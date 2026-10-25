import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createReceiptAccess } from "./receipt-access.js";
import { allowedOrigins, originGuard, securityHeaders } from "./http-security.js";
import { validNewPassword } from "../web/src/shared/password-policy.js";

const secret = "test-only-secret-that-is-not-used-outside-this-process";
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const tables = {
  turnos: [
    { id: first, slug: "test-a", consumidor_id: "alice", payment_id: "100", nombre: "Test", email: "fixture@example.invalid", telefono: "123456789", precio_cobrado: 100, monto_pagado: 25 },
    { id: second, slug: "test-a", consumidor_id: "bob", payment_id: "200", precio_cobrado: 200, monto_pagado: 200 },
    { id: other, slug: "test-b", consumidor_id: "bob", payment_id: "300" },
  ],
  pagos_pendientes: [
    { id: "pending-a", slug: "test-a", payment_id: "100" },
    { id: "pending-offer", slug: "test-a", browse_turno_id: first },
    { id: "pending-unpaid", slug: "test-a" },
  ],
  usuarios: [{ id: "owner-a", slug: "test-a", activo: true }, { id: "disabled-owner", slug: "disabled", activo: false }],
};
let queryCount = 0;
const supabase = { from(table) {
  const filters = []; let columns;
  return {
    select(value) { columns = value.split(","); return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    async maybeSingle() {
      queryCount++;
      const row = tables[table].find(item => filters.every(([key, value]) => item[key] === value));
      return { data: row ? Object.fromEntries(columns.filter(key => key in row).map(key => [key, row[key]])) : null, error: null };
    },
  };
} };
const receipt = createReceiptAccess({ secret, supabase, consumerAccounts: {
  async findById(id) { return { id, activo: id !== "disabled", email_verificado: true }; },
} });
const session = claims => jwt.sign(claims, secret, { algorithm: "HS256", expiresIn: "1h" });
const alice = session({ rol: "consumidor", consumidorId: "alice" });
const bob = session({ rol: "consumidor", consumidorId: "bob" });
const owner = session({ rol: "owner", slug: "test-a", negocioId: "owner-a" });
const path = id => `/turnos/publico/${id}?slug=test-a`;
let server, base;
before(async () => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(originGuard(allowedOrigins({ NODE_ENV: "production" })));
  app.use(cors({ origin: (origin, cb) => cb(null, origin || false), allowedHeaders: ["Authorization", "x-receipt-token"] }));
  app.get("/turnos/publico/:id", receipt.handler());
  app.get("/turnos/by-payment", receipt.handler(true));
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
const request = (url, token, extra = {}) => fetch(base + url, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra } });

