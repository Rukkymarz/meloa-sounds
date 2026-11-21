// One genre list, mapped onto each source's own vocabulary.
// deezer = Deezer genre id for charts (metadata) · audius / jamendo / mixcloud / radio / audiomack = tags
export interface GenreDef {
  slug: string;
  name: string;
  color: string;
  deezer?: number;
  query?: string; // Deezer search phrase when there's no chart id
  audius?: string;
  jamendo?: string;
  mixcloud?: string;
  radio?: string;
  audiomack?: string;
  country?: string; // radio country focus
}

export const GENRES: GenreDef[] = [
  { slug: "afrobeats", name: "Afrobeats", color: "#7A2E3A", deezer: 2, audius: "Afrobeat", jamendo: "afrobeat", mixcloud: "afrobeats", radio: "afrobeats", audiomack: "afrobeats", country: "NG" },
  { slug: "amapiano", name: "Amapiano", color: "#1F5C4F", query: "amapiano", audius: "Electronic", jamendo: "house", mixcloud: "amapiano", radio: "amapiano", audiomack: "afrobeats", country: "ZA" },
  { slug: "street-pop", name: "Naija Street-Pop", color: "#5A2C5B", query: "street pop naija", mixcloud: "naija", radio: "naija", audiomack: "afrobeats", country: "NG" },
  { slug: "fuji-juju", name: "Fuji & Jùjú", color: "#8A4B1C", query: "fuji music", mixcloud: "fuji", radio: "fuji", country: "NG" },
  { slug: "highlife", name: "Highlife", color: "#2F3F73", query: "highlife", jamendo: "world", mixcloud: "highlife", radio: "highlife", country: "GH" },
  { slug: "gospel", name: "Gospel", color: "#6B3A1F", query: "gospel", jamendo: "gospel", mixcloud: "gospel", radio: "gospel", audiomack: "gospel" },
  { slug: "hip-hop", name: "Hip-Hop & Rap", color: "#24525E", deezer: 116, audius: "Hip-Hop/Rap", jamendo: "hiphop", mixcloud: "hip-hop", radio: "hip hop", audiomack: "rap" },
  { slug: "rnb", name: "R&B & Soul", color: "#4A3B6B", deezer: 165, audius: "R&B/Soul", jamendo: "rnb", mixcloud: "rnb", radio: "rnb", audiomack: "rb" },
  { slug: "pop", name: "Pop", color: "#7A3E58", deezer: 132, audius: "Pop", jamendo: "pop", mixcloud: "pop", radio: "pop" },
  { slug: "dancehall-reggae", name: "Dancehall & Reggae", color: "#3D5A2A", deezer: 144, audius: "Reggae", jamendo: "reggae", mixcloud: "dancehall", radio: "reggae", audiomack: "reggae" },
  { slug: "house", name: "House & Dance", color: "#5C4033", deezer: 113, audius: "House", jamendo: "house", mixcloud: "house", radio: "house", audiomack: "electronic" },
  { slug: "electronic", name: "Electronic", color: "#283C5C", deezer: 106, audius: "Electronic", jamendo: "electronic", mixcloud: "electronic", radio: "electronic", audiomack: "electronic" },
  { slug: "rock", name: "Rock", color: "#6E2F2F", deezer: 152, audius: "Rock", jamendo: "rock", mixcloud: "rock", radio: "rock", audiomack: "rock" },
  { slug: "alternative", name: "Alternative & Indie", color: "#3B4F6B", deezer: 85, audius: "Alternative", jamendo: "indie", mixcloud: "indie", radio: "indie" },
  { slug: "metal", name: "Metal", color: "#7A2E3A", deezer: 464, audius: "Metal", jamendo: "metal", mixcloud: "metal", radio: "metal" },
  { slug: "jazz", name: "Jazz", color: "#1F5C4F", deezer: 129, audius: "Jazz", jamendo: "jazz", mixcloud: "jazz", radio: "jazz" },
  { slug: "blues", name: "Blues", color: "#5A2C5B", deezer: 153, audius: "Blues", jamendo: "blues", mixcloud: "blues", radio: "blues" },
  { slug: "classical", name: "Classical", color: "#8A4B1C", deezer: 98, audius: "Classical", jamendo: "classical", mixcloud: "classical", radio: "classical" },
  { slug: "latin", name: "Latin", color: "#2F3F73", deezer: 197, audius: "Latin", jamendo: "latin", mixcloud: "latin", radio: "latin", audiomack: "latin" },
  { slug: "country", name: "Country", color: "#6B3A1F", deezer: 84, audius: "Country", jamendo: "country", mixcloud: "country", radio: "country" },
  { slug: "folk", name: "Folk & Acoustic", color: "#24525E", deezer: 466, audius: "Folk", jamendo: "folk", mixcloud: "folk", radio: "folk" },
  { slug: "lofi", name: "Lo-fi & Chill", color: "#4A3B6B", query: "lofi", audius: "Lo-Fi", jamendo: "lounge", mixcloud: "lo-fi", radio: "chillout" },
  { slug: "world", name: "World", color: "#7A3E58", query: "world music", audius: "World", jamendo: "world", mixcloud: "world", radio: "world" },
  { slug: "k-pop", name: "K-Pop & Asian", color: "#3D5A2A", deezer: 16, jamendo: "pop", mixcloud: "k-pop", radio: "kpop" },
  { slug: "bollywood", name: "Indian & Bollywood", color: "#5C4033", deezer: 81, jamendo: "world", mixcloud: "bollywood", radio: "bollywood" },
  { slug: "arabic", name: "Arabic", color: "#283C5C", deezer: 12, jamendo: "world", mixcloud: "arabic", radio: "arabic" },
  { slug: "brazilian", name: "Brazilian", color: "#6E2F2F", deezer: 75, jamendo: "latin", mixcloud: "brazilian", radio: "brazil" },
  { slug: "soundtracks", name: "Film & Game", color: "#3B4F6B", deezer: 173, audius: "Soundtrack", jamendo: "soundtrack", mixcloud: "soundtrack", radio: "soundtrack" },
];

export function genreBySlug(slug: string) {
  return GENRES.find((g) => g.slug === slug);
}
