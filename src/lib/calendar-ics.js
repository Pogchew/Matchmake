import { SCRIM_DURATION_HOURS, getScrimEndAt } from "@/lib/scrim-utils";

export function formatIcsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function escapeIcsText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function formatRankRange(scrim) {
  if (scrim.opponent_rank_min && scrim.opponent_rank_max) {
    if (scrim.opponent_rank_min === scrim.opponent_rank_max) return scrim.opponent_rank_min;
    return `${scrim.opponent_rank_min} - ${scrim.opponent_rank_max}`;
  }

  return scrim.opponent_rank_min || scrim.opponent_rank_max || scrim.team_rank || "Rank TBD";
}

export function buildCalendarEventSummary(scrim) {
  const postingTeam = scrim.posting_team?.name || "Team TBD";
  const matchedTeam = scrim.matched_team?.name || "Awaiting opponent";
  return `Matchmake Scrim: ${postingTeam} vs ${matchedTeam}`;
}

export function buildCalendarEventDescription(scrim, appUrl = "") {
  const rank = formatRankRange(scrim);
  const region = scrim.posting_team?.region || scrim.matched_team?.region || "Location TBD";
  const scrimUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/scrims/${scrim.id}` : "";
  return [
    `Game: ${scrim.game_title || "Game TBD"}`,
    `Status: ${scrim.status || "scheduled"}`,
    `Looking for: ${rank}`,
    `Location: ${region}`,
    scrimUrl ? `Matchmake: ${scrimUrl}` : "",
  ].filter(Boolean).join("\\n");
}

export function buildIcsCalendar(scrims = [], options = {}) {
  const now = formatIcsDate(new Date());
  const calendarName = options.calendarName || "Matchmake Scrims";
  const appUrl = options.appUrl || "";
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
        `DESCRIPTION:${escapeIcsText(buildCalendarEventDescription(scrim, appUrl))}`,
        `CATEGORIES:${escapeIcsText(scrim.game_title || "Scrim")}`,
        `STATUS:${scrim.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
        "END:VEVENT",
      ].join("\r\n");
    });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Matchmake//Scrim Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
