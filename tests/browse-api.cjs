const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const id = () => crypto.randomUUID();
const consumerId = id(),
  otherId = id(),
  serviceId = id(),
  memberId = id(),
  rewardId = id(),
  offerId = id();
const tables = {
  consumidores: [
    {
      id: consumerId,
      nombre_persona: "Ana",
      apellido: "Prueba",
      email: "ana@example.test",
      telefono: "543511111111",
      activo: true,
      email_verificado: true,
      password: "",
      intereses: ["barberia"],
    },
  ],
  usuarios: [
    {
      slug: "prueba",
      business_name: "Negocio",
      activo: true,
      plan: "premium",
      rubro: "barberia",
      mp_access_token: "fixture-only",
    },
  ],
  negocio_perfiles: [{ slug: "prueba", nombre: "Negocio", publicado: true }],
  servicios: [
    {
      id: serviceId,
      slug: "prueba",
      nombre: "Corte",
      precio: 15000,
      activo: "true",
      duracion: 30,
    },
  ],
  equipo: [
    { id: memberId, slug: "prueba", nombre: "Profesional", activo: true },
  ],
  servicio_equipo: [
    {
      servicio_id: serviceId,
      equipo_id: memberId,
      precio_override: 15000,
      servicios: { slug: "prueba" },
    },
  ],
  turnits_recompensas: [],
  turnits_offers: [],
  sucursales: [],
  tc_billeteras: [],
  tc_movimientos: [],
  browse_cambios_email: [],
  turnos: [
    {
      id: id(),
      consumidor_id: consumerId,
      slug: "prueba",
      servicio_nombre: "Corte",
      fecha: "2027-01-01",
      hora: "15:00",
      gestion_token: "private-management-token",
    },
    { id: id(), consumidor_id: otherId, slug: "prueba" },
  ],
  extras: [],
};
const read = (r, k) => k.split(".").reduce((v, p) => v?.[p], r);
class Query {
  constructor(t) {
    assert(tables[t], t);
    this.t = t;
    this.filters = [];
    this.columns = "*";
  }
  select(c = "*") {
    this.columns = c;
    return this;
  }
  eq(k, v) {
    this.filters.push((r) => read(r, k) === v);
    return this;
  }
  in(k, v) {
    this.filters.push((r) => v.includes(read(r, k)));
    return this;
  }
  order() {
    return this;
  }
  limit(n) {
    this.max = n;
    return this;
  }
  maybeSingle() {
    this.singleResult = true;
    return this;
  }
  single() {
    return this.maybeSingle();
  }
  update(v) {
    this.op = "update";
    this.value = v;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  upsert(v, o) {
    this.op = "upsert";
    this.value = v;
    this.conflict = o.onConflict;
    return this;
  }
  then(resolve, reject) {
    return Promise.resolve()
      .then(() => {
        let rows = tables[this.t].filter((r) =>
          this.filters.every((f) => f(r)),
        );
        if (this.op === "update")
          rows.forEach((r) => Object.assign(r, this.value));
        if (this.op === "delete")
          rows.forEach((r) =>
            tables[this.t].splice(tables[this.t].indexOf(r), 1),
          );
        if (this.op === "upsert") {
          let r = tables[this.t].find(
            (r) => r[this.conflict] === this.value[this.conflict],
          );
          if (r) Object.assign(r, this.value);
          else tables[this.t].push(this.value);
          rows = [this.value];
        }
        rows = rows
          .slice(0, this.max || Infinity)
          .map((r) =>
            this.columns === "*" || this.columns.includes("!inner")
              ? { ...r }
              : Object.fromEntries(
                  this.columns.split(",").map((k) => [k, r[k]]),
                ),
          );
        return {
          data: this.singleResult ? rows[0] || null : rows,
          error: null,
        };
      })
      .then(resolve, reject);
  }
}
const calls = [],
  mails = [],
  notifications = [],
  routes = new Map(),
  app = {};
for (const method of ["get", "post", "put"])
  app[method] = (url, ...fns) =>
    routes.set(method.toUpperCase() + " " + url, fns);
const pass = (_q, _s, next) => next(),
  secret = "local-browse-test-secret";
const supabase = {
  from: (t) => new Query(t),
  rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === "browse_reservar")
      return {
        data: { id: id(), slug: args.p_slug, precio_cobrado: args.p_precio },
      };
    if (name === "browse_cambiar_email") {
      const p = tables.browse_cambios_email.find(
        (r) => r.consumidor_id === args.p_consumidor,
      );
      return { data: p?.codigo_hash === args.p_hash };
    }
    return { data: null };
  },
};
async function call(method, url, { body = {}, auth, params = {} } = {}) {
  const req = {
    headers: auth ? { authorization: "Bearer " + auth } : {},
    params,
    body,
  };
  let status = 200,
    output;
  const res = {
    status(n) {
      status = n;
      return this;
    },
    json(v) {
      output = v;
      return this;
    },
  };
  const handlers = routes.get(method + " " + url);
  assert(handlers, url);
  let i = 0;
  const pending = [];
  const next = () => {
    if (i < handlers.length) {
      const p = handlers[i++](req, res, next);
      if (p?.then) pending.push(p);
    }
  };
  next();
  while (pending.length) await pending.shift();
  assert(output, `No response from ${url}`);
  return { status, body: output };
}
(async () => {
  const { createBrowse, offerPrice } = await import(
    pathToFileURL(path.join(__dirname, "../api/browse.js"))
  );
  tables.consumidores[0].password = await bcrypt.hash("password-test", 4);
  const multer = () => ({ single: () => pass });
  multer.memoryStorage = () => ({});
  createBrowse({
    app,
    supabase,
    jwt,
    bcrypt,
    multer,
    secret,
    limiterAuth: pass,
    limiterBooking: pass,
    requireAuth: (q, s, next) => {
      let t;
      try {
        t = jwt.verify(q.headers.authorization?.split(" ")[1], secret);
      } catch {
        return s.status(401).json({ success: false });
      }
      q.auth = t;
      q.sucursalAdmin = t.rol === "admin_sucursal";
      q.empleado = t.rol === "empleado";
      if (t.slug !== q.params.slug)
        return s.status(403).json({ success: false });
      next();
    },
    consumerAccounts: {
      findByEmail: async (email) =>
        tables.consumidores.find((c) => c.email === email),
    },
    configForMember: (u) => u,
    validateMember: async () => {},
    intervals: () => [],
    available: async () => {},
    checkCommissions: async () => false,
    createCheckout: async () => ({
      success: true,
      payment_url: "https://example.test/payment",
    }),
    notifyBooking: (t) => notifications.push(t),
    mail: async (m) => mails.push(m),
  });
  const token = jwt.sign(
      { rol: "consumidor", consumidorId: consumerId },
      secret,
    ),
    owner = jwt.sign({ rol: "dueño", slug: "prueba" }, secret);
  assert.equal((await call("GET", "/browse/me")).status, 401);
  assert.equal((await call("GET", "/browse/me", { auth: owner })).status, 403);
  const me = await call("GET", "/browse/me", { auth: token });
  assert.equal(me.status, 200);
  assert.equal(me.body.turnos.length, 1);
  assert(!JSON.stringify(me.body).includes("password"));
  assert(!JSON.stringify(me.body).includes("private-management-token"));
  assert.equal(me.body.billetera.saldo, 0);
  assert.equal(
    (
      await call("GET", "/browse/turnos/:id", {
        auth: token,
        params: { id: tables.turnos[1].id },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("GET", "/browse/turnos/:id", {
        auth: token,
        params: { id: tables.turnos[0].id },
      })
    ).body.turno.gestion_token,
    "private-management-token",
  );
  const catalog = await call("GET", "/browse/catalogo");
  assert.equal(catalog.body.servicios.length, 1);
  assert.equal(catalog.body.servicios[0].precio, 15000);
  assert(!JSON.stringify(catalog.body).includes("fixture-only"));
  for (const rol of ["empleado", "admin_sucursal", "consumidor"])
    assert.equal(
      (
        await call("GET", "/admin/browse/:slug", {
          params: { slug: "prueba" },
          auth: jwt.sign({ rol, slug: "prueba" }, secret),
        })
      ).status,
      403,
    );
  assert.equal(
    (
      await call("GET", "/admin/browse/:slug", {
        auth: owner,
        params: { slug: "otro" },
      })
    ).status,
    403,
  );
  const offer = {
    id: offerId,
    servicio_id: serviceId,
    equipo_id: memberId,
    precio_minimo: 10000,
    activo: true,
  };
  assert.equal(
    (
      await call("PUT", "/admin/browse/:slug", {
        auth: owner,
        params: { slug: "prueba" },
        body: { offers: [{ ...offer, precio_minimo: 16000 }], recompensas: [] },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("PUT", "/admin/browse/:slug", {
        auth: owner,
        params: { slug: "prueba" },
        body: { offers: [offer], recompensas: [] },
      })
    ).status,
    200,
  );
  assert.equal(calls.at(-1).args.p_slug, "prueba");
  const reservation = {
    slug: "prueba",
    servicio_id: serviceId,
    equipo_id: memberId,
    fecha: "2027-01-01",
    hora: "15:00",
    recompensa_id: rewardId,
    precio: 0,
    consumidor_id: otherId,
  };
  assert.equal(
    (await call("POST", "/browse/reservar", { body: reservation })).status,
    401,
  );
  assert.equal(
    (
      await call("POST", "/browse/reservar", {
        auth: token,
        body: { ...reservation, precio: -1 },
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("POST", "/browse/reservar", { auth: token, body: reservation }))
      .status,
    201,
  );
  assert.equal(calls.at(-1).args.p_consumidor, consumerId);
  assert.equal(notifications.length, 1);
  assert.equal(
    (
      await call("POST", "/browse/perfil/password", {
        auth: token,
        body: { actual: "bad", nueva: "new-password" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("POST", "/browse/perfil/email", {
        auth: token,
        body: { email: "new@example.test", password: "password-test" },
      })
    ).status,
    200,
  );
  assert.equal(mails.length, 1);
  assert.equal(mails[0].email, "new@example.test");
  assert(
    !JSON.stringify(tables.browse_cambios_email).includes(mails[0].codigo),
  );
  assert.equal(
    (
      await call("POST", "/browse/perfil/email/verificar", {
        auth: token,
        body: { codigo: mails[0].codigo },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("POST", "/browse/perfil/eliminar", {
        auth: token,
        body: { password: "password-test" },
      })
    ).status,
    401,
  );
  assert.equal(tables.consumidores.length, 1);
  assert.equal(
    (
      await call("PUT", "/browse/perfil", {
        auth: token,
        body: {
          nombre_persona: "Ana",
          apellido: "Prueba",
          telefono: "+543511111112",
        },
      })
    ).status,
    200,
  );
  assert.equal(tables.consumidores[0].telefono, "543511111112");
  assert.equal(offerPrice(15000, 10000, 60), 14000);
  assert.equal(offerPrice(15000, 10000, 30), 12000);
  assert.equal(offerPrice(15000, 10000, 15), 10000);
  assert.equal(offerPrice(15000, 10000, 0), null);
  assert.equal(offerPrice(15000, 15000, 30), null);
  console.log(
    "PASS Browse API: consumer/owner isolation, private field filtering, booking identity bound to session, own catalog validation, price steps, authenticated profile updates and email verification. No external writes.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
