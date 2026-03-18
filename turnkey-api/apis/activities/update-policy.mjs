/**
 * UPDATE POLICY
 * Endpoint: POST /public/v1/submit/update_policy
 *
 * Mutates an existing policy in-place — same policyId, new condition/effect/name.
 *
 * Key interview points:
 *  - SUBMIT endpoint — lives under /submit/ because it creates an auditable activity.
 *  - Activity type is ACTIVITY_TYPE_UPDATE_POLICY_V2 — note the _V2 suffix,
 *    unlike delete_policy which has no version suffix.
 *  - update_policy is a full REPLACE, not a patch. Any field you omit goes blank.
 *    Always pass policyName, policyEffect, policyCondition, and policyNotes even
 *    if only one changed. Field names differ from create_policy: policyEffect not
 *    effect, policyCondition not condition, policyNotes not notes.
 *  - Effect values: "EFFECT_ALLOW" or "EFFECT_DENY". Changing ALLOW → DENY on an
 *    existing policy is a fast way to block an action without deleting the policy.
 *  - Condition syntax is CEL (Common Expression Language). Turnkey parses eth.tx.*
 *    fields only for sign_transaction — sign_raw_payload has no structured fields
 *    to match against, so eth.tx.* conditions won't fire there.
 *  - result path: activity.result.updatePolicyResult.policy (full updated policy object)
 *  - Updating a non-existent policyId returns 404 NOT_FOUND.
 *
 * Usage: node apis/activities/update-policy.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const RUN_ID = Date.now();

// ---------------------------------------------------------------------------
// Setup: create a fresh ALLOW policy to mutate across scenarios.
// Using a unique RUN_ID so re-runs don't collide with leftover policies.
// ---------------------------------------------------------------------------
console.log("--- Setup: create base ALLOW policy ---");

const createResult = await stampedFetch("/public/v1/submit/create_policy", {
  type: "ACTIVITY_TYPE_CREATE_POLICY_V3",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    policyName: `Demo ALLOW policy [${RUN_ID}]`,
    effect: "EFFECT_ALLOW",
    condition: "eth.tx.chain_id == 1",
    notes: "Allow any sign_transaction on Ethereum mainnet.",
  },
});

const createParsed = JSON.parse(createResult.body);
const policyId = createParsed.activity?.result?.createPolicyResult?.policyId;

console.log("Created policyId :", policyId);
console.log("Effect           :", "EFFECT_ALLOW");
console.log("Condition        :", "eth.tx.chain_id == 1");

// ---------------------------------------------------------------------------
// Scenario 1: update the condition (broaden to cover both mainnet and testnet)
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Update condition — add Sepolia chain_id ---");

const r1 = await stampedFetch("/public/v1/submit/update_policy", {
  type: "ACTIVITY_TYPE_UPDATE_POLICY_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    policyId,
    policyName: `Demo ALLOW policy [${RUN_ID}]`, // unchanged
    policyEffect: "EFFECT_ALLOW", // unchanged
    policyCondition: "eth.tx.chain_id == 1 || eth.tx.chain_id == 11155111",
    policyNotes: "Broadened: allow mainnet (1) and Sepolia testnet (11155111).",
  },
});

const p1 = JSON.parse(r1.body);
const updated1 = p1.activity?.result?.updatePolicyResult?.policy;

console.log("Status          :", r1.status);
console.log("activityStatus  :", p1.activity?.status);
// updatePolicyResult only echoes the policyId — call get_policy to see updated fields
const getR1 = await stampedFetch("/public/v1/query/get_policy", {
  organizationId,
  policyId,
});
const policy1 = JSON.parse(getR1.body).policy;
console.log("New condition   :", policy1?.condition);
console.log("Effect          :", policy1?.effect);
// Note: update_policy is a REPLACE — always send all fields.
// Omitting policyName or effect would blank them out on the policy.
// Note: update_policy is a REPLACE — always send all fields.
// Omitting policyName or effect would blank them out on the policy.

// ---------------------------------------------------------------------------
// Scenario 2: flip effect ALLOW → DENY (same condition)
// This is the fastest way to temporarily block an action without deleting
// the policy — flip it back to ALLOW to re-enable without recreating.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Flip effect ALLOW → DENY (same condition) ---");

const r2 = await stampedFetch("/public/v1/submit/update_policy", {
  type: "ACTIVITY_TYPE_UPDATE_POLICY_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    policyId,
    policyName: `Demo ALLOW policy [${RUN_ID}]`,
    policyEffect: "EFFECT_DENY", // <-- flipped
    policyCondition: "eth.tx.chain_id == 1 || eth.tx.chain_id == 11155111",
    policyNotes:
      "Temporarily blocked — flip back to EFFECT_ALLOW to re-enable.",
  },
});

const p2 = JSON.parse(r2.body);
const updated2 = p2.activity?.result?.updatePolicyResult?.policy;

console.log("Status          :", r2.status);
console.log("activityStatus  :", p2.activity?.status);
console.log("Effect before   :", "EFFECT_ALLOW");
// call get_policy to confirm the flip
const getR2 = await stampedFetch("/public/v1/query/get_policy", {
  organizationId,
  policyId,
});
const policy2 = JSON.parse(getR2.body).policy;
console.log("Effect after    :", policy2?.effect);
// Interview point: DENY always beats ALLOW in Turnkey's policy engine.
// Flipping to DENY is an instant "kill switch" for a specific action type —
// no need to delete and recreate the policy with the right condition later.

// ---------------------------------------------------------------------------
// Scenario 3 (error): update a policy ID that doesn't exist
// Expected: 404 NOT_FOUND
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): update non-existent policyId ---");

const r3 = await stampedFetch("/public/v1/submit/update_policy", {
  type: "ACTIVITY_TYPE_UPDATE_POLICY_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    policyId: "00000000-0000-0000-0000-000000000000",
    policyName: "Ghost policy",
    policyEffect: "EFFECT_ALLOW",
    policyCondition: "true",
    policyNotes: "",
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status          :", r3.status); // 404
console.log("code            :", p3.code);
console.log("message         :", p3.message);
console.log("turnkeyErrorCode:", p3.turnkeyErrorCode);

// ---------------------------------------------------------------------------
// Cleanup: delete the demo policy
// ---------------------------------------------------------------------------
console.log("\n--- Cleanup: delete demo policy ---");

const cleanupResult = await stampedFetch("/public/v1/submit/delete_policy", {
  type: "ACTIVITY_TYPE_DELETE_POLICY",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: { policyId },
});

const cleanupParsed = JSON.parse(cleanupResult.body);
console.log(
  "Deleted:",
  cleanupParsed.activity?.result?.deletePolicyResult?.policyId
);
