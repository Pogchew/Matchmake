import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.MATCHMAKE_BASE_URL || "http://localhost:3000";
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || (9300 + Math.floor(Math.random() * 500)));
const CHROME_PATH = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEST_EMAIL = process.env.MATCHMAKE_TEST_EMAIL || "codex-ui-1779310745227@example.com";
const TEST_PASSWORD = process.env.MATCHMAKE_TEST_PASSWORD || "CodexTest123!";
const GAME_FILTER = process.env.MATCHMAKE_UI_GAME_FILTER || "";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const CASES = [
  {
    game: "Valorant",
    teamId: "fc8f1758-037a-4a3e-902e-b7591010db71",
    file: "/Users/nicholaschiu/Downloads/220695198-47f6b995-b1e4-4fc8-83f6-46325065e388.png",
    visible: ["PEARL", "LTS michey", "Neon", "245", "17/9/3", "64", "7", "Defuses"],
    formValues: ["LTS michey", "Neon", "245", "17", "9", "3", "64", "7"],
  },
  {
    game: "League of Legends",
    teamId: "be779b0a-504d-4b54-8725-9d9f6110e20f",
    file: "/Users/nicholaschiu/Downloads/shogo.png",
    visible: ["23 - 21", "ttv SoloSSBU", "Garen", "Shogo", "Brand", "24,170", "13,980"],
    formValues: ["ttv SoloSSBU", "Top", "Garen", "18", "12", "2", "3", "13980", "24170", "Shogo", "Brand"],
  },
  {
    game: "Overwatch 2",
    teamId: "6ce198b2-3180-46a9-b0db-2befd27d7aad",
    file: "/Users/nicholaschiu/Downloads/overwatch-2-competitive-ranks-1.jpg",
    visible: ["Circuit Royal", "Junker Queen", "Technoknight", "Junkrat", "2,241", "1,928"],
    formValues: ["Junker Queen", "Technoknight", "Junkrat", "6", "3", "2", "1928", "2241"],
  },
  {
    game: "Marvel Rivals",
    teamId: "23fb473a-f046-4b9e-96c1-5da93d1d46d4",
    file: "/Users/nicholaschiu/Downloads/please-explain-the-scoreboard-to-me-like-im-5-v0-nqfh9gtqyk9e1.webp",
    visible: ["KLYNTAR-SYMBIOTIC SURFACE", "Lucnif", "The Punisher", "4,554", "3,237", "33"],
    formValues: ["Lucnif", "The Punisher", "6", "9", "0", "4554", "3237", "33"],
  },
  {
    game: "Deadlock",
    teamId: "7f034135-de5b-477a-a218-14c3d187db83",
    file: "/Users/nicholaschiu/Downloads/download-replay.webp",
    visible: ["Duration 51:50", "CeeJay", "McGinnis", "55,777", "62,114", "15,164"],
    formValues: ["CeeJay", "McGinnis", "55777", "14", "17", "18", "62114", "15164", "14617"],
  },
];

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
        else resolve(message.result || {});
        return;
      }
      if (message.method) this.events.push(message);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30000);
    });
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChrome() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error("Chrome remote debugging did not start");
}

async function getPageWebSocket() {
  const targets = await waitForChrome();
  const page = targets.find((target) => target.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("No Chrome page target found");
  return page.webSocketDebuggerUrl;
}

async function evaluate(client, expression, options = {}) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: options.returnByValue ?? true,
    objectGroup: "matchmake-ui-test",
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await sleep(1500);
}

async function waitFor(client, predicateExpression, timeoutMs = 30000, label = "condition") {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const passed = await evaluate(client, predicateExpression).catch(() => false);
    if (passed) return;
    await sleep(500);
  }
  const state = await evaluate(client, `({ url: location.href, bodyText: document.body.innerText.slice(0, 2000) })`).catch(() => null);
  throw new Error(`Timed out waiting for ${label}${state ? `\nURL: ${state.url}\nBody:\n${state.bodyText}` : ""}`);
}

function jsString(value) {
  return JSON.stringify(value);
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, "");
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

async function signInDirectly() {
  const localEnv = await readLocalEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  if (!payload?.access_token) return null;
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return { ...payload, storageKey: `sb-${projectRef}-auth-token` };
}

