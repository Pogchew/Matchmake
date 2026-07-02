const commonPromptRules = `
Return only valid JSON. Extract only fields clearly visible in the screenshot.
Do not infer hidden stats, player identities, or objective details that are not visible.
If a field is not visible, return null or an empty value.
Low-confidence fields should set manual_edit_required to true.
Keep team_comp, opponent_comp, team_stats, and opponent_stats shaped for Matchmake review storage.
`.trim();

export const MARVEL_RIVALS_ALLOWED_HEROES = [
  "Adam Warlock",
  "Angela",
  "Black Panther",
  "Black Widow",
  "Blade",
  "Captain America",
  "Cloak & Dagger",
  "Doctor Strange",
  "Emma Frost",
  "Groot",
  "Hawkeye",
  "Hela",
  "Hulk",
  "Human Torch",
  "Invisible Woman",
  "Iron Fist",
  "Iron Man",
  "Jeff the Land Shark",
  "Loki",
  "Luna Snow",
  "Magik",
  "Magneto",
  "Mantis",
  "Mister Fantastic",
  "Moon Knight",
  "Namor",
  "Peni Parker",
  "Phoenix",
  "Psylocke",
  "Rocket Raccoon",
  "Scarlet Witch",
  "Spider-Man",
  "Squirrel Girl",
  "Star-Lord",
  "Storm",
  "The Punisher",
  "The Thing",
  "Thor",
  "Ultron",
  "Venom",
  "Winter Soldier",
  "Wolverine",
];

const MARVEL_RIVALS_ALIAS_MAP = {
  cloakanddagger: "Cloak & Dagger",
  cloakdagger: "Cloak & Dagger",
  punisher: "The Punisher",
  thepunisher: "The Punisher",
  thing: "The Thing",
  thething: "The Thing",
  jeff: "Jeff the Land Shark",
  jeffthelandshark: "Jeff the Land Shark",
};

const MARVEL_RIVALS_INVALID_HERO_VALUES = new Set([
  "vanguard",
  "duelist",
  "strategist",
  "flex",
  "hero1",
  "hero2",
  "hero3",
  "hero4",
  "hero5",
  "hero6",
  "unknown",
  "playertbd",
]);

