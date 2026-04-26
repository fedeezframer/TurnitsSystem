import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { MercadoPagoConfig, Preference } from "mercadopago";
import Stripe from "stripe";
import fetch from "node-fetch";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";

// ─── CONFIGURACIÓN GLOBAL ────────────────────────────────────────────────────
const app = express();
const MASTER_SHEET_ID = "1CYF1IJFEKibbkXTKco-o13ZbMo6KpkT5oJj35Z3q4hg";
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzvcaYhHuyD-Xu63Aw9WpWrpcr5xmrgHW_IffXkmC90bs0pTzhWP1d8rWBaBuhG5Icx/exec";
const BCRYPT_ROUNDS = 10;
const CACHE_DURATION = 20000;

// ─── VALIDADORES ───────────────��────────────────────────────────────────────
const getCleanSlug = (rawSlug) => {
  if (!rawSlug) return "";
  return rawSlug
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
};

const getCleanDomain = (rawDomain) => {
  if (!rawDomain) return "";
  return rawDomain.toLowerCase().trim();
};

const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePassword = (pwd) => {
  return pwd && pwd.length >= 8;
};

const validateSlug = (slug) => {
  return /^[a-z0-9-]{3,50}$/.test(slug);
};

const validateDomain = (domain) => {
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain);
};

const validatePhone = (phone) => {
  return /^[0-9\-\s\+]{5,20}$/.test(phone);
};

// ─── ERROR CLASSES ───────────────────────────────────────────────────────────
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class AuthenticationError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
  }
}

// ─── CACHÉ EN MEMORIA ────────────────────────────────────────────────────────
const globalCache = {};

// ─── RATE LIMITING ───────────────────────────────────────────────────────────
const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: "Demasiados intentos de autenticación. Intenta más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
});

const limiterBooking = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: "Demasiadas reservas. Intenta más tarde.",
});

const limiterAPI = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});

// ─── CONFIGURACIÓN CORS ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "https://negosocio.framer.website",
      "https://framerturnero.onrender.com",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(limiterAPI);

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ─── HELPERS PARA GOOGLE ─────────────────────────────────────────────────────
async function getGoogleAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new AppError("Google credentials no configuradas", 500);
  }
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheets() {
  const auth = await getGoogleAuth();
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

// ─── MIDDLEWARE DE AUTENTICACIÓN ─────────────────────────────────────────────
// Ahora autenticar por DOMAIN (no por slug)
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        error: "No autorizado: falta el token." 
      });
    }

    const token = authHeader.split(" ")[1];
    const domainFromBody = getCleanDomain(req.body?.domain || req.params?.domain || "");

    if (!token || !domainFromBody) {
      return res.status(401).json({ 
        success: false,
        error: "No autorizado: datos incompletos." 
      });
    }

    if (!validateDomain(domainFromBody)) {
      return res.status(400).json({ 
        success: false,
        error: "Domain inválido." 
      });
    }

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("domain, access_token")
      .eq("domain", domainFromBody)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false,
        error: "No autorizado: usuario no encontrado." 
      });
    }

    if (!user.access_token || user.access_token !== token) {
      return res.status(401).json({ 
        success: false,
        error: "No autorizado: token inválido o expirado." 
      });
    }

    req.authenticatedDomain = user.domain;
    next();
  } catch (e) {
    console.error("Error en requireAuth:", e.message);
    res.status(500).json({ 
      success: false,
      error: "Error interno de autenticación." 
    });
  }
}

// ─── ERROR HANDLER GLOBAL ────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.message);

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    error: "Error interno del servidor",
  });
};

// ─── RUTA RAÍZ ───────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "NegoSocio API v2.0 — Online",
    version: "2.0.0",
    model: "Domain-based SaaS",
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH & REGISTRO
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/request-verification
app.post("/api/request-verification", limiterAuth, async (req, res) => {
  try {
    const { email, business_name, password, domain, precio, duracion_turno, horarios } =
      req.body;

    // Validaciones
    if (!email || !business_name || !password || !domain) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos: email, negocio, dominio o contraseña.",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Email inválido.",
      });
    }

    if (!validateDomain(domain)) {
      return res.status(400).json({
        success: false,
        error: "Domain inválido.",
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        error: "La contraseña debe tener al menos 8 caracteres.",
      });
    }

    if (business_name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "El nombre del negocio debe tener al menos 3 caracteres.",
      });
    }

    // Verificar que email y domain no estén registrados
    const cleanDomain = getCleanDomain(domain);
    const { data: existingUser } = await supabase
      .from("usuarios")
      .select("email, domain")
      .or(`email.eq.${email.trim().toLowerCase()},domain.eq.${cleanDomain}`)
      .single();

    if (existingUser) {
      if (existingUser.email === email.trim().toLowerCase()) {
        return res.status(409).json({
          success: false,
          error: "Este email ya está registrado.",
        });
      }
      if (existingUser.domain === cleanDomain) {
        return res.status(409).json({
          success: false,
          error: "Este domain ya está registrado.",
        });
      }
    }

    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "sendCode",
        email: email.trim().toLowerCase(),
        usuario: business_name,
        password,
        precio: precio || 0,
        duracion_turno: duracion_turno || 30,
        horarios:
          typeof horarios === "string" ? horarios : JSON.stringify(horarios),
      }),
    });

    const text = await googleRes.text();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    
    if (start === -1 || end === -1) {
      return res.status(500).json({
        success: false,
        error: "Respuesta inválida del servidor de correos.",
      });
    }

    const result = JSON.parse(text.substring(start, end + 1));
    
    if (result.status === "success") {
      res.json({ success: true, message: "Código de verificación enviado" });
    } else {
      res.status(500).json({ 
        success: false,
        error: result.message || "Error en Google Script." 
      });
    }
  } catch (e) {
    console.error("Error en /api/request-verification:", e.message);
    res.status(500).json({ 
      success: false,
      error: "Error de conexión con el servicio de correos." 
    });
  }
});

