// Enforce directives that do not affect legitimate scripts, maps or payments.
// The frontend build adds a script policy with hashes for its inline bootstrap.
export const browserPolicy = "base-uri 'self'; object-src 'none'; frame-ancestors 'none'";
export function securityHeaders(req, res, next) {
  res.set({
    "Content-Security-Policy": browserPolicy,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=()",
  });
  // Behind Render's trusted proxy req.secure reflects forwarded HTTPS.
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=86400");
  next();
}
export function allowedOrigins(env = process.env) {
  const origins = new Set(["https://turnits.com", "https://www.turnits.com", "https://turnits-web.onrender.com"]);
  for (const value of [env.WEB_URL, env.PANEL_URL, env.API_URL,
    ...(env.PANEL_ORIGINS || "").split(","), ...(env.PUBLIC_WIDGET_ORIGINS || "").split(",")]) {
    if (!value?.trim()) continue;
    origins.add(new URL(value.trim()).origin);
  }
  if (env.NODE_ENV === "development" && env.APP_ENV !== "staging") {
    for (const host of ["localhost", "127.0.0.1"]) for (const port of [5173, 3000]) origins.add(`http://${host}:${port}`);
  }
  return origins;
}
export function originGuard(origins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || origins.has(origin)) return next();
    res.status(403).json({ success: false, error: "Origen no permitido." });
  };
}
