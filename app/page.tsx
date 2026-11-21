import Link from "next/link";
import { homeData } from "@/lib/home";
import { GENRES } from "@/lib/genres";
import { Shelf, SongList, GenreGrid, SectionHead } from "@/components/Shelves";
import { HeroPlay, RecentlyPlayed } from "@/components/HomeClient";
import { Artwork } from "@/components/Artwork";
import { listCurated } from "@/lib/curated";

export const revalidate = 3600;

const DISCOVER = ["afrobeats", "amapiano", "hip-hop", "rnb", "pop", "latin", "k-pop", "gospel"];

export default async function Home() {
  const [d, audiomack] = await Promise.all([homeData(), listCurated({ limit: 20, check: false }).catch(() => [])]);
  const f = d.featured;

  return (
    <>
      <header className="page-head">
        <h1 className="h-large">Home</h1>
      </header>

      {f && (
        <section className="hero" aria-label="Featured release">
          <div className="hero-art">
            <Artwork src={f.artwork} title={f.title} />
          </div>
          <div className="hero-body">
            <p className="hero-kicker">New this week{f.album && f.album !== f.title ? `, from ${f.album}` : ""}</p>
            <h2 className="hero-title">{f.title}</h2>
            <p className="hero-artist">{f.artist}</p>
            <HeroPlay track={f} />
          </div>
        </section>
      )}

      <RecentlyPlayed />

      <SongList title="Trending worldwide" tracks={d.worldwide.slice(0, 20)} ranked paged href="/new" />

      <Shelf title="New releases" tracks={d.releases} href="/new" />

      <SongList title="Hot in Nigeria right now" tracks={d.nigeria.slice(0, 16)} paged href="/new?country=NG" />

      {audiomack.length > 0 && <Shelf title="Fresh on Audiomack" tracks={audiomack} />}

      <section className="shelf" aria-label="Discover by genre">
        <SectionHead title="Discover by genre" href="/search" more="All genres" />
        <GenreGrid genres={GENRES.filter((g) => DISCOVER.includes(g.slug))} />
      </section>

      {d.countries.length > 0 && (
        <section className="shelf" aria-label="Around the world">
          <SectionHead title="Around the world" href="/new" more="All charts" />
          <div className="country-row">
            {d.countries.map((c) => (
              <Link key={c.code} href={`/new?country=${c.code}`} className="country">
                {c.art && <Artwork src={c.art} title={c.name} />}
                <span className="country-name">
                  {c.name}
                  {c.top && <span className="country-sub">No. 1: {c.top}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="legal-note">
        Every song plays through a source that allows it: open-licence catalogs, artists&apos; own uploads, or the official YouTube,
        Audiomack, Mixcloud and SoundCloud players. Charts from Apple Music, YouTube, Deezer and Last.fm. <Link href="/legal">Terms and credits</Link>
      </p>
    </>
  );
}
