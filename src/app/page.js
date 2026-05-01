"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { GAME_OPTIONS, getDefaultRankForGame, getRanksForGame } from "@/lib/game-options";

function createInitialPostForm() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    teamId: "",
    gameTitle: "Valorant",
    date: getDateInputValue(tomorrow),
    startTime: "19:00",
    games: "3 Games",
    rankRange: getDefaultRankForGame("Valorant"),
    opponentRankMin: getDefaultRankForGame("Valorant"),
    opponentRankMax: getDefaultRankForGame("Valorant"),
    server: "NA-East",
    notes: "Looking for BO3 on Ascent/Haven.",
  };
}

const TIME_FILTER_OPTIONS = [
  { label: "Any time", value: "all" },
  { label: "Morning", value: "morning" },
  { label: "Evening", value: "evening" },
];

const SCRIM_DURATION_HOURS = 3;

function getScrimEndAt(value) {
  if (!value) return null;

  const endAt = new Date(value);
  if (Number.isNaN(endAt.getTime())) return null;

  endAt.setHours(endAt.getHours() + SCRIM_DURATION_HOURS);
  return endAt;
}

function parseGamesCount(value) {
  const count = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(count) ? count : 3;
}

function formatGamesCount(value) {
  const count = Number(value || 3);
  return `${count} ${count === 1 ? "Game" : "Games"}`;
}

function isMissingGamesCountError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("games_count");
}

