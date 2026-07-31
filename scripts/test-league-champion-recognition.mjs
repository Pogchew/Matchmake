#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  getLeagueChampionRecognitionPrompt,
  LEAGUE_CHAMPION_AUTO_ACCEPT_CONFIDENCE,
  mergeLeagueChampionRecognition,
} from "../src/lib/league-champion-recognition.js";
import { getLeagueExtractionPrompt } from "../src/lib/postgame-extraction.js";

const statsPrompt = getLeagueExtractionPrompt();
assert.match(statsPrompt, /readable champion-name label/i);
assert.match(statsPrompt, /Do not infer or guess champion identity from portrait art/i);
assert.match(statsPrompt, /portrait recognition runs in a separate second pass only for rows without a readable/i);
assert.doesNotMatch(statsPrompt, /attached labeled League champion portrait reference/i);

const recognitionPrompt = getLeagueChampionRecognitionPrompt(2);
assert.match(recognitionPrompt, /champion portrait recognition only/i);
assert.match(recognitionPrompt, /Do not extract or return player names, K\/D\/A, items, gold, damage/i);
assert.match(recognitionPrompt, /Return exactly 2 row results/i);

const extraction = {
  rows: [
    { row_index: 1, champion: "Unidentified champion 1", kills: 8 },
    { row_index: 2, champion: "Unidentified champion 2", kills: 3 },
  ],
  teams: [
    {
      team_key: "team_1",
      players: [
        { row_index: 1, champion: "Unidentified champion 1", kills: 8 },
        { row_index: 2, champion: "Unidentified champion 2", kills: 3 },
      ],
    },
    { team_key: "team_2", players: [] },
  ],
  fields_needing_manual_review: [
    "rows[0].champion",
    "rows[1].champion",
    "teams[0].players[0].champion",
    "teams[0].players[1].champion",
    "rows[1].gold",
  ],
  manual_review_required: true,
};

const recognition = {
  rows: [
    { row_index: 1, champion: "Leblanc", confidence: 93, needs_manual_review: false },
    { row_index: 2, champion: "Ahri", confidence: LEAGUE_CHAMPION_AUTO_ACCEPT_CONFIDENCE - 0.01, needs_manual_review: false },
  ],
};

const merged = mergeLeagueChampionRecognition(extraction, recognition);
assert.equal(merged.data.rows[0].champion, "LeBlanc", "accepted recognitions use canonical selector names");
assert.equal(merged.data.teams[0].players[0].champion, "LeBlanc", "accepted recognitions merge into grouped team rows");
assert.equal(merged.data.rows[0].champion_recognition_status, "accepted");
assert.equal(merged.data.rows[0].needs_manual_review, false, "accepted champions clear champion-only row review state");
assert.equal(merged.data.rows[1].champion, "Unidentified champion 2", "low-confidence matches stay unidentified");
assert.equal(merged.data.rows[1].champion_guess, "Ahri", "low-confidence candidates remain available for manual review");
assert.equal(merged.data.rows[1].champion_recognition_status, "needs_review");
assert.ok(!merged.data.fields_needing_manual_review.includes("rows[0].champion"), "accepted champion review paths are cleared");
assert.ok(merged.data.fields_needing_manual_review.includes("rows[1].champion"), "uncertain champion review paths remain");
assert.ok(merged.data.fields_needing_manual_review.includes("rows[1].gold"), "unrelated stat review paths are preserved");
assert.equal(merged.data.manual_review_required, true, "unrelated and uncertain fields keep manual review enabled");
assert.deepEqual(merged.summary, {
  attempted_rows: 2,
  accepted_rows: 1,
  review_rows: 1,
  confidence_threshold: LEAGUE_CHAMPION_AUTO_ACCEPT_CONFIDENCE,
});

const fullyAccepted = mergeLeagueChampionRecognition({
  rows: [{ row_index: 1, champion: "Unidentified champion 1", needs_manual_review: true }],
  fields_needing_manual_review: ["rows[0].champion"],
  manual_review_required: true,
}, {
  rows: [{ row_index: 1, champion: "Locke", confidence: 0.98, needs_manual_review: false }],
});
assert.equal(fullyAccepted.data.rows[0].champion, "Locke");
assert.deepEqual(fullyAccepted.data.fields_needing_manual_review, []);
assert.equal(fullyAccepted.data.manual_review_required, false, "champion-only review clears after every row is accepted");

const visibleTextFirst = mergeLeagueChampionRecognition({
  rows: [
    { row_index: 1, champion: "Yone", kills: 14 },
    { row_index: 2, champion: "Skarner", kills: 3 },
    { row_index: 3, champion: "Orianna", kills: 12 },
  ],
  fields_needing_manual_review: [],
  manual_review_required: false,
}, {
  rows: [
    { row_index: 1, champion: "Yone", confidence: 0.95, needs_manual_review: false },
    { row_index: 2, champion: "Samira", confidence: 0.95, needs_manual_review: false },
  ],
});
assert.equal(visibleTextFirst.data.rows[0].champion, "Yone", "an exact visible label remains the primary identity");
assert.equal(visibleTextFirst.data.rows[0].champion_recognition_status, "accepted_text");
assert.equal(visibleTextFirst.data.rows[0].champion_recognition_method, "visible_text_confirmed_by_portrait");
assert.equal(visibleTextFirst.data.rows[0].needs_manual_review, false);
assert.equal(visibleTextFirst.data.rows[1].champion, "Skarner", "a portrait disagreement never overwrites readable text");
assert.equal(visibleTextFirst.data.rows[1].champion_portrait_guess, "Samira");
assert.equal(visibleTextFirst.data.rows[1].champion_portrait_conflict, true);
assert.equal(visibleTextFirst.data.rows[1].champion_recognition_status, "accepted_text");
assert.equal(visibleTextFirst.data.rows[1].champion_recognition_method, "visible_text_portrait_conflict_ignored");
assert.equal(visibleTextFirst.data.rows[1].needs_manual_review, false, "weaker portrait guesses cannot force review on exact visible text");
assert.equal(visibleTextFirst.data.rows[2].champion, "Orianna", "visible text is accepted when portrait recognition is unavailable");
assert.equal(visibleTextFirst.data.rows[2].champion_recognition_method, "visible_text");
assert.ok(!visibleTextFirst.data.fields_needing_manual_review.includes("rows[1].champion"));
assert.deepEqual(visibleTextFirst.summary, {
  attempted_rows: 3,
  accepted_rows: 3,
  review_rows: 0,
  confidence_threshold: LEAGUE_CHAMPION_AUTO_ACCEPT_CONFIDENCE,
});

console.log("League champion recognition tests passed.");
