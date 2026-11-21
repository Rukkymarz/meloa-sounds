import { getJson, enc } from "../http";

// LRCLIB: free, open synced-lyrics database.
export interface Lyrics {
  synced?: string;
  plain?: string;
}

export async function getLyrics(artist: string, title: string, durationSec?: number): Promise<Lyrics | null> {
  const p = new URLSearchParams({ artist_name: artist, track_name: title });
  if (durationSec) p.set("duration", String(Math.round(durationSec)));
  try {
    const r = await getJson(`https://lrclib.net/api/get?${p}`, { revalidate: 604800 });
    return { synced: r.syncedLyrics || undefined, plain: r.plainLyrics || undefined };
  } catch {
    const list = await getJson<any[]>(`https://lrclib.net/api/search?q=${enc(`${artist} ${title}`)}`, {
      revalidate: 604800,
    }).catch(() => []);
    const hit = list?.[0];
    return hit ? { synced: hit.syncedLyrics || undefined, plain: hit.plainLyrics || undefined } : null;
  }
}

/** "[01:23.45] line" → [{ t: 83.45, line }] */
export function parseLrc(lrc: string): { t: number; line: string }[] {
  const out: { t: number; line: string }[] = [];
  for (const raw of lrc.split("\n")) {
    const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (m) out.push({ t: Number(m[1]) * 60 + Number(m[2]), line: m[3].trim() });
  }
  return out;
}
