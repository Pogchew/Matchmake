import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { completePostgameExtractionFields, getCounterStrikeExtractionPrompt, getDeadlockExtractionPrompt, getHonorOfKingsExtractionPrompt, getLeagueExtractionPrompt, getMarvelRivalsExtractionPrompt, getOverwatchExtractionPrompt, getRocketLeagueExtractionPrompt, getValorantExtractionPrompt, normalizeMarvelRivalsExtraction } from "@/lib/postgame-extraction";
import { VALORANT_AGENT_OPTIONS } from "@/lib/game-assets/generated-character-options";
import { matchMarvelRivalsCostumeIcons } from "@/lib/server/marvel-rivals-costume-matcher";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  process.env.GEMINI_MODEL,
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
].filter(Boolean);

const PRIMARY_MAX_OUTPUT_TOKENS = 12000;
const FALLBACK_MAX_OUTPUT_TOKENS = 8000;
const SERVER_TIME_BUDGET_MS = 70000;
const MODEL_REQUEST_TIMEOUT_MS = 52000;
const MINIMUM_ATTEMPT_TIME_MS = 5000;
const MAX_PRIMARY_MODEL_ATTEMPTS = 2;
const MAX_FALLBACK_MODEL_ATTEMPTS = 2;
const GEMINI_MAX_IMAGE_SIDE = 1400;
const GEMINI_IMAGE_QUALITY = 72;

const ROW_FIRST_EXTRACTION_RULES = `
Matchmake extraction priority:
- Extract match metadata, team grouping, and visible per-player rows first.
- Do not calculate team totals, averages, or dashboard summaries in the primary extraction. The app calculates those from rows.
- If the schema includes team_totals, leave those values null unless the screenshot explicitly shows an actual total.
- Preserve row order and team grouping exactly as shown.
- Return only stats visible in the uploaded scoreboard screenshot.
- Every returned player row must include a non-empty champion, agent, hero, or character/build identity field for that game.
- If a champion, agent, hero, or character identity is uncertain, return the best visible guess; if no identity can be read, use "Unidentified <character type> <row number>", keep the player stats, and add that field to fields_needing_manual_review.
- Do not leave saved row stat fields empty. If a visible stat is unreadable, use "Needs review" and add that field to fields_needing_manual_review. Use numeric 0 only when the screenshot visibly shows 0.
- Return compact valid JSON only. Do not explain.
`.trim();

function buildPrimaryPrompt(basePrompt) {
  return `${ROW_FIRST_EXTRACTION_RULES}\n\n${basePrompt}`;
}

function getFallbackExtractionPrompt(gameTitle) {
  const rowFieldsByGame = {
    "League of Legends": "role, player_name, champion, level, kills, deaths, assists, kda_text, gold, damage_to_champions",
    Valorant: "player_name, agent, avg_combat_score, kills, deaths, assists, kda_text, econ_rating, first_bloods, plants, defuses",
    "Marvel Rivals": "player_name, hero_guess, hero_guess_confidence, hero_confirmed=null, kills, deaths, assists, kda_text, final_hits, damage, damage_blocked, healing, accuracy_percent",
    Deadlock: "player_name, hero, kills, deaths, assists, kda_text, souls, player_damage, objective_damage, healing",
    "Overwatch 2": "player_name, hero, role, eliminations, assists, deaths, damage, healing, mitigation, final_blows, objective_kills",
    Overwatch: "player_name, hero, role, eliminations, assists, deaths, damage, healing, mitigation, final_blows, objective_kills",
    "Counter-Strike 2": "player_name, role, kills, assists, deaths, kda_text, adr, hs_percent, mvps, score, rating",
    "Rocket League": "player_name, car, score, goals, assists, saves, shots, demos, ping",
    "Honor of Kings": "player_name, hero, hero_guess, hero_confidence, role, kills, deaths, assists, kda_text, gold, damage, damage_taken, healing, participation_percent, rating",
    HOK: "player_name, hero, hero_guess, hero_confidence, role, kills, deaths, assists, kda_text, gold, damage, damage_taken, healing, participation_percent, rating",
  };

  const rowFields = rowFieldsByGame[gameTitle] || "player_name, character, kills, deaths, assists";

  return `
Extract only match metadata, team grouping, and visible player rows from this ${gameTitle} post-game screenshot.
Return JSON only. Do not explain. Do not include markdown.

Fallback mode rules:
- Keep this small and deterministic.
- Do not calculate totals, averages, comparisons, or summaries.
- Preserve row order from the screenshot.
- Preserve team grouping when visually clear.
- If team grouping is unclear, still return rows[] and set manual_review_required=true.
- Every returned row must include a non-empty champion, agent, hero, or character/build identity field for this game.
- If character identity is uncertain, return the best visible guess; if no identity can be read, use "Unidentified character <row number>" and add the field path to fields_needing_manual_review.
- Do not leave saved row stat fields empty. If a visible stat is unreadable, use "Needs review" and add the field path to fields_needing_manual_review. Use numeric 0 only when the screenshot visibly shows 0.
- Only use values visible in the screenshot.
- Convert comma numbers to integers and percentages to numbers.

Player row fields to extract for this game:
${rowFields}

Return this JSON shape:
{
  "game_title": "${gameTitle}",
  "screenshot_type": "post_game_scoreboard",
  "parser_confidence": 0,
  "manual_review_required": true,
  "match": {
    "result": null,
    "final_score": null,
    "team_1_score": null,
    "team_2_score": null,
    "team_1_name": null,
    "team_2_name": null,
    "map": null,
    "mode": null,
    "map_or_lane": null,
    "objective_or_mode": null,
    "duration": null,
    "played_at": null,
    "match_date_text": null
  },
  "rows": [
    {
      "row_index": 1,
      "team_key": null,
      "row_color_group": null,
      "player_name": null
    }
  ],
  "teams": [
    { "team_key": "team_1", "team_name": null, "team_score": null, "players": [] },
    { "team_key": "team_2", "team_name": null, "team_score": null, "players": [] }
  ],
  "fields_needing_manual_review": []
}
  `.trim();
}

