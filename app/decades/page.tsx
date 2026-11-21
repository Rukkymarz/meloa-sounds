"use client";

import { useEffect, useState } from "react";
import { SongList } from "@/components/Shelves";
import { GENRES } from "@/lib/genres";
import type { Track } from "@/lib/types";

const NAME = (slug: string) => GENRES.find((g) => g.slug === slug)?.name || slug.replace(/-/g, " ");

// Browse verified full songs by the decade they were first released (not upload or reissue year).
export default function Decades() {
  const [facets, setFacets] = useState<{ decades: { decade: number; count: number }[]; genres: { genre: string; count: number }[] } | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);

  useEffect(() => {
    fetch("/api/browse?facets=1").then((r) => r.json()).then((f) => {
      setFacets(f);
      const pick = f.decades.find((d: any) => d.decade === 1980) || f.decades[0];
      if (pick) setDecade(pick.decade);
    }).catch(() => setFacets({ decades: [], genres: [] }));
  }, []);

  useEffect(() => {
    if (decade === null && !genre) return;
    setTracks(null);
    const qs = new URLSearchParams();
    if (decade !== null) qs.set("decade", String(decade));
    if (genre) qs.set("genre", genre);
    fetch(`/api/browse?${qs}`).then((r) => r.json()).then((j) => setTracks(j.tracks || [])).catch(() => setTracks([]));
  }, [decade, genre]);

  return (
    <>
      <header className="page-head">
        <h1 className="h-large">Decades</h1>
      </header>
      {facets && facets.decades.length === 0 && (
        <div className="empty">
          <h3>No verified songs yet</h3>
          <p>Songs appear here once their full recording has passed Meloa&apos;s playback check.</p>
        </div>
      )}
      <div className="chips" role="group" aria-label="Decade">
        {facets?.decades.map((d) => (
          <button key={d.decade} className={`chip ${decade === d.decade ? "on" : ""}`} aria-pressed={decade === d.decade} onClick={() => setDecade(decade === d.decade ? null : d.decade)}>
            {d.decade}s · {d.count}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Genre">
        {facets?.genres.map((g) => (
          <button key={g.genre} className={`chip ${genre === g.genre ? "on" : ""}`} aria-pressed={genre === g.genre} onClick={() => setGenre(genre === g.genre ? null : g.genre)}>
            {NAME(g.genre)}
          </button>
        ))}
      </div>
      {tracks === null && (decade !== null || genre) && <p className="hint">Loading…</p>}
      {tracks && tracks.length === 0 && <p className="hint">Nothing verified here yet.</p>}
      {tracks && tracks.length > 0 && (
        <SongList title={`${decade !== null ? `${decade}s` : "All decades"}${genre ? ` · ${NAME(genre)}` : ""}`} tracks={tracks} showHow />
      )}
    </>
  );
}
