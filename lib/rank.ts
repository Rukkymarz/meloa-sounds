import { normKey, similarity } from "./normalize";
import type { Track } from "./types";

const MIN_FULL_SEC = 60;

/** Full tracks only: drop anything that is (or looks like) a clip. */
export function fullOnly(tracks: Track[]): Track[] {
  return tracks.filter((t) => {
    if (t.kind === "station") return true; // live radio has no length
    if (t.playback.kind === "none") return false;
    if (t.durationSec !== undefined && t.durationSec > 0 && t.durationSec < MIN_FULL_SEC) return false;
    return true;
  });
}

/** Merge duplicates across sources (same artist+title), keep the best way to play each one. */
export function mergeAndRank(tracks: Track[], q = ""): Track[] {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    const k = t.kind === "song" || !t.kind ? normKey(t.artist, t.title) : `${t.kind}:${t.id}`;
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  const merged: Track[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.tier - b.tier);
    const [best, ...rest] = list;
    // keep the best metadata (artwork, ISRC) from whichever source had it
    const art = best.artwork || rest.find((r) => r.artwork)?.artwork;
    const isrc = best.isrc || rest.find((r) => r.isrc)?.isrc;
    merged.push({ ...best, artwork: art, isrc, alternates: rest });
  }
  const score = (t: Track) =>
    (q ? similarity(`${t.artist} ${t.title}`, q) * 3 : 0) +
    (5 - t.tier) * 0.6 +
    (t.alternates?.length || 0) * 0.15;
  return merged.sort((a, b) => score(b) - score(a));
}

/** Run every source in parallel; a slow or broken source never breaks the search. */
export async function gather(tasks: Record<string, Promise<Track[]>>) {
  const names = Object.keys(tasks);
  const settled = await Promise.allSettled(Object.values(tasks));
  const tracks: Track[] = [];
  const status: Record<string, "ok" | "error" | "empty"> = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      tracks.push(...r.value);
      status[names[i]] = r.value.length ? "ok" : "empty";
    } else {
      status[names[i]] = "error";
      console.warn(`[meloa] ${names[i]} failed:`, r.reason?.message || r.reason);
    }
  });
  return { tracks, status };
}
