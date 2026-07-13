export const SCRIM_DURATION_HOURS = 3;

export const SCRIM_DATE_TIME_FORMATS = {
  detail: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  standard: {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  timeOnly: {
    hour: "numeric",
    minute: "2-digit",
  },
  timeWithZone: {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
};

export function getScrimEndAt(value) {
  if (!value) return null;

  const endAt = new Date(value);
  if (Number.isNaN(endAt.getTime())) return null;

  endAt.setHours(endAt.getHours() + SCRIM_DURATION_HOURS);
  return endAt;
}

export function getInitials(name = "") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function formatGamesCount(value) {
  const count = Number(value || 3);
  return `${count} ${count === 1 ? "Game" : "Games"}`;
}

export function formatScrimDateTime(value, format = SCRIM_DATE_TIME_FORMATS.standard) {
  if (!value) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", format).format(new Date(value));
}

export function formatScrimDetailDateTime(value) {
  return formatScrimDateTime(value, SCRIM_DATE_TIME_FORMATS.detail);
}

export function formatScrimStandardDateTime(value) {
  return formatScrimDateTime(value, SCRIM_DATE_TIME_FORMATS.standard);
}

export function formatScrimTime(value) {
  return formatScrimDateTime(value, SCRIM_DATE_TIME_FORMATS.timeOnly);
}

export function formatScrimTimeWithZone(value) {
  return formatScrimDateTime(value, SCRIM_DATE_TIME_FORMATS.timeWithZone);
}

export function formatMessageTime(value) {
  if (!value) return "";
  return formatScrimDateTime(value, SCRIM_DATE_TIME_FORMATS.timeOnly);
}

export function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTimeInputValue(value) {
  if (!value) return "19:00";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "19:00";

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function parseScheduledAt(dateValue, timeValue) {
  const scheduledAt = new Date(`${dateValue}T${timeValue || "00:00"}:00`);
  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt.toISOString();
}

export function parseScheduledAtWithMeridiem(dateValue, timeValue = "") {
  const timeMatch = String(timeValue).match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  const scheduledAt = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(scheduledAt.getTime()) || !timeMatch) return null;

  let hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2] || 0);
  const meridiem = timeMatch[3]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt.toISOString();
}
