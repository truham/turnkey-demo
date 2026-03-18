/**
 * Notes:
 * - Custom confirmation modal injected into `handleSignMessage` via a `modal` render
 *   prop in exploration/page.tsx. The SDK handles all the crypto — this component is purely UI.
 * - `handleSignMessage` works out of the box with Turnkey's default modal, but
 *   also accepts a custom modal so companies can match their own brand and UX without touching
 *   any signing logic. Easy to support customers who want white-labeled confirmation flows.
 */

"use client";

import { useState } from "react";

export const SIGN_MESSAGE =
  "I'm signing this message with my embedded Turnkey wallet. The private key never left the enclave. ✅";

export function SignMessageModal({
  onConfirm,
}: {
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setErr(null);
    try {
      await onConfirm();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to sign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 px-2 pt-6 pb-4 w-72">
      <div className="w-14 h-14 rounded-2xl bg-[#335bf9] flex items-center justify-center shadow-lg">
        <span className="text-white font-bold text-xl tracking-tight">HT</span>
      </div>

      <div className="text-center space-y-1">
        <p className="text-zinc-100 font-semibold">Confirm message signature</p>
        <p className="text-zinc-500 text-xs">
          You&apos;re about to sign this message with your embedded wallet.
        </p>
      </div>

      <pre className="w-full rounded-lg bg-zinc-800/80 border border-zinc-700 p-3 text-zinc-300 text-xs whitespace-pre-wrap text-center">
        {SIGN_MESSAGE}
      </pre>

      {err && <p className="text-red-400 text-xs">{err}</p>}

      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Opening signing…" : "Continue to sign"}
      </button>
    </div>
  );
}
