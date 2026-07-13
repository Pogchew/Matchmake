const REVIEW_PICK_FIELDS = {
  "League of Legends": { field: "champion", label: "Champion" },
  Valorant: { field: "agent", label: "Agent" },
  "Counter-Strike 2": { field: "role", label: "Role" },
  "Rocket League": { field: "car", label: "Car / Role" },
  "Overwatch 2": { field: "hero", label: "Hero" },
  "Marvel Rivals": { field: "hero", label: "Hero" },
  Deadlock: { field: "hero", label: "Hero" },
  SSBU: { field: "character", label: "Character" },
  "Honor of Kings": { field: "hero", label: "Hero" },
};

export function formatSignedAverage(values, { decimals = 1 } = {}) {
  if (!values.length) return "—";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const rounded = Number(average.toFixed(decimals));
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(Math.abs(rounded));
  if (rounded > 0) return `+${formatted}`;
  if (rounded < 0) return `-${formatted}`;
  return decimals ? "0.0" : "0";
}

function getNumericStat(source, key) {
  const value = source?.[key];
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getAverageStatDiff(reviews, leftKey, rightKey = leftKey) {
  return reviews
    .map((review) => {
      const left = getNumericStat(review.team_stats, leftKey);
      const right = getNumericStat(review.opponent_stats, rightKey);
      return left === null || right === null ? null : left - right;
    })
    .filter((value) => value !== null);
}

export function calculateReviewKpis(reviews = [], gameTitle = "") {
  const total = reviews.length;
  const wins = reviews.filter((review) => review.match_result === "victory").length;
  const losses = reviews.filter((review) => review.match_result === "defeat").length;
  const winRate = total ? Math.round((wins / total) * 100) : 0;
  const margins = reviews
    .filter((review) => Number.isFinite(Number(review.team_score)) && Number.isFinite(Number(review.opponent_score)))
    .map((review) => Number(review.team_score) - Number(review.opponent_score));
  const avgMargin = margins.length ? (margins.reduce((sum, margin) => sum + margin, 0) / margins.length).toFixed(1) : "—";
  const pickConfig = REVIEW_PICK_FIELDS[gameTitle] || { field: "hero", label: "Pick" };
  const pickCounts = new Map();
  const mapCounts = new Map();

  for (const review of reviews) {
    for (const row of review.team_comp || []) {
      const pick = row?.[pickConfig.field] || row?.agent || row?.champion || row?.hero || row?.character || row?.car || row?.role;
      if (pick) pickCounts.set(pick, (pickCounts.get(pick) || 0) + 1);
    }
    if (review.map_or_mode) mapCounts.set(review.map_or_mode, (mapCounts.get(review.map_or_mode) || 0) + 1);
  }

  const mostUsed = [...pickCounts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] || "—";
  const bestMap = [...mapCounts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] || "—";
  const baseKpis = [
    { label: "Reviews", value: total },
    { label: "Wins", value: wins },
    { label: "Losses", value: losses },
    { label: "Win Rate", value: `${winRate}%` },
  ];

  if (gameTitle === "League of Legends") {
    return [
      ...baseKpis,
      { label: "Avg Kill Diff", value: formatSignedAverage(margins) },
      { label: "Avg Gold Diff", value: formatSignedAverage(getAverageStatDiff(reviews, "total_gold"), { decimals: 0 }) },
      { label: "Avg Damage Diff", value: formatSignedAverage(getAverageStatDiff(reviews, "total_damage_to_champions"), { decimals: 0 }) },
      { label: `Most Used ${pickConfig.label}`, value: mostUsed },
    ];
  }

  return [
    ...baseKpis,
    { label: "Avg Margin", value: avgMargin },
    { label: `Most Used ${pickConfig.label}`, value: mostUsed },
    { label: "Best Map/Mode", value: bestMap },
  ];
}
