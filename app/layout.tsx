import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";
import { AppShell } from "@/components/AppShell";

const display = Familjen_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

const NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Meloa Sounds";

export const metadata: Metadata = {
  title: { default: NAME, template: `%s · ${NAME}` },
  description: "Music from every corner of the world, played through each platform's official, licensed player.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Meloa", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FAF5EC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body>
        <PlayerProvider>
          <AppShell siteName={NAME}>{children}</AppShell>
        </PlayerProvider>
      </body>
    </html>
  );
}
