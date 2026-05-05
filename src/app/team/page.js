"use client";

/* eslint-disable @next/next/no-img-element */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { supabase } from "@/lib/supabase";
import { getDefaultRankForGame, getDisplayModeForTeam, getRanksForGame } from "@/lib/game-options";

const SCRIM_DURATION_HOURS = 3;
const STATS_TIMELINE_OPTIONS = [
  { label: "Last 5", value: "last5", limit: 5 },
  { label: "Last 20", value: "last20", limit: 20 },
  { label: "All time", value: "all", limit: null },
];
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

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getScrimEndAt(value) {
  if (!value) return null;
  const endAt = new Date(value);
  if (Number.isNaN(endAt.getTime())) return null;
  endAt.setHours(endAt.getHours() + SCRIM_DURATION_HOURS);
  return endAt;
}

function isPastScrim(scrim) {
  if (scrim.status === "completed") return true;
  if (["cancelled", "declined", "expired"].includes(scrim.status)) return true;
  const endAt = getScrimEndAt(scrim.scheduled_at);
  return endAt ? endAt < new Date() : false;
}

function formatDateTime(value) {
  if (!value) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatGameCount(value) {
  const count = Number(value || 3);
  return `${count} ${count === 1 ? "Game" : "Games"}`;
}

function isMissingRosterNamesError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("roster_names") || error?.message?.includes("roster_profiles");
}

function isMissingGamesCountError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("games_count");
}

function isMissingMatchReviewsError(error) {
  return error?.code === "42P01" || error?.code === "PGRST205" || error?.message?.includes("team_match_reviews");
}

function createRosterPlayer(gameTitle, name = "") {
  return {
    name,
    rank: getDefaultRankForGame(gameTitle),
    profile_url: "",
  };
}

function getValidRosterRank(gameTitle, rank) {
  const ranks = getRanksForGame(gameTitle);
  return ranks.includes(rank) ? rank : getDefaultRankForGame(gameTitle);
}

function normalizeRosterProfiles(team) {
  if (!team) return [];

  if (Array.isArray(team.roster_profiles) && team.roster_profiles.length > 0) {
    return team.roster_profiles.map((player) => ({
      name: player?.name || "",
      rank: getValidRosterRank(team.game_title, player?.rank),
      profile_url: player?.profile_url || "",
    }));
  }

  return (team.roster_names || []).map((name) => ({
    name,
    rank: getValidRosterRank(team.game_title),
    profile_url: "",
  }));
}

function EmptyState({ icon, title, body, action }) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-lg text-center">
      <MaterialSymbol className="mx-auto mb-sm block text-[36px] text-outline">{icon}</MaterialSymbol>
      <h2 className="font-headline-3 text-headline-3 text-on-surface">{title}</h2>
      <p className="mx-auto mt-xs max-w-md font-body-sub text-body-sub text-on-surface-variant">{body}</p>
      {action && <div className="mt-md">{action}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    open: "bg-primary-fixed text-on-primary-fixed",
    pending: "bg-[#fff0c2] text-[#755400]",
    confirmed: "bg-[#E3F9E5] text-[#1B5E20]",
    completed: "bg-surface-container-high text-on-surface-variant",
    cancelled: "bg-error-container text-on-error-container",
  };

  return (
    <span className={`rounded-full px-3 py-1 font-label-small text-label-small capitalize ${styles[status] || "bg-surface-container-high text-on-surface-variant"}`}>
      {status || "scheduled"}
    </span>
  );
}

function formatSignedAverage(values, { decimals = 1 } = {}) {
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

function normalizeExtractedNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, "").replace("%", ""));
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

