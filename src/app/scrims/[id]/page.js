"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import MaterialSymbol from "@/components/MaterialSymbol";
import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth-session";
import { getRanksForGame, normalizeTeamLocation } from "@/lib/game-options";
import {
  formatGamesCount,
  formatScrimDetailDateTime as formatDateTime,
  getDateInputValue,
  getInitials,
  getScrimEndAt,
  getTimeInputValue,
  parseScheduledAt,
} from "@/lib/scrim-utils";

function getRankColor(rank = "") {
  if (rank.includes("Immortal") || rank.includes("Radiant")) return "#ff2d55";
  if (rank.includes("Ascendant") || rank.includes("Diamond")) return "#00e676";
  if (rank.includes("Platinum")) return "#2979ff";
  if (rank.includes("Faceit")) return "#ff6d00";
  return "#717786";
}

function isMissingGamesCountError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("games_count");
}

// ─── sub-components ──────────────────────────────────────────────────────────

function TeamAvatar({ initials, size = "lg" }) {
  const dim = size === "lg" ? "w-20 h-20 md:w-24 md:h-24 text-2xl" : "w-12 h-12 text-base";
  return (
    <div
      className={`${dim} rounded-full bg-surface-container-high flex items-center justify-center font-bold text-on-surface border-2 border-outline-variant/20 shrink-0`}
    >
      {initials}
    </div>
  );
}

