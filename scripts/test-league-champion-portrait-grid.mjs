#!/usr/bin/env node

import assert from "node:assert/strict";
import sharp from "sharp";
import {
  buildLeagueChampionPortraitGrid,
  locateLeagueMatchHistoryPortraits,
} from "../src/lib/server/league-champion-portrait-grid.js";

const screenshotWidth = 700;
const screenshotHeight = 473;
const blankScreenshot = await sharp({
  create: {
    width: screenshotWidth,
    height: screenshotHeight,
    channels: 3,
    background: "#071721",
  },
}).png().toBuffer();
const { data, info } = await sharp(blankScreenshot)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const layout = locateLeagueMatchHistoryPortraits({
  data,
  width: info.width,
  height: info.height,
  rowCount: 10,
});
assert.equal(layout.positions.length, 10, "standard League scoreboards produce ten portrait positions");
assert.equal(layout.positions[0].rowIndex, 1);
assert.equal(layout.positions[9].rowIndex, 10);
assert.equal(layout.positions[0].centerX, 82, "portrait column uses the standard match-history x position");
assert.equal(layout.positions[1].centerY - layout.positions[0].centerY, 29, "portrait rows retain scoreboard spacing");
assert.ok(layout.cropSize >= 26 && layout.cropSize <= 30, "portrait crops exclude neighboring scoreboard columns");

const portraitGrid = await buildLeagueChampionPortraitGrid(blankScreenshot, 10);
const gridMetadata = await sharp(portraitGrid.buffer).metadata();
assert.equal(portraitGrid.mimeType, "image/png");
assert.equal(gridMetadata.width, 800);
assert.equal(gridMetadata.height, 392);
assert.equal(portraitGrid.layout.positions.length, 10);

const namedScoreboardWidth = 1488;
const namedScoreboardHeight = 824;
const namedScoreboardSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${namedScoreboardWidth}" height="${namedScoreboardHeight}">
    <rect x="35" y="101" width="7" height="124" fill="#00a6b8"/>
    <rect x="35" y="287" width="7" height="122" fill="#00a6b8"/>
    <rect x="35" y="463" width="7" height="308" fill="#b31738"/>
  </svg>
`);
const namedScoreboard = await sharp({
  create: {
    width: namedScoreboardWidth,
    height: namedScoreboardHeight,
    channels: 3,
    background: "#071721",
  },
})
  .composite([{ input: namedScoreboardSvg, left: 0, top: 0 }])
  .png()
  .toBuffer();
const namedRaw = await sharp(namedScoreboard)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const namedLayout = locateLeagueMatchHistoryPortraits({
  data: namedRaw.data,
  width: namedRaw.info.width,
  height: namedRaw.info.height,
  rowCount: 10,
});
assert.equal(namedLayout.detectionMode, "team_accent_bars_detected");
assert.equal(namedLayout.positions.length, 10);
assert.deepEqual(
  namedLayout.positions.map((position) => position.centerY),
  [132, 193, 255, 317, 378, 494, 555, 617, 679, 740],
  "named scoreboard team bars locate all ten row centers despite the selected-row color gap",
);
assert.equal(namedLayout.centerX, 174, "named scoreboards use the wider portrait column position");
assert.ok(namedLayout.cropSize >= 50 && namedLayout.cropSize <= 56);

console.log("League champion portrait-grid tests passed.");
