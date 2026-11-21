import { NextRequest, NextResponse } from "next/server";
import { genreBySlug } from "@/lib/genres";
import { gather, mergeAndRank, fullOnly } from "@/lib/rank";
import { deezerChart, searchDeezer } from "@/lib/sources/deezer";
import { trendingAudius } from "@/lib/sources/audius";
import { searchJamendo } from "@/lib/sources/jamendo";
import { mixcloudByTag } from "@/lib/sources/mixcloud";
import { searchRadio } from "@/lib/sources/radio";
import { trendingAudiomack } from "@/lib/sources/audiomack";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET /api/genre/afrobeats → charts + free full tracks + DJ mixes + live stations for one genre
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = genreBySlug(slug);
  if (!g) return NextResponse.json({ error: "Unknown genre" }, { status: 404 });

  const tasks: Record<string, Promise<any>> = {
    chart: g.deezer !== undefined ? deezerChart(g.deezer, 50) : searchDeezer(g.query || g.name, 50),
  };
  if (g.audius) tasks.audius = trendingAudius(g.audius, 25);
  if (g.jamendo) tasks.jamendo = searchJamendo("", { tags: g.jamendo, limit: 20 });
  if (g.audiomack) tasks.audiomack = trendingAudiomack(g.audiomack, 25);
  if (g.mixcloud) tasks.mixcloud = mixcloudByTag(g.mixcloud, 15);
  if (g.radio) tasks.radio = searchRadio({ tag: g.radio, country: g.country, limit: 15 });

  const { tracks, status } = await gather(tasks);
  const all = mergeAndRank(fullOnly(tracks));
  return NextResponse.json(
    {
      genre: g,
      free: all.filter((t) => t.kind === "song" && t.tier === 1),
      chart: all.filter((t) => t.kind === "song" && t.tier > 1),
      mixes: all.filter((t) => t.kind === "mix"),
      stations: all.filter((t) => t.kind === "station"),
      status,
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
