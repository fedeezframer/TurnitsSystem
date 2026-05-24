import express        from "express";
import cors           from "cors";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Preference } from "mercadopago";
import fetch          from "node-fetch";
import bcrypt         from "bcryptjs";
import jwt            from "jsonwebtoken";
import rateLimit      from "express-rate-limit";

// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL
// ══════════════════════════════════════════════════════════════
const app = express();

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzvcaYhHuyD-Xu63Aw9WpWrpcr5xmrgHW_IffXkmC90bs0pTzhWP1d8rWBaBuhG5Icx/exec";

const BCRYPT_ROUNDS  = 10;
const CACHE_DURATION = 20_000;       // ms — caché de admin-stats
const JWT_EXPIRY     = "7d";
const API_URL        = process.env.API_URL || "https://negosocio.onrender.com";

// ─── Configuración del SaaS (Associe) ────────────────────────
const DIAS_PRUEBA          = parseInt(process.env.DIAS_PRUEBA || "15");
const PRECIO_SUSCRIPCION   = parseInt(process.env.PRECIO_SUSCRIPCION || "21000");
const MP_PLATFORM_TOKEN    = process.env.MP_PLATFORM_TOKEN || "";
const PANEL_URL            = process.env.PANEL_URL || "https://negosocio.framer.website/panel";
const SUSCRIPCION_SUCCESS  = process.env.SUSCRIPCION_SUCCESS_URL || `${PANEL_URL}?status=suscripcion_ok`;
const SUSCRIPCION_CANCEL   = process.env.SUSCRIPCION_CANCEL_URL  || `${PANEL_URL}?status=suscripcion_cancel`;

// ══════════════════════════════════════════════════════════════
// HELPERS GENERALES
// ══════════════════════════════════════════════════════════════

/**
 * Normaliza un slug: minúsculas, sin espacios ni caracteres especiales.
 * Equivalente JS al generar_slug_base() de PostgreSQL.
 * Ejemplo: "Mi Peluquería & Co." → "mi-peluqueria-co"
 */
const cleanSlug = (raw) => {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quitar tildes
    .replace(/[^a-z0-9]+/g, "-")       // todo lo no alfanumérico → guión
    .replace(/^-+|-+$/g, "");          // quitar guiones al inicio/fin
};

/**
 * Genera un slug único a partir del business_name consultando la DB.
 * Si "mi-negocio" ya existe, prueba "mi-negocio-2", etc.
 */
async function generarSlugUnico(businessName) {
  const base = cleanSlug(businessName);
  let   slug = base;
  let   n    = 2;

  while (true) {
    const { data } = await supabase
      .from("usuarios")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) break;        // slug disponible
    slug = `${base}-${n}`;
    n++;
  }

  return slug;
}

const validateEmail    = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validatePassword = (p) => p && p.length >= 6;
const validatePhone    = (p) => /^[0-9]{7,15}$/.test(p.toString().replace(/\s/g, ""));
const cleanPhone       = (p) => p.toString().replace(/\s/g, "").trim();

const calcularVencimiento = (diasExtra = 30, baseISO = null) => {
  const base = baseISO ? new Date(baseISO + "T12:00:00-03:00") : new Date();
  base.setDate(base.getDate() + diasExtra);
  return base.toISOString().split("T")[0];
};

const diasHastaVencer = (fechaVencimientoISO) => {
  const hoy   = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const vence = new Date(fechaVencimientoISO + "T23:59:59-03:00");
  return Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
};

// ══════════════════════════════════════════════════════════════
// CACHÉ EN MEMORIA
// ══════════════════════════════════════════════════════════════
const globalCache = {};
const invalidateCache = (slug) => { delete globalCache[slug]; };

// ══════════════════════════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════════════════════════
const limiterAuth    = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  message: "Demasiados intentos.", standardHeaders: true, legacyHeaders: false });
const limiterBooking = rateLimit({ windowMs: 60 * 1000,       max: 20,  message: "Demasiadas reservas." });
const limiterAPI     = rateLimit({ windowMs: 60 * 1000,       max: 200 });

// ══════════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════════
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(limiterAPI);

// ══════════════════════════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════════════════════════
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ══════════════════════════════════════════════════════════════
// MIDDLEWARE: JWT AUTH
// ══════════════════════════════════════════════════════════════
// JWT contiene: { slug, negocioId, rol: "owner" | "superadmin" }
function requireAuth(req, res, next) {
  try {
    const header = req.headers["authorization"];
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No autorizado: falta el token." });
    }

    const token   = header.split(" ")[1];
    const secret  = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: "JWT_SECRET no configurado." });

    const payload = jwt.verify(token, secret);

    // Superadmin: acceso total
    if (payload.rol === "superadmin") {
      req.auth = payload;
      return next();
    }

    // Owner: el slug del JWT debe coincidir con el slug de la ruta/body
    const slugRuta = cleanSlug(
      req.params.slug || req.body?.slug || req.query?.slug || ""
    );

    if (slugRuta && payload.slug !== slugRuta) {
      return res.status(403).json({ success: false, error: "No autorizado para este negocio." });
    }

    req.auth = payload;
    next();
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, error: "Sesión expirada. Volvé a iniciar sesión." });
    }
    res.status(401).json({ success: false, error: "Token inválido." });
  }
}

// ══════════════════════════════════════════════════════════════
// MIDDLEWARE: SUPERADMIN KEY
// ══════════════════════════════════════════════════════════════
const requireAdminKey = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ success: false, error: "No autorizado." });
  }
  next();
};

// ══════════════════════════════════════════════════════════════
// HELPERS DE MÉTRICAS
// ══════════════════════════════════════════════════════════════
function generarRangoDias(desdeISO, cantidad) {
  const dias = [];
  const base = new Date(desdeISO + "T12:00:00");
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dias.push(d.toISOString().split("T")[0]);
  }
  return dias;
}

function agruparVentas(ventas, hoyISO) {
  const porDia    = {};
  const porSemana = {};
  const porMes    = {};
  const porEstado = { aprobado: 0, pendiente: 0, rechazado: 0 };
  const clientesSet = new Set();
  let volumenTotal = 0, cantidadTotal = 0;

  ventas.forEach((v) => {
    const fecha  = (v.fecha_pago || v.created_at || hoyISO).split("T")[0];
    const monto  = Number(v.monto || 0);
    const estado = v.estado || "aprobado";
    const [va, vm, vd] = fecha.split("-").map(Number);
    const semKey = `${va}-S${Math.ceil(vd / 7)}`;
    const mesKey = `${va}-${String(vm).padStart(2, "0")}`;

    if (!porDia[fecha])     porDia[fecha]     = { volumen: 0, cantidad: 0, aprobado: 0, pendiente: 0, rechazado: 0 };
    if (!porSemana[semKey]) porSemana[semKey] = { label: semKey, volumen: 0, cantidad: 0 };
    if (!porMes[mesKey])    porMes[mesKey]    = { label: mesKey, volumen: 0, cantidad: 0 };

    porDia[fecha].volumen  += monto;
    porDia[fecha].cantidad += 1;
    porDia[fecha][estado]   = (porDia[fecha][estado] || 0) + 1;

    porSemana[semKey].volumen  += monto;
    porSemana[semKey].cantidad += 1;
    porMes[mesKey].volumen     += monto;
    porMes[mesKey].cantidad    += 1;

    porEstado[estado] = (porEstado[estado] || 0) + 1;

    if (v.email_cliente)         clientesSet.add(v.email_cliente.toLowerCase());
    else if (v.telefono_cliente) clientesSet.add(v.telefono_cliente);

    if (estado === "aprobado") {
      volumenTotal  += monto;
      cantidadTotal += 1;
    }
  });

  return {
    porDia,
    porSemana:      Object.values(porSemana).sort((a, b) => a.label.localeCompare(b.label)),
    porMes:         Object.values(porMes).sort((a, b)    => a.label.localeCompare(b.label)),
    porEstado,
    volumenTotal,
    cantidadTotal,
    ticketPromedio: cantidadTotal > 0 ? Math.round(volumenTotal / cantidadTotal) : 0,
    clientesNuevos: clientesSet.size,
  };
}

function calcularFrecuencia(cantidadTurnos) {
  if (cantidadTurnos >= 4) return "Concurrente";
  if (cantidadTurnos >= 2) return "Regular";
  return "Poco Frecuente";
}

// ══════════════════════════════════════════════════════════════
// RUTAS BASE
// ══════════════════════════════════════════════════════════════
app.get("/",       (_, res) => res.json({ status: "online", version: "8.0", timestamp: new Date().toISOString() }));
app.get("/health", (_, res) => res.json({ status: "ok",     timestamp: new Date().toISOString() }));


