"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePlayer } from "./PlayerProvider";
import { Icon } from "./Icon";
import { Artwork } from "./Artwork";
import { NowPlaying } from "./NowPlaying";

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/new", label: "New", icon: "new" },
  { href: "/radio", label: "Radio", icon: "radio" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/search", label: "Search", icon: "search" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/new") return path.startsWith("/new") || path.startsWith("/genre") || path.startsWith("/charts");
  if (href === "/search") return path.startsWith("/search") || path.startsWith("/artist") || path.startsWith("/album");
  return path.startsWith(href);
}

/**
 * The app frame. It lives in the root layout, so it — and the player inside it —
 * never unmounts when you switch tabs: the current song keeps playing.
 */
export function AppShell({ children, siteName }: { children: React.ReactNode; siteName: string }) {
  const path = usePathname() || "/";
  const { current, nowPlayingOpen, ytMountRef } = usePlayer();
  const kind = current?.playback.kind;
  const showsVideo = kind === "youtube";
  const showsEmbed = kind === "embed";
  const frameMode = nowPlayingOpen ? "np" : "dock";

  // Home-screen app: register the service worker (fast launch + offline page).
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="shell" data-player={current ? "on" : "off"} data-frame={showsVideo || showsEmbed ? "on" : "off"}>
      <a href="#content" className="skip">Skip to content</a>

      <aside className="sidebar" aria-label="Main">
        <Link href="/" className="brand">
          <img src="/icon.svg" alt="" width={30} height={30} />
          <span>{siteName}</span>
        </Link>
        <nav>
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={`side-link ${isActive(path, t.href) ? "on" : ""}`} aria-current={isActive(path, t.href) ? "page" : undefined}>
              <Icon name={t.icon} size={22} />
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <Link href="/submit" className="side-link small">
            <Icon name="upload" size={20} />
            Upload your music
          </Link>
          <Link href="/legal" className="side-link small">Terms and credits</Link>
        </div>
      </aside>

      <main id="content" className="content">
        {children}
      </main>

      {/* One persistent home for platform players. It moves between the dock and Now Playing
          with CSS only, so the YouTube video or embed is never reloaded and stays visible. */}
      <div className={`provider-frame ${frameMode}`} hidden={!showsVideo && !showsEmbed} aria-label="Official player">
        <div className="yt-mount" style={{ display: showsVideo ? "block" : "none" }}>
          <div ref={ytMountRef} />
        </div>
        {current && current.playback.kind === "embed" && officialPlayer(current.playback.src) && (
          <iframe
            key={current.playback.src}
            src={current.playback.src}
            title={`${current.title} in the ${current.playback.provider} player`}
            style={{ height: current.playback.height }}
            allow="autoplay; encrypted-media; clipboard-write"
          />
        )}
      </div>

      <MiniPlayer />
      {nowPlayingOpen && <NowPlaying />}

      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={isActive(path, t.href) ? "on" : ""} aria-current={isActive(path, t.href) ? "page" : undefined}>
            <Icon name={t.icon} size={25} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function MiniPlayer() {
  const { current, status, error, toggle, next, canControl, setNowPlayingOpen, position, duration, needsSound, turnOnSound } = usePlayer();
  if (!current) return null;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div className="mini" role="region" aria-label="Now playing">
      <button className="mini-open" onClick={() => setNowPlayingOpen(true)} aria-label={`Open Now Playing: ${current.title} by ${current.artist}`}>
        <Artwork src={current.artwork} title={current.title} />
        <span className="mini-text">
          <strong>{current.title}</strong>
          <span>{error ? <span className="mini-err">{error}</span> : current.artist}</span>
        </span>
      </button>
      {needsSound && (
        <button className="sound-btn" onClick={turnOnSound}>
          Turn on sound
        </button>
      )}
      {canControl && !needsSound && (
        <button className="icon-btn" onClick={toggle} aria-label={status === "playing" ? "Pause" : "Play"}>
          <Icon name={status === "loading" ? "spin" : status === "playing" ? "pause" : "play"} size={26} />
        </button>
      )}
      <button className="icon-btn" onClick={next} aria-label="Next song">
        <Icon name="next" size={24} />
      </button>
      {canControl && <span className="mini-progress" style={{ width: `${pct}%` }} aria-hidden="true" />}
    </div>
  );
}

// Only official platform players are ever put in an iframe.
const PLAYER_DOMAINS = ["mixcloud.com", "soundcloud.com", "bandcamp.com", "boomplay.com", "mdundo.com", "spotify.com", "audius.co", "dailymotion.com", "ampwall.com", "reverbnation.com", "hearthis.at", "youtube.com", "youtube-nocookie.com"];
function officialPlayer(src: string) {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "audiomack.com") return /^\/embed\/(song|album|playlist)\//.test(u.pathname);
    return PLAYER_DOMAINS.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
