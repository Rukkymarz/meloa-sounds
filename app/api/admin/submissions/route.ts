import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { saveToCatalog } from "@/lib/catalog";
import { normKey } from "@/lib/normalize";

export const runtime = "nodejs";

function authorized(req: NextRequest) {
  const t = process.env.ADMIN_TOKEN;
  return !!t && t.length >= 16 && req.headers.get("authorization") === `Bearer ${t}`;
}

// GET  /api/admin/submissions            → pending uploads (+ 1-hour listen links) and open takedowns
// POST /api/admin/submissions { id, action: "approve" | "reject" | "remove" }
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin()!;
  const { data: subs } = await db.from("submissions").select("*").eq("status", "pending").order("created_at");
  const withLinks = await Promise.all(
    (subs || []).map(async (s) => {
      const { data } = await db.storage.from("submissions").createSignedUrl(s.file_path, 3600);
      return { ...s, listen_url: data?.signedUrl };
    }),
  );
  const { data: takedowns } = await db.from("takedowns").select("*").eq("status", "open").order("created_at");
  return NextResponse.json({ submissions: withLinks, takedowns });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin()!;
  const { id, action } = await req.json();
  const { data: s } = await db.from("submissions").select("*").eq("id", id).single();
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "reject") {
    await db.storage.from("submissions").remove([s.file_path, s.artwork_path].filter(Boolean));
    await db.from("submissions").update({ status: "rejected" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    await db.storage.from("catalog").remove([s.file_path, s.artwork_path].filter(Boolean));
    await db.from("track_sources").delete().eq("source", "meloa").eq("source_id", id);
    await db.from("submissions").update({ status: "removed" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    for (const p of [s.file_path, s.artwork_path].filter(Boolean) as string[]) {
      const { error } = await db.storage.from("submissions").copy(p, p, { destinationBucket: "catalog" });
      if (error) return NextResponse.json({ error: `Copy failed: ${error.message}` }, { status: 500 });
    }
    const pub = (p: string) => db.storage.from("catalog").getPublicUrl(p).data.publicUrl;
    const meta = { title: s.track_title, artist: s.artist_name, genres: s.genre ? [s.genre] : [], artwork: s.artwork_path ? pub(s.artwork_path) : undefined };
    await saveToCatalog(meta, {
      id: `meloa:${id}`,
      source: "meloa",
      sourceId: id,
      title: s.track_title,
      artist: s.artist_name,
      artwork: meta.artwork,
      tier: 1,
      playback: { kind: "audio", url: pub(s.file_path) },
      license: { name: "Meloa Artist Streaming Licence", url: "/legal#artists", attribution: `Uploaded by ${s.artist_name}` },
      kind: "song",
    });
    await db.from("tracks").update({ country: s.country }).eq("norm_key", normKey(s.artist_name, s.track_title));
    await db.from("submissions").update({ status: "approved" }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
