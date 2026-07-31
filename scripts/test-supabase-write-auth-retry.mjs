import assert from "node:assert/strict";
import { getJwtExpirySeconds, isJwtExpiringSoon } from "../src/lib/auth-token.js";
import {
  executeSupabaseWriteWithAuthRetry,
  isSupabaseAuthWriteFailure,
} from "../src/lib/supabase-write.js";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

const expiry = 2_000_000_000;
assert.equal(getJwtExpirySeconds(`${encode({ alg: "none" })}.${encode({ exp: expiry })}.signature`), expiry);
assert.equal(getJwtExpirySeconds("not-a-jwt"), null);
assert.equal(getJwtExpirySeconds(`${encode({})}.${encode({ sub: "user" })}.signature`), null);
assert.equal(isJwtExpiringSoon(`${encode({ alg: "none" })}.${encode({ exp: 1_100 })}.signature`, 1_000, 60), false);
assert.equal(isJwtExpiringSoon(`${encode({ alg: "none" })}.${encode({ exp: 1_050 })}.signature`, 1_000, 60), true);
assert.equal(isJwtExpiringSoon("not-a-jwt", 1_000, 60), true);

assert.equal(isSupabaseAuthWriteFailure({ status: 401, error: { message: "Unauthorized" } }), true);
assert.equal(isSupabaseAuthWriteFailure({ error: { code: "PGRST301", message: "JWT expired" } }), true);
assert.equal(isSupabaseAuthWriteFailure({ status: 409, error: { message: "duplicate key" } }), false);

let writeAttempts = 0;
let refreshAttempts = 0;
const recovered = await executeSupabaseWriteWithAuthRetry(
  async () => {
    writeAttempts += 1;
    if (writeAttempts === 1) return { data: null, error: { message: "JWT expired" }, status: 401 };
    return { data: { id: "game-2" }, error: null, status: 201 };
  },
  async () => {
    refreshAttempts += 1;
    return "fresh-token";
  }
);

assert.equal(writeAttempts, 2);
assert.equal(refreshAttempts, 1);
assert.equal(recovered.data.id, "game-2");
assert.equal(recovered.error, null);
assert.equal(recovered.authRetryAttempted, true);
assert.equal(recovered.authRefreshFailed, false);

let nonAuthAttempts = 0;
const nonAuthFailure = await executeSupabaseWriteWithAuthRetry(
  async () => {
    nonAuthAttempts += 1;
    return { data: null, error: { message: "duplicate key" }, status: 409 };
  },
  async () => {
    throw new Error("refresh should not run");
  }
);
assert.equal(nonAuthAttempts, 1);
assert.equal(nonAuthFailure.authRetryAttempted, false);

const refreshFailure = await executeSupabaseWriteWithAuthRetry(
  async () => ({ data: null, error: { code: "PGRST301", message: "JWT expired" }, status: 401 }),
  async () => null
);
assert.equal(refreshFailure.authRetryAttempted, true);
assert.equal(refreshFailure.authRefreshFailed, true);

console.log("Supabase write auth retry tests passed.");
