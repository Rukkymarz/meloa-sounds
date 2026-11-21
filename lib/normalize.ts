/** Strip noise like "(Official Video)", "[Lyrics]", "feat. X", "- Topic" so the same song from different sources matches. */
export function cleanTitle(t: string): string {
  return t
    .replace(/\((official|lyric|lyrics|audio|visuali[sz]er|music video|video)[^)]*\)/gi, "")
    .replace(/\[(official|lyric|lyrics|audio|visuali[sz]er|music video|video)[^\]]*\]/gi, "")
    .replace(/\b(official\s+(music\s+)?video|official\s+audio|lyric\s+video)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanArtist(a: string): string {
  return a
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/VEVO$/i, "")
    .replace(/\s+\b(fka|aka|f\.k\.a\.|a\.k\.a\.)\b.*$/i, "")
    .trim();
}

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/\b(feat|ft|featuring|with)\b.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normKey(artist: string, title: string): string {
  return `${fold(cleanArtist(artist))}|${fold(cleanTitle(title))}`;
}

/** ISO-8601 duration (YouTube) → seconds */
export function isoDuration(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, d, h, mi, s] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

/** Rough similarity 0..1 between two strings (token overlap). */
export function similarity(a: string, b: string): number {
  const A = new Set(fold(a).split(" ").filter(Boolean));
  const B = new Set(fold(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  A.forEach((t) => B.has(t) && hit++);
  return hit / Math.max(A.size, B.size);
}
