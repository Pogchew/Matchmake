import fs from "node:fs/promises";
import path from "node:path";

const API_BASE_URL = "https://marvelrivalsapi.com/api/v1";
const OUTPUT_FILE = path.join(process.cwd(), "data", "marvel-rivals-costumes.json");
const REQUEST_DELAY_MS = 300;

const HEROES = [
  "Adam Warlock",
  "Angela",
  "Black Panther",
  "Black Widow",
  "Blade",
  "Captain America",
  "Cloak & Dagger",
  "Doctor Strange",
  "Emma Frost",
  "Groot",
  "Hawkeye",
  "Hela",
  "Hulk",
  "Human Torch",
  "Invisible Woman",
  "Iron Fist",
  "Iron Man",
  "Jeff the Land Shark",
  "Loki",
  "Luna Snow",
  "Magik",
  "Magneto",
  "Mantis",
  "Mister Fantastic",
  "Moon Knight",
  "Namor",
  "Peni Parker",
  "Phoenix",
  "Psylocke",
  "Rocket Raccoon",
  "Scarlet Witch",
  "Spider-Man",
  "Squirrel Girl",
  "Star-Lord",
  "Storm",
  "The Punisher",
  "The Thing",
  "Thor",
  "Ultron",
  "Venom",
  "Winter Soldier",
  "Wolverine",
];

export function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getNestedValue(source, pathExpression) {
  return pathExpression.split(".").reduce((value, key) => value?.[key], source);
}

function pickFirstNestedString(source, paths) {
  return pickFirstString(...paths.map((pathExpression) => getNestedValue(source, pathExpression)));
}

export function normalizeCostumeRecord(heroName, costume = {}) {
  const costumeName = pickFirstString(
    costume.name,
    costume.costume_name,
    costume.costumeName,
    costume.label,
    costume.title
  );
  const rawCostumeId = pickFirstString(
    String(costume.id ?? ""),
    String(costume.costume_id ?? ""),
    String(costume.costumeId ?? ""),
    String(costume.uuid ?? ""),
    costume.slug,
    costumeName
  );

  return {
    hero_id: slugify(heroName),
    hero_name: heroName,
    costume_id: slugify(rawCostumeId || "unknown"),
    costume_name: costumeName || "Unknown",
    rarity: pickFirstString(costume.rarity, costume.quality, costume.tier) || null,
    icon_url: pickFirstNestedString(costume, [
      "icon_url",
      "iconUrl",
      "icon",
      "image",
      "image_url",
      "imageUrl",
      "images.icon",
      "images.icon_url",
      "images.small",
      "assets.icon",
      "assets.icon_url",
      "assets.thumbnail",
    ]),
    appearance_url: pickFirstNestedString(costume, [
      "appearance_url",
      "appearanceUrl",
      "appearance",
      "portrait",
      "portrait_url",
      "portraitUrl",
      "full_image",
      "fullImage",
      "full_image_url",
      "fullImageUrl",
      "images.appearance",
      "images.portrait",
      "images.full",
      "assets.appearance",
      "assets.portrait",
      "assets.full",
    ]),
    source: "marvelrivalsapi",
    raw: costume,
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCostumesArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.costumes)) return payload.costumes;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.costumes?.data)) return payload.costumes.data;
  return [];
}

async function fetchHeroCostumes(heroName, apiKey) {
  const url = `${API_BASE_URL}/heroes/hero/${encodeURIComponent(heroName)}/costumes`;
  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }

  const payload = await response.json();
  return extractCostumesArray(payload).map((costume) => normalizeCostumeRecord(heroName, costume));
}

async function main() {
  const apiKey = process.env.MARVEL_RIVALS_API_KEY;
  if (!apiKey) {
    console.error("Missing MARVEL_RIVALS_API_KEY. Add it to your local environment before running this script.");
    process.exitCode = 1;
    return;
  }

  const records = [];
  const failures = [];

  for (const [index, heroName] of HEROES.entries()) {
    try {
      const costumes = await fetchHeroCostumes(heroName, apiKey);
      records.push(...costumes);
      console.log(`✓ ${heroName}: ${costumes.length} costumes`);
    } catch (error) {
      failures.push({ hero_name: heroName, error: error.message });
      console.warn(`✕ ${heroName}: ${error.message}`);
    }

    if (index < HEROES.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  const output = {
    generated_at: new Date().toISOString(),
    source: "https://marvelrivalsapi.com/api/v1",
    total_heroes_attempted: HEROES.length,
    total_successful_heroes: HEROES.length - failures.length,
    total_failed_heroes: failures.length,
    total_costume_records: records.length,
    failures,
    costumes: records,
  };

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`);

  console.log("\nMarvel Rivals costume metadata fetch complete");
  console.log(`Heroes attempted: ${output.total_heroes_attempted}`);
  console.log(`Successful heroes: ${output.total_successful_heroes}`);
  console.log(`Failed heroes: ${output.total_failed_heroes}`);
  console.log(`Costume records saved: ${output.total_costume_records}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log("Review data/marvel-rivals-costumes.json before committing it, especially if it becomes large.");
}

main().catch((error) => {
  console.error("Unexpected Marvel Rivals costume fetch failure:", error);
  process.exitCode = 1;
});
