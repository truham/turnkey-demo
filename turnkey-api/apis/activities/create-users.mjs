/**
 * CREATE USERS
 * Endpoint: POST /public/v1/submit/create_users
 *
 * Creates one or more users in an existing organization.
 *
 * Key interview points:
 *  - SUBMIT endpoint — type is ACTIVITY_TYPE_CREATE_USERS_V3.
 *  - Adds users to an EXISTING org (root org or sub-org).
 *    Compare to create_sub_organization which creates a brand new isolated org.
 *    Use create_users when you want multi-user collaboration within one org.
 *  - Each user needs at least one auth method: apiKeys, authenticators, oauthProviders.
 *    All three arrays are REQUIRED in the body — pass [] for unused ones.
 *  - `userTags` — optional grouping for policy consensus expressions.
 *    e.g. consensus: "approvers.any(user, user.tags.exists(t, t == 'APPROVER'))"
 *  - Result: `userIds[]` — the newly created user IDs.
 *  - Non-root users created here ARE subject to org policies.
 *    Root quorum bypass only applies to users in the root quorum set.
 *  - Key distinction from create_sub_organization:
 *      create_sub_organization → isolated org per user, end-user owns their org
 *      create_users            → multiple users share one org, useful for teams/multi-sig
 *
 * Usage: node apis/activities/create-users.mjs
 */

import { generateKeyPairSync } from "crypto";
import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

function generateP256KeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const spki = publicKey.export({ type: "spki", format: "der" });
  const x = spki.slice(27, 59);
  const y = spki.slice(59, 91);
  const prefix = y[y.length - 1] % 2 === 0 ? "02" : "03";
  const publicKeyHex = prefix + x.toString("hex");
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const privateKeyHex = pkcs8.slice(36, 68).toString("hex");
  return { publicKeyHex, privateKeyHex };
}

const RUN_ID = Date.now();

// ---------------------------------------------------------------------------
// Scenario 1: create a non-root user with an API key
//
// This is the typical pattern for adding a programmatic user (e.g. a CI/CD
// bot, a second developer, or a policy-gated automation key).
// The user is NOT root quorum — they ARE subject to org policies.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Create a non-root API key user ---");

const { publicKeyHex: newUserPubKey, privateKeyHex: newUserPrivKey } =
  generateP256KeyPair();
console.log("Generated publicKey :", newUserPubKey);

const r1 = await stampedFetch("/public/v1/submit/create_users", {
  type: "ACTIVITY_TYPE_CREATE_USERS_V3",
  timestampMs: RUN_ID.toString(),
  organizationId,
  parameters: {
    users: [
      {
        userName: `api-user [${RUN_ID}]`,
        userEmail: `api-user-${RUN_ID}@example.com`,
        apiKeys: [
          {
            apiKeyName: "demo-api-key",
            publicKey: newUserPubKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [], // required — pass [] if not using
        oauthProviders: [], // required — pass [] if not using
        userTags: [],
      },
    ],
  },
});

const p1 = JSON.parse(r1.body);
const newUserId = p1.activity?.result?.createUsersResult?.userIds?.[0];

console.log("Status         :", r1.status);
console.log("activityStatus :", p1.activity?.status);
console.log("newUserId      :", newUserId);

if (r1.status !== 200) {
  console.error("⚠ Error:", p1.message ?? p1.details?.[0]?.turnkeyErrorCode);
}

// ---------------------------------------------------------------------------
// Scenario 2: create a user with userTags
//
// userTags let you group users for policy consensus expressions.
// Example policy using tags:
//   consensus: "approvers.any(user, user.tags.exists(t, t == 'FINANCE_APPROVER'))"
// This means any user tagged FINANCE_APPROVER must approve the activity.
// Tags are set at user creation — updateable via update_user_tag activity.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Create a user with userTags ---");

const { publicKeyHex: taggedUserPubKey } = generateP256KeyPair();

const r2 = await stampedFetch("/public/v1/submit/create_users", {
  type: "ACTIVITY_TYPE_CREATE_USERS_V3",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    users: [
      {
        userName: `tagged-user [${RUN_ID}]`,
        userEmail: `tagged-user-${RUN_ID}@example.com`,
        apiKeys: [
          {
            apiKeyName: "tagged-user-key",
            publicKey: taggedUserPubKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
        userTags: [], // tag IDs go here — tags must be pre-created via create_user_tag
        // e.g. userTags: ["<tagId>"]
      },
    ],
  },
});

const p2 = JSON.parse(r2.body);
const taggedUserId = p2.activity?.result?.createUsersResult?.userIds?.[0];
console.log("Status         :", r2.status);
console.log("activityStatus :", p2.activity?.status);
console.log("taggedUserId   :", taggedUserId);

// ---------------------------------------------------------------------------
// Scenario 3 (error): duplicate email
//
// Emails must be unique within an org — 400 if you try to reuse one.
// Common support issue: customer tries to re-add a user who already exists.
// Fix: list_users first to check, or use a different email.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): duplicate email ---");

const { publicKeyHex: dupPubKey } = generateP256KeyPair();

const r3 = await stampedFetch("/public/v1/submit/create_users", {
  type: "ACTIVITY_TYPE_CREATE_USERS_V3",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    users: [
      {
        userName: "Duplicate Email User",
        userEmail: `api-user-${RUN_ID}@example.com`, // same as Scenario 1
        apiKeys: [
          {
            apiKeyName: "dup-key",
            publicKey: dupPubKey,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
        userTags: [],
      },
    ],
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status); // 400
console.log("message :", p3.message); // "user email must be unique: ..."
