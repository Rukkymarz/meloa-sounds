"use client";

import { useEffect, useState } from "react";

// Simple review screen. Token stays in this tab only (sessionStorage).
export default function Admin() {
  const [token, setToken] = useState("");
  useEffect(() => {
    try {
      setToken(sessionStorage.getItem("meloa-admin") || "");
    } catch {}
  }, []);
  const [data, setData] = useState<{ submissions: any[]; takedowns: any[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setMsg(null);
    try {
      sessionStorage.setItem("meloa-admin", token);
    } catch {}
    const r = await fetch("/api/admin/submissions", { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error);
    setData(j);
  }

  async function act(id: string, action: string) {
    const r = await fetch("/api/admin/submissions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const j = await r.json();
    setMsg(r.ok ? `${action} done` : j.error);
    load();
  }

  return (
    <>
      <h1>Review</h1>
      <div className="search">
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token" aria-label="Admin token" />
        <button className="btn" onClick={load}>Load</button>
      </div>
      {msg && <p className="hint">{msg}</p>}
      {data && (
        <>
          <h3>Pending uploads ({data.submissions.length})</h3>
          {data.submissions.map((s) => (
            <div className="card" key={s.id}>
              <strong>{s.track_title}</strong> — {s.artist_name} <span className="muted">({s.genre || "no genre"}, {s.country || "?"})</span>
              <p className="muted">{s.email} · terms {s.terms_version} · {new Date(s.created_at).toLocaleString()}</p>
              {s.listen_url && <audio controls src={s.listen_url} style={{ width: "100%" }} />}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={() => act(s.id, "approve")}>Approve</button>
                <button className="chip" onClick={() => act(s.id, "reject")}>Reject</button>
              </div>
            </div>
          ))}
          <h3>Open copyright requests ({data.takedowns.length})</h3>
          {data.takedowns.map((t) => (
            <div className="card" key={t.id}>
              <strong>{t.claimant}</strong> <span className="muted">{t.email}</span>
              <p>{t.content_url}</p>
              <p className="muted">{t.details}</p>
            </div>
          ))}
        </>
      )}
    </>
  );
}
