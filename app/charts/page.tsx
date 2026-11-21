"use client";

import { useEffect, useState } from "react";
import type { Track } from "@/lib/types";
import { TrackList } from "@/components/TrackList";
import { CHART_COUNTRIES, EXTERNAL_CHARTS } from "@/lib/chart-meta";

interface ChartData {
  apple: Track[];
  youtube: Track[];
  lastfm: Track[];
  deezerGlobal: Track[];
  audiomack: Track[];
}

export default function ChartsPage() {
  const [country, setCountry] = useState("NG");
  const [data, setData] = useState<ChartData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setErr(null);
    fetch(`/api/charts?country=${country}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setErr("Couldn't load charts."));
  }, [country]);

  const name = CHART_COUNTRIES.find(([c]) => c === country)?.[1] || country;

  return (
    <>
      <h1>Charts</h1>
      <label style={{ display: "block", maxWidth: 320 }}>
        <span style={{ position: "absolute", left: -9999 }}>Country</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          {CHART_COUNTRIES.map(([c, n]) => (
            <option key={c} value={c}>{n}</option>
          ))}
        </select>
      </label>
      {!data && !err && <p className="hint">Loading {name} charts…</p>}
      {err && <p className="hint">{err}</p>}
      {data && (
        <>
          <TrackList title={`Apple Music top 100 · ${name}`} tracks={data.apple} />
          <TrackList title={`Trending music videos on YouTube · ${name}`} tracks={data.youtube} />
          <TrackList title={`Last.fm top tracks · ${name}`} tracks={data.lastfm} />
          <TrackList title="Audiomack trending" tracks={data.audiomack} />
          <TrackList title="Deezer global top 50" tracks={data.deezerGlobal} />
        </>
      )}
      <h3>More charts (open on their sites)</h3>
      <ul className="prose">
        {EXTERNAL_CHARTS.map((c) => (
          <li key={c.url}>
            <a href={c.url} target="_blank" rel="noreferrer">{c.name}</a>
          </li>
        ))}
      </ul>
    </>
  );
}
