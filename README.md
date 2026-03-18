# Turnkey Exploration

Built for Turnkey exploration. Two folders: an SDK app and a set of raw API scripts - together covering surface area of Turnkey's embedded wallet and activity model.

---

## `turnkey-sdk`

A Next.js app using `@turnkey/react-wallet-kit` that implements the embedded wallet quickstart.

**Features built:**
- **Auth** — Google OAuth, passkey, Discord login
- **Create wallet** — generates a sub-org with Ethereum and Solana wallet accounts on first login
- **Sign a message** — custom confirmation modal
- **Send a transaction** — builds, signs, and broadcasts a Sepolia ETH transaction via `viem`
- **Update username** — update display name for the logged-in user
- **Step-up auth** — re-authenticates using a registered passkey
- **Register / remove passkey** — manages WebAuthn credentials for the user
- **Add phone number** — SMS OTP auth (enterprise-gated)
- **Destination policy** *(bonus)* — live policy engine demo: creates an `EFFECT_ALLOW` baseline for a non-root user, layers an `EFFECT_DENY` for the burn address on top, and shows enforcement via a raw signed transaction

### Setup

```bash
cd turnkey-sdk
cp .env.example .env   # fill in values below
npm install
npm run dev
```

Required `.env` values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_ORGANIZATION_ID` | Turnkey root org ID |
| `NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID` | Auth proxy config ID from Turnkey Dashboard → Wallet Kit |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (Web application) |
| `NEXT_PUBLIC_REDIRECT_URI` | OAuth redirect URI (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_DISCORD_CLIENT_ID` | Discord OAuth client ID |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC endpoint (Alchemy or Infura) |

For Google OAuth: create a Web application credential in [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), add `NEXT_PUBLIC_REDIRECT_URI` as an Authorized redirect URI, and enable Google in Turnkey Dashboard → Wallet Kit → Authentication.

---

## `turnkey-api`

Node.js scripts that call Turnkey's REST API directly using `@turnkey/api-key-stamper`. Useful for understanding the underlying activity model and request/response shapes before working with the higher-level SDK.

Also includes a Postman collection with a pre-request script that auto-stamps every request — useful for quick debugging without running Node.

**Activity scripts** (`apis/activities/`):
`create-api-keys` · `create-policy` · `create-sub-organization` · `create-users` · `create-wallet` · `create-wallet-accounts` · `delete-api-keys` · `delete-policy` · `delete-users` · `export-wallet` · `import-wallet` · `sign-raw-payload` · `sign-transaction` · `update-policy` · `update-user`

**Query scripts** (`apis/queries/`):
`get-activity` · `get-authenticator` · `get-authenticators` · `get-policy` · `get-sub-organizations` · `get-user` · `get-wallet` · `get-wallet-account` · `list-activities` · `list-policies` · `list-users` · `list-wallets` · `list-wallets-accounts` · `who-am-i`

### Setup

```bash
cd turnkey-api
cp .env.example .env   # fill in your API keys and org ID from the Turnkey dashboard
npm install
node apis/queries/who-am-i.mjs   # quick smoke test
```

---

Exploring the API scripts alongside the SDK app was a fruitful way to see how the activity model, stamping, and organization hierarchy all fit together.
