import assert from "node:assert/strict";
import {
  buildLeagueScrimComparison,
  getLeagueReviewMetric,
  getLeagueTrendMetric,
  LEAGUE_ROLE_ORDER,
} from "../src/lib/dashboard/league-scrim-comparison.js";

function review({
  id,
  playedAt,
  result = "victory",
  duration = "20:00",
  rows,
}) {
  return {
    id,
    game_title: "League of Legends",
    match_type: "scrim",
    match_result: result,
    played_at: playedAt,
    team_stats: { game_length: duration },
    team_comp: rows,
    player_rows: rows,
  };
}

function rows(offset = 0) {
  return LEAGUE_ROLE_ORDER.map((role, index) => ({
    role,
    player_name: `${role} Player`,
    champion: ["Ornn", "Xin Zhao", "Orianna", "Kai'Sa", "Nautilus"][index],
    k: index + 1 + offset,
    d: index + offset,
    a: index + 2 + offset,
    gold: 8000 + (index * 500) + (offset * 100),
    damage_to_champions: 10000 + (index * 1000) + (offset * 200),
  }));
}

const current = review({ id: "current", playedAt: "2026-07-03T10:00:00Z", rows: rows(2) });
const priorOne = review({ id: "prior-1", playedAt: "2026-07-01T10:00:00Z", rows: rows(0) });
const priorTwo = review({ id: "prior-2", playedAt: "2026-07-02T10:00:00Z", rows: rows(1) });
const nonScrim = { ...review({ id: "match", playedAt: "2026-06-30T10:00:00Z", rows: rows(10) }), match_type: "match" };

assert.equal(getLeagueReviewMetric(current, "kills"), 25);
assert.equal(getLeagueReviewMetric(current, "gold_per_minute"), 2300);
assert.equal(getLeagueTrendMetric(current, "kill_differential"), 5);
assert.equal(getLeagueTrendMetric(current, "team_kda"), 2.75);
assert.equal(getLeagueTrendMetric(current, "assists_per_kill"), 1.2);
assert.equal(Math.round(getLeagueTrendMetric(current, "damage_per_1000_gold")), 1348);

const comparison = buildLeagueScrimComparison(current, [current, priorOne, priorTwo, nonScrim]);
assert.equal(comparison.sampleSize, 2, "only earlier League scrims should form the baseline");
assert.deepEqual(comparison.metrics.map((item) => item.key), [
  "kills",
  "deaths",
  "assists",
  "gold_per_minute",
  "damage_per_minute",
]);
assert.equal(comparison.metrics[0].current, 25);
assert.equal(comparison.metrics[0].average, 17.5);
assert.equal(comparison.roleRows[0].role, "Top");
assert.equal(comparison.roleRows[0].champion, "Ornn");
assert.equal(comparison.roleRows[0].metrics.find((metric) => metric.key === "kills").average, 1.5);
assert.equal(comparison.trendPoints.length, 3);
assert.deepEqual(comparison.trendPoints.map((point) => point.id), ["prior-1", "prior-2", "current"]);
assert.equal(comparison.trendPoints.at(-1).values.kill_differential, 5);
assert.equal(comparison.trendPoints.at(-1).isCurrent, true);
assert.equal(comparison.trendPoints.at(-1).result, "victory");
assert.deepEqual(comparison.trendMetricOptions.map((option) => option.key), [
  "kill_differential",
  "team_kda",
  "assists_per_kill",
  "gold_per_minute",
  "damage_per_minute",
  "damage_per_1000_gold",
]);
assert.equal(comparison.scrimReviews.length, 3);

const noDurationCurrent = {
  ...current,
  id: "no-duration",
  team_stats: {},
};
const noDurationComparison = buildLeagueScrimComparison(noDurationCurrent, [
  { ...priorOne, team_stats: {} },
  { ...priorTwo, team_stats: {} },
]);
assert.deepEqual(noDurationComparison.metrics.map((item) => item.key).slice(-2), ["total_gold", "total_damage"]);

const sparse = buildLeagueScrimComparison(current, []);
assert.equal(sparse.sampleSize, 0);
assert.deepEqual(sparse.metrics, []);
assert.ok(sparse.roleRows.every((row) => row.metrics.every((metric) => metric.average === null)));

console.log("League scrim comparison fixtures passed.");
