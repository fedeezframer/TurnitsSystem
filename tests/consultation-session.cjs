const assert = require("node:assert/strict");
(async () => {
  const { storedSessionToken, isBusinessSession, safeMessagesReturn } = await import("../web/src/shared/consultation-session.js");
  const storage = values => ({ getItem: key => values[key] || null });
  assert.equal(storedSessionToken(storage({ user_token: "business-token" })), "business-token");
  assert.equal(storedSessionToken(storage({ account_type: "usuario", access_token: "consumer-token" })), "consumer-token");
  assert.equal(isBusinessSession(storage({ account_type: "negocio" })), true);
  assert.equal(isBusinessSession(storage({ user_slug: "tattoo-studio" })), true);
  assert.equal(isBusinessSession(storage({ account_type: "usuario", user_slug: "stale-slug" })), false);
  assert.equal(safeMessagesReturn("/consultas?id=thread-1", "https://turnits-web.onrender.com"), "/consultas?id=thread-1");
  assert.equal(safeMessagesReturn("/browse?vista=mensajes&servicio_id=service-1", "https://turnits-web.onrender.com"), "/browse?vista=mensajes&servicio_id=service-1");
  assert.equal(safeMessagesReturn("//attacker.example/consultas", "https://turnits-web.onrender.com"), "");
  assert.equal(safeMessagesReturn("https://attacker.example/consultas", "https://turnits-web.onrender.com"), "");
  assert.equal(safeMessagesReturn("/browse?vista=perfil", "https://turnits-web.onrender.com"), "");
  assert.equal(safeMessagesReturn("/panel", "https://turnits-web.onrender.com"), "");
  console.log("PASS consultation session: legacy tokens, provider role recovery and same-origin chat return.");
})().catch(error => { console.error(error); process.exitCode = 1; });
