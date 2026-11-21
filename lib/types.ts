export type SourceName =
  | "audius"
  | "jamendo"
  | "openverse"
  | "archive"
  | "ccmixter"
  | "youtube"
  | "audiomack"
  | "mixcloud"
  | "soundcloud"
  | "bandcamp"
  | "boomplay"
  | "spotify"
  | "radio"
  | "deezer"
  | "musicbrainz"
  | "meloa";

/**
 * How a track is played. Only `audio` streams a file directly, and only for sources
 * whose terms or licences allow it (Audius API, Creative Commons, public domain,
 * public radio streams, artist uploads). Everything else plays inside the
 * platform's own official player.
 */
export type Playback =
  | { kind: "audio"; url: string; live?: boolean }
  | { kind: "youtube"; videoId: string }
  | { kind: "embed"; provider: SourceName; src: string; height: number; note?: string }
  | { kind: "resolve"; source: SourceName; id: string } // resolved on click (saves API quota)
  | { kind: "none" };

/** 1 = full, free, no ads · 2 = full, platform ads · 3 = platform embed · 4 = metadata only */
export type Tier = 1 | 2 | 3 | 4;

export interface License {
  name: string;
  url?: string;
  attribution?: string;
}

export interface Track {
  id: string; // `${source}:${sourceId}`
  source: SourceName;
  sourceId: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  durationSec?: number;
  isrc?: string;
  mbid?: string;
  genres?: string[];
  tier: Tier;
  playback: Playback;
  license?: License;
  pageUrl?: string; // link back to the original page (required credit on most platforms)
  kind?: "song" | "mix" | "station";
  alternates?: Track[];
}

export interface SearchOptions {
  q: string;
  type?: "song" | "mix" | "station" | "all";
  genre?: string;
  limit?: number;
}
