const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  crypto = require("node:crypto"),
  path = require("node:path");
const { pathToFileURL } = require("node:url");
const jwt = require("jsonwebtoken"),
  bcrypt = require("bcryptjs"),
  ts = require("../web/node_modules/typescript");
const source = fs.readFileSync(
    path.join(__dirname, "../api/server.js"),
    "utf8",
  ),
  ast = ts.createSourceFile("server.js", source, ts.ScriptTarget.Latest, true);
const tables = {
  usuarios: [],
  equipo: [],
  admins: [],
  consumidores: [],
  registros_consumidores: [],
  registros_pendientes: [],
  google_login_accounts: [],
};
const copy = (value) => JSON.parse(JSON.stringify(value));
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.operation = "read";
    this.columns = "*";
  }
  select(columns = "*") {
    this.columns = columns;
    return this;
  }
  eq(key, value) {
    this.filters.push((row) => row[key] === value);
    return this;
  }
  gt(key, value) {
    this.filters.push((row) => row[key] > value);
    return this;
  }
  insert(value) {
    this.operation = "insert";
    this.value = value;
    return this;
  }
  upsert(value, options) {
    this.operation = "upsert";
    this.value = value;
    this.conflict = options.onConflict;
    return this;
  }
  update(value) {
    this.operation = "update";
    this.value = value;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  maybeSingle() {
    this.singleResult = true;
    return this;
  }
  single() {
    this.singleResult = true;
    return this;
  }
  then(resolve, reject) {
    try {
      return Promise.resolve(this.run()).then(resolve, reject);
    } catch (e) {
      return Promise.reject(e).then(resolve, reject);
    }
  }
  run() {
    const rows = tables[this.table];
    assert(rows, `unexpected table ${this.table}`);
    let found = rows.filter((row) => this.filters.every((f) => f(row)));
    if (this.operation === "insert" || this.operation === "upsert") {
      found = [];
      for (const value of Array.isArray(this.value)
        ? this.value
        : [this.value]) {
        let row =
          this.operation === "upsert"
            ? rows.find((r) => r[this.conflict] === value[this.conflict])
            : null;
        if (!row) {
          row = {
            id: crypto.randomUUID(),
            activo: true,
            email_verificado: true,
          };
          rows.push(row);
        }
        Object.assign(row, copy(value));
        found.push(row);
      }
    } else if (this.operation === "update")
      found.forEach((row) => Object.assign(row, copy(this.value)));
    else if (this.operation === "delete")
      found.forEach((row) => rows.splice(rows.indexOf(row), 1));
    const result = found.map((row) =>
      this.columns === "*"
        ? copy(row)
        : Object.fromEntries(
            this.columns.split(",").map((key) => [key.trim(), row[key.trim()]]),
          ),
    );
    return {
      data: this.singleResult ? result[0] || null : result,
      error: null,
    };
  }
}
const supabase = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
    assert.equal(name, "verificar_registro_consumidor");
    const p = tables.registros_consumidores.find(
      (row) =>
        row.email === args.p_email && row.registro_id === args.p_registro_id,
    );
    if (!p || p.intentos >= 5 || Date.parse(p.codigo_expiry) <= Date.now())
      return { data: { success: false, error: "Código expirado." } };
    if (p.codigo_hash !== args.p_codigo_hash) {
      p.intentos++;
      return { data: { success: false, error: "Código incorrecto." } };
    }
    const user = {
      id: crypto.randomUUID(),
      activo: true,
      email_verificado: true,
      nombre_persona: p.nombre_persona,
      apellido: p.apellido,
      email: p.email,
      telefono: p.telefono,
      password: p.password_hash,
      intereses: p.intereses,
    };
    tables.consumidores.push(user);
    tables.registros_consumidores.splice(
      tables.registros_consumidores.indexOf(p),
      1,
    );
    return { data: { ...user, password: undefined, success: true } };
  },
};
const routes = new Map(),
  app = {};
for (const method of ["post", "get"])
  app[method] = (url, ...handlers) =>
    routes.set(method.toUpperCase() + " " + url, handlers);
const pass = (_req, _res, next) => next(),
  sent = [],
  failed = [],
  secret = "local-consumer-tests-secret-only";
