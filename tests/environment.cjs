const assert = require("node:assert/strict");
(async () => {
  const { validateEnvironment, stagingMiddleware } = await import("../api/environment.js");
  const web = "https://turnits-test-api.onrender.com";
  const env = { APP_ENV: "staging", STAGING_SUPABASE_REF: "glqflwmrxnavkdegjcdm", SUPABASE_URL: "https://glqflwmrxnavkdegjcdm.supabase.co", JWT_SECRET: "fixture-only-session-secret-not-a-real-key", API_URL: web, WEB_URL: web, PANEL_URL: web + "/panel", SUCCESS_URL: web + "/success", PENDING_URL: web + "/pendiente", ERROR_URL: web + "/error", REPROGRAMAR_URL: web + "/reprogramar" };
  validateEnvironment(env);
  assert.throws(() => validateEnvironment({ ...env, SUPABASE_URL: "https://xyhuzdtpjlmtadqamywu.supabase.co" }));
  assert.throws(() => validateEnvironment({ ...env, API_URL: "https://negosocio.onrender.com" }));
  assert.throws(() => validateEnvironment({ ...env, SUCCESS_URL: "https://turnits.com/success" }));
  assert.throws(() => validateEnvironment({ ...env, MP_PLATFORM_TOKEN: "fixture-disabled" }));
  assert.throws(() => validateEnvironment({ ...env, APPS_SCRIPT_URL: "https://example.invalid" }));
  const middleware = stagingMiddleware(env);
  for (const path of ["/api/create-preference", "/api/card-config", "/mp/connect/test", "/webhook/mp", "/empleado/test/mp/connect", "/suscripcion/test/compra/id/pagar"]) {
    let next = false;
    const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json() {} };
    middleware({ path }, res, () => { next = true; });
    assert.equal(res.code, 503, path); assert.equal(next, false);
  }
  let normal = false; stagingMiddleware({})({}, {}, () => { normal = true; }); assert(normal);
  console.log("PASS staging: separate project, isolated redirects, separate JWT, integrations blocked and production unchanged.");
})().catch(error => { console.error(error); process.exitCode = 1; });
