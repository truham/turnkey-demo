/**
 * GET USER
 * Endpoint: POST /public/v1/query/get_user
 *
 * Fetches full details about a single user by ID.
 *
 * Key interview points:
 *  - QUERY endpoint — read-only, just organizationId + userId.
 *  - Returns everything attached to a user in one call:
 *      authenticators[]   — passkeys/WebAuthn devices registered to this user
 *      apiKeys[]          — API keys registered to this user (public key + name)
 *      oauthProviders[]   — social login providers (Google, Discord, etc.)
 *      userTags[]         — tags for grouping/policy targeting
 *  - This is the primary support tool for credential questions:
 *      "Why can't this user log in?"   → check authenticators/apiKeys
 *      "What Google account is linked?" → check oauthProviders[].issuer/subject
 *      "When did this user register?"  → createdAt
 *  - credential.type tells you exactly what kind of credential it is:
 *      CREDENTIAL_TYPE_WEBAUTHN_AUTHENTICATOR  → passkey
 *      CREDENTIAL_TYPE_API_KEY_P256            → API key (P-256)
 *      CREDENTIAL_TYPE_OAUTH_KEY_P256          → OAuth/social login
 *      CREDENTIAL_TYPE_OTP_AUTH_KEY_P256       → OTP (email/SMS) session key
 *  - organizationId scopes the lookup — root org key can read users in
 *    any of its sub-orgs by passing the sub-org's ID.
 *
 * Usage: node apis/queries/get-user.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const ROOT_USER_ID = "d496369b-37dd-44ec-a218-c0a7a0069958";

// ---------------------------------------------------------------------------
// Scenario 1: get the root org user
// Shows all credentials attached to our root user — passkey + 2 API keys.
// This is what you'd pull during an interview to show user credential structure.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Root org user ---");

const r1 = await stampedFetch("/public/v1/query/get_user", {
  organizationId,
  userId: ROOT_USER_ID,
});

const u1 = JSON.parse(r1.body).user;
console.log({ u1 });

// console.log("Status      :", r1.status);
// console.log("userId      :", u1?.userId);
// console.log("userName    :", u1?.userName);
// console.log("userEmail   :", u1?.userEmail);
// console.log("createdAt   :", u1?.createdAt?.seconds);

// console.log("\n  API Keys:");
// for (const key of u1?.apiKeys ?? []) {
//   console.log(`    [${key.apiKeyName}]`);
//   console.log(`      id        : ${key.apiKeyId}`);
//   console.log(`      publicKey : ${key.credential?.publicKey}`);
//   console.log(`      type      : ${key.credential?.type}`);
//   console.log(`      expires   : ${key.expirationSeconds ?? "(never)"}`);
// }

// console.log("\n  Authenticators (passkeys):");
// for (const auth of u1?.authenticators ?? []) {
//   console.log(`    [${auth.authenticatorName}]`);
//   console.log(`      id        : ${auth.authenticatorId}`);
//   console.log(`      model     : ${auth.model}`);
//   console.log(`      transports: ${auth.transports?.join(", ")}`);
//   console.log(`      type      : ${auth.credential?.type}`);
// }

// console.log("\n  OAuth Providers:");
// if (u1?.oauthProviders?.length === 0) {
//   console.log("    (none)");
// }
// for (const p of u1?.oauthProviders ?? []) {
//   console.log(
//     `    [${p.providerName}] issuer: ${p.issuer} subject: ${p.subject}`
//   );
// }

// ---------------------------------------------------------------------------
// Scenario 2: get a user in a sub-org
// Same call, different organizationId — root org key can read sub-org users.
// Real-world: "look up the credentials for this specific end-user"
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Sub-org user ---");

const SUB_ORG_ID = "8a1d5b1a-40c8-405d-ae8f-b2c90ac502e5";
const SUB_USER_ID = "0ebff92f-3e23-49e6-8ac4-92d44873e682";

const r2 = await stampedFetch("/public/v1/query/get_user", {
  organizationId: SUB_ORG_ID,
  userId: SUB_USER_ID,
});

const u2 = JSON.parse(r2.body).user;

console.log("Status      :", r2.status);
console.log("userId      :", u2?.userId);
console.log("userName    :", u2?.userName);
console.log("userEmail   :", u2?.userEmail);

console.log("\n  API Keys:");
for (const key of u2?.apiKeys ?? []) {
  console.log(
    `    [${key.apiKeyName}] publicKey: ${key.credential?.publicKey}`
  );
}

console.log(
  "\n  Authenticators:",
  u2?.authenticators?.length === 0 ? "(none)" : ""
);
console.log(
  "  OAuth Providers:",
  u2?.oauthProviders?.length === 0 ? "(none)" : ""
);

// ---------------------------------------------------------------------------
// Scenario 3 (error): userId does not exist in the org
// Returns NOT_FOUND (code 5) — user ID is valid UUID format but unknown.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): userId not found ---");

const r3 = await stampedFetch("/public/v1/query/get_user", {
  organizationId,
  userId: "00000000-0000-0000-0000-000000000000",
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("code    :", p3.code, "(5 = NOT_FOUND)");
console.log("message :", p3.message);
