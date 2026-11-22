import { NextRequest, NextResponse } from "next/server";
import { createPlaylist } from "@/lib/playlists";

export const runtime = "nodejs";
const made = new Map<string, { n: number; day: string }>();

// POST /api/playlists { name, tracks } → { id, editKey }
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const day = new Date().toISOString().slice(0, 10);
  const c = made.get(ip);
  if (c && c.day === day && c.n >= 30) return NextResponse.json({ error: "Too many new playlists today. Try again tomorrow." }, { status: 429 });
  made.set(ip, { n: c && c.day === day ? c.n + 1 : 1, day });
  const body = await req.json().catch(() => ({}));
  try {
    const r = await createPlaylist(String(body.name || ""), Array.isArray(body.tracks) ? body.tracks : []);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
