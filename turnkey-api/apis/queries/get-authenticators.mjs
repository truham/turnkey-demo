/**
 * GET AUTHENTICATORS
 * Endpoint: POST /public/v1/query/get_authenticators
 *
 * Returns all passkeys/WebAuthn devices registered to a specific user.
 * Note: named "get_authenticators" not "list_authenticators" — consistent with
 * Turnkey's pattern of using get_ for both single and multi-record fetches.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, requires organizationId + userId.
 *  - Authenticators are the human-in-the-loop auth method (biometrics, hardware
 *    keys) as opposed to API keys which are programmatic. A user can have both.
 *  - Each authenticator has:
 *      authenticatorId   — unique ID to reference it (use in get_authenticator)
 *      authenticatorName — human-readable label set at registration
 *      model             — device type e.g. "Security key", "Touch ID"
 *      transports[]      — how the device communicates:
 *                            INTERNAL = built-in (Face ID, Touch ID)
 *                            USB/NFC/BLE = external hardware key
 *                            HYBRID = cross-device (phone as security key)
 *      credential.type   — always CREDENTIAL_TYPE_WEBAUTHN_AUTHENTICATOR here
 *  - Common support use case: "I lost my phone / hardware key, how do I recover?"
 *    → list_authenticators to see what's registered, then remove the lost one
 *    and add the new device via create_authenticators.
 *  - If a user has NO authenticators and NO API keys → they are completely locked
 *    out. Recovery requires root quorum action.
 *
 * Usage: node apis/queries/get-authenticators.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Root user ID — has one passkey registered (our Face ID / Touch ID device)
const ROOT_USER_ID = "d496369b-37dd-44ec-a218-c0a7a0069958";

// ---------------------------------------------------------------------------
// Scenario 1: list authenticators for the root user
// Shows the passkey registered during Turnkey account setup.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: List authenticators for root user ---");

const r1 = await stampedFetch("/public/v1/query/get_authenticators", {
  organizationId,
  userId: ROOT_USER_ID,
});

const auths = JSON.parse(r1.body).authenticators ?? [];

console.log("Status             :", r1.status);
console.log("Authenticator count:", auths.length);

for (const auth of auths) {
  console.log(`\n  [${auth.authenticatorName}]`);
  console.log("  authenticatorId :", auth.authenticatorId);
  console.log("  model           :", auth.model);
  console.log("  transports      :", auth.transports?.join(", "));
  console.log("  credentialId    :", auth.credentialId);
  console.log("  credential.type :", auth.credential?.type);
  console.log("  createdAt       :", auth.createdAt?.seconds);
}
// INTERNAL transport = built-in biometric (Face ID / Touch ID) — device-bound,
// cannot be transferred. If user loses the device, root quorum must recover.
// HYBRID = phone can act as a roaming authenticator for another device.

// ---------------------------------------------------------------------------
// Scenario 2: user with no authenticators (API-key-only user)
// Common for programmatic service accounts — no human auth needed.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: API-key-only user (no authenticators) ---");

const SUB_ORG_ID = "8a1d5b1a-40c8-405d-ae8f-b2c90ac502e5";
const SUB_USER_ID = "0ebff92f-3e23-49e6-8ac4-92d44873e682";

const r2 = await stampedFetch("/public/v1/query/get_authenticators", {
  organizationId: SUB_ORG_ID,
  userId: SUB_USER_ID,
});

const auths2 = JSON.parse(r2.body).authenticators ?? [];

console.log("Status             :", r2.status);
console.log("Authenticator count:", auths2.length);
console.log(
  auths2.length === 0
    ? "  (none) — this is a programmatic API-key-only user, no passkey registered"
    : auths2
);
// Interview point: a user with only API keys cannot do passkey-gated actions.
// If a policy requires WebAuthn consensus, this user cannot approve it.

// ---------------------------------------------------------------------------
// Scenario 3: userId does not exist in the org
// Unlike get_user, get_authenticators returns 200 + empty array for unknown
// userIds rather than 404. Always check the array length, not just the status.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3: invalid userId (returns empty, not 404) ---");

const r3 = await stampedFetch("/public/v1/query/get_authenticators", {
  organizationId,
  userId: "00000000-0000-0000-0000-000000000000",
});

const auths3 = JSON.parse(r3.body).authenticators ?? [];
console.log("Status             :", r3.status);
console.log("Authenticator count:", auths3.length);
console.log(
  "(no error — get_authenticators silently returns empty for unknown userId)"
);
