"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MatchmakeLogo from "@/components/MatchmakeLogo";
import MaterialSymbol from "@/components/MaterialSymbol";
import { clearAuthSession, getCurrentUser } from "@/lib/auth-session";
import { supabase, supabaseAuth } from "@/lib/supabase";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "organizations", label: "Organizations", icon: "apartment" },
  { id: "teams", label: "Teams", icon: "groups" },
  { id: "users", label: "Users", icon: "person" },
  { id: "scrims", label: "Scrims", icon: "sports_esports" },
  { id: "messages", label: "Chat & Reports", icon: "chat" },
  { id: "reviews", label: "Match Reviews", icon: "reviews" },
  { id: "reports", label: "Report Queue", icon: "flag" },
  { id: "audit", label: "Audit Log", icon: "history" },
];

const ACTIVITY_FILTERS = [
  { id: "all", label: "All activity" },
  { id: "people", label: "People" },
  { id: "scrims", label: "Scrims" },
  { id: "messages", label: "Messages" },
  { id: "reviews", label: "Reviews" },
  { id: "reports", label: "Reports" },
  { id: "system", label: "System" },
];

const EMPTY_DATA = {
  users: [],
  organizations: [],
  teams: [],
  scrims: [],
  messages: [],
  reviews: [],
  reports: [],
  activity: [],
};

const SCRIM_STATUSES = ["open", "pending", "confirmed", "completed", "cancelled", "expired"];
const REPORT_STATUSES = ["new", "triage", "waiting_on_school", "waiting_on_matchmake", "escalated", "action_pending", "verification_pending", "monitoring", "closed"];
const AI_TRIAGE_STATUSES = ["not_requested", "queued", "in_progress", "suggested", "accepted", "rejected", "blocked"];
const OPEN_REPORT_STATUSES = new Set(REPORT_STATUSES.filter((status) => status !== "closed"));

function relativeTime(value) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(value, options = {}) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: options.year ? "numeric" : undefined,
    hour: options.time === false ? undefined : "numeric",
    minute: options.time === false ? undefined : "2-digit",
  }).format(new Date(value));
}

