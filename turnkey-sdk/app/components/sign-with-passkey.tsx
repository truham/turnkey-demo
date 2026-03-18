/**
 * Notes:
 * - `StamperType.Passkey`: by default `httpClient` silently stamps
 *   requests with the stored session API key. Passing `StamperType.Passkey` as a second
 *   argument overrides the stamper and forces the browser to prompt for a biometric/passkey
 *   confirmation before the request is sent — step-up authentication.
 * - Prerequisite: the user must have a passkey registered on their account. We check this
 *   upfront via `httpClient.getAuthenticators()` and surface a nudge to go to Profile if
 *   none is found — otherwise the button would silently fail or error with no clear reason.
 * - Real-world use case: step-up auth is a powerful pattern for high-value actions (e.g.
 *   withdrawals over $100K, large transfers). Instead of requiring full multi-party consensus,
 *   you can gate a specific action behind a passkey prompt for that individual user — adds a
 *   layer of friction for sensitive operations without needing quorum (albeit quorum is likely most ideal).
 * - If the user dismisses the passkey prompt, the browser throws a `NotAllowedError` and
 *   the request never reaches Turnkey — no activity is created, nothing is signed.
 * - https://docs.turnkey.com/sdks/react/advanced-api-requests
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTurnkey, StamperType } from "@turnkey/react-wallet-kit";

const DEMO_MESSAGE = "Step-up auth demo — signed with passkey, not API key.";

type State =
  | { type: "idle" }
  | { type: "pending" }
  | { type: "success"; r: string; s: string; v: string }
  | { type: "denied" }
  | { type: "error"; message: string };

function isUserCancel(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = (e as DOMException).name ?? "";
  const msg = e.message.toLowerCase();
  return (
    name === "NotAllowedError" ||
    msg.includes("not allowed") ||
    msg.includes("cancel") ||
    msg.includes("denied") ||
    msg.includes("abort")
  );
}

export function SignWithPasskey() {
  const { httpClient, wallets, user } = useTurnkey();
  const router = useRouter();
  const [state, setState] = useState<State>({ type: "idle" });
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    if (!httpClient || !user?.userId) return;
    httpClient
      .getAuthenticators({ userId: user.userId })
      .then((res) => setHasPasskey((res?.authenticators?.length ?? 0) > 0))
      .catch(() => setHasPasskey(false));
  }, [httpClient, user?.userId]);

  const handleSign = async () => {
    const address = wallets[0]?.accounts[0]?.address;
    if (!address || !httpClient) return;

    setState({ type: "pending" });
    try {
      const payload = Buffer.from(DEMO_MESSAGE, "utf8").toString("hex");
      const response = await httpClient.signRawPayload(
        {
          signWith: address,
          payload,
          encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
          hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
        },
        StamperType.Passkey
      );
      const { r, s, v } = response;
      setState({ type: "success", r, s, v });
    } catch (e) {
      if (isUserCancel(e)) {
        setState({ type: "denied" });
      } else {
        setState({
          type: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }
  };

  const reset = () => setState({ type: "idle" });

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* How it works */}
      <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-3 py-2.5 space-y-1">
        <p className="text-zinc-400 text-xs font-medium">How it works</p>
        <p className="text-zinc-500 text-xs leading-relaxed">
          By default, <code className="text-zinc-300">httpClient</code> stamps
          requests with a stored API key silently. Passing{" "}
          <code className="text-zinc-300">StamperType.Passkey</code> forces the
          browser to prompt for your passkey first — step-up auth for sensitive
          operations.
        </p>
      </div>

      {/* Message */}
      <div>
        <p className="text-zinc-500 text-xs mb-2">Payload to sign:</p>
        <pre className="rounded-lg bg-zinc-800/80 border border-zinc-700 p-3 text-zinc-300 text-xs whitespace-pre-wrap">
          {DEMO_MESSAGE}
        </pre>
      </div>

      {/* No passkey registered nudge */}
      {hasPasskey === false && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 flex items-start justify-between gap-3">
          <p className="text-amber-400 text-xs leading-relaxed">
            No passkey registered. Add one on your Profile to use step-up auth.
          </p>
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "instant" });
              router.push("/profile");
            }}
            className="shrink-0 rounded-lg border border-amber-700/50 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-900/30 transition-colors"
          >
            Go to Profile →
          </button>
        </div>
      )}

      {/* Result states */}
      {state.type === "success" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 space-y-2">
          <p className="text-emerald-400 text-xs font-medium">
            ✓ Passkey confirmed — signature returned
          </p>
          <div className="space-y-1 font-mono text-xs text-zinc-400 break-all">
            <p>
              <span className="text-zinc-500">r: </span>
              {state.r}
            </p>
            <p>
              <span className="text-zinc-500">s: </span>
              {state.s}
            </p>
            <p>
              <span className="text-zinc-500">v: </span>
              {state.v}
            </p>
          </div>
        </div>
      )}

      {state.type === "denied" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 space-y-1">
          <p className="text-amber-400 text-xs font-medium">
            ✗ Passkey prompt dismissed
          </p>
          <p className="text-zinc-500 text-xs">
            The request was not sent to Turnkey — without a valid passkey stamp,
            the API call never leaves the browser.
          </p>
        </div>
      )}

      {state.type === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-3 space-y-1">
          <p className="text-red-400 text-xs font-medium">Error</p>
          <p className="text-zinc-500 text-xs break-all">{state.message}</p>
        </div>
      )}

      {/* Actions */}
      {state.type === "idle" || state.type === "pending" ? (
        <button
          onClick={handleSign}
          disabled={state.type === "pending" || hasPasskey === false}
          className="mt-auto w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.type === "pending"
            ? "Waiting for passkey…"
            : "Sign with passkey"}
        </button>
      ) : (
        <button
          onClick={reset}
          className="mt-auto w-full rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
