/**
 * DELETE POLICY
 * Endpoint: POST /public/v1/submit/delete_policy
 *
 * Deletes an existing policy by ID.
 *
 * Key interview points:
 *  - SUBMIT endpoint — /submit/ not /query/.
 *  - Simplest submit body: just type, timestampMs, organizationId, and
 *    parameters.policyId. No versioning (no _V2/_V3) unlike create_policy.
 *  - Result is at activity.result.deletePolicyResult.policyId — echoes
 *    back the deleted ID to confirm what was removed.
 *  - Deleting a non-existent policyId returns 404 NOT_FOUND.
 *  - There is no "soft delete" — deletion is immediate and permanent.
 *  - After deletion, run list-policies to confirm the org is clean.
 *
 * Usage: node apis/activities/delete-policy.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Scenario 1: query list_policies first, then delete whatever exists
// No hardcoded IDs — works regardless of which policies are currently in the org.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Delete all existing policies ---");

const listResult = await stampedFetch("/public/v1/query/list_policies", {
  organizationId,
});

const existing = JSON.parse(listResult.body);
const policies = existing.policies ?? [];

console.log("Found", policies.length, "policy/policies to delete.");

for (const policy of policies) {
  const result = await stampedFetch("/public/v1/submit/delete_policy", {
    type: "ACTIVITY_TYPE_DELETE_POLICY",
    timestampMs: Date.now().toString(),
    organizationId,
    parameters: {
      policyId: policy.policyId,
    },
  });

  const parsed = JSON.parse(result.body);
  const activity = parsed.activity;
  const deletedId = activity?.result?.deletePolicyResult?.policyId;

  console.log(`\n  "${policy.policyName}"`);
  console.log("  Status         :", result.status);
  console.log("  activityStatus :", activity?.status);
  console.log("  deletedPolicyId:", deletedId);

  if (result.status !== 200) {
    console.error("  ⚠ Error:", parsed.message ?? result.body);
  }
}

// ---------------------------------------------------------------------------
// Scenario 2 (error): delete a policy ID that doesn't exist
// Expected: 404 NOT_FOUND (code 5)
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2 (error): delete non-existent policyId ---");

const errResult = await stampedFetch("/public/v1/submit/delete_policy", {
  type: "ACTIVITY_TYPE_DELETE_POLICY",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    policyId: "00000000-0000-0000-0000-000000000000",
  },
});

const errParsed = JSON.parse(errResult.body);

console.log("Status          :", errResult.status);
console.log("code            :", errParsed.code);
console.log("message         :", errParsed.message);
console.log("turnkeyErrorCode:", errParsed.turnkeyErrorCode);

// ---------------------------------------------------------------------------
// Confirm: list policies to show org is clean
// ---------------------------------------------------------------------------
console.log("\n--- Confirm: list policies after deletion ---");

const confirmResult = await stampedFetch("/public/v1/query/list_policies", {
  organizationId,
});

const confirmParsed = JSON.parse(confirmResult.body);
console.log(
  "Policy count:",
  confirmParsed.policies?.length ?? 0,
  "(should be 0)"
);
