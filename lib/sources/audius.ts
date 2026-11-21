import { getJson, enc } from "../http";
import type { Track } from "../types";

// Audius is a decentralised, artist-uploaded catalog whose public API permits
// full-track streaming. Every request must carry an app_name.
const BASE = "https://api.audius.co/v1";
const APP = () => enc(process.env.AUDIUS_APP_NAME || "MeloaSounds");

function toTrack(t: any): Track {
  return {
    id: `audius:${t.id}`,
    source: "audius",
    sourceId: t.id,
    title: t.title,
    artist: t.user?.name || "Unknown",
    artwork: t.artwork?.["480x480"] || t.artwork?.["150x150"],
    durationSec: t.duration,
    genres: t.genre ? [t.genre] : [],
    tier: 1,
    playback: { kind: "audio", url: `${BASE}/tracks/${t.id}/stream?app_name=${APP()}` },
    license: { name: "Streamed via Audius", url: `https://audius.co${t.permalink || ""}` },
    pageUrl: `https://audius.co${t.permalink || ""}`,
    kind: "song",
  };
}

export async function searchAudius(q: string, limit = 15): Promise<Track[]> {
  const r = await getJson(`${BASE}/tracks/search?query=${enc(q)}&limit=${limit}&app_name=${APP()}`);
  return (r.data || []).filter((t: any) => t.is_streamable !== false).map(toTrack);
}

export async function trendingAudius(genre?: string, limit = 25): Promise<Track[]> {
  const g = genre ? `&genre=${enc(genre)}` : "";
  const r = await getJson(`${BASE}/tracks/trending?limit=${limit}${g}&app_name=${APP()}`);
  return (r.data || []).map(toTrack);
}
