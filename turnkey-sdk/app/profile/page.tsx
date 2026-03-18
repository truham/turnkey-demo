"use client";

import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { WalletSection } from "../components/wallet-section";
import { LogoutButton } from "../components/logout-button";
import { UpdateUsername } from "../components/update-username";
import { RegisterPasskey } from "../components/register-passkey";
import { AddPhoneNumber } from "../components/add-phone-number";
import { ExternalWalletAuth } from "../components/external-wallet-auth-custom"; // used in unauthenticated login state only

export default function ProfilePage() {
  const { authState, user, handleLogin } = useTurnkey();

  if (authState !== AuthState.Authenticated) {
    return (
      <div className="min-h-screen bg-zinc-800 flex items-center justify-center p-6">
        <main className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl shadow-black/20 p-6 space-y-4">
          <h1 className="text-2xl font-bold text-zinc-100">Manage Account</h1>
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => handleLogin()}
              className="w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors"
            >
              Log in
            </button>
            <div className="flex w-full items-center gap-3">
              <div className="h-px flex-1 bg-zinc-700" />
              <span className="text-xs text-zinc-500">or</span>
              <div className="h-px flex-1 bg-zinc-700" />
            </div>
            <ExternalWalletAuth />
          </div>
        </main>
      </div>
    );
  }

  const rawEmail =
    (user as { userEmail?: string } | undefined)?.userEmail ??
    (user?.userName?.includes("@") ? user.userName : undefined);

  return (
    <div className="min-h-screen bg-zinc-800 p-6 md:p-10">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-zinc-100">Profile</h1>

        {/* Account details + wallet */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 space-y-4">
          <p className="text-zinc-100 font-medium">Account</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Email:</dt>
            <dd className="text-zinc-100 font-mono text-xs truncate">
              {rawEmail ?? "—"}
            </dd>
            <dt className="text-zinc-500">Username:</dt>
            <dd className="text-zinc-100 font-mono text-xs truncate">
              {user?.userName ?? "—"}
            </dd>
            <dt className="text-zinc-500">User ID:</dt>
            <dd className="text-zinc-500 font-mono text-xs truncate">
              {user?.userId ?? "—"}
            </dd>
          </dl>
          <div className="border-t border-zinc-700 pt-4">
            <WalletSection />
          </div>
        </div>

        <UpdateUsername />

        <RegisterPasskey />

        <AddPhoneNumber />

        <LogoutButton />
      </div>
    </div>
  );
}
