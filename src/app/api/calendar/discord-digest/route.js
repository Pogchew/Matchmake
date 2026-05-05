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

function buildDigestLines(scrims = []) {
  if (!scrims.length) return ["No scheduled scrims this week."];

  return scrims.slice(0, 20).map((scrim) => {
    const opponent = scrim.opponentName || "Awaiting opponent";
    return `• **${formatDiscordTime(scrim.scheduled_at)}** — ${scrim.game_title || "Game TBD"}: ${scrim.postingTeamName || "Team TBD"} vs ${opponent} (${scrim.status || "scheduled"})`;
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const webhookUrl = String(body.webhookUrl || "").trim();
    const scrims = Array.isArray(body.scrims) ? body.scrims : [];

    if (!DISCORD_WEBHOOK_PATTERN.test(webhookUrl)) {
      return NextResponse.json({ error: "Enter a valid Discord webhook URL." }, { status: 400 });
    }

    const digestLines = buildDigestLines(scrims);
    const payload = {
      username: "Matchmake Calendar",
      embeds: [
        {
          title: "This Week's Scrims",
          description: digestLines.join("\n"),
          color: 0x0058bc,
          footer: { text: "Sent from Matchmake" },
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
