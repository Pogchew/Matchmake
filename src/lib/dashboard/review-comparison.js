const LOWER_IS_BETTER = new Set(["damage_taken", "deaths", "team_deaths", "total_deaths"]);

const STAT_SPECS = {
  "League of Legends": [
    { key: "team_kills", group: "Output", label: "Team Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"], positive: "higher", explanation: ["More fight pressure than usual.", "Less fight pressure than usual."] },
    { key: "team_deaths", group: "Efficiency", label: "Team Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"], positive: "lower", explanation: ["Fewer deaths than usual.", "More deaths than usual."] },
    { key: "team_assists", group: "Output", label: "Team Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"], positive: "higher", explanation: ["More teamfight participation than usual.", "Less teamfight participation than usual."] },
    { key: "total_gold", group: "Efficiency", label: "Total Gold", statKeys: "total_gold", rowKeys: "gold", positive: "higher", explanation: ["Your team earned more resources than usual.", "Your team earned fewer resources than usual."] },
    { key: "gold_per_min", group: "Efficiency", label: "Gold / Min", statKeys: "total_gold", rowKeys: "gold", perMinute: true, positive: "higher", explanation: ["Your team earned resources faster than usual.", "Your team earned resources slower than usual."] },
    { key: "damage_to_champions", group: "Output", label: "Damage to Champions", statKeys: "total_damage_to_champions", rowKeys: "damage_to_champions", positive: "higher", explanation: ["More damage pressure than usual.", "Less damage pressure than usual."] },
    { key: "damage_per_min", group: "Output", label: "Damage / Min", statKeys: "total_damage_to_champions", rowKeys: "damage_to_champions", perMinute: true, positive: "higher", explanation: ["Damage pressure came faster than usual.", "Damage pressure was slower than usual."] },
  ],
  Valorant: [
    { key: "team_kills", group: "Output", label: "Team Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"], positive: "higher", explanation: ["More fight pressure than usual.", "Less fight pressure than usual."] },
    { key: "team_deaths", group: "Efficiency", label: "Team Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"], positive: "lower", explanation: ["Fewer deaths than usual.", "More deaths than usual."] },
    { key: "team_assists", group: "Output", label: "Team Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"], positive: "higher", explanation: ["More trading/teamplay than usual.", "Less trading/teamplay than usual."] },
    { key: "average_acs", group: "Output", label: "Avg Combat Score", statKeys: "average_acs", rowKeys: ["avg_combat_score", "acs"], average: true, positive: "higher", explanation: ["Higher combat impact than usual.", "Lower combat impact than usual."] },
    { key: "average_econ_rating", group: "Efficiency", label: "Avg Econ Rating", statKeys: "average_econ_rating", rowKeys: "econ_rating", average: true, positive: "higher", explanation: ["Better economy value than usual.", "Lower economy value than usual."] },
    { key: "first_bloods", group: "Objectives", label: "First Bloods", statKeys: "total_first_bloods", rowKeys: "first_bloods", positive: "higher", explanation: ["More opening picks than usual.", "Fewer opening picks than usual."] },
    { key: "plants", group: "Objectives", label: "Plants", statKeys: "total_plants", rowKeys: "plants", positive: "higher", explanation: ["More spike pressure than usual.", "Less spike pressure than usual."] },
    { key: "defuses", group: "Objectives", label: "Defuses", statKeys: "total_defuses", rowKeys: "defuses", positive: "higher", explanation: ["More retake conversions than usual.", "Fewer retake conversions than usual."] },
    { key: "round_diff", group: "Map/Score", label: "Round Differential", scoreDiff: true, positive: "higher", explanation: ["This scoreline was stronger than your usual scrim.", "This scoreline was weaker than your usual scrim."] },
  ],
  "Marvel Rivals": [
    { key: "team_kills", group: "Output", label: "Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"], positive: "higher", explanation: ["More fight pressure than usual.", "Less fight pressure than usual."] },
    { key: "team_deaths", group: "Efficiency", label: "Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"], positive: "lower", explanation: ["Fewer deaths than usual.", "More deaths than usual."] },
    { key: "team_assists", group: "Output", label: "Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"], positive: "higher", explanation: ["More teamfight participation than usual.", "Less teamfight participation than usual."] },
    { key: "final_hits", group: "Output", label: "Final Hits", statKeys: ["total_final_hits", "final_hits"], rowKeys: "final_hits", positive: "higher", explanation: ["More fight closers than usual.", "Fewer fight closers than usual."] },
    { key: "damage", group: "Output", label: "Damage", statKeys: ["total_damage", "damage"], rowKeys: "damage", positive: "higher", explanation: ["More damage pressure than usual.", "Less damage pressure than usual."] },
    { key: "damage_blocked", group: "Efficiency", label: "Damage Blocked", statKeys: ["total_damage_blocked", "damage_blocked"], rowKeys: "damage_blocked", positive: "higher", explanation: ["More frontline pressure absorbed than usual.", "Less damage absorbed than usual."] },
    { key: "healing", group: "Efficiency", label: "Healing", statKeys: ["total_healing", "healing"], rowKeys: "healing", positive: "higher", explanation: ["More sustain than usual.", "Less sustain than usual."] },
    { key: "accuracy", group: "Efficiency", label: "Average Accuracy", statKeys: ["average_accuracy_percent", "average_accuracy"], rowKeys: "accuracy", average: true, positive: "higher", explanation: ["Cleaner accuracy than usual.", "Lower accuracy than usual."] },
    { key: "score_diff", group: "Map/Score", label: "Score Differential", scoreDiff: true, positive: "higher", explanation: ["This scoreline was stronger than your usual scrim.", "This scoreline was weaker than your usual scrim."] },
  ],
  Deadlock: [
    { key: "team_kills", group: "Output", label: "Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"], positive: "higher", explanation: ["More fight pressure than usual.", "Less fight pressure than usual."] },
    { key: "team_deaths", group: "Efficiency", label: "Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"], positive: "lower", explanation: ["Fewer deaths than usual.", "More deaths than usual."] },
    { key: "team_assists", group: "Output", label: "Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"], positive: "higher", explanation: ["More teamfight participation than usual.", "Less teamfight participation than usual."] },
    { key: "souls", group: "Efficiency", label: "Souls", statKeys: ["total_souls", "souls", "net_worth"], rowKeys: ["souls", "net_worth"], positive: "higher", explanation: ["More resource control than usual.", "Less resource control than usual."] },
    { key: "souls_per_min", group: "Efficiency", label: "Souls / Min", statKeys: ["total_souls", "souls", "net_worth"], rowKeys: ["souls", "net_worth"], perMinute: true, positive: "higher", explanation: ["Your team earned souls faster than usual.", "Your team earned souls slower than usual."] },
    { key: "player_damage", group: "Output", label: "Player Damage", statKeys: ["total_player_damage", "player_damage"], rowKeys: "player_damage", positive: "higher", explanation: ["More player damage pressure than usual.", "Less player damage pressure than usual."] },
    { key: "objective_damage", group: "Objectives", label: "Objective Damage", statKeys: ["total_objective_damage", "objective_damage"], rowKeys: "objective_damage", positive: "higher", explanation: ["More objective conversion than usual.", "Less objective conversion than usual."] },
    { key: "healing", group: "Efficiency", label: "Healing", statKeys: ["total_healing", "healing"], rowKeys: "healing", positive: "higher", explanation: ["More sustain than usual.", "Less sustain than usual."] },
  ],
  "Honor of Kings": [
    { key: "team_kills", group: "Output", label: "Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"], positive: "higher", explanation: ["More fight pressure than usual.", "Less fight pressure than usual."] },
    { key: "team_deaths", group: "Efficiency", label: "Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"], positive: "lower", explanation: ["Fewer deaths than usual.", "More deaths than usual."] },
    { key: "team_assists", group: "Output", label: "Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"], positive: "higher", explanation: ["More teamfight participation than usual.", "Less teamfight participation than usual."] },
    { key: "gold", group: "Efficiency", label: "Gold", statKeys: "total_gold", rowKeys: "gold", positive: "higher", explanation: ["More resource control than usual.", "Less resource control than usual."] },
    { key: "damage", group: "Output", label: "Damage", statKeys: ["total_damage", "damage"], rowKeys: "damage", positive: "higher", explanation: ["More damage pressure than usual.", "Less damage pressure than usual."] },
    { key: "damage_taken", group: "Efficiency", label: "Damage Taken", statKeys: "damage_taken", rowKeys: "damage_taken", positive: "lower", explanation: ["Less incoming pressure than usual.", "More incoming pressure than usual."] },
    { key: "healing", group: "Efficiency", label: "Healing", statKeys: "healing", rowKeys: "healing", positive: "higher", explanation: ["More sustain than usual.", "Less sustain than usual."] },
    { key: "score_diff", group: "Map/Score", label: "Kill Differential", scoreDiff: true, positive: "higher", explanation: ["This scoreline was stronger than your usual match.", "This scoreline was weaker than your usual match."] },
  ],
  HOK: [],
  "Overwatch 2": [
    { key: "eliminations", group: "Output", label: "Eliminations", statKeys: ["total_eliminations", "eliminations", "team_kills"], rowKeys: ["eliminations", "kills"], positive: "higher", explanation: ["More fight pressure than usual.", "Less fight pressure than usual."] },
    { key: "deaths", group: "Efficiency", label: "Deaths", statKeys: ["total_deaths", "deaths", "team_deaths"], rowKeys: "deaths", positive: "lower", explanation: ["Fewer deaths than usual.", "More deaths than usual."] },
    { key: "assists", group: "Output", label: "Assists", statKeys: ["total_assists", "assists", "team_assists"], rowKeys: "assists", positive: "higher", explanation: ["More teamfight participation than usual.", "Less teamfight participation than usual."] },
    { key: "damage", group: "Output", label: "Damage", statKeys: ["total_damage", "damage"], rowKeys: "damage", positive: "higher", explanation: ["More damage pressure than usual.", "Less damage pressure than usual."] },
    { key: "healing", group: "Efficiency", label: "Healing", statKeys: ["total_healing", "healing"], rowKeys: "healing", positive: "higher", explanation: ["More sustain than usual.", "Less sustain than usual."] },
    { key: "mitigation", group: "Efficiency", label: "Mitigation", statKeys: ["total_mitigation", "mitigation"], rowKeys: ["mitigation", "damage_blocked"], positive: "higher", explanation: ["More pressure absorbed than usual.", "Less pressure absorbed than usual."] },
    { key: "final_blows", group: "Output", label: "Final Blows", statKeys: "final_blows", rowKeys: "final_blows", positive: "higher", explanation: ["More confirmed fight closers than usual.", "Fewer fight closers than usual."] },
    { key: "score_diff", group: "Map/Score", label: "Score Differential", scoreDiff: true, positive: "higher", explanation: ["This scoreline was stronger than your usual scrim.", "This scoreline was weaker than your usual scrim."] },
  ],
  "Counter-Strike 2": [
    { key: "team_kills", group: "Output", label: "Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"], positive: "higher", explanation: ["More fight pressure than usual.", "Less fight pressure than usual."] },
    { key: "team_deaths", group: "Efficiency", label: "Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"], positive: "lower", explanation: ["Fewer deaths than usual.", "More deaths than usual."] },
    { key: "team_assists", group: "Output", label: "Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"], positive: "higher", explanation: ["More trade support than usual.", "Less trade support than usual."] },
    { key: "adr", group: "Output", label: "ADR", statKeys: "average_adr", rowKeys: "adr", average: true, positive: "higher", explanation: ["More damage per round than usual.", "Less damage per round than usual."] },
    { key: "round_diff", group: "Map/Score", label: "Round Differential", scoreDiff: true, positive: "higher", explanation: ["This scoreline was stronger than your usual scrim.", "This scoreline was weaker than your usual scrim."] },
  ],
  "Rocket League": [
    { key: "goals", group: "Output", label: "Goals", statKeys: "goals", rowKeys: "goals", positive: "higher", explanation: ["More scoring than usual.", "Less scoring than usual."] },
    { key: "assists", group: "Output", label: "Assists", statKeys: "assists", rowKeys: "assists", positive: "higher", explanation: ["More created chances than usual.", "Fewer created chances than usual."] },
    { key: "saves", group: "Efficiency", label: "Saves", statKeys: "saves", rowKeys: "saves", positive: "higher", explanation: ["More defensive saves than usual.", "Fewer defensive saves than usual."] },
    { key: "shots", group: "Output", label: "Shots", statKeys: "shots", rowKeys: "shots", positive: "higher", explanation: ["More shot pressure than usual.", "Less shot pressure than usual."] },
    { key: "team_score", group: "Output", label: "Team Score", statKeys: "scoreboard_score", rowKeys: "score", positive: "higher", explanation: ["Higher scoreboard output than usual.", "Lower scoreboard output than usual."] },
    { key: "goal_diff", group: "Map/Score", label: "Goal Differential", scoreDiff: true, positive: "higher", explanation: ["This scoreline was stronger than usual.", "This scoreline was weaker than usual."] },
  ],
};

