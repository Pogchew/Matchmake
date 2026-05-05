import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Team = {
  id: string;
  name: string | null;
  region: string | null;
  organization?: {
    name: string | null;
  } | null;
};

type ScrimRequest = {
  id: string;
  posting_team_id: string;
  matched_team_id: string | null;
  game_title: string | null;
  scheduled_at: string | null;
  status: string | null;
  games_count?: number | null;
  posting_team?: Team | null;
  matched_team?: Team | null;
};

const DISCORD_MAX_DESCRIPTION = 3800;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function formatScrimTime(value: string | null) {
  if (!value) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatGamesCount(value?: number | null) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) return "";
  return ` · ${count} ${count === 1 ? "game" : "games"}`;
}

function getTeamLabel(team?: Team | null) {
  if (!team?.name) return "Team TBD";
  const orgName = team.organization?.name;
  return orgName ? `${team.name} (${orgName})` : team.name;
}

function getScrimUrl(scrimId: string) {
  const appUrl = Deno.env.get("MATCHMAKE_APP_URL") || Deno.env.get("SITE_URL") || "";
  if (!appUrl) return "";
  return `${appUrl.replace(/\/$/, "")}/scrims/${scrimId}`;
}

function groupScrimsByGame(scrims: ScrimRequest[]) {
  return scrims.reduce((groups, scrim) => {
    const gameTitle = scrim.game_title || "Other Games";
    const current = groups.get(gameTitle) || [];
    current.push(scrim);
    groups.set(gameTitle, current);
    return groups;
  }, new Map<string, ScrimRequest[]>());
}

function buildDiscordDescription(scrims: ScrimRequest[]) {
  if (scrims.length === 0) {
    return "No confirmed scrims scheduled for the next 7 days.";
  }

  const lines: string[] = [];
  const grouped = groupScrimsByGame(scrims);

  for (const [gameTitle, gameScrims] of grouped) {
    lines.push(`**${gameTitle}**`);
    for (const scrim of gameScrims) {
      const postingTeam = getTeamLabel(scrim.posting_team);
      const matchedTeam = getTeamLabel(scrim.matched_team);
      const gamesCount = formatGamesCount(scrim.games_count);
      const scrimUrl = getScrimUrl(scrim.id);
      const link = scrimUrl ? ` · [View Scrim](${scrimUrl})` : "";
      lines.push(`• ${formatScrimTime(scrim.scheduled_at)} — ${postingTeam} vs ${matchedTeam}${gamesCount}${link}`);
    }
    lines.push("");
  }

  const description = lines.join("\n").trim();
  if (description.length <= DISCORD_MAX_DESCRIPTION) return description;
  return `${description.slice(0, DISCORD_MAX_DESCRIPTION - 80)}\n\n…and more confirmed scrims.`;
}

Deno.serve(async () => {
  const discordWebhookUrl = Deno.env.get("DISCORD_SCRIM_WEBHOOK_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!discordWebhookUrl) {
    return jsonResponse({ error: "DISCORD_SCRIM_WEBHOOK_URL is not configured." }, 500);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase Edge Function env vars are missing." }, 500);
  }

  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("scrim_requests")
    .select(`
      id,
      posting_team_id,
      matched_team_id,
      game_title,
      scheduled_at,
      status,
      games_count,
      posting_team:teams!scrim_requests_posting_team_id_fkey (
        id,
        name,
        region,
        organization:organizations!teams_org_id_fkey (
          id,
          name
        )
      ),
      matched_team:teams!scrim_requests_matched_team_id_fkey (
        id,
        name,
        region,
        organization:organizations!teams_org_id_fkey (
          id,
          name
        )
      )
    `)
    .eq("status", "confirmed")
    .gte("scheduled_at", now.toISOString())
    .lt("scheduled_at", nextWeek.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Failed to load weekly scrims", {
      code: error.code,
      message: error.message,
    });
    return jsonResponse({ error: "Could not load confirmed scrims." }, 500);
  }

  const scrims = (data || []) as ScrimRequest[];
  console.log("Weekly Discord calendar scrim count", scrims.length);

  const payload = {
    username: "Matchmake Calendar",
    embeds: [
      {
        title: "Matchmake Weekly Scrim Schedule",
        description: buildDiscordDescription(scrims),
        color: 0x0058bc,
        fields: [
          {
            name: "Date Range",
            value: `${formatDate(now)} - ${formatDate(nextWeek)} UTC`,
            inline: false,
          },
        ],
        footer: { text: "Confirmed scrims only" },
        timestamp: now.toISOString(),
      },
    ],
  };

  const discordResponse = await fetch(discordWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!discordResponse.ok) {
    const responseText = await discordResponse.text();
    console.error("Discord webhook failed", {
      status: discordResponse.status,
      body: responseText,
    });
    return jsonResponse({
      error: "Discord webhook failed.",
      discordStatus: discordResponse.status,
      discordResponse: responseText,
    }, 500);
  }

  return jsonResponse({
    ok: true,
    scrimCount: scrims.length,
    rangeStart: now.toISOString(),
    rangeEnd: nextWeek.toISOString(),
  });
});