function stripJsonFences(text = "") {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  if (fencedJson) return fencedJson.trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

function parseGeminiJson(rawText) {
  const cleaned = stripJsonFences(rawText);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const normalized = cleaned
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    return JSON.parse(normalized);
  }
}

function errorResponse(message, status = 400, details = {}) {
  return NextResponse.json({ error: message, details }, { status });
}

function inferImageMimeType(file) {
  if (file?.type?.startsWith("image/")) return file.type;

  const name = typeof file?.name === "string" ? file.name.toLowerCase() : "";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".bmp")) return "image/bmp";
  if (name.endsWith(".avif")) return "image/avif";

  return null;
}

const MARVEL_RIVALS_REFERENCE_DIR = path.join(process.cwd(), "public", "game-assets", "marvel-rivals", "reference");
const MARVEL_RIVALS_HERO_REFERENCE_FILE = "marvel-rivals-hero-reference.png";
const MARVEL_RIVALS_COSTUME_DATA_PATH = path.join(process.cwd(), "data", "marvel-rivals-costumes.json");
const MARVEL_RIVALS_API_ORIGIN = "https://marvelrivalsapi.com";
const VALORANT_AGENT_DIR = path.join(process.cwd(), "public", "valorant", "agents");
const DEADLOCK_REFERENCE_DIR = path.join(process.cwd(), "public", "deadlock", "reference");
// Reference sheets are sent in priority order. Each entry is { file, mimeType, label }.
// The labeled grid sheet is the primary lookup; the in-game roster sheet provides
// portrait-style fidelity that better matches small scoreboard portraits.
const DEADLOCK_REFERENCE_FILES = [
  { file: "deadlock-hero-reference.jpg", mimeType: "image/jpeg", label: "labeled-card-grid" },
  { file: "deadlock-hero-reference-ingame.png", mimeType: "image/png", label: "ingame-roster" },
  { file: "deadlock-hero-reference-ingame.jpg", mimeType: "image/jpeg", label: "ingame-roster" },
];
const DEADLOCK_HERO_ASSETS_PATH = path.join(process.cwd(), "src", "lib", "game-assets", "deadlock-hero-assets.json");

function applyMarvelMajorityConfidenceHeroes(extraction) {
  const mergeRow = (row) => {
    const confidence = Number(row.hero_guess_confidence ?? row.hero_confidence ?? row.confidence ?? 0);
    const heroGuess = row.hero_guess ?? row.hero ?? null;

    return {
      ...row,
      hero_guess: heroGuess,
      hero_guess_confidence: confidence,
      needs_hero_review: Boolean(heroGuess),
      hero_confirmed: null,
      hero: null,
    };
  };

  const rows = (extraction.rows || []).map((row) => mergeRow(row));
  const teams = (extraction.teams || []).map((team) => ({
    ...team,
    players: (team.players || []).map((row) => mergeRow(row)),
  }));
  const needsManualReview = rows.some((row) => row.needs_hero_review);

  return normalizeMarvelRivalsExtraction({
    ...extraction,
    rows,
    teams,
    manual_review_required: Boolean(extraction.manual_review_required || needsManualReview),
  });
}

