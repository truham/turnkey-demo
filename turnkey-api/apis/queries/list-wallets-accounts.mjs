/**
 * LIST WALLETS ACCOUNTS
 * Endpoint: POST /public/v1/query/list_wallet_accounts
 *
 * Lists all derived accounts (addresses) within a wallet.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, no `type` or `timestampMs` needed.
 *  - A wallet (BIP-39 seed) can have many accounts — each is a derived address
 *    at a specific BIP-32 path (e.g. m/44'/60'/0'/0/0 for ETH index 0).
 *  - `walletId` is optional — omit it to return ALL accounts across ALL wallets
 *    in the org. Include it to scope to a single wallet.
 *  - `includeWalletDetails: true` embeds the parent wallet metadata in each
 *    account object — saves a separate get_wallet call.
 *  - `publicKey` is exposed here — the raw public key for the derived key pair.
 *    This is what gets embedded in signed transactions for verification.
 *  - `curve` tells you the signing algorithm:
 *      SECP256K1 → Ethereum/Bitcoin
 *      ED25519   → Solana
 *      P256      → passkey / WebAuthn-native
 *
 * Usage: node apis/queries/list-wallets-accounts.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Sub-org and wallet from our get-sub-organizations.mjs run.
// Swap these out for any sub-org/wallet IDs you want to inspect.
const SUB_ORG_ID = "5b2306e7-d9ac-4ff5-9cbd-961cd23abdd1";
const WALLET_ID = "4d70c137-1d68-5dc7-8d2f-3aab3a4fbf31"; // "My New Wallet"

// ---------------------------------------------------------------------------
// Scenario 1: list all accounts for a specific wallet
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: List accounts for a wallet ---");

const result = await stampedFetch("/public/v1/query/list_wallet_accounts", {
  organizationId: SUB_ORG_ID,
  walletId: WALLET_ID,
  includeWalletDetails: true,
  paginationOptions: { limit: "10" },
});

const parsed = JSON.parse(result.body);

console.log("Status        :", result.status);
console.log("Account count :", parsed.accounts?.length ?? 0);

for (const acct of parsed.accounts ?? []) {
  console.log("\n  walletAccountId:", acct.walletAccountId);
  console.log("  address        :", acct.address);
  console.log("  addressFormat  :", acct.addressFormat); // ETHEREUM, SOLANA, etc.
  console.log("  path           :", acct.path); // BIP-32 derivation path
  console.log("  curve          :", acct.curve); // SECP256K1 or ED25519
  console.log("  publicKey      :", acct.publicKey);
  console.log("  wallet.name    :", acct.walletDetails?.walletName);
  console.log("  wallet.exported:", acct.walletDetails?.exported);
}

if (result.status !== 200) {
  console.error("\n⚠ Non-200 response");
  console.error("Raw body:", result.body);
}

// ---------------------------------------------------------------------------
// Scenario 2: omit walletId — returns ALL accounts across ALL wallets in the org
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 2: All accounts across all wallets (no walletId) ---"
);

const allResult = await stampedFetch("/public/v1/query/list_wallet_accounts", {
  organizationId: SUB_ORG_ID,
  // walletId omitted intentionally
  paginationOptions: { limit: "10" },
});

const allParsed = JSON.parse(allResult.body);

console.log("Status        :", allResult.status);
console.log("Account count :", allParsed.accounts?.length ?? 0);

for (const acct of allParsed.accounts ?? []) {
  console.log(`  [${acct.walletId}] ${acct.addressFormat} → ${acct.address}`);
}

// ---------------------------------------------------------------------------
// Scenario 3 (error): walletId that doesn't exist in this org
// Expected: 404 NOT_FOUND (code 5)
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): walletId not found ---");

const errResult = await stampedFetch("/public/v1/query/list_wallet_accounts", {
  organizationId: SUB_ORG_ID,
  walletId: "00000000-0000-0000-0000-000000000000",
});

const errParsed = JSON.parse(errResult.body);

console.log("Status          :", errResult.status);
console.log("code            :", errParsed.code); // 5 = NOT_FOUND
console.log("message         :", errParsed.message);
console.log("turnkeyErrorCode:", errParsed.turnkeyErrorCode);
