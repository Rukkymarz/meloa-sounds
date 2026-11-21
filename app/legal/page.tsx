import { ARTIST_TERMS, ARTIST_TERMS_VERSION } from "@/lib/terms";
import { TakedownForm } from "@/components/TakedownForm";

const NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Meloa Sounds";
const EMAIL = process.env.CONTACT_EMAIL || "the site owner";

export default function Legal() {
  return (
    <div className="prose">
      <h1>Terms, credits & copyright</h1>

      <h2>How {NAME} plays music</h2>
      <p>
        {NAME} does not host or copy commercial music. It organises a catalog and plays each song through a source
        that allows it:
      </p>
      <ul>
        <li><strong>Free, openly licensed audio</strong> — Audius (artist uploads, via its public API), Jamendo, Openverse, ccMixter and the Internet Archive (Creative Commons or public domain). Licence and credit are shown on the Now Playing screen.</li>
        <li><strong>Official players</strong> — YouTube, Audiomack, Mixcloud, SoundCloud, Bandcamp, Boomplay and Spotify play inside their own embedded players, with their own ads and controls, so plays and royalties go to the rights holders. YouTube videos are always shown, never turned into hidden audio.</li>
        <li><strong>Live radio</strong> — public station streams listed by Radio Browser.</li>
        <li><strong>Artist uploads</strong> — songs submitted directly by their owners under the licence below.</li>
        <li><strong>Information only</strong> — song details from Deezer and MusicBrainz, lyrics from LRCLIB. {NAME} never plays 30-second previews.</li>
      </ul>
      <p>
        Use of YouTube content is subject to the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms of Service</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>.
      </p>

      <h2 id="artists">Artist streaming licence ({ARTIST_TERMS_VERSION})</h2>
      <ol>
        {ARTIST_TERMS.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
      <p>To remove your upload, email {EMAIL} from the address you submitted with.</p>

      <h2 id="takedown">Copyright complaints</h2>
      <p>
        If you believe something on {NAME} infringes your copyright, tell us below. For songs playing through YouTube,
        Audiomack, SoundCloud, Mixcloud, Boomplay, Bandcamp or Spotify, the file is hosted by that platform — we remove
        it from our catalog right away, and you can also report it to them directly.
      </p>
      <TakedownForm />
    </div>
  );
}
