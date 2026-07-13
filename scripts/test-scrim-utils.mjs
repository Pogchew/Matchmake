import assert from "node:assert/strict";
import {
  SCRIM_DATE_TIME_FORMATS,
  SCRIM_DURATION_HOURS,
  formatGamesCount,
  formatMessageTime,
  formatScrimDetailDateTime,
  formatScrimDateTime,
  formatScrimStandardDateTime,
  formatScrimTime,
  formatScrimTimeWithZone,
  getDateInputValue,
  getInitials,
  getScrimEndAt,
  getTimeInputValue,
  parseScheduledAt,
  parseScheduledAtWithMeridiem,
} from "../src/lib/scrim-utils.js";

assert.equal(SCRIM_DURATION_HOURS, 3, "scrim duration remains three hours");
assert.equal(getScrimEndAt(), null, "missing scrim time has no end");
assert.equal(getScrimEndAt("not-a-date"), null, "invalid scrim time has no end");
assert.equal(getScrimEndAt("2026-07-09T12:30:00Z")?.toISOString(), "2026-07-09T15:30:00.000Z", "scrim end adds three hours");

assert.equal(getInitials(), "", "missing name has empty initials");
assert.equal(getInitials("North High"), "NH", "uses the first two words");
assert.equal(getInitials("  North   High   School  "), "NH", "ignores extra spaces and later words");

assert.equal(formatGamesCount(), "3 Games", "missing game count defaults to three games");
assert.equal(formatGamesCount(1), "1 Game", "singular game count is formatted correctly");
assert.equal(formatGamesCount("5"), "5 Games", "string game counts are accepted");

assert.equal(formatScrimDateTime(), "Time TBD", "missing display time uses the existing placeholder");
assert.equal(formatScrimDateTime("2026-07-09T04:05:00Z", SCRIM_DATE_TIME_FORMATS.detail), "Thu, Jul 9, 4:05 AM UTC", "detail date format retains weekday and timezone");
assert.equal(formatScrimDateTime("2026-07-09T04:05:00Z", SCRIM_DATE_TIME_FORMATS.standard), "Jul 9, 4:05 AM UTC", "standard date format retains the existing team/request format");
assert.equal(formatScrimDateTime("2026-07-09T04:05:00Z", SCRIM_DATE_TIME_FORMATS.timeOnly), "4:05 AM", "time-only format retains calendar/chat output");
assert.equal(formatScrimDateTime("2026-07-09T04:05:00Z", SCRIM_DATE_TIME_FORMATS.timeWithZone), "4:05 AM UTC", "time-and-zone format retains Scrim Board output");
assert.equal(formatScrimDetailDateTime("2026-07-09T04:05:00Z"), "Thu, Jul 9, 4:05 AM UTC", "detail wrapper keeps Scrim Detail output");
assert.equal(formatScrimStandardDateTime("2026-07-09T04:05:00Z"), "Jul 9, 4:05 AM UTC", "standard wrapper keeps Team and Requests output");
assert.equal(formatScrimTime("2026-07-09T04:05:00Z"), "4:05 AM", "time wrapper keeps Calendar output");
assert.equal(formatScrimTimeWithZone("2026-07-09T04:05:00Z"), "4:05 AM UTC", "time-and-zone wrapper keeps Scrim Board output");
assert.equal(formatMessageTime(), "", "message timestamps keep their empty fallback");

assert.equal(getDateInputValue(new Date("2026-01-05T14:30:00Z")), "2026-01-05", "date input is zero-padded");
assert.equal(getTimeInputValue(), "19:00", "missing time uses the existing default");
assert.equal(getTimeInputValue("not-a-date"), "19:00", "invalid time uses the existing default");
assert.equal(getTimeInputValue("2026-07-09T04:05:00Z"), "04:05", "time input is zero-padded");
assert.equal(parseScheduledAt("2026-07-09", "04:05"), "2026-07-09T04:05:00.000Z", "date and time serialize as an ISO value");
assert.equal(parseScheduledAt("not-a-date", "04:05"), null, "invalid date and time return null");
assert.equal(parseScheduledAtWithMeridiem("2026-07-09", "4:05 PM"), "2026-07-09T16:05:00.000Z", "Scrim Board accepts meridiem time values");
assert.equal(parseScheduledAtWithMeridiem("2026-07-09", "12:00 AM"), "2026-07-09T00:00:00.000Z", "midnight meridiem value is preserved");

console.log("Scrim utility tests passed.");
