import { NextRequest, NextResponse } from "next/server";
import { getLyrics } from "@/lib/sources/lrclib";

export const runtime = "nodejs";

// GET /api/lyrics?artist=&title=&duration=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist");
  const title = sp.get("title");
  if (!artist || !title) return NextResponse.json({ error: "artist and title required" }, { status: 400 });
  const lyrics = await getLyrics(artist, title, Number(sp.get("duration")) || undefined).catch(() => null);
  return NextResponse.json({ lyrics }, { headers: { "Cache-Control": "public, s-maxage=604800" } });
}
