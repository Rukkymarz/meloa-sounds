import Link from "next/link";
import { Artwork } from "./Artwork";

export interface AlbumLite {
  id: number;
  title: string;
  artist?: string;
  cover?: string;
  year?: string;
  type?: string;
}

/** Horizontal row of albums, Apple Music style: cover, title, year. Opens the album page. */
export function AlbumShelf({ title, albums, href }: { title: string; albums: AlbumLite[]; href?: string }) {
  if (!albums.length) return null;
  return (
    <section className="shelf" aria-label={title}>
      <div className="shelf-head">
        <h2 className="h-section">{title}</h2>
        {href && <Link href={href}>See all</Link>}
      </div>
      <div className="shelf-row" role="list">
        {albums.map((a) => (
          <Link key={a.id} role="listitem" href={`/album/${a.id}`} className="tile" style={{ textDecoration: "none" }}>
            <Artwork src={a.cover} title={a.title} />
            <strong>{a.title}</strong>
            <span>{[a.year, a.type === "ep" ? "EP" : a.type === "single" ? "Single" : null].filter(Boolean).join(", ")}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ArtistShelf({ title, artists }: { title: string; artists: { id: number; name: string; picture?: string }[] }) {
  if (!artists.length) return null;
  return (
    <section className="shelf" aria-label={title}>
      <div className="shelf-head">
        <h2 className="h-section">{title}</h2>
      </div>
      <div className="shelf-row" role="list">
        {artists.map((a) => (
          <Link key={a.id} role="listitem" href={`/artist/${a.id}`} className="tile artist-tile" style={{ textDecoration: "none" }}>
            <Artwork src={a.picture} title={a.name} round />
            <strong>{a.name}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
