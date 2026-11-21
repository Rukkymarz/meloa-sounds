"use client";

import { useEffect, useState } from "react";
import type { Track } from "@/lib/types";
import { usePlayer } from "@/components/PlayerProvider";
import { Artwork } from "@/components/Artwork";
import { Icon } from "@/components/Icon";

const COUNTRIES = [
  ["NG", "Nigeria"], ["GH", "Ghana"], ["ZA", "South Africa"], ["KE", "Kenya"], ["TZ", "Tanzania"], ["US", "United States"],
  ["GB", "United Kingdom"], ["JM", "Jamaica"], ["FR", "France"], ["BR", "Brazil"], ["MX", "Mexico"], ["IN", "India"],
  ["JP", "Japan"], ["KR", "South Korea"], ["", "Anywhere"],
];
const GENRES = ["", "afrobeats", "gospel", "hiphop", "rnb", "pop", "jazz", "reggae", "house", "highlife", "news", "talk"];

export default function RadioPage() {
  const { playList, current, status } = usePlayer();
  const [country, setCountry] = useState("NG");
  const [tag, setTag] = useState("");
  const [stations, setStations] = useState<Track[] | null>(null);

  useEffect(() => {
    setStations(null);
    const p = new URLSearchParams();
    if (country) p.set("country", country);
    if (tag) p.set("tag", tag);
    fetch(`/api/radio?${p}`)
      .then((r) => r.json())
      .then((j) => setStations(j.stations || []))
      .catch(() => setStations([]));
  }, [country, tag]);

  return (
    <>
      <header className="page-head">
        <h1 className="h-large">Radio</h1>
      </header>
      <div className="select-row">
        <label>
          <span className="sr">Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {COUNTRIES.map(([c, n]) => (
              <option key={c} value={c}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr">Genre</span>
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>{g ? g[0].toUpperCase() + g.slice(1) : "All genres"}</option>
            ))}
          </select>
        </label>
      </div>

      {!stations && <p className="hint">Finding stations…</p>}
      {stations && !stations.length && (
        <div className="empty">
          <h3>No stations to play here</h3>
          <p>Only stations with secure streams can play in Meloa. Try another country or genre.</p>
        </div>
      )}
      {stations && stations.length > 0 && (
        <div className="stations">
          {stations.map((s, i) => {
            const on = current?.id === s.id;
            return (
              <button key={s.id} className="station" onClick={() => playList(stations, i)} aria-label={`Play ${s.title}`}>
                <Artwork src={s.artwork} title={s.title} />
                <strong>{s.title}</strong>
                <span>{s.artist}</span>
                <span className="station-play">
                  <Icon name={on && status === "playing" ? "pause" : "play"} size={16} />
                  {on ? (status === "playing" ? "Playing" : "Paused") : "Play"}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="legal-note">Station list from Radio Browser. Streams come straight from each station.</p>
    </>
  );
}
