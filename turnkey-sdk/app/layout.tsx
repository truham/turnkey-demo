import "./globals.css";
import "@turnkey/react-wallet-kit/styles.css";
import { Providers } from "./providers";
import { ClientReadyWrapper } from "./client-ready-wrapper";
import { Nav } from "./components/nav";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-zinc-950">
      <body className="bg-zinc-950">
        <Providers>
          <ClientReadyWrapper>
            <div className="flex flex-col min-h-screen">
              <Nav />
              <div className="flex-1 pt-[57px]">{children}</div>
            </div>
          </ClientReadyWrapper>
        </Providers>
      </body>
    </html>
  );
}
