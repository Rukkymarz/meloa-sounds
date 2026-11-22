"use client";

import { useState } from "react";
import type { Track } from "@/lib/types";
import { myPlaylists, newPlaylist, addToPlaylist } from "@/lib/myPlaylists";

export function AddToPlaylist({ track }: { track: Track }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const lists = open ? myPlaylists().filter((p) => p.editKey) : [];

  async function add(p: (typeof lists)[number]) {
    try {
      const r = await addToPlaylist(p, track);
      setMsg(r === "already" ? `Already in ${p.name}.` : `Added to ${p.name}.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function create() {
    try {
      const n = name.trim() || "My playlist";
      await newPlaylist(n, [track]);
      setMsg(`Created ${n} with this song.`);
      setName("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="atp">
      <button className="np-alt-link" onClick={() => { setOpen(!open); setMsg(null); }} aria-expanded={open}>
        {open ? "Close" : "Add to playlist"}
      </button>
      {open && (
        <div className="atp-panel">
          {lists.map((p) => (
            <button key={p.id} className="chip" onClick={() => add(p)}>{p.name}</button>
          ))}
          <div className="atp-new">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist name" aria-label="New playlist name" maxLength={80} />
            <button className="chip on" onClick={create}>Create</button>
          </div>
          {msg && <p className="small" role="status">{msg}</p>}
        </div>
      )}
    </div>
  );
}