test("anonymous receipt and payment lookup fail before querying any booking", async () => {
  const count = queryCount;
  for (const url of [path(first), "/turnos/by-payment?slug=test-a&payment_id=100"]) assert.equal((await request(url)).status, 401);
  assert.equal(queryCount, count);
});
test("invalid, expired and session tokens cannot act as receipt capabilities", async () => {
  const expired = jwt.sign({ slug: "test-a", turnoId: first }, secret + ":receipt", { audience: "turnits-receipt", expiresIn: -1 });
  for (const token of ["invalid", expired, alice]) assert.equal((await request(path(first), null, { "x-receipt-token": token })).status, 401);
});
test("receipt capability reads exactly its booking and omits contact data", async () => {
  const token = receipt.issue({ slug: "test-a", turnoId: first });
  const response = await request(path(first), null, { "x-receipt-token": token });
  assert.equal(response.status, 200);
  const { turno } = await response.json();
  assert.equal(turno.id, first); assert.equal(turno.monto_pendiente_local, 75);
  for (const key of ["email", "telefono", "consumidor_id", "payment_id", "gestion_token"]) assert.equal(key in turno, false);
  assert.equal((await request(path(second), null, { "x-receipt-token": token })).status, 404);
  assert.equal((await request(`/turnos/publico/${other}?slug=test-b`, null, { "x-receipt-token": token })).status, 403);
  assert.throws(() => jwt.verify(token, secret));
});
test("signed payment return cannot be reused for another payment", async () => {
  const token = receipt.issue({ slug: "test-a", pendingId: "pending-a" });
  assert.equal((await request("/turnos/by-payment?slug=test-a&payment_id=100", null, { "x-receipt-token": token })).status, 200);
  assert.equal((await request("/turnos/by-payment?slug=test-a&payment_id=200", null, { "x-receipt-token": token })).status, 404);
  assert.equal((await request(path(second), null, { "x-receipt-token": token })).status, 404);
});
test("offer return is bound to the preexisting booking and unpaid returns disclose nothing", async () => {
  const token = receipt.issue({ slug: "test-a", pendingId: "pending-offer" });
  assert.equal((await request(path(first), null, { "x-receipt-token": token })).status, 200);
  const unpaid = receipt.issue({ slug: "test-a", pendingId: "pending-unpaid" });
  assert.equal((await request(path(first), null, { "x-receipt-token": unpaid })).status, 404);
});
test("consumer can read only their own booking, including payment lookup", async () => {
  assert.equal((await request(path(first), alice)).status, 200);
  assert.equal((await request(path(first), bob)).status, 404);
  assert.equal((await request(path(second), alice)).status, 404);
  assert.equal((await request("/turnos/by-payment?slug=test-a&payment_id=200", alice)).status, 404);
});
test("owner is scoped to a business and inactive identities are denied", async () => {
  assert.equal((await request(path(second), owner)).status, 200);
  assert.equal((await request(`/turnos/publico/${other}?slug=test-b`, owner)).status, 403);
  for (const token of [session({ rol: "consumidor", consumidorId: "disabled" }), session({ rol: "owner", slug: "disabled", negocioId: "disabled-owner" }), session({ rol: "empleado", slug: "test-a" })]) assert.equal((await request(path(first), token)).status, 401);
});
test("tampering with the signed role cannot authorize a receipt", async () => {
  const parts = alice.split(".");
  parts[1] = Buffer.from(JSON.stringify({ rol: "owner", slug: "test-a", negocioId: "owner-a" })).toString("base64url");
  assert.equal((await request(path(first), parts.join("."))).status, 401);
});
test("link generation preserves scope and payment provider query additions", async () => {
  for (const scope of [{ slug: "test-a", turnoId: first }, { slug: "test-a", pendingId: "pending-a" }]) {
    const value = new URL(receipt.url("https://turnits.com/success?existing=1", scope));
    assert.equal(value.searchParams.get("existing"), "1");
    value.searchParams.set("payment_id", "100");
    const payload = jwt.verify(value.searchParams.get("receipt_token"), secret + ":receipt", { audience: "turnits-receipt", algorithms: ["HS256"] });
    assert.equal(payload.slug, scope.slug); assert.equal(payload.turnoId || payload.pendingId, scope.turnoId || scope.pendingId);
    assert.equal(payload.exp - payload.iat, 30 * 86400);
  }
});
test("untrusted browser origins are denied, permitted preflights have a narrow origin", async () => {
  assert.equal((await request(path(first), alice, { Origin: "https://untrusted.invalid" })).status, 403);
  const response = await fetch(base + path(first), { method: "OPTIONS", headers: { Origin: "https://turnits.com", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-receipt-token" } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://turnits.com");
});
test("origin configuration includes staging and explicit widget origins without enabling dev in production", () => {
  const origins = allowedOrigins({ NODE_ENV: "production", API_URL: "https://staging.invalid", WEB_URL: "https://staging.invalid/app", PUBLIC_WIDGET_ORIGINS: "https://widget.invalid" });
  assert.equal(origins.has("https://staging.invalid"), true);
  assert.equal(origins.has("https://widget.invalid"), true);
  assert.equal(origins.has("http://localhost:5173"), false);
});
test("security headers also protect rejected requests and HTTPS enables bounded HSTS", async () => {
  const response = await request(path(first), null, { "X-Forwarded-Proto": "https" });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=86400");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("new passwords require 12 characters and respect bcrypt's UTF-8 byte limit", () => {
  for (const value of [undefined, {}, "123456", "12345678901", "a".repeat(73), "é".repeat(37)]) assert.equal(validNewPassword(value), false);
  for (const value of ["a new passphrase", "a".repeat(72), "é".repeat(36)]) assert.equal(validNewPassword(value), true);
});
