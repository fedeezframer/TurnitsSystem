const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const ts = require("../web/node_modules/typescript");
const compiled = ts.transpileModule(fs.readFileSync("web/src/shared/session-startup.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const token = claims => "e30." + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })).toString("base64url") + ".fixture";
const owner = token({ slug: "negocio", rol: "owner", iat: 1 });
function setup(pathname = "/app", stored = { access_token: owner }) {
  const calls = [], timers = [], storage = new Map(Object.entries(stored));
  const ctx = {
    exports: {}, window: {}, location: { pathname, href: "https://turnits.test" + pathname },
    localStorage: { getItem: key => storage.get(key) || null }, TextDecoder, Uint8Array, atob, AbortController,
    setTimeout: callback => (timers.push(callback), timers.length), clearTimeout: id => { timers[id - 1] = null; },
    fetch: (url, init) => new Promise((resolve, reject) => { calls.push({ url, init, resolve, reject }); init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))); }),
  };
  vm.createContext(ctx); vm.runInContext(compiled, ctx);
  const runHtml = html => vm.runInContext(html.slice(8, -9), ctx);
  return { ctx, calls, timers, storage, api: ctx.exports, runHtml };
}
(async () => {
  for (const path of ["/app", "/app/", "/APP"]) {
    const s = setup(path);
    s.runHtml(s.api.sessionStartupHtml("https://api.test"));
    assert.equal(s.calls.length, 1, "validation starts directly in HTML");
    assert.equal(s.calls[0].url, "https://api.test/verify-session");
    assert.equal(s.calls[0].init.headers.Authorization, "Bearer " + owner);
    assert.equal(s.calls[0].init.cache, "no-store");
    const result = s.api.takeStartupVerification(s.api.selectStoredSession(), "https://api.test");
    assert.equal(s.calls.length, 1, "React reuses exactly the HTML request");
    assert.equal(s.ctx.window.__turnitsSessionStartup, undefined, "handoff consumed, no completed response cache");
    s.calls[0].resolve(Response.json({ active: true, slug: "canonical" }));
    assert.equal((await result).data.slug, "canonical"); assert(s.timers.every(timer => timer === null));
    const again = s.api.takeStartupVerification(s.api.selectStoredSession(), "https://api.test");
    assert.equal(s.calls.length, 2, "later /app entry always validates freshly");
    s.calls[1].resolve(Response.json({ active: false }, { status: 401 }));
    assert.equal((await again).ok, false);
  }
  for (const [path, stored] of [
    ["/panel/negocio", { access_token: owner }], ["/browse", { access_token: owner }],
    ["/login", { access_token: owner }], ["/app", {}], ["/app", { access_token: "invalid" }],
    ["/app", { access_token: token({ slug: "negocio", exp: 1 }) }],
  ]) {
    const s = setup(path, stored); s.runHtml(s.api.sessionStartupHtml("https://api.test"));
    assert.equal(s.calls.length, 0, "public/direct routes, missing and expired sessions do not start an HTML request");
  }
  const consumer = token({ rol: "consumidor", consumidorId: "user", iat: 3 });
  const latest = setup("/app", { access_token: owner, user_token: consumer });
  assert.equal(latest.api.selectStoredSession().token, consumer, "newest valid session wins across legacy keys");
  latest.runHtml(latest.api.sessionStartupHtml("https://api.test"));
  assert.equal(latest.ctx.window.__turnitsSessionStartup.role, "consumidor");
  const links = [];
  latest.ctx.URL = URL;
  latest.ctx.document = { querySelectorAll: () => [{ href: "https://turnits.test/shared.js" }], createElement: () => ({}), head: { appendChild: link => links.push(link) } };
  latest.runHtml(latest.api.sessionPreloadHtml({ panel: ["/owner.js"], browse: ["/shared.js", "/browse.js"] }));
  assert.equal(links.length, 1); assert.equal(links[0].href, "/browse.js"); assert.equal(links[0].rel, "modulepreload");
  assert.equal(latest.calls.length, 1, "speculative code preload makes no private-data request");
  latest.calls[0].resolve(Response.json({ active: true, rol: "consumidor" }));
  await latest.ctx.window.__turnitsSessionStartup.request;

  for (const change of ["account", "api"]) {
    const s = setup(); s.runHtml(s.api.sessionStartupHtml("https://api.test"));
    if (change === "account") s.storage.set("access_token", consumer);
    const taken = s.api.takeStartupVerification(s.api.selectStoredSession(), change === "api" ? "/api" : "https://api.test");
    assert.equal(s.calls.length, 2, "different account/API must not consume old validation");
    s.calls.forEach(call => call.resolve(Response.json({ active: true })));
    await taken;
  }
  const slow = setup();
  const timeout = slow.api.verifyStoredSession("/api", owner);
  slow.timers[0](); await assert.rejects(timeout, { name: "AbortError" });
  assert(slow.timers.every(timer => timer === null));
  const network = setup(); network.runHtml(network.api.sessionStartupHtml("/api"));
  network.calls[0].reject(new Error("offline"));
  await new Promise(setImmediate); // rejection is already handled before React loads
  await assert.rejects(network.api.takeStartupVerification(network.api.selectStoredSession(), "/api"), /offline/);
  const loggedOut = setup(); loggedOut.runHtml(loggedOut.api.sessionStartupHtml("/api"));
  loggedOut.storage.clear(); loggedOut.api.clearStartupVerification();
  assert.equal(loggedOut.ctx.window.__turnitsSessionStartup, undefined, "logout during initial download discards the old handoff");
  loggedOut.calls[0].resolve(Response.json({ active: true }));
  console.log("PASS early session: HTML validation, one-use request handoff, fresh later checks, account/API isolation, latest JWT, consumers, absent/expired tokens, route-specific code preload, timeout and early network errors. No external requests.");
})().catch(error => { console.error(error); process.exitCode = 1; });
