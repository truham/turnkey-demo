/**
 * WHO AM I?
 * Endpoint: POST /public/v1/query/whoami
 *
 * Returns the identity of the API key making the request:
 * which org it belongs to, and which user it's scoped to.
 *
 * Key interview points:
 *  - This is a QUERY endpoint (read-only). No `type` or `timestampMs` needed in the body.
 *  - Only requires `organizationId` in the body.
 *  - If you're a WebAuthn user and don't know your sub-org ID yet, you can pass the
 *    parent org ID here — Turnkey will resolve it. But prefer sub-org ID when known (perf).
 *  - Great first call to verify your API key + org ID are wired up correctly.
 *
 * Usage: node apis/whoami.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const result = await stampedFetch("/public/v1/query/whoami", {
  organizationId,
});

const parsed = JSON.parse(result.body);
console.log({ parsed });

console.log("\n--- Response ---");
console.log("Status           :", result.status);
console.log("organizationId   :", parsed.organizationId);
console.log("organizationName :", parsed.organizationName);
console.log("userId           :", parsed.userId);
console.log("username         :", parsed.username);

if (result.status !== 200) {
  console.error(
    "\n⚠ Non-200 — check your API keys and TURNKEY_ORGANIZATION_ID in .env"
  );
  console.error("Raw body:", result.body);
}

// ---------------------------------------------------------------------------
// ERROR SCENARIO: bad organizationId
// What does a Turnkey error response actually look like?
// ---------------------------------------------------------------------------
console.log("\n--- Error Scenario (bad organizationId) ---");

// Valid UUID format but org doesn't exist → different error than malformed input
const errorResult = await stampedFetch("/public/v1/query/whoami", {
  organizationId: "00000000-0000-0000-0000-000000000000",
});

const errorParsed = JSON.parse(errorResult.body);
console.log({ errorParsed });
console.log("Status          :", errorResult.status);
console.log("code            :", errorParsed.code); // gRPC status code (e.g. 5 = NOT_FOUND, 7 = PERMISSION_DENIED)
console.log("message         :", errorParsed.message);
console.log("turnkeyErrorCode:", errorParsed.turnkeyErrorCode); // Turnkey-specific error enum
