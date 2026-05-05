"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { extractPostGameStats, POSTGAME_SCREENSHOT_STATS } from "@/lib/postgame-extraction";
import { supabase } from "@/lib/supabase";

const GAME_DASHBOARD_CONFIGS = {
  "League of Legends": {
    pickField: "champion",
    pickLabel: "Champion",
    mapLabel: "Scrim Context",
    compositionLabel: "Composition",
    defaultMap: "",
    roles: ["Top", "Jungle", "Mid", "ADC", "Support"],
    editFields: ["level", "k", "d", "a", "gold", "damage_to_champions"],
    cardStats: [
      { key: "kda", label: "K/D/A" },
      { key: "gold", label: "Gold" },
    ],
    tableFields: [
      { key: "kda", label: "K/D/A" },
      { key: "gold", label: "Gold" },
      { key: "damage_to_champions", label: "Damage" },
    ],
    highlightStats: [
      { key: "total_gold", label: "Total Gold" },
      { key: "total_damage_to_champions", label: "Damage" },
    ],
  },
  Valorant: {
    pickField: "agent",
    pickLabel: "Agent",
    mapLabel: "Map",
    compositionLabel: "Composition",
    defaultMap: "Ascent",
    roles: ["Duelist", "Initiator", "Controller", "Sentinel", "Flex"],
    editFields: ["k", "d", "a", "acs", "econ_rating", "first_bloods", "plants", "defuses"],
    cardStats: [
      { key: "acs", label: "Combat Score" },
      { key: "kda", label: "K/D/A" },
    ],
    tableFields: [
      { key: "acs", label: "Combat Score" },
      { key: "kda", label: "K/D/A" },
      { key: "econ_rating", label: "Econ" },
      { key: "first_bloods", label: "FB" },
      { key: "plants", label: "Plants" },
      { key: "defuses", label: "Defuses" },
    ],
    highlightStats: [
      { key: "team_kills", label: "Total Kills" },
      { key: "team_deaths", label: "Total Deaths" },
      { key: "team_assists", label: "Total Assists" },
      { key: "average_acs", label: "Average Combat Score" },
      { key: "average_econ_rating", label: "Average Econ" },
      { key: "total_first_bloods", label: "First Bloods" },
      { key: "total_plants", label: "Plants" },
      { key: "total_defuses", label: "Defuses" },
    ],
  },
  "Counter-Strike 2": {
    pickField: "role",
    pickLabel: "Role",
    mapLabel: "Map",
    compositionLabel: "Lineup",
    defaultMap: "Competitive Map",
    roles: ["Entry", "AWPer", "Rifler", "IGL", "Support"],
    editFields: ["k", "a", "d", "adr", "hs_percent", "mvps"],
    cardStats: [
      { key: "kda", label: "K/A/D" },
      { key: "adr", label: "ADR" },
    ],
    tableFields: [
      { key: "kda", label: "K/A/D" },
      { key: "adr", label: "ADR" },
      { key: "hs_percent", label: "HS%" },
      { key: "mvps", label: "MVPs" },
      { key: "score", label: "Score" },
    ],
    highlightStats: [
      { key: "team_kills", label: "Team Kills" },
      { key: "average_adr", label: "Avg ADR" },
      { key: "average_hs_percent", label: "Avg HS%" },
    ],
  },
  "Rocket League": {
    pickField: "car",
    pickLabel: "Car / Role",
    mapLabel: "Arena / Mode",
    compositionLabel: "Rotation",
    defaultMap: "3v3",
    roles: ["First Man", "Second Man", "Third Man"],
    editFields: ["score", "goals", "assists", "saves", "shots", "demos"],
    cardStats: [
      { key: "goals", label: "Goals" },
      { key: "saves", label: "Saves" },
    ],
    tableFields: [
      { key: "score", label: "Score" },
      { key: "goals", label: "Goals" },
      { key: "assists", label: "Assists" },
      { key: "saves", label: "Saves" },
      { key: "shots", label: "Shots" },
      { key: "demos", label: "Demos" },
    ],
    highlightStats: [
      { key: "goals", label: "Goals" },
      { key: "saves", label: "Saves" },
      { key: "shots", label: "Shots" },
    ],
  },
  "Overwatch 2": {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Map / Objective",
    compositionLabel: "Hero Composition",
    defaultMap: "Hybrid",
    roles: ["Tank", "Damage", "Damage", "Support", "Support", "Flex"],
    editFields: ["eliminations", "assists", "deaths", "damage", "healing", "mitigation"],
    cardStats: [
      { key: "eliminations", label: "Elims" },
      { key: "deaths", label: "Deaths" },
    ],
    tableFields: [
      { key: "eliminations", label: "Elims" },
      { key: "assists", label: "Assists" },
      { key: "deaths", label: "Deaths" },
      { key: "damage", label: "Damage" },
      { key: "healing", label: "Healing" },
      { key: "mitigation", label: "Mitigation" },
    ],
    highlightStats: [
      { key: "eliminations", label: "Eliminations" },
      { key: "damage", label: "Damage" },
      { key: "healing", label: "Healing" },
    ],
  },
  "Marvel Rivals": {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Map / Mode",
    compositionLabel: "Hero Composition",
    defaultMap: "Domination",
    roles: ["Vanguard", "Duelist", "Duelist", "Strategist", "Strategist", "Flex"],
    editFields: ["k", "d", "a", "final_hits", "damage", "damage_blocked", "healing", "accuracy"],
    cardStats: [
      { key: "kda", label: "K/D/A" },
      { key: "damage", label: "Damage" },
    ],
    tableFields: [
      { key: "kda", label: "K/D/A" },
      { key: "final_hits", label: "Final Hits" },
      { key: "damage", label: "Damage" },
      { key: "damage_blocked", label: "Blocked" },
      { key: "healing", label: "Healing" },
      { key: "accuracy", label: "Accuracy" },
    ],
    highlightStats: [
      { key: "total_kills", label: "Kills" },
      { key: "total_final_hits", label: "Final Hits" },
      { key: "total_damage", label: "Damage" },
      { key: "total_healing", label: "Healing" },
    ],
  },
  Deadlock: {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Match / Lane",
    compositionLabel: "Hero Lineup",
    defaultMap: "Ending Match",
    roles: ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6"],
    editFields: ["k", "d", "a", "souls", "player_damage", "objective_damage", "healing"],
    cardStats: [
      { key: "kda", label: "K/D/A" },
      { key: "souls", label: "Souls" },
    ],
    tableFields: [
      { key: "kda", label: "K/D/A" },
      { key: "souls", label: "Souls" },
      { key: "player_damage", label: "Player Dmg" },
      { key: "objective_damage", label: "Obj Dmg" },
      { key: "healing", label: "Healing" },
    ],
    highlightStats: [
      { key: "team_kills", label: "Team Kills" },
      { key: "total_souls", label: "Souls" },
      { key: "total_player_damage", label: "Player Dmg" },
      { key: "total_objective_damage", label: "Objective Dmg" },
      { key: "total_healing", label: "Healing" },
    ],
  },
  SSBU: {
    pickField: "character",
    pickLabel: "Character",
    mapLabel: "Ruleset / Stage",
    compositionLabel: "Crew",
    screenshotUpload: false,
    defaultMap: "Crew Battle",
    roles: ["Starter", "Anchor", "Counterpick", "Flex", "Closer"],
    editFields: ["kos", "falls", "self_destructs", "damage_dealt", "damage_taken", "stocks_remaining"],
    cardStats: [
      { key: "kos", label: "KOs" },
      { key: "stocks_remaining", label: "Stocks" },
    ],
    tableFields: [
      { key: "kos", label: "KOs" },
      { key: "falls", label: "Falls" },
      { key: "self_destructs", label: "SDs" },
      { key: "damage_dealt", label: "Dmg Dealt" },
      { key: "damage_taken", label: "Dmg Taken" },
      { key: "stocks_remaining", label: "Stocks" },
    ],
    highlightStats: [
      { key: "kos", label: "KOs" },
      { key: "stocks_remaining", label: "Stocks Left" },
      { key: "self_destructs", label: "SDs" },
    ],
  },
  "Honor of Kings": {
    pickField: "hero",
    pickLabel: "Hero",
    mapLabel: "Mode",
    compositionLabel: "Hero Composition",
    defaultMap: "Ranked 5v5",
    roles: ["Clash Lane", "Jungle", "Mid", "Farm Lane", "Roam"],
    editFields: ["k", "d", "a", "gold", "damage", "damage_taken"],
    cardStats: [
      { key: "kda", label: "K/D/A" },
      { key: "gold", label: "Gold" },
    ],
    tableFields: [
      { key: "kda", label: "K/D/A" },
      { key: "gold", label: "Gold" },
      { key: "damage", label: "Damage" },
      { key: "damage_taken", label: "Taken" },
      { key: "healing", label: "Healing" },
    ],
    highlightStats: [
      { key: "team_kills", label: "Team Kills" },
      { key: "total_gold", label: "Total Gold" },
      { key: "damage", label: "Damage" },
    ],
  },
};

GAME_DASHBOARD_CONFIGS.Overwatch = GAME_DASHBOARD_CONFIGS["Overwatch 2"];

const SUPPORTED_GAMES = Object.keys(POSTGAME_SCREENSHOT_STATS);

const MARVEL_RIVALS_HERO_OPTIONS = [
  "Adam Warlock",
  "Angela",
  "Black Panther",
  "Black Widow",
  "Blade",
  "Captain America",
  "Cloak & Dagger",
  "Doctor Strange",
  "Emma Frost",
  "Groot",
  "Hawkeye",
  "Hela",
  "Hulk",
  "Human Torch",
  "Invisible Woman",
  "Iron Fist",
  "Iron Man",
  "Jeff the Land Shark",
  "Loki",
  "Luna Snow",
  "Magik",
  "Magneto",
  "Mantis",
  "Mister Fantastic",
  "Moon Knight",
  "Namor",
  "Peni Parker",
  "Phoenix",
  "Psylocke",
  "Rocket Raccoon",
  "Scarlet Witch",
  "Spider-Man",
  "Squirrel Girl",
  "Star-Lord",
  "Storm",
  "The Punisher",
  "The Thing",
  "Thor",
  "Ultron",
  "Venom",
  "Winter Soldier",
  "Wolverine",
];

function getDashboardConfig(gameTitle) {
  return GAME_DASHBOARD_CONFIGS[gameTitle] || GAME_DASHBOARD_CONFIGS.Valorant;
}

function isStatFirstGame(gameTitle) {
  return gameTitle === "Deadlock";
}

function createBlankReview(gameTitle, matchType = "scrim") {
  const config = getDashboardConfig(gameTitle);

  return {
    match_type: matchType,
    match_result: "victory",
    final_score: "",
    team_score: "",
    opponent_score: "",
    opponent_name: "",
    map_or_mode: gameTitle === "League of Legends" ? "" : config.defaultMap,
    played_at: new Date().toISOString().slice(0, 16),
    screenshot_url: null,
    team_comp: createGameRows(gameTitle, true),
    opponent_comp: createGameRows(gameTitle, false),
    team_stats: {},
    opponent_stats: {},
    notes: "",
    parser_status: "manual",
    parser_confidence: null,
    manual_edit_required: false,
  };
}

