export const LEAGUE_ROLE_ORDER = ["Top", "Jungle", "Mid", "ADC", "Support"];

const BASE_METRICS = {
  kills: {
    key: "kills",
    label: "Kills",
    statKeys: ["total_kills", "team_kills", "kills"],
    rowKeys: ["k", "kills"],
    decimals: 1,
  },
  deaths: {
    key: "deaths",
    label: "Deaths",
    statKeys: ["total_deaths", "team_deaths", "deaths"],
    rowKeys: ["d", "deaths"],
    decimals: 1,
  },
  assists: {
    key: "assists",
    label: "Assists",
    statKeys: ["total_assists", "team_assists", "assists"],
    rowKeys: ["a", "assists"],
    decimals: 1,
  },
  total_gold: {
    key: "total_gold",
    label: "Total Gold",
    statKeys: ["total_gold", "gold"],
    rowKeys: ["gold"],
    decimals: 0,
  },
  gold_per_minute: {
    key: "gold_per_minute",
    label: "Gold / min",
    statKeys: ["gold_per_minute", "gpm"],
    totalMetric: "total_gold",
    perMinute: true,
    decimals: 0,
  },
  total_damage: {
    key: "total_damage",
    label: "Champion Damage",
    statKeys: ["total_damage_to_champions", "damage_to_champions"],
    rowKeys: ["damage_to_champions", "damage"],
    decimals: 0,
  },
  damage_per_minute: {
    key: "damage_per_minute",
    label: "Damage / min",
    statKeys: ["damage_per_minute", "dpm"],
    totalMetric: "total_damage",
    perMinute: true,
    decimals: 0,
  },
};

const ROLE_METRICS = [
  { key: "kills", label: "K", rowKeys: ["k", "kills"], decimals: 1 },
  { key: "deaths", label: "D", rowKeys: ["d", "deaths"], decimals: 1 },
  { key: "assists", label: "A", rowKeys: ["a", "assists"], decimals: 1 },
  { key: "gold", label: "Gold", rowKeys: ["gold"], decimals: 0 },
  { key: "damage", label: "Damage", rowKeys: ["damage_to_champions", "damage"], decimals: 0 },
];

const TREND_METRICS = [
  {
    key: "kill_differential",
    label: "Kill differential",
    shortLabel: "Kill diff",
    description: "Team kills minus team deaths.",
    decimals: 1,
  },
  {
    key: "team_kda",
    label: "Team KDA",
    shortLabel: "Team KDA",
    description: "(Kills + assists) divided by deaths.",
    decimals: 2,
  },
  {
    key: "assists_per_kill",
    label: "Assists per kill",
    shortLabel: "Assists / kill",
    description: "Team assists divided by team kills.",
    decimals: 2,
  },
  {
    key: "gold_per_minute",
    label: "Gold per minute",
    shortLabel: "Gold / min",
    description: "Recorded team gold divided by game length.",
    decimals: 0,
  },
  {
    key: "damage_per_minute",
    label: "Damage per minute",
    shortLabel: "Damage / min",
    description: "Recorded champion damage divided by game length.",
    decimals: 0,
  },
  {
    key: "damage_per_1000_gold",
    label: "Damage per 1k gold",
    shortLabel: "Damage / 1k gold",
    description: "Champion damage for every 1,000 recorded team gold.",
    decimals: 0,
  },
];

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function getRows(review) {
  if (Array.isArray(review?.player_rows) && review.player_rows.length) return review.player_rows;
  return Array.isArray(review?.team_comp) ? review.team_comp : [];
}

