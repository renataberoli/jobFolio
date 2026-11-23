// Receives the target URL, PIN, and optional Sites service token through hidden stdin.
import assert from "node:assert/strict";

async function readInput() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdout.write("Ready for hidden verification input.\n");
  const input = await new Promise((resolve, reject) => {
    let value = "";
    const onData = chunk => {
      value += chunk.toString();
      if (value.includes("\u0003")) { process.stdin.off("data", onData); reject(new Error("Cancelled")); }
      else if (/[\r\n]/.test(value)) { process.stdin.off("data", onData); resolve(value.trim()); }
    };
    process.stdin.on("data", onData);
  });
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  return JSON.parse(input);
}

try {
  const { url, pin, serviceToken } = await readInput();
  const origin = new URL(url).origin;
  const headers = serviceToken ? { "OAI-Sites-Authorization": `Bearer ${serviceToken}` } : {};
  const request = (path, options = {}) => fetch(new URL(path, origin), { redirect: "manual", ...options, headers: { ...headers, ...options.headers } });
  const home = await request("/");
  assert([302, 303, 307, 308].includes(home.status), `Anonymous home: ${home.status}`);
  assert.equal(new URL(home.headers.get("location"), origin).pathname, "/login");
  const loginPage = await request("/login");
  assert.equal(loginPage.status, 200);
  assert((await loginPage.text()).includes("Access PIN"));
  for (const path of ["/api/applications", "/api/profiles", "/api/documents/missing/cv"]) {
    assert.equal((await request(path)).status, 401, `Anonymous ${path}`);
  }
  const login = await request("/api/auth", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ action: "login", pin }) });
  assert.equal(login.status, 200, `PIN login: ${login.status}`);
  let cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie?.startsWith("jobfolio_session="));
  const response = await request("/api/profiles", { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  const { profiles } = await response.json();
  let applicationCount = 0;
  let checkedDocuments = 0;
  if (profiles.length) {
    const select = await request("/api/auth", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ action: "select", profileId: profiles[0].id }) });
    assert.equal(select.status, 200);
    cookie = select.headers.get("set-cookie").split(";")[0];
    const applicationResponse = await request("/api/applications", { headers: { Cookie: cookie } });
    assert.equal(applicationResponse.status, 200);
    const { applications } = await applicationResponse.json();
    applicationCount = applications.length;
    const item = applications.find(item => item.cvName || item.letterName);
    if (item) {
      const kind = item.cvName ? "cv" : "letter";
      const download = await request(`/api/documents/${encodeURIComponent(item.id)}/${kind}`, { headers: { Cookie: cookie } });
      assert.equal(download.status, 200);
      assert((await download.arrayBuffer()).byteLength > 0);
      checkedDocuments++;
    }
    const workspace = await request("/", { headers: { Cookie: cookie } });
    assert.equal(workspace.status, 200);
    assert((await workspace.text()).includes("Jobfolio"));
  }
  const logout = await request("/api/auth", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ action: "logout" }) });
  assert.equal(logout.status, 200);
  assert(logout.headers.get("set-cookie").includes("Max-Age=0"));
  console.log(JSON.stringify({ verified: true, profileCount: profiles.length, applicationCount, checkedDocuments, checks: "Anonymous PIN screen, API authorization, PIN login, profile selection, applications, documents, and logout" }));
} catch (error) {
  // Do not echo request data, cookies, or credentials.
  console.error(error instanceof Error ? error.message : "Live verification failed.");
  process.exitCode = 1;
}
