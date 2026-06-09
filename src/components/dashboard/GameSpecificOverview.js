const EMPTY_VALUE = "Not available";

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function trimTrailingZero(value) {
  return String(value).replace(/\.0$/, "");
}

function formatNumber(value, { compact = true, decimals = 0, signed = false, suffix = "" } = {}) {
  const number = normalizeNumber(value);
  if (number === null) return EMPTY_VALUE;
  const sign = signed && number > 0 ? "+" : "";
  const abs = Math.abs(number);
  if (compact && abs >= 1_000_000) return `${sign}${trimTrailingZero((number / 1_000_000).toFixed(1))}M${suffix}`;
  if (compact && abs >= 10_000) return `${sign}${trimTrailingZero((number / 1000).toFixed(1))}k${suffix}`;
  return `${sign}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(number)}${suffix}`;
}

function getStat(stats = {}, keys = []) {
  for (const key of keys) {
    const value = normalizeNumber(stats?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function getRawStat(stats = {}, keys = []) {
  for (const key of keys) {
    const value = stats?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return null;
}

function sumRows(rows = [], keys = []) {
  let total = 0;
  let found = false;
  rows.forEach((row) => {
    for (const key of keys) {
      const value = normalizeNumber(row?.[key]);
      if (value !== null) {
        total += value;
        found = true;
        break;
      }
    }
  });
  return found ? total : null;
}

function parseDurationMinutes(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  const timeParts = text.split(":").map((part) => Number(part));
  if (timeParts.length === 2 && timeParts.every(Number.isFinite)) {
    return timeParts[0] + timeParts[1] / 60;
  }
  if (timeParts.length === 3 && timeParts.every(Number.isFinite)) {
    return (timeParts[0] * 60) + timeParts[1] + timeParts[2] / 60;
  }
  const parsed = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getTeamKda(teamStats = {}, teamRows = []) {
  const kills = getStat(teamStats, ["total_kills", "team_kills", "kills", "total_eliminations", "eliminations"])
    ?? sumRows(teamRows, ["k", "kills", "eliminations"]);
  const deaths = getStat(teamStats, ["total_deaths", "team_deaths", "deaths"])
    ?? sumRows(teamRows, ["d", "deaths"]);
  const assists = getStat(teamStats, ["total_assists", "team_assists", "assists"])
    ?? sumRows(teamRows, ["a", "assists"]);

  if (kills === null && deaths === null && assists === null) return EMPTY_VALUE;
  return `${formatNumber(kills ?? 0, { compact: false })} / ${formatNumber(deaths ?? 0, { compact: false })} / ${formatNumber(assists ?? 0, { compact: false })}`;
}

function getKillsDeaths(teamStats = {}, teamRows = []) {
  const kills = getStat(teamStats, ["total_kills", "team_kills", "kills", "total_eliminations", "eliminations"])
    ?? sumRows(teamRows, ["k", "kills", "eliminations"]);
  const deaths = getStat(teamStats, ["total_deaths", "team_deaths", "deaths"])
    ?? sumRows(teamRows, ["d", "deaths"]);
  if (kills === null && deaths === null) return EMPTY_VALUE;
  return `${formatNumber(kills ?? 0, { compact: false })} / ${formatNumber(deaths ?? 0, { compact: false })}`;
}

function getScoreDiff(review = {}) {
  const teamScore = normalizeNumber(review.team_score);
  const opponentScore = normalizeNumber(review.opponent_score);
  if (teamScore === null || opponentScore === null) return null;
  return teamScore - opponentScore;
}

function getComposition(rows = [], pickField = "hero") {
  const picks = rows
    .map((row) => row?.hero_confirmed || row?.[pickField] || row?.hero || row?.agent || row?.champion || row?.character)
    .filter((pick) => typeof pick === "string" && pick.trim().length > 0)
    .map((pick) => pick.trim());
  if (!picks.length) return EMPTY_VALUE;
  return picks.slice(0, 6).join(", ");
}

function getTopContribution(rows = [], definition = {}) {
  const valueKeys = definition.valueKeys || ["damage_to_champions", "damage", "player_damage", "gold", "souls", "healing"];
  const scored = rows
    .map((row) => {
      const value = getStat(row, valueKeys);
      if (value === null) return null;
      return {
        label: row?.role || row?.player_name || row?.champion || row?.agent || row?.hero || "Player",
        value,
      };
    })
    .filter(Boolean)
    .sort((first, second) => second.value - first.value);
  if (!scored.length) return EMPTY_VALUE;
  return `${scored[0].label}: ${formatNumber(scored[0].value)}`;
}

function getStatValue(definition, context) {
  const { opponentStats, review, teamRows, teamStats } = context;

  if (definition.type === "matchResult") return review?.match_result || EMPTY_VALUE;
  if (definition.type === "scoreDifferential" || definition.type === "roundDifferential") {
    const diff = getScoreDiff(review);
    return diff === null ? EMPTY_VALUE : formatNumber(diff, { compact: false, signed: true });
  }
  if (definition.type === "teamKda") return getTeamKda(teamStats, teamRows);
  if (definition.type === "killsDeaths") return getKillsDeaths(teamStats, teamRows);
  if (definition.type === "composition") return getComposition(teamRows, definition.pickField);
  if (definition.type === "roleContribution") return getTopContribution(teamRows, definition);
  if (definition.type === "duration") return definition.keys?.map((key) => teamStats?.[key]).find(Boolean) || review?.map_or_mode || EMPTY_VALUE;
  if (definition.type === "soulsPerMinute") {
    const existing = getStat(teamStats, ["souls_per_minute", "spm"]);
    if (existing !== null) return formatNumber(existing, { decimals: 1 });
    const souls = getStat(teamStats, ["total_souls", "souls"]) ?? sumRows(teamRows, ["souls"]);
    const minutes = parseDurationMinutes(teamStats?.duration || teamStats?.game_length);
    if (souls === null || !minutes) return EMPTY_VALUE;
    return formatNumber(souls / minutes, { decimals: 1 });
  }
  if (definition.type === "ratio") {
    const numerator = getStat(teamStats, definition.numeratorKeys || []);
    const denominator = getStat(teamStats, definition.denominatorKeys || []);
    if (numerator === null || denominator === null || denominator === 0) return EMPTY_VALUE;
    return formatNumber(numerator / denominator, { decimals: 2, compact: false });
  }
  if (definition.type === "difference") {
    const ours = getStat(teamStats, definition.teamKeys || definition.keys || []);
    const theirs = getStat(opponentStats, definition.opponentKeys || definition.teamKeys || definition.keys || []);
    if (ours === null || theirs === null) return EMPTY_VALUE;
    return formatNumber(ours - theirs, { signed: true, suffix: definition.suffix || "" });
  }

  const keys = definition.keys || [definition.key];
  const value = getStat(teamStats, keys);
  const rawValue = definition.compact === false ? getRawStat(teamStats, keys) : null;
  if (value === null && rawValue !== null) return rawValue;
  return formatNumber(value, {
    compact: definition.compact !== false,
    decimals: definition.decimals || 0,
    suffix: definition.suffix || "",
  });
}

function GameStatCard({ definition, value }) {
  const isEmpty = value === EMPTY_VALUE;
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-md">
      <p className="font-label-small text-label-small text-on-surface-variant">{definition.label}</p>
      <p className={`mt-xs font-headline-3 text-headline-3 ${isEmpty ? "text-on-surface-variant" : "text-primary"}`}>
        {value}
      </p>
      {definition.helper && <p className="mt-xs font-label-small text-label-small text-on-surface-variant">{definition.helper}</p>}
    </div>
  );
}

function GameComparisonRows({ fields = [], opponentStats = {}, teamStats = {} }) {
  const comparable = fields
    .map((field) => {
      const ours = getStat(teamStats, field.teamKeys || field.keys || [field.key]);
      const theirs = getStat(opponentStats, field.opponentKeys || field.teamKeys || field.keys || [field.key]);
      if (ours === null && theirs === null) return null;
      const total = Math.max((ours || 0) + (theirs || 0), 1);
      return {
        ...field,
        ours,
        theirs,
        ourWidth: `${Math.max(6, Math.min(94, ((ours || 0) / total) * 100))}%`,
      };
    })
    .filter(Boolean);

  if (!comparable.length) return null;

  return (
    <section className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-md">
      <div className="mb-md flex items-center justify-between gap-sm">
        <h2 className="font-headline-3 text-headline-3 text-on-surface">Key Comparisons</h2>
        <span className="font-label-small text-label-small text-on-surface-variant">Team vs opponent</span>
      </div>
      <div className="grid gap-sm md:grid-cols-2">
        {comparable.map((field) => (
          <div className="rounded-xl bg-surface-container-low p-sm" key={field.label}>
            <div className="mb-xs flex items-center justify-between gap-sm">
              <p className="font-label-bold text-label-bold text-on-surface">{field.label}</p>
              <p className="font-label-small text-label-small text-on-surface-variant">
                <span className="font-label-bold text-primary">{field.ours === null ? "-" : formatNumber(field.ours, { suffix: field.suffix || "" })}</span>
                <span className="mx-xs">vs</span>
                <span className="font-label-bold text-[#d12b2b]">{field.theirs === null ? "-" : formatNumber(field.theirs, { suffix: field.suffix || "" })}</span>
              </p>
            </div>
            <div className="overflow-hidden rounded-full bg-error-container">
              <div className="h-2 rounded-full bg-primary" style={{ width: field.ourWidth }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function GameSpecificOverview({
  config,
  opponentRows = [],
  opponentStats = {},
  review = {},
  teamRows = [],
  teamStats = {},
}) {
  const firstScreenStats = config?.firstScreenStats || config?.highlightStats || [];
  const secondaryStats = config?.secondaryStats || [];
  const context = { opponentRows, opponentStats, review, teamRows, teamStats };

  if (!firstScreenStats.length && !secondaryStats.length) return null;

  return (
    <section className="grid gap-md">
      <div className="grid gap-sm md:grid-cols-2 xl:grid-cols-4">
        {firstScreenStats.map((definition) => (
          <GameStatCard
            definition={definition}
            key={`${definition.label}-${definition.key || definition.type}`}
            value={getStatValue(definition, context)}
          />
        ))}
      </div>

      {secondaryStats.length > 0 && (
        <section className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-md">
          <div className="mb-md flex items-center justify-between gap-sm">
            <h2 className="font-headline-3 text-headline-3 text-on-surface">Deeper Review</h2>
            <span className="font-label-small text-label-small text-on-surface-variant">Secondary stats</span>
          </div>
          <div className="grid gap-sm md:grid-cols-2 xl:grid-cols-4">
            {secondaryStats.map((definition) => (
              <GameStatCard
                definition={definition}
                key={`${definition.label}-${definition.key || definition.type}`}
                value={getStatValue(definition, context)}
              />
            ))}
          </div>
        </section>
      )}

      <GameComparisonRows fields={config?.comparisonFields || []} opponentStats={opponentStats} teamStats={teamStats} />
    </section>
  );
}
