"use client";

import Link from "next/link";
import { usePlayer } from "@/components/PlayerProvider";
import { SongList, Shelf } from "@/components/Shelves";
import { AppearancePicker } from "@/components/Appearance";
import { useEffect, useState } from "react";
import { myPlaylists, newPlaylist, type MyPlaylist } from "@/lib/myPlaylists";

export default function LibraryPage() {
  const { saved, history, storageOk } = usePlayer();

  return (
    <>
      <header className="page-head">
        <h1 className="h-large">Library</h1>
      </header>

      {!storageOk && (
        <div className="empty" role="status">
          <h3>Saving is off in this browser</h3>
          <p>This browser is blocking storage (often Private Browsing). Songs you save won&apos;t be kept after you close it.</p>
        </div>
      )}

      {saved.length ? (
        <SongList title="Saved songs" tracks={saved} />
      ) : (
        <div className="empty">
          <h3>No saved songs yet</h3>
          <p>Tap the heart on any song in Now Playing to keep it here. Saved songs stay on this device.</p>
          <Link href="/new" className="btn btn-plum">Browse new music</Link>
        </div>
      )}

      <div style={{ height: 24 }} />
      <Shelf title="Recently played" tracks={history.slice(0, 20)} />

      <Playlists />

      <div style={{ height: 24 }} />
      <AppearancePicker />
    </>
  );
}

function Playlists() {
  const [lists, setLists] = useState<MyPlaylist[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setLists(myPlaylists()), []);
  async function create() {
    setBusy(true);
    try {
      const { id } = await newPlaylist("My playlist");
      location.href = `/p/${id}`;
    } catch {
      setBusy(false);
    }
  }
  return (
    <section className="shelf" aria-label="Playlists">
      <h2 className="h-section">Playlists</h2>
      <p className="muted small">No account needed. Share a link to listen, or a link to build it together.</p>
      <div className="chips">
        <button className="chip on" onClick={create} disabled={busy}>{busy ? "Creating…" : "New playlist"}</button>
        {lists.map((p) => (
          <Link key={p.id} href={`/p/${p.id}`} className="chip">{p.name}</Link>
        ))}
      </div>
    </section>
  );
}
