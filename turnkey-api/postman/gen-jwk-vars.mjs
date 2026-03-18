/**
 * Generates the JWK_X, JWK_Y, JWK_D values needed for the Postman collection.
 *
 * Run this whenever you need to update the Postman collection variables
 * for a different API key pair.
 *
 * Usage: node postman/gen-jwk-vars.mjs
 */
import "dotenv/config";
import { convertTurnkeyApiKeyToJwk } from "../node_modules/@turnkey/api-key-stamper/dist/utils.mjs";

const jwk = convertTurnkeyApiKeyToJwk({
  uncompressedPrivateKeyHex: process.env.TURNKEY_API_PRIVATE_KEY,
  compressedPublicKeyHex: process.env.TURNKEY_API_PUBLIC_KEY,
});

console.log("\nPaste these into Postman Collection Variables:\n");
console.log("JWK_X:", jwk.x);
console.log("JWK_Y:", jwk.y);
console.log("JWK_D:", jwk.d, "  ← keep secret (private key)");
console.log("\nAPI_PUBLIC_KEY:", process.env.TURNKEY_API_PUBLIC_KEY);
console.log("ORGANIZATION_ID:", process.env.TURNKEY_ORGANIZATION_ID);
