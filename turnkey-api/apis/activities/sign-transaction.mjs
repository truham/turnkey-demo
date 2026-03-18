/**
 * SIGN TRANSACTION
 * Endpoint: POST /public/v1/submit/sign_transaction
 *
 * Signs a fully structured unsigned transaction. Returns the complete
 * signed transaction ready to broadcast to the network.
 *
 * Key interview points:
 *  - SUBMIT endpoint — consumes 1 signature from quota, same as sign_raw_payload.
 *  - Type is ACTIVITY_TYPE_SIGN_TRANSACTION_V2.
 *  - Key difference from sign_raw_payload:
 *      sign_raw_payload → arbitrary bytes, you control hashing, returns r/s/v
 *      sign_transaction  → structured tx, Turnkey parses it, returns full signed tx
 *  - `unsignedTransaction` — RLP-encoded hex for ETH (EIP-1559 = 0x02 prefix),
 *    base64 for Solana. Typically produced by viem/ethers/web3.js before signing.
 *  - `type` — tells Turnkey which chain format to expect:
 *      TRANSACTION_TYPE_ETHEREUM → RLP-encoded EIP-1559 or legacy tx
 *      TRANSACTION_TYPE_SOLANA   → base64-encoded Solana transaction
 *      TRANSACTION_TYPE_BITCOIN  → Bitcoin PSBT
 *      TRANSACTION_TYPE_TRON     → Tron transaction
 *  - Result is `signedTransaction` — the complete signed tx hex, ready to pass
 *    directly to eth_sendRawTransaction (ETH) or sendTransaction (Solana).
 *    Unlike sign_raw_payload, you don't need to manually assemble r+s+v.
 *  - POLICY ADVANTAGE: because Turnkey parses the tx, policy conditions like
 *      condition: "eth.tx.to == '0x...'"
 *      condition: "eth.tx.chain_id == 1"
 *      condition: "eth.tx.value <= 1000000000000000000"
 *    all work with sign_transaction. They do NOT work with sign_raw_payload
 *    since there's no parsed tx to inspect — just raw bytes.
 *  - The unsigned tx used below is a real EIP-1559 Sepolia tx:
 *      chainId: 11155111 (Sepolia), nonce: 0, to: zero address, value: 0
 *      Built manually via RLP encoding to show what viem produces under the hood.
 *
 * ⚠️  QUOTA WARNING: each successful sign costs $0.10 on pay-as-you-go.
 *     Scenarios 1 and 2 are commented out after first run to preserve output.
 *
 * Usage: node apis/activities/sign-transaction.mjs
 */

import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  stampedFetch,
  stampedFetchWith,
  organizationId,
} from "../../lib/turnkeyClient.mjs";

// Non-root user created via create-users.mjs (userId: 94b55416-a1d2-4961-802e-821a2570bbad)
// This user is NOT root quorum — their activities ARE subject to org policies.
// Root quorum bypass applies to the USER, not just a specific credential.
const NON_ROOT_USER_ID = "94b55416-a1d2-4961-802e-821a2570bbad";
const NON_ROOT_PUBLIC_KEY =
  "03b4613e3dc07e73e512847ea64b5a949076d3c9c5323b2538518803f040b17f38";
const NON_ROOT_PRIVATE_KEY =
  "2f3bbc99c86d7f2aea3a23e8e3ed1c56517589dfe02f043705fa3198dd99a9f3";

const nonRootStamper = new ApiKeyStamper({
  apiPublicKey: NON_ROOT_PUBLIC_KEY,
  apiPrivateKey: NON_ROOT_PRIVATE_KEY,
});

const SIGN_WITH_ADDRESS = "0x5325D53839a8270B88b0cc18eE951643985d047B";

// Minimal unsigned EIP-1559 transaction (Sepolia testnet):
//   chainId: 11155111, nonce: 0, maxPriorityFee: 1gwei, maxFee: 2gwei
//   gasLimit: 21000, to: 0x000...000, value: 0, data: 0x, accessList: []
// Built with viem's serializeTransaction(). The trailing `c0` = empty access
// list RLP-encoded — our earlier manual encoder missed this, causing 400.
const UNSIGNED_ETH_TX =
  "02ea83aa36a780843b9aca0084773594008252089400000000000000000000000000000000000000008080c0";

// ---------------------------------------------------------------------------
// Scenario 1: sign an unsigned ETH transaction (Sepolia)
// Returns the complete signed tx — ready to broadcast via eth_sendRawTransaction.
// Unlike sign_raw_payload, no need to manually assemble r+s+v.
//
// LAST KNOWN OUTPUT (run once — preserved here):
//   Status            : 200
//   activityStatus    : ACTIVITY_STATUS_COMPLETED
//   activityId        : 019cee16-312d-7f50-a399-5c232306c12d
//   signWith          : 0x5325D53839a8270B88b0cc18eE951643985d047B
//   type              : TRANSACTION_TYPE_ETHEREUM
//   signedTransaction : 02f86d83aa36a780843b9aca00847735940082520894000000000000
//                       00000000000000000000000000008080c001a0135dc1ad96aa0a13f01
//                       9f9184987d0c5b59ffe4925e1e371f6c0012c7430b863a030178506dc
//                       a84a7d2f81875cef31102c523fbf39425d79a582a80adbb31dd117
//   → broadcast via: eth_sendRawTransaction("0x" + signedTransaction)
//
// COMMENTED OUT — uncomment to run (costs 1 signature):
// ---------------------------------------------------------------------------
// console.log("\n--- Scenario 1: Sign an unsigned ETH tx (Sepolia) ---");