function applyMarvelCostumeMatches(extraction, matches = []) {
  const byRowIndex = new Map(matches.map((match) => [Number(match.row_index), match]));

  const mergeRow = (row, fallbackIndex) => {
    const rowIndex = Number(row.row_index) || fallbackIndex + 1;
    const match = byRowIndex.get(rowIndex);
    const autoConfirmed = match?.hero_name && !match.needs_manual_review;
    const existingConfirmed = row.hero_confirmed || row.hero || null;
    const confirmedHero = autoConfirmed ? match.hero_name : existingConfirmed;
    const referenceGuess = match?.hero_name || null;
    const priorGuess = row.hero_guess ?? row.hero ?? null;
    const heroGuess = referenceGuess || priorGuess || `Unidentified hero ${rowIndex}`;

    return {
      ...row,
      hero_guess: heroGuess,
      hero_asset_match: match?.hero_name || null,
      hero_asset_confidence: match?.asset_confidence ?? null,
      hero_asset_method: match?.method || null,
      hero_confirmed: confirmedHero,
      hero: confirmedHero,
      hero_id: autoConfirmed ? match.hero_id : row.hero_id || null,
      costume_name: autoConfirmed ? match.costume_name : row.costume_name || null,
      costume_id: autoConfirmed ? match.costume_id : row.costume_id || null,
      asset_confidence: match?.asset_confidence ?? null,
      matched_asset_src: match?.matched_asset_src || null,
      needs_manual_review: Boolean(match?.needs_manual_review),
      needs_hero_review: Boolean(!confirmedHero && (match?.needs_manual_review || heroGuess)),
    };
  };

  const rows = (extraction.rows || []).map((row, index) => mergeRow(row, index));
  const teams = (extraction.teams || []).map((team) => ({
    ...team,
    players: (team.players || []).map((row, index) => mergeRow(row, index)),
  }));

  return normalizeMarvelRivalsExtraction({
    ...extraction,
    rows,
    teams,
    manual_review_required: Boolean(extraction.manual_review_required || matches.some((match) => match.needs_manual_review)),
  });
}

async function imageReferencePart(filePath, mimeType) {
  const image = await fs.readFile(filePath);
  return {
    inlineData: {
      mimeType,
      data: image.toString("base64"),
    },
  };
}

function xmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assetStemForName(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/\//g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function buildLabeledIconReferencePart({ title, entries, columns = 5, iconSize = 70 }) {
  const cellWidth = 132;
  const cellHeight = 106;
  const padding = 18;
  const titleHeight = 48;
  const rows = Math.ceil(entries.length / columns);
  const width = padding * 2 + columns * cellWidth;
  const height = padding * 2 + titleHeight + rows * cellHeight;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#101623"/>
      <text x="${padding}" y="31" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${xmlEscape(title)}</text>
      ${entries.map((entry, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = padding + column * cellWidth;
        const y = padding + titleHeight + row * cellHeight;
        return `
          <rect x="${x}" y="${y}" width="${cellWidth - 10}" height="${cellHeight - 8}" rx="10" fill="#1c2636" stroke="#34445d"/>
          <text x="${x + 8}" y="${y + iconSize + 26}" fill="#f4f7fb" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700">${xmlEscape(entry.name)}</text>
        `;
      }).join("")}
    </svg>
  `;

  const composites = [];
  for (const [index, entry] of entries.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = padding + column * cellWidth + 8;
    const top = padding + titleHeight + row * cellHeight + 8;
    const input = await sharp(entry.filePath, { failOn: "none" })
      .resize(iconSize, iconSize, { fit: "contain" })
      .png()
      .toBuffer();
    composites.push({ input, left, top });
  }

  const buffer = await sharp(Buffer.from(svg)).composite(composites).png().toBuffer();
  return {
    inlineData: {
      mimeType: "image/png",
      data: buffer.toString("base64"),
    },
  };
}

async function getValorantReferenceParts(gameTitle) {
  if (gameTitle !== "Valorant") return [];

  try {
    const entries = [];
    for (const name of VALORANT_AGENT_OPTIONS) {
      const filePath = path.join(VALORANT_AGENT_DIR, `${assetStemForName(name)}.png`);
      try {
        await fs.access(filePath);
        entries.push({ name, filePath });
      } catch {
        // The text list remains authoritative if an icon is missing locally.
      }
    }

    const parts = [
      {
        text: [
          "Valorant agent reference metadata:",
          "Return agent names only from this exact list.",
          "Use only the small row portrait/headshot, not row tint, role, player name, or vague color resemblance.",
          "A standard Valorant team cannot contain duplicate agents. If multiple same-team rows look like the same agent, mark later duplicates as unidentified/review instead of repeating the agent.",
          VALORANT_AGENT_OPTIONS.join(", "),
        ].join("\n"),
      },
    ];

    if (entries.length) {
      parts.push(await buildLabeledIconReferencePart({
        title: "Valorant agent portrait reference",
        entries,
        columns: 5,
        iconSize: 70,
      }));
    }

    return parts;
  } catch (error) {
    console.warn("Valorant reference sheet is unavailable; continuing with prompt-only extraction.", error);
    return [];
  }
}

async function getMarvelRivalsReferenceParts(gameTitle) {
  if (gameTitle !== "Marvel Rivals") return [];

  try {
    const files = await fs.readdir(MARVEL_RIVALS_REFERENCE_DIR);
    const costumeSheetFiles = files
      .filter((file) => /^marvel-rivals-costume-reference-\d+\.jpe?g$/i.test(file))
      .sort();

    const parts = [
      await imageReferencePart(path.join(MARVEL_RIVALS_REFERENCE_DIR, MARVEL_RIVALS_HERO_REFERENCE_FILE), "image/png"),
    ];

    for (const file of costumeSheetFiles) {
      parts.push(await imageReferencePart(path.join(MARVEL_RIVALS_REFERENCE_DIR, file), "image/jpeg"));
    }

    return parts;
  } catch (error) {
    console.warn("Marvel Rivals reference sheets are unavailable; continuing without them.", error);
    return [];
  }
}

async function getDeadlockReferenceParts(gameTitle) {
  if (gameTitle !== "Deadlock") return [];

  const parts = [];
  const seenLabels = new Set();
  for (const ref of DEADLOCK_REFERENCE_FILES) {
    // Avoid double-loading the same logical sheet when both .png and .jpg exist
    if (seenLabels.has(ref.label)) continue;
    const filePath = path.join(DEADLOCK_REFERENCE_DIR, ref.file);
    try {
      await fs.access(filePath);
      parts.push(await imageReferencePart(filePath, ref.mimeType));
      seenLabels.add(ref.label);
    } catch {
      // file not present — skip silently; this is expected for optional sheets
    }
  }

  if (!parts.length) {
    console.warn("No Deadlock hero reference sheets are available; continuing without them.");
  }

  return parts;
}

async function getDeadlockHeroMetadataPart(gameTitle) {
  if (gameTitle !== "Deadlock") return null;

  try {
    const raw = await fs.readFile(DEADLOCK_HERO_ASSETS_PATH, "utf8");
    const heroes = JSON.parse(raw);
    if (!Array.isArray(heroes) || !heroes.length) return null;

    return {
      text: [
        "Deadlock hero reference metadata:",
        "Use this list with the attached Deadlock hero reference sheet to identify only the small hero portraits attached to scoreboard player columns.",
        "Return a hero name from this list or null.",
        heroes.map((hero) => hero.hero_name).join(", "),
      ].join("\n"),
    };
  } catch (error) {
    console.warn("Deadlock hero metadata is unavailable; continuing without it.", error);
    return null;
  }
}

function absolutizeMarvelApiUrl(value) {
  if (!value || typeof value !== "string" || value === "0") return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${MARVEL_RIVALS_API_ORIGIN}${value}`;
  return value;
}

