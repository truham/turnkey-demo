/**
 * CREATE API KEYS
 * Endpoint: POST /public/v1/submit/create_api_keys
 *
 * Adds one or more API keys to an existing user.
 *
 * Key interview points:
 *  - SUBMIT endpoint — type is ACTIVITY_TYPE_CREATE_API_KEYS_V2.
 *  - Takes `apiKeys[]` + `userId` — adds keys to a specific user, not org-wide.
 *  - `publicKey` is a compressed P-256 point (33 bytes = 66 hex chars, 02/03 prefix).
 *    You generate the keypair yourself — Turnkey only stores the public key.
 *    Private key stays with you, never sent to Turnkey.
 *  - `curveType` options:
 *      API_KEY_CURVE_P256      → standard (most common, what we use)
 *      API_KEY_CURVE_SECP256K1 → Bitcoin/ETH curve (for hardware wallet integration)
 *      API_KEY_CURVE_ED25519   → Solana/modern systems
 *  - `expirationSeconds` — optional TTL. After expiry the key stops working.
 *    Useful for short-lived automation keys, session tokens, CI/CD pipelines.
 *    Omit for permanent keys.
 *  - Result: `apiKeyIds[]` — the new API key IDs registered to that user.
 *  - Use case: rotating a compromised key, adding a CI/CD key, creating a
 *    non-root key for policy testing (non-root keys ARE subject to policies,
 *    unlike root quorum which bypasses everything).
 *  - Pair with delete_api_keys to rotate: create new → update config → delete old.
 *
 * WHY THIS MATTERS FOR POLICY TESTING:
 *  - Root quorum bypasses ALL policies — you can never demo DENY policies with
 *    your root API key.
 *  - Adding a non-root API key to the root org user creates a second credential
 *    that IS subject to policies — use it to stamp requests and DENY fires.
 *  - This is how Scenario 2 of sign-transaction.mjs should be completed.
 *
 * Usage: node apis/activities/create-api-keys.mjs
 */

import { createHash, generateKeyPairSync } from "crypto";
import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

const ROOT_USER_ID = "d496369b-37dd-44ec-a218-c0a7a0069958";

// Helper — generate a fresh P-256 keypair using Node's built-in crypto.
// Returns { publicKeyHex, privateKeyHex } where publicKeyHex is the
// compressed 33-byte point (66 hex chars) that Turnkey expects.
function generateP256KeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  // Extract compressed public key from SPKI DER
  // DER format: 26-byte header + 0x04 (uncompressed) + 32-byte x + 32-byte y
  const spki = publicKey.export({ type: "spki", format: "der" });
  const x = spki.slice(27, 59);
  const y = spki.slice(59, 91);
  const prefix = y[y.length - 1] % 2 === 0 ? "02" : "03";
  const publicKeyHex = prefix + x.toString("hex");

  // Extract raw private key from PKCS8 DER
  // For P-256 PKCS8: private key scalar is at offset 36, 32 bytes
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const privateKeyHex = pkcs8.slice(36, 68).toString("hex");

  return { publicKeyHex, privateKeyHex };
}

// ---------------------------------------------------------------------------
// Scenario 1: add a new non-root API key to the root org user
// This key is NOT root quorum — it IS subject to policies.
// Useful for: testing policy enforcement, CI/CD automation, key rotation.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Add a non-root API key to root org user ---");

const { publicKeyHex, privateKeyHex } = generateP256KeyPair();
console.log("Generated publicKey :", publicKeyHex);
console.log("Private key (save!) :", privateKeyHex);
console.log("(In production: store private key in KMS/secrets manager)");

const r1 = await stampedFetch("/public/v1/submit/create_api_keys", {
  type: "ACTIVITY_TYPE_CREATE_API_KEYS_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    apiKeys: [
      {
        apiKeyName: `non-root-demo-key [${Date.now()}]`,
        publicKey: publicKeyHex,
        curveType: "API_KEY_CURVE_P256",
        // no expirationSeconds = permanent key
      },
    ],
    userId: ROOT_USER_ID,
  },
});

const p1 = JSON.parse(r1.body);
const act1 = p1.activity;
const newApiKeyId = act1?.result?.createApiKeysResult?.apiKeyIds?.[0];

