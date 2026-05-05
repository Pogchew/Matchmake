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
    let players = Array.isArray(rawTeam.players)
      ? rawTeam.players.map((row, playerIndex) => normalizeMarvelRow(row, `teams[${index}].players[${playerIndex}]`, manualReviewFields, nulledHeroFields))
      : [];

    if (!players.length && rows.some((row) => row.team_key === `team_${index + 1}`)) {
      players = rows.filter((row) => row.team_key === `team_${index + 1}`);
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
      "Hero, role, player name, K/D/A, gold, damage, damage taken, healing, participation/rating/MVP when visible",
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
- If a value is not visible, return null.
- Preserve both teams separately.
- Extract all visible player rows.
- Split K/D/A into kills, deaths, assists. For example "12 / 2 / 3" means kills=12, deaths=2, assists=3.
- Convert numbers like "12,234" into integers.
- Only extract objectives, items, spells, damage, or gold if clearly visible.
- If uncertain, return null and add the field to fields_needing_manual_review.
- Keep the response compact. Do not include fields that are not in the schema below.
- The screenshot may show "TEAM 1" and "TEAM 2"; keep those as separate team rows.
- The right-side numeric columns in this screenshot style are usually gold and damage to champions. Extract them only if visible.

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
- If a value is not visible, return null.
- Preserve player row order exactly as shown.
- Extract all 10 visible player rows if present.
- Extract the small square agent portrait/headshot at the far left of each row as the agent identity if possible.
- Use only the small scoreboard headshots for agent identification.
- Do not use large splash art, full-body art, store icons, party icons, right-side social icons, friend list icons, or unrelated UI images.
- If the screenshot shows row tint/color grouping, use it to group team_1 and team_2.
- If teams are mixed because the scoreboard is individually sorted, preserve row order and use team_key only when visually clear.
- Split KDA into kills, deaths, assists.
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
- If uncertain, return null and add the field to fields_needing_manual_review.

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
- If a value is not visible, return null.
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
- Use the base hero and costume reference sheets to map row portraits to a base hero name.
- If a costume icon matches, return the base hero name, not the costume name.
- Do not use ban/pick strip portraits, background art, MVP/SVP side art, role icons, medal icons, UI icons, team icons, or menus.
- Do not output role names such as Vanguard, Duelist, Strategist, or Flex.
- Do not output placeholders such as Hero 1, Hero 2, Unknown, or Player TBD.
- If the row portrait is unclear, return hero_guess = null.
- Return portrait_crop_hint for the row portrait if you can locate it confidently; otherwise leave the crop values null.
- hero_confirmed should always be null. The app/user confirms heroes later.

K/D/A RULE:
The three combat-stat columns immediately after Player Name are K/D/A.
- first number = kills
- second number = deaths
- third number = assists
- kda_text = "kills/deaths/assists"

NUMBER RULES:
- Convert comma numbers into integers.
  Example: "47,407" becomes 47407.
- Convert percentages into numbers.
  Example: "16%" becomes 16.
- If a number is unreadable, return null.
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

The screenshot is a Deadlock ending match scoreboard. It may show:
- match result, such as Victory or Defeat
- team names, such as The Amber Hand and The Sapphire Flame
- team total souls at the top
- match duration at the top center
- match id if visible
- two teams, usually 6 players per team
- hero portraits above or inside each player column
- player names
- Total Souls
- Kills
- Deaths
- Assists
- Player DMG
- OBJ DMG
- Healing

You may also receive a Deadlock hero reference sheet before the scoreboard image.
Use the reference sheet only to identify the small hero portraits attached to player columns.
Do not extract match stats from the reference sheet.
Only the final uploaded scoreboard image contains match data.

Rules:
- Extract only data visible in the screenshot.
- Do not use external APIs or hidden game data.
- Do not infer unavailable values.
- If a value is not visible, return null.
- Preserve team separation exactly as shown.
- Preserve player order left to right within each team.
- Extract all visible player columns.
- If a number uses commas, convert it to an integer. Example: "59,304" becomes 59304.
- If a value is unreadable, return null and add the field to fields_needing_manual_review.

Hero rules:
- Identify hero only from the visible hero portrait directly attached to that player column.
- Compare that player-column portrait to the labeled Deadlock hero reference sheet.
- Return a hero name from the reference sheet/metadata only when the visual match is clear.
- Do not use background art, UI icons, badges, report icons, or team logos as heroes.
- If the hero portrait is unclear, return hero = null.
- Do not force hero names.
- Do not output placeholders like Hero 1, Unknown, or Player TBD.

Match result rules:
- If a team section clearly says Victory, set match.result = "victory" for team_1 when the first/left team is the winner.
- If the first/left team is clearly defeated, set match.result = "defeat".
- If the screenshot only makes the winning team clear but not which side is the user team, preserve team_1/team_2 and set manual_review_required = true.

Team grouping:
- team_1 is the first/left team section.
- team_2 is the second/right team section.
- Put each player row in both rows[] and the correct teams[].players array.

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

Team totals:
- If team grouping is reliable, calculate team_totals from visible player rows:
  - souls = sum of Total Souls
  - kills = sum of Kills
  - deaths = sum of Deaths
  - assists = sum of Assists
  - player_damage = sum of Player DMG
  - objective_damage = sum of OBJ DMG
  - healing = sum of Healing
- If top team soul totals are visible, they may be used for team_totals.souls.
- If a row field is null, skip it in sums.

Final validation:
- Do not include fields outside the schema.
- Make sure rows[] contains every visible player column.
- Make sure teams[].players contains the same player rows grouped by team.
- Do not include hidden stats.
  `.trim();
}

export function getPostGameExtractionPrompt(gameTitle) {
  if (gameTitle === "Marvel Rivals") return getMarvelRivalsExtractionPrompt();
  if (gameTitle === "Deadlock") return getDeadlockExtractionPrompt();
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
