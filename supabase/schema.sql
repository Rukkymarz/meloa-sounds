-- Meloa Sounds catalog schema. Run once in Supabase → SQL Editor.

create extension if not exists pgcrypto;

-- One row per song, whatever source it plays from.
create table if not exists public.tracks (
  id           uuid primary key default gen_random_uuid(),
  norm_key     text unique not null,          -- normalized "artist|title" for de-duplication
  title        text not null,
  artist       text not null,
  album        text,
  artwork      text,
  duration_sec integer,
  isrc         text,
  mbid         text,                           -- MusicBrainz recording id
  genres       text[] default '{}',
  country      text,                           -- e.g. NG
  created_at   timestamptz default now()
);
create index if not exists tracks_genres_idx on public.tracks using gin (genres);
create index if not exists tracks_isrc_idx on public.tracks (isrc);
create index if not exists tracks_search_idx on public.tracks
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(artist,'')));

-- Where a song can legally be played. Many sources per track.
create table if not exists public.track_sources (
  id            uuid primary key default gen_random_uuid(),
  track_id      uuid references public.tracks(id) on delete cascade,
  source        text not null,                 -- audius | jamendo | openverse | archive | youtube | audiomack | mixcloud | soundcloud | bandcamp | boomplay | spotify | meloa
  source_id     text not null,
  tier          smallint not null,             -- 1 full free, 2 full with platform ads, 3 platform embed, 4 metadata only
  playback      jsonb not null,                -- { kind: 'audio'|'youtube'|'embed'|'resolve', ... }
  license       jsonb,                         -- { name, url, attribution }
  duration_sec  integer,
  verified_full boolean default true,
  last_checked  timestamptz default now(),
  unique (source, source_id)
);
create index if not exists track_sources_track_idx on public.track_sources (track_id, tier);

-- Signed-in users' playlists.
create table if not exists public.playlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now()
);
create table if not exists public.playlist_tracks (
  playlist_id uuid references public.playlists(id) on delete cascade,
  track_id    uuid references public.tracks(id) on delete cascade,
  position    integer not null,
  primary key (playlist_id, track_id)
);

-- Direct artist uploads (held private until you approve them).
create table if not exists public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  artist_name         text not null,
  email               text not null,
  track_title         text not null,
  genre               text,
  country             text,
  file_path           text,                    -- path in the private "submissions" bucket
  artwork_path        text,
  terms_version       text not null,
  rights_confirmed    boolean not null,
  status              text not null default 'pending',  -- pending | approved | rejected | removed
  ip_hash             text,
  created_at          timestamptz default now()
);

-- Copyright takedown requests (DMCA-style).
create table if not exists public.takedowns (
  id          uuid primary key default gen_random_uuid(),
  claimant    text not null,
  email       text not null,
  content_url text not null,
  details     text not null,
  good_faith  boolean not null,
  status      text not null default 'open',    -- open | actioned | rejected
  created_at  timestamptz default now()
);

-- ---------- Row Level Security ----------
alter table public.tracks          enable row level security;
alter table public.track_sources   enable row level security;
alter table public.playlists       enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.submissions     enable row level security;
alter table public.takedowns       enable row level security;

-- Catalog is public to read; only the server (service role) writes it.
create policy "catalog read" on public.tracks        for select using (true);
create policy "sources read" on public.track_sources for select using (true);

-- Playlists belong to their owner.
create policy "own playlists" on public.playlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own playlist tracks" on public.playlist_tracks
  for all using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));

-- submissions and takedowns: no public policies → only the service role (API routes) can touch them.

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('submissions', 'submissions', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('catalog', 'catalog', true)
  on conflict (id) do nothing;
