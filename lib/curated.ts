import { supabaseAdmin } from "./supabase";
import type { Track } from "./types";
import {
  parseAudiomackUrl,
  audiomackPageUrl,
  checkAudiomack,
  isAudiomackEmbed,
  type AudiomackRef,
} from "./sources/audiomack";

// Curated Audiomack releases: official song, album and playlist links an admin saved.
// They work without Audiomack API keys. Each one's official player is checked before
// Meloa shows it; if the player doesn't load, listeners get "Open in Audiomack" instead.

export interface CuratedRow {
  id: string;
  url: string;
  type: "song" | "album" | "playlist";
  uploader: string;
  slug: string;
  title: string | null;
  artist: string | null;
  artwork: string | null;
  country: string | null;
  genres: string[];
  embed_src: string | null;
  embed_ok: boolean | null;
  embed_checked_at: string | null;
  check_note: string | null;
  active: boolean;
  added_at: string;
}

const RECHECK_MS = 7 * 24 * 3600 * 1000;
const COLS = "id,url,type,uploader,slug,title,artist,artwork,country,genres,embed_src,embed_ok,embed_checked_at,check_note,active,added_at";

function stale(r: CuratedRow) {
  return r.embed_ok === null || !r.embed_checked_at || Date.now() - Date.parse(r.embed_checked_at) > RECHECK_MS;
}

/** Re-validate one release and store the result. */
export async function recheck(row: CuratedRow): Promise<CuratedRow> {
  const ref: AudiomackRef = { uploader: row.uploader, type: row.type, slug: row.slug };
  const c = await checkAudiomack(ref);
  const patch = {
    embed_src: c.src,
    embed_ok: c.ok,
    embed_checked_at: new Date().toISOString(),
    check_note: c.note,
    title: row.title || c.title || null,
    artist: row.artist || c.artist || null,
    artwork: c.artwork || row.artwork || null,
  };
  const db = supabaseAdmin();
  if (db) await db.from("curated_releases").update(patch).eq("id", row.id);
  return { ...row, ...patch };
}

/** Make sure releases have a fresh player check before they're shown (bounded wait). */
async function ensureChecked(rows: CuratedRow[], budgetMs = 6000): Promise<CuratedRow[]> {
  const todo = rows.filter(stale);
  if (!todo.length) return rows;
  const done = await Promise.race([
    Promise.all(todo.map((r) => recheck(r).catch(() => r))),
    new Promise<CuratedRow[]>((res) => setTimeout(() => res(todo), budgetMs)),
  ]);
  const byId = new Map(done.map((r) => [r.id, r]));
  return rows.map((r) => byId.get(r.id) || r);
}

export function curatedToTrack(r: CuratedRow): Track {
  const page = audiomackPageUrl(r);
  const label = r.type === "song" ? "" : r.type === "album" ? " · Album" : " · Playlist";
  const playable = r.embed_ok === true && !!r.embed_src && isAudiomackEmbed(r.embed_src.split("?")[0]);
  return {
    id: `audiomack:${r.uploader}/${r.type}/${r.slug}`,
    source: "audiomack",
    sourceId: `${r.uploader}/${r.type}/${r.slug}`,
    title: r.title || r.slug.replace(/-/g, " "),
    artist: (r.artist || r.uploader) + label,
    artwork: r.artwork || undefined,
    genres: r.genres || [],
    tier: 3,
    playback: playable
      ? { kind: "embed", provider: "audiomack", src: r.embed_src!, height: r.type === "song" ? 252 : 400 }
      : { kind: "external", provider: "audiomack", url: page },
    license: { name: "Official Audiomack release", url: page },
    pageUrl: page,
    kind: "song",
  };
}

/** Listener search over saved releases (title, artist, uploader). */
export async function searchCurated(q: string, limit = 10): Promise<Track[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const term = q.replace(/[%_,()]/g, " ").trim();
  if (!term) return [];
  const { data } = await db
    .from("curated_releases")
    .select(COLS)
    .eq("active", true)
    .or(`title.ilike.%${term}%,artist.ilike.%${term}%,uploader.ilike.%${term}%`)
    .limit(limit);
  const rows = await ensureChecked((data || []) as CuratedRow[]);
  return rows.map(curatedToTrack);
}

/** Newest saved releases, optionally for one country (e.g. "NG"). */
export async function listCurated(opts: { country?: string; limit?: number } = {}): Promise<Track[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  let query = db.from("curated_releases").select(COLS).eq("active", true).order("added_at", { ascending: false }).limit(opts.limit ?? 20);
  if (opts.country) query = query.eq("country", opts.country);
  const { data } = await query;
  const rows = await ensureChecked((data || []) as CuratedRow[]);
  return rows.map(curatedToTrack);
}

// ---------- admin ----------

export async function adminList(): Promise<CuratedRow[]> {
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db.from("curated_releases").select(COLS).order("added_at", { ascending: false });
  return (data || []) as CuratedRow[];
}

export async function adminAdd(input: { url: string; country?: string; genres?: string[] }): Promise<CuratedRow> {
  const ref = parseAudiomackUrl(input.url);
  if (!ref) throw new Error("Paste an audiomack.com song, album or playlist link (https://audiomack.com/artist/song/name).");
  const db = supabaseAdmin();
  if (!db) throw new Error("Database isn't configured.");
  const c = await checkAudiomack(ref);
  const row = {
    url: audiomackPageUrl(ref),
    type: ref.type,
    uploader: ref.uploader,
    slug: ref.slug,
    title: c.title || ref.slug.replace(/-/g, " "),
    artist: c.artist || ref.uploader,
    artwork: c.artwork || null,
    country: input.country?.toUpperCase().slice(0, 2) || null,
    genres: (input.genres || []).map((g) => g.trim().toLowerCase()).filter(Boolean).slice(0, 6),
    embed_src: c.src,
    embed_ok: c.ok,
    embed_checked_at: new Date().toISOString(),
    check_note: c.note,
    active: true,
  };
  const { data, error } = await db.from("curated_releases").upsert(row, { onConflict: "url" }).select(COLS).single();
  if (error || !data) throw new Error(error?.message || "Couldn't save that release.");
  return data as CuratedRow;
}

export async function adminAction(id: string, action: "recheck" | "remove" | "hide" | "show"): Promise<void> {
  const db = supabaseAdmin();
  if (!db) throw new Error("Database isn't configured.");
  if (action === "remove") {
    await db.from("curated_releases").delete().eq("id", id);
    return;
  }
  if (action === "hide" || action === "show") {
    await db.from("curated_releases").update({ active: action === "show" }).eq("id", id);
    return;
  }
  const { data } = await db.from("curated_releases").select(COLS).eq("id", id).single();
  if (data) await recheck(data as CuratedRow);
}
