"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import MaterialSymbol from "@/components/MaterialSymbol";
import { aggregateCharacterAnalytics } from "@/lib/dashboard/character-analytics";
import { buildLeagueScrimComparison } from "@/lib/dashboard/league-scrim-comparison";
import { getPickImagePath } from "@/lib/game-assets/asset-paths";

const COMPARE_TABS = [
  { value: "average", label: "This Game vs Average", icon: "compare_arrows" },
  { value: "trends", label: "Scrim Trends", icon: "monitoring" },
  { value: "champions", label: "Champion Pool", icon: "grid_view" },
];

function formatNumber(value, decimals = 0, { signed = false } = {}) {
  if (!Number.isFinite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatScrimDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function average(values = []) {
  const available = values.filter(Number.isFinite);
  if (!available.length) return null;
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function getDeltaTone(delta, { lowerIsBetter = false } = {}) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.0001) {
    return {
      badge: "border-outline-variant/30 bg-surface-container text-on-surface-variant",
      rail: "bg-outline",
      surface: "border-outline-variant/25 bg-surface-container-low",
      text: "text-on-surface-variant",
    };
  }

  const favorable = lowerIsBetter ? delta < 0 : delta > 0;
  return favorable
    ? {
        badge: "border-[#1B5E20]/20 bg-[#E3F9E5] text-[#1B5E20] dark:border-[#72F59A]/70 dark:bg-[#123A24] dark:text-[#A5FFBD]",
        rail: "bg-[#1B5E20] dark:bg-[#72F59A]",
        surface: "border-[#1B5E20]/20 bg-[#E3F9E5]/55 dark:border-[#72F59A]/60 dark:bg-[#123A24]/80",
        text: "text-[#1B5E20] dark:text-[#A5FFBD]",
      }
    : {
        badge: "border-error/20 bg-error-container text-error",
        rail: "bg-error",
        surface: "border-error/20 bg-error-container/55",
        text: "text-error",
      };
}

function ChampionPortrait({ champion, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const imagePath = getPickImagePath("League of Legends", champion);
  const sizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-11 w-11";

  useEffect(() => {
    setFailed(false);
  }, [imagePath]);

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container font-label-bold text-[10px] text-on-surface-variant`}
      title={champion || "Champion unavailable"}
    >
      {imagePath && !failed ? (
        <img
          alt={champion}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          src={imagePath}
        />
      ) : (
        <span className="px-1 text-center">{champion ? champion.slice(0, 3).toUpperCase() : "—"}</span>
      )}
    </div>
  );
}

function EmptyState({ children, title }) {
  return (
    <div className="rounded-3xl border border-dashed border-outline-variant bg-surface-container-lowest px-lg py-2xl text-center">
      <MaterialSymbol className="mb-sm text-[34px] text-outline">query_stats</MaterialSymbol>
      <h3 className="font-headline-3 text-headline-3 text-on-surface">{title}</h3>
      <p className="mx-auto mt-xs max-w-xl font-body-sub text-body-sub text-on-surface-variant">{children}</p>
    </div>
  );
}

function MetricComparison({ item }) {
  const maxValue = Math.max(Math.abs(item.current), Math.abs(item.average), 1);
  const currentWidth = `${Math.max(4, (Math.abs(item.current) / maxValue) * 100)}%`;
  const averageWidth = `${Math.max(4, (Math.abs(item.average) / maxValue) * 100)}%`;
  const tone = getDeltaTone(item.delta, { lowerIsBetter: item.key === "deaths" });

  return (
    <article className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="flex items-start justify-between gap-sm">
        <div>
          <p className="font-label-bold text-label-bold text-on-surface">{item.label}</p>
          <p className="mt-1 font-label-small text-label-small text-on-surface-variant">n={item.sampleSize} baseline</p>
        </div>
        <span className={`rounded-full border px-sm py-1 font-label-bold text-label-small ${tone.badge}`}>
          {formatNumber(item.delta, item.decimals, { signed: true })}
        </span>
      </div>
      <div className="mt-md grid gap-sm">
        <div className="grid grid-cols-[52px_minmax(0,1fr)_64px] items-center gap-sm">
          <span className="font-label-small text-label-small text-primary">Current</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full bg-primary" style={{ width: currentWidth }} />
          </div>
          <span className="text-right font-label-bold text-label-bold text-primary">{formatNumber(item.current, item.decimals)}</span>
        </div>
        <div className="grid grid-cols-[52px_minmax(0,1fr)_64px] items-center gap-sm">
          <span className="font-label-small text-label-small text-on-surface-variant">Average</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full bg-[#314a73]" style={{ width: averageWidth }} />
          </div>
          <span className="text-right font-label-bold text-label-bold text-on-surface">{formatNumber(item.average, item.decimals)}</span>
        </div>
      </div>
    </article>
  );
}

function RoleMetric({ metric }) {
  const lowerIsBetter = metric.key === "deaths";
  const tone = getDeltaTone(metric.delta, { lowerIsBetter });
  const maxValue = Math.max(Math.abs(metric.current || 0), Math.abs(metric.average || 0), 1);
  const currentWidth = Number.isFinite(metric.current) ? Math.max(4, (Math.abs(metric.current) / maxValue) * 100) : 0;
  const averageWidth = Number.isFinite(metric.average) ? Math.max(4, (Math.abs(metric.average) / maxValue) * 100) : 0;

  return (
    <div className={`rounded-xl border p-sm ${tone.surface}`}>
      <div className="flex items-start justify-between gap-xs">
        <div>
          <p className="font-label-small text-label-small text-on-surface-variant">{metric.label}</p>
          <p className="mt-1 font-headline-3 text-headline-3 text-on-surface">{formatNumber(metric.current, metric.decimals)}</p>
        </div>
        <span className={`rounded-full border px-xs py-1 font-label-bold text-[11px] ${tone.badge}`}>
          Δ {formatNumber(metric.delta, metric.decimals, { signed: true })}
        </span>
      </div>
      <div className="mt-sm grid gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div className={`h-full rounded-full ${tone.rail}`} style={{ width: `${currentWidth}%` }} />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div className="h-full rounded-full bg-[#314a73]" style={{ width: `${averageWidth}%` }} />
        </div>
      </div>
      <p className="mt-xs font-label-small text-[11px] text-on-surface-variant">
        Baseline {formatNumber(metric.average, metric.decimals)}
      </p>
    </div>
  );
}

function RoleComparisonCard({ row }) {
  return (
    <article className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-md shadow-[0_12px_28px_rgba(0,0,0,0.035)]">
      <div className="flex items-center gap-sm border-b border-outline-variant/20 pb-sm">
        <ChampionPortrait champion={row.champion} />
        <div className="min-w-0">
          <p className="font-headline-3 text-headline-3 text-on-surface">{row.role}</p>
          <p className="truncate font-label-small text-label-small text-on-surface-variant">
            {row.playerName || row.champion || "Not recorded"} · n={row.sampleSize}
          </p>
        </div>
      </div>
      <div className="mt-sm grid gap-xs">
        {row.metrics.map((metric) => <RoleMetric key={metric.key} metric={metric} />)}
      </div>
    </article>
  );
}

function AverageTab({ comparison }) {
  if (comparison.sampleSize < 1) {
    return (
      <div data-export-page="true" data-export-page-title="Game vs baseline">
        <EmptyState title="No prior League scrims yet">
          Save at least one earlier League scrim to calculate a historical average for this game.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="grid gap-lg">
      <section
        className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg shadow-[0_14px_35px_rgba(0,0,0,0.04)]"
        data-export-page="true"
        data-export-page-title="Game summary and team output"
      >
        <div className="flex flex-wrap items-start justify-between gap-sm">
          <div>
            <h3 className="font-headline-2 text-headline-2 text-on-surface">Team output</h3>
            <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">Current game and the available prior-scrim average.</p>
          </div>
          <div className="flex items-center gap-md font-label-small text-label-small text-on-surface-variant">
            <span className="flex items-center gap-xs"><span className="h-2.5 w-2.5 rounded-full bg-primary" />This game</span>
            <span className="flex items-center gap-xs"><span className="h-2.5 w-2.5 rounded-full bg-[#314a73]" />Prior average</span>
          </div>
        </div>
        <div className="mt-md grid gap-sm md:grid-cols-2 xl:grid-cols-5" data-export-columns="5">
          {comparison.metrics.length ? (
            comparison.metrics.map((item) => <MetricComparison item={item} key={item.key} />)
          ) : (
            <p className="rounded-2xl bg-surface-container-low p-md font-body-sub text-body-sub text-on-surface-variant">
              No team totals are available in both this game and the prior scrims.
            </p>
          )}
        </div>
      </section>

      <section
        className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg shadow-[0_14px_35px_rgba(0,0,0,0.04)]"
        data-export-page="true"
        data-export-page-title="Role comparison"
      >
        <div className="flex flex-wrap items-start justify-between gap-sm">
          <div>
            <h3 className="font-headline-2 text-headline-2 text-on-surface">Role comparison</h3>
            <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
              Every card shows current value, baseline, and signed delta. Deaths use the inverse favorable direction.
            </p>
          </div>
          <div className="flex flex-wrap gap-xs font-label-small text-label-small">
            <span className="rounded-full border border-[#1B5E20]/20 bg-[#E3F9E5] px-sm py-xs text-[#1B5E20] dark:border-[#72F59A]/70 dark:bg-[#123A24] dark:text-[#A5FFBD]">
              Green · favorable delta
            </span>
            <span className="rounded-full border border-error/20 bg-error-container px-sm py-xs text-error">Red · unfavorable delta</span>
          </div>
        </div>
        <div className="mt-md grid gap-sm md:grid-cols-2 xl:grid-cols-5" data-export-columns="5">
          {comparison.roleRows.map((row) => <RoleComparisonCard key={row.role} row={row} />)}
        </div>
      </section>
    </div>
  );
}

function TrendMetricCard({ active, metric, onSelect, points }) {
  const values = points
    .map((point) => point.values[metric.key])
    .filter(Number.isFinite);
  const currentPoint = points.find((point) => point.isCurrent) || points.at(-1);
  const currentValue = currentPoint?.values?.[metric.key];
  const baselineValues = points
    .filter((point) => !point.isCurrent)
    .map((point) => point.values[metric.key])
    .filter(Number.isFinite);
  const baselineAverage = average(baselineValues);
  const delta = Number.isFinite(currentValue) && Number.isFinite(baselineAverage)
    ? currentValue - baselineAverage
    : null;
  const tone = getDeltaTone(delta);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const span = Math.max(1, maxValue - minValue);

  return (
    <button
      aria-pressed={active}
      className={`rounded-2xl border p-md text-left transition-colors ${
        active
          ? "border-primary/35 bg-primary-fixed/55 shadow-[0_10px_25px_rgba(0,88,188,0.10)]"
          : "border-outline-variant/25 bg-surface-container-lowest hover:border-primary/25"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-xs">
        <div>
          <p className="font-label-bold text-label-bold text-on-surface">{metric.shortLabel}</p>
          <p className="mt-1 font-headline-3 text-headline-3 text-primary">
            {formatNumber(currentValue, metric.decimals)}
          </p>
        </div>
        <span className={`rounded-full border px-xs py-1 font-label-bold text-[11px] ${tone.badge}`}>
          {Number.isFinite(delta) ? `${formatNumber(delta, metric.decimals, { signed: true })} vs avg` : "No baseline"}
        </span>
      </div>
      <div className="mt-sm flex h-10 items-end gap-1" aria-hidden="true">
        {points.map((point) => {
          const value = point.values[metric.key];
          const height = Number.isFinite(value)
            ? Math.max(12, ((value - minValue) / span) * 100)
            : 6;
          const outcomeTone = point.result === "victory"
            ? "bg-[#1B5E20]"
            : point.result === "defeat"
              ? "bg-error"
              : "bg-outline";
          return (
            <span
              className={`min-w-1 flex-1 rounded-t ${outcomeTone} ${point.isCurrent ? "ring-2 ring-primary ring-offset-1" : "opacity-70"}`}
              key={point.id}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
      <p className="mt-xs font-label-small text-[11px] text-on-surface-variant">{metric.description}</p>
    </button>
  );
}

function TrendLineChart({ metric, points }) {
  const width = 820;
  const height = 320;
  const padding = { bottom: 58, left: 58, right: 28, top: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = points.map((point) => point.values[metric.key]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const initialSpan = Math.max(1, rawMax - rawMin);
  const minValue = Math.min(rawMin - initialSpan * 0.15, metric.key === "kill_differential" ? 0 : rawMin);
  const maxValue = Math.max(rawMax + initialSpan * 0.15, metric.key === "kill_differential" ? 0 : rawMax);
  const valueSpan = Math.max(1, maxValue - minValue);
  const xForIndex = (index) => points.length === 1
    ? padding.left + plotWidth / 2
    : padding.left + (index / (points.length - 1)) * plotWidth;
  const yForValue = (value) => padding.top + ((maxValue - value) / valueSpan) * plotHeight;
  const linePath = points
    .map((point, index) => `${index ? "L" : "M"} ${xForIndex(index)} ${yForValue(point.values[metric.key])}`)
    .join(" ");
  const areaPath = `${linePath} L ${xForIndex(points.length - 1)} ${padding.top + plotHeight} L ${xForIndex(0)} ${padding.top + plotHeight} Z`;
  const seriesAverage = average(values);
  const averageY = Number.isFinite(seriesAverage) ? yForValue(seriesAverage) : null;
  const tickValues = Array.from({ length: 5 }, (_, index) => maxValue - (valueSpan * index) / 4);

  return (
    <div className="overflow-hidden rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-md">
      <svg
        aria-label={`${metric.label} across ${points.length} saved scrims`}
        className="h-auto min-w-[620px] w-full"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>{metric.label} by saved scrim</title>
        <desc>Each point is one saved scrim. Green points are victories, red points are defeats, and the outlined point is the selected scrim.</desc>
        <defs>
          <linearGradient id={`trend-area-${metric.key}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(var(--color-primary))" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {tickValues.map((tick) => {
          const y = yForValue(tick);
          return (
            <g key={tick}>
              <line stroke="currentColor" strokeOpacity="0.10" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text fill="rgb(var(--color-on-surface-variant))" fontSize="11" textAnchor="end" x={padding.left - 10} y={y + 4}>
                {formatNumber(tick, metric.decimals)}
              </text>
            </g>
          );
        })}
        {Number.isFinite(averageY) && (
          <>
            <line
              stroke="rgb(var(--color-primary))"
              strokeDasharray="7 7"
              strokeOpacity="0.72"
              x1={padding.left}
              x2={width - padding.right}
              y1={averageY}
              y2={averageY}
            />
            <text fill="rgb(var(--color-on-surface-variant))" fontSize="11" fontWeight="600" textAnchor="end" x={width - padding.right} y={averageY - 8}>
              Series avg {formatNumber(seriesAverage, metric.decimals)}
            </text>
          </>
        )}
        <path d={areaPath} fill={`url(#trend-area-${metric.key})`} />
        <path d={linePath} fill="none" stroke="rgb(var(--color-primary))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {points.map((point, index) => {
          const x = xForIndex(index);
          const y = yForValue(point.values[metric.key]);
          const fill = point.result === "victory"
            ? "rgb(27,94,32)"
            : point.result === "defeat"
              ? "rgb(186,26,26)"
              : "rgb(113,119,134)";
          return (
            <g key={point.id}>
              {point.isCurrent && <circle cx={x} cy={y} fill="none" r="12" stroke="rgb(var(--color-primary))" strokeWidth="3" />}
              <circle cx={x} cy={y} fill={fill} r="7" stroke="white" strokeWidth="3" />
              <text fill="rgb(var(--color-on-surface))" fontSize="11" fontWeight="700" textAnchor="middle" x={x} y={y - 17}>
                {formatNumber(point.values[metric.key], metric.decimals)}
              </text>
              <text fill="rgb(var(--color-on-surface-variant))" fontSize="11" textAnchor="middle" x={x} y={height - 27}>
                {point.gameNumber ? `G${point.gameNumber}` : formatShortDate(point.playedAt)}
              </text>
              <text
                fill={point.result === "victory" ? "rgb(114,245,154)" : point.result === "defeat" ? "rgb(var(--color-error))" : "rgb(var(--color-outline))"}
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
                x={x}
                y={height - 11}
              >
                {point.result === "victory" ? "WIN" : point.result === "defeat" ? "LOSS" : "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TrendsTab({ comparison }) {
  const availableOptions = comparison.trendMetricOptions.filter((option) =>
    comparison.trendPoints.some((point) => Number.isFinite(point.values[option.key]))
  );
  const [metricKey, setMetricKey] = useState(availableOptions[0]?.key || "");

  useEffect(() => {
    if (!availableOptions.some((option) => option.key === metricKey)) {
      setMetricKey(availableOptions[0]?.key || "");
    }
  }, [availableOptions, metricKey]);

  const activeMetric = availableOptions.find((option) => option.key === metricKey);
  const points = activeMetric
    ? comparison.trendPoints.filter((point) => Number.isFinite(point.values[activeMetric.key]))
    : [];
  const activePoint = points.find((point) => point.isCurrent) || points.at(-1);
  const baselineValues = points
    .filter((point) => !point.isCurrent)
    .map((point) => point.values[activeMetric?.key])
    .filter(Number.isFinite);
  const baselineAverage = average(baselineValues);
  const currentValue = activePoint?.values?.[activeMetric?.key];
  const delta = Number.isFinite(currentValue) && Number.isFinite(baselineAverage)
    ? currentValue - baselineAverage
    : null;
  const rangeValues = points.map((point) => point.values[activeMetric?.key]).filter(Number.isFinite);
  const rangeLabel = rangeValues.length
    ? `${formatNumber(Math.min(...rangeValues), activeMetric?.decimals)} – ${formatNumber(Math.max(...rangeValues), activeMetric?.decimals)}`
    : "—";
  const deltaTone = getDeltaTone(delta);

  if (!availableOptions.length || !points.length) {
    return (
      <div data-export-page="true" data-export-page-title="Scrim trajectory">
        <EmptyState title="No chronological stats available">
          Saved League scrims need at least one numeric team stat before a trend can be plotted.
        </EmptyState>
      </div>
    );
  }

  return (
    <section
      className="grid gap-lg rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg shadow-[0_14px_35px_rgba(0,0,0,0.04)]"
      data-export-page="true"
      data-export-page-title="Scrim trajectory"
    >
      <div className="flex flex-col justify-between gap-md lg:flex-row lg:items-start">
        <div>
          <h3 className="font-headline-2 text-headline-2 text-on-surface">Derived scrim trajectory</h3>
          <p className="mt-xs max-w-2xl font-body-sub text-body-sub text-on-surface-variant">
            Ratios, differentials, and efficiency from up to eight saved scoreboards. No forecast or inferred events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-sm font-label-small text-label-small text-on-surface-variant">
          <span className="inline-flex items-center gap-xs"><span className="h-2.5 w-2.5 rounded-full bg-[#1B5E20]" />Win</span>
          <span className="inline-flex items-center gap-xs"><span className="h-2.5 w-2.5 rounded-full bg-error" />Loss</span>
          <span className="inline-flex items-center gap-xs"><span className="h-3 w-3 rounded-full border-2 border-primary" />Selected</span>
        </div>
      </div>

      <div className="grid gap-sm md:grid-cols-2 xl:grid-cols-3" data-export-columns="3">
        {availableOptions.map((option) => (
          <TrendMetricCard
            active={metricKey === option.key}
            key={option.key}
            metric={option}
            onSelect={() => setMetricKey(option.key)}
            points={comparison.trendPoints.filter((point) => Number.isFinite(point.values[option.key]))}
          />
        ))}
      </div>

      <div className="grid gap-md xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 overflow-x-auto">
          <TrendLineChart metric={activeMetric} points={points} />
        </div>
        <aside className="grid content-start gap-sm rounded-3xl bg-surface-container-low p-md">
          <div>
            <p className="font-label-small text-label-small text-on-surface-variant">Selected metric</p>
            <p className="mt-1 font-headline-3 text-headline-3 text-on-surface">{activeMetric.label}</p>
            <p className="mt-xs font-label-small text-label-small text-on-surface-variant">{activeMetric.description}</p>
          </div>
          <div className="rounded-2xl bg-surface-container-lowest p-sm">
            <p className="font-label-small text-label-small text-on-surface-variant">Current</p>
            <p className="mt-1 font-headline-2 text-headline-2 text-primary">{formatNumber(currentValue, activeMetric.decimals)}</p>
          </div>
          <div className={`rounded-2xl border p-sm ${deltaTone.surface}`}>
            <p className="font-label-small text-label-small text-on-surface-variant">Vs prior average</p>
            <p className={`mt-1 font-headline-3 text-headline-3 ${deltaTone.text}`}>
              {formatNumber(delta, activeMetric.decimals, { signed: true })}
            </p>
          </div>
          <div className="rounded-2xl bg-surface-container-lowest p-sm">
            <p className="font-label-small text-label-small text-on-surface-variant">Observed range</p>
            <p className="mt-1 font-label-bold text-label-bold text-on-surface">{rangeLabel}</p>
          </div>
          <div className="rounded-2xl bg-surface-container-lowest p-sm">
            <p className="font-label-small text-label-small text-on-surface-variant">Scrims plotted</p>
            <p className="mt-1 font-label-bold text-label-bold text-on-surface">{points.length}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ChampionPoolTab({ comparison }) {
  const analytics = useMemo(
    () => aggregateCharacterAnalytics(comparison.scrimReviews, "League of Legends"),
    [comparison.scrimReviews]
  );
  const usageByName = new Map(analytics.ourTopCharacters.map((entry) => [entry.name, entry]));
  const champions = analytics.characterPerformance.map((entry) => ({
    ...entry,
    usage: usageByName.get(entry.name),
  }));

  if (!champions.length) {
    return (
      <div data-export-page="true" data-export-page-title="Champion pool">
        <EmptyState title="No confirmed champion stats available">
          Confirm champion names and save the League scrims to build a statistical champion pool.
        </EmptyState>
      </div>
    );
  }

  return (
    <section
      className="grid gap-md md:grid-cols-2 xl:grid-cols-3"
      data-export-columns="3"
      data-export-page="true"
      data-export-page-title="Champion pool"
    >
      {champions.map((champion) => {
        const outcomes = champion.wins + champion.losses;
        return (
          <article className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg shadow-[0_14px_35px_rgba(0,0,0,0.04)]" key={champion.name}>
            <div className="flex items-center gap-md">
              <ChampionPortrait champion={champion.name} size="lg" />
              <div className="min-w-0">
                <h3 className="truncate font-headline-3 text-headline-3 text-on-surface">{champion.name}</h3>
                <p className="mt-1 font-label-small text-label-small text-on-surface-variant">
                  {champion.games} {champion.games === 1 ? "scrim" : "scrims"} · {formatPercent(champion.usage?.pick_rate)} of recorded scrims
                </p>
              </div>
            </div>

            <div className="mt-md grid grid-cols-3 gap-xs">
              <div className="rounded-xl bg-surface-container-low p-sm">
                <p className="font-label-small text-label-small text-on-surface-variant">Games</p>
                <p className="mt-1 font-label-bold text-label-bold text-on-surface">{champion.games}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-sm">
                <p className="font-label-small text-label-small text-on-surface-variant">Record</p>
                <p className="mt-1 font-label-bold text-label-bold text-on-surface">{outcomes ? `${champion.wins}-${champion.losses}` : "—"}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-sm">
                <p className="font-label-small text-label-small text-on-surface-variant">Win rate</p>
                <p className="mt-1 font-label-bold text-label-bold text-on-surface">{formatPercent(champion.win_rate)}</p>
              </div>
            </div>

            <div className="mt-sm flex flex-wrap gap-xs">
              {champion.metrics.map((metric) => (
                <div className="min-w-[72px] flex-1 rounded-xl border border-outline-variant/20 px-sm py-xs" key={metric.key}>
                  <p className="font-label-small text-label-small text-on-surface-variant">Avg {metric.label}</p>
                  <p className="mt-1 font-label-bold text-label-bold text-on-surface">{formatNumber(metric.value, metric.decimals)}</p>
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ComparisonReportSection({ active, children, description, index, title }) {
  return (
    <section className={active ? "block" : "hidden"} data-export-reveal="true">
      <div className="grid gap-md">
        <header className="flex items-start gap-md border-b border-outline-variant/25 pb-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary font-headline-3 text-headline-3 text-on-primary">
            {index}
          </span>
          <div>
            <h2 className="font-headline-2 text-headline-2 text-on-surface">{title}</h2>
            <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{description}</p>
          </div>
        </header>
        {children}
      </div>
    </section>
  );
}

export default function LeagueScrimCompare({ currentReview, historicalReviews = [] }) {
  const [activeTab, setActiveTab] = useState("average");
  const comparison = useMemo(
    () => buildLeagueScrimComparison(currentReview, historicalReviews),
    [currentReview, historicalReviews]
  );

  return (
    <section className="mx-auto grid w-full max-w-[1440px] gap-lg">
      <div className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg shadow-[0_14px_35px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col justify-between gap-md lg:flex-row lg:items-center">
          <div>
            <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">League scrim compare</p>
            <h2 className="mt-xs font-headline-1 text-headline-1 text-on-surface">Current game vs recorded scrims</h2>
            <p className="mt-xs max-w-2xl font-body-main text-body-main text-on-surface-variant">
              Every value below comes from saved scoreboard fields. Missing values are left unavailable.
            </p>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 divide-x divide-outline-variant/25 overflow-hidden rounded-2xl bg-surface-container-low">
            <div className="p-md">
              <p className="font-label-small text-label-small text-on-surface-variant">Selected scrim</p>
              <p className="mt-xs font-label-bold text-label-bold text-on-surface">{formatScrimDate(currentReview?.played_at || currentReview?.created_at)}</p>
            </div>
            <div className="p-md">
              <p className="font-label-small text-label-small text-on-surface-variant">Prior sample</p>
              <p className="mt-xs font-headline-3 text-headline-3 text-primary">{comparison.sampleSize}</p>
            </div>
          </div>
        </div>
      </div>

      <nav
        aria-label="League comparison views"
        className="grid grid-cols-1 gap-xs rounded-2xl bg-surface-container-low p-1 sm:grid-cols-3"
        data-export-ignore="true"
      >
        {COMPARE_TABS.map((tab) => (
          <button
            aria-current={activeTab === tab.value ? "page" : undefined}
            className={`flex items-center justify-center gap-xs rounded-xl px-md py-sm font-label-bold text-label-bold transition-colors ${
              activeTab === tab.value
                ? "bg-surface-container-lowest text-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            <MaterialSymbol className="text-[18px]">{tab.icon}</MaterialSymbol>
            {tab.label}
          </button>
        ))}
      </nav>

      <ComparisonReportSection
        active={activeTab === "average"}
        description="Current scoreboard totals and role-level deltas against prior saved scrims."
        index="1"
        title="Game vs baseline"
      >
        <AverageTab comparison={comparison} />
      </ComparisonReportSection>
      <ComparisonReportSection
        active={activeTab === "trends"}
        description="Derived ratios, differentials, and efficiency across saved scrims."
        index="2"
        title="Scrim trajectory"
      >
        <TrendsTab comparison={comparison} />
      </ComparisonReportSection>
      <ComparisonReportSection
        active={activeTab === "champions"}
        description="Recorded champion usage, outcomes, and average scoreboard performance."
        index="3"
        title="Champion pool"
      >
        <ChampionPoolTab comparison={comparison} />
      </ComparisonReportSection>
    </section>
  );
}
