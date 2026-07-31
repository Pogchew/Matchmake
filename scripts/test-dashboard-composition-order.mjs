import assert from "node:assert/strict";
import { orderCompositionRows } from "../src/lib/dashboard/composition-order.js";

const leagueRoleOrder = ["Top", "Jungle", "Mid", "ADC", "Support"];
const extractedRows = [
  { player_name: "Support Player", role: "Support" },
  { player_name: "ADC Player", role: "Bottom Lane" },
  { player_name: "Unknown Player", role: "Needs review" },
  { player_name: "Mid Player", position: "Middle" },
  { player_name: "Top Player", lane: "Top Lane" },
  { player_name: "Jungle Player", role: "Jungler" },
];

const orderedRows = orderCompositionRows(extractedRows, leagueRoleOrder);

assert.deepEqual(
  orderedRows.map((row) => row.player_name),
  ["Top Player", "Jungle Player", "Mid Player", "ADC Player", "Support Player", "Unknown Player"],
  "League composition follows Top, Jungle, Mid, ADC, Support and leaves unknown roles last"
);
assert.equal(extractedRows[0].player_name, "Support Player", "ordering does not mutate saved row order");

const duplicateUnknownRoles = [
  { player_name: "Unknown One", role: "" },
  { player_name: "Unknown Two", role: "Needs review" },
];

assert.deepEqual(
  orderCompositionRows(duplicateUnknownRoles, leagueRoleOrder),
  duplicateUnknownRoles,
  "rows with unknown roles retain their relative order"
);

console.log("Dashboard composition order tests passed.");
