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

/** If the search looks like an artist name, return that artist's page data (top songs, albums, singles, similar). */
export async function deezerArtistMatch(q: string) {
  const fold = (x: string) => x.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const s = await getJson(`${BASE}/search/artist?q=${enc(q)}&limit=3`, { revalidate: 86400 });
  const want = fold(q);
  const a = (s.data || []).find((x: any) => fold(x.name) === want) || (s.data || []).find((x: any) => fold(x.name).startsWith(want) && want.length >= 3);
  if (!a) return null;
  return deezerArtistPage(a.id);
}

// ---------- Artist and album pages (Apple Music-style order) ----------
export interface AlbumCard {
  id: number;
  title: string;
  artist: string;
  cover?: string;
  year?: string;
  type: "album" | "single" | "ep" | "compile";
}

const albumCard = (a: any, artist: string): AlbumCard => ({
  id: a.id,
  title: a.title,
  artist: a.artist?.name || artist,
  cover: a.cover_xl || a.cover_big || a.cover_medium,
  year: a.release_date ? String(a.release_date).slice(0, 4) : undefined,
  type: (a.record_type || "album") as AlbumCard["type"],
});

export async function deezerArtistPage(id: string | number) {
  const [a, top, albums, related] = await Promise.all([
    getJson(`${BASE}/artist/${enc(String(id))}`, { revalidate: 86400 }),
    getJson(`${BASE}/artist/${enc(String(id))}/top?limit=20`).catch(() => ({ data: [] })),
    getJson(`${BASE}/artist/${enc(String(id))}/albums?limit=100`, { revalidate: 21600 }).catch(() => ({ data: [] })),
    getJson(`${BASE}/artist/${enc(String(id))}/related?limit=12`, { revalidate: 86400 }).catch(() => ({ data: [] })),
  ]);
  if (a.error) return null;
  const cards: AlbumCard[] = (albums.data || [])
    .map((x: any) => albumCard(x, a.name))
    .sort((x: AlbumCard, y: AlbumCard) => (y.year || "").localeCompare(x.year || ""));
  // keep one card per title (Deezer often lists clean and explicit editions)
  const seen = new Set<string>();
  const unique = cards.filter((c) => {
    const k = `${c.type}|${c.title.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    artist: { id: a.id as number, name: a.name as string, picture: (a.picture_xl || a.picture_big) as string | undefined, fans: a.nb_fan as number | undefined },
    top: ((top.data || []) as any[]).filter((t) => t.readable !== false).map(toTrack),
    albums: unique.filter((c) => c.type === "album"),
    singles: unique.filter((c) => c.type === "single" || c.type === "ep"),
    compilations: unique.filter((c) => c.type === "compile"),
    related: ((related.data || []) as any[]).map((r) => ({ id: r.id as number, name: r.name as string, picture: (r.picture_xl || r.picture_big || r.picture_medium) as string | undefined })),
  };
}

export async function deezerAlbumPage(id: string | number) {
  const a = await getJson(`${BASE}/album/${enc(String(id))}`, { revalidate: 86400 });
  if (a.error) return null;
  const cover = a.cover_xl || a.cover_big || a.cover_medium;
  const tracks: Track[] = ((a.tracks?.data || []) as any[])
    .filter((t) => t.readable !== false)
    .map((t) => ({ ...toTrack({ ...t, album: { title: a.title, cover_xl: cover } }), album: a.title, artwork: cover }));
  return {
    album: {
      id: a.id as number,
      title: a.title as string,
      artist: a.artist?.name as string,
      artistId: a.artist?.id as number | undefined,
      cover: cover as string | undefined,
      year: a.release_date ? String(a.release_date).slice(0, 4) : undefined,
      releaseDate: a.release_date as string | undefined,
      label: a.label as string | undefined,
      genre: a.genres?.data?.[0]?.name as string | undefined,
      type: (a.record_type || "album") as AlbumCard["type"],
      durationSec: a.duration as number | undefined,
      count: a.nb_tracks as number | undefined,
    },
    tracks,
  };
}
