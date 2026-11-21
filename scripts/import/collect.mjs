// Catalog collectors. Each provider turns its public catalog (or a curated link list)
// into ImportItems for /api/admin/import. Nothing is listener-visible until verify.mjs
// confirms the full recording plays in Meloa as a guest.
//
//   node scripts/import/collect.mjs <provider> [--commit] [--limit 20] [--urls file.txt]
//   providers: wikimedia fma youtube-classics afrocharts soundcloud hearthis ampwall reverbnation dailymotion
import fs from "node:fs";
import { getText, getJson, meta, yearOf, mmss, stripTags, deezerLookup, submit, meloa, sleep, BROWSER_UA } from "./lib.mjs";

const args = process.argv.slice(2);
const provider = args[0];
const commit = args.includes("--commit");
const limit = Number(args[args.indexOf("--limit") + 1] || 0) || 20;
const urlFile = args.includes("--urls") ? args[args.indexOf("--urls") + 1] : null;
const curated = () => (urlFile ? fs.readFileSync(urlFile, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : []);
const log = (...a) => console.error(...a);

// ---------------------------------------------------------------- Wikimedia Commons
// Public MediaWiki API: file licence, author, original date. Uses the MP3 transcode when
// present so iPhones (no Ogg) can play it.
const WIKI_QUERIES = [
  ["jazz", "filetype:audio jazz 78rpm recording"],
  ["jazz", "filetype:audio ragtime recording"],
  ["blues", "filetype:audio blues 78rpm"],
  ["gospel", "filetype:audio spiritual jubilee singers"],
  ["gospel", "filetype:audio gospel hymn recording 1920s"],
  ["country", "filetype:audio old-time fiddle recording"],
  ["pop", "filetype:audio Edison Records"],
  ["pop", "filetype:audio Victor Records 1910s"],
  ["classical", "filetype:audio Musopen"],
  ["world", "filetype:audio highlife"],
  ["world", "filetype:audio Library of Congress field recording song"],
];
async function wikimedia() {
  const items = [];
  const per = Math.max(3, Math.ceil(limit / WIKI_QUERIES.length));
  for (const [genre, q] of WIKI_QUERIES) {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6" +
      `&gsrsearch=${encodeURIComponent(q)}&gsrlimit=${per * 2}` +
      "&prop=videoinfo&viprop=url|size|mime|mediatype|derivatives|extmetadata" +
      "&viextmetadatafilter=LicenseShortName|LicenseUrl|Artist|DateTimeOriginal|ObjectName|Credit|ImageDescription|AttributionRequired";
    const j = await getJson(url);
    const pages = Object.values(j?.query?.pages || {});
    for (const p of pages) {
      const vi = p.videoinfo?.[0];
      if (!vi || vi.mediatype !== "AUDIO") continue;
      const m = vi.extmetadata || {};
      const dur = Math.round(Number(vi.duration || 0)) || undefined;
      const mp3 = (vi.derivatives || []).find((d) => /audio\/mpeg/.test(d.type))?.src;
      const playUrl = mp3 || (/mpeg|mp3|wav|flac/.test(vi.mime) ? vi.url : vi.url);
      let name = stripTags(m.ObjectName?.value) || p.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "");
      let artist = stripTags(m.Artist?.value).slice(0, 120) || "Unknown artist";
      // "Performer - Title (1908)" file names carry the real performer and recording year.
      const nm = name.match(/^(.{2,80}?)\s+-\s+(.+?)(?:\s*\((\d{4})\))?$/);
      if (nm) {
        artist = nm[1].trim();
        name = nm[2].trim();
      }
      if (dur && dur > 15 * 60) continue; // services, lectures, long sessions
      const lic = stripTags(m.LicenseShortName?.value);
      // Original recording year: the year in the file name/description beats the upload date.
      const fromName = yearOf(p.title) || yearOf(stripTags(m.ImageDescription?.value));
      const fromDate = yearOf(stripTags(m.DateTimeOriginal?.value));
      const year = fromName && (!fromDate || fromName <= fromDate) ? fromName : fromDate;
      items.push({
        source: "wikimedia",
        sourceId: String(p.pageid),
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
        title: name.slice(0, 200),
        artist,
        genre,
        releaseYear: year,
        durationSec: dur,
        kind: "song",
        tier: 1,
        playback: { kind: "audio", url: playUrl },
        license: {
          name: lic,
          // Public-domain files carry no licence URL: point to the PD mark and keep the file page as the record.
          url: m.LicenseUrl?.value || (/public domain|^pd/i.test(lic) ? "https://creativecommons.org/publicdomain/mark/1.0/" : undefined),
          attribution: `${artist}, via Wikimedia Commons (${lic}): https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
        },
        notes: mp3 ? [] : ["No MP3 transcode: may not play on iPhone."],
      });
      if (items.filter((x) => x.genre === genre).length >= per) break;
    }
    await sleep(300);
  }
  return items.slice(0, limit);
}

// ---------------------------------------------------------------- Free Music Archive
// The developer API is discontinued: read the public genre and track pages instead.
const FMA_GENRES = [
  ["rnb", "Soul-RB"], ["hip-hop", "Hip-Hop"], ["rock", "Rock"], ["pop", "Pop"], ["jazz", "Jazz"],
  ["funk", "Funk"], ["blues", "Blues"], ["dancehall-reggae", "Reggae"], ["electronic", "Electronic"], ["folk", "Folk"],
];
async function fma() {
  const items = [];
  const per = Math.max(2, Math.ceil(limit / FMA_GENRES.length));
  for (const [genre, slug] of FMA_GENRES) {
    const page = await getText(`https://freemusicarchive.org/genre/${slug}/`, { browser: true });
    if (page.status !== 200) log(`  FMA ${slug}: ${page.status}`);
    const infos = [...page.text.matchAll(/data-track-info='([^']+)'/g)].map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    }).filter(Boolean);
    let n = 0;
    for (const info of infos) {
      if (n >= per) break;
      const t = await getText(info.url, { browser: true });
      const h = t.text;
      const licUrl = h.match(/href="(https?:\/\/creativecommons\.org\/(?:licenses|publicdomain)\/[^"]+)"/i)?.[1];
      const licName = licUrl ? ccName(licUrl) : stripTags(h.match(/License[^<]*<\/[^>]+>\s*<[^>]+>([^<]{2,60})</i)?.[1]);
      const dur = mmss(h.match(/>\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*</)?.[1]);
      const released = yearOf(stripTags(h.match(/Released[\s\S]{0,200}?((?:19|20)\d\d)/i)?.[1])) || yearOf(h.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1]);
      const album = stripTags(h.match(/Album[\s\S]{0,120}?<a[^>]*>([^<]+)</i)?.[1]) || undefined;
      const art = meta(h, "og:image");
      items.push({
        source: "fma",
        sourceId: String(info.id),
        sourceUrl: info.url,
        title: info.title,
        artist: info.artistName,
        album,
        genre,
        releaseYear: released,
        durationSec: dur,
        artwork: art,
        kind: "song",
        tier: 1,
        playback: { kind: "audio", url: info.playbackUrl },
        license: { name: licName || "", url: licUrl, attribution: `"${info.title}" by ${info.artistName}, Free Music Archive (${licName || "licence on page"})` },
      });
      n++;
      await sleep(400);
    }
  }
  return items.slice(0, limit);
}
function ccName(u) {
  if (/publicdomain\/zero/.test(u)) return "CC0";
  if (/publicdomain\/mark/.test(u)) return "Public Domain";
  const m = u.match(/licenses\/([a-z-]+)\/([0-9.]+)/i);
  return m ? `CC ${m[1].toUpperCase()} ${m[2]}` : "CC";
}

// ---------------------------------------------------------------- recognizable classics via official YouTube uploads
// Editor's list: title, artist, ORIGINAL release year, Meloa genre. Runtime comes from Deezer;
// the player comes from Meloa's existing YouTube matcher (official Topic/VEVO/artist channels).
const CLASSICS = JSON.parse(fs.readFileSync(new URL("./classics.json", import.meta.url), "utf8"));
async function youtubeClassics() {
  const items = [];
  for (const c of CLASSICS.slice(0, limit)) {
    const dz = await deezerLookup(c.artist, c.title).catch(() => null);
    const id = JSON.stringify({ a: c.artist, t: c.title, d: dz?.durationSec || 0 });
    const r = await meloa(`/api/resolve?source=name&id=${encodeURIComponent(id)}`);
    const t = r.json?.track;
    if (!t || t.playback?.kind !== "youtube") {
      log(`  no official YouTube match: ${c.artist} — ${c.title} (${r.status} ${r.json?.error || t?.playback?.kind || ""})`);
      continue;
    }
    items.push({
      source: "youtube",
      sourceId: t.playback.videoId,
      sourceUrl: `https://www.youtube.com/watch?v=${t.playback.videoId}`,
      title: c.title,
      artist: c.artist,
      album: dz?.album,
      genre: c.genre,
      releaseYear: c.year,
      durationSec: dz?.durationSec || t.durationSec,
      artwork: dz?.artwork || t.artwork,
      kind: "song",
      tier: 2,
      playback: { kind: "youtube", videoId: t.playback.videoId, alts: t.playback.alts || [] },
      license: { name: "Played by YouTube (ads by YouTube)", url: `https://www.youtube.com/watch?v=${t.playback.videoId}` },
    });
    await sleep(250);
  }
  return items;
}

// ---------------------------------------------------------------- AfroCharts (discovery only)
// An entry counts only after Meloa finds a supported full-track player for it.
async function afrocharts() {
  const { chromium } = await import("playwright");
  const b = await chromium.launch();
  const p = await b.newPage({ userAgent: BROWSER_UA });
  const entries = [];
  for (const [genre, id] of [["afrobeats", "genreWeeklyTopSongs-afb"], ["amapiano", "genreWeeklyTopSongs-ama"]]) {
    await p.goto(`https://www.afrocharts.com/chart?id=${id}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(5000);
    const rows = await p.$$eval("a[href*='/song/']", (as) =>
      as.map((a) => ({ href: a.href, text: (a.closest("li,tr,div")?.innerText || a.innerText || "").replace(/\s+/g, " ").trim() })),
    );
    const seen = new Set();
    for (const r of rows) {
      if (seen.has(r.href)) continue;
      seen.add(r.href);
      entries.push({ genre, href: r.href, text: r.text });
    }
  }
  await b.close();
  log(`AfroCharts entries: ${entries.length}`);
  const items = [];
  for (const e of entries.slice(0, limit)) {
    // Song pages are /song/<id>/<artist>-<title>; use the page title for clean names.
    const pg = await getText(e.href, { browser: true });
    const t = meta(pg.text, "og:title") || "";
    const [title, artist] = t.split(/\s+by\s+|\s+-\s+/).map((s) => s?.replace(/\s*\|.*$/, "").trim());
    if (!title || !artist) continue;
    const dz = await deezerLookup(artist, title).catch(() => null);
    const id = JSON.stringify({ a: artist, t: title, d: dz?.durationSec || 0 });
    const r = await meloa(`/api/resolve?source=name&id=${encodeURIComponent(id)}`);
    const tr = r.json?.track;
    if (!tr || !["youtube", "embed", "audio"].includes(tr.playback?.kind)) {
      log(`  chart entry without a full player yet: ${artist} — ${title}`);
      continue;
    }
    items.push({
      source: tr.source,
      sourceId: tr.sourceId,
      sourceUrl: tr.pageUrl || tr.license?.url || e.href,
      title,
      artist,
      album: dz?.album,
      genre: e.genre,
      releaseYear: yearOf(dz?.releaseDate),
      durationSec: dz?.durationSec || tr.durationSec,
      artwork: dz?.artwork || tr.artwork,
      kind: "song",
      tier: tr.tier,
      playback: tr.playback,
      license: tr.license,
      notes: [`Found on AfroCharts: ${e.href}`],
    });
    await sleep(250);
  }
  return items;
}

// ---------------------------------------------------------------- SoundCloud (key-free, oEmbed)
// Curated public links → official widget. Live search needs approved API credentials later.
async function soundcloud() {
  const items = [];
  for (const url of curated().slice(0, limit)) {
    const o = await getJson(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!o?.html) {
      log(`  oEmbed refused: ${url}`);
      continue;
    }
    const src = o.html.match(/src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
    const page = await getText(url, { browser: true });
    const dur = Number(page.text.match(/"full_duration":(\d+)/)?.[1] || page.text.match(/"duration":(\d+)/)?.[1] || 0) / 1000 || undefined;
    const year = yearOf(page.text.match(/"release_date":"([^"]+)"/)?.[1]) || yearOf(page.text.match(/"display_date":"([^"]+)"/)?.[1]);
    const genre = (page.text.match(/"genre":"([^"]*)"/)?.[1] || "").toLowerCase();
    const policy = page.text.match(/"policy":"([A-Z]+)"/)?.[1];
    const notes = [];
    if (policy && policy !== "ALLOW") notes.push(`SoundCloud policy ${policy}: may be a 30-second preview for guests.`);
    items.push({
      source: "soundcloud",
      sourceId: new URL(url).pathname,
      sourceUrl: url,
      title: o.title.replace(new RegExp(`\\s+by\\s+${o.author_name}$`), ""),
      artist: o.author_name,
      genre: mapGenre(genre),
      releaseYear: year,
      durationSec: dur ? Math.round(dur) : undefined,
      artwork: o.thumbnail_url,
      kind: /mix|set|podcast/i.test(o.title) ? "mix" : "song",
      tier: 3,
      playback: { kind: "embed", provider: "soundcloud", src: src || `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`, height: 166 },
      license: { name: "Played in SoundCloud's official player", url },
      notes,
    });
    await sleep(400);
  }
  return items;
}

// ---------------------------------------------------------------- embed-card providers (curated links)
// hearthis.at, Ampwall and ReverbNation publish an official player for each public track
// (twitter:player / oEmbed). We read that, plus runtime and date from the page.
async function playerCards(source, host) {
  const items = [];
  for (const url of curated().slice(0, limit)) {
    const pg = await getText(url, { browser: true });
    if (pg.status !== 200) {
      log(`  ${pg.status} ${url}`);
      continue;
    }
    const h = pg.text;
    const player = meta(h, "twitter:player") || meta(h, "og:video:secure_url") || meta(h, "og:video");
    if (!player || !new URL(player, url).hostname.endsWith(host)) {
      log(`  no official player card: ${url}`);
      continue;
    }
    const title = (meta(h, "og:title") || meta(h, "twitter:title") || "").replace(/\s*[|·]\s*(hearthis\.at|Ampwall|ReverbNation).*$/i, "");
    const [t1, a1] = title.split(/\s+by\s+|\s+·\s+|\s+-\s+/);
    const dur = Number(meta(h, "music:duration") || 0) || mmss(h.match(/"duration"\s*:\s*"?(PT[^"]+|\d+)"?/)?.[1]) || isoDur(h.match(/"duration"\s*:\s*"(PT[^"]+)"/)?.[1]);
    const year = yearOf(meta(h, "music:release_date")) || yearOf(h.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1]) || yearOf(h.match(/"(?:release_date|uploadDate)"\s*:\s*"([^"]+)"/)?.[1]);
    const isMix = source === "hearthis" && (/\b(mix|set|podcast|live at|session)\b/i.test(title) || (dur && dur > 20 * 60));
    items.push({
      source,
      sourceId: new URL(url).pathname.replace(/\/$/, ""),
      sourceUrl: url,
      title: (a1 ? t1 : title).trim(),
      artist: (a1 || meta(h, "music:musician") || "").trim() || new URL(url).pathname.split("/").filter(Boolean)[source === "ampwall" ? 1 : 0],
      genre: mapGenre(meta(h, "music:genre") || ""),
      releaseYear: year,
      durationSec: dur || undefined,
      artwork: meta(h, "og:image"),
      kind: isMix ? "mix" : "song",
      tier: 3,
      playback: { kind: "embed", provider: source, src: new URL(player, url).toString(), height: Number(meta(h, "twitter:player:height") || 166) },
      license: { name: `Played in ${source}'s official player`, url },
    });
    await sleep(500);
  }
  return items;
}
function isoDur(s) {
  const m = String(s || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : undefined;
}
function mapGenre(g) {
  g = g.toLowerCase();
  const map = [["afro", "afrobeats"], ["amapiano", "amapiano"], ["hip", "hip-hop"], ["rap", "hip-hop"], ["r&b", "rnb"], ["rnb", "rnb"], ["soul", "rnb"], ["funk", "funk"], ["disco", "funk"], ["reggae", "dancehall-reggae"], ["dancehall", "dancehall-reggae"], ["gospel", "gospel"], ["jazz", "jazz"], ["blues", "blues"], ["rock", "rock"], ["metal", "metal"], ["house", "house"], ["techno", "electronic"], ["electro", "electronic"], ["pop", "pop"], ["folk", "folk"], ["country", "country"], ["latin", "latin"], ["classical", "classical"]];
  return map.find(([k]) => g.includes(k))?.[1] || "world";
}

// ---------------------------------------------------------------- Dailymotion (curated, official channels only)
async function dailymotion() {
  const items = [];
  const player = process.env.DAILYMOTION_PLAYER_ID;
  for (const line of curated().slice(0, limit)) {
    // line: <dailymotion url> | genre | original year
    const [url, genre = "pop", yr] = line.split("|").map((s) => s.trim());
    const id = url.match(/video\/([a-z0-9]+)/i)?.[1];
    if (!id) continue;
    const v = await getJson(`https://api.dailymotion.com/video/${id}?fields=id,title,duration,allow_embed,private,owner.username,owner.screenname,thumbnail_720_url,created_time`);
    if (!v?.id || !v.allow_embed || v.private) {
      log(`  not embeddable/public: ${url}`);
      continue;
    }
    const [artist, title] = v.title.split(/\s+[-–]\s+/);
    const edit = v.title.match(/\((extended|remix|radio edit|live[^)]*|12"[^)]*|single version|album version)[^)]*\)/i)?.[0]?.replace(/[()]/g, "");
    items.push({
      source: "dailymotion",
      sourceId: id,
      sourceUrl: `https://www.dailymotion.com/video/${id}`,
      title: (title || v.title).replace(/\((official|clip|video)[^)]*\)/gi, "").trim(),
      artist: (title ? artist : v["owner.screenname"]).trim(),
      genre,
      releaseYear: Number(yr) || undefined,
      durationSec: v.duration,
      artwork: v.thumbnail_720_url,
      editLabel: edit,
      kind: "song",
      tier: 2,
      playback: {
        kind: "embed",
        provider: "dailymotion",
        src: player ? `https://geo.dailymotion.com/player/${player}.html?video=${id}` : `https://www.dailymotion.com/embed/video/${id}`,
        height: 260,
      },
      license: { name: "Played in Dailymotion's official player", url: `https://www.dailymotion.com/video/${id}` },
      notes: [`owner:${v["owner.username"]}`],
    });
  }
  return items;
}

// ----------------------------------------------------------------
const run = {
  wikimedia,
  fma,
  "youtube-classics": youtubeClassics,
  afrocharts,
  soundcloud,
  hearthis: () => playerCards("hearthis", "hearthis.at"),
  ampwall: () => playerCards("ampwall", "ampwall.com"),
  reverbnation: () => playerCards("reverbnation", "reverbnation.com"),
  dailymotion,
}[provider];
if (!run) {
  log("Unknown provider. Use: " + "wikimedia fma youtube-classics afrocharts soundcloud hearthis ampwall reverbnation dailymotion");
  process.exit(1);
}
const items = await run();
fs.writeFileSync(`/tmp/items-${provider}.json`, JSON.stringify(items, null, 1));
log(`${provider}: collected ${items.length} item(s) → /tmp/items-${provider}.json`);
if (!items.length) process.exit(0);
const res = await submit(provider, items, { commit });
console.log(JSON.stringify(res));
