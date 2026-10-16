const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, ".."),
  source = fs.readFileSync(path.join(root, "api/server.js"), "utf8");
const id = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`,
  a = id(1),
  b = id(2),
  c = id(3),
  owner = id(4),
  north = id(10),
  south = id(11),
  principal = id(12),
  slug = "fede";
const db = {
  usuarios: [
    {
      slug,
      plan: "premium",
      activo: true,
      estado_suscripcion: "activo",
      business_name: "Negocio",
      email: "private@example.com",
      mp_access_token: "SECRET",
      datos_bancarios: "SECRET",
      horarios: {},
      excepciones: [],
    },
  ],
  equipo: [
    {
      id: a,
      slug,
      nombre: "Ana",
      activo: true,
      login_activado: true,
      es_dueño: false,
      sucursal_id: north,
    },
    {
      id: b,
      slug,
      nombre: "Beto",
      activo: true,
      es_dueño: false,
      sucursal_id: north,
    },
    {
      id: c,
      slug,
      nombre: "Cami",
      activo: true,
      es_dueño: false,
      sucursal_id: south,
    },
    { id: owner, slug, es_dueño: true, sucursal_id: null },
  ],
  sucursales: [
    { id: north, slug, nombre: "Centro", activo: true, admin_equipo_id: a },
    { id: south, slug, nombre: "Norte", activo: true, admin_equipo_id: c },
    {
      id: principal,
      slug,
      nombre: "Principal",
      es_principal: true,
      activo: true,
    },
  ],
  turnos: [
    { id: id(20), slug, equipo_id: b, sucursal_id: north },
    { id: id(21), slug, equipo_id: b, sucursal_id: south },
    { id: id(22), slug, equipo_id: owner, sucursal_id: null },
  ],
  notificaciones: [
    { id: id(30), slug, data: { sucursal_id: north } },
    { id: id(31), slug, data: { sucursal_id: south } },
    { id: id(32), slug, data: { sucursal_id: "principal" } },
    { id: id(33), slug, data: {} },
  ],
  reprogramaciones: [
    { id: id(40), slug, turno_id: id(20) },
    { id: id(41), slug, turno_id: id(21) },
  ],
  servicios: [
    { id: id(50), slug, owner_equipo_id: null },
    { id: id(51), slug, owner_equipo_id: b },
    { id: id(52), slug, owner_equipo_id: c },
  ],
  servicio_equipo: [
    { equipo_id: b, servicio_id: id(50) },
    { equipo_id: c, servicio_id: id(50) },
  ],
  finanzas_gastos: [
    { id: id(60), slug, sucursal_id: north },
    { id: id(61), slug, sucursal_id: south },
    { id: id(62), slug, sucursal_id: null },
  ],
  admins: [],
};
const logs = [];
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.fields = "*";
    this.op = "select";
  }
  select(fields = "*", opts = {}) {
    this.fields = fields;
    this.opts = opts;
    return this;
  }
  eq(k, v) {
    this.filters.push((r) => this.val(r, k) === v);
    return this;
  }
  is(k, v) {
    this.filters.push((r) => (this.val(r, k) ?? null) === v);
    return this;
  }
  in(k, vs) {
    this.filters.push((r) => vs.includes(this.val(r, k)));
    return this;
  }
  neq(k, v) {
    this.filters.push((r) => this.val(r, k) !== v);
    return this;
  }
  val(r, k) {
    if (k.startsWith("data->>")) return r.data?.[k.slice(7)];
    if (k.startsWith("turnos."))
      return db.turnos.find((t) => t.id === r.turno_id)?.[k.slice(7)];
    return r[k];
  }
  or(expr) {
    this.filters.push(
      (r) =>
        r.owner_equipo_id == null ||
        [...expr.matchAll(/[0-9a-f]{8}-[0-9a-f-]{27}/g)].some(
          (m) => m[0] === r.owner_equipo_id,
        ),
    );
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  range() {
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  insert(value) {
    this.op = "insert";
    this.value = value;
    return this;
  }
  upsert(value) {
    this.op = "upsert";
    this.value = value;
    return this;
  }
  update(value) {
    this.op = "update";
    this.value = value;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
  async run() {
    logs.push({ table: this.table, op: this.op, fields: this.fields });
    let rows = (db[this.table] || []).filter((r) =>
      this.filters.every((f) => f(r)),
    );
    if (this.op === "insert" || this.op === "upsert") {
      rows = (Array.isArray(this.value) ? this.value : [this.value]).map(
        (v) => ({ id: id(99), ...v }),
      );
      (db[this.table] ||= []).push(...rows);
    }
    if (this.op === "update") rows.forEach((r) => Object.assign(r, this.value));
    if (this.op === "delete")
      db[this.table] = db[this.table].filter((r) => !rows.includes(r));
    return {
      data: this.one ? rows[0] || null : rows.map((r) => ({ ...r })),
      count: rows.length,
      error: null,
    };
  }
}
const supabase = { from: (t) => new Query(t) },
  routes = new Map(),
  app = {};
for (const method of ["get", "post", "put", "delete"])
  app[method] = (urls, ...h) => {
    for (const url of Array.isArray(urls) ? urls : [urls])
      routes.set(method.toUpperCase() + " " + url, h);
  };
const cleanSlug = (s) =>
    String(s || "")
      .trim()
      .toLowerCase(),
  isActivo = (v) => v === true;
(async () => {
  const { crearSucursales } = await import(
      pathToFileURL(path.join(root, "api/perfil-sucursales.js"))
    ),
    { createBranchPanel, branchRouteAllowed } = await import(
      pathToFileURL(path.join(root, "api/branch-panel.js"))
    );
  const multer = Object.assign(() => ({ single: () => (_r, _s, n) => n() }), {
    memoryStorage: () => ({}),
  });
  let requireAuth;
  const sucursalesApp = crearSucursales({
    app,
    supabase,
    requireAuth: (...args) => requireAuth(...args),
    cleanSlug,
    isActivo,
    invalidateCache: () => {},
    multer,
  });
  const branchPanel = createBranchPanel({
    app,
    supabase,
    requireAuth: (...args) => requireAuth(...args),
    cleanSlug,
  });
  const ctx = {
    supabase,
    sucursalesApp,
    branchPanel,
    app,
    cleanSlug,
    isActivo,
    console,
    invalidateCache: () => {},
    APPS_SCRIPT_URL: "",
    validateEmail: () => true,
    process: { env: { JWT_SECRET: "test" } },
    jwt: { verify: (t) => JSON.parse(t) },
    planTieneFuncionesPremium: (p) => ["basico", "premium"].includes(p),
    diasHastaVencer: () => 30,
    mediosOfflinePermitidos: () => true,
    FINANZAS_CATEGORIAS: new Set(["otros"]),
    fechaISOValida: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s),
    actualizarConfigEquipo: async (s, id, body) => {
      db.equipo.find((m) => m.id === id && m.slug === s).horarios =
        body.horarios;
      return {};
    },
  };
  vm.createContext(ctx);
  vm.runInContext(
    source
      .slice(
        source.indexOf("async function requireAuth("),
        source.indexOf(
          "// COMISIONES TURNITS",
          source.indexOf("async function requireAuth("),
        ),
      )
      .replace(/\/\/ ═+\s*$/, "") + ";this.auth=requireAuth",
    ctx,
  );
  requireAuth = ctx.auth;
  function register(start, end) {
    vm.runInContext(
      source.slice(
        source.indexOf(start),
        source.indexOf(end, source.indexOf(start) + start.length),
      ),
      ctx,
    );
  }
  register('app.get("/settings/:slug"', 'app.put("/settings/:slug"');
  register('app.put("/admin/equipo/:id/config"', "// ═════════");
  register('app.post("/finanzas/:slug/gastos"', "// ═════════");
  register('app.post(["/admin/equipo",', "// ═════════");
  register(
    'app.post(["/admin/equipo/:id/servicios",',
    'app.post("/admin/equipo/upload-foto"',
  );
  const req = (method, path, params = {}, body = {}, query = {}) => ({
    method,
    path,
    params,
    body,
    query,
    headers: {
      authorization:
        "Bearer " + JSON.stringify({ rol: "empleado", slug, equipoId: a }),
    },
  });
  async function call(key, r) {
    const res = {
      code: 200,
      set() {
        return this;
      },
      status(n) {
        this.code = n;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    let i = 0;
    const handlers = routes.get(key);
    assert(handlers, key);
    await (async function next() {
      return handlers[i++]?.(r, res, next);
    })();
    for (let wait = 0; !res.body && wait < 20; wait++)
      await new Promise((resolve) => setImmediate(resolve));
    return res;
  }
  async function auth(r) {
    let passed = false,
      res = {
        code: 200,
        status(n) {
          this.code = n;
          return this;
        },
        json(value) {
          this.body = value;
          return this;
        },
      };
    await requireAuth(r, res, () => {
      passed = true;
    });
    return { passed, ...res };
  }
  let r = req("GET", "/admin/equipo/fede", { slug });
  assert((await auth(r)).passed);
  assert.equal(r.sucursalAdmin.id, north);
  assert.deepEqual(r.sucursalAdmin.equipo_ids, [a, b]);
  assert.deepEqual(
    (await branchPanel.from(r, "equipo").select("*").eq("slug", slug)).data.map(
      (m) => m.id,
    ),
    [a, b],
  );
  assert.deepEqual(
    (await branchPanel.from(r, "turnos").select("*").eq("slug", slug)).data.map(
      (t) => t.id,
    ),
    [id(20)],
    "historical branch, not current member",
  );
  assert.deepEqual(
    (
      await branchPanel.from(r, "servicios").select("*").eq("slug", slug)
    ).data.map((t) => t.id),
    [id(50), id(51)],
  );
  assert.equal(
    (await branchPanel.from(r, "servicio_equipo").select("*")).data.length,
    1,
  );
  assert.deepEqual(
    (await branchPanel.from(r, "notificaciones").select("*")).data.map(
      (t) => t.id,
    ),
    [id(30)],
  );
  for (const [method, p] of [
    ["POST", "/admin/servicios"],
    ["PUT", "/settings/fede"],
    ["GET", "/mp/connect"],
    ["GET", "/admin/perfil/fede"],
    ["PUT", "/admin/sucursales/fede"],
    ["POST", "/empleado/fede/servicios"],
    ["GET", "/suscripcion/fede"],
  ])
    assert.equal((await auth(req(method, p, { slug }))).code, 403, p);
  assert.equal(
    (await auth(req("GET", "/agenda/otro", { slug: "otro" }))).code,
    403,
  );
  assert.equal(
    (await auth(req("PUT", `/admin/equipo/${c}`, { id: c }))).code,
    404,
  );
  assert.equal(
    (await auth(req("DELETE", `/admin/equipo/${a}`, { id: a }))).code,
    403,
  );
  assert.equal(
    (await auth(req("PUT", `/turnos/${id(21)}`, { id: id(21) }))).code,
    404,
  );
  assert.equal(
    (await auth(req("POST", "/admin/turnos/manual", {}, { equipo_id: c })))
      .code,
    404,
  );
  assert.equal((await auth(req("POST", "/admin/turnos/manual"))).code, 400);
  assert.equal(
    (
      await auth(
        req(
          "PUT",
          `/admin/equipo/${b}/config`,
          { id: b },
          { mp_access_token: "evil" },
        ),
      )
    ).code,
    403,
  );
  assert.equal(
    (await auth(req("PUT", `/admin/equipo/${a}`, { id: a }, { activo: false })))
      .code,
    403,
  );
  assert(
    (await auth(req("PUT", `/admin/equipo/${a}`, { id: a }, { nombre: "Ana" })))
      .passed,
    "own safe profile/assignments stay editable",
  );
  assert.equal(
    (await auth(req("PUT", `/notificaciones/${id(31)}/leida`, { id: id(31) })))
      .code,
    404,
  );
  await sucursalesApp.equipoMiddleware(
    Object.assign(r, { params: { id: b } }),
    {
      status() {
        throw Error("unexpected deny");
      },
    },
    () => {},
  );
  assert.deepEqual(
    r.sucursalAdmin.equipo_ids,
    [a, b],
    "middleware preserves validated member scope",
  );
  r = req("PUT", `/admin/reprogramaciones/${id(40)}`, { id: id(40) });
  assert((await auth(r)).passed);
  await branchPanel
    .from(r, "reprogramaciones")
    .update({ estado: "aprobada" })
    .eq("id", id(40));
  assert.equal(db.reprogramaciones[0].estado, "aprobada");
  assert.equal(db.reprogramaciones[1].estado, undefined);
  assert.equal(
    (
      await auth(
        req("PUT", `/admin/reprogramaciones/${id(41)}`, { id: id(41) }),
      )
    ).code,
    404,
  );
  await branchPanel
    .from(r, "reprogramaciones")
    .select("id,turnos!inner(nombre)");
  assert.equal(logs.at(-1).fields, "id,turnos!inner(sucursal_id,nombre)");
  let result = await call(
    "GET /settings/:slug",
    req("GET", "/settings/fede", { slug }),
  );
  assert.equal(result.code, 200);
  assert(!JSON.stringify(result.body).includes("SECRET"));
  assert(!JSON.stringify(result.body).includes("private@"));
  result = await call(
    "PUT /admin/equipo/:id",
    req("PUT", `/admin/equipo/${b}`, { id: b }, { nombre: "Beto actualizado" }),
  );
  assert.equal(result.code, 200);
  assert.equal(db.equipo[1].nombre, "Beto actualizado");
  result = await call(
    "PUT /admin/equipo/:id",
    req(
      "PUT",
      `/admin/equipo/${b}`,
      { id: b },
      { rol: "admin", puede_recibir_pagos_personales: true },
    ),
  );
  assert.equal(result.code, 403);
  result = await call(
    "POST /admin/equipo/:id/servicios",
    req(
      "POST",
      `/admin/equipo/${a}/servicios`,
      { id: a },
      { servicio_id: id(50) },
    ),
  );
  assert.equal(result.code, 201);
  result = await call(
    "POST /admin/equipo/:id/servicios",
    req(
      "POST",
      `/admin/equipo/${b}/servicios`,
      { id: b },
      { servicio_id: id(52) },
    ),
  );
  assert.equal(
    result.code,
    404,
    "cannot assign private catalog from other branch",
  );
  result = await call(
    "POST /admin/equipo",
    req(
      "POST",
      "/admin/equipo",
      {},
      {
        nombre: "Nuevo",
        rol: "admin",
        sucursal_id: south,
        puede_crear_servicios: true,
        puede_recibir_pagos_personales: true,
      },
    ),
  );
  assert.equal(result.code, 201);
  assert.equal(db.equipo.at(-1).sucursal_id, north);
  assert.equal(db.equipo.at(-1).rol, "colaborador");
  assert.equal(db.equipo.at(-1).puede_crear_servicios, false);
  assert.equal(db.equipo.at(-1).puede_recibir_pagos_personales, false);
  db.equipo.pop();
  result = await call(
    "PUT /admin/equipo/:id/config",
    req(
      "PUT",
      `/admin/equipo/${b}/config`,
      { id: b },
      { horarios: { martes: { activo: true } } },
    ),
  );
  assert.equal(result.code, 200);
  assert(db.equipo[1].horarios.martes.activo);
  const gasto = {
    descripcion: "Gasto centro",
    categoria: "otros",
    monto: 500,
    fecha: "2026-10-16",
    tipo: "variable",
    sucursal_id: south,
  };
  result = await call(
    "POST /finanzas/:slug/gastos",
    req("POST", "/finanzas/fede/gastos", { slug }, gasto),
  );
  assert.equal(result.code, 201);
  assert.equal(
    db.finanzas_gastos.at(-1).sucursal_id,
    north,
    "forged scope ignored",
  );
  result = await call(
    "PUT /finanzas/:slug/gastos/:id",
    req("PUT", `/finanzas/fede/gastos/${id(61)}`, { slug, id: id(61) }, gasto),
  );
  assert.equal(result.code, 404);
  result = await call(
    "DELETE /finanzas/:slug/gastos/:id",
    req("DELETE", `/finanzas/fede/gastos/${id(61)}`, { slug, id: id(61) }),
  );
  assert.equal(result.code, 404);
  db.sucursales[0].admin_equipo_id = null;
  assert.equal(
    (await auth(req("GET", "/admin/equipo/fede", { slug }))).code,
    403,
    "revocation immediate",
  );
  assert(
    (await auth(req("GET", "/empleado/fede/perfil", { slug }))).passed,
    "ordinary employee retained",
  );
  db.sucursales[0].admin_equipo_id = a;
  db.sucursales[0].activo = false;
  assert.equal(
    (await auth(req("GET", "/admin/equipo/fede", { slug }))).code,
    403,
  );
  db.sucursales[0].activo = true;
  db.usuarios[0].plan = "basico";
  assert.equal(
    (await auth(req("GET", "/admin/equipo/fede", { slug }))).code,
    403,
  );
  db.usuarios[0].plan = "premium";
  db.equipo[0].activo = false;
  assert.equal(
    (await auth(req("GET", "/sesion/panel/fede", { slug }))).code,
    403,
  );
  db.equipo[0].activo = true;
  db.equipo[0].sucursal_id = null;
  assert.equal(
    (await auth(req("GET", "/admin/equipo/fede", { slug }))).code,
    403,
    "moved admin loses branch scope",
  );
  db.sucursales[0].admin_equipo_id = null;
  db.sucursales[2].admin_equipo_id = a;
  r = req("GET", "/agenda/fede", { slug });
  assert((await auth(r)).passed);
  assert.equal(r.sucursalAdmin.id, "principal");
  assert.deepEqual(
    (await branchPanel.from(r, "turnos").select("*")).data.map((t) => t.id),
    [id(22)],
  );
  assert.deepEqual(
    (await branchPanel.from(r, "notificaciones").select("*")).data.map(
      (t) => t.id,
    ),
    [id(32)],
  );
  await branchPanel.from(r, "finanzas_gastos").insert({ slug, monto: 10 });
  assert.equal(db.finanzas_gastos.at(-1).sucursal_id, principal);
  const ownerReq = req("GET", "/settings/fede", { slug });
  ownerReq.headers.authorization =
    "Bearer " + JSON.stringify({ rol: "owner", slug });
  assert((await auth(ownerReq)).passed);
  assert.equal(
    (await branchPanel.from(ownerReq, "equipo").select("*")).data.length,
    4,
    "owner retains all branches",
  );
  console.log(
    "PASS branch API: real auth/resolver/guards/handlers; two branches+principal, historical appointments, catalog/team scope, notification snapshot, expense writes, config masking, forbidden payments/catalog/roles, revoked/paused/moved/downgraded admin, owner and employee regressions. In-memory data; no real writes.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
