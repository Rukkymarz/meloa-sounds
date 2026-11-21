// Guest playback check with Playwright. For each pending player:
//   1. open Meloa's /verify page (no sign-in, Meloa's own domain)
//   2. start playback in the page or inside the official player's frame
//   3. compare the player's runtime with the editor's expected runtime
//   4. seek near the end and confirm the recording reaches the end
// Only players that pass become "verified" (searchable); the rest are "rejected" with a reason.
//
//   node scripts/import/verify.mjs [--source fma] [--limit 20] [--device chrome|iphone] [--no-save]
import fs from "node:fs";
import { chromium, webkit, devices } from "playwright";
import { BASE, meloa, sleep } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const source = opt("--source");
const limit = Number(opt("--limit", 20));
const device = opt("--device", "chrome");
const save = !args.includes("--no-save");
const ids = opt("--ids", "");

const MEDIA_HOOK = `(() => {
  const reg = (m) => { try { (window.__meloaMedia ||= new Set()).add(m); } catch {} };
  const op = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { reg(this); return op.apply(this, arguments); };
  const scan = () => document.querySelectorAll("audio,video").forEach(reg);
  try { new MutationObserver(scan).observe(document, { childList: true, subtree: true }); } catch {}
  document.addEventListener("DOMContentLoaded", scan);
})();`;

// Best media element in a frame: the longest one that has a duration.
const PROBE = `(() => {
  const all = [...(window.__meloaMedia || []), ...document.querySelectorAll("audio,video")];
  let best = null;
  for (const m of all) { const d = Number.isFinite(m.duration) ? m.duration : 0; if (!best || d > best.d) best = { m, d }; }
  if (!best) return null;
  const m = best.m; window.__meloaBest = m;
  return { duration: Number.isFinite(m.duration) ? m.duration : 0, t: m.currentTime, paused: m.paused, ended: m.ended, src: String(m.currentSrc || m.src || "").slice(0, 160), muted: m.muted };
})()`;

async function probeAll(page) {
  const out = [];
  for (const f of page.frames()) {
    try {
      const r = await f.evaluate(PROBE);
      if (r) out.push({ f, ...r });
    } catch {}
  }
  out.sort((a, b) => b.duration - a.duration);
  return out[0] || null;
}

async function clickPlay(page) {
  // Try the official player's own play button, then the middle of the frame.
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    for (const sel of [".ytp-large-play-button", "button[aria-label*='Play' i]", "[data-testid*='play' i]", "button[class*='play' i]", ".playButton", ".play", "[class*='PlayButton']"]) {
      try {
        const el = await f.$(sel);
        if (el && (await el.isVisible())) {
          await el.click({ timeout: 2000 });
          return `clicked ${sel}`;
        }
      } catch {}
    }
  }
  const fr = await page.$("#meloa-embed");
  if (fr) {
    const b = await fr.boundingBox();
    if (b) {
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      return "clicked frame centre";
    }
  }
  return "no play control found";
}

