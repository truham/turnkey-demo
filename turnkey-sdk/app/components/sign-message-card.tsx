/**
 * Notes:
 * - `handleSignMessage` requires full `WalletAccount` object as `walletAccount`, not just
 *   the address string. Initially assumed passing `wallets[0]?.accounts[0]?.address` (0x...)
 *   would work, but the SDK needs the full object so it can read `address`, `source`, and
 *   other fields internally to route the signing correctly.
 * - `wallets[0]?.accounts[0]` is the correct pattern — the whole account object is what
 *   gets passed to `handleSignMessage`, `signRawPayload`, `signTransaction`, etc.
 * -
 */

"use client";

import { useTurnkey, useModal } from "@turnkey/react-wallet-kit";
import { SignMessageModal, SIGN_MESSAGE } from "./sign-message-custom-modal";

function SignatureResultModal({
  signature,
  onClose,
}: {
  signature: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-2 pt-6 pb-4 w-80">
      <div className="text-center space-y-1">
        <div className="text-3xl">🎉</div>
        <p className="text-zinc-100 font-semibold">Message signed!</p>
        <p className="text-zinc-500 text-xs">
          Turnkey signed this with your embedded wallet. The private key never
          left the enclave.
        </p>
      </div>
      <div>
        <p className="text-zinc-500 text-xs mb-2">Signature:</p>
        <pre className="rounded-lg bg-zinc-800/80 border border-zinc-700 p-3 text-emerald-400 text-xs overflow-x-auto break-all whitespace-pre-wrap max-h-36">
          {signature}
        </pre>
      </div>
      <button
        onClick={onClose}
        className="w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors"
      >
        Done
      </button>
    </div>
  );
}

export function SignMessageCard() {
  const { handleSignMessage, wallets } = useTurnkey();
  const { openModal, closeModal } = useModal();

  const handleSignMsg = () => {
    const walletAccount = wallets[0]?.accounts[0]; // using first account of first wallet
    console.log({ walletAccount });
    if (!walletAccount) return;

    openModal({
      key: "sign-message",
      showTitle: false,
      showTurnkeyBranding: false,
      content: (
        <SignMessageModal
          onConfirm={async () => {
            // * Sign a message or transaction
            const sig = await handleSignMessage({
              walletAccount,
              message: SIGN_MESSAGE,
            });
            const sigStr =
              typeof sig === "string" ? sig : sig ? JSON.stringify(sig) : "";
            openModal({
              key: "sign-message-result",
              showTitle: false,
              showTurnkeyBranding: false,
              content: (
                <SignatureResultModal signature={sigStr} onClose={closeModal} />
              ),
            });
          }}
        />
      ),
    });
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-5 py-5 flex flex-col gap-4">
      <div>
        <p className="text-zinc-100 font-medium">Sign Message</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          Sign a message with your embedded wallet via{" "}
          <code className="text-zinc-400">handleSignMessage</code>.
        </p>
      </div>
      <div>
        <p className="text-zinc-500 text-xs mb-2">Message:</p>
        <pre className="rounded-lg bg-zinc-800/80 border border-zinc-700 p-3 text-zinc-300 text-xs overflow-x-auto whitespace-pre-wrap">
          {SIGN_MESSAGE}
        </pre>
      </div>
      <button
        onClick={handleSignMsg}
        className="mt-auto w-full rounded-lg bg-[#335bf9] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#2a4dd4] transition-colors"
      >
        Sign message
      </button>
    </div>
  );
}
