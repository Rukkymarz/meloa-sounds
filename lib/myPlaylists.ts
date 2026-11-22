"use client";
import type { Track } from "./types";

// Playlists this device made or was given an edit link for (no account needed).
export interface MyPlaylist { id: string; name: string; editKey?: string }
const KEY = "meloa:playlists";

export function myPlaylists(): MyPlaylist[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function rememberPlaylist(p: MyPlaylist) {
  const list = myPlaylists().filter((x) => x.id !== p.id);
  const prev = myPlaylists().find((x) => x.id === p.id);
  list.unshift({ ...prev, ...p, editKey: p.editKey || prev?.editKey });
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch {}
}
export function forgetPlaylist(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(myPlaylists().filter((x) => x.id !== id)));
  } catch {}
}

export async function newPlaylist(name: string, tracks: Track[] = []) {
  const r = await fetch("/api/playlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, tracks }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Couldn't create the playlist.");
  rememberPlaylist({ id: j.id, name, editKey: j.editKey });
  return j as { id: string; editKey: string };
}

export async function addToPlaylist(p: MyPlaylist, track: Track) {
  if (!p.editKey) throw new Error("You can only add songs to playlists you can edit.");
  const cur = await fetch(`/api/playlists/${p.id}`).then((r) => r.json());
  const tracks: Track[] = cur.tracks || [];
  if (tracks.some((t) => t.id === track.id)) return "already";
  tracks.push(track);
  const r = await fetch(`/api/playlists/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editKey: p.editKey, tracks }) });
  if (!r.ok) throw new Error((await r.json()).error || "Couldn't add the song.");
  return "added";
}

export const shareUrl = (id: string, editKey?: string) => `${location.origin}/p/${id}${editKey ? `?k=${encodeURIComponent(editKey)}` : ""}`;
