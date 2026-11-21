// node render.mjs <url> <linkRegex> [max] — render in Chrome, print matching hrefs, iframes, media
import { chromium } from "playwright";
const [url, re = ".", max = "15"] = process.argv.slice(2);
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36" });
const media = new Set();
p.on("response", (r) => { const ct = r.headers()["content-type"] || ""; if (/audio|mpegurl|video\/mp4/.test(ct) || /\.(mp3|m4a|ogg|m3u8)(\?|$)/.test(r.url())) media.add(ct + " " + r.url().slice(0, 140)); });
let st = 0;
try { const resp = await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); st = resp?.status(); await p.waitForTimeout(4000); } catch (e) { console.log("ERR", e.message.slice(0, 120)); }
const links = await p.$$eval("a[href]", (as) => as.map((a) => a.href));
const frames = await p.$$eval("iframe", (fs) => fs.map((f) => f.src));
const rx = new RegExp(re, "i");
console.log(`[${st}] ${p.url().slice(0, 100)} title=${(await p.title()).slice(0, 80)}`);
console.log("LINKS\n" + [...new Set(links.filter((l) => rx.test(l)))].slice(0, +max).join("\n"));
const metas = await p.$$eval("meta[property],meta[name],link[type*=oembed]", (ms) => ms.map((m) => (m.getAttribute("property") || m.getAttribute("name") || m.getAttribute("type")) + "=" + (m.getAttribute("content") || m.getAttribute("href"))).filter((x) => /player|video|audio|oembed|duration|release|music:/i.test(x)));
console.log("META " + metas.slice(0, 12).join(" | "));
const html = await p.content();
const emb = [...new Set([...html.matchAll(/[^"'\s<>]*embed[^"'\s<>]*/gi)].map((m) => m[0]))].filter((x) => x.length > 12).slice(0, 8);
console.log("EMBEDSTR " + emb.join(" | "));
console.log("IFRAMES " + frames.slice(0, 5).join(" | "));
console.log("MEDIA " + [...media].slice(0, 5).join(" | "));
await b.close();
