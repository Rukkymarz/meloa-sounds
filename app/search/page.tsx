"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { usePlayer } from "@/components/PlayerProvider";
import { SongList, GenreGrid, SectionHead } from "@/components/Shelves";
import { Artwork } from "@/components/Artwork";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { AlbumShelf, ArtistShelf, type AlbumLite } from "@/components/Albums";

const LINK = /^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be|audiomack\.com|soundcloud\.com|on\.soundcloud\.com|mixcloud\.com|[\w-]+\.bandcamp\.com|bandcamp\.com|boomplay\.com|open\.spotify\.com|audius\.co|(play\.)?mdundo\.com)\//i;

interface ArtistResult {
  id: number;
  name: string;
  picture?: string;
  fans?: number;
  top: Track[];
  albums: AlbumLite[];
  singles: AlbumLite[];
  related: { id: number; name: string; picture?: string }[];
}
interface Results {
  songs: Track[];
  mixes: Track[];
  stations: Track[];
  artist: ArtistResult | null;
}

// Recent searches stay on this device; the last search is restored when you come back to the tab.
const RECENT_KEY = "meloa:recent-searches";
const LAST_KEY = "meloa:last-search";
function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function SearchPage() {
  const { playOne, playList } = usePlayer();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(readRecent());
    try {
      const last = sessionStorage.getItem(LAST_KEY);
      if (last) setQ(last);
    } catch {}
  }, []);

  const remember = (term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 15);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
  };
  const [data, setData] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const lastGood = useRef("");
  const rememberRef = useRef(remember);
  rememberRef.current = remember;

  // Save the search when you play something from it, press Search, or leave the tab
  // (not every half-typed word).
  useEffect(() => () => {
    if (lastGood.current) rememberRef.current(lastGood.current);
  }, []);

  const term = q.trim();
  const isLink = LINK.test(term);

  useEffect(() => {
    try {
      sessionStorage.setItem(LAST_KEY, term);
    } catch {}
    if (timer.current) clearTimeout(timer.current);
    setMsg(null);
    if (!term || isLink) {
      setData(null);
      return;
    }
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      setBusy(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}&type=all`);
        const j = await r.json();
        if (id !== reqId.current) return;
        setData({ songs: j.songs || [], mixes: j.mixes || [], stations: j.stations || [], artist: j.artist || null });
        if (j.results?.length || j.artist) lastGood.current = term;
        if (!j.results?.length && !j.artist) setMsg(`Nothing full-length found for "${term}". Paste a YouTube, Audiomack or Boomplay link to add a song.`);
      } catch {
        if (id === reqId.current) setMsg("Search isn't reachable right now. Check your connection and try again.");
      } finally {
        if (id === reqId.current) setBusy(false);
      }
    }, 350);
  }, [term, isLink]);

  async function openLink() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/link?url=${encodeURIComponent(term)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      playOne(j.track);
      setMsg(`Playing "${j.track.title}". It's now in the Meloa catalog.`);
      setQ("");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const top = data?.songs[0] || data?.mixes[0] || data?.stations[0];
  const topList = top ? (data!.songs[0] === top ? data!.songs : data!.mixes[0] === top ? data!.mixes : data!.stations) : [];

  return (
    <>
      <header className="page-head">
        <h1 className="h-large">Search</h1>
      </header>

      <form
        className="searchbar"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (isLink) openLink();
          else if (term) remember(term);
        }}
      >
        <div className="searchbar-in">
          <Icon name="search" size={20} />
          <label htmlFor="q" className="sr">Songs, artists, mixes, stations, or a link</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Songs, artists, radio, or paste a link" autoComplete="off" enterKeyHint="search" inputMode="search" />
          {q && (
            <button type="button" className="icon-btn" onClick={() => setQ("")} aria-label="Clear search">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        {isLink && (
          <button className="btn btn-plum" style={{ marginTop: 10 }} disabled={busy}>
            <Icon name="link" size={18} />
            Play this link
          </button>
        )}
      </form>

      {busy && <p className="hint" role="status">Searching every catalog…</p>}
      {msg && <p className="hint" role="status">{msg}</p>}

      {!term && recent.length > 0 && (
        <section className="shelf" aria-label="Recent searches">
          <div className="shelf-head">
            <h2 className="h-section">Recent searches</h2>
            <button className="text-btn" onClick={clearRecent}>Clear</button>
          </div>
          <ul className="recent">
            {recent.map((r) => (
              <li key={r}>
                <button onClick={() => setQ(r)}>
                  <Icon name="search" size={18} />
                  <span>{r}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!term && (
        <section className="shelf" aria-label="Browse categories">
          <SectionHead title="Browse categories" />
          <GenreGrid genres={GENRES} />
        </section>
      )}

      {data?.artist && (
        <section className="artist-head" aria-label={data.artist.name}>
          <Link href={`/artist/${data.artist.id}`} aria-label={`Open ${data.artist.name}`}>
            <Artwork src={data.artist.picture} title={data.artist.name} round />
          </Link>
          <div>
            <h2 className="artist-name">
              <Link href={`/artist/${data.artist.id}`} style={{ textDecoration: "none" }}>{data.artist.name}</Link>
            </h2>
            {data.artist.fans ? <p className="muted small">{new Intl.NumberFormat("en", { notation: "compact" }).format(data.artist.fans)} fans on Deezer</p> : null}
            {data.artist.top.length > 0 && (
              <button className="btn btn-plum" onClick={() => { remember(term); playList(data.artist!.top, 0); }}>
                <Icon name="play" size={18} />
                Play
              </button>
            )}
          </div>
        </section>
      )}
      {data?.artist && (
        <>
          <SongList title="Top songs" tracks={data.artist.top.slice(0, 5)} href={`/artist/${data.artist.id}`} />
          <AlbumShelf title="Albums" albums={data.artist.albums} href={`/artist/${data.artist.id}`} />
          <AlbumShelf title="Singles & EPs" albums={data.artist.singles} href={`/artist/${data.artist.id}`} />
          <ArtistShelf title="Similar artists" artists={data.artist.related} />
        </>
      )}

      {data && top && (
        <>
          {!data.artist && <section aria-label="Top result">
            <h2 className="h-section" style={{ marginBottom: 10 }}>Top result</h2>
            <button className="top-match" onClick={() => { remember(term); playList(topList, 0); }}>
              <Artwork src={top.artwork} title={top.title} round={top.kind === "station"} />
              <span>
                <strong>{top.title}</strong>
                <span className="muted small">{top.artist}</span>

              </span>
            </button>
          </section>}

          <SongList title={data.artist ? "More songs" : "Songs"} tracks={data.songs.filter((t) => !data.artist?.top.some((x) => x.id === t.id)).slice(0, 30)} showHow />
          <SongList title="DJ mixes and shows" tracks={data.mixes.slice(0, 15)} showHow />
          <SongList title="Radio stations" tracks={data.stations.slice(0, 15)} showHow />

        </>
      )}
    </>
  );
}
