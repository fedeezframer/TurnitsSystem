const assert = require("node:assert/strict");
const crypto = require("node:crypto");
(async () => {
  const { verifyQuoteWebhook, createQuotePayments } = await import("../api/quote-payments.js");
  const now = Date.now(), secret = "fixture-secret", timestamp = String(now), request = "request-one";
  const digest = crypto.createHmac("sha256", secret).update(`id:123;request-id:${request};ts:${timestamp};`).digest("hex");
  const headers = { "x-signature": `ts=${timestamp},v1=${digest}`, "x-request-id": request };
  assert(verifyQuoteWebhook(headers, "123", secret, now));
  assert(!verifyQuoteWebhook(headers, "124", secret, now));
  assert(!verifyQuoteWebhook(headers, "123", "", now));
  assert(!verifyQuoteWebhook(headers, "123", secret, now + 700000));
  let refunds = 0, blocked = false, rpcCalls = 0;
  const payment = { id: "123", collector_id: "seller", external_reference: "checkout", status: "approved", currency_id: "ARS", transaction_amount: 5000 };
  const records = {
    consulta_checkouts: [{ id: "checkout", presupuesto_id: "quote", importe: 5000, vendedor_id: "seller" }],
    consulta_presupuestos: [{ id: "quote", consulta_id: "thread", equipo_id: "member", estado: "aceptado", fecha: "2027-01-01", hora: "15:00", duracion: 60 }],
    consultas: [{ id: "thread", slug: "tattoo", servicio_id: "service" }],
    consulta_pagos: [{ payment_id: "123", checkout_id: "checkout", estado: "reintegro_pendiente", intentos: 0 }],
  };
  const supabase = { from: table => {
    const filters = []; let update;
    const rows = () => records[table].filter(row => filters.every(([key, value]) => row[key] === value));
    const query = { select: () => query, eq: (key, value) => { filters.push([key, value]); return query; }, update: value => { update = value; return query; }, single: async () => ({ data: rows()[0] }), maybeSingle: async () => ({ data: rows()[0] }), then: (resolve, reject) => Promise.resolve().then(() => { if (update) rows().forEach(row => Object.assign(row, update)); return { data: rows() }; }).then(resolve, reject) };
    return query;
  }, rpc: async (_name, args) => { rpcCalls++; assert.equal(args.p_disponible, false); return { data: records.consulta_pagos[0] }; } };
  const gateway = { context: async () => ({}), payment: async () => payment, refund: async (_ctx, id, key) => { refunds++; assert.equal(id, "123"); assert.equal(key, "quote-refund-123"); if (blocked) throw Error("Provider unavailable"); return { id: "refund", status: "approved" }; } };
  const service = createQuotePayments({ supabase, context: async () => ({}), available: async () => { throw Object.assign(Error("Occupied"), { status: 409 }); }, gateway, enabled: true });
  blocked = true;
  await assert.rejects(service.process("checkout", "123"));
  assert.equal(records.consulta_pagos[0].estado, "reintegro_pendiente");
  assert.equal(records.consulta_pagos[0].intentos, 1);
  blocked = false;
  await service.process("checkout", "123");
  assert.equal(records.consulta_pagos[0].estado, "reintegrado");
  assert.equal(refunds, 2);
  payment.collector_id = "attacker";
  await assert.rejects(service.process("checkout", "123"));
  assert.equal(rpcCalls, 2, "unverified seller cannot reach reservation or refund");
  const disabled = createQuotePayments({ enabled: false });
  await assert.rejects(disabled.process("checkout", "123"));
  const calculations = createQuotePayments({ enabled: true, context: async () => ({}), gateway: { canPay: () => true } });
  const consultation = { estado: "abierta" }, quote = { estado: "aceptado", vence_at: new Date(Date.now() + 60000).toISOString(), total: 10000, sena: 0 };
  const deposit = await calculations.info(consultation, quote, { config: { metodo_pago: "sena", porcentaje_sena: 30 } });
  assert.equal(deposit.importe, 3000); assert.equal(deposit.saldo, 7000);
  const fixedDeposit = await calculations.info(consultation, { ...quote, sena: 2500 }, { config: { metodo_pago: "sena", porcentaje_sena: 30 } });
  assert.equal(fixedDeposit.importe, 2500); assert.equal(fixedDeposit.saldo, 7500);
  const total = await calculations.info(consultation, { ...quote, sena: 2500 }, { config: { metodo_pago: "total", porcentaje_sena: 30 } });
  assert.equal(total.importe, 10000); assert.equal(total.saldo, 0);
  console.log("PASS quote payments: signed notifications, seller binding, refunds, deposit/full amounts and disabled gateway.");
})().catch(error => { console.error(error); process.exitCode = 1; });