async function login(client) {
  await navigate(client, `${BASE_URL}/login`);
  const directSession = await signInDirectly();
  if (directSession?.access_token) {
    await client.send("Network.setCookie", {
      name: "matchmake-access-token",
      value: directSession.access_token,
      url: BASE_URL,
      path: "/",
      maxAge: AUTH_COOKIE_MAX_AGE,
      sameSite: "Lax",
    });
    if (directSession.refresh_token) {
      await client.send("Network.setCookie", {
        name: "matchmake-refresh-token",
        value: directSession.refresh_token,
        url: BASE_URL,
        path: "/",
        maxAge: AUTH_COOKIE_MAX_AGE,
        sameSite: "Lax",
      });
    }
    await evaluate(client, `
      localStorage.setItem(${jsString(directSession.storageKey)}, ${jsString(JSON.stringify({
        access_token: directSession.access_token,
        token_type: directSession.token_type || "bearer",
        expires_in: directSession.expires_in,
        expires_at: directSession.expires_at,
        refresh_token: directSession.refresh_token,
        user: directSession.user,
      }))});
      true;
    `);
    await navigate(client, `${BASE_URL}/`);
    await waitFor(client, `!location.pathname.startsWith('/login')`, 20000, "direct login navigation");
    return;
  }

  const alreadyLoggedIn = await evaluate(client, `!location.pathname.startsWith('/login') || document.body.innerText.includes('Log out')`);
  if (alreadyLoggedIn) return;
  const emailVisible = await evaluate(client, `Boolean(document.querySelector('input[type="email"]'))`).catch(() => false);
  if (!emailVisible) {
    await evaluate(client, `
      [...document.querySelectorAll('button, a')]
        .find((candidate) => /log\\s*in|sign\\s*in/i.test(candidate.textContent.trim()))
        ?.click();
    `);
  }
  await waitFor(client, `Boolean(document.querySelector('input[type="email"]'))`, 10000, "login form");
  await evaluate(client, `
    (() => {
      const setValue = (input, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const email = document.querySelector('input[type="email"]');
      const password = document.querySelector('input[type="password"]');
      if (!email || !password) return false;
      setValue(email, ${jsString(TEST_EMAIL)});
      setValue(password, ${jsString(TEST_PASSWORD)});
      document.querySelector('form button[type="submit"]').click();
      return true;
    })()
  `);
  await waitFor(client, `!location.pathname.startsWith('/login')`, 20000, "login navigation");
}

async function uploadFile(client, filePath) {
  const objectResult = await client.send("Runtime.evaluate", {
    expression: `document.querySelector('input[type="file"]')`,
    returnByValue: false,
    objectGroup: "matchmake-ui-test",
  });
  const objectId = objectResult.result?.objectId;
  if (!objectId) throw new Error("No upload input found");
  await client.send("DOM.setFileInputFiles", { objectId, files: [filePath] });
}

async function expandReviewEditor(client) {
  await evaluate(client, `
    (() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => candidate.textContent.includes('Review & Edit Extracted Data'));
      if (button && !document.querySelector('form textarea')) {
        button.scrollIntoView({ block: 'center' });
        button.click();
      }
      return true;
    })()
  `);
  await waitFor(client, `Boolean(document.querySelector('form textarea'))`, 10000, "review editor form");
}

async function collectUiState(client) {
  return evaluate(client, `
    (() => ({
      url: location.href,
      bodyText: document.body.innerText,
      inputValues: [...document.querySelectorAll('input')]
        .filter((input) => input.type !== 'file')
        .map((input) => input.value),
      selectedValues: [...document.querySelectorAll('select')]
        .map((select) => select.options[select.selectedIndex]?.textContent || select.value),
      textareas: [...document.querySelectorAll('textarea')].map((textarea) => textarea.value),
    }))()
  `);
}

async function verifyCase(client, testCase) {
  await navigate(client, `${BASE_URL}/team/${testCase.teamId}/dashboard`);
  await waitFor(client, `Boolean(document.querySelector('input[type="file"]'))`, 20000, `${testCase.game} upload input`);
  await uploadFile(client, testCase.file);
  await waitFor(
    client,
    `document.body.innerText.includes('Stats extracted into') || document.body.innerText.includes('Extraction issue:')`,
    90000,
    `${testCase.game} extraction completion`,
  );
  const postUploadText = await evaluate(client, `document.body.innerText`);
  assert.ok(!postUploadText.includes("Extraction issue:"), `${testCase.game} has no extraction issue`);
  await expandReviewEditor(client);
  const state = await collectUiState(client);
  const joinedFormValues = [...state.inputValues, ...state.selectedValues, ...state.textareas].join("\\n");

  for (const expected of testCase.visible) {
    assert.ok(
      normalizeText(state.bodyText).includes(normalizeText(expected)) ||
        compactText(state.bodyText).includes(compactText(expected)),
      `${testCase.game} visible output contains ${expected}\nVisible text:\n${state.bodyText.slice(0, 4000)}`,
    );
  }
  for (const expected of testCase.formValues) {
    assert.ok(
      joinedFormValues.includes(expected),
      `${testCase.game} edit form contains ${expected}\nForm values:\n${joinedFormValues.slice(0, 4000)}`,
    );
  }

  console.log(`${testCase.game}: actual UI upload populated visible dashboard and edit form`);
}

const chromeProfileDir = await fs.mkdtemp(path.join(os.tmpdir(), "matchmake-ui-chrome-profile-"));
const chrome = spawn(CHROME_PATH, [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${chromeProfileDir}`,
  "--no-first-run",
  "--disable-default-apps",
  "--window-size=1440,1000",
  "about:blank",
], { stdio: "ignore" });

let client;
try {
  const wsUrl = await getPageWebSocket();
  client = new CdpClient(wsUrl);
  await client.open();
  await client.send("Page.enable");
  await client.send("DOM.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  await login(client);
  const casesToRun = GAME_FILTER ? CASES.filter((testCase) => testCase.game === GAME_FILTER) : CASES;
  for (const testCase of casesToRun) {
    await verifyCase(client, testCase);
  }
  console.log("All five actual browser UI upload checks passed.");
} finally {
  client?.close();
  chrome.kill("SIGTERM");
  await fs.rm(chromeProfileDir, { force: true, recursive: true }).catch(() => {});
}
