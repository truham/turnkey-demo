/**
 * CREATE POLICY
 * Endpoint: POST /public/v1/submit/create_policy
 *
 * Creates a new policy in the organization.
 *
 * Key interview points:
 *  - SUBMIT endpoint — /submit/ not /query/.
 *  - Type is ACTIVITY_TYPE_CREATE_POLICY_V3 — note the V3. Versioned endpoints
 *    are common in Turnkey; always check the docs for the current version.
 *  - Parameters: policyName, effect, condition, consensus, notes (all in `parameters {}`).
 *  - `policyName` must be unique within the org → duplicate names return 400.
 *  - `condition` and `consensus` are both optional:
 *      omit condition  → policy applies to ALL activity types
 *      omit consensus  → ANY authenticated user matches
 *      omit both       → broadest possible policy
 *  - Result is at activity.result.createPolicyResult.policyId
 *  - Root quorum bypasses ALL policies — DENY policies won't block root users.
 *    They matter for non-root users and sub-org automation keys.
 *
 * Policy language quick reference:
 *  consensus keywords: approvers (list<User>), credentials (list<Credential>)
 *  condition keywords: activity, eth.tx, wallet, wallet_account, private_key
 *  operators: ==, !=, in, &&, ||, .any(), .all(), .filter(), .count()
 *
 * Usage: node apis/activities/create-policy.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Root user ID from whoami.mjs — used in consensus expressions below
const ROOT_USER_ID = "d496369b-37dd-44ec-a218-c0a7a0069958";

// Helper to create a policy and log the result
async function createPolicy({ name, effect, consensus, condition, notes }) {
  const result = await stampedFetch("/public/v1/submit/create_policy", {
    type: "ACTIVITY_TYPE_CREATE_POLICY_V3",
    timestampMs: Date.now().toString(),
    organizationId,
    parameters: {
      policyName: name,
      effect,
      notes: notes ?? "", // notes is required — always send, even empty string is OK
      ...(consensus && { consensus }), // omit entirely if not provided — empty string fails parse
      ...(condition && { condition }), // omit entirely if not provided — empty string fails parse
    },
  });

  const parsed = JSON.parse(result.body);
  const activity = parsed.activity;
  const policyResult = activity?.result?.createPolicyResult;

  console.log("Status         :", result.status);
  console.log("activityStatus :", activity?.status);
  console.log("policyId       :", policyResult?.policyId);

  if (result.status !== 200) {
    const errMsg =
      parsed.message ?? parsed.details?.[0]?.turnkeyErrorCode ?? result.body;
    console.error("⚠ Error:", errMsg);
  }

  return policyResult?.policyId;
}

// ---------------------------------------------------------------------------
// Scenario 1: ALLOW with consensus only
// "Only the root user can take any action."
// consensus = WHO;  no condition = applies to ALL activity types.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: ALLOW — specific user (consensus only) ---");

const p1 = await createPolicy({
  name: "Allow root user - all activities",
  effect: "EFFECT_ALLOW",
  consensus: `approvers.any(user, user.id == '${ROOT_USER_ID}')`,
  notes:
    "Grants the root user explicit ALLOW on all activities (condition-free).",
});

// ---------------------------------------------------------------------------
// Scenario 2: ALLOW with condition only
// "Anyone can sign, but only to this specific ETH address."
// condition = WHAT;  no consensus = any authenticated user matches.
// Real-world use: hot wallet that can only send to a whitelisted address.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 2: ALLOW — ETH address allowlist (condition only) ---"
);

const p2 = await createPolicy({
  name: "Allow signing to whitelisted ETH address",
  effect: "EFFECT_ALLOW",
  condition: "eth.tx.to == '0x0000000000000000000000000000000000000000'",
  notes:
    "Only allow signing ETH transactions to the zero address (demo allowlist).",
});

// ---------------------------------------------------------------------------
// Scenario 3: DENY with condition
// "Block all export activities org-wide."
// EFFECT_DENY always beats EFFECT_ALLOW — but root quorum bypasses ALL policies.
// In this org, we are root quorum (1 of 1), so this policy won't block us.
// To actually see it block:
//   → create a non-root API key inside this org via create_api_keys
//   → stamp a request with that key — it would get OUTCOME_DENY
// Real-world use: compliance requirement that keys must never leave the enclave,
// enforced against automation keys while operators can still recover if needed.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3: DENY — block all exports ---");

const p3 = await createPolicy({
  name: "Deny all exports",
  effect: "EFFECT_DENY",
  condition: "activity.action == 'EXPORT'",
  notes:
    "Hard block on all export activities. Root quorum still bypasses this.",
});

// ---------------------------------------------------------------------------
// Scenario 4: ALLOW with both consensus AND condition
// "Only the root user can sign transactions, and only on ETH mainnet (chain 1)."
// consensus + condition = tightest policy: WHO + WHAT must both match.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 4: ALLOW — consensus + condition (user + chain ID) ---"
);

const p4 = await createPolicy({
  name: "Allow root user to sign on ETH mainnet only",
  effect: "EFFECT_ALLOW",
  consensus: `approvers.any(user, user.id == '${ROOT_USER_ID}')`,
  condition: "eth.tx.chain_id == 1",
  notes: "Root user can only sign ETH transactions on mainnet (chain ID 1).",
});

// ---------------------------------------------------------------------------
// Scenario 5 (error): duplicate policy name
// policyName must be unique within the org.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 5 (error): duplicate policy name ---");

await createPolicy({
  name: "Allow root user - all activities", // same name as Scenario 1 (already exists)
  effect: "EFFECT_ALLOW",
});

// ---------------------------------------------------------------------------
// Summary: run list-policies to confirm all 4 were created
// ---------------------------------------------------------------------------
console.log("\n--- Summary: all policy IDs created this run ---");
console.log("p1 (allow, consensus only) :", p1);
console.log("p2 (allow, condition only) :", p2);
console.log("p3 (deny, exports)         :", p3);
console.log("p4 (allow, both)           :", p4);
console.log(
  "\nRun list-policies.mjs to see them, delete-policy.mjs to clean up."
);
