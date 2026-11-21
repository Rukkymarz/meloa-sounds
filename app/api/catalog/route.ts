import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Track } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/catalog?genre=afrobeats&country=NG&limit=50
// Songs in your own Meloa database (seeded from MusicBrainz, matched by listeners, uploaded by artists).
// Songs without a playable source yet are returned as "resolve" rows — tapping finds the full version.
export async function GET(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ tracks: [] });
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit")) || 50, 200);
  let query = db
    .from("tracks")
    .select("id,title,artist,album,artwork,duration_sec,genres,country,track_sources(source,source_id,tier,playback,license)")
    .order("created_at", { ascending: false })
    .limit(limit);
  const genre = sp.get("genre");
  const country = sp.get("country");
  if (genre) query = query.contains("genres", [genre]);
  if (country) query = query.eq("country", country.toUpperCase());
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tracks: Track[] = (data || []).map((r: any) => {
    const s = (r.track_sources || []).filter((x: any) => x.playback?.kind !== "none").sort((a: any, b: any) => a.tier - b.tier)[0];
    return s
      ? {
          id: `${s.source}:${s.source_id}`, source: s.source, sourceId: s.source_id, title: r.title, artist: r.artist,
          artwork: r.artwork ?? undefined, durationSec: r.duration_sec ?? undefined, genres: r.genres, tier: s.tier,
          playback: s.playback, license: s.license ?? undefined, kind: "song",
        }
      : {
          id: `catalog:${r.id}`, source: "meloa", sourceId: r.id, title: r.title, artist: r.artist,
          artwork: r.artwork ?? undefined, durationSec: r.duration_sec ?? undefined, genres: r.genres, tier: 4,
          playback: { kind: "resolve", source: "meloa", id: r.id }, kind: "song",
        };
  });
  return NextResponse.json({ tracks }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
