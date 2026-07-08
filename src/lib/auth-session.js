export const AUTH_ACCESS_TOKEN_COOKIE = "matchmake-access-token";
export const AUTH_REFRESH_TOKEN_COOKIE = "matchmake-refresh-token";

const AUTH_CHANGED_EVENT = "matchmake-auth-changed";
let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

function dispatchAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }
}

export function clearSupabaseBrowserStorage() {
  if (typeof window === "undefined") return;

  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Browsers can block storage access; failing closed is fine here.
  }
}

export async function storeAuthSession(session) {
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error("Cannot store an incomplete auth session.");
  }

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
    }),
  });

  if (!response.ok) {
    cachedAccessToken = "";
    cachedAccessTokenExpiresAt = 0;
    clearSupabaseBrowserStorage();
    throw new Error("Could not start a secure session.");
  }

  cachedAccessToken = session.access_token;
  cachedAccessTokenExpiresAt = Number(session.expires_at || 0) * 1000;
  clearSupabaseBrowserStorage();
  dispatchAuthChanged();
}

export async function clearAuthSession() {
  cachedAccessToken = "";
  cachedAccessTokenExpiresAt = 0;
  clearSupabaseBrowserStorage();

  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => {});

  dispatchAuthChanged();
}

export async function getAccessTokenForSupabase() {
  if (typeof window === "undefined") return null;

  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now() + 30_000) {
    return cachedAccessToken;
  }

  const response = await fetch("/api/auth/access-token", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    cachedAccessToken = "";
    cachedAccessTokenExpiresAt = 0;
    clearSupabaseBrowserStorage();
    return null;
  }

  const payload = await response.json().catch(() => null);
  cachedAccessToken = payload?.access_token || "";
  cachedAccessTokenExpiresAt = Number(payload?.expires_at || 0) * 1000;
  return cachedAccessToken || null;
}

export async function getCurrentUser() {
  const response = await fetch("/api/auth/user", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    return { data: { user: null }, error: new Error("No active session.") };
  }

  const payload = await response.json().catch(() => null);
  return { data: { user: payload?.user || null }, error: null };
}

export { AUTH_CHANGED_EVENT };
