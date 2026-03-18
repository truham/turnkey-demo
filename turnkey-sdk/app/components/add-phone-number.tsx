/**
 * Notes:
 * - Built out `handleAddPhoneNumber` and `handleRemoveUserPhoneNumber` from `useTurnkey()`,
 *   then hit an error when trying to use it.
 * - Root cause: SMS OTP auth is not enabled by default — it requires going into the Turnkey
 *   dashboard under Organization Settings and explicitly enabling it.
 * - After finding the toggle, it was grayed out with a tooltip saying the feature is only
 *   available for enterprise clients. Blocked at the platform/account tier level.
 * - Upfront indication in the docs or SDK that SMS OTP requires enterprise access would be helpful.
 *   (error code 7: SMS OTP disallowed) is descriptive once you hit it, but a developer could
 *   spend time building the integration before discovering the gate.
 */

"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";

export function AddPhoneNumber() {
  const { handleAddPhoneNumber, handleRemoveUserPhoneNumber, user } =
    useTurnkey();

  const phoneNumber = (user as { userPhoneNumber?: string } | undefined)
    ?.userPhoneNumber;

  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    try {
      await handleAddPhoneNumber({ successPageDuration: 2000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await handleRemoveUserPhoneNumber({ successPageDuration: 2000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 space-y-4">
      <div>
        <p className="text-zinc-100 font-medium">Phone Number</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          Link a phone number as an auth method via{" "}
          <code className="text-zinc-400">handleAddPhoneNumber</code>. Once
          linked, you can sign in with SMS OTP.{" "}
          <span className="text-amber-500/80">
            SMS OTP is enterprise-gated in the Turnkey dashboard — calling this
            returns error 7 (SMS OTP disallowed) until enabled.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Phone:</dt>
        <dd className="text-zinc-100 font-mono text-xs">
          {phoneNumber ?? <span className="text-zinc-600">Not linked</span>}
        </dd>
      </div>

      {error && <p className="text-red-400 text-xs break-all">{error}</p>}

      <div className="flex gap-2 pt-1">
        {phoneNumber ? (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="rounded-lg border border-red-800/60 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {removing ? "Removing…" : "Remove phone number"}
          </button>
        ) : (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? "Opening…" : "+ Add phone number"}
          </button>
        )}
      </div>
    </div>
  );
}
