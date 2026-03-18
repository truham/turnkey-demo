/**
 * Notes:
 * - Allows users to log in or sign up using an external browser wallet (e.g. MetaMask, Phantom)
 *   instead of email/SMS/OAuth. Uses `fetchWalletProviders` to detect installed browser extensions
 *   via EIP-6963, then `loginOrSignupWithWallet` to authenticate against Turnkey.
 * - This links the external wallet as a credential on the user's Turnkey sub-org, meaning they
 *   can sign future requests using MetaMask as the stamper instead of an API key or passkey.
 * - Not heavily tested — added to explore the breadth of auth methods the SDK supports
 *   beyond email/passkey flows.
 */

"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import type { WalletProvider } from "@turnkey/core";

export function ExternalWalletAuth() {
  const { fetchWalletProviders, loginOrSignupWithWallet } = useTurnkey();
  const [providers, setProviders] = useState<WalletProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const handleFetchProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWalletProviders();
      const seen = new Set<string>();
      const unique = (result ?? []).filter((p) => {
        if (seen.has(p.info.name)) return false;
        seen.add(p.info.name);
        return true;
      });
      setProviders(unique);
      setFetched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch providers");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (provider: WalletProvider) => {
    setAuthenticating(provider.info.name);
    setError(null);
    try {
      await loginOrSignupWithWallet({ walletProvider: provider });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setAuthenticating(null);
    }
  };

  if (!fetched) {
    return (
      <button
        onClick={handleFetchProviders}
        disabled={loading}
        className="w-full rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Detecting wallets…" : "Connect External Wallet"}
      </button>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-400">
          No wallet providers detected. Install a browser wallet like MetaMask
          or Phantom.
        </p>
        <button
          onClick={handleFetchProviders}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">
        External Wallets
      </p>
      {providers.map((provider) => (
        <button
          key={provider.info.name}
          onClick={() => handleAuth(provider)}
          disabled={authenticating !== null}
          className="flex w-full items-center gap-3 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {provider.info.icon && (
            <img src={provider.info.icon} alt="" className="h-5 w-5 rounded" />
          )}
          <span className="flex-1 text-left">{provider.info.name}</span>
          {authenticating === provider.info.name && (
            <span className="text-xs text-zinc-400">Connecting…</span>
          )}
        </button>
      ))}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
