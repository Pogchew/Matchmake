import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearAuthCookies, getValidSessionFromCookies, setAuthCookies } from "@/lib/server-auth-session";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getValidSessionFromCookies(cookieStore);

  if (session.error || !session.accessToken) {
    const response = NextResponse.json({ error: "No active session." }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json({
    access_token: session.accessToken,
    expires_at: session.expiresAt,
  });

  if (session.refreshed && session.session) {
    setAuthCookies(response, session.session);
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}
