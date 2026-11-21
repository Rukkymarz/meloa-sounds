import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";
import { PlayerBar } from "@/components/PlayerBar";

const NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Meloa Sounds";

export const metadata: Metadata = {
  title: NAME,
  description: "Every genre, full songs, free — played through each platform's official, licensed player.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0E0E10", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PlayerProvider>
          <header className="top">
            <Link href="/" className="brand">
              <img src="/icon.svg" alt="" width={28} height={28} />
              {NAME}
            </Link>
            <nav aria-label="Main">
              <Link href="/">Browse</Link>
              <Link href="/charts">Charts</Link>
              <Link href="/radio">Radio</Link>
              <Link href="/submit">Upload</Link>
            </nav>
          </header>
          <main>{children}</main>
          <p className="legal-foot">
            Music plays through Audius, Jamendo, Internet Archive, Openverse, ccMixter, YouTube, Audiomack, Mixcloud,
            SoundCloud, Bandcamp, Boomplay, Spotify and Radio Browser using their official APIs and players. Metadata
            and charts from Deezer, MusicBrainz, Apple Music RSS, Last.fm and LRCLIB. <Link href="/legal">Terms, credits & copyright</Link>
          </p>
          <PlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
