import { getJson } from "./http";
import { deezerChart } from "./sources/deezer";
import { appleChart, youtubeTrending, lastfmGeo } from "./sources/charts";
import { CHART_COUNTRIES } from "./chart-meta";
import { normKey } from "./normalize";
import type { Track } from "./types";

// Server-side data for Home and New. Every call is cached by fetch (revalidate),
// so YouTube's chart endpoint costs 1 quota unit per country per hour at most.

const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch (e: any) {
    console.warn("[meloa] home data:", e?.message || e);
    return fallback;
  }
};

/** Country chart: Apple's top songs, linked to YouTube's trending videos when the same song is there. */
export async function countryChart(cc: string): Promise<{ apple: Track[]; youtube: Track[]; lastfm: Track[] }> {
  const [apple, youtube, lastfm] = await Promise.all([
    safe(appleChart(cc, 100), [] as Track[]),
    safe(youtubeTrending(cc, 50), [] as Track[]),
    safe(lastfmGeo(cc, 50), [] as Track[]),
  ]);
  const yt = new Map(youtube.map((y) => [normKey(y.artist, y.title), y] as const));
  const linked = apple.map((a) => {
    const hit = yt.get(normKey(a.artist, a.title));
    return hit ? { ...a, tier: 2 as const, playback: hit.playback, license: hit.license, durationSec: hit.durationSec } : a;
  });
  return { apple: linked, youtube, lastfm };
}

/** Countries that currently return chart data (only these appear in the selector). */
export async function availableCountries(): Promise<{ code: string; name: string; art?: string; top?: string }[]> {
  const rows = await Promise.all(
    CHART_COUNTRIES.map(async ([code, name]) => {
      const c = await countryChart(code);
      const first = c.apple[0] || c.youtube[0] || c.lastfm[0];
      return first ? { code, name, art: c.apple.find((t) => t.artwork)?.artwork || first.artwork, top: `${first.title}, ${first.artist}` } : null;
    }),
  );
  return rows.filter(Boolean) as { code: string; name: string; art?: string; top?: string }[];
}

/** New releases picked by Deezer's editors, each with its lead track so it can be played. */
export async function newReleases(limit = 16): Promise<Track[]> {
  const r = await safe(getJson(`https://api.deezer.com/editorial/0/releases?limit=${limit}`, { revalidate: 21600 }), { data: [] } as any);
  const albums: any[] = (r.data || []).slice(0, limit);
  const tracks = await Promise.all(
    albums.map(async (a): Promise<Track | null> => {
      const t = await safe(getJson(`https://api.deezer.com/album/${a.id}/tracks?limit=1`, { revalidate: 86400 }), { data: [] } as any);
      const first = t.data?.[0];
      if (!first) return null;
      return {
        id: `deezer:${first.id}`,
        source: "deezer",
        sourceId: String(first.id),
        title: first.title,
        artist: a.artist?.name || first.artist?.name || "Unknown",
        album: a.title,
        artwork: a.cover_xl || a.cover_big || a.cover_medium,
        durationSec: first.duration || undefined,
        tier: 4,
        playback: { kind: "resolve", source: "deezer", id: String(first.id) },
        kind: "song",
      };
    }),
  );
  return tracks.filter(Boolean) as Track[];
}

export async function homeData() {
  const [worldwide, nigeria, releases, countries] = await Promise.all([
    safe(deezerChart(0, 30), [] as Track[]),
    countryChart("NG"),
    newReleases(12),
    availableCountries(),
  ]);
  const featured = releases[0] || worldwide[0] || null;
  return {
    featured,
    worldwide,
    releases: releases.slice(featured === releases[0] ? 1 : 0),
    nigeria: nigeria.youtube.length ? nigeria.youtube : nigeria.apple,
    countries,
  };
}