function getFirstNumber(source = {}, keys = []) {
  for (const key of keys) {
    const value = normalizeNumber(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function sumRows(rows, keys) {
  const values = rows
    .map((row) => getFirstNumber(row, keys))
    .filter((value) => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function parseDurationMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const parts = String(value).trim().split(":").map(Number);
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] + (parts[1] / 60);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return (parts[0] * 60) + parts[1] + (parts[2] / 60);
  }
  const number = normalizeNumber(String(value).replace(/[^\d.]/g, ""));
  return number !== null && number > 0 ? number : null;
}

function getDurationMinutes(review) {
  return parseDurationMinutes(review?.team_stats?.game_length || review?.team_stats?.duration);
}

export function getLeagueReviewMetric(review, metricKey) {
  const spec = BASE_METRICS[metricKey];
  if (!spec) return null;

  const direct = getFirstNumber(review?.team_stats || {}, spec.statKeys);
  if (direct !== null) return direct;

  if (spec.perMinute) {
    const total = getLeagueReviewMetric(review, spec.totalMetric);
    const minutes = getDurationMinutes(review);
    return total !== null && minutes ? total / minutes : null;
  }

  return sumRows(getRows(review), spec.rowKeys || []);
}

export function getLeagueTrendMetric(review, metricKey) {
  if (["gold_per_minute", "damage_per_minute"].includes(metricKey)) {
    return getLeagueReviewMetric(review, metricKey);
  }

  const kills = getLeagueReviewMetric(review, "kills");
  const deaths = getLeagueReviewMetric(review, "deaths");
  const assists = getLeagueReviewMetric(review, "assists");

  if (metricKey === "kill_differential") {
    return kills !== null && deaths !== null ? kills - deaths : null;
  }
  if (metricKey === "team_kda") {
    return kills !== null && deaths !== null && assists !== null
      ? (kills + assists) / Math.max(1, deaths)
      : null;
  }
  if (metricKey === "assists_per_kill") {
    return kills !== null && kills > 0 && assists !== null ? assists / kills : null;
  }
  if (metricKey === "damage_per_1000_gold") {
    const damage = getLeagueReviewMetric(review, "total_damage");
    const gold = getLeagueReviewMetric(review, "total_gold");
    return damage !== null && gold !== null && gold > 0 ? (damage / gold) * 1000 : null;
  }
  return null;
}

function average(values) {
  const available = values.filter((value) => Number.isFinite(value));
  if (!available.length) return null;
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function normalizeRole(value = "") {
  const compact = String(value).trim().toLowerCase().replace(/[^a-z]/g, "");
  if (["top", "toplane"].includes(compact)) return "Top";
  if (["jungle", "jungler"].includes(compact)) return "Jungle";
  if (["mid", "middle", "midlane"].includes(compact)) return "Mid";
  if (["adc", "bot", "bottom", "botlane", "carry"].includes(compact)) return "ADC";
  if (["support", "sup", "utility"].includes(compact)) return "Support";
  return "";
}

function findRoleRow(review, role) {
  return getRows(review).find((row) => normalizeRole(row?.role || row?.position || row?.lane) === role) || null;
}

function getChampion(row) {
  return row?.champion || row?.champion_confirmed || row?.hero_confirmed || "";
}

function getReviewIdentity(review, index) {
  return review?.id || [
    review?.played_at || review?.created_at || "undated",
    review?.scrim_request_id || review?.review_series_id || "series",
    review?.scrim_game_number || index,
  ].join(":");
}

function uniqueReviews(reviews = []) {
  const seen = new Set();
  return reviews.filter((review, index) => {
    if (!review) return false;
    const identity = getReviewIdentity(review, index);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function isLeagueScrim(review) {
  return review?.game_title === "League of Legends"
    && (!review?.match_type || review.match_type === "scrim");
}

function isCurrentReview(review, currentReview) {
  if (!review || !currentReview) return false;
  if (review === currentReview) return true;
  return Boolean(review.id && currentReview.id && review.id === currentReview.id);
}

function chooseRateOrTotal(currentReview, baselineReviews, rateKey, totalKey) {
  const rateCurrent = getLeagueReviewMetric(currentReview, rateKey);
  const rateBaseline = baselineReviews.map((review) => getLeagueReviewMetric(review, rateKey)).filter(Number.isFinite);
  return rateCurrent !== null && rateBaseline.length ? rateKey : totalKey;
}

function buildMetricComparison(currentReview, baselineReviews, metricKey) {
  const spec = BASE_METRICS[metricKey];
  const current = getLeagueReviewMetric(currentReview, metricKey);
  const baselineValues = baselineReviews
    .map((review) => getLeagueReviewMetric(review, metricKey))
    .filter(Number.isFinite);
  const baselineAverage = average(baselineValues);
  if (current === null || baselineAverage === null) return null;

  return {
    key: spec.key,
    label: spec.label,
    current,
    average: baselineAverage,
    delta: current - baselineAverage,
    decimals: spec.decimals,
    sampleSize: baselineValues.length,
  };
}

function buildRoleRows(currentReview, baselineReviews) {
  return LEAGUE_ROLE_ORDER.map((role) => {
    const currentRow = findRoleRow(currentReview, role);
    const baselineRows = baselineReviews.map((review) => findRoleRow(review, role)).filter(Boolean);

    const metrics = ROLE_METRICS.map((spec) => {
      const current = currentRow ? getFirstNumber(currentRow, spec.rowKeys) : null;
      const baselineValues = baselineRows
        .map((row) => getFirstNumber(row, spec.rowKeys))
        .filter(Number.isFinite);
      const baselineAverage = average(baselineValues);
      return {
        ...spec,
        current,
        average: baselineAverage,
        delta: current !== null && baselineAverage !== null ? current - baselineAverage : null,
        sampleSize: baselineValues.length,
      };
    });

    return {
      role,
      champion: getChampion(currentRow),
      playerName: currentRow?.player_name || "",
      metrics,
      sampleSize: baselineRows.length,
    };
  });
}

function sortReviewsOldestFirst(reviews) {
  return [...reviews].sort((first, second) => {
    const firstDate = new Date(first?.played_at || first?.created_at || 0).getTime();
    const secondDate = new Date(second?.played_at || second?.created_at || 0).getTime();
    return firstDate - secondDate;
  });
}

function buildTrendPoints(reviews, currentReview) {
  return sortReviewsOldestFirst(reviews).slice(-8).map((review, index) => ({
    id: getReviewIdentity(review, index),
    playedAt: review?.played_at || review?.created_at || null,
    gameNumber: normalizeNumber(review?.scrim_game_number),
    result: review?.match_result || "",
    isCurrent: isCurrentReview(review, currentReview),
    champions: LEAGUE_ROLE_ORDER.map((role) => getChampion(findRoleRow(review, role))).filter(Boolean),
    values: Object.fromEntries(TREND_METRICS.map((metric) => [
      metric.key,
      getLeagueTrendMetric(review, metric.key),
    ])),
  }));
}

export function buildLeagueScrimComparison(currentReview, historicalReviews = []) {
  const leagueHistory = uniqueReviews(historicalReviews).filter(isLeagueScrim);
  const baselineReviews = leagueHistory.filter((review) => !isCurrentReview(review, currentReview));
  const currentIsScrim = isLeagueScrim(currentReview);
  const scrimReviews = uniqueReviews([
    ...baselineReviews,
    ...(currentIsScrim ? [currentReview] : []),
  ]);

  const metricKeys = [
    "kills",
    "deaths",
    "assists",
    chooseRateOrTotal(currentReview, baselineReviews, "gold_per_minute", "total_gold"),
    chooseRateOrTotal(currentReview, baselineReviews, "damage_per_minute", "total_damage"),
  ];

  return {
    sampleSize: baselineReviews.length,
    metrics: metricKeys
      .map((metricKey) => buildMetricComparison(currentReview, baselineReviews, metricKey))
      .filter(Boolean),
    roleRows: buildRoleRows(currentReview, baselineReviews),
    trendMetricOptions: TREND_METRICS,
    trendPoints: buildTrendPoints(scrimReviews, currentReview),
    scrimReviews,
  };
}
