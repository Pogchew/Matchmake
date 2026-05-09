const CHARACTER_LABELS = {
  "League of Legends": "Champion",
  Valorant: "Agent",
  "Marvel Rivals": "Hero",
  "Honor of Kings": "Hero",
  HOK: "Hero",
  "Overwatch 2": "Hero",
};

const CHARACTER_COMFORT_TITLES = {
  "League of Legends": "Champion Comfort",
  Valorant: "Agent Comfort",
  "Marvel Rivals": "Hero Comfort",
  "Honor of Kings": "Hero Comfort",
  HOK: "Hero Comfort",
  "Overwatch 2": "Hero Comfort",
};

const SUPPORTED_CHARACTER_GAMES = new Set(Object.keys(CHARACTER_LABELS));

const INVALID_CHARACTER_VALUES = new Set([
  "unknown",
  "unknown hero",
  "hero 1",
  "hero 2",
  "player tbd",
  "vanguard",
  "duelist",
  "strategist",
  "flex",
  "tank",
  "damage",
  "support",
  "top",
  "jungle",
  "mid",
  "adc",
]);

const ROLE_ORDER = {
  "League of Legends": ["Top", "Jungle", "Mid", "ADC", "Support"],
  "Overwatch 2": ["Tank", "Damage", "Damage", "Support", "Support"],
};

function getReviewRows(review, side = "team") {
  if (side === "opponent") {
    return review?.opponent_rows?.length ? review.opponent_rows : review?.opponent_comp || [];
  }

  return review?.player_rows?.length ? review.player_rows : review?.team_comp || [];
}

function getReviewOutcome(review) {
  const result = review?.match_result?.toLowerCase?.();
  if (result === "victory" || result === "win") return "win";
  if (result === "defeat" || result === "loss") return "loss";
  return null;
}

function getPickRate(games, totalReviewsWithPicks) {
  return totalReviewsWithPicks ? games / totalReviewsWithPicks : null;
}

function getWinRate(wins, losses) {
  const total = wins + losses;
  return total ? wins / total : null;
}

function titleCase(value = "") {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getCharacterLabelForGame(gameTitle) {
  return CHARACTER_LABELS[gameTitle] || "Character";
}

export function getCharacterComfortTitleForGame(gameTitle) {
  return CHARACTER_COMFORT_TITLES[gameTitle] || "Character Comfort";
}

export function normalizeCharacterName(name, gameTitle) {
  if (name === null || name === undefined) return "";

  const trimmed = String(name).trim();
  if (!trimmed || trimmed === "—") return "";

  const normalized = trimmed.toLowerCase();
  if (INVALID_CHARACTER_VALUES.has(normalized)) return "";

  if (gameTitle === "Valorant" && normalized === "kay/o") return "KAY/O";
  if (gameTitle === "Marvel Rivals" && ["cloak and dagger", "cloak & dagger"].includes(normalized)) return "Cloak & Dagger";
  if (gameTitle === "Marvel Rivals" && normalized === "punisher") return "The Punisher";
  if (gameTitle === "Marvel Rivals" && normalized === "thing") return "The Thing";

  return titleCase(trimmed);
}

export function extractCharacterName(row = {}, gameTitle) {
  const confirmedFields = gameTitle === "Marvel Rivals"
    ? ["hero_confirmed", "hero"]
    : ["hero_confirmed", "champion", "agent", "hero", "character", "character_name", "champion_name", "agent_name"];

  for (const field of confirmedFields) {
    const value = normalizeCharacterName(row?.[field], gameTitle);
    if (value) return value;
  }

  const guessFields = gameTitle === "Marvel Rivals"
    ? []
    : ["hero_guess", "agent_guess", "champion_guess"];

  for (const field of guessFields) {
    const value = normalizeCharacterName(row?.[field], gameTitle);
    if (value) return value;
  }

  if (gameTitle === "Marvel Rivals") {
    const confidence = Number(row?.hero_guess_confidence ?? row?.hero_confidence ?? 0);
    const canUseGuess = confidence >= 0.6 && !row?.needs_hero_review && !row?.needs_manual_review;
    return canUseGuess ? normalizeCharacterName(row?.hero_guess, gameTitle) : "";
  }

  return "";
}

function orderRowsForComp(rows = [], gameTitle) {
  const order = ROLE_ORDER[gameTitle];
  if (!order) return rows;

  return rows
    .map((row, index) => {
      const role = row?.role || row?.position || row?.lane;
      const roleIndex = order.findIndex((expectedRole, expectedIndex) => {
        if (!role) return false;
        if (expectedRole !== role) return false;
        return expectedRole !== "Damage" && expectedRole !== "Support" ? true : expectedIndex >= 0;
      });

      return {
        row,
        index,
        roleIndex: roleIndex === -1 ? 99 : roleIndex,
      };
    })
    .sort((first, second) => first.roleIndex - second.roleIndex || first.index - second.index)
    .map((entry) => entry.row);
}

export function buildCompKey(rows = [], gameTitle) {
  const seen = new Set();
  const characters = orderRowsForComp(rows, gameTitle)
    .map((row) => extractCharacterName(row, gameTitle))
    .filter(Boolean)
    .filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });

  if (characters.length < 3) return null;

  return {
    comp_key: characters.join(" / "),
    characters,
    incomplete: characters.length < getExpectedCompSize(gameTitle),
  };
}