async function checkOne(ctx, row) {
  const steps = [];
  const expected = row.expected_sec || null;
  const page = await ctx.newPage();
  const res = { id: row.id, ok: false, measuredSec: undefined, report: { steps, device, expected, at: new Date().toISOString() } };
  try {
    const url = `${BASE}/verify?id=${row.id}&k=${encodeURIComponent(process.env.IMPORT_TOKEN)}`;
    const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    steps.push(`page ${r?.status()}`);
    if (!r || r.status() !== 200) throw new Error("verify page not available");
    await page.waitForTimeout(3000);

    // 1. start playback
    if (row.playback.kind === "audio") {
      await page.evaluate(() => document.querySelector("#meloa-media")?.play().catch(() => {}));
      steps.push("audio.play()");
    }
    let m = null;
    for (let i = 0; i < 12; i++) {
      m = await probeAll(page);
      if (m && m.duration > 0 && !m.paused && m.t > 0.3) break;
      if (i === 1 || i === 5) steps.push(await clickPlay(page));
      if (m && m.paused) await m.f.evaluate(() => window.__meloaBest?.play().catch(() => {})).catch(() => {});
      await sleep(1500);
    }
    if (!m || !(m.duration > 0)) throw new Error("no playable media found in the player");
    steps.push(`playing: duration ${m.duration.toFixed(1)}s`);

    // 2. runtime check (wait out a possible pre-roll ad)
    const tol = (e) => Math.max(8, e * 0.05);
    let tries = 0;
    while (expected && Math.abs(m.duration - expected) > tol(expected) && tries < 12) {
      if (tries === 0) steps.push(`duration ${m.duration.toFixed(0)}s ≠ expected ${expected}s, waiting (ad?)`);
      await sleep(5000);
      m = (await probeAll(page)) || m;
      tries++;
    }
    res.measuredSec = Math.round(m.duration);
    if (m.duration < 60) throw new Error(`only ${m.duration.toFixed(0)}s: preview or clip`);
    if (expected && Math.abs(m.duration - expected) > tol(expected)) throw new Error(`runtime ${m.duration.toFixed(0)}s doesn't match expected ${expected}s`);
    steps.push(expected ? "runtime matches" : "no expected runtime: measured only");

    // 3. seek near the end and confirm it reaches the end
    const target = Math.max(0, m.duration - 8);
    await m.f.evaluate((t) => { const x = window.__meloaBest; x.currentTime = t; return x.play().catch(() => {}); }, target);
    steps.push(`seek to ${target.toFixed(0)}s`);
    let end = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      end = await m.f.evaluate(() => { const x = window.__meloaBest; return x ? { t: x.currentTime, d: x.duration, ended: x.ended } : null; }).catch(() => null);
      if (end && (end.ended || end.t >= end.d - 0.75)) break;
    }
    if (!end) throw new Error("player disappeared after seeking");
    if (end.t < target - 2) throw new Error(`seek refused (stuck at ${end.t.toFixed(0)}s): likely a capped preview`);
    if (!(end.ended || end.t >= end.d - 0.75)) throw new Error(`did not reach the end (at ${end.t.toFixed(0)}/${end.d.toFixed(0)}s)`);
    steps.push(`reached end at ${end.t.toFixed(1)}s`);
    res.ok = true;
  } catch (e) {
    res.report.error = e.message;
  } finally {
    await page.close().catch(() => {});
  }
  return res;
}

const q = new URLSearchParams({ pending: "1", limit: String(limit) });
if (source) q.set("source", source);
let rows = (await meloa(`/api/admin/import?${q}`)).json.pending || [];
if (ids) rows = rows.filter((r) => ids.split(",").includes(r.id));
console.error(`checking ${rows.length} player(s) on ${BASE} as ${device}`);

const browser = device === "iphone" ? await webkit.launch() : await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext(device === "iphone" ? { ...devices["iPhone 15"] } : { viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(MEDIA_HOOK);
// Bypass Vercel deployment protection for the preview by cookie (header would leak to third-party players).
if (process.env.VERCEL_BYPASS) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/offline?x-vercel-protection-bypass=${process.env.VERCEL_BYPASS}&x-vercel-set-bypass-cookie=samesitenone`, { waitUntil: "domcontentloaded" });
  await p.close();
}

const results = [];
for (const row of rows) {
  const r = await checkOne(ctx, row);
  results.push(r);
  const t = row.tracks || {};
  console.log(`${r.ok ? "PASS" : "FAIL"} | ${row.source} | ${t.artist} — ${t.title} | exp ${row.expected_sec ?? "?"}s got ${r.measuredSec ?? "?"}s | ${r.ok ? r.report.steps.at(-1) : r.report.error}`);
}
await browser.close();
fs.writeFileSync(`/tmp/verify-${source || "all"}-${device}.json`, JSON.stringify(results, null, 1));
if (save && device === "chrome" && results.length) {
  const s = await meloa("/api/admin/import", { method: "POST", body: JSON.stringify({ verify: results }) });
  console.error("saved", s.status, JSON.stringify(s.json));
}
console.error(`passed ${results.filter((r) => r.ok).length}/${results.length}`);
