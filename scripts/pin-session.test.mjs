import assert from "node:assert/strict";
import { signSession, verifySession, digest } from "../lib/pin-session.ts";
const secret = "a".repeat(64);
const gate = { expires: Date.now() + 60000 };
const token = await signSession(gate, secret);
assert.deepEqual(await verifySession(token, secret), gate);
assert.equal(await verifySession(token, "b".repeat(64)), null);
assert.equal(await verifySession(token + "x", secret), null);
assert.equal(
  await verifySession(
    await signSession({ expires: Date.now() - 1 }, secret),
    secret,
  ),
  null,
);
const a = { ...gate, profileId: "alice" };
const b = { ...gate, profileId: "bob" };
assert.equal(
  (await verifySession(await signSession(a, secret), secret)).profileId,
  "alice",
);
assert.equal(
  (await verifySession(await signSession(b, secret), secret)).profileId,
  "bob",
);
assert.equal((await verifySession(token, secret)).profileId, undefined);
assert.notEqual(await digest("wrong-pin"), await digest("another-pin"));
console.log(
  "Signed PIN sessions, expiry, tampering, and separate profile identities passed.",
);

const persistent = { expires: null, profileId: "alice" };
const persistentToken = await signSession(persistent, secret);
const realNow = Date.now;
try {
  Date.now = () => realNow() + 800 * 24 * 60 * 60 * 1000;
  assert.deepEqual(await verifySession(persistentToken, secret), persistent);
  assert.equal(await verifySession(token, secret), null);
} finally { Date.now = realNow; }
for (const invalid of [{}, { expires: "never" }, { expires: null, profileId: "" }]) {
  assert.equal(await verifySession(await signSession(invalid, secret), secret), null);
}
console.log("Persistent sessions survive elapsed time; expired legacy and malformed sessions are rejected.");