async function getMarvelRivalsCostumeMetadataPart(gameTitle) {
  if (gameTitle !== "Marvel Rivals") return null;

  try {
    const raw = await fs.readFile(MARVEL_RIVALS_COSTUME_DATA_PATH, "utf8");
    const data = JSON.parse(raw);
    const costumes = Array.isArray(data.costumes) ? data.costumes : [];
    if (!costumes.length) return null;

    const grouped = new Map();
    costumes.forEach((costume) => {
      if (!costume.hero_name || !costume.costume_name) return;
      const current = grouped.get(costume.hero_name) || [];
      current.push({
        costume_name: costume.costume_name,
        icon_url: absolutizeMarvelApiUrl(costume.icon_url),
        appearance_url: absolutizeMarvelApiUrl(costume.appearance_url),
      });
      grouped.set(costume.hero_name, current);
    });

    const lines = [];
    for (const [heroName, heroCostumes] of grouped) {
      const compactCostumes = heroCostumes
        .map((costume) => costume.costume_name)
        .join("; ");
      lines.push(`${heroName}: ${compactCostumes}`);
    }

    return {
      text: [
        "Marvel Rivals API costume portrait metadata:",
        "Use this API-collected costume list as label context for the attached Marvel Rivals costume reference sheet images.",
        "The costume reference sheet images are the visual lookup source. This text only maps costume names to base hero names.",
        "If a scoreboard row portrait matches a costume/skin, return the associated base hero name as hero_guess.",
        ...lines,
      ].join("\n"),
    };
  } catch (error) {
    console.warn("Marvel Rivals costume metadata is unavailable; continuing without it.", error);
    return null;
  }
}

function buildPromptParts({
  prompt,
  referenceParts = [],
  costumeMetadataPart = null,
  deadlockHeroMetadataPart = null,
  imageType,
  base64Image,
  includeReferences = true,
}) {
  const safeReferenceParts = Array.isArray(referenceParts) ? referenceParts : [];

  return [
    { text: prompt },
    ...(includeReferences ? safeReferenceParts : []),
    ...(includeReferences && costumeMetadataPart ? [costumeMetadataPart] : []),
    ...(includeReferences && deadlockHeroMetadataPart ? [deadlockHeroMetadataPart] : []),
    {
      inlineData: {
        mimeType: imageType,
        data: base64Image,
      },
    },
  ];
}

function buildGeminiRequestBody(parts, maxOutputTokens) {
  return {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens,
      responseMimeType: "application/json",
    },
  };
}

