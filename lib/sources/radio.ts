import { getJson, enc } from "../http";
import type { Track } from "../types";

// Radio Browser: community directory of public internet radio streams.
// Only HTTPS streams are kept (browsers block http audio on https sites).
const BASE = "https://de1.api.radio-browser.info/json";

function toTrack(s: any): Track {
  return {
    id: `radio:${s.stationuuid}`,
    source: "radio",
    sourceId: s.stationuuid,
    title: s.name.trim(),
    artist: [s.country, s.tags?.split(",").slice(0, 2).join(" · ")].filter(Boolean).join(" — ") || "Live radio",
    artwork: s.favicon || undefined,
    genres: (s.tags || "").split(",").filter(Boolean).slice(0, 4),
    tier: 1,
    playback: { kind: "audio", url: s.url_resolved, live: true },
    license: { name: "Public broadcast stream", url: s.homepage || undefined },
    pageUrl: s.homepage || undefined,
    kind: "station",
  };
}

export async function searchRadio(opts: { q?: string; tag?: string; country?: string; limit?: number }): Promise<Track[]> {
  const p = new URLSearchParams({
    limit: String(opts.limit ?? 30),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });
  if (opts.q) p.set("name", opts.q);
  if (opts.tag) p.set("tag", opts.tag);
  if (opts.country) p.set("countrycode", opts.country.toUpperCase());
  const r = await getJson<any[]>(`${BASE}/stations/search?${p}`, { revalidate: 1800 });
  return (r || []).filter((s) => String(s.url_resolved).startsWith("https://")).map(toTrack);
}
