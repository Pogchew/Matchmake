function decodeBase64Url(value = "") {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof atob === "function") return atob(padded);
  if (typeof Buffer !== "undefined") return Buffer.from(padded, "base64").toString("utf8");
  return "";
}

export function getJwtExpirySeconds(accessToken) {
  if (!accessToken || typeof accessToken !== "string") return null;
  const payloadSegment = accessToken.split(".")[1];
  if (!payloadSegment) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(payloadSegment));
    const expiresAt = Number(payload?.exp);
    return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null;
  } catch {
    return null;
  }
}

export function isJwtExpiringSoon(accessToken, nowSeconds = Date.now() / 1000, bufferSeconds = 60) {
  const expiresAt = getJwtExpirySeconds(accessToken);
  if (!expiresAt) return true;
  return expiresAt <= Number(nowSeconds) + Number(bufferSeconds);
}
