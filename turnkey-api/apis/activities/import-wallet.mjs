/**
 * IMPORT WALLET
 * Endpoints:
 *   Step 1: POST /public/v1/submit/init_import_wallet
 *   Step 2: POST /public/v1/submit/import_wallet
 *
 * Imports a user's existing mnemonic into Turnkey's enclave.
 * This is the inverse of export_wallet — same enclave secure channel,
 * opposite direction.
 *
 * Key interview points:
 *  - TWO-STEP flow, just like export:
 *      Step 1: init_import_wallet → get the enclave's importBundle (contains
 *              the enclave's public key)
 *      Step 2: encrypt your mnemonic to that enclave public key client-side,
 *              then call import_wallet with the encryptedBundle
 *  - The mnemonic is encrypted client-side before it ever leaves the browser/app.
 *    Turnkey's backend only ever sees the encrypted blob — never the plaintext.
 *    This is the same enclave secure channel as export, just in reverse.
 *  - After import, wallet.imported = true in get_wallet — same compliance flag
 *    pattern as wallet.exported.
 *  - The importBundle from Step 1 is single-use — it's tied to one import flow.
 *    If you call init again, you get a fresh bundle.
 *  - encryptWalletToBundle from @turnkey/crypto handles the client-side
 *    encryption — takes the mnemonic + importBundle, outputs encryptedBundle.
 *  - userId is required — the wallet is scoped to a specific user in the org.
 *  - Attempting to import a mnemonic that already exists in the org returns an
 *    error — Turnkey deduplicates by wallet fingerprint.
 *
 * Usage: node apis/activities/import-wallet.mjs
 */

import { encryptWalletToBundle, generateP256KeyPair } from "@turnkey/crypto";
import { generateMnemonic } from "bip39";
import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Root user ID — the wallet will be imported under this user
const ROOT_USER_ID = "d496369b-37dd-44ec-a218-c0a7a0069958";

// Generate a fresh random mnemonic each run — avoids 409 duplicate seed errors.
// In a real app the user provides their own existing mnemonic (e.g. from MetaMask).
const FRESH_MNEMONIC = generateMnemonic();
console.log("Fresh mnemonic (random each run):", FRESH_MNEMONIC);

// ---------------------------------------------------------------------------
// Scenario 1: full import flow — init → encrypt → import
// Shows the complete enclave secure channel in the "inbound" direction.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Full import flow ---");

// Step 1: init_import_wallet — get the enclave's public key
console.log("\nStep 1: init_import_wallet");

const initResult = await stampedFetch("/public/v1/submit/init_import_wallet", {
  type: "ACTIVITY_TYPE_INIT_IMPORT_WALLET",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId: ROOT_USER_ID,
  },
});

const initParsed = JSON.parse(initResult.body);
const importBundle =
  initParsed.activity?.result?.initImportWalletResult?.importBundle;

console.log("Status      :", initResult.status);
console.log("activityStatus:", initParsed.activity?.status);
console.log(
  "importBundle:",
  importBundle?.substring(0, 60) + "... (enclave public key + signature)"
);
// importBundle contains the enclave's public key and a signature proving it
// came from a genuine Turnkey enclave — not a man-in-the-middle key

// Step 2: encrypt mnemonic client-side to the enclave's public key
// In a real app this runs in the browser — the plaintext mnemonic never
// touches the server or Turnkey's API
console.log("\nStep 2: encrypt mnemonic client-side");

const { privateKey: embeddedKey } = await generateP256KeyPair();

const encryptedBundle = await encryptWalletToBundle({
  mnemonic: FRESH_MNEMONIC,
  importBundle,
  embeddedKey,
  organizationId,
  userId: ROOT_USER_ID,
});

console.log(
  "encryptedBundle:",
  encryptedBundle?.substring(0, 60) + "... (mnemonic encrypted to enclave key)"
);

// Step 3: import_wallet — send the encrypted bundle to Turnkey
console.log("\nStep 3: import_wallet");

const RUN_ID = Date.now();

const importResult = await stampedFetch("/public/v1/submit/import_wallet", {
  type: "ACTIVITY_TYPE_IMPORT_WALLET",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId: ROOT_USER_ID,
    walletName: `Imported Wallet [${RUN_ID}]`,
    encryptedBundle,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
  },
});

const importParsed = JSON.parse(importResult.body);
const importedWalletId =
  importParsed.activity?.result?.importWalletResult?.walletId;
const importedAddresses =
  importParsed.activity?.result?.importWalletResult?.addresses;

console.log("Status         :", importResult.status);
console.log("activityStatus :", importParsed.activity?.status);
console.log("walletId       :", importedWalletId);
console.log("addresses      :", importedAddresses);
// NOTE: the "abandon x11 + about" mnemonic is a well-known test seed that
// always derives 0x9858EfFD232B4033E47d90003D41EC34EcaEda94 on ETH mainnet.
// After the first run this will 409 — the seed is already in the org.
// That's expected — Scenario 3 demonstrates this exact error deliberately.

// ---------------------------------------------------------------------------
// Scenario 2: verify wallet.imported flag is set
// Mirrors export_wallet Scenario 2 — imported: true is permanent, just like
// exported: true. Tells you this wallet came from outside Turnkey.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Verify wallet.imported flag ---");

// Fall back to the known walletId from the first successful run if re-running
const KNOWN_IMPORTED_WALLET_ID = "60468065-b3c1-568e-8dd1-547565208a09";
const walletIdToCheck = importedWalletId ?? KNOWN_IMPORTED_WALLET_ID;
const walletResult = await stampedFetch("/public/v1/query/get_wallet", {
  organizationId,
  walletId: walletIdToCheck,
});
const wallet = JSON.parse(walletResult.body).wallet;
console.log("walletName :", wallet?.walletName);
console.log("imported   :", wallet?.imported); // true
console.log("exported   :", wallet?.exported); // false — never been exported
console.log(
  "(imported flag is permanent — signals wallet originated outside Turnkey)"
);

// ---------------------------------------------------------------------------
// Scenario 3 (error): import the same mnemonic again
// Turnkey deduplicates by wallet fingerprint — same seed = same wallet.
// Returns an error rather than silently creating a duplicate.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): duplicate mnemonic import ---");

const initResult2 = await stampedFetch("/public/v1/submit/init_import_wallet", {
  type: "ACTIVITY_TYPE_INIT_IMPORT_WALLET",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: { userId: ROOT_USER_ID },
});

const importBundle2 = JSON.parse(initResult2.body).activity?.result
  ?.initImportWalletResult?.importBundle;

const { privateKey: embeddedKey2 } = await generateP256KeyPair();
const encryptedBundle2 = await encryptWalletToBundle({
  mnemonic: FRESH_MNEMONIC, // same mnemonic as Scenario 1 — will 409
  importBundle: importBundle2,
  embeddedKey: embeddedKey2,
  organizationId,
  userId: ROOT_USER_ID,
});

const dupResult = await stampedFetch("/public/v1/submit/import_wallet", {
  type: "ACTIVITY_TYPE_IMPORT_WALLET",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId: ROOT_USER_ID,
    walletName: `Duplicate Import [${RUN_ID}]`,
    encryptedBundle: encryptedBundle2,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
  },
});

const dupParsed = JSON.parse(dupResult.body);
console.log("Status         :", dupResult.status);
console.log("activityStatus :", dupParsed.activity?.status);
console.log(
  "message        :",
  dupParsed.message ?? dupParsed.activity?.failure?.message
);
// Turnkey prevents duplicate wallets — same seed fingerprint = same wallet
