import { getJson, enc } from "../http";
import type { Track } from "../types";

// Jamendo: Creative Commons music, full MP3 streams. Free client_id required.
const BASE = "https://api.jamendo.com/v3.0";

function toTrack(t: any): Track {
  const lic = t.license_ccurl as string | undefined;
  return {
    id: `jamendo:${t.id}`,
    source: "jamendo",
    sourceId: String(t.id),
    title: t.name,
    artist: t.artist_name,
    album: t.album_name,
    artwork: t.album_image || t.image,
    durationSec: Number(t.duration) || undefined,
    genres: t.musicinfo?.tags?.genres || [],
    tier: 1,
    playback: { kind: "audio", url: t.audio },
    license: {
      name: lic ? `Creative Commons (${lic.split("/licenses/")[1]?.replace(/\/$/, "") || "CC"})` : "Creative Commons",
      url: lic,
      attribution: `"${t.name}" by ${t.artist_name}, via Jamendo`,
    },
    pageUrl: t.shareurl,
    kind: "song",
  };
}

export async function searchJamendo(q: string, opts: { tags?: string; limit?: number } = {}): Promise<Track[]> {
  const id = process.env.JAMENDO_CLIENT_ID?.trim();
  if (!id) return [];
  const p = new URLSearchParams({
    client_id: id,
    format: "json",
    limit: String(opts.limit ?? 15),
    audioformat: "mp32",
    include: "musicinfo licenses",
    audiodlformat: "mp32",
  });
  if (q) p.set("search", q);
  if (opts.tags) p.set("tags", opts.tags);
  if (!q) p.set("order", "popularity_month");
  const r = await getJson(`${BASE}/tracks/?${p}`);
  // Jamendo answers 200 even on errors; the real status is in the response headers block.
  if (r.headers?.status && r.headers.status !== "success") {
    throw new Error(`Jamendo: ${r.headers.error_message || r.headers.warnings || r.headers.status} (code ${r.headers.code})`);
  }
  return (r.results || []).filter((t: any) => t.audio).map(toTrack);
}
