"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { GENRES } from "@/lib/genres";
import { usePlayer } from "@/components/PlayerProvider";
import { SongList, GenreGrid, SectionHead } from "@/components/Shelves";
import { Artwork } from "@/components/Artwork";
import { Icon } from "@/components/Icon";
import { playLabel } from "@/lib/playinfo";

const LINK = /^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be|audiomack\.com|soundcloud\.com|on\.soundcloud\.com|mixcloud\.com|[\w-]+\.bandcamp\.com|bandcamp\.com|boomplay\.com|open\.spotify\.com|audius\.co|(play\.)?mdundo\.com)\//i;

interface ArtistResult {
  id: number;
  name: string;
  picture?: string;
  fans?: number;
  top: Track[];
}
interface Results {
  songs: Track[];
  mixes: Track[];
  stations: Track[];
  artist: ArtistResult | null;
}

export default function SearchPage() {
  const { playOne, playList } = usePlayer();
  const [q, setQ] = useState("");
  const [data, setData] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const term = q.trim();
  const isLink = LINK.test(term);

  useEffect(() => {
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

      {!term && (
        <section className="shelf" aria-label="Browse categories">
          <SectionHead title="Browse categories" />
          <GenreGrid genres={GENRES} />
        </section>
      )}

      {data?.artist && (
        <section className="artist-head" aria-label={data.artist.name}>
          <Artwork src={data.artist.picture} title={data.artist.name} round />
          <div>
            <h2 className="artist-name">{data.artist.name}</h2>
            {data.artist.fans ? <p className="muted small">{new Intl.NumberFormat("en", { notation: "compact" }).format(data.artist.fans)} fans on Deezer</p> : null}
            {data.artist.top.length > 0 && (
              <button className="btn btn-plum" onClick={() => playList(data.artist!.top, 0)}>
                <Icon name="play" size={18} />
                Play
              </button>
            )}
          </div>
        </section>
      )}
      {data?.artist && <SongList title="Top songs" tracks={data.artist.top} ranked />}

      {data && top && (
        <>
          {!data.artist && <section aria-label="Top result">
            <h2 className="h-section" style={{ marginBottom: 10 }}>Top result</h2>
            <button className="top-match" onClick={() => playList(topList, 0)}>
              <Artwork src={top.artwork} title={top.title} round={top.kind === "station"} />
              <span>
                <strong>{top.title}</strong>
                <span className="muted small">{top.artist}</span>
                <br />
                <span className="footnote">{playLabel(top)}</span>
              </span>
            </button>
          </section>}

          <SongList title={data.artist ? "More songs" : "Songs"} tracks={data.songs.filter((t) => !data.artist?.top.some((x) => x.id === t.id)).slice(0, 30)} showHow />
          <SongList title="DJ mixes and shows" tracks={data.mixes.slice(0, 15)} showHow />
          <SongList title="Radio stations" tracks={data.stations.slice(0, 15)} showHow />

          <div className="legend">
            <span>Plays in Meloa: the full song streams here.</span>
            <span>Meloa finds the full song: tap and Meloa looks for a licensed full-length version.</span>
            <span>Opens in another app: the song plays in that app, such as Spotify.</span>
            <span>Meloa never plays 30-second previews.</span>
          </div>
        </>
      )}
    </>
  );
}
