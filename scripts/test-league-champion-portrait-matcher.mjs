#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import { toChampionFileStem } from "../src/lib/game-assets/asset-paths.js";
import {
  combineLeagueChampionRecognition,
  matchLeagueChampionPortraits,
} from "../src/lib/server/league-champion-portrait-matcher.js";

const width = 700;
const height = 473;
const centerX = 82;
const centersY = [155, 184, 213, 242, 271, 327, 356, 385, 414, 443];
const champions = [
  "Vladimir",
  "Gwen",
  "Trundle",
  "Kai'Sa",
  "Nautilus",
  "Sion",
  "Nocturne",
  "Orianna",
  "Ziggs",
  "Rell",
];
const ringSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${centersY.map((centerY) => `
      <circle cx="${centerX}" cy="${centerY}" r="15" fill="#d9a72a"/>
      <circle cx="${centerX}" cy="${centerY}" r="13" fill="#061721"/>
    `).join("")}
  </svg>
`);
const composites = [{ input: ringSvg, left: 0, top: 0 }];

for (const [index, champion] of champions.entries()) {
  const mask = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26">
      <circle cx="13" cy="13" r="13" fill="#ffffff"/>
    </svg>
  `);
  const input = await sharp(path.join(
    process.cwd(),
    "public",
    "lol",
    "champions",
    `${toChampionFileStem(champion)}.png`,
  ))
    .resize(26, 26)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  composites.push({
    input,
    left: centerX - 13,
    top: centersY[index] - 13,
  });
}

const syntheticScoreboard = await sharp({
  create: {
    width,
    height,
    channels: 3,
    background: "#061721",
  },
})
  .composite(composites)
  .png()
  .toBuffer();
const matchResult = await matchLeagueChampionPortraits(syntheticScoreboard, champions.length);
assert.equal(matchResult.status, "completed");
assert.deepEqual(
  matchResult.matches.map((match) => match.candidates[0].champion),
  champions,
  "direct portrait matching follows row order without champion-name text",
);

const combined = combineLeagueChampionRecognition({
  rows: [{ row_index: 1, champion: "Karma" }],
}, {
  status: "completed",
  matches: [{
    row_index: 1,
    margin: 0.002,
    candidates: [
      { champion: "Camille", distance: 0.372 },
      { champion: "Karma", distance: 0.374 },
    ],
  }],
});
assert.equal(combined.rows[0].champion, "Karma", "the model may break only a close local visual tie");
assert.equal(combined.rows[0].recognition_method, "portrait_match_with_model_tiebreak");

console.log("League champion portrait-matcher tests passed.");