function createGameRows(gameTitle, isTeam) {
  const config = getDashboardConfig(gameTitle);

  return config.roles.map((role) => ({
    [config.pickField]: "",
    player_name: isTeam ? "" : `Opponent ${role}`,
    role,
    ...Object.fromEntries(config.editFields.map((field) => [field, ""])),
  }));
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeReviewForForm(review, gameTitle) {
  const base = createBlankReview(gameTitle);
  const showScore = !isStatFirstGame(gameTitle);

  return {
    ...base,
    ...review,
    match_type: review?.match_type || base.match_type,
    final_score: showScore ? formatScore(review?.team_score, review?.opponent_score) || review?.final_score || "" : "",
    team_score: showScore ? review?.team_score ?? "" : "",
    opponent_score: showScore ? review?.opponent_score ?? "" : "",
    played_at: toDateInputValue(review?.played_at || new Date()),
    team_comp: review?.team_comp?.length ? review.team_comp : base.team_comp,
    opponent_comp: review?.opponent_comp?.length ? review.opponent_comp : base.opponent_comp,
    team_stats: review?.team_stats || {},
    opponent_stats: review?.opponent_stats || {},
  };
}

function normalizeRowsForSave(rows = [], gameTitle) {
  if (gameTitle !== "Marvel Rivals") return rows;
  return rows.map((row) => ({
    ...row,
    hero: row.hero_confirmed || "",
    hero_confirmed: row.hero_confirmed || "",
    hero_id: row.hero_id || "",
    costume_name: row.costume_name || "",
    costume_id: row.costume_id || "",
    asset_confidence: row.asset_confidence ?? row.hero_asset_confidence ?? "",
    matched_asset_src: row.matched_asset_src || "",
    needs_manual_review: Boolean(row.needs_manual_review || row.needs_hero_review),
  }));
}

function buildReviewPayload({ form, team, userId, screenshotPreview }) {
  const showScore = !isStatFirstGame(team.game_title);
  const derivedFinalScore = showScore ? formatScore(form.team_score, form.opponent_score) : "";
  const teamRows = normalizeRowsForSave(form.team_comp || [], team.game_title);
  const opponentRows = normalizeRowsForSave(form.opponent_comp || [], team.game_title);

  return {
    team_id: team.id,
    created_by: userId,
    game_title: team.game_title,
    match_type: form.match_type || "scrim",
    match_result: form.match_result || null,
    final_score: derivedFinalScore || null,
    team_score: showScore && form.team_score !== "" ? Number(form.team_score) : null,
    opponent_score: showScore && form.opponent_score !== "" ? Number(form.opponent_score) : null,
    opponent_name: form.opponent_name || null,
    map_or_mode: team.game_title === "League of Legends" ? null : form.map_or_mode || null,
    played_at: form.played_at ? new Date(form.played_at).toISOString() : null,
    screenshot_url: screenshotPreview || form.screenshot_url || null,
    team_comp: teamRows,
    opponent_comp: opponentRows,
    team_stats: form.team_stats || {},
    opponent_stats: form.opponent_stats || {},
    player_rows: teamRows,
    opponent_rows: opponentRows,
    notes: form.notes || null,
    parser_status: form.parser_status || "manual",
    parser_confidence: form.parser_confidence,
    manual_edit_required: Boolean(form.manual_edit_required),
    updated_at: new Date().toISOString(),
  };
}

function normalizeExtractedNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatScore(teamScore, opponentScore) {
  const hasTeamScore = teamScore !== null && teamScore !== undefined && teamScore !== "";
  const hasOpponentScore = opponentScore !== null && opponentScore !== undefined && opponentScore !== "";
  if (!hasTeamScore && !hasOpponentScore) return "";
  return `${hasTeamScore ? teamScore : "—"} - ${hasOpponentScore ? opponentScore : "—"}`;
}

function getReviewStatValue(stats = {}, key) {
  const fallbacks = {
    total_player_damage: "player_damage",
    total_objective_damage: "objective_damage",
    total_healing: "healing",
    total_souls: "souls",
  };

  return stats?.[key] ?? stats?.[fallbacks[key]];
}

function mapLeaguePlayerRow(player = {}) {
  return {
    role: player.role || "",
    champion: player.champion || "",
    player_name: player.player_name || "",
    level: normalizeExtractedNumber(player.level) ?? "",
    k: normalizeExtractedNumber(player.kills) ?? "",
    d: normalizeExtractedNumber(player.deaths) ?? "",
    a: normalizeExtractedNumber(player.assists) ?? "",
    gold: normalizeExtractedNumber(player.gold) ?? "",
    gold_per_min: normalizeExtractedNumber(player.gold_per_min) ?? "",
    damage_to_champions: normalizeExtractedNumber(player.damage_to_champions) ?? "",
    damage_share_percent: normalizeExtractedNumber(player.damage_share_percent) ?? "",
    items: Array.isArray(player.items) ? player.items : [],
    summoner_spells: Array.isArray(player.summoner_spells) ? player.summoner_spells : [],
    is_mvp: Boolean(player.is_mvp),
    confidence: normalizeExtractedNumber(player.confidence),
  };
}

function mapLeagueTeamStats(team = {}, derived = {}) {
  const totals = team.team_totals || {};
  return {
    team_kills: normalizeExtractedNumber(totals.kills) ?? normalizeExtractedNumber(derived.total_kills_from_rows),
    team_deaths: normalizeExtractedNumber(totals.deaths) ?? normalizeExtractedNumber(derived.total_deaths_from_rows),
    team_assists: normalizeExtractedNumber(totals.assists) ?? normalizeExtractedNumber(derived.total_assists_from_rows),
    total_gold: normalizeExtractedNumber(totals.gold) ?? normalizeExtractedNumber(derived.total_gold_from_rows),
    total_damage_to_champions: normalizeExtractedNumber(totals.damage_to_champions) ?? normalizeExtractedNumber(derived.total_damage_to_champions_from_rows),
  };
}

function findUserLeagueTeam(extraction, teamName) {
  const teams = Array.isArray(extraction?.teams) ? extraction.teams : [];
  const lowerTeamName = teamName?.toLowerCase();
  const explicitUserTeam = teams.find((team) => team?.is_user_team === true);
  if (explicitUserTeam) return explicitUserTeam;

  const nameMatch = lowerTeamName
    ? teams.find((team) => {
      const extractedName = team?.team_name?.toLowerCase();
      return extractedName && (extractedName.includes(lowerTeamName) || lowerTeamName.includes(extractedName));
    })
    : null;
  return nameMatch || teams[0] || null;
}

function mapLeagueExtractionToReview(extraction, teamName) {
  const teams = Array.isArray(extraction?.teams) ? extraction.teams : [];
  const match = extraction?.match || {};
  const ourTeam = findUserLeagueTeam(extraction, teamName);
  const opponentTeam = teams.find((team) => team !== ourTeam) || teams[1] || null;
  const ourTeamKey = ourTeam?.team_key || "team_1";
  const opponentTeamKey = opponentTeam?.team_key || "team_2";
  const derived = extraction?.derived_team_stats || {};
  const ourScore = ourTeamKey === "team_2" ? match.team_2_score : match.team_1_score;
  const opponentScore = opponentTeamKey === "team_1" ? match.team_1_score : match.team_2_score;
  const normalizedResult = match.result?.toLowerCase?.();

  return {
    match_result: ["victory", "defeat"].includes(normalizedResult) ? normalizedResult : "",
    final_score: formatScore(ourScore, opponentScore) || match.final_score || "",
    team_score: normalizeExtractedNumber(ourScore) ?? "",
    opponent_score: normalizeExtractedNumber(opponentScore) ?? "",
    opponent_name: opponentTeam?.team_name || "",
    map_or_mode: "",
    played_at: match.played_at || new Date().toISOString(),
    team_comp: (ourTeam?.players || []).map(mapLeaguePlayerRow),
    opponent_comp: (opponentTeam?.players || []).map(mapLeaguePlayerRow),
    team_stats: {
      ...mapLeagueTeamStats(ourTeam, derived[ourTeamKey]),
      game_length: match.game_length || null,
      patch: match.patch || null,
      fields_needing_manual_review: extraction?.fields_needing_manual_review || [],
    },
    opponent_stats: mapLeagueTeamStats(opponentTeam, derived[opponentTeamKey]),
    notes: extraction?.fields_needing_manual_review?.length
      ? `Gemini extraction flagged these fields for review: ${extraction.fields_needing_manual_review.join(", ")}`
      : "Gemini extraction. Review each field before saving.",
    parser_status: "extracted",
    parser_confidence: normalizeExtractedNumber(extraction?.parser_confidence),
    manual_edit_required: Boolean(extraction?.manual_review_required),
  };
}

function parseKdaText(value = "") {
  const parts = String(value)
    .split(/[\/-]/)
    .map((part) => normalizeExtractedNumber(part));

  return {
    k: parts[0] ?? "",
    d: parts[1] ?? "",
    a: parts[2] ?? "",
  };
}

function mapValorantPlayerRow(row = {}) {
  const parsedKda = parseKdaText(row.kda_text);
  return {
    team_key: row.team_key || null,
    row_color_group: row.row_color_group || null,
    agent: row.agent || "",
    player_name: row.player_name || "",
    role: row.role || "",
    k: normalizeExtractedNumber(row.kills) ?? parsedKda.k,
    d: normalizeExtractedNumber(row.deaths) ?? parsedKda.d,
    a: normalizeExtractedNumber(row.assists) ?? parsedKda.a,
    acs: normalizeExtractedNumber(row.avg_combat_score) ?? normalizeExtractedNumber(row.acs) ?? "",
    econ_rating: normalizeExtractedNumber(row.econ_rating) ?? "",
    first_bloods: normalizeExtractedNumber(row.first_bloods) ?? "",
    plants: normalizeExtractedNumber(row.plants) ?? "",
    defuses: normalizeExtractedNumber(row.defuses) ?? "",
    small_agent_headshot_detected: row.small_agent_headshot_detected ?? null,
    confidence: normalizeExtractedNumber(row.confidence),
  };
}

function sumRows(rows, key) {
  const values = rows
    .map((row) => normalizeExtractedNumber(row[key]))
    .filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function averageRows(rows, key) {
  const values = rows
    .map((row) => normalizeExtractedNumber(row[key]))
    .filter((value) => value !== null);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function mapValorantTeamStats(team = {}, rows = []) {
  const totals = team.team_totals || {};
  return {
    team_kills: normalizeExtractedNumber(totals.kills) ?? sumRows(rows, "k"),
    team_deaths: normalizeExtractedNumber(totals.deaths) ?? sumRows(rows, "d"),
    team_assists: normalizeExtractedNumber(totals.assists) ?? sumRows(rows, "a"),
    average_acs: normalizeExtractedNumber(totals.average_acs) ?? averageRows(rows, "acs"),
    average_econ_rating: normalizeExtractedNumber(totals.average_econ_rating) ?? averageRows(rows, "econ_rating"),
    total_first_bloods: normalizeExtractedNumber(totals.total_first_bloods) ?? sumRows(rows, "first_bloods"),
    total_plants: normalizeExtractedNumber(totals.total_plants) ?? sumRows(rows, "plants"),
    total_defuses: normalizeExtractedNumber(totals.total_defuses) ?? sumRows(rows, "defuses"),
  };
}

function groupValorantRows(extraction) {
  const teams = Array.isArray(extraction?.teams) ? extraction.teams : [];
  const teamOne = teams.find((team) => team?.team_key === "team_1") || teams[0] || {};
  const teamTwo = teams.find((team) => team?.team_key === "team_2") || teams[1] || {};
  const allRows = (Array.isArray(extraction?.rows) ? extraction.rows : [])
    .slice()
    .sort((first, second) => Number(first?.row_index || 0) - Number(second?.row_index || 0))
    .map(mapValorantPlayerRow);
  const groupedTeamOne = (teamOne.players || []).map((row) => mapValorantPlayerRow({ ...row, team_key: "team_1" }));
  const groupedTeamTwo = (teamTwo.players || []).map((row) => mapValorantPlayerRow({ ...row, team_key: "team_2" }));

  if (groupedTeamOne.length || groupedTeamTwo.length) {
    return {
      teamRows: groupedTeamOne,
      opponentRows: groupedTeamTwo,
      teamOne,
      teamTwo,
      groupingNeedsReview: groupedTeamOne.length !== 5 || groupedTeamTwo.length !== 5,
    };
  }

  const teamOneRows = allRows.filter((row) => row.team_key === "team_1");
  const teamTwoRows = allRows.filter((row) => row.team_key === "team_2");
  if (teamOneRows.length || teamTwoRows.length) {
    return {
      teamRows: teamOneRows,
      opponentRows: teamTwoRows,
      teamOne,
      teamTwo,
      groupingNeedsReview: teamOneRows.length !== 5 || teamTwoRows.length !== 5,
    };
  }

  return {
    teamRows: allRows.slice(0, 5),
    opponentRows: allRows.slice(5, 10),
    teamOne,
    teamTwo,
    groupingNeedsReview: true,
  };
}

function mapValorantExtractionToReview(extraction) {
  const match = extraction?.match || {};
  const {
    teamRows,
    opponentRows,
    teamOne,
    teamTwo,
    groupingNeedsReview,
  } = groupValorantRows(extraction);
  const normalizedResult = match.result?.toLowerCase?.();

  return {
    match_result: ["victory", "defeat"].includes(normalizedResult) ? normalizedResult : "",
    final_score: formatScore(match.team_1_score, match.team_2_score) || match.final_score || "",
    team_score: normalizeExtractedNumber(match.team_1_score) ?? "",
    opponent_score: normalizeExtractedNumber(match.team_2_score) ?? "",
    opponent_name: "",
    map_or_mode: match.map || "",
    played_at: match.played_at || new Date().toISOString(),
    team_comp: teamRows,
    opponent_comp: opponentRows,
    team_stats: {
      ...mapValorantTeamStats(teamOne, teamRows),
      duration: match.duration || null,
      match_date_text: match.match_date_text || null,
      number_of_games: normalizeExtractedNumber(match.number_of_games),
      team_grouping_needs_review: groupingNeedsReview,
      fields_needing_manual_review: extraction?.fields_needing_manual_review || [],
    },
    opponent_stats: mapValorantTeamStats(teamTwo, opponentRows),
    notes: groupingNeedsReview
      ? "Team grouping needs review. Use Swap Teams if the sides are reversed, then check each row before saving."
      : "Valorant extraction. Review each field before saving.",
    parser_status: "extracted",
    parser_confidence: normalizeExtractedNumber(extraction?.parser_confidence),
    manual_edit_required: Boolean(extraction?.manual_review_required || groupingNeedsReview),
  };
}

function mapMarvelRivalsPlayerRow(row = {}) {
  const parsedKda = parseKdaText(row.kda_text);
  return {
    team_key: row.team_key || null,
    row_color_group: row.row_color_group || null,
    hero: row.hero_confirmed || row.hero || "",
    hero_confirmed: row.hero_confirmed || row.hero || "",
    hero_id: row.hero_id || "",
    costume_name: row.costume_name || "",
    costume_id: row.costume_id || "",
    hero_guess: row.hero_guess || "",
    hero_asset_match: row.hero_asset_match || "",
    hero_asset_confidence: normalizeExtractedNumber(row.hero_asset_confidence) ?? "",
    hero_asset_method: row.hero_asset_method || "",
    asset_confidence: normalizeExtractedNumber(row.asset_confidence) ?? normalizeExtractedNumber(row.hero_asset_confidence) ?? "",
    matched_asset_src: row.matched_asset_src || "",
    needs_manual_review: Boolean(row.needs_manual_review),
    needs_hero_review: Boolean(row.needs_hero_review || row.needs_manual_review),
    player_name: row.player_name || "",
    role: row.role || "",
    k: normalizeExtractedNumber(row.kills) ?? parsedKda.k,
    d: normalizeExtractedNumber(row.deaths) ?? parsedKda.d,
    a: normalizeExtractedNumber(row.assists) ?? parsedKda.a,
    final_hits: normalizeExtractedNumber(row.final_hits) ?? "",
    damage: normalizeExtractedNumber(row.damage) ?? "",
    damage_blocked: normalizeExtractedNumber(row.damage_blocked) ?? "",
    healing: normalizeExtractedNumber(row.healing) ?? "",
    accuracy: normalizeExtractedNumber(row.accuracy_percent ?? row.accuracy) ?? "",
    hero_confidence: normalizeExtractedNumber(row.hero_confidence) ?? normalizeExtractedNumber(row.asset_confidence) ?? normalizeExtractedNumber(row.hero_asset_confidence) ?? normalizeExtractedNumber(row.hero_guess_confidence) ?? normalizeExtractedNumber(row.confidence) ?? 0,
    is_mvp: Boolean(row.is_mvp),
    is_svp: Boolean(row.is_svp),
    medals: Array.isArray(row.medals) ? row.medals : [],
    confidence: normalizeExtractedNumber(row.confidence),
  };
}

function mapMarvelRivalsTeamStats(team = {}, rows = []) {
  const totals = team.team_totals || {};
  const totalKills = normalizeExtractedNumber(totals.kills) ?? sumRows(rows, "k");
  const totalDeaths = normalizeExtractedNumber(totals.deaths) ?? sumRows(rows, "d");
  const totalAssists = normalizeExtractedNumber(totals.assists) ?? sumRows(rows, "a");
  const totalFinalHits = normalizeExtractedNumber(totals.final_hits) ?? sumRows(rows, "final_hits");
  const totalDamage = normalizeExtractedNumber(totals.damage) ?? sumRows(rows, "damage");
  const totalDamageBlocked = normalizeExtractedNumber(totals.damage_blocked) ?? sumRows(rows, "damage_blocked");
  const totalHealing = normalizeExtractedNumber(totals.healing) ?? sumRows(rows, "healing");
  const averageAccuracy = normalizeExtractedNumber(totals.average_accuracy_percent ?? totals.average_accuracy) ?? averageRows(rows, "accuracy");

  return {
    total_kills: totalKills,
    total_deaths: totalDeaths,
    total_assists: totalAssists,
    total_final_hits: totalFinalHits,
    total_damage: totalDamage,
    total_damage_blocked: totalDamageBlocked,
    total_healing: totalHealing,
    average_accuracy_percent: averageAccuracy,
    team_kills: totalKills,
    team_deaths: totalDeaths,
    team_assists: totalAssists,
    final_hits: totalFinalHits,
    damage: totalDamage,
    damage_blocked: totalDamageBlocked,
    healing: totalHealing,
    average_accuracy: averageAccuracy,
  };
}

function hasMarvelRowContent(row = {}) {
  return Boolean(
    row.player_name ||
    row.hero ||
    row.k !== "" ||
    row.d !== "" ||
    row.a !== "" ||
    row.damage !== "" ||
    row.healing !== "" ||
    row.damage_blocked !== "" ||
    row.final_hits !== "",
  );
}

function groupMarvelRivalsRows(extraction) {
  const teams = Array.isArray(extraction?.teams) ? extraction.teams : [];
  const flatRows = Array.isArray(extraction?.rows) ? extraction.rows : [];
  const teamOne = teams.find((team) => team?.team_key === "team_1") || teams[0] || {};
  const teamTwo = teams.find((team) => team?.team_key === "team_2") || teams[1] || {};
  let groupedTeamOne = (teamOne.players || []).map((row) => mapMarvelRivalsPlayerRow({ ...row, team_key: "team_1" }));
  let groupedTeamTwo = (teamTwo.players || []).map((row) => mapMarvelRivalsPlayerRow({ ...row, team_key: "team_2" }));
  const flatTeamOne = flatRows.filter((row) => row.team_key === "team_1").map((row) => mapMarvelRivalsPlayerRow(row));
  const flatTeamTwo = flatRows.filter((row) => row.team_key === "team_2").map((row) => mapMarvelRivalsPlayerRow(row));

  if (flatTeamOne.some(hasMarvelRowContent)) groupedTeamOne = flatTeamOne;
  if (flatTeamTwo.some(hasMarvelRowContent)) groupedTeamTwo = flatTeamTwo;
  if (!groupedTeamOne.length && !groupedTeamTwo.length && flatRows.length) {
    groupedTeamOne = flatRows.slice(0, 6).map((row) => mapMarvelRivalsPlayerRow({ ...row, team_key: row.team_key || "team_1" }));
    groupedTeamTwo = flatRows.slice(6, 12).map((row) => mapMarvelRivalsPlayerRow({ ...row, team_key: row.team_key || "team_2" }));
  }
  groupedTeamOne = groupedTeamOne.filter(hasMarvelRowContent);
  groupedTeamTwo = groupedTeamTwo.filter(hasMarvelRowContent);

  return {
    teamRows: groupedTeamOne,
    opponentRows: groupedTeamTwo,
    teamOne,
    teamTwo,
    groupingNeedsReview: groupedTeamOne.length !== 6 || groupedTeamTwo.length !== 6,
  };
}

function mapMarvelRivalsExtractionToReview(extraction) {
  const match = extraction?.match || {};
  const {
    teamRows,
    opponentRows,
    teamOne,
    teamTwo,
    groupingNeedsReview,
  } = groupMarvelRivalsRows(extraction);
  const normalizedResult = match.result?.toLowerCase?.();
  const mapMode = [match.map, match.objective_or_mode ?? match.mode].filter(Boolean).join(" · ");
  const heroFieldsNulled = extraction?.meta?.hero_fields_nulled || [];
  const heroReviewNeeded = heroFieldsNulled.length > 0;
  const reviewNotes = groupingNeedsReview
    ? "Team grouping needs review. Use Swap Teams if the sides are reversed, then check each row before saving."
    : heroReviewNeeded
      ? "Some hero names need review because duplicate or low-confidence portraits were detected."
      : "Marvel Rivals extraction. Review each field before saving.";

  return {
    match_result: ["victory", "defeat"].includes(normalizedResult) ? normalizedResult : "",
    final_score: formatScore(match.team_1_score, match.team_2_score) || match.final_score || "",
    team_score: normalizeExtractedNumber(match.team_1_score) ?? "",
    opponent_score: normalizeExtractedNumber(match.team_2_score) ?? "",
    opponent_name: "",
    map_or_mode: mapMode,
    played_at: match.played_at || new Date().toISOString(),
    team_comp: teamRows,
    opponent_comp: opponentRows,
    team_stats: {
      ...mapMarvelRivalsTeamStats(teamOne, teamRows),
      duration: match.duration || null,
      objective_or_mode: match.objective_or_mode ?? match.mode ?? null,
      match_date_text: match.match_date_text || null,
      bans_or_picks: extraction?.bans_or_picks || { team_1: [], team_2: [] },
      hero_fields_nulled: heroFieldsNulled,
      team_grouping_needs_review: groupingNeedsReview,
      fields_needing_manual_review: extraction?.fields_needing_manual_review || [],
    },
    opponent_stats: mapMarvelRivalsTeamStats(teamTwo, opponentRows),
    notes: reviewNotes,
    parser_status: "extracted",
    parser_confidence: normalizeExtractedNumber(extraction?.parser_confidence),
    manual_edit_required: Boolean(extraction?.manual_review_required || groupingNeedsReview || heroReviewNeeded),
  };
}

function mapDeadlockPlayerRow(row = {}) {
  const parsedKda = parseKdaText(row.kda_text);
  return {
    team_key: row.team_key || null,
    hero: row.hero || "",
    player_name: row.player_name || "",
    role: row.role || "",
    k: normalizeExtractedNumber(row.kills) ?? parsedKda.k,
    d: normalizeExtractedNumber(row.deaths) ?? parsedKda.d,
    a: normalizeExtractedNumber(row.assists) ?? parsedKda.a,
    souls: normalizeExtractedNumber(row.souls ?? row.total_souls) ?? "",
    player_damage: normalizeExtractedNumber(row.player_damage) ?? "",
    objective_damage: normalizeExtractedNumber(row.objective_damage ?? row.obj_damage) ?? "",
    healing: normalizeExtractedNumber(row.healing) ?? "",
    confidence: normalizeExtractedNumber(row.confidence),
  };
}

function mapDeadlockTeamStats(team = {}, rows = []) {
  const totals = team.team_totals || {};
  const totalKills = normalizeExtractedNumber(totals.kills) ?? sumRows(rows, "k");
  const totalDeaths = normalizeExtractedNumber(totals.deaths) ?? sumRows(rows, "d");
  const totalAssists = normalizeExtractedNumber(totals.assists) ?? sumRows(rows, "a");
  const totalSouls = normalizeExtractedNumber(totals.souls ?? totals.total_souls) ?? sumRows(rows, "souls");
  const totalPlayerDamage = normalizeExtractedNumber(totals.player_damage) ?? sumRows(rows, "player_damage");
  const totalObjectiveDamage = normalizeExtractedNumber(totals.objective_damage ?? totals.obj_damage) ?? sumRows(rows, "objective_damage");
  const totalHealing = normalizeExtractedNumber(totals.healing) ?? sumRows(rows, "healing");

  return {
    team_kills: totalKills,
    team_deaths: totalDeaths,
    team_assists: totalAssists,
    total_kills: totalKills,
    total_deaths: totalDeaths,
    total_assists: totalAssists,
    total_souls: totalSouls,
    souls: totalSouls,
    total_player_damage: totalPlayerDamage,
    player_damage: totalPlayerDamage,
    total_objective_damage: totalObjectiveDamage,
    objective_damage: totalObjectiveDamage,
    total_healing: totalHealing,
    healing: totalHealing,
  };
}

function normalizeDeadlockScore(value) {
  const score = normalizeExtractedNumber(value);
  if (score === null) return null;
  return Math.abs(score) <= 99 ? score : null;
}

function groupDeadlockRows(extraction) {
  const teams = Array.isArray(extraction?.teams) ? extraction.teams : [];
  const flatRows = Array.isArray(extraction?.rows) ? extraction.rows : [];
  const teamOne = teams.find((team) => team?.team_key === "team_1") || teams[0] || {};
  const teamTwo = teams.find((team) => team?.team_key === "team_2") || teams[1] || {};
  const teamOneRows = (teamOne.players?.length ? teamOne.players : flatRows.filter((row) => row.team_key === "team_1"))
    .map((row) => mapDeadlockPlayerRow({ ...row, team_key: "team_1" }));
  const teamTwoRows = (teamTwo.players?.length ? teamTwo.players : flatRows.filter((row) => row.team_key === "team_2"))
    .map((row) => mapDeadlockPlayerRow({ ...row, team_key: "team_2" }));

  if (teamOneRows.length || teamTwoRows.length) {
    return {
      teamRows: teamOneRows,
      opponentRows: teamTwoRows,
      teamOne,
      teamTwo,
      groupingNeedsReview: teamOneRows.length !== 6 || teamTwoRows.length !== 6,
    };
  }

  const sortedRows = flatRows
    .slice()
    .sort((first, second) => Number(first?.row_index || 0) - Number(second?.row_index || 0));

  return {
    teamRows: sortedRows.slice(0, 6).map((row) => mapDeadlockPlayerRow({ ...row, team_key: "team_1" })),
    opponentRows: sortedRows.slice(6, 12).map((row) => mapDeadlockPlayerRow({ ...row, team_key: "team_2" })),
    teamOne,
    teamTwo,
    groupingNeedsReview: true,
  };
}

function mapDeadlockExtractionToReview(extraction) {
  const match = extraction?.match || {};
  const {
    teamRows,
    opponentRows,
    teamOne,
    teamTwo,
    groupingNeedsReview,
  } = groupDeadlockRows(extraction);
  const normalizedResult = match.result?.toLowerCase?.();
  const teamOneScore = normalizeDeadlockScore(match.team_1_score ?? teamOne.team_score);
  const teamTwoScore = normalizeDeadlockScore(match.team_2_score ?? teamTwo.team_score);
  const mapOrLane = match.map_or_lane || match.map || match.lane || match.match_label || "";

  return {
    match_result: ["victory", "defeat"].includes(normalizedResult) ? normalizedResult : "",
    final_score: formatScore(teamOneScore, teamTwoScore) || "",
    team_score: teamOneScore ?? "",
    opponent_score: teamTwoScore ?? "",
    opponent_name: match.opponent_name || match.team_2_name || teamTwo.team_name || "",
    map_or_mode: mapOrLane || "Ending Match",
    played_at: match.played_at || new Date().toISOString(),
    team_comp: teamRows,
    opponent_comp: opponentRows,
    team_stats: {
      ...mapDeadlockTeamStats(teamOne, teamRows),
      duration: match.duration || null,
      map_or_lane: mapOrLane || null,
      match_id: match.match_id || null,
      team_name: match.team_1_name || teamOne.team_name || null,
      team_grouping_needs_review: groupingNeedsReview,
      fields_needing_manual_review: extraction?.fields_needing_manual_review || [],
    },
    opponent_stats: {
      ...mapDeadlockTeamStats(teamTwo, opponentRows),
      team_name: match.team_2_name || teamTwo.team_name || null,
    },
    notes: groupingNeedsReview
      ? "Deadlock team grouping needs review. Use Swap Teams if sides are reversed, then check each player column before saving."
      : "Deadlock extraction. Review each field before saving.",
    parser_status: "extracted",
    parser_confidence: normalizeExtractedNumber(extraction?.parser_confidence),
    manual_edit_required: Boolean(extraction?.manual_review_required || groupingNeedsReview),
  };
}

function resizeImageForExtraction(file) {
  const maxSide = 1600;
  const quality = 0.78;

  if (!file.type?.startsWith("image/")) return Promise.resolve(file);

  return new Promise((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

      if (scale === 1 && file.size < 1_200_000) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }

        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    image.src = objectUrl;
  });
}

function getScrimIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("scrim_id") || "";
}

function getReviewIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("review_id") || "";
}

function getReviewSeriesIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("series_id") || "";
}

function getNewReviewModeFromUrl() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("new") === "true";
}

function getReviewGameNumber(review) {
  return Number(review?.scrim_game_number || 1);
}

function isMissingGamesCountError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("games_count");
}

function isMissingReviewGameNumberError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("scrim_game_number") || error?.message?.includes("series_game_count");
}

function isMissingReviewSeriesError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("review_series_id");
}

function groupReviewsByGame(reviews) {
  return reviews.reduce((groups, review) => {
    groups.set(getReviewGameNumber(review), review);
    return groups;
  }, new Map());
}

export default function TeamDashboardPage() {
  const { id } = useParams();
  const router = useRouter();
  const [authUser, setAuthUser] = useState(null);
  const [team, setTeam] = useState(null);
  const [scrim, setScrim] = useState(null);
  const [scrimId, setScrimId] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [reviewSeriesId, setReviewSeriesId] = useState("");
  const [isStandaloneNewReview, setIsStandaloneNewReview] = useState(false);
  const [seriesGameCount, setSeriesGameCount] = useState(1);
  const [selectedGameNumber, setSelectedGameNumber] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const activeScrimId = getScrimIdFromUrl();
    const activeReviewId = getReviewIdFromUrl();
    const activeReviewSeriesId = getReviewSeriesIdFromUrl();
    const activeNewReviewMode = getNewReviewModeFromUrl() && !activeScrimId && !activeReviewId && !activeReviewSeriesId;
    setScrimId(activeScrimId);
    setReviewId(activeReviewId);
    setReviewSeriesId(activeReviewSeriesId);
    setIsStandaloneNewReview(activeNewReviewMode);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      router.push("/login");
      return;
    }
    setAuthUser(authData.user);

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, org_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError || !profile?.org_id) {
      console.error("Failed to load profile for dashboard", profileError);
      setErrorMessage("We could not load your organization.");
      setLoading(false);
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, org_id, name, game_title, mode, rank_tier, region, scrimgg_rating")
      .eq("id", id)
      .eq("org_id", profile.org_id)
      .maybeSingle();

    if (teamError) {
      console.error("Failed to load dashboard team", teamError);
      setErrorMessage("We could not load this team.");
      setLoading(false);
      return;
    }

    if (!teamData) {
      setErrorMessage("You do not have access to this team dashboard.");
      setLoading(false);
      return;
    }

    setTeam(teamData);
    const defaultMatchType = activeNewReviewMode || activeReviewId || activeReviewSeriesId ? "match" : "scrim";
    setForm(normalizeReviewForForm(createBlankReview(teamData.game_title, defaultMatchType), teamData.game_title));

    let loadedScrim = null;
    let nextSeriesGameCount = 1;

    if (activeScrimId) {
      let { data: scrimData, error: scrimError } = await supabase
        .from("scrim_requests")
        .select("id, posting_team_id, matched_team_id, game_title, games_count, status, scheduled_at")
        .eq("id", activeScrimId)
        .maybeSingle();

      if (isMissingGamesCountError(scrimError)) {
        console.warn("games_count is missing in Supabase. Series dashboard will default to one game.");
        ({ data: scrimData, error: scrimError } = await supabase
          .from("scrim_requests")
          .select("id, posting_team_id, matched_team_id, game_title, status, scheduled_at")
          .eq("id", activeScrimId)
          .maybeSingle());
      }

      if (scrimError) {
        console.error("Failed to load dashboard scrim", scrimError);
        setErrorMessage("We could not load the scrim series for this dashboard.");
        setLoading(false);
        return;
      }

      if (!scrimData || (scrimData.posting_team_id !== teamData.id && scrimData.matched_team_id !== teamData.id)) {
        setErrorMessage("This scrim is not connected to the selected team.");
        setLoading(false);
        return;
      }

      loadedScrim = scrimData;
      nextSeriesGameCount = Math.max(1, Number(scrimData.games_count || 1));
    }

    setScrim(loadedScrim);
    setSeriesGameCount(nextSeriesGameCount);

    let reviewQuery = supabase
      .from("team_match_reviews")
      .select("*")
      .eq("team_id", teamData.id)
      .order("scrim_game_number", { ascending: true })
      .order("played_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (activeScrimId) {
      reviewQuery = reviewQuery.eq("scrim_request_id", activeScrimId);
    } else if (activeReviewSeriesId) {
      reviewQuery = reviewQuery.eq("review_series_id", activeReviewSeriesId);
    } else if (activeReviewId) {
      reviewQuery = reviewQuery.eq("id", activeReviewId);
    } else if (activeNewReviewMode) {
      reviewQuery = reviewQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data: reviewData, error: reviewError } = await reviewQuery;

    if (reviewError) {
      console.error("Failed to load match reviews", reviewError);
      setErrorMessage(reviewError.message.includes("team_match_reviews") || isMissingReviewGameNumberError(reviewError) || isMissingReviewSeriesError(reviewError)
        ? "Run supabase_team_match_reviews.sql, supabase_team_match_reviews_game_number.sql, and supabase_team_match_reviews_series_id.sql in Supabase before using match review series."
        : "We could not load match reviews.");
      setReviews([]);
      setLoading(false);
      return;
    }

    const loadedReviews = reviewData || [];
    if (activeReviewId && loadedReviews.length === 0) {
      setErrorMessage("We could not find that saved match review.");
      setReviews([]);
      setLoading(false);
      return;
    }

    const selectedStandaloneReview = activeReviewId || activeReviewSeriesId ? loadedReviews[0] : null;
    if (selectedStandaloneReview) {
      nextSeriesGameCount = Math.max(1, Number(selectedStandaloneReview.series_game_count || selectedStandaloneReview.scrim_game_number || 1));
      setSeriesGameCount(nextSeriesGameCount);
      setReviewSeriesId(selectedStandaloneReview.review_series_id || activeReviewSeriesId || activeReviewId);
    }

    const reviewsByGame = groupReviewsByGame(loadedReviews);
    const firstMissingGame = Array.from({ length: nextSeriesGameCount }, (_, index) => index + 1)
      .find((gameNumber) => !reviewsByGame.has(gameNumber));
    const nextSelectedGame = selectedStandaloneReview ? getReviewGameNumber(selectedStandaloneReview) : firstMissingGame || 1;

    setReviews(loadedReviews);
    setSelectedGameNumber(nextSelectedGame);
    setForm(normalizeReviewForForm(reviewsByGame.get(nextSelectedGame) || createBlankReview(teamData.game_title, defaultMatchType), teamData.game_title));
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const isSupported = SUPPORTED_GAMES.includes(team?.game_title);
  const reviewsByGame = useMemo(() => groupReviewsByGame(reviews), [reviews]);
  const selectedReview = reviewsByGame.get(selectedGameNumber) || null;
  const savedGameCount = useMemo(() => {
    const savedGames = new Set(reviews.map((review) => getReviewGameNumber(review)));
    return savedGames.size;
  }, [reviews]);
  const seriesWins = reviews.filter((review) => review.match_result === "victory").length;
  const seriesLosses = reviews.filter((review) => review.match_result === "defeat").length;
  const seriesMargins = reviews
    .filter((review) => Number.isFinite(Number(review.team_score)) && Number.isFinite(Number(review.opponent_score)))
    .map((review) => Number(review.team_score) - Number(review.opponent_score));
  const seriesAvgMargin = seriesMargins.length
    ? (seriesMargins.reduce((sum, margin) => sum + margin, 0) / seriesMargins.length).toFixed(1)
    : "—";

  useEffect(() => {
    if (!team) return;
    const nextReview = reviewsByGame.get(selectedGameNumber);
    setForm(normalizeReviewForForm(nextReview || createBlankReview(team.game_title, isStandaloneNewReview ? "match" : "scrim"), team.game_title));
    setScreenshotPreview("");
    setSuccessMessage("");
  }, [isStandaloneNewReview, reviewsByGame, selectedGameNumber, team]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccessMessage("");
  }

  function updateStat(side, field, value) {
    setForm((current) => ({
      ...current,
      [side]: {
        ...(current[side] || {}),
        [field]: value,
      },
    }));
  }

  function updateComp(side, index, field, value) {
    setForm((current) => ({
      ...current,
      [side]: current[side].map((row, currentIndex) => currentIndex === index ? { ...row, [field]: value } : row),
    }));
  }

  async function handleScreenshotChange(event) {
    const file = event.target.files?.[0];
    if (!file || !team) return;

    const previewUrl = URL.createObjectURL(file);
    setScreenshotPreview(previewUrl);
    setExtracting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let extracted;

      if (team.game_title === "League of Legends" || team.game_title === "Valorant" || team.game_title === "Marvel Rivals" || team.game_title === "Deadlock") {
        const extractionFile = await resizeImageForExtraction(file);
        const formData = new FormData();
        formData.append("gameTitle", team.game_title);
        formData.append("image", extractionFile);
        formData.append("teamId", team.id);
        if (scrimId) formData.append("scrimRequestId", scrimId);
        formData.append("scrimGameNumber", String(selectedGameNumber));

        const response = await fetch("/api/postgame/extract", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Could not extract scoreboard data. You can still enter stats manually.");
        }

        if (team.game_title === "League of Legends") {
          extracted = mapLeagueExtractionToReview(payload.data, team.name);
        } else if (team.game_title === "Marvel Rivals") {
          extracted = mapMarvelRivalsExtractionToReview(payload.data);
          if (process.env.NODE_ENV === "development") {
            console.debug("Marvel Rivals extraction mapped", {
              rows: Array.isArray(payload.data?.rows) ? payload.data.rows.length : 0,
              ourRows: extracted.team_comp?.length || 0,
              opponentRows: extracted.opponent_comp?.length || 0,
            });
          }
        } else if (team.game_title === "Deadlock") {
          extracted = mapDeadlockExtractionToReview(payload.data);
        } else {
          extracted = mapValorantExtractionToReview(payload.data);
        }
      } else {
        extracted = await extractPostGameStats({
          gameTitle: team.game_title,
          imageFile: file,
          imageUrl: previewUrl,
        });
      }

      setForm(normalizeReviewForForm({
        ...extracted,
        scrim_game_number: selectedGameNumber,
        series_game_count: seriesGameCount,
        scrim_request_id: scrimId || null,
      }, team.game_title));
      setSuccessMessage(`Stats extracted into the Game ${selectedGameNumber} review form. Check the fields before saving.`);
    } catch (error) {
      console.warn("Post-game extraction fell back to manual entry", error);
      setErrorMessage(error.message || "We could not extract this screenshot.");
    } finally {
      setExtracting(false);
    }
  }

  function handleSwapTeams() {
    setForm((current) => ({
      ...current,
      team_comp: current.opponent_comp || [],
      opponent_comp: current.team_comp || [],
      team_stats: current.opponent_stats || {},
      opponent_stats: current.team_stats || {},
      team_score: current.opponent_score,
      opponent_score: current.team_score,
    }));
    setSuccessMessage("Teams swapped. Review the score and opponent name before saving.");
  }

  async function handleSaveReview(event) {
    event.preventDefault();
    if (!team || !authUser || !form) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const existingReview = isStandaloneNewReview ? null : reviewsByGame.get(selectedGameNumber);
    const standaloneSeriesId = scrimId ? null : (reviewSeriesId || crypto.randomUUID());
    const payload = {
      ...buildReviewPayload({ form, team, userId: authUser.id, screenshotPreview }),
      scrim_request_id: scrimId || null,
      review_series_id: standaloneSeriesId,
      scrim_game_number: selectedGameNumber,
      series_game_count: seriesGameCount,
    };

    const saveQuery = existingReview
      ? supabase.from("team_match_reviews").update(payload).eq("id", existingReview.id).select("*").single()
      : supabase.from("team_match_reviews").insert(payload).select("*").single();

    const { data: savedReview, error } = await saveQuery;

    if (error) {
      console.error("Failed to save match review", error);
      setErrorMessage(error.message.includes("team_match_reviews") || isMissingReviewGameNumberError(error) || isMissingReviewSeriesError(error)
        ? "Run supabase_team_match_reviews.sql, supabase_team_match_reviews_game_number.sql, and supabase_team_match_reviews_series_id.sql in Supabase before saving reviews."
        : error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage(`Game ${selectedGameNumber} review saved.`);
    setScreenshotPreview("");
    if (isStandaloneNewReview && savedReview?.id) {
      const nextSeriesId = savedReview.review_series_id || standaloneSeriesId;
      router.replace(`/team/${team.id}/dashboard?series_id=${nextSeriesId}`);
      setReviewId(savedReview.id);
      setReviewSeriesId(nextSeriesId);
      setIsStandaloneNewReview(false);
      setReviews([savedReview]);
      setSelectedGameNumber(getReviewGameNumber(savedReview));
      setForm(normalizeReviewForForm(savedReview, team.game_title));
    } else {
      await loadDashboard();
      setSelectedGameNumber(selectedGameNumber);
    }
    setSaving(false);
  }

  async function handleAddSeriesGame() {
    if (scrimId) {
      setErrorMessage("Booked scrim series use the number of games from the scrim listing.");
      return;
    }

    const nextGameCount = seriesGameCount + 1;
    setSeriesGameCount(nextGameCount);
    setSelectedGameNumber(nextGameCount);
    setForm(normalizeReviewForForm(createBlankReview(team.game_title, "match"), team.game_title));
    setScreenshotPreview("");
    setSuccessMessage(`Game ${nextGameCount} added. Upload a screenshot or enter stats for the new game.`);
    setErrorMessage("");

    if (!reviewSeriesId || !reviews.length) return;

    if (reviewId) {
      const { error: seedSeriesError } = await supabase
        .from("team_match_reviews")
        .update({
          review_series_id: reviewSeriesId,
          series_game_count: nextGameCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId);

      if (seedSeriesError) {
        console.error("Failed to seed standalone review series id", seedSeriesError);
        setErrorMessage(isMissingReviewSeriesError(seedSeriesError)
          ? "Run supabase_team_match_reviews_series_id.sql in Supabase before adding games to standalone match reviews."
          : "Game added locally, but we could not connect it to the saved review series yet.");
        return;
      }
    }

    const { error } = await supabase
      .from("team_match_reviews")
      .update({ series_game_count: nextGameCount, updated_at: new Date().toISOString() })
      .eq("team_id", team.id)
      .eq("review_series_id", reviewSeriesId);

    if (error) {
      console.error("Failed to update review series game count", error);
      setErrorMessage(isMissingReviewSeriesError(error)
        ? "Run supabase_team_match_reviews_series_id.sql in Supabase before adding games to standalone match reviews."
        : "Game added locally, but we could not update the saved series count yet.");
      return;
    }

    setReviews((currentReviews) => currentReviews.map((review) => ({
      ...review,
      series_game_count: nextGameCount,
    })));
  }

  function selectGame(gameNumber) {
    const boundedGame = Math.min(Math.max(gameNumber, 1), seriesGameCount);
    setSelectedGameNumber(boundedGame);
  }

  const dashboardProps = {
    errorMessage,
    extracting,
    form,
    handleAddSeriesGame,
    handleSaveReview,
    handleScreenshotChange,
    handleSwapTeams,
    reviews,
    saving,
    screenshotPreview,
    selectedGameNumber,
    selectedReview,
    seriesAvgMargin,
    seriesGameCount,
    seriesLosses,
    seriesWins,
    savedGameCount,
    isStandaloneNewReview,
    reviewId,
    reviewSeriesId,
    scrim,
    successMessage,
    team,
    updateComp,
    updateField,
    updateStat,
  };

  return (
    <>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-surface-variant bg-white/85 px-5 text-on-surface backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link className="flex h-9 w-9 items-center justify-center rounded-full text-primary hover:bg-surface-container" href={`/team?id=${id}`}>
            <MaterialSymbol>arrow_back</MaterialSymbol>
          </Link>
          <div>
            <p className="font-headline-3 text-headline-3 font-black">Matchmake</p>
            <p className="font-label-small text-label-small text-on-surface-variant">Post-game dashboard</p>
          </div>
        </div>
        <nav className="hidden items-center gap-1 md:flex">
          <Link className="px-3 py-2 font-label-bold text-label-bold text-on-surface-variant hover:bg-surface-container rounded-lg" href="/">Scrims</Link>
          <Link className="px-3 py-2 font-label-bold text-label-bold text-primary bg-primary-fixed rounded-lg" href="/org">Org</Link>
          <Link className="px-3 py-2 font-label-bold text-label-bold text-on-surface-variant hover:bg-surface-container rounded-lg" href="/requests">Requests</Link>
          <Link className="px-3 py-2 font-label-bold text-label-bold text-on-surface-variant hover:bg-surface-container rounded-lg" href="/calendar">Calendar</Link>
        </nav>
      </header>

      <main className="min-h-screen bg-background px-margin-mobile py-lg pb-28 md:px-xl">
        {loading ? (
          <div className="mx-auto max-w-[1180px] rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-lg text-on-surface-variant">
            Loading dashboard...
          </div>
        ) : errorMessage && !team ? (
          <EmptyState title="Dashboard unavailable" body={errorMessage} />
        ) : !isSupported ? (
          <EmptyState
            title="Post-game dashboard coming soon"
            body={`${team?.game_title} dashboards are not built yet.`}
          />
        ) : team.game_title === "League of Legends" ? (
          <LeagueDashboard
            {...dashboardProps}
            reviewsByGame={reviewsByGame}
            selectGame={selectGame}
          />
        ) : team.game_title === "Valorant" ? (
          <ValorantDashboard
            {...dashboardProps}
            reviewsByGame={reviewsByGame}
            selectGame={selectGame}
          />
        ) : (
          <UniversalGameDashboard
            {...dashboardProps}
            reviewsByGame={reviewsByGame}
            selectGame={selectGame}
          />
        )}
      </main>

      <BottomNav />
    </>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="mx-auto max-w-[760px] rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-xl text-center">
      <MaterialSymbol className="mx-auto mb-md block text-[44px] text-outline">query_stats</MaterialSymbol>
      <h1 className="font-headline-1 text-headline-1 text-on-surface">{title}</h1>
      <p className="mt-sm font-body-main text-body-main text-on-surface-variant">{body}</p>
    </div>
  );
}

function UploadCard({ extracting, handleScreenshotChange, screenshotPreview, title = "Upload Post-Game Screenshot" }) {
  const buttonLabel = extracting
    ? "Extracting..."
    : screenshotPreview
      ? "Change Screenshot"
      : "Upload Image";

  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-primary-fixed/30 p-md shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-md">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary">
            <MaterialSymbol className="text-[28px]">image</MaterialSymbol>
          </div>
          <div>
            <h2 className="font-headline-3 text-headline-3 text-on-surface">{title}</h2>
            <p className="font-body-sub text-body-sub text-on-surface-variant">
              {extracting ? "Extracting visible scoreboard stats..." : "Upload a screenshot, then review and save the extracted fields."}
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-lg py-sm font-label-bold text-label-bold text-on-primary">
          {buttonLabel}
          <input accept="image/*" className="hidden" disabled={extracting} onChange={handleScreenshotChange} type="file" />
        </label>
      </div>
      {screenshotPreview && (
        <div className="mt-md flex items-start gap-md rounded-xl border border-outline-variant/30 bg-white p-sm">
          <img
            alt="Post-game screenshot preview"
            className="h-28 w-44 rounded-lg object-cover sm:h-32 sm:w-56"
            src={screenshotPreview}
          />
          <div className="hidden min-w-0 py-xs sm:block">
            <p className="font-label-bold text-label-bold text-on-surface">Screenshot attached</p>
            <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
              Preview is kept compact so the review form stays close by.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function GameSeriesControl({
  handleAddSeriesGame,
  isStandaloneNewReview,
  reviewId,
  reviewSeriesId,
  reviewsByGame,
  savedGameCount,
  selectGame,
  selectedGameNumber,
  seriesAvgMargin,
  seriesGameCount,
  seriesLosses,
  seriesWins,
  scrim,
}) {
  const isStandaloneSeries = !scrim && (isStandaloneNewReview || reviewId || reviewSeriesId);

  return (
    <section className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-md">
      <div className="flex flex-col gap-md lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">
            {isStandaloneNewReview || reviewId ? "Standalone Match Review" : "Scrim Series"}
          </p>
          <h2 className="mt-xs font-headline-2 text-headline-2 text-on-surface">
            Game {selectedGameNumber} of {seriesGameCount}
          </h2>
          <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
            {isStandaloneNewReview
              ? "Add a match that happened outside the Matchmake scrim board."
              : `Series Progress: ${savedGameCount} / ${seriesGameCount} reviewed · Record: ${seriesWins}W - ${seriesLosses}L · Avg Margin: ${seriesAvgMargin}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-sm">
          <button
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-40 ${seriesGameCount === 1 ? "hidden sm:flex" : ""}`}
            disabled={selectedGameNumber === 1}
            onClick={() => selectGame(selectedGameNumber - 1)}
            type="button"
          >
            <MaterialSymbol>chevron_left</MaterialSymbol>
          </button>
          <div className="flex flex-wrap gap-xs rounded-full bg-surface-container-low p-1">
            {Array.from({ length: seriesGameCount }, (_, index) => {
              const gameNumber = index + 1;
              const review = reviewsByGame.get(gameNumber);
              const isSelected = gameNumber === selectedGameNumber;
              const statusLabel = review
                ? review.manual_edit_required
                  ? "Review"
                  : "Saved"
                : "Empty";

              return (
                <button
                  className={`inline-flex items-center gap-xs rounded-full px-md py-sm font-label-bold text-label-bold transition-colors ${
                    isSelected
                      ? "bg-primary text-on-primary"
                      : "bg-transparent text-on-surface-variant hover:bg-surface-container-lowest"
                  }`}
                  key={gameNumber}
                  onClick={() => selectGame(gameNumber)}
                  type="button"
                >
                  <span>Game {gameNumber}</span>
                  <span className={`h-2 w-2 rounded-full ${review ? "bg-[#1B5E20]" : "bg-outline"}`} />
                  <span className="hidden text-[11px] sm:inline">{statusLabel}</span>
                </button>
              );
            })}
          </div>
          <button
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-40 ${seriesGameCount === 1 ? "hidden sm:flex" : ""}`}
            disabled={selectedGameNumber === seriesGameCount}
            onClick={() => selectGame(selectedGameNumber + 1)}
            type="button"
          >
            <MaterialSymbol>chevron_right</MaterialSymbol>
          </button>
          {isStandaloneSeries && (
            <button
              className="inline-flex h-10 items-center justify-center gap-xs rounded-full bg-primary px-md font-label-bold text-label-bold text-on-primary shadow-[0_4px_14px_rgba(0,88,188,0.22)]"
              onClick={handleAddSeriesGame}
              type="button"
            >
              <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
              Add Game
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ReviewMessages({ errorMessage, successMessage }) {
  return (
    <>
      {errorMessage && (
        <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">{errorMessage}</div>
      )}
      {successMessage && (
        <div className="rounded-xl bg-[#E3F9E5] px-md py-sm font-body-sub text-body-sub text-[#1B5E20]">{successMessage}</div>
      )}
    </>
  );
}

function LeagueDashboard(props) {
  const { form, reviews, selectedReview, team } = props;
  const displayReview = form || selectedReview;
  const gameLength = displayReview?.team_stats?.game_length || "Length TBD";
  const patch = displayReview?.team_stats?.patch;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-lg">
      <GameSeriesControl {...props} />
      <UploadCard
        extracting={props.extracting}
        handleScreenshotChange={props.handleScreenshotChange}
        screenshotPreview={props.screenshotPreview}
        title={`Upload Screenshot for Game ${props.selectedGameNumber}`}
      />
      <section className="grid gap-lg lg:grid-cols-[1fr_360px]">
        <div className="space-y-lg">
          <div className="flex items-end justify-between border-b border-outline-variant/40 pb-md">
            <div>
              <div className="mb-xs flex flex-wrap items-center gap-sm">
                <ResultBadge result={displayReview?.match_result} />
                {patch && <span className="font-body-main text-body-main text-on-surface-variant">Patch {patch}</span>}
              </div>
              <h1 className="font-editorial-large text-editorial-large text-on-surface">Match Overview</h1>
              <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{team.name} • League of Legends</p>
            </div>
            <div className="text-right">
              <p className="font-headline-2 text-headline-2 text-on-surface">{gameLength}</p>
              <p className="font-body-sub text-body-sub text-on-surface-variant">{formatDate(displayReview?.played_at)}</p>
            </div>
          </div>

          <CompositionSection
            accent="bg-primary"
            game="League of Legends"
            rows={displayReview?.team_comp || []}
            title="Our Team Composition"
          />
          <CompositionSection
            accent="bg-[#d12b2b]"
            game="League of Legends"
            rows={displayReview?.opponent_comp || []}
            title="Enemy Composition"
          />
        </div>

        <LeagueComparisonPanel
          opponentName={displayReview?.opponent_name || "Opponent"}
          opponentStats={displayReview?.opponent_stats || {}}
          teamName={team.name}
          teamStats={displayReview?.team_stats || {}}
        />
      </section>

      <ReviewEditor {...props} game="League of Legends" />
      <RecentReviewsList reviews={reviews} />
    </div>
  );
}

function ValorantDashboard(props) {
  const { form, reviews, selectedReview, team } = props;
  const displayReview = form || selectedReview;
  const combinedRows = [
    ...(displayReview?.team_comp || []),
    ...(displayReview?.opponent_comp || []),
  ];
  const duration = displayReview?.team_stats?.duration;
  const matchDateText = displayReview?.team_stats?.match_date_text;
  const groupingNeedsReview = displayReview?.team_stats?.team_grouping_needs_review || displayReview?.manual_edit_required;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-lg">
      <GameSeriesControl {...props} />
      <section className="grid gap-lg lg:grid-cols-[1fr_470px]">
        <div>
          <div className="mb-sm flex flex-wrap items-center gap-sm">
            <ResultBadge result={displayReview?.match_result} />
            <span className="font-label-small text-label-small text-on-surface-variant">{displayReview?.map_or_mode || "Map TBD"}</span>
            <span className="font-label-small text-label-small text-on-surface-variant">{matchDateText || formatDate(displayReview?.played_at)}</span>
            {duration && <span className="font-label-small text-label-small text-on-surface-variant">{duration}</span>}
          </div>
          <h1 className="font-editorial-large text-[42px] font-black leading-none text-on-surface">
            {formatScore(displayReview?.team_score, displayReview?.opponent_score) || "Score TBD"}
          </h1>
          <p className="mt-sm font-body-main text-body-main text-on-surface-variant">
            {team.name} vs. {displayReview?.opponent_name || "Opponent TBD"}
          </p>
        </div>
        <UploadCard
          extracting={props.extracting}
          handleScreenshotChange={props.handleScreenshotChange}
          screenshotPreview={props.screenshotPreview}
          title={`Post-Game Screenshot · Game ${props.selectedGameNumber}`}
        />
      </section>

      {groupingNeedsReview && (
        <div className="rounded-xl border border-[#b26a00]/25 bg-[#fff4d6] px-md py-sm font-body-sub text-body-sub text-[#755400]">
          Team grouping needs review. Use Swap Teams if the sides are reversed, then check player rows before saving.
        </div>
      )}

      <CompositionSection game="Valorant" rows={displayReview?.team_comp || []} title="Team Composition" />
      <CompositionSection game="Valorant" rows={displayReview?.opponent_comp || []} title="Opponent Team Composition" opponentName={displayReview?.opponent_name} />

      <ValorantSummaryCards stats={displayReview?.team_stats || {}} />
      <PerformanceTable game="Valorant" rows={combinedRows} />

      <ReviewEditor {...props} game="Valorant" />
      <RecentReviewsList reviews={reviews} />
    </div>
  );
}

function ValorantSummaryCards({ stats }) {
  const cards = [
    { key: "total_kills", label: "Total Kills" },
    { key: "total_deaths", label: "Total Deaths" },
    { key: "total_assists", label: "Total Assists" },
    { key: "average_acs", label: "Avg Combat Score" },
    { key: "average_econ_rating", label: "Avg Econ" },
    { key: "total_first_bloods", label: "First Bloods" },
    { key: "total_plants", label: "Plants" },
    { key: "total_defuses", label: "Defuses" },
  ];

  return (
    <section>
      <div className="mb-sm flex items-center gap-sm">
        <span className="h-3 w-3 rounded-full bg-primary" />
        <h2 className="font-headline-3 text-headline-3 text-on-surface">Your Team Stats</h2>
      </div>
      <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
        {cards.map((card) => (
          <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-md" key={card.key}>
            <p className="font-label-small text-label-small text-on-surface-variant">{card.label}</p>
            <p className="mt-xs font-headline-2 text-headline-2 text-primary">{stats?.[card.key] ?? "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function UniversalGameDashboard(props) {
  const { form, reviews, selectedReview, team } = props;
  const config = getDashboardConfig(team.game_title);
  const visibleStats = POSTGAME_SCREENSHOT_STATS[team.game_title]?.visibleStats || [];
  const displayReview = form || selectedReview;
  const isMarvelRivals = team.game_title === "Marvel Rivals";
  const isDeadlock = team.game_title === "Deadlock";
  const isCompactSix = isMarvelRivals || isDeadlock;
  const headlineValue = isDeadlock
    ? displayReview?.team_stats?.duration || displayReview?.map_or_mode || "Deadlock Review"
    : formatScore(displayReview?.team_score, displayReview?.opponent_score) || "Score TBD";
  const heroReviewNeeded = isMarvelRivals && (displayReview?.team_stats?.hero_fields_nulled || []).length > 0;
  const groupingNeedsReview = (isMarvelRivals || isDeadlock) && (displayReview?.team_stats?.team_grouping_needs_review || displayReview?.manual_edit_required);
  const performanceRows = isCompactSix
    ? [...(displayReview?.team_comp || []), ...(displayReview?.opponent_comp || [])]
    : displayReview?.team_comp || [];

  return (
    <div className={`mx-auto flex max-w-[1240px] flex-col ${isCompactSix ? "gap-md" : "gap-lg"}`}>
      <GameSeriesControl {...props} />
      <section className={`grid ${isCompactSix ? "gap-md lg:grid-cols-[1fr_380px]" : "gap-lg lg:grid-cols-[1fr_440px]"}`}>
        <div className={`rounded-3xl border border-outline-variant/25 bg-surface-container-lowest ${isCompactSix ? "p-md" : "p-lg"}`}>
          <div className="mb-sm flex flex-wrap items-center gap-sm">
            <ResultBadge result={displayReview?.match_result} />
            <span className="rounded-full bg-primary-fixed px-sm py-xs font-label-small text-label-small text-on-primary-fixed">
              {team.game_title}
            </span>
            <span className="font-label-small text-label-small text-on-surface-variant">{formatDate(displayReview?.played_at)}</span>
          </div>
          <h1 className={`${isCompactSix ? "font-headline-1 text-headline-1" : "font-editorial-large text-editorial-large"} text-on-surface`}>
            {headlineValue}
          </h1>
          <p className={`${isCompactSix ? "mt-xs font-body-sub text-body-sub" : "mt-sm font-body-main text-body-main"} text-on-surface-variant`}>
            {team.name} vs. {displayReview?.opponent_name || "Opponent TBD"} · {displayReview?.map_or_mode || config.defaultMap}
          </p>
          <div className={`mt-md grid gap-sm ${isCompactSix ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
            {config.highlightStats.map((stat) => (
              <div className={`rounded-2xl bg-surface-container-low ${isCompactSix ? "p-sm" : "p-md"}`} key={stat.key}>
                <p className="font-label-small text-label-small text-on-surface-variant">{stat.label}</p>
                <p className={`${isCompactSix ? "mt-[2px] font-label-bold text-label-bold" : "mt-xs font-headline-3 text-headline-3"} text-primary`}>{getReviewStatValue(displayReview?.team_stats, stat.key) ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
        {config.screenshotUpload === false ? (
          <ManualEntryCard gameTitle={team.game_title} selectedGameNumber={props.selectedGameNumber} />
        ) : (
          <UploadCard
            extracting={props.extracting}
            handleScreenshotChange={props.handleScreenshotChange}
            screenshotPreview={props.screenshotPreview}
            title={`Upload Screenshot for Game ${props.selectedGameNumber}`}
          />
        )}
      </section>

      {(isMarvelRivals || isDeadlock) && (groupingNeedsReview || heroReviewNeeded) && (
        <div className="rounded-xl border border-[#b26a00]/25 bg-[#fff4d6] px-md py-sm font-body-sub text-body-sub text-[#755400]">
          {heroReviewNeeded
            ? "Some hero names need review because duplicate or low-confidence portraits were detected."
            : "Team grouping needs review. Use Swap Teams if the sides are reversed, then check player rows before saving."}
        </div>
      )}

      <section className={isCompactSix ? "grid gap-md" : "grid gap-lg lg:grid-cols-[1fr_360px]"}>
        <div className={isCompactSix ? "space-y-md" : "space-y-lg"}>
          <CompositionSection game={team.game_title} rows={displayReview?.team_comp || []} title={`Our ${config.compositionLabel}`} />
          <CompositionSection
            accent="bg-[#d12b2b]"
            game={team.game_title}
            opponentName={displayReview?.opponent_name}
            rows={displayReview?.opponent_comp || []}
            title={`Opponent ${config.compositionLabel}`}
          />
          <PerformanceTable game={team.game_title} rows={performanceRows} />
        </div>

        {!isCompactSix && (
          <aside className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg">
            <h2 className="font-headline-2 text-headline-2 text-on-surface">Screenshot Stats</h2>
            <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
              Matchmake stores only stats visible in each post-game screenshot, so this can become a clean database of scrim history without manual spreadsheets.
            </p>
            <div className="mt-md grid gap-sm">
              {visibleStats.map((stat) => (
                <div className="rounded-2xl bg-surface-container-low p-md" key={stat}>
                  <p className="font-body-sub text-body-sub text-on-surface">{stat}</p>
                </div>
              ))}
            </div>
          </aside>
        )}
      </section>

      {isMarvelRivals && <MarvelRivalsComparisonPanel opponentStats={displayReview?.opponent_stats || {}} teamStats={displayReview?.team_stats || {}} />}
      {isDeadlock && <DeadlockComparisonPanel opponentStats={displayReview?.opponent_stats || {}} teamStats={displayReview?.team_stats || {}} />}

      <ReviewEditor {...props} game={team.game_title} />
      <RecentReviewsList reviews={reviews} />
    </div>
  );
}

function MarvelRivalsComparisonPanel({ opponentStats, teamStats }) {
  const metrics = [
    { key: "total_kills", fallback: "team_kills", label: "Kills" },
    { key: "total_assists", fallback: "team_assists", label: "Assists" },
    { key: "total_final_hits", fallback: "final_hits", label: "Final Hits" },
    { key: "total_damage", fallback: "damage", label: "Damage" },
    { key: "total_damage_blocked", fallback: "damage_blocked", label: "Blocked" },
    { key: "total_healing", fallback: "healing", label: "Healing" },
    { key: "average_accuracy_percent", fallback: "average_accuracy", label: "Accuracy", percent: true },
  ];

  return (
    <section className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-md">
      <div className="flex flex-col gap-xs md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-headline-3 text-headline-3 text-on-surface">Team Comparison</h2>
          <p className="font-label-small text-label-small text-on-surface-variant">
            Scoreboard-visible stats only.
          </p>
        </div>
      </div>
      <div className="mt-md grid grid-cols-1 gap-sm md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const ours = teamStats?.[metric.key] ?? teamStats?.[metric.fallback];
          const theirs = opponentStats?.[metric.key] ?? opponentStats?.[metric.fallback];
          return (
            <MiniComparisonBar
              key={metric.key}
              label={metric.label}
              ours={ours}
              percent={metric.percent}
              theirs={theirs}
            />
          );
        })}
      </div>
    </section>
  );
}

function DeadlockComparisonPanel({ opponentStats, teamStats }) {
  const metrics = [
    { label: "Total Souls", ours: teamStats.total_souls ?? teamStats.souls, theirs: opponentStats.total_souls ?? opponentStats.souls },
    { label: "Player Damage", ours: teamStats.player_damage, theirs: opponentStats.player_damage },
    { label: "Objective Damage", ours: teamStats.objective_damage, theirs: opponentStats.objective_damage },
    { label: "Healing", ours: teamStats.healing, theirs: opponentStats.healing },
  ];

  return (
    <section className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-md">
      <div className="mb-md flex items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-3 text-headline-3 text-on-surface">Deadlock Team Comparison</h2>
          <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
            Souls show economy pace. Player and objective damage show how pressure converted.
          </p>
        </div>
        {teamStats.duration && (
          <span className="rounded-full bg-primary-fixed px-sm py-1 font-label-small text-label-small text-primary">
            {teamStats.duration}
          </span>
        )}
      </div>
      <div className="grid gap-sm md:grid-cols-2">
        {metrics.map((metric) => (
          <MiniComparisonBar key={metric.label} label={metric.label} ours={metric.ours} theirs={metric.theirs} />
        ))}
      </div>
    </section>
  );
}

function MiniComparisonBar({ label, ours, percent = false, theirs }) {
  const ourValue = Number(ours);
  const theirValue = Number(theirs);
  const hasValues = Number.isFinite(ourValue) && Number.isFinite(theirValue);
  const total = hasValues ? Math.max(ourValue + theirValue, 1) : 1;
  const ourWidth = hasValues ? `${Math.max(6, Math.min(94, (ourValue / total) * 100))}%` : "0%";
  const suffix = percent ? "%" : "";

  return (
    <div className="rounded-xl bg-surface-container-low p-sm">
      <div className="mb-sm flex items-center justify-between gap-sm">
        <p className="font-label-bold text-label-bold text-on-surface">{label}</p>
        <p className="font-label-small text-label-small text-on-surface-variant">
          <span className="font-label-bold text-primary">{hasValues ? `${formatLargeStat(ourValue)}${suffix}` : "—"}</span>
          <span className="mx-xs">vs</span>
          <span className="font-label-bold text-[#d12b2b]">{hasValues ? `${formatLargeStat(theirValue)}${suffix}` : "—"}</span>
        </p>
      </div>
      <div className="overflow-hidden rounded-full bg-[#f4cccc]">
        <div className="h-2 rounded-full bg-primary" style={{ width: ourWidth }} />
      </div>
    </div>
  );
}

function ManualEntryCard({ gameTitle, selectedGameNumber }) {
  return (
    <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container text-primary">
          <MaterialSymbol className="text-[28px]">edit_note</MaterialSymbol>
        </div>
        <div>
          <h2 className="font-headline-3 text-headline-3 text-on-surface">Manual Review Entry · Game {selectedGameNumber}</h2>
          <p className="font-body-sub text-body-sub text-on-surface-variant">
            {gameTitle} reviews are entered manually for now. Fill in the review fields below after the set.
          </p>
        </div>
      </div>
    </section>
  );
}

function ResultBadge({ result }) {
  const isWin = result === "victory";
  return (
    <span className={`rounded-md px-3 py-1 font-label-bold text-label-bold uppercase ${isWin ? "bg-primary text-on-primary" : "bg-error-container text-on-error-container"}`}>
      {isWin ? "Victory" : result || "Result TBD"}
    </span>
  );
}

const LEAGUE_CHAMPION_FILE_ALIASES = {
  "aurelionsol": "AurelionSol",
  "belveth": "Belveth",
  "chogath": "Chogath",
  "drmundo": "DrMundo",
  "jarvaniv": "JarvanIV",
  "kaisa": "Kaisa",
  "khazix": "Khazix",
  "kogmaw": "KogMaw",
  "ksante": "KSante",
  "leesin": "LeeSin",
  "masteryi": "MasterYi",
  "missfortune": "MissFortune",
  "monkeyking": "MonkeyKing",
  "nunuandwillump": "Nunu",
  "reksai": "RekSai",
  "renataglasc": "Renata",
  "tahmkench": "TahmKench",
  "twistedfate": "TwistedFate",
  "velkoz": "Velkoz",
  "wukong": "MonkeyKing",
  "xinzhao": "XinZhao",
};

function normalizeChampionKey(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toChampionFileStem(name = "") {
  const key = normalizeChampionKey(name);
  if (!key) return "";
  if (LEAGUE_CHAMPION_FILE_ALIASES[key]) return LEAGUE_CHAMPION_FILE_ALIASES[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function getChampionImagePath(game, pick) {
  if (game !== "League of Legends" || !pick) return "";
  return `/lol/champions/${toChampionFileStem(pick)}.png`;
}

const VALORANT_AGENT_FILE_ALIASES = {
  kayo: "kayo",
  "kay/o": "kayo",
};

function toAgentFileStem(name = "") {
  const key = name.toLowerCase().replace(/[^a-z0-9/]/g, "");
  if (!key) return "";
  return VALORANT_AGENT_FILE_ALIASES[key] || key.replace(/\//g, "");
}

function getAgentImagePath(game, pick) {
  if (game !== "Valorant" || !pick) return "";
  return `/valorant/agents/${toAgentFileStem(pick)}.png`;
}

const MARVEL_HERO_FILE_ALIASES = {
  blackcat: "black_cat",
  cloakdagger: "cloak-and-dagger",
  cloakanddagger: "cloak-and-dagger",
  doctorstrange: "doctor-strange",
  elsabloodstone: "elsa_bloodstone",
  humantorch: "human-torch",
  invisiblewoman: "invisible-woman",
  ironfist: "iron-fist",
  ironman: "iron-man",
  jeff: "jeff-the-land-shark",
  jeffthelandshark: "jeff-the-land-shark",
  misterfantastic: "mister-fantastic",
  moonknight: "moon-knight",
  peniparker: "peni-parker",
  rocket: "rocket-raccoon",
  rocketraccoon: "rocket-raccoon",
  scarletwitch: "scarlet-witch",
  spiderman: "spider-man",
  starlord: "star-lord",
  thepunisher: "the-punisher",
  thething: "the-thing",
  whitefox: "white_fox",
  wintersoldier: "winter-soldier",
};

function toMarvelHeroFileStem(name = "") {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return "";
  return MARVEL_HERO_FILE_ALIASES[key] || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getMarvelHeroImagePath(game, pick) {
  if (game !== "Marvel Rivals" || !pick) return "";
  return `/marvel-rivals/heroes/${toMarvelHeroFileStem(pick)}_avatar.png`;
}

const DEADLOCK_HERO_FILE_ALIASES = {
  graytalon: "grey-talon",
  greytalon: "grey-talon",
  ladygeist: "lady-geist",
  mcginnis: "mcginnis",
  moandkrill: "mo-krill",
  mokrill: "mo-krill",
  theboss: "the-boss",
  thedoorman: "the-doorman",
};

function toDeadlockHeroFileStem(name = "") {
  const key = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  if (!key) return "";
  return DEADLOCK_HERO_FILE_ALIASES[key] || name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getDeadlockHeroImagePath(game, pick) {
  if (game !== "Deadlock" || !pick) return "";
  return `/deadlock/heroes/${toDeadlockHeroFileStem(pick)}.png`;
}

function CharacterTile({ game, row, index }) {
  const [imageFailed, setImageFailed] = useState(false);
  const config = getDashboardConfig(game);
  const isMarvelRivals = game === "Marvel Rivals";
  const isDeadlock = game === "Deadlock";
  const isCompactSix = isMarvelRivals || isDeadlock;
  const pick = row.hero_confirmed || row[config.pickField] || row.agent || row.champion || row.hero || row.character || row.car;
  const subtitle = isMarvelRivals && row.costume_name ? row.costume_name : row.role || config.pickLabel;
  const stat = formatCardStats(row, config);
  const imagePath = getChampionImagePath(game, pick) || getAgentImagePath(game, pick) || getMarvelHeroImagePath(game, pick) || getDeadlockHeroImagePath(game, pick);
  const showImage = Boolean(imagePath && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [imagePath]);

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-lowest shadow-[0_8px_22px_rgba(0,0,0,0.04)]">
      <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#ecf2ff] to-[#dfe7f7] px-md text-center ${isCompactSix ? "h-24" : "h-36"}`}>
        {showImage && (
          <img
            alt={pick}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageFailed(true)}
            src={imagePath}
          />
        )}
        {showImage && isMarvelRivals ? (
          <span className="absolute bottom-xs left-xs right-xs z-10 truncate rounded-lg bg-black/55 px-xs py-1 font-label-small text-[10px] text-white backdrop-blur-sm">
            {pick}
          </span>
        ) : showImage ? (
          <span className="absolute left-sm top-sm z-10 rounded-full bg-black/55 px-sm py-1 font-label-small text-label-small text-white backdrop-blur-sm">
            {subtitle || "Role TBD"}
          </span>
        ) : (
          <div className="relative z-10 rounded-xl px-sm py-xs">
            <p className={`${isCompactSix ? "font-label-bold text-label-bold" : "font-headline-2 text-headline-2"} text-on-surface`}>{pick || (isCompactSix ? "—" : `${config.pickLabel} TBD`)}</p>
            {!isCompactSix && <p className="mt-xs font-label-small text-label-small text-on-surface-variant">{subtitle || "Role TBD"}</p>}
          </div>
        )}
      </div>
      <div className={isCompactSix ? "p-sm" : "p-md"}>
        <p className="font-label-bold text-label-bold text-on-surface">{row.player_name || "Player TBD"}</p>
        <p className={`mt-xs font-label-small text-label-small text-on-surface-variant ${isCompactSix ? "line-clamp-2" : ""}`}>{stat}</p>
      </div>
    </div>
  );
}

function formatStatValue(row, key) {
  if (key === "kda") return `${row.k ?? "—"}/${row.d ?? "—"}/${row.a ?? "—"}`;
  const value = row[key];
  if (value === null || value === undefined || value === "") return "—";
  if (key === "hs_percent" || key === "accuracy") return `${value}%`;
  return value;
}

function formatCardStats(row, config) {
  return config.cardStats
    .map((stat) => `${stat.label} ${formatStatValue(row, stat.key)}`)
    .join(" · ");
}

function CompositionSection({ accent = "bg-primary", game, opponentName, rows, title }) {
  const isMarvelRivals = game === "Marvel Rivals";
  const isDeadlock = game === "Deadlock";
  const isCompactSix = isMarvelRivals || isDeadlock;

  return (
    <section>
      <div className={`${isCompactSix ? "mb-sm" : "mb-md"} flex items-center justify-between`}>
        <h2 className={`flex items-center gap-sm text-on-surface ${isCompactSix ? "font-headline-3 text-headline-3" : "font-headline-2 text-headline-2"}`}>
          <span className={`${isCompactSix ? "h-6" : "h-8"} w-1 rounded-full ${accent}`} />
          {title}
        </h2>
        {opponentName && <span className="font-label-small text-label-small uppercase tracking-wider text-on-surface-variant">{opponentName}</span>}
      </div>
      <div className={isCompactSix ? "grid grid-cols-2 gap-sm md:grid-cols-3 xl:grid-cols-6" : "grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-5"}>
        {rows.map((row, index) => <CharacterTile game={game} index={index} key={`${row.player_name}-${index}`} row={row} />)}
      </div>
    </section>
  );
}

function LeagueComparisonPanel({ opponentName, opponentStats, teamName, teamStats }) {
  const comparisons = [
    {
      label: "Damage",
      left: teamStats.total_damage_to_champions,
      right: opponentStats.total_damage_to_champions,
      icon: "swords",
      helper: "Pressure created in fights",
    },
    {
      label: "Gold",
      left: teamStats.total_gold,
      right: opponentStats.total_gold,
      icon: "paid",
      helper: "Resource lead across the map",
    },
  ];

  return (
    <aside className="flex min-h-full flex-col rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-lg shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
      <div>
        <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">Review Snapshot</p>
        <h2 className="mt-xs font-headline-2 text-headline-2 text-on-surface">Team Comparison</h2>
        <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
          Quick read on who controlled fights and economy.
        </p>
      </div>

      <div className="mt-lg grid flex-1 content-start gap-md">
        {comparisons.map((comparison) => (
          <ComparisonMetricCard
            key={comparison.label}
            {...comparison}
            leftLabel={teamName}
            rightLabel={opponentName}
          />
        ))}
      </div>
    </aside>
  );
}

function formatLargeStat(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US").format(number);
}

function ComparisonMetricCard({ helper, icon, label, left, leftLabel, right, rightLabel }) {
  const leftValue = Number(left) || 0;
  const rightValue = Number(right) || 0;
  const total = leftValue + rightValue;
  const leftPercent = total ? (leftValue / total) * 100 : 50;
  const leader = leftValue === rightValue ? "Even" : leftValue > rightValue ? "Your edge" : "Opponent edge";
  const diff = Math.abs(leftValue - rightValue);

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-md">
      <div className="flex items-start justify-between gap-md">
        <div>
          <div className="flex items-center gap-xs">
            <MaterialSymbol className="text-[19px] text-primary">{icon}</MaterialSymbol>
            <h3 className="font-headline-3 text-headline-3 text-on-surface">{label}</h3>
          </div>
          <p className="mt-xs font-label-small text-label-small text-on-surface-variant">{helper}</p>
        </div>
        <span className={`rounded-full px-sm py-1 font-label-small text-label-small ${leftValue >= rightValue ? "bg-primary-fixed text-on-primary-fixed" : "bg-error-container text-on-error-container"}`}>
          {leader}
        </span>
      </div>

      <div className="mt-md grid grid-cols-2 gap-sm">
        <div className="rounded-xl bg-surface-container-lowest p-sm">
          <p className="truncate font-label-small text-label-small text-on-surface-variant">{leftLabel}</p>
          <p className="mt-xs font-headline-2 text-headline-2 text-primary">{formatLargeStat(left)}</p>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-sm text-right">
          <p className="truncate font-label-small text-label-small text-on-surface-variant">{rightLabel}</p>
          <p className="mt-xs font-headline-2 text-headline-2 text-[#d12b2b]">{formatLargeStat(right)}</p>
        </div>
      </div>

      <div className="mt-md overflow-hidden rounded-full bg-[#f4cccc]">
        <div className="h-4 rounded-full bg-primary transition-all" style={{ width: `${Math.max(6, Math.min(94, leftPercent))}%` }} />
      </div>
      <div className="mt-xs flex justify-between font-label-small text-label-small text-on-surface-variant">
        <span>{Math.round(leftPercent)}%</span>
        <span>{diff ? `${formatLargeStat(diff)} difference` : "Even"}</span>
        <span>{Math.round(100 - leftPercent)}%</span>
      </div>
    </div>
  );
}

function PerformanceTable({ game = "Valorant", rows }) {
  const config = getDashboardConfig(game);
  const usesTeamTint = game === "Valorant" || game === "Marvel Rivals" || game === "Deadlock";
  const expectedTeamSize = game === "Marvel Rivals" || game === "Deadlock" ? 6 : 5;

  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-lowest">
      <div className="border-b border-outline-variant/20 p-md">
        <h2 className="font-headline-3 text-headline-3 text-on-surface">Performance Breakdown</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead className="bg-surface-container-lowest font-label-small text-label-small uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="p-md">Player</th>
              <th>{config.pickLabel}</th>
              {config.tableFields.map((field) => <th key={field.key}>{field.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isOpponent = usesTeamTint && (row.team_key === "team_2" || index >= expectedTeamSize);
              const rowTone = usesTeamTint
                ? isOpponent
                  ? "border-l-4 border-l-[#d12b2b] bg-[#fff1f1] hover:bg-[#ffe7e7]"
                  : "border-l-4 border-l-primary bg-[#eef5ff] hover:bg-[#e4efff]"
                : "border-t border-outline-variant/15";
              const statTone = usesTeamTint && isOpponent ? "text-[#b3261e]" : "text-primary";

              return (
                <tr className={`border-t border-outline-variant/15 transition-colors ${rowTone}`} key={`${row.player_name}-${index}`}>
                  <td className="p-md font-label-bold text-label-bold">{row.player_name || "Player TBD"}</td>
                  <td>{game === "Marvel Rivals" ? row.hero_confirmed || row[config.pickField] || "—" : row[config.pickField] || row.role || "—"}</td>
                  {config.tableFields.map((field, fieldIndex) => (
                    <td className={fieldIndex === 0 ? `font-label-bold ${statTone}` : ""} key={field.key}>
                      {formatStatValue(row, field.key)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HighlightCard({ compact = false, label, tone = "blue", value }) {
  const toneClass = tone === "orange" ? "text-[#c65300]" : tone === "red" ? "text-[#ba1a1a]" : "text-primary";
  return (
    <div className={`rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-lg ${compact ? "text-center" : "bg-primary text-on-primary"}`}>
      <p className={`font-label-small text-label-small ${compact ? "text-on-surface-variant" : "text-on-primary"}`}>{label}</p>
      <p className={`mt-sm font-editorial-large text-editorial-large ${compact ? toneClass : "text-on-primary"}`}>{value}</p>
    </div>
  );
}

function ReviewEditor({
  errorMessage,
  form,
  handleSwapTeams,
  game,
  handleSaveReview,
  saving,
  selectedGameNumber,
  selectedReview,
  successMessage,
  updateComp,
  updateField,
  updateStat,
}) {
  const config = getDashboardConfig(game);
  const primaryHighlight = config.highlightStats[0];
  const showScoreInputs = !isStatFirstGame(game);

  return (
    <form className="grid gap-lg rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg" onSubmit={handleSaveReview}>
      <div>
        <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-headline-2 text-headline-2 text-on-surface">Review & Edit Extracted Data</h2>
            <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
              {selectedReview
                ? `Editing saved review for Game ${selectedGameNumber}.`
                : `No review saved for Game ${selectedGameNumber} yet. Upload a screenshot or enter stats manually for this game.`}
            </p>
          </div>
          {(game === "League of Legends" || game === "Valorant" || game === "Marvel Rivals" || game === "Deadlock") && (
            <button
              className="inline-flex items-center justify-center gap-xs rounded-xl bg-surface-container px-md py-sm font-label-bold text-label-bold text-primary hover:bg-primary-fixed"
              onClick={handleSwapTeams}
              type="button"
            >
              <MaterialSymbol className="text-[18px]">swap_horiz</MaterialSymbol>
              Swap Teams
            </button>
          )}
        </div>
      </div>
      <ReviewMessages errorMessage={errorMessage} successMessage={successMessage} />
      <div className="grid grid-cols-1 gap-md md:grid-cols-4">
        <SelectInput label="Review Type" onChange={(value) => updateField("match_type", value)} value={form.match_type || "scrim"} options={["scrim", "match"]} />
        <SelectInput label="Result" onChange={(value) => updateField("match_result", value)} value={form.match_result} options={["victory", "defeat"]} />
        {showScoreInputs && (
          <>
            <TextInput label={game === "League of Legends" ? "Our Kills" : "Our Score"} onChange={(value) => updateField("team_score", value)} type="number" value={form.team_score} />
            <TextInput label={game === "League of Legends" ? "Opponent Kills" : "Opponent Score"} onChange={(value) => updateField("opponent_score", value)} type="number" value={form.opponent_score} />
          </>
        )}
        {game !== "League of Legends" && (
          <TextInput label={config.mapLabel} onChange={(value) => updateField("map_or_mode", value)} value={form.map_or_mode || ""} />
        )}
        {game === "Marvel Rivals" && (
          <TextInput
            label="Objective / Mode"
            onChange={(value) => updateStat("team_stats", "objective_or_mode", value)}
            value={form.team_stats?.objective_or_mode || ""}
          />
        )}
        {(game === "Valorant" || game === "Marvel Rivals" || game === "Deadlock") && (
          <TextInput
            label="Duration"
            onChange={(value) => updateStat("team_stats", "duration", value)}
            value={form.team_stats?.duration || ""}
          />
        )}
        <TextInput label="Opponent" onChange={(value) => updateField("opponent_name", value)} value={form.opponent_name || ""} />
        <TextInput label="Played At" onChange={(value) => updateField("played_at", value)} type="datetime-local" value={form.played_at || ""} />
        <TextInput
          label={primaryHighlight?.label || "Primary Stat"}
          onChange={(value) => updateStat("team_stats", primaryHighlight?.key || "primary_stat", value)}
          value={form.team_stats?.[primaryHighlight?.key] || ""}
        />
      </div>

      <EditableRows game={game} rows={form.team_comp} side="team_comp" title="Our Rows" updateComp={updateComp} />
      <EditableRows game={game} rows={form.opponent_comp} side="opponent_comp" title="Opponent Rows" updateComp={updateComp} />

      <label className="grid gap-xs">
        <span className="font-label-bold text-label-bold text-on-surface-variant">Notes</span>
        <textarea
          className="min-h-[120px] resize-none rounded-xl border-none bg-surface-container-low p-md font-body-main text-body-main text-on-surface focus:ring-2 focus:ring-primary"
          onChange={(event) => updateField("notes", event.target.value)}
          value={form.notes || ""}
        />
      </label>

      <button className="rounded-xl bg-primary px-lg py-md font-headline-3 text-headline-3 text-on-primary disabled:opacity-60" disabled={saving} type="submit">
        {saving ? "Saving Review..." : selectedReview ? `Update Game ${selectedGameNumber} Review` : `Save Game ${selectedGameNumber} Review`}
      </button>
    </form>
  );
}

function EditableRows({ game, rows, side, title, updateComp }) {
  const config = getDashboardConfig(game);
  const pickField = config.pickField;
  const statFields = config.editFields;
  const canEditRole = game === "League of Legends";
  const usesHeroDropdown = game === "Marvel Rivals";
  const gridClass = getReviewEditorGridClass(canEditRole, statFields.length);
  const columnLabels = [
    "Player",
    ...(canEditRole ? ["Role"] : []),
    config.pickLabel,
    ...statFields.map(formatFieldLabel),
  ];

  return (
    <section>
      <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">{title}</h3>
      <div className="grid gap-sm">
        <div className={`hidden grid-cols-1 gap-xs px-sm font-label-small text-label-small uppercase tracking-wide text-on-surface-variant md:grid ${gridClass}`}>
          {columnLabels.map((label) => (
            <span className="truncate" key={label}>{label}</span>
          ))}
        </div>
        {rows.map((row, index) => (
          <div className={`grid grid-cols-1 gap-xs rounded-xl bg-surface-container-low p-sm ${gridClass}`} key={`${side}-${index}`}>
            <input className={smallInputClass()} onChange={(event) => updateComp(side, index, "player_name", event.target.value)} placeholder="Player" value={row.player_name || ""} />
            {canEditRole && (
              <select
                className={smallInputClass()}
                onChange={(event) => updateComp(side, index, "role", event.target.value)}
                value={row.role || ""}
              >
                <option value="">Role</option>
                {config.roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            )}
            {usesHeroDropdown ? (
              <div className="grid gap-1">
                <select
                  className={smallInputClass()}
                  onChange={(event) => {
                    const selectedHero = event.target.value;
                    updateComp(side, index, pickField, selectedHero);
                    updateComp(side, index, "hero_confirmed", selectedHero);
                    updateComp(side, index, "needs_manual_review", false);
                    updateComp(side, index, "needs_hero_review", false);
                    if (selectedHero !== row.hero_asset_match) {
                      updateComp(side, index, "hero_id", "");
                      updateComp(side, index, "costume_name", "");
                      updateComp(side, index, "costume_id", "");
                      updateComp(side, index, "asset_confidence", "");
                      updateComp(side, index, "matched_asset_src", "");
                    }
                  }}
                  value={row.hero_confirmed || row[pickField] || ""}
                >
                  <option value="">Select hero</option>
                  {MARVEL_RIVALS_HERO_OPTIONS.map((hero) => (
                    <option key={hero} value={hero}>{hero}</option>
                  ))}
                </select>
                {row.hero_asset_match && (
                  <span className="truncate font-label-small text-[10px] text-on-surface-variant">
                    Matched: {row.hero_asset_match}{row.costume_name ? ` / ${row.costume_name}` : ""} · {Math.round(Number(row.asset_confidence || row.hero_asset_confidence || 0) * 100)}%
                  </span>
                )}
                {!row.hero_asset_match && row.hero_confirmed && row.hero_guess_confidence !== "" && (
                  <span className="truncate font-label-small text-[10px] text-on-surface-variant">
                    AI confidence: {Math.round(Number(row.hero_guess_confidence || row.hero_confidence || 0) * 100)}%
                  </span>
                )}
              </div>
            ) : (
              <input className={smallInputClass()} onChange={(event) => updateComp(side, index, pickField, event.target.value)} placeholder={config.pickLabel} value={row[pickField] || ""} />
            )}
            {statFields.map((field) => (
              <input
                className={smallInputClass()}
                key={field}
                onChange={(event) => updateComp(side, index, field, event.target.value)}
                placeholder={field.toUpperCase()}
                value={row[field] ?? ""}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatFieldLabel(field) {
  const labels = {
    k: "K",
    d: "D",
    a: "A",
    hs_percent: "HS%",
    damage_to_champions: "Damage",
    damage_taken: "Taken",
    damage_dealt: "Dealt",
    self_destructs: "SDs",
    stocks_remaining: "Stocks",
    player_damage: "Player Dmg",
    objective_damage: "Obj Dmg",
    damage_blocked: "Blocked",
    final_hits: "Final Hits",
    accuracy: "Acc%",
  };

  return labels[field] || field.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getReviewEditorGridClass(canEditRole, statFieldCount) {
  if (canEditRole) return "md:grid-cols-[1fr_120px_1fr_repeat(6,80px)]";
  if (statFieldCount >= 8) return "md:grid-cols-[1fr_1fr_repeat(8,80px)]";
  if (statFieldCount >= 7) return "md:grid-cols-[1fr_1fr_repeat(7,80px)]";
  return "md:grid-cols-[1fr_1fr_repeat(6,80px)]";
}

function smallInputClass() {
  return "min-w-0 rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-label-small text-label-small text-on-surface focus:ring-2 focus:ring-primary";
}

function TextInput({ label, onChange, type = "text", value }) {
  return (
    <label className="grid gap-xs">
      <span className="font-label-bold text-label-bold text-on-surface-variant">{label}</span>
      <input className="rounded-xl border-none bg-surface-container-low px-md py-sm font-body-main text-body-main text-on-surface focus:ring-2 focus:ring-primary" onChange={(event) => onChange(event.target.value)} type={type} value={value ?? ""} />
    </label>
  );
}

function SelectInput({ label, onChange, options, value }) {
  return (
    <label className="grid gap-xs">
      <span className="font-label-bold text-label-bold text-on-surface-variant">{label}</span>
      <select className="rounded-xl border-none bg-surface-container-low px-md py-sm font-body-main text-body-main text-on-surface focus:ring-2 focus:ring-primary" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option} value={option}>{option.replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>)}
      </select>
    </label>
  );
}

function RecentReviewsList({ reviews }) {
  return (
    <section className="rounded-3xl border border-outline-variant/25 bg-surface-container-lowest p-lg">
      <h2 className="font-headline-2 text-headline-2 text-on-surface">Recent Reviews</h2>
      {reviews.length === 0 ? (
        <div className="mt-md rounded-xl border border-dashed border-outline-variant p-lg text-center text-on-surface-variant">
          No post-game reviews yet. Upload a screenshot or enter stats manually to start tracking this team.
        </div>
      ) : (
        <div className="mt-md grid gap-sm">
          {reviews.slice(0, 6).map((review) => (
            <div className="flex flex-col gap-sm rounded-xl bg-surface-container-low p-md sm:flex-row sm:items-center sm:justify-between" key={review.id}>
              <div>
                <p className="font-label-bold text-label-bold text-on-surface">
                  Game {getReviewGameNumber(review)} · {isStatFirstGame(review.game_title) ? review.team_stats?.duration || review.map_or_mode || "Deadlock Review" : formatScore(review.team_score, review.opponent_score) || "Score TBD"} vs {review.opponent_name || "Opponent"}
                </p>
                <p className="font-label-small text-label-small text-on-surface-variant">
                  {(review.match_type || "scrim").replace(/\b\w/g, (letter) => letter.toUpperCase())} review • {review.game_title === "League of Legends" ? "League of Legends" : review.map_or_mode || "Mode TBD"} • {formatDate(review.played_at || review.created_at)}
                </p>
              </div>
              <ResultBadge result={review.match_result} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
