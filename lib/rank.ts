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
    // prefer square album art over a YouTube video thumbnail
    const albumArt = rest.find((r) => r.artwork && r.source !== "youtube")?.artwork;
    const art = (best.source === "youtube" && albumArt) || best.artwork || rest.find((r) => r.artwork)?.artwork;
    const isrc = best.isrc || rest.find((r) => r.isrc)?.isrc;
    merged.push({ ...best, artwork: art, isrc, alternates: rest });
  }
  // Relevance first (artist name hits matter most), then how freely it plays.
  const qk = normKey(q, "").split("|")[0];
  const score = (t: Track) => {
    if (!q) return (5 - t.tier) * 0.6;
    const ak = normKey(t.artist, "").split("|")[0];
    const artistHit = ak === qk ? 4 : ak.split(" ").includes(qk) || qk.split(" ").includes(ak) ? 2.5 : 0;
    return (
      artistHit +
      similarity(t.title, q) * 2 +
      similarity(`${t.artist} ${t.title}`, q) * 1.5 +
      (5 - t.tier) * 0.35 +
      (t.playback.kind === "audio" ? 0.8 : 0) + // plays in Meloa's own player, keeps going in the background
      (t.alternates?.length || 0) * 0.15
    );
  };
  return merged.sort((a, b) => score(b) - score(a));
}

/** Run every source in parallel; a slow or broken source never breaks or delays the search.
 *  Each source gets `budgetMs`; anything slower is reported as "slow" and left out. */
export async function gather(tasks: Record<string, Promise<Track[]>>, budgetMs = 4000) {
  const names = Object.keys(tasks);
  const t0 = Date.now();
  const timed = names.map((n) =>
    Promise.race([
      tasks[n].then((v) => ({ v, ms: Date.now() - t0 })),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`slow (>${budgetMs}ms)`)), budgetMs)),
    ]),
  );
  const settled = await Promise.allSettled(timed);
  const tracks: Track[] = [];
  const status: Record<string, string> = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      tracks.push(...r.value.v);
      status[names[i]] = `${r.value.v.length ? "ok" : "empty"} ${r.value.ms}ms`;
    } else {
      status[names[i]] = `error: ${String(r.reason?.message || r.reason).slice(0, 160)}`;
      console.warn(`[meloa] ${names[i]} failed:`, r.reason?.message || r.reason);
    }
  });
  return { tracks, status };
}
