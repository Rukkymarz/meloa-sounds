"use client";

import { useState } from "react";

export function TakedownForm() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    try {
      const r = await fetch("/api/takedown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimant: f.get("claimant"),
          email: f.get("email"),
          contentUrl: f.get("contentUrl"),
          details: f.get("details"),
          goodFaith: f.get("goodFaith") === "on",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg("Received. We'll review it within 48 hours.");
      form.reset();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form card" onSubmit={onSubmit}>
      <label>
        Your name / organisation
        <input name="claimant" required />
      </label>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Link to the content on this site (or song title and artist)
        <input name="contentUrl" required />
      </label>
      <label>
        What work do you own, and how is it infringed?
        <textarea name="details" rows={4} required />
      </label>
      <label className="check">
        <input type="checkbox" name="goodFaith" required />
        I believe in good faith that this use is not authorised by the copyright owner, its agent or the law, and the information above is accurate.
      </label>
      <button className="btn" disabled={busy}>Send request</button>
      {msg && <p className="hint">{msg}</p>}
    </form>
  );
}
