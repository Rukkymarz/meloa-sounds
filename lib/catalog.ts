import { supabaseAdmin } from "./supabase";
import { normKey } from "./normalize";
import type { Track } from "./types";

// The Meloa catalog: every song we've ever matched, with every legal place it plays.
// This is what turns 100 YouTube searches/day into an ever-growing library.

/** Save a song and one playable source. Safe to call often (upserts). */
export async function saveToCatalog(meta: Partial<Track> & { title: string; artist: string }, src: Track) {
  const db = supabaseAdmin();
  if (!db) return;
  const key = normKey(meta.artist, meta.title);
  const { data: row, error } = await db
    .from("tracks")
    .upsert(
      {
        norm_key: key,
        title: meta.title,
        artist: meta.artist,
        album: meta.album ?? null,
        artwork: meta.artwork ?? src.artwork ?? null,
        duration_sec: meta.durationSec ?? src.durationSec ?? null,
        isrc: meta.isrc ?? null,
        mbid: meta.mbid ?? null,
        genres: meta.genres ?? src.genres ?? [],
      },
      { onConflict: "norm_key", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error || !row) return;
  await db.from("track_sources").upsert(
    {
      track_id: row.id,
      source: src.source,
      source_id: src.sourceId,
      tier: src.tier,
      playback: src.playback,
      license: src.license ?? null,
      duration_sec: src.durationSec ?? null,
      last_checked: new Date().toISOString(),
    },
    { onConflict: "source,source_id" },
  );
}

/** Mark a song as checked-and-unavailable so we don't spend quota on it again for a week. */
export async function saveMiss(meta: { title: string; artist: string }) {
  const db = supabaseAdmin();
  if (!db) return;
  const key = normKey(meta.artist, meta.title);
  const { data: row } = await db
    .from("tracks")
    .upsert({ norm_key: key, title: meta.title, artist: meta.artist }, { onConflict: "norm_key" })
    .select("id")
    .single();
  if (!row) return;
  await db.from("track_sources").upsert(
    { track_id: row.id, source: "meloa", source_id: `miss:${key}`, tier: 4, playback: { kind: "none" }, verified_full: false, last_checked: new Date().toISOString() },
    { onConflict: "source,source_id" },
  );
}

/** Best saved playable source for a song, if we've matched it before. */
export async function lookupCatalog(artist: string, title: string): Promise<{ track: Track | null; recentMiss: boolean }> {
  const db = supabaseAdmin();
  if (!db) return { track: null, recentMiss: false };
  const { data } = await db
    .from("tracks")
    .select("id,title,artist,album,artwork,duration_sec,isrc,genres,release_year,track_sources(source,source_id,tier,priority,playback,license,duration_sec,last_checked,verification)")
    .eq("norm_key", normKey(artist, title))
    .maybeSingle();
  if (!data) return { track: null, recentMiss: false };
  const sources = ((data as any).track_sources || []) as any[];
  const playable = sources
    .filter((s) => s.playback?.kind && s.playback.kind !== "none" && (!s.verification || LISTENABLE.includes(s.verification)))
    .sort((a, b) => a.tier - b.tier || (a.priority ?? 100) - (b.priority ?? 100));
  const miss = sources.find((s) => String(s.source_id).startsWith("miss:"));
  const recentMiss = !!miss && Date.now() - new Date(miss.last_checked).getTime() < 7 * 86400_000;
  const s = playable[0];
  if (!s) return { track: null, recentMiss };
  return {
    recentMiss,
    track: {
      id: `${s.source}:${s.source_id}`,
      source: s.source,
      sourceId: s.source_id,
      title: data.title,
      artist: data.artist,
      album: data.album ?? undefined,
      artwork: data.artwork ?? undefined,
      durationSec: s.duration_sec ?? data.duration_sec ?? undefined,
      isrc: data.isrc ?? undefined,
      genres: data.genres ?? [],
      tier: s.tier,
      playback: s.playback,
      license: s.license ?? undefined,
      releaseYear: (data as any).release_year ?? undefined,
      fallbacks: playable.slice(1, 4).map((x) => x.playback),
      kind: "song",
    },
  };
}

const LISTENABLE = ["legacy", "verified"]; // pending / needs_review / rejected players stay hidden
const TRACK_COLS =
  "id,title,artist,album,artwork,duration_sec,genres,release_year,primary_genre,track_sources!inner(source,source_id,tier,priority,playback,license,duration_sec,verification,source_url)";

function rowToTrack(r: any): Track {
  const srcs = [...r.track_sources]
    .filter((s: any) => s.playback?.kind && s.playback.kind !== "none")
    .sort((a: any, b: any) => a.tier - b.tier || (a.priority ?? 100) - (b.priority ?? 100));
  const s = srcs[0];
  return {
    id: `${s.source}:${s.source_id}`,
    source: s.source,
    sourceId: s.source_id,
    title: r.title,
    artist: r.artist,
    album: r.album ?? undefined,
    artwork: r.artwork ?? undefined,
    durationSec: s.duration_sec ?? r.duration_sec ?? undefined,
    genres: r.genres ?? [],
    tier: s.tier,
    playback: s.playback,
    license: s.license ?? undefined,
    pageUrl: s.source_url ?? undefined,
    releaseYear: r.release_year ?? undefined,
    fallbacks: srcs.slice(1, 4).map((x: any) => x.playback),
    kind: "song",
  } as Track;
}

/** Full-text search over songs already in the catalog (instant, zero quota). */
export async function searchCatalog(q: string, limit = 20): Promise<Track[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const term = q.replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim();
  if (!term) return [];
  const { data } = await db
    .from("tracks")
    .select(TRACK_COLS)
    .or(`title.ilike.%${term}%,artist.ilike.%${term}%`)
    .lt("track_sources.tier", 4)
    .in("track_sources.verification", LISTENABLE)
    .limit(limit);
  return ((data || []) as any[]).filter((r) => r.track_sources?.length).map(rowToTrack);
}

/** Verified songs by ORIGINAL release decade and/or genre. */
export async function browseCatalog(opts: { decade?: number; genre?: string; limit?: number }): Promise<Track[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  let q = db.from("tracks").select(TRACK_COLS).lt("track_sources.tier", 4).in("track_sources.verification", LISTENABLE);
  if (opts.decade) q = q.eq("decade", opts.decade);
  if (opts.genre) q = q.eq("primary_genre", opts.genre);
  const { data } = await q.order("release_year", { ascending: true, nullsFirst: false }).limit(opts.limit ?? 60);
  return ((data || []) as any[]).filter((r) => r.track_sources?.length).map(rowToTrack);
}

/** How many verified songs exist per decade and per genre (for the browse screen). */
export async function catalogFacets(): Promise<{ decades: { decade: number; count: number }[]; genres: { genre: string; count: number }[] }> {
  const db = supabaseAdmin();
  if (!db) return { decades: [], genres: [] };
  const { data } = await db.from("tracks").select("decade,primary_genre,track_sources!inner(verification)").eq("track_sources.verification", "verified").not("decade", "is", null).limit(5000);
  const d = new Map<number, number>();
  const g = new Map<string, number>();
  for (const r of (data || []) as any[]) {
    d.set(r.decade, (d.get(r.decade) || 0) + 1);
    if (r.primary_genre) g.set(r.primary_genre, (g.get(r.primary_genre) || 0) + 1);
  }
  return {
    decades: [...d].map(([decade, count]) => ({ decade, count })).sort((a, b) => a.decade - b.decade),
    genres: [...g].map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count),
  };
}
