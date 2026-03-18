/**
 * LIST POLICIES
 * Endpoint: POST /public/v1/query/list_policies
 *
 * Returns all policies defined in an organization.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, no `type` or `timestampMs` needed.
 *  - Policies live at the org level — each org (root or sub-org) has its own
 *    independent set of policies.
 *  - A policy has 3 core fields:
 *      effect    → EFFECT_ALLOW or EFFECT_DENY
 *      consensus → WHO is allowed (evaluated against the list of approvers)
 *      condition → WHAT the activity must look like (evaluated against the payload)
 *  - Both consensus and condition are optional — omitting one means "match anything"
 *    for that dimension.
 *  - `notes` is a free-text field for documenting intent — useful for audits.
 *  - Evaluation order (critical):
 *      1. Root quorum approves?    → ALWAYS ALLOW (bypasses all policies)
 *      2. Any EFFECT_DENY matches? → DENY  (explicit deny always wins)
 *      3. Any EFFECT_ALLOW matches?→ ALLOW
 *      4. Nothing matches?         → DENY  (implicit deny — default is blocked)
 *
 * Usage: node apis/queries/list-policies.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Scenario 1: list all policies in the root org
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: List policies in root org ---");

const result = await stampedFetch("/public/v1/query/list_policies", {
  organizationId,
});

const parsed = JSON.parse(result.body);

console.log("Status        :", result.status);
console.log("Policy count  :", parsed.policies?.length ?? 0);

for (const policy of parsed.policies ?? []) {
  console.log("\n  policyId   :", policy.policyId);
  console.log("  policyName :", policy.policyName);
  console.log("  effect     :", policy.effect); // EFFECT_ALLOW or EFFECT_DENY
  console.log("  consensus  :", policy.consensus); // WHO — approver expression
  console.log("  condition  :", policy.condition); // WHAT — activity/tx expression
  console.log("  notes      :", policy.notes);
  console.log("  createdAt  :", policy.createdAt?.seconds);
}

if (result.status !== 200) {
  console.error("\n⚠ Non-200 response");
  console.error("Raw body:", result.body);
}

// ---------------------------------------------------------------------------
// Scenario 2: list policies in a sub-org
// Each org has its own independent policy set — a sub-org's policies only
// govern activities within that sub-org.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: List policies in a sub-org ---");

const SUB_ORG_ID = "5b2306e7-d9ac-4ff5-9cbd-961cd23abdd1";

const subOrgResult = await stampedFetch("/public/v1/query/list_policies", {
  organizationId: SUB_ORG_ID,
});

const subOrgParsed = JSON.parse(subOrgResult.body);

console.log("Status        :", subOrgResult.status);
console.log("Policy count  :", subOrgParsed.policies?.length ?? 0);

for (const policy of subOrgParsed.policies ?? []) {
  console.log("\n  policyId   :", policy.policyId);
  console.log("  policyName :", policy.policyName);
  console.log("  effect     :", policy.effect);
  console.log("  consensus  :", policy.consensus);
  console.log("  condition  :", policy.condition);
  console.log("  notes      :", policy.notes);
}
