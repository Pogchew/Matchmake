import path from "node:path";
import sharp from "sharp";
import { LEAGUE_CHAMPION_OPTIONS } from "../game-assets/generated-character-options.js";
import { toChampionFileStem } from "../game-assets/asset-paths.js";
import { normalizeLeagueChampionName } from "../game-assets/league-champions.js";
import { locateLeagueMatchHistoryPortraits } from "./league-champion-portrait-grid.js";

const SOURCE_PATCH_SIZE = 18;
const DESCRIPTOR_SAMPLE_POINTS = [1, 4, 7, 10, 13, 16];
const REFERENCE_SIZES = [24, 26, 28, 30, 32, 34];
const MAX_CONFIDENT_DISTANCE = 0.4;
const MIN_CONFIDENT_MARGIN = 0.005;
const STRONG_DISTANCE = 0.3;
const MODEL_TIE_BREAK_RANGE = 0.03;
const REFERENCE_CACHE_KEY = "__matchmakeLeagueChampionPortraitReferences";
const REFINEMENT_X_OFFSETS = [-2, 0, 2];
const REFINEMENT_Y_OFFSETS = [-2, 0, 2, 4];

function portraitDescriptor(data, width, left, top) {
  const descriptor = [];
  for (const y of DESCRIPTOR_SAMPLE_POINTS) {
    for (const x of DESCRIPTOR_SAMPLE_POINTS) {
      const index = ((top + y) * width + left + x) * 3;
      descriptor.push(data[index], data[index + 1], data[index + 2]);
    }
  }

  for (let channel = 0; channel < 3; channel += 1) {
    let mean = 0;
    let count = 0;
    for (let index = channel; index < descriptor.length; index += 3) {
      mean += descriptor[index];
      count += 1;
    }
    mean /= count;

    let magnitude = 0;
    for (let index = channel; index < descriptor.length; index += 3) {
      magnitude += (descriptor[index] - mean) ** 2;
    }
    magnitude = Math.sqrt(magnitude) || 1;
    for (let index = channel; index < descriptor.length; index += 3) {
      descriptor[index] = (descriptor[index] - mean) / magnitude;
    }
  }

  return descriptor;
}

function descriptorDistance(first, second) {
  let correlation = 0;
  for (let index = 0; index < first.length; index += 1) {
    correlation += first[index] * second[index];
  }
  return 1 - correlation / 3;
}

function fullPortraitDescriptor(data, width, left, top) {
  const descriptor = [];
  for (let y = 0; y < SOURCE_PATCH_SIZE; y += 1) {
    for (let x = 0; x < SOURCE_PATCH_SIZE; x += 1) {
      const index = ((top + y) * width + left + x) * 3;
      descriptor.push(data[index], data[index + 1], data[index + 2]);
    }
  }

  for (let channel = 0; channel < 3; channel += 1) {
    let mean = 0;
    let count = 0;
    for (let index = channel; index < descriptor.length; index += 3) {
      mean += descriptor[index];
      count += 1;
    }
    mean /= count;

    let magnitude = 0;
    for (let index = channel; index < descriptor.length; index += 3) {
      magnitude += (descriptor[index] - mean) ** 2;
    }
    magnitude = Math.sqrt(magnitude) || 1;
    for (let index = channel; index < descriptor.length; index += 3) {
      descriptor[index] = (descriptor[index] - mean) / magnitude;
    }
  }

  return descriptor;
}

async function getLeagueChampionPortraitReferences() {
  if (globalThis[REFERENCE_CACHE_KEY]) return globalThis[REFERENCE_CACHE_KEY];

  const references = [];
  for (const champion of LEAGUE_CHAMPION_OPTIONS) {
    const filePath = path.join(
      process.cwd(),
      "public",
      "lol",
      "champions",
      `${toChampionFileStem(champion)}.png`,
    );
    const variants = [];
    for (const size of REFERENCE_SIZES) {
      const { data } = await sharp(filePath, { failOn: "none" })
        .resize(size, size, { fit: "fill" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      variants.push({ data, size });
    }
    references.push({ champion, variants });
  }

  globalThis[REFERENCE_CACHE_KEY] = references;
  return references;
}

function getSourceDescriptor(image, position) {
  const left = Math.round(position.centerX - SOURCE_PATCH_SIZE / 2);
  const top = Math.round(position.centerY - SOURCE_PATCH_SIZE / 2);
  if (
    left < 0
    || top < 0
    || left + SOURCE_PATCH_SIZE > image.width
    || top + SOURCE_PATCH_SIZE > image.height
  ) {
    return null;
  }
  return portraitDescriptor(image.data, image.width, left, top);
}

function getRefinementSourceDescriptors(image, position) {
  const descriptors = [];
  for (const offsetX of REFINEMENT_X_OFFSETS) {
    for (const offsetY of REFINEMENT_Y_OFFSETS) {
      const left = Math.round(position.centerX - SOURCE_PATCH_SIZE / 2 + offsetX);
      const top = Math.round(position.centerY - SOURCE_PATCH_SIZE / 2 + offsetY);
      if (
        left < 0
        || top < 0
        || left + SOURCE_PATCH_SIZE > image.width
        || top + SOURCE_PATCH_SIZE > image.height
      ) {
        continue;
      }
      descriptors.push(fullPortraitDescriptor(image.data, image.width, left, top));
    }
  }
  return descriptors;
}

function scoreChampionReference(sourceDescriptor, reference) {
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const variant of reference.variants) {
    for (let top = 0; top + SOURCE_PATCH_SIZE <= variant.size; top += 1) {
      for (let left = 0; left + SOURCE_PATCH_SIZE <= variant.size; left += 1) {
        const referenceDescriptor = portraitDescriptor(variant.data, variant.size, left, top);
        const distance = descriptorDistance(sourceDescriptor, referenceDescriptor);
        if (distance < bestDistance) bestDistance = distance;
      }
    }
  }

  return bestDistance;
}

function scoreChampionReferenceFull(sourceDescriptors, reference) {
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const variant of reference.variants) {
    for (let top = 0; top + SOURCE_PATCH_SIZE <= variant.size; top += 1) {
      for (let left = 0; left + SOURCE_PATCH_SIZE <= variant.size; left += 1) {
        const referenceDescriptor = fullPortraitDescriptor(variant.data, variant.size, left, top);
        for (const sourceDescriptor of sourceDescriptors) {
          const distance = descriptorDistance(sourceDescriptor, referenceDescriptor);
          if (distance < bestDistance) bestDistance = distance;
        }
      }
    }
  }

  return bestDistance;
}

