import fs from "node:fs/promises";
import path from "node:path";

const API_BASE_URL = "https://marvelrivalsapi.com/api/v1";
const API_ORIGIN = "https://marvelrivalsapi.com";
const REQUEST_DELAY_MS = 300;
const IMAGE_DELAY_MS = 75;
const RAW_OUTPUT_FILE = path.join(process.cwd(), "data", "marvel-rivals-costumes.json");
const MANIFEST_FILE = path.join(process.cwd(), "src", "lib", "game-assets", "marvel-rivals-costume-assets.json");
const ASSET_ROOT = path.join(process.cwd(), "public", "game-assets", "marvel-rivals", "scoreboard-icons");

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

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() && value.trim() !== "0") return value.trim();
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNestedValue(source, pathExpression) {
  return pathExpression.split(".").reduce((value, key) => value?.[key], source);
}

function pickFirstNestedString(source, paths) {
  return pickFirstString(...paths.map((pathExpression) => getNestedValue(source, pathExpression)));
}

function extractCostumesArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.costumes)) return payload.costumes;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.costumes?.data)) return payload.costumes.data;
  return [];
}

function normalizeUrl(value) {
  if (!value || typeof value !== "string" || value.trim() === "0") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return `${API_ORIGIN}/rivals${trimmed}`;
  return `${API_ORIGIN}/${trimmed.replace(/^\/+/, "")}`;
}

function getDownloadCandidates(value) {
  if (!value || typeof value !== "string" || value.trim() === "0") return [];
  const trimmed = value.trim();
  const candidates = [];

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    candidates.push(trimmed);
  } else if (trimmed.startsWith("/")) {
    candidates.push(`${API_ORIGIN}/rivals${trimmed}`);
    candidates.push(`${API_ORIGIN}${trimmed}`);
    candidates.push(`${API_BASE_URL}${trimmed}`);
  } else {
    candidates.push(`${API_ORIGIN}/${trimmed.replace(/^\/+/, "")}`);
    candidates.push(`${API_BASE_URL}/${trimmed.replace(/^\/+/, "")}`);
  }

  return [...new Set(candidates)];
}

function normalizeCostumeRecord(heroName, costume = {}) {
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
  const iconUrl = pickFirstNestedString(costume, [
    "icon",
    "icon_url",
    "iconUrl",
    "image",
    "image_url",
    "imageUrl",
    "thumbnail",
    "thumbnail_url",
    "thumbnailUrl",
    "appearance",
    "appearance_url",
    "appearanceUrl",
    "assets.icon",
    "assets.image",
  ]);
  const appearanceUrl = pickFirstNestedString(costume, [
    "appearance",
    "appearance_url",
    "appearanceUrl",
    "portrait",
    "portrait_url",
    "portraitUrl",
    "full_image",
    "fullImage",
    "assets.appearance",
    "assets.portrait",
    "assets.full",
  ]);

  return {
    hero_id: slugify(heroName),
    hero_name: heroName,
    costume_id: slugify(rawCostumeId || costumeName || "unknown"),
    costume_name: costumeName || "Unknown",
    rarity: pickFirstString(costume.rarity, costume.quality, costume.tier) || null,
    icon_url: normalizeUrl(iconUrl),
    appearance_url: normalizeUrl(appearanceUrl),
    download_candidates: getDownloadCandidates(iconUrl || appearanceUrl),
    source: "marvelrivalsapi",
    raw: costume,
  };
}