function calculateReviewKpis(reviews, gameTitle) {
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

  const mostUsed = [...pickCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const bestMap = [...mapCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

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

export default function TeamPage() {
  return (
    <Suspense fallback={<TeamPageShell><div className="rounded-xl bg-surface-container-lowest p-lg font-body-main text-body-main text-on-surface-variant">Loading team...</div></TeamPageShell>}>
      <TeamPageContent />
    </Suspense>
  );
}

function TeamPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTeamId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(requestedTeamId || "");
  const [organization, setOrganization] = useState(null);
  const [scrims, setScrims] = useState([]);
  const [matchReviews, setMatchReviews] = useState([]);
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState(() => createRosterPlayer("Valorant"));
  const [rosterError, setRosterError] = useState("");
  const [rosterSuccess, setRosterSuccess] = useState("");
  const [savingRoster, setSavingRoster] = useState(false);
  const [hasRosterProfilesColumn, setHasRosterProfilesColumn] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingTeam, setDeletingTeam] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || teams[0] || null,
    [selectedTeamId, teams]
  );

  const selectedTeamScrims = useMemo(() => {
    if (!selectedTeam) return [];
    return scrims.filter(
      (scrim) => scrim.posting_team_id === selectedTeam.id || scrim.matched_team_id === selectedTeam.id
    );
  }, [scrims, selectedTeam]);

  const upcomingScrims = useMemo(
    () => selectedTeamScrims
      .filter((scrim) => !isPastScrim(scrim))
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
    [selectedTeamScrims]
  );

  const previousScrims = useMemo(
    () => selectedTeamScrims
      .filter((scrim) => isPastScrim(scrim))
      .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)),
    [selectedTeamScrims]
  );

  const selectedTeamReviews = useMemo(() => {
    if (!selectedTeam) return [];
    return matchReviews.filter((review) => review.team_id === selectedTeam.id);
  }, [matchReviews, selectedTeam]);

  const gameHistoryItems = useMemo(() => {
    if (!selectedTeam) return [];

    const items = previousScrims.map((scrim) => ({
      kind: "scrim",
      id: scrim.id,
      date: scrim.scheduled_at || scrim.created_at,
      scrim,
    }));
    const scrimIds = new Set(previousScrims.map((scrim) => scrim.id));
    const standaloneSeries = new Map();

    for (const review of selectedTeamReviews) {
      if (review.scrim_request_id && scrimIds.has(review.scrim_request_id)) continue;

      const seriesKey = review.review_series_id || review.id;
      const existing = standaloneSeries.get(seriesKey);
      const nextReviews = [...(existing?.reviews || []), review]
        .sort((first, second) => Number(first.scrim_game_number || 1) - Number(second.scrim_game_number || 1));

      standaloneSeries.set(seriesKey, {
        kind: "review",
        id: seriesKey,
        date: review.played_at || review.created_at,
        review: existing?.review || review,
        reviews: nextReviews,
      });
    }

    return [...items, ...standaloneSeries.values()]
      .sort((first, second) => new Date(second.date || 0) - new Date(first.date || 0));
  }, [previousScrims, selectedTeam, selectedTeamReviews]);

  const reviewKpis = useMemo(
    () => calculateReviewKpis(selectedTeamReviews, selectedTeam?.game_title),
    [selectedTeamReviews, selectedTeam?.game_title]
  );

  const loadTeamData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, org_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load user profile for team page", profileError);
      setErrorMessage("We could not load your profile. Please try again.");
      setLoading(false);
      return;
    }

    if (!profile?.org_id) {
      setErrorMessage("Your account is missing an organization.");
      setLoading(false);
      return;
    }

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, type, verified_flag, region")
      .eq("id", profile.org_id)
      .maybeSingle();

    if (orgError) {
      console.error("Failed to load org for team page", orgError);
      setErrorMessage("We could not load your organization. Please try again.");
      setLoading(false);
      return;
    }

    const selectWithRosterNames = "id, org_id, name, game_title, mode, rank_tier, region, scrimgg_rating, roster_names, roster_profiles, created_at";
    const selectWithoutRosterNames = "id, org_id, name, game_title, mode, rank_tier, region, scrimgg_rating, created_at";

    let { data: teamData, error: teamsError } = await supabase
      .from("teams")
      .select(selectWithRosterNames)
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: true });

    if (isMissingRosterNamesError(teamsError)) {
      console.warn("roster profile columns are missing in Supabase. Run supabase_team_roster_names.sql to enable roster editing.");
      setHasRosterProfilesColumn(false);
      ({ data: teamData, error: teamsError } = await supabase
        .from("teams")
        .select(selectWithoutRosterNames)
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true }));
    }

    if (teamsError) {
      console.error("Failed to load teams for team page", teamsError);
      setErrorMessage("We could not load your teams. Please try again.");
      setLoading(false);
      return;
    }

    const loadedTeams = teamData || [];
    setOrganization(orgData);
    setTeams(loadedTeams);

    const nextTeam = loadedTeams.find((team) => team.id === requestedTeamId) || loadedTeams[0] || null;
    setSelectedTeamId(nextTeam?.id || "");
    setRosterPlayers(normalizeRosterProfiles(nextTeam));
    setNewPlayer(createRosterPlayer(nextTeam?.game_title || "Valorant"));

    const teamIds = loadedTeams.map((team) => team.id);
    if (!teamIds.length) {
      setScrims([]);
      setMatchReviews([]);
      setLoading(false);
      return;
    }

    const scrimSelectWithGames = "id, posting_team_id, matched_team_id, game_title, scheduled_at, games_count, team_rank, opponent_rank_min, opponent_rank_max, status, expires_at";
    const scrimSelectWithoutGames = scrimSelectWithGames.replace("games_count,", "");

    const fetchTeamScrims = async (selectQuery) => {
      const postedResult = await supabase
        .from("scrim_requests")
        .select(selectQuery)
        .in("posting_team_id", teamIds);

      const matchedResult = await supabase
        .from("scrim_requests")
        .select(selectQuery)
        .in("matched_team_id", teamIds);

      return [postedResult, matchedResult];
    };

    let [
      { data: postedScrims, error: postedError },
      { data: matchedScrims, error: matchedError },
    ] = await fetchTeamScrims(scrimSelectWithGames);

    if (isMissingGamesCountError(postedError) || isMissingGamesCountError(matchedError)) {
      console.warn("games_count is missing in Supabase. Run supabase_scrim_games_count.sql to enable saved game counts.");
      [
        { data: postedScrims, error: postedError },
        { data: matchedScrims, error: matchedError },
      ] = await fetchTeamScrims(scrimSelectWithoutGames);
    }

    const scrimError = postedError || matchedError;
    if (scrimError) {
      console.error("Failed to load team scrims", scrimError);
      setErrorMessage("We could not load this team's scrims. Please try again.");
      setLoading(false);
      return;
    }

    const mergedScrims = new Map();
    for (const scrim of [...(postedScrims || []), ...(matchedScrims || [])]) {
      mergedScrims.set(scrim.id, scrim);
    }

    setScrims(Array.from(mergedScrims.values()));

    const { data: reviewData, error: reviewError } = await supabase
      .from("team_match_reviews")
      .select("id, team_id, scrim_request_id, review_series_id, scrim_game_number, series_game_count, game_title, match_type, match_result, team_score, opponent_score, opponent_name, map_or_mode, team_comp, opponent_comp, team_stats, opponent_stats, player_rows, opponent_rows, played_at, created_at")
      .in("team_id", teamIds)
      .order("played_at", { ascending: false, nullsFirst: false });

    if (reviewError && !isMissingMatchReviewsError(reviewError)) {
      console.error("Failed to load team match reviews", reviewError);
    }

    if (isMissingMatchReviewsError(reviewError)) {
      console.warn("team_match_reviews is missing in Supabase. Run supabase_team_match_reviews.sql to enable aggregate review stats.");
      setMatchReviews([]);
    } else {
      setMatchReviews(reviewData || []);
    }

    setLoading(false);
  }, [requestedTeamId, router]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  useEffect(() => {
    if (!selectedTeam) return;
    setRosterPlayers(normalizeRosterProfiles(selectedTeam));
    setNewPlayer(createRosterPlayer(selectedTeam.game_title));
    setRosterError("");
    setRosterSuccess("");
  }, [selectedTeam]);

  function handleRosterPlayerChange(index, field, value) {
    setRosterPlayers((current) => current.map((player, currentIndex) => (
      currentIndex === index ? { ...player, [field]: value } : player
    )));
    setRosterError("");
    setRosterSuccess("");
  }

  function handleNewPlayerChange(field, value) {
    setNewPlayer((current) => ({ ...current, [field]: value }));
    setRosterError("");
    setRosterSuccess("");
  }

  function handleAddPlayer(event) {
    event.preventDefault();
    const trimmedName = newPlayer.name.trim();
    if (!trimmedName) return;
    setRosterPlayers((current) => [...current, {
      name: trimmedName,
      rank: newPlayer.rank || getDefaultRankForGame(selectedTeam?.game_title),
      profile_url: newPlayer.profile_url.trim(),
    }]);
    setNewPlayer(createRosterPlayer(selectedTeam?.game_title || "Valorant"));
    setRosterError("");
    setRosterSuccess("Player added locally. Save the roster to publish it.");
  }

  function handleRemovePlayer(index) {
    setRosterPlayers((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setRosterError("");
    setRosterSuccess("");
  }

  async function handleSaveRoster() {
    if (!selectedTeam) return;

    const cleanedRoster = rosterPlayers
      .map((player) => ({
        name: player.name.trim(),
        rank: getValidRosterRank(selectedTeam.game_title, player.rank),
        profile_url: player.profile_url?.trim() || "",
      }))
      .filter((player) => player.name);

    if (!hasRosterProfilesColumn) {
      setRosterError("Run supabase_team_roster_names.sql in Supabase before saving roster profiles.");
      return;
    }

    setSavingRoster(true);
    setRosterError("");
    setRosterSuccess("");

    const { data, error } = await supabase
      .from("teams")
      .update({
        roster_names: cleanedRoster.map((player) => player.name),
        roster_profiles: cleanedRoster,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedTeam.id)
      .eq("org_id", selectedTeam.org_id)
      .select("id, roster_names, roster_profiles")
      .maybeSingle();

    if (isMissingRosterNamesError(error)) {
      setHasRosterProfilesColumn(false);
      setRosterError("Run supabase_team_roster_names.sql in Supabase before saving roster profiles.");
      setSavingRoster(false);
      return;
    }

    if (error) {
      console.error("Failed to save roster", error);
      setRosterError(error.message || "We could not save this roster.");
      setSavingRoster(false);
      return;
    }

    setTeams((current) => current.map((team) => (
      team.id === selectedTeam.id
        ? { ...team, roster_names: data?.roster_names || cleanedRoster.map((player) => player.name), roster_profiles: data?.roster_profiles || cleanedRoster }
        : team
    )));
    setRosterPlayers(data?.roster_profiles || cleanedRoster);
    setRosterSuccess("Roster saved.");
    setSavingRoster(false);
  }

  async function handleDeleteTeam() {
    if (!selectedTeam || deleteConfirmation.trim() !== selectedTeam.name) return;

    setDeletingTeam(true);
    setDeleteError("");

    const { data, error } = await supabase
      .from("teams")
      .delete()
      .eq("id", selectedTeam.id)
      .eq("org_id", selectedTeam.org_id)
      .select("id");

    if (error) {
      console.error("Failed to delete team", error);
      setDeleteError(error.message || "We could not delete this team.");
      setDeletingTeam(false);
      return;
    }

    if (!data?.length) {
      setDeleteError("The team was not deleted. Run supabase_team_delete_policy.sql in Supabase, then try again.");
      setDeletingTeam(false);
      return;
    }

    setTeams((current) => current.filter((team) => team.id !== selectedTeam.id));
    setScrims((current) => current.filter((scrim) => (
      scrim.posting_team_id !== selectedTeam.id && scrim.matched_team_id !== selectedTeam.id
    )));
    setMatchReviews((current) => current.filter((review) => review.team_id !== selectedTeam.id));
    setDeleteModalOpen(false);
    setDeleteConfirmation("");
    setDeletingTeam(false);
    router.replace("/org");
  }

  const teamInitials = getInitials(selectedTeam?.name || "Team");

  return (
    <TeamPageShell>
        {loading ? (
          <div className="rounded-xl bg-surface-container-lowest p-lg font-body-main text-body-main text-on-surface-variant">
            Loading team...
          </div>
        ) : errorMessage ? (
          <EmptyState
            icon="error"
            title="Team page unavailable"
            body={errorMessage}
            action={
              <Link className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary" href="/org">
                Back to Org
              </Link>
            }
          />
        ) : teams.length === 0 ? (
          <EmptyState
            icon="groups"
            title="No teams yet"
            body="Create your first team before managing a roster or team scrims."
            action={
              <Link className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary" href="/team/new">
                <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
                Create Team
              </Link>
            }
          />
        ) : (
          <>
            <section className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-lg mb-lg flex flex-col md:flex-row items-start md:items-center gap-md">
              <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 border-4 border-surface-container-lowest shadow-sm">
                <span className="font-editorial-large text-editorial-large text-primary">{teamInitials}</span>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-sm mb-xs">
                  <h1 className="font-headline-1 text-on-surface">{selectedTeam.name}</h1>
                  {organization?.verified_flag && <MaterialSymbol className="text-primary text-[20px]" fill>verified</MaterialSymbol>}
                </div>
                <p className="font-body-sub text-on-surface-variant mb-md">
                  {organization?.name || "Your organization"} • {selectedTeam.region || "Region not set"}
                </p>
                <div className="flex flex-wrap gap-sm">
                  <span className="bg-primary-fixed text-on-primary-fixed font-label-small px-3 py-1 rounded-full">{selectedTeam.game_title}</span>
                  <span className="bg-surface-container text-on-surface-variant font-label-small px-3 py-1 rounded-full">{getDisplayModeForTeam(selectedTeam)}</span>
                  <span className="bg-surface-container text-on-surface-variant font-label-small px-3 py-1 rounded-full">{selectedTeam.rank_tier || "Rank TBD"}</span>
                  <span className="bg-surface-container text-on-surface-variant font-label-small px-3 py-1 rounded-full">Rating {Number(selectedTeam.scrimgg_rating || 0).toFixed(1)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-sm w-full md:w-64">
                <label className="font-label-small text-label-small text-on-surface-variant uppercase tracking-wide">
                  Switch Team
                </label>
                <select
                  className="w-full rounded-lg border-none bg-surface-container px-md py-sm font-label-bold text-label-bold text-on-surface focus:ring-2 focus:ring-primary"
                  onChange={(event) => {
                    setSelectedTeamId(event.target.value);
                    router.replace(`/team?id=${event.target.value}`);
                  }}
                  value={selectedTeam.id}
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <button
                  className="inline-flex items-center justify-center gap-xs rounded-lg border border-error/30 bg-error-container px-md py-sm font-label-bold text-label-bold text-on-error-container hover:bg-error-container/80"
                  onClick={() => {
                    setDeleteModalOpen(true);
                    setDeleteConfirmation("");
                    setDeleteError("");
                  }}
                  type="button"
                >
                  <MaterialSymbol className="text-[18px]">delete</MaterialSymbol>
                  Delete Team
                </button>
              </div>
            </section>

            <TeamReviewStats
              gameTitle={selectedTeam.game_title}
              kpis={reviewKpis}
              reviews={selectedTeamReviews}
              teamId={selectedTeam.id}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
              <div className="lg:col-span-1 flex flex-col gap-lg">
                <section className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md">
                  <div className="flex justify-between items-center mb-md">
                    <h2 className="font-headline-3 text-on-surface">Active Roster</h2>
                    <span className="font-body-sub text-on-surface-variant">{rosterPlayers.filter((player) => player.name.trim()).length}</span>
                  </div>

                  <div className="flex flex-col gap-sm">
                    {rosterPlayers.length === 0 ? (
                      <div className="rounded-lg bg-surface-container-low p-md font-body-sub text-body-sub text-on-surface-variant">
                        No players added yet.
                      </div>
                    ) : (
                      rosterPlayers.map((player, index) => (
                        <div key={`${player.name}-${index}`} className="grid grid-cols-[auto_1fr_auto] gap-sm rounded-lg bg-surface-container-low p-sm">
                          <div className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-label-bold mt-1">
                            {getInitials(player.name || "P")}
                          </div>
                          <div className="grid gap-xs min-w-0">
                            <input
                              className="min-w-0 rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-label-bold text-label-bold text-on-surface focus:ring-2 focus:ring-primary"
                              onChange={(event) => handleRosterPlayerChange(index, "name", event.target.value)}
                              placeholder="Player name"
                              value={player.name}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
                              <select
                                className="min-w-0 rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-label-small text-label-small text-on-surface focus:ring-2 focus:ring-primary"
                                onChange={(event) => handleRosterPlayerChange(index, "rank", event.target.value)}
                                value={player.rank}
                              >
                                {getRanksForGame(selectedTeam?.game_title).map((rank) => (
                                  <option key={rank} value={rank}>{rank}</option>
                                ))}
                              </select>
                              <input
                                className="min-w-0 rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-label-small text-label-small text-on-surface focus:ring-2 focus:ring-primary"
                                onChange={(event) => handleRosterPlayerChange(index, "profile_url", event.target.value)}
                                placeholder="Profile link optional"
                                type="url"
                                value={player.profile_url}
                              />
                            </div>
                            {player.profile_url && (
                              <a
                                className="font-label-small text-label-small text-primary underline"
                                href={player.profile_url}
                                rel="noreferrer"
                                target="_blank"
                              >
                                View profile
                              </a>
                            )}
                          </div>
                          <button
                            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high self-start"
                            onClick={() => handleRemovePlayer(index)}
                            type="button"
                          >
                            <MaterialSymbol className="text-[18px]">close</MaterialSymbol>
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="mt-md grid gap-sm" onSubmit={handleAddPlayer}>
                    <input
                      className="min-w-0 rounded-lg border-none bg-surface-container-low px-md py-sm font-body-sub text-body-sub text-on-surface focus:ring-2 focus:ring-primary"
                      onChange={(event) => handleNewPlayerChange("name", event.target.value)}
                      placeholder="Add player name"
                      value={newPlayer.name}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-sm">
                      <select
                        className="min-w-0 rounded-lg border-none bg-surface-container-low px-md py-sm font-body-sub text-body-sub text-on-surface focus:ring-2 focus:ring-primary"
                        onChange={(event) => handleNewPlayerChange("rank", event.target.value)}
                        value={newPlayer.rank}
                      >
                        {getRanksForGame(selectedTeam?.game_title).map((rank) => (
                          <option key={rank} value={rank}>{rank}</option>
                        ))}
                      </select>
                      <input
                        className="min-w-0 rounded-lg border-none bg-surface-container-low px-md py-sm font-body-sub text-body-sub text-on-surface focus:ring-2 focus:ring-primary"
                        onChange={(event) => handleNewPlayerChange("profile_url", event.target.value)}
                        placeholder="Profile link optional"
                        type="url"
                        value={newPlayer.profile_url}
                      />
                      <button className="rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary" type="submit">
                        Add
                      </button>
                    </div>
                  </form>

                  {rosterError && <div className="mt-sm rounded-lg bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">{rosterError}</div>}
                  {rosterSuccess && <div className="mt-sm rounded-lg bg-[#E3F9E5] px-md py-sm font-body-sub text-body-sub text-[#1B5E20]">{rosterSuccess}</div>}

                  <button
                    className="mt-md w-full rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={savingRoster}
                    onClick={handleSaveRoster}
                    type="button"
                  >
                    {savingRoster ? "Saving..." : "Save Roster"}
                  </button>
                </section>

              </div>

              <div className="lg:col-span-2 flex flex-col gap-lg">
                <ScrimList
                  title="Upcoming Scrims"
                  scrims={upcomingScrims}
                  empty="No upcoming scrims for this team."
                />
                <GameHistoryList
                  empty="Completed scrims and uploaded match reviews will appear here."
                  items={gameHistoryItems}
                  teamId={selectedTeam.id}
                />
              </div>
            </div>
            {deleteModalOpen && selectedTeam && (
              <DeleteTeamModal
                confirmation={deleteConfirmation}
                deleteError={deleteError}
                deleting={deletingTeam}
                onCancel={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmation("");
                  setDeleteError("");
                }}
                onConfirm={handleDeleteTeam}
                onConfirmationChange={setDeleteConfirmation}
                teamName={selectedTeam.name}
              />
            )}
          </>
        )}
    </TeamPageShell>
  );
}

function TeamPageShell({ children }) {
  return (
    <>
      <header className="bg-white/80 backdrop-blur-md text-on-surface w-full top-0 sticky z-50 border-b border-surface-variant flex items-center justify-between px-5 h-16">
        <div className="flex items-center gap-3">
          <Link
            href="/org"
            className="text-primary hover:bg-surface-container transition-colors active:scale-95 w-9 h-9 flex items-center justify-center rounded-full -ml-1"
          >
            <MaterialSymbol>arrow_back</MaterialSymbol>
          </Link>
          <span className="font-headline-3 text-on-surface font-bold tracking-tight">Matchmake</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: "Scrims", href: "/" },
            { label: "Org", href: "/org", active: true },
            { label: "Requests", href: "/requests" },
            { label: "Calendar", href: "/calendar" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={
                item.active
                  ? "text-primary font-label-bold font-bold bg-primary-fixed px-3 py-2 rounded-lg"
                  : "text-on-surface-variant font-label-bold hover:bg-surface-container transition-colors px-3 py-2 rounded-lg"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          className="text-primary hover:bg-surface-container transition-colors p-2 rounded-full flex items-center justify-center active:scale-95"
          href="/team/new"
        >
          <MaterialSymbol>add</MaterialSymbol>
        </Link>
      </header>

      <main className="pt-6 pb-[100px] md:pb-xl px-margin-mobile md:px-xl max-w-[1200px] mx-auto min-h-screen">
        {children}
      </main>

      <BottomNav />
    </>
  );
}

function TeamReviewStats({ gameTitle, kpis, reviews = [], teamId }) {
  return (
    <section className="mb-lg rounded-xl border border-surface-variant bg-surface-container-lowest p-md shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
      <div className="mb-md flex flex-col gap-xs sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-headline-3 text-on-surface">Post-Game Database</h2>
          <p className="font-body-sub text-body-sub text-on-surface-variant">
            Aggregate stats from every saved post-game review for this team.
          </p>
        </div>
        <div className="flex flex-col gap-xs sm:items-end">
          <span className="font-label-small text-label-small uppercase tracking-wide text-outline">All reviewed matches</span>
          {teamId && (
            <Link
              className="inline-flex items-center justify-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary shadow-[0_4px_14px_rgba(0,88,188,0.22)]"
              href={`/team/${teamId}/dashboard?new=true`}
            >
              <MaterialSymbol className="text-[18px]">add_chart</MaterialSymbol>
              Add Match Review
            </Link>
          )}
        </div>
      </div>
      <GameStatsTabs fallbackKpis={kpis} gameTitle={gameTitle} reviews={reviews} />
    </section>
  );
}

function getReviewRows(review, side = "team") {
  if (side === "opponent") {
    return review.opponent_rows?.length ? review.opponent_rows : review.opponent_comp || [];
  }

  return review.player_rows?.length ? review.player_rows : review.team_comp || [];
}

function getReviewOutcome(review) {
  const result = review?.match_result?.toLowerCase?.();
  if (result === "victory" || result === "win") return "win";
  if (result === "defeat" || result === "loss") return "loss";
  return null;
}

function getReviewStat(review, statKeys, rowKeys, { average = false, side = "team" } = {}) {
  const stats = side === "opponent" ? review.opponent_stats || {} : review.team_stats || {};
  const keys = Array.isArray(statKeys) ? statKeys : [statKeys];

  for (const key of keys) {
    const value = normalizeExtractedNumber(stats[key]);
    if (value !== null) return value;
  }

  const rows = getReviewRows(review, side);
  const rowKeyList = Array.isArray(rowKeys) ? rowKeys : [rowKeys];
  const values = rows
    .flatMap((row) => rowKeyList.map((key) => normalizeExtractedNumber(row?.[key])))
    .filter((value) => value !== null);

  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return average ? total / values.length : total;
}

function averageValues(values, decimals = 1) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (!validValues.length) return null;
  const average = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  return Number(average.toFixed(decimals));
}

function formatSignedValue(value, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(decimals));
  if (rounded > 0) return `+${rounded.toFixed(decimals)}`;
  if (rounded < 0) return rounded.toFixed(decimals);
  return decimals ? "0.0" : "0";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function splitFeatureValue(value = "") {
  if (!value || value === "—") return { primary: "—", meta: "" };
  const [primary, ...metaParts] = String(value).split(" · ");
  return {
    primary: primary || "—",
    meta: metaParts.join(" · "),
  };
}

const LEAGUE_CHAMPION_FILE_ALIASES = {
  aurelionsol: "AurelionSol",
  belveth: "Belveth",
  chogath: "Chogath",
  drmundo: "DrMundo",
  jarvaniv: "JarvanIV",
  kaisa: "Kaisa",
  khazix: "Khazix",
  kogmaw: "KogMaw",
  ksante: "KSante",
  leesin: "LeeSin",
  masteryi: "MasterYi",
  missfortune: "MissFortune",
  monkeyking: "MonkeyKing",
  nunuandwillump: "Nunu",
  reksai: "RekSai",
  renataglasc: "Renata",
  tahmkench: "TahmKench",
  twistedfate: "TwistedFate",
  velkoz: "Velkoz",
  wukong: "MonkeyKing",
  xinzhao: "XinZhao",
};

function compactPickKey(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toChampionFileStem(name = "") {
  const key = compactPickKey(name);
  if (!key) return "";
  return LEAGUE_CHAMPION_FILE_ALIASES[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

const VALORANT_AGENT_FILE_ALIASES = {
  kayo: "kayo",
  "kay/o": "kayo",
};

function toAgentFileStem(name = "") {
  const key = String(name).toLowerCase().replace(/[^a-z0-9/]/g, "");
  if (!key) return "";
  return VALORANT_AGENT_FILE_ALIASES[key] || key.replace(/\//g, "");
}

const MARVEL_HERO_FILE_ALIASES = {
  cloakdagger: "cloak-and-dagger",
  cloakanddagger: "cloak-and-dagger",
  doctorstrange: "doctor-strange",
  humantorch: "human-torch",
  invisiblewoman: "invisible-woman",
  ironfist: "iron-fist",
  ironman: "iron-man",
  jeff: "jeff-the-land-shark",
  jeffthelandshark: "jeff-the-land-shark",
  misterfantastic: "mister-fantastic",
  moonknight: "moon-knight",
  peniparker: "peni-parker",
  rocketraccoon: "rocket-raccoon",
  scarletwitch: "scarlet-witch",
  spiderman: "spider-man",
  starlord: "star-lord",
  thepunisher: "the-punisher",
  thething: "the-thing",
  wintersoldier: "winter-soldier",
};

function toMarvelHeroFileStem(name = "") {
  const key = compactPickKey(name);
  if (!key) return "";
  return MARVEL_HERO_FILE_ALIASES[key] || String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
  const key = compactPickKey(String(name).replace(/&/g, "and"));
  if (!key) return "";
  return DEADLOCK_HERO_FILE_ALIASES[key] || String(name).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getPickImagePath(gameTitle, pick) {
  if (!pick) return "";
  if (gameTitle === "League of Legends") return `/lol/champions/${toChampionFileStem(pick)}.png`;
  if (gameTitle === "Valorant") return `/valorant/agents/${toAgentFileStem(pick)}.png`;
  if (gameTitle === "Marvel Rivals") return `/marvel-rivals/heroes/${toMarvelHeroFileStem(pick)}_avatar.png`;
  if (gameTitle === "Deadlock") return `/deadlock/heroes/${toDeadlockHeroFileStem(pick)}.png`;
  return "";
}

function splitCompPicks(value = "") {
  const { primary, meta } = splitFeatureValue(value);
  if (primary === "—") return { picks: [], meta };
  return {
    picks: primary.split(" / ").map((pick) => pick.trim()).filter(Boolean),
    meta,
  };
}

function formatPoolHeading(label = "Map") {
  if (label.includes("/")) return "Map and mode notes";
  if (label.toLowerCase().includes("mode")) return "Mode notes";
  if (label.toLowerCase().includes("stage")) return "Stage notes";
  return `${label} notes`;
}

function getWinRate(wins, total) {
  return total ? (wins / total) * 100 : null;
}

function parseDurationMinutes(value) {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] + parts[1] / 60;
  const number = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function getReviewDurationMinutes(review) {
  return parseDurationMinutes(review?.team_stats?.game_length || review?.team_stats?.duration);
}

function averageByOutcome(reviews, outcome, getValue) {
  return averageValues(reviews
    .filter((review) => getReviewOutcome(review) === outcome)
    .map(getValue)
    .filter((value) => value !== null));
}

function buildLeagueInsights(sortedReviews = []) {
  const chronologicalReviews = [...sortedReviews].reverse();
  const getDiff = (review, statKeys, rowKeys) => {
    const ours = getReviewStat(review, statKeys, rowKeys);
    const theirs = getReviewStat(review, statKeys, rowKeys, { side: "opponent" });
    return ours === null || theirs === null ? null : ours - theirs;
  };
  const trend = (statKeys, rowKeys) => chronologicalReviews
    .map((review) => getDiff(review, statKeys, rowKeys))
    .filter((value) => value !== null)
    .slice(-6);
  const roles = ["Top", "Jungle", "Mid", "ADC", "Support"];
  const roleStats = roles.map((role) => {
    const rows = sortedReviews.flatMap((review) => getReviewRows(review).filter((row) => row.role === role));
    const kills = averageValues(rows.map((row) => normalizeExtractedNumber(row.k ?? row.kills)).filter((value) => value !== null));
    const deaths = averageValues(rows.map((row) => normalizeExtractedNumber(row.d ?? row.deaths)).filter((value) => value !== null));
    const assists = averageValues(rows.map((row) => normalizeExtractedNumber(row.a ?? row.assists)).filter((value) => value !== null));
    const gold = averageValues(rows.map((row) => normalizeExtractedNumber(row.gold)).filter((value) => value !== null), 0);
    const damage = averageValues(rows.map((row) => normalizeExtractedNumber(row.damage_to_champions)).filter((value) => value !== null), 0);
    const kda = Number.isFinite(deaths) && deaths > 0 && Number.isFinite(kills) && Number.isFinite(assists)
      ? Number(((kills + assists) / deaths).toFixed(2))
      : null;

    return { role, kda, gold, damage };
  });

  return {
    trends: [
      { label: "Kill Diff", values: trend(["total_kills", "team_kills"], ["kills", "k"]) },
      { label: "Gold Diff", values: trend("total_gold", "gold") },
      { label: "Damage Diff", values: trend("total_damage_to_champions", "damage_to_champions") },
      { label: "Death Diff", values: trend(["total_deaths", "team_deaths"], ["deaths", "d"]) },
    ],
    roleStats,
    winLoss: [
      {
        label: "Gold Diff",
        wins: averageByOutcome(sortedReviews, "win", (review) => getDiff(review, "total_gold", "gold")),
        losses: averageByOutcome(sortedReviews, "loss", (review) => getDiff(review, "total_gold", "gold")),
      },
      {
        label: "Damage Diff",
        wins: averageByOutcome(sortedReviews, "win", (review) => getDiff(review, "total_damage_to_champions", "damage_to_champions")),
        losses: averageByOutcome(sortedReviews, "loss", (review) => getDiff(review, "total_damage_to_champions", "damage_to_champions")),
      },
      {
        label: "Deaths",
        wins: averageByOutcome(sortedReviews, "win", (review) => getReviewStat(review, ["total_deaths", "team_deaths"], ["deaths", "d"])),
        losses: averageByOutcome(sortedReviews, "loss", (review) => getReviewStat(review, ["total_deaths", "team_deaths"], ["deaths", "d"])),
      },
    ],
    avgGameLength: averageValues(sortedReviews.map(getReviewDurationMinutes).filter((value) => value !== null)),
  };
}

const GAME_ANALYTICS_CONFIG = {
  Valorant: {
    title: "Valorant Stats Dashboard",
    scoreDiffLabel: "Average Round Differential",
    pickField: "agent",
    pickLabel: "Agent",
    compLabel: "5-Agent Comp",
    mapLabel: "Map",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Average Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"] },
      { label: "Average Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"] },
      { label: "Average Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"] },
      { label: "Combat Score", statKeys: "average_acs", rowKeys: ["avg_combat_score", "acs"], average: true },
      { label: "Econ Rating", statKeys: "average_econ_rating", rowKeys: "econ_rating", average: true },
    ],
    impact: [
      { label: "First Bloods", statKeys: "total_first_bloods", rowKeys: "first_bloods" },
      { label: "Plants", statKeys: "total_plants", rowKeys: "plants" },
      { label: "Defuses", statKeys: "total_defuses", rowKeys: "defuses" },
    ],
    differentials: [
      { label: "Average First Blood Differential", statKeys: "total_first_bloods", rowKeys: "first_bloods" },
    ],
  },
  "League of Legends": {
    title: "League Stats Dashboard",
    scoreDiffLabel: "Average Kill Differential",
    pickField: "champion",
    pickLabel: "Champion",
    compLabel: "Champion Comp",
    mapLabel: "Context",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Average Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"] },
      { label: "Average Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"] },
      { label: "Average Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"] },
      { label: "Gold", statKeys: "total_gold", rowKeys: "gold" },
      { label: "Damage to Champions", statKeys: "total_damage_to_champions", rowKeys: "damage_to_champions" },
    ],
    impact: [
      { label: "Gold Differential", statKeys: "total_gold", rowKeys: "gold", differentialOnly: true },
      { label: "Damage Differential", statKeys: "total_damage_to_champions", rowKeys: "damage_to_champions", differentialOnly: true },
    ],
    differentials: [
      { label: "Average Gold Differential", statKeys: "total_gold", rowKeys: "gold" },
      { label: "Average Damage Differential", statKeys: "total_damage_to_champions", rowKeys: "damage_to_champions" },
    ],
  },
  "Counter-Strike 2": {
    title: "Counter-Strike Stats Dashboard",
    scoreDiffLabel: "Average Round Differential",
    pickField: "role",
    pickLabel: "Role",
    compLabel: "Role Mix",
    mapLabel: "Map",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Average Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"] },
      { label: "Average Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"] },
      { label: "Average Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"] },
      { label: "Average ADR", statKeys: "average_adr", rowKeys: "adr", average: true },
      { label: "Average HS%", statKeys: "average_hs_percent", rowKeys: ["hs_percent", "hs"], average: true },
    ],
    impact: [
      { label: "MVPs / Stars", statKeys: "total_mvps", rowKeys: ["mvps", "stars"] },
      { label: "Score / Rating", statKeys: "score", rowKeys: ["score", "rating"], average: true },
    ],
  },
  "Rocket League": {
    title: "Rocket League Stats Dashboard",
    scoreDiffLabel: "Average Goal Differential",
    pickField: "car",
    pickLabel: "Car / Role",
    compLabel: "Lineup",
    mapLabel: "Arena / Mode",
    betterWhenLower: [],
    output: [
      { label: "Goals", statKeys: "goals", rowKeys: "goals" },
      { label: "Assists", statKeys: "assists", rowKeys: "assists" },
      { label: "Saves", statKeys: "saves", rowKeys: "saves" },
      { label: "Shots", statKeys: "shots", rowKeys: "shots" },
      { label: "Scoreboard Score", statKeys: "scoreboard_score", rowKeys: "score" },
    ],
    impact: [
      { label: "Demos", statKeys: "demos", rowKeys: "demos" },
      { label: "Shot Differential", statKeys: "shots", rowKeys: "shots", differentialOnly: true },
    ],
  },
  "Overwatch 2": {
    title: "Overwatch 2 Stats Dashboard",
    scoreDiffLabel: "Average Score Differential",
    pickField: "hero",
    pickLabel: "Hero",
    compLabel: "Hero Comp",
    mapLabel: "Map / Mode",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Eliminations", statKeys: "eliminations", rowKeys: ["eliminations", "kills"] },
      { label: "Average Deaths", statKeys: "deaths", rowKeys: "deaths" },
      { label: "Assists", statKeys: "assists", rowKeys: "assists" },
      { label: "Damage", statKeys: "damage", rowKeys: "damage" },
      { label: "Healing", statKeys: "healing", rowKeys: "healing" },
      { label: "Mitigation", statKeys: "mitigation", rowKeys: ["mitigation", "damage_blocked"] },
    ],
    impact: [
      { label: "Damage Differential", statKeys: "damage", rowKeys: "damage", differentialOnly: true },
      { label: "Healing Differential", statKeys: "healing", rowKeys: "healing", differentialOnly: true },
    ],
  },
  "Marvel Rivals": {
    title: "Marvel Rivals Stats Dashboard",
    scoreDiffLabel: "Average Score Differential",
    pickField: "hero",
    pickLabel: "Hero",
    compLabel: "Hero Comp",
    mapLabel: "Map / Mode",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Average Kills", statKeys: ["total_kills", "team_kills", "kills"], rowKeys: ["kills", "k"] },
      { label: "Average Deaths", statKeys: ["total_deaths", "team_deaths", "deaths"], rowKeys: ["deaths", "d"] },
      { label: "Average Assists", statKeys: ["total_assists", "team_assists", "assists"], rowKeys: ["assists", "a"] },
      { label: "Final Hits", statKeys: ["total_final_hits", "final_hits"], rowKeys: "final_hits" },
      { label: "Damage", statKeys: ["total_damage", "damage"], rowKeys: "damage" },
      { label: "Healing", statKeys: ["total_healing", "healing"], rowKeys: "healing" },
      { label: "Damage Blocked", statKeys: ["total_damage_blocked", "damage_blocked"], rowKeys: "damage_blocked" },
      { label: "Accuracy", statKeys: ["average_accuracy_percent", "average_accuracy"], rowKeys: "accuracy", average: true },
    ],
    impact: [
      { label: "Damage Differential", statKeys: ["total_damage", "damage"], rowKeys: "damage", differentialOnly: true },
      { label: "Blocked Damage Differential", statKeys: ["total_damage_blocked", "damage_blocked"], rowKeys: "damage_blocked", differentialOnly: true },
      { label: "Healing Differential", statKeys: ["total_healing", "healing"], rowKeys: "healing", differentialOnly: true },
      { label: "Final Hits Differential", statKeys: ["total_final_hits", "final_hits"], rowKeys: "final_hits", differentialOnly: true },
    ],
  },
  Deadlock: {
    title: "Deadlock Stats Dashboard",
    scoreDiffLabel: "Average Kill Differential",
    pickField: "hero",
    pickLabel: "Hero",
    compLabel: "Hero Comp",
    mapLabel: "Match / Lane",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Average Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"] },
      { label: "Average Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"] },
      { label: "Average Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"] },
      { label: "Souls / Net Worth", statKeys: ["total_souls", "souls", "net_worth"], rowKeys: ["souls", "net_worth"] },
      { label: "Player Damage", statKeys: "player_damage", rowKeys: "player_damage" },
      { label: "Objective Damage", statKeys: "objective_damage", rowKeys: "objective_damage" },
    ],
    impact: [
      { label: "Soul Differential", statKeys: ["total_souls", "souls", "net_worth"], rowKeys: ["souls", "net_worth"], differentialOnly: true },
      { label: "Objective Damage Differential", statKeys: "objective_damage", rowKeys: "objective_damage", differentialOnly: true },
    ],
  },
  SSBU: {
    title: "SSBU Stats Dashboard",
    scoreDiffLabel: "Average Stock Differential",
    pickField: "character",
    pickLabel: "Character",
    compLabel: "Crew",
    mapLabel: "Ruleset / Stage",
    betterWhenLower: ["Falls", "Self-Destructs", "Damage Taken"],
    output: [
      { label: "KOs", statKeys: "kos", rowKeys: ["kos", "kills"] },
      { label: "Falls", statKeys: "falls", rowKeys: ["falls", "deaths"] },
      { label: "Self-Destructs", statKeys: "self_destructs", rowKeys: "self_destructs" },
      { label: "Damage Dealt", statKeys: "damage_dealt", rowKeys: "damage_dealt" },
      { label: "Damage Taken", statKeys: "damage_taken", rowKeys: "damage_taken" },
      { label: "Stocks Remaining", statKeys: "stocks_remaining", rowKeys: "stocks_remaining" },
    ],
    impact: [
      { label: "KO Differential", statKeys: "kos", rowKeys: ["kos", "kills"], differentialOnly: true },
      { label: "Stock Differential", statKeys: "stocks_remaining", rowKeys: "stocks_remaining", differentialOnly: true },
    ],
  },
  "Honor of Kings": {
    title: "Honor of Kings Stats Dashboard",
    scoreDiffLabel: "Average Kill Differential",
    pickField: "hero",
    pickLabel: "Hero",
    compLabel: "Hero Comp",
    mapLabel: "Mode",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Average Kills", statKeys: ["total_kills", "team_kills"], rowKeys: ["kills", "k"] },
      { label: "Average Deaths", statKeys: ["total_deaths", "team_deaths"], rowKeys: ["deaths", "d"] },
      { label: "Average Assists", statKeys: ["total_assists", "team_assists"], rowKeys: ["assists", "a"] },
      { label: "Gold", statKeys: "total_gold", rowKeys: "gold" },
      { label: "Damage", statKeys: "damage", rowKeys: "damage" },
      { label: "Healing", statKeys: "healing", rowKeys: "healing" },
    ],
    impact: [
      { label: "Gold Differential", statKeys: "total_gold", rowKeys: "gold", differentialOnly: true },
      { label: "Damage Differential", statKeys: "damage", rowKeys: "damage", differentialOnly: true },
    ],
  },
};

