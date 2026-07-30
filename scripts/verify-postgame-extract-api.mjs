import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const API_URL = process.env.MATCHMAKE_EXTRACT_URL || "http://127.0.0.1:3000/api/postgame/extract";
const AUTH_COOKIE_NAME = "matchmake-access-token";
const AUTH_COOKIE = process.env.MATCHMAKE_EXTRACT_AUTH_COOKIE || "";
const TEST_EMAIL = process.env.MATCHMAKE_TEST_EMAIL || "";
const TEST_PASSWORD = process.env.MATCHMAKE_TEST_PASSWORD || "";
const VALID_IMAGE_PATH = process.env.MATCHMAKE_EXTRACT_VALID_IMAGE || path.join(process.cwd(), "public", "lol", "champions", "Annie.png");
const VALID_GAME_TITLE = process.env.MATCHMAKE_EXTRACT_VALID_GAME_TITLE || "League of Legends";
const RUN_VALID_REQUEST = process.env.MATCHMAKE_EXTRACT_RUN_VALID === "true";
const EXPECT_VALID_STATUS = Number.parseInt(process.env.MATCHMAKE_EXTRACT_VALID_EXPECTED_STATUS || "200", 10);

const HELP_TEXT = `
Verify post-game extractor API security/status responses.

Start the app first, for example:
  npm run dev

Run unauthenticated-only verification:
  node scripts/verify-postgame-extract-api.mjs

Run authenticated malformed and oversized verification:
  MATCHMAKE_EXTRACT_AUTH_COOKIE=<access-token> node scripts/verify-postgame-extract-api.mjs

Or let the script sign in with Supabase test credentials:
  MATCHMAKE_TEST_EMAIL=<email> MATCHMAKE_TEST_PASSWORD=<password> node scripts/verify-postgame-extract-api.mjs

Run a valid image request too:
  MATCHMAKE_EXTRACT_RUN_VALID=true \\
  MATCHMAKE_EXTRACT_VALID_IMAGE=/path/to/scoreboard.png \\
  MATCHMAKE_EXTRACT_VALID_GAME_TITLE="League of Legends" \\
  MATCHMAKE_EXTRACT_AUTH_COOKIE=<access-token> \\
  node scripts/verify-postgame-extract-api.mjs

Environment:
  MATCHMAKE_EXTRACT_URL defaults to ${API_URL}
  MATCHMAKE_EXTRACT_VALID_EXPECTED_STATUS defaults to ${EXPECT_VALID_STATUS}
`.trim();

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP_TEXT);
  process.exit(0);
}

function assertJsonCode(payload, expectedCode, label) {
  assert.equal(payload?.details?.code, expectedCode, `${label} error code`);
}

function authCookieHeader(accessTokenOrCookie) {
  if (accessTokenOrCookie.includes("=")) return accessTokenOrCookie;
  return `${AUTH_COOKIE_NAME}=${accessTokenOrCookie}`;
}

async function readLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const raw = await fs.readFile(envPath, "utf8").catch(() => "");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

async function getAuthCookieValue() {
  if (AUTH_COOKIE) return AUTH_COOKIE;
  if (!TEST_EMAIL || !TEST_PASSWORD) return "";

  const localEnv = await readLocalEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return "";

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Could not sign in test user: ${response.status} ${text}`);
  }

  const payload = await response.json();
  if (!payload?.access_token) throw new Error("Supabase sign-in did not return an access token.");
  return payload.access_token;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function verifyUnauthenticated() {
  const response = await fetch(API_URL, { method: "POST" });
  const payload = await readJson(response);

  assert.equal(response.status, 401, "unauthenticated request status");
  assertJsonCode(payload, "authentication_required", "unauthenticated request");
  console.log("unauthenticated request: 401 authentication_required");
}

async function verifyMalformedMultipart(authCookie) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      cookie: authCookieHeader(authCookie),
      "content-type": "multipart/form-data; boundary=broken-boundary",
    },
    body: "this is not a valid multipart body",
  });
  const payload = await readJson(response);

  assert.equal(response.status, 400, "malformed multipart status");
  assertJsonCode(payload, "malformed_form_data", "malformed multipart");
  console.log("malformed multipart request: 400 malformed_form_data");
}

async function verifyOversizedRequest(authCookie) {
  const oversizedBody = new Uint8Array(9 * 1024 * 1024);
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      cookie: authCookieHeader(authCookie),
      "content-type": "application/octet-stream",
    },
    body: oversizedBody,
  });
  const payload = await readJson(response);

  assert.equal(response.status, 413, "oversized request status");
  assertJsonCode(payload, "upload_too_large", "oversized request");
  console.log("oversized request: 413 upload_too_large");
}

async function verifyValidImageRequest(authCookie) {
  const image = await fs.readFile(VALID_IMAGE_PATH);
  const formData = new FormData();
  formData.append("gameTitle", VALID_GAME_TITLE);
  formData.append("image", new Blob([image]), path.basename(VALID_IMAGE_PATH));

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      cookie: authCookieHeader(authCookie),
    },
    body: formData,
  });
  const payload = await readJson(response);

  assert.equal(response.status, EXPECT_VALID_STATUS, `valid image request status: ${payload.error || response.statusText}`);
  assert.ok(response.status !== 400 && response.status !== 401 && response.status !== 413, "valid image request passed upload/auth guards");
  if (response.status === 200 && VALID_GAME_TITLE === "League of Legends") {
    const recognition = payload?.meta?.leagueChampionRecognition;
    assert.equal(recognition?.mode, "separate_pass", "League extraction reports the separate champion-recognition pass");
    assert.equal(payload?.meta?.referencePartsSent, 0, "League statistics pass does not receive champion reference images");
    console.log(`League champion recognition: ${recognition.status} (${recognition.accepted_rows ?? 0} accepted, ${recognition.review_rows ?? 0} review)`);
  }
  console.log(`valid image request: ${response.status} ${response.statusText || "OK"}`);
}

await verifyUnauthenticated();

const authCookie = await getAuthCookieValue();
if (!authCookie) {
  console.log("authenticated request checks skipped: set MATCHMAKE_EXTRACT_AUTH_COOKIE or MATCHMAKE_TEST_EMAIL/MATCHMAKE_TEST_PASSWORD");
  process.exit(0);
}

await verifyMalformedMultipart(authCookie);
await verifyOversizedRequest(authCookie);

if (RUN_VALID_REQUEST) {
  await verifyValidImageRequest(authCookie);
} else {
  console.log("valid image request skipped: set MATCHMAKE_EXTRACT_RUN_VALID=true and provide a scoreboard image path");
}
