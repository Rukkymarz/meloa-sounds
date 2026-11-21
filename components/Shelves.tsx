"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { Track } from "@/lib/types";
import { usePlayer } from "./PlayerProvider";
import { Artwork } from "./Artwork";
import { playLabel, playMode } from "@/lib/playinfo";

function fmt(s?: number) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function Head({ title, href, more = "See all" }: { title: string; href?: string; more?: string }) {
  return (
    <div className="shelf-head">
      <h2 className="h-section">{title}</h2>
      {href && <Link href={href}>{more}</Link>}
    </div>
  );
}

/** Horizontal row of large artwork. */
export function Shelf({ title, tracks, href }: { title: string; tracks: Track[]; href?: string }) {
  const { playList, current } = usePlayer();
  if (!tracks.length) return null;
  return (
    <section className="shelf" aria-label={title}>
      <Head title={title} href={href} />
      <div className="shelf-row" role="list">
        {tracks.map((t, i) => (
          <button key={t.id} role="listitem" className={`tile ${current?.id === t.id ? "playing" : ""}`} onClick={() => playList(tracks, i)} aria-label={`Play ${t.title} by ${t.artist}`}>
            <Artwork src={t.artwork} title={t.title} />
            <strong>{t.title}</strong>
            <span>{t.artist}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Compact song rows. `paged` lays them out four-high and swipes sideways, like Apple Music charts. */
export function SongList({ title, tracks, href, ranked = false, paged = false, showHow = false, numbered = false }: { title?: string; tracks: Track[]; href?: string; ranked?: boolean; paged?: boolean; showHow?: boolean; numbered?: boolean }) {
  const { playList, current } = usePlayer();
  if (!tracks.length) return null;
  return (
    <section className="shelf" aria-label={title || "Songs"}>
      {title && <Head title={title} href={href} />}
      <ol className={`songs ${paged ? "songs-grid" : ""}`}>
        {tracks.map((t, i) => {
          const mode = playMode(t);
          return (
            <li key={t.id} style={{ display: "contents" }}>
              <button className={`song ${current?.id === t.id ? "playing" : ""}`} onClick={() => playList(tracks, i)}>
                {(ranked || numbered) && <span className="rank">{i + 1}</span>}
                {!numbered && <Artwork src={t.artwork} title={t.title} round={t.kind === "station"} />}
                <span className="song-text">
                  <strong>{t.title}</strong>
                  <span>
                    {t.artist}
                    {t.durationSec && t.kind !== "station" ? `, ${fmt(t.durationSec)}` : ""}
                  </span>
                </span>
                {showHow && <span className={`how ${mode}`}>{playLabel(t)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function GenreGrid({ genres }: { genres: { slug: string; name: string; color: string; bright?: string }[] }) {
  return (
    <div className="genre-grid">
      {genres.map((g) => (
        <Link key={g.slug} href={`/genre/${g.slug}`} className="genre-tile" style={{ "--tile": g.color, "--tile-bright": g.bright || g.color } as CSSProperties}>
          {g.name}
        </Link>
      ))}
    </div>
  );
}

export function SectionHead(props: { title: string; href?: string; more?: string }) {
  return <Head {...props} />;
}
