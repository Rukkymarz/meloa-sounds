"use client";

import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import { SourceBadge } from "./SourceBadge";
import { Icon } from "./Icon";

function fmt(s: number) {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function parseLrc(lrc: string) {
  return lrc
    .split("\n")
    .map((l) => l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/))
    .filter(Boolean)
    .map((m) => ({ t: Number(m![1]) * 60 + Number(m![2]), line: m![3].trim() }));
}

export function PlayerBar() {
  const { current, status, error, position, duration, toggle, next, prev, seek, ytMountRef } = usePlayer();
  const [open, setOpen] = useState(false);
  const [lyrics, setLyrics] = useState<{ t: number; line: string }[] | null>(null);
  const [plain, setPlain] = useState<string | null>(null);

  const isYT = current?.playback.kind === "youtube";
  const isEmbed = current?.playback.kind === "embed";
  const isLive = current?.playback.kind === "audio" && current.playback.live;

  useEffect(() => {
    setLyrics(null);
    setPlain(null);
    if (!current || current.kind !== "song") return;
    const p = new URLSearchParams({ artist: current.artist, title: current.title });
    if (current.durationSec) p.set("duration", String(current.durationSec));
    fetch(`/api/lyrics?${p}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.lyrics?.synced) setLyrics(parseLrc(j.lyrics.synced));
        else if (j.lyrics?.plain) setPlain(j.lyrics.plain);
      })
      .catch(() => {});
  }, [current]);

  const activeLine = useMemo(() => {
    if (!lyrics) return -1;
    let i = -1;
    for (let k = 0; k < lyrics.length; k++) if (lyrics[k].t <= position + 0.2) i = k;
    return i;
  }, [lyrics, position]);

  const total = duration || current?.durationSec || 0;

  // The dock is always mounted so the YouTube player keeps one stable home.
  // Official players stay visible: YouTube needs ≥200×200 and its own controls/ads.
  const dock = (
    <div className={`dock ${isYT || isEmbed ? "show" : ""}`} aria-label="Official player">
      <div className="yt" style={{ display: isYT ? "block" : "none" }}>
        <div ref={ytMountRef} style={{ width: "100%", height: "100%" }} />
      </div>
      {current && isEmbed && current.playback.kind === "embed" && (
          <iframe
            key={current.playback.src}
            src={current.playback.src}
            title={`${current.title} on ${current.playback.provider}`}
            style={{ width: "100%", height: current.playback.height, border: 0, borderRadius: 12 }}
            allow="autoplay; encrypted-media; clipboard-write"
            loading="lazy"
          />
        )}
      {current && isEmbed && current.playback.kind === "embed" && current.playback.note && <p className="note">{current.playback.note}</p>}
    </div>
  );

  if (!current) return dock;

  return (
    <>
      {dock}

      {open && (
        <section className="sheet" aria-label="Now playing">
          <button className="icon-btn close" aria-label="Close now playing" onClick={() => setOpen(false)}>
            <Icon name="down" />
          </button>
          {current.artwork && !isYT && <img className="big-art" src={current.artwork} alt="" />}
          <h2>{current.title}</h2>
          <p className="muted">{current.artist}</p>
          <SourceBadge track={current} />
          {current.license && (
            <p className="credit">
              {current.license.attribution || current.license.name}
              {current.license.url && (
                <>
                  {" · "}
                  <a href={current.license.url} target="_blank" rel="noreferrer">
                    licence
                  </a>
                </>
              )}
              {current.pageUrl && (
                <>
                  {" · "}
                  <a href={current.pageUrl} target="_blank" rel="noreferrer">
                    original
                  </a>
                </>
              )}
            </p>
          )}
          <div className="lyrics">
            {lyrics ? (
              lyrics.map((l, i) => (
                <p key={i} className={i === activeLine ? "on" : ""} onClick={() => seek(l.t)}>
                  {l.line || "♪"}
                </p>
              ))
            ) : plain ? (
              <pre>{plain}</pre>
            ) : (
              <p className="muted">No lyrics found.</p>
            )}
          </div>
        </section>
      )}

      <footer className="bar">
        {!isLive && !isEmbed && (
          <input
            className="seek"
            type="range"
            min={0}
            max={Math.max(total, 1)}
            step={1}
            value={Math.min(position, total)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
          />
        )}
        <div className="bar-row">
          <button className="now" onClick={() => setOpen((o) => !o)} aria-label="Open now playing">
            {current.artwork ? <img src={current.artwork} alt="" /> : <span className="ph" />}
            <span className="meta">
              <strong>{current.title}</strong>
              <span className="muted">
                {error ? <span className="err">{error}</span> : current.artist}
              </span>
            </span>
          </button>
          <span className="time muted">{isLive ? "LIVE" : isEmbed ? "" : `${fmt(position)} / ${fmt(total)}`}</span>
          <div className="controls">
            <button className="icon-btn" aria-label="Previous" onClick={prev}>
              <Icon name="prev" />
            </button>
            {!isEmbed && (
              <button className="icon-btn play" aria-label={status === "playing" ? "Pause" : "Play"} onClick={toggle}>
                <Icon name={status === "loading" ? "spin" : status === "playing" ? "pause" : "play"} />
              </button>
            )}
            <button className="icon-btn" aria-label="Next" onClick={next}>
              <Icon name="next" />
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
