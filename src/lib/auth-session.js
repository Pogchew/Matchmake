export const AUTH_ACCESS_TOKEN_COOKIE = "matchmake-access-token";
export const AUTH_REFRESH_TOKEN_COOKIE = "matchmake-refresh-token";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function storeAuthSession(session) {
  if (typeof document === "undefined" || !session?.access_token) return;

  document.cookie = `${AUTH_ACCESS_TOKEN_COOKIE}=${session.access_token}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;

  if (session.refresh_token) {
    document.cookie = `${AUTH_REFRESH_TOKEN_COOKIE}=${session.refresh_token}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }
}

export function clearAuthSession() {
  if (typeof document === "undefined") return;

  document.cookie = `${AUTH_ACCESS_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${AUTH_REFRESH_TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
