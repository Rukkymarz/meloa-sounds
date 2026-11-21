// Shared with client pages (no server code here).
export const CHART_COUNTRIES = [
  ["NG", "Nigeria"], ["GH", "Ghana"], ["ZA", "South Africa"], ["KE", "Kenya"], ["TZ", "Tanzania"], ["UG", "Uganda"],
  ["CM", "Cameroon"], ["CI", "Côte d'Ivoire"], ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"],
  ["JM", "Jamaica"], ["FR", "France"], ["DE", "Germany"], ["BR", "Brazil"], ["MX", "Mexico"], ["IN", "India"],
  ["JP", "Japan"], ["KR", "South Korea"],
] as const;

/** Chart sites with no API or feed: shown as links only. */
export const EXTERNAL_CHARTS = [
  { name: "kworb — Apple Music Nigeria (top 200)", url: "https://kworb.net/charts/apple_s/ng.html" },
  { name: "Billboard Naija charts", url: "https://billboardnaija.com" },
  { name: "TurnTable Charts (official Nigerian chart)", url: "https://www.turntablecharts.com" },
];
