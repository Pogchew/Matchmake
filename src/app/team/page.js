"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { supabase } from "@/lib/supabase";
import { getDefaultRankForGame, getRanksForGame } from "@/lib/game-options";

const SCRIM_DURATION_HOURS = 3;
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
  const historyCount = gameHistoryItems.length;
  const confirmedScrims = selectedTeamScrims.filter((scrim) => scrim.status === "confirmed" || scrim.status === "completed").length;

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
                  <span className="bg-surface-container text-on-surface-variant font-label-small px-3 py-1 rounded-full">{selectedTeam.mode || "Mode TBD"}</span>
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

                <section className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md">
                  <h2 className="font-headline-3 text-on-surface mb-md">Team Stats</h2>
                  <div className="grid grid-cols-2 gap-sm">
                    <div className="bg-surface-container-low p-sm rounded-lg flex flex-col items-center justify-center text-center">
                      <span className="font-editorial-large text-editorial-large text-primary">{historyCount}</span>
                      <span className="font-label-small text-label-small text-on-surface-variant">Game History</span>
                    </div>
                    <div className="bg-surface-container-low p-sm rounded-lg flex flex-col items-center justify-center text-center">
                      <span className="font-editorial-large text-editorial-large text-secondary">{confirmedScrims}</span>
                      <span className="font-label-small text-label-small text-on-surface-variant">Confirmed</span>
                    </div>
                  </div>
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
  const isValorant = gameTitle === "Valorant";

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
      {isValorant ? (
        <ValorantStatsTabs reviews={reviews} />
      ) : (
        <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-md">
              <p className="font-label-small text-label-small text-on-surface-variant">{kpi.label}</p>
              <p className="mt-xs font-headline-2 text-headline-2 text-primary">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}
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

function getWinRate(wins, total) {
  return total ? (wins / total) * 100 : null;
}

function buildValorantAggregateStats(reviews = []) {
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
  const recentForm = reviewsWithOutcome.slice(0, 5).map((entry) => entry.outcome === "win" ? "W" : "L");
  const avg = (values, decimals = 1) => averageValues(values.filter((value) => value !== null), decimals);
  const agentCounts = new Map();
  const agentResults = new Map();
  const compCounts = new Map();
  const compResults = new Map();
  const mapCounts = new Map();
  const mapResults = new Map();

  for (const review of sortedReviews) {
    const outcome = getReviewOutcome(review);
    const map = review.map_or_mode;
    const agents = getReviewRows(review)
      .map((row) => row.agent)
      .filter(Boolean);
    const comp = agents.length ? [...agents].sort((a, b) => a.localeCompare(b)).join(" / ") : "";

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

    for (const agent of agents) {
      agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
      if (outcome) {
        const current = agentResults.get(agent) || { wins: 0, total: 0 };
        agentResults.set(agent, {
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
    totalReviews: sortedReviews.length,
    winRate: getWinRate(wins, wins + losses),
    recentForm,
    averageRoundDiff: averageValues(roundDiffs),
    teamOutput: {
      kills: avg(sortedReviews.map((review) => getReviewStat(review, ["total_kills", "team_kills"], ["kills", "k"]))),
      deaths: avg(sortedReviews.map((review) => getReviewStat(review, ["total_deaths", "team_deaths"], ["deaths", "d"]))),
      assists: avg(sortedReviews.map((review) => getReviewStat(review, ["total_assists", "team_assists"], ["assists", "a"]))),
      combatScore: avg(sortedReviews.map((review) => getReviewStat(review, "average_acs", ["avg_combat_score", "acs"], { average: true }))),
      econ: avg(sortedReviews.map((review) => getReviewStat(review, "average_econ_rating", "econ_rating", { average: true }))),
    },
    impact: {
      firstBloods: avg(sortedReviews.map((review) => getReviewStat(review, "total_first_bloods", "first_bloods"))),
      firstBloodDiff: avg(sortedReviews.map((review) => {
        const ours = getReviewStat(review, "total_first_bloods", "first_bloods");
        const theirs = getReviewStat(review, "total_first_bloods", "first_bloods", { side: "opponent" });
        return ours === null || theirs === null ? null : ours - theirs;
      })),
      plants: avg(sortedReviews.map((review) => getReviewStat(review, "total_plants", "plants"))),
      defuses: avg(sortedReviews.map((review) => getReviewStat(review, "total_defuses", "defuses"))),
    },
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
  };
}

function ValorantStatsTabs({ reviews }) {
  const [activeTab, setActiveTab] = useState("overview");
  const stats = useMemo(() => buildValorantAggregateStats(reviews), [reviews]);
  const tabs = [
    { label: "Overview", value: "overview" },
    { label: "Deep Stats", value: "deep" },
  ];

  return (
    <div>
      <div className="mb-md flex flex-col gap-md md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-label-bold text-label-bold uppercase tracking-wider text-outline">Team Form</p>
          <h3 className="mt-xs font-headline-3 text-headline-3 text-on-surface">Valorant Stats Dashboard</h3>
        </div>
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
      </div>

      {stats.totalReviews === 0 ? (
        activeTab === "overview" ? (
          <StatsEmptyState
            body="Upload a post-game screenshot to start tracking team form."
            title="No Valorant reviews yet."
          />
        ) : (
          <StatsEmptyState
            body="Deep stats will appear after you save a few Valorant reviews."
            title="Deep stats are warming up."
          />
        )
      ) : activeTab === "overview" ? (
        <ValorantOverviewStats stats={stats} />
      ) : (
        <ValorantDeepStats stats={stats} />
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

function ValorantOverviewStats({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-md md:grid-cols-3">
      <StatKpiCard label="Win Rate" value={formatPercent(stats.winRate)} />
      <StatKpiCard label="Recent Form">
        {stats.recentForm.length ? (
          <div className="mt-sm flex flex-wrap gap-xs">
            {stats.recentForm.map((result, index) => (
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full font-label-bold text-label-bold ${
                  result === "W" ? "bg-[#E3F9E5] text-[#1B5E20]" : "bg-error-container text-on-error-container"
                }`}
                key={`${result}-${index}`}
              >
                {result}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-xs font-headline-2 text-headline-2 text-primary">—</p>
        )}
      </StatKpiCard>
      <StatKpiCard label="Avg Round Differential" value={formatSignedValue(stats.averageRoundDiff)} />
    </div>
  );
}

function ValorantDeepStats({ stats }) {
  const groups = [
    {
      title: "Team Output",
      cards: [
        ["Average Team Kills", stats.teamOutput.kills],
        ["Average Team Deaths", stats.teamOutput.deaths],
        ["Average Team Assists", stats.teamOutput.assists],
        ["Average Combat Score", stats.teamOutput.combatScore],
        ["Average Econ Rating", stats.teamOutput.econ],
      ],
    },
    {
      title: "Objective / Round Impact",
      cards: [
        ["Average First Bloods", stats.impact.firstBloods],
        ["Average First Blood Differential", Number.isFinite(stats.impact.firstBloodDiff) ? formatSignedValue(stats.impact.firstBloodDiff) : "—"],
        ["Average Plants", stats.impact.plants],
        ["Average Defuses", stats.impact.defuses],
      ],
    },
    {
      title: "Map Pool",
      cards: [
        ["Best Map by Win Rate", stats.mapPool.bestMap],
        ["Most Played Map", stats.mapPool.mostPlayedMap],
      ],
    },
    {
      title: "Agent / Comp",
      cards: [
        ["Most Used Agent", stats.agentComp.mostUsedAgent],
        ["Best Performing Agent", stats.agentComp.bestAgent],
        ["Most Used 5-Agent Comp", stats.agentComp.mostUsedComp],
        ["Best Performing 5-Agent Comp", stats.agentComp.bestComp],
      ],
    },
  ];

  return (
    <div className="grid gap-lg">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">{group.title}</h3>
          <div className="grid grid-cols-1 gap-sm md:grid-cols-2 lg:grid-cols-4">
            {group.cards.map(([label, value]) => (
              <StatKpiCard key={label} label={label} value={typeof value === "number" ? value.toFixed(1) : value} />
            ))}
          </div>
        </div>
      ))}
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