// const r1 = await stampedFetch("/public/v1/submit/sign_transaction", {
//   type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
//   timestampMs: Date.now().toString(),
//   organizationId,
//   parameters: {
//     signWith: SIGN_WITH_ADDRESS,
//     unsignedTransaction: UNSIGNED_ETH_TX,
//     type: "TRANSACTION_TYPE_ETHEREUM",
//   },
// });

// const p1 = JSON.parse(r1.body);
// const act1 = p1.activity;
// const res1 = act1?.result?.signTransactionResult;

// console.log("Status            :", r1.status);
// console.log("activityStatus    :", act1?.status);
// console.log("activityId        :", act1?.id);
// console.log(
//   "signWith          :",
//   act1?.intent?.signTransactionIntentV2?.signWith
// );
// console.log("type              :", act1?.intent?.signTransactionIntentV2?.type);
// console.log("signedTransaction :", res1?.signedTransaction);
// // To broadcast: eth_sendRawTransaction("0x" + signedTransaction)

// if (r1.status !== 200) {
//   console.error("⚠ Error:", p1.message ?? p1.details?.[0]?.turnkeyErrorCode);
// }

// ---------------------------------------------------------------------------
// Scenario 2: DENY policy blocks a non-root user's sign attempt
//
// Non-root users (created via create_users) ARE subject to policies.
// Root quorum bypass applies to the QUORUM USER — regardless of which key they use.
//
// The existing org-level policy "Allow signing to whitelisted ETH address" already
// grants any user ALLOW to sign to the zero address — no extra ALLOW needed.
// Adding a DENY on the same condition overrides it: DENY always beats ALLOW.
//
// Key insight: Turnkey surfaces DENY as HTTP 403, not ACTIVITY_STATUS_REJECTED.
// REJECTED is only for multi-party flows where a quorum member explicitly votes
// down a pending activity.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: DENY policy blocks non-root user ---");

const RUN_ID = Date.now();

// DENY policy on the zero address (root stamps this)
const denyResult = await stampedFetch("/public/v1/submit/create_policy", {
  type: "ACTIVITY_TYPE_CREATE_POLICY_V3",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    policyName: `Deny sign to zero address [${RUN_ID}]`,
    effect: "EFFECT_DENY",
    condition: "eth.tx.to == '0x0000000000000000000000000000000000000000'",
    notes: "Blocks any tx to the zero address.",
  },
});
const denyPolicyId = JSON.parse(denyResult.body).activity?.result
  ?.createPolicyResult?.policyId;
console.log("DENY policy created :", denyPolicyId);

// Wait for DENY policy to propagate (~3s)
await new Promise((r) => setTimeout(r, 3000));

// Step 3: non-root user tries to sign to zero address → DENY fires → 403
const r2 = await stampedFetchWith(
  nonRootStamper,
  "/public/v1/submit/sign_transaction",
  {
    type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
    timestampMs: Date.now().toString(),
    organizationId,
    parameters: {
      signWith: SIGN_WITH_ADDRESS,
      unsignedTransaction: UNSIGNED_ETH_TX, // to == 0x000...000, matches DENY
      type: "TRANSACTION_TYPE_ETHEREUM",
    },
  }
);

const p2 = JSON.parse(r2.body);
console.log("\nNon-root sign attempt:");
console.log("  HTTP status    :", r2.status); // expect 403
console.log("  message        :", p2.message);
console.log(
  "  signedTx       :",
  p2.activity?.result?.signTransactionResult?.signedTransaction ??
    "(none — blocked)"
);

if (r2.status === 403) {
  console.log("  ✓ DENY policy fired — HTTP 403, sign blocked.");
  console.log("  DENY beats ALLOW. eth.tx.to == zero address matched.");
  console.log("  Root quorum user signing same tx would still get COMPLETED.");
}

// Step 4: clean up
// await stampedFetch("/public/v1/submit/delete_policy", {
//   type: "ACTIVITY_TYPE_DELETE_POLICY",
//   timestampMs: Date.now().toString(),
//   organizationId,
//   parameters: { policyId: allowPolicyId },
// });
await stampedFetch("/public/v1/submit/delete_policy", {
  type: "ACTIVITY_TYPE_DELETE_POLICY",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: { policyId: denyPolicyId },
});
console.log("\nDENY policy deleted.");

// ---------------------------------------------------------------------------
// Scenario 3 (error): malformed unsigned transaction
// Passing garbage hex returns 400 — Turnkey validates the tx format
// before attempting to sign. This is another advantage over sign_raw_payload
// which would sign anything you give it.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): malformed unsigned transaction ---");

const r3 = await stampedFetch("/public/v1/submit/sign_transaction", {
  type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    signWith: SIGN_WITH_ADDRESS,
    unsignedTransaction: "deadbeef", // not a valid RLP-encoded tx
    type: "TRANSACTION_TYPE_ETHEREUM",
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("message :", p3.message);
