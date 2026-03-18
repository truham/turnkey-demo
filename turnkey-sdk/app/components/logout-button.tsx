"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";

export function LogoutButton({ className }: { className?: string }) {
  const { logout } = useTurnkey();

  return (
    <button
      onClick={() => logout()}
      className={
        className ??
        "rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
      }
    >
      Log out
    </button>
  );
}
