/**
 * Notes:
 * - Not a Turnkey-specific component — no signing or key management here.
 * - Exists purely as a helper to enable the `send-eth` flow: displays the wallet's Ethereum
 *   address (to receive testnet ETH from a faucet) and live Sepolia balance (via viem + RPC).
 * - Meant to enable an easier way to fund wallet for the send transaction demo.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { createPublicClient, http, formatEther } from "viem";
import { sepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org"
  ),
});

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const FAUCETS = [
  {
    name: "Google",
    description: "No signup · 0.05 ETH",
    url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
  },
  {
    name: "Alchemy",
    description: "Alchemy account · 0.5 ETH/day",
    url: "https://sepoliafaucet.com",
  },
];

export function ReceiveEth() {
  const { wallets } = useTurnkey();
  const [copied, setCopied] = useState(false);
  const [faucetCopied, setFaucetCopied] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const ethAccount = wallets[0]?.accounts?.find(
    (a: { addressFormat?: string }) =>
      a.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
  );

  const address = ethAccount?.address;

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    setBalanceLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10_000)
      );
      const raw = await Promise.race([
        publicClient.getBalance({ address: address as `0x${string}` }),
        timeout,
      ]);
      setBalance(formatEther(raw));
    } catch {
      setBalance("unavailable");
    } finally {
      setBalanceLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (!ethAccount) return null;

  const addr = address as string;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Copies address to clipboard before opening the faucet tab so the user
  // can just paste on arrival — no need to come back and copy first.
  const handleFaucetClick = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    faucetName: string,
    url: string
  ) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(addr);
      setFaucetCopied(faucetName);
      setTimeout(() => setFaucetCopied(null), 3000);
    } catch {
      // clipboard write failed; open the tab anyway
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Address display */}
      <div>
        <p className="text-zinc-500 text-xs mb-2">Your Sepolia address:</p>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-800/80 border border-zinc-700 px-3 py-2.5">
          <span
            className="flex-1 font-mono text-sm text-zinc-100 truncate"
            title={addr}
          >
            {addr}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            title="Copy address"
          >
            {copied ? (
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
        </div>
      </div>

      {/* Balance */}
      <div className="flex items-center justify-between rounded-lg bg-zinc-800/80 border border-zinc-700 px-3 py-2.5">
        <div>
          <p className="text-zinc-500 text-xs">Sepolia balance</p>
          <p className="text-zinc-100 font-medium text-sm mt-0.5">
            {balanceLoading ? (
              "Loading…"
            ) : balance === "unavailable" ? (
              <span className="text-zinc-500 text-xs">
                RPC unavailable — try refreshing
              </span>
            ) : balance !== null ? (
              `${parseFloat(balance).toFixed(6)} ETH`
            ) : (
              "—"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchBalance}
          disabled={balanceLoading}
          title="Refresh balance"
          className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-colors disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={balanceLoading ? "animate-spin" : ""}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>

      {/* Faucets */}
      <div>
        <p className="text-zinc-500 text-xs mb-2">
          Click a faucet — your address is copied automatically:
        </p>
        <div className="space-y-2">
          {FAUCETS.map((faucet) => (
            <a
              key={faucet.name}
              href={faucet.url}
              onClick={(e) => handleFaucetClick(e, faucet.name, faucet.url)}
              className="flex items-center justify-between rounded-lg border border-zinc-700 px-3 py-2.5 hover:bg-zinc-800 transition-colors group cursor-pointer"
            >
              <div>
                <span className="text-sm font-medium text-zinc-100">
                  {faucet.name}
                </span>
                <span className="text-xs text-zinc-500 ml-2">
                  {faucet.description}
                </span>
              </div>
              <span className="text-xs transition-colors text-zinc-500 group-hover:text-zinc-300">
                {faucetCopied === faucet.name ? (
                  <span className="text-emerald-400">Address copied ✓</span>
                ) : (
                  "↗"
                )}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
