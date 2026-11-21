"use client";

import { use, useEffect, useState } from "react";
import type { Track } from "@/lib/types";
import { Shelf, SongList } from "@/components/Shelves";
import { genreBySlug } from "@/lib/genres";

interface GenreData {
  free: Track[];
  chart: Track[];
  mixes: Track[];
  stations: Track[];
}

export default function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const g = genreBySlug(slug);
  const [data, setData] = useState<GenreData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [own, setOwn] = useState<Track[]>([]);

  useEffect(() => {
    fetch(`/api/genre/${slug}`)
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setData(j)))
      .catch(() => setErr("This genre couldn't load. Check your connection and try again."));
    fetch(`/api/catalog?genre=${slug}&limit=60`)
      .then((r) => r.json())
      .then((j) => setOwn(j.tracks || []))
      .catch(() => {});
  }, [slug]);

  if (!g) return <h1 className="h-large">Genre not found</h1>;
  const empty = data && !data.chart.length && !data.free.length && !data.mixes.length && !data.stations.length && !own.length;

  return (
    <>
      <header className="page-head" style={{ borderBottom: `4px solid ${g.color}`, marginBottom: 18 }}>
        <h1 className="h-large">{g.name}</h1>
      </header>
      {!data && !err && <p className="hint" role="status">Gathering charts, mixes and stations…</p>}
      {err && <p className="hint">{err}</p>}
      {empty && (
        <div className="empty">
          <h3>Nothing to play here yet</h3>
          <p>None of Meloa&apos;s sources returned {g.name} music today. Try another genre or search by artist.</p>
        </div>
      )}
      {data && (
        <>
          <SongList title="Top songs" tracks={data.chart.slice(0, 40)} ranked paged />
          <Shelf title="Free and full, no ads" tracks={data.free} />
          <SongList title="From the Meloa catalog" tracks={own} paged />
          <Shelf title="DJ mixes" tracks={data.mixes} />
          <SongList title="Live stations" tracks={data.stations} />
        </>
      )}
    </>
  );
}
