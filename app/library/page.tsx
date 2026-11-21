"use client";

import Link from "next/link";
import { usePlayer } from "@/components/PlayerProvider";
import { SongList, Shelf } from "@/components/Shelves";
import { AppearancePicker } from "@/components/Appearance";

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

      <div className="empty" style={{ marginTop: 8 }}>
        <h3>Playlists aren&apos;t available yet</h3>
        <p>Meloa doesn&apos;t have accounts yet, so playlists can&apos;t be created or synced between devices.</p>
      </div>

      <div style={{ height: 24 }} />
      <AppearancePicker />
    </>
  );
}
