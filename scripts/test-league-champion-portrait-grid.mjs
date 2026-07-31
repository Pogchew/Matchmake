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

console.log("League champion portrait-grid tests passed.");
