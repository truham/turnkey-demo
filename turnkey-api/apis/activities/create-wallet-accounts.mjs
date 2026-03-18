/**
 * CREATE WALLET ACCOUNTS
 * Endpoint: POST /public/v1/submit/create_wallet_accounts
 *
 * Derives additional accounts from an existing HD wallet.
 *
 * Key interview points:
 *  - SUBMIT endpoint — type is ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS.
 *  - An HD (hierarchical deterministic) wallet has one mnemonic seed. All
 *    accounts are derived from it via BIP-32 paths. Same seed, different path
 *    = different keypair, different address. This is how one wallet can have
 *    infinite addresses without storing multiple private keys.
 *  - BIP-44 path format: m / purpose' / coin_type' / account' / change / index
 *      Ethereum: m/44'/60'/0'/0/0, m/44'/60'/0'/0/1, m/44'/60'/0'/0/2 ...
 *      Solana:   m/44'/501'/0'/0', m/44'/501'/1'/0', m/44'/501'/2'/0' ...
 *  - Paths must be unique within a wallet — reusing a path returns 409 (docs say 400, live API returns 409).
 *  - You can mix curves/address formats in one call — e.g. derive an ETH
 *    account and a Solana account from the same wallet in a single activity.
 *  - Common customer use case: "I need a new deposit address for each user"
 *    → derive m/44'/60'/0'/0/N where N increments per user. All map back
 *    to the same wallet mnemonic, all manageable under one wallet ID.
 *  - Pair with list_wallet_accounts to see all derived accounts.
 *
 * Usage: node apis/activities/create-wallet-accounts.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Using the first test wallet — already has m/44'/60'/0'/0/0 (ETH) and m/44'/501'/0'/0' (SOL)
const WALLET_ID = "4462d40d-34d7-52f3-a63c-b8ace24ade21";

// Dynamically find the next available ETH and SOL path indices
// so this script can be run multiple times without hitting 409 duplicate path
const existingR = await stampedFetch("/public/v1/query/list_wallet_accounts", {
  organizationId,
  walletId: WALLET_ID,
});
const existing = JSON.parse(existingR.body).accounts;

// Find highest ETH index (m/44'/60'/0'/0/N) already derived
const ethIndexes = existing
  .filter((a) => a.path.startsWith("m/44'/60'/0'/0/"))
  .map((a) => parseInt(a.path.split("/").pop()));
const nextEthIndex = (ethIndexes.length ? Math.max(...ethIndexes) : -1) + 1;

// Find highest SOL account index (m/44'/501'/N'/0') already derived
const solIndexes = existing
  .filter((a) => a.path.startsWith("m/44'/501'/"))
  .map((a) => parseInt(a.path.split("'")[2].replace(/\D/g, "")));
const nextSolIndex = (solIndexes.length ? Math.max(...solIndexes) : -1) + 1;

console.log(`Next ETH index: ${nextEthIndex}, Next SOL index: ${nextSolIndex}`);

// ---------------------------------------------------------------------------
// Scenario 1: derive the next Ethereum account (index 1)
//
// Customer scenario: "I need a second Ethereum address from the same wallet."
// Just increment the last path index — same mnemonic, new keypair.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Derive next Ethereum account (index 1) ---");

const r1 = await stampedFetch("/public/v1/submit/create_wallet_accounts", {
  type: "ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    walletId: WALLET_ID,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: `m/44'/60'/0'/0/${nextEthIndex}`, // next available ETH index
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
  },
});

const p1 = JSON.parse(r1.body);
const addresses1 = p1.activity?.result?.createWalletAccountsResult?.addresses;

console.log("Status        :", r1.status);
console.log("activityStatus:", p1.activity?.status);
console.log("New address   :", addresses1?.[0]);
console.log("Path          :", `m/44'/60'/0'/0/${nextEthIndex}`);
console.log("(Different address, same wallet mnemonic as m/44'/60'/0'/0/0)");

// ---------------------------------------------------------------------------
// Scenario 2: derive multiple accounts in one call
//
// You can batch-derive across chains in a single activity.
// Efficient for onboarding a user who needs both ETH and Solana addresses.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 2: Derive multiple accounts in one call (ETH index " +
    (nextEthIndex + 1) +
    " + SOL index " +
    nextSolIndex +
    ") ---"
);

const r2 = await stampedFetch("/public/v1/submit/create_wallet_accounts", {
  type: "ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    walletId: WALLET_ID,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: `m/44'/60'/0'/0/${nextEthIndex + 1}`, // ETH next+1
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
      {
        curve: "CURVE_ED25519",
        pathFormat: "PATH_FORMAT_BIP32",
        path: `m/44'/501'/${nextSolIndex}'/0'`, // Solana next index
        addressFormat: "ADDRESS_FORMAT_SOLANA",
      },
    ],
  },
});

const p2 = JSON.parse(r2.body);
const addresses2 = p2.activity?.result?.createWalletAccountsResult?.addresses;

console.log("Status        :", r2.status);
console.log("activityStatus:", p2.activity?.status);
console.log("New addresses :", addresses2);
console.log("(One ETH + one Solana — both derived from the same mnemonic)");

// ---------------------------------------------------------------------------
// Scenario 3 (error): duplicate path — reusing an existing path
//
// Paths are unique per wallet. m/44'/60'/0'/0/0 already exists → 409 (docs say 400, live API returns 409).
// This is a common customer mistake when they don't track which paths
// have been derived. Best practice: store derived paths in your own DB.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): duplicate path ---");

const r3 = await stampedFetch("/public/v1/submit/create_wallet_accounts", {
  type: "ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    walletId: WALLET_ID,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0", // already exists
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status); // 409 Conflict (not 400 — docs say 400 but live API returns 409)
console.log("message :", p3.message); // includes the conflicting wallet account ID

// ---------------------------------------------------------------------------
// Verify: list all accounts to show full picture
// ---------------------------------------------------------------------------
console.log("\n--- All accounts on wallet after derivation ---");

const r4 = await stampedFetch("/public/v1/query/list_wallet_accounts", {
  organizationId,
  walletId: WALLET_ID,
});

const accounts = JSON.parse(r4.body).accounts;
accounts.forEach((a) => console.log(`  ${a.path.padEnd(22)} | ${a.address}`));
