import express        from "express";
import cors           from "cors";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Preference } from "mercadopago";
import fetch          from "node-fetch";
import bcrypt         from "bcryptjs";
import jwt            from "jsonwebtoken";
import rateLimit      from "express-rate-limit";
import multer         from "multer";

// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL
// ══════════════════════════════════════════════════════════════
const app = express();

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzvcaYhHuyD-Xu63Aw9WpWrpcr5xmrgHW_IffXkmC90bs0pTzhWP1d8rWBaBuhG5Icx/exec";

const BCRYPT_ROUNDS  = 10;
const CACHE_DURATION = 20_000;
const JWT_EXPIRY     = "7d";
const API_URL        = process.env.API_URL || "https://negosocio.onrender.com";

const DIAS_PRUEBA        = parseInt(process.env.DIAS_PRUEBA       || "15");
const PRECIO_RENOVACION  = parseInt(process.env.PRECIO_RENOVACION || "23000");
const MP_PLATFORM_TOKEN  = process.env.MP_PLATFORM_TOKEN          || "";
const PANEL_URL          = process.env.PANEL_URL                  || "https://negosociov2.framer.website/panel";
const RENOVACION_SUCCESS = process.env.RENOVACION_SUCCESS_URL     || `${PANEL_URL}?status=renovacion_ok`;
const RENOVACION_CANCEL  = process.env.RENOVACION_CANCEL_URL      || `${PANEL_URL}?status=renovacion_cancel`;

// Marketplace fee: 5% solo cuando el monto > 500 ARS
const MARKETPLACE_FEE_PCT   = parseFloat(process.env.MARKETPLACE_FEE_PCT  || "0.05");
const MARKETPLACE_FEE_MINIMO = parseInt(process.env.MARKETPLACE_FEE_MINIMO || "500");

// ══════════════════════════════════════════════════════════════
// MULTER — Upload de imágenes
// ══════════════════════════════════════════════════════════════
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
const cleanSlug = (raw) => {
  if (!raw) return "";
  return raw.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
};

const isActivo = (val) => val === "true" || val === true;

