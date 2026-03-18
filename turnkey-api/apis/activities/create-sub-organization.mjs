/**
 * CREATE SUB-ORGANIZATION
 * Endpoint: POST /public/v1/submit/create_sub_organization
 *
 * Creates a new sub-organization under the root org, with a root user and
 * optionally a wallet — all in a single atomic activity.
 *
 * Key interview points:
 *  - SUBMIT endpoint — /submit/ not /query/. Always needs type + timestampMs.
 *  - Type is ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7 — on version 7.
 *    Versioning reflects new auth methods added over time (passkeys → OAuth →
 *    OTP → OIDC). Always use the latest version.
 *  - This is the core onboarding call. Every end-user in a B2C product gets
 *    their own sub-org. The sub-org is isolated: its own policies, its own
 *    wallets, its own activity log.
 *  - `rootUsers` array — each user needs at least one auth method:
 *      apiKeys[]        → programmatic access (backend automation)
 *      authenticators[] → passkey/WebAuthn (browser-based users)
 *      oauthProviders[] → social login (Google, Discord, etc.)
 *    For a server-side flow, apiKeys is most common.
 *    For a user-facing flow, authenticators or oauthProviders.
 *  - `rootQuorumThreshold` — how many root users must approve an activity.
 *    Almost always 1 for consumer apps. Must be ≤ rootUsers.length.
 *  - `wallet` is optional but typically included — creates the HD wallet
 *    atomically. You get back walletId + addresses in the same response.
 *  - Result path: activity.result.createSubOrganizationResultV7
 *      → subOrganizationId  (the new org's ID — save this in your DB)
 *      → wallet.walletId    (the wallet created inside it)
 *      → wallet.addresses   (derived addresses)
 *      → rootUserIds        (user IDs created as root quorum)
 *  - The root org API key (yours) submits this — you are creating the sub-org
 *    on behalf of the user. The user becomes root quorum of their own org.
 *  - After creation, the user's own credentials (apiKey/passkey/oauth) control
 *    their sub-org. Your root org key can READ the sub-org but cannot submit
 *    activities into it (ORGANIZATION_MISMATCH — see create-wallet.mjs).
 *
 * Usage: node apis/activities/create-sub-organization.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// Our root org API key public key — used to register the sub-org user's API key.
// In a real app you'd generate a fresh keypair per user. Here we reuse ours
// just for demonstration (the sub-org user will share our API key credentials).
const API_PUBLIC_KEY = process.env.TURNKEY_API_PUBLIC_KEY;

// ---------------------------------------------------------------------------
// Scenario 1: create a sub-org with an API key root user + wallet
// This mirrors what your SDK app does when a new user signs up via API key.
// The root user gets our API key registered so we can stamp requests for them.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 1: Create sub-org with API key root user + wallet ---"
);

const RUN_ID = Date.now();

const r1 = await stampedFetch("/public/v1/submit/create_sub_organization", {
  type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7",
  timestampMs: RUN_ID.toString(),
  organizationId,
  parameters: {
    subOrganizationName: `Demo Sub-Org ${RUN_ID}`,
    rootUsers: [
      {
        userName: "API Demo User",
        userEmail: `demo-${RUN_ID}@example.com`,
        apiKeys: [
          {
            apiKeyName: "demo-api-key",
            publicKey: API_PUBLIC_KEY,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [], // empty arrays required — omitting causes 400
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1, // 1-of-1 — standard for consumer apps
    wallet: {
      walletName: "Default Wallet",
      accounts: [
        {
          curve: "CURVE_SECP256K1",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/60'/0'/0/0",
          addressFormat: "ADDRESS_FORMAT_ETHEREUM",
        },
        {
          curve: "CURVE_ED25519",
          pathFormat: "PATH_FORMAT_BIP32",
          path: "m/44'/501'/0'/0'",
          addressFormat: "ADDRESS_FORMAT_SOLANA",
        },
      ],
      mnemonicLength: 12,
    },
  },
});

const p1 = JSON.parse(r1.body);
const act1 = p1.activity;
const res1 = act1?.result?.createSubOrganizationResultV7;

console.log("Status              :", r1.status);
console.log("activityStatus      :", act1?.status);
console.log("subOrganizationId   :", res1?.subOrganizationId);
console.log("walletId            :", res1?.wallet?.walletId);
console.log("addresses           :", res1?.wallet?.addresses?.join(", "));
console.log("rootUserIds         :", res1?.rootUserIds?.join(", "));

if (r1.status !== 200) {
  console.error("⚠ Error:", p1.message ?? p1.details?.[0]?.turnkeyErrorCode);
}

// ---------------------------------------------------------------------------
// Scenario 2: create a sub-org with NO wallet
// Some flows defer wallet creation — e.g. user picks a chain after signup.
// Omitting `wallet` entirely is valid; you can call create_wallet later.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2: Create sub-org with no wallet (deferred) ---");

const RUN_ID2 = Date.now();

const r2 = await stampedFetch("/public/v1/submit/create_sub_organization", {
  type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7",
  timestampMs: RUN_ID2.toString(),
  organizationId,
  parameters: {
    subOrganizationName: `Demo Sub-Org No-Wallet ${RUN_ID2}`,
    rootUsers: [
      {
        userName: "No-Wallet Demo User",
        userEmail: `demo-nowallet-${RUN_ID2}@example.com`,
        apiKeys: [
          {
            apiKeyName: "demo-api-key",
            publicKey: API_PUBLIC_KEY,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 1,
    // wallet omitted — sub-org is created without one
  },
});

const p2 = JSON.parse(r2.body);
const act2 = p2.activity;
const res2 = act2?.result?.createSubOrganizationResultV7;

console.log("Status              :", r2.status);
console.log("activityStatus      :", act2?.status);
console.log("subOrganizationId   :", res2?.subOrganizationId);
console.log(
  "walletId            :",
  res2?.wallet?.walletId ?? "(none — deferred)"
);
console.log("rootUserIds         :", res2?.rootUserIds?.join(", "));

if (r2.status !== 200) {
  console.error("⚠ Error:", p2.message ?? p2.details?.[0]?.turnkeyErrorCode);
}

// ---------------------------------------------------------------------------
// Scenario 3 (error): rootQuorumThreshold > rootUsers.length
// Threshold must be ≤ number of root users — you can't require 2 approvals
// if only 1 user exists.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 3 (error): rootQuorumThreshold > rootUsers count ---"
);

const r3 = await stampedFetch("/public/v1/submit/create_sub_organization", {
  type: "ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    subOrganizationName: `Bad Quorum Sub-Org ${Date.now()}`,
    rootUsers: [
      {
        userName: "Solo User",
        userEmail: `solo-${Date.now()}@example.com`,
        apiKeys: [
          {
            apiKeyName: "demo-api-key",
            publicKey: API_PUBLIC_KEY,
            curveType: "API_KEY_CURVE_P256",
          },
        ],
        authenticators: [],
        oauthProviders: [],
      },
    ],
    rootQuorumThreshold: 2, // invalid — only 1 root user but threshold is 2
  },
});

const p3 = JSON.parse(r3.body);
console.log("Status  :", r3.status);
console.log("message :", p3.message);

// ---------------------------------------------------------------------------
// Scenario 4: submit an activity INTO the new sub-org using the same stamper
//
// Key insight: the stamper (private key) doesn't change.
// Turnkey validates the X-Stamp signature and checks:
//   "does the sub-org have a user with this public key registered?"
// Since we registered our own API public key in Scenario 1, the answer is yes.
// So swapping organizationId in the request body is all it takes.
//
// This is how a backend server acts on behalf of a user:
//   - At onboarding: create_sub_organization with the user's public key
//   - At runtime: stamp requests with the matching private key, use sub-org ID
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 4: Submit create_wallet INTO the new sub-org ---");

// sub-org created in Scenario 1 above
const SUB_ORG_ID = res1?.subOrganizationId;

const r4 = await stampedFetch("/public/v1/submit/create_wallet", {
  type: "ACTIVITY_TYPE_CREATE_WALLET",
  timestampMs: Date.now().toString(),
  organizationId: SUB_ORG_ID, // ← sub-org ID, not root org
  parameters: {
    walletName: `Sub-Org Wallet ${Date.now()}`,
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
    mnemonicLength: 12,
  },
});

const p4 = JSON.parse(r4.body);
const act4 = p4.activity;
const res4 = act4?.result?.createWalletResult;

console.log("Status     :", r4.status);
console.log("activityStatus :", act4?.status);
console.log("walletId   :", res4?.walletId);
console.log("addresses  :", res4?.addresses?.join(", "));

if (r4.status !== 200) {
  console.error("⚠ Error:", p4.message ?? p4.details?.[0]?.turnkeyErrorCode);
}
