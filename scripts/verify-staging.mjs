import fs from "node:fs";
import assert from "node:assert/strict";
const credentials = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (credentials.site !== "https://turnits-test-api.onrender.com") throw new Error("This smoke test only runs against the isolated staging site.");
async function api(path, token, body) {
  const response = await fetch(credentials.site + path, { method: body ? "POST" : "GET", headers: { ...(token ? { Authorization: "Bearer " + token } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`${path}: ${response.status} ${data.error || "invalid response"}`);
  return data;
}
const client = await api("/login", null, { email: credentials.consumer_email, password: credentials.consumer_password, tipo_cuenta: "usuario" });
const owner = await api("/login", null, { email: credentials.owner_email, password: credentials.owner_password, tipo_cuenta: "negocio" });
const clientToken = client.token || client.access_token, ownerToken = owner.token || owner.access_token;
assert(clientToken && ownerToken);
const catalog = await api("/browse/catalogo", clientToken);
assert(catalog.servicios.some(service => service.id === credentials.quote_service && service.negocio.modo_agenda === "presupuesto"));
const request = await api("/browse/consultas", clientToken, { servicio_id: credentials.quote_service });
await api(`/browse/consultas/${request.id}/mensajes`, clientToken, { texto: "Consulta de prueba: diseño pequeño en blanco y negro." });
await api(`/admin/consultas/${request.id}/mensajes`, ownerToken, { texto: "Respuesta de prueba del estudio. Coordinamos el diseño y el horario." });
let conversation = await api(`/browse/consultas/${request.id}`, clientToken);
let quote = conversation.presupuestos.find(item => item.estado === "reservado");
if (!quote) {
  const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const slots = await api(`/slots-disponibles/tatuajes-demo?${new URLSearchParams({ fecha: day, servicio_id: credentials.quote_service, equipo_id: credentials.quote_member })}`);
  const slot = slots.slots.find(item => !item.lleno && item.hora < "18:00");
  assert(slot, "test artist has available slots");
  const offered = await api(`/admin/consultas/${request.id}/presupuestos`, ownerToken, { detalle: "Diseño de prueba. Sin cobros reales.", total: 20000, sena: 5000, equipo_id: credentials.quote_member, fecha: day, hora: slot.hora, duracion: 60, vence_at: new Date(Date.now() + 86400000).toISOString() });
  quote = offered.presupuesto;
  await api(`/browse/consultas/${request.id}/aceptar`, clientToken, { presupuesto_id: quote.id });
  const booked = await api(`/admin/consultas/${request.id}/reservar`, ownerToken, { presupuesto_id: quote.id });
  const retry = await api(`/admin/consultas/${request.id}/reservar`, ownerToken, { presupuesto_id: quote.id });
  assert.equal(retry.turno_id, booked.turno_id);
}
conversation = await api(`/browse/consultas/${request.id}`, clientToken);
assert.equal(conversation.consulta.estado, "reservada");
const disabled = await fetch(credentials.site + "/api/create-preference", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
assert.equal(disabled.status, 503);
console.log(JSON.stringify({ success: true, environment: "staging", checks: ["consumer login", "owner login", "quote catalog", "private messages", "quote proposal", "client acceptance", "manual reservation", "idempotency", "real payments disabled"], consultation: request.id }));
