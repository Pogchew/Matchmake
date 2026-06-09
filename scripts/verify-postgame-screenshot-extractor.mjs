import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const API_URL = process.env.POSTGAME_EXTRACT_URL || "http://127.0.0.1:3000/api/postgame/extract";

const CASES = [
  {
    gameTitle: "Overwatch 2",
    imagePath: "/Users/nicholaschiu/Downloads/overwatch-2-competitive-ranks-1.jpg",
    expectedRows: 10,
    expectedTeamSizes: [5, 5],
    maxSeconds: 60,
    expectedMatch: { map: "Circuit Royal", mode: "Escort", duration: "2:48" },
    requiredRowFields: ["player_name", "hero", "role", "eliminations", "assists", "deaths", "damage", "healing", "mitigation", "final_blows", "objective_kills", "character_build"],
    exactRows: [
      { row_index: 1, team_key: "team_1", hero: "Junker Queen", role: "Tank", eliminations: 6, assists: 3, deaths: 2, damage: 1928, healing: 173, mitigation: 260 },
      { row_index: 2, team_key: "team_1", hero: "Junkrat", role: "Damage", player_name: "Technoknight", eliminations: 7, assists: 3, deaths: 2, damage: 2241, healing: 0, mitigation: 0 },
      { row_index: 10, team_key: "team_2", hero: "Kiriko", role: "Support", eliminations: 2, assists: 5, deaths: 2, damage: 260, healing: 952, mitigation: 0 },
    ],
    frontendFields: ["player_name", "hero", "role", "eliminations", "assists", "deaths", "damage", "healing", "mitigation", "final_blows", "objective_kills"],
  },
  {
    gameTitle: "Deadlock",
    imagePath: "/Users/nicholaschiu/Downloads/download-replay.webp",
    expectedRows: 12,
    expectedTeamSizes: [6, 6],
    maxSeconds: 60,
    expectedMatch: { result: "victory", duration: "51:50", team_1_name: "THE SAPPHIRE FLAME", team_2_name: "THE AMBER HAND" },
    requiredRowFields: ["player_name", "hero", "souls", "kills", "deaths", "assists", "kda_text", "player_damage", "objective_damage", "healing", "character_build"],
    exactRows: [
      { row_index: 1, team_key: "team_1", player_name: "Ceejay", souls: 55777, kills: 14, deaths: 17, assists: 18, player_damage: 62114, objective_damage: 15164, healing: 14617 },
      { row_index: 7, team_key: "team_2", player_name: "Cooller", souls: 59905, kills: 16, deaths: 9, assists: 15, player_damage: 48664, objective_damage: 5004, healing: 23947 },
      { row_index: 12, team_key: "team_2", player_name: "Harry Dotter", souls: 66445, kills: 34, deaths: 15, assists: 5, player_damage: 77437, objective_damage: 5873, healing: 9333 },
    ],
    frontendFields: ["player_name", "hero", "souls", "k", "d", "a", "player_damage", "objective_damage", "healing"],
  },
  {
    gameTitle: "Marvel Rivals",
    imagePath: "/Users/nicholaschiu/Downloads/please-explain-the-scoreboard-to-me-like-im-5-v0-nqfh9gtqyk9e1.webp",
    expectedRows: 12,
    expectedTeamSizes: [6, 6],
    maxSeconds: 60,
    expectedMeta: { referencePartsSentAtLeast: 8, costumeMetadataAttached: true },
    expectedMatch: { result: "defeat", map: "KLYNTAR-SYMBIOTIC SURFACE", objective_or_mode: "CONVERGENCE", duration: "00:07:05" },
    requiredRowFields: ["player_name", "hero_guess", "kills", "deaths", "assists", "kda_text", "final_hits", "damage", "damage_blocked", "healing", "accuracy_percent", "character_build"],
    exactRows: [
      { row_index: 1, team_key: "team_1", player_name: "Lucnif", kills: 6, deaths: 9, assists: 0, final_hits: 3, damage: 4554, damage_blocked: 3237, healing: 0, accuracy_percent: 33 },
      { row_index: 4, team_key: "team_1", player_name: "Illazyoli", kills: 6, deaths: 5, assists: 0, final_hits: 5, damage: 3594, damage_blocked: 5526, healing: 544, accuracy_percent: 60 },
      { row_index: 12, team_key: "team_2", player_name: "Jollyjoshua_21", kills: 11, deaths: 5, assists: 8, final_hits: 4, damage: 1723, damage_blocked: 2607, healing: 5482, accuracy_percent: 35 },
    ],
    frontendFields: ["player_name", "hero", "k", "d", "a", "final_hits", "damage", "damage_blocked", "healing", "accuracy"],
  },
  {
    gameTitle: "Valorant",
    imagePath: "/Users/nicholaschiu/Downloads/220695198-47f6b995-b1e4-4fc8-83f6-46325065e388.png",
    expectedRows: 10,
    expectedTeamSizes: [5, 5],
    maxSeconds: 60,
    expectedMatch: { result: "victory", final_score: "13 - 6", map: "PEARL", duration: "35:17" },
    requiredRowFields: ["player_name", "agent", "avg_combat_score", "kills", "deaths", "assists", "kda_text", "econ_rating", "first_bloods", "plants", "defuses", "character_build"],
    exactRows: [
      { row_index: 1, team_key: "team_1", player_name: "LTS michey", agent: "Neon", avg_combat_score: 245, kills: 17, deaths: 9, assists: 3, econ_rating: 64, first_bloods: 7, plants: 0, defuses: 1 },
      { row_index: 5, team_key: "team_2", player_name: "RV RxYaL", avg_combat_score: 203, kills: 14, deaths: 13, assists: 1, econ_rating: 70, first_bloods: 1, plants: 0, defuses: 0 },
      { row_index: 10, team_key: "team_2", player_name: "RV Varlas", avg_combat_score: 148, kills: 8, deaths: 16, assists: 8, econ_rating: 45, first_bloods: 1, plants: 1, defuses: 0 },
    ],
    frontendFields: ["player_name", "agent", "acs", "k", "d", "a", "econ_rating", "first_bloods", "plants", "defuses"],
  },
  {
    gameTitle: "League of Legends",
    imagePath: "/Users/nicholaschiu/Downloads/shogo.png",
    expectedRows: 10,
    expectedTeamSizes: [5, 5],
    maxSeconds: 60,
    expectedMatch: { result: "Victory", game_length: "24:43", final_score: "23-21", map_or_mode: "Ranked Solo/Duo" },
    requiredRowFields: ["role", "player_name", "champion", "level", "kills", "deaths", "assists", "kda_text", "gold", "damage_to_champions", "character_build"],
    exactRows: [
      { row_index: 1, team_key: "team_1", role: "Top", player_name: "ttv SoloSSBU", champion: "Garen", level: 18, kills: 12, deaths: 2, assists: 3, gold: 13980, damage_to_champions: 24170 },
      { row_index: 4, team_key: "team_1", role: "ADC", player_name: "Shogo", champion: "Brand", level: 15, kills: 2, deaths: 5, assists: 8, gold: 11622, damage_to_champions: 23914 },
      { row_index: 10, team_key: "team_2", role: "Support", player_name: "ThatPikminBoi", champion: "Milio", level: 12, kills: 1, deaths: 5, assists: 13, gold: 7074, damage_to_champions: 3115 },
    ],
    frontendFields: ["player_name", "role", "champion", "level", "k", "d", "a", "gold", "damage_to_champions"],
  },
];

