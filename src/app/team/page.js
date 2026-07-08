"use client";

/* eslint-disable @next/next/no-img-element */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import TopBar from "@/components/TopBar";
import { aggregateCharacterAnalytics } from "@/lib/dashboard/character-analytics";
import { getCurrentUser } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { getDefaultRankForGame, getDisplayModeForTeam, getRanksForGame, normalizeTeamLocation } from "@/lib/game-options";

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

const MAX_PROFILE_URL_LENGTH = 500;

function getProfileUrlError(value = "") {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";
  if (trimmedValue.length > MAX_PROFILE_URL_LENGTH) {
    return `Profile links must be ${MAX_PROFILE_URL_LENGTH} characters or fewer.`;
  }

  try {
    const profileUrl = new URL(trimmedValue);
    if (profileUrl.protocol !== "https:") return "Profile links must use HTTPS.";
    if (profileUrl.username || profileUrl.password) {
      return "Profile links cannot include embedded sign-in information.";
    }
  } catch {
    return "Enter a complete HTTPS profile link.";
  }

  return "";
}

function getSafeProfileUrl(value = "") {
  return getProfileUrlError(value) ? "" : value.trim();
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
    pending: "bg-tertiary-fixed text-on-tertiary-fixed",
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
  const rosterTeamContextRef = useRef("");

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

    const { data: authData, error: authError } = await getCurrentUser();
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

    let { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, type, verified_flag, region, logo_url")
      .eq("id", profile.org_id)
      .maybeSingle();

    if (orgError?.code === "42703" || orgError?.code === "PGRST204" || orgError?.message?.includes("logo_url")) {
      ({ data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, type, verified_flag, region")
        .eq("id", profile.org_id)
        .maybeSingle());
    }

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
    const nextRosterContext = `${selectedTeam.id}:${selectedTeam.game_title}`;
    if (rosterTeamContextRef.current === nextRosterContext) return;
    rosterTeamContextRef.current = nextRosterContext;
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
    const profileUrlError = getProfileUrlError(newPlayer.profile_url);
    if (profileUrlError) {
      setRosterError(profileUrlError);
      return;
    }
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

    const playerWithUnsafeProfileUrl = rosterPlayers.find((player) => getProfileUrlError(player.profile_url));
    if (playerWithUnsafeProfileUrl) {
      setRosterError(`${playerWithUnsafeProfileUrl.name || "Player"}: ${getProfileUrlError(playerWithUnsafeProfileUrl.profile_url)}`);
      return;
    }

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
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-sm mb-xs">
                  <h1 className="font-headline-1 text-on-surface">{selectedTeam.name}</h1>
                  {organization?.verified_flag && <MaterialSymbol className="text-primary text-[20px]" fill>verified</MaterialSymbol>}
                </div>
                <p className="font-body-sub text-on-surface-variant mb-md">
                  {organization?.name || "Your organization"} • {normalizeTeamLocation(selectedTeam.region) || "Location not set"}
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

            <div className="grid grid-cols-1 gap-lg xl:grid-cols-2 xl:items-start">
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

            <div className="mt-lg grid grid-cols-1 gap-lg">
              <RosterManagementSection
                gameTitle={selectedTeam.game_title}
                newPlayer={newPlayer}
                onAddPlayer={handleAddPlayer}
                onNewPlayerChange={handleNewPlayerChange}
                onRemovePlayer={handleRemovePlayer}
                onRosterPlayerChange={handleRosterPlayerChange}
                onSaveRoster={handleSaveRoster}
                rosterError={rosterError}
                rosterPlayers={rosterPlayers}
                rosterSuccess={rosterSuccess}
                savingRoster={savingRoster}
              />
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
      <TopBar
        actions={(
          <Link
            aria-label="Create team"
            className="hidden h-10 items-center justify-center gap-xs rounded-xl bg-primary px-md font-label-bold text-label-bold text-on-primary shadow-[0_6px_18px_rgba(0,88,188,0.22)] transition-colors hover:bg-on-primary-fixed-variant active:scale-95 sm:flex"
            href="/team/new"
            title="Create team"
          >
            <MaterialSymbol className="text-[18px]" fill>add</MaterialSymbol>
            Team
          </Link>
        )}
      />

      <main className="pt-6 pb-[100px] md:pb-xl px-margin-mobile md:px-xl max-w-[1200px] mx-auto min-h-screen">
        {children}
      </main>

      <BottomNav />
    </>
  );
}

function TeamReviewStats({ className = "mb-lg", gameTitle, kpis, reviews = [], teamId }) {
  return (
    <section className={`${className} rounded-xl border border-surface-variant bg-surface-container-lowest p-md shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]`}>
      <div className="mb-md flex flex-col gap-xs sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-headline-3 text-on-surface">Team Stats</h2>
          <p className="font-body-sub text-body-sub text-on-surface-variant">
            Performance trends from every saved match review for this team.
          </p>
        </div>
        <div className="flex flex-col gap-xs sm:items-end">
          <span className="font-label-small text-label-small uppercase tracking-wide text-outline">Saved match reviews</span>
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

function RosterManagementSection({
  gameTitle,
  newPlayer,
  onAddPlayer,
  onNewPlayerChange,
  onRemovePlayer,
  onRosterPlayerChange,
  onSaveRoster,
  rosterError,
  rosterPlayers,
  rosterSuccess,
  savingRoster,
}) {
  const activeRosterCount = rosterPlayers.filter((player) => player.name.trim()).length;

  return (
    <details className="group rounded-xl border border-surface-variant bg-surface-container-lowest shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
      <summary className="flex cursor-pointer list-none flex-col gap-sm p-md marker:hidden sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-sm">
          <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-primary">
            <MaterialSymbol className="text-[22px]">groups</MaterialSymbol>
          </span>
          <div>
            <h2 className="font-headline-3 text-on-surface">Roster Management</h2>
            <p className="font-body-sub text-body-sub text-on-surface-variant">
              Edit player names, ranks, and profile links when you need to update the team.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <span className="rounded-full bg-surface-container px-3 py-1 font-label-small text-label-small text-on-surface-variant">
            {activeRosterCount} players
          </span>
          <MaterialSymbol className="text-[22px] text-on-surface-variant transition-transform group-open:rotate-180">expand_more</MaterialSymbol>
        </div>
      </summary>

      <div className="border-t border-surface-variant p-md">
        <div className="grid gap-sm md:grid-cols-2">
          {rosterPlayers.length === 0 ? (
            <div className="rounded-lg bg-surface-container-low p-md font-body-sub text-body-sub text-on-surface-variant md:col-span-2">
              No players added yet.
            </div>
          ) : (
            rosterPlayers.map((player, index) => (
              <div key={`${player.name}-${index}`} className="grid grid-cols-[auto_1fr_auto] gap-sm rounded-lg bg-surface-container-low p-sm">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed font-label-bold text-on-primary-fixed">
                  {getInitials(player.name || "P")}
                </div>
                <div className="grid min-w-0 gap-xs">
                  <input
                    className="min-w-0 rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-label-bold text-label-bold text-on-surface focus:ring-2 focus:ring-primary"
                    onChange={(event) => onRosterPlayerChange(index, "name", event.target.value)}
                    placeholder="Player name"
                    value={player.name}
                  />
                  <div className="grid grid-cols-1 gap-xs sm:grid-cols-2">
                    <select
                      className="min-w-0 rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-label-small text-label-small text-on-surface focus:ring-2 focus:ring-primary"
                      onChange={(event) => onRosterPlayerChange(index, "rank", event.target.value)}
                      value={player.rank}
                    >
                      {getRanksForGame(gameTitle).map((rank) => (
                        <option key={rank} value={rank}>{rank}</option>
                      ))}
                    </select>
                    <input
                      className="min-w-0 rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-label-small text-label-small text-on-surface focus:ring-2 focus:ring-primary"
                      maxLength={MAX_PROFILE_URL_LENGTH}
                      onChange={(event) => onRosterPlayerChange(index, "profile_url", event.target.value)}
                      placeholder="HTTPS profile link (optional)"
                      type="url"
                      value={player.profile_url}
                    />
                  </div>
                  {getSafeProfileUrl(player.profile_url) && (
                    <a
                      className="font-label-small text-label-small text-primary underline"
                      href={getSafeProfileUrl(player.profile_url)}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View profile
                    </a>
                  )}
                </div>
                <button
                  className="self-start rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high"
                  onClick={() => onRemovePlayer(index)}
                  type="button"
                >
                  <MaterialSymbol className="text-[18px]">close</MaterialSymbol>
                </button>
              </div>
            ))
          )}
        </div>

        <form className="mt-md grid gap-sm" onSubmit={onAddPlayer}>
          <p className="rounded-lg bg-surface-container-low px-md py-sm font-label-small text-label-small text-on-surface-variant">
            Optional links must use HTTPS and point to a coach-approved game, ranking, or tournament profile. Do not add personal social media, contact details, private accounts, or unrelated pages. Saved roster links are not included on the public Scrim Board.
          </p>
          <input
            className="min-w-0 rounded-lg border-none bg-surface-container-low px-md py-sm font-body-sub text-body-sub text-on-surface focus:ring-2 focus:ring-primary"
            onChange={(event) => onNewPlayerChange("name", event.target.value)}
            placeholder="Add player name"
            value={newPlayer.name}
          />
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-[1fr_1.4fr_auto]">
            <select
              className="min-w-0 rounded-lg border-none bg-surface-container-low px-md py-sm font-body-sub text-body-sub text-on-surface focus:ring-2 focus:ring-primary"
              onChange={(event) => onNewPlayerChange("rank", event.target.value)}
              value={newPlayer.rank}
            >
              {getRanksForGame(gameTitle).map((rank) => (
                <option key={rank} value={rank}>{rank}</option>
              ))}
            </select>
            <input
              className="min-w-0 rounded-lg border-none bg-surface-container-low px-md py-sm font-body-sub text-body-sub text-on-surface focus:ring-2 focus:ring-primary"
              maxLength={MAX_PROFILE_URL_LENGTH}
              onChange={(event) => onNewPlayerChange("profile_url", event.target.value)}
              placeholder="HTTPS profile link (optional)"
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
          onClick={onSaveRoster}
          type="button"
        >
          {savingRoster ? "Saving..." : "Save Roster"}
        </button>
      </div>
    </details>
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

function getReviewStatValue(review, stat, side = "team") {
  const value = getReviewStat(review, stat.statKeys, stat.rowKeys, { average: stat.average, side });
  if (!stat.perMinute) return value;

  const minutes = getReviewDurationMinutes(review);
  if (value === null || !Number.isFinite(minutes) || minutes <= 0) return null;
  return value / minutes;
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

function formatSignedStat(value, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const formatted = abs >= 10_000
    ? formatDeepStatValue(abs)
    : new Intl.NumberFormat("en-US", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return decimals ? "0.0" : "0";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function formatRatioPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "—";
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

function averageFinite(values, decimals = 1) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (!validValues.length) return null;
  const average = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  return Number(average.toFixed(decimals));
}

function getReviewScoreDiff(review) {
  const teamScore = normalizeExtractedNumber(review.team_score);
  const opponentScore = normalizeExtractedNumber(review.opponent_score);
  return teamScore === null || opponentScore === null ? null : teamScore - opponentScore;
}

function getWeakestStatTrend(stats = {}) {
  const candidates = [
    ...(stats.impact || []),
    ...(stats.differentials || []),
    ...(stats.teamOutput || []).map((stat) => {
      const lowerBetter = stats.config?.betterWhenLower?.includes(stat.label);
      const diff = Number.isFinite(stat.ours) && Number.isFinite(stat.theirs)
        ? stat.ours - stat.theirs
        : null;
      return {
        ...stat,
        diff: lowerBetter && diff !== null ? -diff : diff,
      };
    }),
  ]
    .map((stat) => {
      if (!Number.isFinite(stat.diff)) return null;
      const lowerBetter = stats.config?.betterWhenLower?.includes(stat.label);
      const adjustedDiff = lowerBetter ? -stat.diff : stat.diff;
      return {
        label: stat.label,
        value: adjustedDiff,
        display: formatSignedStat(stat.diff, stat.decimals ?? 1),
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.value - second.value);

  const weakest = candidates[0];
  if (!weakest || weakest.value >= 0) {
    return {
      label: "No clear weak trend",
      detail: "Saved reviews do not show a major negative stat gap yet.",
      tone: "neutral",
    };
  }

  return {
    label: weakest.label,
    detail: `${weakest.display} average gap`,
    tone: "negative",
  };
}

function getAverageMarginSummary(reviews = [], config = {}) {
  const scoreDiffs = reviews
    .map(getReviewScoreDiff)
    .filter((value) => value !== null);

  if (scoreDiffs.length) {
    return {
      label: config.scoreDiffLabel || "Average Score Differential",
      value: averageFinite(scoreDiffs, 1),
      source: "From visible final scores.",
    };
  }

  const differentialCandidates = [
    ...(config.differentials || []),
    ...(config.impact || []).filter((stat) => stat.differentialOnly),
  ];

  for (const stat of differentialCandidates) {
    const diffs = reviews
      .map((review) => {
        const ours = getReviewStatValue(review, stat);
        const theirs = getReviewStatValue(review, stat, "opponent");
        return ours === null || theirs === null ? null : ours - theirs;
      })
      .filter((value) => value !== null);

    if (diffs.length) {
      return {
        label: stat.label.startsWith("Average ") ? stat.label : `Average ${stat.label}`,
        value: averageFinite(diffs, stat.decimals ?? 1),
        source: "From team vs opponent stat totals.",
      };
    }
  }

  return {
    label: config.scoreDiffLabel || "Average Margin",
    value: null,
    source: "No visible margin data yet.",
  };
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
    title: "Valorant",
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
    title: "League of Legends",
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
      { label: "Gold / Min", statKeys: "total_gold", rowKeys: "gold", perMinute: true, decimals: 0 },
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
    title: "Counter-Strike 2",
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
    title: "Rocket League",
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
    title: "Overwatch 2",
    scoreDiffLabel: "Average Score Differential",
    pickField: "hero",
    pickLabel: "Hero",
    compLabel: "Hero Comp",
    mapLabel: "Map / Mode",
    betterWhenLower: ["Average Deaths"],
    output: [
      { label: "Eliminations", statKeys: ["total_eliminations", "eliminations", "team_kills"], rowKeys: ["eliminations", "kills"] },
      { label: "Average Deaths", statKeys: ["total_deaths", "deaths", "team_deaths"], rowKeys: "deaths" },
      { label: "Assists", statKeys: ["total_assists", "assists", "team_assists"], rowKeys: "assists" },
      { label: "Damage", statKeys: ["total_damage", "damage"], rowKeys: "damage" },
      { label: "Healing", statKeys: ["total_healing", "healing"], rowKeys: "healing" },
      { label: "Mitigation", statKeys: ["total_mitigation", "mitigation"], rowKeys: ["mitigation", "damage_blocked"] },
      { label: "Final Blows", statKeys: "final_blows", rowKeys: "final_blows" },
      { label: "Objective Kills", statKeys: "objective_kills", rowKeys: "objective_kills" },
    ],
    impact: [
      { label: "Damage Differential", statKeys: ["total_damage", "damage"], rowKeys: "damage", differentialOnly: true },
      { label: "Healing Differential", statKeys: ["total_healing", "healing"], rowKeys: "healing", differentialOnly: true },
      { label: "Mitigation Differential", statKeys: ["total_mitigation", "mitigation"], rowKeys: ["mitigation", "damage_blocked"], differentialOnly: true },
      { label: "Elimination Differential", statKeys: ["total_eliminations", "eliminations", "team_kills"], rowKeys: ["eliminations", "kills"], differentialOnly: true },
    ],
  },
  "Marvel Rivals": {
    title: "Marvel Rivals",
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
    title: "Deadlock",
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
      { label: "Souls / Min", statKeys: ["total_souls", "souls", "net_worth"], rowKeys: ["souls", "net_worth"], perMinute: true, decimals: 0 },
      { label: "Player Damage", statKeys: "player_damage", rowKeys: "player_damage" },
      { label: "Objective Damage", statKeys: "objective_damage", rowKeys: "objective_damage" },
    ],
    impact: [
      { label: "Soul Differential", statKeys: ["total_souls", "souls", "net_worth"], rowKeys: ["souls", "net_worth"], differentialOnly: true },
      { label: "Objective Damage Differential", statKeys: "objective_damage", rowKeys: "objective_damage", differentialOnly: true },
    ],
  },
  SSBU: {
    title: "SSBU",
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
    title: "Honor of Kings",
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
      { label: "Damage", statKeys: ["total_damage", "damage"], rowKeys: "damage" },
      { label: "Damage Taken", statKeys: "damage_taken", rowKeys: "damage_taken" },
      { label: "Healing", statKeys: "healing", rowKeys: "healing" },
    ],
    impact: [
      { label: "Gold Differential", statKeys: "total_gold", rowKeys: "gold", differentialOnly: true },
      { label: "Damage Differential", statKeys: ["total_damage", "damage"], rowKeys: "damage", differentialOnly: true },
      { label: "Damage Taken Differential", statKeys: "damage_taken", rowKeys: "damage_taken", differentialOnly: true },
      { label: "Healing Differential", statKeys: "healing", rowKeys: "healing", differentialOnly: true },
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
      const ours = getReviewStatValue(review, stat);
      const theirs = getReviewStatValue(review, stat, "opponent");
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
  const teamOutput = config.output.map((stat) => ({
    ...stat,
    ours: avg(sortedReviews.map((review) => getReviewStatValue(review, stat)), stat.decimals ?? 1),
    theirs: avg(sortedReviews.map((review) => getReviewStatValue(review, stat, "opponent")), stat.decimals ?? 1),
  }));
  const impact = config.impact.map((stat) => ({
    ...stat,
    ours: avg(sortedReviews.map((review) => getReviewStatValue(review, stat)), stat.decimals ?? 1),
    theirs: avg(sortedReviews.map((review) => getReviewStatValue(review, stat, "opponent")), stat.decimals ?? 1),
    diff: avg(getDiffsForStat(stat), stat.decimals ?? 1),
    trend: getDiffsForStat(stat).slice().reverse(),
  }));
  const differentials = (config.differentials || []).map((stat) => ({
    ...stat,
    diff: avg(getDiffsForStat(stat), stat.decimals ?? 1),
    trend: getDiffsForStat(stat).slice().reverse(),
  }));
  const lastFiveReviews = sortedReviews.slice(0, 5);
  const lastFiveOutcomes = lastFiveReviews.map(getReviewOutcome).filter(Boolean);
  const lastFiveWins = lastFiveOutcomes.filter((outcome) => outcome === "win").length;
  const lastFiveLosses = lastFiveOutcomes.filter((outcome) => outcome === "loss").length;
  const marginSummary = getAverageMarginSummary(sortedReviews, config);
  const formStats = {
    lastFiveReviews: lastFiveReviews.length,
    lastFiveSequence: lastFiveReviews.map((review) => getReviewOutcome(review) || "unknown"),
    lastFiveWins,
    lastFiveLosses,
    averageMargin: marginSummary.value,
    averageMarginLabel: marginSummary.label,
    averageMarginSource: marginSummary.source,
    mostPlayedComp: mostUsedComp
      ? {
        label: mostUsedComp[0],
        detail: `${mostUsedComp[1]} ${mostUsedComp[1] === 1 ? "review" : "reviews"}`,
      }
      : null,
    strongestMap: bestMap
      ? {
        label: bestMap[0],
        detail: `${formatPercent(getWinRate(bestMap[1].wins, bestMap[1].total))} win rate · ${bestMap[1].total} ${bestMap[1].total === 1 ? "review" : "reviews"}`,
      }
      : null,
    weakestTrend: null,
  };

  const aggregateStats = {
    config,
    gameTitle,
    totalReviews: sortedReviews.length,
    wins,
    losses,
    winRate: getWinRate(wins, wins + losses),
    averageRoundDiff: averageValues(roundDiffs),
    teamOutput,
    impact,
    differentials,
    form: formStats,
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
    characterComfort: aggregateCharacterAnalytics(sortedReviews, gameTitle),
    league: gameTitle === "League of Legends" ? buildLeagueInsights(sortedReviews) : null,
  };
  aggregateStats.form.weakestTrend = getWeakestStatTrend(aggregateStats);
  return aggregateStats;
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
          <h3 className="font-headline-3 text-headline-3 text-on-surface">
            {gameTitle === "Valorant" ? `Valorant Stats · ${reviews.length} ${reviews.length === 1 ? "Review" : "Reviews"}` : stats.config.title}
          </h3>
          <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
            {gameTitle === "Valorant"
              ? `Showing ${timelineOption.label.toLowerCase()}.`
              : `Showing ${timelineOption.label.toLowerCase()} from ${reviews.length} saved ${reviews.length === 1 ? "review" : "reviews"}.`}
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
            body="Upload a post-game screenshot to start building this review summary."
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
      ) : gameTitle === "Valorant" ? (
        <ValorantDeepStats stats={stats} />
      ) : gameTitle === "League of Legends" ? (
        <LeagueDeepStats stats={stats} />
      ) : gameTitle === "Overwatch 2" ? (
        <OverwatchDeepStats stats={stats} />
      ) : gameTitle === "Marvel Rivals" ? (
        <MarvelRivalsDeepStats stats={stats} />
      ) : gameTitle === "Deadlock" ? (
        <DeadlockDeepStats stats={stats} />
      ) : gameTitle === "Counter-Strike 2" ? (
        <CounterStrikeDeepStats stats={stats} />
      ) : gameTitle === "Rocket League" ? (
        <RocketLeagueDeepStats stats={stats} />
      ) : gameTitle === "SSBU" ? (
        <SsbuDeepStats stats={stats} />
      ) : gameTitle === "Honor of Kings" ? (
        <HonorOfKingsDeepStats stats={stats} />
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
  const form = stats.form || {};
  const resultDots = Array.from({ length: 5 }).map((_, index) => form.lastFiveSequence?.[index] || "empty");

  return (
    <div className="grid gap-md">
      <section className="grid gap-sm md:grid-cols-3">
        <StatKpiCard label="Recent Form" value={`${form.lastFiveWins || 0}W - ${form.lastFiveLosses || 0}L`}>
          <div>
            <p className="mt-xs font-headline-2 text-headline-2 text-primary">{form.lastFiveWins || 0}W - {form.lastFiveLosses || 0}L</p>
            <p className="mt-0.5 font-label-small text-label-small text-on-surface-variant">Last 5 reviewed games</p>
            <div className="mt-sm flex gap-xs">
              {resultDots.map((result, index) => (
                <span
                  className={`h-2.5 flex-1 rounded-full ${
                    result === "win"
                      ? "bg-primary"
                      : result === "loss"
                        ? "bg-error"
                        : result === "unknown"
                          ? "bg-outline"
                          : "bg-surface-container-high"
                  }`}
                  key={`${result}-${index}`}
                  title={result}
                />
              ))}
            </div>
          </div>
        </StatKpiCard>
        <StatKpiCard label={form.averageMarginLabel || "Average Margin"} value={formatSignedStat(form.averageMargin, 1)}>
          <p className="mt-xs font-headline-2 text-headline-2 text-primary">{formatSignedStat(form.averageMargin, 1)}</p>
          {form.averageMarginSource && <p className="mt-xs font-label-small text-label-small text-on-surface-variant">{form.averageMarginSource}</p>}
        </StatKpiCard>
        <StatKpiCard label={`Strongest ${stats.config.mapLabel.toLowerCase()}`}>
          <p className="mt-xs font-headline-3 text-headline-3 text-on-surface">{form.strongestMap?.label || "—"}</p>
          {form.strongestMap?.detail && <p className="mt-xs font-label-small text-label-small text-primary">{form.strongestMap.detail}</p>}
        </StatKpiCard>
      </section>

      <section className="grid gap-sm md:grid-cols-3">
        <TeamFormCompCard
          gameTitle={stats.gameTitle}
          label="Most-played comp"
          value={form.mostPlayedComp ? `${form.mostPlayedComp.label} · ${form.mostPlayedComp.detail}` : "—"}
        />
        <FeatureCard
          icon="trending_down"
          label="Stat trend"
          value={form.weakestTrend ? `${form.weakestTrend.label} · ${form.weakestTrend.detail}` : "—"}
        />
        <RecordSummaryCard
          losses={stats.losses}
          reviews={stats.totalReviews}
          winRate={stats.winRate}
          wins={stats.wins}
        />
      </section>
    </div>
  );
}

function RecordSummaryCard({ losses, reviews, winRate, wins }) {
  const items = [
    { label: "Win rate", value: formatPercent(winRate) },
    { label: "Total record", value: `${wins}W - ${losses}L` },
    { label: "Reviews", value: reviews },
  ];

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <p className="font-label-small text-label-small text-on-surface-variant">Season summary</p>
      <div className="mt-sm grid gap-xs">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-md rounded-xl bg-surface-container-lowest px-sm py-2" key={item.label}>
            <span className="font-label-small text-label-small text-on-surface-variant">{item.label}</span>
            <span className="font-label-bold text-label-bold text-on-surface">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDeepStatValue(value) {
  if (typeof value !== "number") return value || "—";
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  // Match the dashboard formatLargeStat behavior: keep small stats precise,
  // compact large ones to "k" / "M" so souls and damage are scannable.
  if (abs >= 1_000_000) {
    return `${trimDeepStatTrailingZero((value / 1_000_000).toFixed(1))}M`;
  }
  if (abs >= 10_000) {
    return `${trimDeepStatTrailingZero((value / 1000).toFixed(1))}k`;
  }
  return value.toFixed(1);
}

function trimDeepStatTrailingZero(value) {
  return String(value).replace(/\.0$/, "");
}

// Returns the percentage by which `ours` exceeds `theirs`, rounded to a whole
// number. Positive = your edge, negative = opponent edge. Returns null when
// either value is missing or the opponent is zero.
function calcDeepStatPercentGap(ours, theirs) {
  const ourValue = Number(ours);
  const theirValue = Number(theirs);
  if (!Number.isFinite(ourValue) || !Number.isFinite(theirValue)) return null;
  if (theirValue === 0) return null;
  return Math.round(((ourValue - theirValue) / Math.abs(theirValue)) * 100);
}

// Appends a parenthesized percent gap to a formatted differential string when
// the gap is meaningful. Produces e.g. "+1.2k (+8%)" or "−54 (−5%)".
function appendPercentGapText(baseText, percentGap) {
  if (percentGap === null || percentGap === undefined) return baseText;
  const formatted = percentGap > 0 ? `+${percentGap}%` : `${percentGap}%`;
  return `${baseText} (${formatted})`;
}

function ComparisonBar({ label, ours, theirs, note }) {
  const hasValues = Number.isFinite(ours) && Number.isFinite(theirs);
  const max = hasValues ? Math.max(Math.abs(ours), Math.abs(theirs), 1) : 1;
  const ourWidth = hasValues ? `${readableBarWidth(Math.abs(ours), max)}%` : "0%";
  const theirWidth = hasValues ? `${readableBarWidth(Math.abs(theirs), max)}%` : "0%";
  const gap = hasValues ? calcDeepStatPercentGap(ours, theirs) : null;
  const gapTone = gap === null
    ? "bg-surface-container text-on-surface-variant"
    : gap > 0
      ? "bg-primary-fixed text-primary"
      : gap < 0
        ? "bg-error-container text-error"
        : "bg-surface-container text-on-surface-variant";
  const gapLabel = gap === null
    ? "—"
    : gap > 0
      ? `+${gap}% you`
      : gap < 0
        ? `${gap}% opp`
        : "Even";

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="font-label-bold text-label-bold text-on-surface">{label}</p>
          {note && <p className="mt-0.5 font-label-small text-label-small text-on-surface-variant">{note}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 font-label-small text-label-small ${gapTone}`}>
            {gapLabel}
          </span>
          <div className="text-right font-label-bold text-label-bold">
            <span className="text-primary">{formatDeepStatValue(ours)}</span>
            <span className="mx-xs text-outline">vs</span>
            <span className="text-error">{formatDeepStatValue(theirs)}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-sm">
        <div className="h-3.5 overflow-hidden rounded-full bg-primary-fixed">
          <div className="h-full rounded-full bg-primary" style={{ width: ourWidth }} />
        </div>
        <div className="h-3.5 overflow-hidden rounded-full bg-error-container">
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

function TeamFormCompCard({ gameTitle, label, value }) {
  const { picks, meta } = splitCompPicks(value);

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <p className="font-label-small text-label-small text-on-surface-variant">{label}</p>
      {picks.length ? (
        <>
          <div className="mt-sm flex flex-wrap gap-xs" aria-label={picks.join(", ")}>
            {picks.map((pick, index) => (
              <div className="-mr-2" key={`${pick}-${index}`} title={pick}>
                <PickAvatar gameTitle={gameTitle} name={pick} size="sm" />
              </div>
            ))}
          </div>
          {meta && <p className="mt-xs font-label-small text-label-small text-primary">{meta}</p>}
        </>
      ) : (
        <div className="mt-sm flex items-center gap-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <MaterialSymbol className="text-[21px]">groups</MaterialSymbol>
          </div>
          <p className="font-headline-3 text-headline-3 text-on-surface">—</p>
        </div>
      )}
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
          <div className="mt-sm flex flex-wrap gap-xs" aria-label={picks.join(", ")}>
            {picks.map((pick, index) => (
              <div className="-mr-2" key={`${pick}-${index}`} title={pick}>
                <PickAvatar gameTitle={gameTitle} name={pick} size="sm" />
              </div>
            ))}
          </div>
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

function CharacterStatSummaryCard({ gameTitle, item, label, type = "character" }) {
  const isComp = type === "comp";
  const primary = isComp ? item?.comp_key : item?.name;

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <p className="font-label-small text-label-small text-on-surface-variant">{label}</p>
      {primary ? (
        isComp ? (
          <>
            <div className="mt-sm flex flex-wrap gap-xs" aria-label={item.characters?.join(", ") || item.comp_key}>
              {item.characters?.map((pick, index) => (
                <div className="-mr-2" key={`${pick}-${index}`} title={pick}>
                  <PickAvatar gameTitle={gameTitle} name={pick} size="sm" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-sm flex items-center gap-sm">
            <PickAvatar gameTitle={gameTitle} name={primary} />
            <p className="min-w-0 truncate font-headline-3 text-headline-3 text-on-surface">{primary}</p>
          </div>
        )
      ) : (
        <p className="mt-sm font-headline-3 text-headline-3 text-on-surface">—</p>
      )}
      {item && (
        <p className="mt-xs font-label-small text-label-small text-primary">
          {item.games} {item.games === 1 ? "game" : "games"}
          {!item.small_sample && item.win_rate !== null && item.win_rate !== undefined ? ` · ${formatRatioPercent(item.win_rate)} WR` : ""}
          {item.small_sample ? " · small sample" : ""}
        </p>
      )}
    </div>
  );
}

function CharacterTopList({ gameTitle, items = [], label, title }) {
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <h4 className="font-headline-3 text-headline-3 text-on-surface">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-sm font-body-sub text-body-sub text-on-surface-variant">No valid {label.toLowerCase()} picks found.</p>
      ) : (
        <div className="mt-sm grid gap-xs">
          {items.map((item) => (
            <div className="flex items-center gap-sm rounded-xl bg-surface-container-lowest p-sm" key={item.name}>
              <PickAvatar gameTitle={gameTitle} name={item.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-bold text-label-bold text-on-surface">{item.name}</p>
                <p className="font-label-small text-label-small text-on-surface-variant">
                  {item.games} {item.games === 1 ? "pick" : "picks"}
                  {item.pick_rate !== null && item.pick_rate !== undefined ? ` · ${formatRatioPercent(item.pick_rate)} pick rate` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-label-bold text-label-bold text-primary">{item.small_sample ? "—" : formatRatioPercent(item.win_rate)}</p>
                {item.small_sample && <p className="font-label-small text-[10px] text-outline">Small sample</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCharacterMetricValue(metric) {
  if (!Number.isFinite(metric?.value)) return "—";
  const decimals = metric.decimals ?? 1;
  return formatDeepStatValue(Number(metric.value.toFixed(decimals)));
}

function CharacterPerformancePanel({ analytics, gameTitle }) {
  const items = analytics?.characterPerformance || [];
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm">
        <h4 className="font-headline-3 text-headline-3 text-on-surface">{analytics.label} Stats</h4>
        <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
          Average screenshot stats by {analytics.label.toLowerCase()} across saved reviews.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
        {items.map((item) => (
          <div className="rounded-xl bg-surface-container-lowest p-sm" key={item.name}>
            <div className="flex items-center gap-sm">
              <PickAvatar gameTitle={gameTitle} name={item.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-bold text-label-bold text-on-surface">{item.name}</p>
                <p className="font-label-small text-label-small text-on-surface-variant">
                  {item.games} {item.games === 1 ? "review" : "reviews"} · {item.small_sample ? "Small sample" : `${formatRatioPercent(item.win_rate)} win rate`}
                </p>
              </div>
            </div>
            <div className="mt-sm grid grid-cols-3 gap-xs sm:grid-cols-5">
              {item.metrics.slice(0, 5).map((metric) => (
                <div className="rounded-lg bg-surface-container-low px-xs py-1 text-center" key={metric.key}>
                  <p className="font-label-small text-[9px] uppercase tracking-wide text-outline">{metric.label}</p>
                  <p className="font-label-bold text-[11px] text-on-surface">{formatCharacterMetricValue(metric)}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function pluralCharacterLabel(label = "Character") {
  if (label === "Hero") return "Heroes";
  return `${label}s`;
}

function CharacterComfortPanel({ analytics, gameTitle }) {
  if (!analytics?.supported) return null;

  const hasCharacterData = analytics.ourTopCharacters.length || analytics.enemyTopCharacters.length || analytics.mostUsedComp;
  const pluralLabel = pluralCharacterLabel(analytics.label);

  return (
    <section>
      <div className="mb-sm">
        <h3 className="font-headline-3 text-headline-3 text-on-surface">{analytics.comfortTitle}</h3>
        <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
          See what your team plays most, what opponents commonly pick, and what performs best over time.
        </p>
      </div>

      {!hasCharacterData ? (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-lg text-center">
          <h4 className="font-headline-3 text-headline-3 text-on-surface">No character comfort data yet.</h4>
          <p className="mx-auto mt-xs max-w-md font-body-sub text-body-sub text-on-surface-variant">
            Upload and save post-game reviews to start tracking your {analytics.label.toLowerCase()} pool.
          </p>
        </div>
      ) : (
        <div className="grid gap-sm">
          <CharacterPerformancePanel analytics={analytics} gameTitle={gameTitle} />
          <div className="grid grid-cols-1 gap-sm md:grid-cols-2 xl:grid-cols-3">
            <CharacterStatSummaryCard gameTitle={gameTitle} item={analytics.mostUsedCharacter} label={`Most Used ${analytics.label}`} />
            <CharacterStatSummaryCard gameTitle={gameTitle} item={analytics.bestPerformingCharacter} label={`Best Performing ${analytics.label}`} />
            <CharacterStatSummaryCard gameTitle={gameTitle} item={analytics.mostCommonEnemyCharacter} label={`Most Common Enemy ${analytics.label}`} />
            <CharacterStatSummaryCard gameTitle={gameTitle} item={analytics.mostUsedComp} label="Most Used Comp" type="comp" />
            <CharacterStatSummaryCard gameTitle={gameTitle} item={analytics.bestPerformingComp} label="Best Performing Comp" type="comp" />
            <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
              <p className="font-label-small text-label-small text-on-surface-variant">Comfort Pick Rate</p>
              <p className="mt-sm font-headline-2 text-headline-2 text-primary">{formatRatioPercent(analytics.comfortPickRate)}</p>
              <p className="mt-xs font-label-small text-label-small text-on-surface-variant">
                Share of appearances from your top 3 most-used {analytics.label.toLowerCase()}s.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
            <CharacterTopList gameTitle={gameTitle} items={analytics.ourTopCharacters} label={analytics.label} title={`Top 5 Our ${pluralLabel}`} />
            <CharacterTopList gameTitle={gameTitle} items={analytics.enemyTopCharacters} label={analytics.label} title={`Top 5 Enemy ${pluralLabel}`} />
          </div>
        </div>
      )}
    </section>
  );
}

function ImpactDifferentialCard({ stat }) {
  const hasDiff = Number.isFinite(stat.diff);
  const diff = hasDiff ? stat.diff : 0;
  const percentGap = calcDeepStatPercentGap(stat.ours, stat.theirs);
  const trend = Array.isArray(stat.trend) ? stat.trend.filter(Number.isFinite) : [];
  const scale = Math.max(1, ...trend.map((value) => Math.abs(value)), Math.abs(diff));
  const position = hasDiff ? Math.max(10, Math.min(90, 50 + (diff / scale) * 38)) : 50;
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
        <div className="flex flex-col items-end">
          <p className={`font-headline-3 text-headline-3 ${valueTone}`}>
            {hasDiff ? formatSignedValue(diff) : "—"}
          </p>
          {percentGap !== null && (
            <span className={`mt-0.5 font-label-small text-label-small ${valueTone}`}>
              {percentGap > 0 ? `+${percentGap}%` : `${percentGap}%`}
            </span>
          )}
        </div>
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
        ? `Opponent is winning fights by ${Math.abs(killDiff).toFixed(1)} kills.`
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

function KdaBalanceBar({ kills, deaths, assists }) {
  const k = Math.max(0, Number(kills) || 0);
  const d = Math.max(0, Number(deaths) || 0);
  const a = Math.max(0, Number(assists) || 0);
  const total = k + d + a;
  const kPct = total > 0 ? (k / total) * 100 : 0;
  const dPct = total > 0 ? (d / total) * 100 : 0;
  const aPct = total > 0 ? (a / total) * 100 : 0;
  const ratio = d > 0 ? ((k + a) / d) : null;
  const ratioLabel = total === 0 ? "—" : ratio === null ? "Perfect" : ratio.toFixed(2);

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-md flex items-end justify-between">
        <div>
          <p className="font-label-small text-label-small text-on-surface-variant">KDA Balance</p>
          <p className="mt-0.5 font-headline-2 text-headline-2 text-on-surface">{ratioLabel}</p>
        </div>
        <div className="flex items-center gap-xs font-label-small text-label-small">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#1B5E20]" />K</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-error" />D</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />A</span>
        </div>
      </div>
      {total === 0 ? (
        <div className="flex h-7 items-center justify-center rounded-full bg-surface-container-lowest font-label-small text-label-small text-on-surface-variant">
          Save more reviews
        </div>
      ) : (
        <>
          <div className="flex h-7 overflow-hidden rounded-full bg-surface-container-lowest">
            <div className="bg-[#1B5E20] transition-[width]" style={{ width: `${kPct}%` }} title={`Kills: ${k.toFixed(1)}`} />
            <div className="bg-error transition-[width]" style={{ width: `${dPct}%` }} title={`Deaths: ${d.toFixed(1)}`} />
            <div className="bg-primary transition-[width]" style={{ width: `${aPct}%` }} title={`Assists: ${a.toFixed(1)}`} />
          </div>
          <div className="mt-xs grid grid-cols-3 font-label-small text-label-small">
            <span className="text-[#1B5E20]">{k.toFixed(1)}</span>
            <span className="text-center text-error">{d.toFixed(1)}</span>
            <span className="text-right text-primary">{a.toFixed(1)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function PaceDial({ minutes }) {
  const value = Number(minutes);
  const min = 20;
  const max = 50;
  const hasValue = Number.isFinite(value);
  const clamped = hasValue ? Math.max(min, Math.min(max, value)) : min;
  const fraction = (clamped - min) / (max - min);
  // Semicircle from 180deg (left) to 0deg (right), needle angle in radians
  const angleRad = Math.PI - fraction * Math.PI;
  const cx = 100;
  const cy = 100;
  const radius = 78;
  const needleX = cx + Math.cos(angleRad) * radius * 0.85;
  const needleY = cy - Math.sin(angleRad) * radius * 0.85;

  // Build the three colored arc segments via stroke-dasharray on a circle path.
  // Total arc length for a semicircle of r=78 ≈ 245.
  const arcLen = Math.PI * radius;
  const segLen = arcLen / 3;
  const tone = !hasValue
    ? "—"
    : value < 28
      ? "Snowball pace"
      : value < 36
        ? "Even pace"
        : "Long games";

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm flex items-end justify-between">
        <div>
          <p className="font-label-small text-label-small text-on-surface-variant">Average Game Pace</p>
          <p className="mt-0.5 font-headline-2 text-headline-2 text-on-surface">{hasValue ? `${value.toFixed(1)} min` : "—"}</p>
        </div>
        <span className="rounded-full bg-primary-fixed px-sm py-1 font-label-small text-label-small text-primary">{tone}</span>
      </div>
      <svg viewBox="0 0 200 130" className="mx-auto block w-full max-w-[260px]">
        {/* Three arc segments; we draw each as a stroked circle with a dash to reveal a third. */}
        <g fill="none" strokeWidth="14" strokeLinecap="butt">
          <circle cx={cx} cy={cy} r={radius}
            stroke="#1B5E20" strokeOpacity="0.45"
            strokeDasharray={`${segLen} ${arcLen + arcLen}`}
            strokeDashoffset={arcLen}
            transform={`rotate(180 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={radius}
            stroke="#9e3d00" strokeOpacity="0.4"
            strokeDasharray={`${segLen} ${arcLen + arcLen}`}
            strokeDashoffset={arcLen - segLen}
            transform={`rotate(180 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={radius}
            stroke="#ba1a1a" strokeOpacity="0.45"
            strokeDasharray={`${segLen} ${arcLen + arcLen}`}
            strokeDashoffset={arcLen - segLen * 2}
            transform={`rotate(180 ${cx} ${cy})`} />
        </g>
        {/* Tick labels */}
        <text x="22" y="118" fontSize="10" fill="#475569">20</text>
        <text x="100" y="20" fontSize="10" textAnchor="middle" fill="#475569">35</text>
        <text x="178" y="118" fontSize="10" textAnchor="end" fill="#475569">50</text>
        {/* Needle */}
        {hasValue && (
          <>
            <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="7" fill="#0f172a" />
            <circle cx={cx} cy={cy} r="3" fill="#ffffff" />
          </>
        )}
      </svg>
    </div>
  );
}

function RoleStatCard({ role, kdaMax, goldMax, damageMax }) {
  const safeFraction = (value, max) => {
    if (!Number.isFinite(value) || max <= 0) return 0;
    return Math.max(0, Math.min(1, value / max));
  };
  const formatKda = (value) => (Number.isFinite(value) ? value.toFixed(2) : "—");

  // Each metric gets its own mini bar. KDA stays as decimal; Gold and Damage
  // use the shared compact formatter so big numbers shrink to "12.1k" etc.
  const rows = [
    { key: "kda", label: "KDA", value: formatKda(role.kda), fraction: safeFraction(role.kda, kdaMax), tone: "bg-primary" },
    { key: "gold", label: "Gold", value: formatDeepStatValue(role.gold), fraction: safeFraction(role.gold, goldMax), tone: "bg-secondary" },
    { key: "damage", label: "DMG", value: formatDeepStatValue(role.damage), fraction: safeFraction(role.damage, damageMax), tone: "bg-tertiary" },
  ];

  return (
    <div className="flex flex-col gap-sm rounded-2xl border border-outline-variant/25 bg-surface-container-low p-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary-fixed px-2 py-0.5 font-label-small text-label-small text-primary">{role.role}</span>
      </div>
      <div className="flex flex-col gap-xs">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex items-baseline justify-between">
              <span className="font-label-small text-label-small text-on-surface-variant">{row.label}</span>
              <span className="font-label-bold text-label-bold text-on-surface">{row.value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container-lowest">
              <div className={`h-full rounded-full ${row.tone} transition-[width]`} style={{ width: `${row.fraction * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinLossDots({ row, lowerIsBetter = false }) {
  const wins = Number(row.wins);
  const losses = Number(row.losses);
  const hasValues = Number.isFinite(wins) && Number.isFinite(losses);
  // Build axis range with padding so dots don't sit at the very edges.
  let winsX = 50;
  let lossesX = 50;
  let gapStart = 50;
  let gapWidth = 0;
  if (hasValues) {
    const min = Math.min(wins, losses);
    const max = Math.max(wins, losses);
    const span = Math.max(max - min, Math.abs(max) * 0.4, Math.abs(min) * 0.4, 1);
    const lo = min - span * 0.4;
    const hi = max + span * 0.4;
    const range = hi - lo;
    winsX = ((wins - lo) / range) * 100;
    lossesX = ((losses - lo) / range) * 100;
    gapStart = Math.min(winsX, lossesX);
    gapWidth = Math.abs(winsX - lossesX);
  }
  const winsBetter = hasValues && (lowerIsBetter ? wins < losses : wins > losses);
  const verdict = !hasValues
    ? "Needs more reviews"
    : winsBetter
      ? "Correlates with winning"
      : Math.abs(wins - losses) < Math.abs(wins) * 0.05
        ? "No clear pattern"
        : "Correlates with losing";

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm flex items-baseline justify-between">
        <p className="font-label-bold text-label-bold text-on-surface">{row.label}</p>
        <span className={`font-label-small text-label-small ${winsBetter ? "text-[#1B5E20]" : "text-on-surface-variant"}`}>{verdict}</span>
      </div>
      <div className="relative mt-md mb-sm h-6">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-outline-variant/40" />
        {hasValues && (
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary-fixed"
            style={{ left: `${gapStart}%`, width: `${Math.max(2, gapWidth)}%` }}
          />
        )}
        {hasValues && (
          <>
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-error shadow"
              style={{ left: `${lossesX}%` }}
              title={`In losses: ${losses}`}
            />
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1B5E20] shadow"
              style={{ left: `${winsX}%` }}
              title={`In wins: ${wins}`}
            />
          </>
        )}
      </div>
      <div className="flex items-center justify-between font-label-small text-label-small">
        <span className="inline-flex items-center gap-1 text-error">
          <span className="h-2 w-2 rounded-full bg-error" />
          Losses {hasValues ? formatDeepStatValue(losses) : "—"}
        </span>
        <span className="inline-flex items-center gap-1 text-[#1B5E20]">
          Wins {hasValues ? formatDeepStatValue(wins) : "—"}
          <span className="h-2 w-2 rounded-full bg-[#1B5E20]" />
        </span>
      </div>
    </div>
  );
}

function LeagueDeepStats({ stats }) {
  const killStat = stats.teamOutput.find((stat) => stat.label === "Average Kills");
  const deathStat = stats.teamOutput.find((stat) => stat.label === "Average Deaths");
  const assistStat = stats.teamOutput.find((stat) => stat.label === "Average Assists");
  const goldStat = stats.teamOutput.find((stat) => stat.label === "Gold");
  const goldPerMinStat = stats.teamOutput.find((stat) => stat.label === "Gold / Min");
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

      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <GameKdaRibbon assists={assistStat} deaths={deathStat} kills={killStat} title="Teamfight Shape" />
        <EdgeProfileCard stats={[goldStat, damageStat, goldPerMinStat]} title="Resource Pressure Profile" />
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Map Control Signals</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          <ComparisonBar label="Gold" ours={goldStat?.ours} theirs={goldStat?.theirs} />
          <ComparisonBar label="Damage to Champions" ours={damageStat?.ours} theirs={damageStat?.theirs} />
        </div>
        <div className="mt-sm grid grid-cols-1 gap-sm md:grid-cols-3">
          <StatKpiCard
            label="Average Kill Differential"
            value={Number.isFinite(stats.averageRoundDiff)
              ? appendPercentGapText(formatSignedValue(stats.averageRoundDiff), calcDeepStatPercentGap(killStat?.ours, killStat?.theirs))
              : "—"}
          />
          <StatKpiCard
            label="Average Gold Differential"
            value={Number.isFinite(goldDiff?.diff)
              ? appendPercentGapText(formatSignedValue(goldDiff.diff, 0), calcDeepStatPercentGap(goldStat?.ours, goldStat?.theirs))
              : "—"}
          />
          <StatKpiCard
            label="Average Damage Differential"
            value={Number.isFinite(damageDiff?.diff)
              ? appendPercentGapText(formatSignedValue(damageDiff.diff, 0), calcDeepStatPercentGap(damageStat?.ours, damageStat?.theirs))
              : "—"}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Pace</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
          <StatKpiCard label="Average Game Length" value={Number.isFinite(stats.league?.avgGameLength) ? `${stats.league.avgGameLength.toFixed(1)} min` : "—"} />
          <StatKpiCard label="Gold / Min" value={formatDeepStatValue(goldPerMinStat?.ours)} />
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
        {(() => {
          const roleStats = stats.league?.roleStats || [];
          const kdaMax = Math.max(0.01, ...roleStats.map((role) => Number(role.kda) || 0));
          const goldMax = Math.max(0.01, ...roleStats.map((role) => Number(role.gold) || 0));
          const damageMax = Math.max(0.01, ...roleStats.map((role) => Number(role.damage) || 0));
          return (
            <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
              {roleStats.map((role) => (
                <RoleStatCard
                  key={role.role}
                  role={role}
                  kdaMax={kdaMax}
                  goldMax={goldMax}
                  damageMax={damageMax}
                />
              ))}
            </div>
          );
        })()}
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Win / Loss Patterns</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-3">
          {stats.league?.winLoss.map((row) => (
            <WinLossDots key={row.label} row={row} lowerIsBetter={row.label === "Deaths"} />
          ))}
        </div>
      </section>

      <CharacterComfortPanel analytics={stats.characterComfort} gameTitle={stats.gameTitle} />
    </div>
  );
}

function getStatByLabel(items = [], label) {
  return items.find((item) => item.label === label) || null;
}

function getValorantStatBundle(stats) {
  const output = stats.teamOutput || [];
  const impact = stats.impact || [];
  return {
    assists: getStatByLabel(output, "Average Assists"),
    combat: getStatByLabel(output, "Combat Score"),
    deaths: getStatByLabel(output, "Average Deaths"),
    defuses: getStatByLabel(impact, "Defuses"),
    econ: getStatByLabel(output, "Econ Rating"),
    firstBloods: getStatByLabel(impact, "First Bloods"),
    kills: getStatByLabel(output, "Average Kills"),
    plants: getStatByLabel(impact, "Plants"),
  };
}

function chartValue(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampChartValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatChartValue(value, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  return formatDeepStatValue(Number(value.toFixed(decimals)));
}

function readableBarWidth(value, max, minWidth = 12) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(minWidth, (value / max) * 100);
}

function ValorantChartCard({ children, className = "", label, meta }) {
  return (
    <div className={`rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md ${className}`}>
      <div className="mb-sm flex items-start justify-between gap-sm">
        <p className="font-label-bold text-label-bold text-on-surface">{label}</p>
        {meta && <p className="font-label-small text-label-small text-on-surface-variant">{meta}</p>}
      </div>
      {children}
    </div>
  );
}

function polarPoint(cx, cy, radius, angleDeg) {
  const angle = (Math.PI / 180) * angleDeg;
  return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
}

function kdaPolygon(values, maxValue, cx = 100, cy = 92, radius = 66) {
  const angles = [-90, 30, 150];
  return values
    .map((value, index) => polarPoint(cx, cy, radius * (value / Math.max(maxValue, 1)), angles[index]))
    .join(" ");
}

function ValorantKdaRadar({ assists, deaths, kills }) {
  const ourDeaths = chartValue(deaths?.ours);
  const theirDeaths = chartValue(deaths?.theirs);
  const maxDeaths = Math.max(ourDeaths, theirDeaths, 1);
  const ourSurvival = Math.max(0, maxDeaths - ourDeaths) + 1;
  const theirSurvival = Math.max(0, maxDeaths - theirDeaths) + 1;
  const ourValues = [chartValue(kills?.ours), chartValue(assists?.ours), ourSurvival];
  const theirValues = [chartValue(kills?.theirs), chartValue(assists?.theirs), theirSurvival];
  const maxValue = Math.max(...ourValues, ...theirValues, 1);

  return (
    <ValorantChartCard label="KDA Shape" meta="Kills · Assists · Survival">
      <svg className="h-72 w-full" role="img" viewBox="0 0 260 220">
        <polygon fill="none" points="130,26 211,166 49,166" stroke="currentColor" strokeOpacity="0.18" />
        <polygon fill="none" points="130,58 183,150 77,150" stroke="currentColor" strokeOpacity="0.13" />
        <line stroke="currentColor" strokeOpacity="0.16" x1="130" x2="130" y1="110" y2="26" />
        <line stroke="currentColor" strokeOpacity="0.16" x1="130" x2="211" y1="110" y2="166" />
        <line stroke="currentColor" strokeOpacity="0.16" x1="130" x2="49" y1="110" y2="166" />
        <polygon fill="rgba(0,88,188,0.24)" points={kdaPolygon(ourValues, maxValue, 130, 110, 84)} stroke="rgb(0,88,188)" strokeWidth="3" />
        <polygon fill="rgba(209,43,43,0.16)" points={kdaPolygon(theirValues, maxValue, 130, 110, 84)} stroke="rgb(209,43,43)" strokeWidth="3" />
        <text className="fill-on-surface text-[11px] font-bold" textAnchor="middle" x="130" y="17">Kills</text>
        <text className="fill-on-surface text-[11px] font-bold" textAnchor="start" x="218" y="174">Assists</text>
        <text className="fill-on-surface text-[11px] font-bold" textAnchor="end" x="42" y="174">Survival</text>
      </svg>
      <div className="grid grid-cols-1 gap-xs font-label-small text-label-small sm:grid-cols-2">
        <div className="rounded-xl bg-primary-fixed p-sm text-primary">Your Team: {formatChartValue(kills?.ours)} / {formatChartValue(deaths?.ours)} / {formatChartValue(assists?.ours)}</div>
        <div className="rounded-xl bg-error-container p-sm text-error">Opponent Avg: {formatChartValue(kills?.theirs)} / {formatChartValue(deaths?.theirs)} / {formatChartValue(assists?.theirs)}</div>
      </div>
    </ValorantChartCard>
  );
}

function ValorantGauge({ stat }) {
  const ours = chartValue(stat?.ours);
  const theirs = chartValue(stat?.theirs);
  const min = 80;
  const max = 200;
  const toX = (value) => 34 + clampChartValue((value - min) / (max - min), 0, 1) * 212;
  const ourX = toX(ours);
  const theirX = toX(theirs);
  const fillWidth = Math.max(0, ourX - 34);

  return (
    <ValorantChartCard label="Combat Score">
      <svg className="h-80 w-full" role="img" viewBox="0 0 280 240">
        <text className="fill-primary text-[36px] font-black" textAnchor="middle" x="140" y="58">{formatChartValue(ours, 1)}</text>
        <text className="fill-on-surface-variant text-[9px] font-bold" textAnchor="middle" x="34" y="98">Low</text>
        <text className="fill-on-surface-variant text-[9px] font-bold" textAnchor="middle" x="140" y="98">Avg</text>
        <text className="fill-on-surface-variant text-[9px] font-bold" textAnchor="middle" x="246" y="98">High</text>
        <rect fill="rgba(255,255,255,0.14)" height="10" rx="5" width="212" x="34" y="125" />
        <rect fill="rgb(37,99,235)" height="10" rx="5" width={fillWidth} x="34" y="125" />
        {[80, 120, 160, 200].map((tick) => (
          <g key={tick}>
            <line stroke="currentColor" strokeOpacity="0.32" x1={toX(tick)} x2={toX(tick)} y1="145" y2="158" />
            <text className="fill-on-surface-variant text-[9px]" textAnchor="middle" x={toX(tick)} y="176">{tick}</text>
          </g>
        ))}
        <line stroke="rgb(255,95,95)" strokeLinecap="round" strokeWidth="2" x1={theirX} x2={theirX} y1="106" y2="158" />
        <text className="fill-error text-[10px] font-bold" textAnchor="middle" x={theirX} y="196">Opp {formatChartValue(theirs, 0)}</text>
        <circle cx={ourX} cy="130" fill="rgb(59,130,246)" r="7" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
        <text className="fill-on-surface-variant text-[9px]" textAnchor="middle" x="140" y="220">Combat Score benchmark</text>
        <text className="fill-on-surface-variant text-[9px]" textAnchor="middle" x="140" y="234">Higher is better</text>
      </svg>
    </ValorantChartCard>
  );
}

function ValorantEconMeter({ stat }) {
  const ours = chartValue(stat?.ours);
  const theirs = chartValue(stat?.theirs);
  const delta = ours - theirs;
  const highValue = Math.max(ours, theirs, 1);
  const max = Math.ceil((highValue + 10) / 10) * 10;
  const ourWidth = clampChartValue((ours / max) * 100, 0, 100);
  const theirWidth = clampChartValue((theirs / max) * 100, 0, 100);
  const deltaTone = delta >= 0 ? "text-primary" : "text-error";

  return (
    <ValorantChartCard label="Econ Rating" meta="Average comparison">
      <div className="grid gap-md py-sm">
        <div>
          <div className="mb-sm flex items-center justify-between gap-sm">
            <p className="font-label-bold text-label-bold text-on-surface">Average econ rating</p>
            <p className={`font-label-bold text-label-bold ${deltaTone}`}>{formatSignedValue(delta, 1)}</p>
          </div>
          <div className="grid gap-lg rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 p-md">
            <div>
              <div className="mb-xs flex items-center justify-between gap-sm">
                <p className="font-label-bold text-label-bold text-primary">Blue team</p>
                <p className="font-headline-3 text-headline-3 text-primary">{formatChartValue(ours, 1)}</p>
              </div>
              <div className="h-5 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-primary" style={{ width: `${ourWidth}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-xs flex items-center justify-between gap-sm">
                <p className="font-label-bold text-label-bold text-error">Red team</p>
                <p className="font-headline-3 text-headline-3 text-error">{formatChartValue(theirs, 1)}</p>
              </div>
              <div className="h-5 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-error" style={{ width: `${theirWidth}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between font-label-small text-label-small text-on-surface-variant">
              <span>0</span>
              <span>Same scale</span>
              <span>{formatChartValue(max, 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </ValorantChartCard>
  );
}

function ValorantRoundDial({ value }) {
  const diff = Number.isFinite(value) ? value : 0;
  const barWidth = clampChartValue(Math.abs(diff) / 13, 0, 1) * 96;
  const valueTone = diff >= 0 ? "fill-primary" : "fill-error";

  return (
    <ValorantChartCard label="Average Round Differential" meta="Rounds won - lost">
      <svg className="h-[340px] w-full" role="img" viewBox="0 0 280 240">
        <text className={`text-[42px] font-black ${valueTone}`} textAnchor="middle" x="140" y="60">{formatSignedValue(diff)}</text>
        <text className="fill-error text-[10px] font-bold" textAnchor="middle" x="70" y="102">Opponent edge</text>
        <text className="fill-on-surface-variant text-[10px] font-bold" textAnchor="middle" x="140" y="102">Even</text>
        <text className="fill-primary text-[10px] font-bold" textAnchor="middle" x="210" y="102">Your edge</text>
        <rect fill="rgba(255,255,255,0.10)" height="18" rx="9" width="208" x="36" y="132" />
        <line stroke="currentColor" strokeOpacity="0.42" strokeWidth="2" x1="140" x2="140" y1="118" y2="164" />
        {diff >= 0 ? (
          <rect fill="rgb(37,99,235)" height="18" rx="9" width={barWidth} x="140" y="132" />
        ) : (
          <rect fill="rgb(239,68,68)" height="18" rx="9" width={barWidth} x={140 - barWidth} y="132" />
        )}
        <circle cx={diff >= 0 ? 140 + barWidth : 140 - barWidth} cy="141" fill={diff >= 0 ? "rgb(59,130,246)" : "rgb(239,68,68)"} r="9" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
        {[-13, -7, 0, 7, 13].map((tick) => {
          const x = 36 + ((tick + 13) / 26) * 208;
          return (
            <g key={tick}>
              <line stroke="currentColor" strokeOpacity="0.28" x1={x} x2={x} y1="172" y2="184" />
              <text className="fill-on-surface-variant text-[10px]" textAnchor="middle" x={x} y="202">{tick > 0 ? `+${tick}` : tick}</text>
            </g>
          );
        })}
        <text className="fill-on-surface-variant text-[10px]" textAnchor="middle" x="140" y="216">Positive means your team wins more rounds per review</text>
      </svg>
    </ValorantChartCard>
  );
}

function ValorantDotChart({ stat }) {
  const ours = chartValue(stat?.ours);
  const theirs = chartValue(stat?.theirs);

  return (
    <ValorantChartCard label="First Bloods" meta="Rounded avg">
      <ValorantTwoRowBars ours={ours} theirs={theirs} />
    </ValorantChartCard>
  );
}

function ValorantPlantDonut({ stat }) {
  const ours = chartValue(stat?.ours);
  const theirs = chartValue(stat?.theirs);
  const total = ours + theirs;
  const share = total > 0 ? ours / total : 0;
  const percent = Math.round(share * 100);

  return (
    <ValorantChartCard label="Plants" meta="Share of plants">
      <div className="grid items-center gap-sm sm:grid-cols-[150px_1fr]">
        <svg className="h-36 w-36" role="img" viewBox="0 0 120 120">
          <circle cx="60" cy="60" fill="none" r="42" stroke="rgb(254,226,226)" strokeWidth="18" />
          <circle
            cx="60"
            cy="60"
            fill="none"
            pathLength="100"
            r="42"
            stroke="rgb(0,88,188)"
            strokeDasharray={`${percent} 100`}
            strokeLinecap="round"
            strokeWidth="18"
            transform="rotate(-90 60 60)"
          />
          <text className="fill-primary text-[22px] font-black" textAnchor="middle" x="60" y="65">{percent}%</text>
        </svg>
        <div className="grid gap-xs font-label-bold text-label-bold">
          <div className="flex justify-between rounded-xl bg-primary-fixed p-sm text-primary"><span>Your Team</span><span>{formatChartValue(ours)}</span></div>
          <div className="flex justify-between rounded-xl bg-error-container p-sm text-error"><span>Opponent Avg</span><span>{formatChartValue(theirs)}</span></div>
        </div>
      </div>
    </ValorantChartCard>
  );
}

function ValorantEventMarkers({ stat }) {
  const ours = chartValue(stat?.ours);
  const theirs = chartValue(stat?.theirs);

  return (
    <ValorantChartCard label="Defuses" meta="Rare event markers">
      <ValorantTwoRowBars ours={ours} theirs={theirs} />
    </ValorantChartCard>
  );
}

function ValorantTwoRowBars({ ours, theirs }) {
  const max = Math.max(ours, theirs, 1);
  const rows = [
    { label: "Your Team", tone: "bg-primary", value: ours, valueTone: "text-primary" },
    { label: "Opponent Avg", tone: "bg-error", value: theirs, valueTone: "text-error" },
  ];

  return (
    <div className="grid gap-xl py-md">
      {rows.map((row, index) => (
        <div key={row.label}>
          <div className="mb-sm flex items-center justify-between gap-sm">
            <p className="font-label-bold text-label-bold text-on-surface">{row.label}</p>
            <p className={`font-headline-3 text-headline-3 ${row.valueTone}`}>{formatChartValue(row.value, 1)}</p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className={`h-full rounded-full ${row.tone}`}
              style={{ width: `${readableBarWidth(row.value, max)}%` }}
            />
          </div>
          {index === 0 && <div className="mt-lg h-px bg-outline-variant/30" />}
        </div>
      ))}
    </div>
  );
}

function ValorantTugChart({ stat }) {
  const diff = Number.isFinite(stat?.diff)
    ? stat.diff
    : Number.isFinite(stat?.ours) && Number.isFinite(stat?.theirs)
      ? stat.ours - stat.theirs
      : null;
  const value = diff ?? 0;
  const scale = Math.max(1, Math.abs(value), Math.abs(stat?.ours || 0), Math.abs(stat?.theirs || 0));
  const left = 50 + (value / scale) * 42;

  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-md">
      <div className="mb-sm flex items-center justify-between gap-sm">
        <p className="font-label-bold text-label-bold text-on-surface">{stat.label}</p>
        <p className={`font-label-bold text-label-bold ${value > 0 ? "text-primary" : value < 0 ? "text-error" : "text-on-surface-variant"}`}>
          {diff === null ? "—" : formatSignedValue(value)}
        </p>
      </div>
      <div className="relative h-10 rounded-full bg-gradient-to-r from-error-container via-surface-container-lowest to-primary-fixed">
        <div className="absolute left-1/2 top-1 h-8 w-px bg-outline-variant" />
        <div
          className={`absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface-container-lowest shadow-sm ${value >= 0 ? "border-primary" : "border-error"}`}
          style={{ left: `${Math.max(10, Math.min(90, left))}%` }}
        />
      </div>
      <div className="mt-xs flex justify-between font-label-small text-label-small text-on-surface-variant">
        <span>Opponent edge</span>
        <span>Even</span>
        <span>Your edge</span>
      </div>
    </div>
  );
}

function ValorantDeepStats({ stats }) {
  const bundle = getValorantStatBundle(stats);
  const differentialStats = [
    { ...bundle.firstBloods, label: "First Blood Differential" },
    { ...bundle.plants, label: "Plant Differential" },
    { ...bundle.defuses, label: "Defuse Differential" },
  ];

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <ValorantKdaRadar assists={bundle.assists} deaths={bundle.deaths} kills={bundle.kills} />
        <ValorantGauge stat={bundle.combat} />
      </section>

      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <ValorantEconMeter stat={bundle.econ} />
        <ValorantRoundDial value={stats.averageRoundDiff} />
      </section>

      <section className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <ValorantDotChart stat={bundle.firstBloods} />
        <ValorantPlantDonut stat={bundle.plants} />
        <ValorantEventMarkers stat={bundle.defuses} />
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Differentials</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-3">
          {differentialStats.map((stat) => (
            <ValorantTugChart key={stat.label} stat={stat} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">{formatPoolHeading(stats.config.mapLabel)}</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
          <FeatureCard icon="map" label="Best win rate" value={stats.mapPool.bestMap} />
          <FeatureCard icon="repeat" label="Most reviewed" value={stats.mapPool.mostPlayedMap} />
        </div>
      </section>

      <CharacterComfortPanel analytics={stats.characterComfort} gameTitle={stats.gameTitle} />
    </div>
  );
}

function getOutputStat(stats, label) {
  return getStatByLabel(stats.teamOutput || [], label);
}

function getDifferentialStats(stats) {
  return [
    ...(stats.impact || []).filter((stat) => stat.differentialOnly || Number.isFinite(stat.diff)),
    ...(stats.differentials || []),
  ];
}

function GameMapAndComfort({ stats }) {
  return (
    <>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">{formatPoolHeading(stats.config.mapLabel)}</h3>
        <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
          <FeatureCard icon="map" label="Best win rate" value={stats.mapPool.bestMap} />
          <FeatureCard icon="repeat" label="Most reviewed" value={stats.mapPool.mostPlayedMap} />
        </div>
      </section>
      <CharacterComfortPanel analytics={stats.characterComfort} gameTitle={stats.gameTitle} />
    </>
  );
}

function GameKdaRibbon({ assists, deaths, kills, title = "Fight Snapshot" }) {
  const rows = [
    { label: "Kills", stat: kills, tone: "bg-primary", valueTone: "text-primary" },
    { label: "Deaths", stat: deaths, tone: "bg-error", valueTone: "text-error", lowerIsBetter: true },
    { label: "Assists", stat: assists, tone: "bg-[#0F766E]", valueTone: "text-[#0F766E]" },
  ];

  return (
    <ValorantChartCard label={title} meta="Your team vs opponent avg">
      <div className="grid gap-md py-sm">
        {rows.map((row) => {
          const ours = chartValue(row.stat?.ours);
          const theirs = chartValue(row.stat?.theirs);
          const max = Math.max(ours, theirs, 1);
          const edge = row.lowerIsBetter ? theirs - ours : ours - theirs;
          return (
            <div key={row.label}>
              <div className="mb-xs flex items-center justify-between gap-sm">
                <p className="font-label-bold text-label-bold text-on-surface">{row.label}</p>
                <p className={`font-label-bold text-label-bold ${edge >= 0 ? "text-primary" : "text-error"}`}>
                  {formatSignedValue(edge, 1)}
                </p>
              </div>
              <div className="grid gap-xs">
                <div className="flex items-center gap-sm">
                  <span className="w-12 font-label-small text-label-small text-primary">You</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-primary-fixed">
                    <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${readableBarWidth(ours, max)}%` }} />
                  </div>
                  <span className={`w-14 text-right font-label-bold text-label-bold ${row.valueTone}`}>{formatChartValue(ours, 1)}</span>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="w-12 font-label-small text-label-small text-error">Opp</span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-error-container">
                    <div className="h-full rounded-full bg-error" style={{ width: `${readableBarWidth(theirs, max)}%` }} />
                  </div>
                  <span className="w-14 text-right font-label-bold text-label-bold text-error">{formatChartValue(theirs, 1)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ValorantChartCard>
  );
}

function OutputMixCard({ stats: statRows, title }) {
  const rows = statRows.filter((stat) => stat?.label);

  return (
    <ValorantChartCard label={title} meta="Per-stat comparison">
      <div className="grid gap-md py-sm">
        {rows.map((stat) => {
          const ours = chartValue(stat.ours);
          const theirs = chartValue(stat.theirs);
          const max = Math.max(Math.abs(ours), Math.abs(theirs), 1);
          const gap = calcDeepStatPercentGap(ours, theirs);

          return (
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-high/35 p-sm" key={stat.label}>
              <div className="mb-xs flex items-center justify-between gap-sm">
                <p className="font-label-bold text-label-bold text-on-surface">{stat.label}</p>
                <p className={`font-label-small text-label-small ${gap === null || gap >= 0 ? "text-primary" : "text-error"}`}>
                  {gap === null ? "—" : `${gap > 0 ? "+" : ""}${gap}%`}
                </p>
              </div>
              <div className="grid gap-xs">
                <div className="grid grid-cols-[48px_1fr_64px] items-center gap-xs">
                  <span className="font-label-small text-label-small text-primary">You</span>
                  <div className="h-3.5 overflow-hidden rounded-full bg-primary-fixed">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${readableBarWidth(Math.abs(ours), max)}%` }} />
                  </div>
                  <span className="text-right font-label-bold text-label-bold text-primary">{formatChartValue(ours, stat.decimals ?? 0)}</span>
                </div>
                <div className="grid grid-cols-[48px_1fr_64px] items-center gap-xs">
                  <span className="font-label-small text-label-small text-error">Opp</span>
                  <div className="h-3.5 overflow-hidden rounded-full bg-error-container">
                    <div className="h-full rounded-full bg-error" style={{ width: `${readableBarWidth(Math.abs(theirs), max)}%` }} />
                  </div>
                  <span className="text-right font-label-bold text-label-bold text-error">{formatChartValue(theirs, stat.decimals ?? 0)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ValorantChartCard>
  );
}

function EdgeProfileCard({ stats: statRows, title }) {
  const rows = statRows.filter((stat) => stat?.label);

  return (
    <ValorantChartCard label={title} meta="Team edge by stat">
      <div className="grid gap-md py-sm">
        {rows.map((stat) => {
          const ours = chartValue(stat.ours);
          const theirs = chartValue(stat.theirs);
          const lowerBetter = stat.lowerBetter;
          const rawDiff = ours - theirs;
          const edge = lowerBetter ? -rawDiff : rawDiff;
          const max = Math.max(Math.abs(ours), Math.abs(theirs), 1);
          const position = clampChartValue(50 + (edge / max) * 38, 10, 90);
          const tone = edge >= 0 ? "text-primary" : "text-error";
          const markerTone = edge >= 0 ? "border-primary bg-primary" : "border-error bg-error";
          const diffLabel = lowerBetter ? "Team edge" : "Diff";

          return (
            <div key={stat.label}>
              <div className="mb-xs flex items-center justify-between gap-sm">
                <p className="font-label-bold text-label-bold text-on-surface">{stat.label}</p>
                <p className={`font-label-bold text-label-bold ${tone}`}>{diffLabel} {formatSignedValue(edge, stat.decimals ?? 1)}</p>
              </div>
              <div className="relative h-9 rounded-full bg-gradient-to-r from-error-container via-surface-container-lowest to-primary-fixed">
                <div className="absolute left-1/2 top-1 h-7 w-px bg-outline-variant/60" />
                <div
                  className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45 ${markerTone}`}
                  style={{ left: `${position}%` }}
                />
              </div>
              <div className="mt-xs flex justify-between font-label-small text-label-small text-on-surface-variant">
                <span>Opponent</span>
                <span>{formatChartValue(ours, stat.decimals ?? 1)} vs {formatChartValue(theirs, stat.decimals ?? 1)}</span>
                <span>Your team</span>
              </div>
            </div>
          );
        })}
      </div>
    </ValorantChartCard>
  );
}

function MetricRingCard({ label, stat, suffix = "" }) {
  const ours = chartValue(stat?.ours);
  const theirs = chartValue(stat?.theirs);
  const max = Math.max(ours, theirs, 1);
  const ourWidth = readableBarWidth(ours, max);
  const theirWidth = readableBarWidth(theirs, max);
  const gap = calcDeepStatPercentGap(ours, theirs);
  const gapTone = gap === null || gap >= 0 ? "text-primary" : "text-error";
  const diff = ours - theirs;

  return (
    <ValorantChartCard label={label} meta="Average comparison">
      <div className="grid gap-lg py-sm">
        <div className="flex items-end justify-between gap-md">
          <div>
            <p className="font-label-small text-label-small text-on-surface-variant">Your Team</p>
            <p className="font-display-small text-display-small text-primary">{formatChartValue(ours, suffix ? 0 : 1)}{suffix}</p>
          </div>
          <div className="text-right">
            <p className="font-label-small text-label-small text-on-surface-variant">Opponent Avg</p>
            <p className="font-headline-2 text-headline-2 text-error">{formatChartValue(theirs, suffix ? 0 : 1)}{suffix}</p>
          </div>
        </div>

        <div className="grid gap-md rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 p-md">
          <div>
            <div className="mb-xs flex items-center justify-between gap-sm">
              <span className="font-label-bold text-label-bold text-primary">Your Team</span>
              <span className="font-label-bold text-label-bold text-primary">{formatChartValue(ours, suffix ? 0 : 1)}{suffix}</span>
            </div>
            <div className="h-5 overflow-hidden rounded-full bg-primary-fixed">
              <div className="h-full rounded-full bg-primary" style={{ width: `${ourWidth}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-xs flex items-center justify-between gap-sm">
              <span className="font-label-bold text-label-bold text-error">Opponent Avg</span>
              <span className="font-label-bold text-label-bold text-error">{formatChartValue(theirs, suffix ? 0 : 1)}{suffix}</span>
            </div>
            <div className="h-5 overflow-hidden rounded-full bg-error-container">
              <div className="h-full rounded-full bg-error" style={{ width: `${theirWidth}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between font-label-small text-label-small text-on-surface-variant">
            <span>Same scale</span>
            <span className={gapTone}>
              {gap === null ? formatSignedValue(diff, suffix ? 0 : 1) : `${gap > 0 ? "+" : ""}${gap}% vs opponent`}
            </span>
          </div>
        </div>
      </div>
    </ValorantChartCard>
  );
}

function DifferentialStripGrid({ stats, title = "Differentials" }) {
  const rows = stats.filter(Boolean);
  if (!rows.length) return null;

  return (
    <section>
      <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">{title}</h3>
      <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
        {rows.map((stat) => (
          <ImpactDifferentialCard key={stat.label} stat={stat} />
        ))}
      </div>
    </section>
  );
}

function DamageConversionCard({ objectiveDamage, playerDamage }) {
  const player = chartValue(playerDamage?.ours);
  const objective = chartValue(objectiveDamage?.ours);
  const ratio = player > 0 ? objective / player : 0;
  const percent = Math.round(ratio * 100);
  const max = Math.max(player, objective, 1);

  return (
    <ValorantChartCard label="Damage Conversion" meta="Objective / player damage">
      <div className="grid gap-lg py-md">
        <div className="text-center">
          <p className="font-display-small text-display-small text-primary">{percent}%</p>
          <p className="font-label-small text-label-small text-on-surface-variant">of player damage converted into objective pressure</p>
        </div>
        <div className="grid gap-md">
          {[
            { label: "Player Damage", value: player, tone: "bg-primary", text: "text-primary" },
            { label: "Objective Damage", value: objective, tone: "bg-tertiary", text: "text-tertiary" },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-xs flex justify-between gap-sm">
                <p className="font-label-bold text-label-bold text-on-surface">{row.label}</p>
                <p className={`font-label-bold text-label-bold ${row.text}`}>{formatChartValue(row.value, 0)}</p>
              </div>
              <div className="h-5 overflow-hidden rounded-full bg-surface-container-high">
                <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${readableBarWidth(row.value, max)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ValorantChartCard>
  );
}

function OverwatchDeepStats({ stats }) {
  const eliminations = getOutputStat(stats, "Eliminations");
  const deaths = getOutputStat(stats, "Average Deaths");
  const assists = getOutputStat(stats, "Assists");
  const damage = getOutputStat(stats, "Damage");
  const healing = getOutputStat(stats, "Healing");
  const mitigation = getOutputStat(stats, "Mitigation");
  const finalBlows = getOutputStat(stats, "Final Blows");
  const objectiveKills = getOutputStat(stats, "Objective Kills");

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <GameKdaRibbon assists={assists} deaths={deaths} kills={eliminations} title="Fight Flow" />
        <OutputMixCard stats={[damage, healing, mitigation]} title="Role Output Comparison" />
      </section>
      <section className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <MetricRingCard label="Final Blows" stat={finalBlows} />
        <MetricRingCard label="Objective Kills" stat={objectiveKills} />
      </section>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Role Pressure</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
          <ComparisonBar label="Damage" ours={damage?.ours} theirs={damage?.theirs} />
          <ComparisonBar label="Healing" ours={healing?.ours} theirs={healing?.theirs} />
          <ComparisonBar label="Mitigation" ours={mitigation?.ours} theirs={mitigation?.theirs} />
        </div>
      </section>
      <DifferentialStripGrid stats={getDifferentialStats(stats)} />
      <GameMapAndComfort stats={stats} />
    </div>
  );
}

function MarvelRivalsDeepStats({ stats }) {
  const kills = getOutputStat(stats, "Average Kills");
  const deaths = getOutputStat(stats, "Average Deaths");
  const assists = getOutputStat(stats, "Average Assists");
  const finalHits = getOutputStat(stats, "Final Hits");
  const damage = getOutputStat(stats, "Damage");
  const healing = getOutputStat(stats, "Healing");
  const blocked = getOutputStat(stats, "Damage Blocked");
  const accuracy = getOutputStat(stats, "Accuracy");

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <GameKdaRibbon assists={assists} deaths={deaths} kills={kills} title="Team KDA Shape" />
        <OutputMixCard stats={[damage, blocked, healing]} title="Damage / Sustain Comparison" />
      </section>
      <section className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <MetricRingCard label="Final Hits" stat={finalHits} />
        <MetricRingCard label="Accuracy" stat={accuracy} suffix="%" />
      </section>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Core Combat Output</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
          <ComparisonBar label="Damage" ours={damage?.ours} theirs={damage?.theirs} />
          <ComparisonBar label="Damage Blocked" ours={blocked?.ours} theirs={blocked?.theirs} />
          <ComparisonBar label="Healing" ours={healing?.ours} theirs={healing?.theirs} />
        </div>
      </section>
      <DifferentialStripGrid stats={getDifferentialStats(stats)} />
      <GameMapAndComfort stats={stats} />
    </div>
  );
}

function DeadlockDeepStats({ stats }) {
  const kills = getOutputStat(stats, "Average Kills");
  const deaths = getOutputStat(stats, "Average Deaths");
  const assists = getOutputStat(stats, "Average Assists");
  const souls = getOutputStat(stats, "Souls / Net Worth");
  const soulsPerMin = getOutputStat(stats, "Souls / Min");
  const playerDamage = getOutputStat(stats, "Player Damage");
  const objectiveDamage = getOutputStat(stats, "Objective Damage");

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <EdgeProfileCard stats={[souls, playerDamage, objectiveDamage]} title="Economy to Pressure Profile" />
        <DamageConversionCard objectiveDamage={objectiveDamage} playerDamage={playerDamage} />
      </section>
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <GameKdaRibbon assists={assists} deaths={deaths} kills={kills} title="Fight Trading" />
        <MetricRingCard label="Souls / Min" stat={soulsPerMin} />
      </section>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Economy and Objective Race</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
          <ComparisonBar label="Souls / Net Worth" ours={souls?.ours} theirs={souls?.theirs} />
          <ComparisonBar label="Player Damage" ours={playerDamage?.ours} theirs={playerDamage?.theirs} />
          <ComparisonBar label="Objective Damage" ours={objectiveDamage?.ours} theirs={objectiveDamage?.theirs} />
        </div>
      </section>
      <DifferentialStripGrid stats={getDifferentialStats(stats)} />
      <GameMapAndComfort stats={stats} />
    </div>
  );
}

function CounterStrikeDeepStats({ stats }) {
  const kills = getOutputStat(stats, "Average Kills");
  const deaths = getOutputStat(stats, "Average Deaths");
  const assists = getOutputStat(stats, "Average Assists");
  const adr = getOutputStat(stats, "Average ADR");
  const headshots = getOutputStat(stats, "Average HS%");
  const mvps = getStatByLabel(stats.impact || [], "MVPs / Stars");
  const rating = getStatByLabel(stats.impact || [], "Score / Rating");

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <GameKdaRibbon assists={assists} deaths={deaths} kills={kills} title="Gunfight Trading" />
        <EdgeProfileCard stats={[adr, headshots, rating]} title="Precision Profile" />
      </section>
      <section className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <MetricRingCard label="Average HS%" stat={headshots} suffix="%" />
        <MetricRingCard label="MVPs / Stars" stat={mvps} />
      </section>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Round Impact</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
          <ComparisonBar label="Average ADR" ours={adr?.ours} theirs={adr?.theirs} />
          <ComparisonBar label="Average HS%" ours={headshots?.ours} theirs={headshots?.theirs} />
          <ComparisonBar label="Score / Rating" ours={rating?.ours} theirs={rating?.theirs} />
        </div>
      </section>
      <GameMapAndComfort stats={stats} />
    </div>
  );
}

function RocketLeagueDeepStats({ stats }) {
  const goals = getOutputStat(stats, "Goals");
  const assists = getOutputStat(stats, "Assists");
  const saves = getOutputStat(stats, "Saves");
  const shots = getOutputStat(stats, "Shots");
  const score = getOutputStat(stats, "Scoreboard Score");
  const demos = getStatByLabel(stats.impact || [], "Demos");

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <OutputMixCard stats={[goals, assists, saves, shots]} title="Rotation Output Comparison" />
        <EdgeProfileCard stats={[goals, shots, score]} title="Scoring Pressure Profile" />
      </section>
      <section className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <MetricRingCard label="Goals" stat={goals} />
        <MetricRingCard label="Saves" stat={saves} />
      </section>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Pressure and Disruption</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
          <ComparisonBar label="Shots" ours={shots?.ours} theirs={shots?.theirs} />
          <ComparisonBar label="Assists" ours={assists?.ours} theirs={assists?.theirs} />
          <ComparisonBar label="Demos" ours={demos?.ours} theirs={demos?.theirs} />
        </div>
      </section>
      <DifferentialStripGrid stats={getDifferentialStats(stats)} />
      <GameMapAndComfort stats={stats} />
    </div>
  );
}

function SsbuDeepStats({ stats }) {
  const kos = getOutputStat(stats, "KOs");
  const falls = getOutputStat(stats, "Falls");
  const selfDestructs = getOutputStat(stats, "Self-Destructs");
  const damageDealt = getOutputStat(stats, "Damage Dealt");
  const damageTaken = getOutputStat(stats, "Damage Taken");
  const stocks = getOutputStat(stats, "Stocks Remaining");

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <EdgeProfileCard stats={[kos, falls && { ...falls, lowerBetter: true }, damageTaken && { ...damageTaken, lowerBetter: true }]} title="Stock Control Profile" />
        <OutputMixCard stats={[kos, damageDealt, stocks]} title="Conversion Comparison" />
      </section>
      <section className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <MetricRingCard label="Stocks Remaining" stat={stocks} />
        <MetricRingCard label="KOs" stat={kos} />
      </section>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">Clean Play</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
          <ComparisonBar label="Falls" note="Lower is cleaner." ours={falls?.ours} theirs={falls?.theirs} />
          <ComparisonBar label="Self-Destructs" note="Lower is cleaner." ours={selfDestructs?.ours} theirs={selfDestructs?.theirs} />
          <ComparisonBar label="Damage Taken" note="Lower is cleaner." ours={damageTaken?.ours} theirs={damageTaken?.theirs} />
        </div>
      </section>
      <DifferentialStripGrid stats={getDifferentialStats(stats)} />
      <GameMapAndComfort stats={stats} />
    </div>
  );
}

function HonorOfKingsDeepStats({ stats }) {
  const kills = getOutputStat(stats, "Average Kills");
  const deaths = getOutputStat(stats, "Average Deaths");
  const assists = getOutputStat(stats, "Average Assists");
  const gold = getOutputStat(stats, "Gold");
  const damage = getOutputStat(stats, "Damage");
  const damageTaken = getOutputStat(stats, "Damage Taken");
  const healing = getOutputStat(stats, "Healing");

  return (
    <div className="grid gap-lg">
      <section className="grid grid-cols-1 gap-md xl:grid-cols-2">
        <GameKdaRibbon assists={assists} deaths={deaths} kills={kills} title="Teamfight Shape" />
        <EdgeProfileCard stats={[gold, damage, damageTaken && { ...damageTaken, lowerBetter: true }, healing]} title="Lane Pressure Profile" />
      </section>
      <section className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <OutputMixCard stats={[damage, damageTaken, healing]} title="Damage / Sustain Comparison" />
        <MetricRingCard label="Gold" stat={gold} />
      </section>
      <section>
        <h3 className="mb-sm font-headline-3 text-headline-3 text-on-surface">MOBA Output</h3>
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-3">
          <ComparisonBar label="Gold" ours={gold?.ours} theirs={gold?.theirs} />
          <ComparisonBar label="Damage" ours={damage?.ours} theirs={damage?.theirs} />
          <ComparisonBar label="Healing" ours={healing?.ours} theirs={healing?.theirs} />
        </div>
      </section>
      <DifferentialStripGrid stats={getDifferentialStats(stats)} />
      <GameMapAndComfort stats={stats} />
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
          <StatKpiCard
            label={stats.config.scoreDiffLabel}
            value={Number.isFinite(stats.averageRoundDiff)
              ? appendPercentGapText(
                  formatSignedValue(stats.averageRoundDiff),
                  // Use the leading comparable output stat (kills/score) as the
                  // basis for the percent gap, since averageRoundDiff is derived
                  // from it for most games.
                  calcDeepStatPercentGap(comparableOutput[0]?.ours, comparableOutput[0]?.theirs)
                )
              : "—"}
          />
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

      <CharacterComfortPanel analytics={stats.characterComfort} gameTitle={stats.gameTitle} />
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