export async function matchLeagueChampionPortraits(imageBuffer, rowCount = 10) {
  const orientedBuffer = await sharp(imageBuffer, { failOn: "none" })
    .rotate()
    .removeAlpha()
    .png()
    .toBuffer();
  const { data, info } = await sharp(orientedBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const layout = locateLeagueMatchHistoryPortraits({
    data,
    width: info.width,
    height: info.height,
    rowCount,
  });

  if (layout.detectionMode !== "gold_border_detected") {
    return { status: "skipped_nonstandard_layout", layout, matches: [] };
  }

  const sources = layout.positions.map((position) => ({
    rowIndex: position.rowIndex,
    position,
    descriptor: getSourceDescriptor({ data, width: info.width, height: info.height }, position),
    scores: [],
  }));
  const references = await getLeagueChampionPortraitReferences();

  for (const reference of references) {
    for (const source of sources) {
      if (!source.descriptor) continue;
      source.scores.push({
        champion: reference.champion,
        distance: scoreChampionReference(source.descriptor, reference),
      });
    }
  }

  const matches = sources.map((source) => {
    let candidates = source.scores
      .sort((first, second) => first.distance - second.distance)
      .slice(0, 5)
      .map((candidate) => ({
        champion: candidate.champion,
        distance: Number(candidate.distance.toFixed(4)),
      }));
    let refinement = null;

    if ((candidates[0]?.distance ?? Number.POSITIVE_INFINITY) > STRONG_DISTANCE) {
      const refinementSources = getRefinementSourceDescriptors(
        { data, width: info.width, height: info.height },
        source.position,
      );
      candidates = references
        .map((reference) => ({
          champion: reference.champion,
          distance: scoreChampionReferenceFull(refinementSources, reference),
        }))
        .sort((first, second) => first.distance - second.distance)
        .slice(0, 5)
        .map((candidate) => ({
          champion: candidate.champion,
          distance: Number(candidate.distance.toFixed(4)),
        }));
      refinement = "full_pixel_alignment";
    }

    return {
      row_index: source.rowIndex,
      candidates,
      refinement,
      distance: candidates[0]?.distance ?? null,
      margin: candidates.length >= 2
        ? Number((candidates[1].distance - candidates[0].distance).toFixed(4))
        : 0,
    };
  });

  return { status: "completed", layout, matches };
}

export function combineLeagueChampionRecognition(modelRecognition = {}, portraitMatchResult = {}) {
  const modelRows = Array.isArray(modelRecognition?.rows) ? modelRecognition.rows : [];
  const modelByRow = new Map(modelRows.map((row, index) => [
    Number(row?.row_index) || index + 1,
    normalizeLeagueChampionName(row?.champion),
  ]));
  const portraitMatches = Array.isArray(portraitMatchResult?.matches) ? portraitMatchResult.matches : [];

  if (portraitMatchResult?.status !== "completed" || !portraitMatches.length) {
    return modelRecognition;
  }

  return {
    rows: portraitMatches.map((match) => {
      const best = match.candidates?.[0];
      const modelChampion = modelByRow.get(Number(match.row_index)) || "";
      const modelCandidate = match.candidates?.find((candidate) => candidate.champion === modelChampion);
      const locallyStrong = Boolean(best && best.distance <= STRONG_DISTANCE);
      const locallySeparated = Boolean(
        best
        && best.distance <= MAX_CONFIDENT_DISTANCE
        && match.margin >= MIN_CONFIDENT_MARGIN
      );
      const modelBreaksCloseTie = Boolean(
        best
        && modelCandidate
        && best.distance <= MAX_CONFIDENT_DISTANCE
        && modelCandidate.distance <= best.distance + MODEL_TIE_BREAK_RANGE
      );
      const selected = modelBreaksCloseTie && !locallyStrong && match.margin < MIN_CONFIDENT_MARGIN
        ? modelCandidate
        : best;
      const accepted = Boolean(selected && (locallyStrong || locallySeparated || modelBreaksCloseTie));

      return {
        row_index: match.row_index,
        champion: accepted ? selected.champion : null,
        confidence: accepted ? 0.95 : 0,
        needs_manual_review: !accepted,
        recognition_method: selected === modelCandidate && selected !== best
          ? "portrait_match_with_model_tiebreak"
          : "portrait_match",
        portrait_refinement: match.refinement || null,
        portrait_distance: selected?.distance ?? null,
        portrait_margin: match.margin,
        portrait_candidates: match.candidates,
      };
    }),
  };
}
