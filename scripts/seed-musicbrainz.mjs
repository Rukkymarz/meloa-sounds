// Seed your Meloa catalog with song metadata from MusicBrainz (open, CC0 data).
// No audio is downloaded: each song is matched to a full legal player the first
// time someone taps it, and that match is saved.
//
// Usage:
//   node --env-file=.env.local scripts/seed-musicbrainz.mjs            (all presets, 300 songs each)
//   node --env-file=.env.local scripts/seed-musicbrainz.mjs afrobeats 1000
//
// MusicBrainz asks for ≤1 request/second and a real User-Agent — both are respected here.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const UA = `MeloaSounds/0.1 ( ${process.env.CONTACT_EMAIL || "contact@example.com"} )`;

// genre slug → MusicBrainz recording query (Lucene syntax) + country tag stored on rows
const PRESETS = {
  afrobeats: { q: '(tag:afrobeats OR tag:afrobeat OR tag:"afro pop" OR tag:afropop OR tag:afroswing)', country: null },
  "street-pop": { q: '(tag:"nigerian" OR tag:"naija" OR tag:"street pop") AND country:NG', country: "NG" },
  "fuji-juju": { q: "(tag:fuji OR tag:juju OR tag:apala OR tag:yoruba)", country: "NG" },
  highlife: { q: "(tag:highlife OR tag:hiplife)", country: "GH" },
  amapiano: { q: "(tag:amapiano OR tag:gqom OR tag:kwaito)", country: "ZA" },
  gospel: { q: '(tag:gospel OR tag:"contemporary christian" OR tag:worship)', country: null },
  "hip-hop": { q: '(tag:"hip hop" OR tag:rap OR tag:trap)', country: null },
  rnb: { q: '(tag:"r&b" OR tag:"contemporary r&b" OR tag:soul)', country: null },
  "dancehall-reggae": { q: "(tag:dancehall OR tag:reggae OR tag:reggaeton)", country: null },
  house: { q: '(tag:house OR tag:"deep house" OR tag:"afro house")', country: null },
  jazz: { q: "(tag:jazz OR tag:\"jazz fusion\")", country: null },
  latin: { q: '(tag:latin OR tag:salsa OR tag:bachata OR tag:"latin pop")', country: null },
  "k-pop": { q: '(tag:k-pop OR tag:"korean pop")', country: null },
  bollywood: { q: '(tag:bollywood OR tag:filmi OR tag:"indian pop")', country: null },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fold(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "").replace(/\b(feat|ft|featuring|with)\b.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
const normKey = (artist, title) => `${fold(artist.replace(/\s*-\s*Topic$/i, ""))}|${fold(title)}`;

async function mb(query, offset) {
  const u = `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&limit=100&offset=${offset}&fmt=json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (r.status === 503) { await sleep(3000); continue; }
    if (!r.ok) throw new Error(`MusicBrainz ${r.status}`);
    return r.json();
  }
  throw new Error("MusicBrainz busy, try later");
}

async function seed(slug, max) {
  const p = PRESETS[slug];
  if (!p) throw new Error(`Unknown preset ${slug}. Options: ${Object.keys(PRESETS).join(", ")}`);
  let added = 0;
  const seen = new Set();
  for (let offset = 0; offset < max; offset += 100) {
    const j = await mb(p.q, offset);
    const recs = j.recordings || [];
    if (!recs.length) break;
    const rows = [];
    for (const x of recs) {
      const artist = (x["artist-credit"] || []).map((c) => c.name + (c.joinphrase || "")).join("").trim();
      if (!artist || !x.title) continue;
      const lengthSec = x.length ? Math.round(x.length / 1000) : null;
      if (lengthSec !== null && lengthSec < 60) continue; // full songs only
      const k = normKey(artist, x.title);
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({
        norm_key: k,
        title: x.title,
        artist,
        duration_sec: lengthSec,
        isrc: x.isrcs?.[0] || null,
        mbid: x.id,
        genres: [slug],
        country: p.country,
      });
    }
    if (rows.length) {
      const { error } = await db.from("tracks").upsert(rows, { onConflict: "norm_key", ignoreDuplicates: true });
      if (error) console.error(error.message);
      else added += rows.length;
    }
    console.log(`${slug}: ${offset + recs.length}/${Math.min(max, j.count)} scanned, ${added} saved`);
    if (offset + 100 >= j.count) break;
    await sleep(1100); // MusicBrainz rate limit
  }
  return added;
}

const [, , only, maxArg] = process.argv;
const max = Number(maxArg) || 300;
const slugs = only ? [only] : Object.keys(PRESETS);
let total = 0;
for (const s of slugs) total += await seed(s, max);
console.log(`Done. ${total} songs added to the Meloa catalog.`);
