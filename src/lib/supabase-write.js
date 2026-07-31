export function isSupabaseAuthWriteFailure(result = {}) {
  const status = Number(result?.status || result?.error?.status);
  const code = String(result?.error?.code || "").toUpperCase();
  const message = [
    result?.error?.message,
    result?.error?.details,
    result?.error?.hint,
  ].filter(Boolean).join(" ").toLowerCase();

  return status === 401
    || code === "PGRST301"
    || message.includes("jwt expired")
    || message.includes("invalid jwt")
    || message.includes("token is expired");
}

export async function executeSupabaseWriteWithAuthRetry(writeOperation, refreshAccessToken) {
  const firstResult = await writeOperation();
  if (!isSupabaseAuthWriteFailure(firstResult)) {
    return { ...firstResult, authRetryAttempted: false, authRefreshFailed: false };
  }

  const refreshedToken = await refreshAccessToken().catch(() => null);
  if (!refreshedToken) {
    return { ...firstResult, authRetryAttempted: true, authRefreshFailed: true };
  }

  const retryResult = await writeOperation();
  return { ...retryResult, authRetryAttempted: true, authRefreshFailed: false };
}

