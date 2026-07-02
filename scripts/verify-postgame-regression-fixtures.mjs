import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { completePostgameExtractionFields } from "../src/lib/postgame-extraction.js";

const FIXTURE_URL = new URL("../fixtures/postgame-extraction/five-priority-games.json", import.meta.url);
const PRIORITY_GAMES = [
  "League of Legends",
  "Valorant",
  "Marvel Rivals",
  "Overwatch 2",
  "Deadlock",
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

const fixture = JSON.parse(await fs.readFile(FIXTURE_URL, "utf8"));
assert.equal(fixture.schema_version, 1, "supported fixture schema");
assert.ok(Array.isArray(fixture.cases), "fixture cases must be an array");
assert.deepEqual(
  fixture.cases.map(({ gameTitle }) => gameTitle).sort(),
  [...PRIORITY_GAMES].sort(),
  "fixtures cover each priority game exactly once",
);

for (const testCase of fixture.cases) {
  const output = completePostgameExtractionFields(testCase.input, testCase.gameTitle);

  assert.equal(output.rows.length, testCase.expectedRows, `${testCase.gameTitle} row count`);
  assert.equal(output.teams.length, 2, `${testCase.gameTitle} team count`);
  assert.equal(output.teams[0].players.length, testCase.expectedTeamSizes[0], `${testCase.gameTitle} team 1 size`);
  assert.equal(output.teams[1].players.length, testCase.expectedTeamSizes[1], `${testCase.gameTitle} team 2 size`);
  assert.ok(output.manual_review_required, `${testCase.gameTitle} generated fallbacks require review`);

  for (const [field, expected] of Object.entries(testCase.expectedMatch)) {
    assertLooseEqual(output.match[field], expected, `${testCase.gameTitle} match.${field}`);
  }

  output.rows.forEach((row, rowIndex) => {
    assert.ok(row.team_key, `${testCase.gameTitle} row ${rowIndex + 1} team_key`);
    for (const field of testCase.requiredRowFields) {
      assert.ok(hasContent(row[field]), `${testCase.gameTitle} row ${rowIndex + 1} ${field}`);
    }
  });

  for (const expectedRow of testCase.exactRows) {
    const row = output.rows.find((candidate) => Number(candidate.row_index) === Number(expectedRow.row_index));
    assert.ok(row, `${testCase.gameTitle} expected row ${expectedRow.row_index}`);
    for (const [field, expected] of Object.entries(expectedRow)) {
      assertLooseEqual(row[field], expected, `${testCase.gameTitle} row ${expectedRow.row_index}.${field}`);
    }
  }

  console.log(`${testCase.gameTitle}: fixture passed (${output.rows.length} rows)`);
}

console.log(`Verified ${fixture.cases.length} priority-game regression fixtures from ${fileURLToPath(FIXTURE_URL)}.`);
