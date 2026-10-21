const PRODUCTION_PROJECT = "xyhuzdtpjlmtadqamywu";
const PRODUCTION_HOSTS = new Set(["turnits.com", "www.turnits.com", "negosocio.onrender.com", "turnits-web.onrender.com"]);
export function validateEnvironment(env = process.env) {
  if (env.APP_ENV !== "staging") return;
  const database = new URL(env.SUPABASE_URL || "http://invalid");
  if (database.protocol !== "https:" || database.hostname === `${PRODUCTION_PROJECT}.supabase.co` || !env.STAGING_SUPABASE_REF || database.hostname !== `${env.STAGING_SUPABASE_REF}.supabase.co`) throw new Error("Staging requires its own explicitly selected Supabase project.");
  for (const name of ["API_URL", "WEB_URL", "PANEL_URL", "SUCCESS_URL", "PENDING_URL", "ERROR_URL", "REPROGRAMAR_URL"]) {
    const url = new URL(env[name] || "http://invalid");
    if (url.protocol !== "https:" || PRODUCTION_HOSTS.has(url.hostname)) throw new Error(`Staging requires an isolated ${name}.`);
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error("Staging requires a separate strong session secret.");
  for (const key of ["APPS_SCRIPT_URL", "MP_PLATFORM_TOKEN", "MP_CLIENT_SECRET", "MP_TURNERO_PUBLIC_KEY", "META_ACCESS_TOKEN", "WHATSAPP_TOKEN", "VAPID_PRIVATE_KEY"]) if (env[key]) throw new Error(`External integration ${key} must remain disabled in staging.`);
}
export function stagingMiddleware(env = process.env) {
  return (req, res, next) => {
    if (env.APP_ENV !== "staging") return next();
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.setHeader("X-Turnits-Environment", "staging");
    const path = req.path || "";
    if (/^\/(mp(?:\/|$)|webhook(?:\/|$)|api\/(?:create-preference|card)|renovacion\/checkout|suscripcion\/.*\/pagar|empleado\/[^/]+\/mp\/)/.test(path)) return res.status(503).json({ success: false, error: "Entorno de pruebas: cobros y conexiones de pago reales deshabilitados." });
    next();
  };
}
