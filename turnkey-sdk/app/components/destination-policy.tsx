/**
 * ⚠️  Demo/prototype component — quite hacky!
 *
 * Notes:
 * - Explore Turnkey's policy engine with live enforcement
 * - Full flow:
 *     1. Toggle ON → creates a DENY policy for the burn address (0x000...) in the sub-org
 *     2. "Create test user" → generates a P256 keypair client-side, creates a non-root user
 *        in the sub-org via `httpClient.createUsers`, attaches the keypair as an API key
 *     3. Send to burn address as non-root user → DENY policy fires → 403 blocked
 *     4. Toggle OFF → deletes the policy → same send now would succeed
 *
 * Learnings:
 * 1. CEL string literals must use single quotes, not double quotes.
 *    `eth.tx.to == "0x..."` throws error 3 (invalid policy condition / parse error at token 13).
 *    `eth.tx.to == '0x...'` is correct. Not called out in the docs — found via runtime error.
 *
 * 2. Root user policy bypass — policies are NOT enforced for root users.
 *    Embedded wallet users are root in their own sub-org, so policies never fire for them.
 *    Solution: create a non-root user in the sub-org and sign as them — policies apply correctly.
 *    In production this would be a server-managed root quorum with the end user as non-root.
 *
 * 3. High-level TurnkeyClient falls back to the browser session stamper even when a custom
 *    ApiKeyStamper is injected. Bypassed by using ApiKeyStamper + raw fetch directly (same
 *    pattern as turnkey-api scripts). This ensures the request is genuinely signed as the
 *    non-root user, not the root session.
 *
 * 4. Non-root users are implicitly denied by default — they need an explicit ALLOW policy
 *    before they can do anything. The DENY policy layers on top of the ALLOW.
 *    Flow: create demo user → fetchOrCreatePolicies ALLOW ("true" condition) → DENY toggle adds
 *    a second DENY for the burn address. Toggle OFF deletes only the DENY; ALLOW stays.
 *    The 403 response body surfaces two outcomes:
 *    - OUTCOME_DENY_IMPLICIT: no matching ALLOW policy existed (seen before ALLOW was added)
 *    - OUTCOME_DENY_EXPLICIT: our DENY policy condition matched eth.tx.to (correct block)
 *
 * 5. createUsers rejects empty strings for userEmail/userPhoneNumber — must omit the fields
 *    entirely rather than pass "". Same validation pattern as the Turnkey API scripts.
 *
 * 6. Sub-org organizationId is available on walletAccount.organizationId (from v1WalletAccount),
 *    not on httpClient.config. Needed to scope the raw sign_transaction request correctly.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { ApiKeyStamper } from "@turnkey/core";
import { generateP256KeyPair } from "@turnkey/crypto";
import {
  createPublicClient,
  http,
  parseEther,
  serializeTransaction,
} from "viem";
import { sepolia } from "viem/chains";

const BLOCKED_DESTINATION = "0x0000000000000000000000000000000000000000";
const POLICY_NAME = "destination-deny-guard";
const ALLOW_POLICY_NAME = "demo-user-allow-sign";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org"
  ),
});

type DemoUser = {
  userId: string;
  publicKey: string;
  privateKey: string;
};

export function DestinationPolicy() {
  const { httpClient, fetchOrCreatePolicies, wallets } = useTurnkey();
  const [enabled, setEnabled] = useState(false);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [toggling, setToggling] = useState(false);

  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);
  const [allowPolicyId, setAllowPolicyId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [hasBeenActive, setHasBeenActive] = useState(false);

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: "success" | "blocked" | "error";
    message: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fetchExistingPolicy = useCallback(async () => {
    if (!httpClient) return;
    try {
      const res = await httpClient.getPolicies({});
      const match = (res?.policies ?? []).find(
        (p: any) => p.policyName === POLICY_NAME
      );
      if (match) {
        setEnabled(true);
        setPolicyId(match.policyId);
      } else {
        setEnabled(false);
        setPolicyId(null);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingPolicy(false);
    }
  }, [httpClient]);

  useEffect(() => {
    fetchExistingPolicy();
  }, [fetchExistingPolicy]);

  const handleToggle = async () => {
    setToggling(true);
    setError(null);
    setStatus(null);
    try {
      if (!enabled) {
        const res = await fetchOrCreatePolicies({
          policies: [
            {
              policyName: POLICY_NAME,
              effect: "EFFECT_DENY",
              condition: `eth.tx.to == '${BLOCKED_DESTINATION}'`,
              notes: `Blocks sign_transaction to burn address ${BLOCKED_DESTINATION}`,
            },
          ],
        });
        setPolicyId(res?.[0]?.policyId ?? null);
        setEnabled(true);
        setHasBeenActive(true);
        setStatus(
          "DENY policy active — sending to the burn address will be blocked."
        );
      } else {
        if (!policyId || !httpClient) return;
        await httpClient.deletePolicy({ policyId });
        setPolicyId(null);
        setEnabled(false);
        setSendResult(null);
        setStatus(
          "Policy removed — all destinations allowed again. Try sending to the burn address now."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update policy");
    } finally {
      setToggling(false);
    }
  };

  const handleCreateDemoUser = async () => {
    if (!httpClient) return;
    setCreatingUser(true);
    setError(null);
    try {
      const { publicKey, privateKey } = await generateP256KeyPair();
      const res = await httpClient.createUsers({
        users: [
          {
            userName: `policy-demo-user-${Date.now()}`,
            userTags: [],
            apiKeys: [
              {
                apiKeyName: "policy-demo-key",
                publicKey,
                curveType: "API_KEY_CURVE_P256" as any,
              },
            ],
            authenticators: [],
            oauthProviders: [],
          },
        ],
      });
      const userId =
        (res as any)?.userIds?.[0] ??
        (res as any)?.users?.[0]?.userId ??
        "unknown";
      setDemoUser({ userId, publicKey, privateKey });

      // Non-root users are implicitly denied by default.
      // Create an ALLOW policy so they can sign_transaction at all.
      // The DENY policy (when toggled on) layers on top of this.
      const allowRes = await fetchOrCreatePolicies({
        policies: [
          {
            policyName: ALLOW_POLICY_NAME,
            effect: "EFFECT_ALLOW",
            condition: "true",
            notes: "Allows the non-root demo user to sign transactions.",
          },
        ],
      });
      setAllowPolicyId(allowRes?.[0]?.policyId ?? null);

      setStatus(
        "Non-root user created — ALLOW policy added. Actions below are signed as this user. Policies apply."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create demo user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSendAsNonRoot = async () => {
    if (!demoUser || !httpClient) return;
    const walletAccount = wallets[0]?.accounts?.find(
      (a: any) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
    );
    if (!walletAccount) {
      setError("No Ethereum wallet found.");
      return;
    }
    if (!to || !amount) {
      setError("Enter a destination address and amount.");
      return;
    }
    if (!to.startsWith("0x")) {
      setError("Invalid address — must start with 0x.");
      return;
    }

    setSending(true);
    setSendResult(null);
    setError(null);

    try {
      // Build unsigned tx via viem
      const [nonce, feeData] = await Promise.all([
        publicClient.getTransactionCount({
          address: walletAccount.address as `0x${string}`,
        }),
        publicClient.estimateFeesPerGas(),
      ]);
      const unsignedTransaction = serializeTransaction({
        chainId: sepolia.id,
        to: to as `0x${string}`,
        value: parseEther(amount),
        nonce,
        gas: BigInt(21000),
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      });

      // Stamp the sign_transaction request directly as the non-root user.
      // We bypass TurnkeyClient (which falls back to the browser session stamper)
      // and use ApiKeyStamper + raw fetch — same pattern as our turnkey-api scripts.
      const stamper = new ApiKeyStamper({
        apiPublicKey: demoUser.publicKey,
        apiPrivateKey: demoUser.privateKey,
      });
      // Sub-org ID lives on the wallet account's organizationId field
      const orgId = (walletAccount as any).organizationId ?? "";
      const requestBody = JSON.stringify({
        type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
        timestampMs: Date.now().toString(),
        organizationId: orgId,
        parameters: {
          signWith: walletAccount.address,
          unsignedTransaction,
          type: "TRANSACTION_TYPE_ETHEREUM",
        },
      });
      const stamp = await stamper.stamp(requestBody);
      const response = await fetch(
        "https://api.turnkey.com/public/v1/submit/sign_transaction",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [stamp.stampHeaderName]: stamp.stampHeaderValue,
          },
          body: requestBody,
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const detail =
          errBody?.message ?? errBody?.error ?? response.statusText;
        throw new Error(
          `${response.status}::${detail}::${JSON.stringify(errBody)}`
        );
      }

      const data = await response.json();
      const signed =
        data?.activity?.result?.signTransactionResult?.signedTransaction;
      if (!signed) throw new Error("No signed transaction returned");

      // Broadcast
      const hash = await publicClient.sendRawTransaction({
        serializedTransaction: signed as `0x${string}`,
      });
      setSendResult({ type: "success", message: hash });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      const isBlocked =
        msg.includes("403") ||
        msg.toLowerCase().includes("not authorized") ||
        msg.toLowerCase().includes("deny");
      setSendResult({
        type: isBlocked ? "blocked" : "error",
        message: isBlocked
          ? `403 — DENY policy fired. Transaction blocked by Turnkey.\n\n${msg.split("::").slice(1).join("\n")}`
          : msg,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 space-y-5">
      {/* ── Section 1: Policy toggle ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-zinc-100 font-medium">Destination Policy</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            Creating a non-root user adds an{" "}
            <code className="text-zinc-400">EFFECT_ALLOW</code> policy so they
            can sign at all. Toggle to layer a{" "}
            <code className="text-zinc-400">EFFECT_DENY</code> on top — explicit
            DENY beats ALLOW, blocking{" "}
            <code className="text-zinc-400">sign_transaction</code> to the burn
            address. Toggle off to remove the DENY and watch the same send
            succeed.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling || loadingPolicy}
          className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled ? "bg-[#335bf9]" : "bg-zinc-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-3 py-2.5 space-y-1">
        <p className="text-zinc-500 text-xs">
          Blocked destination (burn address)
        </p>
        <p className="text-zinc-300 text-xs font-mono">{BLOCKED_DESTINATION}</p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${enabled ? "bg-emerald-400" : "bg-zinc-600"}`}
        />
        <p className="text-xs text-zinc-500">
          {loadingPolicy
            ? "Checking policy…"
            : enabled
              ? "DENY policy active"
              : "No policy — all destinations allowed"}
        </p>
      </div>

      {/* ── Section 2: Create non-root user ── */}
      {(enabled || hasBeenActive) && (
        <div className="border-t border-zinc-700 pt-4 space-y-3">
          <div>
            <p className="text-zinc-100 text-sm font-medium">
              Step 1 — Create non-root test user
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Generates a P256 keypair client-side, creates a non-root user in
              your sub-org, and attaches the keypair as an API key. Actions
              below will be signed as this user — policies apply to them.
            </p>
          </div>

          {demoUser ? (
            <div className="rounded-lg bg-zinc-800/60 border border-zinc-700 px-3 py-2.5 space-y-1">
              <p className="text-emerald-400 text-xs font-medium">
                ✓ Non-root user ready
              </p>
              <p className="text-zinc-500 text-xs font-mono truncate">
                ID: {demoUser.userId}
              </p>
              <p className="text-zinc-500 text-xs font-mono truncate">
                Key: {demoUser.publicKey.slice(0, 20)}…
              </p>
            </div>
          ) : (
            <button
              onClick={handleCreateDemoUser}
              disabled={creatingUser}
              className="w-full rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingUser ? "Creating user…" : "Create test user in sub-org"}
            </button>
          )}
        </div>
      )}

      {/* ── Section 3: Send as non-root ── */}
      {(demoUser || hasBeenActive) && (
        <div className="border-t border-zinc-700 pt-4 space-y-3">
          <div>
            <p className="text-zinc-100 text-sm font-medium">
              Step 2 — Send as non-root user
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">
              Try sending to <code className="text-zinc-400">0x0000…</code> —
              expect a 403 DENY. Try any other address — expect it to succeed.
            </p>
          </div>

          <input
            type="text"
            placeholder="Destination address (0x...)"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setSendResult(null);
            }}
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <input
            type="number"
            placeholder="Amount (ETH)"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setSendResult(null);
            }}
            min="0"
            step="0.0001"
            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />

          {sendResult && (
            <div
              className={`rounded-lg border px-3 py-2.5 space-y-1 ${
                sendResult.type === "blocked"
                  ? "border-red-500/30 bg-red-500/5"
                  : sendResult.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
              }`}
            >
              <p
                className={`text-xs font-medium ${
                  sendResult.type === "blocked"
                    ? "text-red-400"
                    : sendResult.type === "success"
                      ? "text-emerald-400"
                      : "text-amber-400"
                }`}
              >
                {sendResult.type === "blocked"
                  ? "✗ Blocked by policy"
                  : sendResult.type === "success"
                    ? "✓ Transaction sent"
                    : "Error"}
              </p>
              {sendResult.type === "success" ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${sendResult.message}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#335bf9] hover:underline break-all"
                >
                  {sendResult.message}
                </a>
              ) : (
                <pre className="text-zinc-500 text-xs break-all whitespace-pre-wrap">
                  {sendResult.message}
                </pre>
              )}
            </div>
          )}

          {!demoUser && (
            <p className="text-amber-400 text-xs">
              Create a test user above first to send as a non-root user.
            </p>
          )}
          <button
            onClick={handleSendAsNonRoot}
            disabled={sending || !to || !amount || !demoUser}
            className="w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Signing & sending…" : "Send as non-root user"}
          </button>
        </div>
      )}

      {status && <p className="text-emerald-400 text-xs">{status}</p>}
      {error && <p className="text-red-400 text-xs break-all">{error}</p>}
    </div>
  );
}
