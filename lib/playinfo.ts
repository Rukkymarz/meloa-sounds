import type { Track } from "./types";

// How a result plays, in words a listener understands. Used on search results and Now Playing.
const NAMES: Record<string, string> = {
  audius: "Audius",
  jamendo: "Jamendo",
  openverse: "Openverse",
  archive: "Internet Archive",
  ccmixter: "ccMixter",
  youtube: "YouTube",
  audiomack: "Audiomack",
  mixcloud: "Mixcloud",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  boomplay: "Boomplay",
  spotify: "Spotify",
  radio: "Radio Browser",
  deezer: "Deezer",
  meloa: "Meloa",
  dailymotion: "Dailymotion",
  fma: "Free Music Archive",
  reverbnation: "ReverbNation",
  ampwall: "Ampwall",
  hearthis: "hearthis.at",
  wikimedia: "Wikimedia Commons",
};

export const providerName = (s: string) => NAMES[s] || s;

export type PlayMode = "here" | "here-ads" | "here-player" | "find" | "external" | "live";

export function playMode(t: Track): PlayMode {
  if (t.playback.kind === "external") return "external";
  if (t.kind === "station") return "live";
  if (t.playback.kind === "resolve" && t.source !== "archive") return "find";
  if (t.tier === 2 || t.playback.kind === "youtube") return "here-ads";
  if (t.playback.kind === "embed") return "here-player";
  return "here";
}

/** Short label for result rows. */
export function playLabel(t: Track): string {
  switch (playMode(t)) {
    case "here":
      return "Plays in Meloa";
    case "here-ads":
      return "Plays in Meloa, YouTube ads";
    case "here-player":
      return `Plays in Meloa, ${providerName(t.source)} player`;
    case "find":
      return "Meloa finds the full song";
    case "external":
      return `Opens in ${providerName(t.source)}`;
    case "live":
      return "Live radio";
  }
}

/** Attribution sentence for Now Playing. */
export function attribution(t: Track): string {
  const p = providerName(t.source);
  if (t.playback.kind === "youtube") return "Playing on YouTube. Ads and video by YouTube.";
  if (t.playback.kind === "embed") return `Playing in the official ${providerName(t.playback.provider)} player.`;
  if (t.playback.kind === "external") return `This plays in the ${providerName(t.playback.provider)} app.`;
  if (t.kind === "station") return "Live stream from the station, listed by Radio Browser.";
  if (t.license?.attribution) return t.license.attribution;
  return `Streaming from ${p}.`;
}
