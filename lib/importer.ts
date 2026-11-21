import { supabaseAdmin } from "./supabase";
import { normKey } from "./normalize";
import type { Playback, SourceName } from "./types";

// Batch importer for curated catalog sources.
// • Dry run: checks every item and reports what would happen, writes nothing but the report.
// • Commit: upserts songs (by artist+title+edit) and players (by source+source_id), so
//   re-running a batch never creates duplicates. A second player for a song that already
//   exists is saved on the same track as a fallback.
// • Nothing is listener-visible until a guest playback check marks the player "verified".

export interface ImportItem {
  source: SourceName;
  sourceId: string;
  sourceUrl: string; // the page a listener could open (direct source URL)
  title: string;
  artist: string;
  album?: string;
  genre: string; // Meloa genre slug, e.g. "rnb", "funk", "afrobeats"
  releaseYear?: number; // ORIGINAL release year, even for reissues/new uploads
  durationSec?: number; // editor's expected runtime
  artwork?: string;
  editLabel?: string; // "Extended Mix", "Radio Edit", "Live 1985"… kept as a distinct song
  kind?: "song" | "mix";
  playback: Playback;
  license?: { name: string; url?: string; attribution?: string };
  tier: 1 | 2 | 3;
  notes?: string[];
}

export type ItemStatus = "ready" | "needs_review" | "rejected";

export interface ItemResult {
  key: string;
  source: string;
  sourceId: string;
  title: string;
  artist: string;
  status: ItemStatus;
  action: "new_track" | "fallback_on_existing" | "already_imported" | "skipped";
  reasons: string[];
}

// Licences that allow Meloa to stream the file with credit (commercial use included).
const OPEN_LICENCE = /^(cc0|public domain|pd|pdm|cc[- ]by(?:[- ]sa)?(?:[- ][0-9.]+)?(?:[- ][a-z]{2})?)$/i;
const NC_OR_ND = /\b(nc|nd)\b/i;
const MIN_FULL_SEC = 60;