// POST /api/verify-and-register
app.post("/api/verify-and-register", limiterAuth, async (req, res) => {
  try {
    const {
      email,
      code,
      business_name,
      domain,
      nombre_persona,
      precio,
      duracion_turno,
      horarios,
      telefono,
    } = req.body;

    // Validaciones
    if (!email || !code || !business_name || !domain) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos.",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Email inválido.",
      });
    }

    if (!validateDomain(domain)) {
      return res.status(400).json({
        success: false,
        error: "Domain inválido.",
      });
    }

    if (telefono && !validatePhone(telefono)) {
      return res.status(400).json({
        success: false,
        error: "Teléfono inválido.",
      });
    }

    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "verifyCode",
        email: email.trim().toLowerCase(),
        code: code.toString().trim(),
      }),
    });

    const result = await googleRes.json();

    if (result.status !== "valid") {
      return res.status(400).json({
        success: false,
        error: "El código de verificación es incorrecto o expirado.",
      });
    }

    const cleanDomain = getCleanDomain(domain);
    const cleanSlug = getCleanSlug(business_name);
    const accessToken = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(String(result.password), BCRYPT_ROUNDS);

    const { error } = await supabase.from("usuarios").insert([
      {
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        slug: cleanSlug,
        domain: cleanDomain,
        nombre_persona: nombre_persona?.trim() || "Dueño",
        business_name: business_name.trim(),
        telefono: telefono || null,
        sheet_id: MASTER_SHEET_ID,
        precio: parseInt(precio) || 0,
        duracion_turno: parseInt(duracion_turno) || 30,
        horarios: horarios || {},
        metodo_pago: "none",
        excepciones: [],
        mp_access_token: null,
        stripe_secret_key: null,
        access_token: accessToken,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          error: "Este email o domain ya está registrado.",
        });
      }
      throw error;
    }

    // Mail de bienvenida (no bloquea si falla)
    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "welcomeEmail",
        email: email.trim().toLowerCase(),
        usuario: business_name.trim(),
      }),
    }).catch((e) => console.error("Error mail bienvenida:", e.message));

    console.log(`Usuario registrado: ${cleanDomain}`);
    res.status(201).json({
      success: true,
      domain: cleanDomain,
      access_token: accessToken,
      message: "Cuenta creada con éxito.",
    });
  } catch (e) {
    console.error("Error en /api/verify-and-register:", e.message);
    res.status(500).json({ 
      success: false,
      error: "No se pudo completar el registro." 
    });
  }
});