function hasContent(value) {
  if (Array.isArray(value)) return true;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function assertLooseEqual(actual, expected, label) {
  if (typeof expected === "number") {
    assert.equal(Number(actual), expected, label);
    return;
  }
  assert.equal(normalizeText(actual), normalizeText(expected), label);
}

function parseKdaText(value = "") {
  const parts = String(value).split(/[/-]/).map((part) => Number(String(part).replace(/,/g, "").trim()));
  return {
    k: Number.isFinite(parts[0]) ? parts[0] : "Needs review",
    d: Number.isFinite(parts[1]) ? parts[1] : "Needs review",
    a: Number.isFinite(parts[2]) ? parts[2] : "Needs review",
  };
}

function projectFrontendRow(gameTitle, row) {
  const kda = parseKdaText(row.kda_text);
  if (gameTitle === "League of Legends") {
    return {
      player_name: row.player_name,
      role: row.role,
      champion: row.champion,
      level: row.level,
      k: row.kills ?? kda.k,
      d: row.deaths ?? kda.d,
      a: row.assists ?? kda.a,
      gold: row.gold,
      damage_to_champions: row.damage_to_champions,
    };
  }
  if (gameTitle === "Valorant") {
    return {
      player_name: row.player_name,
      agent: row.agent,
      acs: row.avg_combat_score ?? row.acs,
      k: row.kills ?? kda.k,
      d: row.deaths ?? kda.d,
      a: row.assists ?? kda.a,
      econ_rating: row.econ_rating,
      first_bloods: row.first_bloods,
      plants: row.plants,
      defuses: row.defuses,
    };
  }
  if (gameTitle === "Marvel Rivals") {
    return {
      player_name: row.player_name,
      hero: row.hero_confirmed || row.hero || row.hero_guess,
      k: row.kills ?? kda.k,
      d: row.deaths ?? kda.d,
      a: row.assists ?? kda.a,
      final_hits: row.final_hits,
      damage: row.damage,
      damage_blocked: row.damage_blocked,
      healing: row.healing,
      accuracy: row.accuracy_percent ?? row.accuracy,
    };
  }
  if (gameTitle === "Deadlock") {
    return {
      player_name: row.player_name,
      hero: row.hero,
      souls: row.souls,
      k: row.kills ?? kda.k,
      d: row.deaths ?? kda.d,
      a: row.assists ?? kda.a,
      player_damage: row.player_damage,
      objective_damage: row.objective_damage,
      healing: row.healing,
    };
  }
  return {
    player_name: row.player_name,
    hero: row.hero,
    role: row.role,
    eliminations: row.eliminations,
    assists: row.assists,
    deaths: row.deaths,
    damage: row.damage,
    healing: row.healing,
    mitigation: row.mitigation,
    final_blows: row.final_blows,
    objective_kills: row.objective_kills,
  };
}

async function postScreenshot(testCase) {
  const formData = new FormData();
  const image = await fs.readFile(testCase.imagePath);
  formData.append("gameTitle", testCase.gameTitle);
  formData.append("image", new Blob([image]), path.basename(testCase.imagePath));
  const startedAt = performance.now();
  const response = await fetch(API_URL, { method: "POST", body: formData });
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const payload = await response.json();
  assert.equal(response.status, 200, `${testCase.gameTitle} HTTP status: ${payload.error || response.statusText}`);
  assert.ok(elapsedSeconds <= testCase.maxSeconds, `${testCase.gameTitle} response time ${elapsedSeconds.toFixed(2)}s <= ${testCase.maxSeconds}s`);
  return { payload, elapsedSeconds };
}

for (const testCase of CASES) {
  const { payload, elapsedSeconds } = await postScreenshot(testCase);
  const data = payload.data;
  assert.ok(data, `${testCase.gameTitle} returned data`);
  assert.equal(data.rows.length, testCase.expectedRows, `${testCase.gameTitle} row count`);
  assert.equal(data.teams?.[0]?.players?.length, testCase.expectedTeamSizes[0], `${testCase.gameTitle} team 1 size`);
  assert.equal(data.teams?.[1]?.players?.length, testCase.expectedTeamSizes[1], `${testCase.gameTitle} team 2 size`);

  for (const [field, expected] of Object.entries(testCase.expectedMatch)) {
    assertLooseEqual(data.match?.[field], expected, `${testCase.gameTitle} match.${field}`);
  }

  if (testCase.expectedMeta) {
    if (testCase.expectedMeta.referencePartsSentAtLeast !== undefined) {
      assert.ok(
        Number(payload.meta?.referencePartsSent || 0) >= testCase.expectedMeta.referencePartsSentAtLeast,
        `${testCase.gameTitle} prompt includes costume/base reference sheets`,
      );
    }
    if (testCase.expectedMeta.costumeMetadataAttached !== undefined) {
      assert.equal(Boolean(payload.meta?.costumeMetadataAttached), testCase.expectedMeta.costumeMetadataAttached, `${testCase.gameTitle} costume metadata attached`);
    }
  }

  data.rows.forEach((row, index) => {
    testCase.requiredRowFields.forEach((field) => {
      assert.ok(hasContent(row[field]), `${testCase.gameTitle} API row ${index + 1} ${field}`);
    });
    const frontendRow = projectFrontendRow(testCase.gameTitle, row);
    testCase.frontendFields.forEach((field) => {
      assert.ok(hasContent(frontendRow[field]), `${testCase.gameTitle} frontend row ${index + 1} ${field}`);
    });
  });

  for (const expectedRow of testCase.exactRows) {
    const row = data.rows.find((candidate) => Number(candidate.row_index) === Number(expectedRow.row_index));
    assert.ok(row, `${testCase.gameTitle} expected row ${expectedRow.row_index}`);
    for (const [field, expected] of Object.entries(expectedRow)) {
      assertLooseEqual(row[field], expected, `${testCase.gameTitle} row ${expectedRow.row_index}.${field}`);
    }
  }

  console.log(`${testCase.gameTitle}: ${data.rows.length} rows, ${elapsedSeconds.toFixed(2)}s, frontend fields verified`);
}

console.log("All five screenshot extractor/frontend-output checks passed.");
