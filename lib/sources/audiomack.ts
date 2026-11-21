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

// ---------- curated releases (no API key needed) ----------

export type AudiomackType = "song" | "album" | "playlist";
export interface AudiomackRef { uploader: string; type: AudiomackType; slug: string }

const SLUG = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/;

/** Accepts only official-format audiomack.com song/album/playlist links. */
export function parseAudiomackUrl(raw: string): AudiomackRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  if (u.protocol !== "https:" || host !== "audiomack.com") return null;
  const [uploader, type, slug] = u.pathname.split("/").filter(Boolean);
  if (!uploader || !slug || !["song", "album", "playlist"].includes(type)) return null;
  if (!SLUG.test(uploader) || !SLUG.test(slug)) return null;
  return { uploader, type: type as AudiomackType, slug };
}

export function audiomackPageUrl(r: AudiomackRef) {
  return `https://audiomack.com/${r.uploader}/${r.type}/${r.slug}`;
}

/** An embed URL is only rendered when it points at Audiomack's own player for that release. */
export function isAudiomackEmbed(src: string) {
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname === "audiomack.com" && /^\/embed\/(song|album|playlist)\/[^/]+\/[^/]+$/.test(u.pathname);
  } catch {
    return false;
  }
}

export interface AudiomackCheck {
  ok: boolean;
  src: string;
  note: string;
  title?: string;
  artist?: string;
  artwork?: string;
}

const UA = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" };

async function fetchText(url: string, ms = 5000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: UA, signal: ctl.signal, redirect: "follow", next: { revalidate: 3600 } });
    return { status: r.status, type: r.headers.get("content-type") || "", finalUrl: r.url, body: r.ok ? await r.text() : "" };
  } finally {
    clearTimeout(t);
  }
}

function meta(html: string, prop: string) {
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  return (html.match(a) || html.match(b))?.[1]?.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
}

/**
 * Checks that Audiomack's official player loads for this release before Meloa shows it.
 * 1) oEmbed (Audiomack's own embed answer) gives title, artist, artwork and the player URL.
 * 2) The player URL must be an audiomack.com/embed/… address that answers 200 with a page.
 */
export async function checkAudiomack(r: AudiomackRef): Promise<AudiomackCheck> {
  const page = audiomackPageUrl(r);
  let src = audiomackEmbed(r.type, r.uploader, r.slug);
  let title: string | undefined, artist: string | undefined, artwork: string | undefined;

  try {
    const o = await fetchText(`https://audiomack.com/oembed?format=json&url=${encodeURIComponent(page)}`);
    if (o.status === 200 && o.type.includes("json")) {
      const j = JSON.parse(o.body);
      title = j.title;
      artist = j.author_name;
      artwork = j.thumbnail_url;
      const m = String(j.html || "").match(/src=["']([^"']+)["']/);
      if (m && isAudiomackEmbed(m[1].split("?")[0])) src = m[1].startsWith("http") ? m[1] : `https:${m[1]}`;
    } else if (o.status === 404) {
      return { ok: false, src, note: "Audiomack says this release doesn't exist (404)." };
    }
  } catch {
    /* fall through to checking the player directly */
  }

  if (!isAudiomackEmbed(src.split("?")[0])) return { ok: false, src, note: "Player address isn't Audiomack's official player." };

  try {
    const e = await fetchText(src);
    if (e.status === 404 || e.status === 410) return { ok: false, src, title, artist, artwork, note: `Audiomack's player answered ${e.status}: release not available.` };
    if (e.status !== 200) {
      // 403/429/5xx usually means Audiomack's bot protection blocked our server, not that the
      // player is broken. Listeners' browsers load it normally, so show the official player.
      return { ok: true, src, title, artist, artwork, note: `Server check got ${e.status} (bot protection); the address is Audiomack's official player, so it is shown.` };
    }
    if (!e.type.includes("html")) return { ok: false, src, title, artist, artwork, note: "Audiomack's player didn't return a page." };
    const pageTitle = (e.body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "") + " " + (meta(e.body, "og:title") || "");
    if (/not\s+found|\b404\b|no longer available|has been removed|unavailable/i.test(pageTitle)) {
      return { ok: false, src, title, artist, artwork, note: "Audiomack's player says this release is unavailable." };
    }
    if (!title) {
      const t = meta(e.body, "og:title") || meta(e.body, "twitter:title");
      if (t) {
        const [a, b] = t.split(" by ");
        title = a?.trim();
        artist = artist || b?.replace(/\s*[|·-]\s*Audiomack.*$/i, "").trim();
      }
      artwork = artwork || meta(e.body, "og:image") || meta(e.body, "twitter:image");
    }
    return { ok: true, src, title, artist, artwork, note: "Official Audiomack player loads." };
  } catch (err) {
    const er = err as Error & { cause?: { code?: string; message?: string } };
    const why = [er.name, er.message, er.cause?.code || er.cause?.message].filter(Boolean).join(": ");
    return { ok: true, src, title, artist, artwork, note: `Server couldn't reach Audiomack (${why}); the address is Audiomack's official player, so it is shown.` };
  }
}
