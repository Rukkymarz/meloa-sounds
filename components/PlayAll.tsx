"use client";

import type { Track } from "@/lib/types";
import { usePlayer } from "./PlayerProvider";
import { Icon } from "./Icon";

export function PlayAll({ tracks, label, shuffle = false, round = false }: { tracks: Track[]; label: string; shuffle?: boolean; round?: boolean }) {
  const { playList } = usePlayer();
  const go = () => {
    const list = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
    playList(list, 0);
  };
  if (round)
    return (
      <button className="play-round" onClick={go} aria-label={label}>
        <Icon name="play" size={26} />
      </button>
    );
  return (
    <button className="btn" onClick={go}>
      <Icon name={shuffle ? "shuffle" : "play"} size={18} />
      {label}
    </button>
  );
}
