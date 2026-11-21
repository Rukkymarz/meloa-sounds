"use client";

import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";
import { ARTIST_TERMS } from "@/lib/terms";
import { GENRES } from "@/lib/genres";

export default function SubmitPage() {
  const [audio, setAudio] = useState<File | null>(null);
  const [art, setArt] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (!audio) return;
    setState("sending");
    setMsg("Preparing upload…");
    try {
      const r = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistName: f.get("artistName"),
          email: f.get("email"),
          trackTitle: f.get("trackTitle"),
          genre: f.get("genre"),
          country: f.get("country"),
          audioFile: audio.name,
          audioSizeMb: audio.size / 1048576,
          artworkFile: art?.name || "",
          rightsConfirmed: f.get("rights") === "on",
          agreeTerms: f.get("terms") === "on",
          allowDownload: f.get("downloads") === "on",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const sb = supabaseBrowser();
      if (!sb) throw new Error("Uploads are not configured yet.");
      setMsg("Uploading audio…");
      const up = await sb.storage.from("submissions").uploadToSignedUrl(j.audio.path, j.audio.token, audio);
      if (up.error) throw new Error(up.error.message);
      if (art && j.artwork) {
        setMsg("Uploading artwork…");
        await sb.storage.from("submissions").uploadToSignedUrl(j.artwork.path, j.artwork.token, art);
      }
      setState("done");
      setMsg("Received. We'll review it and email you when it's live.");
      form.reset();
      setAudio(null);
      setArt(null);
    } catch (err: any) {
      setState("error");
      setMsg(err.message || "Upload failed.");
    }
  }

  return (
    <>
      <h1 className="h-large" style={{ margin: "16px 0 12px" }}>Upload your music</h1>
      <p className="muted prose">
        Independent artists can add their own songs to Meloa for free streaming. Every upload is reviewed before it
        goes live. You keep all rights and can remove your track any time.
      </p>
      <form className="form card" onSubmit={onSubmit}>
        <label>
          Artist name
          <input name="artistName" required maxLength={120} />
        </label>
        <label>
          Email (for review updates — never shown publicly)
          <input name="email" type="email" required maxLength={200} />
        </label>
        <label>
          Track title
          <input name="trackTitle" required maxLength={120} />
        </label>
        <label>
          Genre
          <select name="genre" defaultValue="afrobeats">
            {GENRES.map((g) => (
              <option key={g.slug} value={g.slug}>{g.name}</option>
            ))}
          </select>
        </label>
        <label>
          Country code (e.g. NG, GH, US)
          <input name="country" maxLength={2} pattern="[A-Za-z]{2}" />
        </label>
        <label>
          Audio file (MP3, M4A, WAV, FLAC · max 50 MB · full song)
          <input type="file" accept=".mp3,.m4a,.aac,.wav,.flac,.ogg,audio/*" required onChange={(e) => setAudio(e.target.files?.[0] || null)} />
        </label>
        <label>
          Artwork (optional · square JPG/PNG)
          <input type="file" accept=".jpg,.jpeg,.png,.webp,image/*" onChange={(e) => setArt(e.target.files?.[0] || null)} />
        </label>

        <div className="card" style={{ background: "var(--surface-2)", margin: 0 }}>
          <strong>Artist streaming licence (summary)</strong>
          <ol className="prose" style={{ fontSize: 14 }}>
            {ARTIST_TERMS.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
          <Link href="/legal#artists">Read the full terms</Link>
        </div>

        <label className="check">
          <input type="checkbox" name="rights" required />
          I own or control all rights to this recording and song (including any samples, beats and features), or I have written permission.
        </label>
        <label className="check">
          <input type="checkbox" name="terms" required />
          I agree to the Meloa artist streaming licence above.
        </label>
        <label className="check">
          <input type="checkbox" name="downloads" />
          Also let listeners download this track (optional).
        </label>

        <button className="btn-submit" disabled={state === "sending" || !audio}>
          {state === "sending" ? "Uploading…" : "Submit for review"}
        </button>
        {msg && <p className={state === "done" ? "ok" : "hint"}>{msg}</p>}
      </form>
    </>
  );
}
