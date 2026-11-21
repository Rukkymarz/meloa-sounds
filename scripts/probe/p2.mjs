// node p2.mjs <url> <regex> [max] — prints unique regex matches (compact)
const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", "Accept-Language": "en" };
const [url, re, max = "10"] = process.argv.slice(2);
const r = await fetch(url, { headers: H, redirect: "follow" });
const t = await r.text();
const out = new Set();
for (const m of t.matchAll(new RegExp(re, "gi"))) { out.add((m[1] ?? m[0]).replace(/\s+/g, " ").slice(0, 220)); if (out.size >= +max) break; }
console.log(`[${r.status} ${t.length}] ${r.url.slice(0, 90)}\n` + [...out].join("\n"));
