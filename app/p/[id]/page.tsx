"use client";

import { use, useEffect, useState } from "react";
import { SongList } from "@/components/Shelves";
import { usePlayer } from "@/components/PlayerProvider";
import { rememberPlaylist, forgetPlaylist, myPlaylists, shareUrl } from "@/lib/myPlaylists";
import type { Track } from "@/lib/types";

export default function PlaylistPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> }) {
  const { id } = use(params);
  const { k } = use(searchParams);
  const { playList } = usePlayer();
  const [pl, setPl] = useState<{ name: string; tracks: Track[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | undefined>();

  useEffect(() => {
    fetch(`/api/playlists/${id}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setErr(j.error);
      setPl(j);
      const key = k || myPlaylists().find((p) => p.id === id)?.editKey;
      setEditKey(key);
      rememberPlaylist({ id, name: j.name, editKey: key });
    });
  }, [id, k]);

  async function save(tracks: Track[]) {
    if (!editKey || !pl) return;
    setPl({ ...pl, tracks });
    await fetch(`/api/playlists/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editKey, tracks }) });
  }
  async function share(edit: boolean) {
    const url = shareUrl(id, edit ? editKey : undefined);
    try {
      if (navigator.share) await navigator.share({ title: pl?.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Link copied.");
      }
    } catch {}
  }

  if (err) return <div className="empty"><h3>Playlist not found</h3><p>{err}</p></div>;
  if (!pl) return <p className="hint">Loading…</p>;
  const shuffle = () => playList([...pl.tracks].sort(() => Math.random() - 0.5), 0);

  return (
    <>
      <header className="page-head">
        <h1 className="h-large">{pl.name}</h1>
        <p className="muted">{pl.tracks.length} song{pl.tracks.length === 1 ? "" : "s"} · no account needed</p>
      </header>
      <div className="album-actions" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => playList(pl.tracks, 0)} disabled={!pl.tracks.length}>Play</button>
        <button className="btn" onClick={shuffle} disabled={!pl.tracks.length}>Shuffle</button>
      </div>
      <div className="chips">
        <button className="chip" onClick={() => share(false)}>Share to listen</button>
        {editKey && <button className="chip" onClick={() => share(true)}>Share to edit together</button>}
        <button className="chip" onClick={() => { forgetPlaylist(id); setNote("Removed from your Library on this device."); }}>Remove from Library</button>
      </div>
      {note && <p className="hint" role="status">{note}</p>}
      {pl.tracks.length === 0 && <div className="empty"><h3>No songs yet</h3><p>Open Now Playing and tap “Add to playlist”.</p></div>}
      <SongList tracks={pl.tracks} numbered />
      {editKey && pl.tracks.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary className="muted">Edit songs</summary>
          {pl.tracks.map((t, i) => (
            <div key={t.id + i} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>{t.title} <span className="muted">— {t.artist}</span></span>
              <button className="chip" onClick={() => save(pl.tracks.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