async function fetchHeroCostumes(heroName, apiKey) {
  const response = await fetch(`${API_BASE_URL}/heroes/hero/${encodeURIComponent(heroName)}/costumes`, {
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

async function downloadImage(record, apiKey) {
  if (!record.download_candidates.length) {
    return { ok: false, reason: "no-image-url" };
  }

  for (const url of record.download_candidates) {
    try {
      const response = await fetch(url, {
        headers: {
          "x-api-key": apiKey,
          accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*",
        },
      });

      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) continue;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (!buffer.length) continue;

      const localDir = path.join(ASSET_ROOT, record.hero_id);
      const localPath = path.join(localDir, `${record.costume_id}.png`);
      await fs.mkdir(localDir, { recursive: true });
      await fs.writeFile(localPath, buffer);

      return {
        ok: true,
        local_src: `/game-assets/marvel-rivals/scoreboard-icons/${record.hero_id}/${record.costume_id}.png`,
        url,
      };
    } catch {
      // Try the next URL candidate.
    }
  }

  return { ok: false, reason: "download-failed" };
}

async function main() {
  const apiKey = process.env.MARVEL_RIVALS_API_KEY;
  if (!apiKey) {
    console.error("Missing MARVEL_RIVALS_API_KEY. Load it from .env.local or your shell environment before running this script.");
    process.exitCode = 1;
    return;
  }

  const rawCostumes = [];
  const manifest = [];
  const heroFailures = [];
  let imagesDownloaded = 0;
  let imagesSkipped = 0;

  for (const [heroIndex, heroName] of HEROES.entries()) {
    let costumes = [];
    try {
      costumes = await fetchHeroCostumes(heroName, apiKey);
      rawCostumes.push(...costumes);
      console.log(`✓ ${heroName}: ${costumes.length} costumes`);
    } catch (error) {
      heroFailures.push({ hero_name: heroName, error: error.message });
      console.warn(`✕ ${heroName}: ${error.message}`);
    }

    for (const costume of costumes) {
      const result = await downloadImage(costume, apiKey);
      if (result.ok) {
        imagesDownloaded += 1;
        manifest.push({
          hero_id: costume.hero_id,
          hero_name: costume.hero_name,
          costume_id: costume.costume_id,
          costume_name: costume.costume_name,
          rarity: costume.rarity,
          local_src: result.local_src,
          original_icon_url: costume.icon_url,
          original_appearance_url: costume.appearance_url,
          asset_type: "costume_icon",
          source: "marvelrivalsapi",
        });
        console.log(`  ↓ ${costume.costume_name}: saved`);
      } else {
        imagesSkipped += 1;
        console.warn(`  - ${costume.costume_name}: skipped (${result.reason})`);
      }
      await sleep(IMAGE_DELAY_MS);
    }

    if (heroIndex < HEROES.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  const rawOutput = {
    generated_at: new Date().toISOString(),
    source: API_BASE_URL,
    total_heroes_attempted: HEROES.length,
    total_successful_heroes: HEROES.length - heroFailures.length,
    total_failed_heroes: heroFailures.length,
    total_costume_records: rawCostumes.length,
    images_downloaded: imagesDownloaded,
    images_skipped: imagesSkipped,
    failures: heroFailures,
    costumes: rawCostumes.map(({ download_candidates, ...costume }) => costume),
  };

  await fs.mkdir(path.dirname(RAW_OUTPUT_FILE), { recursive: true });
  await fs.writeFile(RAW_OUTPUT_FILE, `${JSON.stringify(rawOutput, null, 2)}\n`);
  await fs.mkdir(path.dirname(MANIFEST_FILE), { recursive: true });
  await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log("\nMarvel Rivals costume icon download complete");
  console.log(`Heroes attempted: ${rawOutput.total_heroes_attempted}`);
  console.log(`Heroes succeeded: ${rawOutput.total_successful_heroes}`);
  console.log(`Heroes failed: ${rawOutput.total_failed_heroes}`);
  console.log(`Costume records found: ${rawOutput.total_costume_records}`);
  console.log(`Images downloaded: ${imagesDownloaded}`);
  console.log(`Images skipped: ${imagesSkipped}`);
  console.log(`Manifest path: ${MANIFEST_FILE}`);
  console.log(`Asset folder path: ${ASSET_ROOT}`);
}

main().catch((error) => {
  console.error("Unexpected Marvel Rivals icon download failure:", error);
  process.exitCode = 1;
});
