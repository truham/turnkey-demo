/**
 * GET SUB-ORGANIZATIONS
 * Endpoint: POST /public/v1/query/list_suborgs
 *
 * Returns sub-org IDs under the root org. Optionally filter by a specific
 * user attribute to look up a single user's sub-org without pagination.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, no `type` or `timestampMs` needed.
 *  - Each end user in an embedded wallet app gets their own sub-org.
 *    Sub-orgs are isolated: users in sub-org A cannot see sub-org B's resources.
 *  - The root org API key has READ-ONLY access to all sub-orgs just by passing
 *    the sub-org's organizationId in the body. No credential swap needed.
 *  - To submit activities in a sub-org (e.g. sign a tx), you need the sub-org
 *    user's own credentials (their passkey or their sub-org API key).
 *  - filterType options: CREDENTIAL_ID, NAME, USERNAME, EMAIL, PHONE_NUMBER,
 *    OIDC_TOKEN, WALLET_ACCOUNT_ADDRESS, PUBLIC_KEY
 *    → Real-world use: "find the sub-org for user@example.com" instead of
 *      paginating through all sub-orgs manually.
 *  - paginationOptions.limit is a STRING, not a number (common gotcha).
 *
 * Usage: node apis/queries/get-sub-organizations.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Step 1: list all sub-orgs (no filter)
// ---------------------------------------------------------------------------
const suborgsResult = await stampedFetch("/public/v1/query/list_suborgs", {
  organizationId,
  paginationOptions: { limit: "10" },
});

const suborgs = JSON.parse(suborgsResult.body);

console.log("\n--- All Sub-Organizations ---");
console.log("Status :", suborgsResult.status);
console.log("Count  :", suborgs.organizationIds?.length ?? 0);
console.log("IDs    :", suborgs.organizationIds);

if (suborgsResult.status !== 200) {
  console.error("\n⚠ Non-200 response");
  console.error("Raw body:", suborgsResult.body);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 2: filter by EMAIL — look up a specific user's sub-org directly.
// Real-world: customer says "I lost access to my wallet" → find their sub-org
// by email without paginating through all orgs.
// Swap in a real email from your embedded wallet app to see this work.
// ---------------------------------------------------------------------------
console.log("\n--- Filter by EMAIL ---");

const filterResult = await stampedFetch("/public/v1/query/list_suborgs", {
  organizationId,
  filterType: "EMAIL",
  filterValue: "hamiltontruong@gmail.com", // ← swap in a real user email to test
});

const filtered = JSON.parse(filterResult.body);

console.log("Status :", filterResult.status);
console.log("Matched:", filtered.organizationIds?.length ?? 0, "sub-org(s)");
console.log("IDs    :", filtered.organizationIds);

// ---------------------------------------------------------------------------
// Step 3: for each sub-org, list its wallets using the SAME root API key.
// This proves you don't need a separate API key per sub-org for reads.
// ---------------------------------------------------------------------------
const subOrgIds = suborgs.organizationIds ?? [];

if (subOrgIds.length === 0) {
  console.log(
    "\nNo sub-orgs found — create one via the embedded wallet app first."
  );
  process.exit(0);
}

console.log("\n--- Wallets per Sub-Org (using root API key) ---");

for (const subOrgId of subOrgIds) {
  const walletsResult = await stampedFetch("/public/v1/query/list_wallets", {
    organizationId: subOrgId, // ← sub-org ID, not root org ID
  });

  const wallets = JSON.parse(walletsResult.body);

  console.log(`\nSub-org: ${subOrgId}`);
  console.log("  Wallet count:", wallets.wallets?.length ?? 0);

  for (const wallet of wallets.wallets ?? []) {
    console.log("    walletId  :", wallet.walletId);
    console.log("    walletName:", wallet.walletName);
    console.log("    exported  :", wallet.exported);
    console.log("    imported  :", wallet.imported);
  }
}