STAT_SPECS.HOK = STAT_SPECS["Honor of Kings"];

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").replace("%", "").trim());
  return Number.isFinite(number) ? number : null;
}

function getRows(review, side = "team") {
  if (side === "opponent") {
    return review?.opponent_rows?.length ? review.opponent_rows : review?.opponent_comp || [];
  }

  return review?.player_rows?.length ? review.player_rows : review?.team_comp || [];
}

function getStat(review, statKeys, rowKeys, { average = false, side = "team" } = {}) {
  const stats = side === "opponent" ? review?.opponent_stats || {} : review?.team_stats || {};
  const keys = Array.isArray(statKeys) ? statKeys : [statKeys];

  for (const key of keys) {
    const value = normalizeNumber(stats[key]);
    if (value !== null) return value;
  }

  const values = getRows(review, side)
    .flatMap((row) => (Array.isArray(rowKeys) ? rowKeys : [rowKeys]).map((key) => normalizeNumber(row?.[key])))
    .filter((value) => value !== null);

  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return average ? total / values.length : total;
}

function parseDurationMinutes(value) {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] + parts[1] / 60;
  const number = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function getDurationMinutes(review) {
  return parseDurationMinutes(review?.team_stats?.game_length || review?.team_stats?.duration);
}

function getReviewValue(review, spec) {
  if (spec.scoreDiff) {
    const teamScore = normalizeNumber(review?.team_score);
    const opponentScore = normalizeNumber(review?.opponent_score);
    return teamScore === null || opponentScore === null ? null : teamScore - opponentScore;
  }

  const value = getStat(review, spec.statKeys, spec.rowKeys, { average: spec.average });
  if (!spec.perMinute) return value;

  const minutes = getDurationMinutes(review);
  if (value === null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return value / minutes;
}

function getAverage(values) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (!validValues.length) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function getStatus(deltaPercent, isPositive) {
  if (!Number.isFinite(deltaPercent) || Math.abs(deltaPercent) <= 0.05) return "neutral";
  return isPositive ? "better" : "worse";
}

function getExplanation(spec, status) {
  if (status === "neutral") return "This stat was about the same as usual.";
  return status === "better" ? spec.explanation?.[0] : spec.explanation?.[1];
}

export function compareReviewToAverage(currentReview, historicalReviews = [], gameTitle = "") {
  const specs = STAT_SPECS[gameTitle] || [];
  const currentId = currentReview?.id;
  const baselineReviews = historicalReviews
    .filter((review) => review?.game_title === gameTitle)
    .filter((review) => !currentId || review.id !== currentId);

  if (!currentReview || baselineReviews.length < 2 || !specs.length) {
    return {
      sampleSize: baselineReviews.length,
      betterCount: 0,
      worseCount: 0,
      neutralCount: 0,
      items: [],
    };
  }

  const items = specs
    .map((spec) => {
      const current = getReviewValue(currentReview, spec);
      const average = getAverage(baselineReviews.map((review) => getReviewValue(review, spec)));
      if (current === null || average === null) return null;

      const delta = current - average;
      const deltaPercent = average === 0 ? null : delta / Math.abs(average);
      const direction = delta > 0 ? "higher" : delta < 0 ? "lower" : "same";
      const higherIsPositive = spec.positive !== "lower" && !LOWER_IS_BETTER.has(spec.key);
      const isPositive = Math.abs(delta) === 0 ? false : higherIsPositive ? delta > 0 : delta < 0;
      const status = getStatus(deltaPercent, isPositive);

      return {
        key: spec.key,
        group: spec.group,
        label: spec.label,
        current,
        average,
        delta,
        deltaPercent,
        direction,
        isPositive,
        status,
        explanation: getExplanation(spec, status),
      };
    })
    .filter(Boolean);

  return {
    sampleSize: baselineReviews.length,
    betterCount: items.filter((item) => item.status === "better").length,
    worseCount: items.filter((item) => item.status === "worse").length,
    neutralCount: items.filter((item) => item.status === "neutral").length,
    items,
  };
}

export function getComparisonSummary(comparisonItems = []) {
  return {
    betterCount: comparisonItems.filter((item) => item.status === "better").length,
    worseCount: comparisonItems.filter((item) => item.status === "worse").length,
    neutralCount: comparisonItems.filter((item) => item.status === "neutral").length,
  };
}