async function generarSlugUnico(businessName) {
  const base = cleanSlug(businessName);
  let slug = base, n = 2;
  while (true) {
    const { data } = await supabase.from("usuarios").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${n++}`;
  }
  return slug;
}

const validateEmail    = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validatePassword = (p) => p && p.length >= 6;
const validatePhone    = (p) => /^[0-9]{7,15}$/.test(p.toString().replace(/\s/g, ""));
const cleanPhone = (p) => p.toString().replace(/\s/g, "").replace(/^\+/, "").trim();

const calcularVencimiento = (diasExtra = 30, baseISO = null) => {
  const base = baseISO ? new Date(baseISO + "T12:00:00-03:00") : new Date();
  base.setDate(base.getDate() + diasExtra);
  return base.toISOString().split("T")[0];
};

const diasHastaVencer = (fechaISO) => {
  const hoy   = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const vence = new Date(fechaISO + "T23:59:59-03:00");
  return Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
};

async function verificarPassword(passwordIngresado, passwordGuardado, userId) {
  const stored   = String(passwordGuardado);
  const esBcrypt = /^\$2[aby]\$/.test(stored);
  if (esBcrypt) return await bcrypt.compare(String(passwordIngresado), stored);
  const ok = stored === String(passwordIngresado);
  if (ok) {
    const hash = await bcrypt.hash(String(passwordIngresado), BCRYPT_ROUNDS);
    await supabase.from("usuarios").update({ password: hash }).eq("id", userId);
    console.log(`🔄 Password migrado a bcrypt: user ${userId}`);
  }
  return ok;
}

// Calcula el marketplace fee: 5% solo si monto > MARKETPLACE_FEE_MINIMO
const calcularMarketplaceFee = (monto) => {
  if (monto <= MARKETPLACE_FEE_MINIMO) return 0;
  return Math.round(monto * MARKETPLACE_FEE_PCT);
};

// ══════════════════════════════════════════════════════════════
// CACHÉ EN MEMORIA
// ══════════════════════════════════════════════════════════════
const globalCache = {};
const invalidateCache = (slug) => { delete globalCache[slug]; };

// ══════════════════════════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════════════════════════
const limiterAuth    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: "Demasiados intentos.",  standardHeaders: true, legacyHeaders: false });
const limiterBooking = rateLimit({ windowMs: 60 * 1000,       max: 20,  message: "Demasiadas reservas." });
const limiterAPI     = rateLimit({ windowMs: 60 * 1000,       max: 200 });

// ══════════════════════════════════════════════════════════════
// MIDDLEWARES
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
    if (payload.rol === "superadmin") { req.auth = payload; return next(); }
    const slugRuta = cleanSlug(req.params.slug || req.body?.slug || req.query?.slug || "");
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
// MIDDLEWARE: ADMIN KEY
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
  const porDia = {}, porSemana = {}, porMes = {};
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

    porDia[fecha].volumen      += monto;
    porDia[fecha].cantidad     += 1;
    porDia[fecha][estado]       = (porDia[fecha][estado] || 0) + 1;
    porSemana[semKey].volumen  += monto; porSemana[semKey].cantidad += 1;
    porMes[mesKey].volumen     += monto; porMes[mesKey].cantidad    += 1;
    porEstado[estado]           = (porEstado[estado] || 0) + 1;

    if (v.email_cliente)         clientesSet.add(v.email_cliente.toLowerCase());
    else if (v.telefono_cliente) clientesSet.add(v.telefono_cliente);

    if (estado === "aprobado") { volumenTotal += monto; cantidadTotal += 1; }
  });

  return {
    porDia,
    porSemana:      Object.values(porSemana).sort((a, b) => a.label.localeCompare(b.label)),
    porMes:         Object.values(porMes).sort((a, b)    => a.label.localeCompare(b.label)),
    porEstado, volumenTotal, cantidadTotal,
    ticketPromedio: cantidadTotal > 0 ? Math.round(volumenTotal / cantidadTotal) : 0,
    clientesNuevos: clientesSet.size,
  };
}

// ══════════════════════════════════════════════════════════════
// RUTAS BASE
// ══════════════════════════════════════════════════════════════
app.get("/",       (_, res) => res.json({ status: "online", version: "12.0", timestamp: new Date().toISOString() }));
app.get("/health", (_, res) => res.json({ status: "ok",     timestamp: new Date().toISOString() }));

// ══════════════════════════════════════════════════════════════
// REGISTRO PÚBLICO
// POST /registro
// ══════════════════════════════════════════════════════════════
app.post("/registro", limiterAuth, async (req, res) => {
  try {
    const { nombre_persona, apellido, email, telefono, business_name, password, horarios, duracion_turno, plan } = req.body;

    if (!nombre_persona || !email || !password || !business_name) {
      return res.status(400).json({ success: false, error: "Faltan campos obligatorios: nombre_persona, email, password, business_name." });
    }
    if (!validateEmail(email))       return res.status(400).json({ success: false, error: "Email inválido." });
    if (!validatePassword(password)) return res.status(400).json({ success: false, error: "La contraseña debe tener al menos 6 caracteres." });
    if (telefono && !validatePhone(cleanPhone(telefono))) return res.status(400).json({ success: false, error: "Teléfono inválido (7-15 dígitos)." });
    if (business_name.trim().length < 2) return res.status(400).json({ success: false, error: "El nombre del negocio es demasiado corto." });

    const { data: emailExiste } = await supabase.from("usuarios").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
    if (emailExiste) return res.status(409).json({ success: false, error: "Ya existe una cuenta con ese email." });

    const slug           = await generarSlugUnico(business_name.trim());
    const hashedPassword = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

    // Plan: solo acepta 'gratis' o 'premium', default 'gratis'
    const planFinal = plan === "premium" ? "premium" : "gratis";

    // Gratis  → sin fecha de vencimiento, estado activo permanente
    // Premium → trial de DIAS_PRUEBA días, después requiere renovación manual
    const fechaVencimiento  = planFinal === "premium" ? calcularVencimiento(DIAS_PRUEBA) : null;
    const estadoSuscripcion = planFinal === "premium" ? "trial" : "activo";

    const insertData = {
      nombre_persona:     nombre_persona.trim(),
      apellido:           apellido?.trim() || null,
      email:              email.trim().toLowerCase(),
      telefono:           telefono ? cleanPhone(telefono) : null,
      business_name:      business_name.trim(),
      slug,
      password:           hashedPassword,
      plan:               planFinal,
      metodo_pago:        "none",
      porcentaje_sena:    30,
      excepciones:        [],
      activo:             "true",
      estado_suscripcion: estadoSuscripcion,
      fecha_vencimiento:  fechaVencimiento,
    };
    if (horarios && typeof horarios === "object") insertData.horarios = horarios;
    if (duracion_turno) insertData.duracion_turno = parseInt(duracion_turno) || 30;

    const { data: nuevo, error } = await supabase.from("usuarios")
      .insert([insertData])
      .select("id, slug, business_name, email, nombre_persona, plan, estado_suscripcion, fecha_vencimiento")
      .single();

    if (error) {
      if (error.code === "23505") return res.status(409).json({ success: false, error: "El email ya está registrado." });
      throw error;
    }

    const secret = process.env.JWT_SECRET;
    const token  = secret
      ? jwt.sign({ slug: nuevo.slug, negocioId: nuevo.id, rol: "owner" }, secret, { expiresIn: JWT_EXPIRY })
      : null;

    fetch(APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action:     "bienvenida",
        adminEmail: nuevo.email,
        nombre:     nuevo.nombre_persona,
        slug:       nuevo.slug,
        panel_url:  `${PANEL_URL}?u=${nuevo.slug}`,
        dias_prueba: planFinal === "premium" ? DIAS_PRUEBA : 0,
      }),
    }).catch((e) => console.error("Error mail bienvenida:", e.message));

    console.log(`✅ Registro: ${slug} — plan: ${planFinal} — vencimiento: ${fechaVencimiento ?? "sin vencimiento"}`);

    res.status(201).json({
      success:           true,
      slug:              nuevo.slug,
      business_name:     nuevo.business_name,
      plan:              nuevo.plan,
      panel_url:         `${PANEL_URL}?u=${nuevo.slug}`,
      token,
      dias_prueba:       planFinal === "premium" ? DIAS_PRUEBA : null,
      fecha_vencimiento: fechaVencimiento,
    });
  } catch (e) {
    console.error("Error en POST /registro:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// AUTH — LOGIN
// POST /login
// ══════════════════════════════════════════════════════════════
app.post("/login", limiterAuth, async (req, res) => {
  try {
    const rawSlug  = cleanSlug(req.body.slug || "");
    const email    = req.body.email?.trim().toLowerCase() || "";
    const password = req.body.password;

    if ((!rawSlug && !email) || !password) {
      return res.status(400).json({ success: false, error: "Faltan email (o slug) y contraseña." });
    }

    let query = supabase.from("usuarios")
      .select("id, slug, password, business_name, nombre_persona, apellido, email, activo, plan, estado_suscripcion, fecha_vencimiento");
    query = rawSlug ? query.eq("slug", rawSlug) : query.eq("email", email);

    const { data: user, error } = await query.maybeSingle();
    if (error) throw error;
    if (!user) return res.status(401).json({ success: false, error: "Credenciales incorrectas." });
    if (!isActivo(user.activo)) return res.status(403).json({ success: false, error: "Este negocio está desactivado." });

    const passwordOk = await verificarPassword(password, user.password, user.id);
    if (!passwordOk) return res.status(401).json({ success: false, error: "Credenciales incorrectas." });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, error: "JWT_SECRET no configurado." });

    const token = jwt.sign(
      { slug: user.slug, negocioId: user.id, rol: "owner" },
      secret, { expiresIn: JWT_EXPIRY }
    );

    const diasRestantes      = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estadoSuscripcion  = user.estado_suscripcion || "trial";
    const suscripcionVencida = diasRestantes !== null && diasRestantes <= 0;

    res.json({
      success:        true,
      token,
      slug:           user.slug,
      business_name:  user.business_name,
      nombre_persona: user.nombre_persona,
      apellido:       user.apellido || "",
      email:          user.email,
      plan:           user.plan || "gratis",
      suscripcion: {
        estado:            suscripcionVencida ? "suspendido" : estadoSuscripcion,
        fecha_vencimiento: user.fecha_vencimiento,
        dias_restantes:    diasRestantes,
        alerta:            diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0,
        vencida:           suscripcionVencida,
      },
    });
  } catch (e) {
    console.error("Error en /login:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// AUTH — VERIFY SESSION
// GET /verify-session
// ══════════════════════════════════════════════════════════════
app.get("/verify-session", async (req, res) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1] || req.query.token;
    if (!token) return res.json({ active: false, reason: "no_token" });

    const payload    = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user } = await supabase.from("usuarios")
      .select("slug, business_name, email, nombre_persona, activo, plan, estado_suscripcion, fecha_vencimiento")
      .eq("slug", payload.slug).maybeSingle();

    if (!user || !isActivo(user.activo)) return res.json({ active: false, reason: "not_found" });

    const diasRestantes = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    res.json({
      active:         true,
      slug:           user.slug,
      business_name:  user.business_name,
      email:          user.email,
      nombre_persona: user.nombre_persona,
      plan:           user.plan || "gratis",
      suscripcion: {
        estado:         user.estado_suscripcion,
        dias_restantes: diasRestantes,
        vencida:        diasRestantes !== null && diasRestantes <= 0,
      },
    });
  } catch (e) {
    res.json({ active: false, reason: "invalid_token" });
  }
});

// ══════════════════════════════════════════════════════════════
// ADMIN — RESETEAR PASSWORD
// POST /admin/reset-password
// ══════════════════════════════════════════════════════════════
app.post("/admin/reset-password", requireAdminKey, async (req, res) => {
  try {
    const { email, new_password } = req.body;
    if (!email || !new_password) return res.status(400).json({ success: false, error: "Faltan email y new_password." });
    if (!validatePassword(new_password)) return res.status(400).json({ success: false, error: "Mínimo 6 caracteres." });
    const hash = await bcrypt.hash(String(new_password), BCRYPT_ROUNDS);
    const { error } = await supabase.from("usuarios").update({ password: hash }).eq("email", email.trim().toLowerCase());
    if (error) throw error;
    res.json({ success: true, message: `Password actualizado para ${email}` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// NEGOCIO PÚBLICO
// GET /negocio/:slug
// ══════════════════════════════════════════════════════════════
app.get("/negocio/:slug", async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });

    const { data: user, error } = await supabase.from("usuarios")
      .select("slug, business_name, horarios, excepciones, duracion_turno, capacidad_por_turno, metodo_pago, porcentaje_sena, mp_access_token, activo, plan, estado_suscripcion, fecha_vencimiento")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!user)              return res.status(404).json({ success: false, error: "Negocio no encontrado." });
    if (!isActivo(user.activo)) return res.status(404).json({ success: false, error: "Negocio no disponible." });

    // Solo suspender si tiene fecha_vencimiento (plan premium vencido)
    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = user.estado_suscripcion === "suspendido" || (diasRestantes !== null && diasRestantes <= 0);

    if (estaSuspendido) {
      if (user.estado_suscripcion !== "suspendido") {
        supabase.from("usuarios").update({ estado_suscripcion: "suspendido" }).eq("slug", slug).then(() => {});
      }
      return res.json({ success: true, suspendido: true, negocio: { slug: user.slug, business_name: user.business_name } });
    }

    res.json({
      success: true,
      negocio: {
        slug:                user.slug,
        business_name:       user.business_name,
        horarios:            user.horarios            || {},
        excepciones:         user.excepciones         || [],
        duracion_turno:      user.duracion_turno      || 30,
        capacidad_por_turno: user.capacidad_por_turno || 1,
        metodo_pago:         user.metodo_pago         || "none",
        porcentaje_sena:     user.porcentaje_sena     || 30,
        tiene_mp:            !!user.mp_access_token,
        plan:                user.plan                || "gratis",
      },
    });
  } catch (e) {
    console.error("Error en /negocio:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// SLOTS DISPONIBLES
// GET /slots-disponibles/:slug?fecha=YYYY-MM-DD&servicio_id=...
// ══════════════════════════════════════════════════════════════
app.get("/slots-disponibles/:slug", async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const { fecha, servicio_id } = req.query;
    if (!slug || !fecha) return res.status(400).json({ success: false, error: "Faltan slug o fecha." });

    const { data: user, error: userError } = await supabase.from("usuarios")
      .select("horarios, duracion_turno, capacidad_por_turno, excepciones, activo, estado_suscripcion, fecha_vencimiento")
      .eq("slug", slug)
      .maybeSingle();

    if (userError) throw userError;
    if (!user || !isActivo(user.activo)) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = user.estado_suscripcion === "suspendido" || (diasRestantes !== null && diasRestantes <= 0);
    if (estaSuspendido) return res.json({ success: true, slots: [], suspendido: true });

    let duracion  = user.duracion_turno      || 30;
    let capacidad = user.capacidad_por_turno || 1;

    if (servicio_id) {
      const { data: srv } = await supabase.from("servicios")
        .select("duracion, capacidad")
        .eq("id", servicio_id).eq("slug", slug)
        .maybeSingle();
      if (srv) { duracion = srv.duracion || duracion; capacidad = srv.capacidad || capacidad; }
    }

    const excepcionesArr = user.excepciones || [];
    const estaExceptuado = Array.isArray(excepcionesArr)
      ? excepcionesArr.some((e) => typeof e === "string" ? e === fecha : e?.fecha === fecha && e?.type === "block")
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

    const { data: turnosDia } = await supabase.from("turnos").select("hora, estado")
      .eq("slug", slug).eq("fecha", fecha).in("estado", ["confirmado", "pendiente"]);

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
    console.error("Error en /slots-disponibles:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// SERVICIOS — PÚBLICOS
// GET /servicios/:slug
// ══════════════════════════════════════════════════════════════
app.get("/servicios/:slug", async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });
    const { data, error } = await supabase.from("servicios")
      .select("id, nombre, descripcion, duracion, precio, capacidad")
      .eq("slug", slug).eq("activo", "true")
      .order("orden", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw error;
    res.json({ success: true, servicios: data || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// SERVICIOS — ADMIN — UPLOAD IMAGEN
// POST /admin/servicios/upload-imagen
// ⚠️ DEBE IR ANTES de /admin/servicios/:id
// ══════════════════════════════════════════════════════════════
app.post("/admin/servicios/upload-imagen", requireAuth, upload.single("imagen"), async (req, res) => {
  try {
    const slug = cleanSlug(req.body.slug || req.auth.slug);
    if (!req.file) return res.status(400).json({ success: false, error: "No se recibió imagen." });

    const ext      = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
    const fileName = `${slug}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("servicios")
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from("servicios").getPublicUrl(fileName);
    res.json({ success: true, url: data.publicUrl });
  } catch (e) {
    console.error("Error upload imagen:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// SERVICIOS — ADMIN — CRUD
// ══════════════════════════════════════════════════════════════
app.get("/admin/servicios/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const { data, error } = await supabase.from("servicios").select("*").eq("slug", slug)
      .order("orden", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw error;
    res.json({ success: true, servicios: data || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/admin/servicios", requireAuth, async (req, res) => {
  try {
    const { slug, nombre, descripcion, duracion, precio, capacidad, orden } = req.body;
    const slugClean = cleanSlug(slug || req.auth.slug);
    if (!slugClean || !nombre || !duracion || precio === undefined) {
      return res.status(400).json({ success: false, error: "Faltan campos: nombre, duracion, precio." });
    }
    const { data, error } = await supabase.from("servicios").insert([{
      slug: slugClean, nombre: nombre.trim(), descripcion: descripcion?.trim() || "",
      duracion: parseInt(duracion), precio: Number(precio),
      capacidad: parseInt(capacidad) || 1, orden: parseInt(orden) || 0, activo: "true",
    }]).select().single();
    if (error) throw error;
    invalidateCache(slugClean);
    res.status(201).json({ success: true, servicio: data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put("/admin/servicios/:id", requireAuth, async (req, res) => {
  try {
    const { id }    = req.params;
    const slugClean = cleanSlug(req.body.slug || req.auth.slug);
    const { nombre, descripcion, duracion, precio, capacidad, activo, orden } = req.body;
    const u = {};
    if (nombre      !== undefined) u.nombre      = nombre.trim();
    if (descripcion !== undefined) u.descripcion = descripcion.trim();
    if (duracion    !== undefined) u.duracion    = parseInt(duracion);
    if (precio      !== undefined) u.precio      = Number(precio);
    if (capacidad   !== undefined) u.capacidad   = parseInt(capacidad);
    if (activo      !== undefined) u.activo      = activo === true || activo === "true" ? "true" : "false";
    if (orden       !== undefined) u.orden       = parseInt(orden);
    const { data, error } = await supabase.from("servicios").update(u).eq("id", id).eq("slug", slugClean).select().single();
    if (error) throw error;
    invalidateCache(slugClean);
    res.json({ success: true, servicio: data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete("/admin/servicios/:id", requireAuth, async (req, res) => {
  try {
    const { id }    = req.params;
    const slugClean = cleanSlug(req.body?.slug || req.query?.slug || req.auth.slug);
    const { error } = await supabase.from("servicios").delete().eq("id", id).eq("slug", slugClean);
    if (error) throw error;
    invalidateCache(slugClean);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// TURNOS — RESERVA PÚBLICA
// POST /turnos/reservar
// ══════════════════════════════════════════════════════════════
app.post("/turnos/reservar", limiterBooking, async (req, res) => {
  try {
    const { name, phone, email, fecha, hora, slug, servicio_id, apellido } = req.body;
    const slugClean = cleanSlug(slug || "");

    if (!name || !phone || !fecha || !hora || !slugClean) {
      return res.status(400).json({ success: false, error: "Faltan datos requeridos." });
    }
    const phoneClean = cleanPhone(phone.toString());
    if (!validatePhone(phoneClean)) return res.status(400).json({ success: false, error: "Teléfono inválido (7-15 dígitos)." });
    if (email && !validateEmail(email)) return res.status(400).json({ success: false, error: "Email inválido." });

    const { data: user, error: userError } = await supabase.from("usuarios")
      .select("*").eq("slug", slugClean).maybeSingle();
    if (userError) throw userError;
    if (!user)              return res.status(404).json({ success: false, error: "Negocio no encontrado." });
    if (!isActivo(user.activo)) return res.status(404).json({ success: false, error: "Negocio no disponible." });

    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = user.estado_suscripcion === "suspendido" || (diasRestantes !== null && diasRestantes <= 0);
    if (estaSuspendido) return res.status(403).json({ success: false, error: "Este servicio está pausado temporalmente." });

    const requierePago = user.mp_access_token && (user.metodo_pago === "sena" || user.metodo_pago === "total");
    if (requierePago) return res.status(403).json({ success: false, error: "Este turno requiere pago previo." });

    const hoy = new Date().toISOString().split("T")[0];
    const { data: turnosExistentes } = await supabase.from("turnos").select("id")
      .eq("slug", slugClean).gte("fecha", hoy).neq("estado", "cancelado")
      .or(`telefono.eq.${phoneClean}${email ? `,email.eq.${email.trim().toLowerCase()}` : ""}`);
    if (turnosExistentes?.length > 0) return res.status(400).json({ success: false, error: "Ya tenés un turno agendado activo." });

    let capacidad = user.capacidad_por_turno || 1, servicioNombre = null, precioCobrado = 0;
    if (servicio_id) {
      const { data: srv } = await supabase.from("servicios").select("nombre, capacidad, precio").eq("id", servicio_id).maybeSingle();
      if (srv) { servicioNombre = srv.nombre; capacidad = srv.capacidad || capacidad; precioCobrado = Number(srv.precio || 0); }
    }

    const { count } = await supabase.from("turnos").select("id", { count: "exact" })
      .eq("slug", slugClean).eq("fecha", fecha).eq("hora", hora).neq("estado", "cancelado");
    if (count >= capacidad) return res.status(400).json({ success: false, error: "Este turno ya está lleno." });

    const { data: turno, error: turnoError } = await supabase.from("turnos").insert([{
      slug: slugClean, nombre: name.trim(), telefono: phoneClean,
      apellido: apellido?.trim() || null,
      email: email?.trim().toLowerCase() || null, fecha, hora,
      servicio_id: servicio_id || null, servicio_nombre: servicioNombre,
      precio_cobrado: precioCobrado, estado: "confirmado", metodo_pago: "none",
    }]).select().single();
    if (turnoError) throw turnoError;

    fetch(APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "newAppointmentEmail", nombreCliente: name.trim(), fechaHora: `${fecha} ${hora}`, adminEmail: user.email, emailCliente: email?.trim() || "" }),
    }).catch((e) => console.error("Error mail booking:", e.message));

    invalidateCache(slugClean);
    res.json({ success: true, turno_id: turno.id, message: "Turno creado con éxito." });
  } catch (e) {
    console.error("Error en /turnos/reservar:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// TURNOS — ACTUALIZAR ESTADO
// PUT /turnos/:id
// ══════════════════════════════════════════════════════════════
app.put("/turnos/:id", requireAuth, async (req, res) => {
  try {
    const { id }    = req.params;
    const slugClean = cleanSlug(req.body?.slug || req.auth?.slug || "");
    const { estado, notas } = req.body;

    const ESTADOS_VALIDOS = ["confirmado", "pendiente", "cancelado", "completado", "no_asistio"];
    if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ success: false, error: `Estado inválido. Debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}` });
    }

    const { data: turnoExistente, error: fetchError } = await supabase
      .from("turnos").select("id, slug, estado")
      .eq("id", id).eq("slug", slugClean).maybeSingle();

    if (fetchError) throw fetchError;
    if (!turnoExistente) return res.status(404).json({ success: false, error: "Turno no encontrado." });

    const updateData = { estado };
    if (notas !== undefined) updateData.notas = notas;

    const { data: turnoActualizado, error: updateError } = await supabase
      .from("turnos").update(updateData).eq("id", id).eq("slug", slugClean).select().single();

    if (updateError) throw updateError;

    invalidateCache(slugClean);
    console.log(`✅ Turno ${id} → ${estado} (${slugClean})`);
    res.json({ success: true, turno: turnoActualizado });
  } catch (e) {
    console.error("Error en PUT /turnos/:id:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// AGENDA — Próximos 30 días
// GET /agenda/:slug
// ══════════════════════════════════════════════════════════════
app.get("/agenda/:slug", requireAuth, async (req, res) => {
  try {
    const slug     = cleanSlug(req.params.slug);
    const ahoraArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const hoyISO   = ahoraArg.toISOString().split("T")[0];
    const hasta    = new Date(ahoraArg); hasta.setDate(hasta.getDate() + 30);
    const hastaISO = hasta.toISOString().split("T")[0];

    const { data: turnos, error } = await supabase.from("turnos").select("*")
      .eq("slug", slug).gte("fecha", hoyISO).lte("fecha", hastaISO).neq("estado", "cancelado")
      .order("fecha", { ascending: true }).order("hora", { ascending: true });
    if (error) throw error;

    const porFecha = {};
    (turnos || []).forEach((t) => {
      if (!porFecha[t.fecha]) porFecha[t.fecha] = [];
      porFecha[t.fecha].push({
        id: t.id, nombre: t.nombre, hora: t.hora.slice(0, 5),
        servicio: t.servicio_nombre || null, precio_cobrado: t.precio_cobrado || 0,
        estado: t.estado, email: t.email, telefono: t.telefono, notas: t.notas || null,
      });
    });

    const dias = Object.keys(porFecha).sort().map((fecha) => ({ fecha, esHoy: fecha === hoyISO, turnos: porFecha[fecha] }));
    res.json({ success: true, hoy: hoyISO, dias });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// SETTINGS
// GET /settings/:slug
// PUT /settings/:slug
// ══════════════════════════════════════════════════════════════
app.get("/settings/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const { data: user, error } = await supabase.from("usuarios")
      .select(
        "slug, business_name, nombre_persona, apellido, email, telefono, " +
        "plan, duracion_turno, capacidad_por_turno, metodo_pago, porcentaje_sena, " +
        "horarios, excepciones, mp_access_token, " +
        "estado_suscripcion, fecha_vencimiento, activo"
      )
      .eq("slug", slug).maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const diasRestantes = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;

    res.json({
      success: true,
      settings: {
        slug:                user.slug,
        business_name:       user.business_name,
        nombre_persona:      user.nombre_persona,
        apellido:            user.apellido,
        email:               user.email,
        telefono:            user.telefono,
        plan:                user.plan || "gratis",
        duracion_turno:      user.duracion_turno,
        capacidad_por_turno: user.capacidad_por_turno,
        metodo_pago:         user.metodo_pago,
        porcentaje_sena:     user.porcentaje_sena,
        horarios:            user.horarios    || {},
        excepciones:         user.excepciones || [],
        activo:              isActivo(user.activo),
        estado_suscripcion:  user.estado_suscripcion,
        fecha_vencimiento:   user.fecha_vencimiento,
        mp_status:           user.mp_access_token ? "Conectado" : "Desconectado",
        dias_restantes:      diasRestantes,
        alerta_vencimiento:  diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put("/settings/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });

    const ALLOWED_FIELDS = [
      "business_name", "nombre_persona", "apellido", "telefono",
      "duracion_turno", "capacidad_por_turno",
      "metodo_pago", "porcentaje_sena",
      "horarios", "excepciones",
    ];

    const update = {};
    ALLOWED_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });

    if (update.duracion_turno      !== undefined) update.duracion_turno      = parseInt(update.duracion_turno)      || 30;
    if (update.capacidad_por_turno !== undefined) update.capacidad_por_turno = parseInt(update.capacidad_por_turno) || 1;
    if (update.porcentaje_sena     !== undefined) update.porcentaje_sena     = parseInt(update.porcentaje_sena)     || 30;
    if (update.telefono            !== undefined) update.telefono            = cleanPhone(update.telefono);
    if (update.business_name       !== undefined) update.business_name       = update.business_name.trim();
    if (update.nombre_persona      !== undefined) update.nombre_persona      = update.nombre_persona.trim();

    if (update.excepciones !== undefined && !Array.isArray(update.excepciones)) {
      update.excepciones = Object.entries(update.excepciones).map(([fecha, exc]) => ({
        fecha, type: exc.type ?? "block",
        ...(exc.slots ? { slots: exc.slots } : {}),
      }));
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, error: "No hay campos válidos para actualizar." });
    }

    const { error } = await supabase.from("usuarios").update(update).eq("slug", slug);
    if (error) throw error;
    invalidateCache(slug);
    res.json({ success: true, updated: Object.keys(update) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// ADMIN STATS — Dashboard principal
// GET /admin-stats/:slug
// ══════════════════════════════════════════════════════════════
app.get("/admin-stats/:slug", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    if (!slug) return res.status(400).json({ success: false, error: "Slug inválido." });

    const now = Date.now();
    if (globalCache[slug] && now - globalCache[slug].timestamp < CACHE_DURATION) {
      return res.json(globalCache[slug].data);
    }

    const { data: user, error: userError } = await supabase.from("usuarios")
      .select("id, slug, business_name, nombre_persona, apellido, email, activo, plan, metodo_pago, porcentaje_sena, duracion_turno, capacidad_por_turno, horarios, excepciones, mp_access_token, estado_suscripcion, fecha_vencimiento")
      .eq("slug", slug).maybeSingle();
    if (userError) throw userError;
    if (!user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const ahoraArg   = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const anioActual = ahoraArg.getFullYear();
    const mesActual  = ahoraArg.getMonth() + 1;
    const diaHoyNum  = ahoraArg.getDate();
    const hoyISO     = `${anioActual}-${String(mesActual).padStart(2, "0")}-${String(diaHoyNum).padStart(2, "0")}`;
    const inicioMes  = `${anioActual}-${String(mesActual).padStart(2, "0")}-01`;

    const { data: turnosMes } = await supabase.from("turnos").select("*")
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
      id: t.id, nombre: t.nombre, telefono: t.telefono, email: t.email,
      fecha: t.fecha, hora: t.hora.slice(0, 5), servicio: t.servicio_nombre,
      precio_cobrado: t.precio_cobrado || 0, estado: t.estado, notas: t.notas || null,
      duracion: user.duracion_turno || 30,
    })).reverse();

    const turnosHoyDetalle = turnosData
      .filter((t) => t.fecha === hoyISO)
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((t) => ({ id: t.id, nombre: t.nombre, hora: t.hora.slice(0, 5), servicio: t.servicio_nombre, estado: t.estado }));

    const desde90 = new Date(ahoraArg); desde90.setDate(desde90.getDate() - 90);
    const hasta7  = new Date(ahoraArg); hasta7.setDate(hasta7.getDate() + 7);
    const { data: ventasData } = await supabase.from("ventas").select("*").eq("slug", slug)
      .gte("fecha_turno", desde90.toISOString().split("T")[0])
      .lte("fecha_turno", hasta7.toISOString().split("T")[0])
      .order("fecha_pago", { ascending: true });

    const metricas  = agruparVentas(ventasData || [], hoyISO);
    const mesKey    = `${anioActual}-${String(mesActual).padStart(2, "0")}`;
    const ventasHoy = metricas.porDia[hoyISO] || { volumen: 0, cantidad: 0, aprobado: 0, pendiente: 0, rechazado: 0 };
    const ventasMes = metricas.porMes.find((m) => m.label === mesKey) || { volumen: 0, cantidad: 0 };

    const proximosDias = generarRangoDias(hoyISO, 7).map((fecha) => ({
      fecha, ...(metricas.porDia[fecha] || { volumen: 0, cantidad: 0, aprobado: 0, pendiente: 0, rechazado: 0 }),
    }));

    const { data: todosLosTurnos } = await supabase.from("turnos")
      .select("telefono, email, created_at").eq("slug", slug).neq("estado", "cancelado");
    const clientesUnicos = new Set(), clientesMesSet = new Set();
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
    const suscripcionVencida = diasRestantes !== null && diasRestantes <= 0;

    const finalData = {
      turnosHoy, turnosMes: turnosMesTotal, turnosHoyDetalle,
      chartData: Object.keys(semanas).map((k) => ({ label: k, turnos: semanas[k] })),
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
        estados: { aprobado: metricas.porEstado.aprobado || 0, pendiente: metricas.porEstado.pendiente || 0, rechazado: metricas.porEstado.rechazado || 0 },
      },
      ventasPorDia, ventasPorSem: metricas.porSemana, ventasPorMes: metricas.porMes, proximosDias,
      horarios: user.horarios,
      config: {
        plan:                user.plan                || "gratis",
        duracion:            user.duracion_turno      || 30,
        capacidad_por_turno: user.capacidad_por_turno || 1,
        metodo_pago:         user.metodo_pago         || "none",
        porcentaje_sena:     user.porcentaje_sena     || 30,
        mp_status:           user.mp_access_token ? "Conectado" : "Desconectado",
        excepciones:         user.excepciones         || [],
      },
      suscripcion: {
        estado:            suscripcionVencida ? "suspendido" : estadoSuscripcion,
        fecha_vencimiento: user.fecha_vencimiento,
        dias_restantes:    diasRestantes,
        alerta:            diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0,
        vencida:           suscripcionVencida,
        precio_renovacion: PRECIO_RENOVACION,
      },
      businessName:   user.business_name,
      nombre_persona: user.nombre_persona,
      apellido:       user.apellido || "",
      slug:           user.slug,
      plan:           user.plan || "gratis",
    };

    globalCache[slug] = { timestamp: now, data: finalData };
    res.json(finalData);
  } catch (e) {
    console.error("Error en /admin-stats:", e.message);
    res.status(500).json({ success: false, error: "Error al procesar estadísticas." });
  }
});

// ══════════════════════════════════════════════════════════════
// SUPERADMIN — CRUD DE NEGOCIOS
// ══════════════════════════════════════════════════════════════
app.post("/superadmin/negocios", requireAdminKey, async (req, res) => {
  try {
    const { nombre_persona, apellido, email, telefono, business_name, password, plan = "gratis" } = req.body;
    if (!nombre_persona || !email || !password || !business_name) {
      return res.status(400).json({ success: false, error: "Faltan campos obligatorios." });
    }
    if (!validateEmail(email))       return res.status(400).json({ success: false, error: "Email inválido." });
    if (!validatePassword(password)) return res.status(400).json({ success: false, error: "Contraseña: mínimo 6 caracteres." });

    const planFinal        = plan === "premium" ? "premium" : "gratis";
    const slug             = await generarSlugUnico(business_name.trim());
    const hashedPassword   = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const fechaVencimiento = planFinal === "premium" ? calcularVencimiento(DIAS_PRUEBA) : null;
    const estadoSuscripcion = planFinal === "premium" ? "trial" : "activo";

    const { data, error } = await supabase.from("usuarios").insert([{
      nombre_persona: nombre_persona.trim(), apellido: apellido?.trim() || "",
      email: email.trim().toLowerCase(), telefono: telefono ? cleanPhone(telefono) : null,
      business_name: business_name.trim(), slug, password: hashedPassword,
      plan: planFinal,
      metodo_pago: "none", porcentaje_sena: 30, excepciones: [],
      activo: "true", estado_suscripcion: estadoSuscripcion, fecha_vencimiento: fechaVencimiento,
    }]).select("id, slug, business_name, plan, email, nombre_persona, apellido, estado_suscripcion, fecha_vencimiento").single();

    if (error) {
      if (error.code === "23505") return res.status(409).json({ success: false, error: "El email ya está registrado." });
      throw error;
    }
    res.status(201).json({ success: true, negocio: data, panel_url: `${PANEL_URL}?u=${slug}` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/superadmin/negocios", requireAdminKey, async (req, res) => {
  try {
    const { data, error } = await supabase.from("usuarios")
      .select("id, slug, business_name, nombre_persona, apellido, email, telefono, activo, plan, metodo_pago, mp_access_token, estado_suscripcion, fecha_vencimiento, created_at")
      .order("business_name", { ascending: true });
    if (error) throw error;
    const negocios = (data || []).map((u) => ({
      id: u.id, slug: u.slug, business_name: u.business_name,
      nombre_persona: u.nombre_persona, apellido: u.apellido,
      email: u.email, telefono: u.telefono,
      activo: isActivo(u.activo), plan: u.plan || "gratis",
      metodo_pago: u.metodo_pago, tiene_mp: !!u.mp_access_token,
      estado_suscripcion: u.estado_suscripcion || "trial",
      fecha_vencimiento:  u.fecha_vencimiento,
      dias_restantes: u.fecha_vencimiento ? diasHastaVencer(u.fecha_vencimiento) : null,
      creado: u.created_at,
    }));
    res.json({ success: true, negocios, total: negocios.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put("/superadmin/negocios/:slug", requireAdminKey, async (req, res) => {
  try {
    const slug    = cleanSlug(req.params.slug);
    const allowed = ["nombre_persona", "apellido", "email", "telefono", "business_name", "duracion_turno", "capacidad_por_turno", "estado_suscripcion", "fecha_vencimiento"];
    const update  = {};
    allowed.forEach((key) => { if (req.body[key] !== undefined) update[key] = req.body[key]; });
    if (req.body.activo   !== undefined) update.activo = req.body.activo === true || req.body.activo === "true" ? "true" : "false";
    if (req.body.plan     !== undefined) update.plan   = ["gratis", "premium"].includes(req.body.plan) ? req.body.plan : "gratis";
    if (req.body.password)               update.password = await bcrypt.hash(String(req.body.password), BCRYPT_ROUNDS);
    if (req.body.sumar_dias && !isNaN(parseInt(req.body.sumar_dias))) {
      const { data: actual } = await supabase.from("usuarios").select("fecha_vencimiento").eq("slug", slug).maybeSingle();
      const base = actual?.fecha_vencimiento && new Date(actual.fecha_vencimiento) > new Date() ? actual.fecha_vencimiento : null;
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

// ══════════════════════════════════════════════════════════════
// PAGOS — Mercado Pago (turnos)
// POST /api/create-preference
// Marketplace fee: 5% cuando monto > MARKETPLACE_FEE_MINIMO
// ══════════════════════════════════════════════════════════════
app.post("/api/create-preference", limiterBooking, async (req, res) => {
  try {
    const { nombre, telefono, email, fecha, hora, slug, servicio_id } = req.body;
    const slugClean = cleanSlug(slug || "");
    if (!nombre || !telefono || !fecha || !hora || !slugClean) {
      return res.status(400).json({ success: false, error: "Faltan datos requeridos." });
    }

    const { data: user, error: userError } = await supabase.from("usuarios").select("*").eq("slug", slugClean).maybeSingle();
    if (userError) throw userError;
    if (!user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const diasRestantes  = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const estaSuspendido = user.estado_suscripcion === "suspendido" || (diasRestantes !== null && diasRestantes <= 0);
    if (estaSuspendido) return res.status(403).json({ success: false, error: "Este servicio está pausado temporalmente." });

    let precioServicio = 0, nombreServicio = "Reserva";
    if (servicio_id) {
      const { data: srv } = await supabase.from("servicios").select("nombre, precio").eq("id", servicio_id).eq("slug", slugClean).maybeSingle();
      if (srv) { precioServicio = Number(srv.precio || 0); nombreServicio = srv.nombre; }
    }

    const metodo    = user.metodo_pago || "none";
    const debePagar = metodo === "sena" || metodo === "total";
    if (!debePagar || precioServicio <= 0) return res.json({ isFree: true });

    const montoACobrar = metodo === "sena" ? Math.round(precioServicio * (user.porcentaje_sena || 30) / 100) : precioServicio;
    const conceptoPago = metodo === "sena" ? `Seña ${user.porcentaje_sena || 30}%` : "Total";
    const fee          = calcularMarketplaceFee(montoACobrar);
    const metaMeta     = { nombre, telefono: cleanPhone(telefono), email: email || "", fecha, hora, slug: slugClean, servicio_id: servicio_id || "", servicio_nombre: nombreServicio, metodo_pago: metodo, precio_servicio: precioServicio };
    const successUrl   = process.env.SUCCESS_URL || `${API_URL}/success`;
    const cancelUrl    = process.env.CANCEL_URL  || `${API_URL}/error`;

    if (user.mp_access_token) {
      try {
        const client   = new MercadoPagoConfig({ accessToken: user.mp_access_token });
        const pref     = new Preference(client);
        const prefBody = {
          items: [{ title: `${nombreServicio} (${conceptoPago}): ${fecha} - ${hora}hs`, unit_price: montoACobrar, quantity: 1, currency_id: "ARS" }],
          metadata: { ...metaMeta, tipo_pago: metodo },
          notification_url: `${API_URL}/webhook/mp`,
          back_urls: { success: successUrl, failure: cancelUrl, pending: cancelUrl },
          auto_return: "approved",
        };
        if (fee > 0) prefBody.marketplace_fee = fee;
        const response = await pref.create({ body: prefBody });
        console.log(`💰 Preference creada: monto=${montoACobrar} fee=${fee} slug=${slugClean}`);
        return res.json({ payment_url: response.init_point, monto: montoACobrar, fee, pasarela: "mercadopago" });
      } catch (e) { return res.status(500).json({ success: false, error: "Error con MercadoPago." }); }
    }

    res.status(400).json({ success: false, error: "Sin pasarela de pago configurada." });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// RENOVACIÓN — Pago único mensual (reemplaza suscripciones)
// POST /api/renovacion/checkout
// GET  /api/renovacion/estado
// ══════════════════════════════════════════════════════════════
app.post("/api/renovacion/checkout", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.body.slug || req.auth.slug);
    if (!MP_PLATFORM_TOKEN) return res.status(500).json({ success: false, error: "Pasarela de renovación no configurada." });

    const { data: user, error } = await supabase.from("usuarios")
      .select("id, email, nombre_persona, apellido, business_name, plan, fecha_vencimiento")
      .eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const client   = new MercadoPagoConfig({ accessToken: MP_PLATFORM_TOKEN });
    const pref     = new Preference(client);
    const response = await pref.create({ body: {
      items: [{ title: `Associe — Renovación mensual (${user.business_name})`, unit_price: PRECIO_RENOVACION, quantity: 1, currency_id: "ARS" }],
      payer: { email: user.email, name: `${user.nombre_persona || ""} ${user.apellido || ""}`.trim() },
      metadata: { tipo: "renovacion_associe", slug, user_id: user.id },
      notification_url: `${API_URL}/webhook/renovacion`,
      back_urls: { success: RENOVACION_SUCCESS, failure: RENOVACION_CANCEL, pending: RENOVACION_CANCEL },
      auto_return: "approved",
    }});
    res.json({ success: true, payment_url: response.init_point, monto: PRECIO_RENOVACION });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/api/renovacion/estado", requireAuth, async (req, res) => {
  try {
    const slug = cleanSlug(req.query.slug || req.auth.slug);
    const { data: user, error } = await supabase.from("usuarios")
      .select("plan, estado_suscripcion, fecha_vencimiento").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, error: "Negocio no encontrado." });

    const diasRestantes      = user.fecha_vencimiento ? diasHastaVencer(user.fecha_vencimiento) : null;
    const suscripcionVencida = diasRestantes !== null && diasRestantes <= 0;
    res.json({
      success:           true,
      plan:              user.plan || "gratis",
      estado:            suscripcionVencida ? "suspendido" : (user.estado_suscripcion || "trial"),
      fecha_vencimiento: user.fecha_vencimiento,
      dias_restantes:    diasRestantes,
      alerta:            diasRestantes !== null && diasRestantes <= 5 && diasRestantes > 0,
      vencida:           suscripcionVencida,
      precio_renovacion: PRECIO_RENOVACION,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// OAUTH — Mercado Pago
// GET /oauth-callback
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
// WEBHOOK — Mercado Pago (turnos)
// ══════════════════════════════════════════════════════════════
async function procesarPagoConfirmado({ slug, nombre, telefono, email, fecha, hora, servicio_id, servicio_nombre, monto, moneda, metodo_pago, payment_id, estado }) {
  let turnoId = null;
  if (estado === "aprobado") {
    const { data: turnoInsertado } = await supabase.from("turnos").insert([{
      slug, nombre: nombre?.trim() || "Cliente", telefono: cleanPhone(telefono?.toString() || "0"),
      email: email?.trim().toLowerCase() || null, fecha, hora,
      servicio_id: servicio_id || null, servicio_nombre: servicio_nombre || null,
      precio_cobrado: monto, estado: "confirmado", metodo_pago, payment_id: String(payment_id),
    }]).select().single();
    turnoId = turnoInsertado?.id || null;

    const { data: userNegocio } = await supabase.from("usuarios").select("email").eq("slug", slug).maybeSingle();
    if (userNegocio?.email) {
      fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "newAppointmentEmail", nombreCliente: nombre?.trim() || "Cliente", fechaHora: `${fecha} ${hora}`, adminEmail: userNegocio.email, emailCliente: email?.trim() || "" }),
      }).catch((e) => console.error("Error mail webhook:", e.message));
    }
  }
  await supabase.from("ventas").insert([{
    slug, turno_id: turnoId, fecha_turno: fecha, fecha_pago: new Date().toISOString(),
    monto, moneda: moneda || "ARS", metodo_pago, estado,
    nombre_cliente: nombre?.trim() || "Cliente", email_cliente: email?.trim() || null,
    telefono_cliente: cleanPhone(telefono?.toString() || ""),
    servicio_id: servicio_id || null, servicio_nombre: servicio_nombre || null,
    payment_id: String(payment_id),
  }]);
  invalidateCache(slug);
}

app.post("/webhook/mp", async (req, res) => {
  const { query, body } = req;
  try {
    if (query.topic === "payment" || body.type === "payment") {
      const paymentId = query.id || body.data?.id;
      if (!paymentId) return res.sendStatus(200);
      const payRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } });
      const payData = await payRes.json();
      if (payData.metadata?.tipo === "renovacion_associe") { await procesarRenovacion(payData); return res.sendStatus(200); }
      const slug = cleanSlug(payData.metadata?.slug || "");
      if (!slug) return res.sendStatus(200);
      const { data: userNegocio } = await supabase.from("usuarios").select("mp_access_token").eq("slug", slug).maybeSingle();
      let meta = payData.metadata;
      if (userNegocio?.mp_access_token) {
        const real = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${userNegocio.mp_access_token}` } });
        meta = (await real.json()).metadata;
      }
      const estado = payData.status === "approved" ? "aprobado" : payData.status === "pending" ? "pendiente" : "rechazado";
      await procesarPagoConfirmado({ slug, nombre: meta.nombre, telefono: meta.telefono, email: meta.email, fecha: meta.fecha, hora: meta.hora, servicio_id: meta.servicio_id || null, servicio_nombre: meta.servicio_nombre || null, monto: Number(payData.transaction_amount || 0), moneda: payData.currency_id || "ARS", metodo_pago: "mercadopago", payment_id: paymentId, estado });
    }
    res.sendStatus(200);
  } catch (e) { console.error("Error en /webhook/mp:", e.message); res.sendStatus(200); }
});

// ══════════════════════════════════════════════════════════════
// WEBHOOK — Renovación mensual (pago único)
// ══════════════════════════════════════════════════════════════
async function procesarRenovacion(payData) {
  if (payData.status !== "approved") return;
  const slug = cleanSlug(payData.metadata?.slug || "");
  if (!slug) return;
  const { data: user } = await supabase.from("usuarios")
    .select("id, email, nombre_persona, plan, fecha_vencimiento").eq("slug", slug).maybeSingle();
  if (!user) return;

  // Sumar 30 días desde hoy o desde la fecha vigente si aún no venció
  const fechaBase  = user.fecha_vencimiento && new Date(user.fecha_vencimiento) > new Date() ? user.fecha_vencimiento : null;
  const nuevaFecha = calcularVencimiento(30, fechaBase);

  await supabase.from("usuarios").update({
    fecha_vencimiento:  nuevaFecha,
    estado_suscripcion: "activo",
    plan:               "premium",
  }).eq("slug", slug);

  invalidateCache(slug);
  console.log(`✅ Renovación aprobada: ${slug} → vence ${nuevaFecha}`);

  if (user.email) {
    fetch(APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "renovacionAprobada", adminEmail: user.email, nombre: user.nombre_persona || "Cliente", slug, nuevaFecha }),
    }).catch((e) => console.error("Error mail renovación:", e.message));
  }
}

app.post("/webhook/renovacion", async (req, res) => {
  const { query, body } = req;
  try {
    if (query.topic === "payment" || body.type === "payment") {
      const paymentId = query.id || body.data?.id;
      if (!paymentId) return res.sendStatus(200);
      const payRes  = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${MP_PLATFORM_TOKEN}` } });
      await procesarRenovacion(await payRes.json());
    }
    res.sendStatus(200);
  } catch (e) { console.error("Error en /webhook/renovacion:", e.message); res.sendStatus(200); }
});

// ══════════════════════════════════════════════════════════════
// CRON — Verificación de vencimientos
// GET /cron/check-vencimientos
// ══════════════════════════════════════════════════════════════
app.get("/cron/check-vencimientos", requireAdminKey, async (req, res) => {
  try {
    const hoyISO = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })).toISOString().split("T")[0];

    // Suspender premium vencidos (gratis tienen fecha_vencimiento NULL → no los toca)
    const { data: vencidos, error } = await supabase.from("usuarios")
      .select("id, slug")
      .eq("activo", "true")
      .neq("estado_suscripcion", "suspendido")
      .not("fecha_vencimiento", "is", null)
      .lt("fecha_vencimiento", hoyISO);
    if (error) throw error;

    const slugs = (vencidos || []).map((u) => u.slug);
    if (slugs.length > 0) {
      await supabase.from("usuarios").update({ estado_suscripcion: "suspendido" }).in("slug", slugs);
      slugs.forEach((s) => invalidateCache(s));
    }

    // Reactivar si pagaron (fecha_vencimiento >= hoy y estaban suspendidos)
    const { data: reactivables } = await supabase.from("usuarios")
      .select("id, slug")
      .eq("activo", "true")
      .eq("estado_suscripcion", "suspendido")
      .not("fecha_vencimiento", "is", null)
      .gte("fecha_vencimiento", hoyISO);
    const slugsReactivar = (reactivables || []).map((u) => u.slug);
    if (slugsReactivar.length > 0) {
      await supabase.from("usuarios").update({ estado_suscripcion: "activo" }).in("slug", slugsReactivar);
      slugsReactivar.forEach((s) => invalidateCache(s));
    }

    res.json({ success: true, fecha: hoyISO, suspendidos: slugs, reactivados: slugsReactivar });
  } catch (e) {
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
  ║   Associe API v12.0                          ║
  ║   activo: 'true' / 'false'                   ║
  ║   plan:   'gratis' / 'premium'               ║
  ║   Puerto: ${PORT}                              ║
  ╚═══════════════════════════════════════════════╝
  `);
});

export default app;
