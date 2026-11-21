import { lookupCatalog, saveToCatalog, saveMiss } from "./catalog";
import { deezerTrack } from "./sources/deezer";
import { searchAudius } from "./sources/audius";
import { searchJamendo } from "./sources/jamendo";
import { searchAudiomack, audiomackEnabled } from "./sources/audiomack";
import { matchYouTube } from "./sources/youtube";
import { resolveArchive } from "./sources/archive";
import { similarity } from "./normalize";
import { supabaseAdmin } from "./supabase";
import { after } from "next/server";

// Save in the background after the response is sent, so playback starts sooner.
function later(fn: () => Promise<unknown>) {
  try {
    after(() => fn().catch(() => {}));
  } catch {
    fn().catch(() => {});
  }
}
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

  // 2–4. Ask Audius, Audiomack and YouTube at the same time (no waiting in line),
  // then use the best legal source: free full track first, platform players after.
  const q = `${meta.artist} ${meta.title}`;
  let timedOut = false;
  const within = <T,>(p: Promise<T>, ms: number, fallback: T) =>
    new Promise<T>((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true;
        resolve(fallback);
      }, ms);
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        () => {
          clearTimeout(timer);
          timedOut = true; // a network error is not proof the song doesn't exist
          resolve(fallback);
        },
      );
    });
  const [audiusList, jamList, amList, yt] = await Promise.all([
    within(searchAudius(q, 5), 2500, [] as Track[]),
    within(searchJamendo(q, { limit: 5 }), 2500, [] as Track[]),
    audiomackEnabled() ? within(searchAudiomack(q, 5), 3000, [] as Track[]) : Promise.resolve([] as Track[]),
    within(matchYouTube(meta.artist, meta.title, meta.durationSec), 6000, null as Track | null),
  ]);

  const audius = audiusList.find(close);
  if (audius) {
    later(() => saveToCatalog(meta, audius));
    if (yt) later(() => saveToCatalog(meta, { ...yt, title: meta.title, artist: meta.artist }));
    return { ...audius, artwork: audius.artwork || meta.artwork };
  }
  const jam = jamList.find(close);
  if (jam) {
    later(() => saveToCatalog(meta, jam));
    if (yt) later(() => saveToCatalog(meta, { ...yt, title: meta.title, artist: meta.artist }));
    return { ...jam, artwork: jam.artwork || meta.artwork };
  }
  const am = amList.find(close);
  if (am) {
    later(() => saveToCatalog(meta, am));
    return { ...am, artwork: am.artwork || meta.artwork };
  }
  if (yt) {
    const withMeta = { ...yt, title: meta.title, artist: meta.artist, artwork: meta.artwork || yt.artwork };
    later(() => saveToCatalog(meta, withMeta));
    return withMeta;
  }

  // Only remember "not found" when every source actually answered.
  if (!timedOut) later(() => saveMiss(meta));
  return null;
}
