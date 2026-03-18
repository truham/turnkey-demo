/**
 * UPDATE USER
 * Endpoint: POST /public/v1/submit/update_user
 *
 * Updates a user's name, email, phone number, or tags in-place.
 *
 * Key interview points:
 *  - SUBMIT endpoint — creates an auditable activity even for simple renames.
 *  - Activity type is ACTIVITY_TYPE_UPDATE_USER — no version suffix.
 *  - update_user is a REPLACE for the fields you pass — but unlike update_policy,
 *    omitting optional fields (email, phone, tags) does NOT blank them out.
 *    Only fields you explicitly pass are updated.
 *  - userTagIds is REPLACE not append — passing a new array overwrites all tags.
 *    Pass an empty array [] to clear all tags.
 *  - result only echoes userId — call get_user to verify the change landed.
 *  - Common support use case: "I need to update this user's email for OTP auth"
 *    or "remove all tags from this user so a policy stops targeting them."
 *
 * Usage: node apis/activities/update-user.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";
import { generateKeyPairSync } from "crypto";

function generateP256KeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const spki = publicKey.export({ type: "spki", format: "der" });
  const x = spki.slice(27, 59);
  const y = spki.slice(59, 91);
  const prefix = y[y.length - 1] % 2 === 0 ? "02" : "03";
  const publicKeyHex = prefix + x.toString("hex");
  return { publicKeyHex };
}

const RUN_ID = Date.now();

// ---------------------------------------------------------------------------
// Setup: create a fresh user to mutate across scenarios
// ---------------------------------------------------------------------------
console.log("--- Setup: create demo user ---");

const { publicKeyHex: demoUserPubKey } = generateP256KeyPair();

const createResult = await stampedFetch("/public/v1/submit/create_users", {
  type: "ACTIVITY_TYPE_CREATE_USERS_V3",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    users: [
      {
        userName: `update-demo-user [${RUN_ID}]`,
        userEmail: `update-demo-${RUN_ID}@example.com`,
        apiKeys: [
          {
            apiKeyName: `update-demo-key [${RUN_ID}]`,
            publicKey: demoUserPubKey,
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

const createParsed = JSON.parse(createResult.body);
const userId = createParsed.activity?.result?.createUsersResult?.userIds?.[0];
console.log("Created userId:", userId);
console.log("Name          :", `update-demo-user [${RUN_ID}]`);
console.log("Email         :", `update-demo-${RUN_ID}@example.com`);

// ---------------------------------------------------------------------------
// Scenario 1: rename the user and update their email
// Most common update — customer onboarding flow updates display name
// or email changes after account creation.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Rename user + update email ---");

const r1 = await stampedFetch("/public/v1/submit/update_user", {
  type: "ACTIVITY_TYPE_UPDATE_USER",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId,
    userName: `update-demo-user RENAMED [${RUN_ID}]`,
    userEmail: `update-demo-renamed-${RUN_ID}@example.com`,
    userTagIds: [],
  },
});

const p1 = JSON.parse(r1.body);
console.log("Status         :", r1.status);
console.log("activityStatus :", p1.activity?.status);

// verify with get_user
const getR1 = await stampedFetch("/public/v1/query/get_user", {
  organizationId,
  userId,
});
const user1 = JSON.parse(getR1.body).user;
console.log("userName after :", user1?.userName);
console.log("userEmail after:", user1?.userEmail);
// result only echoes userId — always call get_user to confirm the change landed

// ---------------------------------------------------------------------------
// Scenario 2: update userTagIds (full replace)
// userTagIds replaces ALL existing tags — not an append.
// Passing [] clears all tags. Relevant when a policy targets users by tag
// and you want to remove a user from that policy's scope immediately.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Clear all user tags (userTagIds: []) ---");

const r2 = await stampedFetch("/public/v1/submit/update_user", {
  type: "ACTIVITY_TYPE_UPDATE_USER",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId,
    userName: `update-demo-user RENAMED [${RUN_ID}]`, // unchanged
    userEmail: `update-demo-renamed-${RUN_ID}@example.com`, // unchanged
    userTagIds: [], // explicitly clear — replace semantics
  },
});

const p2 = JSON.parse(r2.body);
console.log("Status         :", r2.status);
console.log("activityStatus :", p2.activity?.status);
console.log("userTagIds     : [] — all tags cleared");
// Interview point: if a policy condition uses userTagIds to grant access,
// clearing tags is an instant way to revoke that access without touching the policy.

// ---------------------------------------------------------------------------
// Scenario 3 (error): userId does not exist
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): userId not found ---");

const r3 = await stampedFetch("/public/v1/submit/update_user", {
  type: "ACTIVITY_TYPE_UPDATE_USER",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId: "00000000-0000-0000-0000-000000000000",
    userName: "Ghost",
    userEmail: "ghost@example.com",
    userTagIds: [],
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("code    :", p3.code);
console.log("message :", p3.message);
