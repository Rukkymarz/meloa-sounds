import { NextRequest, NextResponse } from "next/server";
import { getPlaylist, updatePlaylist } from "@/lib/playlists";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPlaylist(id);
  if (!p) return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
  return NextResponse.json(p);
}

// PUT { editKey, name?, tracks? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await updatePlaylist(id, String(body.editKey || ""), { name: body.name, tracks: Array.isArray(body.tracks) ? body.tracks : undefined });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
