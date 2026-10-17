const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  crypto = require("node:crypto"),
  ts = require("../web/node_modules/typescript");
const src = fs.readFileSync(
    require("node:path").join(__dirname, "../api/server.js"),
    "utf8",
  ),
  ast = ts.createSourceFile("server.js", src, ts.ScriptTarget.Latest, true);
const consumer = crypto.randomUUID(),
  id = crypto.randomUUID();
const turn = {
  id,
  slug: "fixture",
  consumidor_id: consumer,
  browse_tipo: "offer",
  estado: "pendiente",
  pago_estado: "pendiente",
  precio_cobrado: 12000,
  monto_pagado: 0,
  fecha: "2027-01-01",
  hora: "15:00",
  servicio_nombre: "Corte",
  nombre: "Ana",
  email: "ana@example.test",
  browse_cierre: new Date(Date.now() + 30 * 60000).toISOString(),
};
const tables = {
  turnos: [turn],
  usuarios: [{ slug: "fixture", email: "owner@example.test" }],
  pagos_pendientes: [],
};
const updates = [],
  preferences = [],
  mails = [],
  notifications = [];
class Q {
  constructor(t) {
    this.t = t;
    this.filters = [];
    this.cols = "*";
  }
  select(c = "*") {
    this.cols = c;
    return this;
  }
  eq(k, v) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  single() {
    return this.maybeSingle();
  }
  insert(v) {
    this.op = "insert";
    this.value = v;
    return this;
  }
  update(v) {
    this.op = "update";
    this.value = v;
    return this;
  }
  then(ok, bad) {
    return Promise.resolve()
      .then(() => {
        let rows = tables[this.t].filter((r) =>
          this.filters.every((f) => f(r)),
        );
        if (this.op === "insert") {
          const r = { id: crypto.randomUUID(), ...this.value };
          tables[this.t].push(r);
          rows = [r];
        }
        if (this.op === "update") {
          rows.forEach((r) => Object.assign(r, this.value));
          updates.push(this.value);
        }
        const data = rows.map((r) =>
          this.cols === "*"
            ? { ...r }
            : Object.fromEntries(this.cols.split(",").map((k) => [k, r[k]])),
        );
        return { data: this.one ? data[0] || null : data, error: null };
      })
      .then(ok, bad);
  }
}
const context = vm.createContext({
  supabase: { from: (t) => new Q(t) },
  console: { log() {}, error() {} },
  Date,
  Set,
  Error,
  Math,
  usaCuentaMpPersonal: () => false,
  obtenerTokenMpVigente: async () => "fixture-only-token",
  planCobraComision: () => true,
  calcularComisionTurnits: (amount) => amount * 0.02,
  MercadoPagoConfig: class {},
  Preference: class {
    async create(p) {
      preferences.push(p);
      return {
        id: "preference-fixture",
        init_point: "https://example.test/pay",
      };
    }
  },
  API_URL: "https://api.example.test",
  SUCCESS_URL: "https://example.test/success",
  PENDIENTE_URL: "https://example.test/pendiente",
  ERROR_URL: "https://example.test/error",
  enviarMailTurno: (t) => mails.push(t),
  enviarMailConflictoTurno: (t) => mails.push(t),
  crearNotificacion: (t) => notifications.push(t),
  invalidateCache() {},
  armarReprogramarUrl: () => "/reprogramar/fixture",
});
vm.runInContext("const browseCheckoutLocks=new Set();", context);
for (const name of ["crearCheckoutOffer", "procesarPagoConfirmado"]) {
  const fn = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === name,
  );
  assert(fn, name);
  vm.runInContext(fn.getText(ast), context);
}
(async () => {
  const ctx = { user: { plan: "gratis" }, member: {}, config: {} };
  const p = await context.crearCheckoutOffer({ ...turn }, ctx, false);
  assert.equal(p.payment_url, "https://example.test/pay");
  assert.equal(preferences.length, 1);
  assert.equal(preferences[0].body.items[0].unit_price, 12000);
  assert.equal(preferences[0].body.marketplace_fee, 240);
  assert.equal(preferences[0].requestOptions.idempotencyKey, "offer-" + id);
  assert.equal(tables.pagos_pendientes[0].consumidor_id, consumer);
  assert.equal(tables.pagos_pendientes[0].browse_turno_id, id);
  await context.crearCheckoutOffer({ ...turn }, ctx, false);
  assert.equal(preferences.length, 1);
  assert.equal(tables.pagos_pendientes.length, 1);
  const payment = {
    slug: "fixture",
    browse_turno_id: id,
    consumidor_id: consumer,
    monto: 12000,
    payment_id: "123456",
    estado: "aprobado",
    estado_original: "approved",
    comision_mp: 500,
    comision_plataforma: 240,
  };
  await assert.rejects(
    context.procesarPagoConfirmado({
      ...payment,
      consumidor_id: crypto.randomUUID(),
    }),
    /no coincide/,
  );
  await assert.rejects(
    context.procesarPagoConfirmado({ ...payment, monto: 10000 }),
    /no coincide/,
  );
  await context.procesarPagoConfirmado(payment);
  assert.equal(tables.turnos.length, 1);
  assert.equal(turn.estado, "confirmado");
  assert.equal(turn.monto_pagado, 12000);
  assert.equal(mails.length, 1);
  assert.equal(notifications.length, 1);
  const count = updates.length;
  await context.procesarPagoConfirmado(payment);
  assert.equal(updates.length, count);
  assert.equal(mails.length, 1);
  await context.procesarPagoConfirmado({
    ...payment,
    estado: "rechazado",
    estado_original: "refunded",
  });
  assert.equal(turn.pago_estado, "reembolsado");
  assert.equal(tables.turnos.length, 1);
  console.log(
    "PASS Browse payment integration: single checkout preference, trusted price/fee and consumer identity, idempotency key, confirmation updates held booking once, duplicate notifications ignored, full refund reverses payment status. Mock MP only.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
