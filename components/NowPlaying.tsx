"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import { Icon } from "./Icon";
import { Artwork } from "./Artwork";
import { attribution, providerName } from "@/lib/playinfo";

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

export function NowPlaying() {
  const p = usePlayer();
  const { current, status, error, position, duration, toggle, next, prev, seek, canControl, setNowPlayingOpen, isSaved, toggleSave } = p;
  const [lyrics, setLyrics] = useState<{ t: number; line: string }[] | null>(null);
  const [plain, setPlain] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNowPlayingOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [setNowPlayingOpen]);

  useEffect(() => {
    setLyrics(null);
    setPlain(null);
    if (!current || current.kind !== "song" || current.playback.kind === "external") return;
    const q = new URLSearchParams({ artist: current.artist, title: current.title });
    if (current.durationSec) q.set("duration", String(current.durationSec));
    fetch(`/api/lyrics?${q}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.lyrics?.synced) setLyrics(parseLrc(j.lyrics.synced));
        else if (j.lyrics?.plain) setPlain(j.lyrics.plain);
      })
      .catch(() => {});
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = useMemo(() => {
    if (!lyrics) return -1;
    let i = -1;
    for (let k = 0; k < lyrics.length; k++) if (lyrics[k].t <= position + 0.2) i = k;
    return i;
  }, [lyrics, position]);

  if (!current) return null;
  const pb = current.playback;
  const live = pb.kind === "audio" && pb.live;
  const framed = pb.kind === "youtube" || pb.kind === "embed";
  const total = duration || current.durationSec || 0;
  const saved = isSaved(current);

  return (
    <section className="np" role="dialog" aria-modal="true" aria-label={`Now Playing: ${current.title}`}>
      <div className="np-top">
        <button ref={closeRef} className="icon-btn np-close" onClick={() => setNowPlayingOpen(false)} aria-label="Close Now Playing">
          <Icon name="down" size={26} />
        </button>
        <span className="np-from">{providerName(pb.kind === "embed" || pb.kind === "external" ? pb.provider : current.source)}</span>
        <span style={{ width: 44 }} />
      </div>

      {/* YouTube video / platform player is positioned here by the shell (provider-frame.np). */}
      {framed ? (
        <div className="np-frame-space" style={pb.kind === "embed" ? { height: pb.height } : undefined} aria-hidden="true" />
      ) : (
        <Artwork src={current.artwork} title={current.title} className="np-art" />
      )}

      <div className="np-title-row">
        <div className="np-titles">
          <h2>{current.title}</h2>
          <p>{current.artist}</p>
        </div>
        {current.kind !== "station" && (
          <button className="icon-btn np-save" onClick={() => toggleSave(current)} aria-pressed={saved} aria-label={saved ? "Remove from Library" : "Save to Library"}>
            <Icon name={saved ? "heartFill" : "heart"} size={26} />
          </button>
        )}
      </div>

      {canControl && !live && (
        <div className="np-progress">
          <input type="range" min={0} max={Math.max(total, 1)} step={1} value={Math.min(position, total)} onChange={(e) => seek(Number(e.target.value))} aria-label="Song position" />
          <div className="np-times">
            <span>{fmt(position)}</span>
            <span>-{fmt(Math.max(0, total - position))}</span>
          </div>
        </div>
      )}
      {live && <p className="np-live">Live</p>}

      {pb.kind === "external" ? (
        <a className="np-handoff" href={pb.url} target="_blank" rel="noreferrer">
          Open in {providerName(pb.provider)}
          <Icon name="external" size={20} />
        </a>
      ) : (
        <div className="np-controls">
          <button className="icon-btn big" onClick={prev} aria-label="Previous song">
            <Icon name="prev" size={34} />
          </button>
          {canControl ? (
            <button className="icon-btn huge" onClick={toggle} aria-label={status === "playing" ? "Pause" : "Play"}>
              <Icon name={status === "loading" ? "spin" : status === "playing" ? "pause" : "play"} size={44} />
            </button>
          ) : (
            <span className="np-hint">Use the {providerName(pb.kind === "embed" ? pb.provider : current.source)} player above</span>
          )}
          <button className="icon-btn big" onClick={next} aria-label="Next song">
            <Icon name="next" size={34} />
          </button>
        </div>
      )}

      {error && <p className="np-error" role="status">{error}</p>}

      <p className="np-credit">
        {attribution(current)}
        {current.license?.url && (
          <>
            {" "}
            <a href={current.license.url} target="_blank" rel="noreferrer">Licence</a>
          </>
        )}
        {current.pageUrl && (
          <>
            {" "}
            <a href={current.pageUrl} target="_blank" rel="noreferrer">Original page</a>
          </>
        )}
      </p>

      {(lyrics || plain) && (
        <div className="np-lyrics" aria-label="Lyrics">
          {lyrics
            ? lyrics.map((l, i) => (
                <p key={i} className={i === active ? "on" : ""} onClick={() => canControl && seek(l.t)}>
                  {l.line || "♪"}
                </p>
              ))
            : <pre>{plain}</pre>}
          <p className="np-lyrics-credit">Lyrics from LRCLIB</p>
        </div>
      )}
    </section>
  );
}
