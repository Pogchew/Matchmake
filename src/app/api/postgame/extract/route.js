import { NextResponse } from "next/server";
import { getLeagueExtractionPrompt, getValorantExtractionPrompt } from "@/lib/postgame-extraction";

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
      "League of Legends": getLeagueExtractionPrompt,
      Valorant: getValorantExtractionPrompt,
    };
    const getPrompt = extractionPrompts[gameTitle];

    if (!getPrompt) {
      return errorResponse("Gemini extraction is only enabled for League of Legends and Valorant right now.");
    }

    if (!image || typeof image === "string") {
      return errorResponse("A scoreboard image is required.");
    }

    if (!image.type?.startsWith("image/")) {
      return errorResponse("Uploaded file must be an image.");
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const base64Image = imageBuffer.toString("base64");

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: getPrompt() },
            {
              inlineData: {
                mimeType: image.type,
                data: base64Image,
              },
            },
          ],
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
      return NextResponse.json({ data: parseGeminiJson(rawText) });
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
