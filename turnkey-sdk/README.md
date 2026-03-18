# Turnkey Embedded Wallet Demo — Quickstart

A Next.js app built as part of the [Turnkey embedded wallet quickstart](https://docs.turnkey.com/getting-started/embedded-wallet-quickstart). The goal was to explore the SDK, ship features, and document learnings encountered along the way.

## What's built

- **Auth** — Google OAuth, passkey, and Discord login via `@turnkey/react-wallet-kit`
- **Wallet creation** — creates a sub-org and Ethereum + Solana wallet accounts
- **Sign a message** — custom confirmation modal using `handleSignMessage`
- **Send a transaction** — builds, signs, and broadcasts a Sepolia ETH transaction via `viem`
- **Update username** - update display name for the logged-in user
- **Step-up auth** — re-authenticates with a passkey via `StamperType.Passkey`
- **Register / remove passkey** — prerequisite for step-up auth
- **Add phone number** — SMS OTP auth (enterprise-gated)
- **Destination policy** _(bonus)_ — demonstrates Turnkey's policy engine with live enforcement

## Setup

1. Copy `.env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Required variables:

- `NEXT_PUBLIC_TURNKEY_API_PUBLIC_KEY` / `NEXT_PUBLIC_TURNKEY_API_PRIVATE_KEY` — your Turnkey root API key
- `NEXT_PUBLIC_TURNKEY_ORGANIZATION_ID` — your root org ID
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth client ID (Web application type)
- `NEXT_PUBLIC_REDIRECT_URI` — OAuth redirect URI (e.g. `http://localhost:3000`)
- `NEXT_PUBLIC_SEPOLIA_RPC_URL` — Sepolia RPC endpoint (e.g. from Alchemy or Infura)

For Google OAuth: create a Web application credential in [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), add `NEXT_PUBLIC_REDIRECT_URI` as an Authorized redirect URI, and enable Google in Turnkey Dashboard → Wallet Kit → Authentication.

2. Install dependencies and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)
