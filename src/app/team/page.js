"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { supabase } from "@/lib/supabase";
import { getDefaultRankForGame, getRanksForGame } from "@/lib/game-options";

const SCRIM_DURATION_HOURS = 3;

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
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState(() => createRosterPlayer("Valorant"));
  const [rosterError, setRosterError] = useState("");
  const [rosterSuccess, setRosterSuccess] = useState("");
  const [savingRoster, setSavingRoster] = useState(false);
  const [hasRosterProfilesColumn, setHasRosterProfilesColumn] = useState(true);

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

  const teamInitials = getInitials(selectedTeam?.name || "Team");
  const scrimsPlayed = previousScrims.length;
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
              </div>
            </section>

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
                      <span className="font-editorial-large text-editorial-large text-primary">{scrimsPlayed}</span>
                      <span className="font-label-small text-label-small text-on-surface-variant">Previous Scrims</span>
                    </div>
                    <div className="bg-surface-container-low p-sm rounded-lg flex flex-col items-center justify-center text-center">
                      <span className="font-editorial-large text-editorial-large text-secondary">{confirmedScrims}</span>
                      <span className="font-label-small text-label-small text-on-surface-variant">Confirmed</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="lg:col-span-2 flex flex-col gap-lg">
                <ScrimList title="Upcoming Scrims" scrims={upcomingScrims} empty="No upcoming scrims for this team." />
                <ScrimList title="Previous Scrims" scrims={previousScrims} empty="Previous scrims will appear here after they end." previous />
              </div>
            </div>
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

function ScrimList({ title, scrims, empty, previous = false }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-surface-variant p-md">
      <div className="flex justify-between items-center mb-md">
        <h2 className="font-headline-3 text-on-surface">{title}</h2>
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
      <div className="flex flex-col gap-md">
        {scrims.length === 0 ? (
          <div className="rounded-lg bg-surface-container-low p-md font-body-sub text-body-sub text-on-surface-variant">
            {empty}
          </div>
        ) : (
          scrims.map((scrim) => (
            <Link
              key={scrim.id}
              href={`/scrims/${scrim.id}`}
              className="block border border-surface-variant rounded-lg p-md hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.05)] transition-shadow"
            >
              <ScrimCard scrim={scrim} />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function ScrimCard({ scrim }) {
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
      </div>
    </>
  );
}
