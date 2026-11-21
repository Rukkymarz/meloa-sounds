import { getJson, enc } from "../http";
import type { Track } from "../types";

// Mixcloud: licensed DJ mixes and radio shows. Read API needs no key.
// Playback must use Mixcloud's own widget (that is how Mixcloud pays rights holders).
export function mixcloudWidget(key: string) {
  return `https://player-widget.mixcloud.com/widget/iframe/?hide_cover=1&light=0&autoplay=1&feed=${enc(key)}`;
}

function toTrack(c: any): Track {
  return {
    id: `mixcloud:${c.key}`,
    source: "mixcloud",
    sourceId: c.key,
    title: c.name,
    artist: c.user?.name || "Mixcloud",
    artwork: c.pictures?.large || c.pictures?.medium,
    durationSec: c.audio_length,
    genres: (c.tags || []).map((t: any) => t.name).slice(0, 4),
    tier: 3,
    playback: { kind: "embed", provider: "mixcloud", src: mixcloudWidget(c.key), height: 120 },
    pageUrl: c.url,
    kind: "mix",
  };
}

export async function searchMixcloud(q: string, limit = 12): Promise<Track[]> {
  const r = await getJson(`https://api.mixcloud.com/search/?q=${enc(q)}&type=cloudcast&limit=${limit}`);
  return (r.data || []).map(toTrack);
}

/** Popular mixes for a tag, e.g. "afrobeats", "amapiano", "house". */
export async function mixcloudByTag(tag: string, limit = 20): Promise<Track[]> {
  const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const r = await getJson(`https://api.mixcloud.com/discover/${slug}/popular/?limit=${limit}`);
  return (r.data || []).map(toTrack);
}
