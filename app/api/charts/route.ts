import { NextRequest, NextResponse } from "next/server";
import { gather, fullOnly } from "@/lib/rank";
import { appleChart, youtubeTrending, lastfmGeo } from "@/lib/sources/charts";
import { deezerChart } from "@/lib/sources/deezer";
import { trendingAudiomack } from "@/lib/sources/audiomack";
import { normKey } from "@/lib/normalize";
import type { Track } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET /api/charts?country=NG
// Apple Music most-played (per country) · YouTube trending music (per country, playable now)
// Last.fm top tracks (per country, if key) · Deezer global chart · Audiomack trending (if key)
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") || "NG").toUpperCase().slice(0, 2);
  const { tracks, status } = await gather({
    apple: appleChart(country, 100),
    youtube: youtubeTrending(country, 50),
    lastfm: lastfmGeo(country, 50),
  });
  const extra = await gather({ deezer: deezerChart(0, 50), audiomack: trendingAudiomack(undefined, 30) });

  const apple = tracks.filter((t) => t.id.startsWith("apple:"));
  const youtube = tracks.filter((t) => t.source === "youtube");
  const lastfm = tracks.filter((t) => t.id.startsWith("lastfm:"));

  // If a charting Apple song is also in YouTube's trending list, play it straight away (no lookup needed).
  const yt = new Map(youtube.map((y) => [normKey(y.artist, y.title), y] as const));
  const appleLinked: Track[] = apple.map((a) => {
    const hit = yt.get(normKey(a.artist, a.title));
    return hit ? { ...a, tier: 2, playback: hit.playback, license: hit.license, durationSec: hit.durationSec } : a;
  });

  return NextResponse.json(
    {
      country,
      apple: appleLinked,
      youtube: fullOnly(youtube),
      lastfm,
      deezerGlobal: extra.tracks.filter((t) => t.source === "deezer"),
      audiomack: extra.tracks.filter((t) => t.source === "audiomack"),
      status: { ...status, ...extra.status },
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } },
  );
}