function captureRoute(method, url, ctx) {
  const node = ast.statements.find(
    (n) =>
      ts.isExpressionStatement(n) &&
      ts.isCallExpression(n.expression) &&
      n.expression.expression.getText(ast) === `app.${method}` &&
      n.expression.arguments[0]?.text === url,
  );
  assert(node, `${method} ${url}`);
  vm.runInContext(node.getText(ast), ctx);
}
async function call(method, url, body = {}, headers = {}) {
  let output,
    status = 200;
  const req = {
    body,
    headers,
    query: {},
    params: {},
    path: url,
    method,
    is: (type) => type === "application/json",
  };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(data) {
      output = data;
      return this;
    },
    setHeader() {},
  };
  const handlers = routes.get(method + " " + url);
  assert(handlers, url);
  let i = 0;
  const pending = [];
  const next = () => {
    if (i < handlers.length) {
      const result = handlers[i++](req, res, next);
      if (result?.then) pending.push(result);
    }
  };
  next();
  while (pending.length) await pending.shift();
  return { status, body: output };
}
(async () => {
  const { createConsumerAccounts, consumerIdentity } = await import(
    pathToFileURL(path.join(__dirname, "../api/consumer-accounts.js"))
  );
  const { validCategories } = await import(
    pathToFileURL(path.join(__dirname, "../web/src/shared/categories.js"))
  );
  const accounts = createConsumerAccounts({
    app,
    supabase,
    bcrypt,
    jwt,
    limiterAuth: pass,
    limiterCodigo: pass,
    fetch: async (_url, opts) => {
      sent.push(JSON.parse(opts.body));
      return { ok: true };
    },
    mailUrl: "https://mail.invalid",
    rounds: 4,
    secret,
  });
  const ctx = vm.createContext({
    app,
    supabase,
    bcrypt,
    jwt,
    crypto,
    console,
    Buffer,
    consumerAccounts: accounts,
    consumerIdentity,
    validCategories,
    limiterAuth: pass,
    limiterCodigo: pass,
    process: { env: { JWT_SECRET: secret } },
    JWT_EXPIRY: "1d",
    cleanSlug: (s) =>
      String(s || "")
        .trim()
        .toLowerCase(),
    validateEmail: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
    validatePassword: (p) => p?.length >= 6,
    cleanPhone: (p) => p.replace(/\D/g, ""),
    validatePhone: (p) => /^\d{7,15}$/.test(p),
    BCRYPT_ROUNDS: 4,
    PLANES_VALIDOS: ["gratis", "basico", "premium"],
    validarHorarios: () => true,
    normalizarReferralCode: (r) => r || null,
    APPS_SCRIPT_URL: "",
    isActivo: (v) => v === true || v === "true",
    planTieneFuncionesPremium: (p) => ["basico", "premium"].includes(p),
    diasHastaVencer: () => 30,
    verificarPassword: (p, h) => bcrypt.compare(p, h),
    chequearBloqueoLogin: () => ({ bloqueado: false }),
    registrarIntentoFallidoLogin: (email) => failed.push(email),
    limpiarIntentosLogin: () => {},
    DIAS_PRUEBA: 30,
    calcularVencimiento: () =>
      new Date(Date.now() + 30 * 86400000).toISOString(),
    generarSlugUnico: async (name) => name,
    registrarReferido: async () => {},
    asegurarReferralCode: async () => {},
    crearNotificacion: () => {},
    generarTips: () => {},
    PANEL_URL: "https://turnits.com/panel",
  });
  for (const url of ["/registro/iniciar", "/registro/verificar", "/login"])
    captureRoute("post", url, ctx);
  captureRoute("get", "/verify-session", ctx);
  const authFunction = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "requireAuth",
  );
  vm.runInContext(authFunction.getText(ast), ctx);
  const googleFunction = ast.statements.find(
    (n) =>
      ts.isFunctionDeclaration(n) && n.name?.text === "registerGoogleRoutes",
  );
  vm.runInContext(googleFunction.getText(ast), ctx);
  let googlePayload;
  ctx.registerGoogleRoutes({
    app,
    limiterAuth: pass,
    supabase,
    jwt,
    bcrypt,
    crypto,
    JWT_EXPIRY: "1d",
    isActivo: ctx.isActivo,
    diasHastaVencer: ctx.diasHastaVencer,
    planTieneFuncionesPremium: ctx.planTieneFuncionesPremium,
    limpiarIntentosLogin: () => {},
    verifyGoogle: async () => googlePayload,
    env: { JWT_SECRET: secret, GOOGLE_CLIENT_ID: "test-client" },
  });
  const data = {
    nombre_persona: "Ana",
    apellido: "Prueba",
    email: "ana@test.example",
    telefono: "+54 351 5555555",
    password: "testing123",
    intereses: ["barberia", "vehiculos"],
  };
  const post = (url, body) => call("POST", url, body);
  assert.equal(
    (
      await post("/consumidores/registro/iniciar", {
        ...data,
        intereses: ["fake"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/consumidores/registro/iniciar", {
        ...data,
        intereses: ["barberia", "barberia"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/consumidores/registro/iniciar", {
        ...data,
        password: "x".repeat(73),
      })
    ).status,
    400,
  );
  let r = await post("/consumidores/registro/iniciar", data);
  assert.equal(r.status, 200);
  const registrationId = r.body.registro_id,
    code = sent.at(-1).codigo;
  assert.equal(tables.usuarios.length, 0);
  assert.equal(tables.consumidores.length, 0);
  assert.equal(tables.registros_consumidores[0].codigo, undefined);
  assert.notEqual(tables.registros_consumidores[0].codigo_hash, code);
  assert(
    await bcrypt.compare(
      data.password,
      tables.registros_consumidores[0].password_hash,
    ),
  );
  assert.equal(
    (
      await post("/consumidores/registro/reenviar-codigo", {
        email: data.email,
        registro_id: registrationId,
      })
    ).status,
    429,
  );
  assert.equal(
    (
      await post("/consumidores/registro/verificar", {
        email: data.email,
        codigo: code,
        registro_id: crypto.randomUUID(),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post("/consumidores/registro/verificar", {
        email: data.email,
        codigo: "000000",
        registro_id: registrationId,
      })
    ).status,
    400,
  );
  r = await post("/consumidores/registro/verificar", {
    email: data.email,
    codigo: code,
    registro_id: registrationId,
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.redirect, "browse");
  const consumerToken = r.body.token;
  assert.equal(jwt.verify(consumerToken, secret).rol, "consumidor");
  assert.equal(r.body.password, undefined);
  assert.equal(r.body.slug, undefined);
  assert.equal(tables.usuarios.length, 0);
  assert.equal(
    (
      await post("/consumidores/registro/verificar", {
        email: data.email,
        codigo: code,
        registro_id: registrationId,
      })
    ).status,
    400,
  );
  r = await post("/login", { email: data.email, password: data.password });
  assert.equal(r.status, 200);
  assert.equal(r.body.rol, "consumidor");
  assert.equal(
    (await post("/login", { email: data.email, password: "wrong" })).status,
    401,
  );
  assert(failed.includes(data.email));
  r = await call(
    "GET",
    "/verify-session",
    {},
    { authorization: `Bearer ${consumerToken}` },
  );
  assert.equal(r.body.active, true);
  assert.equal(r.body.rol, "consumidor");
  assert.equal(r.body.password, undefined);
  for (const slug of [undefined, "victim"]) {
    let permitted = false,
      status;
    await ctx.requireAuth(
      {
        headers: {
          authorization:
            "Bearer " +
            jwt.sign(
              {
                rol: "consumidor",
                consumidorId: tables.consumidores[0].id,
                slug,
              },
              secret,
            ),
        },
        params: {},
        body: {},
        query: {},
        path: "/settings/victim",
        method: "PUT",
      },
      {
        status(c) {
          status = c;
          return this;
        },
        json() {},
      },
      () => {
        permitted = true;
      },
    );
    assert.equal(permitted, false);
    assert.equal(status, 403);
  }
  tables.consumidores[0].activo = false;
  assert.equal(
    (await post("/login", { email: data.email, password: data.password }))
      .status,
    401,
  );
  assert.equal(
    (
      await call(
        "GET",
        "/verify-session",
        {},
        { authorization: `Bearer ${consumerToken}` },
      )
    ).body.active,
    false,
  );
  tables.consumidores[0].activo = true;
  const headers = { origin: "https://turnits.com" };
  let challenge = (await call("POST", "/auth/google/challenge", {}, headers))
    .body.nonce;
  googlePayload = {
    nonce: challenge,
    sub: "google-ana",
    email: data.email,
    email_verified: true,
    hd: "test.example",
  };
  r = await call(
    "POST",
    "/auth/google",
    { credential: "verified-in-test", nonce: challenge },
    headers,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.rol, "consumidor");
  assert.equal(
    tables.google_login_accounts[0].consumidor_id,
    tables.consumidores[0].id,
  );
  assert.equal(
    (
      await call(
        "POST",
        "/auth/google",
        { credential: "verified-in-test", nonce: challenge },
        headers,
      )
    ).status,
    401,
  );
  challenge = (await call("POST", "/auth/google/challenge", {}, headers)).body
    .nonce;
  googlePayload.nonce = challenge;
  googlePayload.email = "changed@external.example";
  r = await call(
    "POST",
    "/auth/google",
    { credential: "verified-in-test", nonce: challenge },
    headers,
  );
  assert.equal(r.body.rol, "consumidor");
  const reset = await post("/auth/forgot-password", { email: data.email });
  assert.equal(reset.status, 200);
  const resetToken = new URL(sent.at(-1).resetUrl).searchParams.get("token");
  assert.notEqual(resetToken, tables.consumidores[0].reset_token);
  assert.equal(
    (
      await post("/auth/reset-password", {
        token: resetToken,
        new_password: "updated123",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post("/auth/reset-password", {
        token: resetToken,
        new_password: "updated123",
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("/login", { email: data.email, password: "updated123" })).body
      .rol,
    "consumidor",
  );
  r = await post("/registro/iniciar", {
    ...data,
    business_name: "new-shop",
    usuario: "new-shop",
    rubros: ["barberia"],
    email: "shop@test.example",
    plan: "premium",
    ref: "ABC123",
  });
  assert.equal(r.status, 200);
  assert.equal(tables.registros_pendientes[0].rubro, "barberia");
  assert.equal(tables.registros_pendientes[0].slug_solicitado, "new-shop");
  assert.equal(
    (
      await post("/registro/iniciar", {
        ...data,
        business_name: "xshop",
        rubros: ["barberia", "vehiculos"],
      })
    ).status,
    400,
  );
  const pending = tables.registros_pendientes[0];
  r = await post("/registro/verificar", {
    email: pending.email,
    codigo: pending.codigo,
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.slug, "new-shop");
  assert.equal(tables.usuarios[0].rubro, "barberia");
  assert.equal(tables.usuarios[0].plan, "premium");
  assert.equal(tables.equipo[0].es_dueño, true);
  assert.equal(
    (await post("/login", { email: pending.email, password: data.password }))
      .body.slug,
    "new-shop",
  );
  challenge = (await call("POST", "/auth/google/challenge", {}, headers)).body
    .nonce;
  googlePayload = {
    nonce: challenge,
    sub: "google-owner",
    email: pending.email,
    email_verified: true,
    hd: "test.example",
  };
  r = await call(
    "POST",
    "/auth/google",
    { credential: "verified-in-test", nonce: challenge },
    headers,
  );
  assert.equal(r.body.slug, "new-shop");
  assert.equal(jwt.verify(r.body.token, secret).rol, "owner");
  tables.equipo.push({
    id: crypto.randomUUID(),
    slug: "new-shop",
    nombre: "Equipo",
    es_dueño: false,
    activo: true,
    login_email: "staff@test.example",
    login_password: await bcrypt.hash("staff123", 4),
    login_activado: true,
  });
  assert.equal(
    (
      await post("/login", {
        email: "staff@test.example",
        password: "staff123",
      })
    ).body.rol,
    "empleado",
  );
  challenge = (await call("POST", "/auth/google/challenge", {}, headers)).body
    .nonce;
  googlePayload = {
    nonce: challenge,
    sub: "google-staff",
    email: "staff@test.example",
    email_verified: true,
    hd: "test.example",
  };
  r = await call(
    "POST",
    "/auth/google",
    { credential: "verified-in-test", nonce: challenge },
    headers,
  );
  assert.equal(r.body.rol, "empleado");
  assert.equal(tables.google_login_accounts.at(-1).consumidor_id, null);
  assert.equal(
    (
      await post("/consumidores/registro/iniciar", {
        ...data,
        email: pending.email,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post("/registro/iniciar", {
        ...data,
        business_name: "other-shop",
        usuario: "other-shop",
        rubros: ["barberia"],
      })
    ).status,
    409,
  );
  await post("/auth/forgot-password", { email: data.email });
  const expiredToken = new URL(sent.at(-1).resetUrl).searchParams.get("token");
  tables.consumidores[0].reset_token_expiry = new Date(
    Date.now() - 1000,
  ).toISOString();
  assert.equal(
    (
      await post("/auth/reset-password", {
        token: expiredToken,
        new_password: "updated456",
      })
    ).status,
    400,
  );
  console.log(
    "Consumer API: registration/validation, hashed OTP/password, verified-only creation, role isolation, login/session/Google nonce/binding, one-use password reset, business slug/category/trial compatibility PASS",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