console.log("\nStatus      :", r1.status);
console.log("activityStatus :", act1?.status);
console.log("newApiKeyId :", newApiKeyId);

if (r1.status !== 200) {
  console.error("⚠ Error:", p1.message ?? p1.details?.[0]?.turnkeyErrorCode);
}

// ---------------------------------------------------------------------------
// Scenario 2: add a key with expiration (short-lived)
// expirationSeconds = "3600" means the key expires in 1 hour.
// Use for: CI/CD pipelines, session tokens, temporary delegated access.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 2: Add a short-lived API key (expires in 1 hour) ---"
);

const { publicKeyHex: pubKey2 } = generateP256KeyPair();

const r2 = await stampedFetch("/public/v1/submit/create_api_keys", {
  type: "ACTIVITY_TYPE_CREATE_API_KEYS_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    apiKeys: [
      {
        apiKeyName: `expiring-demo-key [${Date.now()}]`,
        publicKey: pubKey2,
        curveType: "API_KEY_CURVE_P256",
        expirationSeconds: "3600", // expires in 1 hour — string not number
      },
    ],
    userId: ROOT_USER_ID,
  },
});

const p2 = JSON.parse(r2.body);
const expiringKeyId = p2.activity?.result?.createApiKeysResult?.apiKeyIds?.[0];

console.log("Status         :", r2.status);
console.log("activityStatus :", p2.activity?.status);
console.log("expiringKeyId  :", expiringKeyId);

// verify expiration shows up on get_user
const userResult = await stampedFetch("/public/v1/query/get_user", {
  organizationId,
  userId: ROOT_USER_ID,
});
const newKeys = JSON.parse(userResult.body).user?.apiKeys?.filter(
  (k) => k.apiKeyId === expiringKeyId
);
console.log(
  "expirationSeconds on key:",
  newKeys?.[0]?.expirationSeconds ?? "(none)"
);

// ---------------------------------------------------------------------------
// Scenario 3 (error): duplicate public key
// Same public key can't be registered twice to the same user.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): duplicate public key ---");

const r3 = await stampedFetch("/public/v1/submit/create_api_keys", {
  type: "ACTIVITY_TYPE_CREATE_API_KEYS_V2",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    apiKeys: [
      {
        apiKeyName: "duplicate-key-attempt",
        publicKey: publicKeyHex, // same key as Scenario 1
        curveType: "API_KEY_CURVE_P256",
      },
    ],
    userId: ROOT_USER_ID,
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("message :", p3.message);

// ---------------------------------------------------------------------------
// Captured output (run on 2026-03-13):
//
// Scenario 1:
//   Generated publicKey : 0365919771cbc75f2f2ace64077e7d222e3ba0cdb8c63d02885a875a77544e1a34
//   activityStatus      : ACTIVITY_STATUS_COMPLETED
//   newApiKeyId         : 9d9b231e-ef81-4316-af05-047176c5f6ee
//
// Scenario 2:
//   activityStatus      : ACTIVITY_STATUS_COMPLETED
//   expiringKeyId       : 2a51f177-a9d1-431c-a96c-1282d864c4ab
//   expirationSeconds   : 3600  ← confirmed in get_user response
//
// Scenario 3 (duplicate key):
//   Status  : 400
//   message : "user credential public keys must be unique: 0365919771..."
//   → Each public key can only be registered once per user. Rotate by
//     creating new first, then deleting old (see delete-api-keys.mjs).
//
// ---------------------------------------------------------------------------
// Summary — log the new key IDs for use in sign-transaction.mjs Scenario 2
// ---------------------------------------------------------------------------
console.log("\n--- Summary ---");
console.log("non-root key ID  :", newApiKeyId);
console.log("expiring key ID  :", expiringKeyId);
console.log("non-root pubKey  :", publicKeyHex);
console.log("non-root privKey :", privateKeyHex);
console.log(
  "\nTo use for policy testing: update TURNKEY_API_PUBLIC_KEY + PRIVATE_KEY in .env"
);
console.log(
  "to the non-root key, then stamp sign_transaction — DENY policies will fire."
);
