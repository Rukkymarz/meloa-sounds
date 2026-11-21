import { getJson, enc } from "../http";
import type { Track } from "../types";

// Internet Archive: public-domain and Creative Commons recordings, live concerts
// (etree) and netlabels. Search returns items; the playable file is looked up on click.
export async function searchArchive(q: string, limit = 12): Promise<Track[]> {
  const query = `(${q}) AND mediatype:(audio) AND (collection:(etree) OR collection:(netlabels) OR collection:(opensource_audio) OR collection:(78rpm) OR licenseurl:*creativecommons* OR licenseurl:*publicdomain*)`;
  const fl = ["identifier", "title", "creator", "licenseurl", "subject"].map((f) => `fl[]=${f}`).join("&");
  const r = await getJson(
    `https://archive.org/advancedsearch.php?q=${enc(query)}&${fl}&rows=${limit}&output=json&sort[]=downloads+desc`,
  );
  return (r.response?.docs || []).map(
    (d: any): Track => ({
      id: `archive:${d.identifier}`,
      source: "archive",
      sourceId: d.identifier,
      title: Array.isArray(d.title) ? d.title[0] : d.title || d.identifier,
      artist: (Array.isArray(d.creator) ? d.creator[0] : d.creator) || "Various",
      artwork: `https://archive.org/services/img/${d.identifier}`,
      genres: Array.isArray(d.subject) ? d.subject.slice(0, 3) : d.subject ? [d.subject] : [],
      tier: 1,
      playback: { kind: "resolve", source: "archive", id: d.identifier },
      license: { name: d.licenseurl ? "Open licence (see link)" : "Public domain / archive terms", url: d.licenseurl },
      pageUrl: `https://archive.org/details/${d.identifier}`,
      kind: "song",
    }),
  );
}

/** Pick the first full MP3 in an Archive item. */
export async function resolveArchive(identifier: string): Promise<{ url: string; durationSec?: number } | null> {
  const r = await getJson(`https://archive.org/metadata/${enc(identifier)}`);
  const files: any[] = r.files || [];
  const mp3 =
    files.find((f) => f.format === "VBR MP3") ||
    files.find((f) => f.format === "MP3") ||
    files.find((f) => /\.mp3$/i.test(f.name));
  if (!mp3) return null;
  const len = Number(mp3.length);
  return {
    url: `https://archive.org/download/${enc(identifier)}/${mp3.name.split("/").map(enc).join("/")}`,
    durationSec: Number.isFinite(len) ? Math.round(len) : undefined,
  };
}
