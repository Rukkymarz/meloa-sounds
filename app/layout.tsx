import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";
import { AppShell } from "@/components/AppShell";
import { themeBootScript } from "@/components/Appearance";

const display = Familjen_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });

const NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Meloa Sounds";

export const metadata: Metadata = {
  title: { default: NAME, template: `%s · ${NAME}` },
  description: "Music from every corner of the world, played through each platform's official, licensed player.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }] },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "Meloa", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0f0e11",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable} data-theme="dark" data-accent="rose" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <PlayerProvider>
          <AppShell siteName={NAME}>{children}</AppShell>
        </PlayerProvider>
      </body>
    </html>
  );
}
