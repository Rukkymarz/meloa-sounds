# Meloa Sounds

A free web app (PWA) that gathers music from every legal open catalog and plays **full songs only**, each through a source that permits it.

## How the catalog works

| Layer | Sources | Plays as |
|---|---|---|
| 1. Song database | MusicBrainz (seed script), daily chart import (Apple Music top 100 and YouTube trending music by country, Deezer genre charts), Deezer and Last.fm metadata, listener matches, artist uploads | Supabase `tracks` |
| 2a. Free full audio | Audius, Jamendo, Openverse (CC music), Internet Archive, ccMixter, Radio Browser, artist uploads | Direct stream (licence permits it) |
| 2b. Official players | YouTube IFrame player, Audiomack, Mixcloud, SoundCloud, Bandcamp, Boomplay, Spotify | That platform's own player, with its ads |
| 3. Artist uploads | `/submit` with a rights confirmation and a non-exclusive licence, reviewed in `/admin` | Supabase Storage |

When a listener taps a song that only has metadata, `/api/resolve` finds a full version in this order: your saved catalog first, then Audius, then Audiomack (if you have a key), then YouTube. The match is saved, so each song uses YouTube search quota once. If no full version exists, nothing plays: there are **never 30-second previews**.

## Deploy (about 20 minutes, $0)

1. **Supabase**: create a project, open SQL Editor, and run `supabase/schema.sql`.
2. **Keys**:
   - YouTube: Google Cloud Console → enable *YouTube Data API v3* → create an API key. Restrict it to that API.
   - Jamendo: create an app at devportal.jamendo.com and copy the `client_id`.
   - Last.fm: create an API account at last.fm/api to get country top-track charts.
   - `CRON_SECRET`: any long random string. Vercel uses it to run the daily chart import.
   - Audiomack (optional): request API access through Audiomack's contact page.
3. **GitHub → Vercel**: push this folder to a repo and import it in Vercel. Add every variable from `.env.example` under Settings → Environment Variables.
4. **Seed the catalog** (on your PC):
   ```bash
   npm install
   cp .env.example .env.local   # fill it in
   npm run seed                 # all genres, 300 songs each
   node --env-file=.env.local scripts/seed-musicbrainz.mjs afrobeats 2000
   ```
5. Open `/admin` with your `ADMIN_TOKEN` to review artist uploads and copyright requests.

## API

| Endpoint | What it does |
|---|---|
| `GET /api/search?q=&type=all\|song\|mix\|station` | Searches every source in parallel, merges duplicates, returns full tracks only |
| `GET /api/genre/:slug` | Charts, free tracks, DJ mixes and stations for one of 28 genres |
| `GET /api/catalog?genre=&country=` | Your own database |
| `GET /api/resolve?source=&id=` or `?artist=&title=` | Best full legal source for a song |
| `GET /api/link?url=` | Paste any YouTube, Audiomack, SoundCloud, Mixcloud, Bandcamp, Boomplay, Spotify or Audius link |
| `GET /api/charts?country=NG` | Apple Music top 100, YouTube trending music, Last.fm, Audiomack trending and Deezer global top 50 |
| `GET /api/cron/ingest` | Daily chart import into your catalog (Vercel cron, Bearer `CRON_SECRET`) |
| `GET /api/radio?country=NG&tag=` | Live stations (HTTPS only) |
| `GET /api/lyrics?artist=&title=` | Synced lyrics from LRCLIB |
| `POST /api/submit` | Artist upload: returns signed upload URLs to a private bucket |
| `POST /api/takedown` | Copyright complaint |
| `GET/POST /api/admin/submissions` | Approve, reject or remove uploads (Bearer `ADMIN_TOKEN`) |

## Charts
Charts come from official feeds: Apple's Marketing Tools RSS (keyless, per country), YouTube `videos.list chart=mostPopular` (1 quota unit per country, and the songs are playable immediately), Last.fm `geo.getTopTracks`, Deezer and Audiomack. Chart sites with no API or feed, such as kworb, Billboard Naija and TurnTable, are linked from `/charts` and never scraped. kworb's Apple Music Nigeria page is built from the same Apple chart this app reads directly.

Every day at 06:17 UTC, `/api/cron/ingest` saves YouTube trending music for Nigeria, Ghana, South Africa, Kenya and one rotating country (with players attached), Apple's top 100 for those countries, and two Deezer genre charts. The catalog grows on its own.

## Legal guardrails built in
- **YouTube**: the player is always visible (at least 200 px tall). YouTube's ads and controls are never hidden, audio is never pulled out of the video, and only video IDs are stored. The YouTube Terms link is on `/legal`.
- **Embeds** (Audiomack, SoundCloud, Mixcloud, Boomplay, Bandcamp, Spotify) play inside each platform's own player, so plays and royalties go to the rights holders.
- **Direct streams** are limited to sources whose terms or licences allow them. Licence and credit show on the Now Playing screen.
- **No scraping** of blogs or MP3 sites. Pasted links are accepted only from the platforms listed above.
- **Artist uploads** require a rights confirmation and licence acceptance (versioned and stored), sit in a private bucket until approved, are limited to 5 a day per IP, and can be removed on request.
- **Copyright** complaints go through a takedown form on `/legal`.
- Have a lawyer review `lib/terms.ts` and `/legal` before you open uploads to the public.

## Known limits
- **YouTube** allows about 100 new song matches a day on the free quota. Saved matches don't count. You can request more through Google's quota form.
- **YouTube on iPhone** stops when the screen locks. This is YouTube's rule; audio-tier sources keep playing.
- **Spotify** plays full tracks only in desktop browsers signed in to Spotify. Phones get a preview, and the app labels this.
- **Boomplay** blocks some tracks outside Africa, and **SoundCloud** plays only clips of some major-label tracks to non-subscribers. Both are labelled in the player.
