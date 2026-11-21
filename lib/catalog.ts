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
    .select("id,title,artist,album,artwork,duration_sec,isrc,genres,track_sources(source,source_id,tier,playback,license,duration_sec,last_checked)")
    .eq("norm_key", normKey(artist, title))
    .maybeSingle();
  if (!data) return { track: null, recentMiss: false };
  const sources = ((data as any).track_sources || []) as any[];
  const playable = sources.filter((s) => s.playback?.kind && s.playback.kind !== "none").sort((a, b) => a.tier - b.tier);
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
      kind: "song",
    },
  };
}

/** Full-text search over songs already in the catalog (instant, zero quota). */
export async function searchCatalog(q: string, limit = 20): Promise<Track[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const term = q.replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim();
  if (!term) return [];
  const { data } = await db
    .from("tracks")
    .select("id,title,artist,artwork,duration_sec,genres,track_sources!inner(source,source_id,tier,playback,license)")
    .or(`title.ilike.%${term}%,artist.ilike.%${term}%`)
    .lt("track_sources.tier", 4)
    .limit(limit);
  return ((data || []) as any[]).map((r) => {
    const s = [...r.track_sources].sort((a: any, b: any) => a.tier - b.tier)[0];
    return {
      id: `${s.source}:${s.source_id}`,
      source: s.source,
      sourceId: s.source_id,
      title: r.title,
      artist: r.artist,
      artwork: r.artwork ?? undefined,
      durationSec: r.duration_sec ?? undefined,
      genres: r.genres ?? [],
      tier: s.tier,
      playback: s.playback,
      license: s.license ?? undefined,
      kind: "song",
    } as Track;
  });
}
