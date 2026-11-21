import { getJson, enc } from "../http";
import type { Track } from "../types";

// Openverse (WordPress Foundation): one anonymous API over openly-licensed audio
// from Jamendo, Wikimedia Commons and Freesound. We ask for category=music and
// drop anything shorter than 60s so sound-effect clips never reach the app.
export async function searchOpenverse(q: string, limit = 20): Promise<Track[]> {
  const r = await getJson(
    `https://api.openverse.org/v1/audio/?q=${enc(q)}&category=music&page_size=${limit}&mature=false`,
  );
  return (r.results || [])
    .filter((a: any) => a.url && (!a.duration || a.duration >= 60_000))
    .map(
      (a: any): Track => ({
        id: `openverse:${a.id}`,
        source: "openverse",
        sourceId: a.id,
        title: a.title || "Untitled",
        artist: a.creator || "Unknown",
        artwork: a.thumbnail || undefined,
        durationSec: a.duration ? Math.round(a.duration / 1000) : undefined,
        genres: (a.genres || []).filter(Boolean),
        tier: 1,
        playback: { kind: "audio", url: a.url },
        license: {
          name: `${String(a.license || "").toUpperCase()} ${a.license_version || ""}`.trim(),
          url: a.license_url,
          attribution: a.attribution,
        },
        pageUrl: a.foreign_landing_url,
        kind: "song",
      }),
    );
}
