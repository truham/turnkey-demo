/**
 * LIST USERS
 * Endpoint: POST /public/v1/query/list_users
 *
 * Lists all users within an organization.
 *
 * Key interview points:
 *  - QUERY endpoint — only needs organizationId, no filters or pagination.
 *  - Returns the same full user shape as get_user, just as an array.
 *  - Root org typically has 1 user (the root user you created at signup).
 *    Sub-orgs also typically have 1 user — the end-user who owns that org.
 *    Multiple users in one org = enterprise/team setup with multi-party policies.
 *  - Each user's credentials tell you how they authenticate:
 *      apiKeys[]        → backend/programmatic access
 *      authenticators[] → passkey/device-bound (browser)
 *      oauthProviders[] → social login (Google, Discord, etc.)
 *  - Support use case: "this user can't log in" →
 *      1. find their sub-org via get_sub_organizations (filter by email)
 *      2. list_users on that sub-org
 *      3. check what credentials they have — maybe their passkey was deleted,
 *         or their OAuth provider isn't linked, or API key expired
 *  - oauthProviders[].issuer identifies the provider:
 *      https://accounts.google.com   → Google
 *      https://discord.com           → Discord
 *
 * Usage: node apis/queries/list-users.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Scenario 1: list users in the root org
// Almost always just 1 user — the root user created at org setup.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Users in root org ---");

const r1 = await stampedFetch("/public/v1/query/list_users", {
  organizationId,
});

const users1 = JSON.parse(r1.body).users ?? [];

console.log("Status     :", r1.status);
console.log("User count :", users1.length);

for (const u of users1) {
  console.log(`\n  [${u.userName}]`);
  console.log("  userId     :", u.userId);
  console.log("  email      :", u.userEmail);
  console.log(
    "  apiKeys    :",
    u.apiKeys?.map((k) => k.apiKeyName).join(", ") || "(none)"
  );
  console.log(
    "  passkeys   :",
    u.authenticators?.map((a) => a.authenticatorName).join(", ") || "(none)"
  );
  console.log(
    "  oauth      :",
    u.oauthProviders?.map((p) => p.providerName).join(", ") || "(none)"
  );
}

// ---------------------------------------------------------------------------
// Scenario 2: list users in a sub-org created via API key
// 1 user — the "API Demo User" we created in create-sub-organization.mjs.
// Has only an API key credential, no passkey or OAuth.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Users in API-key sub-org ---");

const API_SUB_ORG_ID = "8a1d5b1a-40c8-405d-ae8f-b2c90ac502e5";

const r2 = await stampedFetch("/public/v1/query/list_users", {
  organizationId: API_SUB_ORG_ID,
});

const users2 = JSON.parse(r2.body).users ?? [];

console.log("Status     :", r2.status);
console.log("User count :", users2.length);

for (const u of users2) {
  console.log(`\n  [${u.userName}]`);
  console.log("  userId     :", u.userId);
  console.log("  email      :", u.userEmail);
  console.log(
    "  apiKeys    :",
    u.apiKeys?.map((k) => k.apiKeyName).join(", ") || "(none)"
  );
  console.log("  passkeys   :", u.authenticators?.length || 0);
  console.log("  oauth      :", u.oauthProviders?.length || 0);
}

// ---------------------------------------------------------------------------
// Scenario 3: list users in a sub-org created via OAuth (Discord login)
// This is a real end-user sub-org from the SDK app — has an OAuth provider
// linked (Discord) and potentially a passkey from the login flow.
// Shows what a typical consumer app user looks like vs an API-key user.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3: Users in OAuth sub-org (SDK app user) ---");

const OAUTH_SUB_ORG_ID = "5b2306e7-d9ac-4ff5-9cbd-961cd23abdd1";

const r3 = await stampedFetch("/public/v1/query/list_users", {
  organizationId: OAUTH_SUB_ORG_ID,
});

const users3 = JSON.parse(r3.body).users ?? [];

console.log("Status     :", r3.status);
console.log("User count :", users3.length);

for (const u of users3) {
  console.log(`\n  [${u.userName}]`);
  console.log("  userId     :", u.userId);
  console.log("  email      :", u.userEmail);
  console.log(
    "  apiKeys    :",
    u.apiKeys?.map((k) => k.apiKeyName).join(", ") || "(none)"
  );
  console.log(
    "  passkeys   :",
    u.authenticators?.map((a) => a.authenticatorName).join(", ") || "(none)"
  );

  for (const p of u.oauthProviders ?? []) {
    console.log(`  oauth      : [${p.providerName}] issuer: ${p.issuer}`);
  }
  if (u.oauthProviders?.length === 0) {
    console.log("  oauth      : (none)");
  }
}
