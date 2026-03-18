/**
 * GET WALLET ACCOUNT
 * Endpoint: POST /public/v1/query/get_wallet_account
 *
 * Fetches a single wallet account by address OR by BIP-32 path.
 * You only need one of the two — address is more common in practice.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, no `type` or `timestampMs` needed.
 *  - Requires organizationId + walletId + (address OR path).
 *  - Use this when you know the address and want the full account metadata:
 *    which wallet it belongs to, what path it was derived at, its public key.
 *  - Real-world use: a user gives you their ETH address, you verify it's
 *    actually managed by Turnkey and which wallet/org it belongs to.
 *  - `publicKey` here is the compressed public key (33 bytes, "03..." prefix
 *    for SECP256K1). The Ethereum address is derived from this via keccak256.
 *
 * Usage: node apis/queries/get-wallet-account.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const SUB_ORG_ID = "5b2306e7-d9ac-4ff5-9cbd-961cd23abdd1";
const WALLET_ID = "4d70c137-1d68-5dc7-8d2f-3aab3a4fbf31";

// ---------------------------------------------------------------------------
// Step 1: look up by address (most common in practice)
// ---------------------------------------------------------------------------
console.log("\n--- Get by Address (ETH) ---");

const byAddress = await stampedFetch("/public/v1/query/get_wallet_account", {
  organizationId: SUB_ORG_ID,
  walletId: WALLET_ID,
  address: "0x079d8B6BC1FB480786f56636803269AA1b618c7e",
});

const acct1 = JSON.parse(byAddress.body).account;

console.log("Status         :", byAddress.status);
console.log("address        :", acct1?.address);
console.log("addressFormat  :", acct1?.addressFormat);
console.log("path           :", acct1?.path);
console.log("curve          :", acct1?.curve);
console.log("publicKey      :", acct1?.publicKey);
console.log("wallet.name    :", acct1?.walletDetails?.walletName);

// ---------------------------------------------------------------------------
// Step 2: look up by path — same account, different lookup key
// ---------------------------------------------------------------------------
console.log("\n--- Get by Path (Solana) ---");

const byPath = await stampedFetch("/public/v1/query/get_wallet_account", {
  organizationId: SUB_ORG_ID,
  walletId: WALLET_ID,
  path: "m/44'/501'/0'/0'",
});

const acct2 = JSON.parse(byPath.body).account;

console.log("Status         :", byPath.status);
console.log("address        :", acct2?.address);
console.log("addressFormat  :", acct2?.addressFormat);
console.log("path           :", acct2?.path);
console.log("curve          :", acct2?.curve);
console.log("publicKey      :", acct2?.publicKey);

// ---------------------------------------------------------------------------
// ERROR SCENARIO: address that doesn't exist in this wallet
// ---------------------------------------------------------------------------
console.log("\n--- Error Scenario (address not in this wallet) ---");

const errResult = await stampedFetch("/public/v1/query/get_wallet_account", {
  organizationId: SUB_ORG_ID,
  walletId: WALLET_ID,
  address: "0x0000000000000000000000000000000000000000",
});

const errParsed = JSON.parse(errResult.body);

console.log("Status          :", errResult.status);
console.log("code            :", errParsed.code);
console.log("message         :", errParsed.message);
console.log("turnkeyErrorCode:", errParsed.turnkeyErrorCode);
