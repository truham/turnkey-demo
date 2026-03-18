/**
 * GET AUTHENTICATOR
 * Endpoint: POST /public/v1/query/get_authenticator
 *
 * Fetches full details about a single authenticator (passkey/WebAuthn device)
 * by its authenticatorId.
 *
 * Key interview points:
 *  - Companion to get_authenticators — use the list call to find the ID, then
 *    this call to drill into a specific device.
 *  - Returns the same fields as get_authenticators items but scoped to one:
 *      authenticatorId   — unique ID
 *      authenticatorName — human-readable label set at registration time
 *      model             — "Security key", "Touch ID", "YubiKey", etc.
 *      transports[]      — INTERNAL (built-in biometric), USB, NFC, BLE, HYBRID
 *      credentialId      — the WebAuthn credential ID (base64url, set by the
 *                          authenticator hardware itself, not Turnkey)
 *      credential.type   — always CREDENTIAL_TYPE_WEBAUTHN_AUTHENTICATOR
 *      aaguid            — authenticator model GUID, identifies the device make
 *                          (e.g. all YubiKey 5s share the same aaguid)
 *  - Support use case: customer says "I think my hardware key is compromised" —
 *    pull the authenticator, confirm the model and credentialId match the device
 *    they actually registered, then advise delete + re-register.
 *  - Returns 404 NOT_FOUND if authenticatorId doesn't exist in the org.
 *
 * Usage: node apis/queries/get-authenticator.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Authenticator ID from get_authenticators output (root user's passkey)
const AUTHENTICATOR_ID = "a4c30bb5-7cfa-49fc-a5d2-b21232c5c442";

// ---------------------------------------------------------------------------
// Scenario 1: get the root user's registered passkey
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Get root user's passkey ---");

const r1 = await stampedFetch("/public/v1/query/get_authenticator", {
  organizationId,
  authenticatorId: AUTHENTICATOR_ID,
});

const auth = JSON.parse(r1.body).authenticator;

console.log("Status           :", r1.status);
console.log("authenticatorId  :", auth?.authenticatorId);
console.log("authenticatorName:", auth?.authenticatorName);
console.log("model            :", auth?.model);
console.log("transports       :", auth?.transports?.join(", "));
console.log("credentialId     :", auth?.credentialId);
console.log("aaguid           :", auth?.aaguid);
console.log("attestationType  :", auth?.attestationType);
console.log("credential.type  :", auth?.credential?.type);
console.log("createdAt        :", auth?.createdAt?.seconds);
// aaguid identifies the authenticator model — all devices of the same make/model
// share the same aaguid. Useful for confirming "is this the YubiKey they claimed?"

// ---------------------------------------------------------------------------
// Scenario 2 (error): authenticatorId not found
// Returns 404 NOT_FOUND — unlike get_authenticators (plural) which returns
// an empty array, the singular get_authenticator does return a proper 404.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2 (error): authenticatorId not found ---");

const r2 = await stampedFetch("/public/v1/query/get_authenticator", {
  organizationId,
  authenticatorId: "00000000-0000-0000-0000-000000000000",
});

const p2 = JSON.parse(r2.body);
console.log("Status  :", r2.status);
console.log("code    :", p2.code, "(5 = NOT_FOUND)");
console.log("message :", p2.message);
// Contrast with get_authenticators (plural) which returns 200 + empty array
// for unknown userId. Single-resource gets are stricter — 404 on bad ID.
