#!/usr/bin/env node
/**
 * Rebuild the Deadlock hero reference assets from a local Deadlock API download.
 *
 * Source layout (default ~/Downloads/deadlock-heroes):
 *   heroes.json               -- official Deadlock hero metadata
 *   hero-assets/<slug>/<codename>_card.png   -- full hero card art (preferred)
 *   hero-assets/<slug>/<codename>_sm.png     -- tiny scoreboard icon (fallback)
 *
 * What this script writes:
 *   public/deadlock/heroes/<slug>.png        -- per-hero card art (used in dashboard lineup cards)
 *   public/deadlock/reference/deadlock-hero-reference.jpg  -- labeled grid reference sheet for Gemini
 *   src/lib/game-assets/deadlock-hero-assets.json          -- updated metadata
 *
 * Usage:
 *   node scripts/build-deadlock-reference-sheet.mjs
 *   DEADLOCK_SOURCE=/some/other/path node scripts/build-deadlock-reference-sheet.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SOURCE_ROOT =
  process.env.DEADLOCK_SOURCE ||
  path.join(os.homedir(), "Downloads", "deadlock-heroes");
const HERO_ASSETS_DIR = path.join(SOURCE_ROOT, "hero-assets");
const HEROES_JSON_PATH = path.join(SOURCE_ROOT, "heroes.json");

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_HERO_DIR = path.join(PROJECT_ROOT, "public", "deadlock", "heroes");
const OUT_REFERENCE_PATH = path.join(
  PROJECT_ROOT,
  "public",
  "deadlock",
  "reference",
  "deadlock-hero-reference.jpg"
);
const OUT_METADATA_PATH = path.join(
  PROJECT_ROOT,
  "src",
  "lib",
  "game-assets",
  "deadlock-hero-assets.json"
);

// Grid layout for the reference sheet
const GRID_COLS = 8;
const CARD_W = 160;
const CARD_H = 217; // preserves the 280x380 hero card aspect ratio
const LABEL_H = 30;
const CELL_PAD = 6;
const CELL_W = CARD_W + CELL_PAD * 2;
const CELL_H = CARD_H + LABEL_H + CELL_PAD * 2;
const HEADER_H = 56;
const SHEET_BG = "#f6f7fb";
const CELL_BG = "#ffffff";
const LABEL_COLOR = "#0f172a";
const HEADER_COLOR = "#1d3a8a";

function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function readHeroesJson() {
  // The Deadlock API flags some live heroes (The Boss, Tokamak, Gunslinger, etc.)
  // as `disabled: true` / `in_development: true`, so we cannot rely on those
  // flags. Instead we keep every hero that has a real name and exclude obvious
  // test/internal entries; we then further intersect with on-disk asset folders.
  const raw = await fs.readFile(HEROES_JSON_PATH, "utf8");
  const all = JSON.parse(raw);
  const candidates = all.filter(
    (entry) =>
      entry &&
      typeof entry.name === "string" &&
      entry.name.trim().length > 0 &&
      !entry.name.startsWith("hero_") &&
      entry.name.toLowerCase() !== "bomber" &&
      entry.name.toLowerCase() !== "shield guy"
  );
  candidates.sort((a, b) => a.name.localeCompare(b.name));
  return candidates;
}

async function findCardFile(folder) {
  let files;
  try {
    files = await fs.readdir(folder);
  } catch {
    return null;
  }

  // Preference order, all of which show the same character at large size:
  //   1. plain _card.png (neutral pose)
  //   2. _card_critical.png (different expression, same character)
  //   3. _card_gloat.png   (different expression, same character)
  //   4. _vertical.png     (full-body banner art)
  //   5. _mm.png           (medium icon — better than _sm)
  //   6. _sm.png           (tiny icon — last resort)
  const tiers = [
    { kind: "card", match: (file) => /_card\.png$/i.test(file) && !/_critical/i.test(file) && !/_gloat/i.test(file) },
    { kind: "card_critical", match: (file) => /_card_critical\.png$/i.test(file) },
    { kind: "card_gloat", match: (file) => /_card_gloat\.png$/i.test(file) },
    { kind: "vertical", match: (file) => /_vertical\.png$/i.test(file) },
    { kind: "mm", match: (file) => /_mm\.png$/i.test(file) },
    { kind: "sm", match: (file) => /_sm\.png$/i.test(file) },
  ];

  for (const tier of tiers) {
    const found = files.find(tier.match);
    if (found) return { file: found, kind: tier.kind };
  }

  return null;
}

async function collectHeroCards() {
  const heroes = await readHeroesJson();
  const folderEntries = await fs.readdir(HERO_ASSETS_DIR, { withFileTypes: true });
  const folderSet = new Set(
    folderEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  );

  const resolved = [];
  const skipped = [];

  for (const hero of heroes) {
    const slug = nameToSlug(hero.name);
    const folderName = folderSet.has(slug)
      ? slug
      : folderSet.has(slug.replace(/-/g, "")) // tolerate compact folder names
        ? slug.replace(/-/g, "")
        : null;

    if (!folderName) {
      skipped.push({ hero: hero.name, reason: `no folder for slug ${slug}` });
      continue;
    }

    const folderPath = path.join(HERO_ASSETS_DIR, folderName);
    const found = await findCardFile(folderPath);
    if (!found) {
      skipped.push({ hero: hero.name, reason: `no card/vertical/sm in ${folderName}` });
      continue;
    }

    resolved.push({
      hero_id: slug,
      hero_name: hero.name,
      slug,
      folder: folderName,
      sourcePath: path.join(folderPath, found.file),
      sourceKind: found.kind,
    });
  }

  return { heroes: resolved, skipped };
}

async function writeHeroPngs(heroes) {
  await fs.mkdir(OUT_HERO_DIR, { recursive: true });
  for (const hero of heroes) {
    const outPath = path.join(OUT_HERO_DIR, `${hero.slug}.png`);
    // Resize to a reasonable max dimension so dashboard renders are snappy,
    // but keep enough resolution that the card stays readable.
    await sharp(hero.sourcePath)
      .resize({ width: 360, height: 488, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    hero.outRelative = `/deadlock/heroes/${hero.slug}.png`;
  }
}

function labelSvg(text, width, height) {
  const safe = escapeXml(text);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${CELL_BG}" />
  <text x="${width / 2}" y="${height / 2 + 5}" font-family="Inter, Helvetica, Arial, sans-serif"
        font-size="14" font-weight="600" text-anchor="middle" fill="${LABEL_COLOR}">${safe}</text>
</svg>`.trim();
}

function headerSvg(text, width, height) {
  const safe = escapeXml(text);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="${SHEET_BG}" />
  <text x="20" y="${height / 2 + 7}" font-family="Inter, Helvetica, Arial, sans-serif"
        font-size="18" font-weight="700" fill="${HEADER_COLOR}">${safe}</text>
  <text x="20" y="${height - 10}" font-family="Inter, Helvetica, Arial, sans-serif"
        font-size="12" fill="#475569">Use these labeled hero cards to identify the small portraits attached to scoreboard player columns.</text>
</svg>`.trim();
}

async function buildReferenceSheet(heroes) {
  const rows = Math.ceil(heroes.length / GRID_COLS);
  const sheetWidth = CELL_W * GRID_COLS;
  const sheetHeight = HEADER_H + CELL_H * rows;

  const composites = [];

  // Header
  composites.push({
    input: Buffer.from(headerSvg("Deadlock Hero Reference Sheet", sheetWidth, HEADER_H)),
    top: 0,
    left: 0,
  });

  for (let i = 0; i < heroes.length; i += 1) {
    const hero = heroes[i];
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const cellLeft = col * CELL_W;
    const cellTop = HEADER_H + row * CELL_H;

    // Cell background
    composites.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}">
          <rect x="2" y="2" width="${CELL_W - 4}" height="${CELL_H - 4}" rx="10" ry="10" fill="${CELL_BG}" stroke="#e2e8f0" stroke-width="1" />
        </svg>`
      ),
      top: cellTop,
      left: cellLeft,
    });

    // Card image
    const cardBuffer = await sharp(hero.sourcePath)
      .resize({ width: CARD_W, height: CARD_H, fit: "inside", withoutEnlargement: true })
      .flatten({ background: CELL_BG })
      .png()
      .toBuffer();
    const cardMeta = await sharp(cardBuffer).metadata();
    const cardLeft = cellLeft + CELL_PAD + Math.floor((CARD_W - (cardMeta.width || CARD_W)) / 2);
    const cardTop = cellTop + CELL_PAD;

    composites.push({
      input: cardBuffer,
      top: cardTop,
      left: cardLeft,
    });

    // Label below the card
    composites.push({
      input: Buffer.from(labelSvg(hero.hero_name, CARD_W, LABEL_H)),
      top: cellTop + CELL_PAD + CARD_H,
      left: cellLeft + CELL_PAD,
    });
  }

  await fs.mkdir(path.dirname(OUT_REFERENCE_PATH), { recursive: true });
  await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 3,
      background: SHEET_BG,
    },
  })
    .composite(composites)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(OUT_REFERENCE_PATH);

  return { sheetWidth, sheetHeight };
}

async function writeMetadata(heroes) {
  const payload = heroes.map((hero) => ({
    hero_id: hero.slug,
    hero_name: hero.hero_name,
    src: hero.outRelative,
    source_file: hero.sourcePath,
    asset_type:
      hero.sourceKind === "card"
        ? "hero_card"
        : hero.sourceKind === "card_critical" || hero.sourceKind === "card_gloat"
          ? "hero_card_variant"
          : hero.sourceKind === "vertical"
            ? "hero_vertical"
            : hero.sourceKind === "mm"
              ? "hero_medium_icon"
              : "scoreboard_portrait",
    source: "deadlock-api-download",
  }));
  await fs.writeFile(OUT_METADATA_PATH, `${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  console.log(`Reading hero metadata from: ${HEROES_JSON_PATH}`);
  const { heroes, skipped } = await collectHeroCards();
  console.log(`Resolved ${heroes.length} heroes`);
  if (skipped.length) {
    console.warn(`Skipped ${skipped.length}:`);
    skipped.forEach((entry) => console.warn(`  - ${entry.hero}: ${entry.reason}`));
  }

  console.log(`Writing per-hero PNGs to ${OUT_HERO_DIR}`);
  await writeHeroPngs(heroes);

  console.log(`Composing reference sheet at ${OUT_REFERENCE_PATH}`);
  const dims = await buildReferenceSheet(heroes);
  console.log(`  -> ${dims.sheetWidth} x ${dims.sheetHeight}`);

  console.log(`Updating metadata at ${OUT_METADATA_PATH}`);
  await writeMetadata(heroes);

  const usingCards = heroes.filter((hero) => hero.sourceKind === "card").length;
  const usingFallback = heroes.length - usingCards;
  console.log(`Done. ${usingCards} heroes used full card art; ${usingFallback} fell back to other formats.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
