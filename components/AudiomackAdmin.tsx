"use client";

import { useEffect, useState, type FormEvent } from "react";

interface Release {
  id: string;
  url: string;
  type: string;
  title: string | null;
  artist: string | null;
  country: string | null;
  genres: string[];
  embed_ok: boolean | null;
  check_note: string | null;
  embed_checked_at: string | null;
  active: boolean;
}

// Save official Audiomack song, album and playlist links into Meloa's catalog.
export function AudiomackAdmin({ token }: { token: string }) {
  const [list, setList] = useState<Release[] | null>(null);
  const [live, setLive] = useState(false);
  const [url, setUrl] = useState("");
  const [country, setCountry] = useState("NG");
  const [genres, setGenres] = useState("afrobeats");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function load() {
    const r = await fetch("/api/admin/audiomack", { headers });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error);
    setList(j.releases);
    setLive(j.liveSearch);
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/audiomack", { method: "POST", headers, body: JSON.stringify({ url, country, genres }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg(j.error);
    setMsg(j.release.embed_ok ? `Saved “${j.release.title}”. It plays in Meloa.` : `Saved “${j.release.title}”. Its player didn't load, so listeners get “Open in Audiomack”. ${j.release.check_note || ""}`);
    setUrl("");
    load();
  }

  async function act(id: string, action: string) {
    await fetch("/api/admin/audiomack", { method: "POST", headers, body: JSON.stringify({ id, action }) });
    load();
  }

  return (
    <section style={{ marginTop: 28 }}>
      <h3>Audiomack releases</h3>
      <p className="hint">
        Live Audiomack search is <strong>{live ? "on" : "off"}</strong>
        {live ? "." : " (add AUDIOMACK_CONSUMER_KEY and AUDIOMACK_CONSUMER_SECRET in Vercel to turn it on). Saved releases work either way."}
      </p>
      <form className="form" onSubmit={add}>
        <label>
          Official Audiomack link
          <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://audiomack.com/artist/song/title" />
        </label>
        <div className="select-row">
          <label>
            Country (2 letters)
            <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} />
          </label>
          <label>
            Genres (comma separated)
            <input value={genres} onChange={(e) => setGenres(e.target.value)} />
          </label>
        </div>
        <button className="btn-submit" disabled={busy}>{busy ? "Checking the player…" : "Save release"}</button>
      </form>
      {msg && <p className="hint" role="status">{msg}</p>}
      {list?.map((r) => (
        <div className="card" key={r.id} style={{ opacity: r.active ? 1 : 0.6 }}>
          <strong>{r.title}</strong> — {r.artist} <span className="muted">({r.type}{r.country ? `, ${r.country}` : ""})</span>
          <p className="muted" style={{ margin: "6px 0" }}>
            {r.embed_ok === true ? "Plays in Meloa" : r.embed_ok === false ? "Opens in Audiomack" : "Not checked yet"}
            {r.check_note ? ` · ${r.check_note}` : ""}
          </p>
          <a href={r.url} target="_blank" rel="noreferrer" className="small">{r.url}</a>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="chip" onClick={() => act(r.id, "recheck")}>Check player again</button>
            <button className="chip" onClick={() => act(r.id, r.active ? "hide" : "show")}>{r.active ? "Hide" : "Show"}</button>
            <button className="chip" onClick={() => act(r.id, "remove")}>Remove</button>
          </div>
        </div>
      ))}
    </section>
  );
}
