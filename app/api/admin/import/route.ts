import { NextRequest, NextResponse } from "next/server";
import { runBatch, pendingForVerification, saveVerification, type ImportItem, type VerifyResult } from "@/lib/importer";

export const runtime = "nodejs";
export const maxDuration = 60;

// Importer API, used by scripts/import/*.mjs. Auth: Bearer IMPORT_TOKEN (or ADMIN_TOKEN).
// GET  ?pending=1[&source=fma]           → players waiting for a guest playback check
// POST { batchId, provider, dryRun, items } → dry run or commit (idempotent)
// POST { verify: [{ id, ok, measuredSec, report }] } → record playback-check results
function authorized(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  return [process.env.IMPORT_TOKEN, process.env.ADMIN_TOKEN].some((t) => !!t && t.length >= 16 && h === `Bearer ${t}`);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const source = req.nextUrl.searchParams.get("source") || undefined;
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit") || 50));
  return NextResponse.json({ pending: await pendingForVerification(limit, source) });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  try {
    if (Array.isArray(body.verify)) {
      await saveVerification(body.verify as VerifyResult[]);
      return NextResponse.json({ ok: true, saved: body.verify.length });
    }
    const items = (body.items || []) as ImportItem[];
    if (!body.batchId || !body.provider || !items.length) throw new Error("batchId, provider and items are required.");
    if (items.length > 300) throw new Error("Send at most 300 items per call.");
    const res = await runBatch(String(body.batchId), String(body.provider), items, body.dryRun !== false);
    return NextResponse.json({ batchId: res.batchId, dryRun: res.dryRun, summary: res.summary });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
