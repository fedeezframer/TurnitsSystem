const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(process.argv[2] || "api/server.js", "utf8");
const clone = value => JSON.parse(JSON.stringify(value));
const clock = Date.parse("2026-10-19T15:00:00Z");
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
}
const user = {
  slug: "fixture", business_name: "Negocio", nombre_persona: "Titular",
  apellido: "Prueba", activo: true, plan: "premium", horarios: {}, excepciones: [],
  duracion_turno: 30, estado_suscripcion: "activo", fecha_vencimiento: "2027-01-01",
};
const turn = (id, fecha, branch, extra = {}) => ({
  id, slug: "fixture", sucursal_id: branch, fecha, hora: "15:00:00",
  created_at: fecha + "T15:00:00Z", telefono: "cliente-" + id,
  nombre: "Cliente", servicio_id: "corte", servicio_nombre: "Corte", estado: "confirmado",
  precio_cobrado: 15000, monto_pagado: 500, pago_estado: "aprobado", fecha_pago: fecha,
  ...extra,
});
const fixtures = {
  usuarios: [user], servicios: [{ id: "corte", slug: "fixture", duracion: 45, activo: "true" }],
  referidos: [1, 2, 3].map(n => ({ grupo_nro: 1, referidor_slug: "fixture", premio_entregado_at: "2026-10-01" })),
  turnos: [
    turn(1, "2026-10-19", "north"),
    turn(2, "2026-10-20", "north", { telefono: "cliente-1", pago_estado: "sin_pago", monto_pagado: 0 }),
    turn(3, "2026-10-19", "north", { estado: "pendiente" }),
    turn(4, "2026-10-19", "north", { estado: "cancelado" }),
    turn(5, "2026-09-19", "north"), turn(6, "2026-09-20", "south"),
    turn(7, "2026-10-31", "south"), turn(8, "2026-10-12", "south"),
    turn(9, "2026-10-19", "south", { precio_cobrado: 900000 }),
    turn(10, "2026-09-30", "north"),
    turn(11, "2026-10-19", "north", { precio_cobrado: 10000, pago_estado: "rechazado" }),
  ],
};

async function harness({ branch = false, bulk = false, failure, missing = false, empty = false } = {}) {
  const db = clone(fixtures), logs = [], waiting = [];
  if (missing) db.usuarios = [];
  if (empty) { db.turnos = []; db.referidos = []; }
  if (bulk) db.turnos.push(...Array.from({ length: 1005 }, (_, n) => turn(n + 100, "2026-10-19", "north")));
  let wave = 0, handler, requireAuth = () => {}, responded = false;
  class Query {
    constructor(table, scoped = false) { this.table = table; this.scoped = scoped; this.filters = []; this.fields = "*"; this.orders = []; }
    select(fields, opts = {}) { this.fields = fields; this.opts = opts; return this; }
    eq(k, v) { this.filters.push(row => row[k] === v); return this; }
    neq(k, v) { this.filters.push(row => row[k] !== v); return this; }
    gte(k, v) { this.filters.push(row => row[k] >= v); return this; }
    lte(k, v) { this.filters.push(row => row[k] <= v); return this; }
    not(k, op, v) { assert.equal(op, "in"); const values = v.slice(1, -1).split(","); this.filters.push(row => !values.includes(row[k])); return this; }
    order(k, opts) { this.orders.push([k, opts?.ascending !== false ? 1 : -1]); return this; }
    range(start, end) { this.slice = [start, end + 1]; return this; }
    maybeSingle() { this.single = true; return this; }
    then(resolve, reject) {
      const log = { table: this.table, fields: this.fields, scoped: this.scoped, slice: this.slice, wave };
      logs.push(log);
      return new Promise(done => waiting.push(() => {
        const isFailure = failure === "unpaid" && this.fields === "precio_cobrado, fecha, email, telefono, estado" || failure === "range" && this.slice;
        if (isFailure) return done({ data: null, error: new Error("fixture read failed") });
        let data = db[this.table].filter(row => (!this.scoped || !branch || row.sucursal_id === "north" || this.table === "servicios") && this.filters.every(f => f(row)));
        const count = data.length;
        data.sort((a, b) => { for (const [k, direction] of this.orders) { if (a[k] !== b[k]) return (a[k] > b[k] ? 1 : -1) * direction; } return 0; });
        data = data.slice(...(this.slice || [0, 1000]));
        if (this.fields !== "*") data = data.map(row => Object.fromEntries(this.fields.split(",").map(k => [k.trim(), row[k.trim()]])));
        done({ data: this.single ? data[0] || null : this.opts?.head ? null : data, count, error: null });
      })).then(resolve, reject);
    }
  }
  const ctx = {
    Date: FixedDate, console: { error() {} }, requireAuth,
    app: { get(route, guard, callback) { assert.equal(route, "/admin-stats/:slug"); assert.equal(guard, requireAuth, "authorization middleware must remain installed"); handler = callback; } },
    supabase: { from: table => new Query(table) },
    branchPanel: { from: (req, table) => { assert.equal(!!req.sucursalAdmin, branch); return new Query(table, true); } },
    cleanSlug: s => String(s || "").trim().toLowerCase(), globalCache: {}, CACHE_DURATION: 20000,
    mediosOfflinePermitidos: () => true, diasHastaVencer: () => 74, precioMensualPlan: () => 100,
    REFERIDOS_GRUPO_SIZE: 3, LOGRO_FACTURACION_META_ARS: 600000,
    fechaISOValida: s => /^\d{4}-\d{2}-\d{2}$/.test(s),
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf("function generarRangoDias("), source.indexOf("// HELPER: ENVIAR MAIL DE TURNO")), ctx);
  const start = source.indexOf('app.get("/admin-stats/:slug"');
  vm.runInContext(source.slice(start, source.indexOf("// RENDIMIENTO POR INTEGRANTE", start)), ctx);
  const req = { params: { slug: "fixture" }, ...(branch ? { sucursalAdmin: { nombre: "Centro", id: "north" }, empleado: { nombre: "Admin", apellido: "Sucursal" } } : {}) };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = clone(body); responded = true; return this; } };
  const run = handler(req, res);
  // Resolve each round of independent database reads together. This counts
  // network round trips deterministically, without accessing Supabase.
  for (let limit = 0; !responded && limit < 100; limit++) {
    await new Promise(setImmediate);
    if (waiting.length) { wave++; waiting.splice(0).forEach(release => release()); }
  }
  await run;
  assert(responded);
  return { res, logs, waves: wave, handler, req, ctx };
}

