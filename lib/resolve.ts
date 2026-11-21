import { lookupCatalog, saveToCatalog, saveMiss } from "./catalog";
import { deezerTrack } from "./sources/deezer";
import { searchAudius } from "./sources/audius";
import { searchAudiomack, audiomackEnabled } from "./sources/audiomack";
import { matchYouTube } from "./sources/youtube";
import { resolveArchive } from "./sources/archive";
import { similarity } from "./normalize";
import { supabaseAdmin } from "./supabase";
import type { Track } from "./types";

/**
 * Turn a catalog entry into something playable, best legal option first:
 *   1. already matched in our catalog (free, instant)
 *   2. full free track on Audius (exact artist + title match)
 *   3. Audiomack official player (if API key approved)
 *   4. YouTube official player (full track, YouTube's ads)
 * Never a 30-second preview. Every result is saved, so each song costs quota once.
 */
export async function resolvePlayable(source: string, id: string): Promise<Track | null> {
  if (source === "archive") {
    const f = await resolveArchive(id);
    if (!f) return null;
    return {
      id: `archive:${id}`,
      source: "archive",
      sourceId: id,
      title: id,
      artist: "Internet Archive",
      durationSec: f.durationSec,
      tier: 1,
      playback: { kind: "audio", url: f.url },
      pageUrl: `https://archive.org/details/${id}`,
      kind: "song",
    };
  }

  let meta: Partial<Track> & { title: string; artist: string } | null = null;
  if (source === "deezer") meta = await deezerTrack(id);
  if (source === "name") {
    // chart rows (Apple Music, Last.fm) that only carry artist + title
    try {
      const { a, t, d } = JSON.parse(id);
      if (typeof a === "string" && typeof t === "string") meta = { artist: a, title: t, durationSec: Number(d) || undefined };
    } catch {}
  }
  if (source === "meloa") {
    // a song in our own database (e.g. seeded from MusicBrainz) that has no player yet
    const db = supabaseAdmin();
    const { data } = db ? await db.from("tracks").select("title,artist,album,artwork,duration_sec,isrc,mbid,genres").eq("id", id).maybeSingle() : { data: null };
    if (data)
      meta = {
        title: data.title, artist: data.artist, album: data.album ?? undefined, artwork: data.artwork ?? undefined,
        durationSec: data.duration_sec ?? undefined, isrc: data.isrc ?? undefined, mbid: data.mbid ?? undefined, genres: data.genres ?? [],
      };
  }
  if (!meta) return null;
  return findFullSource(meta);
}

export async function findFullSource(meta: Pick<Track, "title" | "artist"> & Partial<Track>): Promise<Track | null> {
  const { track: saved, recentMiss } = await lookupCatalog(meta.artist, meta.title);
  if (saved) return { ...saved, artwork: saved.artwork || meta.artwork };
  if (recentMiss) return null;

  const close = (t: Track) =>
    similarity(t.title, meta.title) >= 0.7 &&
    similarity(t.artist, meta.artist) >= 0.6 &&
    (!meta.durationSec || !t.durationSec || Math.abs(t.durationSec - meta.durationSec) <= Math.max(10, meta.durationSec * 0.1));

  // 2. Audius
  const audius = (await searchAudius(`${meta.artist} ${meta.title}`, 5).catch(() => [])).find(close);
  if (audius) {
    await saveToCatalog(meta, audius);
    return { ...audius, artwork: audius.artwork || meta.artwork };
  }

  // 3. Audiomack (official embed)
  if (audiomackEnabled()) {
    const am = (await searchAudiomack(`${meta.artist} ${meta.title}`, 5).catch(() => [])).find(close);
    if (am) {
      await saveToCatalog(meta, am);
      return { ...am, artwork: am.artwork || meta.artwork };
    }
  }

  // 4. YouTube (official full upload)
  const yt = await matchYouTube(meta.artist, meta.title, meta.durationSec).catch(() => null);
  if (yt) {
    const withMeta = { ...yt, title: meta.title, artist: meta.artist, artwork: meta.artwork || yt.artwork };
    await saveToCatalog(meta, withMeta);
    return withMeta;
  }

  await saveMiss(meta);
  return null;
}
