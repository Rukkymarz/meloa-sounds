"use client";

import type { Track } from "@/lib/types";
import { usePlayer } from "./PlayerProvider";
import { Icon } from "./Icon";
import { Shelf } from "./Shelves";

export function HeroPlay({ track }: { track: Track }) {
  const { playOne, isSaved, toggleSave } = usePlayer();
  const saved = isSaved(track);
  return (
    <div className="hero-actions">
      <button className="btn btn-copper" onClick={() => playOne(track)}>
        <Icon name="play" size={18} />
        Play
      </button>
      <button className="btn btn-ghost" onClick={() => toggleSave(track)} aria-pressed={saved}>
        <Icon name={saved ? "heartFill" : "heart"} size={18} />
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

/** Shown only once this device has listening history. */
export function RecentlyPlayed() {
  const { history } = usePlayer();
  if (!history.length) return null;
  return <Shelf title="Recently played" tracks={history.slice(0, 15)} href="/library" />;
}