function DetailRow({ icon, label, value, last = false }) {
  return (
    <div
      className={`flex items-center justify-between ${
        !last ? "border-b border-surface-container-highest pb-md" : ""
      }`}
    >
      <div className="flex items-center gap-sm text-on-surface-variant">
        <MaterialSymbol>{icon}</MaterialSymbol>
        <span className="font-body-main text-body-main">{label}</span>
      </div>
      <span className="font-body-main text-body-main font-medium text-on-surface">{value}</span>
    </div>
  );
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return <div className={`bg-surface-container-high animate-pulse rounded-lg ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-lg space-y-lg pb-32">
      <div className="bg-surface-container-lowest rounded-xl p-lg border border-surface-container-highest space-y-lg">
        <div className="flex items-center justify-center gap-lg">
          <div className="flex flex-col items-center gap-sm flex-1">
            <Skeleton className="w-20 h-20 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-4 w-8 shrink-0" />
          <div className="flex flex-col items-center gap-sm flex-1">
            <Skeleton className="w-20 h-20 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-8 w-32 rounded-full" />
        </div>
        <div className="text-center space-y-sm">
          <Skeleton className="h-6 w-48 mx-auto" />
          <div className="flex justify-center gap-sm">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="bg-surface-container-lowest rounded-xl p-lg border border-surface-container-highest space-y-md">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </main>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ScrimDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [scrim, setScrim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState("");
  const [requestingTeams, setRequestingTeams] = useState([]);
  const [userTeamIds, setUserTeamIds] = useState([]);
  const [selectedRequestingTeamId, setSelectedRequestingTeamId] = useState("");
  const [isLoadingRequestingTeams, setIsLoadingRequestingTeams] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [editForm, setEditForm] = useState({
    date: "",
    startTime: "",
    gamesCount: "3",
    opponentRankMin: "",
    opponentRankMax: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCancellingListing, setIsCancellingListing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [isCompletingScrim, setIsCompletingScrim] = useState(false);

  const fetchScrim = useCallback(async ({ showLoading = false } = {}) => {
    if (!id) return null;

    if (showLoading) {
      setLoading(true);
    }
    setError("");

    const selectWithGames = `
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
            verified_flag,
            type
          )
        ),
        matched_team:teams!scrim_requests_matched_team_id_fkey (
          id,
          name,
          game_title,
          rank_tier,
          region,
          organization:organizations!teams_org_id_fkey (
            id,
            name,
            verified_flag,
            type
          )
        )
      `;
    const selectWithoutGames = selectWithGames.replace("games_count,", "");

    let { data, error: err } = await supabase
      .from("scrim_requests")
      .select(selectWithGames)
      .eq("id", id)
      .single();

    if (isMissingGamesCountError(err)) {
      console.warn("games_count is missing in Supabase. Run supabase_scrim_games_count.sql to enable saved game counts.");
      ({ data, error: err } = await supabase
        .from("scrim_requests")
        .select(selectWithoutGames)
        .eq("id", id)
        .single());
    }

    if (err) {
      setError(err.code === "PGRST116" ? "Scrim not found." : err.message);
      setLoading(false);
      return null;
    }

    setScrim(data);
    setLoading(false);
    return data;
  }, [id]);

  useEffect(() => {
    fetchScrim({ showLoading: true });
  }, [fetchScrim]);

  useEffect(() => {
    if (!scrim) return;

    setEditForm({
      date: getDateInputValue(new Date(scrim.scheduled_at)),
      startTime: getTimeInputValue(scrim.scheduled_at),
      gamesCount: String(scrim.games_count || 3),
      opponentRankMin: scrim.opponent_rank_min || scrim.team_rank || "",
      opponentRankMax: scrim.opponent_rank_max || scrim.opponent_rank_min || scrim.team_rank || "",
    });
  }, [scrim]);

  useEffect(() => {
    async function fetchRequestingTeams() {
      setIsLoadingRequestingTeams(true);
      setRequestError("");

      const { data: userData, error: userError } = await getCurrentUser();

      if (userError || !userData.user) {
        setRequestingTeams([]);
        setUserTeamIds([]);
        setRequestError("Log in before requesting a scrim.");
        setIsLoadingRequestingTeams(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, org_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        console.error("Failed to load profile for scrim request", profileError);
        setRequestingTeams([]);
        setUserTeamIds([]);
        setRequestError("We could not load your profile. Please try again.");
        setIsLoadingRequestingTeams(false);
        return;
      }

      if (!profile?.org_id) {
        setRequestingTeams([]);
        setUserTeamIds([]);
        setRequestError("Create an organization before requesting a scrim.");
        setIsLoadingRequestingTeams(false);
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, game_title, rank_tier, region")
        .eq("org_id", profile.org_id)
        .eq("game_title", scrim?.game_title)
        .order("created_at", { ascending: true });

      if (teamsError) {
        console.error("Failed to load teams for scrim request", teamsError);
        setRequestingTeams([]);
        setUserTeamIds([]);
        setRequestError("We could not load your teams. Please try again.");
        setIsLoadingRequestingTeams(false);
        return;
      }

      setRequestingTeams(teams || []);
      setUserTeamIds((teams || []).map((team) => team.id));
      setSelectedRequestingTeamId((currentTeamId) => {
        if (scrim?.matched_team_id && teams?.some((team) => team.id === scrim.matched_team_id)) {
          return scrim.matched_team_id;
        }
        if (currentTeamId && teams?.some((team) => team.id === currentTeamId)) return currentTeamId;
        return teams?.[0]?.id || "";
      });
      setIsLoadingRequestingTeams(false);
    }

    if (!loading) {
      fetchRequestingTeams();
    }
  }, [loading, scrim?.game_title, scrim?.matched_team_id]);

  // ── derived display values ──────────────────────────────────────────────────
  const postingTeam = scrim?.posting_team;
  const matchedTeam = scrim?.matched_team;
  const org = postingTeam?.organization;

  const teamName = postingTeam?.name ?? "Unknown Team";
  const teamInitials = getInitials(teamName);
  const orgName = org?.name ?? "Independent";
  const verified = Boolean(org?.verified_flag);

  const game = scrim?.game_title ?? "—";
  const rank = scrim?.team_rank ?? postingTeam?.rank_tier ?? "Rank TBD";
  const rankColor = getRankColor(rank);
  const opponentMin = scrim?.opponent_rank_min;
  const opponentMax = scrim?.opponent_rank_max;
  const rankRange =
    opponentMin && opponentMax
      ? `${opponentMin} – ${opponentMax}`
      : opponentMin ?? opponentMax ?? "Open";
  const region = normalizeTeamLocation(postingTeam?.region) || "Location TBD";
  const rating = Number(postingTeam?.scrimgg_rating ?? 0).toFixed(1);
  const dateTime = formatDateTime(scrim?.scheduled_at);
  const gamesCount = formatGamesCount(scrim?.games_count);
  const selectedRequestingTeam = requestingTeams.find((team) => team.id === selectedRequestingTeamId);
  const isOwnListing = Boolean(userTeamIds.includes(scrim?.posting_team_id));
  const userHasRequested = Boolean(
    scrim?.status === "pending" && userTeamIds.includes(scrim?.matched_team_id)
  );
  const isConfirmedParticipant = Boolean(
    scrim?.status === "confirmed" &&
    (userTeamIds.includes(scrim?.posting_team_id) || userTeamIds.includes(scrim?.matched_team_id))
  );
  const displayChallengerTeam = scrim?.matched_team_id ? matchedTeam || selectedRequestingTeam : selectedRequestingTeam;
  const isInboundPending = Boolean(scrim?.status === "pending" && isOwnListing && matchedTeam);

  const isExpired = scrim?.scheduled_at
    ? getScrimEndAt(scrim.scheduled_at) < new Date()
    : false;
  const isOpen = scrim?.status === "open" && !isExpired;
  const statusLabel = isOpen
    ? "Open · Looking for Scrim"
    : isInboundPending
      ? "Needs Response"
      : userHasRequested
        ? "Request Sent"
        : isExpired
          ? "Expired"
          : scrim?.status;

  async function handleRequestScrim() {
    if (!selectedRequestingTeamId) {
      setRequestError("Choose which team is requesting this scrim.");
      return;
    }

    if (!scrim || scrim.status !== "open") {
      setRequestError("This scrim is no longer open.");
      return;
    }

    if (isExpired) {
      setRequestError("This scrim has expired.");
      return;
    }

    if (selectedRequestingTeamId === scrim.posting_team_id) {
      setRequestError("You can't request your own scrim.");
      return;
    }

    setRequestLoading(true);
    setRequestError("");
    setRequestSuccess("");

    try {
      const { data: userData, error: userError } = await getCurrentUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, org_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        console.error("Failed to load profile for scrim request", profileError);
        setRequestError("We could not load your profile. Please try again.");
        return;
      }

      if (!profile?.org_id) {
        setRequestError("Create an organization before requesting a scrim.");
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, game_title")
        .eq("org_id", profile.org_id)
        .eq("game_title", scrim.game_title)
        .order("created_at", { ascending: true });

      if (teamsError) {
        console.error("Failed to load teams for scrim request", teamsError);
        setRequestError("We could not load your teams. Please try again.");
        return;
      }

      if (!teams?.length) {
        setRequestError(`Create a ${scrim.game_title} team before requesting this scrim.`);
        return;
      }

      const selectedTeam = teams.find((team) => team.id === selectedRequestingTeamId);
      const challengerTeam = selectedTeam || teams[0];

      if (challengerTeam.game_title !== scrim.game_title) {
        setRequestError(`${challengerTeam.game_title} teams can only request ${challengerTeam.game_title} scrims.`);
        return;
      }

      if (challengerTeam.id === scrim.posting_team_id) {
        setRequestError("You can't request your own scrim.");
        return;
      }

      const { data: updatedScrim, error: updateError } = await supabase
        .from("scrim_requests")
        .update({
          matched_team_id: challengerTeam.id,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "open")
        .is("matched_team_id", null)
        .select(
          `
          id,
          posting_team_id,
          matched_team_id,
          game_title,
          scheduled_at,
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
              verified_flag,
              type
            )
          )
        `
        )
        .maybeSingle();

      if (updateError) {
        console.error("Failed to request scrim", updateError);
        setRequestError(updateError.message || "Another team may have already requested this scrim.");
        return;
      }

      if (!updatedScrim) {
        setRequestError("Another team may have already requested this scrim.");
        await fetchScrim();
        return;
      }

      setScrim(updatedScrim);
      setSelectedRequestingTeamId(challengerTeam.id);
      setRequested(true);
      setRequestSuccess("Request sent. Waiting for the posting team to accept.");
    } catch (requestError) {
      console.error("Failed to request scrim", requestError);
      setRequestError(requestError.message || "Something went wrong while requesting this scrim.");
    } finally {
      setRequestLoading(false);
    }
  }

  async function handleRetractRequest() {
    if (!scrim?.matched_team_id || !userHasRequested) {
      setRequestError("We could not find your pending request to retract.");
      return;
    }

    setRequestLoading(true);
    setRequestError("");
    setRequestSuccess("");

    try {
      const { data: userData, error: userError } = await getCurrentUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const { data: updatedScrim, error: updateError } = await supabase
        .from("scrim_requests")
        .update({
          matched_team_id: null,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending")
        .eq("matched_team_id", scrim.matched_team_id)
        .select(
          `
          id,
          posting_team_id,
          matched_team_id,
          game_title,
          scheduled_at,
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
              verified_flag,
              type
            )
          )
        `
        )
        .maybeSingle();

      if (updateError) {
        console.error("Failed to retract scrim request", updateError);
        setRequestError(updateError.message || "We could not retract this request.");
        return;
      }

      if (!updatedScrim) {
        setRequestError("This request may have already changed.");
        await fetchScrim();
        return;
      }

      setScrim(updatedScrim);
      setRequested(false);
      setRequestSuccess("Request retracted.");
    } catch (retractError) {
      console.error("Failed to retract scrim request", retractError);
      setRequestError(retractError.message || "Something went wrong while retracting this request.");
    } finally {
      setRequestLoading(false);
    }
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
    setEditError("");
    setEditSuccess("");
  }

  async function handleSaveEdit(event) {
    event.preventDefault();

    if (!scrim || !isOwnListing) {
      setEditError("You can only edit scrims posted by your own team.");
      return;
    }

    if (scrim.status !== "open") {
      setEditError("Only open scrims can be edited here.");
      return;
    }

    const scheduledAt = parseScheduledAt(editForm.date, editForm.startTime);

    if (!scheduledAt) {
      setEditError("Enter a valid date and start time.");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");
    setEditSuccess("");

    try {
      const updatePayload = {
        scheduled_at: scheduledAt,
        games_count: Number(editForm.gamesCount || 3),
        opponent_rank_min: editForm.opponentRankMin,
        opponent_rank_max: editForm.opponentRankMax,
        expires_at: getScrimEndAt(scheduledAt).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updateSelectWithGames = `
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
              verified_flag,
              type
            )
          ),
          matched_team:teams!scrim_requests_matched_team_id_fkey (
            id,
            name,
            game_title,
            rank_tier,
            region,
            organization:organizations!teams_org_id_fkey (
              id,
              name,
              verified_flag,
              type
            )
          )
        `;
      const updateSelectWithoutGames = updateSelectWithGames.replace("games_count,", "");

      const updateScrim = (payload, selectQuery = updateSelectWithGames) => supabase
        .from("scrim_requests")
        .update(payload)
        .eq("id", id)
        .eq("posting_team_id", scrim.posting_team_id)
        .eq("status", "open")
        .select(selectQuery)
        .maybeSingle();

      let { data: updatedScrim, error: updateError } = await updateScrim(updatePayload);

      if (isMissingGamesCountError(updateError)) {
        console.warn("games_count is missing in Supabase. Saving scrim without game count update.");
        const { games_count, ...fallbackPayload } = updatePayload;
        ({ data: updatedScrim, error: updateError } = await updateScrim(fallbackPayload, updateSelectWithoutGames));
      }

      if (updateError) {
        console.error("Failed to update scrim", updateError);
        setEditError(updateError.message || "We could not update this scrim.");
        return;
      }

      if (!updatedScrim) {
        setEditError("This scrim may have changed and could not be edited.");
        await fetchScrim();
        return;
      }

      setScrim(updatedScrim);
      setEditSuccess("Scrim updated.");
    } catch (saveError) {
      console.error("Failed to update scrim", saveError);
      setEditError(saveError.message || "Something went wrong while updating this scrim.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleCancelListing() {
    if (!scrim || !isOwnListing) {
      setEditError("You can only retract scrims posted by your own team.");
      return;
    }

    if (scrim.status !== "open") {
      setEditError("Only open scrims can be retracted here.");
      return;
    }

    const confirmed = window.confirm("Retract this scrim listing and remove it from the board?");
    if (!confirmed) return;

    setIsCancellingListing(true);
    setEditError("");
    setEditSuccess("");

    try {
      const { data: updatedScrim, error: updateError } = await supabase
        .from("scrim_requests")
        .update({
          status: "cancelled",
          expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("posting_team_id", scrim.posting_team_id)
        .eq("status", "open")
        .is("matched_team_id", null)
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        console.error("Failed to retract scrim listing", updateError);
        setEditError(updateError.message || "We could not retract this scrim.");
        return;
      }

      if (!updatedScrim) {
        setEditError("This scrim may have changed and could not be retracted.");
        await fetchScrim();
        return;
      }

      router.push("/");
    } catch (cancelError) {
      console.error("Failed to retract scrim listing", cancelError);
      setEditError(cancelError.message || "Something went wrong while retracting this scrim.");
    } finally {
      setIsCancellingListing(false);
    }
  }

  async function handleCompleteScrim() {
    if (!scrim || !isConfirmedParticipant) {
      setRequestError("You can only end confirmed scrims involving your own team.");
      return;
    }

    const ownedScrimTeamId = userTeamIds.includes(scrim.posting_team_id)
      ? scrim.posting_team_id
      : userTeamIds.includes(scrim.matched_team_id)
        ? scrim.matched_team_id
        : "";

    if (!ownedScrimTeamId) {
      setRequestError("We could not find your team for this scrim.");
      return;
    }

    const confirmed = window.confirm("Mark this scrim as played and open the post-game dashboard?");
    if (!confirmed) return;

    setIsCompletingScrim(true);
    setRequestError("");
    setRequestSuccess("");

    try {
      const { data: updatedScrim, error: updateError } = await supabase
        .from("scrim_requests")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", scrim.id)
        .eq("status", "confirmed")
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        console.error("Failed to complete scrim", updateError);
        setRequestError(updateError.message || "We could not mark this scrim as played.");
        return;
      }

      if (!updatedScrim) {
        setRequestError("This scrim may have changed and could not be ended.");
        await fetchScrim();
        return;
      }

      router.push(`/team/${ownedScrimTeamId}/dashboard?scrim_id=${scrim.id}`);
    } catch (completeError) {
      console.error("Failed to complete scrim", completeError);
      setRequestError(completeError.message || "Something went wrong while ending this scrim.");
    } finally {
      setIsCompletingScrim(false);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-on-background min-h-screen">
      <TopBar
        actions={(
          <Link
            aria-label="Back to scrim board"
            className="hidden h-10 items-center justify-center gap-xs rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-md font-label-bold text-label-bold text-on-surface-variant transition-colors hover:border-primary/35 hover:bg-surface-container hover:text-primary active:scale-95 sm:flex"
            href="/"
            title="Back to scrim board"
          >
            <MaterialSymbol className="text-[18px]">arrow_back</MaterialSymbol>
            Board
          </Link>
        )}
      />

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <main className="max-w-[1200px] mx-auto px-margin-mobile py-xl text-center">
          <MaterialSymbol className="text-[48px] text-outline mb-md block">sentiment_dissatisfied</MaterialSymbol>
          <h2 className="font-headline-2 text-headline-2 text-on-surface mb-sm">{error}</h2>
          <Link href="/" className="text-primary font-label-bold underline">
            Back to Scrim Board
          </Link>
        </main>
      ) : (
        <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg py-lg space-y-lg pb-32">

          {/* ── Matchup card ──────────────────────────────────────── */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <div className="flex items-center justify-center gap-lg">

              {/* Posting team */}
              <div className="flex flex-col items-center gap-sm flex-1 min-w-0">
                <TeamAvatar initials={teamInitials} />
                <div className="text-center">
                  <p className="font-headline-3 text-headline-3 text-on-surface leading-tight break-words w-full flex items-center justify-center gap-1">
                    {teamName}
                    {verified && (
                      <MaterialSymbol className="text-[16px] text-primary shrink-0" fill>
                        verified
                      </MaterialSymbol>
                    )}
                  </p>
                  <p className="font-label-small text-label-small text-on-surface-variant mt-1">{orgName}</p>
                </div>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center shrink-0 px-sm">
                <span className="font-label-bold text-label-bold text-outline uppercase tracking-widest">VS</span>
              </div>

              {/* Challenger slot */}
              <div className="flex flex-col items-center gap-sm flex-1 min-w-0">
                {displayChallengerTeam ? (
                  <TeamAvatar initials={getInitials(displayChallengerTeam.name)} />
                ) : (
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-surface-container-high border-2 border-dashed border-outline-variant flex items-center justify-center shrink-0">
                    <MaterialSymbol className="text-[32px] text-outline">group_add</MaterialSymbol>
                  </div>
                )}
                <div className="text-center">
                  <p className="font-headline-3 text-headline-3 text-on-surface-variant leading-tight">
                    {displayChallengerTeam?.name || "Your Team"}
                  </p>
                  <p className="font-label-small text-label-small text-outline mt-1">
                    {displayChallengerTeam
                      ? `${displayChallengerTeam.game_title} · ${displayChallengerTeam.rank_tier || "Rank TBD"}`
                      : "Challenger"}
                  </p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex justify-center mt-md">
              {isOpen ? (
                <span className="inline-flex items-center gap-1 bg-primary-fixed text-on-primary-fixed font-label-bold text-label-bold px-4 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {statusLabel}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 font-label-bold text-label-bold px-4 py-1.5 rounded-full ${
                    isInboundPending
                      ? "bg-primary-fixed text-on-primary-fixed"
                      : userHasRequested
                        ? "bg-[#E3F9E5] text-[#1B5E20]"
                        : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  <MaterialSymbol className="text-[14px]">
                    {isInboundPending ? "pending_actions" : userHasRequested ? "check_circle" : "lock"}
                  </MaterialSymbol>
                  {statusLabel}
                </span>
              )}
            </div>

            {/* Time + tags */}
            <div className="mt-lg text-center">
              <p className="font-headline-2 text-headline-2 text-on-surface">{dateTime}</p>
              <div className="flex flex-wrap justify-center gap-sm mt-md">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-small text-label-small">
                  <MaterialSymbol className="text-[14px] mr-1">sports_esports</MaterialSymbol>
                  {game}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-small text-label-small">
                  <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: rankColor }} />
                  {rank}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-small text-label-small">
                  <MaterialSymbol className="text-[14px] mr-1">format_list_numbered</MaterialSymbol>
                  {gamesCount}
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-small text-label-small">
                  <MaterialSymbol className="text-[14px] mr-1">public</MaterialSymbol>
                  {region}
                </span>
              </div>
            </div>
          </section>

          {/* ── CTA ───────────────────────────────────────────────── */}
          <section className="space-y-md">
            {isConfirmedParticipant ? (
              <div className="grid gap-sm md:grid-cols-2">
                <button
                  className="w-full bg-[#1B5E20] text-white rounded-xl py-4 flex items-center justify-center gap-sm transition-all active:scale-[0.98] shadow-sm font-headline-3 text-headline-3 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCompletingScrim}
                  onClick={handleCompleteScrim}
                  type="button"
                >
                  <MaterialSymbol fill>flag</MaterialSymbol>
                  {isCompletingScrim ? "Ending..." : "Mark Played"}
                </button>
                <Link
                  className="w-full bg-primary text-on-primary rounded-xl py-4 flex items-center justify-center gap-sm transition-all active:scale-[0.98] shadow-sm font-headline-3 text-headline-3"
                  href={`/scrims/${scrim.id}/chat`}
                >
                  <MaterialSymbol fill>chat_bubble</MaterialSymbol>
                  Open Chat
                </Link>
              </div>
            ) : isOwnListing && isOpen ? (
              <form
                className="bg-surface-container-lowest rounded-xl p-md border border-surface-container-highest space-y-md"
                onSubmit={handleSaveEdit}
              >
                <div>
                  <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                    Edit Your Listing
                  </p>
                  <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
                    Update when this scrim happens and what opponent ranks you want to play against.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <label className="flex flex-col gap-sm">
                    <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                      Date
                    </span>
                    <input
                      className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary"
                      name="date"
                      onChange={handleEditChange}
                      type="date"
                      value={editForm.date}
                    />
                  </label>

                  <label className="flex flex-col gap-sm">
                    <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                      Start Time
                    </span>
                    <input
                      className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary"
                      name="startTime"
                      onChange={handleEditChange}
                      type="time"
                      value={editForm.startTime}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-sm">
                  <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                    Number of Games
                  </span>
                  <select
                    className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary"
                    name="gamesCount"
                    onChange={handleEditChange}
                    value={editForm.gamesCount}
                  >
                    <option value="1">1 Game</option>
                    <option value="2">2 Games</option>
                    <option value="3">3 Games</option>
                    <option value="4">4 Games</option>
                    <option value="5">5 Games</option>
                  </select>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <label className="flex flex-col gap-sm">
                    <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                      Opponent Rank Min
                    </span>
                    <select
                      className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary"
                      name="opponentRankMin"
                      onChange={handleEditChange}
                      value={editForm.opponentRankMin}
                    >
                      {getRanksForGame(game).map((rankOption) => (
                        <option key={rankOption}>{rankOption}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-sm">
                    <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                      Opponent Rank Max
                    </span>
                    <select
                      className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md focus:ring-2 focus:ring-primary"
                      name="opponentRankMax"
                      onChange={handleEditChange}
                      value={editForm.opponentRankMax}
                    >
                      {getRanksForGame(game).map((rankOption) => (
                        <option key={rankOption}>{rankOption}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {editError && (
                  <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
                    {editError}
                  </div>
                )}
                {editSuccess && (
                  <div className="rounded-xl bg-[#E3F9E5] px-md py-sm font-body-sub text-body-sub text-[#1B5E20]">
                    {editSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-sm">
                  <button
                    className="w-full bg-[#1B5E20] text-white rounded-xl py-4 flex items-center justify-center gap-sm transition-all active:scale-[0.98] shadow-sm font-headline-3 text-headline-3 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingEdit || isCancellingListing}
                    type="submit"
                  >
                    <MaterialSymbol fill>edit_calendar</MaterialSymbol>
                    {isSavingEdit ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    className="rounded-xl border border-error bg-error-container px-lg py-4 font-headline-3 text-headline-3 text-on-error-container transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingEdit || isCancellingListing}
                    onClick={handleCancelListing}
                    type="button"
                  >
                    {isCancellingListing ? "Retracting..." : "Retract"}
                  </button>
                </div>
              </form>
            ) : isInboundPending ? (
              <>
                <div className="bg-surface-container-lowest rounded-xl p-md border border-surface-container-highest">
                  <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                    Request From
                  </p>
                  <div className="mt-sm flex items-center gap-sm rounded-xl bg-surface-container-low p-md">
                    <div className="h-10 w-10 rounded-lg bg-surface-container-high flex items-center justify-center font-headline-3 text-headline-3 text-on-surface">
                      {getInitials(matchedTeam?.name)}
                    </div>
                    <div>
                      <p className="font-label-bold text-label-bold text-on-surface">{matchedTeam?.name}</p>
                      <p className="font-label-small text-label-small text-on-surface-variant">
                        {matchedTeam?.organization?.name || "Independent"} · {matchedTeam?.game_title}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-sm md:grid-cols-2">
                  <Link
                    className="w-full bg-primary text-on-primary rounded-xl py-4 flex items-center justify-center gap-sm transition-all active:scale-[0.98] shadow-sm font-headline-3 text-headline-3"
                    href={`/scrims/${scrim.id}/chat`}
                  >
                    <MaterialSymbol fill>chat_bubble</MaterialSymbol>
                    Open Chat
                  </Link>
                  <Link
                    className="w-full bg-surface-container-lowest text-primary border border-primary rounded-xl py-4 flex items-center justify-center gap-sm transition-all active:scale-[0.98] shadow-sm font-headline-3 text-headline-3"
                    href={`/requests?scrim=${scrim.id}`}
                  >
                    <MaterialSymbol fill>pending_actions</MaterialSymbol>
                    Respond in Requests
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="bg-surface-container-lowest rounded-xl p-md border border-surface-container-highest">
                  <label className="flex flex-col gap-sm">
                    <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">
                      Requesting Team
                    </span>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-low text-on-surface font-body-main text-body-main rounded-xl border-none py-md px-md pr-xl appearance-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                        disabled={
                          isLoadingRequestingTeams ||
                          requestingTeams.length === 0 ||
                          requested ||
                          userHasRequested ||
                          requestLoading
                        }
                        onChange={(event) => {
                          setSelectedRequestingTeamId(event.target.value);
                          setRequestError("");
                        }}
                        value={selectedRequestingTeamId}
                      >
                        {isLoadingRequestingTeams ? (
                          <option value="">Loading teams...</option>
                        ) : requestingTeams.length === 0 ? (
                          <option value="">Create a {game} team before requesting</option>
                        ) : (
                          requestingTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name} - {team.game_title}
                            </option>
                          ))
                        )}
                      </select>
                      <MaterialSymbol className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                        expand_more
                      </MaterialSymbol>
                    </div>
                  </label>
                  {requestError && (
                    <div className="mt-sm rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
                      {requestError}
                    </div>
                  )}
                  {requestSuccess && (
                    <div className="mt-sm rounded-xl bg-[#E3F9E5] px-md py-sm font-body-sub text-body-sub text-[#1B5E20]">
                      {requestSuccess}
                    </div>
                  )}
                </div>

                {requested || userHasRequested ? (
              <div className="grid gap-sm md:grid-cols-[1fr_auto_auto]">
                <div className="w-full bg-[#E3F9E5] text-[#1B5E20] rounded-xl py-4 flex items-center justify-center gap-sm">
                  <MaterialSymbol fill>check_circle</MaterialSymbol>
                  <span className="font-headline-3 text-headline-3">
                    Request Sent{selectedRequestingTeam ? ` from ${selectedRequestingTeam.name}` : ""}
                  </span>
                </div>
                <Link
                  className="rounded-xl bg-primary px-lg py-4 font-headline-3 text-headline-3 text-on-primary transition-colors hover:opacity-90 flex items-center justify-center gap-sm"
                  href={`/scrims/${scrim.id}/chat`}
                >
                  <MaterialSymbol fill>chat_bubble</MaterialSymbol>
                  Chat
                </Link>
                <button
                  className="rounded-xl border border-outline-variant bg-surface-container-lowest px-lg py-4 font-headline-3 text-headline-3 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={requestLoading}
                  onClick={handleRetractRequest}
                  type="button"
                >
                  {requestLoading ? "Retracting..." : "Retract"}
                </button>
              </div>
                ) : (
              <button
                disabled={!isOpen || isLoadingRequestingTeams || requestingTeams.length === 0 || requestLoading}
                onClick={handleRequestScrim}
                className={`w-full rounded-xl py-4 flex items-center justify-center gap-sm transition-all active:scale-[0.98] shadow-sm font-headline-3 text-headline-3 ${
                  isOpen && requestingTeams.length > 0
                    ? "bg-primary text-on-primary hover:opacity-90"
                    : "bg-surface-container text-on-surface-variant cursor-not-allowed"
                }`}
              >
                <MaterialSymbol fill={isOpen}>swords</MaterialSymbol>
                {requestLoading ? "Sending Request..." : isOpen ? "Request This Scrim" : "No Longer Available"}
              </button>
                )}
              </>
            )}
          </section>

          {/* ── Match details ─────────────────────────────────────── */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <h2 className="font-headline-3 text-headline-3 mb-md">Match Details</h2>
            <div className="space-y-md">
              <DetailRow icon="sports_esports" label="Game"          value={game} />
              <DetailRow icon="schedule"       label="Time"          value={dateTime} />
              <DetailRow icon="format_list_numbered" label="Games"   value={gamesCount} />
              <DetailRow icon="military_tech"  label="Posting Rank"  value={rank} />
              <DetailRow icon="swap_vert"      label="Opponent Rank" value={rankRange} />
              <DetailRow icon="public"         label="Location"      value={region} />
              <DetailRow
                icon="star"
                label="Matchmake Rating"
                value={`${rating} / 5.0`}
                last
              />
            </div>
          </section>

          {/* ── About the org ─────────────────────────────────────── */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border border-surface-container-highest">
            <h2 className="font-headline-3 text-headline-3 mb-md">About the Team</h2>
            <div className="flex items-center gap-md">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center font-headline-2 text-headline-2 text-on-surface font-bold shrink-0">
                {teamInitials}
              </div>
              <div>
                <p className="font-label-bold text-label-bold text-on-surface flex items-center gap-1">
                  {teamName}
                  {verified && (
                    <MaterialSymbol className="text-[14px] text-primary" fill>verified</MaterialSymbol>
                  )}
                </p>
                <p className="font-label-small text-label-small text-on-surface-variant">{orgName}</p>
                {org?.type && (
                  <p className="font-label-small text-label-small text-outline capitalize mt-0.5">
                    {org.type.replace("_", " ")}
                  </p>
                )}
              </div>
            </div>
          </section>

        </main>
      )}
    </div>
  );
}