async function callGeminiModels({ apiKey, requestBody, requestStartedAt, attempts, mode }) {
  let geminiResponse = null;
  let lastErrorText = "";
  let attempted = 0;
  const maxAttempts = mode === "fallback_row_only" ? MAX_FALLBACK_MODEL_ATTEMPTS : MAX_PRIMARY_MODEL_ATTEMPTS;

  for (const model of [...new Set(GEMINI_MODELS)]) {
    if (attempted >= maxAttempts) {
      attempts.push({ model, mode, skipped: true, reason: "mode_attempt_limit_reached" });
      break;
    }

    const elapsedMs = Date.now() - requestStartedAt;
    const remainingMs = SERVER_TIME_BUDGET_MS - elapsedMs;
    if (remainingMs < MINIMUM_ATTEMPT_TIME_MS) {
      attempts.push({ model, mode, skipped: true, reason: "server_time_budget_exceeded" });
      break;
    }

    const controller = new AbortController();
    const requestTimeoutMs = Math.max(MINIMUM_ATTEMPT_TIME_MS, Math.min(MODEL_REQUEST_TIMEOUT_MS, remainingMs - 1000));
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    attempted += 1;
    try {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
    } catch (error) {
      attempts.push({
        model,
        mode,
        status: null,
        ok: false,
        error: error.name === "AbortError" ? "request_timeout" : "request_failed",
        timeoutMs: requestTimeoutMs,
      });
      lastErrorText = error.name === "AbortError" ? "request_timeout" : error.message;
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    attempts.push({
      model,
      mode,
      status: geminiResponse.status,
      ok: geminiResponse.ok,
    });

    if (geminiResponse.ok) break;

    lastErrorText = await geminiResponse.text();
    const retryable = geminiResponse.status === 429 || geminiResponse.status === 503 || geminiResponse.status === 404;
    if (!retryable) break;
  }

  return { geminiResponse, lastErrorText };
}

function getPrimaryReferencePartsForGame(gameTitle, referenceParts) {
  return referenceParts;
}

function getReferenceDebugMeta(gameTitle, referenceParts, primaryReferenceParts, costumeMetadataPart, deadlockHeroMetadataPart) {
  if (gameTitle !== "Marvel Rivals" && gameTitle !== "Deadlock" && gameTitle !== "Valorant") return {};

  return {
    referencePartsAvailable: referenceParts.length,
    referencePartsSent: primaryReferenceParts.length,
    costumeMetadataAttached: Boolean(costumeMetadataPart),
    deadlockHeroMetadataAttached: Boolean(deadlockHeroMetadataPart),
  };
}

async function readGeminiText(geminiResponse) {
  const geminiJson = await geminiResponse.json();
  return geminiJson?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim() || "";
}

async function normalizeExtractionResult({ gameTitle, parsedJson, imageBuffer }) {
  let normalizedJson = gameTitle === "Marvel Rivals" ? normalizeMarvelRivalsExtraction(parsedJson) : parsedJson;

  if (gameTitle === "Marvel Rivals") {
    normalizedJson = applyMarvelMajorityConfidenceHeroes(normalizedJson);
    const costumeMatchResult = await matchMarvelRivalsCostumeIcons({ imageBuffer, rows: normalizedJson.rows || [] });
    normalizedJson = applyMarvelCostumeMatches(normalizedJson, costumeMatchResult.matches);
    normalizedJson.meta = {
      ...(normalizedJson.meta || {}),
      costume_match_debug: costumeMatchResult.debug,
    };
  }

  return completePostgameExtractionFields(normalizedJson, gameTitle);
}

async function optimizeImageForGemini(imageBuffer, originalMimeType) {
  try {
    const optimized = await sharp(imageBuffer, { failOn: "none" })
      .rotate()
      .resize({
        width: GEMINI_MAX_IMAGE_SIDE,
        height: GEMINI_MAX_IMAGE_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: GEMINI_IMAGE_QUALITY, mozjpeg: true })
      .toBuffer();

    return {
      buffer: optimized,
      mimeType: "image/jpeg",
    };
  } catch (error) {
    console.warn("Could not optimize screenshot for Gemini; using original image.", {
      mimeType: originalMimeType,
      error: error.message,
    });
    return {
      buffer: imageBuffer,
      mimeType: originalMimeType,
    };
  }
}

async function runFallbackExtraction({ apiKey, gameTitle, imageType, base64Image, imageBuffer, requestStartedAt, attempts, fallbackReason }) {
  const fallbackParts = buildPromptParts({
    prompt: getFallbackExtractionPrompt(gameTitle),
    imageType,
    base64Image,
    includeReferences: false,
  });
  const fallbackBody = buildGeminiRequestBody(fallbackParts, FALLBACK_MAX_OUTPUT_TOKENS);
  const { geminiResponse, lastErrorText } = await callGeminiModels({
    apiKey,
    requestBody: fallbackBody,
    requestStartedAt,
    attempts,
    mode: "fallback_row_only",
  });

  if (!geminiResponse?.ok) {
    return {
      ok: false,
      errorCode: geminiResponse?.status === 503 || lastErrorText.includes("UNAVAILABLE") ? "fallback_model_overloaded" : "fallback_request_failed",
      status: geminiResponse?.status,
      lastErrorText,
    };
  }

  const rawText = await readGeminiText(geminiResponse);
  if (!rawText) {
    return { ok: false, errorCode: "fallback_empty_response", rawTextLength: 0 };
  }

  try {
    const parsedJson = parseGeminiJson(rawText);
    const normalizedJson = await normalizeExtractionResult({ gameTitle, parsedJson, imageBuffer });
    return {
      ok: true,
      data: normalizedJson,
      meta: {
        usedFallback: true,
        fallbackReason,
        extractionMode: "fallback_row_only",
        rawTextLength: rawText.length,
      },
    };
  } catch (parseError) {
    console.error("Fallback extraction returned unparseable JSON", {
      parseError,
      rawTextPreview: rawText.slice(0, 1200),
      rawTextLength: rawText.length,
    });
    return { ok: false, errorCode: "fallback_parse_failed", rawTextLength: rawText.length };
  }
}

export async function POST(request) {
  const requestStartedAt = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse("Gemini API key is not configured.", 500);
    }

    const formData = await request.formData();
    const gameTitle = formData.get("gameTitle");
    const image = formData.get("image");

    const extractionPrompts = {
      "Counter-Strike 2": getCounterStrikeExtractionPrompt,
      Deadlock: getDeadlockExtractionPrompt,
      "Honor of Kings": getHonorOfKingsExtractionPrompt,
      HOK: getHonorOfKingsExtractionPrompt,
      "League of Legends": getLeagueExtractionPrompt,
      "Marvel Rivals": getMarvelRivalsExtractionPrompt,
      Overwatch: getOverwatchExtractionPrompt,
      "Overwatch 2": getOverwatchExtractionPrompt,
      "Rocket League": getRocketLeagueExtractionPrompt,
      Valorant: getValorantExtractionPrompt,
    };
    const getPrompt = extractionPrompts[gameTitle];

    if (!getPrompt) {
      return errorResponse("Gemini extraction is only enabled for supported post-game screenshot games. SSBU is manual-entry only.");
    }

    if (!image || typeof image === "string") {
      return errorResponse("A scoreboard image is required.");
    }

    const sourceMimeType = inferImageMimeType(image);

    if (!sourceMimeType) {
      return errorResponse("Uploaded file must be an image.");
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const optimizedImage = await optimizeImageForGemini(imageBuffer, sourceMimeType);
    const base64Image = optimizedImage.buffer.toString("base64");
    const referenceParts = [
      ...(await getValorantReferenceParts(gameTitle)),
      ...(await getMarvelRivalsReferenceParts(gameTitle)),
      ...(await getDeadlockReferenceParts(gameTitle)),
    ];
    const costumeMetadataPart = await getMarvelRivalsCostumeMetadataPart(gameTitle);
    const deadlockHeroMetadataPart = await getDeadlockHeroMetadataPart(gameTitle);
    const primaryReferenceParts = getPrimaryReferencePartsForGame(gameTitle, referenceParts);
    const referenceDebugMeta = getReferenceDebugMeta(gameTitle, referenceParts, primaryReferenceParts, costumeMetadataPart, deadlockHeroMetadataPart);
    const modelAttempts = [];
    const promptParts = buildPromptParts({
      prompt: buildPrimaryPrompt(getPrompt()),
      referenceParts: primaryReferenceParts,
      costumeMetadataPart,
      deadlockHeroMetadataPart,
      imageType: optimizedImage.mimeType,
      base64Image,
      includeReferences: true,
    });
    const requestBody = buildGeminiRequestBody(promptParts, PRIMARY_MAX_OUTPUT_TOKENS);
    const { geminiResponse, lastErrorText } = await callGeminiModels({
      apiKey,
      requestBody,
      requestStartedAt,
      attempts: modelAttempts,
      mode: "primary_row_first",
    });

    if (!geminiResponse?.ok) {
      const quotaExceeded = geminiResponse?.status === 429 || lastErrorText.includes("RESOURCE_EXHAUSTED") || lastErrorText.includes("quota");
      console.error("Gemini extraction failed", {
        status: geminiResponse?.status,
        body: lastErrorText,
      });
      if (quotaExceeded) {
        return errorResponse("Gemini quota is exhausted for the configured API key. You can still enter stats manually.", 429, {
          code: "quota_exhausted",
          attempts: modelAttempts,
        });
      }
      const shouldTryRowOnlyFallback = !geminiResponse || geminiResponse.status >= 500 || lastErrorText.includes("UNAVAILABLE") || lastErrorText.includes("request_timeout") || lastErrorText.includes("request_failed");
      if (shouldTryRowOnlyFallback) {
        const fallback = await runFallbackExtraction({
          apiKey,
          gameTitle,
          imageType: optimizedImage.mimeType,
          base64Image,
          imageBuffer,
          requestStartedAt,
          attempts: modelAttempts,
          fallbackReason: "model_overloaded",
        });

        if (fallback.ok) {
          return NextResponse.json({
            data: fallback.data,
            meta: {
              durationMs: Date.now() - requestStartedAt,
              attempts: modelAttempts,
              ...referenceDebugMeta,
              ...fallback.meta,
            },
          });
        }

        return errorResponse("Gemini could not finish scoreboard extraction. Try again in a minute, or enter stats manually.", 503, {
          code: geminiResponse?.status === 503 || lastErrorText.includes("UNAVAILABLE") ? "model_overloaded" : "primary_request_failed",
          fallbackCode: fallback.errorCode,
          attempts: modelAttempts,
          usedFallback: true,
          fallbackReason: "primary_request_failed",
        });
      }
      return errorResponse("Could not extract scoreboard data. You can still enter stats manually.", 502, {
        code: "gemini_request_failed",
        status: geminiResponse?.status,
        attempts: modelAttempts,
      });
    }

    const rawText = await readGeminiText(geminiResponse);

    if (!rawText) {
      console.error("Gemini extraction returned no text");
      const fallback = await runFallbackExtraction({
        apiKey,
        gameTitle,
        imageType: optimizedImage.mimeType,
        base64Image,
        imageBuffer,
        requestStartedAt,
        attempts: modelAttempts,
        fallbackReason: "empty_response",
      });

      if (fallback.ok) {
        return NextResponse.json({
          data: fallback.data,
          meta: {
            durationMs: Date.now() - requestStartedAt,
            attempts: modelAttempts,
            ...referenceDebugMeta,
            ...fallback.meta,
          },
        });
      }

      return errorResponse("Gemini returned an empty response. You can still enter stats manually.", 502, {
        code: "empty_model_response",
        fallbackCode: fallback.errorCode,
        attempts: modelAttempts,
        usedFallback: true,
        fallbackReason: "empty_response",
      });
    }

    if (gameTitle === "Deadlock") {
      console.log("Deadlock Gemini raw response", {
        rawTextLength: rawText.length,
        rawTextPreview: rawText.slice(0, 500),
      });
    }

    try {
      const parsedJson = parseGeminiJson(rawText);
      const normalizedJson = await normalizeExtractionResult({ gameTitle, parsedJson, imageBuffer });

      if (gameTitle === "Marvel Rivals" && process.env.NODE_ENV === "development") {
        console.debug("Marvel Rivals extraction normalized", {
          rows: normalizedJson.rows?.length || 0,
          team1: normalizedJson.teams?.[0]?.players?.length || 0,
          team2: normalizedJson.teams?.[1]?.players?.length || 0,
          nulledHeroes: normalizedJson.meta?.hero_fields_nulled || [],
          confirmedHeroes: normalizedJson.rows?.filter((row) => row.hero_confirmed).length || 0,
          heroReviewNeeded: normalizedJson.rows?.filter((row) => row.needs_hero_review).length || 0,
          costumeMatch: normalizedJson.meta?.costume_match_debug || {},
        });
      }

      if (gameTitle === "Deadlock") {
        const rowsArr = Array.isArray(normalizedJson?.rows) ? normalizedJson.rows : [];
        const teamsArr = Array.isArray(normalizedJson?.teams) ? normalizedJson.teams : [];
        console.log("Deadlock extraction summary", {
          referenceSheetsSent: primaryReferenceParts.length,
          metadataAttached: Boolean(deadlockHeroMetadataPart),
          result: normalizedJson?.match?.result || null,
          duration: normalizedJson?.match?.duration || null,
          team1Name: normalizedJson?.match?.team_1_name || null,
          team2Name: normalizedJson?.match?.team_2_name || null,
          rows: rowsArr.length,
          team1Players: teamsArr[0]?.players?.length || 0,
          team2Players: teamsArr[1]?.players?.length || 0,
          rowsWithHero: rowsArr.filter((row) => row?.hero).length,
          rowsWithName: rowsArr.filter((row) => row?.player_name).length,
          rowsWithKills: rowsArr.filter((row) => Number.isFinite(Number(row?.kills))).length,
        });
      }

      return NextResponse.json({
        data: normalizedJson,
        meta: {
          durationMs: Date.now() - requestStartedAt,
          attempts: modelAttempts,
          ...referenceDebugMeta,
          usedFallback: false,
          fallbackReason: null,
          extractionMode: "primary_row_first",
        },
      });
    } catch (parseError) {
      console.error("Gemini extraction returned unparseable JSON", {
        parseError,
        rawTextPreview: rawText.slice(0, 1200),
        rawTextLength: rawText.length,
      });
      const fallback = await runFallbackExtraction({
        apiKey,
        gameTitle,
        imageType: optimizedImage.mimeType,
        base64Image,
        imageBuffer,
        requestStartedAt,
        attempts: modelAttempts,
        fallbackReason: "parse_failed",
      });

      if (fallback.ok) {
        return NextResponse.json({
          data: fallback.data,
          meta: {
            durationMs: Date.now() - requestStartedAt,
            attempts: modelAttempts,
            ...referenceDebugMeta,
            ...fallback.meta,
          },
        });
      }

      return errorResponse("Could not parse extracted scoreboard data. You can still enter stats manually.", 502, {
        code: "parse_failed",
        fallbackCode: fallback.errorCode,
        rawTextLength: rawText.length,
        attempts: modelAttempts,
        usedFallback: true,
        fallbackReason: "parse_failed",
      });
    }
  } catch (error) {
    console.error("Unexpected post-game extraction error", error);
    return errorResponse("Could not extract scoreboard data. You can still enter stats manually.", 500, {
      code: "unexpected_extraction_error",
      message: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
