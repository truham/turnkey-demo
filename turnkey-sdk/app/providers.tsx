"use client";

import { useRouter } from "next/navigation";
import {
  TurnkeyProvider,
  TurnkeyProviderConfig,
} from "@turnkey/react-wallet-kit";

const turnkeyConfig: TurnkeyProviderConfig = {
  organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID!,
  ui: {
    darkMode: true,
    colors: {
      light: {
        primary: "#2ed962",
      },
      dark: {
        primary: "#da14c3",
      },
    },
    borderRadius: "20px",
    backgroundBlur: "10px",
  },
  auth: {
    methods: {
      walletAuthEnabled: true,
      smsOtpAuthEnabled: true,
    },
    oauthConfig: {
      openOauthInPage: true,
      oauthRedirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI ?? "",
      googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      // Optional: add more providers as needed
      // appleClientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? "",
      // facebookClientId: process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID ?? "",
      // xClientId: process.env.NEXT_PUBLIC_X_CLIENT_ID ?? "",
      discordClientId: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "",
    },
  },
  walletConfig: {
    features: {
      auth: true,
    },
    chains: {
      ethereum: {
        native: true,
        walletConnectNamespaces: [],
      },
      solana: {
        native: true,
        walletConnectNamespaces: [],
      },
    },
    // To enable WalletConnect, add your project ID and populate walletConnectNamespaces above:
    // walletConnect: {
    //   projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "",
    //   appMetadata: {
    //     name: "Turnkey Wallet Kit",
    //     description: "Turnkey Wallet Kit Demo",
    //     url: "http://localhost:3000",
    //     icons: [],
    //   },
    // },
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <TurnkeyProvider
      config={turnkeyConfig}
      callbacks={{
        onError: (error: any) => {
          console.error("Turnkey error:", error);
          console.error("Error details:", {
            message: error?.message,
            code: error?.code,
            cause: error?.cause,
            name: error?.name,
            stack: error?.stack,
          });
          // Redirect to profile when session is missing (e.g. user hit /activity without logging in)
          if (error?.code === "NO_SESSION_FOUND") {
            router.push("/profile");
          }
        },
        onAuthenticationSuccess: ({ session }: { session: any }) => {
          console.log("User authenticated:", session);
        },
        onSessionExpired: () => {
          console.warn(
            "[Turnkey] Session expired — user needs to re-authenticate."
          );
          router.push("/profile");
        },
      }}
    >
      {children}
    </TurnkeyProvider>
  );
}
