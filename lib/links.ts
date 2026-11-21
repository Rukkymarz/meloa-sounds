import { getJson, getText, enc } from "./http";
import { mixcloudWidget } from "./sources/mixcloud";
import { audiomackEmbed } from "./sources/audiomack";
import { youtubeById } from "./sources/youtube";
import { cleanTitle } from "./normalize";
import type { Track } from "./types";

// "Paste a link": turns a public link from any supported platform into a playable
// Track that uses THAT platform's official player. Nothing is downloaded or re-hosted.

const ALLOWED_HOSTS = [
  "youtube.com", "youtu.be", "music.youtube.com",
  "audiomack.com", "soundcloud.com", "on.soundcloud.com",
  "mixcloud.com", "bandcamp.com", "boomplay.com",
  "open.spotify.com", "audius.co", "mdundo.com",
];

function hostOk(u: URL) {
  const h = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith("." + a));
}

/** Read a page's player card (og:video / twitter:player) — the platform's own declared embed. */
async function playerCard(url: string) {
  const html = await getText(url);
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
    return (html.match(re) || html.match(re2))?.[1]?.replace(/&amp;/g, "&");
  };
  return {
    player: meta("twitter:player") || meta("og:video:secure_url") || meta("og:video"),
    title: meta("og:title") || meta("twitter:title"),
    image: meta("og:image") || meta("twitter:image"),
    artist: meta("music:musician_description") || meta("og:site_name"),
  };
}

export async function resolveLink(raw: string): Promise<Track> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a link.");
  }
  if (u.protocol !== "https:" || !hostOk(u)) {
    throw new Error("Unsupported site. Paste a YouTube, Audiomack, SoundCloud, Mixcloud, Bandcamp, Boomplay, Spotify or Audius link.");
  }
  const host = u.hostname.replace(/^(www|m)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  // ---- YouTube ----
  if (host.endsWith("youtube.com") || host === "youtu.be") {
    const id = host === "youtu.be" ? parts[0] : u.searchParams.get("v") || (parts[0] === "shorts" ? parts[1] : null);
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("Couldn't find a video ID in that YouTube link.");
    const t = await youtubeById(id);
    if (!t) throw new Error("That YouTube video isn't available to embed.");
    return t;
  }

  // ---- Audiomack: /{uploader}/{song|album|playlist}/{slug} ----
  if (host === "audiomack.com" && parts.length >= 3 && ["song", "album", "playlist"].includes(parts[1])) {
    const [uploader, type, slug] = parts as [string, "song" | "album" | "playlist", string];
    const card = await playerCard(u.toString()).catch(() => null);
    return {
      id: `audiomack:${uploader}/${type}/${slug}`,
      source: "audiomack",
      sourceId: `${uploader}/${type}/${slug}`,
      title: cleanTitle(card?.title?.split(" by ")[0] || slug.replace(/-/g, " ")),
      artist: card?.title?.split(" by ")[1]?.replace(/\s*\|.*$/, "") || uploader,
      artwork: card?.image,
      tier: 3,
      playback: { kind: "embed", provider: "audiomack", src: audiomackEmbed(type, uploader, slug), height: type === "song" ? 252 : 400 },
      pageUrl: u.toString(),
      kind: /mix|mixtape/i.test(slug) || type !== "song" ? "mix" : "song",
    };
  }

  // ---- SoundCloud (oEmbed, no key) ----
  if (host.endsWith("soundcloud.com")) {
    const o = await getJson(`https://soundcloud.com/oembed?format=json&url=${enc(u.toString())}`);
    return {
      id: `soundcloud:${u.pathname}`,
      source: "soundcloud",
      sourceId: u.pathname,
      title: cleanTitle(String(o.title || "").split(" by ")[0]),
      artist: o.author_name || "SoundCloud",
      artwork: o.thumbnail_url,
      tier: 3,
      playback: {
        kind: "embed",
        provider: "soundcloud",
        src: `https://w.soundcloud.com/player/?url=${enc(u.toString())}&auto_play=true&visual=false&show_comments=false`,
        height: 166,
        note: "Some major-label tracks play only a clip on SoundCloud for non-subscribers.",
      },
      pageUrl: u.toString(),
      kind: "song",
    };
  }

  // ---- Mixcloud ----
  if (host === "mixcloud.com" && parts.length >= 2) {
    const key = `/${parts[0]}/${parts[1]}/`;
    const c = await getJson(`https://api.mixcloud.com${key}`).catch(() => null);
    return {
      id: `mixcloud:${key}`,
      source: "mixcloud",
      sourceId: key,
      title: c?.name || parts[1].replace(/-/g, " "),
      artist: c?.user?.name || parts[0],
      artwork: c?.pictures?.large,
      durationSec: c?.audio_length,
      tier: 3,
      playback: { kind: "embed", provider: "mixcloud", src: mixcloudWidget(key), height: 120 },
      pageUrl: u.toString(),
      kind: "mix",
    };
  }

  // ---- Spotify (embed) ----
  if (host === "open.spotify.com" && parts.length >= 2) {
    const i = parts[0].startsWith("intl-") ? 1 : 0;
    const [type, id] = [parts[i], parts[i + 1]];
    const o = await getJson(`https://open.spotify.com/oembed?url=${enc(u.toString())}`).catch(() => null);
    return {
      id: `spotify:${type}:${id}`,
      source: "spotify",
      sourceId: `${type}:${id}`,
      title: o?.title || "Spotify",
      artist: "Spotify",
      artwork: o?.thumbnail_url,
      tier: 3,
      playback: { kind: "external", provider: "spotify", url: u.toString() },
      pageUrl: u.toString(),
      kind: type === "track" ? "song" : "mix",
    };
  }

  // ---- Audius ----
  if (host === "audius.co") {
    const app = enc(process.env.AUDIUS_APP_NAME || "MeloaSounds");
    const r = await getJson(`https://api.audius.co/v1/resolve?url=${enc(u.toString())}&app_name=${app}`);
    const t = r.data;
    if (!t?.id || !t.title) throw new Error("Paste a link to a single Audius track.");
    return {
      id: `audius:${t.id}`,
      source: "audius",
      sourceId: t.id,
      title: t.title,
      artist: t.user?.name || "Audius",
      artwork: t.artwork?.["480x480"],
      durationSec: t.duration,
      tier: 1,
      playback: { kind: "audio", url: `https://api.audius.co/v1/tracks/${t.id}/stream?app_name=${app}` },
      pageUrl: u.toString(),
      kind: "song",
    };
  }

  // ---- Bandcamp, Boomplay and anything else on the list: use the page's declared player ----
  const card = await playerCard(u.toString());
  if (!card.player)
    throw new Error(
      host.includes("mdundo")
        ? "Mdundo doesn't offer an embeddable player for this page — open it on Mdundo to listen."
        : "This page doesn't offer an embeddable player.",
    );
  const provider = host.includes("bandcamp") ? "bandcamp" : host.includes("boomplay") ? "boomplay" : "meloa";
  return {
    id: `${provider}:${u.pathname}`,
    source: provider as Track["source"],
    sourceId: u.pathname,
    title: cleanTitle((card.title || "").split(", by ")[0].split(" | ")[0]),
    artist: (card.title || "").split(", by ")[1] || card.artist || host,
    artwork: card.image,
    tier: 3,
    playback: {
      kind: "embed",
      provider: provider as Track["source"],
      src: card.player,
      height: 160,
      note: provider === "boomplay" ? "Some Boomplay tracks are region-locked outside Africa." : undefined,
    },
    pageUrl: u.toString(),
    kind: "song",
  };
}