function getExpectedCompSize(gameTitle) {
  if (gameTitle === "Marvel Rivals") return 6;
  return 5;
}

function addCharacterUse(map, name, outcome) {
  const current = map.get(name) || { name, games: 0, wins: 0, losses: 0 };
  current.games += 1;
  if (outcome === "win") current.wins += 1;
  if (outcome === "loss") current.losses += 1;
  map.set(name, current);
}

function addCompUse(map, comp, outcome) {
  const current = map.get(comp.comp_key) || {
    comp_key: comp.comp_key,
    characters: comp.characters,
    games: 0,
    wins: 0,
    losses: 0,
    incomplete: comp.incomplete,
  };
  current.games += 1;
  if (outcome === "win") current.wins += 1;
  if (outcome === "loss") current.losses += 1;
  map.set(comp.comp_key, current);
}

function finalizeCharacterStats(map, totalReviewsWithPicks) {
  return [...map.values()]
    .map((entry) => ({
      ...entry,
      pick_rate: getPickRate(entry.games, totalReviewsWithPicks),
      win_rate: getWinRate(entry.wins, entry.losses),
      small_sample: entry.games < 2,
    }))
    .sort((first, second) => second.games - first.games || first.name.localeCompare(second.name));
}

function finalizeCompStats(map) {
  return [...map.values()]
    .map((entry) => ({
      ...entry,
      win_rate: getWinRate(entry.wins, entry.losses),
      small_sample: entry.games < 2,
    }))
    .sort((first, second) => second.games - first.games || first.comp_key.localeCompare(second.comp_key));
}

function bestPerforming(entries) {
  return [...entries]
    .filter((entry) => entry.win_rate !== null)
    .sort((first, second) => {
      const sampleDiff = Number(first.small_sample) - Number(second.small_sample);
      if (sampleDiff !== 0) return sampleDiff;
      return second.win_rate - first.win_rate || second.games - first.games;
    })[0] || null;
}

function getTopComfortPickRate(entries) {
  const totalAppearances = entries.reduce((sum, entry) => sum + entry.games, 0);
  if (!totalAppearances) return null;
  const topThreeAppearances = entries.slice(0, 3).reduce((sum, entry) => sum + entry.games, 0);
  return topThreeAppearances / totalAppearances;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").replace("%", ""));
  return Number.isFinite(number) ? number : null;
}

