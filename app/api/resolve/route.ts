import { NextRequest, NextResponse } from "next/server";
import { resolvePlayable, findFullSource } from "@/lib/resolve";

export const runtime = "nodejs";
export const maxDuration = 15;

// GET /api/resolve?source=deezer&id=123          → best full legal source for that song
// GET /api/resolve?artist=Fola&title=Who%20Does%20That   → same, by name
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const source = sp.get("source");
  const id = sp.get("id");
  const artist = sp.get("artist");
  const title = sp.get("title");
  try {
    let track = null;
    if (source && id) track = await resolvePlayable(source, id);
    else if (artist && title) {
      const dur = Number(sp.get("duration")) || undefined;
      track = await findFullSource({ artist, title, durationSec: dur });
    } else return NextResponse.json({ error: "Pass source+id or artist+title" }, { status: 400 });

    if (!track)
      return NextResponse.json(
        { error: "No full-length legal version found yet. Try pasting a YouTube, Audiomack or Boomplay link." },
        { status: 404 },
      );
    return NextResponse.json({ track }, { headers: { "Cache-Control": "public, s-maxage=86400" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Resolve failed" }, { status: 502 });
  }
}
