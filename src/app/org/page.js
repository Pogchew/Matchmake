"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { getDisplayModeForTeam, normalizeTeamLocation } from "@/lib/game-options";
import { supabase } from "@/lib/supabase";

function formatOrgType(type) {
  if (!type) return "Amateur";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatScrimDate(value) {
  if (!value) return { day: "TBD", time: "TBD" };

  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date),
  };
}

function groupTeamsByGame(teams) {
  return teams.reduce((groups, team) => {
    const game = team.game_title || "Other";
    return {
      ...groups,
      [game]: [...(groups[game] || []), team],
    };
  }, {});
}

function getScrimCounts(scrims) {
  return scrims.reduce(
    (counts, scrim) => ({
      ...counts,
      [scrim.status]: (counts[scrim.status] || 0) + 1,
    }),
    {},
  );
}

function getTeamScrims(scrims, teamId) {
  return scrims.filter((scrim) => scrim.posting_team_id === teamId);
}

function isMissingOrgLogoError(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || error?.message?.includes("logo_url");
}

function EmptyState({ icon, title, body, action }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant p-lg text-center">
      <MaterialSymbol className="text-[36px] text-outline mb-sm block">{icon}</MaterialSymbol>
      <h3 className="font-headline-3 text-headline-3 text-on-surface">{title}</h3>
      <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{body}</p>
      {action && <div className="mt-md">{action}</div>}
    </div>
  );
}

function ProgramSection({ game, scrims, teams }) {
  const gameTeamIds = new Set(teams.map((team) => team.id));
  const gameScrims = scrims.filter((scrim) => gameTeamIds.has(scrim.posting_team_id));
  const counts = getScrimCounts(gameScrims);

  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
      <div className="flex flex-col gap-sm border-b border-outline-variant/20 bg-surface-container-low px-md py-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="font-headline-3 text-headline-3 text-on-surface">{game}</h4>
          <p className="font-label-small text-label-small text-on-surface-variant">
            {teams.length} team{teams.length === 1 ? "" : "s"} in this program
          </p>
        </div>
        <CompactStatusSummary counts={counts} />
      </div>
      <div className="divide-y divide-outline-variant/15">
        {teams.map((team) => (
          <TeamProgramRow key={team.id} scrims={getTeamScrims(scrims, team.id)} team={team} />
        ))}
      </div>
    </section>
  );
}

function CompactStatusSummary({ counts }) {
  return (
    <div className="flex flex-wrap gap-xs">
      <span className="rounded-full bg-primary-fixed px-2 py-1 font-label-small text-[10px] text-on-primary-fixed">
        {counts.open || 0} open
      </span>
      <span className="rounded-full bg-surface-container-high px-2 py-1 font-label-small text-[10px] text-on-surface-variant">
        {counts.pending || 0} pending
      </span>
      <span className="rounded-full bg-surface-container-high px-2 py-1 font-label-small text-[10px] text-on-surface-variant">
        {counts.confirmed || 0} confirmed
      </span>
    </div>
  );
}

function TeamProgramRow({ scrims, team }) {
  const counts = getScrimCounts(scrims);
  const activeCount = (counts.open || 0) + (counts.pending || 0) + (counts.matched || 0) + (counts.confirmed || 0);
  const rowAccent = activeCount ? "bg-primary" : "bg-outline-variant";

  return (
    <Link
      href={`/team?id=${team.id}`}
      className="grid gap-sm p-md transition-colors hover:bg-surface-container-low md:grid-cols-[minmax(180px,1.5fr)_repeat(5,minmax(88px,auto))_auto] md:items-center"
    >
      <div className="flex min-w-0 items-center gap-sm">
        <span className={`h-10 w-1 rounded-full ${rowAccent}`} />
        <div className="min-w-0">
          <p className="truncate font-label-bold text-label-bold text-on-surface">{team.name}</p>
          <p className="font-label-small text-label-small text-on-surface-variant">{team.game_title || "Game not set"}</p>
        </div>
      </div>
      <ProgramRowPill label="Mode" value={getDisplayModeForTeam(team)} />
      <ProgramRowPill label="Rank" value={team.rank_tier || "TBD"} />
      <ProgramRowPill label="Location" value={normalizeTeamLocation(team.region) || "Not set"} />
      <ProgramRowPill label="Open" value={counts.open || 0} />
      <ProgramRowPill label="Pending" value={counts.pending || 0} />
      <div className="flex items-center justify-between gap-sm md:justify-end">
        <span className="font-label-small text-label-small text-on-surface-variant">
          Rating {Number(team.scrimgg_rating || 0).toFixed(1)}
        </span>
        <MaterialSymbol className="text-primary">arrow_forward</MaterialSymbol>
      </div>
    </Link>
  );
}

