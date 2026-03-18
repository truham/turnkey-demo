"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";

const NAV_LINKS = [
  { href: "/exploration", label: "Exploration" },
  { href: "/activity", label: "Activity" },
];

export function Nav() {
  const { authState, user } = useTurnkey();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  const navigate = (href: string) => {
    router.push(href);
  };

  if (authState !== AuthState.Authenticated) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-700 bg-zinc-900 px-6 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <button
                key={href}
                onClick={() => navigate(href)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Avatar — click goes to profile */}
        <button
          onClick={() => navigate("/profile")}
          className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 hover:bg-zinc-600 transition-colors cursor-pointer"
          title={user?.userName ?? "Profile"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
