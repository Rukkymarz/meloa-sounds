import { notFound } from "next/navigation";
import { deezerArtistPage } from "@/lib/sources/deezer";
import { SongList } from "@/components/Shelves";
import { AlbumShelf, ArtistShelf } from "@/components/Albums";
import { Artwork } from "@/components/Artwork";
import { PlayAll } from "@/components/PlayAll";

export const revalidate = 21600;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await deezerArtistPage(id).catch(() => null);
  return { title: d?.artist.name || "Artist" };
}

// Apple Music order: artist, Top Songs, Albums, Singles & EPs, Compilations, Similar Artists.
export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const d = await deezerArtistPage(id).catch(() => null);
  if (!d) notFound();
  const latest = [...d.albums, ...d.singles].sort((a, b) => (b.year || "").localeCompare(a.year || ""))[0];

  return (
    <>
      <section className="artist-hero" aria-label={d.artist.name}>
        <Artwork src={d.artist.picture} title={d.artist.name} />
        <div className="artist-hero-text">
          <h1>{d.artist.name}</h1>
          {d.top.length > 0 && <PlayAll tracks={d.top} label={`Play ${d.artist.name}`} round />}
        </div>
      </section>

      {latest && <AlbumShelf title="Latest release" albums={[latest]} />}
      <SongList title="Top songs" tracks={d.top.slice(0, 20)} paged />
      <AlbumShelf title="Albums" albums={d.albums} />
      <AlbumShelf title="Singles & EPs" albums={d.singles} />
      <AlbumShelf title="Compilations" albums={d.compilations} />
      <ArtistShelf title="Similar artists" artists={d.related} />

      <p className="legal-note">Artist and album details from Deezer. Songs play through Meloa&apos;s licensed sources.</p>
    </>
  );
}
