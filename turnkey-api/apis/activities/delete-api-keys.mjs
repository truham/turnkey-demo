/**
 * DELETE API KEYS
 * Endpoint: POST /public/v1/submit/delete_api_keys
 *
 * Removes one or more API keys from a user.
 *
 * Key interview points:
 *  - SUBMIT endpoint — type is ACTIVITY_TYPE_DELETE_API_KEYS.
 *  - Takes `userId` + `apiKeyIds[]` — removes specific keys from a specific user.
 *  - Result: `apiKeyIds[]` — the IDs of the keys that were deleted.
 *  - Primary use case: key rotation.
 *      Safe rotation pattern: create new key first → update config → delete old key.
 *      Never delete before creating the replacement — you'd lose access.
 *  - You cannot delete a key that is currently being used to stamp the request.
 *    Attempting to do so returns 400. Always rotate with a different credential.
 *  - Deleting a key is permanent — the key ID cannot be reused.
 *
 * Usage: node apis/activities/delete-api-keys.mjs
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

// Non-root user from create-users.mjs / sign-transaction.mjs
const TARGET_USER_ID = "94b55416-a1d2-4961-802e-821a2570bbad";

// ---------------------------------------------------------------------------
// Scenario 1: safe key rotation — create new key, then delete old
//
// This is the correct rotation pattern:
//   1. create_api_keys → register the new key
//   2. Update your config/secrets to use the new key
//   3. delete_api_keys → remove the old key
// Never delete first — you'd be locked out.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 1: Safe key rotation (create new → delete old) ---"
);

// Step 1: create a replacement key
const { publicKeyHex: newPub } = generateP256KeyPair();

const createResult = await stampedFetch("/public/v1/submit/create_api_keys", {
  type: "ACTIVITY_TYPE_CREATE_API_KEYS_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId: TARGET_USER_ID,
    apiKeys: [
      {
        apiKeyName: `replacement-key [${Date.now()}]`,
        publicKey: newPub,
        curveType: "API_KEY_CURVE_P256",
      },
    ],
  },
});

const newKeyId = JSON.parse(createResult.body).activity?.result
  ?.createApiKeysResult?.apiKeyIds?.[0];
console.log("New key created :", newKeyId);

// Step 2: fetch the user's current keys to find the old one to delete
const userResult = await stampedFetch("/public/v1/query/get_user", {
  organizationId,
  userId: TARGET_USER_ID,
});
const currentKeys = JSON.parse(userResult.body).user?.apiKeys ?? [];
console.log(
  "Current keys    :",
  currentKeys.map((k) => `${k.apiKeyName} (${k.apiKeyId})`)
);

// Delete any key that isn't the one we just created
const oldKey = currentKeys.find((k) => k.apiKeyId !== newKeyId);
if (!oldKey) {
  console.log("No old key to delete — only the new key exists.");
  process.exit(0);
}

console.log("Deleting old key:", oldKey.apiKeyName, `(${oldKey.apiKeyId})`);

const r1 = await stampedFetch("/public/v1/submit/delete_api_keys", {
  type: "ACTIVITY_TYPE_DELETE_API_KEYS",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId: TARGET_USER_ID,
    apiKeyIds: [oldKey.apiKeyId],
  },
});

const p1 = JSON.parse(r1.body);
const deletedIds = p1.activity?.result?.deleteApiKeysResult?.apiKeyIds;

console.log("Status         :", r1.status);
console.log("activityStatus :", p1.activity?.status);
console.log("deletedKeyIds  :", deletedIds);

if (r1.status !== 200) {
  console.error("⚠ Error:", p1.message);
}

// ---------------------------------------------------------------------------
// Scenario 2 (error): delete a key that doesn't exist
// Returns 400 — key ID must belong to the specified user.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2 (error): delete non-existent key ID ---");

const r2 = await stampedFetch("/public/v1/submit/delete_api_keys", {
  type: "ACTIVITY_TYPE_DELETE_API_KEYS",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    userId: TARGET_USER_ID,
    apiKeyIds: ["00000000-0000-0000-0000-000000000000"],
  },
});

const p2 = JSON.parse(r2.body);
console.log("Status  :", r2.status);
console.log("message :", p2.message);
