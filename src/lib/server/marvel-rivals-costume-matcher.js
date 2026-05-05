import fs from "node:fs/promises";
import path from "node:path";
import { MARVEL_RIVALS_HERO_ASSETS } from "@/lib/game-assets/marvel-rivals-hero-assets";

const AUTO_FILL_THRESHOLD = 0.88;
const REVIEW_THRESHOLD = 0.7;
const SAMPLE_SIZE = 64;
const COSTUME_ASSET_MANIFEST_PATH = path.join(process.cwd(), "src", "lib", "game-assets", "marvel-rivals-costume-assets.json");

async function loadSharp() {
  try {
    const sharpModule = await import("sharp");
    return sharpModule.default || sharpModule;
  } catch {
    return null;
  }
}

function publicAssetPath(publicUrl) {
  return path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadCostumeAssetManifest() {
  try {
    const raw = await fs.readFile(COSTUME_ASSET_MANIFEST_PATH, "utf8");
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) return [];

    return records
      .filter((asset) => asset?.local_src && asset?.hero_name)
      .map((asset) => ({
        hero_id: asset.hero_id,
        hero_name: asset.hero_name,
        costume_id: asset.costume_id,
        costume_name: asset.costume_name,
        asset_type: asset.asset_type || "costume_icon",
        src: asset.local_src,
        source: asset.source || "marvelrivalsapi",
      }));
  } catch {
    return [];
  }
}

function normalizeCropHint(cropHint, metadata) {
  if (!cropHint || !metadata?.width || !metadata?.height) return null;
  const values = [cropHint.x, cropHint.y, cropHint.width, cropHint.height].map(Number);
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null;

  const normalized = cropHint.coordinate_space === "normalized_0_1000";
  const scaleX = normalized ? metadata.width / 1000 : 1;
  const scaleY = normalized ? metadata.height / 1000 : 1;
  const left = Math.max(0, Math.round(values[0] * scaleX));
  const top = Math.max(0, Math.round(values[1] * scaleY));
  const width = Math.min(metadata.width - left, Math.round(values[2] * scaleX));
  const height = Math.min(metadata.height - top, Math.round(values[3] * scaleY));

  if (width < 12 || height < 12) return null;
  return { left, top, width, height };
}

function estimateCropForRow(row, index, metadata) {
  if (!metadata?.width || !metadata?.height) return null;
  const rowCount = 12;
  const rowIndex = Number(row?.row_index);
  const safeIndex = Number.isFinite(rowIndex) && rowIndex > 0 ? rowIndex - 1 : index;
  const topStart = Math.round(metadata.height * 0.22);
  const usableHeight = Math.round(metadata.height * 0.56);
  const rowHeight = usableHeight / rowCount;
  const size = Math.round(Math.min(metadata.width, metadata.height) * 0.055);
  const left = Math.round(metadata.width * 0.09);
  const top = Math.round(topStart + safeIndex * rowHeight + rowHeight * 0.1);

  if (size < 20 || left + size > metadata.width || top < 0 || top + size > metadata.height) return null;
  return { left, top, width: size, height: size };
}

async function imageToRawSample(sharp, input, extract) {
  let pipeline = sharp(input);
  if (extract) pipeline = pipeline.extract(extract);
  const { data } = await pipeline
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

function compareRgbDistance(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    const diff = a[index] - b[index];
    distance += diff * diff;
  }
  const maxDistance = a.length * 255 * 255;
  return Math.max(0, 1 - Math.sqrt(distance / maxDistance));
}

async function loadReferenceSamples(sharp) {
  const references = [];
  const costumeAssets = await loadCostumeAssetManifest();
  const assets = [...costumeAssets, ...MARVEL_RIVALS_HERO_ASSETS];

  for (const asset of assets) {
    const assetPath = publicAssetPath(asset.src);
    if (!(await fileExists(assetPath))) continue;

    try {
      references.push({
        asset,
        sample: await imageToRawSample(sharp, assetPath),
      });
    } catch {
      // Bad or missing images should never break extraction.
    }
  }

  return references;
}

