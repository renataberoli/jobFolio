import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { digest } from "../lib/pin-session.ts";

// Exercise the real route handlers and Drizzle queries against isolated SQLite.
const sqlite = new DatabaseSync(":memory:");
const migrationDirectory = new URL("../drizzle/", import.meta.url);
for (const name of readdirSync(migrationDirectory).filter(name => name.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(new URL(name, migrationDirectory), "utf8"));
}
class Statement {
  constructor(query, params = []) { this.query = query; this.params = params; }
  bind(...params) { return new Statement(this.query, params); }
  async first(column) {
    const row = sqlite.prepare(this.query).get(...this.params);
    return column ? row?.[column] ?? null : row ?? null;
  }
  async all() { return { results: sqlite.prepare(this.query).all(...this.params), success: true }; }
  async raw() {
    const statement = sqlite.prepare(this.query);
    statement.setReturnArrays(true);
    return statement.all(...this.params);
  }
  async run() {
    const result = sqlite.prepare(this.query).run(...this.params);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
}
const cookieJar = new Map();
const files = new Map();
globalThis.__jobfolioTest = {
  cookieJar,
  env: {
    JOBFOLIO_SESSION_SECRET: "test-session-secret-".repeat(4),
    JOBFOLIO_PIN_HASH: await digest("fixture-pin"),
    DB: { prepare: query => new Statement(query), batch: statements => Promise.all(statements.map(statement => statement.all())) },
    BUCKET: {
      async put(key, stream) { files.set(key, await new Response(stream).arrayBuffer()); },
      async get(key) { return files.has(key) ? { body: files.get(key) } : null; },
      async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) files.delete(key); },
    },
  },
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__jobfolioTest.env;", shortCircuit: true };
    if (specifier === "next/headers") return { url: "data:text/javascript,export async function cookies(){return {get:key=>globalThis.__jobfolioTest.cookieJar.has(key)?{value:globalThis.__jobfolioTest.cookieJar.get(key)}:undefined}}", shortCircuit: true };
    if (specifier === "next/navigation") return { url: "data:text/javascript,export function redirect(location){throw Object.assign(new Error('Redirect'),{location})}", shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      for (const suffix of [".ts", "/index.ts"]) {
        const url = new URL(specifier + suffix, context.parentURL);
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
const auth = await import("../app/api/auth/route.ts");
const profileList = await import("../app/api/profiles/route.ts");
const applications = await import("../app/api/applications/route.ts");
const documents = await import("../app/api/documents/[id]/[kind]/route.ts");
const profileSettings = await import("../app/api/profile/route.ts");
const profileExport = await import("../app/api/profile/export/route.ts");
const { sessionCookie, requireAppUser } = await import("../app/profile-auth.ts");
const jsonRequest = (payload, headers = {}) => new Request("https://jobfolio.test/api/auth", {
  method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload),
});
function remember(response) {
  const value = response.headers.get("set-cookie");
  if (value) cookieJar.set(sessionCookie, value.split(";")[0].slice(sessionCookie.length + 1));
}
async function authenticate(payload) {
  const response = await auth.POST(jsonRequest(payload));
  assert.equal(response.status, 200, await response.clone().text());
  remember(response);
  return response;
}
const fileContext = id => ({ params: Promise.resolve({ id, kind: "cv" }) });

try {
  sqlite.prepare("INSERT INTO applications (id,owner,role,company,url,cv_key,cv_name,letter_key,letter_name,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("legacy", "legacy-owner", "Original role", "Company", "", "legacy-cv", "original.pdf", "", "", "2026-01-01");
  files.set("legacy-cv", new TextEncoder().encode("existing document"));

  await assert.rejects(requireAppUser(), error => error.location === "/login");
  assert.equal((await applications.GET()).status, 401);
  assert.equal((await profileExport.GET()).status, 401);
  assert.equal((await profileSettings.PATCH(jsonRequest({ name: "Blocked" }))).status, 401);
  assert.equal((await profileSettings.DELETE(jsonRequest({ confirmation: "delete" }))).status, 401);
  assert.equal((await profileList.GET()).status, 401);
  assert.equal((await documents.GET(new Request("https://jobfolio.test"), fileContext("legacy"))).status, 401);
  assert.equal((await auth.POST(jsonRequest({ action: "create", name: "Blocked" }))).status, 401);
  assert.equal((await auth.POST(jsonRequest({ action: "select", profileId: "legacy-owner" }))).status, 401);
  assert.equal((await auth.POST(jsonRequest({ action: "login", pin: "wrong" }))).status, 401);
  assert.equal((await auth.POST(jsonRequest({ action: "login", pin: "fixture-pin" }, { origin: "https://other.test" }))).status, 403);
  assert.equal((await auth.POST(jsonRequest({ action: "logout" }, { "sec-fetch-site": "cross-site" }))).status, 403);

  const login = await authenticate({ action: "login", pin: "fixture-pin" });
  assert.match(login.headers.get("set-cookie"), /HttpOnly; SameSite=Lax; Max-Age=34560000; Secure/);
  await assert.rejects(requireAppUser(), error => error.location === "/profiles");
  assert.equal((await applications.GET()).status, 401);
  let list = await (await profileList.GET()).json();
  assert.deepEqual(list.profiles.map(profile => profile.id), ["legacy-owner"]);
  assert.equal((await auth.POST(jsonRequest({ action: "select", profileId: "missing" }))).status, 404);

  await authenticate({ action: "select", profileId: "legacy-owner" });
  const legacyCookie = cookieJar.get(sessionCookie);
  assert.equal((await requireAppUser()).userId, "legacy-owner");
  assert.equal((await (await applications.GET()).json()).applications[0].role, "Original role");
  assert.equal(await (await documents.GET(new Request("https://jobfolio.test"), fileContext("legacy"))).text(), "existing document");

  assert.equal((await profileSettings.PATCH(jsonRequest({ name: "   " }))).status, 400);
  assert.equal((await profileSettings.PATCH(jsonRequest({ name: "a".repeat(61) }))).status, 400);
  assert.equal((await profileSettings.PATCH(jsonRequest({ name: "Blocked" }, { origin: "https://other.test" }))).status, 403);
  const renamed = await profileSettings.PATCH(jsonRequest({ name: '  Maya, "Chen"  ', profileId: "another-profile" }));
  assert.equal(renamed.status, 200);
  assert.equal((await requireAppUser()).name, 'Maya, "Chen"');
  assert.equal((await (await profileList.GET()).json()).profiles[0].name, 'Maya, "Chen"');
  sqlite.prepare("UPDATE applications SET role = ?, notes = ? WHERE id = ?").run("=1+1", 'First line\n"Quoted", café', "legacy");
  const exported = await profileExport.GET();
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-disposition"), /attachment; filename="jobfolio-applications.csv"/);
  assert.match(exported.headers.get("cache-control"), /no-store/);
  const csvBytes = new Uint8Array(await exported.arrayBuffer());
  assert.deepEqual(Array.from(csvBytes.slice(0, 3)), [239, 187, 191]);
  const csv = new TextDecoder().decode(csvBytes);
  assert(csv.includes('"Maya, ""Chen"""'));
  assert(csv.includes('"\'=1+1"'));
  assert(csv.includes('"First line\n""Quoted"", café"'));
  assert(csv.includes('"original.pdf"'));
  assert(!csv.includes("legacy-owner"));
  assert(!csv.includes("legacy-cv"));

  await authenticate({ action: "create", name: "Second profile" });
  const secondUser = await requireAppUser();
  const secondCookie = cookieJar.get(sessionCookie);
  const emptyCsv = await (await profileExport.GET()).text();
  assert.equal(emptyCsv.trim().split("\r\n").length, 1);
  assert.equal((await (await applications.GET()).json()).applications.length, 0);
  assert.equal((await documents.GET(new Request("https://jobfolio.test"), fileContext("legacy"))).status, 404);
  for (const method of ["PATCH", "DELETE"]) {
    const response = await applications[method](new Request("https://jobfolio.test/api/applications", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "legacy", status: "Rejected" }) }));
    assert.equal(response.status, 404);
  }
  const edit = new FormData(); edit.set("id", "legacy"); edit.set("easyApply", "true");
  assert.equal((await applications.PUT(new Request("https://jobfolio.test/api/applications", { method: "PUT", body: edit }))).status, 404);

  const form = new FormData(); form.set("role", "New role"); form.set("easyApply", "true"); form.set("cv", new File(["new document"], "new.pdf"));
  const created = await applications.POST(new Request("https://jobfolio.test/api/applications", { method: "POST", body: form }));
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal((await (await applications.GET()).json()).applications[0].id, id);
  assert.equal(await (await documents.GET(new Request("https://jobfolio.test"), fileContext(id))).text(), "new document");
  const secondCsv = await (await profileExport.GET()).text();
  assert(secondCsv.includes("New role"));
  assert(!secondCsv.includes("=1+1"));
  assert(!secondCsv.includes('Maya, ""Chen""'));
  assert.equal((await profileSettings.DELETE(jsonRequest({}))).status, 400);
  assert.equal((await profileSettings.DELETE(jsonRequest({ confirmation: "delete" }, { origin: "https://other.test" }))).status, 403);
  const realDelete = globalThis.__jobfolioTest.env.BUCKET.delete;
  globalThis.__jobfolioTest.env.BUCKET.delete = async () => { throw new Error("Storage unavailable"); };
  assert.equal((await profileSettings.DELETE(jsonRequest({ confirmation: "delete" }))).status, 503);
  assert.equal((await requireAppUser()).userId, secondUser.userId);
  assert.equal((await (await applications.GET()).json()).applications.length, 1);
  globalThis.__jobfolioTest.env.BUCKET.delete = realDelete;
  const deleted = await profileSettings.DELETE(jsonRequest({ confirmation: "delete", profileId: "legacy-owner" }));
  assert.equal(deleted.status, 200);
  remember(deleted);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM profiles WHERE id = ?").get(secondUser.userId).total, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM applications WHERE owner = ?").get(secondUser.userId).total, 0);
  assert.equal(files.size, 1);
  assert(files.has("legacy-cv"));
  assert.equal((await profileExport.GET()).status, 401);
  await assert.rejects(requireAppUser(), error => error.location === "/profiles");
  cookieJar.set(sessionCookie, secondCookie);
  assert.equal((await applications.GET()).status, 401);
  await authenticate({ action: "login", pin: "fixture-pin" });
  assert.equal((await (await profileList.GET()).json()).profiles.length, 1);
  cookieJar.set(sessionCookie, legacyCookie);
  assert.equal((await documents.GET(new Request("https://jobfolio.test"), fileContext(id))).status, 404);
  assert.equal((await (await applications.GET()).json()).applications.length, 1);

  const logout = await authenticate({ action: "logout" });
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await applications.GET()).status, 401);
  cookieJar.set(sessionCookie, legacyCookie + "tampered");
  assert.equal((await applications.GET()).status, 401);
  cookieJar.clear();
  for (let attempt = 0; attempt < 11; attempt++) {
    const response = await auth.POST(jsonRequest({ action: "login", pin: "wrong" }, { "cf-connecting-ip": "rate-limit-test" }));
    assert.equal(response.status, attempt < 10 ? 401 : 429);
  }
  console.log("PIN access, profile renaming, CSV escaping/isolation, confirmed deletion, document cleanup, storage failure, and session invalidation passed.");
} finally {
  sqlite.close();
  delete globalThis.__jobfolioTest;
}
