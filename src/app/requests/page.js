"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { supabase } from "@/lib/supabase";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatScrimTime(value) {
  if (!value) return "Time TBD";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-lowest p-lg text-center">
      <MaterialSymbol className="text-[36px] text-outline mb-sm block">pending_actions</MaterialSymbol>
      <h3 className="font-headline-3 text-headline-3 text-on-surface">{title}</h3>
      <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{body}</p>
      {action && <div className="mt-md">{action}</div>}
    </div>
  );
}

function RequestCard({ isRetracting = false, onRetract, request, perspective }) {
  const isInbound = perspective === "inbound";
  const isOutbound = perspective === "outbound";
  const isConfirmed = request.status === "confirmed";
  const displayTeam = isInbound ? request.matched_team : request.posting_team;
  const displayOrg = displayTeam?.organization;
  const displayName = displayTeam?.name || "Unknown Team";

  return (
    <article className="bg-surface-container-lowest rounded-[16px] p-md border border-surface-variant shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex items-start gap-md mb-md">
        <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0 font-headline-3 text-on-surface-variant font-bold">
          {getInitials(displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm mb-xs flex-wrap">
            <h3 className="font-headline-3 text-headline-3 text-on-surface">{displayName}</h3>
            <span className="inline-flex items-center bg-primary-fixed text-on-primary-fixed-variant rounded-full px-2 py-0.5 font-label-small text-label-small">
              {request.game_title}
            </span>
          </div>
          <p className="font-label-small text-label-small text-on-surface-variant mb-xs">
            {displayOrg?.name || "Independent"}
          </p>
          <div className="flex items-center gap-xs text-on-surface-variant font-body-sub text-body-sub">
            <MaterialSymbol className="text-[16px]">schedule</MaterialSymbol>
            <span>{formatScrimTime(request.scheduled_at)}</span>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-wrap gap-sm pt-md border-t border-surface-variant items-center">
        <span
          className={
            isConfirmed
              ? "bg-[#E3F9E5] text-[#1B5E20] font-label-bold text-label-bold py-2 px-4 rounded-lg inline-flex items-center gap-xs"
              : "bg-primary-fixed text-on-primary-fixed font-label-bold text-label-bold py-2 px-4 rounded-lg inline-flex items-center gap-xs"
          }
        >
          <MaterialSymbol className="text-[16px]">
            {isConfirmed ? "check_circle" : "schedule"}
          </MaterialSymbol>
          {isConfirmed
            ? "Confirmed"
            : isInbound
              ? "Needs Response"
              : "Pending Response"}
        </span>
        {isOutbound && !isConfirmed && (
          <button
            className="rounded-lg border border-outline-variant px-4 py-2 font-label-bold text-label-bold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRetracting}
            onClick={() => onRetract?.(request)}
            type="button"
          >
            {isRetracting ? "Retracting..." : "Retract"}
          </button>
        )}
        <Link
          className="ml-auto text-primary font-label-bold text-label-bold flex items-center gap-1"
          href={`/scrims/${request.id}`}
        >
          View Scrim
          <MaterialSymbol className="text-[16px]">arrow_forward</MaterialSymbol>
        </Link>
      </div>
    </article>
  );
}

export default function RequestsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inbound");
  const [teams, setTeams] = useState([]);
  const [inboundRequests, setInboundRequests] = useState([]);
  const [outboundRequests, setOutboundRequests] = useState([]);
  const [confirmedScrims, setConfirmedScrims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [retractingId, setRetractingId] = useState("");

  useEffect(() => {
    async function fetchRequests() {
      setIsLoading(true);
      setErrorMessage("");

      const { data: userData, error: userError } = await supabase.auth.getUser();

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
        console.error("Failed to load profile for requests", profileError);
        setErrorMessage("We could not load your profile. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!profile?.org_id) {
        setErrorMessage("Create an organization before managing requests.");
        setIsLoading(false);
        return;
      }

      const { data: teamData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, game_title")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true });

      if (teamsError) {
        console.error("Failed to load teams for requests", teamsError);
        setErrorMessage("We could not load your teams. Please try again.");
        setIsLoading(false);
        return;
      }

      const teamIds = (teamData || []).map((team) => team.id);
      setTeams(teamData || []);

      if (teamIds.length === 0) {
        setInboundRequests([]);
        setOutboundRequests([]);
        setConfirmedScrims([]);
        setIsLoading(false);
        return;
      }

      const requestSelect = `
        id,
        posting_team_id,
        matched_team_id,
        game_title,
        scheduled_at,
        status,
        posting_team:teams!scrim_requests_posting_team_id_fkey (
          id,
          name,
          game_title,
          organization:organizations!teams_org_id_fkey (
            id,
            name
          )
        ),
        matched_team:teams!scrim_requests_matched_team_id_fkey (
          id,
          name,
          game_title,
          organization:organizations!teams_org_id_fkey (
            id,
            name
          )
        )
      `;

      const [inboundResult, outboundResult, confirmedPostedResult, confirmedMatchedResult] = await Promise.all([
        supabase
          .from("scrim_requests")
          .select(requestSelect)
          .in("posting_team_id", teamIds)
          .eq("status", "pending")
          .not("matched_team_id", "is", null)
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("scrim_requests")
          .select(requestSelect)
          .in("matched_team_id", teamIds)
          .eq("status", "pending")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("scrim_requests")
          .select(requestSelect)
          .in("posting_team_id", teamIds)
          .eq("status", "confirmed")
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("scrim_requests")
          .select(requestSelect)
          .in("matched_team_id", teamIds)
          .eq("status", "confirmed")
          .order("scheduled_at", { ascending: true }),
      ]);

      const queryError = inboundResult.error || outboundResult.error || confirmedPostedResult.error || confirmedMatchedResult.error;

      if (queryError) {
        console.error("Failed to load requests", queryError);
        setErrorMessage("We could not load your requests. Please try again.");
        setIsLoading(false);
        return;
      }

      const confirmedById = new Map([
        ...(confirmedPostedResult.data || []),
        ...(confirmedMatchedResult.data || []),
      ].map((request) => [request.id, request]));

      setInboundRequests(inboundResult.data || []);
      setOutboundRequests(outboundResult.data || []);
      setConfirmedScrims(Array.from(confirmedById.values()));
      setIsLoading(false);
    }

    fetchRequests();
  }, [router]);

  const counts = useMemo(() => ({
    inbound: inboundRequests.length,
    outbound: outboundRequests.length,
    confirmed: confirmedScrims.length,
  }), [confirmedScrims.length, inboundRequests.length, outboundRequests.length]);

  const activeRequests =
    activeTab === "inbound"
      ? inboundRequests
      : activeTab === "outbound"
        ? outboundRequests
        : confirmedScrims;

  async function handleRetractRequest(request) {
    setRetractingId(request.id);
    setActionError("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const teamIds = teams.map((team) => team.id);

      if (!teamIds.includes(request.matched_team_id)) {
        setActionError("You can only retract requests made by your own teams.");
        return;
      }

      const { data: updatedScrim, error: updateError } = await supabase
        .from("scrim_requests")
        .update({
          matched_team_id: null,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id)
        .eq("status", "pending")
        .eq("matched_team_id", request.matched_team_id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Failed to retract scrim request", updateError);
        setActionError(updateError.message || "We could not retract that request.");
        return;
      }

      if (!updatedScrim) {
        setActionError("That request may have already changed.");
        return;
      }

      setOutboundRequests((currentRequests) =>
        currentRequests.filter((outboundRequest) => outboundRequest.id !== request.id)
      );
    } catch (retractError) {
      console.error("Failed to retract scrim request", retractError);
      setActionError(retractError.message || "Something went wrong while retracting that request.");
    } finally {
      setRetractingId("");
    }
  }

  return (
    <>
      <TopBar />

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-lg pt-lg pb-32 md:pb-xl">
        <div className="mb-lg">
          <h2 className="font-headline-1 text-headline-1 text-on-surface mb-sm">Requests</h2>
          <p className="font-body-sub text-body-sub text-on-surface-variant">
            Manage real scrim requests for your organization.
          </p>
        </div>

        <div className="bg-surface-container-low p-1 rounded-lg flex mb-xl max-w-md">
          {["inbound", "outbound", "confirmed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-4 rounded-md font-label-bold text-label-bold text-center capitalize transition-colors ${
                activeTab === tab
                  ? "bg-surface-container-lowest text-on-surface shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {counts[tab] > 0 && (
                <span className="ml-xs inline-flex min-w-5 justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 text-on-primary">
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="rounded-[16px] border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            Loading requests...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
            {errorMessage}
          </div>
        ) : teams.length === 0 ? (
          <EmptyState
            title="No teams yet"
            body="Create a team before managing scrim requests."
            action={
              <Link
                href="/team/new"
                className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
              >
                <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
                Add Team
              </Link>
            }
          />
        ) : activeRequests.length === 0 ? (
          <EmptyState
            title={
              activeTab === "inbound"
                ? "No inbound requests"
                : activeTab === "outbound"
                  ? "No outbound requests"
                  : "No confirmed scrims"
            }
            body={
              activeTab === "inbound"
                ? "Requests from other teams will appear here."
                : activeTab === "outbound"
                  ? "Scrims your teams request will appear here while they wait for a response."
                  : "Confirmed scrims will appear here after they are accepted."
            }
            action={
              activeTab === "outbound" ? (
                <Link
                  href="/"
                  className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
                >
                  <MaterialSymbol className="text-[18px]">search</MaterialSymbol>
                  Browse Scrims
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="space-y-md">
            {actionError && (
              <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
                {actionError}
              </div>
            )}
            {activeRequests.map((request) => (
              <RequestCard
                isRetracting={retractingId === request.id}
                key={request.id}
                onRetract={handleRetractRequest}
                perspective={activeTab === "outbound" ? "outbound" : "inbound"}
                request={request}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
