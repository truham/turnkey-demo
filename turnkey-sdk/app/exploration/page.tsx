"use client";

import Link from "next/link"; // still used in unauthenticated state
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { SendEth } from "../components/send-eth";
import { ReceiveEth } from "../components/receive-eth";
import { SignWithPasskey } from "../components/sign-with-passkey";
import { SignMessageCard } from "../components/sign-message-card";
import { DestinationPolicy } from "../components/destination-policy";

export default function ExplorationPage() {
  const { authState, handleLogin } = useTurnkey();

  if (authState !== AuthState.Authenticated) {
    return (
      <div className="min-h-screen bg-zinc-800 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <h1 className="text-2xl font-bold text-zinc-100">Exploration</h1>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-4 space-y-4 text-center">
            <p className="text-zinc-400 text-sm">You need to be signed in.</p>
            <button
              onClick={() => handleLogin()}
              className="w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors"
            >
              Log in
            </button>
            <Link
              href="/"
              className="block text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              ← Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-800 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-zinc-100">Exploration</h1>

        {/* Cards grid — 1 col on mobile, 2 cols on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sign Message card */}
          <SignMessageCard />

          {/* Step-up auth card */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 flex flex-col gap-4">
            <div>
              <p className="text-zinc-100 font-medium">Step-up Auth</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Force passkey confirmation for a sensitive operation via{" "}
                <code className="text-zinc-400">StamperType.Passkey</code>.
              </p>
            </div>
            <SignWithPasskey />
          </div>

          {/* Receive Sepolia ETH card */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 flex flex-col gap-4">
            <div>
              <p className="text-zinc-100 font-medium">Receive Sepolia ETH</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Copy your address and use a faucet to get testnet ETH.
              </p>
            </div>
            <ReceiveEth />
          </div>

          {/* Send Sepolia ETH card */}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 flex flex-col gap-4">
            <div>
              <p className="text-zinc-100 font-medium">Send Sepolia ETH</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Sign and broadcast a transaction on Ethereum Sepolia testnet.
              </p>
            </div>
            <SendEth hideHeader />
          </div>

          {/* Policy card */}
          <div className="lg:col-span-2">
            <DestinationPolicy />
          </div>
        </div>
      </div>
    </div>
  );
}
