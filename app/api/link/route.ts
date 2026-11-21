import { NextRequest, NextResponse } from "next/server";
import { resolveLink } from "@/lib/links";
import { saveToCatalog } from "@/lib/catalog";

export const runtime = "nodejs";

// GET /api/link?url=https://audiomack.com/...   → plays in that platform's official player
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  try {
    const track = await resolveLink(url);
    if (track.kind === "song" && track.title && track.artist) await saveToCatalog(track, track).catch(() => {});
    return NextResponse.json({ track });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Couldn't open that link" }, { status: 400 });
  }
}
