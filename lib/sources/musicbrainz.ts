import { getJson, enc } from "../http";

// MusicBrainz: open music encyclopedia (CC0 core data). Used to build the catalog
// database — artists by country/genre, recordings, ISRCs. No audio.
// Rules: send a descriptive User-Agent (done in lib/http.ts) and stay ≤1 request/second.
const BASE = "https://musicbrainz.org/ws/2";

export interface MbArtist {
  id: string;
  name: string;
  country?: string;
  tags: string[];
}
export interface MbRecording {
  id: string;
  title: string;
  artist: string;
  lengthSec?: number;
  isrcs: string[];
  tags: string[];
}

export async function mbArtists(query: string, limit = 100, offset = 0): Promise<MbArtist[]> {
  const r = await getJson(`${BASE}/artist?query=${enc(query)}&limit=${limit}&offset=${offset}&fmt=json`, {
    timeoutMs: 15000,
    revalidate: 86400,
  });
  return (r.artists || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    country: a.country,
    tags: (a.tags || []).map((t: any) => t.name),
  }));
}

export async function mbRecordings(query: string, limit = 100, offset = 0): Promise<MbRecording[]> {
  const r = await getJson(
    `${BASE}/recording?query=${enc(query)}&limit=${limit}&offset=${offset}&fmt=json`,
    { timeoutMs: 15000, revalidate: 86400 },
  );
  return (r.recordings || []).map((x: any) => ({
    id: x.id,
    title: x.title,
    artist: (x["artist-credit"] || []).map((c: any) => c.name + (c.joinphrase || "")).join("") || "Unknown",
    lengthSec: x.length ? Math.round(x.length / 1000) : undefined,
    isrcs: x.isrcs || [],
    tags: (x.tags || []).map((t: any) => t.name),
  }));
}
