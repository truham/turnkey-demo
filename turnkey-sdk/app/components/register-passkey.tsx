/**
 * Notes:
 * - Built as prerequisite for `sign-with-passkey.tsx`
 *   (https://docs.turnkey.com/sdks/react/advanced-api-requests)
 * - Had to dig around to find the handleAddPassKey & handleRemovePassKey
 *   Would be helpful to have these surfaced in the docs as prerequisites
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTurnkey } from "@turnkey/react-wallet-kit";

type Authenticator = {
  authenticatorId: string;
  authenticatorName: string;
  model: string;
  credentialId: string;
};

export function RegisterPasskey() {
  const { handleAddPasskey, handleRemovePasskey, httpClient, user } =
    useTurnkey();
  const router = useRouter();

  const [passkeys, setPasskeys] = useState<Authenticator[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    if (!httpClient || !user?.userId) return;
    setLoadingList(true);
    try {
      const res = await httpClient.getAuthenticators({
        userId: user.userId,
      });
      setPasskeys((res?.authenticators ?? []) as Authenticator[]);
    } catch {
      // silently fail — list just stays empty
    } finally {
      setLoadingList(false);
    }
  }, [httpClient, user?.userId]);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);
    setAddSuccess(false);
    try {
      await handleAddPasskey({
        name: "Passkey",
        displayName: user?.userName ?? user?.userId ?? "Passkey",
      });
      setAddSuccess(true);
      await fetchPasskeys();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (authenticatorId: string) => {
    setRemovingId(authenticatorId);
    setRemoveError(null);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("dismissed")), 15_000)
      );
      await Promise.race([handleRemovePasskey({ authenticatorId }), timeout]);
      await fetchPasskeys();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "dismissed") setRemoveError(msg);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 space-y-4">
      <div>
        <p className="text-zinc-100 font-medium">Passkey Manager</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          Register or remove passkey authenticators on your account via{" "}
          <code className="text-zinc-400">handleAddPasskey</code> /{" "}
          <code className="text-zinc-400">handleRemovePasskey</code>.
        </p>
      </div>

      {/* Existing passkeys */}
      <div className="space-y-2">
        <p className="text-zinc-500 text-xs uppercase tracking-wide">
          Registered passkeys
        </p>
        {loadingList ? (
          <p className="text-zinc-600 text-xs">Loading…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-zinc-600 text-xs">None registered yet.</p>
        ) : (
          passkeys.map((pk) => (
            <div
              key={pk.authenticatorId}
              className="flex items-center justify-between rounded-lg bg-zinc-800/60 border border-zinc-700 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-zinc-100 text-sm font-medium truncate">
                  {pk.authenticatorName || "Passkey"}
                </p>
                <p className="text-zinc-500 text-xs truncate">
                  {pk.model || "—"} ·{" "}
                  <span className="font-mono">
                    {pk.credentialId.slice(0, 10)}…
                  </span>
                </p>
              </div>
              <button
                onClick={() => handleRemove(pk.authenticatorId)}
                disabled={removingId === pk.authenticatorId}
                className="ml-3 shrink-0 rounded-lg border border-red-800/60 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {removingId === pk.authenticatorId ? "Removing…" : "Remove"}
              </button>
            </div>
          ))
        )}
        {removeError && <p className="text-red-400 text-xs">{removeError}</p>}
      </div>

      <div className="border-t border-zinc-700 pt-4 space-y-3">
        {addSuccess && (
          <p className="text-emerald-400 text-xs">
            ✓ Passkey registered — try{" "}
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: "instant" });
                router.push("/exploration");
              }}
              className="underline underline-offset-2 hover:text-emerald-300 transition-colors"
            >
              Sign with passkey on Exploration
            </button>
            .
          </p>
        )}
        {addError && (
          <p className="text-red-400 text-xs break-all">{addError}</p>
        )}
        {passkeys.length >= 1 && !adding && (
          <p className="text-zinc-500 text-xs">
            Remove your existing passkey to register a new one.
          </p>
        )}
        <button
          onClick={handleAdd}
          disabled={adding || passkeys.length >= 1}
          className="w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? "Follow the passkey prompt…" : "+ Register Passkey"}
        </button>
      </div>
    </div>
  );
}