// ══════════════════════════════════════════════════════════════
// REGISTRO PÚBLICO — Auto-registro de negocios
// POST /registro
// El cliente completa un formulario en Framer y se registra solo.
// El slug se genera automáticamente a partir del business_name.
// ══════════════════════════════════════════════════════════════

/**
 * POST /registro
 * Body: {
 *   nombre_persona, apellido?, email, telefono?,
 *   business_name, password, rubro?
 * }
 * Responde: { success, slug, panel_url, token, dias_prueba }
 */
app.post("/registro", limiterAuth, async (req, res) => {
  try {
    const {
      nombre_persona,
      apellido,
      email,
      telefono,
      business_name,
      password,
      horarios,
      duracion_turno,
    } = req.body;

    // ── Validaciones ──────────────────────────────────────────
    if (!nombre_persona || !email || !password || !business_name) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios: nombre_persona, email, password, business_name.",
      });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: "Email inválido." });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, error: "La contraseña debe tener al menos 6 caracteres." });
    }
    if (telefono && !validatePhone(cleanPhone(telefono))) {
      return res.status(400).json({ success: false, error: "Teléfono inválido (7-15 dígitos)." });
    }
    if (business_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: "El nombre del negocio es demasiado corto." });
    }

    // ── Verificar email único ─────────────────────────────────
    const { data: emailExiste } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (emailExiste) {
      return res.status(409).json({ success: false, error: "Ya existe una cuenta con ese email." });
    }

    // ── Generar slug único ────────────────────────────────────
    const slug = await generarSlugUnico(business_name.trim());

    // ── Hash de contraseña ────────────────────────────────────
