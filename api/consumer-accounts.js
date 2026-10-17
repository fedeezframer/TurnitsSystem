import crypto from "node:crypto";
import { validCategories } from "../web/src/shared/categories.js";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailOf = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
const emailValid = (value) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const nameOf = (value) => (typeof value === "string" ? value.trim() : "");
const resetHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
export function consumerIdentity(user) {
  return {
    tipo_cuenta: "usuario",
    rol: "consumidor",
    consumidor_id: user.id,
    email: user.email,
    nombre_persona: user.nombre_persona,
    apellido: user.apellido || "",
    intereses: user.intereses,
    redirect: "browse",
  };
}
export function createConsumerAccounts({
  app,
  supabase,
  bcrypt,
  jwt,
  limiterAuth,
  limiterCodigo,
  fetch,
  mailUrl,
  rounds = 10,
  expiry = "1d",
  secret = process.env.JWT_SECRET,
}) {
  const fail = (res, error) => {
    console.error(
      "Consumer account error:",
      error.code || error.name || "unknown",
    );
    return res.status(error.code === "23505" ? 409 : 503).json({
      success: false,
      error:
        error.code === "23505"
          ? "Ya existe una cuenta con ese email."
          : "No se pudo completar la operación. Probá de nuevo en un momento.",
    });
  };
  const check = (result) => {
    if (result.error) throw result.error;
    return result.data;
  };
  const codeHash = (email, id, code) =>
    crypto
      .createHmac("sha256", secret)
      .update(`registro:${email}:${id}:${code}`)
      .digest("hex");
  async function findByEmail(email) {
    return check(
      await supabase
        .from("consumidores")
        .select("*")
        .eq("email", email)
        .maybeSingle(),
    );
  }
  async function findById(id) {
    if (!ID.test(id || "")) return null;
    return check(
      await supabase
        .from("consumidores")
        .select(
          "id,email,nombre_persona,apellido,intereses,activo,email_verificado",
        )
        .eq("id", id)
        .maybeSingle(),
    );
  }
  function session(user) {
    if (!secret) throw new Error("Missing session configuration");
    return {
      success: true,
      ...consumerIdentity(user),
      token: jwt.sign({ consumidorId: user.id, rol: "consumidor" }, secret, {
        expiresIn: expiry,
      }),
    };
  }
  async function mail(body) {
    if (!mailUrl || !secret) throw new Error("Missing mail configuration");
    const response = await fetch(mailUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("Mail unavailable");
  }
  app.post("/consumidores/registro/iniciar", limiterAuth, async (req, res) => {
    try {
      if (!secret || !mailUrl)
        return res.status(503).json({
          success: false,
          error: "El registro no está disponible en este momento.",
        });
      const body = req.body || {},
        email = emailOf(body.email),
        nombre = nameOf(body.nombre_persona),
        apellido = nameOf(body.apellido);
      const telefono =
        typeof body.telefono === "string"
          ? body.telefono.replace(/[\s()+-]/g, "")
          : "";
      const intereses = validCategories(body.intereses);
      if (
        !nombre ||
        nombre.length > 80 ||
        !apellido ||
        apellido.length > 80 ||
        /[\x00-\x1f]/.test(nombre + apellido) ||
        !emailValid(email) ||
        !/^[0-9]{7,15}$/.test(telefono) ||
        typeof body.password !== "string" ||
        body.password.length < 6 ||
        Buffer.byteLength(body.password) > 72 ||
        !intereses
      )
        return res.status(400).json({
          success: false,
          error:
            "Revisá tus datos y elegí al menos un rubro. La contraseña debe tener entre 6 y 72 bytes.",
        });
      if (await findByEmail(email))
        return res.status(409).json({
          success: false,
          error:
            "Ya existe una cuenta de usuario con ese email. Iniciá sesión.",
        });
      const pending = check(
        await supabase
          .from("registros_consumidores")
          .select("enviado_at")
          .eq("email", email)
          .maybeSingle(),
      );
      if (pending && Date.now() - Date.parse(pending.enviado_at) < 60000)
        return res.status(429).json({
          success: false,
          error: "Esperá un minuto antes de iniciar el registro de nuevo.",
        });
      const registro_id = crypto.randomUUID(),
        codigo = crypto.randomInt(100000, 1000000).toString();
      check(
        await supabase.from("registros_consumidores").upsert(
          {
            email,
            registro_id,
            nombre_persona: nombre,
            apellido,
            telefono,
            password_hash: await bcrypt.hash(body.password, rounds),
            intereses,
            codigo_hash: codeHash(email, registro_id, codigo),
            codigo_expiry: new Date(Date.now() + 15 * 60000).toISOString(),
            intentos: 0,
            enviado_at: new Date().toISOString(),
          },
          { onConflict: "email" },
        ),
      );
      await mail({ action: "verificarCodigo", email, nombre, codigo });
      return res.json({
        success: true,
        registro_id,
        message: "Código enviado. Revisá tu email.",
      });
    } catch (error) {
      return fail(res, error);
    }
  });
  app.post(
    "/consumidores/registro/verificar",
    limiterAuth,
    limiterCodigo,
    async (req, res) => {
      try {
        const email = emailOf(req.body?.email),
          id = req.body?.registro_id,
          codigo = req.body?.codigo;
        if (
          !secret ||
          !emailValid(email) ||
          !ID.test(id || "") ||
          typeof codigo !== "string" ||
          !/^\d{6}$/.test(codigo)
        )
          return res.status(400).json({
            success: false,
            error: "Revisá el código de seis dígitos.",
          });
        const data = check(
          await supabase.rpc("verificar_registro_consumidor", {
            p_email: email,
            p_registro_id: id,
            p_codigo_hash: codeHash(email, id, codigo),
          }),
        );
        if (!data?.success)
          return res.status(400).json(
            data || {
              success: false,
              error: "No se pudo verificar el código.",
            },
          );
        return res.status(201).json(session(data));
      } catch (error) {
        return fail(res, error);
      }
    },
  );
  app.post(
    "/consumidores/registro/reenviar-codigo",
    limiterAuth,
    async (req, res) => {
      try {
        const email = emailOf(req.body?.email),
          id = req.body?.registro_id;
        if (!emailValid(email) || !ID.test(id || ""))
          return res
            .status(400)
            .json({ success: false, error: "Iniciá el registro de nuevo." });
        const pending = check(
          await supabase
            .from("registros_consumidores")
            .select("nombre_persona,enviado_at,codigo_hash")
            .eq("email", email)
            .eq("registro_id", id)
            .maybeSingle(),
        );
        if (!pending)
          return res
            .status(404)
            .json({ success: false, error: "Iniciá el registro de nuevo." });
        if (Date.now() - Date.parse(pending.enviado_at) < 60000)
          return res.status(429).json({
            success: false,
            error: "Esperá un minuto antes de pedir otro código.",
          });
        const codigo = crypto.randomInt(100000, 1000000).toString();
        const updated = check(
          await supabase
            .from("registros_consumidores")
            .update({
              codigo_hash: codeHash(email, id, codigo),
              codigo_expiry: new Date(Date.now() + 15 * 60000).toISOString(),
              intentos: 0,
              enviado_at: new Date().toISOString(),
            })
            .eq("email", email)
            .eq("registro_id", id)
            .eq("codigo_hash", pending.codigo_hash)
            .select("registro_id")
            .maybeSingle(),
        );
        if (!updated)
          return res.status(409).json({
            success: false,
            error: "Ya se solicitó otro código. Esperá un minuto.",
          });
        await mail({
          action: "verificarCodigo",
          email,
          nombre: pending.nombre_persona,
          codigo,
        });
        return res.json({ success: true, message: "Código reenviado." });
      } catch (error) {
        return fail(res, error);
      }
    },
  );
  // Se ejecutan antes de los recuperadores existentes de dueños y empleados.
  app.post("/auth/forgot-password", limiterAuth, async (req, res, next) => {
    try {
      const type = req.body?.tipo_cuenta;
      if (type && !["usuario", "negocio"].includes(type))
        return res
          .status(400)
          .json({ success: false, error: "Elegí el tipo de cuenta." });
      if (type === "negocio") return next();
      const email = emailOf(req.body?.email);
      if (!emailValid(email)) return next();
      const user = await findByEmail(email);
      if (!user && type !== "usuario") return next();
      if (!user)
        return res.json({
          success: true,
          message: "Si el email existe, vas a recibir un enlace.",
        });
      if (user.activo && user.email_verificado) {
        const token = crypto.randomBytes(32).toString("hex");
        check(
          await supabase
            .from("consumidores")
            .update({
              reset_token: resetHash(token),
              reset_token_expiry: new Date(
                Date.now() + 30 * 60000,
              ).toISOString(),
            })
            .eq("id", user.id),
        );
        await mail({
          action: "resetPassword",
          email,
          nombre: user.nombre_persona,
          resetUrl: `https://turnits.com/cambiar-contraseña?token=${token}`,
        });
      }
      return res.json({
        success: true,
        message: "Si el email existe, vas a recibir un enlace.",
      });
    } catch (error) {
      return fail(res, error);
    }
  });
  app.post("/auth/reset-password", limiterAuth, async (req, res, next) => {
    try {
      const token = req.body?.token;
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        return next();
      const user = check(
        await supabase
          .from("consumidores")
          .select("id,activo,email_verificado,reset_token_expiry")
          .eq("reset_token", resetHash(token))
          .maybeSingle(),
      );
      if (
        !user ||
        !user.activo ||
        !user.email_verificado ||
        !user.reset_token_expiry ||
        Date.parse(user.reset_token_expiry) <= Date.now()
      )
        return res.status(400).json({
          success: false,
          error: "El enlace expiró o ya se usó. Solicitá uno nuevo.",
        });
      const password = req.body?.new_password;
      if (
        typeof password !== "string" ||
        password.length < 6 ||
        Buffer.byteLength(password) > 72
      )
        return res.status(400).json({
          success: false,
          error: "La contraseña debe tener entre 6 y 72 bytes.",
        });
      const updated = check(
        await supabase
          .from("consumidores")
          .update({
            password: await bcrypt.hash(password, rounds),
            reset_token: null,
            reset_token_expiry: null,
          })
          .eq("id", user.id)
          .eq("reset_token", resetHash(token))
          .gt("reset_token_expiry", new Date().toISOString())
          .eq("activo", true)
          .select("id")
          .maybeSingle(),
      );
      if (!updated)
        return res.status(400).json({
          success: false,
          error: "El enlace expiró o ya se usó. Solicitá uno nuevo.",
        });
      return res.json({
        success: true,
        message: "Contraseña actualizada correctamente.",
      });
    } catch (error) {
      return fail(res, error);
    }
  });
  app.get("/auth/reset-token-info", async (req, res, next) => {
    try {
      const token = req.query.token;
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
        return next();
      const user = check(
        await supabase
          .from("consumidores")
          .select("nombre_persona,activo,email_verificado,reset_token_expiry")
          .eq("reset_token", resetHash(token))
          .maybeSingle(),
      );
      if (
        !user ||
        !user.activo ||
        !user.email_verificado ||
        !user.reset_token_expiry ||
        Date.parse(user.reset_token_expiry) <= Date.now()
      )
        return res
          .status(400)
          .json({ success: false, error: "El enlace expiró o ya se usó." });
      return res.json({
        success: true,
        nombre: user.nombre_persona,
        tipo: "consumidor",
      });
    } catch (error) {
      return fail(res, error);
    }
  });
  return { findByEmail, findById, session };
}
