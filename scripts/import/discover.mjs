// Find public track links on listing pages (rendered in a real browser) → /tmp/urls-<provider>.txt
//   node scripts/import/discover.mjs <provider> [max]
import fs from "node:fs";
import { chromium } from "playwright";
import { BROWSER_UA } from "./lib.mjs";
const [provider, maxS = "40"] = process.argv.slice(2);
const max = Number(maxS);
const SPEC = {
  hearthis: { pages: ["funk", "soul", "hiphop", "rnb", "reggae", "afrobeat", "jazz", "rock", "pop", "gospel", "house", "disco"].map((c) => `https://hearthis.at/categories/${c}/`), re: /^https:\/\/hearthis\.at\/[^/]+\/[^/]+\/$/ , skip: /\/(categories|set|sets|playlist|groups|charts|about|upload|login|signup|search|search_)\//i },
  ampwall: { pages: ["https://ampwall.com/", "https://ampwall.com/explore", "https://ampwall.com/discover"], re: /^https:\/\/ampwall\.com\/a\/[^/]+\/album\/[^/]+$/ },
  reverbnation: { pages: ["https://www.reverbnation.com/main/charts", "https://www.reverbnation.com/main/charts/hip_hop", "https://www.reverbnation.com/main/charts/r_b", "https://www.reverbnation.com/main/charts/rock", "https://www.reverbnation.com/main/charts/pop", "https://www.reverbnation.com/main/charts/gospel", "https://www.reverbnation.com/main/charts/jazz", "https://www.reverbnation.com/main/charts/reggae"], re: /^https:\/\/www\.reverbnation\.com\/[^/]+\/song\/\d+[^/]*$/ },
  soundcloud: { pages: ["https://soundcloud.com/charts/top", "https://soundcloud.com/discover/sets/charts-top:all-music", "https://soundcloud.com/discover/sets/charts-trending:all-music"], re: /^https:\/\/soundcloud\.com\/[^/]+\/[^/?]+$/, skip: /\/(sets|discover|charts|you|upload|pages|search|stations|tags|popular|people)\b/i },
}[provider];
if (!SPEC) throw new Error("provider?");
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ userAgent: BROWSER_UA });
const found = new Set();
for (const u of SPEC.pages) {
  try {
    await p.goto(u, { waitUntil: "domcontentloaded", timeout: 40000 });
    await p.waitForTimeout(4000);
    for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, 4000); await p.waitForTimeout(1200); }
    const links = await p.$$eval("a[href]", (as) => as.map((a) => a.href.split("#")[0].split("?")[0]));
    let n = 0;
    for (const l of links) if (SPEC.re.test(l) && !(SPEC.skip && SPEC.skip.test(l)) && !found.has(l)) { found.add(l); n++; }
    console.error(`${u} → ${n}`);
  } catch (e) { console.error(`${u} ✗ ${e.message.slice(0, 80)}`); }
  if (found.size >= max) break;
}
// Ampwall: expand albums into their track pages.
if (provider === "ampwall") {
  const tracks = new Set();
  for (const album of [...found].slice(0, Math.ceil(max / 4))) {
    try {
      await p.goto(album, { waitUntil: "domcontentloaded", timeout: 40000 });
      await p.waitForTimeout(2500);
      const links = await p.$$eval("a[href]", (as) => as.map((a) => a.href.split("?")[0]));
      links.filter((l) => /\/a\/[^/]+\/track\/[^/]+$/.test(l)).forEach((l) => tracks.add(l));
    } catch {}
    if (tracks.size >= max) break;
  }
  console.error(`ampwall: ${found.size} albums → ${tracks.size} tracks`);
  found.clear();
  tracks.forEach((t) => found.add(t));
}
await b.close();
const list = [...found].slice(0, max);
fs.writeFileSync(`/tmp/urls-${provider}.txt`, list.join("\n"));
console.log(`${provider}: ${list.length} links`);
console.log(list.slice(0, 4).join("\n"));
