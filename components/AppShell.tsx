"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

  // The small official player can be dragged anywhere and snaps to the nearest corner.
  const frameRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("meloa:frame-pos") || "null");
      if (saved) setDrag(saved);
    } catch {}
  }, []);
  function settle(pos: { x: number; y: number }) {
    const el = frameRef.current;
    if (!el) return setDrag(pos);
    // base position is bottom-right; snap left/right and keep it on screen
    const r = el.getBoundingClientRect();
    const baseLeft = r.left - pos.x;
    const baseTop = r.top - pos.y;
    const toLeft = r.left + r.width / 2 < window.innerWidth / 2;
    const x = toLeft ? 8 - baseLeft : 0;
    const minY = 8 - baseTop + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-t")) || 0);
    const maxY = 0 + 60; // may sit a little lower, over the mini-player edge
    const y = Math.min(maxY, Math.max(minY, pos.y));
    const next = { x, y };
    setDrag(next);
    try {
      localStorage.setItem("meloa:frame-pos", JSON.stringify(next));
    } catch {}
  }
  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); // keep the drag even over the video
    } catch {}
    const start = { px: e.clientX, py: e.clientY, ...drag };
    let last = drag;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      last = { x: start.x + ev.clientX - start.px, y: start.y + ev.clientY - start.py };
      setDrag(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
      settle(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function keyMove(e: React.KeyboardEvent) {
    const step = 40;
    const d = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-400, 0], ArrowRight: [400, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    settle({ x: drag.x + d[0], y: drag.y + d[1] });
  }

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
      <div
        ref={frameRef}
        className={`provider-frame ${frameMode}${dragging ? " dragging" : ""}`}
        hidden={!showsVideo && !showsEmbed}
        aria-label="Official player"
        style={frameMode === "dock" ? ({ "--dx": `${drag.x}px`, "--dy": `${drag.y}px` } as React.CSSProperties) : undefined}
      >
        <div className="frame-grip" role="button" aria-label="Drag to move the player" tabIndex={0} onPointerDown={startDrag} onKeyDown={keyMove} />
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