function titleCase(value = "") {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(value = "Owner") {
  return value
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function statusClass(status) {
  if (["success", "completed", "confirmed", "open", "verified"].includes(status)) {
    return "bg-[#e5f7ec] text-[#177342]";
  }
  if (["failed", "cancelled", "expired", "declined"].includes(status)) {
    return "bg-[#ffe7e5] text-[#bd2929]";
  }
  return "bg-[#fff1d9] text-[#ad6200]";
}

function reportStatusClass(status) {
  if (status === "closed") return "bg-[#e5f7ec] text-[#177342]";
  if (["escalated", "action_pending"].includes(status)) return "bg-[#ffe7e5] text-[#bd2929]";
  if (["new", "triage", "verification_pending"].includes(status)) return "bg-[#fff1d9] text-[#ad6200]";
  return "bg-[#eef6ff] text-[#0878eb]";
}

function severityClass(severity) {
  if (Number(severity) === 0) return "bg-[#ffe7e5] text-[#bd2929]";
  if (Number(severity) === 1) return "bg-[#fff1d9] text-[#ad6200]";
  return "bg-[#eef6ff] text-[#0878eb]";
}

function severityLabel(severity) {
  const value = Number(severity);
  if (value === 0) return "S0 urgent";
  if (value === 1) return "S1 high";
  return "S2 normal";
}

function reportCaseLabel(report) {
  if (!report?.case_number) return report?.id?.slice(0, 8) || "Report";
  return `MM-REPORT-${String(report.case_number).padStart(4, "0")}`;
}

function formatPercent(numerator, denominator) {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function activityIcon(entityType) {
  return {
    users: "person",
    organizations: "apartment",
    teams: "groups",
    scrim_requests: "sports_esports",
    scrim_messages: "chat",
    team_match_reviews: "reviews",
    report_cases: "flag",
    system: "settings_suggest",
  }[entityType] || "adjust";
}

function activityCategory(entityType) {
  if (["users", "organizations", "teams"].includes(entityType)) return "people";
  if (entityType === "scrim_requests") return "scrims";
  if (entityType === "scrim_messages") return "messages";
  if (entityType === "team_match_reviews") return "reviews";
  if (entityType === "report_cases") return "reports";
  return "system";
}

function sectionForEntity(entityType) {
  return {
    users: "users",
    organizations: "organizations",
    teams: "teams",
    scrim_requests: "scrims",
    scrim_messages: "messages",
    team_match_reviews: "reviews",
    report_cases: "reports",
    system: "audit",
  }[entityType] || "audit";
}

function SectionTitle({ title, body, count }) {
  return (
    <div className="flex flex-col gap-xs border-b border-[#dce3ee] px-lg py-md sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[19px] font-semibold text-[#101828]">{title}</h2>
        <p className="mt-1 text-[13px] text-[#637083]">{body}</p>
      </div>
      <span className="text-[13px] font-medium text-[#637083]">{count} records</span>
    </div>
  );
}

function EmptyRows({ columns, label }) {
  return (
    <tr>
      <td className="px-md py-xl text-center text-[13px] text-[#718096]" colSpan={columns}>
        {label}
      </td>
    </tr>
  );
}

function ConfirmDialog({ action, busy, onCancel, onConfirm }) {
  if (!action) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#06142b]/45 px-margin-mobile backdrop-blur-sm" role="presentation">
      <section className="w-full max-w-[440px] rounded-[18px] border border-[#dce3ee] bg-white p-lg shadow-[0_28px_80px_rgba(7,24,54,0.25)]" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff0ef] text-[#c72b2b]">
          <MaterialSymbol className="text-[24px]" fill>{action.icon || "warning"}</MaterialSymbol>
        </div>
        <h2 className="mt-md text-[20px] font-semibold text-[#101828]" id="confirm-title">{action.title}</h2>
        <p className="mt-xs text-[14px] leading-6 text-[#637083]">{action.body}</p>
        <div className="mt-lg flex justify-end gap-sm">
          <button className="h-10 rounded-lg border border-[#cfd8e6] px-md text-[13px] font-semibold text-[#334155] hover:bg-[#f5f7fa]" disabled={busy} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className={`h-10 rounded-lg px-md text-[13px] font-semibold text-white ${action.tone === "danger" ? "bg-[#c72b2b] hover:bg-[#ad2222]" : "bg-[#0878eb] hover:bg-[#006edc]"}`} disabled={busy} onClick={onConfirm} type="button">
            {busy ? "Working..." : action.confirmLabel || "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("overview");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityWindow, setActivityWindow] = useState("all");
  const [reportStatusFilter, setReportStatusFilter] = useState("open");
  const [reportSeverityFilter, setReportSeverityFilter] = useState("all");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [data, setData] = useState(EMPTY_DATA);
  const [ownerUser, setOwnerUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [newestLiveId, setNewestLiveId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isMutating, setIsMutating] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [reportQueueSetupError, setReportQueueSetupError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date().toISOString());
  const [, setClock] = useState(0);

  const loadData = useCallback(async ({ initial = false } = {}) => {
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMessage("");

    const { data: authData } = await getCurrentUser();
    if (!authData.user) {
      router.replace("/admin/login");
      return;
    }

    setOwnerUser(authData.user);
    const { data: ownerAccess, error: ownerAccessError } = await supabase.rpc("is_matchmake_owner");
    if (ownerAccessError || ownerAccess !== true) {
      setIsAuthorized(false);
      setErrorMessage("This account is not approved for Matchmake owner access.");
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setIsAuthorized(true);

    const [users, organizations, teams, scrims, messages, reviews, reports, activity] = await Promise.all([
      supabase.from("users").select("id,email,display_name,account_type,org_id,team_ids,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("organizations").select("id,name,type,verified_flag,org_admin_id,school_domain,region,team_ids,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("teams").select("id,org_id,name,game_title,mode,rank_tier,region,roster_names,no_show_count,scrimgg_rating,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("scrim_requests").select("id,posting_team_id,matched_team_id,game_title,scheduled_at,games_count,status,expires_at,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("scrim_messages").select("id,scrim_request_id,sender_user_id,sender_display_name,sender_team_id,body,created_at").order("created_at", { ascending: false }).limit(250),
      supabase.from("team_match_reviews").select("id,team_id,scrim_request_id,created_by,game_title,match_type,match_result,final_score,opponent_name,map_or_mode,played_at,parser_status,parser_confidence,manual_edit_required,created_at,updated_at").order("created_at", { ascending: false }).limit(250),
      supabase.from("report_cases").select("id,case_number,title,summary,report_type,severity,status,source,reporter_role,organization_id,team_id,scrim_request_id,scrim_message_id,match_review_id,subject_user_id,assigned_owner_id,next_update_at,closed_at,resolution,ai_triage_status,ai_triage_notes,agent_context,created_by,created_at,updated_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("admin_activity_logs").select("id,actor_user_id,entity_type,entity_id,action,target_label,status,details,metadata,created_at").order("created_at", { ascending: false }).limit(150),
    ]);

    const reportQueueMissing = reports.error && (reports.error.code === "42P01" || String(reports.error.message || "").includes("report_cases"));
    setReportQueueSetupError(reportQueueMissing ? "Report queue table is not installed yet. Apply supabase_report_queue.sql after supabase_admin_dashboard.sql." : "");

    const failedResult = [users, organizations, teams, scrims, messages, reviews, reportQueueMissing ? null : reports, activity].filter(Boolean).find((result) => result.error);
    if (failedResult?.error) {
      setErrorMessage(failedResult.error.message || "The owner dashboard could not load all platform data.");
    }

    setData({
      users: users.data || [],
      organizations: organizations.data || [],
      teams: teams.data || [],
      scrims: scrims.data || [],
      messages: messages.data || [],
      reviews: reviews.data || [],
      reports: reportQueueMissing || reports.error ? [] : reports.data || [],
      activity: activity.data || [],
    });
    setLastRefreshedAt(new Date().toISOString());
    setIsLoading(false);
    setIsRefreshing(false);
  }, [router]);

  useEffect(() => {
    loadData({ initial: true });
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthorized || !isLive) {
      setLiveStatus(isLive ? "connecting" : "paused");
      return undefined;
    }

    const channel = supabase
      .channel("matchmake-owner-live-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_activity_logs" },
        (payload) => {
          setData((current) => ({
            ...current,
            activity: [payload.new, ...current.activity.filter((entry) => entry.id !== payload.new.id)].slice(0, 150),
          }));
          setNewestLiveId(payload.new.id);
          window.setTimeout(() => setNewestLiveId(null), 5000);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setLiveStatus("error");
        else setLiveStatus("connecting");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthorized, isLive]);

  const maps = useMemo(() => ({
    users: new Map(data.users.map((user) => [user.id, user])),
    organizations: new Map(data.organizations.map((org) => [org.id, org])),
    teams: new Map(data.teams.map((team) => [team.id, team])),
    scrims: new Map(data.scrims.map((scrim) => [scrim.id, scrim])),
  }), [data]);

  const summary = useMemo(() => {
    const openScrims = data.scrims.filter((scrim) => scrim.status === "open").length;
    const pendingRequests = data.scrims.filter((scrim) => ["pending", "matched", "accepted"].includes(scrim.status)).length;
    const completedMatches = data.scrims.filter((scrim) => scrim.status === "completed").length;
    const successfulReviews = data.reviews.filter((review) => !review.manual_edit_required && review.parser_status !== "failed").length;
    const reviewSuccess = data.reviews.length ? Math.round((successfulReviews / data.reviews.length) * 1000) / 10 : null;
    const openReports = data.reports.filter((report) => OPEN_REPORT_STATUSES.has(report.status)).length;
    const urgentReports = data.reports.filter((report) => OPEN_REPORT_STATUSES.has(report.status) && Number(report.severity) <= 1).length;
    return { openScrims, pendingRequests, completedMatches, reviewSuccess, openReports, urgentReports };
  }, [data]);

  const pilotTracking = useMemo(() => {
    const activeOrgIds = new Set();
    const activeTeamIds = new Set();

    data.teams.forEach((team) => {
      if (team.org_id) activeOrgIds.add(team.org_id);
    });

    data.scrims.forEach((scrim) => {
      [scrim.posting_team_id, scrim.matched_team_id].filter(Boolean).forEach((teamId) => {
        activeTeamIds.add(teamId);
        const orgId = maps.teams.get(teamId)?.org_id;
        if (orgId) activeOrgIds.add(orgId);
      });
    });

    data.reviews.forEach((review) => {
      if (!review.team_id) return;
      activeTeamIds.add(review.team_id);
      const orgId = maps.teams.get(review.team_id)?.org_id;
      if (orgId) activeOrgIds.add(orgId);
    });

    const extractionCompletedEvents = data.activity.filter((entry) => entry.action === "extraction_completed").length;
    const extractionFailedEvents = data.activity.filter((entry) => entry.action === "extraction_failed").length;
    const extractionEventAttempts = extractionCompletedEvents + extractionFailedEvents;
    const extractedReviews = data.reviews.filter((review) => review.parser_status && review.parser_status !== "manual");
    const extractionAttempts = extractionEventAttempts || extractedReviews.length;
    const extractionNeedsReview = extractedReviews.filter((review) => review.manual_edit_required).length;

    return {
      activeOrgCount: activeOrgIds.size,
      activeTeamCount: activeTeamIds.size,
      completedScrims: data.scrims.filter((scrim) => scrim.status === "completed").length,
      extractionAttempts,
      extractionEventAttempts,
      extractionFailedEvents,
      extractionNeedsReview,
      extractedReviewCount: extractedReviews.length,
      postedScrims: data.scrims.length,
    };
  }, [data, maps.teams]);

  const attention = useMemo(() => {
    const staleBoundary = Date.now() - 48 * 60 * 60 * 1000;
    return [
      {
        id: "open-reports",
        icon: "flag",
        title: "Open reports",
        body: "Cases awaiting owner or school follow-up",
        count: data.reports.filter((report) => OPEN_REPORT_STATUSES.has(report.status)).length,
        tone: "red",
        section: "reports",
      },
      {
        id: "manual-reviews",
        icon: "rate_review",
        title: "Reviews needing attention",
        body: "Parser output flagged for manual review",
        count: data.reviews.filter((review) => review.manual_edit_required).length,
        tone: "red",
        section: "reviews",
      },
      {
        id: "stale-requests",
        icon: "schedule",
        title: "Stale requests",
        body: "Open or pending for more than 48 hours",
        count: data.scrims.filter((scrim) => ["open", "pending"].includes(scrim.status) && new Date(scrim.updated_at || scrim.created_at).getTime() < staleBoundary).length,
        tone: "amber",
        section: "scrims",
      },
      {
        id: "unverified-organizations",
        icon: "apartment",
        title: "Unverified organizations",
        body: "Organizations awaiting owner verification",
        count: data.organizations.filter((org) => !org.verified_flag).length,
        tone: "amber",
        section: "organizations",
      },
      {
        id: "unaffiliated-users",
        icon: "person_alert",
        title: "Users without an organization",
        body: "Profiles not connected to an organization",
        count: data.users.filter((user) => !user.org_id).length,
        tone: "green",
        section: "users",
      },
    ];
  }, [data]);

  const filteredActivity = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    return data.activity.filter((entry) => {
      if (activityFilter !== "all" && activityCategory(entry.entity_type) !== activityFilter) return false;
      if (activityWindow !== "all") {
        const windowHours = Number(activityWindow);
        if (new Date(entry.created_at).getTime() < Date.now() - windowHours * 60 * 60 * 1000) return false;
      }
      if (!query) return true;
      const actor = maps.users.get(entry.actor_user_id);
      return [entry.action, entry.target_label, entry.details, actor?.display_name, actor?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [activityFilter, activityWindow, data.activity, globalSearch, maps.users]);

  async function handleLogout() {
    await supabaseAuth.auth.signOut();
    await clearAuthSession();
    router.replace("/admin/login");
  }

  async function executeConfirmedAction() {
    if (!confirmAction) return;
    setIsMutating(true);
    setNotice("");
    setErrorMessage("");
    let result;

    if (confirmAction.type === "organization-verification") {
      result = await supabase.from("organizations").update({ verified_flag: confirmAction.nextValue, updated_at: new Date().toISOString() }).eq("id", confirmAction.id);
    } else if (confirmAction.type === "scrim-status") {
      result = await supabase.from("scrim_requests").update({ status: confirmAction.nextValue, updated_at: new Date().toISOString() }).eq("id", confirmAction.id);
    } else if (confirmAction.type === "delete-message") {
      result = await supabase.from("scrim_messages").delete().eq("id", confirmAction.id);
    } else if (confirmAction.type === "delete-review") {
      result = await supabase.from("team_match_reviews").delete().eq("id", confirmAction.id);
    } else if (confirmAction.type === "delete-team") {
      result = await supabase.from("teams").delete().eq("id", confirmAction.id);
    } else if (confirmAction.type === "clear-user-membership") {
      result = await supabase.from("users").update({ org_id: null, team_ids: [], updated_at: new Date().toISOString() }).eq("id", confirmAction.id);
    }

    if (result?.error) {
      setErrorMessage(result.error.message || "The owner action could not be completed.");
    } else {
      setNotice(confirmAction.successMessage || "Owner action completed.");
      await loadData();
    }
    setIsMutating(false);
    setConfirmAction(null);
  }

  function reportQueueUnavailable(message) {
    return message && (message.includes("report_cases") || message.includes("relation"));
  }

  async function createReportCase(payload) {
    setIsMutating(true);
    setNotice("");
    setErrorMessage("");

    const { data: inserted, error } = await supabase
      .from("report_cases")
      .insert({ ...payload, created_by: ownerUser?.id || null })
      .select("id,case_number")
      .single();

    if (error) {
      setErrorMessage(reportQueueUnavailable(error.message) ? "Report queue is not installed yet. Apply supabase_report_queue.sql after supabase_admin_dashboard.sql, then refresh this page." : error.message);
    } else {
      setSelectedReportId(inserted?.id || null);
      setActiveSection("reports");
      setNotice(`${reportCaseLabel(inserted)} created in the report queue.`);
      await loadData();
    }

    setIsMutating(false);
  }

  async function updateReportCase(reportId, patch, successMessage = "Report case updated.") {
    setIsMutating(true);
    setNotice("");
    setErrorMessage("");

    const { error } = await supabase
      .from("report_cases")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    if (error) {
      setErrorMessage(reportQueueUnavailable(error.message) ? "Report queue is not installed yet. Apply supabase_report_queue.sql after supabase_admin_dashboard.sql, then refresh this page." : error.message);
    } else {
      setNotice(successMessage);
      await loadData();
    }

    setIsMutating(false);
  }

  function createMessageReport(message) {
    const scrim = maps.scrims.get(message.scrim_request_id);
    const senderTeam = maps.teams.get(message.sender_team_id);
    createReportCase({
      title: `Chat report: ${message.sender_display_name || maps.users.get(message.sender_user_id)?.display_name || "Unknown sender"}`,
      summary: message.body || "Chat message flagged from the owner dashboard.",
      report_type: "chat",
      severity: 2,
      status: "new",
      source: "owner_dashboard_message",
      reporter_role: "owner",
      organization_id: senderTeam?.org_id || null,
      team_id: message.sender_team_id || null,
      scrim_request_id: message.scrim_request_id || null,
      scrim_message_id: message.id,
      subject_user_id: message.sender_user_id || null,
      agent_context: {
        source_table: "scrim_messages",
        source_id: message.id,
        sender_display_name: message.sender_display_name || null,
        sender_team_name: senderTeam?.name || null,
        scrim_game_title: scrim?.game_title || null,
        message_body: message.body || "",
        sent_at: message.created_at,
      },
    });
  }

  function createReviewReport(review) {
    const team = maps.teams.get(review.team_id);
    createReportCase({
      title: `Match review report: ${team?.name || review.game_title || "Saved review"}`,
      summary: [
        review.manual_edit_required ? "Review was flagged for manual correction." : "Match review flagged from the owner dashboard.",
        review.opponent_name ? `Opponent: ${review.opponent_name}.` : "",
        review.parser_status ? `Parser status: ${review.parser_status}.` : "",
      ].filter(Boolean).join(" "),
      report_type: "match_review",
      severity: review.manual_edit_required || review.parser_status === "failed" ? 1 : 2,
      status: "new",
      source: "owner_dashboard_review",
      reporter_role: "owner",
      organization_id: team?.org_id || null,
      team_id: review.team_id || null,
      scrim_request_id: review.scrim_request_id || null,
      match_review_id: review.id,
      subject_user_id: review.created_by || null,
      agent_context: {
        source_table: "team_match_reviews",
        source_id: review.id,
        team_name: team?.name || null,
        game_title: review.game_title || null,
        match_type: review.match_type || null,
        match_result: review.match_result || null,
        final_score: review.final_score || null,
        opponent_name: review.opponent_name || null,
        parser_status: review.parser_status || null,
        parser_confidence: review.parser_confidence,
        manual_edit_required: Boolean(review.manual_edit_required),
      },
    });
  }

  function resourceSearch(rows, fields) {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => fields.some((field) => String(row[field] || "").toLowerCase().includes(query)));
  }

  function renderResourceSection() {
    if (activeSection === "organizations") {
      const rows = resourceSearch(data.organizations, ["name", "type", "region", "school_domain"]);
      return (
        <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
          <SectionTitle title="Organizations" body="Verify schools and review organization ownership." count={rows.length} />
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-[13px]">
              <thead className="bg-[#f8fafc] text-[#526174]"><tr><th className="px-md py-sm">Organization</th><th className="px-md py-sm">Type</th><th className="px-md py-sm">Region</th><th className="px-md py-sm">Teams</th><th className="px-md py-sm">Status</th><th className="px-md py-sm text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                {rows.length === 0 && <EmptyRows columns={6} label="No organizations match this search." />}
                {rows.map((org) => (
                  <tr key={org.id} className="hover:bg-[#f8fbff]"><td className="px-md py-sm"><p className="font-semibold text-[#172033]">{org.name}</p><p className="text-[11px] text-[#78869a]">{org.school_domain || org.id}</p></td><td className="px-md py-sm text-[#526174]">{titleCase(org.type)}</td><td className="px-md py-sm text-[#526174]">{org.region || "—"}</td><td className="px-md py-sm text-[#526174]">{org.team_ids?.length || 0}</td><td className="px-md py-sm"><span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${statusClass(org.verified_flag ? "verified" : "pending")}`}>{org.verified_flag ? "Verified" : "Pending"}</span></td><td className="px-md py-sm text-right"><button className="rounded-lg border border-[#cbd6e4] px-sm py-xs font-semibold text-[#0878eb] hover:bg-[#f2f7fd]" onClick={() => setConfirmAction({ type: "organization-verification", id: org.id, nextValue: !org.verified_flag, title: org.verified_flag ? "Remove organization verification?" : "Verify this organization?", body: `${org.name} will be marked ${org.verified_flag ? "unverified" : "verified"} across Matchmake.`, confirmLabel: org.verified_flag ? "Remove verification" : "Verify organization", successMessage: `${org.name} verification updated.` })} type="button">{org.verified_flag ? "Unverify" : "Verify"}</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    if (activeSection === "teams") {
      const rows = resourceSearch(data.teams, ["name", "game_title", "region", "rank_tier"]);
      return (
        <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
          <SectionTitle title="Teams" body="Inspect rosters, ranking context, and organization ownership." count={rows.length} />
          <div className="overflow-x-auto"><table className="min-w-[920px] w-full text-left text-[13px]"><thead className="bg-[#f8fafc] text-[#526174]"><tr><th className="px-md py-sm">Team</th><th className="px-md py-sm">Organization</th><th className="px-md py-sm">Game</th><th className="px-md py-sm">Roster</th><th className="px-md py-sm">Rank</th><th className="px-md py-sm text-right">Action</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">
            {rows.length === 0 && <EmptyRows columns={6} label="No teams match this search." />}
            {rows.map((team) => <tr key={team.id} className="hover:bg-[#f8fbff]"><td className="px-md py-sm"><p className="font-semibold text-[#172033]">{team.name}</p><p className="text-[11px] text-[#78869a]">{team.region || "Region not set"}</p></td><td className="px-md py-sm text-[#526174]">{maps.organizations.get(team.org_id)?.name || "Unknown"}</td><td className="px-md py-sm text-[#526174]">{team.game_title}</td><td className="px-md py-sm text-[#526174]">{team.roster_names?.length || 0} players</td><td className="px-md py-sm text-[#526174]">{team.rank_tier || "—"}</td><td className="px-md py-sm text-right"><button className="rounded-lg border border-[#f0b9b5] px-sm py-xs font-semibold text-[#bd2929] hover:bg-[#fff3f2]" onClick={() => setConfirmAction({ type: "delete-team", id: team.id, title: `Remove ${team.name}?`, body: "This is destructive and can cascade to posted scrims and match reviews. Use it only when the team must be removed from Matchmake.", confirmLabel: "Remove team", tone: "danger", successMessage: `${team.name} was removed.` })} type="button">Remove</button></td></tr>)}
          </tbody></table></div>
        </section>
      );
    }

    if (activeSection === "users") {
      const rows = resourceSearch(data.users, ["display_name", "email", "account_type"]);
      return (
        <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
          <SectionTitle title="Users" body="Review account ownership and organization membership." count={rows.length} />
          <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-[13px]"><thead className="bg-[#f8fafc] text-[#526174]"><tr><th className="px-md py-sm">User</th><th className="px-md py-sm">Account type</th><th className="px-md py-sm">Organization</th><th className="px-md py-sm">Teams</th><th className="px-md py-sm">Created</th><th className="px-md py-sm text-right">Action</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">
            {rows.length === 0 && <EmptyRows columns={6} label="No users match this search." />}
            {rows.map((user) => <tr key={user.id} className="hover:bg-[#f8fbff]"><td className="px-md py-sm"><p className="font-semibold text-[#172033]">{user.display_name}</p><p className="text-[11px] text-[#78869a]">{user.email}</p></td><td className="px-md py-sm text-[#526174]">{titleCase(user.account_type)}</td><td className="px-md py-sm text-[#526174]">{maps.organizations.get(user.org_id)?.name || "None"}</td><td className="px-md py-sm text-[#526174]">{user.team_ids?.length || 0}</td><td className="px-md py-sm text-[#526174]">{formatDate(user.created_at, { time: false, year: true })}</td><td className="px-md py-sm text-right">{user.org_id ? <button className="rounded-lg border border-[#f0c77a] px-sm py-xs font-semibold text-[#9b5d00] hover:bg-[#fff8e8]" onClick={() => setConfirmAction({ type: "clear-user-membership", id: user.id, title: `Clear ${user.display_name}'s membership?`, body: "The profile will be detached from its organization and teams. The authentication account will remain active.", confirmLabel: "Clear membership", successMessage: `${user.display_name}'s organization membership was cleared.` })} type="button">Clear membership</button> : <span className="text-[11px] text-[#98a2b3]">No membership</span>}</td></tr>)}
          </tbody></table></div>
        </section>
      );
    }

    if (activeSection === "scrims") {
      const rows = resourceSearch(data.scrims, ["id", "game_title", "status"]);
      return (
        <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
          <SectionTitle title="Scrims" body="Inspect platform-wide scheduling and safely correct workflow status." count={rows.length} />
          <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-[13px]"><thead className="bg-[#f8fafc] text-[#526174]"><tr><th className="px-md py-sm">Scrim</th><th className="px-md py-sm">Posting team</th><th className="px-md py-sm">Matched team</th><th className="px-md py-sm">Scheduled</th><th className="px-md py-sm">Games</th><th className="px-md py-sm">Status</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">
            {rows.length === 0 && <EmptyRows columns={6} label="No scrims match this search." />}
            {rows.map((scrim) => <tr key={scrim.id} className="hover:bg-[#f8fbff]"><td className="px-md py-sm"><p className="font-semibold text-[#0878eb]">{scrim.game_title}</p><p className="text-[11px] text-[#78869a]">{scrim.id.slice(0, 8)}</p></td><td className="px-md py-sm text-[#526174]">{maps.teams.get(scrim.posting_team_id)?.name || "Unknown"}</td><td className="px-md py-sm text-[#526174]">{maps.teams.get(scrim.matched_team_id)?.name || "—"}</td><td className="px-md py-sm text-[#526174]">{formatDate(scrim.scheduled_at)}</td><td className="px-md py-sm text-[#526174]">Best of {scrim.games_count}</td><td className="px-md py-sm"><select className={`rounded-lg border-0 py-1 pl-2 pr-8 text-[11px] font-semibold focus:ring-2 focus:ring-[#0878eb] ${statusClass(scrim.status)}`} onChange={(event) => { const nextValue = event.target.value; event.target.value = scrim.status; setConfirmAction({ type: "scrim-status", id: scrim.id, nextValue, title: `Change scrim to ${titleCase(nextValue)}?`, body: `${scrim.game_title} for ${maps.teams.get(scrim.posting_team_id)?.name || "the posting team"} will move from ${titleCase(scrim.status)} to ${titleCase(nextValue)}.`, confirmLabel: "Change status", successMessage: "Scrim workflow status updated." }); }} value={scrim.status}>{SCRIM_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></td></tr>)}
          </tbody></table></div>
        </section>
      );
    }

    if (activeSection === "messages") {
      const rows = resourceSearch(data.messages, ["sender_display_name", "body", "scrim_request_id"]);
      return (
        <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
          <SectionTitle title="Chat activity" body="Review scrim conversations and remove inappropriate messages." count={rows.length} />
          <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-[13px]"><thead className="bg-[#f8fafc] text-[#526174]"><tr><th className="px-md py-sm">Sender</th><th className="px-md py-sm">Message</th><th className="px-md py-sm">Scrim</th><th className="px-md py-sm">Sent</th><th className="px-md py-sm text-right">Action</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">
            {rows.length === 0 && <EmptyRows columns={5} label="No messages match this search." />}
            {rows.map((message) => <tr key={message.id} className="hover:bg-[#f8fbff]"><td className="px-md py-sm"><p className="font-semibold text-[#172033]">{message.sender_display_name || maps.users.get(message.sender_user_id)?.display_name || "Unknown"}</p><p className="text-[11px] text-[#78869a]">{maps.teams.get(message.sender_team_id)?.name || "No team"}</p></td><td className="max-w-[420px] px-md py-sm text-[#526174]"><p className="line-clamp-2">{message.body}</p></td><td className="px-md py-sm text-[#526174]">{maps.scrims.get(message.scrim_request_id)?.game_title || message.scrim_request_id.slice(0, 8)}</td><td className="px-md py-sm text-[#526174]">{relativeTime(message.created_at)}</td><td className="px-md py-sm text-right"><div className="flex justify-end gap-xs"><button className="rounded-lg border border-[#b8d5f5] px-sm py-xs font-semibold text-[#0878eb] hover:bg-[#eef6ff]" disabled={isMutating} onClick={() => createMessageReport(message)} type="button">Report</button><button className="rounded-lg border border-[#f0b9b5] px-sm py-xs font-semibold text-[#bd2929] hover:bg-[#fff3f2]" onClick={() => setConfirmAction({ type: "delete-message", id: message.id, title: "Remove this chat message?", body: "The message will be permanently removed from the scrim conversation and the action will appear in the owner audit log.", confirmLabel: "Remove message", tone: "danger", successMessage: "Chat message removed." })} type="button">Remove</button></div></td></tr>)}
          </tbody></table></div>
        </section>
      );
    }

    if (activeSection === "reviews") {
      const rows = resourceSearch(data.reviews, ["game_title", "opponent_name", "match_result", "parser_status"]);
      return (
        <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
          <SectionTitle title="Match reviews" body="Inspect saved review output and remove invalid records." count={rows.length} />
          <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-[13px]"><thead className="bg-[#f8fafc] text-[#526174]"><tr><th className="px-md py-sm">Review</th><th className="px-md py-sm">Team</th><th className="px-md py-sm">Opponent</th><th className="px-md py-sm">Result</th><th className="px-md py-sm">Parser</th><th className="px-md py-sm">Played</th><th className="px-md py-sm text-right">Action</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">
            {rows.length === 0 && <EmptyRows columns={7} label="No match reviews match this search." />}
            {rows.map((review) => <tr key={review.id} className="hover:bg-[#f8fbff]"><td className="px-md py-sm"><p className="font-semibold text-[#172033]">{review.game_title}</p><p className="text-[11px] text-[#78869a]">{review.map_or_mode || review.match_type}</p></td><td className="px-md py-sm text-[#526174]">{maps.teams.get(review.team_id)?.name || "Unknown"}</td><td className="px-md py-sm text-[#526174]">{review.opponent_name || "—"}</td><td className="px-md py-sm text-[#526174]">{review.match_result || review.final_score || "—"}</td><td className="px-md py-sm"><span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${statusClass(review.manual_edit_required ? "pending" : "success")}`}>{review.manual_edit_required ? "Needs review" : titleCase(review.parser_status)}</span></td><td className="px-md py-sm text-[#526174]">{formatDate(review.played_at || review.created_at, { time: false })}</td><td className="px-md py-sm text-right"><div className="flex justify-end gap-xs"><button className="rounded-lg border border-[#b8d5f5] px-sm py-xs font-semibold text-[#0878eb] hover:bg-[#eef6ff]" disabled={isMutating} onClick={() => createReviewReport(review)} type="button">Report</button><button className="rounded-lg border border-[#f0b9b5] px-sm py-xs font-semibold text-[#bd2929] hover:bg-[#fff3f2]" onClick={() => setConfirmAction({ type: "delete-review", id: review.id, title: "Remove this match review?", body: "This permanently removes the saved review and its derived analytics. Use this only for invalid or duplicate records.", confirmLabel: "Remove review", tone: "danger", successMessage: "Match review removed." })} type="button">Remove</button></div></td></tr>)}
          </tbody></table></div>
        </section>
      );
    }

    if (activeSection === "reports") {
      const query = globalSearch.trim().toLowerCase();
      const rows = data.reports.filter((report) => {
        if (reportStatusFilter === "open" && !OPEN_REPORT_STATUSES.has(report.status)) return false;
        if (reportStatusFilter !== "open" && reportStatusFilter !== "all" && report.status !== reportStatusFilter) return false;
        if (reportSeverityFilter !== "all" && Number(report.severity) !== Number(reportSeverityFilter)) return false;
        if (!query) return true;
        return [report.title, report.summary, report.report_type, report.status, report.source, report.resolution, report.ai_triage_notes, reportCaseLabel(report)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
      const selectedReport = rows.find((report) => report.id === selectedReportId) || rows[0] || data.reports.find((report) => report.id === selectedReportId);
      const openCount = data.reports.filter((report) => OPEN_REPORT_STATUSES.has(report.status)).length;
      const urgentCount = data.reports.filter((report) => OPEN_REPORT_STATUSES.has(report.status) && Number(report.severity) <= 1).length;
      const aiReadyCount = data.reports.filter((report) => OPEN_REPORT_STATUSES.has(report.status) && ["queued", "in_progress", "suggested"].includes(report.ai_triage_status)).length;
      const linkedSummary = selectedReport ? [
        selectedReport.organization_id ? `Org ${maps.organizations.get(selectedReport.organization_id)?.name || selectedReport.organization_id.slice(0, 8)}` : "",
        selectedReport.team_id ? `Team ${maps.teams.get(selectedReport.team_id)?.name || selectedReport.team_id.slice(0, 8)}` : "",
        selectedReport.scrim_request_id ? `Scrim ${maps.scrims.get(selectedReport.scrim_request_id)?.game_title || selectedReport.scrim_request_id.slice(0, 8)}` : "",
        selectedReport.scrim_message_id ? `Message ${selectedReport.scrim_message_id.slice(0, 8)}` : "",
        selectedReport.match_review_id ? `Review ${selectedReport.match_review_id.slice(0, 8)}` : "",
      ].filter(Boolean) : [];

      return (
        <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
          <SectionTitle title="Report queue" body="Review, triage, and close owner-visible cases from one scrollable queue." count={rows.length} />
          {reportQueueSetupError && <div className="mx-md mt-md flex items-start gap-sm rounded-lg border border-[#f0c77a] bg-[#fff8e8] px-md py-sm text-[13px] leading-5 text-[#8a5400]"><MaterialSymbol className="mt-0.5 text-[18px]" fill>warning</MaterialSymbol><span>{reportQueueSetupError}</span></div>}
          <div className="grid grid-cols-2 border-b border-[#dce3ee] md:grid-cols-4">
            {[{ label: "Total", value: data.reports.length, icon: "inventory_2" }, { label: "Open", value: openCount, icon: "flag" }, { label: "S0/S1 Open", value: urgentCount, icon: "priority_high", alert: urgentCount > 0 }, { label: "AI Triage", value: aiReadyCount, icon: "auto_awesome" }].map((metric) => <div className="border-r border-[#dce3ee] px-md py-sm" key={metric.label}><div className="flex items-center gap-xs text-[11px] font-semibold text-[#526174]"><MaterialSymbol className={`text-[18px] ${metric.alert ? "text-[#bd2929]" : "text-[#0878eb]"}`}>{metric.icon}</MaterialSymbol>{metric.label}</div><p className="mt-1 text-[24px] font-semibold text-[#101828]">{metric.value}</p></div>)}
          </div>
          <div className="flex flex-col gap-sm border-b border-[#dce3ee] px-md py-sm md:flex-row md:items-center">
            <label className="flex items-center gap-xs text-[12px] font-semibold text-[#526174]">Status<select className="h-9 rounded-lg border border-[#cfd8e6] bg-white px-sm text-[12px] text-[#172033]" onChange={(event) => setReportStatusFilter(event.target.value)} value={reportStatusFilter}><option value="open">Open reports</option><option value="all">All reports</option>{REPORT_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
            <label className="flex items-center gap-xs text-[12px] font-semibold text-[#526174]">Severity<select className="h-9 rounded-lg border border-[#cfd8e6] bg-white px-sm text-[12px] text-[#172033]" onChange={(event) => setReportSeverityFilter(event.target.value)} value={reportSeverityFilter}><option value="all">All severities</option><option value="0">S0 urgent</option><option value="1">S1 high</option><option value="2">S2 normal</option></select></label>
            <span className="text-[12px] text-[#78869a] md:ml-auto">{rows.length} visible of {data.reports.length} total</span>
          </div>
          <div className="grid min-h-[560px] lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)]">
            <div className="max-h-[70vh] overflow-y-auto border-b border-[#dce3ee] lg:border-b-0 lg:border-r">
              {rows.length === 0 && <div className="px-md py-xl text-center text-[13px] text-[#718096]">No report cases match these filters.</div>}
              {rows.map((report) => (
                <button className={`block w-full border-b border-[#e5eaf1] px-md py-sm text-left hover:bg-[#f8fbff] ${selectedReport?.id === report.id ? "bg-[#eef6ff]" : ""}`} key={report.id} onClick={() => setSelectedReportId(report.id)} type="button">
                  <div className="flex items-start gap-sm">
                    <span className={`mt-0.5 rounded-md px-2 py-1 text-[10px] font-bold ${severityClass(report.severity)}`}>{severityLabel(report.severity).split(" ")[0]}</span>
                    <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#0878eb]">{reportCaseLabel(report)}</span><span className="mt-1 block truncate text-[13px] font-semibold text-[#172033]">{report.title}</span><span className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#637083]">{report.summary || "No summary yet."}</span><span className="mt-2 flex flex-wrap gap-xs"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${reportStatusClass(report.status)}`}>{titleCase(report.status)}</span><span className="rounded-md bg-[#f1f4f8] px-2 py-1 text-[10px] font-semibold text-[#526174]">{titleCase(report.report_type)}</span></span></span>
                  </div>
                </button>
              ))}
            </div>
            <div className="min-w-0 p-md">
              {!selectedReport ? (
                <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-[#cfd8e6] text-center text-[13px] text-[#718096]">Select a report case to review it.</div>
              ) : (
                <article className="space-y-md">
                  <div className="flex flex-col gap-sm border-b border-[#dce3ee] pb-md md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0"><p className="text-[12px] font-semibold text-[#0878eb]">{reportCaseLabel(selectedReport)}</p><h3 className="mt-1 text-[22px] font-semibold text-[#101828]">{selectedReport.title}</h3><p className="mt-xs text-[13px] text-[#637083]">Created {formatDate(selectedReport.created_at, { year: true })} - Updated {relativeTime(selectedReport.updated_at || selectedReport.created_at)}</p></div>
                    <div className="flex flex-wrap gap-xs"><span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${severityClass(selectedReport.severity)}`}>{severityLabel(selectedReport.severity)}</span><span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${reportStatusClass(selectedReport.status)}`}>{titleCase(selectedReport.status)}</span></div>
                  </div>
                  <div className="grid gap-sm md:grid-cols-3">
                    <label className="text-[12px] font-semibold text-[#526174]">Status<select className="mt-xs h-10 w-full rounded-lg border border-[#cfd8e6] bg-white px-sm text-[13px] text-[#172033]" disabled={isMutating} onChange={(event) => { const nextStatus = event.target.value; updateReportCase(selectedReport.id, { status: nextStatus, closed_at: nextStatus === "closed" ? new Date().toISOString() : null }, "Report status updated."); }} value={selectedReport.status}>{REPORT_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
                    <label className="text-[12px] font-semibold text-[#526174]">Severity<select className="mt-xs h-10 w-full rounded-lg border border-[#cfd8e6] bg-white px-sm text-[13px] text-[#172033]" disabled={isMutating} onChange={(event) => updateReportCase(selectedReport.id, { severity: Number(event.target.value) }, "Report severity updated.")} value={selectedReport.severity}><option value={0}>S0 urgent</option><option value={1}>S1 high</option><option value={2}>S2 normal</option></select></label>
                    <label className="text-[12px] font-semibold text-[#526174]">AI triage<select className="mt-xs h-10 w-full rounded-lg border border-[#cfd8e6] bg-white px-sm text-[13px] text-[#172033]" disabled={isMutating} onChange={(event) => updateReportCase(selectedReport.id, { ai_triage_status: event.target.value }, "AI triage status updated.")} value={selectedReport.ai_triage_status || "not_requested"}>{AI_TRIAGE_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>
                  </div>
                  <section className="rounded-lg border border-[#dce3ee] p-md"><h4 className="text-[13px] font-semibold text-[#172033]">Report summary</h4><p className="mt-xs whitespace-pre-wrap text-[13px] leading-6 text-[#526174]">{selectedReport.summary || "No summary recorded."}</p></section>
                  <section className="rounded-lg border border-[#dce3ee] p-md"><h4 className="text-[13px] font-semibold text-[#172033]">Linked records</h4><div className="mt-sm flex flex-wrap gap-xs">{linkedSummary.length ? linkedSummary.map((item) => <span className="rounded-md bg-[#f1f4f8] px-2 py-1 text-[11px] font-semibold text-[#526174]" key={item}>{item}</span>) : <span className="text-[12px] text-[#718096]">No linked records.</span>}</div></section>
                  <section className="rounded-lg border border-[#dce3ee] p-md"><h4 className="text-[13px] font-semibold text-[#172033]">AI/agent context</h4><p className="mt-1 text-[12px] text-[#718096]">Structured snapshot for later automation. Keep secrets and private contact info out of this field.</p><pre className="mt-sm max-h-[260px] overflow-auto rounded-lg bg-[#0b1220] p-md text-[11px] leading-5 text-[#dbeafe]">{JSON.stringify(selectedReport.agent_context || {}, null, 2)}</pre></section>
                  <section className="rounded-lg border border-[#dce3ee] p-md"><h4 className="text-[13px] font-semibold text-[#172033]">Resolution</h4><p className="mt-xs whitespace-pre-wrap text-[13px] leading-6 text-[#526174]">{selectedReport.resolution || "No resolution recorded yet."}</p><div className="mt-sm flex flex-wrap gap-xs"><button className="rounded-lg border border-[#cfd8e6] px-sm py-xs text-[12px] font-semibold text-[#334155] hover:bg-[#f5f7fa]" disabled={isMutating} onClick={() => updateReportCase(selectedReport.id, { status: "triage" }, "Report moved to triage.")} type="button">Move to triage</button><button className="rounded-lg border border-[#cfd8e6] px-sm py-xs text-[12px] font-semibold text-[#334155] hover:bg-[#f5f7fa]" disabled={isMutating} onClick={() => updateReportCase(selectedReport.id, { status: "waiting_on_school" }, "Report marked waiting on school.")} type="button">Waiting on school</button><button className="rounded-lg border border-[#bde2cc] px-sm py-xs text-[12px] font-semibold text-[#177342] hover:bg-[#edf9f2]" disabled={isMutating} onClick={() => updateReportCase(selectedReport.id, { status: "closed", closed_at: new Date().toISOString(), resolution: selectedReport.resolution || "Closed from the owner dashboard." }, "Report closed.")} type="button">Close case</button></div></section>
                </article>
              )}
            </div>
          </div>
        </section>
      );
    }

    const rows = filteredActivity;
    return (
      <section className="overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
        <SectionTitle title="Full audit log" body="Immutable operational history captured from Matchmake writes." count={rows.length} />
        <div className="overflow-x-auto"><table className="min-w-[920px] w-full text-left text-[13px]"><thead className="bg-[#f8fafc] text-[#526174]"><tr><th className="px-md py-sm">Time</th><th className="px-md py-sm">Actor</th><th className="px-md py-sm">Action</th><th className="px-md py-sm">Target</th><th className="px-md py-sm">Status</th><th className="px-md py-sm">Details</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">
          {rows.length === 0 && <EmptyRows columns={6} label="No activity matches this search." />}
          {rows.map((entry) => { const actor = maps.users.get(entry.actor_user_id); return <tr key={entry.id} className="hover:bg-[#f8fbff]"><td className="whitespace-nowrap px-md py-sm text-[#526174]">{formatDate(entry.created_at, { year: true })}</td><td className="px-md py-sm"><p className="font-semibold text-[#172033]">{actor?.display_name || (entry.actor_user_id ? "Authenticated user" : "System")}</p><p className="text-[11px] text-[#78869a]">{actor?.email || entry.actor_user_id || "Automated"}</p></td><td className="px-md py-sm text-[#526174]">{titleCase(entry.action)}</td><td className="px-md py-sm font-medium text-[#0878eb]">{entry.target_label}</td><td className="px-md py-sm"><span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${statusClass(entry.status)}`}>{titleCase(entry.status)}</span></td><td className="px-md py-sm text-[#526174]">{entry.details || "—"}</td></tr>; })}
        </tbody></table></div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb] text-[#172033]">
        <div className="text-center"><span className="mx-auto block h-9 w-9 animate-spin rounded-full border-[3px] border-[#c6d8ef] border-t-[#0878eb]" /><p className="mt-md text-[14px] text-[#637083]">Loading owner operations...</p></div>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-margin-mobile">
        <section className="max-w-[460px] rounded-[18px] border border-[#dce3ee] bg-white p-lg text-center shadow-[0_18px_60px_rgba(7,24,54,0.10)]">
          <MaterialSymbol className="text-[42px] text-[#c72b2b]" fill>shield_lock</MaterialSymbol>
          <h1 className="mt-md text-[22px] font-semibold text-[#172033]">Owner access required</h1>
          <p className="mt-xs text-[14px] leading-6 text-[#637083]">{errorMessage}</p>
          <button className="mt-lg rounded-lg bg-[#0878eb] px-lg py-sm text-[13px] font-semibold text-white" onClick={handleLogout} type="button">Return to owner login</button>
        </section>
      </main>
    );
  }

  const kpis = [
    { label: "Organizations", value: data.organizations.length, icon: "apartment", note: "Current total" },
    { label: "Active Teams", value: data.teams.length, icon: "groups", note: "Across all games" },
    { label: "Active Users", value: data.users.length, icon: "person", note: "Registered profiles" },
    { label: "Open Scrims", value: summary.openScrims, icon: "sports_esports", note: "Available now" },
    { label: "Pending Requests", value: summary.pendingRequests, icon: "schedule", note: "Awaiting action", alert: summary.pendingRequests > 0 },
    { label: "Completed Matches", value: summary.completedMatches, icon: "check_circle", note: "All time" },
    { label: "Review Success", value: summary.reviewSuccess === null ? "—" : `${summary.reviewSuccess}%`, icon: "database", note: data.reviews.length ? `${data.reviews.length} reviews` : "No reviews yet" },
    { label: "Open Reports", value: summary.openReports, icon: "flag", note: `${summary.urgentReports} urgent/high`, alert: summary.urgentReports > 0 },
  ];

  const pilotMetricCards = [
    {
      label: "Active Schools/Orgs",
      value: pilotTracking.activeOrgCount,
      icon: "apartment",
      note: `${data.organizations.length} total loaded`,
    },
    {
      label: "Teams",
      value: data.teams.length,
      icon: "groups",
      note: `${pilotTracking.activeTeamCount} with scrims/reviews`,
    },
    {
      label: "Posted Scrims",
      value: pilotTracking.postedScrims,
      icon: "sports_esports",
      note: `${data.scrims.length} loaded requests`,
    },
    {
      label: "Completed Scrims",
      value: pilotTracking.completedScrims,
      icon: "check_circle",
      note: `${formatPercent(pilotTracking.completedScrims, pilotTracking.postedScrims)} completion rate`,
    },
    {
      label: "Extraction Usage",
      value: pilotTracking.extractionAttempts,
      icon: "auto_awesome",
      note: pilotTracking.extractionEventAttempts ? `${pilotTracking.extractionEventAttempts} tracked events` : `${pilotTracking.extractedReviewCount} saved reviews`,
    },
    {
      label: "Needs Review",
      value: pilotTracking.extractionNeedsReview,
      icon: "rate_review",
      note: `${pilotTracking.extractionFailedEvents} failed extraction events`,
      alert: pilotTracking.extractionNeedsReview > 0 || pilotTracking.extractionFailedEvents > 0,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#172033] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col bg-[#06152d] text-white lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex h-20 items-center border-b border-white/8 px-md"><MatchmakeLogo height={50} /><span className="ml-sm text-[17px] font-semibold tracking-tight">Matchmake</span></div>
        <nav className="flex-1 space-y-1 px-sm py-md" aria-label="Owner admin navigation">
          {NAV_ITEMS.map((item) => <button className={`flex h-11 w-full items-center gap-sm rounded-lg px-sm text-left text-[14px] font-medium transition ${activeSection === item.id ? "bg-[#0878eb] text-white shadow-[0_8px_20px_rgba(0,119,235,0.25)]" : "text-white/78 hover:bg-white/7 hover:text-white"}`} key={item.id} onClick={() => setActiveSection(item.id)} type="button"><MaterialSymbol className="text-[20px]" fill={activeSection === item.id}>{item.icon}</MaterialSymbol>{item.label}</button>)}
        </nav>
        <div className="border-t border-white/10 p-md"><button className="flex w-full items-center gap-sm text-left" onClick={handleLogout} type="button"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#0878eb] text-[12px] font-bold">{initials(ownerUser?.email)}</span><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Owner</span><span className="block truncate text-[11px] text-white/50">{ownerUser?.email}</span></span><MaterialSymbol className="text-[18px] text-white/50">logout</MaterialSymbol></button></div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-20 items-center gap-md border-b border-[#dce3ee] bg-white/95 px-margin-mobile backdrop-blur lg:px-lg">
          <div className="flex items-center gap-sm lg:hidden"><MatchmakeLogo height={42} /><span className="font-semibold">Owner</span></div>
          <label className="hidden h-11 max-w-[480px] flex-1 items-center gap-sm rounded-lg border border-[#d6deea] bg-white px-md shadow-sm sm:flex"><MaterialSymbol className="text-[21px] text-[#526174]">search</MaterialSymbol><input className="min-w-0 flex-1 border-0 p-0 text-[14px] placeholder:text-[#8b97a8] focus:ring-0" onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search organizations, teams, users, scrims..." value={globalSearch} /><span className="rounded border border-[#d6deea] px-1.5 py-0.5 text-[10px] text-[#78869a]">⌘ K</span></label>
          <div className="ml-auto flex items-center gap-sm"><label className="hidden h-10 items-center gap-xs rounded-lg border border-[#d6deea] px-sm text-[12px] font-medium text-[#334155] md:flex"><MaterialSymbol className="text-[18px]">calendar_month</MaterialSymbol><select className="border-0 bg-transparent py-0 pl-0 pr-7 text-[12px] font-medium focus:ring-0" onChange={(event) => setActivityWindow(event.target.value)} value={activityWindow}><option value="24">Last 24 hours</option><option value="168">Last 7 days</option><option value="720">Last 30 days</option><option value="all">All time</option></select></label><span className="hidden h-10 items-center gap-xs rounded-lg border border-[#d6deea] px-sm text-[12px] font-medium text-[#334155] md:flex"><span className="h-2 w-2 rounded-full bg-[#169c55]" />Production</span><button className="grid h-10 w-10 place-items-center rounded-lg border border-[#d6deea] text-[#526174] hover:bg-[#f4f7fb]" onClick={() => loadData()} title="Refresh dashboard" type="button"><MaterialSymbol className={`text-[20px] ${isRefreshing ? "animate-spin" : ""}`}>refresh</MaterialSymbol></button><button className="grid h-10 w-10 place-items-center rounded-full bg-[#0878eb] text-[12px] font-bold text-white lg:hidden" onClick={handleLogout} title="Sign out" type="button">{initials(ownerUser?.email)}</button></div>
        </header>

        <nav className="flex gap-xs overflow-x-auto border-b border-[#dce3ee] bg-white px-margin-mobile py-sm lg:hidden" aria-label="Mobile owner navigation">{NAV_ITEMS.map((item) => <button className={`whitespace-nowrap rounded-lg px-sm py-xs text-[12px] font-semibold ${activeSection === item.id ? "bg-[#0878eb] text-white" : "bg-[#f1f4f8] text-[#526174]"}`} key={item.id} onClick={() => setActiveSection(item.id)} type="button">{item.label}</button>)}</nav>

        <div className="px-margin-mobile py-md lg:px-lg">
          {notice && <div className="mb-md flex items-center gap-sm rounded-lg border border-[#bde2cc] bg-[#edf9f2] px-md py-sm text-[13px] text-[#177342]"><MaterialSymbol className="text-[19px]" fill>check_circle</MaterialSymbol>{notice}<button className="ml-auto" onClick={() => setNotice("")} type="button" aria-label="Dismiss notice"><MaterialSymbol className="text-[18px]">close</MaterialSymbol></button></div>}
          {errorMessage && <div className="mb-md flex items-center gap-sm rounded-lg border border-[#f0b9b5] bg-[#fff0ef] px-md py-sm text-[13px] text-[#bd2929]"><MaterialSymbol className="text-[19px]" fill>error</MaterialSymbol>{errorMessage}<button className="ml-auto" onClick={() => setErrorMessage("")} type="button" aria-label="Dismiss error"><MaterialSymbol className="text-[18px]">close</MaterialSymbol></button></div>}

          {activeSection === "overview" ? (
            <>
              <section className="flex min-h-12 items-center gap-sm rounded-[10px] border border-[#dce3ee] bg-white px-md text-[13px] text-[#526174]"><span className={`h-2 w-2 rounded-full ${liveStatus === "error" ? "bg-[#d33a36]" : "bg-[#0878eb]"}`} /><strong className="font-semibold text-[#172033]">{liveStatus === "error" ? "Live activity connection needs attention." : "All systems operational."}</strong><span className="hidden sm:inline">Owner data is connected and activity logging is enabled.</span><span className="ml-auto text-[11px] text-[#78869a]">Updated {relativeTime(lastRefreshedAt)}</span></section>

              <section className="mt-md grid grid-cols-2 border-l border-t border-[#dce3ee] bg-white sm:grid-cols-4 xl:grid-cols-8">{kpis.map((kpi) => <div className="min-w-0 border-b border-r border-[#dce3ee] px-sm py-md sm:px-md" key={kpi.label}><div className="flex items-center gap-xs text-[11px] font-medium text-[#334155] sm:text-[12px]"><MaterialSymbol className={`text-[19px] ${kpi.alert ? "text-[#e54b45]" : "text-[#0878eb]"}`}>{kpi.icon}</MaterialSymbol><span className="truncate">{kpi.label}</span></div><p className="mt-xs text-[23px] font-semibold tracking-tight text-[#111827] sm:text-[25px]">{kpi.value}</p><p className={`mt-1 truncate text-[10px] sm:text-[11px] ${kpi.alert ? "text-[#d33a36]" : "text-[#24834f]"}`}>{kpi.note}</p></div>)}</section>

              <section className="mt-md overflow-hidden rounded-[12px] border border-[#dce3ee] bg-white">
                <div className="border-b border-[#dce3ee] px-md py-sm">
                  <h2 className="text-[18px] font-semibold text-[#172033]">MOSEF pilot tracking</h2>
                  <p className="mt-1 text-[12px] text-[#637083]">Bounded owner-dashboard view of active schools/orgs, teams, scrims, and extraction usage.</p>
                </div>
                <div className="grid grid-cols-2 border-l border-[#dce3ee] sm:grid-cols-3 xl:grid-cols-6">
                  {pilotMetricCards.map((metric) => (
                    <div className="min-w-0 border-b border-r border-[#dce3ee] px-sm py-md sm:px-md" key={metric.label}>
                      <div className="flex items-center gap-xs text-[11px] font-medium text-[#334155] sm:text-[12px]">
                        <MaterialSymbol className={`text-[19px] ${metric.alert ? "text-[#e54b45]" : "text-[#0878eb]"}`}>{metric.icon}</MaterialSymbol>
                        <span className="truncate">{metric.label}</span>
                      </div>
                      <p className="mt-xs text-[23px] font-semibold tracking-tight text-[#111827] sm:text-[25px]">{metric.value}</p>
                      <p className={`mt-1 truncate text-[10px] sm:text-[11px] ${metric.alert ? "text-[#d33a36]" : "text-[#24834f]"}`}>{metric.note}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-md grid gap-md xl:grid-cols-[minmax(0,1fr)_326px]">
                <section className="admin-live-activity min-w-0 overflow-hidden border-y border-[#dce3ee] bg-white xl:border-x xl:rounded-[12px]">
                  <div className="flex flex-col gap-sm border-b border-[#dce3ee] px-md py-md sm:flex-row sm:items-center"><div className="flex items-center gap-sm"><h2 className="text-[19px] font-semibold">Live activity</h2><span className={`flex items-center gap-1 text-[12px] font-medium ${liveStatus === "live" ? "text-[#169c55]" : liveStatus === "error" ? "text-[#d33a36]" : "text-[#78869a]"}`}><span className={`h-2 w-2 rounded-full ${liveStatus === "live" ? "bg-[#169c55]" : liveStatus === "error" ? "bg-[#d33a36]" : "bg-[#f2a43a]"}`} />{liveStatus === "live" ? "Live" : liveStatus === "paused" ? "Paused" : liveStatus === "error" ? "Reconnect needed" : "Connecting"}</span></div><div className="sm:ml-auto flex gap-sm"><button className="flex items-center gap-xs text-[12px] font-medium text-[#334155] hover:text-[#0878eb]" onClick={() => setIsLive((current) => !current)} type="button"><MaterialSymbol className="text-[18px]">{isLive ? "pause" : "play_arrow"}</MaterialSymbol>{isLive ? "Pause" : "Resume"}</button><button className="flex items-center gap-xs text-[12px] font-medium text-[#334155] hover:text-[#0878eb]" onClick={() => { setActivityFilter("all"); setActivityWindow("all"); setGlobalSearch(""); }} type="button"><MaterialSymbol className="text-[18px]">filter_list_off</MaterialSymbol>Clear filters</button></div></div>
                  <div className="flex gap-xs overflow-x-auto border-b border-[#dce3ee] px-md py-sm">{ACTIVITY_FILTERS.map((filter) => <button className={`whitespace-nowrap rounded-lg border px-sm py-xs text-[12px] font-semibold ${activityFilter === filter.id ? "border-[#b8d5f5] bg-[#eef6ff] text-[#0878eb]" : "border-[#dce3ee] bg-white text-[#334155] hover:bg-[#f7f9fc]"}`} key={filter.id} onClick={() => setActivityFilter(filter.id)} type="button">{filter.label}</button>)}</div>
                  <div className="overflow-x-auto"><table className="min-w-[780px] w-full text-left text-[12px]"><thead className="bg-[#fafbfd] text-[#475569]"><tr><th className="px-md py-sm">Time</th><th className="px-md py-sm">Actor</th><th className="px-md py-sm">Action</th><th className="px-md py-sm">Target</th><th className="px-md py-sm">Status</th><th className="px-md py-sm">Details</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">{filteredActivity.length === 0 && <EmptyRows columns={6} label="No live activity matches these filters." />}{filteredActivity.slice(0, 12).map((entry) => { const actor = maps.users.get(entry.actor_user_id); return <tr className={`${entry.id === newestLiveId ? "bg-[#eef6ff]" : "hover:bg-[#f8fbff]"}`} key={entry.id}><td className="whitespace-nowrap px-md py-sm text-[#526174]">{entry.id === newestLiveId && <span className="mr-xs inline-block h-1.5 w-1.5 rounded-full bg-[#0878eb]" />}{relativeTime(entry.created_at)}</td><td className="px-md py-sm"><div className="flex items-center gap-xs"><MaterialSymbol className="text-[18px] text-[#243753]">{activityIcon(entry.entity_type)}</MaterialSymbol><div><p className="whitespace-nowrap font-semibold text-[#172033]">{actor?.display_name || (entry.actor_user_id ? "Authenticated user" : "System")}</p><p className="max-w-[150px] truncate text-[10px] text-[#7b8798]">{actor?.email || titleCase(entry.entity_type)}</p></div></div></td><td className="whitespace-nowrap px-md py-sm text-[#334155]">{titleCase(entry.action)}</td><td className="max-w-[180px] truncate px-md py-sm font-medium text-[#0878eb]">{entry.target_label}</td><td className="px-md py-sm"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${statusClass(entry.status)}`}>{titleCase(entry.status)}</span></td><td className="px-md py-sm text-[#526174]"><div className="flex min-w-0 items-center gap-xs"><span className="max-w-[170px] truncate">{entry.details || "—"}</span><button className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#334155] hover:bg-[#eef4fb] hover:text-[#0878eb]" onClick={() => setActiveSection(sectionForEntity(entry.entity_type))} title={`View ${entry.target_label}`} type="button"><MaterialSymbol className="text-[17px]">visibility</MaterialSymbol></button></div></td></tr>; })}</tbody></table></div>
                  <button className="m-md flex items-center gap-xs text-[12px] font-semibold text-[#0878eb]" onClick={() => setActiveSection("audit")} type="button">View full activity log<MaterialSymbol className="text-[17px]">arrow_forward</MaterialSymbol></button>
                </section>

                <aside className="overflow-hidden rounded-[12px] border border-[#dce3ee] bg-white"><h2 className="border-b border-[#dce3ee] px-md py-md text-[18px] font-semibold">Needs attention</h2><div className="divide-y divide-[#e5eaf1]">{attention.map((item) => { const tone = item.tone === "red" ? "text-[#e23d38] bg-[#ffeceb]" : item.tone === "amber" ? "text-[#e58b15] bg-[#fff4df]" : "text-[#199b58] bg-[#eaf8f0]"; return <button className="flex w-full items-start gap-sm px-md py-md text-left hover:bg-[#f8fbff]" key={item.id} onClick={() => setActiveSection(item.section)} type="button"><MaterialSymbol className={`mt-0.5 text-[22px] ${tone.split(" ")[0]}`}>{item.icon}</MaterialSymbol><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-[#172033]">{item.title}</span><span className="mt-1 block text-[11px] leading-4 text-[#637083]">{item.body}</span></span><span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${tone}`}>{item.count}</span><MaterialSymbol className="mt-1 text-[18px] text-[#8b97a8]">chevron_right</MaterialSymbol></button>; })}</div></aside>
              </div>
            </>
          ) : (
            <div className="mt-0">{renderResourceSection()}</div>
          )}
        </div>
      </main>

      <ConfirmDialog action={confirmAction} busy={isMutating} onCancel={() => setConfirmAction(null)} onConfirm={executeConfirmedAction} />
    </div>
  );
}
