/**
 * GET ACTIVITY
 * Endpoint: POST /public/v1/query/get_activity
 *
 * Fetches the full detail of a single activity by ID.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, no `type` or `timestampMs`.
 *  - This is the #1 support tool. Turnkey support always asks for the
 *    activityId first because the response contains: *      → intent: the exact parameters the client sent
 *      → result: the output (walletId, policyId, addresses, etc.)
 *      → votes[]: who approved/rejected + the raw signed message + signature
 *      → failure: the error code and message if it failed
 *      → fingerprint: SHA-256 of the canonical request body
 *  - votes[].message is the exact JSON that was cryptographically signed —
 *    you can verify the signature against the public key to prove authenticity.
 *  - canApprove / canReject tell you if the *current caller* can still act on
 *    a CONSENSUS_NEEDED activity (useful for building approval UIs).
 *  - orgainzationId must match the org the activity belongs to — querying a
 *    root-org activity with a sub-org ID (or vice versa) returns NOT_FOUND.
 *
 * Usage: node apis/queries/get-activity.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Scenario 1: fetch a completed CREATE_WALLET activity
// Shows the full intent + result — exactly what Turnkey support would pull
// to verify "yes, this wallet was created with these accounts on this date".
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Completed CREATE_WALLET activity ---");

const WALLET_ACTIVITY_ID = "019ce9c5-79e1-7192-b34f-6676151ae1e1";

const r1 = await stampedFetch("/public/v1/query/get_activity", {
  organizationId,
  activityId: WALLET_ACTIVITY_ID,
});

const p1 = JSON.parse(r1.body);
console.log({ p1 });
const act1 = p1.activity;

console.log("Status         :", r1.status);
console.log("activityId     :", act1?.id);
console.log("type           :", act1?.type);
console.log("activityStatus :", act1?.status);
console.log("createdAt      :", act1?.createdAt?.seconds);

// intent — what was requested
const intent = act1?.intent?.createWalletIntent;
console.log("\n  intent.walletName :", intent?.walletName);
console.log(
  "  intent.accounts   :",
  intent?.accounts?.map((a) => a.path).join(", ")
);

// result — what was produced
const result = act1?.result?.createWalletResult;
console.log("\n  result.walletId   :", result?.walletId);
console.log("  result.addresses  :", result?.addresses?.join(", "));

// votes — who approved and with what key
const vote = act1?.votes?.[0];
console.log("\n  vote.userId       :", vote?.userId);
console.log("  vote.selection    :", vote?.selection);
console.log("  vote.scheme       :", vote?.scheme);
console.log("  vote.publicKey    :", vote?.publicKey);
// vote.message is the exact raw body that was signed — verifiable
console.log("  vote.message      :", vote?.message?.slice(0, 80) + "...");

// ---------------------------------------------------------------------------
// Scenario 2: fetch a FAILED activity
// Shows the failure object — this is what you give support when something
// breaks. The failure.code maps to gRPC codes (3 = INVALID_ARGUMENT, etc.)
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Failed CREATE_POLICY activity ---");

const FAILED_ACTIVITY_ID = "019cead7-95fe-71d5-b2ae-b75a55774dd0";

const r2 = await stampedFetch("/public/v1/query/get_activity", {
  organizationId,
  activityId: FAILED_ACTIVITY_ID,
});

const p2 = JSON.parse(r2.body);
const act2 = p2.activity;

console.log("Status         :", r2.status);
console.log("activityId     :", act2?.id);
console.log("type           :", act2?.type);
console.log("activityStatus :", act2?.status);

// failure — the error detail
console.log(
  "\n  failure.code    :",
  act2?.failure?.code,
  "(3 = INVALID_ARGUMENT)"
);
console.log("  failure.message :", act2?.failure?.message);

// ---------------------------------------------------------------------------
// Scenario 3 (error): wrong org ID — activity belongs to root org,
// querying with a sub-org ID returns PERMISSION_DENIED (code 7), not NOT_FOUND.
// Turnkey distinguishes "doesn't exist" from "exists but belongs to another org"
// — the message explicitly names both IDs, which makes it easy to diagnose.
// Classic support gotcha: customer queries the wrong org.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): activityId exists but wrong orgId ---");

const WRONG_ORG_ID = "5b2306e7-d9ac-4ff5-9cbd-961cd23abdd1"; // sub-org

const r3 = await stampedFetch("/public/v1/query/get_activity", {
  organizationId: WRONG_ORG_ID,
  activityId: WALLET_ACTIVITY_ID, // root-org activity
});

const p3 = JSON.parse(r3.body);

console.log("Status  :", r3.status);
console.log(
  "code    :",
  p3.code,
  "(7 = PERMISSION_DENIED — activity exists but belongs to a different org)"
);
console.log("message :", p3.message);
