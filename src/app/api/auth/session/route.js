import { NextResponse } from "next/server";
import { clearAuthCookies, setAuthCookies, validateAccessToken } from "@/lib/server-auth-session";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const accessToken = body?.access_token;
  const refreshToken = body?.refresh_token;

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Auth session is incomplete." }, { status: 400 });
  }

  const { user, error } = await validateAccessToken(accessToken);
  if (error || !user?.id) {
    return NextResponse.json({ error: "Auth session could not be verified." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setAuthCookies(response, {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: body?.expires_at,
    expires_in: body?.expires_in,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
