import { LEAGUE_CHAMPION_OPTIONS } from "./generated-character-options.js";

function compactChampionKey(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const LEAGUE_CHAMPION_BY_KEY = new Map(
  LEAGUE_CHAMPION_OPTIONS.map((champion) => [compactChampionKey(champion), champion]),
);

const LEAGUE_CHAMPION_ALIASES = new Map([
  ["renata", "Renata Glasc"],
  ["monkeyking", "Wukong"],
]);

export function normalizeLeagueChampionName(value = "") {
  const key = compactChampionKey(value);
  if (!key) return "";
  return LEAGUE_CHAMPION_BY_KEY.get(key) || LEAGUE_CHAMPION_ALIASES.get(key) || "";
}

export function getLeagueChampionReferenceText() {
  return LEAGUE_CHAMPION_OPTIONS.join(", ");
}
