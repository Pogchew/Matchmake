import { createClient } from "@supabase/supabase-js";
import { AUTH_ACCESS_TOKEN_COOKIE, AUTH_REFRESH_TOKEN_COOKIE } from "@/lib/auth-session";

const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase auth environment is not configured.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function setAuthCookies(response, session) {
  const accessMaxAge = Math.max(60, Number(session.expires_in || 3600));

  response.cookies.set(AUTH_ACCESS_TOKEN_COOKIE, session.access_token, cookieOptions(accessMaxAge));
  response.cookies.set(AUTH_REFRESH_TOKEN_COOKIE, session.refresh_token, cookieOptions(REFRESH_COOKIE_MAX_AGE));
}

export function clearAuthCookies(response) {
  response.cookies.set(AUTH_ACCESS_TOKEN_COOKIE, "", cookieOptions(0));
  response.cookies.set(AUTH_REFRESH_TOKEN_COOKIE, "", cookieOptions(0));
}

export async function validateAccessToken(accessToken) {
  if (!accessToken) return { user: null, error: new Error("Missing access token.") };

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return { user: null, error: new Error("Invalid access token.") };
  }

  const user = await response.json().catch(() => null);
  return user?.id ? { user, error: null } : { user: null, error: new Error("Invalid user payload.") };
}

export async function refreshAuthSession(refreshToken) {
  if (!refreshToken) return { session: null, error: new Error("Missing refresh token.") };

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session?.access_token || !data.session?.refresh_token) {
    return { session: null, error: error || new Error("Could not refresh auth session.") };
  }

  return { session: data.session, error: null };
}

export async function getValidSessionFromCookies(cookieStore) {
  const accessToken = cookieStore.get(AUTH_ACCESS_TOKEN_COOKIE)?.value || "";
  const refreshToken = cookieStore.get(AUTH_REFRESH_TOKEN_COOKIE)?.value || "";
  const validated = await validateAccessToken(accessToken);

  if (validated.user) {
    return {
      accessToken,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      refreshToken,
      session: null,
      user: validated.user,
      refreshed: false,
      error: null,
    };
  }

  const refreshed = await refreshAuthSession(refreshToken);
  if (refreshed.error || !refreshed.session) {
    return { accessToken: "", expiresAt: 0, refreshToken: "", session: null, user: null, refreshed: false, error: refreshed.error };
  }

  const refreshValidated = await validateAccessToken(refreshed.session.access_token);
  if (refreshValidated.error || !refreshValidated.user) {
    return { accessToken: "", expiresAt: 0, refreshToken: "", session: null, user: null, refreshed: false, error: refreshValidated.error };
  }

  return {
    accessToken: refreshed.session.access_token,
    expiresAt: refreshed.session.expires_at || Math.floor(Date.now() / 1000) + Number(refreshed.session.expires_in || 3600),
    refreshToken: refreshed.session.refresh_token,
    session: refreshed.session,
    user: refreshValidated.user,
    refreshed: true,
    error: null,
  };
}
