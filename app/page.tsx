import Link from "next/link";
import { GENRES } from "@/lib/genres";
import { SearchView } from "@/components/SearchView";

export default function Home() {
  return (
    <>
      <h1>Every genre. Full songs. Free.</h1>
      <SearchView />
      <h3>Browse by genre</h3>
      <div className="genres">
        {GENRES.map((g) => (
          <Link key={g.slug} href={`/genre/${g.slug}`} className="genre" style={{ background: g.color }}>
            {g.name}
          </Link>
        ))}
      </div>
    </>
  );
}
