// compact multi-purpose probe: node q.mjs <mode> <args...>
const H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36" };
const [mode, ...a] = process.argv.slice(2);
const get = async (u) => { const r = await fetch(u, { headers: H }); return { s: r.status, t: await r.text(), ct: r.headers.get("content-type") }; };
if (mode === "dmusers") {
  for (const q of a) {
    const r = JSON.parse((await get(`https://api.dailymotion.com/users?search=${encodeURIComponent(q)}&fields=username,screenname,verified,videos_total,partner&limit=8`)).t);
    console.log("#" + q, (r.list || []).map((u) => `${u.username}|${u.screenname}|v${+u.verified}|p${+u.partner}|${u.videos_total}`).join("  ;  "));
  }
}
if (mode === "dmvids") { // owner username, optional search
  const [owner, q] = a;
  const r = JSON.parse((await get(`https://api.dailymotion.com/user/${owner}/videos?fields=id,title,duration,allow_embed,channel&limit=30${q ? "&search=" + encodeURIComponent(q) : ""}&sort=relevance`)).t);
  console.log((r.list || []).map((v) => `${v.id}|${v.duration}|e${+v.allow_embed}|${v.title.slice(0, 70)}`).join("\n") || JSON.stringify(r).slice(0, 300));
}
if (mode === "grep") { // url regex
  const r = await get(a[0]);
  console.log("status", r.s, r.ct, r.t.length);
  const re = new RegExp(a[1] || "iframe|embed|player", "gi");
  const seen = new Set();
  for (const m of r.t.matchAll(new RegExp(".{0,90}(?:" + (a[1] || "iframe|embed") + ").{0,140}", "gi"))) { const s = m[0].replace(/\s+/g, " "); if (!seen.has(s)) { seen.add(s); console.log("…" + s); } if (seen.size > Number(a[2] || 12)) break; }
}
if (mode === "head") { for (const u of a) { const r = await fetch(u, { headers: H, redirect: "follow" }); console.log(r.status, r.headers.get("content-type"), r.headers.get("content-length"), r.url.slice(0, 120)); } }
if (mode === "json") { const r = await get(a[0]); console.log(r.s, r.t.slice(0, Number(a[1] || 1500))); }