(async () => {
  const owner = await harness();
  assert.equal(owner.res.code, 200);
  const data = owner.res.body;
  assert.equal(data.turnosMes, 6); assert.equal(data.turnosHoy, 3);
  assert.equal(data.turnosLista.length, 7, "pending appointments remain visible, canceled appointments excluded");
  const sinCobro = data.proximosDias.find(d => d.fecha === "2026-10-20");
  assert.equal(sinCobro.volumen, 15000);
  assert.equal(sinCobro.aprobado, 0);
  assert.equal(sinCobro.cantidad, 1);
  assert.equal(data.turnosHoyDetalle[0].duracion, undefined);
  assert.equal(data.turnosLista.find(t => t.id === 1).duracion, 45);
  assert.equal(data.turnosLista.find(t => t.id === 1).monto_pendiente_local, 14500);
  assert.equal(data.comparativas.mes.actual.turnos, 4);
  assert.equal(data.comparativas.mes.actual.ingresos, 940000);
  assert.equal(data.comparativas.mes.anterior.turnos, 1);
  assert.equal(data.comparativas.semana.actual.turnos, 4);
  assert.equal(data.diasConMasTurnos.reduce((sum, d) => sum + d.cantidad, 0), 6);
  assert.equal(data.logros.programaAfiliadosCompleto, true);
  assert.equal(data.logros.turnosHistoricos, 9);
  assert.equal(data.businessName, "Negocio");

  const branch = await harness({ branch: true });
  assert.equal(branch.res.code, 200);
  assert.equal(branch.res.body.businessName, "Negocio · Centro");
  assert.equal(branch.res.body.nombre_persona, "Admin");
  assert.equal(branch.res.body.turnosMes, 3);
  assert.equal(branch.res.body.comparativas.mes.actual.ingresos, 25000);
  assert.equal(branch.res.body.logros.programaAfiliadosCompleto, false);
  assert.equal(branch.logs.some(l => l.table === "referidos"), false);
  assert(branch.logs.filter(l => l.table === "turnos" || l.table === "servicios").every(l => l.scoped));
  assert.equal(Object.keys(branch.ctx.globalCache).length, 0, "branch response never enters owner cache");

  const bulk = await harness({ bulk: true });
  assert.equal(bulk.res.body.comparativas.mes.actual.turnos, 1009, "comparisons read every page");
  assert.equal(bulk.res.body.diasConMasTurnos.reduce((sum, d) => sum + d.cantidad, 0), 1011);
  assert(bulk.logs.some(l => l.slice?.[0] === 1000), "second page must be read");
  const empty = await harness({ empty: true });
  assert.equal(empty.res.body.turnosMes, 0); assert.deepEqual(empty.res.body.diasConMasTurnos, []);
  for (const failure of ["unpaid", "range"]) assert.equal((await harness({ failure })).res.code, 500);
  const missing = await harness({ missing: true });
  assert.equal(missing.res.code, 404); assert.equal(missing.logs.length, 1);
  const count = owner.logs.length;
  await owner.handler(owner.req, { json(body) { assert.deepEqual(clone(body), data); } });
  assert.equal(owner.logs.length, count, "existing 20-second owner cache still works");
  if (!process.argv[2]) {
    assert.equal(owner.waves, 2, "user read followed by one batch of independent reads");
    assert.equal(bulk.waves, 3, "only pagination adds a third network round trip");
  }
  const snapshot = { owner: data, branch: branch.res.body, bulk: bulk.res.body, empty: empty.res.body };
  if (process.env.DASHBOARD_SNAPSHOT) fs.writeFileSync(process.env.DASHBOARD_SNAPSHOT, JSON.stringify(snapshot));
  if (process.env.DASHBOARD_BASELINE) assert.deepEqual(snapshot, JSON.parse(fs.readFileSync(process.env.DASHBOARD_BASELINE, "utf8")), "all response fields match the pre-optimization implementation");
  console.log(JSON.stringify({ pass: true, ownerReadRounds: owner.waves, paginatedReadRounds: bulk.waves, queries: count, checks: "metrics, payments, historical clients, rankings, future/pending appointments, pagination, branch isolation, errors, owner cache" }));
})().catch(error => { console.error(error); process.exitCode = 1; });
