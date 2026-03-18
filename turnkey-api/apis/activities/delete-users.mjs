/**
 * DELETE USERS
 * Endpoint: POST /public/v1/submit/delete_users
 *
 * Deletes one or more users from the organization.
 *
 * Key interview points:
 *  - SUBMIT endpoint — auditable activity even for deletions.
 *  - Activity type is ACTIVITY_TYPE_DELETE_USERS — accepts an array of userIds,
 *    so you can bulk-delete in a single call.
 *  - result.userIds[] echoes back the deleted IDs to confirm what was removed.
 *  - Deleting a user does NOT delete their wallets — wallets belong to the org,
 *    not the user. Wallets persist after the user is gone.
 *  - Deleting a user DOES invalidate all their API keys and authenticators —
 *    their credentials are gone, so they can no longer stamp requests.
 *  - Cannot delete the root quorum user — that would lock the org permanently.
 *    Turnkey blocks this at the API level.
 *  - Deleting a non-existent userId returns NOT_FOUND (code 5).
 *
 * Usage: node apis/activities/delete-users.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const ROOT_USER_ID = "d496369b-37dd-44ec-a218-c0a7a0069958";
const SIGN_TX_DEMO_USER_ID = "94b55416-a1d2-4961-802e-821a2570bbad"; // needed for sign-transaction.mjs
const AUTH_PROXY_USER_ID = "13696ef5-acbe-4746-9aba-0cadf82a4a25"; // system user

const KEEP_IDS = new Set([
  ROOT_USER_ID,
  SIGN_TX_DEMO_USER_ID,
  AUTH_PROXY_USER_ID,
]);

// ---------------------------------------------------------------------------
// Scenario 1: list all users, delete all demo/accumulated ones in one call
// Demonstrates bulk delete — cleaner than looping one-by-one.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Bulk delete all accumulated demo users ---");

const listResult = await stampedFetch("/public/v1/query/list_users", {
  organizationId,
});

const allUsers = JSON.parse(listResult.body).users ?? [];
const toDelete = allUsers.filter((u) => !KEEP_IDS.has(u.userId));

console.log("Total users   :", allUsers.length);
console.log(
  "Keeping       :",
  KEEP_IDS.size,
  "(root, sign-tx-demo, auth-proxy)"
);
console.log("Deleting      :", toDelete.length);
toDelete.forEach((u) => console.log(`  - ${u.userName} (${u.userId})`));

if (toDelete.length === 0) {
  console.log("Nothing to delete — org is already clean.");
} else {
  const deleteResult = await stampedFetch("/public/v1/submit/delete_users", {
    type: "ACTIVITY_TYPE_DELETE_USERS",
    timestampMs: Date.now().toString(),
    organizationId,
    parameters: {
      userIds: toDelete.map((u) => u.userId),
    },
  });

  const deleteParsed = JSON.parse(deleteResult.body);
  const deletedIds =
    deleteParsed.activity?.result?.deleteUsersResult?.userIds ?? [];

  console.log("\nStatus         :", deleteResult.status);
  console.log("activityStatus :", deleteParsed.activity?.status);
  console.log("Deleted count  :", deletedIds.length);
  // Wallets owned by deleted users are NOT removed — they persist in the org.
  // Only the user's credentials (API keys, passkeys) are invalidated.
}

// ---------------------------------------------------------------------------
// Scenario 2 (error): delete a userId that doesn't exist
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2 (error): delete non-existent userId ---");

const errResult = await stampedFetch("/public/v1/submit/delete_users", {
  type: "ACTIVITY_TYPE_DELETE_USERS",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userIds: ["00000000-0000-0000-0000-000000000000"],
  },
});

const errParsed = JSON.parse(errResult.body);
console.log("Status  :", errResult.status);
console.log("code    :", errParsed.code);
console.log("message :", errParsed.message);

// ---------------------------------------------------------------------------
// Confirm: list users after deletion
// ---------------------------------------------------------------------------
console.log("\n--- Confirm: users remaining after deletion ---");

const confirmResult = await stampedFetch("/public/v1/query/list_users", {
  organizationId,
});
const remaining = JSON.parse(confirmResult.body).users ?? [];
console.log("Remaining count:", remaining.length);
remaining.forEach((u) => console.log(`  ${u.userName} | ${u.userId}`));