const hashedPassword = String(password);
    const fechaVencimiento = calcularVencimiento(DIAS_PRUEBA);

    // ── Insertar en DB ────────────────────────────────────────
    const insertData = {
      nombre_persona:     nombre_persona.trim(),
      apellido:           apellido?.trim() || null,
      email:              email.trim().toLowerCase(),
      telefono:           telefono ? cleanPhone(telefono) : null,
      business_name:      business_name.trim(),
      slug,
      password:           hashedPassword,
      metodo_pago:        "none",
      porcentaje_sena:    30,
      excepciones:        [],
      activo:             true,
      estado_suscripcion: "trial",
      fecha_vencimiento:  fechaVencimiento,
    };

    // Solo sobreescribir horarios si el front los mandó
    if (horarios && typeof horarios === "object") insertData.horarios = horarios;
    // Solo sobreescribir duración si el front la mandó
    if (duracion_turno) insertData.duracion_turno = parseInt(duracion_turno) || 30;

    const { data: nuevoUsuario, error } = await supabase
      .from("usuarios")
      .insert([insertData])
      .select("id, slug, business_name, email, nombre_persona, estado_suscripcion, fecha_vencimiento")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ success: false, error: "El email ya está registrado." });
      }
      throw error;
    }

    // ── Generar JWT para login automático ─────────────────────
    const secret = process.env.JWT_SECRET;
    let token    = null;
    if (secret) {
      token = jwt.sign(
        { slug: nuevoUsuario.slug, negocioId: nuevoUsuario.id, rol: "owner" },
        secret,
        { expiresIn: JWT_EXPIRY }
      );
    }

    // ── Email de bienvenida (no bloqueante) ───────────────────
    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action:     "bienvenida",
        adminEmail: nuevoUsuario.email,
        nombre:     nuevoUsuario.nombre_persona,
        slug:       nuevoUsuario.slug,
        panel_url:  `${PANEL_URL}?u=${nuevoUsuario.slug}`,
        dias_prueba: DIAS_PRUEBA,
      }),
    }).catch((e) => console.error("Error mail bienvenida:", e.message));

    console.log(`✅ Registro: ${slug} (${business_name}) — trial hasta ${fechaVencimiento}`);

    res.status(201).json({
      success:     true,
      slug:        nuevoUsuario.slug,
      business_name: nuevoUsuario.business_name,
      panel_url:   `${PANEL_URL}?u=${nuevoUsuario.slug}`,
      token,
      dias_prueba: DIAS_PRUEBA,
      fecha_vencimiento: fechaVencimiento,
    });
  } catch (e) {
    console.error("Error en POST /registro:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /registro/check-slug?business_name=...
 * Permite al frontend mostrar en tiempo real el slug que se asignaría,
 * y si ya está disponible.
 */
app.get("/registro/check-slug", async (req, res) => {
  try {
    const { business_name } = req.query;
    if (!business_name) {
      return res.status(400).json({ success: false, error: "Falta business_name." });
    }

    const base = cleanSlug(business_name);
    if (!base) {
      return res.status(400).json({ success: false, error: "Nombre de negocio inválido para generar slug." });
    }

    const slugSugerido = await generarSlugUnico(business_name);

    res.json({
      success:        true,
      slug_sugerido:  slugSugerido,
      slug_base:      base,
      disponible:     slugSugerido === base,   // false si ya se tuvo que agregar sufijo
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// SUPERADMIN — CRUD DE NEGOCIOS
// ══════════════════════════════════════════════════════════════

/**
 * POST /superadmin/negocios
 * Registra un negocio manualmente (admin). El slug se genera igual que
 * en el registro público, a partir del business_name.
 * Body: { nombre_persona, apellido, email, telefono, business_name, password, rubro? }
 */
app.post("/superadmin/negocios", requireAdminKey, async (req, res) => {
  try {
    const {
      nombre_persona, apellido, email, telefono,
      business_name,
      password,
      rubro = "generico",
    } = req.body;

    if (!nombre_persona || !email || !password || !business_name) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos obligatorios: nombre_persona, email, password, business_name.",
      });
    }
    if (!validateEmail(email))        return res.status(400).json({ success: false, error: "Email inválido." });
    if (!validatePassword(password))  return res.status(400).json({ success: false, error: "Contraseña: mínimo 6 caracteres." });
    if (telefono && !validatePhone(cleanPhone(telefono))) {
      return res.status(400).json({ success: false, error: "Teléfono inválido." });
    }

    const slug           = await generarSlugUnico(business_name.trim());
    const hashedPassword = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const fechaVencimiento = calcularVencimiento(DIAS_PRUEBA);

    const { data, error } = await supabase.from("usuarios").insert([{
      nombre_persona:     nombre_persona.trim(),
      apellido:           apellido?.trim() || "",
      email:              email.trim().toLowerCase(),
      telefono:           telefono ? cleanPhone(telefono) : null,
      business_name:      business_name.trim(),
      slug,
      password:           hashedPassword,
      rubro,
      metodo_pago:        "none",
      porcentaje_sena:    30,
      excepciones:        [],
      activo:             true,
      estado_suscripcion: "trial",
      fecha_vencimiento:  fechaVencimiento,
    }]).select("id, slug, business_name, rubro, email, nombre_persona, apellido, estado_suscripcion, fecha_vencimiento").single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ success: false, error: "El email ya está registrado." });
      }
      throw error;
    }

    console.log(`✅ Negocio creado (admin): ${slug} (${rubro}) — vence: ${fechaVencimiento}`);
    res.status(201).json({
      success:   true,
      negocio:   data,
      panel_url: `${PANEL_URL}?u=${slug}`,
    });
  } catch (e) {
    console.error("Error en POST /superadmin/negocios:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /superadmin/negocios
 */
app.get("/superadmin/negocios", requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, slug, business_name, rubro, nombre_persona, apellido, email, telefono, activo, metodo_pago, mp_access_token, mobbex_api_key, estado_suscripcion, fecha_vencimiento, created_at")
      .order("business_name", { ascending: true });

    if (error) throw error;

    const negocios = (data || []).map((u) => ({
      id:                 u.id,
      slug:               u.slug,
      business_name:      u.business_name,
      rubro:              u.rubro,
      nombre_persona:     u.nombre_persona,
      apellido:           u.apellido,
      email:              u.email,
      telefono:           u.telefono,
      activo:             u.activo,
      metodo_pago:        u.metodo_pago,
      tiene_mp:           !!u.mp_access_token,
      tiene_mobbex:       !!u.mobbex_api_key,
      estado_suscripcion: u.estado_suscripcion || "trial",
      fecha_vencimiento:  u.fecha_vencimiento,
      dias_restantes:     u.fecha_vencimiento ? diasHastaVencer(u.fecha_vencimiento) : null,
      creado:             u.created_at,
    }));

    res.json({ success: true, negocios, total: negocios.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /superadmin/negocios/:slug
 */
app.get("/superadmin/negocios/:slug", requireAdminKey, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const { data: negocio, error } = await supabase
      .from("usuarios")
      .select("id, slug, business_name, rubro, nombre_persona, apellido, email, telefono, activo, metodo_pago, porcentaje_sena, quien_asume_comision, duracion_turno, capacidad_por_turno, horarios, excepciones, notas_internas, mp_access_token, mobbex_api_key, estado_suscripcion, fecha_vencimiento, created_at")
      .eq("slug", slug).single();

    if (error || !negocio) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const { data: servicios } = await supabase
      .from("servicios").select("id, nombre, descripcion, precio, duracion, capacidad, activo, orden")
      .eq("slug", slug).order("orden", { ascending: true });

    res.json({
      success: true,
      negocio: {
        ...negocio,
        tiene_mp:            !!negocio.mp_access_token,
        tiene_mobbex:        !!negocio.mobbex_api_key,
        dias_restantes:      negocio.fecha_vencimiento ? diasHastaVencer(negocio.fecha_vencimiento) : null,
        mp_access_token:     undefined,
        mobbex_api_key:      undefined,
        mobbex_access_token: undefined,
      },
      servicios: servicios || [],
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PUT /superadmin/negocios/:slug
 */
app.put("/superadmin/negocios/:slug", requireAdminKey, async (req, res) => {
  try {
    const slug    = cleanSlug(req.params.slug);
    const allowed = [
      "nombre_persona", "apellido", "email", "telefono",
      "business_name", "rubro", "activo", "notas_internas",
      "duracion_turno", "capacidad_por_turno",
      "estado_suscripcion", "fecha_vencimiento",
    ];
    const update = {};

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });

    // Superadmin puede cambiar el slug manualmente
    if (req.body.nuevo_slug) {
      update.slug = cleanSlug(req.body.nuevo_slug);
    }

    if (req.body.password) {
      update.password = await bcrypt.hash(String(req.body.password), BCRYPT_ROUNDS);
    }

    if (req.body.sumar_dias && !isNaN(parseInt(req.body.sumar_dias))) {
      const { data: actual } = await supabase.from("usuarios").select("fecha_vencimiento").eq("slug", slug).single();
      const base = actual?.fecha_vencimiento && new Date(actual.fecha_vencimiento) > new Date()
        ? actual.fecha_vencimiento
        : null;
      update.fecha_vencimiento  = calcularVencimiento(parseInt(req.body.sumar_dias), base);
      update.estado_suscripcion = "activo";
    }

    const { error } = await supabase.from("usuarios").update(update).eq("slug", slug);
    if (error) throw error;
    invalidateCache(slug);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * DELETE /superadmin/negocios/:slug — soft delete
 */
app.delete("/superadmin/negocios/:slug", requireAdminKey, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const { error } = await supabase.from("usuarios").update({ activo: false }).eq("slug", slug);
    if (error) throw error;
    invalidateCache(slug);
    res.json({ success: true, message: `Negocio ${slug} desactivado.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════

/**
 * POST /login
 * Body: { slug, password }  (también acepta "email" como alternativa al slug)
 */
app.post("/login", async (req, res) => {
  try {
    const rawSlug  = cleanSlug(req.body.slug || req.body.dominio || "");
    const email    = req.body.email?.trim().toLowerCase() || "";
    const password = req.body.password;

    if ((!rawSlug && !email) || !password) {
      return res.status(400).json({ success: false, error: "Faltan slug (o email) y contraseña." });
    }

    let query = supabase
      .from("usuarios")
      .select("id, slug, password, business_name, nombre_persona, apellido, email, rubro, activo, estado_suscripcion, fecha_vencimiento");

    query = rawSlug ? query.eq("slug", rawSlug) : query.eq("email", email);

    const { data: user, error } = await query.single();

    if (error || !user) return res.status(401).json({ success: false, error: "Credenciales incorrectas." });
    if (!user.activo)   return res.status(403).json({ success: false, error: "Este negocio está desactivado." });

    const passwordOk = String(user.password) === String(password);

    if (!passwordOk) return res.status(401).json({ success: false, error: "Credenciales incorrectas." });

    const secret = process.env.JWT_SECRET;
    if (!secret)  return res.status(500).json({ success: false, error: "JWT_SECRET no configurado." });

    const token = jwt.sign(
      { slug: user.slug, negocioId: user.id, rol: "owner" },
      secret,
      { expiresIn: JWT_EXPIRY }
    );

    const diasRestantes      = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estadoSuscripcion  = user.estado_suscripcion || "trial";
    const alertaVencimiento  = diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0;
    const suscripcionVencida = diasRestantes !== null && diasRestantes <= 0;

    res.json({
      success:        true,
      token,
      slug:           user.slug,
      business_name:  user.business_name,
      nombre_persona: user.nombre_persona,
      apellido:       user.apellido || "",
      email:          user.email,
      rubro:          user.rubro,
      suscripcion: {
        estado:            estadoSuscripcion,
        fecha_vencimiento: user.fecha_vencimiento,
        dias_restantes:    diasRestantes,
        alerta:            alertaVencimiento,
        vencida:           suscripcionVencida,
      },
    });
  } catch (e) {
    console.error("Error en /login:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /verify-session
 */
app.get("/verify-session", async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1] || req.query.token;
    if (!token) return res.json({ active: false, reason: "no_token" });

    const secret = process.env.JWT_SECRET;
    const payload = jwt.verify(token, secret);

    const { data: user } = await supabase
      .from("usuarios")
      .select("slug, business_name, email, nombre_persona, activo, estado_suscripcion, fecha_vencimiento")
      .eq("slug", payload.slug)
      .single();

    if (!user || !user.activo) return res.json({ active: false, reason: "not_found" });

    res.json({ active: true, slug: user.slug, business_name: user.business_name, email: user.email });
  } catch (e) {
    res.json({ active: false, reason: "invalid_token" });
  }
});

app.post("/debug-login", async (req, res) => {
  const { email, password } = req.body;
  const { data: user } = await supabase
    .from("usuarios")
    .select("email, password, activo")
    .eq("email", email)
    .single();
  
  res.json({
    user_encontrado: !!user,
    activo: user?.activo,
    password_en_db: user?.password,
    password_recibido: password,
    son_iguales: String(user?.password) === String(password)
  });
});

/**
 * POST /api/request-password-reset
 */
app.post("/api/request-password-reset", limiterAuth, async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)         return res.status(400).json({ success: false, error: "Faltan datos." });
    if (!validatePassword(newPassword)) return res.status(400).json({ success: false, error: "Mínimo 6 caracteres." });

    const { data: user } = await supabase.from("usuarios").select("slug").eq("email", email.trim().toLowerCase()).single();
    if (!user) return res.json({ success: true }); // silencioso por seguridad

    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "resetPassword", email: email.trim().toLowerCase(), newPassword }),
    });
    const text   = await googleRes.text();
    const result = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
    res.json(result.status === "success" ? { success: true } : { success: false, error: result.message });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/verify-and-reset-password", limiterAuth, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, error: "Faltan datos." });

    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "verifyCode", email: email.trim().toLowerCase(), code: code.toString().trim() }),
    });
    const result = await googleRes.json();
    if (result.status !== "valid") return res.status(400).json({ success: false, error: "Código incorrecto o expirado." });

    const hashedPassword = await bcrypt.hash(String(result.password), BCRYPT_ROUNDS);
    const { error } = await supabase.from("usuarios").update({ password: hashedPassword }).eq("email", email.trim().toLowerCase());
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// NEGOCIO PÚBLICO (para la landing del cliente)
// ══════════════════════════════════════════════════════════════

/**
 * GET /negocio/:slug
 */
app.get("/negocio/:slug", async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("slug, business_name, rubro, horarios, excepciones, duracion_turno, capacidad_por_turno, metodo_pago, porcentaje_sena, mp_access_token, mobbex_api_key, quien_asume_comision, activo, estado_suscripcion, fecha_vencimiento")
      .eq("slug", slug)
      .single();

    if (error || !user)  return res.status(404).json({ success: false, error: "Negocio no encontrado." });
    if (!user.activo)    return res.status(404).json({ success: false, error: "Negocio no disponible." });

    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = (user.estado_suscripcion === "suspendido") || (diasRestantes !== null && diasRestantes <= 0);

    if (estaSuspendido) {
      if (user.estado_suscripcion !== "suspendido") {
        supabase.from("usuarios").update({ estado_suscripcion: "suspendido" }).eq("slug", slug).then(() => {});
      }
      return res.json({
        success:    true,
        suspendido: true,
        negocio: {
          slug:          user.slug,
          business_name: user.business_name,
          rubro:         user.rubro,
        },
      });
    }

    res.json({
      success: true,
      negocio: {
        slug:                 user.slug,
        business_name:        user.business_name,
        rubro:                user.rubro,
        horarios:             user.horarios || {},
        excepciones:          user.excepciones || [],
        duracion_turno:       user.duracion_turno || 30,
        capacidad_por_turno:  user.capacidad_por_turno || 1,
        metodo_pago:          user.metodo_pago || "none",
        porcentaje_sena:      user.porcentaje_sena || 30,
        tiene_mp:             !!user.mp_access_token,
        tiene_mobbex:         !!user.mobbex_api_key,
        quien_asume_comision: user.quien_asume_comision || "cliente",
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// SLOTS DISPONIBLES
// ══════════════════════════════════════════════════════════════

/**
 * GET /slots-disponibles/:slug?fecha=YYYY-MM-DD&servicio_id=...
 */
app.get("/slots-disponibles/:slug", async (req, res) => {
  try {
    const slug                   = cleanSlug(req.params.slug);
    const { fecha, servicio_id } = req.query;

    if (!slug || !fecha) return res.status(400).json({ success: false, error: "Faltan slug o fecha." });

    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("horarios, duracion_turno, capacidad_por_turno, excepciones, activo, estado_suscripcion, fecha_vencimiento")
      .eq("slug", slug)
      .single();

    if (userError || !user || !user.activo) {
      return res.status(404).json({ success: false, error: "Negocio no encontrado." });
    }

    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = (user.estado_suscripcion === "suspendido") || (diasRestantes !== null && diasRestantes <= 0);
    if (estaSuspendido) return res.json({ success: true, slots: [], suspendido: true });

    let duracion  = user.duracion_turno       || 30;
    let capacidad = user.capacidad_por_turno  || 1;

    if (servicio_id) {
      const { data: srv } = await supabase
        .from("servicios")
        .select("duracion, capacidad")
        .eq("id", servicio_id)
        .eq("slug", slug)
        .single();
      if (srv) {
        duracion  = srv.duracion  || duracion;
        capacidad = srv.capacidad || capacidad;
      }
    }

    const excepcionesArr = user.excepciones || [];
    const estaExceptuado = Array.isArray(excepcionesArr)
      ? excepcionesArr.some((e) =>
          typeof e === "string" ? e === fecha : e?.fecha === fecha && e?.type === "block"
        )
      : false;
    if (estaExceptuado) return res.json({ success: true, slots: [] });

    const diasSemana = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const diaConfig  = user.horarios?.[diasSemana[new Date(fecha + "T12:00:00").getDay()]];
    if (!diaConfig?.activo) return res.json({ success: true, slots: [] });

    const toMin   = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const fromMin = (m) => `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;

    const inicio = toMin(diaConfig.jornada[0]);
    const fin    = toMin(diaConfig.jornada[1]);
    const dIni   = toMin(diaConfig.descanso?.[0]);
    const dFin   = toMin(diaConfig.descanso?.[1]);

    const slotsGenerados = [];
    let cursor = inicio;
    while (cursor + duracion <= fin) {
      if (!(dIni && dFin && cursor >= dIni && cursor < dFin)) slotsGenerados.push(fromMin(cursor));
      cursor += duracion;
    }

    const { data: turnosDia } = await supabase
      .from("turnos")
      .select("hora, estado")
      .eq("slug", slug).eq("fecha", fecha)
      .in("estado", ["confirmado", "pendiente"]);

    const reservasPorSlot = {};
    (turnosDia || []).forEach((t) => {
      const h = t.hora.slice(0, 5);
      reservasPorSlot[h] = (reservasPorSlot[h] || 0) + 1;
    });

    const slots = slotsGenerados.map((slot) => {
      const reservados  = reservasPorSlot[slot] || 0;
      const disponibles = capacidad - reservados;
      return { hora: slot, disponibles: Math.max(0, disponibles), lleno: disponibles <= 0 };
    });

    res.json({ success: true, slots });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// TURNOS — RESERVA PÚBLICA (sin login)
// ══════════════════════════════════════════════════════════════

/**
 * GET /turnos/ocupados?slug=...&fecha=...
 */
app.get("/turnos/ocupados", async (req, res) => {
  try {
    const slug  = cleanSlug(req.query.slug || req.query.dominio || "");
    const fecha = req.query.fecha;
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });

    let q = supabase.from("turnos").select("hora").eq("slug", slug).neq("estado", "cancelado");
    if (fecha) q = q.eq("fecha", fecha);

    const { data, error } = await q;
    if (error) throw error;

    res.json({ success: true, ocupados: (data || []).map((t) => t.hora.slice(0, 5)) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /turnos/reservar
 */
app.post("/turnos/reservar", limiterBooking, async (req, res) => {
  try {
    const { name, phone, email, fecha, hora, slug, dominio, servicio_id } = req.body;
    const slugClean = cleanSlug(slug || dominio || "");

    if (!name || !phone || !fecha || !hora || !slugClean) {
      return res.status(400).json({ success: false, error: "Faltan datos requeridos." });
    }

    const phoneClean = cleanPhone(phone.toString());
    if (!validatePhone(phoneClean)) {
      return res.status(400).json({ success: false, error: "Teléfono inválido (7-15 dígitos)." });
    }
    if (email && !validateEmail(email)) {
      return res.status(400).json({ success: false, error: "Email inválido." });
    }

    const { data: user, error: userError } = await supabase
      .from("usuarios").select("*").eq("slug", slugClean).single();
    if (userError || !user)  return res.status(404).json({ success: false, error: "Negocio no encontrado." });
    if (!user.activo)        return res.status(404).json({ success: false, error: "Negocio no disponible." });

    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = (user.estado_suscripcion === "suspendido") || (diasRestantes !== null && diasRestantes <= 0);
    if (estaSuspendido) {
      return res.status(403).json({ success: false, error: "Este servicio está pausado temporalmente." });
    }

    const requierePago = (user.mp_access_token || user.mobbex_api_key)
      && (user.metodo_pago === "sena" || user.metodo_pago === "total");
    if (requierePago) {
      return res.status(403).json({ success: false, error: "Este turno requiere pago previo." });
    }

    const hoy = new Date().toISOString().split("T")[0];
    const { data: turnosExistentes } = await supabase
      .from("turnos").select("id")
      .eq("slug", slugClean).gte("fecha", hoy).neq("estado", "cancelado")
      .or(`telefono.eq.${phoneClean}${email ? `,email.eq.${email.trim().toLowerCase()}` : ""}`);

    if (turnosExistentes?.length > 0) {
      return res.status(400).json({ success: false, error: "Ya tenés un turno agendado activo." });
    }

    let capacidad      = user.capacidad_por_turno || 1;
    let servicioNombre = null;
    let precioCobrado  = 0;

    if (servicio_id) {
      const { data: srv } = await supabase
        .from("servicios").select("nombre, capacidad, precio")
        .eq("id", servicio_id).single();
      if (srv) {
        servicioNombre = srv.nombre;
        capacidad      = srv.capacidad || capacidad;
        precioCobrado  = Number(srv.precio || 0);
      }
    }

    const { count } = await supabase.from("turnos")
      .select("id", { count: "exact" })
      .eq("slug", slugClean).eq("fecha", fecha).eq("hora", hora).neq("estado", "cancelado");

    if (count >= capacidad) {
      return res.status(400).json({ success: false, error: "Este turno ya está lleno." });
    }

    const { data: turno, error: turnoError } = await supabase.from("turnos").insert([{
      slug:            slugClean,
      nombre:          name.trim(),
      telefono:        phoneClean,
      email:           email?.trim().toLowerCase() || null,
      fecha,
      hora,
      servicio_id:     servicio_id || null,
      servicio_nombre: servicioNombre,
      precio_cobrado:  precioCobrado,
      estado:          "confirmado",
      metodo_pago:     "none",
    }]).select().single();

    if (turnoError) throw turnoError;

    fetch(APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action:        "newAppointmentEmail",
        nombreCliente: name.trim(),
        fechaHora:     `${fecha} ${hora}`,
        adminEmail:    user.email,
        emailCliente:  email?.trim() || "",
      }),
    }).catch((e) => console.error("Error mail booking:", e.message));

    invalidateCache(slugClean);
    res.json({ success: true, turno_id: turno.id, message: "Turno creado con éxito." });
  } catch (e) {
    console.error("Error en /turnos/reservar:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * PUT /turnos/:id — dueño actualiza estado o notas
 */
app.put("/turnos/:id", requireAuth, async (req, res) => {
  try {
    const { id }       = req.params;
    const { estado, notas, slug, dominio } = req.body;
    const slugClean    = cleanSlug(slug || dominio || req.auth.slug);

    const estadosValidos = ["confirmado", "pendiente", "cancelado", "completado", "no_asistio"];
    if (estado && !estadosValidos.includes(estado)) {
      return res.status(400).json({ success: false, error: `Estado inválido. Valores posibles: ${estadosValidos.join(", ")}` });
    }

    const update = {};
    if (estado !== undefined) update.estado = estado;
    if (notas  !== undefined) update.notas  = notas;

    const { data, error } = await supabase
      .from("turnos").update(update).eq("id", id).eq("slug", slugClean).select().single();

    if (error) throw error;
    invalidateCache(slugClean);
    res.json({ success: true, turno: data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// SERVICIOS
// ══════════════════════════════════════════════════════════════

/** GET /servicios/:slug — público */
app.get("/servicios/:slug", async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });

    const { data, error } = await supabase
      .from("servicios")
      .select("id, nombre, descripcion, duracion, precio, capacidad")
      .eq("slug", slug).eq("activo", true)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ success: true, servicios: data || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /admin/servicios/:slug — lista completa (con inactivos) */
app.get("/admin/servicios/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const { data, error } = await supabase
      .from("servicios").select("*").eq("slug", slug)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ success: true, servicios: data || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /admin/servicios — crear */
app.post("/admin/servicios", requireAuth, async (req, res) => {
  try {
    const { slug, dominio, nombre, descripcion, duracion, precio, capacidad, orden } = req.body;
    const slugClean = cleanSlug(slug || dominio || req.auth.slug);

    if (!slugClean || !nombre || !duracion || precio === undefined) {
      return res.status(400).json({ success: false, error: "Faltan campos: nombre, duracion, precio." });
    }

    const { data, error } = await supabase.from("servicios").insert([{
      slug:        slugClean,
      nombre:      nombre.trim(),
      descripcion: descripcion?.trim() || "",
      duracion:    parseInt(duracion),
      precio:      Number(precio),
      capacidad:   parseInt(capacidad) || 1,
      orden:       parseInt(orden) || 0,
      activo:      true,
    }]).select().single();

    if (error) throw error;
    invalidateCache(slugClean);
    res.status(201).json({ success: true, servicio: data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** PUT /admin/servicios/:id — editar */
app.put("/admin/servicios/:id", requireAuth, async (req, res) => {
  try {
    const { id }       = req.params;
    const slugClean    = cleanSlug(req.body.slug || req.body.dominio || req.auth.slug);
    const { nombre, descripcion, duracion, precio, capacidad, activo, orden } = req.body;

    const u = {};
    if (nombre      !== undefined) u.nombre      = nombre.trim();
    if (descripcion !== undefined) u.descripcion = descripcion.trim();
    if (duracion    !== undefined) u.duracion    = parseInt(duracion);
    if (precio      !== undefined) u.precio      = Number(precio);
    if (capacidad   !== undefined) u.capacidad   = parseInt(capacidad);
    if (activo      !== undefined) u.activo      = activo;
    if (orden       !== undefined) u.orden       = parseInt(orden);

    const { data, error } = await supabase
      .from("servicios").update(u).eq("id", id).eq("slug", slugClean).select().single();

    if (error) throw error;
    invalidateCache(slugClean);
    res.json({ success: true, servicio: data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** DELETE /admin/servicios/:id — eliminar */
app.delete("/admin/servicios/:id", requireAuth, async (req, res) => {
  try {
    const { id }    = req.params;
    const slugClean = cleanSlug(req.body?.slug || req.query?.slug || req.body?.dominio || req.query?.dominio || req.auth.slug);

    const { error } = await supabase.from("servicios").delete().eq("id", id).eq("slug", slugClean);
    if (error) throw error;
    invalidateCache(slugClean);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// AGENDA — Vista agrupada por fecha (próximos 30 días)
// ══════════════════════════════════════════════════════════════

app.get("/agenda/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);

    const ahoraArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const hoyISO   = ahoraArg.toISOString().split("T")[0];
    const hasta    = new Date(ahoraArg);
    hasta.setDate(hasta.getDate() + 30);
    const hastaISO = hasta.toISOString().split("T")[0];

    const { data: turnos, error } = await supabase
      .from("turnos").select("*")
      .eq("slug", slug)
      .gte("fecha", hoyISO).lte("fecha", hastaISO)
      .neq("estado", "cancelado")
      .order("fecha", { ascending: true })
      .order("hora",  { ascending: true });

    if (error) throw error;

    const porFecha = {};
    (turnos || []).forEach((t) => {
      if (!porFecha[t.fecha]) porFecha[t.fecha] = [];
      porFecha[t.fecha].push({
        id:             t.id,
        nombre:         t.nombre,
        hora:           t.hora.slice(0, 5),
        servicio:       t.servicio_nombre || null,
        precio_cobrado: t.precio_cobrado  || 0,
        estado:         t.estado,
        email:          t.email,
        telefono:       t.telefono,
        notas:          t.notas || null,
      });
    });

    const dias = Object.keys(porFecha).sort().map((fecha) => ({
      fecha,
      esHoy:  fecha === hoyISO,
      turnos: porFecha[fecha],
    }));

    res.json({ success: true, hoy: hoyISO, dias });
  } catch (e) {
    console.error("Error en /agenda/:slug:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// COBROS — Lista de ventas del negocio
// ══════════════════════════════════════════════════════════════

app.get("/cobros/:slug", requireAuth, async (req, res) => {
  try {
    const slug   = cleanSlug(req.params.slug);
    const limite = parseInt(req.query.limite) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const { data: ventas, error, count } = await supabase
      .from("ventas").select("*", { count: "exact" })
      .eq("slug", slug)
      .order("fecha_pago", { ascending: false })
      .range(offset, offset + limite - 1);

    if (error) throw error;

    const cobros = (ventas || []).map((v) => ({
      id:               v.id,
      monto:            v.monto,
      moneda:           v.moneda || "ARS",
      metodo_pago:      v.metodo_pago,
      estado:           v.estado,
      nombre_cliente:   v.nombre_cliente,
      email_cliente:    v.email_cliente,
      telefono_cliente: v.telefono_cliente,
      servicio_nombre:  v.servicio_nombre,
      fecha_turno:      v.fecha_turno,
      fecha_pago:       v.fecha_pago,
      payment_id:       v.payment_id,
    }));

    res.json({ success: true, cobros, total: count || 0, offset, limite });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// CLIENTES — CRM básico
// ══════════════════════════════════════════════════════════════

app.get("/clientes/:slug", requireAuth, async (req, res) => {
  try {
    const slug   = cleanSlug(req.params.slug);
    const limite = parseInt(req.query.limite) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const { data: turnos, error } = await supabase
      .from("turnos").select("nombre, email, telefono, fecha, created_at")
      .eq("slug", slug).neq("estado", "cancelado")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const clientesMap = {};
    (turnos || []).forEach((t) => {
      const key = t.telefono || t.email || t.nombre;
      if (!clientesMap[key]) {
        clientesMap[key] = {
          nombre:      t.nombre,
          email:       t.email    || null,
          telefono:    t.telefono || null,
          turnos:      0,
          ultimoTurno: t.fecha,
          primerTurno: t.fecha,
        };
      }
      clientesMap[key].turnos += 1;
      if (t.fecha > clientesMap[key].ultimoTurno) clientesMap[key].ultimoTurno = t.fecha;
      if (t.fecha < clientesMap[key].primerTurno) clientesMap[key].primerTurno = t.fecha;
    });

    const clientesArr = Object.values(clientesMap)
      .map((c) => ({ ...c, frecuencia: calcularFrecuencia(c.turnos) }))
      .sort((a, b) => b.turnos - a.turnos);

    res.json({
      success: true,
      clientes: clientesArr.slice(offset, offset + limite),
      total:    clientesArr.length,
      offset,
      limite,
      stats: {
        concurrentes:   clientesArr.filter((c) => c.frecuencia === "Concurrente").length,
        regulares:      clientesArr.filter((c) => c.frecuencia === "Regular").length,
        pocoFrecuentes: clientesArr.filter((c) => c.frecuencia === "Poco Frecuente").length,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// SETTINGS — Configuración del negocio
// ══════════════════════════════════════════════════════════════

app.get("/settings/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const { data: user, error } = await supabase
      .from("usuarios")
      .select("slug, business_name, rubro, nombre_persona, apellido, email, telefono, duracion_turno, capacidad_por_turno, metodo_pago, porcentaje_sena, quien_asume_comision, horarios, excepciones, mp_access_token, mobbex_api_key, notas_internas, estado_suscripcion, fecha_vencimiento")
      .eq("slug", slug).single();

    if (error || !user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const diasRestantes = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;

    res.json({
      success: true,
      settings: {
        ...user,
        mp_status:           user.mp_access_token ? "Conectado" : "Desconectado",
        mobbex_status:       user.mobbex_api_key  ? "Conectado" : "Desconectado",
        mp_access_token:     undefined,
        mobbex_api_key:      undefined,
        mobbex_access_token: undefined,
        dias_restantes:      diasRestantes,
        alerta_vencimiento:  diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const handleUpdateSettings = async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug || req.body.slug || req.body.dominio);
    const {
      horarios, duracion_turno, excepciones,
      porcentaje_sena, metodo_pago, quien_asume_comision,
      capacidad_por_turno, business_name, telefono, rubro,
    } = req.body;

    const u = {};
    if (metodo_pago)               u.metodo_pago         = metodo_pago;
    if (porcentaje_sena !== undefined && !isNaN(parseInt(porcentaje_sena))) {
      u.porcentaje_sena = Math.min(100, Math.max(1, parseInt(porcentaje_sena)));
    }
    if (duracion_turno)            u.duracion_turno      = parseInt(duracion_turno);
    if (capacidad_por_turno)       u.capacidad_por_turno = parseInt(capacidad_por_turno);
    if (quien_asume_comision)      u.quien_asume_comision= quien_asume_comision;
    if (horarios)                  u.horarios            = horarios;
    if (excepciones !== undefined) u.excepciones         = excepciones;
    if (business_name)             u.business_name       = business_name.trim();
    if (telefono)                  u.telefono            = telefono.trim();
    if (rubro)                     u.rubro               = rubro;

    const { error } = await supabase.from("usuarios").update(u).eq("slug", slug);
    if (error) throw error;
    invalidateCache(slug);
    res.json({ success: true, message: "Configuración actualizada." });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

app.post("/settings/:slug", requireAuth, handleUpdateSettings);
app.put("/settings/:slug",  requireAuth, handleUpdateSettings);


// ══════════════════════════════════════════════════════════════
// ADMIN STATS — Dashboard principal del dueño
// ══════════════════════════════════════════════════════════════

app.get("/admin-stats/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });

    const now = Date.now();
    if (globalCache[slug] && now - globalCache[slug].timestamp < CACHE_DURATION) {
      return res.json(globalCache[slug].data);
    }

    const { data: user, error: userError } = await supabase
      .from("usuarios").select("*").eq("slug", slug).single();
    if (userError || !user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const ahoraArg   = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const anioActual = ahoraArg.getFullYear();
    const mesActual  = ahoraArg.getMonth() + 1;
    const diaHoyNum  = ahoraArg.getDate();
    const hoyISO     = `${anioActual}-${String(mesActual).padStart(2, "0")}-${String(diaHoyNum).padStart(2, "0")}`;
    const inicioMes  = `${anioActual}-${String(mesActual).padStart(2, "0")}-01`;

    const { data: turnosMes } = await supabase
      .from("turnos").select("*")
      .eq("slug", slug).gte("fecha", inicioMes).neq("estado", "cancelado")
      .order("fecha", { ascending: true }).order("hora", { ascending: true });

    const turnosData     = turnosMes || [];
    const turnosHoy      = turnosData.filter((t) => t.fecha === hoyISO).length;
    const turnosMesTotal = turnosData.length;

    const semanas = { "Sem 1": 0, "Sem 2": 0, "Sem 3": 0, "Sem 4": 0 };
    turnosData.forEach((t) => {
      const dia = parseInt(t.fecha.split("-")[2]);
      if      (dia <= 7)  semanas["Sem 1"]++;
      else if (dia <= 14) semanas["Sem 2"]++;
      else if (dia <= 21) semanas["Sem 3"]++;
      else                semanas["Sem 4"]++;
    });

    const turnosLista = turnosData.map((t) => ({
      id:             t.id,
      nombre:         t.nombre,
      telefono:       t.telefono,
      email:          t.email,
      fecha:          t.fecha,
      hora:           t.hora.slice(0, 5),
      servicio:       t.servicio_nombre,
      precio_cobrado: t.precio_cobrado || 0,
      estado:         t.estado,
      notas:          t.notas || null,
      duracion:       user.duracion_turno || 30,
    })).reverse();

    const turnosHoyDetalle = turnosData
      .filter((t) => t.fecha === hoyISO)
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((t) => ({
        id:      t.id,
        nombre:  t.nombre,
        hora:    t.hora.slice(0, 5),
        servicio: t.servicio_nombre,
        estado:  t.estado,
      }));

    const desde90 = new Date(ahoraArg); desde90.setDate(desde90.getDate() - 90);
    const hasta7  = new Date(ahoraArg); hasta7.setDate(hasta7.getDate() + 7);
    const { data: ventasData } = await supabase
      .from("ventas").select("*").eq("slug", slug)
      .gte("fecha_turno", desde90.toISOString().split("T")[0])
      .lte("fecha_turno", hasta7.toISOString().split("T")[0])
      .order("fecha_pago", { ascending: true });

    const metricas  = agruparVentas(ventasData || [], hoyISO);
    const mesKey    = `${anioActual}-${String(mesActual).padStart(2, "0")}`;
    const ventasHoy = metricas.porDia[hoyISO] || { volumen: 0, cantidad: 0, aprobado: 0, pendiente: 0, rechazado: 0 };
    const ventasMes = metricas.porMes.find((m) => m.label === mesKey) || { volumen: 0, cantidad: 0 };

    const proximosDias = generarRangoDias(hoyISO, 7).map((fecha) => ({
      fecha,
      ...(metricas.porDia[fecha] || { volumen: 0, cantidad: 0, aprobado: 0, pendiente: 0, rechazado: 0 }),
    }));

    const { data: todosLosTurnos } = await supabase
      .from("turnos").select("telefono, email, created_at")
      .eq("slug", slug).neq("estado", "cancelado");

    const clientesUnicos = new Set();
    const clientesMesSet = new Set();
    const inicioMesDate  = new Date(inicioMes + "T00:00:00");

    (todosLosTurnos || []).forEach((t) => {
      const key = t.telefono || t.email?.toLowerCase();
      if (key) {
        clientesUnicos.add(key);
        if (new Date(t.created_at) >= inicioMesDate) clientesMesSet.add(key);
      }
    });

    const ventasPorDia = {};
    generarRangoDias(inicioMes, diaHoyNum).forEach((d) => {
      ventasPorDia[d] = metricas.porDia[d] || { volumen: 0, cantidad: 0, aprobado: 0, pendiente: 0, rechazado: 0 };
    });

    const diasRestantes      = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estadoSuscripcion  = user.estado_suscripcion || "trial";
    const alertaVencimiento  = diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0;
    const suscripcionVencida = diasRestantes !== null && diasRestantes <= 0;

    const finalData = {
      turnosHoy,
      turnosMes:       turnosMesTotal,
      turnosHoyDetalle,
      chartData:       Object.keys(semanas).map((k) => ({ label: k, turnos: semanas[k] })),
      turnosLista,

      totalClientes:        clientesUnicos.size,
      clientesNuevos:       clientesMesSet.size,
      clientesConcurrentes: Math.floor(clientesUnicos.size * 0.4),

      ventas: {
        volumenTotal:   metricas.volumenTotal,
        volumenHoy:     ventasHoy.volumen,
        volumenMes:     ventasMes.volumen  || 0,
        ticketPromedio: metricas.ticketPromedio,
        cantidadTotal:  metricas.cantidadTotal,
        cantidadHoy:    ventasHoy.cantidad,
        cantidadMes:    ventasMes.cantidad || 0,
        estados: {
          aprobado:  metricas.porEstado.aprobado  || 0,
          pendiente: metricas.porEstado.pendiente || 0,
          rechazado: metricas.porEstado.rechazado || 0,
        },
      },

      ventasPorDia,
      ventasPorSem:  metricas.porSemana,
      ventasPorMes:  metricas.porMes,
      proximosDias,

      horarios:      user.horarios,
      config: {
        duracion:             user.duracion_turno      || 30,
        capacidad_por_turno:  user.capacidad_por_turno || 1,
        metodo_pago:          user.metodo_pago         || "none",
        porcentaje_sena:      user.porcentaje_sena     || 30,
        quien_asume_comision: user.quien_asume_comision|| "cliente",
        mp_status:            user.mp_access_token ? "Conectado" : "Desconectado",
        mobbex_status:        user.mobbex_api_key  ? "Conectado" : "Desconectado",
        excepciones:          user.excepciones     || [],
      },

      suscripcion: {
        estado:            suscripcionVencida ? "suspendido" : estadoSuscripcion,
        fecha_vencimiento: user.fecha_vencimiento,
        dias_restantes:    diasRestantes,
        alerta:            alertaVencimiento,
        vencida:           suscripcionVencida,
        precio_renovacion: PRECIO_SUSCRIPCION,
      },

      businessName:   user.business_name,
      nombre_persona: user.nombre_persona,
      apellido:       user.apellido || "",
      slug:           user.slug,
      rubro:          user.rubro || "generico",
    };

    globalCache[slug] = { timestamp: now, data: finalData };
    res.json(finalData);
  } catch (e) {
    console.error("Error en /admin-stats:", e.message);
    res.status(500).json({ success: false, error: "Error al procesar estadísticas." });
  }
});


// ══════════════════════════════════════════════════════════════
// PAGOS — Mercado Pago + Mobbex (pagos de turnos del cliente)
// ══════════════════════════════════════════════════════════════

app.post("/api/create-preference", limiterBooking, async (req, res) => {
  try {
    const { nombre, telefono, email, fecha, hora, slug, dominio, servicio_id } = req.body;
    const slugClean = cleanSlug(slug || dominio || "");

    if (!nombre || !telefono || !fecha || !hora || !slugClean) {
      return res.status(400).json({ success: false, error: "Faltan datos requeridos." });
    }
    if (email && !validateEmail(email)) {
      return res.status(400).json({ success: false, error: "Email inválido." });
    }

    const { data: user, error: userError } = await supabase
      .from("usuarios").select("*").eq("slug", slugClean).single();
    if (userError || !user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = (user.estado_suscripcion === "suspendido") || (diasRestantes !== null && diasRestantes <= 0);
    if (estaSuspendido) {
      return res.status(403).json({ success: false, error: "Este servicio está pausado temporalmente." });
    }

    let precioServicio = 0;
    let nombreServicio = "Reserva";

    if (servicio_id) {
      const { data: srv } = await supabase
        .from("servicios").select("nombre, precio")
        .eq("id", servicio_id).eq("slug", slugClean).single();
      if (srv) {
        precioServicio = Number(srv.precio || 0);
        nombreServicio = srv.nombre;
      }
    }

    const metodo    = user.metodo_pago || "none";
    const debePagar = metodo === "sena" || metodo === "total";
    if (!debePagar || precioServicio <= 0) return res.json({ isFree: true });

    const montoACobrar = metodo === "sena"
      ? Math.round(precioServicio * (user.porcentaje_sena || 30) / 100)
      : precioServicio;

    const conceptoPago = metodo === "sena"
      ? `Seña ${user.porcentaje_sena || 30}%`
      : "Total";

    const metaMeta = {
      nombre,
      telefono:        cleanPhone(telefono),
      email:           email || "",
      fecha,
      hora,
      slug:            slugClean,
      servicio_id:     servicio_id || "",
      servicio_nombre: nombreServicio,
      metodo_pago:     metodo,
      precio_servicio: precioServicio,
    };

    const successUrl = process.env.SUCCESS_URL || `${API_URL}/success`;
    const cancelUrl  = process.env.CANCEL_URL  || `${API_URL}/error`;

    // MOBBEX (prioridad)
    if (user.mobbex_api_key && user.mobbex_access_token) {
      try {
        const mobbexRes = await fetch("https://api.mobbex.com/p/sessions", {
          method: "POST",
          headers: {
            "Content-Type":   "application/json",
            "x-api-key":      user.mobbex_api_key,
            "x-access-token": user.mobbex_access_token,
          },
          body: JSON.stringify({
            total:       montoACobrar,
            currency:    "ARS",
            description: `${nombreServicio} (${conceptoPago}): ${fecha} ${hora}hs`,
            reference:   `${slugClean}-${fecha}-${hora}`.replace(/[:.]/g, ""),
            webhook:     `${API_URL}/webhook/mobbex`,
            return_url:  successUrl,
            items: [{
              image:       "",
              description: `${nombreServicio} (${conceptoPago})`,
              quantity:    1,
              price:       montoACobrar,
            }],
            metadata: metaMeta,
            options:  { button: false, redirect: true },
          }),
        });
        const mobbexData = await mobbexRes.json();
        if (mobbexData?.data?.url) {
          return res.json({ payment_url: mobbexData.data.url, monto: montoACobrar, pasarela: "mobbex" });
        }
        console.warn("⚠️ Mobbex sin URL, fallback a MP:", mobbexData);
      } catch (e) {
        console.error("Error Mobbex, fallback MP:", e.message);
      }
    }

    // MERCADO PAGO (fallback)
    if (user.mp_access_token) {
      try {
        const client = new MercadoPagoConfig({ accessToken: user.mp_access_token });
        const pref   = new Preference(client);

        const response = await pref.create({
          body: {
            items: [{
              title:       `${nombreServicio} (${conceptoPago}): ${fecha} - ${hora}hs`,
              unit_price:  montoACobrar,
              quantity:    1,
              currency_id: "ARS",
            }],
            metadata:         { ...metaMeta, tipo_pago: metodo },
            notification_url: `${API_URL}/webhook/mp`,
            back_urls: { success: successUrl, failure: cancelUrl, pending: cancelUrl },
            auto_return: "approved",
          },
        });

        return res.json({ payment_url: response.init_point, monto: montoACobrar, pasarela: "mercadopago" });
      } catch (e) {
        return res.status(500).json({ success: false, error: "Error con MercadoPago." });
      }
    }

    res.status(400).json({ success: false, error: "Sin pasarela de pago configurada." });
  } catch (e) {
    console.error("Error en /api/create-preference:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// SUSCRIPCIÓN — Checkout de renovación mensual de Associe
// ══════════════════════════════════════════════════════════════

app.post("/api/suscripcion/checkout", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.body.slug || req.body.dominio || req.auth.slug);

    if (!MP_PLATFORM_TOKEN) {
      return res.status(500).json({ success: false, error: "Pasarela de suscripción no configurada. Contactá soporte." });
    }

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("id, email, nombre_persona, apellido, business_name, fecha_vencimiento, estado_suscripcion")
      .eq("slug", slug).single();

    if (error || !user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const client = new MercadoPagoConfig({ accessToken: MP_PLATFORM_TOKEN });
    const pref   = new Preference(client);

    const response = await pref.create({
      body: {
        items: [{
          title:       `Associe — Suscripción mensual (${user.business_name})`,
          unit_price:  PRECIO_SUSCRIPCION,
          quantity:    1,
          currency_id: "ARS",
        }],
        payer: {
          email: user.email,
          name:  `${user.nombre_persona || ""} ${user.apellido || ""}`.trim(),
        },
        metadata: {
          tipo:    "suscripcion_associe",
          slug:    slug,
          user_id: user.id,
        },
        notification_url: `${API_URL}/webhook/suscripcion`,
        back_urls: {
          success: SUSCRIPCION_SUCCESS,
          failure: SUSCRIPCION_CANCEL,
          pending: SUSCRIPCION_CANCEL,
        },
        auto_return: "approved",
      },
    });

    res.json({
      success:     true,
      payment_url: response.init_point,
      monto:       PRECIO_SUSCRIPCION,
    });
  } catch (e) {
    console.error("Error en /api/suscripcion/checkout:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/suscripcion/estado
 */
app.get("/api/suscripcion/estado", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.query.slug || req.query.dominio || req.auth.slug);

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("estado_suscripcion, fecha_vencimiento")
      .eq("slug", slug).single();

    if (error || !user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const diasRestantes      = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const suscripcionVencida = diasRestantes !== null && diasRestantes <= 0;
    const estadoReal         = suscripcionVencida ? "suspendido" : (user.estado_suscripcion || "trial");

    res.json({
      success:           true,
      estado:            estadoReal,
      fecha_vencimiento: user.fecha_vencimiento,
      dias_restantes:    diasRestantes,
      alerta:            diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0,
      vencida:           suscripcionVencida,
      precio_renovacion: PRECIO_SUSCRIPCION,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// OAUTH — Mercado Pago (vinculación del negocio cliente)
// ══════════════════════════════════════════════════════════════

app.get("/oauth-callback", async (req, res) => {
  const { code, state: slug } = req.query;
  if (!code || !slug) return res.status(400).send("Parámetros inválidos.");

  try {
    const slugClean = cleanSlug(slug);
    const response  = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:     process.env.MP_TURNERO_CLIENT_ID,
        client_secret: process.env.MP_TURNERO_CLIENT_SECRET,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  `${API_URL}/oauth-callback`,
      }),
    });
    const data = await response.json();

    if (data.access_token) {
      await supabase.from("usuarios").update({ mp_access_token: data.access_token }).eq("slug", slugClean);
      invalidateCache(slugClean);
      return res.redirect(`${PANEL_URL}?status=mp_success&u=${slugClean}`);
    }
    res.redirect(`${PANEL_URL}?status=mp_error&u=${slugClean}`);
  } catch (e) {
    res.status(500).send("Error al vincular Mercado Pago.");
  }
});


// ══════════════════════════════════════════════════════════════
// WEBHOOKS — Pagos de turnos (MP + Mobbex)
// ══════════════════════════════════════════════════════════════

async function procesarPagoConfirmado({ slug, nombre, telefono, email, fecha, hora, servicio_id, servicio_nombre, monto, moneda, metodo_pago, payment_id, estado }) {
  let turnoId = null;

  if (estado === "aprobado") {
    const { data: turnoInsertado } = await supabase.from("turnos").insert([{
      slug,
      nombre:          nombre?.trim() || "Cliente",
      telefono:        cleanPhone(telefono?.toString() || "0"),
      email:           email?.trim().toLowerCase() || null,
      fecha,
      hora,
      servicio_id:     servicio_id || null,
      servicio_nombre: servicio_nombre || null,
      precio_cobrado:  monto,
      estado:          "confirmado",
      metodo_pago,
      payment_id:      String(payment_id),
    }]).select().single();

    turnoId = turnoInsertado?.id || null;

    const { data: userNegocio } = await supabase.from("usuarios").select("email").eq("slug", slug).single();
    if (userNegocio?.email) {
      fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action:        "newAppointmentEmail",
          nombreCliente: nombre?.trim() || "Cliente",
          fechaHora:     `${fecha} ${hora}`,
          adminEmail:    userNegocio.email,
          emailCliente:  email?.trim() || "",
        }),
      }).catch((e) => console.error("Error mail webhook:", e.message));
    }
  }

  await supabase.from("ventas").insert([{
    slug,
    turno_id:         turnoId,
    fecha_turno:      fecha,
    fecha_pago:       new Date().toISOString(),
    monto,
    moneda:           moneda || "ARS",
    metodo_pago,
    estado,
    nombre_cliente:   nombre?.trim() || "Cliente",
    email_cliente:    email?.trim()  || null,
    telefono_cliente: cleanPhone(telefono?.toString() || ""),
    servicio_id:      servicio_id    || null,
    servicio_nombre:  servicio_nombre || null,
    payment_id:       String(payment_id),
  }]);

  invalidateCache(slug);
}

app.post("/webhook/mp", async (req, res) => {
  const { query, body } = req;
  try {
    if (query.topic === "payment" || body.type === "payment") {
      const paymentId = query.id || body.data?.id;
      if (!paymentId) return res.sendStatus(200);

      const payRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      });
      const payData = await payRes.json();

      const tipoPago = payData.metadata?.tipo || "";
      if (tipoPago === "suscripcion_associe") {
        await procesarPagoSuscripcion(payData);
        return res.sendStatus(200);
      }

      const slug = cleanSlug(payData.metadata?.slug || payData.metadata?.dominio || "");
      if (!slug) return res.sendStatus(200);

      const { data: userNegocio } = await supabase.from("usuarios").select("mp_access_token").eq("slug", slug).single();
      let meta = payData.metadata;
      if (userNegocio?.mp_access_token) {
        const real = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${userNegocio.mp_access_token}` },
        });
        meta = (await real.json()).metadata;
      }

      const estado = payData.status === "approved" ? "aprobado" : payData.status === "pending" ? "pendiente" : "rechazado";
      await procesarPagoConfirmado({
        slug,
        nombre:          meta.nombre,
        telefono:        meta.telefono,
        email:           meta.email,
        fecha:           meta.fecha,
        hora:            meta.hora,
        servicio_id:     meta.servicio_id    || null,
        servicio_nombre: meta.servicio_nombre || null,
        monto:           Number(payData.transaction_amount || 0),
        moneda:          payData.currency_id || "ARS",
        metodo_pago:     "mercadopago",
        payment_id:      paymentId,
        estado,
      });
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("Error en /webhook/mp:", e.message);
    res.sendStatus(200);
  }
});

app.post("/webhook/mobbex", async (req, res) => {
  try {
    const body       = req.body;
    const statusCode = Number(body.status?.code || 0);
    const estado     = statusCode === 200 ? "aprobado" : statusCode >= 300 && statusCode < 400 ? "pendiente" : "rechazado";
    const meta       = body.metadata || {};
    const slug       = cleanSlug(meta.slug || meta.dominio || "");
    const monto      = Number(body.total || 0);
    const paymentId  = body.id || body.payment?.id || "mobbex-" + Date.now();

    if (!slug) return res.sendStatus(200);

    await procesarPagoConfirmado({
      slug,
      nombre:          meta.nombre,
      telefono:        meta.telefono,
      email:           meta.email,
      fecha:           meta.fecha,
      hora:            meta.hora,
      servicio_id:     meta.servicio_id    || null,
      servicio_nombre: meta.servicio_nombre || null,
      monto,
      moneda:          "ARS",
      metodo_pago:     "mobbex",
      payment_id:      paymentId,
      estado,
    });

    res.sendStatus(200);
  } catch (e) {
    console.error("Error en /webhook/mobbex:", e.message);
    res.sendStatus(200);
  }
});


// ══════════════════════════════════════════════════════════════
// WEBHOOK — Pago de suscripción de Associe
// ══════════════════════════════════════════════════════════════

async function procesarPagoSuscripcion(payData) {
  const estado = payData.status === "approved" ? "aprobado" : "rechazado";
  if (estado !== "aprobado") return;

  const slug = cleanSlug(payData.metadata?.slug || payData.metadata?.dominio || "");
  if (!slug) {
    console.error("⚠️ Webhook suscripción: slug no encontrado en metadata.");
    return;
  }

  const { data: user, error } = await supabase
    .from("usuarios")
    .select("id, email, nombre_persona, fecha_vencimiento, estado_suscripcion")
    .eq("slug", slug).single();

  if (error || !user) {
    console.error(`⚠️ Webhook suscripción: negocio no encontrado (${slug}).`);
    return;
  }

  const fechaBase  = user.fecha_vencimiento && new Date(user.fecha_vencimiento) > new Date()
    ? user.fecha_vencimiento
    : null;
  const nuevaFecha = calcularVencimiento(30, fechaBase);

  await supabase.from("usuarios").update({
    fecha_vencimiento:  nuevaFecha,
    estado_suscripcion: "activo",
  }).eq("slug", slug);

  invalidateCache(slug);
  console.log(`✅ Suscripción renovada: ${slug} → vence ${nuevaFecha}`);

  if (user.email) {
    fetch(APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action:     "suscripcionRenovada",
        adminEmail: user.email,
        nombre:     user.nombre_persona || "Cliente",
        slug,
        nuevaFecha,
      }),
    }).catch((e) => console.error("Error mail suscripción:", e.message));
  }
}

app.post("/webhook/suscripcion", async (req, res) => {
  const { query, body } = req;
  try {
    if (query.topic === "payment" || body.type === "payment") {
      const paymentId = query.id || body.data?.id;
      if (!paymentId) return res.sendStatus(200);

      const payRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_PLATFORM_TOKEN}` },
      });
      const payData = await payRes.json();
      await procesarPagoSuscripcion(payData);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("Error en /webhook/suscripcion:", e.message);
    res.sendStatus(200);
  }
});


// ══════════════════════════════════════════════════════════════
// CRON — Verificación de vencimientos
// GET /cron/check-vencimientos  (protegido con x-api-key)
// ══════════════════════════════════════════════════════════════

app.get("/cron/check-vencimientos", requireAdminKey, async (req, res) => {
  try {
    const hoyISO = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }))
      .toISOString().split("T")[0];

    const { data: vencidos, error } = await supabase
      .from("usuarios")
      .select("id, slug, business_name, email, fecha_vencimiento")
      .eq("activo", true)
      .neq("estado_suscripcion", "suspendido")
      .lt("fecha_vencimiento", hoyISO);

    if (error) throw error;

    const slugs = (vencidos || []).map((u) => u.slug);

    if (slugs.length > 0) {
      await supabase.from("usuarios")
        .update({ estado_suscripcion: "suspendido" })
        .in("slug", slugs);

      slugs.forEach((s) => invalidateCache(s));
      console.log(`🔒 Suspendidos (${hoyISO}):`, slugs.join(", "));
    }

    const { data: reactivables } = await supabase
      .from("usuarios")
      .select("id, slug")
      .eq("activo", true)
      .eq("estado_suscripcion", "suspendido")
      .gte("fecha_vencimiento", hoyISO);

    const slugsReactivar = (reactivables || []).map((u) => u.slug);
    if (slugsReactivar.length > 0) {
      await supabase.from("usuarios")
        .update({ estado_suscripcion: "activo" })
        .in("slug", slugsReactivar);

      slugsReactivar.forEach((s) => invalidateCache(s));
      console.log(`✅ Reactivados:`, slugsReactivar.join(", "));
    }

    res.json({
      success:            true,
      fecha:              hoyISO,
      suspendidos:        slugs,
      reactivados:        slugsReactivar,
      total_suspendidos:  slugs.length,
      total_reactivados:  slugsReactivar.length,
    });
  } catch (e) {
    console.error("Error en /cron/check-vencimientos:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════
// 404 Y ERROR HANDLER
// ══════════════════════════════════════════════════════════════
app.use("*", (req, res) => {
  res.status(404).json({ success: false, error: "Ruta no encontrada.", path: req.originalUrl });
});

app.use((err, req, res, _next) => {
  console.error("Error no manejado:", err.message);
  res.status(500).json({ success: false, error: "Error interno del servidor." });
});


// ══════════════════════════════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   Associe API v8.0                           ║
  ║   Multi-tenant · Slug auto-generado          ║
  ║   Registro público activado                  ║
  ║   Puerto: ${PORT}                              ║
  ╚═══════════════════════════════════════════════╝
  `);
});

export default app;
