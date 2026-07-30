#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LEAGUE_CHAMPION_OPTIONS } from "../src/lib/game-assets/generated-character-options.js";
import { toChampionFileStem } from "../src/lib/game-assets/asset-paths.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHAMPION_DIR = path.join(PROJECT_ROOT, "public", "lol", "champions");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "public", "lol", "reference", "league-champion-reference.png");
const COLUMNS = 8;
const ICON_SIZE = 62;
const CELL_WIDTH = 118;
const CELL_HEIGHT = 94;
const HEADER_HEIGHT = 58;
const PADDING = 12;

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function main() {
  const entries = await Promise.all(LEAGUE_CHAMPION_OPTIONS.map(async (name) => {
    const filePath = path.join(CHAMPION_DIR, `${toChampionFileStem(name)}.png`);
    await fs.access(filePath);
    return { filePath, name };
  }));

  const rows = Math.ceil(entries.length / COLUMNS);
  const width = PADDING * 2 + COLUMNS * CELL_WIDTH;
  const height = HEADER_HEIGHT + PADDING + rows * CELL_HEIGHT;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#0b1220"/>
      <text x="${PADDING}" y="25" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">League champion portrait reference</text>
      <text x="${PADDING}" y="45" fill="#a9b7cc" font-family="Arial, Helvetica, sans-serif" font-size="12">${entries.length} selectable Matchmake champions · Riot Data Dragon 16.14.1</text>
      ${entries.map((entry, index) => {
        const column = index % COLUMNS;
        const row = Math.floor(index / COLUMNS);
        const x = PADDING + column * CELL_WIDTH;
        const y = HEADER_HEIGHT + row * CELL_HEIGHT;
        return `
          <rect x="${x}" y="${y}" width="${CELL_WIDTH - 6}" height="${CELL_HEIGHT - 6}" rx="9" fill="#182235" stroke="#30415d"/>
          <text x="${x + CELL_WIDTH / 2 - 3}" y="${y + 80}" fill="#f5f7fb" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" text-anchor="middle">${escapeXml(entry.name)}</text>
        `;
      }).join("")}
    </svg>
  `;

  const composites = await Promise.all(entries.map(async (entry, index) => {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const left = PADDING + column * CELL_WIDTH + Math.floor((CELL_WIDTH - 6 - ICON_SIZE) / 2);
    const top = HEADER_HEIGHT + row * CELL_HEIGHT + 7;
    const input = await sharp(entry.filePath, { failOn: "none" })
      .resize(ICON_SIZE, ICON_SIZE, { fit: "cover" })
      .png()
      .toBuffer();
    return { input, left, top };
  }));

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await sharp(Buffer.from(svg)).composite(composites).png({ compressionLevel: 9 }).toFile(OUTPUT_PATH);
  console.log(`Wrote ${entries.length}-champion reference sheet to ${OUTPUT_PATH}`);
}

await main();
