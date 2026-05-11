"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import MaterialSymbol from "@/components/MaterialSymbol";
import { normalizeTeamLocation } from "@/lib/game-options";
import { supabase } from "@/lib/supabase";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STATUS_FILTERS = ["all", "open", "pending", "confirmed"];
const ACTIVE_STATUSES = ["open", "pending", "confirmed"];
const SCRIM_DURATION_HOURS = 3;

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function getLocalTimeZoneLabel() {
  return new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value || "Local";
}

function formatScrimTime(value) {
  if (!value) return "Time TBD";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatIcsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function getScrimEndAt(value) {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setHours(end.getHours() + SCRIM_DURATION_HOURS);
  return end;
}

function buildCalendarEventSummary(scrim) {
  const postingTeam = scrim.posting_team?.name || "Team TBD";
  const matchedTeam = scrim.matched_team?.name || "Awaiting opponent";
  return `Matchmake Scrim: ${postingTeam} vs ${matchedTeam}`;
}

function buildCalendarEventDescription(scrim) {
  const rank = formatRankRange(scrim);
  const region = normalizeTeamLocation(scrim.posting_team?.region || scrim.matched_team?.region) || "Location TBD";
  return [
    `Game: ${scrim.game_title || "Game TBD"}`,
    `Status: ${scrim.status || "scheduled"}`,
    `Looking for: ${rank}`,
    `Location: ${region}`,
    `Matchmake: ${typeof window !== "undefined" ? `${window.location.origin}/scrims/${scrim.id}` : ""}`,
  ].join("\\n");
}

function buildIcsCalendar(scrims = []) {
  const now = formatIcsDate(new Date());
  const events = scrims
    .filter((scrim) => scrim.scheduled_at)
    .map((scrim) => {
      const start = new Date(scrim.scheduled_at);
      const end = getScrimEndAt(scrim.scheduled_at) || new Date(start.getTime() + SCRIM_DURATION_HOURS * 60 * 60 * 1000);
      return [
        "BEGIN:VEVENT",
        `UID:matchmake-${scrim.id}@matchmake`,
        `DTSTAMP:${now}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcsText(buildCalendarEventSummary(scrim))}`,
        `DESCRIPTION:${escapeIcsText(buildCalendarEventDescription(scrim))}`,
        `CATEGORIES:${escapeIcsText(scrim.game_title || "Scrim")}`,
        "END:VEVENT",
      ].join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Matchmake//Scrim Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Matchmake Scrims",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadTextFile(filename, content, type = "text/calendar;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatRankRange(scrim) {
  if (scrim.opponent_rank_min && scrim.opponent_rank_max) {
    if (scrim.opponent_rank_min === scrim.opponent_rank_max) return scrim.opponent_rank_min;
    return `${scrim.opponent_rank_min} - ${scrim.opponent_rank_max}`;
  }

  return scrim.opponent_rank_min || scrim.opponent_rank_max || scrim.team_rank || "Rank TBD";
}

function getStatusStyles(status) {
  if (status === "confirmed") {
    return {
      accent: "bg-[#1B5E20]",
      chip: "text-[#1B5E20] bg-[#E3F9E5]",
      icon: "check_circle",
      label: "Confirmed",
    };
  }

  if (status === "pending") {
    return {
      accent: "bg-tertiary",
      chip: "text-tertiary bg-tertiary-fixed/40",
      icon: "schedule",
      label: "Pending",
    };
  }

  return {
    accent: "bg-primary",
    chip: "text-on-primary-fixed bg-primary-fixed",
    icon: "campaign",
    label: "Open Listing",
  };
}

function getPerspectiveText(scrim, teamIds) {
  const isPosting = teamIds.includes(scrim.posting_team_id);
  const isMatched = teamIds.includes(scrim.matched_team_id);

  if (scrim.status === "confirmed") return "Scrim confirmed.";
  if (isPosting && scrim.status === "open") return "Your listing is open.";
  if (isPosting && scrim.status === "pending") return "You have an inbound request.";
  if (isMatched && scrim.status === "pending") return "Waiting for opponent to accept.";

  return "Scrim on your calendar.";
}

function StatusChip({ status }) {
  const styles = getStatusStyles(status);

  return (
    <div className={`flex items-center gap-xs font-label-small text-label-small px-3 py-1 rounded-full self-start sm:self-auto ${styles.chip}`}>
      <MaterialSymbol className="text-[14px]">{styles.icon}</MaterialSymbol>
      {styles.label}
    </div>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-lg text-center">
      <MaterialSymbol className="mx-auto mb-sm block text-[36px] text-outline">event_busy</MaterialSymbol>
      <h3 className="font-headline-3 text-headline-3 text-on-surface">{title}</h3>
      <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">{body}</p>
      {action && <div className="mt-md">{action}</div>}
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [current, setCurrent] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(today));
  const [statusFilter, setStatusFilter] = useState("all");
  const [teams, setTeams] = useState([]);
  const [scrims, setScrims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [discordMessage, setDiscordMessage] = useState("");
  const [discordError, setDiscordError] = useState("");
  const [isSendingDiscord, setIsSendingDiscord] = useState(false);
  const localTimeZoneLabel = getLocalTimeZoneLabel();

  useEffect(() => {
    async function fetchCalendarData() {
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
        console.error("Failed to load profile for calendar", profileError);
        setErrorMessage("We could not load your profile. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!profile?.org_id) {
        setErrorMessage("Your account is missing an organization.");
        setIsLoading(false);
        return;
      }

      const { data: teamData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, game_title")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true });

      if (teamsError) {
        console.error("Failed to load teams for calendar", teamsError);
        setErrorMessage("We could not load your teams. Please try again.");
        setIsLoading(false);
        return;
      }

      const myTeamIds = (teamData || []).map((team) => team.id);
      setTeams(teamData || []);

      if (myTeamIds.length === 0) {
        setScrims([]);
        setIsLoading(false);
        return;
      }

      const requestSelect = `
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
          game_title,
          rank_tier,
          region,
          scrimgg_rating,
          organization:organizations!teams_org_id_fkey (
            id,
            name,
            verified_flag
          )
        ),
        matched_team:teams!scrim_requests_matched_team_id_fkey (
          id,
          name,
          game_title,
          rank_tier,
          region,
          scrimgg_rating,
          organization:organizations!teams_org_id_fkey (
            id,
            name,
            verified_flag
          )
        )
      `;

      const idList = myTeamIds.join(",");
      const { data: scrimData, error: scrimsError } = await supabase
        .from("scrim_requests")
        .select(requestSelect)
        .in("status", ACTIVE_STATUSES)
        .or(`posting_team_id.in.(${idList}),matched_team_id.in.(${idList})`)
        .order("scheduled_at", { ascending: true });

      if (scrimsError) {
        console.error("Failed to load calendar scrims", scrimsError);
        setErrorMessage("We could not load your calendar. Please try again.");
        setIsLoading(false);
        return;
      }

      setScrims(scrimData || []);
      setIsLoading(false);
    }

    fetchCalendarData();
  }, [router]);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const total = firstDay + daysInMonth;
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  const teamIds = useMemo(() => teams.map((team) => team.id), [teams]);

  const filteredScrims = useMemo(() => (
    statusFilter === "all"
      ? scrims
      : scrims.filter((scrim) => scrim.status === statusFilter)
  ), [scrims, statusFilter]);

  const scrimsByDate = useMemo(() => filteredScrims.reduce((groups, scrim) => {
    const key = getDateInputValue(new Date(scrim.scheduled_at));
    return {
      ...groups,
      [key]: [...(groups[key] || []), scrim],
    };
  }, {}), [filteredScrims]);

  const selectedDayScrims = scrimsByDate[selectedDate] || [];
  const monthScrims = filteredScrims.filter((scrim) => {
    const date = new Date(scrim.scheduled_at);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const pendingCount = monthScrims.filter((scrim) => scrim.status === "pending").length;
  const confirmedCount = monthScrims.filter((scrim) => scrim.status === "confirmed").length;
  const upcomingExportScrims = filteredScrims.filter((scrim) => scrim.scheduled_at && new Date(scrim.scheduled_at) >= new Date());
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weeklyDiscordScrims = filteredScrims.filter((scrim) => {
    if (!scrim.scheduled_at) return false;
    const scheduledAt = new Date(scrim.scheduled_at);
    return scheduledAt >= new Date() && scheduledAt <= weekEnd;
  });

  const changeMonth = (dir) => {
    const next = new Date(current);
    next.setMonth(next.getMonth() + dir);
    setCurrent(next);
    setSelectedDate(getDateInputValue(new Date(next.getFullYear(), next.getMonth(), 1)));
  };

  const jumpToThisMonth = () => {
    const now = new Date();
    setCurrent(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(getDateInputValue(now));
  };

  const selected = new Date(`${selectedDate}T00:00:00`);
  const selectedDayNumber = selected.getDate();
  const selectedMonth = selected.getMonth();
  const dayLabel = `${DAYS_FULL[selected.getDay()]}, ${MONTHS[selectedMonth].slice(0, 3)} ${selectedDayNumber}`;

  const exportIcs = (target) => {
    if (upcomingExportScrims.length === 0) {
      setDiscordError("");
      setDiscordMessage("No upcoming scrims to export.");
      return;
    }

    const ics = buildIcsCalendar(upcomingExportScrims);
    downloadTextFile(`matchmake-${target}-scrims.ics`, ics);
    setDiscordError("");
    setDiscordMessage(`Downloaded ${upcomingExportScrims.length} upcoming scrim ${upcomingExportScrims.length === 1 ? "event" : "events"} for ${target === "google" ? "Google Calendar" : "Outlook"}.`);
  };

  const sendDiscordDigest = async () => {
    setDiscordError("");
    setDiscordMessage("");
    setIsSendingDiscord(true);

    const digestScrims = weeklyDiscordScrims.map((scrim) => ({
      id: scrim.id,
      scheduled_at: scrim.scheduled_at,
      game_title: scrim.game_title,
      status: scrim.status,
      postingTeamName: scrim.posting_team?.name,
      opponentName: scrim.matched_team?.name || "Awaiting opponent",
    }));

    try {
      const response = await fetch("/api/calendar/discord-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: discordWebhookUrl,
          scrims: digestScrims,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not send Discord digest.");
      }

      setDiscordMessage(`Sent ${digestScrims.length} scrim ${digestScrims.length === 1 ? "event" : "events"} to Discord.`);
    } catch (error) {
      console.error("Failed to send Discord digest", error);
      setDiscordError(error.message || "Could not send Discord digest.");
    } finally {
      setIsSendingDiscord(false);
    }
  };

  return (
    <>
      <TopBar />

      <main className="pt-lg pb-[100px] px-margin-mobile max-w-[1200px] mx-auto">
        <div className="mb-md flex flex-col gap-sm md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-headline-1 text-headline-1 text-on-surface">{MONTHS[month]}</h1>
            <p className="font-body-sub text-body-sub text-on-surface-variant">
              {monthScrims.length} {monthScrims.length === 1 ? "scrim" : "scrims"} this month · {pendingCount} pending · {confirmedCount} confirmed
            </p>
          </div>
          <div className="flex gap-unit bg-surface-container-low rounded-lg p-unit self-start md:self-auto">
            <button
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-variant transition-colors"
              type="button"
            >
              <MaterialSymbol className="text-[20px]">chevron_left</MaterialSymbol>
            </button>
            <button
              className="h-8 rounded px-sm font-label-bold text-label-bold text-primary hover:bg-primary-fixed transition-colors"
              onClick={jumpToThisMonth}
              type="button"
            >
              This Month
            </button>
            <button
              aria-label="Next month"
              onClick={() => changeMonth(1)}
              className="w-8 h-8 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-variant transition-colors"
              type="button"
            >
              <MaterialSymbol className="text-[20px]">chevron_right</MaterialSymbol>
            </button>
          </div>
        </div>

        <div className="mb-md flex gap-xs overflow-x-auto pb-xs">
          {STATUS_FILTERS.map((filter) => (
            <button
              className={`rounded-full px-md py-sm font-label-bold text-label-bold capitalize transition-colors ${
                statusFilter === filter
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"
              }`}
              key={filter}
              onClick={() => setStatusFilter(filter)}
              type="button"
            >
              {filter === "all" ? "All" : filter}
            </button>
          ))}
          <button
            className={`inline-flex items-center gap-xs rounded-full px-md py-sm font-label-bold text-label-bold transition-colors ${
              isIntegrationOpen
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-variant"
            }`}
            onClick={() => setIsIntegrationOpen((open) => !open)}
            type="button"
          >
            <MaterialSymbol className="text-[18px]">ios_share</MaterialSymbol>
            Export
          </button>
        </div>

        {isIntegrationOpen && (
          <section className="mb-md rounded-xl border border-surface-variant/50 bg-surface-container-lowest p-md shadow-[0_8px_30px_0_rgba(0,0,0,0.04)]">
            <div className="mb-md flex flex-col gap-xs sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-headline-3 text-headline-3 text-on-surface">Calendar integrations</h2>
                <p className="font-body-sub text-body-sub text-on-surface-variant">
                  Export upcoming scrims off-platform or post this week’s schedule into Discord.
                </p>
              </div>
              <span className="rounded-full bg-primary-fixed px-sm py-1 font-label-small text-label-small text-primary">
                {upcomingExportScrims.length} upcoming
              </span>
            </div>

            <div className="grid gap-md lg:grid-cols-3">
              <button
                className="flex items-center gap-sm rounded-xl border border-outline-variant/25 bg-surface-container-low p-md text-left transition-colors hover:bg-primary-fixed disabled:opacity-50"
                disabled={upcomingExportScrims.length === 0}
                onClick={() => exportIcs("google")}
                type="button"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">
                  <MaterialSymbol>calendar_add_on</MaterialSymbol>
                </div>
                <div>
                  <p className="font-label-bold text-label-bold text-on-surface">Google Calendar</p>
                  <p className="font-label-small text-label-small text-on-surface-variant">Download an importable .ics file</p>
                </div>
              </button>

              <button
                className="flex items-center gap-sm rounded-xl border border-outline-variant/25 bg-surface-container-low p-md text-left transition-colors hover:bg-primary-fixed disabled:opacity-50"
                disabled={upcomingExportScrims.length === 0}
                onClick={() => exportIcs("outlook")}
                type="button"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-on-primary">
                  <MaterialSymbol>event_upcoming</MaterialSymbol>
                </div>
                <div>
                  <p className="font-label-bold text-label-bold text-on-surface">Microsoft Outlook</p>
                  <p className="font-label-small text-label-small text-on-surface-variant">Download an importable .ics file</p>
                </div>
              </button>

              <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low p-md">
                <div className="mb-sm flex items-center gap-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-tertiary text-on-primary">
                    <MaterialSymbol>forum</MaterialSymbol>
                  </div>
                  <div>
                    <p className="font-label-bold text-label-bold text-on-surface">Discord weekly digest</p>
                    <p className="font-label-small text-label-small text-on-surface-variant">{weeklyDiscordScrims.length} scrims this week</p>
                  </div>
                </div>
                <input
                  className="mb-sm w-full rounded-lg border-none bg-surface-container-lowest px-sm py-2 font-body-sub text-body-sub text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary"
                  onChange={(event) => setDiscordWebhookUrl(event.target.value)}
                  placeholder="Discord webhook URL"
                  type="password"
                  value={discordWebhookUrl}
                />
                <button
                  className="w-full rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary disabled:opacity-60"
                  disabled={isSendingDiscord || !discordWebhookUrl.trim()}
                  onClick={sendDiscordDigest}
                  type="button"
                >
                  {isSendingDiscord ? "Sending..." : "Post This Week"}
                </button>
              </div>
            </div>

            {(discordMessage || discordError) && (
              <div className={`mt-md rounded-lg px-md py-sm font-body-sub text-body-sub ${discordError ? "bg-error-container text-on-error-container" : "bg-primary-fixed text-on-primary-fixed"}`}>
                {discordError || discordMessage}
              </div>
            )}
          </section>
        )}

        {isLoading ? (
          <div className="rounded-xl border border-surface-variant/50 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            Loading calendar...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
            {errorMessage}
          </div>
        ) : teams.length === 0 ? (
          <EmptyState
            title="Create a team to start scheduling scrims."
            body="Your calendar will show scrims for every team in your organization."
            action={
              <Link
                className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
                href="/team/new"
              >
                <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
                Add Team
              </Link>
            }
          />
        ) : (
          <>
            <section className="bg-surface-container-lowest rounded-xl p-md mb-xl shadow-[0_8px_30px_0_rgba(0,0,0,0.04)] border border-surface-variant/50">
              <div className="grid grid-cols-7 mb-sm text-center">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <div key={`${day}-${index}`} className="font-label-small text-label-small text-on-surface-variant">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-sm gap-x-xs text-center font-body-main text-body-main">
                {Array.from({ length: firstDay }).map((_, index) => (
                  <div key={`prev-${index}`} className="py-2 text-outline-variant cursor-default">
                    {prevDays - (firstDay - 1 - index)}
                  </div>
                ))}

                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const dateValue = getDateInputValue(new Date(year, month, day));
                  const dayScrims = scrimsByDate[dateValue] || [];
                  const isSelected = dateValue === selectedDate;
                  const isToday = dateValue === getDateInputValue();

                  return (
                    <button
                      key={dateValue}
                      onClick={() => setSelectedDate(dateValue)}
                      className={`min-h-12 py-2 cursor-pointer rounded-lg flex flex-col items-center justify-center relative transition-colors ${
                        isSelected
                          ? "bg-primary text-on-primary shadow-sm"
                          : isToday
                            ? "bg-primary-fixed text-on-primary-fixed"
                            : "hover:bg-surface-container"
                      }`}
                      type="button"
                    >
                      <span className={isSelected || isToday ? "font-label-bold" : ""}>{day}</span>
                      {dayScrims.length > 0 && (
                        <div className="absolute bottom-1 flex max-w-[30px] gap-[2px]">
                          {dayScrims.slice(0, 3).map((scrim) => (
                            <span
                              className={`h-1 w-1 rounded-full ${
                                isSelected ? "bg-on-primary" : getStatusStyles(scrim.status).accent
                              }`}
                              key={scrim.id}
                            />
                          ))}
                          {dayScrims.length > 3 && (
                            <span className={`h-1 w-1 rounded-full ${isSelected ? "bg-on-primary" : "bg-outline"}`} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}

                {Array.from({ length: trailing }).map((_, index) => (
                  <div key={`next-${index}`} className="py-2 text-outline-variant cursor-default">
                    {index + 1}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-md">
                <h2 className="font-headline-2 text-headline-2 text-on-surface">{dayLabel}</h2>
                <span className="font-label-small text-label-small text-primary bg-primary-fixed px-2 py-1 rounded-full">
                  {selectedDayScrims.length} {selectedDayScrims.length === 1 ? "Scrim" : "Scrims"}
                </span>
              </div>

              <div className="flex flex-col gap-md">
                {selectedDayScrims.length === 0 ? (
                  <EmptyState
                    title="No scrims scheduled for this day."
                    body="Post a new listing when your team is ready to practice."
                    action={
                      <Link
                        className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary"
                        href="/?post=true"
                      >
                        <MaterialSymbol className="text-[18px]">add</MaterialSymbol>
                        Schedule New Scrim
                      </Link>
                    }
                  />
                ) : (
                  selectedDayScrims.map((scrim) => {
                    const postingTeam = scrim.posting_team;
                    const matchedTeam = scrim.matched_team;
                    const statusStyles = getStatusStyles(scrim.status);
                    const opponentLabel = matchedTeam?.name || "Awaiting opponent";
                    const region = normalizeTeamLocation(postingTeam?.region || matchedTeam?.region) || "Location TBD";

                    return (
                      <Link
                        key={scrim.id}
                        href={`/scrims/${scrim.id}`}
                        className="bg-surface-container-lowest rounded-xl p-md shadow-[0_8px_30px_0_rgba(0,0,0,0.04)] border border-surface-variant/50 flex items-stretch gap-md relative overflow-hidden hover:border-outline-variant transition-colors cursor-pointer"
                      >
                        <div className={`w-1 ${statusStyles.accent} absolute left-0 top-md bottom-md rounded-r-full`} />
                        <div className="flex flex-col justify-center min-w-[72px] pl-sm">
                          <span className="font-label-bold text-label-bold text-on-surface">{formatScrimTime(scrim.scheduled_at)}</span>
                          <span className="font-label-small text-label-small text-on-surface-variant">{localTimeZoneLabel}</span>
                        </div>
                        <div className="w-[1px] bg-surface-variant" />
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-md py-xs">
                          <div className="flex items-center gap-sm min-w-0">
                            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-surface-variant shrink-0">
                              <span className="font-label-bold text-on-surface-variant">{getInitials(postingTeam?.name)}</span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-body-main text-body-main text-on-surface font-semibold truncate">
                                {postingTeam?.name || "Unknown Team"} vs {opponentLabel}
                              </h3>
                              <p className="font-label-small text-label-small text-on-surface-variant">
                                {scrim.game_title} · VS {formatRankRange(scrim)} · {region}
                              </p>
                              <p className="mt-0.5 font-label-small text-label-small text-outline">
                                {getPerspectiveText(scrim, teamIds)}
                              </p>
                            </div>
                          </div>
                          <StatusChip status={scrim.status} />
                        </div>
                      </Link>
                    );
                  })
                )}

                <Link
                  href="/?post=true"
                  className="bg-transparent rounded-xl p-md border-2 border-dashed border-outline-variant/40 flex items-center justify-center gap-sm cursor-pointer hover:bg-surface-container-low transition-colors py-lg"
                >
                  <MaterialSymbol className="text-outline">add</MaterialSymbol>
                  <span className="font-label-bold text-label-bold text-outline">Schedule New Scrim</span>
                </Link>
              </div>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
