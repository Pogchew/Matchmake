import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDeadlockExtractionPrompt, getLeagueExtractionPrompt, getMarvelRivalsExtractionPrompt, getValorantExtractionPrompt, normalizeMarvelRivalsExtraction } from "@/lib/postgame-extraction";
import { matchMarvelRivalsCostumeIcons } from "@/lib/server/marvel-rivals-costume-matcher";

export const runtime = "nodejs";

const GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
];

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

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const MARVEL_HERO_CONFIDENCE_THRESHOLD = 0.6;
const MARVEL_RIVALS_REFERENCE_DIR = path.join(process.cwd(), "public", "game-assets", "marvel-rivals", "reference");
const MARVEL_RIVALS_HERO_REFERENCE_FILE = "marvel-rivals-hero-reference.png";
const MARVEL_RIVALS_COSTUME_DATA_PATH = path.join(process.cwd(), "data", "marvel-rivals-costumes.json");
const MARVEL_RIVALS_API_ORIGIN = "https://marvelrivalsapi.com";
const DEADLOCK_REFERENCE_PATH = path.join(process.cwd(), "public", "deadlock", "reference", "deadlock-hero-reference.jpg");
const DEADLOCK_HERO_ASSETS_PATH = path.join(process.cwd(), "src", "lib", "game-assets", "deadlock-hero-assets.json");

function applyMarvelMajorityConfidenceHeroes(extraction) {
  const mergeRow = (row) => {
    const confidence = Number(row.hero_guess_confidence ?? row.hero_confidence ?? row.confidence ?? 0);
    const heroGuess = row.hero_guess ?? row.hero ?? null;
    const heroConfirmed = heroGuess && confidence >= MARVEL_HERO_CONFIDENCE_THRESHOLD ? heroGuess : null;

    return {
      ...row,
      hero_guess: heroGuess,
      hero_guess_confidence: confidence,
      needs_hero_review: Boolean(!heroConfirmed && heroGuess),
      hero_confirmed: heroConfirmed,
      hero: heroConfirmed,
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

    return {
      ...row,
      hero_guess: row.hero_guess ?? row.hero ?? null,
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
      needs_hero_review: Boolean(match?.needs_manual_review && !confirmedHero),
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

  try {
    return [await imageReferencePart(DEADLOCK_REFERENCE_PATH, "image/jpeg")];
  } catch (error) {
    console.warn("Deadlock hero reference sheet is unavailable; continuing without it.", error);
    return [];
  }
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

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return errorResponse("Gemini API key is not configured.", 500);
    }

    const formData = await request.formData();
    const gameTitle = formData.get("gameTitle");
    const image = formData.get("image");

    const extractionPrompts = {
      Deadlock: getDeadlockExtractionPrompt,
      "League of Legends": getLeagueExtractionPrompt,
      "Marvel Rivals": getMarvelRivalsExtractionPrompt,
      Valorant: getValorantExtractionPrompt,
    };
    const getPrompt = extractionPrompts[gameTitle];

    if (!getPrompt) {
      return errorResponse("Gemini extraction is only enabled for League of Legends, Valorant, Marvel Rivals, and Deadlock right now.");
    }

    if (!image || typeof image === "string") {
      return errorResponse("A scoreboard image is required.");
    }

    if (!image.type?.startsWith("image/")) {
      return errorResponse("Uploaded file must be an image.");
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const base64Image = imageBuffer.toString("base64");
    const referenceParts = [
      ...(await getMarvelRivalsReferenceParts(gameTitle)),
      ...(await getDeadlockReferenceParts(gameTitle)),
    ];
    const costumeMetadataPart = await getMarvelRivalsCostumeMetadataPart(gameTitle);
    const deadlockHeroMetadataPart = await getDeadlockHeroMetadataPart(gameTitle);
    const promptParts = [
      { text: getPrompt() },
      ...referenceParts,
      ...(costumeMetadataPart ? [costumeMetadataPart] : []),
      ...(deadlockHeroMetadataPart ? [deadlockHeroMetadataPart] : []),
      {
        inlineData: {
          mimeType: image.type,
          data: base64Image,
        },
      },
    ];

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: promptParts,
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 20000,
        responseMimeType: "application/json",
      },
    };

    let geminiResponse = null;
    let lastErrorText = "";

    for (const model of [...new Set(GEMINI_MODELS)]) {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (geminiResponse.ok) break;

      lastErrorText = await geminiResponse.text();
      const retryable = geminiResponse.status === 429 || geminiResponse.status === 503 || geminiResponse.status === 404;
      if (!retryable) break;
    }

    if (!geminiResponse?.ok) {
      const quotaExceeded = geminiResponse?.status === 429 || lastErrorText.includes("RESOURCE_EXHAUSTED") || lastErrorText.includes("quota");
      console.error("Gemini extraction failed", {
        status: geminiResponse?.status,
        body: lastErrorText,
      });
      if (quotaExceeded) {
        return errorResponse("Gemini quota is exhausted for the configured API key. You can still enter stats manually.", 429);
      }
      return errorResponse("Could not extract scoreboard data. You can still enter stats manually.", 502);
    }

    const geminiJson = await geminiResponse.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!rawText) {
      console.error("Gemini extraction returned no text", geminiJson);
      return errorResponse("Could not extract scoreboard data. You can still enter stats manually.", 502);
    }

    try {
      const parsedJson = parseGeminiJson(rawText);
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

      return NextResponse.json({ data: normalizedJson });
    } catch (parseError) {
      console.error("Gemini extraction returned unparseable JSON", {
        parseError,
        rawTextPreview: rawText.slice(0, 1200),
        rawTextLength: rawText.length,
      });
      return errorResponse("Could not parse extracted scoreboard data. You can still enter stats manually.", 502);
    }
  } catch (error) {
    console.error("Unexpected post-game extraction error", error);
    return errorResponse("Could not extract scoreboard data. You can still enter stats manually.", 500);
  }
}