function manualMatch(row, index, method) {
  return {
    row_index: row.row_index ?? index + 1,
    team_key: row.team_key || null,
    hero_name: null,
    hero_id: null,
    costume_name: null,
    costume_id: null,
    asset_confidence: 0,
    matched_asset_src: null,
    needs_manual_review: true,
    method,
  };
}

function applyDuplicateSafety(matches) {
  const teamGroups = new Map();
  let duplicateNulled = 0;

  matches.forEach((match) => {
    if (!match.hero_name) return;
    const teamKey = match.team_key || "unknown";
    teamGroups.set(teamKey, [...(teamGroups.get(teamKey) || []), match]);
  });

  for (const [, teamMatches] of teamGroups) {
    const byHero = new Map();
    teamMatches.forEach((match) => {
      byHero.set(match.hero_name, [...(byHero.get(match.hero_name) || []), match]);
    });

    for (const [, duplicates] of byHero) {
      if (duplicates.length < 2) continue;
      const sorted = [...duplicates].sort((a, b) => b.asset_confidence - a.asset_confidence);
      sorted.slice(1).forEach((match) => {
        match.hero_name = null;
        match.hero_id = null;
        match.costume_name = null;
        match.costume_id = null;
        match.matched_asset_src = null;
        match.needs_manual_review = true;
        match.method = `${match.method}:duplicate-nulled`;
        duplicateNulled += 1;
      });
    }
  }

  return duplicateNulled;
}

export async function matchMarvelRivalsCostumeIcons({ imageBuffer, rows = [] }) {
  const sharp = await loadSharp();
  if (!sharp) {
    return {
      matches: rows.map((row, index) => manualMatch(row, index, "sharp-unavailable")),
      debug: { referenceCount: 0, cropAttempts: 0, autoFillCount: 0, needsReviewCount: rows.length, duplicateNulled: 0 },
    };
  }

  const references = await loadReferenceSamples(sharp);
  if (!references.length) {
    return {
      matches: rows.map((row, index) => manualMatch(row, index, "no-reference-assets")),
      debug: { referenceCount: 0, cropAttempts: 0, autoFillCount: 0, needsReviewCount: rows.length, duplicateNulled: 0 },
    };
  }

  const metadata = await sharp(imageBuffer).metadata();
  let cropAttempts = 0;
  let autoFillCount = 0;
  const matches = [];

  for (const [index, row] of rows.entries()) {
    const crop = normalizeCropHint(row.portrait_crop_hint, metadata) || estimateCropForRow(row, index, metadata);
    if (!crop) {
      matches.push(manualMatch(row, index, "no-crop"));
      continue;
    }

    cropAttempts += 1;
    let cropSample = null;
    try {
      cropSample = await imageToRawSample(sharp, imageBuffer, crop);
    } catch {
      matches.push(manualMatch(row, index, "crop-failed"));
      continue;
    }

    const best = references
      .map((reference) => ({
        asset: reference.asset,
        confidence: compareRgbDistance(cropSample, reference.sample),
      }))
      .sort((a, b) => b.confidence - a.confidence)[0];

    const confidence = best?.confidence || 0;
    const suggested = best && confidence >= REVIEW_THRESHOLD;
    const autoFill = best && confidence >= AUTO_FILL_THRESHOLD;
    if (autoFill) autoFillCount += 1;

    matches.push({
      row_index: row.row_index ?? index + 1,
      team_key: row.team_key || null,
      hero_name: suggested ? best.asset.hero_name : null,
      hero_id: suggested ? best.asset.hero_id : null,
      costume_name: suggested ? best.asset.costume_name : null,
      costume_id: suggested ? best.asset.costume_id : null,
      asset_confidence: confidence,
      matched_asset_src: suggested ? best.asset.src : null,
      needs_manual_review: !autoFill,
      method: autoFill ? "costume-icon-match:auto" : suggested ? "costume-icon-match:suggested" : "costume-icon-match:low-confidence",
    });
  }

  const duplicateNulled = applyDuplicateSafety(matches);

  return {
    matches,
    debug: {
      referenceCount: references.length,
      cropAttempts,
      autoFillCount,
      needsReviewCount: matches.filter((match) => match.needs_manual_review).length,
      duplicateNulled,
    },
  };
}
