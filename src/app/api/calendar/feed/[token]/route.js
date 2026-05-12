import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildIcsCalendar } from "@/lib/calendar-ics";

export const runtime = "nodejs";

const ACTIVE_FEED_STATUSES = ["open", "pending", "confirmed"];

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function GET(request, context) {
  const params = await context.params;
  const token = String(params?.token || "").trim();

  if (!token || token.length < 24) {
    return NextResponse.json({ error: "Calendar feed not found." }, { status: 404 });
  }

  const supabase = getServerSupabase();

  if (!supabase) {
    return NextResponse.json({ error: "Calendar feed is not configured." }, { status: 500 });
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, calendar_feed_token")
    .eq("calendar_feed_token", token)
    .maybeSingle();

  if (orgError) {
    console.error("Failed to load calendar feed organization", orgError);
    return NextResponse.json({ error: "Calendar feed could not be loaded." }, { status: 500 });
  }

  if (!organization?.id) {
    return NextResponse.json({ error: "Calendar feed not found." }, { status: 404 });
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .eq("org_id", organization.id);

  if (teamsError) {
    console.error("Failed to load calendar feed teams", teamsError);
    return NextResponse.json({ error: "Calendar feed teams could not be loaded." }, { status: 500 });
  }

  const teamIds = (teams || []).map((team) => team.id);

  if (teamIds.length === 0) {
    const emptyCalendar = buildIcsCalendar([], {
      calendarName: `${organization.name || "Matchmake"} Scrims`,
      appUrl: request.nextUrl.origin,
    });
    return new Response(emptyCalendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  const idList = teamIds.join(",");
  const { data: scrims, error: scrimsError } = await supabase
    .from("scrim_requests")
    .select(`
      id,
      posting_team_id,
      matched_team_id,
      game_title,
      scheduled_at,
      team_rank,
      opponent_rank_min,
      opponent_rank_max,
      status,
      posting_team:teams!scrim_requests_posting_team_id_fkey (
        id,
        name,
        region
      ),
      matched_team:teams!scrim_requests_matched_team_id_fkey (
        id,
        name,
        region
      )
    `)
    .in("status", ACTIVE_FEED_STATUSES)
    .or(`posting_team_id.in.(${idList}),matched_team_id.in.(${idList})`)
    .gte("scheduled_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("scheduled_at", { ascending: true });

  if (scrimsError) {
    console.error("Failed to load calendar feed scrims", scrimsError);
    return NextResponse.json({ error: "Calendar feed scrims could not be loaded." }, { status: 500 });
  }

  const calendar = buildIcsCalendar(scrims || [], {
    calendarName: `${organization.name || "Matchmake"} Scrims`,
    appUrl: request.nextUrl.origin,
  });

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=\"matchmake-scrims.ics\"",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
    },
  });
}
