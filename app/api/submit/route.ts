import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ARTIST_TERMS_VERSION } from "@/lib/terms";

export const runtime = "nodejs";

const AUDIO = /\.(mp3|m4a|aac|wav|flac|ogg)$/i;
const IMAGE = /\.(jpe?g|png|webp)$/i;
const MAX_MB = 50; // Supabase free-tier per-file limit

// POST /api/submit  { artistName, email, trackTitle, genre, country, audioFile, artworkFile?, rightsConfirmed, agreeTerms, allowDownload }
// Creates a pending submission and returns one-time signed upload URLs.
// Files land in a PRIVATE bucket and are invisible until you approve them.
export async function POST(req: NextRequest) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "Uploads are not configured yet." }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const artistName = str(b.artistName);
  const email = str(b.email, 200);
  const trackTitle = str(b.trackTitle);
  const audioFile = str(b.audioFile, 200);
  const artworkFile = str(b.artworkFile, 200);
  const sizeMb = Number(b.audioSizeMb) || 0;

  if (!artistName || !trackTitle) return NextResponse.json({ error: "Artist name and track title are required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (b.rightsConfirmed !== true || b.agreeTerms !== true)
    return NextResponse.json({ error: "You must confirm you own the rights and accept the artist terms." }, { status: 400 });
  if (!AUDIO.test(audioFile)) return NextResponse.json({ error: "Audio must be MP3, M4A, AAC, WAV, FLAC or OGG." }, { status: 400 });
  if (sizeMb > MAX_MB) return NextResponse.json({ error: `Audio must be under ${MAX_MB} MB.` }, { status: 400 });
  if (artworkFile && !IMAGE.test(artworkFile)) return NextResponse.json({ error: "Artwork must be JPG, PNG or WebP." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const ipHash = crypto.createHash("sha256").update(ip + (process.env.ADMIN_TOKEN || "")).digest("hex").slice(0, 32);

  // simple abuse guard: max 5 submissions per IP per day
  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await db.from("submissions").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count || 0) >= 5) return NextResponse.json({ error: "Daily upload limit reached. Try again tomorrow." }, { status: 429 });

  const id = crypto.randomUUID();
  const audioPath = `${id}/audio${audioFile.match(AUDIO)![0].toLowerCase()}`;
  const artPath = artworkFile ? `${id}/art${artworkFile.match(IMAGE)![0].toLowerCase()}` : null;

  const { error } = await db.from("submissions").insert({
    id,
    artist_name: artistName,
    email,
    track_title: trackTitle,
    genre: str(b.genre, 60) || null,
    country: str(b.country, 2).toUpperCase() || null,
    file_path: audioPath,
    artwork_path: artPath,
    terms_version: ARTIST_TERMS_VERSION + (b.allowDownload === true ? "+downloads" : ""),
    rights_confirmed: true,
    ip_hash: ipHash,
  });
  if (error) return NextResponse.json({ error: "Couldn't save your submission." }, { status: 500 });

  const audio = await db.storage.from("submissions").createSignedUploadUrl(audioPath);
  const art = artPath ? await db.storage.from("submissions").createSignedUploadUrl(artPath) : null;
  if (audio.error) return NextResponse.json({ error: "Couldn't prepare the upload." }, { status: 500 });

  return NextResponse.json({
    id,
    audio: { path: audioPath, token: audio.data.token },
    artwork: art && !art.error ? { path: artPath, token: art.data.token } : null,
  });
}
