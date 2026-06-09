import assert from "node:assert/strict";
import { completePostgameExtractionFields } from "../src/lib/postgame-extraction.js";

const CASES = [
  {
    gameTitle: "Overwatch 2",
    input: {
      match: { map: "Circuit Royal", mode: "Escort", duration: "2:48" },
      rows: [{ row_index: 1, team_key: "team_1", player_name: "Technoknight", hero: "Junkrat", eliminations: 7, assists: 3, deaths: 2 }],
    },
    expectedRows: 10,
    requiredRowFields: ["player_name", "hero", "eliminations", "assists", "deaths", "damage", "healing", "mitigation", "final_blows", "objective_kills"],
  },
  {
    gameTitle: "Deadlock",
    input: {
      match: { result: "victory", duration: "51:50", team_1_name: "The Sapphire Flame", team_2_name: "The Amber Hand" },
      rows: [{ row_index: 1, team_key: "team_1", player_name: "Ceeljay", hero: "Bebop", souls: 55777, kills: 14, deaths: 17, assists: 18 }],
    },
    expectedRows: 12,
    requiredRowFields: ["player_name", "hero", "souls", "kills", "deaths", "assists", "kda_text", "player_damage", "objective_damage", "healing"],
  },
  {
    gameTitle: "Marvel Rivals",
    input: {
      match: { result: "defeat", map: "Klyntar-Symbiotic Surface", objective_or_mode: "Convergence", duration: "00:07:05" },
      rows: [{ row_index: 1, team_key: "team_1", player_name: "Lucnif", kills: 6, deaths: 9, assists: 0, damage: 4554 }],
    },
    expectedRows: 12,
    requiredRowFields: ["player_name", "hero_guess", "kills", "deaths", "assists", "kda_text", "final_hits", "damage", "damage_blocked", "healing", "accuracy_percent"],
  },
  {
    gameTitle: "Valorant",
    input: {
      match: { result: "victory", team_1_score: 13, team_2_score: 6, map: "Pearl", duration: "35:17" },
      rows: [{ row_index: 1, team_key: "team_1", player_name: "LTS michey", avg_combat_score: 245, kills: 17, deaths: 9, assists: 3 }],
    },
    expectedRows: 10,
    requiredRowFields: ["player_name", "agent", "avg_combat_score", "kills", "deaths", "assists", "kda_text", "econ_rating", "first_bloods", "plants", "defuses"],
  },
  {
    gameTitle: "League of Legends",
    input: {
      match: { result: "victory", game_length: "24:43", team_1_score: 23, team_2_score: 21 },
      rows: [{ row_index: 1, team_key: "team_1", player_name: "ttv SoloSSBU", champion: "Garen", level: 18, kills: 12, deaths: 2, assists: 3 }],
    },
    expectedRows: 10,
    requiredRowFields: ["role", "player_name", "champion", "level", "kills", "deaths", "assists", "kda_text", "gold", "damage_to_champions"],
  },
];

function hasContent(value) {
  if (Array.isArray(value)) return true;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

for (const testCase of CASES) {
  const output = completePostgameExtractionFields(testCase.input, testCase.gameTitle);
  assert.equal(output.rows.length, testCase.expectedRows, `${testCase.gameTitle} row count`);
  assert.equal(output.teams.length, 2, `${testCase.gameTitle} team count`);
  assert.ok(output.manual_review_required, `${testCase.gameTitle} marks generated fallbacks for review`);

  output.rows.forEach((row, rowIndex) => {
    assert.ok(row.team_key, `${testCase.gameTitle} row ${rowIndex + 1} team_key`);
    testCase.requiredRowFields.forEach((field) => {
      assert.ok(hasContent(row[field]), `${testCase.gameTitle} row ${rowIndex + 1} ${field}`);
    });
    assert.ok(hasContent(row.character_build), `${testCase.gameTitle} row ${rowIndex + 1} character_build`);
  });
}

const duplicateValorant = completePostgameExtractionFields({
  match: { result: "victory", team_1_score: 13, team_2_score: 6, map: "Pearl" },
  rows: [
    { row_index: 1, team_key: "team_1", player_name: "One", agent: "Reyna", avg_combat_score: 200, kills: 10, deaths: 5, assists: 2 },
    { row_index: 2, team_key: "team_1", player_name: "Two", agent: "Reyna", avg_combat_score: 180, kills: 9, deaths: 6, assists: 3 },
    { row_index: 3, team_key: "team_1", player_name: "Three", agent: "Reyna", avg_combat_score: 170, kills: 8, deaths: 7, assists: 4 },
  ],
}, "Valorant");

const teamOneAgents = duplicateValorant.rows
  .filter((row) => row.team_key === "team_1")
  .map((row) => row.agent);
assert.equal(teamOneAgents.filter((agent) => agent === "Reyna").length, 1, "Valorant keeps only one duplicate agent per team");
assert.ok(teamOneAgents.filter((agent) => String(agent).startsWith("Unidentified agent")).length >= 2, "Valorant duplicate agents become review placeholders");

console.log(`Post-game completion tests passed for ${CASES.length} games.`);
