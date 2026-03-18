/**
 * GET POLICY
 * Endpoint: POST /public/v1/query/get_policy
 *
 * Fetches full details about a single policy by ID.
 *
 * Key interview points:
 *  - QUERY endpoint — needs organizationId + policyId.
 *  - Returns the complete policy definition:
 *      effect    — EFFECT_ALLOW or EFFECT_DENY
 *      consensus — the WHO expression (which users match)
 *      condition — the WHAT expression (which activities match)
 *      notes     — human-readable description
 *  - Complement to list_policies: use list_policies to find policy IDs,
 *    then get_policy to inspect the full expression on a specific one.
 *  - Support use case: "why is this user's activity being blocked/allowed?"
 *    → list_policies to see all active policies
 *    → get_policy on each DENY policy to read its condition expression
 *    → check if the expression matches the blocked activity
 *  - consensus/condition are CEL-like expressions — they may be absent if
 *    the policy was created without them (broadest possible scope).
 *
 * Usage: node apis/queries/get-policy.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Scenario 1: get an ALLOW policy with both consensus and condition
// "Only the root user can sign ETH transactions on mainnet (chain 1)"
// Shows the full policy expression — who + what.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: ALLOW policy with consensus + condition ---");

const ALLOW_POLICY_ID = "a403a33e-782e-4aff-9e7a-d01a98faa361";

const r1 = await stampedFetch("/public/v1/query/get_policy", {
  organizationId,
  policyId: ALLOW_POLICY_ID,
});

const pol1 = JSON.parse(r1.body).policy;

console.log("Status     :", r1.status);
console.log("policyId   :", pol1?.policyId);
console.log("policyName :", pol1?.policyName);
console.log("effect     :", pol1?.effect);
console.log("consensus  :", pol1?.consensus ?? "(none — any user matches)");
console.log("condition  :", pol1?.condition ?? "(none — any activity matches)");
console.log("notes      :", pol1?.notes);
console.log("createdAt  :", pol1?.createdAt?.seconds);

// ---------------------------------------------------------------------------
// Scenario 2: get a DENY policy with condition only
// "Block all export activities org-wide"
// No consensus = applies to ALL users. condition = only export activities.
// DENY always beats ALLOW — this is the override policy pattern.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: DENY policy with condition only ---");

const DENY_POLICY_ID = "22daf293-fc30-4668-b2a0-e03ae42d49a0";

const r2 = await stampedFetch("/public/v1/query/get_policy", {
  organizationId,
  policyId: DENY_POLICY_ID,
});

const pol2 = JSON.parse(r2.body).policy;

console.log("Status     :", r2.status);
console.log("policyId   :", pol2?.policyId);
console.log("policyName :", pol2?.policyName);
console.log("effect     :", pol2?.effect);
console.log("consensus  :", pol2?.consensus ?? "(none — applies to ALL users)");
console.log("condition  :", pol2?.condition);
console.log("notes      :", pol2?.notes);

// ---------------------------------------------------------------------------
// Scenario 3 (error): policyId not found
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): policyId not found ---");

const r3 = await stampedFetch("/public/v1/query/get_policy", {
  organizationId,
  policyId: "00000000-0000-0000-0000-000000000000",
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("code    :", p3.code, "(5 = NOT_FOUND)");
console.log("message :", p3.message);
