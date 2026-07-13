import assert from "node:assert/strict";
import { calculateReviewKpis, formatSignedAverage } from "../src/lib/dashboard/team-review-kpis.js";

assert.equal(formatSignedAverage([]), "—");
assert.equal(formatSignedAverage([2, 4]), "+3.0");
assert.equal(formatSignedAverage([-3, -1], { decimals: 0 }), "-2");

const valorantKpis = calculateReviewKpis([
  { match_result: "victory", team_score: 13, opponent_score: 8, map_or_mode: "Ascent", team_comp: [{ agent: "Jett" }] },
  { match_result: "defeat", team_score: 10, opponent_score: 13, map_or_mode: "Ascent", team_comp: [{ agent: "Jett" }] },
], "Valorant");
assert.deepEqual(valorantKpis, [
  { label: "Reviews", value: 2 },
  { label: "Wins", value: 1 },
  { label: "Losses", value: 1 },
  { label: "Win Rate", value: "50%" },
  { label: "Avg Margin", value: "1.0" },
  { label: "Most Used Agent", value: "Jett" },
  { label: "Best Map/Mode", value: "Ascent" },
]);

const leagueKpis = calculateReviewKpis([{
  match_result: "victory",
  team_score: 20,
  opponent_score: 15,
  team_stats: { total_gold: 52000, total_damage_to_champions: 76000 },
  opponent_stats: { total_gold: 48000, total_damage_to_champions: 68000 },
  team_comp: [{ champion: "Garen" }],
}], "League of Legends");
assert.deepEqual(leagueKpis.slice(4), [
  { label: "Avg Kill Diff", value: "+5.0" },
  { label: "Avg Gold Diff", value: "+4,000" },
  { label: "Avg Damage Diff", value: "+8,000" },
  { label: "Most Used Champion", value: "Garen" },
]);

console.log("Team review KPI tests passed.");
