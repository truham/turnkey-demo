/**
 * CREATE WALLET
 * Endpoint: POST /public/v1/submit/create_wallet
 *
 * Creates a new BIP-39 HD wallet and derives initial accounts (addresses).
 * This is the first SUBMIT (write) endpoint — the body shape is completely
 * different from query endpoints.
 *
 * Key interview points:
 *  - SUBMIT endpoint — note /submit/ in the path, not /query/.
 *  - Body requires 3 new top-level fields vs query: type, timestampMs, parameters.
 *  - `type` is an enum: ACTIVITY_TYPE_CREATE_WALLET — tells Turnkey what operation to run.
 *  - `timestampMs` is a string (not a number) of the current epoch in ms.
 *    Turnkey uses it to verify request liveness and prevent replay attacks.
 *  - Actual params go inside `parameters {}`, not at the top level.
 *  - Response wraps everything in an `activity` object — the wallet ID and
 *    derived addresses live at activity.result.createWalletResult.
 *  - Activity status: ACTIVITY_STATUS_COMPLETED means synchronous success.
 *    ACTIVITY_STATUS_PENDING or REQUIRES_CONSENSUS means a policy is blocking it.
 *  - `walletName` must be unique within the org — duplicate names → 400 error.
 *  - `mnemonicLength` defaults to 12. Accepted: 12, 15, 18, 21, 24.
 *  - Does NOT count against the 25 free signing quota — that's only for
 *    sign_raw_payload / sign_transaction.
 *
 * Usage: node apis/activities/create-wallet.mjs
 */

import { stampedFetch, organizationId } from "../../lib/turnkeyClient.mjs";

// ---------------------------------------------------------------------------
// Scenario 1: create a wallet with ETH + Solana accounts in the root org
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 1: Create wallet (ETH + Solana) ---");

const result = await stampedFetch("/public/v1/submit/create_wallet", {
  type: "ACTIVITY_TYPE_CREATE_WALLET",
  timestampMs: Date.now().toString(), // string, not number — common gotcha
  organizationId,
  parameters: {
    walletName: `API Test Wallet ${Date.now()}`, // unique name to avoid duplicate error
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0", // standard ETH derivation path
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
      {
        curve: "CURVE_ED25519",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/501'/0'/0'", // standard Solana derivation path
        addressFormat: "ADDRESS_FORMAT_SOLANA",
      },
    ],
    mnemonicLength: 12,
  },
});

const parsed = JSON.parse(result.body);
const activity = parsed.activity;
const walletResult = activity?.result?.createWalletResult;

console.log("Status         :", result.status);
console.log("activityId     :", activity?.id);
console.log("activityStatus :", activity?.status); // ACTIVITY_STATUS_COMPLETED = synchronous success
console.log("activityType   :", activity?.type);
console.log("walletId       :", walletResult?.walletId);
console.log("addresses      :", walletResult?.addresses);

if (result.status !== 200) {
  console.error("\n⚠ Non-200 response");
  console.error("Raw body:", result.body);
}

// ---------------------------------------------------------------------------
// Scenario 2 (error): missing `walletName` in parameters
// Shows what "bad request body" looks like for a submit endpoint.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 2 (error): missing walletName ---");

const errResult = await stampedFetch("/public/v1/submit/create_wallet", {
  type: "ACTIVITY_TYPE_CREATE_WALLET",
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    // walletName omitted intentionally
    accounts: [],
  },
});

const errParsed = JSON.parse(errResult.body);

console.log("Status          :", errResult.status);
console.log("code            :", errParsed.code);
console.log("message         :", errParsed.message);
console.log("turnkeyErrorCode:", errParsed.turnkeyErrorCode);

// ---------------------------------------------------------------------------
// Scenario 3 (error): wrong `type` value
// Shows what happens when the type enum doesn't match the endpoint.
// ---------------------------------------------------------------------------
console.log("\n--- Scenario 3 (error): wrong activity type ---");

const wrongTypeResult = await stampedFetch("/public/v1/submit/create_wallet", {
  type: "ACTIVITY_TYPE_SIGN_TRANSACTION", // wrong type for this endpoint
  timestampMs: Date.now().toString(),
  organizationId,
  parameters: {
    walletName: "Should not work",
    accounts: [],
  },
});

const wrongTypeParsed = JSON.parse(wrongTypeResult.body);

console.log("Status          :", wrongTypeResult.status);
console.log("code            :", wrongTypeParsed.code);
console.log("message         :", wrongTypeParsed.message);
console.log("turnkeyErrorCode:", wrongTypeParsed.turnkeyErrorCode);

// ---------------------------------------------------------------------------
// Scenario 4 (error): targeting a sub-org with the root API key
// Root org has READ-ONLY access to sub-orgs — submitting activities into
// a sub-org requires either the sub-org user's own credentials, or a
// delegated API key created inside that sub-org via create_api_keys.
// ---------------------------------------------------------------------------
console.log(
  "\n--- Scenario 4 (error): ORGANIZATION_MISMATCH (root key → sub-org) ---"
);

const mismatchResult = await stampedFetch("/public/v1/submit/create_wallet", {
  type: "ACTIVITY_TYPE_CREATE_WALLET",
  timestampMs: Date.now().toString(),
  organizationId: "7b472c36-b548-4107-b96e-9f1dff9ca064", // sub-org ID
  parameters: {
    walletName: "Should fail",
    accounts: [],
  },
});

const mismatchParsed = JSON.parse(mismatchResult.body);

console.log("Status          :", mismatchResult.status);
console.log("code            :", mismatchParsed.code);
console.log("message         :", mismatchParsed.message);
console.log("turnkeyErrorCode:", mismatchParsed.turnkeyErrorCode); // ORGANIZATION_MISMATCH
