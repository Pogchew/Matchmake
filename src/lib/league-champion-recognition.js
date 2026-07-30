import { normalizeLeagueChampionName } from "./game-assets/league-champions.js";

export const LEAGUE_CHAMPION_AUTO_ACCEPT_CONFIDENCE = 0.8;

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const normalized = number > 1 && number <= 100 ? number / 100 : number;
  return Math.max(0, Math.min(1, normalized));
}

function isChampionReviewField(field = "") {
  return String(field).endsWith(".champion");
}

function addReviewField(fields, field) {
  if (field && !fields.includes(field)) fields.push(field);
}

export function getLeagueChampionRecognitionPrompt(rowCount = 0) {
  return `
You are performing champion portrait recognition only for a League of Legends post-game scoreboard.
The scoreboard statistics have already been extracted in a separate pass.

Rules:
- Inspect only the champion portrait in each visible player row.
- Do not extract or return player names, K/D/A, items, gold, damage, roles, team totals, or match metadata.
- Use the attached labeled champion portrait reference and exact champion list as the only identity source.
- Return champion names exactly as written in that reference.
- Preserve global row order: all rows of the first displayed team from top to bottom, then all rows of the second displayed team from top to bottom.
- Return exactly ${rowCount} row results when ${rowCount} player rows are visible.
- Confidence must be a number from 0 to 1 based only on portrait similarity.
- If a portrait is unclear or does not confidently match one reference, set champion to null and needs_manual_review to true. Never make a best guess.
- Return compact valid JSON only. Do not include markdown or explanations.

Return this exact shape:
{
  "rows": [
    {
      "row_index": 1,
      "champion": null,
      "confidence": 0,
      "needs_manual_review": true
    }
  ]
}
  `.trim();
}

export function mergeLeagueChampionRecognition(extraction = {}, recognition = {}) {
  const recognitionRows = Array.isArray(recognition?.rows) ? recognition.rows : [];
  const recognitionByIndex = new Map(recognitionRows.map((row, index) => {
    const rowIndex = Number(row?.row_index) || index + 1;
    const champion = normalizeLeagueChampionName(row?.champion);
    const confidence = normalizeConfidence(row?.confidence);
    return [rowIndex, {
      champion,
      confidence,
      accepted: Boolean(champion && confidence >= LEAGUE_CHAMPION_AUTO_ACCEPT_CONFIDENCE && !row?.needs_manual_review),
    }];
  }));
  const manualReviewFields = Array.isArray(extraction.fields_needing_manual_review)
    ? [...extraction.fields_needing_manual_review]
    : [];
  const acceptedPaths = new Set();

  const mergeRow = (row = {}, rowIndex, path) => {
    const match = recognitionByIndex.get(rowIndex);
    const championPath = `${path}.champion`;
    const hasOtherRowReview = manualReviewFields.some((field) => field.startsWith(`${path}.`) && field !== championPath);

    if (match?.accepted) {
      acceptedPaths.add(championPath);
      return {
        ...row,
        champion: match.champion,
        champion_guess: match.champion,
        champion_recognition_confidence: match.confidence,
        champion_recognition_status: "accepted",
        needs_manual_review: hasOtherRowReview,
      };
    }

    addReviewField(manualReviewFields, championPath);
    return {
      ...row,
      champion: `Unidentified champion ${rowIndex}`,
      champion_guess: match?.champion || null,
      champion_recognition_confidence: match?.confidence || 0,
      champion_recognition_status: "needs_review",
      needs_manual_review: true,
    };
  };

  const sourceRows = Array.isArray(extraction.rows) ? extraction.rows : null;
  const rows = sourceRows
    ? sourceRows.map((row, index) => mergeRow(row, Number(row?.row_index) || index + 1, `rows[${index}]`))
    : extraction.rows;
  let flatIndex = 0;
  const teams = Array.isArray(extraction.teams)
    ? extraction.teams.map((team, teamIndex) => ({
      ...team,
      players: Array.isArray(team?.players)
        ? team.players.map((row, playerIndex) => {
          flatIndex += 1;
          return mergeRow(row, Number(row?.row_index) || flatIndex, `teams[${teamIndex}].players[${playerIndex}]`);
        })
        : team?.players,
    }))
    : extraction.teams;
  const attemptedRows = sourceRows?.length || flatIndex;
  const acceptedRows = Array.from({ length: attemptedRows }, (_, index) => recognitionByIndex.get(index + 1))
    .filter((match) => match?.accepted)
    .length;
  const reviewRows = Math.max(0, attemptedRows - acceptedRows);

  const remainingReviewFields = manualReviewFields.filter((field) => !acceptedPaths.has(field));
  const originalReviewFields = Array.isArray(extraction.fields_needing_manual_review)
    ? extraction.fields_needing_manual_review
    : [];
  const originalHadNonChampionReview = originalReviewFields.some((field) => !isChampionReviewField(field));

  return {
    data: {
      ...extraction,
      rows,
      teams,
      fields_needing_manual_review: [...new Set(remainingReviewFields)],
      manual_review_required: Boolean(
        remainingReviewFields.length
        || reviewRows
        || (extraction.manual_review_required && (originalReviewFields.length === 0 || originalHadNonChampionReview))
      ),
    },
    summary: {
      attempted_rows: attemptedRows,
      accepted_rows: acceptedRows,
      review_rows: reviewRows,
      confidence_threshold: LEAGUE_CHAMPION_AUTO_ACCEPT_CONFIDENCE,
    },
  };
}
