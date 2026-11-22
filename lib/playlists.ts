import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import type { Track } from "./types";

// No-account playlists (like Freefy): a short link to listen, a private edit link to change it.
const MAX_TRACKS = 500;
const hash = (k: string) => createHash("sha256").update(k).digest("hex");
const shortId = () => randomBytes(6).toString("base64url"); // 8 chars

/** Keep only what's needed to play a song again (no alternates, bounded strings). */
export function slimTrack(t: Track): Track {
  return {
    id: String(t.id).slice(0, 200),
    source: t.source,
    sourceId: String(t.sourceId).slice(0, 300),
    title: String(t.title).slice(0, 200),
    artist: String(t.artist).slice(0, 200),
    album: t.album?.slice(0, 200),
    artwork: t.artwork?.slice(0, 600),
    durationSec: t.durationSec,
    genres: (t.genres || []).slice(0, 4),
    tier: t.tier,
    playback: t.playback,
    license: t.license,
    pageUrl: t.pageUrl,
    releaseYear: t.releaseYear,
    fallbacks: t.fallbacks?.slice(0, 2),
    kind: t.kind,
  };
}

export async function createPlaylist(name: string, tracks: Track[]) {
  const db = supabaseAdmin();
  if (!db) throw new Error("Playlists aren't available right now.");
  const editKey = randomBytes(18).toString("base64url");
  const id = shortId();
  const { error } = await db.from("shared_playlists").insert({
    id,
    name: name.trim().slice(0, 80) || "My playlist",
    edit_key_hash: hash(editKey),
    tracks: tracks.slice(0, MAX_TRACKS).map(slimTrack),
  });
  if (error) throw new Error(error.message);
  return { id, editKey };
}

export async function getPlaylist(id: string) {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db.from("shared_playlists").select("id,name,tracks,updated_at").eq("id", id).maybeSingle();
  return data as { id: string; name: string; tracks: Track[]; updated_at: string } | null;
}

export async function updatePlaylist(id: string, editKey: string, patch: { name?: string; tracks?: Track[] }) {
  const db = supabaseAdmin();
  if (!db) throw new Error("Playlists aren't available right now.");
  const { data } = await db.from("shared_playlists").select("edit_key_hash").eq("id", id).maybeSingle();
  if (!data || data.edit_key_hash !== hash(editKey)) throw new Error("This link can't edit the playlist.");
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 80) || "My playlist";
  if (patch.tracks) row.tracks = patch.tracks.slice(0, MAX_TRACKS).map(slimTrack);
  const { error } = await db.from("shared_playlists").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}
