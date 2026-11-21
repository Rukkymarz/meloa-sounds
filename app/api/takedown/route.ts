import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// POST /api/takedown { claimant, email, contentUrl, details, goodFaith }
export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: `Email ${process.env.CONTACT_EMAIL || "us"} instead.` }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const row = {
    claimant: s(b.claimant, 200),
    email: s(b.email, 200),
    content_url: s(b.contentUrl, 500),
    details: s(b.details, 4000),
    good_faith: b.goodFaith === true,
  };
  if (!row.claimant || !row.email || !row.content_url || !row.details || !row.good_faith)
    return NextResponse.json({ error: "All fields and the good-faith statement are required." }, { status: 400 });
  const { error } = await db.from("takedowns").insert(row);
  if (error) return NextResponse.json({ error: "Couldn't record the request." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
