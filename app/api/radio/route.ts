import { NextRequest, NextResponse } from "next/server";
import { searchRadio } from "@/lib/sources/radio";

export const runtime = "nodejs";

// GET /api/radio?country=NG&tag=afrobeats&q=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const stations = await searchRadio({
      q: sp.get("q") || undefined,
      tag: sp.get("tag") || undefined,
      country: sp.get("country") || undefined,
      limit: 40,
    });
    return NextResponse.json({ stations }, { headers: { "Cache-Control": "public, s-maxage=1800" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
