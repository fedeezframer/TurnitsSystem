const assert = require("node:assert/strict");
(async () => {
  const { validateQuote, resolveQuoteProducts, referenceType, validateReferenceText, createQuoteBooking } = await import("../api/quote-booking.js");
  const now = Date.parse("2026-10-21T12:00:00Z");
  const quote = { detalle: "Diseño personalizado de 10 cm", total: 10000, sena: 3000, duracion: 120, equipo_id: "00000000-0000-4000-8000-000000000001", fecha: "2026-10-24", hora: "15:00", vence_at: "2026-10-23T12:00:00Z" };
  assert.equal(validateQuote(quote, now).total, 10000);
  const included = [{ id: "00000000-0000-4000-8000-000000000002", nombre: "Aftercare", cantidad: 2, precio_unitario: 500, precio: 1000 }];
  const withProducts = validateQuote({ ...quote, total: 9000, servicio: "Tatuaje", detalle: "Trabajo personalizado" }, now, included);
  assert.equal(withProducts.total, 10000);
  assert.match(withProducts.detalle, /\[productos:/);
  for (const change of [{ total: -1 }, { sena: 10001 }, { total: "NaN" }, { duracion: 0 }, { duracion: 800 }, { hora: "23:30" }, { equipo_id: "other" }, { fecha: "2026-99-99" }, { fecha: "2026-02-30" }, { vence_at: "2026-10-25T12:00:00Z" }, { detalle: " " }]) assert.throws(() => validateQuote({ ...quote, ...change }, now));
  const productTables = {
    servicio_extras: [{ servicio_id: "service", extra_id: included[0].id }],
    extras: [{ id: included[0].id, slug: "shop", activo: true, nombre: "Aftercare", precio: 500, owner_equipo_id: quote.equipo_id }],
  };
  const productSupabase = { from: table => {
    const filters = [];
    const query = { select: () => query, eq: (key, value) => { filters.push([key, value]); return query; }, in: (key, values) => { filters.push([key, values]); return query; }, then: resolve => resolve({ data: productTables[table].filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value)) }) };
    return query;
  } };
  assert.deepEqual(await resolveQuoteProducts(productSupabase, { servicio_id: "service", slug: "shop" }, [{ id: included[0].id, cantidad: 2 }], quote.equipo_id), included);
  await assert.rejects(resolveQuoteProducts(productSupabase, { servicio_id: "service", slug: "shop" }, [{ id: included[0].id, cantidad: 2 }], "00000000-0000-4000-8000-000000000003"));
  assert.equal(referenceType(Buffer.from("<svg onload=alert(1)>")), null);
  assert.equal(referenceType(Buffer.from([255,216,255,0])).mime, "image/jpeg");
  assert.equal(referenceType(Buffer.from([137,80,78,71,13,10,26,10])).mime, "image/png");
  assert.equal(validateReferenceText("  Mirá esta idea  "), "Mirá esta idea");
  assert.equal(validateReferenceText(undefined), "");
  assert.throws(() => validateReferenceText("x".repeat(3001)));
  assert.throws(() => validateReferenceText(["Texto", "duplicado"]));
  const routes = new Map();
  const app = Object.fromEntries(["get", "post"].map(method => [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers)]));
  const queried = [];
  const consultation = { id: quote.equipo_id, consumidor_id: "consumer-one", slug: "tattoo-one", estado: "abierta" };
  let found = true;
  const supabase = { from: table => {
    const filters = [];
    const query = { select: () => query, eq: (key, value) => { filters.push([key, value]); return query; }, maybeSingle: async () => { queried.push({ table, filters }); return { data: found ? consultation : null }; }, insert: async row => { queried.push({ table, row }); return { data: null }; } };
    return query;
  } };
  const next = (_req, _res, done) => done();
  const make = enabled => { routes.clear(); createQuoteBooking({ app, supabase, consumerAuth: next, requireAuth: next, limiter: next, enabled, multer: Object.assign(() => ({ single: () => next }), { memoryStorage: () => ({}) }) }); };
  const call = async (path, req) => {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    const handlers = routes.get("post " + path);
    const run = async index => { if (handlers[index]) await handlers[index](req, res, () => run(index + 1)); };
    await run(0); return res;
  };
  const request = { params: { id: consultation.id }, consumer: { id: "consumer-one" }, auth: { slug: "tattoo-one", rol: "owner" }, body: { texto: "Hola", autor: "negocio", consumidor_id: "victim" } };
  make(false);
  assert.equal((await call("/browse/consultas/:id/mensajes", request)).statusCode, 404);
  assert.equal(queried.length, 0);
  make(true);
  consultation.modo_agenda = "presupuesto";
  const guarded = await call("/turnos/reservar,/turnos/reservar-manual,/api/create-preference", { body: { slug: "Táttoo One" } });
  assert.equal(guarded.statusCode, 409);
  assert.deepEqual(queried.at(-1).filters, [["slug", "tattoo-one"]]);
  queried.length = 0;
  assert.equal((await call("/browse/consultas/:id/mensajes", request)).statusCode, 200);
  assert.deepEqual(queried[0].filters, [["id", consultation.id], ["consumidor_id", "consumer-one"]]);
  assert.equal(queried[1].row.autor, "cliente", "message authors cannot be forged");
  queried.length = 0;
  assert.equal((await call("/admin/consultas/:id/mensajes", request)).statusCode, 200);
  assert.deepEqual(queried[0].filters, [["id", consultation.id], ["slug", "tattoo-one"]]);
  assert.equal((await call("/admin/consultas/:id/mensajes", { ...request, empleado: {} })).statusCode, 403);
  found = false;
  assert.equal((await call("/browse/consultas/:id/mensajes", request)).statusCode, 404);
  console.log("PASS quote booking: linked product validation and totals, feature gate, participant isolation, server-bound authors, owner restrictions, price/date validation and image signatures.");
})().catch(error => { console.error(error); process.exitCode = 1; });
