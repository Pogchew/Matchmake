import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DISCORD_WEBHOOK_PATTERN = /^https:\/\/(discord(?:app)?\.com)\/api\/webhooks\/\d+\/[\w-]+/;

function formatDiscordTime(value) {
  if (!value) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatGamesCount(value) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) return "";
  return ` · ${count} ${count === 1 ? "game" : "games"}`;
}

function getDigestTitle(options = {}) {
  const gameFilter = options.gameFilter && options.gameFilter !== "all" ? `${options.gameFilter} ` : "";
  const days = Number(options.lookaheadDays || 7);
  return `${gameFilter}Scrim Schedule · Next ${days} Days`;
}

function shouldIncludeChat(options = {}) {
  return Array.isArray(options.notificationTypes) && options.notificationTypes.includes("chat_reminders");
}

function buildDigestLines(scrims = [], options = {}) {
  if (!scrims.length) return ["No scheduled scrims match these filters."];

  return scrims.slice(0, 20).map((scrim) => {
    const opponent = scrim.opponentName || "Awaiting opponent";
    const gamesCount = formatGamesCount(scrim.gamesCount);
    const scrimLink = scrim.scrimUrl ? ` · [View](${scrim.scrimUrl})` : "";
    const chatLink = shouldIncludeChat(options) && scrim.chatUrl ? ` · [Chat](${scrim.chatUrl})` : "";
    return `• **${formatDiscordTime(scrim.scheduled_at)}** — ${scrim.game_title || "Game TBD"}: ${scrim.postingTeamName || "Team TBD"} vs ${opponent} (${scrim.status || "scheduled"}${gamesCount})${scrimLink}${chatLink}`;
  });
}

function buildFilterFooter(options = {}) {
  const pieces = [];
  if (Array.isArray(options.statusFilters) && options.statusFilters.length) {
    pieces.push(`Statuses: ${options.statusFilters.join(", ")}`);
  }
  if (options.gameFilter && options.gameFilter !== "all") {
    pieces.push(`Game: ${options.gameFilter}`);
  }
  if (Array.isArray(options.notificationTypes) && options.notificationTypes.length) {
    pieces.push(`Includes: ${options.notificationTypes.map((type) => type.replace(/_/g, " ")).join(", ")}`);
  }
  return pieces.length ? pieces.join(" · ") : "Sent from Matchmake";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const webhookUrl = String(body.webhookUrl || "").trim();
    const scrims = Array.isArray(body.scrims) ? body.scrims : [];
    const options = body.options && typeof body.options === "object" ? body.options : {};

    if (!DISCORD_WEBHOOK_PATTERN.test(webhookUrl)) {
      return NextResponse.json({ error: "Enter a valid Discord webhook URL." }, { status: 400 });
    }

    const digestLines = buildDigestLines(scrims, options);
    const payload = {
      username: "Matchmake Calendar",
      embeds: [
        {
          title: getDigestTitle(options),
          description: digestLines.join("\n"),
          color: 0x0058bc,
          footer: { text: buildFilterFooter(options) },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Discord webhook failed", {
        status: response.status,
        body: await response.text(),
      });
      return NextResponse.json({ error: "Discord rejected the digest. Check the webhook URL and channel permissions." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Discord digest error", error);
    return NextResponse.json({ error: "Could not send the Discord digest." }, { status: 500 });
  }
}
