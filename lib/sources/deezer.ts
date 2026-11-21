import { getJson, enc } from "../http";
import type { Track } from "../types";

// Deezer public API: METADATA ONLY (titles, artists, artwork, ISRC, genre charts).
// Meloa never plays Deezer previews — a Deezer result is resolved to a full-length
// legal source (Audius, Audiomack, YouTube…) when the listener taps it.
const BASE = "https://api.deezer.com";

function toTrack(t: any): Track {
  return {
    id: `deezer:${t.id}`,
    source: "deezer",
    sourceId: String(t.id),
    title: t.title,
    artist: t.artist?.name || "Unknown",
    album: t.album?.title,
    artwork: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium,
    durationSec: t.duration || undefined,
    isrc: t.isrc,
    tier: 4,
    playback: { kind: "resolve", source: "deezer", id: String(t.id) },
    kind: "song",
  };
}

export async function searchDeezer(q: string, limit = 25): Promise<Track[]> {
  const r = await getJson(`${BASE}/search?q=${enc(q)}&limit=${limit}`);
  return (r.data || []).filter((t: any) => t.readable !== false).map(toTrack);
}

export async function deezerTrack(id: string): Promise<Track | null> {
  const t = await getJson(`${BASE}/track/${enc(id)}`, { revalidate: 86400 });
  if (t.error) return null;
  return toTrack(t);
}

export interface Genre {
  id: number;
  name: string;
  picture: string;
}

export async function deezerGenres(): Promise<Genre[]> {
  const r = await getJson(`${BASE}/genre`, { revalidate: 86400 });
  return (r.data || [])
    .filter((g: any) => g.id !== 0)
    .map((g: any) => ({ id: g.id, name: g.name, picture: g.picture_medium }));
}

/** Top tracks for a genre id (0 = all). */
export async function deezerChart(genreId: number, limit = 50): Promise<Track[]> {
  const r = await getJson(`${BASE}/chart/${genreId}/tracks?limit=${limit}`);
  return (r.data || []).map(toTrack);
}

/** Top tracks for an artist name (used for country/scene browsing). */
export async function deezerArtistTop(name: string, limit = 10): Promise<Track[]> {
  const s = await getJson(`${BASE}/search/artist?q=${enc(name)}&limit=1`, { revalidate: 86400 });
  const a = s.data?.[0];
  if (!a) return [];
  const r = await getJson(`${BASE}/artist/${a.id}/top?limit=${limit}`);
  return (r.data || []).map(toTrack);
}