// POST /login
app.post("/login", limiterAuth, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Faltan email o contraseña.",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Email inválido.",
      });
    }

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: "Credenciales incorrectas." 
      });
    }

    // Validar contraseña con bcrypt
    let passwordOk = false;
    const isHashed = user.password?.startsWith("$2b$") || user.password?.startsWith("$2a$");

    if (isHashed) {
      passwordOk = await bcrypt.compare(String(password), user.password);
    } else {
      // Fallback para usuarios viejos con contraseña en texto plano
      passwordOk = String(user.password) === String(password);
      if (passwordOk) {
        const newHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
        await supabase
          .from("usuarios")
          .update({ password: newHash })
          .eq("email", email.trim().toLowerCase());
        console.log(`Contraseña migrada a bcrypt para: ${user.domain}`);
      }
    }

    if (!passwordOk) {
      return res.status(401).json({ 
        success: false, 
        error: "Credenciales incorrectas." 
      });
    }

    // Generar nuevo access token
    const newAccessToken = crypto.randomBytes(32).toString("hex");
    await supabase
      .from("usuarios")
      .update({ access_token: newAccessToken })
      .eq("email", email.trim().toLowerCase());

    res.json({
      success: true,
      domain: user.domain,
      access_token: newAccessToken,
      business_name: user.business_name,
      email: user.email,
    });
  } catch (e) {
    console.error("Error en /login:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// GET /verify-session?domain=negosocio.framer.website
app.get("/verify-session", async (req, res) => {
  try {
    const domain = getCleanDomain(req.query.domain);
    const authHeader = req.headers["authorization"];
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!domain) {
      return res.json({ active: false, reason: "no_domain" });
    }

    if (!validateDomain(domain)) {
      return res.json({ active: false, reason: "invalid_domain" });
    }

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("domain, access_token, business_name, email")
      .eq("domain", domain)
      .single();

    if (error || !user) {
      return res.json({ active: false, reason: "user_not_found" });
    }

    // Verificación con access token
    if (accessToken && user.access_token && user.access_token === accessToken) {
      return res.json({
        active: true,
        domain: user.domain,
        business_name: user.business_name,
        email: user.email,
      });
    }

    return res.json({ active: false, reason: "invalid_token" });
  } catch (e) {
    console.error("Error en /verify-session:", e.message);
    res.status(500).json({ active: false, error: e.message });
  }
});

// POST /api/request-password-reset
app.post("/api/request-password-reset", limiterAuth, async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: "Faltan datos." 
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ 
        success: false,
        error: "Email inválido." 
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ 
        success: false,
        error: "La contraseña debe tener al menos 8 caracteres." 
      });
    }

    const { data: user } = await supabase
      .from("usuarios")
      .select("domain")
      .eq("email", email.trim().toLowerCase())
      .single();

    // No revelar si el email existe
    if (!user) {
      return res.json({ 
        success: true,
        message: "Si el email existe, recibirás un código de verificación." 
      });
    }

    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "resetPassword",
        email: email.trim().toLowerCase(),
        newPassword,
      }),
    });

    const text = await googleRes.text();
    const result = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
    
    if (result.status === "success") {
      res.json({ 
        success: true,
        message: "Si el email existe, recibirás un código de verificación." 
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: result.message 
      });
    }
  } catch (e) {
    console.error("Error en /api/request-password-reset:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// POST /api/verify-and-reset-password
app.post("/api/verify-and-reset-password", limiterAuth, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: "Faltan email o código.",
      });
    }

    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "verifyCode",
        email: email.trim().toLowerCase(),
        code: code.toString().trim(),
      }),
    });

    const result = await googleRes.json();

    if (result.status !== "valid") {
      return res.status(400).json({
        success: false,
        error: "Código incorrecto o expirado.",
      });
    }

    const hashedPassword = await bcrypt.hash(String(result.password), BCRYPT_ROUNDS);
    const { error } = await supabase
      .from("usuarios")
      .update({ password: hashedPassword })
      .eq("email", email.trim().toLowerCase());

    if (error) throw error;

    res.json({ 
      success: true,
      message: "Contraseña actualizada con éxito." 
    });
  } catch (e) {
    console.error("Error en /api/verify-and-reset-password:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGOS: MERCADO PAGO Y STRIPE
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/create-preference
app.post("/api/create-preference", limiterBooking, async (req, res) => {
  try {
    const { nombre, telefono, email, fecha, hora, domain, servicio_id } = req.body;

    if (!nombre || !telefono || !fecha || !hora || !domain) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos.",
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: "Email inválido.",
      });
    }

    if (!validatePhone(telefono.toString())) {
      return res.status(400).json({
        success: false,
        error: "Teléfono inválido.",
      });
    }

    const cleanDomain = getCleanDomain(domain);

    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("domain", cleanDomain)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false,
        error: "Negocio no encontrado." 
      });
    }

    // Precio y concepto
    let precioFinal = Number(user.precio || 0);
    let nombreServicio = "Reserva";

    if (servicio_id) {
      const { data: servicio } = await supabase
        .from("servicios")
        .select("*")
        .eq("id", servicio_id)
        .eq("domain", cleanDomain)
        .single();

      if (servicio) {
        precioFinal = Number(servicio.precio || precioFinal);
        nombreServicio = servicio.nombre || nombreServicio;
      }
    }

    if (user.metodo_pago === "sena" && user.monto_sena) {
      precioFinal = Number(user.monto_sena);
    }

    const metodo = user.metodo_pago || "none";
    const debePagar = metodo === "sena" || metodo === "total";

    if (!debePagar || precioFinal <= 0) {
      return res.json({ isFree: true });
    }

    const conceptoPago = metodo === "sena" ? "Seña" : "Total";

    // ── STRIPE ──
    if (user.stripe_secret_key) {
      try {
        const stripe = new Stripe(user.stripe_secret_key);
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "ars",
                product_data: {
                  name: `${nombreServicio} (${conceptoPago}): ${fecha} a las ${hora}hs`,
                },
                unit_amount: Math.round(precioFinal * 100),
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            nombre,
            telefono,
            email: email || "",
            fecha,
            hora,
            domain: cleanDomain,
            servicio_id: servicio_id || "",
            metodo_pago: metodo,
          },
          success_url: "https://negosocio.framer.website/success",
          cancel_url: "https://negosocio.framer.website/error",
        });
        return res.json({ payment_url: session.url });
      } catch (stripeError) {
        console.error("Error Stripe:", stripeError.message);
        return res.status(500).json({
          success: false,
          error: "Error procesando pago con Stripe.",
        });
      }
    }

    // ── MERCADO PAGO ──
    if (user.mp_access_token) {
      try {
        const client = new MercadoPagoConfig({
          accessToken: user.mp_access_token,
        });
        const preference = new Preference(client);
        const response = await preference.create({
          body: {
            items: [
              {
                title: `${nombreServicio} (${conceptoPago}): ${fecha} - ${hora}hs`,
                unit_price: precioFinal,
                quantity: 1,
                currency_id: "ARS",
              },
            ],
            metadata: {
              nombre,
              telefono,
              email: email || "",
              fecha,
              hora,
              domain: cleanDomain,
              servicio_id: servicio_id || "",
              tipo_pago: metodo,
            },
            notification_url: "https://framerturnero.onrender.com/webhook",
            back_urls: {
              success: "https://negosocio.framer.website/success",
              failure: "https://negosocio.framer.website/error",
              pending: "https://negosocio.framer.website/error",
            },
            auto_return: "approved",
          },
        });
        return res.json({ payment_url: response.init_point });
      } catch (mpError) {
        console.error("Error MercadoPago:", mpError.message);
        return res.status(500).json({
          success: false,
          error: "Error procesando pago con MercadoPago.",
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: "El negocio no tiene método de pago configurado.",
    });
  } catch (e) {
    console.error("Error en /api/create-preference:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// GET /oauth-callback
app.get("/oauth-callback", async (req, res) => {
  const { code, state: domain } = req.query;

  if (!code || !domain) {
    return res.status(400).send("Parámetros inválidos.");
  }

  try {
    const cleanDomain = getCleanDomain(domain);

    if (!validateDomain(cleanDomain)) {
      return res.status(400).send("Domain inválido.");
    }

    const response = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.MP_TURNERO_CLIENT_ID,
        client_secret: process.env.MP_TURNERO_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://framerturnero.onrender.com/oauth-callback",
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      const { error } = await supabase
        .from("usuarios")
        .update({ mp_access_token: data.access_token })
        .eq("domain", cleanDomain);

      if (error) {
        return res.redirect(
          `https://negosocio.framer.website/dashboard?status=mp_error&domain=${cleanDomain}`
        );
      }

      console.log(`MP vinculado para: ${cleanDomain}`);
      return res.redirect(
        `https://negosocio.framer.website/dashboard?status=mp_success&domain=${cleanDomain}`
      );
    }

    res.redirect(
      `https://negosocio.framer.website/dashboard?status=mp_error&domain=${cleanDomain}`
    );
  } catch (e) {
    console.error("Error en OAuth MP:", e.message);
    res.status(500).send("Error interno al vincular la cuenta.");
  }
});

// POST /webhook
app.post("/webhook", async (req, res) => {
  const { query, body } = req;

  try {
    if (query.topic === "payment" || body.type === "payment") {
      const paymentId = query.id || body.data?.id;

      if (paymentId) {
        const paymentResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            },
          }
        );
        const paymentData = await paymentResponse.json();

        if (paymentData.status === "approved" && paymentData.metadata?.domain) {
          const domain = getCleanDomain(paymentData.metadata.domain);

          const { data: userNegocio } = await supabase
            .from("usuarios")
            .select("mp_access_token, email")
            .eq("domain", domain)
            .single();

          let metadataFinal = paymentData.metadata;
          if (userNegocio?.mp_access_token) {
            const real = await fetch(
              `https://api.mercadopago.com/v1/payments/${paymentId}`,
              {
                headers: {
                  Authorization: `Bearer ${userNegocio.mp_access_token}`,
                },
              }
            );
            const realData = await real.json();
            metadataFinal = realData.metadata;
          }

          const { nombre, telefono, email, fecha, hora } = metadataFinal;
          const partes = fecha.split("-");
          const textoTurno = `${partes[2]}/${partes[1]} - ${hora}`;
          const fechaHoy = new Date().toLocaleDateString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
          });

          const sheets = await getSheets();
          await sheets.spreadsheets.values.append({
            spreadsheetId: MASTER_SHEET_ID,
            range: "A:G",
            valueInputOption: "RAW",
            requestBody: {
              values: [
                [
                  nombre?.trim() || "Cliente",
                  telefono?.toString().trim() || "N/A",
                  textoTurno,
                  fechaHoy,
                  domain,
                  "PENDIENTE",
                  email?.trim() || "",
                ],
              ],
            },
          });

          // Notificación por mail
          if (userNegocio?.email) {
            try {
              await fetch(APPS_SCRIPT_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({
                  action: "newAppointmentEmail",
                  nombreCliente: nombre?.trim() || "Cliente",
                  fechaHora: textoTurno,
                  adminEmail: userNegocio.email,
                  emailCliente: email?.trim() || "",
                }),
              });
            } catch (mailErr) {
              console.error("Error enviando mail webhook:", mailErr.message);
            }
          }

          delete globalCache[domain];
          console.log(`Turno agendado vía pago para: ${domain}`);
        }
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Error en webhook:", e.message);
    res.sendStatus(200);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TURNOS Y DISPONIBILIDAD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /get-occupied?domain=...
app.get("/get-occupied", async (req, res) => {
  try {
    const domain = getCleanDomain(req.query.domain);

    if (!validateDomain(domain)) {
      return res.status(400).json({
        success: false,
        error: "Domain inválido.",
      });
    }

    const sheets = await getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SHEET_ID,
      range: "A:F",
    });

    const rows = response.data.values || [];
    const ocupados = rows
      .filter((row) => row[4] === domain)
      .map((row) => row[2]);

    res.json({ success: true, ocupados });
  } catch (e) {
    console.error("Error en /get-occupied:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// POST /create-booking
app.post("/create-booking", limiterBooking, async (req, res) => {
  try {
    const { name, phone, email, fecha, hora, domain } = req.body;

    if (!name || !phone || !fecha || !hora || !domain) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos.",
      });
    }

    if (!validatePhone(phone.toString())) {
      return res.status(400).json({
        success: false,
        error: "Teléfono inválido.",
      });
    }

    const cleanDomain = getCleanDomain(domain);

    if (!validateDomain(cleanDomain)) {
      return res.status(400).json({
        success: false,
        error: "Domain inválido.",
      });
    }

    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("domain", cleanDomain)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: "Negocio no encontrado.",
      });
    }

    // Validar si requiere pago
    const requierePago =
      user.mp_access_token &&
      (user.metodo_pago === "sena" || user.metodo_pago === "total");
    if (requierePago) {
      return res.status(403).json({
        success: false,
        error: "Este turno requiere pago previo.",
      });
    }

    const sheets = await getSheets();

    // Anti-duplicado
    const existingData = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SHEET_ID,
      range: "A:G",
    });
    const existingRows = existingData.data.values || [];

    const yaExiste = existingRows.some((row) => {
      const phoneFila = row[1]?.toString().trim();
      const domainFila = row[4]?.toString().toLowerCase().trim();
      const emailFila = row[6]?.toString().toLowerCase().trim();
      const turnoFila = row[2]?.toString().trim();

      const mismoDomain = domainFila === cleanDomain;
      const mismoTelefono = phoneFila === phone.toString().trim();
      const mismoEmail =
        email && emailFila && emailFila === email.trim().toLowerCase();

      if (!mismoDomain || (!mismoTelefono && !mismoEmail)) return false;
      if (!turnoFila || !turnoFila.includes("/")) return false;

      const partes = turnoFila.split(" - ");
      if (partes.length < 2) return false;

      const [dia, mes] = partes[0].split("/").map(Number);
      const [hora_part, minuto] = partes[1].split(":").map(Number);
      const fechaTurno = new Date(
        new Date().getFullYear(),
        mes - 1,
        dia,
        hora_part,
        minuto
      );

      return fechaTurno > new Date();
    });

    if (yaExiste) {
      return res.status(400).json({
        success: false,
        error: "Ya tenés un turno agendado activo.",
      });
    }

    // Guardar en Sheets
    const partes = fecha.split("-");
    const textoTurno = `${partes[2]}/${partes[1]} - ${hora}`;
    const fechaHoy = new Date().toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: MASTER_SHEET_ID,
      range: "A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            name.trim(),
            phone.toString().trim(),
            textoTurno,
            fechaHoy,
            cleanDomain,
            "PENDIENTE",
            email?.trim() || "",
          ],
        ],
      },
    });

    // Notificación por mail
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          action: "newAppointmentEmail",
          nombreCliente: name.trim(),
          fechaHora: textoTurno,
          adminEmail: user.email,
          emailCliente: email?.trim() || "",
        }),
      });
    } catch (mailErr) {
      console.error("Error notificando mail:", mailErr.message);
    }

    delete globalCache[cleanDomain];
    res.json({ success: true, message: "Turno creado con éxito" });
  } catch (e) {
    console.error("Error en /create-booking:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// GET /slots-disponibles/:domain?fecha=YYYY-MM-DD&servicio_id=...
app.get("/slots-disponibles/:domain", async (req, res) => {
  try {
    const domain = getCleanDomain(req.params.domain);
    const { fecha, servicio_id } = req.query;

    if (!validateDomain(domain)) {
      return res.status(400).json({
        success: false,
        error: "Domain inválido.",
      });
    }

    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("horarios, duracion_turno, capacidad_por_turno, excepciones")
      .eq("domain", domain)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false,
        error: "Negocio no encontrado." 
      });
    }

    let duracion = user.duracion_turno || 30;
    let capacidad = user.capacidad_por_turno || 1;

    if (servicio_id) {
      const { data: servicio } = await supabase
        .from("servicios")
        .select("duracion, capacidad")
        .eq("id", servicio_id)
        .eq("domain", domain)
        .single();

      if (servicio) {
        duracion = servicio.duracion || duracion;
        capacidad = servicio.capacidad || capacidad;
      }
    }

    if (user.excepciones?.includes(fecha)) {
      return res.json({ success: true, slots: [] });
    }

    const diasSemana = [
      "domingo",
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "sabado",
    ];
    const fechaObj = new Date(fecha + "T12:00:00");
    const diaNombre = diasSemana[fechaObj.getDay()];
    const diaConfig = user.horarios?.[diaNombre];

    if (!diaConfig?.activo) {
      return res.json({ success: true, slots: [] });
    }

    const toMinutes = (t) => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const fromMinutes = (mins) => {
      const h = Math.floor(mins / 60).toString().padStart(2, "0");
      const m = (mins % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    const [jornadaIni, jornadaFin] = diaConfig.jornada;
    const [descansoIni, descansoFin] = diaConfig.descanso || [null, null];
    const inicio = toMinutes(jornadaIni);
    const fin = toMinutes(jornadaFin);
    const dIni = toMinutes(descansoIni);
    const dFin = toMinutes(descansoFin);

    const slotsGenerados = [];
    let cursor = inicio;

    while (cursor + duracion <= fin) {
      const enDescanso = dIni && dFin && cursor >= dIni && cursor < dFin;
      if (!enDescanso) slotsGenerados.push(fromMinutes(cursor));
      cursor += duracion;
    }

    const sheets = await getSheets();
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SHEET_ID,
      range: "A:G",
    });

    const allRows = sheetData.data.values || [];
    const [anio, mes, dia] = fecha.split("-");
    const fechaFormateada = `${dia}/${mes}`;

    const reservasPorSlot = {};
    allRows.forEach((row, i) => {
      if (i === 0) return;
      const turnoFila = row[2]?.toString().trim();
      const domainFila = row[4]?.toString().toLowerCase().trim();

      if (domainFila !== domain || !turnoFila) return;

      const partes = turnoFila.split(" - ");
      if (partes.length < 2) return;

      if (partes[0].trim() === fechaFormateada) {
        const horaFila = partes[1].trim();
        reservasPorSlot[horaFila] = (reservasPorSlot[horaFila] || 0) + 1;
      }
    });

    const slots = slotsGenerados.map((slot) => {
      const reservados = reservasPorSlot[slot] || 0;
      const disponibles = capacidad - reservados;

      return {
        hora: slot,
        disponibles: Math.max(0, disponibles),
        lleno: disponibles <= 0,
      };
    });

    res.json({ success: true, slots });
  } catch (e) {
    console.error("Error en /slots-disponibles:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /servicios/admin/:domain — todos los servicios (protegido)
app.get("/servicios/admin/:domain", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    const domain = getCleanDomain(req.params.domain);

    if (!token || !domain) {
      return res.status(401).json({ 
        success: false,
        error: "No autorizado." 
      });
    }

    if (!validateDomain(domain)) {
      return res.status(400).json({
        success: false,
        error: "Domain inválido.",
      });
    }

    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("domain, access_token")
      .eq("domain", domain)
      .single();

    if (userError || !user || user.access_token !== token) {
      return res.status(401).json({ 
        success: false,
        error: "No autorizado." 
      });
    }

    const { data, error } = await supabase
      .from("servicios")
      .select("*")
      .eq("domain", domain)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ success: true, servicios: data || [] });
  } catch (e) {
    console.error("Error en /servicios/admin:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// GET /servicios/:domain — servicios públicos activos
app.get("/servicios/:domain", async (req, res) => {
  try {
    const domain = getCleanDomain(req.params.domain);

    if (!validateDomain(domain)) {
      return res.status(400).json({
        success: false,
        error: "Domain inválido.",
      });
    }

    const { data, error } = await supabase
      .from("servicios")
      .select("id, nombre, descripcion, duracion, precio, capacidad")
      .eq("domain", domain)
      .eq("activo", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    res.json({ success: true, servicios: data || [] });
  } catch (e) {
    console.error("Error en /servicios:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// POST /servicios/crear (protegido)
app.post("/servicios/crear", requireAuth, async (req, res) => {
  try {
    const { domain, nombre, descripcion, duracion, precio, capacidad } = req.body;
    const cleanDomain = getCleanDomain(domain);

    if (!cleanDomain || !nombre || !duracion || precio === undefined) {
      return res.status(400).json({
        success: false,
        error: "Faltan campos: domain, nombre, duracion, precio.",
      });
    }

    if (nombre.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "El nombre del servicio debe tener al menos 3 caracteres.",
      });
    }

    const { data, error } = await supabase
      .from("servicios")
      .insert([
        {
          domain: cleanDomain,
          nombre: nombre.trim(),
          descripcion: descripcion?.trim() || "",
          duracion: parseInt(duracion),
          precio: Number(precio),
          capacidad: parseInt(capacidad) || 1,
          activo: true,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    delete globalCache[cleanDomain];
    res.status(201).json({ success: true, servicio: data });
  } catch (e) {
    console.error("Error en /servicios/crear:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// POST /servicios/editar (protegido)
app.post("/servicios/editar", requireAuth, async (req, res) => {
  try {
    const {
      id,
      domain,
      nombre,
      descripcion,
      duracion,
      precio,
      capacidad,
      activo,
    } = req.body;
    const cleanDomain = getCleanDomain(domain);

    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: "Falta el id." 
      });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (nombre !== undefined) {
      if (nombre.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: "El nombre debe tener al menos 3 caracteres.",
        });
      }
      updateData.nombre = nombre.trim();
    }

    if (descripcion !== undefined) updateData.descripcion = descripcion.trim();
    if (duracion !== undefined) updateData.duracion = parseInt(duracion);
    if (precio !== undefined) updateData.precio = Number(precio);
    if (capacidad !== undefined) updateData.capacidad = parseInt(capacidad);
    if (activo !== undefined) updateData.activo = activo;

    const { data, error } = await supabase
      .from("servicios")
      .update(updateData)
      .eq("id", id)
      .eq("domain", cleanDomain)
      .select()
      .single();

    if (error) throw error;

    delete globalCache[cleanDomain];
    res.json({ success: true, servicio: data });
  } catch (e) {
    console.error("Error en /servicios/editar:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// POST /servicios/eliminar (protegido)
app.post("/servicios/eliminar", requireAuth, async (req, res) => {
  try {
    const { id, domain } = req.body;
    const cleanDomain = getCleanDomain(domain);

    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: "Falta el id." 
      });
    }

    const { error } = await supabase
      .from("servicios")
      .delete()
      .eq("id", id)
      .eq("domain", cleanDomain);

    if (error) throw error;

    delete globalCache[cleanDomain];
    res.json({ success: true, message: "Servicio eliminado" });
  } catch (e) {
    console.error("Error en /servicios/eliminar:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN Y CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin-stats/:domain (protegido)
app.get("/admin-stats/:domain", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;
  const domain = getCleanDomain(req.params.domain);

  if (!token || !domain) {
    return res.status(401).json({ 
      success: false,
      error: "No autorizado." 
    });
  }

  if (!validateDomain(domain)) {
    return res.status(400).json({
      success: false,
      error: "Domain inválido.",
    });
  }

  const { data: authUser, error: authError } = await supabase
    .from("usuarios")
    .select("domain, access_token")
    .eq("domain", domain)
    .single();

  if (authError || !authUser || authUser.access_token !== token) {
    return res.status(401).json({ 
      success: false,
      error: "No autorizado." 
    });
  }

  const now = Date.now();
  if (globalCache[domain] && now - globalCache[domain].timestamp < CACHE_DURATION) {
    return res.json(globalCache[domain].data);
  }

  try {
    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("domain", domain)
      .single();

    if (userError || !user) {
      return res.status(404).json({ 
        success: false,
        error: "Usuario no encontrado." 
      });
    }

    const sheets = await getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SHEET_ID,
      range: "A:E",
    });

    const allRows = response.data.values || [];
    const rows = allRows.filter(
      (r, i) => i === 0 || (r[4] && getCleanDomain(r[4]) === domain)
    );

    const ahoraArg = new Date(
      new Date().toLocaleString("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
      })
    );

    const mesActual = ahoraArg.getMonth() + 1;
    const diaHoyNum = ahoraArg.getDate();
    const anioActual = ahoraArg.getFullYear();

    let turnosHoy = 0;
    let turnosMesActual = 0;
    let turnosLista = [];
    const semanas = { "Sem 1": 0, "Sem 2": 0, "Sem 3": 0, "Sem 4": 0 };

    rows.forEach((r, i) => {
      if (i === 0 || !r[2]) return;

      const partes = r[2].toString().split(" - ");
      if (partes.length < 2) return;

      const [dia, mes] = partes[0].split("/").map(Number);

      let semanaIdx = 0;
      if (dia > 7 && dia <= 14) semanaIdx = 1;
      else if (dia > 14 && dia <= 21) semanaIdx = 2;
      else if (dia > 21) semanaIdx = 3;

      if (mes === mesActual) {
        turnosMesActual++;
        if (dia === diaHoyNum) turnosHoy++;
        semanas[`Sem ${semanaIdx + 1}`]++;
      }

      turnosLista.push({
        nombre: r[0],
        telefono: r[1],
        fecha: `${anioActual}-${String(mes).padStart(2, "0")}-${String(dia).padStart(
          2,
          "0"
        )}`,
        hora: partes[1],
        semanaIdx,
        duracion: user.duracion_turno || 60,
        rawTurno: r[2],
      });
    });

    const finalData = {
      stats: {
        nombre_persona: user.nombre_persona,
        turnosHoy,
        turnosMes: turnosMesActual,
        ingresosEstimados: turnosMesActual * (user.precio || 0),
        promedioDiario:
          diaHoyNum > 0
            ? Math.round((turnosMesActual * (user.precio || 0)) / diaHoyNum)
            : 0,
        chartData: Object.keys(semanas).map((key) => ({
          label: key,
          turnos: semanas[key],
        })),
        businessName: user.business_name,
        horarios: user.horarios,
        config: {
          duracion: user.duracion_turno,
          precio: user.precio,
          monto_sena: user.monto_sena || 0,
          metodo_pago: user.metodo_pago || "none",
          mp_status: user.mp_access_token ? "Conectado" : "Desconectado",
          excepciones: user.excepciones || [],
        },
        turnosLista: turnosLista.reverse(),
      },
    };

    globalCache[domain] = { timestamp: now, data: finalData };
    res.json(finalData);
  } catch (e) {
    console.error("Error en /admin-stats:", e.message);
    res.status(500).json({ 
      success: false,
      error: "Error al procesar las estadísticas." 
    });
  }
});

// POST /update-settings (protegido)
app.post("/update-settings", requireAuth, async (req, res) => {
  try {
    const {
      domain,
      precio,
      horarios,
      duracion_turno,
      ocupados,
      monto_sena,
      metodo_pago,
    } = req.body;

    const cleanDomain = getCleanDomain(domain);

    const numPrecio = parseInt(precio) || 0;
    const numSena = parseInt(monto_sena) || 0;

    if (numPrecio < 0) {
      return res.status(400).json({
        success: false,
        error: "El precio no puede ser negativo.",
      });
    }

    const updateData = {
      precio: numPrecio,
      monto_sena: numSena,
      metodo_pago: metodo_pago || "none",
      duracion_turno: parseInt(duracion_turno) || 30,
      updated_at: new Date().toISOString(),
    };

    if (horarios) updateData.horarios = horarios;
    if (ocupados) updateData.excepciones = ocupados;

    const { error } = await supabase
      .from("usuarios")
      .update(updateData)
      .eq("domain", cleanDomain);

    if (error) throw error;

    delete globalCache[cleanDomain];
    res.json({ success: true, message: "Configuración actualizada" });
  } catch (e) {
    console.error("Error en /update-settings:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// POST /cancel-appointment (protegido)
app.post("/cancel-appointment", requireAuth, async (req, res) => {
  try {
    const { domain, rawTurno } = req.body;
    const cleanDomain = getCleanDomain(domain);

    if (!rawTurno) {
      return res.status(400).json({
        success: false,
        error: "Falta el rawTurno.",
      });
    }

    const sheets = await getSheets();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SHEET_ID,
      range: "A:E",
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(
      (r) => r[2] === rawTurno && r[4] === cleanDomain
    );

    if (rowIndex === -1) {
      return res.status(404).json({ 
        success: false,
        error: "Turno no encontrado." 
      });
    }

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: MASTER_SHEET_ID,
    });

    const sheetIdReal = spreadsheet.data.sheets[0].properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetIdReal,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    delete globalCache[cleanDomain];
    res.json({ success: true, message: "Turno cancelado" });
  } catch (e) {
    console.error("Error en /cancel-appointment:", e.message);
    res.status(500).json({ 
      success: false,
      error: e.message 
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING Y 404
// ═══════════════════════════════════════════════════════════════════════════════

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
    path: req.originalUrl,
  });
});

app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║   NegoSocio API v2.0 - Online             ║
  ║   Port: ${PORT}                             ║
  ║   Model: Domain-based SaaS                ║
  ║   Environment: ${process.env.NODE_ENV || "development"}             ║
  ╚════════════════════════════════════════════╝
  `);
});

export default app;
