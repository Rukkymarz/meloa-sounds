import { getJson, enc } from "../http";
import { cleanArtist, cleanTitle, isoDuration, similarity } from "../normalize";
import type { Track } from "../types";

// YouTube Data API v3 + the official IFrame player.
// Rules we follow (YouTube API Services Terms & Developer Policies):
//  • audio is never separated from the video — the player stays visible (≥200×200)
//  • YouTube's ads, branding and controls are never blocked or hidden
//  • only video IDs and metadata are stored, never audio/video files
// search.list costs 100 quota units (~100 searches/day free), so every match
// is saved in Supabase and reused forever.
const BASE = "https://www.googleapis.com/youtube/v3";

const BAD = /\b(cover|karaoke|instrumental|8d|sped ?up|slowed|nightcore|reaction|tutorial|1 hour|loop)\b/i;

export function youtubeEnabled() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

interface Candidate {
  videoId: string;
  title: string;
  channel: string;
  durationSec: number;
  thumb?: string;
  embeddable: boolean;
}

async function details(ids: string[]): Promise<Candidate[]> {
  const key = process.env.YOUTUBE_API_KEY!;
  const r = await getJson(
    `${BASE}/videos?part=snippet,contentDetails,status&id=${ids.join(",")}&key=${key}`,
    { revalidate: 86400 },
  );
  return (r.items || []).map((v: any) => ({
    videoId: v.id,
    title: v.snippet.title,
    channel: v.snippet.channelTitle,
    durationSec: isoDuration(v.contentDetails.duration),
    thumb: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
    embeddable: v.status?.embeddable !== false,
  }));
}

/** Find the best official full-length upload for a known song. Returns null if nothing trustworthy. */
export async function matchYouTube(artist: string, title: string, expectedSec?: number): Promise<Track | null> {
  if (!youtubeEnabled()) return null;
  const key = process.env.YOUTUBE_API_KEY!;
  const q = `${cleanArtist(artist)} ${cleanTitle(title)}`;
  const s = await getJson(
    `${BASE}/search?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=8&q=${enc(q)}&key=${key}`,
    { revalidate: 86400 },
  );
  const ids: string[] = (s.items || []).map((i: any) => i.id?.videoId).filter(Boolean);
  if (!ids.length) return null;
  const cands = await details(ids);

  const a = cleanArtist(artist);
  let best: { c: Candidate; score: number } | null = null;
  for (const c of cands) {
    if (!c.embeddable || c.durationSec < 60) continue; // full tracks only
    if (BAD.test(c.title) && !BAD.test(title)) continue;
    let score = similarity(c.title, title) * 2 + similarity(c.title + " " + c.channel, a);
    const ch = c.channel.toLowerCase();
    if (ch.endsWith(" - topic")) score += 1.2; // auto-generated official audio
    if (/vevo$/i.test(c.channel)) score += 1;
    if (similarity(cleanArtist(c.channel), a) > 0.6) score += 0.8; // artist's own channel
    if (/official/i.test(c.title)) score += 0.3;
    if (/\blive\b/i.test(c.title) && !/\blive\b/i.test(title)) score -= 0.8;
    if (expectedSec) {
      const diff = Math.abs(c.durationSec - expectedSec) / expectedSec;
      if (diff > 0.35) continue;
      score += 1 - diff * 2;
    }
    if (!best || score > best.score) best = { c, score };
  }
  if (!best || best.score < 1.6) return null;
  const c = best.c;
  return {
    id: `youtube:${c.videoId}`,
    source: "youtube",
    sourceId: c.videoId,
    title: cleanTitle(title),
    artist: a,
    artwork: c.thumb,
    durationSec: c.durationSec,
    tier: 2,
    playback: { kind: "youtube", videoId: c.videoId },
    license: { name: "Played by YouTube (ads by YouTube)", url: `https://www.youtube.com/watch?v=${c.videoId}` },
    pageUrl: `https://www.youtube.com/watch?v=${c.videoId}`,
    kind: "song",
  };
}

/** Video metadata for a pasted link (1 quota unit). */
export async function youtubeById(videoId: string): Promise<Track | null> {
  const fallback: Track = {
    id: `youtube:${videoId}`,
    source: "youtube",
    sourceId: videoId,
    title: "YouTube video",
    artist: "YouTube",
    artwork: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    tier: 2,
    playback: { kind: "youtube", videoId },
    pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
    kind: "song",
  };
  if (!youtubeEnabled()) return fallback;
  const [c] = await details([videoId]);
  if (!c) return null;
  return { ...fallback, title: cleanTitle(c.title), artist: cleanArtist(c.channel), durationSec: c.durationSec, artwork: c.thumb };
}