function isScrimPast(value) {
  const endAt = getScrimEndAt(value);
  return endAt ? endAt < new Date() : false;
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getRankColor(rank = "") {
  if (rank.includes("Immortal") || rank.includes("Radiant")) return "#ff2d55";
  if (rank.includes("Ascendant") || rank.includes("Diamond")) return "#00e676";
  if (rank.includes("Platinum")) return "#2979ff";
  if (rank.includes("Faceit")) return "#ff6d00";
  return "#717786";
}

function getRankIndex(rank, ranks) {
  if (!rank || !ranks.length) return -1;
  const normalizedRank = rank.toLowerCase().trim();
  const exactIndex = ranks.findIndex((rankOption) => normalizedRank === rankOption.toLowerCase());

  if (exactIndex !== -1) return exactIndex;

  return ranks
    .map((rankOption, index) => ({ index, rankOption }))
    .sort((first, second) => second.rankOption.length - first.rankOption.length)
    .find(({ rankOption }) => normalizedRank.includes(rankOption.toLowerCase()))?.index ?? -1;
}

function getRankRangeLabel(filters, ranks) {
  if (!ranks.length || filters.gameTitle === "all") return "Choose a game";
  const minRank = ranks[filters.rankMinIndex] || ranks[0];
  const maxRank = ranks[filters.rankMaxIndex] || ranks[ranks.length - 1];
  const isAllRanks = filters.rankMinIndex === 0 && filters.rankMaxIndex === ranks.length - 1;
  return isAllRanks ? "Any rank matchup" : `${minRank} - ${maxRank}`;
}

function scrimMatchesRankRange(scrimRequest, filters, ranks) {
  if (filters.gameTitle === "all" || !ranks.length) return true;
  if (filters.rankMinIndex === 0 && filters.rankMaxIndex === ranks.length - 1) return true;

  const selectedMin = Math.min(filters.rankMinIndex, filters.rankMaxIndex);
  const selectedMax = Math.max(filters.rankMinIndex, filters.rankMaxIndex);
  const postingRankIndex = getRankIndex(scrimRequest.team_rank || scrimRequest.posting_team?.rank_tier, ranks);
  const opponentMinIndex = getRankIndex(scrimRequest.opponent_rank_min, ranks);
  const opponentMaxIndex = getRankIndex(scrimRequest.opponent_rank_max, ranks);
  const rankChecks = [];

  if (postingRankIndex !== -1) {
    rankChecks.push(postingRankIndex >= selectedMin && postingRankIndex <= selectedMax);
  }

  if (opponentMinIndex !== -1 || opponentMaxIndex !== -1) {
    const availableOpponentIndexes = [opponentMinIndex, opponentMaxIndex].filter((index) => index !== -1);
    const opponentRangeMin = Math.min(...availableOpponentIndexes);
    const opponentRangeMax = Math.max(...availableOpponentIndexes);
    rankChecks.push(opponentRangeMax >= selectedMin && opponentRangeMin <= selectedMax);
  }

  if (!rankChecks.length) return true;

  return rankChecks.some(Boolean);
}

function abbreviateRank(rank = "") {
  const rankMap = {
    Iron: "Ir",
    Bronze: "Br",
    Silver: "Sil",
    Gold: "Gold",
    Platinum: "Plat",
    Diamond: "Dia",
    Ascendant: "Asc",
    Immortal: "Imm",
    Radiant: "Rad",
    Emerald: "Em",
    Master: "Mstr",
    Grandmaster: "GM",
    Challenger: "Chal",
    Champion: "Champ",
    "Grand Champion": "GC",
    "Supersonic Legend": "SSL",
    "Gold Nova": "GN",
    "Master Guardian": "MG",
    "Distinguished Master Guardian": "DMG",
    "Legendary Eagle": "LE",
    "Supreme Master": "SM",
    "Global Elite": "GE",
    Premier: "Prem",
    Celestial: "Cel",
    Eternity: "Eter",
    "One Above All": "OAA",
    "Top 500": "T500",
  };

  return rankMap[rank] || rank;
}

function formatScrimTime(value) {
  if (!value) return "Time TBD";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getUserTimeZoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time zone";
}

function formatBoardDate(value) {
  if (!value) return "Any date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getDayRange(dateValue) {
  const start = new Date(`${dateValue}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function matchesTimeBucket(value, timeFilter) {
  if (timeFilter === "all") return true;
  if (!value) return false;

  const hour = new Date(value).getHours();

  if (timeFilter === "morning") return hour >= 6 && hour < 12;
  if (timeFilter === "evening") return hour >= 12 || hour < 2;

  return true;
}

function getScrimDateKey(value) {
  if (!value) return "unscheduled";
  return getDateInputValue(new Date(value));
}

function formatScrimSectionDate(value) {
  if (value === "unscheduled") return "Date TBD";

  const date = new Date(`${value}T00:00:00`);
  const today = getDateInputValue();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowValue = getDateInputValue(tomorrow);

  if (value === today) return "Today";
  if (value === tomorrowValue) return "Tomorrow";

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function groupScrimsByDate(scrimRequests) {
  return scrimRequests.reduce((groups, scrimRequest) => {
    const key = getScrimDateKey(scrimRequest.scheduled_at);
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.scrims.push(scrimRequest);
      return groups;
    }

    return [
      ...groups,
      {
        key,
        label: formatScrimSectionDate(key),
        scrims: [scrimRequest],
      },
    ];
  }, []);
}

function normalizeScrimRequest(scrimRequest) {
  const postingTeam = scrimRequest.posting_team || scrimRequest.teams;
  const organization = postingTeam?.organization || postingTeam?.organizations;
  const opponentRank = scrimRequest.opponent_rank_min || scrimRequest.opponent_rank_max || "Open";

  return {
    id: scrimRequest.id,
    initials: getInitials(postingTeam?.name),
    team: postingTeam?.name || "Unknown Team",
    org: organization?.name || "Independent",
    game: scrimRequest.game_title,
    region: postingTeam?.region || "Region TBD",
    rank: scrimRequest.team_rank || postingTeam?.rank_tier || "Rank TBD",
    rankColor: getRankColor(scrimRequest.team_rank || postingTeam?.rank_tier),
    opponentRank,
    opponentRankColor: getRankColor(scrimRequest.opponent_rank_min || scrimRequest.opponent_rank_max || ""),
    rating: Number(postingTeam?.scrimgg_rating || 0).toFixed(1),
    time: formatScrimTime(scrimRequest.scheduled_at),
    games: formatGamesCount(scrimRequest.games_count),
    verified: Boolean(organization?.verified_flag),
    hasRequested: Boolean(scrimRequest.hasRequested),
    isOwnListing: Boolean(scrimRequest.isOwnListing),
    status: scrimRequest.status,
  };
}

function ScrimCard({ scrim }) {
  const actionHref = scrim.hasRequested ? `/requests?scrim=${scrim.id}` : `/scrims/${scrim.id}`;
  const actionLabel = scrim.hasRequested ? "Request Sent" : scrim.isOwnListing ? "Edit" : "Scrim";

  return (
    <article className={`bg-surface-container-lowest rounded-[16px] p-md border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow ${scrim.hasRequested ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between mb-md">
        <div className="flex items-center gap-sm">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center font-headline-2 text-headline-2 text-on-surface font-bold">
            {scrim.initials}
          </div>
          <div>
            <h2 className="font-headline-3 text-headline-3 text-on-surface flex items-center gap-1">
              {scrim.team}
              {scrim.verified && (
                <MaterialSymbol className="text-[16px] text-primary" fill>
                  verified
                </MaterialSymbol>
              )}
            </h2>
            <p className="font-label-small text-label-small text-on-surface-variant">{scrim.org}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-xs mb-md">
        <span className="bg-primary-fixed text-on-primary-fixed font-label-small text-label-small px-2 py-1 rounded-full">
          {scrim.game}
        </span>
        <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full">
          {scrim.region}
        </span>
        <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: scrim.rankColor }} />
          {scrim.rank}
        </span>
        <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full flex items-center gap-1">
          <span className="text-[10px] font-bold leading-none">VS</span>
          {scrim.opponentRank}
        </span>
        <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full flex items-center gap-1">
          <MaterialSymbol className="text-[12px] text-[#ffb400]" fill>
            star
          </MaterialSymbol>
          {scrim.rating}
        </span>
        {scrim.hasRequested && (
          <span className="bg-surface-container-highest text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full flex items-center gap-1">
            <MaterialSymbol className="text-[12px]" fill>
              check_circle
            </MaterialSymbol>
            Request sent
          </span>
        )}
        {scrim.isOwnListing && (
          <span className="bg-[#E3F9E5] text-[#1B5E20] font-label-small text-label-small px-2 py-1 rounded-full flex items-center gap-1">
            <MaterialSymbol className="text-[12px]" fill>
              edit_calendar
            </MaterialSymbol>
            Your listing
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-sm border-t border-surface-variant">
        <div className="flex items-center gap-1 text-on-surface-variant font-label-bold text-label-bold">
          <MaterialSymbol className="text-[18px]">schedule</MaterialSymbol>
          {scrim.time} &bull; {scrim.games}
        </div>
        <a
          href={actionHref}
          className={`font-label-bold text-label-bold px-lg py-sm rounded-full active:scale-95 transition-transform ${
            scrim.hasRequested
              ? "bg-surface-container-highest text-on-surface-variant"
              : scrim.isOwnListing
                ? "bg-[#1B5E20] text-white"
              : "bg-primary text-on-primary"
          }`}
        >
          {actionLabel}
        </a>
      </div>
    </article>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-sm">
      <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}

function SelectField({ icon, children, ...props }) {
  return (
    <div className="relative">
      <select
        className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md pr-xl appearance-none focus:ring-2 focus:ring-primary"
        {...props}
      >
        {children}
      </select>
      <MaterialSymbol className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
        {icon}
      </MaterialSymbol>
    </div>
  );
}

function TextInput({ icon, ...props }) {
  return (
    <div className="relative">
      <input
        className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md pr-xl focus:ring-2 focus:ring-primary"
        type="text"
        {...props}
      />
      <MaterialSymbol className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
        {icon}
      </MaterialSymbol>
    </div>
  );
}

function BoardFilterSelect({ icon, label, children, ...props }) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      {icon && (
        <MaterialSymbol className="absolute left-sm top-1/2 -translate-y-1/2 text-[20px] text-primary pointer-events-none">
          {icon}
        </MaterialSymbol>
      )}
      <select
        className={`h-10 min-w-[140px] bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-bold text-label-bold rounded-full border border-transparent appearance-none focus:ring-2 focus:ring-primary ${
          icon ? "pl-xl" : "pl-md"
        } pr-xl`}
        {...props}
      >
        {children}
      </select>
      <MaterialSymbol className="absolute right-sm top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant pointer-events-none">
        keyboard_arrow_down
      </MaterialSymbol>
    </label>
  );
}

function BoardDateFilter({ value, onChange, onClear }) {
  const dateInputRef = useRef(null);

  function openDatePicker() {
    if (dateInputRef.current?.showPicker) {
      dateInputRef.current.showPicker();
      return;
    }

    dateInputRef.current?.focus();
  }

  return (
    <div className="relative shrink-0">
      <span className="sr-only">Scrim date</span>
      <button
        className="h-10 min-w-[132px] bg-primary text-on-primary font-label-bold text-label-bold rounded-full pl-md pr-lg flex items-center gap-xs shadow-[0_2px_12px_rgba(0,112,235,0.25)] focus:ring-2 focus:ring-primary"
        onClick={openDatePicker}
        type="button"
      >
        <MaterialSymbol className="text-[20px]">calendar_month</MaterialSymbol>
        <span>{formatBoardDate(value)}</span>
      </button>
      <input
        className="absolute left-1/2 top-1/2 h-px w-px -translate-x-1/2 -translate-y-1/2 opacity-0"
        name="date"
        onChange={onChange}
        ref={dateInputRef}
        type="date"
        value={value}
      />
      {value && (
        <button
          aria-label="Clear date filter"
          className="absolute right-xs top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-on-primary hover:bg-white/15"
          onClick={onClear}
          type="button"
        >
          <MaterialSymbol className="text-[16px]">close</MaterialSymbol>
        </button>
      )}
    </div>
  );
}

function RankRangeFilter({ filters, onChange, ranks }) {
  const disabled = filters.gameTitle === "all" || ranks.length === 0;
  const minRank = ranks[filters.rankMinIndex] || ranks[0];
  const maxRank = ranks[filters.rankMaxIndex] || ranks[ranks.length - 1];
  const sliderMax = Math.max(ranks.length - 1, 0);
  const selectedMin = Math.min(filters.rankMinIndex, filters.rankMaxIndex);
  const selectedMax = Math.max(filters.rankMinIndex, filters.rankMaxIndex);
  const sliderMinPercent = sliderMax ? (selectedMin / sliderMax) * 100 : 0;
  const sliderMaxPercent = sliderMax ? (selectedMax / sliderMax) * 100 : 100;

  function handleMinChange(event) {
    const nextMin = Math.min(Number(event.target.value), selectedMax);
    onChange({ rankMinIndex: nextMin });
  }

  function handleMaxChange(event) {
    const nextMax = Math.max(Number(event.target.value), selectedMin);
    onChange({ rankMaxIndex: nextMax });
  }

  return (
    <section
      className={`rounded-2xl border px-md py-sm shadow-[0_8px_24px_rgba(0,0,0,0.04)] ${
        disabled
          ? "border-outline-variant/20 bg-surface-container-low text-outline"
          : "border-outline-variant/30 bg-surface-container-lowest"
      }`}
    >
      <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
        <div className="min-w-[180px]">
          <p className="font-label-small text-label-small uppercase tracking-wider text-outline">Rank Window</p>
          <h3 className="mt-0.5 font-label-bold text-label-bold text-on-surface">
            {disabled ? "Pick a game first" : getRankRangeLabel(filters, ranks)}
          </h3>
        </div>

        {!disabled && (
          <button
            className="self-start rounded-full px-sm py-xs font-label-small text-label-small text-primary hover:bg-primary-fixed"
            onClick={() => onChange({ rankMinIndex: 0, rankMaxIndex: sliderMax })}
            type="button"
          >
            Reset
          </button>
        )}
      </div>

      {disabled ? (
        <div className="mt-sm flex items-center gap-sm rounded-xl bg-surface-container px-md py-sm font-body-sub text-body-sub">
          <MaterialSymbol className="text-[20px]">sports_esports</MaterialSymbol>
          Select a game to unlock its rank filter.
        </div>
      ) : (
        <div className="mt-sm rounded-xl bg-surface-container-low px-md py-sm">
          <div className="relative pb-lg pt-md">
            <div className="absolute left-0 right-0 top-[22px] h-2 rounded-full bg-surface-container-high" />
            <div
              className="absolute top-[22px] h-2 rounded-full bg-primary"
              style={{
                left: `${sliderMinPercent}%`,
                right: `${100 - sliderMaxPercent}%`,
              }}
            />
            <input
              aria-label="Minimum rank"
              className="rank-range-slider absolute left-0 top-0 w-full"
              max={sliderMax}
              min={0}
              onChange={handleMinChange}
              type="range"
              value={selectedMin}
            />
            <input
              aria-label="Maximum rank"
              className="rank-range-slider absolute left-0 top-0 w-full"
              max={sliderMax}
              min={0}
              onChange={handleMaxChange}
              type="range"
              value={selectedMax}
            />
          </div>

          <div className="mt-xs flex items-start justify-between gap-xs overflow-x-auto pb-xs scrollbar-hide">
            {ranks.map((rank, index) => {
              const selected = index >= selectedMin && index <= selectedMax;
              return (
                <button
                  className={`flex min-w-[56px] flex-col items-center gap-1 rounded-lg px-1.5 py-1 text-center font-label-small text-[11px] leading-tight transition-colors ${
                    selected ? "bg-primary-fixed text-on-primary-fixed" : "text-outline hover:bg-surface-container"
                  }`}
                  key={rank}
                  onClick={() => onChange({ rankMinIndex: index, rankMaxIndex: index })}
                  type="button"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${selected ? "bg-primary" : "bg-outline-variant"}`}
                  />
                  <span className="max-w-[70px] whitespace-normal break-words">{rank}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-sm font-label-small text-label-small text-on-surface">
            <div className="min-w-0">
              <span className="text-outline">Low</span>
              <strong className="ml-xs">{minRank}</strong>
            </div>
            <div className="h-px flex-1 bg-outline-variant" />
            <div className="min-w-0 text-right">
              <span className="text-outline">High</span>
              <strong className="ml-xs">{maxRank}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function parseScheduledAt(dateValue, timeValue) {
  const timeMatch = timeValue.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  const scheduledAt = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(scheduledAt.getTime()) || !timeMatch) {
    return null;
  }

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] || 0);
  const meridiem = timeMatch[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt.toISOString();
}

function PostScrimModal({
  form,
  isOpen,
  isPosting,
  isLoadingTeams,
  onChange,
  onClose,
  onSubmit,
  postError,
  teams,
}) {
  if (!isOpen) return null;

  return (
    <>
      <button
        aria-label="Close post scrim modal"
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 md:items-center md:justify-center md:inset-0 md:flex">
        <div className="w-full md:w-[600px] md:mx-auto bg-surface rounded-t-[32px] md:rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex flex-col max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between px-margin-mobile pt-lg pb-md border-b border-surface-variant relative">
            <div className="md:hidden w-12 h-1.5 bg-outline-variant rounded-full absolute top-3 left-1/2 -translate-x-1/2" />
            <button
              className="text-primary hover:text-on-primary-fixed-variant transition-colors p-sm -ml-sm"
              onClick={onClose}
              type="button"
            >
              <MaterialSymbol className="text-2xl">close</MaterialSymbol>
            </button>
            <h2 className="font-headline-2 text-headline-2 text-on-surface">New Scrim Listing</h2>
            <button
              className="text-primary font-label-bold text-label-bold hover:text-on-primary-fixed-variant transition-colors px-sm py-xs"
              type="button"
            >
              Drafts
            </button>
          </div>

          <form className="overflow-y-auto px-margin-mobile py-lg flex flex-col gap-lg flex-grow" onSubmit={onSubmit}>
            <Field label="Posting Team">
              <SelectField
                disabled={isLoadingTeams || teams.length === 0}
                icon="expand_more"
                name="teamId"
                onChange={onChange}
                value={form.teamId}
              >
                {isLoadingTeams ? (
                  <option value="">Loading teams...</option>
                ) : teams.length === 0 ? (
                  <option value="">Create a team before posting</option>
                ) : (
                  teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} - {team.game_title}
                    </option>
                  ))
                )}
              </SelectField>
            </Field>

            <Field label="Select Game">
              <SelectField disabled icon="lock" name="gameTitle" onChange={onChange} value={form.gameTitle}>
                <option>{form.gameTitle}</option>
              </SelectField>
              <p className="font-label-small text-label-small text-outline">
                Game is locked to the selected team&apos;s registered game.
              </p>
            </Field>

            <Field label="Date">
              <input
                className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary"
                name="date"
                onChange={onChange}
                type="date"
                value={form.date}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Start Time">
                <TextInput
                  icon="schedule"
                  name="startTime"
                  onChange={onChange}
                  type="time"
                  value={form.startTime}
                />
                <p className="font-label-small text-label-small text-outline">
                  Uses your local time zone: {getUserTimeZoneLabel()}
                </p>
              </Field>
              <Field label="Number of Games">
                <SelectField icon="expand_more" name="games" onChange={onChange} value={form.games}>
                  <option>1 Game</option>
                  <option>2 Games</option>
                  <option>3 Games</option>
                  <option>4 Games</option>
                  <option>5+ Games</option>
                </SelectField>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Opponent Rank Min">
                <SelectField icon="military_tech" name="opponentRankMin" onChange={onChange} value={form.opponentRankMin}>
                  {getRanksForGame(form.gameTitle).map((rank) => (
                    <option key={rank}>{rank}</option>
                  ))}
                </SelectField>
              </Field>
              <Field label="Opponent Rank Max">
                <SelectField icon="military_tech" name="opponentRankMax" onChange={onChange} value={form.opponentRankMax}>
                  {getRanksForGame(form.gameTitle).map((rank) => (
                    <option key={rank}>{rank}</option>
                  ))}
                </SelectField>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Server">
                <SelectField icon="public" name="server" onChange={onChange} value={form.server}>
                  <option>NA-East</option>
                  <option>NA-West</option>
                  <option>NA-Central</option>
                  <option>EU-West</option>
                </SelectField>
              </Field>
            </div>

            <Field label="Additional Notes">
              <textarea
                className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary resize-none"
                name="notes"
                onChange={onChange}
                placeholder="Any specific map requests, format (BO3, BO5), or rules..."
                rows={3}
                value={form.notes}
              />
            </Field>

            {postError && (
              <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
                {postError}
              </div>
            )}

            <div className="-mx-margin-mobile -mb-lg px-margin-mobile py-lg border-t border-surface-variant bg-surface">
              <button
                className="w-full bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-headline-3 text-headline-3 rounded-xl py-md px-lg transition-colors flex items-center justify-center gap-sm active:scale-[0.98]"
                disabled={isPosting}
                type="submit"
              >
                <MaterialSymbol className="text-2xl" fill>
                  send
                </MaterialSymbol>
                {isPosting ? "Posting..." : "Post to Scrim Board"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default function ScrimBoardPage() {
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [scrimRequests, setScrimRequests] = useState([]);
  const [isLoadingScrims, setIsLoadingScrims] = useState(true);
  const [scrimError, setScrimError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [boardFilters, setBoardFilters] = useState({
    date: "",
    gameTitle: "all",
    rankMinIndex: 0,
    rankMaxIndex: 0,
    time: "all",
  });
  const [postForm, setPostForm] = useState(() => createInitialPostForm());
  const [isPosting, setIsPosting] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [postError, setPostError] = useState("");
  const [postingTeams, setPostingTeams] = useState([]);

  const rankFilterOptions = useMemo(() => {
    if (boardFilters.gameTitle !== "all") {
      return getRanksForGame(boardFilters.gameTitle);
    }

    return [];
  }, [boardFilters.gameTitle]);

  useEffect(() => {
    if (!rankFilterOptions.length) return;
    setBoardFilters((currentFilters) => {
      const nextMax = rankFilterOptions.length - 1;
      if (currentFilters.rankMaxIndex === nextMax) return currentFilters;
      return {
        ...currentFilters,
        rankMinIndex: 0,
        rankMaxIndex: nextMax,
      };
    });
  }, [rankFilterOptions]);

  const visibleScrimRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return scrimRequests.filter((scrimRequest) => {
      if (!matchesTimeBucket(scrimRequest.scheduled_at, boardFilters.time)) {
        return false;
      }

      if (!scrimMatchesRankRange(scrimRequest, boardFilters, rankFilterOptions)) {
        return false;
      }

      if (!query) return true;

      const scrim = normalizeScrimRequest(scrimRequest);
      return [scrim.team, scrim.org, scrim.region, scrim.game, scrim.rank]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [boardFilters, rankFilterOptions, scrimRequests, searchQuery]);

  const scrimSections = useMemo(() => groupScrimsByDate(visibleScrimRequests), [visibleScrimRequests]);

  const fetchScrimRequests = useCallback(async () => {
    setIsLoadingScrims(true);
    setScrimError("");

    const requestSelectWithGames = `
        id,
        posting_team_id,
        matched_team_id,
        game_title,
        scheduled_at,
        games_count,
        team_rank,
        opponent_rank_min,
        opponent_rank_max,
        status,
        expires_at,
        posting_team:teams!scrim_requests_posting_team_id_fkey (
          id,
          name,
          region,
          rank_tier,
          scrimgg_rating,
          organization:organizations!teams_org_id_fkey (
            id,
            name,
            verified_flag
          )
        )
      `;
    const requestSelectWithoutGames = requestSelectWithGames.replace("games_count,", "");

    const activeSince = new Date(Date.now() - SCRIM_DURATION_HOURS * 60 * 60 * 1000).toISOString();
    const userTeamIds = [];

    const { data: userData } = await supabase.auth.getUser();

    if (userData?.user) {
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Failed to load current user for board requests", profileError);
      }

      if (profile?.org_id) {
        const { data: teams, error: teamsError } = await supabase
          .from("teams")
          .select("id")
          .eq("org_id", profile.org_id);

        if (teamsError) {
          console.error("Failed to load current user teams for board requests", teamsError);
        } else {
          userTeamIds.push(...(teams || []).map((team) => team.id));
        }
      }
    }

    const applyFilters = (baseQuery) => {
      let filteredQuery = baseQuery;

      if (!boardFilters.date) {
        filteredQuery = filteredQuery.gte("scheduled_at", activeSince);
      }

      if (boardFilters.gameTitle !== "all") {
        filteredQuery = filteredQuery.eq("game_title", boardFilters.gameTitle);
      }

      const dateRange = boardFilters.date ? getDayRange(boardFilters.date) : null;

      if (dateRange) {
        filteredQuery = filteredQuery.gte("scheduled_at", dateRange.start).lt("scheduled_at", dateRange.end);
      }

      return filteredQuery.order("scheduled_at", { ascending: true });
    };

    const runBoardQueries = async (requestSelect) => {
      const openQuery = applyFilters(
        supabase
        .from("scrim_requests")
        .select(requestSelect)
        .eq("status", "open")
        .is("matched_team_id", null)
      );

      const requestedQuery = userTeamIds.length
        ? applyFilters(
            supabase
              .from("scrim_requests")
              .select(requestSelect)
              .eq("status", "pending")
              .in("matched_team_id", userTeamIds)
          )
        : null;

      return Promise.all([
        openQuery,
        requestedQuery || Promise.resolve({ data: [], error: null }),
      ]);
    };

    let [openResult, requestedResult] = await runBoardQueries(requestSelectWithGames);

    if (isMissingGamesCountError(openResult.error) || isMissingGamesCountError(requestedResult.error)) {
      console.warn("games_count is missing in Supabase. Run supabase_scrim_games_count.sql to enable saved game counts.");
      [openResult, requestedResult] = await runBoardQueries(requestSelectWithoutGames);
    }

    const error = openResult.error || requestedResult.error;

    if (error) {
      setScrimError(error.message);
      setScrimRequests([]);
    } else {
      const mergedById = new Map();

      for (const scrimRequest of openResult.data || []) {
        if (
          scrimRequest.status === "open" &&
          !scrimRequest.matched_team_id &&
          !isScrimPast(scrimRequest.scheduled_at)
        ) {
          mergedById.set(scrimRequest.id, {
            ...scrimRequest,
            hasRequested: false,
            isOwnListing: userTeamIds.includes(scrimRequest.posting_team_id),
          });
        }
      }

      for (const scrimRequest of requestedResult.data || []) {
        if (
          scrimRequest.status === "pending" &&
          userTeamIds.includes(scrimRequest.matched_team_id) &&
          !isScrimPast(scrimRequest.scheduled_at)
        ) {
          mergedById.set(scrimRequest.id, {
            ...scrimRequest,
            hasRequested: true,
          });
        }
      }

      setScrimRequests(
        Array.from(mergedById.values()).sort(
          (firstScrim, secondScrim) => new Date(firstScrim.scheduled_at) - new Date(secondScrim.scheduled_at)
        )
      );
    }

    setIsLoadingScrims(false);
  }, [boardFilters]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("post") === "true") {
      setIsPostModalOpen(true);
    }
  }, []);

  useEffect(() => {
    fetchScrimRequests();
  }, [fetchScrimRequests]);

  useEffect(() => {
    document.body.style.overflow = isPostModalOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isPostModalOpen]);

  useEffect(() => {
    if (!isPostModalOpen) return;

    async function fetchPostingTeams() {
      setIsLoadingTeams(true);
      setPostError("");

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setPostingTeams([]);
        setPostError("Log in before posting a scrim.");
        setIsLoadingTeams(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, org_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        console.error("Failed to load user profile for scrim post", profileError);
        setPostingTeams([]);
        setPostError("We could not load your profile. Please try again.");
        setIsLoadingTeams(false);
        return;
      }

      if (!profile?.org_id) {
        setPostingTeams([]);
        setPostError("Create an organization before posting a scrim.");
        setIsLoadingTeams(false);
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, game_title, rank_tier, region")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true });

      if (teamsError) {
        console.error("Failed to load teams for scrim post", teamsError);
        setPostingTeams([]);
        setPostError("We could not load your teams. Please try again.");
        setIsLoadingTeams(false);
        return;
      }

      setPostingTeams(teams || []);

      if (teams?.length) {
        setPostForm((currentForm) => ({
          ...currentForm,
          ...(() => {
            const preferredTeam = teams.find((team) => team.game_title === currentForm.gameTitle) || teams[0];
            const selectedTeam = teams.find((team) => team.id === currentForm.teamId) || preferredTeam;

            return {
              teamId: selectedTeam.id,
              gameTitle: selectedTeam.game_title,
              rankRange: selectedTeam.rank_tier || getDefaultRankForGame(selectedTeam.game_title),
              opponentRankMin: getRanksForGame(selectedTeam.game_title).includes(currentForm.opponentRankMin)
                ? currentForm.opponentRankMin
                : getDefaultRankForGame(selectedTeam.game_title),
              opponentRankMax: getRanksForGame(selectedTeam.game_title).includes(currentForm.opponentRankMax)
                ? currentForm.opponentRankMax
                : getDefaultRankForGame(selectedTeam.game_title),
              server: selectedTeam.region || currentForm.server,
            };
          })(),
        }));
      } else {
        setPostForm((currentForm) => ({
          ...currentForm,
          teamId: "",
        }));
      }

      setIsLoadingTeams(false);
    }

    fetchPostingTeams();
  }, [isPostModalOpen]);

  function handlePostFormChange(event) {
    const { name, value } = event.target;
    const selectedTeam = name === "teamId" ? postingTeams.find((team) => team.id === value) : null;

    setPostForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === "gameTitle"
        ? {
            rankRange: getDefaultRankForGame(value),
            opponentRankMin: getDefaultRankForGame(value),
            opponentRankMax: getDefaultRankForGame(value),
          }
        : {}),
      ...(selectedTeam
        ? {
            gameTitle: selectedTeam.game_title,
            rankRange: selectedTeam.rank_tier || getDefaultRankForGame(selectedTeam.game_title),
            opponentRankMin: getDefaultRankForGame(selectedTeam.game_title),
            opponentRankMax: getDefaultRankForGame(selectedTeam.game_title),
            server: selectedTeam.region || currentForm.server,
          }
        : {}),
    }));
  }

  function handleBoardFilterChange(event) {
    const { name, value } = event.target;
    const nextRanks = name === "gameTitle" && value !== "all" ? getRanksForGame(value) : [];
    setBoardFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
      ...(name === "gameTitle"
        ? {
            rankMinIndex: 0,
            rankMaxIndex: nextRanks.length ? nextRanks.length - 1 : 0,
          }
        : {}),
      ...(name === "date" && value
        ? {
            time: "all",
          }
        : {}),
    }));
  }

  function handleRankRangeChange(nextRange) {
    setBoardFilters((currentFilters) => ({
      ...currentFilters,
      ...nextRange,
    }));
  }

  async function resolvePostingTeam(userId, gameTitle, selectedTeamId) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, org_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Failed to load user profile for scrim post", profileError);
      throw new Error("We could not load your profile. Please try again.");
    }

    if (!profile?.org_id) {
      throw new Error("Create an organization before posting a scrim.");
    }

    const { data: teams, error: teamsError } = await supabase
      .from("teams")
      .select("id, game_title, rank_tier, region")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: true });

    if (teamsError) {
      console.error("Failed to load teams for scrim post", teamsError);
      throw new Error("We could not load your teams. Please try again.");
    }

    if (!teams?.length) {
      throw new Error("Create a team before posting a scrim.");
    }

    const selectedTeam = teams.find((team) => team.id === selectedTeamId);
    if (selectedTeam) return selectedTeam;

    return teams.find((team) => team.game_title === gameTitle) || teams[0];
  }

  async function submitPost(event) {
    event.preventDefault();
    setIsPosting(true);
    setPostError("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setPostError("Log in before posting a scrim.");
        return;
      }

      const postingTeam = await resolvePostingTeam(userData.user.id, postForm.gameTitle, postForm.teamId);
      const gameTitle = postingTeam.game_title;
      const scheduledAt = parseScheduledAt(postForm.date, postForm.startTime);

      if (!scheduledAt) {
        setPostError("Enter a valid date and start time.");
        return;
      }

      const opponentRankMin = postForm.opponentRankMin || postForm.rankRange;
      const opponentRankMax = postForm.opponentRankMax || postForm.opponentRankMin || postForm.rankRange;
      const expiresAt = getScrimEndAt(scheduledAt).toISOString();

      const payload = {
        posting_team_id: postingTeam.id,
        game_title: gameTitle,
        scheduled_at: scheduledAt,
        games_count: parseGamesCount(postForm.games),
        team_rank: postingTeam.rank_tier || postForm.rankRange,
        opponent_rank_min: opponentRankMin,
        opponent_rank_max: opponentRankMax,
        status: "open",
        matched_team_id: null,
        expires_at: expiresAt,
      };

      let { error: insertError } = await supabase.from("scrim_requests").insert(payload);

      if (isMissingGamesCountError(insertError)) {
        console.warn("games_count is missing in Supabase. Posting scrim without saved game count.");
        const { games_count, ...fallbackPayload } = payload;
        ({ error: insertError } = await supabase.from("scrim_requests").insert(fallbackPayload));
      }

      if (insertError) {
        console.error("Failed to post scrim request", insertError);
        setPostError(insertError.message);
        return;
      }

      setIsPostModalOpen(false);
      setPostForm(createInitialPostForm());
      setPostingTeams([]);
      setShowToast(true);
      window.setTimeout(() => setShowToast(false), 2500);
      await fetchScrimRequests();
    } catch (error) {
      console.error("Failed to post scrim request", error);
      setPostError(error.message || "Something went wrong while posting your scrim.");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <>
      <TopBar />

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-lg pb-xl">
        <div className="mb-lg flex items-start justify-between gap-4">
          <div>
            <p className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-xs">ACTIVE LISTINGS</p>
            <h1 className="font-editorial-large text-editorial-large text-on-surface">Scrim Board</h1>
          </div>
          <button
            className="bg-primary hover:bg-on-primary-fixed-variant text-on-primary font-label-bold text-label-bold px-4 py-2 md:px-lg md:py-3 rounded-full active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,88,188,0.3)] whitespace-nowrap mt-4"
            onClick={() => setIsPostModalOpen(true)}
            type="button"
          >
            Post LF Scrim
          </button>
        </div>

        <div className="flex flex-col gap-sm mb-xl">
          <div className="relative w-full">
            <MaterialSymbol className="absolute left-sm top-1/2 -translate-y-1/2 text-outline">
              search
            </MaterialSymbol>
            <input
              className="w-full bg-surface-container-high border-none rounded-lg py-sm pl-xl pr-sm font-body-sub text-body-sub text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-colors h-[44px]"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search teams, orgs, or regions..."
              type="text"
              value={searchQuery}
            />
          </div>

          <div className="flex items-center gap-xs overflow-x-auto pb-xs scrollbar-hide -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0">
            <BoardDateFilter
              onClear={() => {
                setBoardFilters((currentFilters) => ({
                  ...currentFilters,
                  date: "",
                }));
              }}
              onChange={handleBoardFilterChange}
              value={boardFilters.date}
            />

            <BoardFilterSelect
              icon="sports_esports"
              label="Game"
              name="gameTitle"
              onChange={handleBoardFilterChange}
              value={boardFilters.gameTitle}
            >
              <option value="all">All games</option>
              {GAME_OPTIONS.map((game) => (
                <option key={game} value={game}>
                  {game}
                </option>
              ))}
            </BoardFilterSelect>

            <BoardFilterSelect
              icon="schedule"
              label="Time"
              name="time"
              onChange={handleBoardFilterChange}
              value={boardFilters.time}
            >
              {TIME_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </BoardFilterSelect>
          </div>

          <RankRangeFilter
            filters={boardFilters}
            onChange={handleRankRangeChange}
            ranks={rankFilterOptions}
          />
        </div>

        {isLoadingScrims ? (
          <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            Loading scrims...
          </div>
        ) : scrimError ? (
          <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            Unable to load scrims: {scrimError}
          </div>
        ) : visibleScrimRequests.length === 0 ? (
          <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            No active scrims found.
          </div>
        ) : (
          <div className="flex flex-col gap-xl">
            {scrimSections.map((section) => (
              <section className="flex flex-col gap-md" key={section.key}>
                <div className="flex items-center gap-sm">
                  <h2 className="font-headline-3 text-headline-3 text-on-surface">{section.label}</h2>
                  <span className="h-px flex-1 bg-outline-variant/60" />
                  <span className="font-label-small text-label-small text-outline">
                    {section.scrims.length} {section.scrims.length === 1 ? "scrim" : "scrims"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                  {section.scrims.map((scrimRequest) => (
                    <ScrimCard key={scrimRequest.id} scrim={normalizeScrimRequest(scrimRequest)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <PostScrimModal
        form={postForm}
        isOpen={isPostModalOpen}
        isPosting={isPosting}
        isLoadingTeams={isLoadingTeams}
        onChange={handlePostFormChange}
        onClose={() => setIsPostModalOpen(false)}
        onSubmit={submitPost}
        postError={postError}
        teams={postingTeams}
      />

      <BottomNav />

      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-on-surface text-inverse-on-surface font-label-bold text-label-bold px-6 py-3 rounded-full shadow-lg z-50 transition-all">
          Posted to Scrim Board
        </div>
      )}
    </>
  );
}
