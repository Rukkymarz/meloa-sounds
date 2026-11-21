"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/lib/types";
import { TrackList } from "./TrackList";
import { usePlayer } from "./PlayerProvider";
import { Icon } from "./Icon";

type Tab = "all" | "song" | "mix" | "station";
const LINK = /^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be|audiomack\.com|soundcloud\.com|on\.soundcloud\.com|mixcloud\.com|[\w-]+\.bandcamp\.com|bandcamp\.com|boomplay\.com|open\.spotify\.com|audius\.co|(play\.)?mdundo\.com)\//i;

export function SearchView() {
  const { playOne } = usePlayer();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [data, setData] = useState<{ songs: Track[]; mixes: Track[]; stations: Track[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (timer.current) clearTimeout(timer.current);
    setMsg(null);
    if (!term) {
      setData(null);
      return;
    }
    if (LINK.test(term)) return; // handled on submit
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}&type=${tab}`);
        const j = await r.json();
        setData({ songs: j.songs || [], mixes: j.mixes || [], stations: j.stations || [] });
        if (!j.results?.length) setMsg("No full-length results yet. Paste a YouTube, Audiomack or Boomplay link to add it.");
      } catch {
        setMsg("Search failed. Check your connection.");
      } finally {
        setBusy(false);
      }
    }, 400);
  }, [q, tab]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!LINK.test(term)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/link?url=${encodeURIComponent(term)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      playOne(j.track);
      setMsg(`Playing "${j.track.title}" and saved it to the catalog.`);
      setQ("");
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isLink = LINK.test(q.trim());

  return (
    <>
      <form className="search" onSubmit={onSubmit} role="search">
        <label htmlFor="q" className="sr-only" style={{ position: "absolute", left: -9999 }}>
          Search songs, artists, mixes, stations, or paste a link
        </label>
        <input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any song, artist, mix or station — or paste a link"
          autoComplete="off"
          inputMode="search"
        />
        {isLink && (
          <button className="btn" type="submit" disabled={busy} aria-label="Play link">
            <Icon name="link" />
          </button>
        )}
      </form>
      <div className="tabs" role="tablist">
        {(["all", "song", "mix", "station"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t === "all" ? "All" : t === "song" ? "Songs" : t === "mix" ? "DJ Mixes" : "Radio"}
          </button>
        ))}
      </div>
      {busy && <p className="hint">Searching every source…</p>}
      {msg && <p className="hint">{msg}</p>}
      {data && (
        <>
          <TrackList title="Songs" tracks={data.songs} />
          <TrackList title="DJ mixes & shows" tracks={data.mixes} />
          <TrackList title="Live radio" tracks={data.stations} />
        </>
      )}
    </>
  );
}
