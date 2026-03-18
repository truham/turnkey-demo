/**
 * Notes:
 * - The flow is intentionally split into 4 steps to show what Turnkey is and isn't responsible for:
 *     1. Fetch nonce + gas fees from Sepolia via viem (Turnkey doesn't handle chain state)
 *     2. Build + serialize the unsigned transaction via viem's `serializeTransaction`
 *     3. Turnkey signs it via `signTransaction()` — private key never leaves the enclave
 *     4. Broadcast the signed tx to Sepolia via viem's `sendRawTransaction`
 * - Turnkey is a pure signing layer — it does not interact with the chain directly.
 *   Developers still need a separate RPC provider (viem + Sepolia RPC here) for nonce,
 *   gas estimation, and broadcasting. This is a common source of confusion.
 * - Received a 401 `API_KEY_EXPIRED` error when sending a transaction after leaving the
 *   browser idle. Same root cause as `update-username` — the SDK's short-lived session key
 *   expired. Fix is to re-authenticate (log out and back in).
 * - `signTransaction` takes the full `walletAccount` object (same as `handleSignMessage`),
 *   not just the address string.
 */

"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import {
  createPublicClient,
  http,
  parseEther,
  serializeTransaction,
} from "viem";
import { sepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org"
  ),
});

export function SendEth({ hideHeader }: { hideHeader?: boolean } = {}) {
  const { signTransaction, wallets } = useTurnkey();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ethAccount = wallets[0]?.accounts?.find(
    (a: { addressFormat?: string }) =>
      a.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
  );

  const handleSend = async () => {
    if (!ethAccount) {
      setError("No Ethereum wallet found. Create a wallet first.");
      return;
    }
    if (!to || !amount) {
      setError("Please enter a recipient address and amount.");
      return;
    }
    if (!to.startsWith("0x")) {
      setError("Invalid address — EVM addresses must start with 0x.");
      return;
    }

    setSending(true);
    setError(null);
    setTxHash(null);

    // * Sign a transaction
    try {
      // 1. Fetch nonce and gas fees from Sepolia via viem
      const [nonce, feeData] = await Promise.all([
        publicClient.getTransactionCount({
          address: ethAccount.address as `0x${string}`,
        }),
        publicClient.estimateFeesPerGas(),
      ]);

      // 2. Build and serialize the unsigned transaction via viem
      // `Unsigned transaction data as a serialized string in the canonical encoding for the given transactionType`
      // From docs, wasn't familiar, so had to look into what was missing here. An example in docs would be helpful!
      // https://docs.turnkey.com/generated-docs/react-wallet-kit/client-context-type-sign-transaction
      const unsignedTransaction = serializeTransaction({
        chainId: sepolia.id,
        to: to as `0x${string}`,
        value: parseEther(amount),
        nonce,
        gas: BigInt(21000),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });

      // 3. Turnkey signs it — private key never leaves the enclave
      const signed = await signTransaction({
        walletAccount: ethAccount,
        unsignedTransaction,
        transactionType: "TRANSACTION_TYPE_ETHEREUM",
      });

      // 4. Broadcast to Sepolia via viem
      const hash = await publicClient.sendRawTransaction({
        serializedTransaction: signed as `0x${string}`,
      });

      setTxHash(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  };

  if (!ethAccount) return null;

  return (
    <div className="flex flex-col gap-3 flex-1">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">
            Send Sepolia ETH
          </p>
          <a
            href={`https://sepolia.etherscan.io/address/${ethAccount.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View on Etherscan ↗
          </a>
        </div>
      )}
      {hideHeader && (
        <a
          href={`https://sepolia.etherscan.io/address/${ethAccount.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View wallet on Etherscan ↗
        </a>
      )}
      <input
        type="text"
        placeholder="Recipient address (0x...)"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="w-full rounded-lg bg-zinc-900/80 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
      />
      <input
        type="number"
        placeholder="Amount (ETH)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        min="0"
        step="0.001"
        className="w-full rounded-lg bg-zinc-900/80 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {txHash && (
        <div className="rounded-lg bg-zinc-900/80 border border-emerald-500/30 p-3 space-y-1">
          <p className="text-xs text-emerald-400">Transaction sent!</p>
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-zinc-400 hover:text-zinc-200 font-mono break-all transition-colors"
          >
            {txHash} ↗
          </a>
        </div>
      )}
      <button
        onClick={handleSend}
        disabled={sending}
        className="mt-auto w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? "Signing & sending…" : "Send"}
      </button>
    </div>
  );
}
