import "dotenv/config";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

export const baseUrl = process.env.TURNKEY_BASE_URL;
export const organizationId = process.env.TURNKEY_ORGANIZATION_ID;

const apiPublicKey = process.env.TURNKEY_API_PUBLIC_KEY;
const apiPrivateKey = process.env.TURNKEY_API_PRIVATE_KEY;

if (!apiPublicKey || !apiPrivateKey || !organizationId) {
  throw new Error(
    "Missing TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY, or TURNKEY_ORGANIZATION_ID"
  );
}

export const stamper = new ApiKeyStamper({
  apiPublicKey,
  apiPrivateKey,
});

// Stamp a request with a specific stamper instance.
// Used in tests/demos where you need to sign as a non-root key.
export async function stampedFetchWith(stamperInstance, endpoint, bodyObject) {
  const body = JSON.stringify(bodyObject);
  const stamp = await stamperInstance.stamp(body);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Stamp": stamp.stampHeaderValue,
    },
    body,
  });

  const text = await response.text();
  return { response, status: response.status, body: text };
}

export async function stampedFetch(endpoint, bodyObject) {
  const body = JSON.stringify(bodyObject);

  // stamp shape: { stampHeaderName: 'X-Stamp', stampHeaderValue: '<base64url JSON>' }
  // stampHeaderValue encodes: { publicKey, scheme: 'SIGNATURE_SCHEME_TK_API_P256', signature }
  // The signature is ECDSA-P256 over the exact request body string — prevents replay/MITM.
  const stamp = await stamper.stamp(body);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Stamp": stamp.stampHeaderValue,
    },
    body,
  });

  const text = await response.text();

  return {
    response,
    status: response.status,
    body: text,
  };
}