function ProgramRowPill({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-sm rounded-lg bg-surface-container-low px-sm py-xs md:block md:bg-transparent md:px-0 md:py-0">
      <span className="font-label-small text-[10px] uppercase tracking-wide text-outline md:block">{label}</span>
      <span className="font-label-bold text-label-small text-on-surface md:block">{value}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <>
      <TopBar />
      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-lg pb-xl flex flex-col gap-xl">
        <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/30 p-lg font-body-sub text-body-sub text-on-surface-variant">
          Loading organization...
        </div>
      </main>
      <BottomNav />
    </>
  );
}

export default function OrgPage() {
  const router = useRouter();
  const logoInputRef = useRef(null);
  const [organization, setOrganization] = useState(null);
  const [teams, setTeams] = useState([]);
  const [scrims, setScrims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [setupMessage, setSetupMessage] = useState("");
  const [selectedGame, setSelectedGame] = useState("All");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [hasLogoColumn, setHasLogoColumn] = useState(true);
  const [logoUploadError, setLogoUploadError] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    async function fetchOrgDashboard() {
      setIsLoading(true);
      setErrorMessage("");
      setSetupMessage("");

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(userData.user.id);

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, org_id")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        console.error("Failed to load org profile", profileError);
        setSetupMessage("Your account is missing an organization.");
        setIsLoading(false);
        return;
      }

      if (!profile?.org_id) {
        setSetupMessage("Your account is missing an organization.");
        setIsLoading(false);
        return;
      }

      let { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, type, verified_flag, region, org_admin_id, logo_url")
        .eq("id", profile.org_id)
        .single();

      if (isMissingOrgLogoError(orgError)) {
        console.warn("logo_url is missing in Supabase. Run supabase_org_logo.sql to enable organization logos.");
        setHasLogoColumn(false);
        ({ data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("id, name, type, verified_flag, region, org_admin_id")
          .eq("id", profile.org_id)
          .single());
      } else {
        setHasLogoColumn(true);
      }

      if (orgError) {
        console.error("Failed to load organization", orgError);
        setErrorMessage("We could not load your organization. Please try again.");
        setIsLoading(false);
        return;
      }

      const { data: teamData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, game_title, mode, rank_tier, region, scrimgg_rating, created_at")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true });

      if (teamsError) {
        console.error("Failed to load organization teams", teamsError);
        setErrorMessage("We could not load your teams. Please try again.");
        setIsLoading(false);
        return;
      }

      const teamIds = (teamData || []).map((team) => team.id);
      let scrimData = [];

      if (teamIds.length) {
        const { data, error: scrimsError } = await supabase
          .from("scrim_requests")
          .select("id, posting_team_id, game_title, scheduled_at, status, matched_team_id")
          .in("posting_team_id", teamIds)
          .order("scheduled_at", { ascending: true });

        if (scrimsError) {
          console.error("Failed to load organization scrims", scrimsError);
          setErrorMessage("We could not load your scrims. Please try again.");
          setIsLoading(false);
          return;
        }

        scrimData = data || [];
      }

      setOrganization(orgData);
      setTeams(teamData || []);
      setScrims(scrimData);
      setIsLoading(false);
    }

    fetchOrgDashboard();
  }, [router]);

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !organization?.id) return;

    setLogoUploadError("");

    if (!hasLogoColumn) {
      setLogoUploadError("Run supabase_org_logo.sql before uploading organization logos.");
      return;
    }

    if (organization.org_admin_id && organization.org_admin_id !== currentUserId) {
      setLogoUploadError("Only the organization owner can update the organization logo.");
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setLogoUploadError("Upload an image file for your organization logo.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadError("Logo image must be under 2MB.");
      return;
    }

    setIsUploadingLogo(true);

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const logoPath = `${organization.id}/logo-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("org-logos")
        .upload(logoPath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Failed to upload organization logo", uploadError);
        setLogoUploadError(uploadError.message || "We could not upload the logo.");
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("org-logos").getPublicUrl(logoPath);
      const logoUrl = publicUrlData?.publicUrl;

      if (!logoUrl) {
        setLogoUploadError("We could not create a public URL for the logo.");
        return;
      }

      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organization.id);

      if (updateError) {
        console.error("Failed to save organization logo", updateError);
        setLogoUploadError(updateError.message || "We could not save the logo.");
        return;
      }

      setOrganization((current) => ({
        ...current,
        logo_url: logoUrl,
      }));
    } catch (error) {
      console.error("Failed to upload organization logo", error);
      setLogoUploadError(error.message || "Something went wrong while uploading your logo.");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const teamsByGame = useMemo(() => groupTeamsByGame(teams), [teams]);
  const activeGames = useMemo(() => Object.keys(teamsByGame).sort((a, b) => a.localeCompare(b)), [teamsByGame]);
  const visibleProgramGames = selectedGame === "All" ? activeGames : [selectedGame];
  const openScrims = scrims.filter((scrim) => scrim.status === "open").length;
  const upcomingScrims = scrims.filter((scrim) => ["open", "pending", "matched", "confirmed"].includes(scrim.status));
  const isOrgOwner = organization?.org_admin_id ? organization.org_admin_id === currentUserId : true;

  if (isLoading) return <LoadingState />;

  return (
    <>
      <TopBar />

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-lg pb-xl flex flex-col gap-xl">
        {setupMessage ? (
          <EmptyState
            icon="domain_disabled"
            title="Your account is missing an organization."
            body="Finish setup or create an organization later so your teams and scrims have a home."
            action={
              <Link
                href="/org/new"
                className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
              >
                <MaterialSymbol className="text-[18px]" fill>
                  domain_add
                </MaterialSymbol>
                Create Organization
              </Link>
            }
          />
        ) : errorMessage ? (
          <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
            {errorMessage}
          </div>
        ) : (
          <>
            <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
              <div className="flex flex-col gap-md sm:flex-row sm:items-center">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-high shadow-sm">
                  {organization?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={`${organization?.name || "Organization"} logo`}
                      className="h-full w-full object-cover"
                      src={organization.logo_url}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-primary">
                      <MaterialSymbol className="text-[42px]" fill>
                        shield
                      </MaterialSymbol>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="font-label-bold text-label-bold text-outline uppercase tracking-wider mb-xs">My Organization</h2>
                  <h1 className="font-headline-1 text-headline-1 md:font-editorial-large md:text-editorial-large text-on-surface flex items-center gap-sm">
                    {organization?.name || "Unnamed Organization"}
                    {organization?.verified_flag && (
                      <MaterialSymbol className="text-primary text-[22px]" fill>
                        verified
                      </MaterialSymbol>
                    )}
                  </h1>
                  <div className="mt-sm flex flex-wrap gap-xs">
                    <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full">
                      {formatOrgType(organization?.type)}
                    </span>
                    <span className="bg-surface-container-high text-on-surface-variant font-label-small text-label-small px-2 py-1 rounded-full">
                      {normalizeTeamLocation(organization?.region) || "Location not set"}
                    </span>
                  </div>
                  <div className="mt-sm flex flex-wrap items-center gap-sm">
                    <input
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      ref={logoInputRef}
                      type="file"
                    />
                    {isOrgOwner ? (
                      <button
                        className="inline-flex items-center gap-xs rounded-lg bg-surface-variant px-md py-sm font-label-bold text-label-bold text-primary transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUploadingLogo || !hasLogoColumn}
                        onClick={() => logoInputRef.current?.click()}
                        type="button"
                      >
                        <MaterialSymbol className="text-[18px]">upload</MaterialSymbol>
                        {isUploadingLogo ? "Uploading..." : organization?.logo_url ? "Change Logo" : "Upload Logo"}
                      </button>
                    ) : (
                      <span className="font-label-small text-label-small text-outline">
                        Only the org owner can change the logo.
                      </span>
                    )}
                    {!hasLogoColumn && (
                      <span className="font-label-small text-label-small text-outline">
                        Run logo SQL first
                      </span>
                    )}
                  </div>
                  {logoUploadError && (
                    <div className="mt-sm rounded-lg bg-error-container px-sm py-xs font-label-small text-label-small text-on-error-container">
                      {logoUploadError}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-sm">
                <Link
                  href="/team/new"
                  className="bg-surface-variant text-primary font-label-bold text-label-bold px-md py-sm rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-xs"
                >
                  <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
                  Create Team
                </Link>
                <Link
                  href="/?post=true"
                  className="bg-primary text-on-primary font-label-bold text-label-bold px-md py-sm rounded-lg hover:bg-on-primary-fixed-variant transition-colors flex items-center gap-xs shadow-[0_4px_12px_rgba(0,112,235,0.2)]"
                >
                  <MaterialSymbol className="text-[18px]" fill>
                    calendar_month
                  </MaterialSymbol>
                  Schedule Scrim
                </Link>
              </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-3 gap-md">
              <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-xs text-outline mb-sm">
                  <MaterialSymbol className="text-[16px]">groups</MaterialSymbol>
                  <span className="font-label-small text-label-small uppercase tracking-wide">Teams</span>
                </div>
                <div className="font-headline-1 text-headline-1 text-on-surface">{teams.length}</div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-xs text-primary mb-sm">
                  <MaterialSymbol className="text-[16px]">sports_esports</MaterialSymbol>
                  <span className="font-label-small text-label-small uppercase tracking-wide">Open Scrims</span>
                </div>
                <div className="font-headline-1 text-headline-1 text-on-surface">{openScrims}</div>
              </div>
              <div className="col-span-2 md:col-span-1 bg-primary-fixed rounded-xl p-md border border-primary-fixed-dim/50 shadow-[0_8px_24px_-12px_rgba(0,112,235,0.15)] flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10">
                  <MaterialSymbol className="text-[100px]" fill>
                    event_upcoming
                  </MaterialSymbol>
                </div>
                <div className="flex items-center gap-xs text-on-primary-fixed mb-sm relative z-10">
                  <MaterialSymbol className="text-[16px]">calendar_month</MaterialSymbol>
                  <span className="font-label-small text-label-small uppercase tracking-wide">Upcoming Scrims</span>
                </div>
                <div className="font-headline-1 text-headline-1 text-on-primary-fixed relative z-10">
                  {upcomingScrims.length}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
              <section className="lg:col-span-1 flex flex-col gap-md">
                <h3 className="font-headline-3 text-headline-3 text-on-surface flex items-center gap-sm">
                  <MaterialSymbol className="text-primary">event_upcoming</MaterialSymbol>
                  Upcoming Scrims
                </h3>
                <div className="flex max-h-[560px] flex-col gap-sm overflow-y-auto pr-xs">
                  {upcomingScrims.length === 0 ? (
                    <EmptyState
                      icon="event_busy"
                      title="No scrims scheduled yet"
                      body="Post a listing when your team is ready to practice."
                      action={
                        <Link
                          href="/?post=true"
                          className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
                        >
                          <MaterialSymbol className="text-[18px]" fill>
                            calendar_month
                          </MaterialSymbol>
                          Schedule Scrim
                        </Link>
                      }
                    />
                  ) : (
                    upcomingScrims.map((scrim) => {
                      const team = teamsById.get(scrim.posting_team_id);
                      const date = formatScrimDate(scrim.scheduled_at);

                      return (
                        <Link
                          key={scrim.id}
                          href={`/scrims/${scrim.id}`}
                          className="bg-surface-container-lowest p-md rounded-xl border border-outline-variant/30 flex items-center gap-md hover:shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08)] transition-shadow"
                        >
                          <div className="flex flex-col items-center justify-center bg-surface-container w-12 h-12 rounded-lg text-on-surface-variant font-label-bold text-label-bold shrink-0">
                            <span className="text-[10px] uppercase text-outline">{date.day}</span>
                            <span>{date.time}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-label-small text-label-small text-primary mb-[2px]">
                              {team?.name || scrim.game_title}
                            </div>
                            <div className="font-label-bold text-label-bold text-on-surface">
                              {scrim.matched_team_id ? "Matched opponent" : "Waiting for opponent"}
                            </div>
                            <div className="mt-1 font-label-small text-label-small text-outline capitalize">
                              {scrim.status}
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="lg:col-span-2 flex flex-col gap-lg">
                <div className="flex flex-col gap-sm">
                  <div className="flex flex-col gap-xs md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="font-headline-3 text-headline-3 text-on-surface flex items-center gap-sm">
                        <MaterialSymbol className="text-primary">team_dashboard</MaterialSymbol>
                        Programs
                      </h3>
                      <p className="font-body-sub text-body-sub text-on-surface-variant">
                        One row per team, grouped by game so larger orgs stay easy to scan.
                      </p>
                    </div>
                    <Link
                      href="/team/new"
                      className="inline-flex w-fit items-center gap-xs rounded-lg bg-surface-variant px-md py-sm font-label-bold text-label-bold text-primary hover:bg-surface-container-high"
                    >
                      <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
                      Create Team
                    </Link>
                  </div>
                  <label className="flex w-full flex-col gap-xs rounded-xl border border-outline-variant/25 bg-surface-container-lowest p-sm md:max-w-[320px]">
                    <span className="font-label-small text-[10px] uppercase tracking-wide text-outline">
                      Filter programs
                    </span>
                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-lg border-none bg-surface-container-low px-md py-sm pr-xl font-label-bold text-label-bold text-on-surface focus:ring-2 focus:ring-primary disabled:opacity-60"
                        disabled={activeGames.length === 0}
                        onChange={(event) => setSelectedGame(event.target.value)}
                        value={selectedGame}
                      >
                        <option value="All">All active programs ({teams.length})</option>
                        {activeGames.map((game) => (
                          <option key={game} value={game}>
                            {game} ({teamsByGame[game]?.length || 0})
                          </option>
                        ))}
                      </select>
                      <MaterialSymbol className="pointer-events-none absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant">
                        expand_more
                      </MaterialSymbol>
                    </div>
                  </label>
                </div>
                {teams.length === 0 ? (
                  <EmptyState
                    icon="groups"
                    title="No teams yet"
                    body="Create your first team to start posting scrims."
                    action={
                      <Link
                        href="/team/new"
                        className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
                      >
                        <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
                        Create Team
                      </Link>
                    }
                  />
                ) : (
                  <div className="grid gap-md">
                    {visibleProgramGames.map((game) => (
                      <ProgramSection
                        game={game}
                        key={game}
                        scrims={scrims}
                        teams={teamsByGame[game] || []}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
