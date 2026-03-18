"use client";

/**
 * ClientReadyWrapper — gates app content until Turnkey SDK has initialized.
 *
 * Learnings (troubleshooting "Failed to initialize"):
 * - ERR_CERT_AUTHORITY_INVALID: Public/corporate WiFi (e.g. allergist's office)
 *   often uses proxies or firewalls that intercept HTTPS. Browser rejects the cert.
 *   Fix: Switch to phone hotspot or a trusted network.
 * - Invalid authProxyConfigId/organizationId: CORS or 401 before SDK gets a response.
 *   onError may not fire — failure happens at network layer.
 * - Config checklist: authProxyConfigId, organizationId match Turnkey dashboard;
 *   Auth Proxy enabled in dashboard → Wallet Kit.
 */
import { ClientState, AuthState, useTurnkey } from "@turnkey/react-wallet-kit";

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-zinc-300"
          aria-hidden
        />
        <p className="text-zinc-400 text-sm">Initializing Turnkey client...</p>
      </div>
    </div>
  );
}

function ErrorMessage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="max-w-md rounded-lg border border-red-800 bg-red-950/40 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-400">
          Failed to initialize
        </h2>
        <p className="mt-2 text-sm text-red-500">
          The Turnkey client could not be loaded. Please refresh the page or
          check your configuration.
        </p>
      </div>
    </div>
  );
}

export function ClientReadyWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { clientState, authState } = useTurnkey();

  // Show loading spinner while client initializes
  if (clientState === undefined || clientState === ClientState.Loading) {
    return <LoadingSpinner />;
  }

  // Handle client initialization errors
  if (clientState === ClientState.Error) {
    return <ErrorMessage />;
  }

  // Client is ready - render your UI
  return <>{children}</>;
}
