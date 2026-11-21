import { getJson, enc } from "../http";
import type { Track } from "../types";

// ccMixter: Creative Commons remixes, a cappellas and instrumentals. Open API, no key.
export async function searchCcmixter(q: string, limit = 10): Promise<Track[]> {
  const r = await getJson<any[]>(
    `https://ccmixter.org/api/query?f=json&search=${enc(q)}&search_type=all&limit=${limit}&sort=rank`,
  );
  return (r || [])
    .map((u: any): Track | null => {
      const file = (u.files || []).find((f: any) => /\.mp3$/i.test(f.download_url || f.file_name || ""));
      if (!file?.download_url) return null;
      return {
        id: `ccmixter:${u.upload_id}`,
        source: "ccmixter",
        sourceId: String(u.upload_id),
        title: u.upload_name,
        artist: u.user_real_name || u.user_name,
        genres: String(u.upload_tags || "").split(",").filter(Boolean).slice(0, 3),
        tier: 1,
        playback: { kind: "audio", url: file.download_url },
        license: { name: u.license_name || "Creative Commons", url: u.license_url, attribution: `"${u.upload_name}" by ${u.user_name} (ccMixter)` },
        pageUrl: u.file_page_url,
        kind: "song",
      };
    })
    .filter(Boolean) as Track[];
}
