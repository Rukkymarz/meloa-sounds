import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { saveToCatalog } from "@/lib/catalog";
import { normKey } from "@/lib/normalize";
import { appleChart, youtubeTrending, CHART_COUNTRIES } from "@/lib/sources/charts";
import { GENRES } from "@/lib/genres";
import { deezerChart } from "@/lib/sources/deezer";

export const runtime = "nodejs";
export const maxDuration = 60;

// Runs daily (vercel.json → crons). Grows the catalog automatically:
//  • YouTube trending music in every chart country → saved WITH its player (cost: 1 quota unit per country)
//  • Apple Music most-played per country + Deezer genre charts → saved as songs to resolve on tap
// Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  // rotate through countries so each run stays well under the time limit
  const day = Math.floor(Date.now() / 86400_000);
  const countries = [...CHART_COUNTRIES.slice(0, 4), CHART_COUNTRIES[4 + (day % (CHART_COUNTRIES.length - 4))]].map(([c]) => c);

  let playable = 0;
  let songs = 0;
  for (const cc of countries) {
    const yt = await youtubeTrending(cc, 50).catch(() => []);
    const saved = await Promise.allSettled(
      yt.map((t) => saveToCatalog({ title: t.title, artist: t.artist, artwork: t.artwork, durationSec: t.durationSec }, t)),
    );
    playable += saved.filter((s) => s.status === "fulfilled").length;
    const apple = await appleChart(cc, 100).catch(() => []);
    const rows = apple.map((a) => ({
      norm_key: normKey(a.artist, a.title),
      title: a.title,
      artist: a.artist,
      artwork: a.artwork ?? null,
      genres: (a.genres || []).map((g) => g.toLowerCase()),
      country: cc,
    }));
    if (rows.length) {
      const { error } = await db.from("tracks").upsert(rows, { onConflict: "norm_key", ignoreDuplicates: true });
      if (!error) songs += rows.length;
    }
  }

  // two genre charts per day, rotating through all genres with a Deezer chart id
  const withChart = GENRES.filter((g) => g.deezer !== undefined);
  for (const g of [withChart[day % withChart.length], withChart[(day + 1) % withChart.length]]) {
    const chart = await deezerChart(g.deezer!, 50).catch(() => []);
    const rows = chart.map((t) => ({
      norm_key: normKey(t.artist, t.title),
      title: t.title,
      artist: t.artist,
      artwork: t.artwork ?? null,
      duration_sec: t.durationSec ?? null,
      genres: [g.slug],
    }));
    if (rows.length) {
      const { error } = await db.from("tracks").upsert(rows, { onConflict: "norm_key", ignoreDuplicates: true });
      if (!error) songs += rows.length;
    }
  }

  return NextResponse.json({ ok: true, countries, playable, songs });
}
