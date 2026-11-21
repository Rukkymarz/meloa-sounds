import { getJson, enc } from "../http";
import { cleanArtist, cleanTitle, isoDuration } from "../normalize";
import type { Track } from "../types";

// Official, keyless-or-free chart feeds. These replace scraping chart sites:
//  • kworb.net "Apple Music Nigeria" is built from the same Apple chart we read here directly.
//  • Billboard Naija / TurnTable publish no API or feed → linked out on /charts, never scraped.

/** A chart row that only has artist + title: tapping it finds the full legal version. */
export function nameRow(source: Track["source"], artist: string, title: string, extra: Partial<Track> = {}): Track {
  const a = cleanArtist(artist);
  const t = cleanTitle(title);
  return {
    id: `${source}:${a}|${t}`,
    source,
    sourceId: `${a}|${t}`,
    title: t,
    artist: a,
    tier: 4,
    playback: { kind: "resolve", source: "name" as Track["source"], id: JSON.stringify({ a, t, d: extra.durationSec }) },
    kind: "song",
    ...extra,
  };
}

// ---- Apple Music: most-played songs per country (Apple Marketing Tools RSS, no key) ----
const APPLE_HOSTS = ["https://rss.marketingtools.apple.com", "https://rss.applemarketingtools.com"];

export async function appleChart(country: string, limit = 100): Promise<Track[]> {
  const cc = country.toLowerCase();
  let lastErr: unknown;
  for (const host of APPLE_HOSTS) {
    try {
      const r = await getJson(`${host}/api/v2/${cc}/music/most-played/${limit}/songs.json`, { revalidate: 3600 });
      return (r.feed?.results || []).map((s: any, i: number) =>
        nameRow("deezer", s.artistName, s.name, {
          id: `apple:${cc}:${s.id}`,
          artwork: String(s.artworkUrl100 || "").replace("100x100bb", "600x600bb") || undefined,
          genres: (s.genres || []).map((g: any) => g.name).filter((g: string) => g !== "Music"),
          pageUrl: s.url,
          album: `#${i + 1} Apple Music ${country.toUpperCase()}`,
        }),
      );
    } catch (e) {
      lastErr = e;
    }
  }
  // Legacy iTunes RSS (same Apple charts, older format) as a last resort
  try {
    const r = await getJson(`https://itunes.apple.com/${cc}/rss/topsongs/limit=${Math.min(limit, 100)}/json`, { revalidate: 3600 });
    const entries: any[] = r.feed?.entry || [];
    if (entries.length)
      return entries.map((e: any, i: number) =>
        nameRow("deezer", e["im:artist"]?.label || "", e["im:name"]?.label || "", {
          id: `apple:${cc}:${e.id?.attributes?.["im:id"] || i}`,
          artwork: String(e["im:image"]?.slice(-1)[0]?.label || "").replace(/\d+x\d+bb/, "600x600bb") || undefined,
          genres: e.category?.attributes?.label ? [e.category.attributes.label] : [],
          pageUrl: e.link?.attributes?.href,
        }),
      );
  } catch (e) {
    lastErr = e;
  }
  throw lastErr;
}

// ---- YouTube: most popular music videos per region (videos.list chart=mostPopular: 1 quota unit) ----
// These are playable immediately — no search quota spent.
export async function youtubeTrending(region: string, limit = 50): Promise<Track[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return [];
  const r = await getJson(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&chart=mostPopular&videoCategoryId=10&regionCode=${enc(region.toUpperCase())}&maxResults=${Math.min(limit, 50)}&key=${key}`,
    { revalidate: 3600 },
  );
  return (r.items || [])
    .filter((v: any) => v.status?.embeddable !== false)
    .map((v: any): Track => {
      const raw = v.snippet.title as string;
      // "Artist - Title (Official Video)" is the common format; fall back to channel name
      const [maybeArtist, ...rest] = raw.split(/\s[-–—]\s/);
      const hasDash = rest.length > 0;
      return {
        id: `youtube:${v.id}`,
        source: "youtube",
        sourceId: v.id,
        title: cleanTitle(hasDash ? rest.join(" - ") : raw),
        artist: cleanArtist(hasDash ? maybeArtist : v.snippet.channelTitle),
        artwork: v.snippet.thumbnails?.high?.url,
        durationSec: isoDuration(v.contentDetails.duration),
        tier: 2,
        playback: { kind: "youtube", videoId: v.id },
        license: { name: "Played by YouTube (ads by YouTube)", url: `https://www.youtube.com/watch?v=${v.id}` },
        pageUrl: `https://www.youtube.com/watch?v=${v.id}`,
        kind: "song",
      };
    })
    .filter((t: Track) => (t.durationSec || 0) >= 60);
}

// ---- Last.fm: top tracks per country (free API key) ----
const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria", GH: "Ghana", ZA: "South Africa", KE: "Kenya", US: "United States", GB: "United Kingdom",
  JM: "Jamaica", FR: "France", BR: "Brazil", IN: "India", CA: "Canada", DE: "Germany", MX: "Mexico", JP: "Japan",
  KR: "Korea, Republic of", TZ: "Tanzania, United Republic of", UG: "Uganda", CM: "Cameroon", CI: "Côte d'Ivoire",
};

export async function lastfmGeo(country: string, limit = 50): Promise<Track[]> {
  const key = process.env.LASTFM_API_KEY?.trim();
  const name = COUNTRY_NAMES[country.toUpperCase()];
  if (!key || !name) return [];
  const r = await getJson(
    `https://ws.audioscrobbler.com/2.0/?method=geo.gettoptracks&country=${enc(name)}&limit=${limit}&api_key=${key}&format=json`,
    { revalidate: 3600 },
  );
  return (r.tracks?.track || []).map((t: any) =>
    nameRow("deezer", t.artist?.name || "", t.name, {
      id: `lastfm:${country}:${t.mbid || t.name}`,
      durationSec: Number(t.duration) || undefined,
      mbid: t.mbid || undefined,
      pageUrl: t.url,
    }),
  );
}

export { CHART_COUNTRIES, EXTERNAL_CHARTS } from "../chart-meta";