function playerHost(pb: Playback): string | null {
  const url = pb.kind === "embed" ? pb.src : pb.kind === "audio" ? pb.url : null;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const OFFICIAL_HOSTS: Partial<Record<SourceName, RegExp>> = {
  dailymotion: /(^|\.)dailymotion\.com$/,
  reverbnation: /(^|\.)reverbnation\.com$/,
  ampwall: /(^|\.)ampwall\.com$/,
  hearthis: /(^|\.)hearthis\.at$/,
  fma: /(^|\.)freemusicarchive\.org$/,
  wikimedia: /(^|\.)wikimedia\.org$/,
};

/** Eligibility rules, before any playback test. */
export function checkItem(it: ImportItem): { status: ItemStatus; reasons: string[] } {
  const reasons: string[] = [...(it.notes || [])];
  let status: ItemStatus = "ready";
  const bad = (r: string) => {
    reasons.push(r);
    status = "rejected";
  };
  const review = (r: string) => {
    reasons.push(r);
    if (status === "ready") status = "needs_review";
  };

  if (!it.title?.trim() || !it.artist?.trim()) bad("Missing title or artist.");
  if (!it.sourceId || !it.sourceUrl) bad("Missing source id or URL.");
  if (!/^https:\/\//.test(it.sourceUrl || "")) bad("Source URL must be https.");
  if (it.playback.kind !== "audio" && it.playback.kind !== "embed" && it.playback.kind !== "youtube") bad(`Unsupported player kind ${it.playback.kind}.`);

  const host = playerHost(it.playback);
  const rule = OFFICIAL_HOSTS[it.source];
  if (rule && host && !rule.test(host)) bad(`Player host ${host} isn't ${it.source}'s own.`);
  const purl = it.playback.kind === "embed" ? it.playback.src : it.playback.kind === "audio" ? it.playback.url : "";
  if (/\/preview\/|[?&]preview=|snippet|sample/i.test(purl)) bad("Player URL is a preview/clip.");

  if (!it.durationSec) review("No expected runtime from the source.");
  else if (it.kind !== "mix" && it.durationSec < MIN_FULL_SEC) bad(`Runtime ${it.durationSec}s looks like a clip.`);
  if (/\b(preview|snippet|teaser|clip|excerpt)\b/i.test(it.title)) review("Title suggests a preview or excerpt.");

  if (!it.releaseYear) review("Original release year unknown (needed for decade browsing).");
  else if (it.releaseYear < 1880 || it.releaseYear > new Date().getFullYear() + 1) bad(`Release year ${it.releaseYear} is out of range.`);

  if (it.source === "fma" || it.source === "wikimedia") {
    const lic = it.license?.name?.trim() || "";
    if (!lic) bad("No licence information.");
    else if (NC_OR_ND.test(lic)) review(`Licence ${lic} restricts commercial use or changes; confirm Meloa's use is allowed.`);
    else if (!OPEN_LICENCE.test(lic)) review(`Licence "${lic}" needs a manual check.`);
    if (!it.license?.url) review("Licence URL missing.");
    if (!it.license?.attribution) review("Attribution text missing.");
  }
  if (it.source === "dailymotion") {
    if (!process.env.DAILYMOTION_PLAYER_ID) review("No Dailymotion Player ID configured (DAILYMOTION_PLAYER_ID).");
    const owners = (process.env.DAILYMOTION_OFFICIAL_OWNERS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const owner = (it.notes || []).find((n) => n.startsWith("owner:"))?.slice(6).toLowerCase();
    if (!owner || !owners.includes(owner)) review(`Uploader ${owner || "unknown"} isn't on the approved official-channel list.`);
  }
  return { status, reasons };
}

export function trackKey(it: Pick<ImportItem, "artist" | "title" | "editLabel">) {
  return normKey(it.artist, it.editLabel ? `${it.title} ${it.editLabel}` : it.title);
}

export async function runBatch(batchId: string, provider: string, items: ImportItem[], dryRun: boolean) {
  const db = supabaseAdmin();
  if (!db) throw new Error("Database isn't configured.");

  const results: ItemResult[] = [];
  const seenInBatch = new Set<string>();

  for (const it of items) {
    const key = trackKey(it);
    const base = { key, source: it.source, sourceId: it.sourceId, title: it.title, artist: it.artist };
    const { status, reasons } = checkItem(it);
    const dupeInBatch = `${it.source}:${it.sourceId}`;
    if (seenInBatch.has(dupeInBatch)) {
      results.push({ ...base, status, action: "skipped", reasons: [...reasons, "Duplicate of an earlier item in this batch."] });
      continue;
    }
    seenInBatch.add(dupeInBatch);

    const [{ data: existingSrc }, { data: existingTrack }] = await Promise.all([
      db.from("track_sources").select("id,track_id,verification").eq("source", it.source).eq("source_id", it.sourceId).maybeSingle(),
      db.from("tracks").select("id").eq("norm_key", key).maybeSingle(),
    ]);
    let action: ItemResult["action"] = existingSrc ? "already_imported" : existingTrack ? "fallback_on_existing" : "new_track";
    if (status === "rejected") action = "skipped";

    if (!dryRun && status !== "rejected") {
      const { data: tr, error: te } = await db
        .from("tracks")
        .upsert(
          {
            norm_key: key,
            title: it.title,
            artist: it.artist,
            album: it.album ?? null,
            artwork: it.artwork ?? null,
            duration_sec: it.durationSec ?? null,
            genres: [it.genre],
            primary_genre: it.genre,
            release_year: it.releaseYear ?? null,
            edit_label: it.editLabel ?? null,
          },
          { onConflict: "norm_key", ignoreDuplicates: false },
        )
        .select("id")
        .single();
      if (te || !tr) {
        results.push({ ...base, status: "needs_review", action: "skipped", reasons: [...reasons, `Database: ${te?.message}`] });
        continue;
      }
      // Keep an earlier verification result unless the player itself changed.
      const { error: se } = await db.from("track_sources").upsert(
        {
          track_id: tr.id,
          source: it.source,
          source_id: it.sourceId,
          tier: it.tier,
          playback: it.playback,
          license: it.license ?? null,
          duration_sec: it.durationSec ?? null,
          expected_sec: it.durationSec ?? null,
          source_url: it.sourceUrl,
          import_batch: batchId,
          verification: existingSrc?.verification === "verified" || existingSrc?.verification === "rejected" ? existingSrc.verification : status === "ready" ? "pending" : "needs_review",
          verify_report: existingSrc ? undefined : { reasons },
          last_checked: new Date().toISOString(),
        },
        { onConflict: "source,source_id" },
      );
      if (se) reasons.push(`Database: ${se.message}`);
    }
    results.push({ ...base, status, action, reasons });
  }

  const count = (f: (r: ItemResult) => boolean) => results.filter(f).length;
  const summary = {
    total: results.length,
    ready: count((r) => r.status === "ready"),
    needs_review: count((r) => r.status === "needs_review"),
    rejected: count((r) => r.status === "rejected"),
    new_tracks: count((r) => r.action === "new_track"),
    fallbacks: count((r) => r.action === "fallback_on_existing"),
    already_imported: count((r) => r.action === "already_imported"),
  };
  await db.from("import_batches").upsert({ id: batchId, provider, dry_run: dryRun, summary, report: results });
  return { batchId, dryRun, summary, results };
}

/** Players waiting for (or due) a guest playback check. */
export async function pendingForVerification(limit = 50, source?: string) {
  const db = supabaseAdmin()!;
  let q = db
    .from("track_sources")
    .select("id,source,source_id,playback,expected_sec,source_url,tracks(title,artist,release_year,primary_genre)")
    .eq("verification", "pending")
    .limit(limit);
  if (source) q = q.eq("source", source);
  const { data } = await q;
  return data || [];
}

export interface VerifyResult {
  id: string;
  ok: boolean;
  measuredSec?: number;
  report: Record<string, unknown>;
}

export async function saveVerification(results: VerifyResult[]) {
  const db = supabaseAdmin()!;
  for (const r of results) {
    await db
      .from("track_sources")
      .update({
        verification: r.ok ? "verified" : "rejected",
        verified_full: r.ok,
        measured_sec: r.measuredSec ?? null,
        verify_report: r.report,
        verified_at: new Date().toISOString(),
        ...(r.ok && r.measuredSec ? { duration_sec: Math.round(r.measuredSec) } : {}),
      })
      .eq("id", r.id);
  }
}
