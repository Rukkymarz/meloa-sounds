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

export interface ArtistHit {
  id: number;
  name: string;
  picture?: string;
  fans?: number;
  albums?: number;
}

/** If the search looks like an artist name, return that artist and their top songs (metadata; full songs found on tap). */
export async function deezerArtistMatch(q: string, limit = 12): Promise<{ artist: ArtistHit; top: Track[] } | null> {
  const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const s = await getJson(`${BASE}/search/artist?q=${enc(q)}&limit=3`, { revalidate: 86400 });
  const want = fold(q);
  const a = (s.data || []).find((x: any) => fold(x.name) === want) || (s.data || []).find((x: any) => fold(x.name).startsWith(want) && want.length >= 3);
  if (!a) return null;
  const r = await getJson(`${BASE}/artist/${a.id}/top?limit=${limit}`);
  const top: Track[] = (r.data || []).filter((t: any) => t.readable !== false).map(toTrack);
  return {
    artist: { id: a.id, name: a.name, picture: a.picture_xl || a.picture_big || a.picture_medium, fans: a.nb_fan, albums: a.nb_album },
    top,
  };
}
