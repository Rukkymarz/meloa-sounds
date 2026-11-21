import { NextRequest, NextResponse } from "next/server";
import { listCurated } from "@/lib/curated";
import { audiomackEnabled } from "@/lib/sources/audiomack";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET /api/curated?country=NG → saved official Audiomack releases (player checked)
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") || undefined;
  const tracks = await listCurated({ country, limit: 30 });
  return NextResponse.json(
    { tracks, liveSearch: audiomackEnabled() },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
  );
}
