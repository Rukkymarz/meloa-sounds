import crypto from "node:crypto";
import { getJson } from "../http";
import type { Track } from "../types";

// Audiomack: the deepest legal catalog for Afrobeats, street-pop, amapiano and DJ mixes.
// • Embeds (no key): any audiomack.com song/album/playlist URL plays in Audiomack's player.
// • Data API search (optional): needs an approved OAuth 1.0a consumer key/secret.
// Playback always stays in Audiomack's player so plays, ads and royalties go to the artist.
const API = "https://api.audiomack.com/v1";

export function audiomackEnabled() {
  return Boolean(process.env.AUDIOMACK_CONSUMER_KEY && process.env.AUDIOMACK_CONSUMER_SECRET);
}

export function audiomackEmbed(type: "song" | "album" | "playlist", uploader: string, slug: string) {
  return `https://audiomack.com/embed/${type}/${uploader}/${slug}?background=1`;
}

function pct(s: string) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/** OAuth 1.0a two-legged (consumer-only) HMAC-SHA1 signed GET. */
function signedUrl(path: string, params: Record<string, string>) {
  const url = `${API}${path}`;
  const oauth: Record<string, string> = {
    oauth_consumer_key: process.env.AUDIOMACK_CONSUMER_KEY!,
    oauth_nonce: crypto.randomBytes(12).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const base = Object.keys(all)
    .sort()
    .map((k) => `${pct(k)}=${pct(all[k])}`)
    .join("&");
  const sigBase = ["GET", pct(url), pct(base)].join("&");
  const key = `${pct(process.env.AUDIOMACK_CONSUMER_SECRET!)}&`;
  const sig = crypto.createHmac("sha1", key).update(sigBase).digest("base64");
  const qs = new URLSearchParams({ ...all, oauth_signature: sig });
  return `${url}?${qs}`;
}

function toTrack(s: any): Track | null {
  const uploader = s.uploader?.url_slug || s.uploader_url_slug;
  const slug = s.url_slug;
  if (!uploader || !slug) return null;
  const dur = Number(s.duration);
  return {
    id: `audiomack:${s.id}`,
    source: "audiomack",
    sourceId: String(s.id),
    title: s.title,
    artist: s.artist || s.uploader?.name || uploader,
    artwork: s.image || s.image_base,
    durationSec: Number.isFinite(dur) && dur > 0 ? dur : undefined,
    genres: s.genre ? [s.genre] : [],
    tier: 3,
    playback: { kind: "embed", provider: "audiomack", src: audiomackEmbed("song", uploader, slug), height: 252 },
    pageUrl: `https://audiomack.com/${uploader}/song/${slug}`,
    kind: /mix|mixtape/i.test(s.title) ? "mix" : "song",
  };
}

export async function searchAudiomack(q: string, limit = 15): Promise<Track[]> {
  if (!audiomackEnabled()) return [];
  const r = await getJson(signedUrl("/search", { q, show: "songs", limit: String(limit) }), { revalidate: 3600 });
  return (r.results || []).map(toTrack).filter(Boolean) as Track[];
}

export async function trendingAudiomack(genre?: string, limit = 20): Promise<Track[]> {
  if (!audiomackEnabled()) return [];
  const path = genre ? `/music/${genre}/trending` : "/music/trending";
  const r = await getJson(signedUrl(path, { limit: String(limit) }), { revalidate: 3600 });
  return (r.results || []).map(toTrack).filter(Boolean) as Track[];
}
