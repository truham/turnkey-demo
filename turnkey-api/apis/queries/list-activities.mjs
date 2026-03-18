/**
 * LIST ACTIVITIES
 * Endpoint: POST /public/v1/query/list_activities
 *
 * Returns the full audit log of all activities in an organization.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, no `type` or `timestampMs` needed.
 *  - Every submit (write) operation creates an Activity record — this is the
 *    complete audit trail: who did what, when, and with what result.
 *  - `filterByStatus` narrows to a specific lifecycle state:
 *      ACTIVITY_STATUS_COMPLETED       → succeeded
 *      ACTIVITY_STATUS_PENDING         → in flight (rare for most ops)
 *      ACTIVITY_STATUS_CONSENSUS_NEEDED→ parked waiting for approvals
 *      ACTIVITY_STATUS_FAILED          → errored
 *      ACTIVITY_STATUS_REJECTED        → denied by a policy or approver
 *  - `filterByType` takes an ARRAY of type strings — passing a single string
 *    returns 400. Note the enum is versioned (CREATE_POLICY_V3,
 *    CREATE_SUB_ORGANIZATION_V7, etc.) — filter on the current version or
 *    you'll miss recent activities.
 *  - `filterByStatus` also takes an ARRAY.
 *  - `paginationOptions.limit` is a string (not a number) — common gotcha.
 *  - Activities are scoped per org — root org activities won't show sub-org
 *    activities and vice versa.
 *
 * Usage: node apis/queries/list-activities.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Scenario 1: all recent activities in the root org (last 20)
// This shows everything we've done this session — wallets created,
// policies created and deleted, etc.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: All recent activities (root org) ---");

const allResult = await stampedFetch("/public/v1/query/list_activities", {
  organizationId,
  paginationOptions: { limit: "20" },
});

const allParsed = JSON.parse(allResult.body);

console.log("Status         :", allResult.status);
console.log("Activity count :", allParsed.activities?.length ?? 0);

for (const act of allParsed.activities ?? []) {
  console.log(`\n  [${act.createdAt?.seconds}] ${act.type}`);
  console.log("  id     :", act.id);
  console.log("  status :", act.status);
}

if (allResult.status !== 200) {
  console.error("\n⚠ Non-200 response:", allParsed.message);
}

// ---------------------------------------------------------------------------
// Scenario 2: filter by type — only wallet creation activities
// Useful for auditing: "show me every time a wallet was created"
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Filter by type — CREATE_WALLET only ---");

const walletResult = await stampedFetch("/public/v1/query/list_activities", {
  organizationId,
  filterByType: ["ACTIVITY_TYPE_CREATE_WALLET"], // must be an array — string returns 400
  paginationOptions: { limit: "10" },
});

const walletParsed = JSON.parse(walletResult.body);

console.log("Status         :", walletResult.status);
console.log("Activity count :", walletParsed.activities?.length ?? 0);

for (const act of walletParsed.activities ?? []) {
  const walletId = act.result?.createWalletResult?.walletId;
  const addresses = act.result?.createWalletResult?.addresses;
  console.log(`\n  id       : ${act.id}`);
  console.log(`  status   : ${act.status}`);
  console.log(`  walletId : ${walletId}`);
  console.log(`  addresses: ${addresses}`);
}

// ---------------------------------------------------------------------------
// Scenario 3: filter by status — CONSENSUS_NEEDED
// Shows any activities parked waiting for approvals.
// In a fresh org with no multi-party policies this will be empty —
// but this is what you'd query to find pending approvals in a multi-sig setup.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3: Filter by status — CONSENSUS_NEEDED ---");

const consensusResult = await stampedFetch("/public/v1/query/list_activities", {
  organizationId,
  filterByStatus: ["ACTIVITY_STATUS_CONSENSUS_NEEDED"], // must be an array
  paginationOptions: { limit: "10" },
});

const consensusParsed = JSON.parse(consensusResult.body);

console.log("Status         :", consensusResult.status);
console.log("Activity count :", consensusParsed.activities?.length ?? 0);

if (consensusParsed.activities?.length === 0) {
  console.log("(none — no policies requiring consensus are active)");
}

// ---------------------------------------------------------------------------
// Scenario 4: activities in a sub-org
// Each org has its own independent activity log.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 4: Activities in a sub-org ---");

const SUB_ORG_ID = "5b2306e7-d9ac-4ff5-9cbd-961cd23abdd1";

const subOrgResult = await stampedFetch("/public/v1/query/list_activities", {
  organizationId: SUB_ORG_ID,
  paginationOptions: { limit: "10" },
});

const subOrgParsed = JSON.parse(subOrgResult.body);

console.log("Status         :", subOrgResult.status);
console.log("Activity count :", subOrgParsed.activities?.length ?? 0);

for (const act of subOrgParsed.activities ?? []) {
  console.log(`\n  [${act.createdAt?.seconds}] ${act.type}`);
  console.log("  id     :", act.id);
  console.log("  status :", act.status);
}