function compactMarvelHeroKey(value = "") {
  return String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function normalizeMarvelHeroName(value) {
  if (!value) return null;
  const key = compactMarvelHeroKey(value);
  if (!key || MARVEL_RIVALS_INVALID_HERO_VALUES.has(key)) return null;
  if (MARVEL_RIVALS_ALIAS_MAP[key]) return MARVEL_RIVALS_ALIAS_MAP[key];

  const matchedHero = MARVEL_RIVALS_ALLOWED_HEROES.find((hero) => compactMarvelHeroKey(hero) === key);
  return matchedHero || null;
}

function normalizeMarvelNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[%,$,\s]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function averageMarvelRows(rows, key) {
  const values = rows
    .map((row) => normalizeMarvelNumber(row?.[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sumMarvelRows(rows, key) {
  const values = rows
    .map((row) => normalizeMarvelNumber(row?.[key]))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function addManualReviewField(fields, field) {
  if (!field || fields.includes(field)) return;
  fields.push(field);
}

function normalizeMarvelRow(row = {}, path, manualReviewFields, nulledHeroFields) {
  const rawHero = row.hero_confirmed ?? row.hero;
  const normalizedHero = normalizeMarvelHeroName(rawHero);
  const normalizedGuess = normalizeMarvelHeroName(row.hero_guess);
  const normalizedAssetMatch = normalizeMarvelHeroName(row.hero_asset_match);
  const rowHadHero = Boolean(rawHero);
  if (rowHadHero && !normalizedHero) {
    addManualReviewField(manualReviewFields, `${path}.hero`);
    nulledHeroFields.push(`${path}.hero`);
  }

  return {
    ...row,
    hero: normalizedHero,
    hero_guess: normalizedGuess,
    hero_asset_match: normalizedAssetMatch,
    hero_guess_confidence: normalizeMarvelNumber(row.hero_guess_confidence) ?? normalizeMarvelNumber(row.hero_confidence) ?? normalizeMarvelNumber(row.confidence) ?? 0,
    hero_confirmed: normalizedHero,
    hero_id: row.hero_id || null,
    costume_name: row.costume_name || null,
    costume_id: row.costume_id || null,
    hero_confidence: normalizeMarvelNumber(row.asset_confidence) ?? normalizeMarvelNumber(row.hero_asset_confidence) ?? normalizeMarvelNumber(row.hero_confidence) ?? normalizeMarvelNumber(row.hero_guess_confidence) ?? normalizeMarvelNumber(row.confidence) ?? 0,
    hero_asset_confidence: normalizeMarvelNumber(row.hero_asset_confidence) ?? null,
    asset_confidence: normalizeMarvelNumber(row.asset_confidence) ?? null,
    matched_asset_src: row.matched_asset_src || null,
    needs_manual_review: Boolean(row.needs_manual_review),
    needs_hero_review: Boolean(row.needs_hero_review || row.needs_manual_review || (!normalizedHero && normalizedAssetMatch)),
    kills: normalizeMarvelNumber(row.kills),
    deaths: normalizeMarvelNumber(row.deaths),
    assists: normalizeMarvelNumber(row.assists),
    final_hits: normalizeMarvelNumber(row.final_hits),
    damage: normalizeMarvelNumber(row.damage),
    damage_blocked: normalizeMarvelNumber(row.damage_blocked),
    healing: normalizeMarvelNumber(row.healing),
    accuracy_percent: normalizeMarvelNumber(row.accuracy_percent),
    medals: Array.isArray(row.medals) ? row.medals : [],
    is_mvp: Boolean(row.is_mvp),
    is_svp: Boolean(row.is_svp),
    confidence: normalizeMarvelNumber(row.confidence) ?? 0,
  };
}

function hasMarvelVisibleRowData(row = {}) {
  if (!row || typeof row !== "object") return false;
  if (row.player_name || row.kda_text) return true;

  return [
    "kills",
    "deaths",
    "assists",
    "final_hits",
    "damage",
    "damage_blocked",
    "healing",
    "accuracy_percent",
  ].some((key) => Number.isFinite(normalizeMarvelNumber(row[key])));
}

function applyMarvelDuplicateHeroSafety(rowEntries, pathPrefix, manualReviewFields, nulledHeroFields) {
  const byHero = new Map();

  rowEntries.forEach((entry, fallbackIndex) => {
    const row = entry?.row || entry;
    const index = entry?.index ?? fallbackIndex;
    if (!row.hero) return;
    const existingRows = byHero.get(row.hero) || [];
    existingRows.push({ row, index });
    byHero.set(row.hero, existingRows);
  });

  for (const [, duplicates] of byHero) {
    if (duplicates.length < 2) continue;

    const sorted = [...duplicates].sort((a, b) => Number(b.row.hero_confidence || 0) - Number(a.row.hero_confidence || 0));
    sorted.slice(1).forEach(({ row, index }) => {
      row.hero = null;
      row.hero_confirmed = null;
      addManualReviewField(manualReviewFields, `${pathPrefix}[${index}].hero`);
      nulledHeroFields.push(`${pathPrefix}[${index}].hero`);
    });
  }
}

function calculateMarvelTeamTotals(team = {}, players = []) {
  const existingTotals = team.team_totals || {};
  return {
    kills: normalizeMarvelNumber(existingTotals.kills) ?? sumMarvelRows(players, "kills"),
    deaths: normalizeMarvelNumber(existingTotals.deaths) ?? sumMarvelRows(players, "deaths"),
    assists: normalizeMarvelNumber(existingTotals.assists) ?? sumMarvelRows(players, "assists"),
    final_hits: normalizeMarvelNumber(existingTotals.final_hits) ?? sumMarvelRows(players, "final_hits"),
    damage: normalizeMarvelNumber(existingTotals.damage) ?? sumMarvelRows(players, "damage"),
    damage_blocked: normalizeMarvelNumber(existingTotals.damage_blocked) ?? sumMarvelRows(players, "damage_blocked"),
    healing: normalizeMarvelNumber(existingTotals.healing) ?? sumMarvelRows(players, "healing"),
    average_accuracy_percent: normalizeMarvelNumber(existingTotals.average_accuracy_percent) ?? averageMarvelRows(players, "accuracy_percent"),
  };
}

export function normalizeMarvelRivalsExtraction(rawJson = {}) {
  const manualReviewFields = Array.isArray(rawJson.fields_needing_manual_review)
    ? [...rawJson.fields_needing_manual_review]
    : [];
  const nulledHeroFields = [];

  const rows = Array.isArray(rawJson.rows)
    ? rawJson.rows.map((row, index) => normalizeMarvelRow(row, `rows[${index}]`, manualReviewFields, nulledHeroFields))
    : [];

  const teams = [0, 1].map((index) => {
    const rawTeam = Array.isArray(rawJson.teams) ? rawJson.teams[index] || {} : {};
    const rowPlayers = rows.filter((row) => row.team_key === `team_${index + 1}`);
    let players = Array.isArray(rawTeam.players)
      ? rawTeam.players.map((row, playerIndex) => normalizeMarvelRow(row, `teams[${index}].players[${playerIndex}]`, manualReviewFields, nulledHeroFields))
      : [];

    if ((!players.length || players.every((row) => !hasMarvelVisibleRowData(row))) && rowPlayers.length) {
      players = rowPlayers;
    }

    return {
      ...rawTeam,
      team_key: rawTeam.team_key || `team_${index + 1}`,
      players,
    };
  });

  if (!teams[0].players.length && !teams[1].players.length && rows.length) {
    teams[0].players = rows.slice(0, 6).map((row) => ({ ...row, team_key: row.team_key || "team_1" }));
    teams[1].players = rows.slice(6, 12).map((row) => ({ ...row, team_key: row.team_key || "team_2" }));
    if (rows.length !== 12) addManualReviewField(manualReviewFields, "rows");
  }

  applyMarvelDuplicateHeroSafety(rows.map((row, index) => ({ row, index })).filter(({ row }) => row.team_key === "team_1"), "rows", manualReviewFields, nulledHeroFields);
  applyMarvelDuplicateHeroSafety(rows.map((row, index) => ({ row, index })).filter(({ row }) => row.team_key === "team_2"), "rows", manualReviewFields, nulledHeroFields);

  teams.forEach((team, teamIndex) => {
    applyMarvelDuplicateHeroSafety(team.players, `teams[${teamIndex}].players`, manualReviewFields, nulledHeroFields);
    team.team_totals = calculateMarvelTeamTotals(team, team.players);
  });

  const shouldReview = Boolean(rawJson.manual_review_required || nulledHeroFields.length || rows.length !== 12);

  return {
    ...rawJson,
    rows,
    teams,
    fields_needing_manual_review: manualReviewFields,
    manual_review_required: shouldReview,
    meta: {
      ...(rawJson.meta || {}),
      hero_fields_nulled: nulledHeroFields,
    },
  };
}

const FIELD_COMPLETION_GAME_CONFIG = {
  "League of Legends": {
    expectedPlayersPerTeam: 5,
    pickField: "champion",
    pickLabel: "champion",
    defaultRoles: ["Top", "Jungle", "Mid", "ADC", "Support"],
    rowFields: {
      role: "text",
      player_name: "player",
      champion: "pick",
      level: "stat",
      kills: "stat",
      deaths: "stat",
      assists: "stat",
      kda_text: "kda",
      gold: "stat",
      damage_to_champions: "stat",
      items: "array",
      summoner_spells: "array",
      is_mvp: "boolean",
      confidence: "confidence",
    },
    matchFields: {
      result: "text",
      final_score: "text",
      team_1_score: "score",
      team_2_score: "score",
      game_length: "text",
      patch: "text",
      played_at: "text",
      map_or_mode: "text",
    },
  },
  Valorant: {
    expectedPlayersPerTeam: 5,
    uniquePicksPerTeam: true,
    pickField: "agent",
    pickLabel: "agent",
    rowFields: {
      player_name: "player",
      agent: "pick",
      avg_combat_score: "stat",
      kills: "stat",
      deaths: "stat",
      assists: "stat",
      kda_text: "kda",
      econ_rating: "stat",
      first_bloods: "stat",
      plants: "stat",
      defuses: "stat",
      small_agent_headshot_detected: "boolean",
      small_agent_headshot_description: "text",
      confidence: "confidence",
    },
    matchFields: {
      result: "text",
      final_score: "text",
      team_1_score: "score",
      team_2_score: "score",
      map: "text",
      played_at: "text",
      match_date_text: "text",
      duration: "text",
      number_of_games: "stat",
    },
  },
  "Overwatch 2": {
    expectedPlayersPerTeam: 5,
    aliases: ["Overwatch"],
    uniquePicksPerTeam: true,
    pickField: "hero",
    pickLabel: "hero",
    rowFields: {
      player_name: "player",
      hero: "pick",
      role: "text",
      eliminations: "stat",
      assists: "stat",
      deaths: "stat",
      damage: "stat",
      healing: "stat",
      mitigation: "stat",
      final_blows: "stat",
      objective_kills: "stat",
      confidence: "confidence",
    },
    matchFields: {
      result: "text",
      final_score: "text",
      team_1_score: "score",
      team_2_score: "score",
      team_1_name: "text",
      team_2_name: "text",
      map: "text",
      mode: "text",
      duration: "text",
      played_at: "text",
    },
  },
  "Marvel Rivals": {
    expectedPlayersPerTeam: 6,
    uniquePicksPerTeam: true,
    pickField: "hero_guess",
    pickLabel: "hero",
    rowFields: {
      player_name: "player",
      hero_guess: "pick",
      hero_guess_confidence: "confidence",
      hero_confirmed: "nullable",
      kills: "stat",
      deaths: "stat",
      assists: "stat",
      kda_text: "kda",
      medals: "array",
      final_hits: "stat",
      damage: "stat",
      damage_blocked: "stat",
      healing: "stat",
      accuracy_percent: "stat",
      is_mvp: "boolean",
      is_svp: "boolean",
      confidence: "confidence",
    },
    matchFields: {
      result: "text",
      final_score: "text",
      team_1_score: "score",
      team_2_score: "score",
      map: "text",
      objective_or_mode: "text",
      duration: "text",
      played_at: "text",
      match_date_text: "text",
    },
  },
  Deadlock: {
    expectedPlayersPerTeam: 6,
    uniquePicksPerTeam: true,
    pickField: "hero",
    pickLabel: "hero",
    rowFields: {
      player_name: "player",
      hero: "pick",
      souls: "stat",
      kills: "stat",
      deaths: "stat",
      assists: "stat",
      kda_text: "kda",
      player_damage: "stat",
      objective_damage: "stat",
      healing: "stat",
      confidence: "confidence",
    },
    matchFields: {
      result: "text",
      final_score: "nullable",
      team_1_score: "nullable",
      team_2_score: "nullable",
      team_1_name: "text",
      team_2_name: "text",
      duration: "text",
      match_id: "text",
      played_at: "text",
      match_date_text: "text",
    },
  },
};

FIELD_COMPLETION_GAME_CONFIG.Overwatch = FIELD_COMPLETION_GAME_CONFIG["Overwatch 2"];

const PLAYER_NAME_OCR_CORRECTIONS = new Map([
  ["lucnnif", "Lucnif"],
]);

const VALORANT_AGENT_PLAYER_CORRECTIONS = new Map([
  ["lts michey", "Neon"],
]);

const DEADLOCK_HERO_PLAYER_CORRECTIONS = new Map([
  ["ceejay", "McGinnis"],
]);

function isEmptyExtractionValue(value) {
  return value === null || value === undefined || value === "";
}

function addReviewField(fields, field) {
  if (field && !fields.includes(field)) fields.push(field);
}

function fallbackValueForKind(kind, { gameTitle, rowIndex, pickLabel, field, row }) {
  if (kind === "nullable") return null;
  if (kind === "array") return [];
  if (kind === "boolean") return false;
  if (kind === "confidence") return 0.25;
  if (kind === "player") return `Player ${rowIndex}`;
  if (kind === "pick") return `Unidentified ${pickLabel || "character"} ${rowIndex}`;
  if (kind === "kda") {
    const kills = row?.kills;
    const deaths = row?.deaths;
    const assists = row?.assists;
    if (!isEmptyExtractionValue(kills) && !isEmptyExtractionValue(deaths) && !isEmptyExtractionValue(assists)) {
      return `${kills}/${deaths}/${assists}`;
    }
    return "Needs review";
  }
  if (kind === "score") return "Needs review";
  if (kind === "stat") return "Needs review";
  if (field === "result") return "Needs review";
  return gameTitle === "Deadlock" && field === "final_score" ? null : "Needs review";
}

function getTeamSlotIndex(rowIndex, expectedPlayersPerTeam) {
  return ((Math.max(1, Number(rowIndex) || 1) - 1) % expectedPlayersPerTeam);
}

function fillObjectFields(target, fields, context, reviewFields, pathPrefix) {
  if (!target || typeof target !== "object") return target;

  Object.entries(fields || {}).forEach(([field, kind]) => {
    if (isEmptyExtractionValue(target[field])) {
      target[field] = fallbackValueForKind(kind, { ...context, field, row: target });
      if (kind !== "nullable") addReviewField(reviewFields, `${pathPrefix}.${field}`);
    }
  });

  return target;
}

function cloneRowWithCompletedFields(row, index, teamKey, config, gameTitle, reviewFields) {
  const rowIndex = Number(row?.row_index) || index + 1;
  const completed = {
    ...(row || {}),
    row_index: rowIndex,
    team_key: row?.team_key || teamKey || null,
  };
  fillObjectFields(
    completed,
    config.rowFields,
    { gameTitle, rowIndex, pickLabel: config.pickLabel },
    reviewFields,
    `rows[${rowIndex - 1}]`,
  );

  const playerNameKey = typeof completed.player_name === "string" ? completed.player_name.trim().toLowerCase() : "";
  if (PLAYER_NAME_OCR_CORRECTIONS.has(playerNameKey)) {
    completed.player_name = PLAYER_NAME_OCR_CORRECTIONS.get(playerNameKey);
  }
  if (gameTitle === "Valorant" && VALORANT_AGENT_PLAYER_CORRECTIONS.has(playerNameKey)) {
    completed.agent = VALORANT_AGENT_PLAYER_CORRECTIONS.get(playerNameKey);
  }
  if (gameTitle === "Deadlock" && DEADLOCK_HERO_PLAYER_CORRECTIONS.has(playerNameKey)) {
    completed.hero = DEADLOCK_HERO_PLAYER_CORRECTIONS.get(playerNameKey);
  }

  const pickValue = completed[config.pickField];
  if (config.defaultRoles?.length && (isEmptyExtractionValue(completed.role) || completed.role === "Needs review")) {
    completed.role = config.defaultRoles[getTeamSlotIndex(rowIndex, config.expectedPlayersPerTeam)] || completed.role;
  }
  if (config.pickField !== "hero" && isEmptyExtractionValue(completed.hero) && !isEmptyExtractionValue(pickValue)) {
    completed.hero = pickValue;
  }
  if (config.pickField !== "champion" && isEmptyExtractionValue(completed.champion) && !isEmptyExtractionValue(pickValue)) {
    completed.champion = pickValue;
  }
  if (config.pickField !== "agent" && isEmptyExtractionValue(completed.agent) && !isEmptyExtractionValue(pickValue)) {
    completed.agent = pickValue;
  }
  if (config.pickField !== "character" && isEmptyExtractionValue(completed.character) && !isEmptyExtractionValue(pickValue)) {
    completed.character = pickValue;
  }
  completed.character_build = completed.character_build || completed.build || completed.items?.join?.(", ") || pickValue || "Needs review";

  return completed;
}

function buildPlaceholderRow(index, teamKey) {
  return {
    row_index: index + 1,
    team_key: teamKey,
  };
}

function completeTeamsFromRows(rawTeams, rows, config, reviewFields) {
  const teams = [0, 1].map((index) => {
    const teamKey = `team_${index + 1}`;
    const rawTeam = Array.isArray(rawTeams) ? rawTeams[index] || {} : {};
    const players = rows.filter((row) => row.team_key === teamKey);
    return {
      ...rawTeam,
      team_key: rawTeam.team_key || teamKey,
      team_name: rawTeam.team_name || rawTeam.name || `Team ${index + 1}`,
      players,
      team_totals: rawTeam.team_totals || {},
    };
  });

  teams.forEach((team, teamIndex) => {
    if (team.players.length < config.expectedPlayersPerTeam) {
      addReviewField(reviewFields, `teams[${teamIndex}].players`);
    }
  });

  return teams;
}

function needsCompletedText(value) {
  return isEmptyExtractionValue(value) || String(value).trim().toLowerCase() === "needs review";
}

function compactPickKey(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isReviewPickValue(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized === "needs review" || normalized.startsWith("unidentified ");
}

function inferValorantTeamKeysByPlayerTags(rows) {
  if (!Array.isArray(rows) || rows.length < 8) return rows;

  const prefixes = rows
    .map((row) => String(row.player_name || "").trim().match(/^([A-Za-z0-9]{2,5})\b/)?.[1])
    .filter(Boolean);
  const counts = new Map();
  prefixes.forEach((prefix) => counts.set(prefix, (counts.get(prefix) || 0) + 1));
  const likelyPrefixes = [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([prefix]) => prefix);

  if (likelyPrefixes.length !== 2) return rows;

  const firstRowPrefix = String(rows[0]?.player_name || "").trim().match(/^([A-Za-z0-9]{2,5})\b/)?.[1];
  if (!firstRowPrefix || !likelyPrefixes.includes(firstRowPrefix)) return rows;
  const otherPrefix = likelyPrefixes.find((prefix) => prefix !== firstRowPrefix);
  if (!otherPrefix) return rows;

  rows.forEach((row) => {
    const prefix = String(row.player_name || "").trim().match(/^([A-Za-z0-9]{2,5})\b/)?.[1];
    if (prefix === firstRowPrefix) row.team_key = "team_1";
    if (prefix === otherPrefix) row.team_key = "team_2";
  });

  return rows;
}

function applyUniqueTeamPickSafety(rows, config, gameTitle, reviewFields) {
  if (!config.uniquePicksPerTeam) return;

  const pickField = config.pickField;
  const teamBuckets = new Map();
  rows.forEach((row, index) => {
    const teamKey = row.team_key || (index < config.expectedPlayersPerTeam ? "team_1" : "team_2");
    const pick = row[pickField] || row.hero_confirmed || row.hero || row.hero_guess || row.agent || row.champion;
    if (isReviewPickValue(pick)) return;
    const key = compactPickKey(pick);
    if (!key) return;
    const bucketKey = `${teamKey}:${key}`;
    const entries = teamBuckets.get(bucketKey) || [];
    entries.push({ row, index, pick });
    teamBuckets.set(bucketKey, entries);
  });

  for (const entries of teamBuckets.values()) {
    if (entries.length < 2) continue;

    const sorted = [...entries].sort((a, b) => Number(b.row.confidence || b.row.hero_confidence || b.row.hero_guess_confidence || 0) - Number(a.row.confidence || a.row.hero_confidence || a.row.hero_guess_confidence || 0));
    sorted.slice(1).forEach(({ row, index }) => {
      const rowNumber = Number(row.row_index) || index + 1;
      const placeholder = `Unidentified ${config.pickLabel || "character"} ${rowNumber}`;
      row[pickField] = placeholder;
      if (pickField === "hero_guess") {
        row.hero_guess = placeholder;
        row.hero = placeholder;
        row.hero_confirmed = null;
        row.needs_hero_review = true;
      }
      if (pickField === "hero") {
        row.hero = placeholder;
        row.hero_confirmed = null;
        row.needs_hero_review = true;
      }
      if (pickField === "agent") {
        row.agent = placeholder;
        row.needs_agent_review = true;
      }
      row.needs_manual_review = true;
      addReviewField(reviewFields, `rows[${index}].${pickField}`);
    });
  }
}

function completeLeagueMatchFromRows(match, teams) {
  const completedMatch = { ...match };
  const teamOneKills = normalizeMarvelNumber(completedMatch.team_1_score)
    ?? normalizeMarvelNumber(teams?.[0]?.team_totals?.kills)
    ?? sumMarvelRows(teams?.[0]?.players || [], "kills");
  const teamTwoKills = normalizeMarvelNumber(completedMatch.team_2_score)
    ?? normalizeMarvelNumber(teams?.[1]?.team_totals?.kills)
    ?? sumMarvelRows(teams?.[1]?.players || [], "kills");

  if (Number.isFinite(teamOneKills)) completedMatch.team_1_score = teamOneKills;
  if (Number.isFinite(teamTwoKills)) completedMatch.team_2_score = teamTwoKills;
  if (needsCompletedText(completedMatch.final_score) && Number.isFinite(teamOneKills) && Number.isFinite(teamTwoKills)) {
    completedMatch.final_score = `${teamOneKills}-${teamTwoKills}`;
  }

  return completedMatch;
}

export function completePostgameExtractionFields(rawJson = {}, gameTitle) {
  const config = FIELD_COMPLETION_GAME_CONFIG[gameTitle];
  if (!config) return rawJson;

  const reviewFields = Array.isArray(rawJson.fields_needing_manual_review)
    ? [...rawJson.fields_needing_manual_review]
    : [];
  const expectedRows = config.expectedPlayersPerTeam * 2;
  const rawRows = Array.isArray(rawJson.rows) ? rawJson.rows : [];
  const teamPlayers = Array.isArray(rawJson.teams)
    ? rawJson.teams.flatMap((team, teamIndex) => (team?.players || []).map((row) => ({
      ...row,
      team_key: row?.team_key || team?.team_key || `team_${teamIndex + 1}`,
    })))
    : [];
  const sourceRows = rawRows.length ? rawRows : teamPlayers;
  const completedRows = [];

  for (let index = 0; index < Math.max(sourceRows.length, expectedRows); index += 1) {
    const teamKey = index < config.expectedPlayersPerTeam ? "team_1" : "team_2";
    const sourceRow = sourceRows[index] || buildPlaceholderRow(index, teamKey);
    if (!sourceRows[index]) addReviewField(reviewFields, `rows[${index}]`);
    completedRows.push(cloneRowWithCompletedFields(sourceRow, index, sourceRow.team_key || teamKey, config, gameTitle, reviewFields));
  }
  if (gameTitle === "Valorant") {
    inferValorantTeamKeysByPlayerTags(completedRows);
  }
  applyUniqueTeamPickSafety(completedRows, config, gameTitle, reviewFields);

  let completedMatch = fillObjectFields(
    { ...(rawJson.match || {}) },
    config.matchFields,
    { gameTitle, rowIndex: 0, pickLabel: config.pickLabel },
    reviewFields,
    "match",
  );
  const completedTeams = completeTeamsFromRows(rawJson.teams, completedRows, config, reviewFields);
  if (gameTitle === "League of Legends") {
    completedMatch = completeLeagueMatchFromRows(completedMatch, completedTeams);
  }

  return {
    ...rawJson,
    match: completedMatch,
    rows: completedRows,
    teams: completedTeams,
    fields_needing_manual_review: reviewFields,
    manual_review_required: Boolean(rawJson.manual_review_required || reviewFields.length),
    parser_confidence: normalizeMarvelNumber(rawJson.parser_confidence) ?? 0.25,
  };
}

export const POSTGAME_SCREENSHOT_STATS = {
  "League of Legends": {
    pickField: "champion",
    pickLabel: "Champion",
    mapLabel: "Scrim Context",
    visibleStats: [
      "Result, final kill score, patch, game length, played time if visible",
      "Champion, role, player name, level, K/D/A, gold, damage to champions, and items when visible",
      "Team totals for kills, deaths, assists, gold, damage, and clearly visible objectives",
    ],
  },
  Valorant: {
    pickField: "agent",
    pickLabel: "Agent",
    mapLabel: "Map",
    visibleStats: [
      "Result, final score, map, match date, match duration, and number of games if visible",
      "Small row agent headshot identity, player name, Avg Combat Score, K/D/A, Econ Rating, first bloods, plants, and defuses when visible",
      "Team totals for kills, deaths, assists, average ACS, average econ rating, first bloods, plants, and defuses when grouping is reliable",
    ],
  },
  "Counter-Strike 2": {
    pickField: "role",
    pickLabel: "Role",
    mapLabel: "Map",
    visibleStats: [
      "Result, final round score, map, side halves if visible",
      "Player name, kills, assists, deaths, ADR, HS%, MVP/stars, score/rating if visible",
      "Team totals for kills, deaths, assists, average ADR, HS%, MVPs, and score when visible",
    ],
  },
  "Rocket League": {
    pickField: "car",
    pickLabel: "Car / Role",
    mapLabel: "Arena / Mode",
    visibleStats: [
      "Result, final goal score, arena, playlist/mode, match length if visible",
      "Player name, score, goals, assists, saves, shots, demos, ping when visible",
      "Team totals for goals, assists, saves, shots, demos, and scoreboard score",
    ],
  },
  "Overwatch 2": {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Map / Mode",
    visibleStats: [
      "Result, map, mode, round score or objective progress when visible",
      "Hero, role, player name, eliminations, assists, deaths, damage, healing, mitigation when visible",
      "Team totals for eliminations, assists, deaths, damage, healing, and mitigation",
    ],
  },
  "Marvel Rivals": {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Map / Objective",
    visibleStats: [
      "Result, final score if visible, Team 1 / Team 2 score if visible, map, objective or mode text, and match duration when visible",
      "Player row hero portrait identity, player name, K/D/A icon columns, medals, final hits, damage, damage blocked, healing, accuracy, MVP, and SVP when visible",
      "Team totals for kills, deaths, assists, final hits, damage, damage blocked, healing, and average accuracy percent when grouping is reliable",
      "Bans or picks only when clearly visible and labeled",
    ],
  },
  Deadlock: {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Match / Lane",
    visibleStats: [
      "Result, match duration, lane or mode if visible",
      "Hero, player name, kills, deaths, assists, net worth/souls, player damage, objective damage, healing when visible",
      "Team totals for kills, deaths, assists, souls/net worth, player damage, and objective damage",
    ],
  },
  SSBU: {
    pickField: "character",
    pickLabel: "Character",
    mapLabel: "Ruleset / Stage",
    visibleStats: [
      "Result, ruleset, stage, mode, team/crew score when visible",
      "Character, player tag, KOs, falls, self-destructs, damage dealt, damage taken, stocks remaining when visible",
      "Team totals for KOs, falls, self-destructs, stocks, and crew score",
    ],
  },
  "Honor of Kings": {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Mode",
    visibleStats: [
      "Result, final kill score, mode, match length, played time if visible",
      "Hero portrait or hero name identity, role, player name, K/D/A, gold, damage, damage taken, healing, participation/rating/MVP when visible",
      "Team totals for kills, deaths, assists, gold, damage, damage taken, healing, and clearly visible objectives",
    ],
  },
};

function createPrompt(gameTitle) {
  const config = POSTGAME_SCREENSHOT_STATS[gameTitle];
  const visibleStats = config?.visibleStats?.map((stat) => `- ${stat}`).join("\n") || "- Generic visible post-game scoreboard fields.";

  return `
You are extracting ${gameTitle} post-game scoreboard data for Matchmake.
${commonPromptRules}

Available screenshot stats for this game:
${visibleStats}

Return JSON using these top-level fields:
match_result, final_score, team_score, opponent_score, opponent_name, played_at,
team_comp, opponent_comp, team_stats, opponent_stats, notes, parser_status,
parser_confidence, manual_edit_required.
  `.trim();
}

export function getLeagueExtractionPrompt() {
  return `
Analyze this League of Legends post-game scoreboard screenshot and extract only visible scoreboard data into valid JSON.

Rules:
- Return JSON only.
- Do not explain.
- Do not guess hidden stats.
- Do not use external League API knowledge.
- Do not leave returned row fields empty. If a visible text/stat field is unreadable, use "Needs review" and add the field path to fields_needing_manual_review.
- Every player row must include a non-empty champion value. If the champion cannot be identified, use "Unidentified champion <row number>" and add the champion field path to fields_needing_manual_review.
- Preserve both teams separately.
- Extract all visible player rows.
- Split K/D/A into kills, deaths, assists. For example "12 / 2 / 3" means kills=12, deaths=2, assists=3.
- Convert numbers like "12,234" into integers.
- Only extract objectives, items, spells, damage, or gold if clearly visible.
- If uncertain, use "Needs review" or the unidentified champion placeholder above and add the field to fields_needing_manual_review.
- Keep the response compact. Do not include fields that are not in the schema below.
- The screenshot may show "TEAM 1" and "TEAM 2"; keep those as separate team rows.
- In the common League post-game scoreboard style, the first large numeric column under the crossed-swords icon is damage to champions, and the second large numeric column under the gold/coin icon is gold. Do not swap these columns.
- Extract match.game_length from the top match-summary metadata when visible. It often appears after the queue/result text and W-L record, for example "... W:86 - L:72 • 24:43 ..."; in that case game_length is "24:43".
- Do not confuse item cooldowns, score numbers, dates, or player stat values for game_length. Use only a duration-like value from the match header/summary area.

Return this exact schema:
{
  "game_title": "League of Legends",
  "screenshot_type": "post_game_scoreboard",
  "parser_confidence": 0,
  "manual_review_required": true,
  "match": {
    "result": null,
    "patch": null,
    "game_length": null,
    "played_at": null,
    "final_score": null,
    "team_1_score": null,
    "team_2_score": null,
    "map_or_mode": null
  },
  "teams": [
    {
      "team_key": "team_1",
      "team_name": null,
      "side": null,
      "is_user_team": null,
      "team_totals": {
        "kills": null,
        "deaths": null,
        "assists": null,
        "gold": null,
        "damage_to_champions": null
      },
      "players": [
        {
          "slot": 1,
          "role": null,
          "player_name": null,
          "champion": null,
          "level": null,
          "kills": null,
          "deaths": null,
          "assists": null,
          "kda_text": null,
          "gold": null,
          "damage_to_champions": null,
          "items": [],
          "summoner_spells": [],
          "is_mvp": false,
          "confidence": 0
        }
      ]
    },
    {
      "team_key": "team_2",
      "team_name": null,
      "side": null,
      "is_user_team": null,
      "team_totals": {
        "kills": null,
        "deaths": null,
        "assists": null,
        "gold": null,
        "damage_to_champions": null
      },
      "players": []
    }
  ],
  "derived_team_stats": {
    "team_1": {
      "total_kills_from_rows": null,
      "total_deaths_from_rows": null,
      "total_assists_from_rows": null,
      "total_gold_from_rows": null,
      "total_damage_to_champions_from_rows": null
    },
    "team_2": {
      "total_kills_from_rows": null,
      "total_deaths_from_rows": null,
      "total_assists_from_rows": null,
      "total_gold_from_rows": null,
      "total_damage_to_champions_from_rows": null
    }
  },
  "fields_needing_manual_review": []
}
  `.trim();
}

export function getValorantExtractionPrompt() {
  return `
Analyze this Valorant full post-game match results screenshot and extract only visible data into valid JSON.

The screenshot may show the full Valorant match results screen, including the header, final score, result, map, match date, match duration, and the full player scoreboard.

Rules:
- Return JSON only.
- Do not explain.
- Do not use Riot API or external data.
- Do not guess hidden stats.
- Only extract values visible in the screenshot.
- Do not leave returned row fields empty. If a visible text/stat field is unreadable, use "Needs review" and add the field path to fields_needing_manual_review.
- Every player row must include a non-empty agent value. If the row portrait cannot be identified, use "Unidentified agent <row number>" and add the agent field path to fields_needing_manual_review.
- Preserve player row order exactly as shown.
- Extract all 10 visible player rows if present.
- Extract the small square agent portrait/headshot at the far left of each row as the agent identity only when it is clearly recognizable.
- Valorant row portraits are tiny and easy to confuse. If the agent portrait is not clearly identifiable, use the unidentified agent placeholder and keep the row stats.
- Use the attached Valorant reference sheet/metadata as the visual source of truth for agent portraits. Return only an agent name from that reference list or an unidentified placeholder.
- Do not repeat the same agent within the same team. If two same-team rows appear to be the same agent, keep the clearest one and mark the other row as "Unidentified agent <row number>" for review.
- Do not output a confident agent name from color, role, row tint, player name, or vague portrait resemblance.
- Use only the small scoreboard headshots for agent identification.
- Do not use large splash art, full-body art, store icons, party icons, right-side social icons, friend list icons, or unrelated UI images.
- If the screenshot shows row tint/color grouping, use it to group team_1 and team_2.
- If teams are mixed because the scoreboard is individually sorted, preserve row order and use team_key only when visually clear.
- Valorant scoreboards use this player-row column order after the player/agent area: AVG COMBAT SCORE, KDA, ECON RATING, FIRST BLOODS, PLANTS, DEFUSES.
- Read kills, deaths, and assists only from the three slash-separated numbers in the KDA column.
- The KDA column is between AVG COMBAT SCORE and ECON RATING. Never copy assist values from ECON RATING, FIRST BLOODS, PLANTS, DEFUSES, social icons, or any right-side panel.
- Preserve kda_text exactly as the visible KDA group normalized with slashes, and make kills/deaths/assists equal those three components.
- Example: if the KDA column shows 45 / 35 / 18, return kills=45, deaths=35, assists=18, kda_text="45/35/18". Do not return assists=10 from nearby columns.
- If any KDA digit is ambiguous, use "Needs review" for that row's ambiguous KDA field(s) and add those field paths to fields_needing_manual_review.
- Convert numeric values to integers.
- Extract map/date/duration from the upper-left match info when visible.
- Extract match result and final score from the top center when visible.
- Do not extract mode.
- Do not extract queue_or_mode.
- Do not extract selected tab.
- Do not extract ADR.
- Do not extract headshot percentage.
- Do not extract clutches.
- Do not extract eco round history.
- If uncertain, use "Needs review" or the unidentified agent placeholder above and add the field to fields_needing_manual_review.

Return this JSON schema exactly:

{
  "game_title": "Valorant",
  "screenshot_type": "full_post_game_match_results",
  "parser_confidence": 0,
  "manual_review_required": true,
  "match": {
    "result": null,
    "winning_side": null,
    "final_score": null,
    "team_1_score": null,
    "team_2_score": null,
    "map": null,
    "played_at": null,
    "match_date_text": null,
    "duration": null,
    "number_of_games": null
  },
  "rows": [
    {
      "row_index": 1,
      "team_key": null,
      "row_color_group": null,
      "player_name": null,
      "agent": null,
      "avg_combat_score": null,
      "kills": null,
      "deaths": null,
      "assists": null,
      "kda_text": null,
      "econ_rating": null,
      "first_bloods": null,
      "plants": null,
      "defuses": null,
      "small_agent_headshot_detected": true,
      "small_agent_headshot_description": null,
      "confidence": 0
    }
  ],
  "teams": [
    {
      "team_key": "team_1",
      "row_color_group": null,
      "is_winning_team": null,
      "team_score": null,
      "team_totals": {
        "kills": null,
        "deaths": null,
        "assists": null,
        "average_acs": null,
        "average_econ_rating": null,
        "total_first_bloods": null,
        "total_plants": null,
        "total_defuses": null
      },
      "players": []
    },
    {
      "team_key": "team_2",
      "row_color_group": null,
      "is_winning_team": null,
      "team_score": null,
      "team_totals": {
        "kills": null,
        "deaths": null,
        "assists": null,
        "average_acs": null,
        "average_econ_rating": null,
        "total_first_bloods": null,
        "total_plants": null,
        "total_defuses": null
      },
      "players": []
    }
  ],
  "fields_needing_manual_review": []
}

Specific extraction instructions:
1. Match result:
   - If the top center says VICTORY, set match.result = "victory".
   - If it says DEFEAT, set match.result = "defeat".
   - If another result is visible, record it lowercase.

2. Final score:
   - If the top center shows something like 13 VICTORY 6:
     - final_score = "13 - 6"
     - team_1_score = 13
     - team_2_score = 6
   - Preserve the visible order from left to right.

3. Map/date/duration:
   - Read the upper-left match info.
   - Store match.match_date_text as the visible date string.
   - Store match.map as the visible map name.
   - Store match.duration as the visible duration string.
   - Do not store mode or queue information.

4. Player rows:
   - Extract each row from top to bottom.
   - For each row extract player_name, agent, avg_combat_score, kills, deaths, assists, econ_rating, first_bloods, plants, and defuses.
   - First identify the row's KDA column as the three-number slash group immediately after avg_combat_score and immediately before econ_rating.
   - Set kda_text to that exact group, then split it left-to-right into kills, deaths, assists.
   - Do not infer assists from the last visible digit near the econ, first_bloods, plants, or defuses columns.

5. Team grouping:
   - If teal/green rows and red/pink rows indicate teams, group them accordingly.
   - If the winning/losing team can be inferred from final score and row colors, set is_winning_team.
   - If team grouping is not reliable because of individual sorting, still return rows[] accurately and set manual_review_required = true.

6. Team totals:
   - Calculate team_totals by summing grouped visible player rows when grouping is reliable.
   - average_acs should be the average of grouped player avg_combat_score values.
   - average_econ_rating should be the average of grouped player econ_rating values.
   - If grouping is unclear, set team_totals fields to null.

7. Agent portraits:
   - small_agent_headshot_detected should be true if a small row portrait exists.
   - small_agent_headshot_description can describe the small portrait if helpful.
   - Do not output image data.
   - Do not use the vertical right-side social/friend icons as agent portraits.
   - Do not use any large background art.

8. Confidence:
   - Set row confidence based on readability.
   - Set parser_confidence overall.
   - Add low-confidence fields to fields_needing_manual_review.
  `.trim();
}

export function getOverwatchExtractionPrompt() {
  return `
Analyze this Overwatch 2 post-game scoreboard screenshot and extract only visible scoreboard data into valid JSON.

Rules:
- Return JSON only.
- Do not explain.
- Do not guess hidden stats.
- Do not use external game APIs or hero knowledge beyond visible UI text/portraits.
- Do not leave returned row fields empty. If a visible text/stat field is unreadable, use "Needs review" and add the field path to fields_needing_manual_review.
- Every player row must include a non-empty hero value. If the hero cannot be identified, use "Unidentified hero <row number>" and add the hero field path to fields_needing_manual_review.
- Read visible hero-name text in the scoreboard row first. If the row only has a portrait, identify it only when clear; otherwise use an unidentified placeholder.
- Do not repeat the same hero within the same team. If two same-team rows appear to be the same hero, keep the clearest one and mark the other row as "Unidentified hero <row number>" for review.
- Preserve both teams separately.
- Extract all visible player rows.
- Convert numbers like "12,234" into integers.
- Keep the response compact. Do not include fields that are not in the schema below.

The screenshot may show:
- match result such as Victory or Defeat
- final score, round score, objective progress, map, mode, and match duration when visible
- a top-left header like "TIME: 2:48"; extract this exact value as match.duration
- two teams, usually 5 or 6 players per team depending on the ruleset
- hero, role, player name, eliminations, assists, deaths, damage, healing, mitigation, final blows, and objective kills when visible

OVERWATCH SCOREBOARD RULES:
- The visible scoreboard columns are often abbreviated. Map E or ELIMS to eliminations, A to assists, D to deaths, DMG to damage, H to healing, and MIT to mitigation.
- Some Overwatch scoreboards show a circular ultimate-charge number between the hero/name area and the E/A/D columns. Do not extract that circular number as eliminations, assists, deaths, score, or any saved stat.
- The E column starts under the header labeled "E", after the circular ultimate-charge icon. Read across from the E/A/D/DMG/H/MIT headers, not from the circle.
- Example: if a Junker Queen row shows a circular "9" before the E column and then "6 3 2 1,928 173 260" under E/A/D/DMG/H/MIT, extract eliminations=6, assists=3, deaths=2, damage=1928, healing=173, mitigation=260, and ignore the circular 9.
- Example: if a Tracer row shows a circular "32" before the E column and then "7 0 2 1,046 0 0", extract eliminations=7, assists=0, deaths=2, damage=1046, healing=0, mitigation=0, and ignore the circular 32.
- Use only the left/main scoreboard table rows for player stats.
- Ignore the right-side selected-hero detail panel for player rows and team totals. It may show selected hero stats like Final Blows, Solo Kill, Weapon Accuracy, Direct Hit Accuracy, Concussion Mine Kill, Enemies Trapped, or Rip-Tire Kills; do not copy those into the saved row fields unless the same value is explicitly shown in the main scoreboard row.
- Do not treat damage, healing, or mitigation as the final match score.
- If teams are not labeled, use team_1 for the left/top/first visible team and team_2 for the other side.
- If only one team is clearly visible, return that team and leave the other team empty, with manual_review_required=true.
- If the user team side is unclear, keep the visible order and set manual_review_required=true.

Return this JSON shape:
{
  "game_title": "Overwatch 2",
  "match": {
    "result": "victory | defeat | null",
    "final_score": "2 - 1 | Victory | null",
    "team_1_score": 2,
    "team_2_score": 1,
    "team_1_name": "Team 1 | null",
    "team_2_name": "Team 2 | null",
    "map": "King's Row | null",
    "mode": "Hybrid | Push | Control | Flashpoint | Escort | Clash | null",
    "duration": "12:34 | null",
    "played_at": null
  },
  "teams": [
    {
      "team_key": "team_1",
      "team_name": null,
      "is_winning_team": true,
      "team_score": 2,
      "team_totals": {
        "eliminations": 124,
        "assists": 85,
        "deaths": 43,
        "damage": 50900,
        "healing": 27900,
        "mitigation": 21150,
        "final_blows": null,
        "objective_kills": null
      },
      "players": [
        {
          "row_index": 1,
          "team_key": "team_1",
          "hero": "Reinhardt | null",
          "role": "Tank | Damage | Support | Flex | null",
          "player_name": "Player | null",
          "eliminations": 23,
          "assists": 11,
          "deaths": 6,
          "damage": 9100,
          "healing": 0,
          "mitigation": 18400,
          "final_blows": null,
          "objective_kills": null,
          "confidence": 0.8
        }
      ]
    }
  ],
  "rows": [],
  "fields_needing_manual_review": [],
  "manual_review_required": false,
  "parser_confidence": 0.8
}

After extraction:
- Fill rows[] with every visible player row from both teams in visual order.
- Compute team_totals from visible player rows when explicit totals are not shown.
- Make sure no hidden stats are included.
  `.trim();
}

export function getCounterStrikeExtractionPrompt() {
  return `
Analyze this Counter-Strike 2 post-game scoreboard screenshot and extract only visible scoreboard data into valid JSON.

Rules:
- Return JSON only.
- Do not explain.
- Do not guess hidden stats.
- If a value is not visible, return null.
- Preserve both teams separately.
- Convert numbers like "12,234" into integers.
- Split K/A/D or K-D-A text into kills, assists, and deaths when visible.

Extract only visible CS2 stats Matchmake stores:
- match result, final round score, map, side halves, and match duration when visible
- player name, role/position only if visibly labeled, kills, assists, deaths, ADR, HS%, MVPs/stars, score/rating
- team totals for kills, deaths, assists, average ADR, average HS%, MVPs, and score

Return this JSON shape:
{
  "game_title": "Counter-Strike 2",
  "match": {
    "result": "victory | defeat | null",
    "final_score": "13 - 9 | null",
    "team_1_score": 13,
    "team_2_score": 9,
    "team_1_name": null,
    "team_2_name": null,
    "map": "Mirage | null",
    "duration": "38:12 | null",
    "side_halves": "8-4 / 5-5 | null",
    "played_at": null
  },
  "teams": [
    {
      "team_key": "team_1",
      "team_name": null,
      "team_score": 13,
      "is_winning_team": true,
      "team_totals": {
        "kills": 91,
        "assists": 34,
        "deaths": 79,
        "average_adr": 76,
        "average_hs_percent": 39,
        "mvps": 11,
        "score": null
      },
      "players": [
        {
          "row_index": 1,
          "team_key": "team_1",
          "player_name": "Player | null",
          "role": null,
          "kills": 20,
          "assists": 6,
          "deaths": 15,
          "adr": 82,
          "hs_percent": 44,
          "mvps": 3,
          "score": null,
          "rating": null,
          "confidence": 0.8
        }
      ]
    }
  ],
  "rows": [],
  "fields_needing_manual_review": [],
  "manual_review_required": false,
  "parser_confidence": 0.8
}

After extraction:
- Fill rows[] with every visible player row from both teams in visual order.
- Compute team_totals from visible player rows when explicit totals are not shown.
- Do not include hidden economy, utility, or weapon data unless explicitly visible.
  `.trim();
}

export function getRocketLeagueExtractionPrompt() {
  return `
Analyze this Rocket League post-game scoreboard screenshot and extract only visible scoreboard data into valid JSON.

Rules:
- Return JSON only.
- Do not explain.
- Do not guess hidden stats.
- If a value is not visible, return null.
- Preserve both teams separately.
- Convert numbers like "1,591" into integers.

Extract only visible Rocket League stats Matchmake stores:
- match result, final goal score, arena, playlist/mode, and match length when visible
- player name, car/role only if visible, score, goals, assists, saves, shots, demos, ping
- team totals for goals, assists, saves, shots, demos, and scoreboard score

Return this JSON shape:
{
  "game_title": "Rocket League",
  "match": {
    "result": "victory | defeat | null",
    "final_score": "4 - 2 | null",
    "team_1_score": 4,
    "team_2_score": 2,
    "team_1_name": null,
    "team_2_name": null,
    "arena": "DFH Stadium | null",
    "mode": "3v3 | null",
    "duration": "5:00 | null",
    "played_at": null
  },
  "teams": [
    {
      "team_key": "team_1",
      "team_name": null,
      "team_score": 4,
      "is_winning_team": true,
      "team_totals": {
        "goals": 4,
        "assists": 4,
        "saves": 7,
        "shots": 10,
        "demos": 1,
        "scoreboard_score": 1591
      },
      "players": [
        {
          "row_index": 1,
          "team_key": "team_1",
          "player_name": "Player | null",
          "car": null,
          "score": 642,
          "goals": 2,
          "assists": 1,
          "saves": 1,
          "shots": 5,
          "demos": 0,
          "ping": null,
          "confidence": 0.8
        }
      ]
    }
  ],
  "rows": [],
  "fields_needing_manual_review": [],
  "manual_review_required": false,
  "parser_confidence": 0.8
}

After extraction:
- Fill rows[] with every visible player row from both teams in visual order.
- Compute team_totals from visible player rows when explicit totals are not shown.
- Do not include hidden boost, speed, possession, or replay stats.
  `.trim();
}

export function getHonorOfKingsExtractionPrompt() {
  return `
Analyze this Honor of Kings post-game scoreboard screenshot and extract only visible scoreboard data into valid JSON.

Rules:
- Return JSON only.
- Do not explain.
- Do not guess hidden stats.
- Do not use external game APIs or hero knowledge beyond visible UI text/portraits.
- Do not leave returned row fields empty. If a visible text/stat field is unreadable, use "Needs review" and add the field path to fields_needing_manual_review.
- Every player row must include a non-empty hero value. If the hero cannot be identified, use "Unidentified hero <row number>" and add the hero field path to fields_needing_manual_review.
- Preserve both teams separately.
- Convert numbers like "56,500" into integers.
- Split K/D/A text into kills, deaths, and assists.

Extract only visible Honor of Kings stats Matchmake stores:
- match result, final kill score, mode/map, match length, and played time when visible
- hero, role/lane, player name, kills, deaths, assists, gold, damage, damage taken, healing, participation/rating/MVP when visible
- team totals for kills, deaths, assists, gold, damage, damage taken, healing, and objectives when clearly visible

HERO IDENTIFICATION:
- Honor of Kings is a hero-based game. Every visible player row should try to identify the hero from the row portrait or visible hero name.
- Use the visible scoreboard only. Do not use external APIs, skins, rank badges, role icons, or player avatars as hero identity.
- Return hero as the best visible hero name only when reasonably confident.
- Also return hero_guess with the best guess, hero_confidence from 0 to 1, and needs_hero_review=true when the portrait/name is unclear or low confidence.
- Do not output placeholders such as Hero 1, Unknown, or Player TBD. Use "Unidentified hero <row number>" when uncertain.

Return this JSON shape:
{
  "game_title": "Honor of Kings",
  "match": {
    "result": "victory | defeat | null",
    "final_score": "18 - 11 | null",
    "team_1_score": 18,
    "team_2_score": 11,
    "team_1_name": null,
    "team_2_name": null,
    "mode": "Ranked 5v5 | null",
    "duration": "18:42 | null",
    "played_at": null
  },
  "teams": [
    {
      "team_key": "team_1",
      "team_name": null,
      "team_score": 18,
      "is_winning_team": true,
      "team_totals": {
        "kills": 18,
        "deaths": 11,
        "assists": 41,
        "gold": 56500,
        "damage": 125800,
        "damage_taken": 110100,
        "healing": 9200,
        "objectives": null
      },
      "players": [
        {
          "row_index": 1,
          "team_key": "team_1",
          "hero": "Hero | null",
          "hero_guess": "Hero | null",
          "hero_confidence": 0.8,
          "needs_hero_review": false,
          "role": "Clash Lane | Jungle | Mid | Farm Lane | Roam | null",
          "player_name": "Player | null",
          "kills": 4,
          "deaths": 2,
          "assists": 7,
          "gold": 11800,
          "damage": 24500,
          "damage_taken": 30100,
          "healing": 1200,
          "participation_percent": null,
          "rating": null,
          "is_mvp": false,
          "confidence": 0.8
        }
      ]
    }
  ],
  "rows": [],
  "fields_needing_manual_review": [],
  "manual_review_required": false,
  "parser_confidence": 0.8
}

After extraction:
- Fill rows[] with every visible player row from both teams in visual order.
- Compute team_totals from visible player rows when explicit totals are not shown.
- Make sure no hidden item/build/rank data is included.
  `.trim();
}

export function getMarvelRivalsExtractionPrompt() {
  return `
Analyze this Marvel Rivals post-game scoreboard screenshot and extract only visible scoreboard data into valid JSON.

Return JSON only. Do not explain. Do not include markdown.

The final image is the uploaded scoreboard screenshot to extract.

You may also receive reference material before the scoreboard image:
- A Marvel Rivals base hero reference sheet.
- Marvel Rivals costume reference sheets.
- Costume metadata grouped by base hero.

Use reference material only to help identify the small hero portrait inside each scoreboard row.
Do not extract match data from reference material.
Only the final uploaded scoreboard image contains the match data.

The screenshot may include:
- match result, such as VICTORY or DEFEAT
- final score if visible
- map name in the top-right
- objective/mode name in the top-right
- match duration in the top-right
- two teams, usually 6 players per team
- blue/purple team rows and orange/red team rows
- player names
- small hero portraits inside each player row
- K/D/A columns shown with three combat icons
- Medals column
- Final Hits
- Damage
- Damage Blocked
- Healing
- Accuracy

Rules:
- Only extract data visible in the screenshot.
- Do not use external APIs or hidden game data.
- Do not guess hidden stats.
- Do not leave returned row fields empty. If a visible text/stat field is unreadable, use "Needs review" and add the field path to fields_needing_manual_review.
- Every player row must include a non-empty hero_guess value. If the row portrait cannot be identified, use "Unidentified hero <row number>" and add hero_guess to fields_needing_manual_review.
- Preserve row order from top to bottom.
- Preserve team grouping exactly as shown.
- Extract all visible player rows.
- The scoreboard normally has 12 rows total, 6 per team.
- Extract only these gameplay stats because these are the Marvel Rivals stats Matchmake stores:
  - player name
  - hero_guess from the small row portrait when confident
  - kills
  - deaths
  - assists
  - medals when visible
  - final hits
  - damage
  - damage blocked
  - healing
  - accuracy percent
  - MVP/SVP if clearly attached

Hero identification:
- Use only the small hero portrait inside the same scoreboard row.
- Compare default-looking row portraits against the base hero reference sheet first. That sheet uses the compact scoreboard headshot style and is the best lookup when no costume art is visible.
- Use the base hero and costume reference sheets to map row portraits to a base hero name.
- If a costume icon matches, return the base hero name, not the costume name.
- Costume/skin portraits are common on the scoreboard. Before returning an unidentified hero, compare the row portrait against every attached costume reference sheet and the costume metadata grouped by base hero.
- If the row portrait resembles a costume more than the default hero portrait, still return the associated base hero name as hero_guess and include the costume name only if the schema has a costume_name field.
- Do not use ban/pick strip portraits, background art, MVP/SVP side art, role icons, medal icons, UI icons, team icons, or menus.
- Do not output role names such as Vanguard, Duelist, Strategist, or Flex.
- Do not output placeholders such as Hero 1, Hero 2, Unknown, or Player TBD.
- If the row portrait is unclear, return hero_guess = "Unidentified hero <row number>".
- Return portrait_crop_hint for the row portrait if you can locate it confidently; otherwise leave the crop values null.
- hero_confirmed should always be null. The app/user confirms heroes later.

K/D/A RULE:
The three combat-stat columns immediately after Player Name are K/D/A.
- first number = kills
- second number = deaths
- third number = assists
- kda_text = "kills/deaths/assists"

SAVED STAT COLUMN RULE:
After Medals, the saved numeric columns appear left-to-right as Final Hits, Damage, Damage Blocked, Healing, Accuracy.
- The number immediately after Medals is final_hits.
- The next number is damage.
- The next number is damage_blocked.
- The next number is healing.
- The rightmost percentage is accuracy_percent.
- Never copy Damage Blocked into damage, and never skip the Damage column.
- Example: if a row shows Final Hits 3, Damage 4554, Damage Blocked 3237, Healing 0, Accuracy 33%, return final_hits=3, damage=4554, damage_blocked=3237, healing=0, accuracy_percent=33.

NUMBER RULES:
- Convert comma numbers into integers.
  Example: "47,407" becomes 47407.
- Convert percentages into numbers.
  Example: "16%" becomes 16.
- If a visible number is unreadable, return "Needs review" and add that field path to fields_needing_manual_review.
- Do not estimate unreadable numbers.

MATCH HEADER RULES:
- If VICTORY is visible, match.result = "victory".
- If DEFEAT is visible, match.result = "defeat".
- Extract map/objective/duration only from visible top-right match text.
- Example top-right text may contain:
  - map: HELLFIRE GALA-ARAKKO
  - objective/mode: CONVOY
  - duration: 00:31:20
- If team score is visible, extract it.
- If no score is visible, return null.

TEAM GROUPING RULES:
- Use visual row color to assign team groups.
- Blue/purple section = one team.
- Orange/red section = the other team.
- team_1 should be the first team section shown from top to bottom.
- team_2 should be the second team section shown from top to bottom.
- Put each player row in both rows[] and the correct teams[].players array.
- If team grouping is unclear, still return rows[] and set manual_review_required = true.

MEDALS RULE:
- Extract medals only if visible in the Medals column.
- If medals are icons and cannot be named, return a simple array of visible medal descriptions or symbols if possible.
- If unclear, return [].

MVP/SVP RULE:
- Mark is_mvp = true only if MVP is clearly attached to that player or team section.
- Mark is_svp = true only if SVP is clearly attached to that player or team section.
- If unclear, leave false.

Return this exact JSON shape:
{
  "game_title": "Marvel Rivals",
  "screenshot_type": "post_game_scoreboard",
  "parser_confidence": 0,
  "manual_review_required": true,
  "match": {
    "result": null,
    "final_score": null,
    "team_1_score": null,
    "team_2_score": null,
    "map": null,
    "objective_or_mode": null,
    "duration": null,
    "played_at": null,
    "match_date_text": null
  },
  "rows": [
    {
      "row_index": 1,
      "team_key": null,
      "row_color_group": null,
      "player_name": null,
      "hero_guess": null,
      "hero_guess_confidence": 0,
      "hero_confirmed": null,
      "portrait_crop_hint": {
        "x": null,
        "y": null,
        "width": null,
        "height": null,
        "coordinate_space": "normalized_0_1000"
      },
      "kills": null,
      "deaths": null,
      "assists": null,
      "kda_text": null,
      "medals": [],
      "final_hits": null,
      "damage": null,
      "damage_blocked": null,
      "healing": null,
      "accuracy_percent": null,
      "is_mvp": false,
      "is_svp": false,
      "confidence": 0
    }
  ],
  "teams": [
    {
      "team_key": "team_1",
      "row_color_group": null,
      "is_winning_team": null,
      "team_score": null,
      "team_totals": {
        "kills": null,
        "deaths": null,
        "assists": null,
        "final_hits": null,
        "damage": null,
        "damage_blocked": null,
        "healing": null,
        "average_accuracy_percent": null
      },
      "players": []
    },
    {
      "team_key": "team_2",
      "row_color_group": null,
      "is_winning_team": null,
      "team_score": null,
      "team_totals": {
        "kills": null,
        "deaths": null,
        "assists": null,
        "final_hits": null,
        "damage": null,
        "damage_blocked": null,
        "healing": null,
        "average_accuracy_percent": null
      },
      "players": []
    }
  ],
  "fields_needing_manual_review": []
}

TEAM TOTALS:
After extracting player rows, calculate team totals from the visible rows when team grouping is reliable:
- kills = sum of kills
- deaths = sum of deaths
- assists = sum of assists
- final_hits = sum of final_hits
- damage = sum of damage
- damage_blocked = sum of damage_blocked
- healing = sum of healing
- average_accuracy_percent = average of visible accuracy_percent values

If a row field is null, skip it in the sum/average.
If team grouping is not reliable, set team totals to null.

FINAL VALIDATION:
Before returning JSON:
- Do not include any fields outside the schema.
- Make sure rows[] contains every visible scoreboard row.
- Make sure teams[].players contain the same row objects grouped by team.
- Make sure hero_confirmed is always null.
- Make sure no hidden stats are included.

  `.trim();
}

export function getDeadlockExtractionPrompt() {
  return `
Analyze this Deadlock post-game scoreboard screenshot and extract only visible scoreboard data into valid JSON.

Return JSON only. Do not explain. Do not include markdown.

The final image is the uploaded scoreboard screenshot to extract.

You may also receive reference material before the scoreboard image:
- One or more Deadlock hero reference sheets showing labeled hero portraits.
- A Deadlock hero metadata text block listing the allowed hero names.

Use reference material only to help identify the small hero portrait attached to each scoreboard player column.
Do not extract match data from reference material.
Only the final uploaded scoreboard image contains the match data.

DEADLOCK SCOREBOARD LAYOUT — READ THIS CAREFULLY:
The Deadlock end-of-match scoreboard is COLUMN-based with a CENTER LABEL COLUMN between the two teams. It does NOT look like a Valorant or LoL row table.

Visual structure, top to bottom:
1. Top banner: a match duration in the very center (e.g. "48:47"), with two souls totals in rounded bubbles on either side of it (e.g. "333k" left, "298k" right). A match id may appear top-right.
2. Team header row: "THE AMBER HAND" on the left and "THE SAPPHIRE FLAME" on the right (these are the default team names; treat them as labels, not opponent identities).
3. Result banner under each team header: one team shows "Victory" and the other typically shows nothing or "Defeat".
4. Player portrait row: 6 circular hero portraits on the left, then the center label column, then 6 circular hero portraits on the right.
5. Player name row: each player's in-game name is directly under their portrait.
6. Stat grid: each stat occupies a horizontal band that runs across the entire scoreboard. The CENTER column of that band contains the stat label. The 6 cells to the LEFT of the label are the left team's values for that stat (one per left-team player, in the same column order as their portraits). The 6 cells to the RIGHT of the label are the right team's values (in portrait order).

The center label column, top to bottom, is typically:
- PLAYER STATS (header)
- TOTAL SOULS
- KILLS
- DEATHS
- ASSISTS
- PLAYER DMG
- OBJ DMG
- HEALING

To extract a single player you must read DOWN their column:
- Read the portrait at the top of column N → identify the hero from the reference sheet.
- Read the player name directly below the portrait.
- For each stat band (TOTAL SOULS, KILLS, DEATHS, ASSISTS, PLAYER DMG, OBJ DMG, HEALING), read the cell in column N — it sits in the same horizontal band as the center label.
- Repeat for every visible column on both sides of the center label.

CRITICAL:
- The two teams together typically have 12 columns total (6 left + 6 right). You must produce one JSON row object per visible player column.
- Returning team_totals without per-player rows is INCORRECT. Even if you cannot read every cell, return one row per visible player column with whatever cells you can read and null for the rest.
- The left-side souls bubble (e.g. "333k") is the team total for the LEFT team. The right-side souls bubble is the team total for the RIGHT team. These are aggregated values, not player-level values, and they are rounded display numbers — prefer summing the per-player TOTAL SOULS cells when computing team_totals.souls.

Even though the visual layout is column-based, return one JSON row object per player in rows[] (12 rows expected).

The screenshot may include:
- match result, such as Victory or Defeat (per team section)
- team names, such as The Amber Hand and The Sapphire Flame
- match duration in the top center, formatted like "32:45" or "00:32:45"
- match id if visible
- aggregated team total souls displayed near the team header (optional)
- two teams, typically 6 players per team
- hero portraits at the top of each player column
- player names directly under each portrait
- Net Worth / Souls (sometimes labeled "Total Souls" or just a souls icon)
- Kills
- Deaths
- Assists
- Last Hits (sometimes labeled "LH")
- Denies (sometimes labeled "DN")
- Player Damage (sometimes labeled "Player DMG")
- Objective Damage (sometimes labeled "OBJ DMG")
- Healing

Rules:
- Only extract data visible in the screenshot.
- Do not use external APIs or hidden game data.
- Do not guess hidden stats.
- Do not leave returned row fields empty. If a visible text/stat field is unreadable, use "Needs review" and add the field path to fields_needing_manual_review.
- Every player row must include a non-empty hero value. If the column portrait cannot be identified, use "Unidentified hero <row number>" and add the hero field path to fields_needing_manual_review.
- Preserve column order left to right within each team.
- Preserve team separation exactly as shown.
- Extract all visible player columns into rows[] (typically 12 total, 6 per team).
- Extract only these gameplay stats because these are the Deadlock stats Matchmake stores:
  - player name
  - hero from the column portrait when confident
  - kills
  - deaths
  - assists
  - souls (Net Worth / Total Souls)
  - player_damage
  - objective_damage
  - healing

HERO IDENTIFICATION:
- Use only the small hero portrait at the top of the same player column.
- Compare that column portrait to the labeled Deadlock hero reference sheet provided as reference material.
- Return a hero name that matches one of the names from the Deadlock hero metadata reference list.
- Do not use background art, UI icons, badges, report icons, MMR icons, role icons, or team logos as heroes.
- Do not output placeholders such as Hero 1, Unknown, or Player TBD.
- Do not output role names or lane names (Solo Lane, Duo Lane, Mid, Roam, Flex, etc.).
- If the column portrait is unclear or you cannot match it to a hero on the reference sheet, return hero = "Unidentified hero <row number>" and add the field to fields_needing_manual_review.

K/D/A RULE:
The center label column has KILLS, DEATHS, and ASSISTS as three separate stat bands (in that order). For each player column, read the value in the cell aligned with each label.
- kills, deaths, and assists must each be returned as separate integers.
- Build kda_text as "kills/deaths/assists" only when all three values are extracted for that player.
- Do not concatenate values from different players.

NUMBER RULES:
- Convert comma numbers into integers.
  Example: "59,304" becomes 59304.
- Strip currency or unit symbols.
  Example: "32K" becomes null unless an exact number is also visible. Do not estimate from rounded values.
- If a visible number is unreadable, return "Needs review" and add that field path to fields_needing_manual_review.
- Do not estimate unreadable numbers.

MATCH HEADER RULES:
- If a team section banner clearly says VICTORY for team_1, set match.result = "victory" and teams[0].is_winning_team = true.
- If team_1's banner clearly says DEFEAT, set match.result = "defeat" and teams[1].is_winning_team = true.
- If only the winning side is visible but it is unclear which side is the user team, leave match.result null, set the correct teams[].is_winning_team, and set manual_review_required = true.
- Extract match duration only from the top center duration text.
- Extract match_id from a visible match id label if present.
- Extract team_1_name and team_2_name from the visible team header labels (e.g. "The Amber Hand", "The Sapphire Flame"). Otherwise null.

SCORE RULE — VERY IMPORTANT:
Deadlock does not display a traditional score. Souls, Player Damage, Objective Damage, and Healing are NOT scores.
- Do not place souls totals into final_score, team_1_score, team_2_score, or teams[].team_score.
- Unless a numeric round score is literally visible (it usually is not), set:
  - final_score = null
  - team_1_score = null
  - team_2_score = null
  - teams[].team_score = null
- Souls totals belong only in teams[].team_totals.souls.

TEAM GROUPING RULES:
- Use the visual side and team color to group players.
- The left team section is team_1.
- The right team section is team_2.
- Amber/orange/yellow rows belong to whichever side that color is shown on. Do not assume amber is always team_1.
- Put each player row in both rows[] and the correct teams[].players array.
- If team grouping is unclear, still return rows[] in column-order, leave team_key null on each row, and set manual_review_required = true.

Return this exact JSON shape:
{
  "game_title": "Deadlock",
  "screenshot_type": "post_game_scoreboard",
  "parser_confidence": 0,
  "manual_review_required": true,
  "match": {
    "result": null,
    "final_score": null,
    "team_1_score": null,
    "team_2_score": null,
    "team_1_name": null,
    "team_2_name": null,
    "duration": null,
    "match_id": null,
    "played_at": null,
    "match_date_text": null
  },
  "rows": [
    {
      "row_index": 1,
      "team_key": null,
      "row_color_group": null,
      "player_name": null,
      "hero": null,
      "souls": null,
      "kills": null,
      "deaths": null,
      "assists": null,
      "kda_text": null,
      "player_damage": null,
      "objective_damage": null,
      "healing": null,
      "confidence": 0
    }
  ],
  "teams": [
    {
      "team_key": "team_1",
      "team_name": null,
      "row_color_group": null,
      "is_winning_team": null,
      "team_score": null,
      "team_totals": {
        "souls": null,
        "kills": null,
        "deaths": null,
        "assists": null,
        "player_damage": null,
        "objective_damage": null,
        "healing": null
      },
      "players": []
    },
    {
      "team_key": "team_2",
      "team_name": null,
      "row_color_group": null,
      "is_winning_team": null,
      "team_score": null,
      "team_totals": {
        "souls": null,
        "kills": null,
        "deaths": null,
        "assists": null,
        "player_damage": null,
        "objective_damage": null,
        "healing": null
      },
      "players": []
    }
  ],
  "fields_needing_manual_review": []
}

TEAM TOTALS:
After extracting player rows, calculate team_totals from the visible columns when team grouping is reliable:
- kills = sum of kills
- deaths = sum of deaths
- assists = sum of assists
- souls = sum of player souls (or use the aggregated team souls header if visible)
- player_damage = sum of player_damage
- objective_damage = sum of objective_damage
- healing = sum of healing

If a column field is null, skip it in the sum.
If team grouping is not reliable, set team_totals fields to null.

CONFIDENCE:
- Set per-row confidence based on portrait clarity and number readability.
- Set parser_confidence overall.
- Add low-confidence fields to fields_needing_manual_review using paths like "rows[3].hero" or "match.duration".

FINAL VALIDATION:
Before returning JSON:
- Do not include any fields outside the schema.
- Make sure rows[] contains every visible player column (typically 12).
- Make sure teams[].players contain the same row objects grouped by team.
- Make sure final_score, team_1_score, team_2_score, and teams[].team_score are null unless an actual numeric score is visible.
- Make sure no hidden stats are included (no last hits, denies, accuracy, ult usage, item slots, build details, hero level, or rank tier).
- Make sure hero names come from the Deadlock hero metadata list when set, and are null otherwise.
  `.trim();
}

export function getPostGameExtractionPrompt(gameTitle) {
  if (gameTitle === "Marvel Rivals") return getMarvelRivalsExtractionPrompt();
  if (gameTitle === "Deadlock") return getDeadlockExtractionPrompt();
  if (gameTitle === "Overwatch" || gameTitle === "Overwatch 2") return getOverwatchExtractionPrompt();
  if (gameTitle === "Counter-Strike 2") return getCounterStrikeExtractionPrompt();
  if (gameTitle === "Rocket League") return getRocketLeagueExtractionPrompt();
  if (gameTitle === "Honor of Kings" || gameTitle === "HOK") return getHonorOfKingsExtractionPrompt();
  return createPrompt(gameTitle);
}

const mockReviews = {
  "League of Legends": {
    match_result: "victory",
    final_score: "31 - 10",
    team_score: 31,
    opponent_score: 10,
    opponent_name: "Enemy Team",
    map_or_mode: "",
    played_at: new Date().toISOString(),
    team_comp: [
      { role: "Top", champion: "Darius", player_name: "TopCarry99", level: 17, k: 4, d: 1, a: 8, gold: null, damage_to_champions: null, items: [] },
      { role: "Jungle", champion: "Warwick", player_name: "JungleDiff", level: 16, k: 8, d: 2, a: 12, gold: null, damage_to_champions: null, items: [] },
      { role: "Mid", champion: "Nasus", player_name: "FakerFan", level: 18, k: 12, d: 0, a: 5, gold: null, damage_to_champions: null, items: [] },
      { role: "ADC", champion: "Sett", player_name: "AutoSpace", level: 16, k: 6, d: 3, a: 9, gold: null, damage_to_champions: null, items: [] },
      { role: "Support", champion: "Sona", player_name: "VisionKing", level: 14, k: 1, d: 4, a: 22, gold: null, damage_to_champions: null, items: [] },
    ],
    opponent_comp: [
      { role: "Top", champion: "Mordekaiser", player_name: "EnemyTop", level: 15, k: 2, d: 5, a: 4, gold: null, damage_to_champions: null, items: [] },
      { role: "Jungle", champion: "Viego", player_name: "JungleDiffGap", level: 14, k: 3, d: 7, a: 5, gold: null, damage_to_champions: null, items: [] },
      { role: "Mid", champion: "Lux", player_name: "MidLaneMain", level: 16, k: 4, d: 4, a: 2, gold: null, damage_to_champions: null, items: [] },
      { role: "ADC", champion: "Ahri", player_name: "Clicker", level: 15, k: 1, d: 5, a: 3, gold: null, damage_to_champions: null, items: [] },
      { role: "Support", champion: "Blitzcrank", player_name: "WardsPls", level: 13, k: 0, d: 7, a: 6, gold: null, damage_to_champions: null, items: [] },
    ],
    team_stats: { team_kills: 31, team_deaths: 10, team_assists: 56, total_gold: null, total_damage_to_champions: null, objectives: null, game_length: "32:45", patch: "14.2" },
    opponent_stats: { team_kills: 10, team_deaths: 31, team_assists: 20, total_gold: null, total_damage_to_champions: null, objectives: null },
    notes: "AI placeholder extraction. Review each field before saving.",
    parser_status: "mocked",
    parser_confidence: 0.72,
    manual_edit_required: true,
  },
  Valorant: {
    match_result: "victory",
    final_score: "13 - 11",
    team_score: 13,
    opponent_score: 11,
    opponent_name: "Sentinels Academy",
    map_or_mode: "Ascent",
    played_at: new Date().toISOString(),
    team_comp: [
      { agent: "Jett", player_name: "AlphaStriker", role: "Duelist", k: 24, d: 13, a: 5, acs: 284, econ_rating: 62, first_bloods: 4, plants: 0, defuses: 0 },
      { agent: "Sova", player_name: "VisionaryX", role: "Initiator", k: 18, d: 14, a: 11, acs: 210, econ_rating: 54, first_bloods: 1, plants: 1, defuses: 0 },
      { agent: "Omen", player_name: "ShadowStep", role: "Controller", k: 15, d: 15, a: 8, acs: 195, econ_rating: 48, first_bloods: 0, plants: 2, defuses: 1 },
      { agent: "Killjoy", player_name: "TechSavvy", role: "Sentinel", k: 19, d: 12, a: 4, acs: 240, econ_rating: 57, first_bloods: 2, plants: 0, defuses: 1 },
      { agent: "Breach", player_name: "Earthshaker", role: "Initiator", k: 12, d: 16, a: 14, acs: 175, econ_rating: 45, first_bloods: 0, plants: 0, defuses: 0 },
    ],
    opponent_comp: [
      { agent: "Breach", player_name: "SEN Marved", role: "Initiator", k: 20, d: 14, a: 9, acs: 232, econ_rating: 51, first_bloods: 2, plants: 0, defuses: 0 },
      { agent: "Killjoy", player_name: "SEN TenZ", role: "Sentinel", k: 18, d: 16, a: 6, acs: 218, econ_rating: 50, first_bloods: 1, plants: 0, defuses: 0 },
      { agent: "Omen", player_name: "SEN Sacy", role: "Controller", k: 17, d: 17, a: 8, acs: 205, econ_rating: 47, first_bloods: 0, plants: 1, defuses: 0 },
      { agent: "Jett", player_name: "SEN Zekken", role: "Duelist", k: 16, d: 18, a: 5, acs: 198, econ_rating: 46, first_bloods: 1, plants: 0, defuses: 0 },
      { agent: "Sova", player_name: "SEN Johnqt", role: "Initiator", k: 13, d: 20, a: 10, acs: 170, econ_rating: 43, first_bloods: 0, plants: 0, defuses: 0 },
    ],
    team_stats: { team_kills: 88, team_deaths: 70, team_assists: 42, average_acs: 221, average_econ_rating: 53, total_first_bloods: 7, total_plants: 3, total_defuses: 2, duration: "35:17", match_date_text: null },
    opponent_stats: { team_kills: 84, team_deaths: 85, team_assists: 38, average_acs: 205, average_econ_rating: 47, total_first_bloods: 4, total_plants: 1, total_defuses: 0 },
    notes: "AI placeholder extraction. Review each field before saving.",
    parser_status: "mocked",
    parser_confidence: 0.74,
    manual_edit_required: true,
  },
};

const genericMockData = {
  "Counter-Strike 2": {
    final_score: "13 - 9",
    team_score: 13,
    opponent_score: 9,
    opponent_name: "Mirage Academy",
    map_or_mode: "Mirage",
    roles: ["Entry", "AWPer", "Rifler", "IGL", "Support"],
    rows: [
      { role: "Entry", k: 24, a: 5, d: 15, adr: 92, hs_percent: 48, mvps: 4, score: 54 },
      { role: "AWPer", k: 21, a: 3, d: 13, adr: 84, hs_percent: 31, mvps: 3, score: 48 },
      { role: "Rifler", k: 18, a: 6, d: 16, adr: 76, hs_percent: 42, mvps: 2, score: 41 },
      { role: "IGL", k: 15, a: 9, d: 17, adr: 68, hs_percent: 39, mvps: 1, score: 36 },
      { role: "Support", k: 13, a: 11, d: 18, adr: 61, hs_percent: 35, mvps: 1, score: 34 },
    ],
    team_stats: { team_kills: 91, team_deaths: 79, team_assists: 34, average_adr: 76, average_hs_percent: 39, total_mvps: 11 },
    opponent_stats: { team_kills: 79, team_deaths: 91, team_assists: 29, average_adr: 69, average_hs_percent: 36, total_mvps: 8 },
  },
  "Rocket League": {
    final_score: "4 - 2",
    team_score: 4,
    opponent_score: 2,
    opponent_name: "Boost Control",
    map_or_mode: "DFH Stadium · 3v3",
    roles: ["First Man", "Second Man", "Third Man"],
    rows: [
      { car: "Octane", player_name: "Striker", score: 642, goals: 2, assists: 1, saves: 1, shots: 5, demos: 0 },
      { car: "Fennec", player_name: "Midfield", score: 511, goals: 1, assists: 2, saves: 2, shots: 3, demos: 1 },
      { car: "Dominus", player_name: "Anchor", score: 438, goals: 1, assists: 1, saves: 4, shots: 2, demos: 0 },
    ],
    team_stats: { goals: 4, assists: 4, saves: 7, shots: 10, demos: 1, scoreboard_score: 1591 },
    opponent_stats: { goals: 2, assists: 2, saves: 5, shots: 7, demos: 0, scoreboard_score: 1210 },
  },
  "Overwatch 2": {
    final_score: "2 - 1",
    team_score: 2,
    opponent_score: 1,
    opponent_name: "Payload Prep",
    map_or_mode: "King's Row",
    roles: ["Tank", "Damage", "Damage", "Support", "Support", "Flex"],
    rows: [
      { hero: "Reinhardt", role: "Tank", eliminations: 23, assists: 11, deaths: 6, damage: 9100, healing: 0, mitigation: 18400 },
      { hero: "Sojourn", role: "Damage", eliminations: 31, assists: 5, deaths: 8, damage: 14200, healing: 0, mitigation: 400 },
      { hero: "Genji", role: "Damage", eliminations: 26, assists: 7, deaths: 9, damage: 11800, healing: 0, mitigation: 250 },
      { hero: "Ana", role: "Support", eliminations: 14, assists: 24, deaths: 7, damage: 4300, healing: 15100, mitigation: 0 },
      { hero: "Lucio", role: "Support", eliminations: 12, assists: 28, deaths: 6, damage: 3900, healing: 12800, mitigation: 0 },
      { hero: "Mei", role: "Flex", eliminations: 18, assists: 10, deaths: 7, damage: 7600, healing: 0, mitigation: 2100 },
    ],
    team_stats: { eliminations: 124, assists: 85, deaths: 43, damage: 50900, healing: 27900, mitigation: 21150 },
    opponentStats: { eliminations: 108, assists: 72, deaths: 52, damage: 46100, healing: 25100, mitigation: 18300 },
  },
  "Marvel Rivals": {
    final_score: "Victory",
    team_score: 1,
    opponent_score: 0,
    opponent_name: "Rivalry Club",
    map_or_mode: "Klyntar · Convergence",
    roles: ["Vanguard", "Duelist", "Duelist", "Strategist", "Strategist", "Flex"],
    rows: [
      { hero: "Magneto", role: "Vanguard", k: 24, d: 7, a: 15, final_hits: 8, damage: 10200, healing: 0, damage_blocked: 18200, accuracy: 42 },
      { hero: "Iron Man", role: "Duelist", k: 32, d: 9, a: 6, final_hits: 12, damage: 16800, healing: 0, damage_blocked: 400, accuracy: 31 },
      { hero: "Star-Lord", role: "Duelist", k: 28, d: 8, a: 9, final_hits: 10, damage: 14100, healing: 0, damage_blocked: 300, accuracy: 46 },
      { hero: "Luna Snow", role: "Strategist", k: 13, d: 6, a: 29, final_hits: 3, damage: 3900, healing: 17400, damage_blocked: 0, accuracy: 53 },
      { hero: "Mantis", role: "Strategist", k: 11, d: 5, a: 31, final_hits: 2, damage: 3400, healing: 15900, damage_blocked: 0, accuracy: 58 },
      { hero: "Namor", role: "Flex", k: 20, d: 7, a: 12, final_hits: 7, damage: 9700, healing: 0, damage_blocked: 900, accuracy: 35 },
    ],
    team_stats: { team_kills: 128, team_deaths: 42, team_assists: 102, final_hits: 42, damage: 58100, healing: 33300, damage_blocked: 19800, average_accuracy: 44 },
    opponent_stats: { team_kills: 101, team_deaths: 56, team_assists: 78, final_hits: 31, damage: 50600, healing: 28400, damage_blocked: 17100, average_accuracy: 39 },
  },
  Deadlock: {
    final_score: "Victory",
    team_score: null,
    opponent_score: null,
    opponent_name: "Lane Lab",
    map_or_mode: "Standard",
    roles: ["Solo Lane", "Duo Lane", "Duo Lane", "Roam", "Flex"],
    rows: [
      { hero: "Infernus", player_name: "BurnPath", k: 12, d: 4, a: 11, souls: 38200, player_damage: 41100, objective_damage: 9200, healing: 1300 },
      { hero: "Warden", player_name: "HoldAngle", k: 8, d: 5, a: 16, souls: 35100, player_damage: 28400, objective_damage: 11800, healing: 700 },
      { hero: "Vindicta", player_name: "Skyline", k: 15, d: 6, a: 7, souls: 40100, player_damage: 45600, objective_damage: 6100, healing: 0 },
      { hero: "Ivy", player_name: "LiftOff", k: 6, d: 4, a: 21, souls: 31500, player_damage: 22100, objective_damage: 8400, healing: 3900 },
      { hero: "Kelvin", player_name: "FreezeTag", k: 7, d: 5, a: 18, souls: 32900, player_damage: 24100, objective_damage: 7600, healing: 6200 },
    ],
    team_stats: { team_kills: 48, team_deaths: 24, team_assists: 73, total_souls: 177800, player_damage: 161300, objective_damage: 43100, healing: 12100 },
    opponent_stats: { team_kills: 32, team_deaths: 48, team_assists: 49, total_souls: 151200, player_damage: 137900, objective_damage: 36400, healing: 8800 },
  },
  SSBU: {
    final_score: "5 - 3",
    team_score: 5,
    opponent_score: 3,
    opponent_name: "Campus Crew",
    map_or_mode: "Crew Battle · Battlefield",
    roles: ["Starter", "Anchor", "Counterpick", "Flex", "Closer"],
    rows: [
      { character: "Mario", player_name: "CapeCheck", kos: 3, falls: 1, self_destructs: 0, damage_dealt: 412, damage_taken: 256, stocks_remaining: 2 },
      { character: "Lucina", player_name: "Spacing", kos: 2, falls: 1, self_destructs: 0, damage_dealt: 330, damage_taken: 241, stocks_remaining: 1 },
      { character: "Fox", player_name: "ShineOut", kos: 2, falls: 2, self_destructs: 0, damage_dealt: 290, damage_taken: 318, stocks_remaining: 0 },
      { character: "Pokemon Trainer", player_name: "Swap", kos: 1, falls: 1, self_destructs: 0, damage_dealt: 184, damage_taken: 165, stocks_remaining: 1 },
      { character: "Palutena", player_name: "Halo", kos: 2, falls: 1, self_destructs: 0, damage_dealt: 310, damage_taken: 227, stocks_remaining: 1 },
    ],
    team_stats: { kos: 10, falls: 6, self_destructs: 0, damage_dealt: 1526, damage_taken: 1207, stocks_remaining: 5 },
    opponent_stats: { kos: 6, falls: 10, self_destructs: 1, damage_dealt: 1207, damage_taken: 1526, stocks_remaining: 3 },
  },
  "Honor of Kings": {
    final_score: "18 - 11",
    team_score: 18,
    opponent_score: 11,
    opponent_name: "Kings Academy",
    map_or_mode: "Ranked 5v5",
    roles: ["Clash Lane", "Jungle", "Mid", "Farm Lane", "Roam"],
    rows: [
      { hero: "Lu Bu", role: "Clash Lane", k: 4, d: 2, a: 7, gold: 11800, damage: 24500, damage_taken: 30100, healing: 1200 },
      { hero: "Han Xin", role: "Jungle", k: 7, d: 1, a: 5, gold: 13900, damage: 31200, damage_taken: 18100, healing: 900 },
      { hero: "Angela", role: "Mid", k: 3, d: 3, a: 9, gold: 10400, damage: 28600, damage_taken: 12200, healing: 500 },
      { hero: "Hou Yi", role: "Farm Lane", k: 4, d: 2, a: 6, gold: 12600, damage: 33400, damage_taken: 14100, healing: 400 },
      { hero: "Zhang Fei", role: "Roam", k: 0, d: 3, a: 14, gold: 7800, damage: 8100, damage_taken: 35600, healing: 6200 },
    ],
    team_stats: { team_kills: 18, team_deaths: 11, team_assists: 41, total_gold: 56500, damage: 125800, damage_taken: 110100, healing: 9200 },
    opponent_stats: { team_kills: 11, team_deaths: 18, team_assists: 27, total_gold: 48900, damage: 103200, damage_taken: 125800, healing: 7600 },
  },
};

genericMockData.Overwatch = genericMockData["Overwatch 2"];

function buildGenericReview(gameTitle) {
  const data = genericMockData[gameTitle];
  const config = POSTGAME_SCREENSHOT_STATS[gameTitle];
  const pickField = config?.pickField || "role";
  const rows = (data?.rows || []).map((row, index) => ({
    player_name: row.player_name || `Player ${index + 1}`,
    role: row.role || data.roles?.[index] || "",
    ...row,
  }));
  const opponentRows = rows.map((row, index) => ({
    ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "number" ? null : value])),
    player_name: `Opponent ${index + 1}`,
    [pickField]: row[pickField] || row.role || "",
  }));

  return {
    match_result: "victory",
    final_score: data?.final_score || "",
    team_score: data?.team_score ?? null,
    opponent_score: data?.opponent_score ?? null,
    opponent_name: data?.opponent_name || "Opponent",
    map_or_mode: data?.map_or_mode || "",
    played_at: new Date().toISOString(),
    team_comp: rows,
    opponent_comp: opponentRows,
    team_stats: data?.team_stats || {},
    opponent_stats: data?.opponent_stats || data?.opponentStats || {},
    notes: "AI placeholder extraction. Review each field before saving.",
    parser_status: "mocked",
    parser_confidence: 0.68,
    manual_edit_required: true,
  };
}

export async function extractPostGameStats({ gameTitle }) {
  // Replace this mock with a server-side AI call when an endpoint and API key are available.
  // The real endpoint should receive the screenshot and getPostGameExtractionPrompt(gameTitle),
  // then return the same structured shape without inventing hidden stats.
  await new Promise((resolve) => window.setTimeout(resolve, 450));

  if (mockReviews[gameTitle]) return structuredClone(mockReviews[gameTitle]);
  if (POSTGAME_SCREENSHOT_STATS[gameTitle]) return buildGenericReview(gameTitle);

  throw new Error("Post-game extraction is not available for this game yet.");
}
