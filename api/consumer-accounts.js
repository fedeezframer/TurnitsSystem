import { validNewPassword, PASSWORD_ERROR } from "../web/src/shared/password-policy.js";
import { validInternationalPhone } from "../web/src/shared/phone-policy.js";
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
  limiterRegistroAgenda = limiterCodigo,
  fetch,
  mailUrl,
  resendApiKey = process.env.RESEND_API_KEY,
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
  async function mail(body, confirmDeliveryRequest = false) {
    if (!mailUrl || !secret) throw new Error("Missing mail configuration");
    const response = await fetch(mailUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw Object.assign(new Error("Mail unavailable"), { code: `mail_http_${response.status}` });
    }
    if (confirmDeliveryRequest) {
      const outcome = await response.json().catch(() => null);
      if (outcome?.status !== "success") {
        const knownErrors = ["mail_quota_or_limit", "mail_send_failed", "invalid_recipient", "invalid_code"];
        const code = knownErrors.includes(outcome?.message) ? outcome.message : "mail_response_unconfirmed";
        throw Object.assign(new Error("Mail unavailable"), { code });
      }
    }
  }
  async function sendBookingCode(email, name, codigo, challenge) {
    if (!resendApiKey) {
      return mail({ action: "verificarCodigo", email, nombre: name, codigo, expiraEnMinutos: 10 }, true);
    }

    const expiration = "El código vence en 10 minutos.";
    const warning = "No compartas este código. Si no lo solicitaste, ignorá este correo.";
    const font = "'Inter Display', Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `booking-code/${challenge}`,
      },
      body: JSON.stringify({
        from: "Turnits <team@notificaciones.turnits.com>",
        to: [email],
        subject: "Tu código de acceso a Turnits",
        text: `Tu código de acceso a Turnits es ${codigo}.\n\n${expiration} ${warning}`,
        html: `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tu código de acceso a Turnits</title>
</head>
<body style="margin:0;padding:0;background-color:#F0F0F0;font-family:${font};color:#0D0D0D">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F0F0F0">
    <tr>
      <td align="center" style="padding:36px 16px">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF"
               style="width:100%;max-width:520px;border:1px solid #E4E4E4;border-radius:12px;overflow:hidden">
          <tr>
            <td align="center" style="padding:28px 24px 22px;border-bottom:1px solid #E4E4E4">
              <img src="https://turnits.com/assets/browse/LogoTurnitsCompletoB.png" width="120" alt="Turnits"
                   style="display:block;width:120px;max-width:100%;height:auto;border:0">
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;font-family:${font}">
              <p style="margin:0 0 8px;color:#1B6B1A;font-size:10px;font-weight:700;letter-spacing:2px">
                VERIFICACIÓN
              </p>
              <h1 style="margin:0 0 22px;color:#0D0D0D;font-size:22px;line-height:1.25">
                Tu código de acceso
              </h1>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#1B6B1A" style="padding:28px 12px;border-radius:12px">
                    <p style="margin:0 0 12px;color:#D9E9D9;font-size:10px;font-weight:600;letter-spacing:2px">
                      CÓDIGO DE VERIFICACIÓN
                    </p>
                    <p style="margin:0;color:#FFFFFF;font-size:42px;font-weight:800;letter-spacing:8px;line-height:1.15">
                      ${codigo}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 16px;color:#6B7280;font-size:12px;text-align:center">
                Vence en <strong style="color:#0D0D0D">10 minutos</strong>.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="#FFFBEB" style="border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;color:#92400E;font-size:12px;line-height:1.6">
                    ${warning}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#F7F7F7" style="padding:22px 24px;border-top:1px solid #E4E4E4;font-family:${font}">
              <p style="margin:0 0 6px;color:#6B7280;font-size:12px;line-height:1.7">
                ¿Tenés dudas? Llamanos al <a href="tel:+5493513087324" style="color:#1B6B1A;font-weight:600;text-decoration:none">+54 9 3513 08-7324</a>
              </p>
              <p style="margin:0;color:#6B7280;font-size:11px">© ${new Date().getFullYear()} Turnits</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw Object.assign(new Error("Resend rejected booking email"), { code: `resend_http_${response.status}` });
    }
    const receipt = await response.json().catch(() => null);
    if (typeof receipt?.id !== "string" || !receipt.id) {
      throw Object.assign(new Error("Resend did not confirm booking email"), { code: "resend_response_unconfirmed" });
    }
  }

  const bookingCodeHash = (id, challenge, code) =>
    crypto.createHmac("sha256", secret).update(`booking:${id}:${challenge}:${code}`).digest("hex");

  const limitBookingCode = (req, res, next) =>
    (req.body?.registro === true ? limiterRegistroAgenda : limiterCodigo)(req, res, next);

  app.post("/consumidores/agenda/enviar-codigo", limitBookingCode, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const email = emailOf(req.body?.email);
    if (!emailValid(email)) return res.status(400).json({ success: false, error: "Ingresá un correo válido." });

    try {
      if (!secret || (!mailUrl && !resendApiKey)) throw new Error("Missing booking login configuration");
      const signup = req.body?.registro === true;
      const consumer = signup ? null : await findByEmail(email);
      if (!signup && !consumer) {
        return res.status(404).json({
          success: false,
          code: "consumer_registration_required",
          error: "No encontramos una cuenta de cliente con ese correo. Tocá Registrarse para crearla.",
        });
      }
      if (!signup && (consumer.activo !== true || consumer.email_verificado !== true)) {
        return res.status(403).json({ success: false, error: "Esta cuenta de cliente no está habilitada para iniciar sesión." });
      }

      const challenge = crypto.randomUUID();
      const codigo = crypto.randomInt(100000, 1000000).toString();
      const issued = signup
        ? check(await supabase.rpc("issue_booking_consumer_signup", {
          p_email: email, p_challenge: challenge, p_hash: bookingCodeHash(`signup:${email}`, challenge, codigo),
        }))
        : check(await supabase.rpc("issue_consumer_booking_code", {
          p_consumer: consumer.id, p_challenge: challenge, p_hash: bookingCodeHash(consumer.id, challenge, codigo),
        }));
      if (!issued) {
        return res.status(429).json({ success: false, error: "Esperá un minuto antes de pedir otro código." });
      }
      try {
        await sendBookingCode(email, consumer?.nombre_persona || "cliente", codigo, challenge);
      } catch (error) {
        console.error("Booking verification mail failed:", error.code || error.name || "unknown");
        return res.status(503).json({
          success: false,
          error: "No pudimos enviar el código. Esperá un minuto y volvé a intentar.",
        });
      }
      return res.json({ success: true, challenge });
    } catch (error) {
      return fail(res, error);
    }
  });

  app.post("/consumidores/agenda/verificar-codigo", limitBookingCode, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const email = emailOf(req.body?.email);
    const { challenge, codigo } = req.body || {};
    const invalid = () => res.status(400).json({ success: false, error: "Código inválido o vencido. Podés pedir otro." });
    if (!emailValid(email) || typeof challenge !== "string" || !ID.test(challenge)
        || typeof codigo !== "string" || !/^\d{6}$/.test(codigo)) return invalid();

    try {
      let consumerId;
      if (req.body?.registro === true) {
        consumerId = check(await supabase.rpc("complete_booking_consumer_signup", {
          p_email: email,
          p_challenge: challenge,
          p_hash: bookingCodeHash(`signup:${email}`, challenge, codigo),
          // Conserva el contrato de cuentas existentes sin una contraseña conocida.
          p_password_hash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), rounds),
        }));
      } else {
        const consumer = await findByEmail(email);
        if (consumer?.activo !== true || consumer.email_verificado !== true) return invalid();
        const verified = check(await supabase.rpc("consume_consumer_booking_code", {
          p_consumer: consumer.id,
          p_challenge: challenge,
          p_hash: bookingCodeHash(consumer.id, challenge, codigo),
        }));
        if (verified) consumerId = consumer.id;
      }
      if (!consumerId) return invalid();
      const current = await findById(consumerId);
      if (current?.activo !== true || current.email_verificado !== true || current.email !== email) return invalid();
      return res.json(session(current));
    } catch (error) {
      return fail(res, error);
    }
  });

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
        !validInternationalPhone(telefono) ||
        !validNewPassword(body.password) ||
        !intereses
      )
        return res.status(400).json({
          success: false,
          error:
            `Revisá tus datos y elegí al menos un rubro. ${PASSWORD_ERROR}`,
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
        !validNewPassword(password)
      )
        return res.status(400).json({
          success: false,
          error: PASSWORD_ERROR,
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
