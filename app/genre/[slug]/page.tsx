"use client";

import { use, useEffect, useState } from "react";
import type { Track } from "@/lib/types";
import { TrackList } from "@/components/TrackList";
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
      .catch(() => setErr("Couldn't load this genre."));
    fetch(`/api/catalog?genre=${slug}&limit=100`)
      .then((r) => r.json())
      .then((j) => setOwn(j.tracks || []))
      .catch(() => {});
  }, [slug]);

  if (!g) return <h1>Genre not found</h1>;

  return (
    <>
      <h1 style={{ color: g.color }}>{g.name}</h1>
      {!data && !err && <p className="hint">Gathering charts, free tracks, mixes and stations…</p>}
      {err && <p className="hint">{err}</p>}
      {data && (
        <>
          <TrackList title="Top songs (full track found when you tap)" tracks={data.chart} />
          <TrackList title="Free full tracks, no ads" tracks={data.free} />
          <TrackList title="From the Meloa catalog" tracks={own} />
          <TrackList title="DJ mixes" tracks={data.mixes} />
          <TrackList title="Live stations" tracks={data.stations} />
        </>
      )}
    </>
  );
}
