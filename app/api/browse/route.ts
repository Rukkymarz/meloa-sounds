import { NextRequest, NextResponse } from "next/server";
import { browseCatalog, catalogFacets } from "@/lib/catalog";

export const runtime = "nodejs";

// GET /api/browse?decade=1980&genre=rnb → verified songs by original release decade
// GET /api/browse?facets=1            → counts per decade and genre
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("facets")) return NextResponse.json(await catalogFacets(), { headers: { "Cache-Control": "public, s-maxage=600" } });
  const decade = sp.get("decade") ? Number(sp.get("decade")) : undefined;
  const genre = sp.get("genre") || undefined;
  const tracks = await browseCatalog({ decade, genre, limit: Math.min(100, Number(sp.get("limit") || 60)) });
  return NextResponse.json({ tracks }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}
