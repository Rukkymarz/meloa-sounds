"use client";

import type { Track } from "@/lib/types";
import { usePlayer } from "./PlayerProvider";
import { SourceBadge } from "./SourceBadge";

function fmt(s?: number) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function TrackList({ tracks, title }: { tracks: Track[]; title?: string }) {
  const { playList, current } = usePlayer();
  if (!tracks.length) return null;
  return (
    <section className="list">
      {title && <h3>{title}</h3>}
      <ol>
        {tracks.map((t, i) => (
          <li key={t.id}>
            <button className={`row ${current?.id === t.id ? "active" : ""}`} onClick={() => playList(tracks, i)}>
              {t.artwork ? <img src={t.artwork} alt="" loading="lazy" /> : <span className="ph" />}
              <span className="meta">
                <strong>{t.title}</strong>
                <span className="muted">
                  {t.artist}
                  {t.durationSec ? ` · ${fmt(t.durationSec)}` : ""}
                </span>
              </span>
              <SourceBadge track={t} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
