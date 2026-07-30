import assert from "node:assert/strict";
import {
  AUTH_SERVICE_UNAVAILABLE_MESSAGE,
  signInWithPasswordSafely,
} from "../src/lib/auth-login.js";

const credentials = {
  email: "player@example.com",
  password: "not-a-real-password",
};

function mockAuthClient(signInWithPassword) {
  return { auth: { signInWithPassword } };
}

let retryAttempts = 0;
const successfulSession = {
  data: { user: { id: "test-user" }, session: { access_token: "test-token" } },
  error: null,
};
const recoveredResult = await signInWithPasswordSafely(
  mockAuthClient(async () => {
    retryAttempts += 1;
    if (retryAttempts === 1) throw new TypeError("Failed to fetch");
    return successfulSession;
  }),
  credentials,
  { sleep: async () => {} }
);

assert.equal(retryAttempts, 2, "a temporary network failure is retried once");
assert.equal(recoveredResult, successfulSession, "a successful retry returns the Supabase result");

let unavailableAttempts = 0;
const unavailableResult = await signInWithPasswordSafely(
  mockAuthClient(async () => {
    unavailableAttempts += 1;
    throw new TypeError("Failed to fetch");
  }),
  credentials,
  { sleep: async () => {} }
);

assert.equal(unavailableAttempts, 2, "a persistent network failure stops after one retry");
assert.equal(unavailableResult.data.session, null);
assert.equal(unavailableResult.error.message, AUTH_SERVICE_UNAVAILABLE_MESSAGE);

const invalidCredentialsError = new Error("Invalid login credentials");
let invalidCredentialsAttempts = 0;
const invalidCredentialsResult = await signInWithPasswordSafely(
  mockAuthClient(async () => {
    invalidCredentialsAttempts += 1;
    return { data: { user: null, session: null }, error: invalidCredentialsError };
  }),
  credentials,
  { sleep: async () => {} }
);

assert.equal(invalidCredentialsAttempts, 1, "Supabase credential errors are not retried");
assert.equal(invalidCredentialsResult.error, invalidCredentialsError, "credential errors remain unchanged");

console.log("Auth login resilience checks passed.");
