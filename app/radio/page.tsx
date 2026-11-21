"use client";

import { useEffect, useState } from "react";
import type { Track } from "@/lib/types";
import { TrackList } from "@/components/TrackList";

const COUNTRIES = [
  ["NG", "Nigeria"], ["GH", "Ghana"], ["ZA", "South Africa"], ["KE", "Kenya"], ["US", "United States"],
  ["GB", "United Kingdom"], ["JM", "Jamaica"], ["FR", "France"], ["BR", "Brazil"], ["IN", "India"],
  ["", "Worldwide"],
];

export default function RadioPage() {
  const [country, setCountry] = useState("NG");
  const [tag, setTag] = useState("");
  const [stations, setStations] = useState<Track[] | null>(null);

  useEffect(() => {
    setStations(null);
    const p = new URLSearchParams();
    if (country) p.set("country", country);
    if (tag.trim()) p.set("tag", tag.trim());
    const t = setTimeout(() => {
      fetch(`/api/radio?${p}`)
        .then((r) => r.json())
        .then((j) => setStations(j.stations || []))
        .catch(() => setStations([]));
    }, 300);
    return () => clearTimeout(t);
  }, [country, tag]);

  return (
    <>
      <h1>Live radio</h1>
      <div className="search">
        <label style={{ flex: 1 }}>
          <span className="sr-only" style={{ position: "absolute", left: -9999 }}>Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map(([c, n]) => (
              <option key={c} value={c}>{n}</option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1 }}>
          <span className="sr-only" style={{ position: "absolute", left: -9999 }}>Genre tag</span>
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Genre, e.g. afrobeats, gospel, jazz" />
        </label>
      </div>
      {!stations && <p className="hint">Tuning in…</p>}
      {stations && !stations.length && <p className="hint">No secure streams found. Try another country or tag.</p>}
      {stations && <TrackList tracks={stations} />}
    </>
  );
}
