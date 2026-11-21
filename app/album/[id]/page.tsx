import Link from "next/link";
import { notFound } from "next/navigation";
import { deezerAlbumPage } from "@/lib/sources/deezer";
import { SongList } from "@/components/Shelves";
import { Artwork } from "@/components/Artwork";
import { PlayAll } from "@/components/PlayAll";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await deezerAlbumPage(id).catch(() => null);
  return { title: d ? `${d.album.title} by ${d.album.artist}` : "Album" };
}

function minutes(s?: number) {
  if (!s) return "";
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`;
}

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const d = await deezerAlbumPage(id).catch(() => null);
  if (!d) notFound();
  const a = d.album;
  const kind = a.type === "single" ? "Single" : a.type === "ep" ? "EP" : a.type === "compile" ? "Compilation" : "Album";

  return (
    <>
      <section className="album-head" aria-label={a.title}>
        <Artwork src={a.cover} title={a.title} />
        <div style={{ display: "grid", gap: 6, justifyItems: "inherit" }}>
          <h1 className="album-title">{a.title}</h1>
          {a.artistId ? (
            <Link href={`/artist/${a.artistId}`} className="album-artist">{a.artist}</Link>
          ) : (
            <span className="album-artist">{a.artist}</span>
          )}
          <span className="album-meta">{[kind, a.genre, a.year].filter(Boolean).join(", ")}</span>
          {d.tracks.length > 0 && (
            <div className="album-actions">
              <PlayAll tracks={d.tracks} label="Play" />
              <PlayAll tracks={d.tracks} label="Shuffle" shuffle />
            </div>
          )}
        </div>
      </section>

      <SongList tracks={d.tracks} numbered />

      <p className="album-foot">
        {a.releaseDate && <>Released {new Date(a.releaseDate).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}<br /></>}
        {d.tracks.length} {d.tracks.length === 1 ? "song" : "songs"}
        {a.durationSec ? `, ${minutes(a.durationSec)}` : ""}
        {a.label && <><br />{a.label}</>}
      </p>
    </>
  );
}
