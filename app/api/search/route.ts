import { NextRequest, NextResponse } from "next/server";
import { gather, mergeAndRank, fullOnly } from "@/lib/rank";
import { searchCatalog } from "@/lib/catalog";
import { searchAudius } from "@/lib/sources/audius";
import { searchJamendo } from "@/lib/sources/jamendo";
import { searchOpenverse } from "@/lib/sources/openverse";
import { searchArchive } from "@/lib/sources/archive";
import { searchCcmixter } from "@/lib/sources/ccmixter";
import { searchMixcloud } from "@/lib/sources/mixcloud";
import { searchRadio } from "@/lib/sources/radio";
import { searchDeezer, deezerArtistMatch } from "@/lib/sources/deezer";
import { searchAudiomack, audiomackEnabled } from "@/lib/sources/audiomack";
import { searchCurated } from "@/lib/curated";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET /api/search?q=fola&type=all|song|mix|station
// Fans out to every source in parallel, merges duplicates, keeps full tracks only.
// YouTube is NOT searched here (quota) — Deezer/MusicBrainz metadata rows resolve
// to YouTube or Audiomack only when tapped, and that match is saved forever.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 120);
  const type = req.nextUrl.searchParams.get("type") || "all";
  if (!q) return NextResponse.json({ results: [], status: {} });

  const tasks: Record<string, Promise<any>> = {};
  if (type === "all" || type === "song") {
    tasks.catalog = searchCatalog(q, 20);
    tasks.audius = searchAudius(q, 15);
    tasks.jamendo = searchJamendo(q, { limit: 12 });
    tasks.openverse = searchOpenverse(q, 12);
    tasks.archive = searchArchive(q, 8);
    tasks.ccmixter = searchCcmixter(q, 6);
    tasks.curated = searchCurated(q, 10);
    if (audiomackEnabled()) tasks.audiomack = searchAudiomack(q, 15);
    tasks.deezer = searchDeezer(q, 25);
  }
  if (type === "all" || type === "mix") tasks.mixcloud = searchMixcloud(q, 10);
  if (type === "all" || type === "station") tasks.radio = searchRadio({ q, limit: 10 });

  const artistP = type === "all" || type === "song" ? deezerArtistMatch(q).catch(() => null) : Promise.resolve(null);
  const [{ tracks, status }, artistHit] = await Promise.all([gather(tasks), artistP]);
  const results = mergeAndRank(fullOnly(tracks), q).slice(0, 80);

  return NextResponse.json(
    {
      results,
      artist: artistHit ? { ...artistHit.artist, top: artistHit.top.slice(0, 10), albums: artistHit.albums.slice(0, 20), singles: artistHit.singles.slice(0, 20), related: artistHit.related } : null,
      songs: results.filter((t) => t.kind === "song"),
      mixes: results.filter((t) => t.kind === "mix"),
      stations: results.filter((t) => t.kind === "station"),
      status,
      audiomackLive: audiomackEnabled(),
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
