import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import type { Playback } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Player check", robots: { index: false, follow: false } };

// Guest playback check page used by the automated verifier (scripts/import/verify.mjs).
// It renders one catalog player exactly as Meloa embeds it, on Meloa's own domain,
// with no sign-in. Protected by the import token so pending players stay private.
export default async function Verify({ searchParams }: { searchParams: Promise<{ id?: string; k?: string }> }) {
  const { id, k } = await searchParams;
  const token = process.env.IMPORT_TOKEN;
  if (!token || k !== token || !id) notFound();
  const db = supabaseAdmin();
  const { data } = db ? await db.from("track_sources").select("id,source,playback,expected_sec,tracks(title,artist)").eq("id", id).maybeSingle() : { data: null };
  if (!data) notFound();
  const pb = data.playback as Playback;
  const t = (data as any).tracks;

  return (
    <div style={{ padding: 16 }} data-verify-id={data.id} data-expected={data.expected_sec ?? ""} data-kind={pb.kind}>
      <h1 className="h-section">{t?.title} — {t?.artist}</h1>
      <p className="muted">{data.source} · expected {data.expected_sec ?? "?"}s</p>
      {pb.kind === "audio" && <audio id="meloa-media" src={pb.url} controls preload="metadata" playsInline style={{ width: "100%" }} />}
      {pb.kind === "youtube" && (
        <iframe
          id="meloa-embed"
          src={`https://www.youtube.com/embed/${pb.videoId}?enablejsapi=1&playsinline=1&rel=0`}
          allow="autoplay; encrypted-media"
          style={{ width: "100%", maxWidth: 560, aspectRatio: "16/9", border: 0 }}
        />
      )}
      {pb.kind === "embed" && (
        <iframe id="meloa-embed" src={pb.src} allow="autoplay; encrypted-media; clipboard-write" style={{ width: "100%", maxWidth: 560, height: Math.max(pb.height, 200), border: 0 }} />
      )}
    </div>
  );
}
