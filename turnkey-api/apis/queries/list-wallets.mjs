/**
 * LIST WALLETS
 * Endpoint: POST /public/v1/query/list_wallets
 *
 * Returns all wallets in the organization.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, no `type` or `timestampMs` needed.
 *  - A "wallet" is a BIP-39 HD seed. It is NOT a single address — it's the root
 *    that you derive accounts (addresses) from.
 *  - Each wallet has accounts (derived addresses) on different chains.
 *    list_wallets does NOT return those accounts — use list_wallet_accounts for that.
 *  - `exported` / `imported` flags tell you whether the seed has ever left Turnkey's
 *    enclave (useful for compliance/audit conversations).
 *
 * Usage: node apis/queries/list-wallets.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const result = await stampedFetch("/public/v1/query/list_wallets", {
  organizationId,
});

const parsed = JSON.parse(result.body);

console.log("\n--- Response ---");
console.log("Status      :", result.status);
console.log("Wallet count:", parsed.wallets?.length ?? 0);

for (const wallet of parsed.wallets ?? []) {
  console.log("\n  walletId  :", wallet.walletId);
  console.log("  walletName:", wallet.walletName);
  console.log("  exported  :", wallet.exported);
  console.log("  imported  :", wallet.imported);
  console.log("  createdAt :", wallet.createdAt?.seconds);
}

if (result.status !== 200) {
  console.error("\n⚠ Non-200 response");
  console.error("Raw body:", result.body);
}

// ---------------------------------------------------------------------------
// ERROR SCENARIO: missing organizationId
// Shows the error shape when a required field is omitted entirely.
// ---------------------------------------------------------------------------
console.log("\n--- Error Scenario (missing organizationId) ---");

const errorResult = await stampedFetch("/public/v1/query/list_wallets", {});

const errorParsed = JSON.parse(errorResult.body);

console.log("Status          :", errorResult.status);
console.log("code            :", errorParsed.code);
console.log("message         :", errorParsed.message);
console.log("turnkeyErrorCode:", errorParsed.turnkeyErrorCode);
