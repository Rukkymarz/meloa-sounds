import Link from "next/link";
import { availableCountries, countryChart, newReleases } from "@/lib/home";
import { GENRES } from "@/lib/genres";
import { Shelf, SongList, GenreGrid, SectionHead } from "@/components/Shelves";
import { CountryPicker } from "@/components/CountryPicker";

export const revalidate = 3600;
export const metadata = { title: "New" };

// Genres in the order the brief asks for; each opens its own page with charts, mixes and stations.
const BROWSE = ["pop", "hip-hop", "rnb", "rock", "latin", "k-pop", "house", "jazz", "afrobeats", "amapiano", "gospel", "electronic", "dancehall-reggae", "alternative", "classical", "country"];
const NIGERIA = ["street-pop", "afrobeats", "fuji-juju", "highlife", "gospel"];

export default async function NewPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const sp = await searchParams;
  const [countries, releases] = await Promise.all([availableCountries(), newReleases(16)]);
  const wanted = (sp.country || "NG").toUpperCase();
  const country = countries.find((c) => c.code === wanted) || countries[0];
  const chart = country ? await countryChart(country.code) : { apple: [], youtube: [], lastfm: [] };
  const genres = BROWSE.map((s) => GENRES.find((g) => g.slug === s)).filter(Boolean) as typeof GENRES;

  return (
    <>
      <header className="page-head">
        <h1 className="h-large">New</h1>
      </header>

      <Shelf title="New releases" tracks={releases} />

      <section className="shelf" aria-label="Charts">
        <SectionHead title="Charts" />
        {countries.length ? (
          <CountryPicker countries={countries.map((c) => ({ code: c.code, name: c.name }))} value={country?.code || ""} />
        ) : (
          <p className="hint">Charts are unavailable right now. Try again in a few minutes.</p>
        )}
      </section>

      {country && (
        <>
          <SongList title={`Top songs in ${country.name}`} tracks={chart.apple.slice(0, 40)} ranked paged />
          <Shelf title={`Trending music videos in ${country.name}`} tracks={chart.youtube.slice(0, 20)} />
          <SongList title={`Most played on Last.fm in ${country.name}`} tracks={chart.lastfm.slice(0, 20)} ranked paged />
        </>
      )}

      {country?.code === "NG" && (
        <section className="shelf" aria-label="Nigeria, deeper">
          <SectionHead title="Nigeria, deeper" />
          <GenreGrid genres={NIGERIA.map((s) => GENRES.find((g) => g.slug === s)!).filter(Boolean)} />
        </section>
      )}

      <section className="shelf" aria-label="Browse by genre">
        <SectionHead title="Browse by genre" />
        <div className="chips">
          {genres.map((g) => (
            <Link key={g.slug} href={`/genre/${g.slug}`} className="chip">
              {g.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
