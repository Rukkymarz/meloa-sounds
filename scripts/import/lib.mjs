// Shared helpers for the catalog importers (run in a networked shell, not in the app).
// Env: MELOA_URL (preview URL), IMPORT_TOKEN, VERCEL_BYPASS (protection-bypass secret, optional)
export const BASE = (process.env.MELOA_URL || "").replace(/\/$/, "");
export const UA = "MeloaSounds/0.1 (catalog curation; https://meloasounds.aclclouds.online)";
export const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function meloaHeaders(extra = {}) {
  const h = { "Content-Type": "application/json", Authorization: `Bearer ${process.env.IMPORT_TOKEN}`, ...extra };
  if (process.env.VERCEL_BYPASS) h["x-vercel-protection-bypass"] = process.env.VERCEL_BYPASS;
  return h;
}

export async function meloa(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: meloaHeaders(init.headers) });
  const t = await r.text();
  try {
    return { status: r.status, json: JSON.parse(t) };
  } catch {
    return { status: r.status, json: { error: t.slice(0, 200) } };
  }
}

export async function getText(url, { browser = false, headers = {} } = {}) {
  const r = await fetch(url, { headers: { "User-Agent": browser ? BROWSER_UA : UA, "Accept-Language": "en", ...headers }, redirect: "follow" });
  return { status: r.status, url: r.url, text: await r.text() };
}
export async function getJson(url, opts) {
  const r = await getText(url, opts);
  try {
    return JSON.parse(r.text);
  } catch {
    return null;
  }
}

export function meta(html, prop) {
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const v = (html.match(a) || html.match(b))?.[1];
  return v?.replace(/&amp;/g, "&").replace(/&#0?39;|&#x27;/g, "'").replace(/&quot;/g, '"');
}

export const yearOf = (s) => {
  const m = String(s || "").match(/\b(1[89]\d\d|20[0-3]\d)\b/);
  return m ? Number(m[1]) : undefined;
};
export const mmss = (s) => {
  const m = String(s || "").match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
};
export const stripTags = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Deezer (public, no key): runtime, album, artwork, release date for a title/artist. */
export async function deezerLookup(artist, title) {
  const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
  const j = await getJson(`https://api.deezer.com/search?q=${q}&limit=5`);
  const hit = (j?.data || [])[0];
  if (!hit) return null;
  const alb = await getJson(`https://api.deezer.com/album/${hit.album.id}`);
  return { durationSec: hit.duration, album: hit.album.title, artwork: hit.album.cover_xl, releaseDate: alb?.release_date, isrc: hit.isrc };
}

/** Post one batch (dry run unless commit=true). Splits into calls of 100. */
export async function submit(provider, items, { commit = false, batchId } = {}) {
  const id = batchId || `${provider}-${new Date().toISOString().slice(0, 10)}`;
  const totals = {};
  for (let i = 0; i < items.length; i += 100) {
    const part = items.slice(i, i + 100);
    const r = await meloa("/api/admin/import", { method: "POST", body: JSON.stringify({ batchId: `${id}-${commit ? "commit" : "dry"}-${i / 100}`, provider, dryRun: !commit, items: part }) });
    if (r.status !== 200) throw new Error(`Import API ${r.status}: ${r.json.error}`);
    for (const [k, v] of Object.entries(r.json.summary)) totals[k] = (totals[k] || 0) + v;
  }
  return { batch: id, commit, ...totals };
}
