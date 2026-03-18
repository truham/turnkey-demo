/**
 * EXPORT WALLET
 * Endpoint: POST /public/v1/submit/export_wallet
 *
 * Exports a wallet's mnemonic phrase, encrypted to a client-side public key.
 *
 * Key interview points:
 *  - SUBMIT endpoint — type is ACTIVITY_TYPE_EXPORT_WALLET.
 *  - Turnkey NEVER returns the mnemonic in plaintext. It encrypts it to a
 *    `targetPublicKey` you generate client-side. Only the holder of the
 *    corresponding private key can decrypt it.
 *  - This is the "enclave secure channel" pattern — the mnemonic goes from
 *    Turnkey's enclave directly to the client, encrypted end-to-end.
 *    Neither Turnkey nor your backend server ever sees the plaintext.
 *  - `targetPublicKey` — uncompressed P-256 public key (hex, no 0x prefix).
 *    In a real app this is generated in the user's browser, never leaves the client.
 *  - `exportBundle` in the result is an encrypted blob — useless without the
 *    matching private key to decrypt it.
 *  - `language` — BIP-39 mnemonic language (default: English).
 *  - After export, `wallet.exported` flag is set to true on the wallet object.
 *    This is permanent and visible in get_wallet / list_wallets — useful for
 *    compliance auditing ("has this wallet ever been exported?").
 *  - Pair with export_wallet_account to export a single private key instead
 *    of the full mnemonic.
 *  - Policy note: the existing "Deny all exports" policy in this org blocks
 *    non-root users from exporting. Root quorum bypasses it.
 *
 * Usage: node apis/activities/export-wallet.mjs
 */

import { generateP256KeyPair, decryptExportBundle } from "@turnkey/crypto";
import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const WALLET_ID = "4462d40d-34d7-52f3-a63c-b8ace24ade21";

// ---------------------------------------------------------------------------
// Scenario 1: export a wallet mnemonic
//
// In a real app: generateP256KeyPair() runs in the browser, privateKey never
// leaves the client. Here we do it server-side just to demo the full flow.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Export wallet mnemonic ---");

// Step 1: generate a fresh keypair client-side
// privateKey stays with the client — Turnkey never sees it
// publicKeyUncompressed is the 65-byte (130 hex char) uncompressed P-256 key
// Turnkey requires uncompressed format for targetPublicKey
const { publicKey, publicKeyUncompressed, privateKey } =
  await generateP256KeyPair();
console.log("targetPublicKey (uncompressed):", publicKeyUncompressed);

// Step 2: submit export_wallet with the target public key
const r1 = await stampedFetch("/public/v1/submit/export_wallet", {
  type: "ACTIVITY_TYPE_EXPORT_WALLET",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    walletId: WALLET_ID,
    targetPublicKey: publicKeyUncompressed,
    language: "MNEMONIC_LANGUAGE_ENGLISH",
  },
});

const p1 = JSON.parse(r1.body);
const act1 = p1.activity;
const exportBundle = act1?.result?.exportWalletResult?.exportBundle;

console.log("Status         :", r1.status);
console.log("activityStatus :", act1?.status);
console.log("walletId       :", act1?.result?.exportWalletResult?.walletId);
console.log(
  "exportBundle   :",
  exportBundle?.substring(0, 60) + "... (encrypted)"
);

if (r1.status !== 200) {
  console.error("⚠ Error:", p1.message);
  process.exit(1);
}

// Step 3: decrypt the bundle client-side using the private key
// In a real app this happens in the browser — mnemonic never touches the server
const mnemonic = await decryptExportBundle({
  exportBundle,
  embeddedKey: privateKey,
  organizationId,
  returnMnemonic: true,
});

console.log("\nDecrypted mnemonic:", mnemonic);
console.log("(12 or 24 words — the actual seed phrase for this wallet)");

// ---------------------------------------------------------------------------
// Scenario 2: verify wallet.exported flag is set after export
//
// Once exported, the wallet is permanently flagged — useful for compliance.
// get_wallet will show exported: true from this point on.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Verify wallet.exported flag ---");

const r2 = await stampedFetch("/public/v1/query/get_wallet", {
  organizationId,
  walletId: WALLET_ID,
});

const wallet = JSON.parse(r2.body).wallet;
console.log("walletName :", wallet.walletName);
console.log("exported   :", wallet.exported); // true after Scenario 1
console.log("imported   :", wallet.imported);
console.log("(exported flag is permanent — cannot be unset)");

// ---------------------------------------------------------------------------
// Scenario 3 (error): export with a wrong wallet ID
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): invalid wallet ID ---");

const { publicKeyUncompressed: pub3 } = await generateP256KeyPair();

const r3 = await stampedFetch("/public/v1/submit/export_wallet", {
  type: "ACTIVITY_TYPE_EXPORT_WALLET",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    walletId: "00000000-0000-0000-0000-000000000000",
    targetPublicKey: pub3,
    language: "MNEMONIC_LANGUAGE_ENGLISH",
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("message :", p3.message);
