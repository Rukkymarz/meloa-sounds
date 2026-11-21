import { NextRequest, NextResponse } from "next/server";
import { adminList, adminAdd, adminAction } from "@/lib/curated";
import { audiomackEnabled } from "@/lib/sources/audiomack";

export const runtime = "nodejs";
export const maxDuration = 20;

function authorized(req: NextRequest) {
  const t = process.env.ADMIN_TOKEN;
  return !!t && t.length >= 16 && req.headers.get("authorization") === `Bearer ${t}`;
}

// GET  /api/admin/audiomack                     → saved releases + whether live search is on
// POST /api/admin/audiomack { url, country?, genres? }        → save + check the official player
// POST /api/admin/audiomack { id, action: recheck|hide|show|remove }
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ releases: await adminList(), liveSearch: audiomackEnabled() });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.id && body.action) {
      if (!["recheck", "hide", "show", "remove"].includes(body.action)) throw new Error("Unknown action.");
      await adminAction(String(body.id), body.action);
      return NextResponse.json({ ok: true });
    }
    const row = await adminAdd({ url: String(body.url || ""), country: body.country, genres: Array.isArray(body.genres) ? body.genres : String(body.genres || "").split(",") });
    return NextResponse.json({ ok: true, release: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