function getGameAnalyticsConfig(gameTitle) {
  return GAME_ANALYTICS_CONFIG[gameTitle] || GAME_ANALYTICS_CONFIG.Valorant;
}

function buildGameAggregateStats(reviews = [], gameTitle = "Valorant") {
  const config = getGameAnalyticsConfig(gameTitle);
  const sortedReviews = [...reviews].sort((first, second) => (
    new Date(second.played_at || second.created_at || 0) - new Date(first.played_at || first.created_at || 0)
  ));
  const reviewsWithOutcome = sortedReviews
    .map((review) => ({ review, outcome: getReviewOutcome(review) }))
    .filter((entry) => entry.outcome);
  const wins = reviewsWithOutcome.filter((entry) => entry.outcome === "win").length;
  const losses = reviewsWithOutcome.filter((entry) => entry.outcome === "loss").length;
  const roundDiffs = sortedReviews
    .map((review) => {
      const teamScore = normalizeExtractedNumber(review.team_score);
      const opponentScore = normalizeExtractedNumber(review.opponent_score);
      return teamScore === null || opponentScore === null ? null : teamScore - opponentScore;
    })
    .filter((value) => value !== null);
  const avg = (values, decimals = 1) => averageValues(values.filter((value) => value !== null), decimals);
  const agentCounts = new Map();
  const agentResults = new Map();
  const compCounts = new Map();
  const compResults = new Map();
  const mapCounts = new Map();
  const mapResults = new Map();
  const getDiffsForStat = (stat) => sortedReviews
    .map((review) => {
      const ours = getReviewStat(review, stat.statKeys, stat.rowKeys, { average: stat.average });
      const theirs = getReviewStat(review, stat.statKeys, stat.rowKeys, { average: stat.average, side: "opponent" });
      return ours === null || theirs === null ? null : ours - theirs;
    })
    .filter((value) => value !== null);

  for (const review of sortedReviews) {
    const outcome = getReviewOutcome(review);
    const map = review.map_or_mode;
    const picks = getReviewRows(review)
      .map((row) => row?.[config.pickField] || row?.agent || row?.champion || row?.hero || row?.character || row?.car || row?.role)
      .filter(Boolean);
    const comp = picks.length ? [...picks].sort((a, b) => a.localeCompare(b)).join(" / ") : "";

    if (map) {
      mapCounts.set(map, (mapCounts.get(map) || 0) + 1);
      if (outcome) {
        const current = mapResults.get(map) || { wins: 0, total: 0 };
        mapResults.set(map, {
          wins: current.wins + (outcome === "win" ? 1 : 0),
          total: current.total + 1,
        });
      }
    }

    for (const pick of picks) {
      agentCounts.set(pick, (agentCounts.get(pick) || 0) + 1);
      if (outcome) {
        const current = agentResults.get(pick) || { wins: 0, total: 0 };
        agentResults.set(pick, {
          wins: current.wins + (outcome === "win" ? 1 : 0),
          total: current.total + 1,
        });
      }
    }

    if (comp) {
      compCounts.set(comp, (compCounts.get(comp) || 0) + 1);
      if (outcome) {
        const current = compResults.get(comp) || { wins: 0, total: 0 };
        compResults.set(comp, {
          wins: current.wins + (outcome === "win" ? 1 : 0),
          total: current.total + 1,
        });
      }
    }
  }

  const mostPlayedMap = [...mapCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const mostUsedAgent = [...agentCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const mostUsedComp = [...compCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const bestByWinRate = (resultsMap) => [...resultsMap.entries()]
    .filter(([, result]) => result.total > 0)
    .sort((a, b) => {
      const aPreferred = a[1].total >= 2 ? 1 : 0;
      const bPreferred = b[1].total >= 2 ? 1 : 0;
      if (aPreferred !== bPreferred) return bPreferred - aPreferred;
      return getWinRate(b[1].wins, b[1].total) - getWinRate(a[1].wins, a[1].total);
    })[0] || null;
  const bestMap = bestByWinRate(mapResults);
  const bestAgent = bestByWinRate(agentResults);
  const bestComp = bestByWinRate(compResults);

  return {
    config,
    gameTitle,
    totalReviews: sortedReviews.length,
    wins,
    losses,
    winRate: getWinRate(wins, wins + losses),
    averageRoundDiff: averageValues(roundDiffs),
    teamOutput: config.output.map((stat) => ({
      ...stat,
      ours: avg(sortedReviews.map((review) => getReviewStat(review, stat.statKeys, stat.rowKeys, { average: stat.average }))),
      theirs: avg(sortedReviews.map((review) => getReviewStat(review, stat.statKeys, stat.rowKeys, { average: stat.average, side: "opponent" }))),
    })),
    impact: config.impact.map((stat) => ({
      ...stat,
      ours: avg(sortedReviews.map((review) => getReviewStat(review, stat.statKeys, stat.rowKeys, { average: stat.average }))),
      theirs: avg(sortedReviews.map((review) => getReviewStat(review, stat.statKeys, stat.rowKeys, { average: stat.average, side: "opponent" }))),
      diff: avg(getDiffsForStat(stat)),
      trend: getDiffsForStat(stat).slice().reverse(),
    })),
    differentials: (config.differentials || []).map((stat) => ({
      ...stat,
      diff: avg(getDiffsForStat(stat)),
      trend: getDiffsForStat(stat).slice().reverse(),
    })),
    mapPool: {
      bestMap: bestMap ? `${bestMap[0]} · ${formatPercent(getWinRate(bestMap[1].wins, bestMap[1].total))}` : "—",
      mostPlayedMap: mostPlayedMap ? `${mostPlayedMap[0]} · ${mostPlayedMap[1]} ${mostPlayedMap[1] === 1 ? "review" : "reviews"}` : "—",
    },
    agentComp: {
      mostUsedAgent: mostUsedAgent ? `${mostUsedAgent[0]} · ${mostUsedAgent[1]} picks` : "—",
      bestAgent: bestAgent ? `${bestAgent[0]} · ${formatPercent(getWinRate(bestAgent[1].wins, bestAgent[1].total))}` : "—",
      mostUsedComp: mostUsedComp ? `${mostUsedComp[0]} · ${mostUsedComp[1]} uses` : "—",
      bestComp: bestComp ? `${bestComp[0]} · ${formatPercent(getWinRate(bestComp[1].wins, bestComp[1].total))}` : "—",
    },
    league: gameTitle === "League of Legends" ? buildLeagueInsights(sortedReviews) : null,
  };
}

function GameStatsTabs({ fallbackKpis, gameTitle, reviews }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [timeline, setTimeline] = useState("last5");
  const timelineOption = STATS_TIMELINE_OPTIONS.find((option) => option.value === timeline) || STATS_TIMELINE_OPTIONS[0];
  const sortedReviews = useMemo(() => [...reviews].sort((first, second) => (
    new Date(second.played_at || second.created_at || 0) - new Date(first.played_at || first.created_at || 0)
  )), [reviews]);
  const scopedReviews = useMemo(() => (
    timelineOption.limit ? sortedReviews.slice(0, timelineOption.limit) : sortedReviews
  ), [sortedReviews, timelineOption.limit]);
  const stats = useMemo(() => buildGameAggregateStats(scopedReviews, gameTitle), [gameTitle, scopedReviews]);
  const tabs = [
    { label: "Overview", value: "overview" },
    { label: "Deep Stats", value: "deep" },
  ];

  return (
    <div>
      <div className="mb-md flex flex-col gap-md md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">Team Form</p>
          <h3 className="mt-xs font-headline-3 text-headline-3 text-on-surface">{stats.config.title}</h3>
          <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
            Showing {timelineOption.label.toLowerCase()} from {reviews.length} saved {reviews.length === 1 ? "review" : "reviews"}.
          </p>
        </div>
        <div className="grid gap-sm">
          <div className="grid grid-cols-2 rounded-xl bg-surface-container-low p-1">
            {tabs.map((tab) => (
              <button
                className={`rounded-lg px-md py-sm font-label-bold text-label-bold transition-colors ${
                  activeTab === tab.value
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 rounded-xl bg-surface-container-low p-1">
            {STATS_TIMELINE_OPTIONS.map((option) => (
              <button
                className={`rounded-lg px-sm py-xs font-label-bold text-label-small transition-colors ${
                  timeline === option.value
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
                key={option.value}
                onClick={() => setTimeline(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {stats.totalReviews === 0 ? (
        activeTab === "overview" ? (
          <StatsEmptyState
            body="Upload a post-game screenshot to start tracking team form."
            title={`No ${gameTitle} reviews yet.`}
          />
        ) : (
          <StatsEmptyState
            body={`Deep stats will appear after you save a few ${gameTitle} reviews.`}
            title="Deep stats are warming up."
          />
        )
      ) : activeTab === "overview" ? (
        <GameOverviewStats stats={stats} />
      ) : gameTitle === "League of Legends" ? (
        <LeagueDeepStats stats={stats} />
      ) : (
        <GameDeepStats fallbackKpis={fallbackKpis} stats={stats} />
      )}
    </div>
  );
}

function StatsEmptyState({ body, title }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-lg text-center">
      <MaterialSymbol className="mx-auto mb-sm block text-[34px] text-outline">query_stats</MaterialSymbol>
      <h3 className="font-headline-3 text-headline-3 text-on-surface">{title}</h3>
      <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{body}</p>
    </div>
  );
}

function StatKpiCard({ label, value, children }) {
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <p className="font-label-small text-label-small text-on-surface-variant">{label}</p>
      {children || <p className="mt-xs font-headline-2 text-headline-2 text-primary">{value ?? "—"}</p>}
    </div>
  );
}

function GameOverviewStats({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-md md:grid-cols-3">
      <StatKpiCard label="# of Reviews" value={stats.totalReviews} />
      <StatKpiCard label="Record" value={`${stats.wins}W - ${stats.losses}L`} />
      <StatKpiCard label="Win Rate" value={formatPercent(stats.winRate)} />
    </div>
  );
}

function formatDeepStatValue(value) {
  return typeof value === "number" ? value.toFixed(1) : value || "—";
}

function ComparisonBar({ label, ours, theirs, note }) {
  const hasValues = Number.isFinite(ours) && Number.isFinite(theirs);
  const max = hasValues ? Math.max(Math.abs(ours), Math.abs(theirs), 1) : 1;
  const ourWidth = hasValues ? `${Math.max(8, (Math.abs(ours) / max) * 100)}%` : "0%";
  const theirWidth = hasValues ? `${Math.max(8, (Math.abs(theirs) / max) * 100)}%` : "0%";

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm flex items-center justify-between gap-sm">
        <div>
          <p className="font-label-bold text-label-bold text-on-surface">{label}</p>
          {note && <p className="mt-0.5 font-label-small text-label-small text-on-surface-variant">{note}</p>}
        </div>
        <div className="text-right font-label-bold text-label-bold">
          <span className="text-primary">{formatDeepStatValue(ours)}</span>
          <span className="mx-xs text-outline">vs</span>
          <span className="text-error">{formatDeepStatValue(theirs)}</span>
        </div>
      </div>
      <div className="grid gap-xs">
        <div className="h-2 overflow-hidden rounded-full bg-primary-fixed">
          <div className="h-full rounded-full bg-primary" style={{ width: ourWidth }} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-error-container">
          <div className="h-full rounded-full bg-error" style={{ width: theirWidth }} />
        </div>
      </div>
      <div className="mt-xs flex justify-between font-label-small text-label-small text-on-surface-variant">
        <span>Your team</span>
        <span>Opponent avg</span>
      </div>
    </div>
  );
}

function CoachTakeaways({ stats }) {
  const primaryOutput = stats.teamOutput.find((stat) => Number.isFinite(stat.ours) && Number.isFinite(stat.theirs));
  const primaryImpact = stats.impact.find((stat) => Number.isFinite(stat.diff));
  const takeaways = [
    {
      label: "Strength",
      icon: "trending_up",
      value: Number.isFinite(stats.averageRoundDiff) && stats.averageRoundDiff > 0
        ? `${stats.config.scoreDiffLabel.replace("Average ", "")} is positive (${formatSignedValue(stats.averageRoundDiff)})`
        : primaryImpact && primaryImpact.diff > 0
          ? `${primaryImpact.label} trending up (${formatSignedValue(primaryImpact.diff)})`
          : "Upload more reviews to identify a strength",
    },
    {
      label: "Watch",
      icon: "visibility",
      value: Number.isFinite(stats.averageRoundDiff) && stats.averageRoundDiff < 0
        ? `${stats.config.scoreDiffLabel.replace("Average ", "")} is negative (${formatSignedValue(stats.averageRoundDiff)})`
        : primaryOutput && primaryOutput.ours < primaryOutput.theirs && !stats.config.betterWhenLower?.includes(primaryOutput.label)
          ? `Opponent average is higher in ${primaryOutput.label.toLowerCase()}`
          : "No major warning from saved reviews",
    },
    {
      label: "Focus",
      icon: "flag",
      value: primaryImpact && primaryImpact.diff < 0
        ? `Review ${primaryImpact.label.toLowerCase()}`
        : primaryOutput && primaryOutput.ours < primaryOutput.theirs && !stats.config.betterWhenLower?.includes(primaryOutput.label)
          ? `Raise ${primaryOutput.label.toLowerCase()}`
          : "Keep building the review sample",
    },
  ];

  return (
    <section className="rounded-3xl border border-primary/10 bg-primary-fixed/30 p-md">
      <div className="mb-sm flex items-center gap-sm">
        <MaterialSymbol className="text-[22px] text-primary">psychology</MaterialSymbol>
        <h3 className="font-headline-3 text-headline-3 text-on-surface">Coach Takeaways</h3>
      </div>
      <div className="grid gap-sm md:grid-cols-3">
        {takeaways.map((item) => (
          <div className="rounded-2xl bg-surface-container-lowest p-md" key={item.label}>
            <div className="mb-xs flex items-center gap-xs font-label-bold text-label-bold text-primary">
              <MaterialSymbol className="text-[18px]">{item.icon}</MaterialSymbol>
              {item.label}
            </div>
            <p className="font-body-sub text-body-sub text-on-surface-variant">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ icon, label, value }) {
  const { primary, meta } = splitFeatureValue(value);

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary">
        <MaterialSymbol className="text-[21px]">{icon}</MaterialSymbol>
      </div>
      <p className="font-label-small text-label-small text-on-surface-variant">{label}</p>
      <p className="mt-xs font-headline-3 text-headline-3 text-on-surface">{primary}</p>
      {meta && <p className="mt-xs font-label-small text-label-small text-primary">{meta}</p>}
    </div>
  );
}

function PickAvatar({ gameTitle, name, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const imagePath = getPickImagePath(gameTitle, name);
  const sizeClass = size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const label = name?.slice(0, 2)?.toUpperCase() || "?";

  useEffect(() => {
    setFailed(false);
  }, [imagePath]);

  return (
    <div className={`${sizeClass} shrink-0 overflow-hidden rounded-xl border border-outline-variant/25 bg-primary-fixed`}>
      {imagePath && !failed ? (
        <img
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          src={imagePath}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-label-bold text-label-bold text-primary">
          {label}
        </div>
      )}
    </div>
  );
}

function PickFeatureCard({ gameTitle, icon, label, value }) {
  const { primary, meta } = splitFeatureValue(value);
  const hasPick = primary && primary !== "—";

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="flex items-center gap-sm">
        {hasPick ? <PickAvatar gameTitle={gameTitle} name={primary} /> : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fixed text-primary">
            <MaterialSymbol className="text-[22px]">{icon}</MaterialSymbol>
          </div>
        )}
        <div className="min-w-0">
          <p className="font-label-small text-label-small text-on-surface-variant">{label}</p>
          <p className="truncate font-headline-3 text-headline-3 text-on-surface">{primary}</p>
          {meta && <p className="font-label-small text-label-small text-primary">{meta}</p>}
        </div>
      </div>
    </div>
  );
}

function CompFeatureCard({ gameTitle, icon, label, value }) {
  const { picks, meta } = splitCompPicks(value);
  const hasPicks = picks.length > 0;

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <p className="font-label-small text-label-small text-on-surface-variant">{label}</p>
      {hasPicks ? (
        <>
          <div className="mt-sm flex flex-wrap gap-xs">
            {picks.map((pick, index) => (
              <div className="-mr-2" key={`${pick}-${index}`} title={pick}>
                <PickAvatar gameTitle={gameTitle} name={pick} size="sm" />
              </div>
            ))}
          </div>
          <p className="mt-sm line-clamp-2 font-label-bold text-label-bold text-on-surface">{picks.join(" / ")}</p>
          {meta && <p className="mt-xs font-label-small text-label-small text-primary">{meta}</p>}
        </>
      ) : (
        <div className="mt-sm flex items-center gap-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <MaterialSymbol className="text-[21px]">{icon}</MaterialSymbol>
          </div>
          <p className="font-headline-3 text-headline-3 text-on-surface">—</p>
        </div>
      )}
    </div>
  );
}

function ImpactDifferentialCard({ stat }) {
  const hasDiff = Number.isFinite(stat.diff);
  const diff = hasDiff ? stat.diff : 0;
  const trend = Array.isArray(stat.trend) ? stat.trend.filter(Number.isFinite) : [];
  const scale = Math.max(1, ...trend.map((value) => Math.abs(value)), Math.abs(diff));
  const position = hasDiff ? Math.max(4, Math.min(96, 50 + (diff / scale) * 42)) : 50;
  const level = !hasDiff
    ? "unknown"
    : diff >= scale * 0.35
      ? "strong"
      : diff > 0
        ? "edge"
        : diff <= -scale * 0.35
          ? "gap"
          : diff < 0
            ? "slight-gap"
            : "even";
  const verdict = !hasDiff
    ? "Needs more reviews"
    : level === "even"
      ? "Even with opponents"
      : level === "strong"
        ? "Strong team edge"
        : level === "edge"
          ? "Slight team edge"
          : level === "gap"
            ? "Needs attention"
            : "Slight opponent edge";
  const coachText = !hasDiff
    ? "Save more reviews before reading this pattern."
    : diff > 0
      ? "Keep this as part of your practice identity."
      : diff < 0
        ? "Review the moments where opponents created this gap."
        : "This stat is stable. Look for context in the review notes.";
  const valueTone = diff > 0 ? "text-primary" : diff < 0 ? "text-error" : "text-on-surface";

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="flex items-start justify-between gap-sm">
        <div>
          <p className="font-label-bold text-label-bold text-on-surface">{stat.label}</p>
          <p className="mt-0.5 font-label-small text-label-small text-on-surface-variant">{verdict}</p>
        </div>
        <p className={`font-headline-3 text-headline-3 ${valueTone}`}>
          {hasDiff ? formatSignedValue(diff) : "—"}
        </p>
      </div>

      <div className="mt-md">
        <div className="relative h-14 rounded-2xl bg-gradient-to-r from-error-container via-surface-container-lowest to-primary-fixed px-md py-sm">
          <div className="absolute left-1/2 top-2 h-10 w-px bg-outline-variant" />
          <div
            className={`absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-surface-container-lowest shadow-sm ${
              diff > 0 ? "border-primary text-primary" : diff < 0 ? "border-error text-error" : "border-outline text-on-surface"
            }`}
            style={{ left: `${position}%` }}
          >
            <MaterialSymbol className="text-[18px]">{diff >= 0 ? "arrow_forward" : "arrow_back"}</MaterialSymbol>
          </div>
        </div>
        <div className="mt-xs flex justify-between font-label-small text-label-small text-on-surface-variant">
          <span>needs work</span>
          <span>even</span>
          <span>strong edge</span>
        </div>
      </div>

      <div className="mt-md">
        <div className="mb-xs flex items-center justify-between">
          <p className="font-label-small text-label-small text-on-surface-variant">Trend in this window</p>
          <p className="font-label-small text-label-small text-on-surface-variant">{trend.length || 0} games</p>
        </div>
        <div className="flex gap-xs">
          {trend.length ? trend.map((value, index) => (
            <span
              className={`h-3 flex-1 rounded-full ${value > 0 ? "bg-primary" : value < 0 ? "bg-error" : "bg-outline-variant"}`}
              key={`${stat.label}-${index}`}
              title={`${stat.label}: ${formatSignedValue(value)}`}
            />
          )) : (
            <span className="h-3 flex-1 rounded-full bg-outline-variant/60" />
          )}
        </div>
      </div>

      <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">{coachText}</p>
    </div>
  );
}

function TrendSparkline({ label, values }) {
  const hasValues = values.length > 0;
  const min = hasValues ? Math.min(...values) : 0;
  const max = hasValues ? Math.max(...values) : 1;
  const range = Math.max(1, max - min);
  const direction = values.length >= 2 ? values.at(-1) - values[0] : null;

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm flex items-center justify-between">
        <div>
          <p className="font-label-bold text-label-bold text-on-surface">{label}</p>
          <p className="mt-0.5 font-label-small text-label-small text-on-surface-variant">
            {Number.isFinite(direction) ? (direction >= 0 ? "Improving" : "Declining") : "Needs more games"}
          </p>
        </div>
        <p className="font-label-bold text-label-bold text-primary">{hasValues ? formatSignedValue(values.at(-1), 0) : "—"}</p>
      </div>
      <div className="flex h-14 items-end gap-xs">
        {hasValues ? values.map((value, index) => (
          <div
            className={`flex-1 rounded-t-md ${value >= 0 ? "bg-primary" : "bg-error"}`}
            key={`${label}-${index}`}
            style={{ height: `${22 + ((value - min) / range) * 34}px` }}
            title={`${label}: ${formatSignedValue(value, 0)}`}
          />
        )) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface-container-lowest font-body-sub text-body-sub text-on-surface-variant">
            Save more reviews
          </div>
        )}
      </div>
      <p className="mt-xs font-label-small text-label-small text-on-surface-variant">Last {values.length || 0} reviewed games</p>
    </div>
  );
}

function LeagueRoleCard({ role }) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-center gap-sm rounded-2xl border border-outline-variant/25 bg-surface-container-low p-sm">
      <div className="rounded-xl bg-primary-fixed px-sm py-md text-center">
        <p className="font-label-bold text-label-bold text-on-primary-fixed">{role.role}</p>
      </div>
      <div className="grid grid-cols-3 gap-xs">
        <div>
          <p className="font-label-small text-label-small text-on-surface-variant">KDA</p>
          <p className="font-label-bold text-label-bold text-on-surface">{Number.isFinite(role.kda) ? role.kda.toFixed(2) : "—"}</p>
        </div>
        <div>
          <p className="font-label-small text-label-small text-on-surface-variant">Gold</p>
          <p className="font-label-bold text-label-bold text-primary">{formatDeepStatValue(role.gold)}</p>
        </div>
        <div>
          <p className="font-label-small text-label-small text-on-surface-variant">Damage</p>
          <p className="font-label-bold text-label-bold text-primary">{formatDeepStatValue(role.damage)}</p>
        </div>
      </div>
    </div>
  );
}

function WinLossCard({ row }) {
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <p className="font-label-bold text-label-bold text-on-surface">{row.label}</p>
      <div className="mt-sm grid grid-cols-2 gap-xs">
        <div className="rounded-xl bg-[#E3F9E5] p-sm">
          <p className="font-label-small text-label-small text-[#1B5E20]">Wins</p>
          <p className="font-headline-3 text-headline-3 text-[#1B5E20]">{formatDeepStatValue(row.wins)}</p>
        </div>
        <div className="rounded-xl bg-error-container p-sm">
          <p className="font-label-small text-label-small text-on-error-container">Losses</p>
          <p className="font-headline-3 text-headline-3 text-on-error-container">{formatDeepStatValue(row.losses)}</p>
        </div>
      </div>
    </div>
  );
}

function LeagueCoachRead({ damageDiff, goldDiff, killDiff }) {
  const reads = [
    {
      label: "Strength",
      icon: "trending_up",
      value: Number.isFinite(goldDiff?.diff) && goldDiff.diff > 0
        ? `You are building resource leads (${formatSignedValue(goldDiff.diff, 0)} gold).`
        : Number.isFinite(damageDiff?.diff) && damageDiff.diff > 0
          ? `You are creating more champion pressure (${formatSignedValue(damageDiff.diff, 0)} damage).`
          : "Save more reviews to identify a repeatable strength.",
    },
    {
      label: "Watch",
      icon: "visibility",
      value: Number.isFinite(killDiff) && killDiff < 0
        ? `Opponent is winning fights by ${formatSignedValue(killDiff, 1)} kills.`
        : Number.isFinite(goldDiff?.diff) && goldDiff.diff < 0
          ? `Resource control is behind (${formatSignedValue(goldDiff.diff, 0)} gold).`
          : "No major warning from saved scoreboard data.",
    },
    {
      label: "Focus",
      icon: "flag",
      value: Number.isFinite(goldDiff?.diff) && goldDiff.diff < 0
        ? "Review how lanes and jungle convert farm into team gold."
        : Number.isFinite(damageDiff?.diff) && damageDiff.diff < 0
          ? "Work on coordinated fights and damage uptime."
          : "Keep tracking scrims to confirm the pattern.",
    },
  ];

  return (
    <section className="rounded-3xl border border-primary/10 bg-primary-fixed/30 p-md">
      <div className="mb-sm flex items-center gap-sm">
        <MaterialSymbol className="text-[22px] text-primary">school</MaterialSymbol>
        <h3 className="font-headline-3 text-headline-3 text-on-surface">Coach Read</h3>
      </div>
      <div className="grid gap-sm md:grid-cols-3">
        {reads.map((item) => (
          <div className="rounded-2xl bg-surface-container-lowest p-md" key={item.label}>
            <div className="mb-xs flex items-center gap-xs font-label-bold text-label-bold text-primary">
              <MaterialSymbol className="text-[18px]">{item.icon}</MaterialSymbol>
              {item.label}
            </div>
            <p className="font-body-sub text-body-sub text-on-surface-variant">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeagueDeepStats({ stats }) {
  const killStat = stats.teamOutput.find((stat) => stat.label === "Average Kills");
  const deathStat = stats.teamOutput.find((stat) => stat.label === "Average Deaths");
  const assistStat = stats.teamOutput.find((stat) => stat.label === "Average Assists");
  const goldStat = stats.teamOutput.find((stat) => stat.label === "Gold");
  const damageStat = stats.teamOutput.find((stat) => stat.label === "Damage to Champions");
  const goldDiff = stats.differentials.find((stat) => stat.label === "Average Gold Differential");
  const damageDiff = stats.differentials.find((stat) => stat.label === "Average Damage Differential");
  const leagueTrendLabels = {
    "Kill Diff": "Fighting Trend",
    "Gold Diff": "Economy Trend",
    "Damage Diff": "Pressure Trend",
    "Death Diff": "Cleanliness Trend",
  };

  return (
    <div className="grid gap-lg">
      <LeagueCoachRead damageDiff={damageDiff} goldDiff={goldDiff} killDiff={stats.averageRoundDiff} />

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Map Control Signals</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          <ComparisonBar label="Average Kills" ours={killStat?.ours} theirs={killStat?.theirs} />
          <ComparisonBar label="Average Deaths" ours={deathStat?.ours} theirs={deathStat?.theirs} note="Lower is usually cleaner." />
          <ComparisonBar label="Gold" ours={goldStat?.ours} theirs={goldStat?.theirs} />
          <ComparisonBar label="Damage to Champions" ours={damageStat?.ours} theirs={damageStat?.theirs} />
        </div>
        <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-3">
          <StatKpiCard label="Average Kill Differential" value={Number.isFinite(stats.averageRoundDiff) ? formatSignedValue(stats.averageRoundDiff) : "—"} />
          <StatKpiCard label="Average Gold Differential" value={Number.isFinite(goldDiff?.diff) ? formatSignedValue(goldDiff.diff, 0) : "—"} />
          <StatKpiCard label="Average Damage Differential" value={Number.isFinite(damageDiff?.diff) ? formatSignedValue(damageDiff.diff, 0) : "—"} />
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Fight Cleanliness</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-3">
          <StatKpiCard label="Average Kills" value={formatDeepStatValue(killStat?.ours)} />
          <StatKpiCard label="Average Deaths" value={formatDeepStatValue(deathStat?.ours)} />
          <StatKpiCard label="Average Assists" value={formatDeepStatValue(assistStat?.ours)} />
        </div>
        <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-2">
          <StatKpiCard label="Average Game Length" value={Number.isFinite(stats.league?.avgGameLength) ? `${stats.league.avgGameLength.toFixed(1)} min` : "—"} />
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Last Games Trend</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2 lg:grid-cols-4">
          {stats.league?.trends.map((trend) => (
            <TrendSparkline key={trend.label} label={leagueTrendLabels[trend.label] || trend.label} values={trend.values} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Role Review</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {stats.league?.roleStats.map((role) => (
            <LeagueRoleCard key={role.role} role={role} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Win / Loss Comparison</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-3">
          {stats.league?.winLoss.map((row) => (
            <WinLossCard key={row.label} row={row} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Champion Comfort</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
          <PickFeatureCard gameTitle={stats.gameTitle} icon="person_search" label="Most used champion" value={stats.agentComp.mostUsedAgent} />
          <PickFeatureCard gameTitle={stats.gameTitle} icon="workspace_premium" label="Best performing champion" value={stats.agentComp.bestAgent} />
        </div>
      </section>
    </div>
  );
}

function GameDeepStats({ fallbackKpis, stats }) {
  const comparableOutput = stats.teamOutput.filter((stat) => !stat.differentialOnly);
  const comparableImpact = stats.impact.filter((stat) => !stat.differentialOnly);
  const impactDiffs = [
    ...stats.impact.filter((stat) => stat.differentialOnly || Number.isFinite(stat.diff)),
    ...stats.differentials,
  ];

  return (
    <div className="grid gap-lg">
      <CoachTakeaways stats={stats} />

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Team Output</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {comparableOutput.map((stat) => (
            <ComparisonBar
              key={stat.label}
              label={stat.label}
              note={stats.config.betterWhenLower?.includes(stat.label) ? "Lower is usually cleaner." : ""}
              ours={stat.ours}
              theirs={stat.theirs}
            />
          ))}
        </div>
        <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-2">
          <StatKpiCard label={stats.config.scoreDiffLabel} value={Number.isFinite(stats.averageRoundDiff) ? formatSignedValue(stats.averageRoundDiff) : "—"} />
          {fallbackKpis?.slice(0, 1).map((kpi) => (
            <StatKpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </div>
      </section>

      {(comparableImpact.length > 0 || impactDiffs.length > 0) && (
        <section>
          <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Impact Stats</h3>
          {comparableImpact.length > 0 && (
            <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
              {comparableImpact.map((stat) => (
                <ComparisonBar key={stat.label} label={stat.label} ours={stat.ours} theirs={stat.theirs} />
              ))}
            </div>
          )}
          {impactDiffs.length > 0 && (
            <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-2">
              {impactDiffs.map((stat) => (
                <ImpactDifferentialCard key={stat.label} stat={stat} />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">{formatPoolHeading(stats.config.mapLabel)}</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
          <FeatureCard icon="map" label="Best win rate" value={stats.mapPool.bestMap} />
          <FeatureCard icon="repeat" label="Most reviewed" value={stats.mapPool.mostPlayedMap} />
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">{stats.config.pickLabel} and comp notes</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
          <PickFeatureCard gameTitle={stats.gameTitle} icon="person_search" label={`Most used ${stats.config.pickLabel.toLowerCase()}`} value={stats.agentComp.mostUsedAgent} />
          <PickFeatureCard gameTitle={stats.gameTitle} icon="workspace_premium" label={`Best performing ${stats.config.pickLabel.toLowerCase()}`} value={stats.agentComp.bestAgent} />
          <CompFeatureCard gameTitle={stats.gameTitle} icon="groups" label={`Most used ${stats.config.compLabel.toLowerCase()}`} value={stats.agentComp.mostUsedComp} />
          <CompFeatureCard gameTitle={stats.gameTitle} icon="trophy" label={`Best performing ${stats.config.compLabel.toLowerCase()}`} value={stats.agentComp.bestComp} />
        </div>
      </section>
    </div>
  );
}

function DeleteTeamModal({
  confirmation,
  deleteError,
  deleting,
  onCancel,
  onConfirm,
  onConfirmationChange,
  teamName,
}) {
  const canDelete = confirmation.trim() === teamName;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-margin-mobile backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-2xl border border-error/30 bg-surface-container-lowest p-lg shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container">
            <MaterialSymbol className="text-[26px]">warning</MaterialSymbol>
          </div>
          <div>
            <h2 className="font-headline-2 text-headline-2 text-on-surface">Delete {teamName}?</h2>
            <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
              This will permanently delete the team, roster, posted scrims, and saved post-game review data connected to this team. This cannot be undone.
            </p>
          </div>
        </div>

        <label className="mt-lg grid gap-xs">
          <span className="font-label-bold text-label-bold text-on-surface-variant">
            Type <span className="text-on-surface">{teamName}</span> to confirm
          </span>
          <input
            className="rounded-xl border-none bg-surface-container-low px-md py-sm font-body-main text-body-main text-on-surface focus:ring-2 focus:ring-error"
            onChange={(event) => onConfirmationChange(event.target.value)}
            value={confirmation}
          />
        </label>

        {deleteError && (
          <div className="mt-md rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
            {deleteError}
          </div>
        )}

        <div className="mt-lg flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
          <button
            className="rounded-xl bg-surface-container px-lg py-sm font-label-bold text-label-bold text-on-surface-variant hover:bg-surface-container-high"
            disabled={deleting}
            onClick={onCancel}
            type="button"
          >
            Keep Team
          </button>
          <button
            className="rounded-xl bg-error px-lg py-sm font-label-bold text-label-bold text-on-error disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canDelete || deleting}
            onClick={onConfirm}
            type="button"
          >
            {deleting ? "Deleting..." : "Delete Team"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScrimList({ title, scrims, empty, previous = false, teamId = "" }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md">
      <div className="flex justify-between items-center mb-md">
        <div>
          <h2 className="font-headline-3 text-on-surface">{title}</h2>
          {scrims.length > 4 && (
            <p className="mt-0.5 font-label-small text-label-small text-on-surface-variant">
              Showing 4 at a time. Scroll for more.
            </p>
          )}
        </div>
        {!previous && (
          <Link
            href="/calendar"
            className="text-primary font-label-bold flex items-center gap-xs hover:bg-surface-container p-xs rounded-lg transition-colors"
          >
            View Calendar
            <MaterialSymbol className="text-[18px]">arrow_forward</MaterialSymbol>
          </Link>
        )}
      </div>
      <div className="flex max-h-[440px] flex-col gap-md overflow-y-auto pr-xs">
        {scrims.length === 0 ? (
          <div className="rounded-lg bg-surface-container-low p-md font-body-sub text-body-sub text-on-surface-variant">
            {empty}
          </div>
        ) : (
          scrims.map((scrim) => (
            <Link
              key={scrim.id}
              href={previous && teamId ? `/team/${teamId}/dashboard?scrim_id=${scrim.id}` : `/scrims/${scrim.id}`}
              className="block border border-surface-variant rounded-lg p-md hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] transition-shadow"
            >
              <ScrimCard previous={previous} scrim={scrim} />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function GameHistoryList({ empty, items, teamId = "" }) {
  const [activeTab, setActiveTab] = useState("all");
  const tabs = [
    { label: "All", value: "all" },
    { label: "Matches", value: "matches" },
    { label: "Scrims", value: "scrims" },
  ];
  const filteredItems = items.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "scrims") return item.kind === "scrim" || item.review?.match_type === "scrim";
    return item.kind === "review" && item.review?.match_type === "match";
  });

  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md">
      <div className="flex flex-col gap-md mb-md sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-headline-3 text-on-surface">Game History</h2>
          {filteredItems.length > 4 && (
            <p className="mt-0.5 font-label-small text-label-small text-on-surface-variant">
              Showing 4 at a time. Scroll for more.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 rounded-xl bg-surface-container-low p-1">
          {tabs.map((tab) => (
            <button
              className={`rounded-lg px-md py-xs font-label-bold text-label-bold transition-colors ${
                activeTab === tab.value
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex max-h-[440px] flex-col gap-md overflow-y-auto pr-xs">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg bg-surface-container-low p-md font-body-sub text-body-sub text-on-surface-variant">
            {activeTab === "matches"
              ? "Uploaded match reviews will appear here."
              : activeTab === "scrims"
                ? "Booked scrim history will appear here."
                : empty}
          </div>
        ) : (
          filteredItems.map((item) => {
            const href = item.kind === "scrim"
              ? `/team/${teamId}/dashboard?scrim_id=${item.scrim.id}`
              : item.review.review_series_id
                ? `/team/${teamId}/dashboard?series_id=${item.review.review_series_id}`
                : `/team/${teamId}/dashboard?review_id=${item.review.id}`;

            return (
              <Link
                className="block border border-surface-variant rounded-lg p-md hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] transition-shadow"
                href={href}
                key={`${item.kind}-${item.id}`}
              >
                {item.kind === "scrim" ? (
                  <ScrimCard previous scrim={item.scrim} />
                ) : (
                  <ReviewHistoryCard item={item} />
                )}
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function ReviewHistoryCard({ item }) {
  const review = item.review;
  const gameCount = item.reviews.length;
  const opponentName = review.opponent_name || "Opponent TBD";
  const score = review.team_score !== null && review.team_score !== undefined && review.opponent_score !== null && review.opponent_score !== undefined
    ? `${review.team_score} - ${review.opponent_score}`
    : "Score TBD";

  return (
    <>
      <div className="flex justify-between items-start mb-sm gap-md">
        <div className="flex items-center gap-sm min-w-0">
          <div className="w-12 h-12 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
            <MaterialSymbol className="text-[24px]">query_stats</MaterialSymbol>
          </div>
          <div className="min-w-0">
            <h3 className="font-headline-3 text-on-surface text-[16px] truncate">
              {review.game_title} {review.match_type === "match" ? "Match" : "Scrim"} vs {opponentName}
            </h3>
            <p className="font-body-sub text-on-surface-variant">
              {formatDateTime(review.played_at || review.created_at)} • {gameCount} {gameCount === 1 ? "Game" : "Games"}
            </p>
          </div>
        </div>
        <StatusBadge status={review.match_result || "review"} />
      </div>
      <div className="flex flex-wrap items-center gap-md text-on-surface-variant font-label-small mt-sm">
        <div className="flex items-center gap-xs">
          <MaterialSymbol className="text-[16px]">scoreboard</MaterialSymbol>
          {score}
        </div>
        <div className="flex items-center gap-xs">
          <MaterialSymbol className="text-[16px]">groups</MaterialSymbol>
          {opponentName}
        </div>
        <div className="flex items-center gap-xs">
          <MaterialSymbol className="text-[16px]">sports_esports</MaterialSymbol>
          {review.map_or_mode || "Map/mode TBD"}
        </div>
        <div className="ml-auto inline-flex items-center gap-xs rounded-lg bg-primary-fixed px-sm py-1 font-label-bold text-label-bold text-on-primary-fixed">
          <MaterialSymbol className="text-[16px]">edit_note</MaterialSymbol>
          Uploaded review
        </div>
      </div>
    </>
  );
}

function ScrimCard({ previous = false, scrim }) {
  return (
    <>
      <div className="flex justify-between items-start mb-sm gap-md">
        <div className="flex items-center gap-sm min-w-0">
          <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
            <MaterialSymbol className="text-on-surface-variant text-[24px]">sports_esports</MaterialSymbol>
          </div>
          <div className="min-w-0">
            <h3 className="font-headline-3 text-on-surface text-[16px] truncate">{scrim.game_title}</h3>
            <p className="font-body-sub text-on-surface-variant">
              {formatDateTime(scrim.scheduled_at)} • {formatGameCount(scrim.games_count)}
            </p>
          </div>
        </div>
        <StatusBadge status={scrim.status} />
      </div>
      <div className="flex flex-wrap items-center gap-md text-on-surface-variant font-label-small mt-sm">
        <div className="flex items-center gap-xs">
          <MaterialSymbol className="text-[16px]">military_tech</MaterialSymbol>
          {scrim.team_rank || "Rank TBD"}
        </div>
        <div className="flex items-center gap-xs">
          <MaterialSymbol className="text-[16px]">swap_vert</MaterialSymbol>
          VS {scrim.opponent_rank_min || scrim.opponent_rank_max || "Open"}
        </div>
        {previous && (
          <div className="ml-auto inline-flex items-center gap-xs rounded-lg bg-primary-fixed px-sm py-1 font-label-bold text-label-bold text-on-primary-fixed">
            <MaterialSymbol className="text-[16px]">query_stats</MaterialSymbol>
            Post-game review
          </div>
        )}
      </div>
    </>
  );
}
