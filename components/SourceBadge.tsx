import type { Track } from "@/lib/types";

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
  radio: "Radio",
  deezer: "Find full song",
  meloa: "Meloa artist",
};

export function SourceBadge({ track }: { track: Track }) {
  const name = NAMES[track.source] || track.source;
  if (track.kind === "station") return <span className="badge live">LIVE · {name}</span>;
  if (track.tier === 1) return <span className="badge free">FULL · {name}</span>;
  if (track.tier === 2) return <span className="badge ads">FULL · {name} ads</span>;
  if (track.tier === 3) return <span className="badge embed">{track.kind === "mix" ? "MIX" : "FULL"} · {name}</span>;
  return <span className="badge find">{name}</span>;
}
