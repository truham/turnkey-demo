/**
 * SIGN RAW PAYLOAD
 * Endpoint: POST /public/v1/submit/sign_raw_payload
 *
 * Signs an arbitrary raw payload using a wallet account's private key.
 * The private key never leaves Turnkey's secure enclave — only the signature
 * is returned.
 *
 * Key interview points:
 *  - SUBMIT endpoint — consumes 1 signature from your monthly quota.
 *    Free tier: 25/month. Pay-as-you-go: $0.10/signature after that.
 *  - Type is ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2.
 *  - `signWith` — the wallet ACCOUNT ADDRESS (not wallet ID, not user ID).
 *    Turnkey uses the address to look up which key to sign with.
 *  - `payload` — the raw bytes to sign, as a hex string (0x-prefixed) or UTF-8.
 *  - `encoding` — how the payload is encoded:
 *      PAYLOAD_ENCODING_HEXADECIMAL  → 0x-prefixed hex (most common for ETH)
 *      PAYLOAD_ENCODING_TEXT_UTF8    → plain text string
 *      PAYLOAD_ENCODING_EIP712       → typed structured data (MetaMask-style)
 *  - `hashFunction` — applied to the payload BEFORE signing:
 *      HASH_FUNCTION_KECCAK256       → Ethereum (applied automatically for ETH)
 *      HASH_FUNCTION_SHA256          → Solana, Bitcoin
 *      HASH_FUNCTION_NO_OP           → payload is already hashed, sign as-is
 *      HASH_FUNCTION_NOT_APPLICABLE  → used with EIP-712 encoding
 *  - Result: ECDSA signature components r, s, v
 *      r + s → the 64-byte signature (r is 32 bytes, s is 32 bytes)
 *      v     → recovery ID (27 or 28 for ETH, used to recover the public key)
 *    Combine as: signature = "0x" + r + s + v  (for ETH)
 *  - This is what the SDK's signRawPayload() calls under the hood —
 *    used for signing messages, EIP-712 typed data, custom auth challenges, etc.
 *  - sign_transaction is the sibling endpoint — takes a full serialized
 *    unsigned tx instead of raw bytes. Use sign_raw_payload for arbitrary data,
 *    sign_transaction for structured blockchain transactions.
 *
 * ⚠️  QUOTA WARNING: each run of Scenario 1 burns 1 signature.
 *     Check remaining quota with list_activities filtered by SIGN_RAW_PAYLOAD.
 *     Comment out Scenario 1 after running once to preserve the output.
 *
 *     429 Resource exhausted — what you see when quota is fully used:
 *       "Signing is disabled because your organization is over its allotted quota.
 *        Please upgrade to a paid plan, or reach out to help@turnkey.com"
 *     Note: quota check happens at the API gateway BEFORE business logic —
 *     even an invalid signWith address returns 429 (not 400) when over quota.
 *
 * Usage: node apis/activities/sign-raw-payload.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Wallet account address to sign with — ETH account at m/44'/60'/0'/0/0
// obtained via list_wallets_accounts on WALLET_ID below.
const SIGN_WITH_ADDRESS = "0x5325D53839a8270B88b0cc18eE951643985d047B";
const WALLET_ID = "4462d40d-34d7-52f3-a63c-b8ace24ade21"; // run list_wallets_accounts on this to see all addresses

// ---------------------------------------------------------------------------
// Scenario 1: sign a simple UTF-8 message
// "Hello from Turnkey" — the classic "sign message" flow used for
// wallet ownership proofs, login challenges, NFT auth, etc.
// Costs 1 signature. Comment out after first run.
//
// LAST KNOWN OUTPUT (when quota available):
//   Status         : 200
//   activityStatus : ACTIVITY_STATUS_COMPLETED
//   activityId     : 019cedfa-6c4a-7f4b-8746-2e52bcc7c824
//   signWith       : 0x5325D53839a8270B88b0cc18eE951643985d047B
//   payload        : Hello from Turnkey
//   r : d103ec13ff39884366a4f618d6449822d6de391fd5432b2afcf759947058e986
//   s : 1294b22a8c0236456bb11c7cca91f689341bad10be4b07e742e0e840716da04b
//   v : 00
//   signature: 0xd103ec13ff39884366a4f618d6449822d6de391fd5432b2afcf759947058e986
//             1294b22a8c0236456bb11c7cca91f689341bad10be4b07e742e0e840716da04b00
//   (65 bytes total — r:32 + s:32 + v:1)
//
// OVER QUOTA OUTPUT (429):
//   Status         : 429
//   ⚠ Error: Resource exhausted: Signing is disabled because your organization
//            is over its allotted quota. Please upgrade to a paid plan.
//   Note: quota check fires BEFORE address validation — even invalid signWith
//         returns 429 (not 400) when over quota.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Sign a UTF-8 message (costs 1 signature) ---");

// const r1 = await stampedFetch("/public/v1/submit/sign_raw_payload", {
//   type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
//   timestampMs: Date.now().toString(),
//   organizationId,
//   parameters: {
//     signWith: SIGN_WITH_ADDRESS,
//     payload: "Hello from Turnkey",
//     encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
//     hashFunction: "HASH_FUNCTION_KECCAK256", // ETH standard: keccak256 the message before signing
//   },
// });

// const p1 = JSON.parse(r1.body);
// const act1 = p1.activity;
// const res1 = act1?.result?.signRawPayloadResult;

// console.log("Status         :", r1.status);
// console.log("activityStatus :", act1?.status);
// console.log("activityId     :", act1?.id);
// console.log("signWith       :", act1?.intent?.signRawPayloadIntentV2?.signWith);
// console.log("payload        :", act1?.intent?.signRawPayloadIntentV2?.payload);

// console.log("\n  r :", res1?.r);
// console.log("  s :", res1?.s);
// console.log("  v :", res1?.v);

// // Combine r+s+v into a full 65-byte ETH signature
// if (res1?.r && res1?.s && res1?.v) {
//   const vHex = parseInt(res1.v).toString(16).padStart(2, "0");
//   console.log("\n  signature (0x + r + s + v):", `0x${res1.r}${res1.s}${vHex}`);
// }

// if (r1.status !== 200) {
//   console.error("⚠ Error:", p1.message ?? p1.details?.[0]?.turnkeyErrorCode);
// }

// ---------------------------------------------------------------------------
// Scenario 2: sign a hex-encoded payload (pre-hashed)
// Use HASH_FUNCTION_NO_OP when the payload is already a 32-byte hash.
// Common when integrating with protocols that pre-hash before sending to signer.
// This also costs 1 signature — commented out to preserve quota.
//
// ACTUAL OUTPUT (run live with 0xaaa...aaa as payload):
//   r : a09448ba09aae51471d8ae6d6331a894c806f1d7f9cd2e3440c7a58d1c60c90e
//   s : 733a0b364393a68a12cf620188730fd03dfe8f45d413815f425e7c7880ae2194
//   v : 01
// ---------------------------------------------------------------------------
// console.log("\n--- Scenario 2: Sign a pre-hashed hex payload ---");

// const PREHASHED = "0x" + "a".repeat(64); // 32 bytes of 0xaa (demo hash)

// const r2 = await stampedFetch("/public/v1/submit/sign_raw_payload", {
//   type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
//   timestampMs: Date.now().toString(),
//   organizationId,
//   parameters: {
//     signWith: SIGN_WITH_ADDRESS,
//     payload: PREHASHED,
//     encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
//     hashFunction: "HASH_FUNCTION_NO_OP", // already hashed — sign as-is
//   },
// });
// const res2 = JSON.parse(r2.body).activity?.result?.signRawPayloadResult;
// console.log("r:", res2?.r, "s:", res2?.s, "v:", res2?.v);

// ---------------------------------------------------------------------------
// Scenario 3 (error): invalid signWith address
// Returns 404 — "Could not find any resource to sign with. Addresses are case sensitive."
// Note: address lookup is case-sensitive — 0xABC and 0xabc are different.
// Common mistake: passing a walletId instead of the account address.
//
// NOTE: when quota is exhausted this returns 429 BEFORE address validation.
// We hit this live during development — both Scenario 1 and this scenario
// returned 429 simultaneously because quota enforcement fires first at the
// API gateway, before Turnkey processes the request body at all.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): invalid signWith address ---");
console.log(
  "(returns 404 normally, 429 when over quota — quota check fires first)"
);

const r3 = await stampedFetch("/public/v1/submit/sign_raw_payload", {
  type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    signWith: "0x0000000000000000000000000000000000000000", // not a real account
    payload: "Hello",
    encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
    hashFunction: "HASH_FUNCTION_KECCAK256",
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("message :", p3.message);

// ACTUAL OUTPUT when over quota (hit live during development):
//   Status  : 429
//   message : Resource exhausted: Signing is disabled because your organization
//             is over its allotted quota. Please upgrade to a paid plan, or
//             reach out to the Turnkey team (help@turnkey.com) for more information.
//
// EXPECTED OUTPUT when quota is available:
//   Status  : 404
//   message : Could not find any resource to sign with. Addresses are case sensitive.
