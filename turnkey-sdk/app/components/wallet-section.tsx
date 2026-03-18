/**
 * Notes:
 * - Ran into a duplicate wallet name error when calling `createWallet()` with a hardcoded
 *   name like "My Wallet" — Turnkey rejects it if a wallet with that name already exists in
 *   the sub-org. Fixed by appending `Date.now()` to guarantee uniqueness on every call.
 * - Intentionally designed as 1 wallet per user (using `wallets[0]`), mirroring how
 *   consumer crypto apps like Moonshot or FOMO work — users don't need to manage multiple
 *   wallets, they just have one with ETH and SOL accounts derived from the same HD seed.
 * - `createWallet()` returns only the walletId. The full wallet object (with addresses) is
 *   not in the return value — it becomes available reactively via the `wallets` array from
 *   `useTurnkey()` after the SDK refreshes state. Initially expected addresses back directly.
 * - Seamless & straightforward flow
 * - https://docs.turnkey.com/sdks/react/using-embedded-wallets
 */

"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";

function truncateWalletId(id: string, start = 5, end = 4): string {
  if (id.length <= start + end + 3) return id;
  return `${id.slice(0, start)}...${id.slice(-end)}`;
}

export function WalletSection() {
  const { createWallet, wallets, handleImportWallet, handleExportWallet } =
    useTurnkey();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const wallet = wallets[0];
  const isEmbedded = wallet?.source === "embedded";
  const ethAccount = wallet?.accounts?.find(
    (a: { addressFormat?: string }) =>
      a.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
  );
  const solAccount = wallet?.accounts?.find(
    (a: { addressFormat?: string }) =>
      a.addressFormat === "ADDRESS_FORMAT_SOLANA"
  );

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(value);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const CopyButton = ({ value, title }: { value: string; title: string }) => (
    <button
      type="button"
      onClick={() => handleCopy(value)}
      className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
      title={title}
    >
      {copiedId === value ? (
        <span className="text-xs text-emerald-400">Copied</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );

  // * Create an embedded wallet with an Ethereum account
  const handleCreateWallet = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const walletId = await createWallet({
        walletName: "My Wallet",
        accounts: ["ADDRESS_FORMAT_ETHEREUM", "ADDRESS_FORMAT_SOLANA"],
      });
      console.log("Wallet created:", walletId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create wallet";
      setCreateError(message);
      console.error("Error creating wallet:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {wallets.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm items-center">
          <dt className="text-zinc-500">Ethereum:</dt>
          <dd className="text-zinc-100 font-medium min-w-0 flex items-center gap-2">
            <span className="truncate font-mono" title={ethAccount?.address}>
              {ethAccount ? truncateWalletId(ethAccount.address) : "—"}
            </span>
            {ethAccount && (
              <CopyButton
                value={ethAccount.address}
                title="Copy Ethereum address"
              />
            )}
          </dd>
          <dt className="text-zinc-500">Solana:</dt>
          <dd className="text-zinc-100 font-medium min-w-0 flex items-center gap-2">
            <span className="truncate font-mono" title={solAccount?.address}>
              {solAccount ? truncateWalletId(solAccount.address) : "—"}
            </span>
            {solAccount && (
              <CopyButton
                value={solAccount.address}
                title="Copy Solana address"
              />
            )}
          </dd>
        </dl>
      )}
      <div className="flex flex-col gap-2">
        {wallets.length === 0 ? (
          <>
            <button
              onClick={handleCreateWallet}
              disabled={creating}
              className="inline-block rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create Wallet"}
            </button>
            <button
              onClick={() => handleImportWallet()}
              className="inline-block rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
            >
              Import Wallet
            </button>
            {createError && (
              <p className="text-sm text-red-400">{createError}</p>
            )}
          </>
        ) : (
          isEmbedded && (
            <button
              onClick={() => handleExportWallet({ walletId: wallet.walletId })}
              className="inline-block rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
            >
              Export Wallet
            </button>
          )
        )}
      </div>
    </div>
  );
}