function getRowNumber(row, keys) {
  for (const key of keys) {
    const value = normalizeNumber(row?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function getCharacterMetricSpecs(gameTitle) {
  const kda = [
    { key: "kills", label: "K", keys: ["kills", "k"], decimals: 1 },
    { key: "deaths", label: "D", keys: ["deaths", "d"], decimals: 1 },
    { key: "assists", label: "A", keys: ["assists", "a"], decimals: 1 },
  ];

  return {
    "League of Legends": [
      ...kda,
      { key: "gold", label: "Gold", keys: ["gold"], decimals: 0 },
      { key: "damage", label: "Damage", keys: ["damage_to_champions", "damage"], decimals: 0 },
    ],
    Valorant: [
      ...kda,
      { key: "combat_score", label: "Combat", keys: ["avg_combat_score", "acs"], decimals: 0 },
      { key: "econ", label: "Econ", keys: ["econ_rating"], decimals: 0 },
    ],
    "Marvel Rivals": [
      ...kda,
      { key: "final_hits", label: "Final", keys: ["final_hits"], decimals: 1 },
      { key: "damage", label: "Damage", keys: ["damage"], decimals: 0 },
      { key: "healing", label: "Healing", keys: ["healing"], decimals: 0 },
    ],
    "Honor of Kings": [
      ...kda,
      { key: "gold", label: "Gold", keys: ["gold"], decimals: 0 },
      { key: "damage", label: "Damage", keys: ["damage"], decimals: 0 },
    ],
    HOK: [
      ...kda,
      { key: "gold", label: "Gold", keys: ["gold"], decimals: 0 },
      { key: "damage", label: "Damage", keys: ["damage"], decimals: 0 },
    ],
    "Overwatch 2": [
      { key: "eliminations", label: "Elims", keys: ["eliminations", "kills"], decimals: 1 },
      { key: "deaths", label: "D", keys: ["deaths"], decimals: 1 },
      { key: "assists", label: "A", keys: ["assists"], decimals: 1 },
      { key: "damage", label: "Damage", keys: ["damage"], decimals: 0 },
      { key: "healing", label: "Healing", keys: ["healing"], decimals: 0 },
    ],
  }[gameTitle] || [];
}

function addCharacterPerformance(map, row, outcome, gameTitle) {
  const name = extractCharacterName(row, gameTitle);
  if (!name) return;

  const current = map.get(name) || {
    name,
    games: 0,
    wins: 0,
    losses: 0,
    metricTotals: {},
    metricCounts: {},
  };

  current.games += 1;
  if (outcome === "win") current.wins += 1;
  if (outcome === "loss") current.losses += 1;

  for (const spec of getCharacterMetricSpecs(gameTitle)) {
    const value = getRowNumber(row, spec.keys);
    if (value === null) continue;
    current.metricTotals[spec.key] = (current.metricTotals[spec.key] || 0) + value;
    current.metricCounts[spec.key] = (current.metricCounts[spec.key] || 0) + 1;
  }

  map.set(name, current);
}

function finalizeCharacterPerformance(map, gameTitle) {
  const specs = getCharacterMetricSpecs(gameTitle);

  return [...map.values()]
    .map((entry) => ({
      name: entry.name,
      games: entry.games,
      wins: entry.wins,
      losses: entry.losses,
      win_rate: getWinRate(entry.wins, entry.losses),
      small_sample: entry.games < 2,
      metrics: specs
        .map((spec) => {
          const count = entry.metricCounts[spec.key] || 0;
          return {
            key: spec.key,
            label: spec.label,
            value: count ? entry.metricTotals[spec.key] / count : null,
            decimals: spec.decimals,
          };
        })
        .filter((metric) => metric.value !== null),
    }))
    .filter((entry) => entry.metrics.length > 0)
    .sort((first, second) => second.games - first.games || first.name.localeCompare(second.name))
    .slice(0, 6);
}

export function aggregateCharacterAnalytics(reviews = [], gameTitle = "") {
  const label = getCharacterLabelForGame(gameTitle);
  const comfortTitle = getCharacterComfortTitleForGame(gameTitle);

  if (!SUPPORTED_CHARACTER_GAMES.has(gameTitle)) {
    return {
      label,
      comfortTitle,
      supported: false,
      ourTopCharacters: [],
      enemyTopCharacters: [],
      bestPerformingCharacters: [],
      mostUsedCharacter: null,
      bestPerformingCharacter: null,
      mostCommonEnemyCharacter: null,
      mostUsedComp: null,
      bestPerformingComp: null,
      comfortPickRate: null,
      characterPerformance: [],
    };
  }

  const ourCharacters = new Map();
  const enemyCharacters = new Map();
  const comps = new Map();
  const characterPerformance = new Map();
  let reviewsWithOurPicks = 0;
  let reviewsWithEnemyPicks = 0;

  for (const review of reviews) {
    const outcome = getReviewOutcome(review);
    const ourRows = getReviewRows(review, "team");
    const enemyRows = getReviewRows(review, "opponent");
    const ourNames = [...new Set(ourRows.map((row) => extractCharacterName(row, gameTitle)).filter(Boolean))];
    const enemyNames = [...new Set(enemyRows.map((row) => extractCharacterName(row, gameTitle)).filter(Boolean))];

    if (ourNames.length) reviewsWithOurPicks += 1;
    if (enemyNames.length) reviewsWithEnemyPicks += 1;

    ourNames.forEach((name) => addCharacterUse(ourCharacters, name, outcome));
    enemyNames.forEach((name) => addCharacterUse(enemyCharacters, name, outcome));
    ourRows.forEach((row) => addCharacterPerformance(characterPerformance, row, outcome, gameTitle));

    const comp = buildCompKey(ourRows, gameTitle);
    if (comp) addCompUse(comps, comp, outcome);
  }

  const ourTopCharacters = finalizeCharacterStats(ourCharacters, reviewsWithOurPicks);
  const enemyTopCharacters = finalizeCharacterStats(enemyCharacters, reviewsWithEnemyPicks);
  const compStats = finalizeCompStats(comps);
  const bestPerformingCharacter = bestPerforming(ourTopCharacters);
  const bestPerformingComp = bestPerforming(compStats);

  return {
    label,
    comfortTitle,
    supported: true,
    ourTopCharacters: ourTopCharacters.slice(0, 5),
    enemyTopCharacters: enemyTopCharacters.slice(0, 5),
    bestPerformingCharacters: ourTopCharacters.filter((entry) => entry.win_rate !== null).sort((first, second) => second.win_rate - first.win_rate || second.games - first.games).slice(0, 5),
    mostUsedCharacter: ourTopCharacters[0] || null,
    bestPerformingCharacter,
    mostCommonEnemyCharacter: enemyTopCharacters[0] || null,
    mostUsedComp: compStats[0] || null,
    bestPerformingComp,
    comfortPickRate: getTopComfortPickRate(ourTopCharacters),
    characterPerformance: finalizeCharacterPerformance(characterPerformance, gameTitle),
  };
}
