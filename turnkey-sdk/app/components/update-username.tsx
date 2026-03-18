/**
 * Notes:
 * - `API_KEY_EXPIRED` was a friction point: I interpreted as the root API key in `.env` needs
 *   rotating, but it actually refers to the SDK's internal short-lived session key generated
 *   at login (leaving the browser tab idle long enough will trigger this). The fix is simply
 *   to re-authenticate, not update any credentials.
 *   A clearer message like "Session expired, please log in again" would have helped
 *   reduce confusion for me.
 * - Otherwise 'Failed to update user name' was explicit and easy to follow error message.
 */

"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";

export function UpdateUsername() {
  const { handleUpdateUserName } = useTurnkey();
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await handleUpdateUserName({ userName: newName.trim() });
      setSuccess(true);
      setNewName("");
    } catch (e) {
      console.log({ e });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 space-y-4">
      <div>
        <p className="text-zinc-100 font-medium">Update username</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          Sets a human-readable display name on your Turnkey sub-org user.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setSuccess(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="e.g. hamilton-user-001"
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={saving || !newName.trim()}
          className="rounded-lg bg-[#335bf9] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {success && <p className="text-emerald-400 text-xs">Username updated.</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
