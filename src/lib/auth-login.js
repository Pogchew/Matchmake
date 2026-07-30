const RETRYABLE_AUTH_ERROR_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /network(?:error| request)?/i,
  /load failed/i,
  /econn(?:reset|refused|aborted)/i,
  /enotfound/i,
  /timed? ?out/i,
];

export const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  "The login service is temporarily unavailable. Please wait a moment and try again.";

function isRetryableAuthError(error) {
  if (!error) return false;
  if (error instanceof TypeError) return true;

  const message = String(error.message || error);
  return RETRYABLE_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function signInWithPasswordSafely(
  authClient,
  credentials,
  { retryDelayMs = 750, sleep = wait } = {}
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await authClient.auth.signInWithPassword(credentials);
    } catch (error) {
      const shouldRetry = attempt === 0 && isRetryableAuthError(error);

      if (shouldRetry) {
        await sleep(retryDelayMs);
        continue;
      }

      return {
        data: { user: null, session: null },
        error: new Error(
          isRetryableAuthError(error)
            ? AUTH_SERVICE_UNAVAILABLE_MESSAGE
            : error?.message || "Could not sign in."
        ),
      };
    }
  }

  return {
    data: { user: null, session: null },
    error: new Error(AUTH_SERVICE_UNAVAILABLE_MESSAGE),
  };
}
