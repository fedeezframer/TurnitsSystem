import crypto from "node:crypto";
import sharp from "sharp";
import { quoteDetail } from "../web/src/shared/consultations.js";
import { verifyQuoteWebhook } from "./quote-payments.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const read = response => { if (response.error) throw response.error; return response.data; };
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { publicMessage: message, status }); };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export async function resolveQuoteProducts(supabase, consultation, selection, equipoId) {
  const requested = selection ?? [];
  if (!Array.isArray(requested) || requested.length > 10) fail("Elegí hasta 10 productos para el presupuesto.");
  const unique = new Set();
  const normalized = requested.map(item => {
    if (!item || !UUID.test(item.id || "") || !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 99 || unique.has(item.id)) fail("Revisá los productos seleccionados y sus cantidades.");
    unique.add(item.id);
    return { id: item.id, cantidad: item.cantidad };
  });
  if (!normalized.length) return [];
  const ids = normalized.map(item => item.id);
  const links = read(await supabase.from("servicio_extras").select("extra_id").eq("servicio_id", consultation.servicio_id).in("extra_id", ids)) || [];
  if (new Set(links.map(link => link.extra_id)).size !== ids.length) fail("Uno de los productos ya no está vinculado a este servicio.", 409);
  const extras = read(await supabase.from("extras").select("id,nombre,precio,owner_equipo_id").eq("slug", consultation.slug).eq("activo", true).in("id", ids)) || [];
  const byId = new Map(extras.map(extra => [extra.id, extra]));
  if (ids.some(id => !byId.has(id))) fail("Uno de los productos ya no está disponible.", 409);
  return normalized.map(({ id, cantidad }) => {
    const extra = byId.get(id), unitPrice = Math.round((Number(extra.precio) || 0) * 100) / 100;
    if ((extra.owner_equipo_id && extra.owner_equipo_id !== equipoId) || !Number.isFinite(unitPrice) || unitPrice < 0) fail("Hay un producto que no está disponible para este profesional.", 409);
    return { id, nombre: String(extra.nombre || "Producto").slice(0, 120), cantidad, precio_unitario: unitPrice, precio: Math.round(unitPrice * cantidad * 100) / 100 };
  });
}

export function validateQuote(body, now = Date.now(), products = []) {
  let detail = typeof body.detalle === "string" ? body.detalle.trim() : "";
  if (products.length && body.servicio === undefined) fail("El presupuesto debe indicar el servicio para incluir productos.");
  if (body.servicio !== undefined) {
    if (typeof body.servicio !== "string" || body.servicio.trim().length < 2 || body.servicio.trim().length > 120 || detail.length > 2200) fail("Revisá el servicio y la observación.");
    detail = quoteDetail(body.servicio, detail, products);
  }
  if (detail.length < 2 || detail.length > 3000) fail("Describí qué incluye el presupuesto.");
  const baseTotal = Number(body.total), productsTotal = products.reduce((sum, product) => sum + product.precio, 0), total = Math.round((baseTotal + productsTotal) * 100) / 100, deposit = Number(body.sena), duration = Number(body.duracion);
  if (!Number.isFinite(baseTotal) || baseTotal < 0 || !Number.isFinite(total) || total <= 0 || total > 100000000 || Math.round(baseTotal * 100) / 100 !== baseTotal || !Number.isFinite(deposit) || deposit < 0 || deposit > total || Math.round(deposit * 100) / 100 !== deposit) fail("Revisá el precio del trabajo y la seña.");
  if (!Number.isInteger(duration) || duration < 5 || duration > 720 || !UUID.test(body.equipo_id || "")) fail("Revisá el profesional y la duración.");
  const date = String(body.fecha || ""), time = String(body.hora || "");
  const start = Date.parse(`${date}T${time}:00-03:00`), expiry = Date.parse(body.vence_at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || start <= now || !Number.isFinite(expiry) || expiry <= now || expiry > Math.min(start, now + 30 * 86400000)) fail("Elegí fecha, hora y vencimiento futuros válidos.");
  const [hours, minutes] = time.split(":").map(Number);
  if (hours * 60 + minutes + duration > 1440) fail("El servicio debe terminar dentro del mismo día.");
  return { detalle: detail, total, sena: deposit, duracion: duration, equipo_id: body.equipo_id, fecha: date, hora: time, vence_at: new Date(expiry).toISOString() };
}
export function referenceType(buffer) {
  if (buffer?.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mime: "image/png", extension: "png" };
  if (buffer?.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  if (buffer?.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}
export function validateReferenceText(value) {
  if (value !== undefined && typeof value !== "string") fail("El mensaje puede tener hasta 3000 caracteres.");
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > 3000) fail("El mensaje puede tener hasta 3000 caracteres.");
  return text;
}
export function createQuoteBooking({ app, supabase, consumerAuth, requireAuth, limiter, context, available, multer, payments, webhookSecret = process.env.MP_WEBHOOK_SECRET, enabled = process.env.QUOTE_BOOKING_ENABLED === "true" }) {
  const route = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { res.status(error.status || (error.promoValidacion || error.code === "P0001" || error.code === "23505" ? 409 : 503)).json({ success: false, error: error.publicMessage || (error.promoValidacion || error.code === "P0001" ? error.message : "No pudimos completar la consulta. Volvé a intentar.") }); }
  };
  const feature = (_req, res, next) => enabled ? next() : res.status(404).json({ success: false, error: "Esta modalidad todavía no está habilitada." });
  app.post(["/turnos/reservar", "/turnos/reservar-manual", "/api/create-preference"], (req,res,next) => route(async () => {
    const slug = typeof req.body?.slug === "string" ? req.body.slug.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "";
    if (typeof slug === "string" && /^[a-z0-9_-]{1,100}$/.test(slug)) {
      const business = read(await supabase.from("usuarios").select("*").eq("slug",slug).maybeSingle());
      if (business?.modo_agenda === "presupuesto") fail("Este servicio se coordina desde una consulta con presupuesto.",409);
    }
    next();
  })(req,res));
  const owner = (req, res, next) => {
    if (!req.auth?.slug || req.empleado || req.sucursalAdmin || ["empleado", "consumidor"].includes(req.auth.rol)) return res.status(403).json({ success: false, error: "Solo el titular puede gestionar estas consultas." });
    next();
  };
  const thread = async (req, business) => {
    if (!UUID.test(req.params.id || "")) fail("Consulta no encontrada.", 404);
    let query = supabase.from("consultas").select("*").eq("id", req.params.id);
    query = business ? query.eq("slug", req.auth.slug) : query.eq("consumidor_id", req.consumer.id);
    const data = read(await query.maybeSingle());
    if (!data) fail("Consulta no encontrada.", 404);
    return data;
  };
  const requireMode = async slug => {
    const business = read(await supabase.from("usuarios").select("modo_agenda,activo,estado_suscripcion,fecha_vencimiento").eq("slug", slug).maybeSingle());
    if (business?.modo_agenda !== "presupuesto" || ![true, "true"].includes(business.activo) || business.estado_suscripcion === "suspendido" || (business.fecha_vencimiento && Date.parse(business.fecha_vencimiento) <= Date.now())) fail("Este negocio no recibe consultas.", 409);
  };
  app.post("/browse/consultas", feature, consumerAuth, limiter, route(async (req, res) => {
    const service = read(await supabase.from("servicios").select("id,slug,nombre,activo").eq("id", req.body.servicio_id).maybeSingle());
    if (!service || ![true, "true"].includes(service.activo)) fail("Servicio no disponible.", 404);
    await requireMode(service.slug);
    const profile = read(await supabase.from("negocio_perfiles").select("slug").eq("slug", service.slug).eq("publicado", true).maybeSingle());
    if (!profile) fail("Negocio no disponible.", 404);
    const findOpen = () => supabase.from("consultas").select("id").eq("consumidor_id", req.consumer.id).eq("servicio_id", service.id).eq("estado", "abierta").maybeSingle();
    let saved = read(await findOpen());
    if (!saved) {
      const inserted = await supabase.from("consultas").insert({ consumidor_id: req.consumer.id, slug: service.slug, servicio_id: service.id, titulo: service.nombre.slice(0, 120) }).select("id").single();
      if (inserted.error?.code === "23505") saved = read(await findOpen());
      else saved = read(inserted);
    }
    if (!saved) fail("No pudimos abrir la consulta. Reintentá.", 409);
    res.json({ success: true, id: saved.id });
  }));
  for (const business of [false, true]) {
    const prefix = business ? "/admin/consultas" : "/browse/consultas";
    const guards = business ? [feature, requireAuth, owner, limiter] : [feature, consumerAuth, limiter];
    app.get(prefix, ...guards, route(async (req, res) => {
      const data = read(await supabase.rpc("consulta_bandeja", { p_consumidor: business ? null : req.consumer.id, p_slug: business ? req.auth.slug : null }));
      res.json({ success: true, consultas: data });
    }));
    app.post(prefix + "/:id/leida", ...guards, route(async (req,res) => {
      const consultation = await thread(req,business);
      if (!UUID.test(req.body.mensaje_id || "")) fail("Mensaje inválido.");
      const message = read(await supabase.from("consulta_mensajes").select("created_at").eq("id",req.body.mensaje_id).eq("consulta_id",consultation.id).maybeSingle());
      if (!message) fail("Mensaje no encontrado.",404);
      const column = business ? "negocio_leido_at" : "cliente_leido_at";
      if (!consultation[column] || Date.parse(consultation[column]) < Date.parse(message.created_at)) read(await supabase.from("consultas").update({ [column]:message.created_at }).eq("id",consultation.id).or(`${column}.is.null,${column}.lt.${message.created_at}`));
      res.json({success:true});
    }));
    app.get(prefix + "/:id", ...guards, route(async (req, res) => {
      const consultation = await thread(req, business);
      const [participantResult,serviceResult] = await Promise.all([
        business ? supabase.from("consumidores").select("nombre_persona,apellido,foto_url").eq("id",consultation.consumidor_id).maybeSingle() : supabase.from("negocio_perfiles").select("nombre,foto_perfil_url").eq("slug",consultation.slug).maybeSingle(),
        supabase.from("servicios").select("nombre,duracion").eq("id",consultation.servicio_id).eq("slug",consultation.slug).maybeSingle(),
      ]);
      const participant = read(participantResult), service = read(serviceResult);
      const linkedProductIds = business ? read(await supabase.from("servicio_extras").select("extra_id").eq("servicio_id", consultation.servicio_id)) || [] : [];
      const availableProducts = linkedProductIds.length ? read(await supabase.from("extras").select("id,nombre,precio,owner_equipo_id,orden").eq("slug", consultation.slug).eq("activo", true).in("id", linkedProductIds.map(item => item.extra_id))) || [] : [];
      availableProducts.sort((first, second) => (first.orden || 0) - (second.orden || 0));
      const interlocutor = { nombre: business ? [participant?.nombre_persona,participant?.apellido].filter(Boolean).join(" ") || "Cliente" : participant?.nombre || consultation.slug, foto_url: business ? participant?.foto_url : participant?.foto_perfil_url };
      const before = req.query.before;
      if (before && !UUID.test(before)) fail("Cursor inválido.");
      let messages = supabase.from("consulta_mensajes").select("id,autor,texto,archivo,created_at").eq("consulta_id", consultation.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
      if (before) {
        const cursor = read(await supabase.from("consulta_mensajes").select("created_at").eq("id", before).eq("consulta_id", consultation.id).maybeSingle());
        if (!cursor) fail("Cursor inválido.");
        messages = messages.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${before})`);
      }
      const [messagesResult, quotesResult] = await Promise.all([
        messages,
        supabase.from("consulta_presupuestos").select("*").eq("consulta_id", consultation.id).order("created_at", { ascending: false }).limit(20),
      ]);
      const rows = read(messagesResult) || [], quotes = read(quotesResult) || [];
      const activeQuote = quotes.find(quote => quote.estado !== "reemplazado");
      const loadPaymentStates = async () => {
        if (!payments?.enabled || !quotes.length) return [];
        const checkouts = read(await supabase.from("consulta_checkouts").select("id").in("presupuesto_id", quotes.map(quote => quote.id)));
        return checkouts.length ? read(await supabase.from("consulta_pagos").select("estado,importe,turno_id,created_at").in("checkout_id", checkouts.map(checkout => checkout.id)).order("created_at", { ascending: false })) : [];
      };
      const [safeMessages, paymentInfo, paymentStates] = await Promise.all([
        Promise.all(rows.map(async message => {
          if (!message.archivo) return message;
          const signed = read(await supabase.storage.from("consulta-referencias").createSignedUrl(message.archivo, 300));
          return { ...message, archivo: undefined, referencia_url: signed.signedUrl };
        })),
        payments?.info ? payments.info(consultation, activeQuote) : null,
        loadPaymentStates(),
      ]);
      res.json({ success: true, consulta: { id: consultation.id, titulo: consultation.titulo, estado: consultation.estado, slug: consultation.slug, servicio_id: consultation.servicio_id }, pagos: paymentStates, pago_online: paymentInfo?.habilitado === true, pago_presupuesto: paymentInfo, interlocutor, servicio:service, productos_disponibles: business ? availableProducts : undefined, mensajes: safeMessages.reverse(), presupuestos: quotes, anterior: rows.length === 50 ? rows.at(-1).id : null });
    }));
    app.post(prefix + "/:id/mensajes", ...guards, route(async (req, res) => {
      const consultation = await thread(req, business);
      if (consultation.estado === "cerrada") fail("La consulta está cerrada.", 409);
      const text = typeof req.body.texto === "string" ? req.body.texto.trim() : "";
      if (!text || text.length > 3000) fail("Escribí un mensaje de hasta 3000 caracteres.");
      read(await supabase.from("consulta_mensajes").insert({ consulta_id: consultation.id, autor: business ? "negocio" : "cliente", texto: text }));
      res.json({ success: true });
    }));
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2097152, files: 1, fields: 1 } }).single("referencia");
    app.post(prefix + "/:id/referencias", ...guards, route(async (req, res) => {
      const consultation = await thread(req, business);
      if (consultation.estado !== "abierta") fail("La consulta ya no recibe referencias.", 409);
      await new Promise((resolve, reject) => upload(req, res, error => error ? reject(Object.assign(error, { status: 400, publicMessage: "Subí una sola imagen de hasta 2 MB." })) : resolve()));
      const text = validateReferenceText(req.body?.texto);
      const type = referenceType(req.file?.buffer);
      if (!type) fail("Solo se permiten imágenes JPG, PNG o WebP.");
      const imagePromise = sharp(req.file.buffer, { limitInputPixels: 20000000, animated: false, failOn: "warning" }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer().catch(() => fail("La imagen no es válida o es demasiado grande."));
      const countPromise = supabase.from("consulta_mensajes").select("id", { count: "exact", head: true }).eq("consulta_id", consultation.id).not("archivo", "is", null);
      const [image, count] = await Promise.all([imagePromise, countPromise]);
      if (image.length > 2097152) fail("La imagen procesada supera el límite de 2 MB.");
      if (count.error) throw count.error;
      if (count.count >= 10) fail("Esta consulta alcanzó el límite de 10 referencias.");
      const path = `${consultation.id}/${crypto.randomUUID()}.webp`;
      read(await supabase.storage.from("consulta-referencias").upload(path, image, { contentType: "image/webp", upsert: false }));
      try { read(await supabase.from("consulta_mensajes").insert({ consulta_id: consultation.id, autor: business ? "negocio" : "cliente", texto: text, archivo: path, archivo_bytes: image.length })); }
      catch (error) { await supabase.storage.from("consulta-referencias").remove([path]); throw error; }
      res.json({ success: true });
    }));
  }
  app.post("/admin/consultas/:id/presupuestos", feature, requireAuth, owner, limiter, route(async (req, res) => {
    const consultation = await thread(req, true);
    await requireMode(consultation.slug);
    const products = await resolveQuoteProducts(supabase, consultation, req.body.productos, req.body.equipo_id);
    const quote = validateQuote(req.body, Date.now(), products);
    const ctx = await context(consultation.slug, consultation.servicio_id, quote.equipo_id);
    await available(consultation.slug, quote.fecha, quote.hora, { duracion: quote.duracion, capacidad: 1 }, ctx.config, ctx.member, consultation.servicio_id);
    const data = read(await supabase.rpc("consulta_proponer", { p_slug: consultation.slug, p_consulta: consultation.id, p_detalle: quote.detalle, p_total: quote.total, p_sena: quote.sena, p_equipo: quote.equipo_id, p_fecha: quote.fecha, p_hora: quote.hora, p_duracion: quote.duracion, p_vence: quote.vence_at }));
    res.json({ success: true, presupuesto: data });
  }));
  app.post("/browse/consultas/:id/aceptar", feature, consumerAuth, limiter, route(async (req, res) => {
    const consultation = await thread(req, false);
    const quote = read(await supabase.from("consulta_presupuestos").select("id").eq("id", req.body.presupuesto_id).eq("consulta_id", consultation.id).maybeSingle());
    if (!quote) fail("Presupuesto no encontrado.", 404);
    read(await supabase.rpc("consulta_aceptar", { p_consumidor: req.consumer.id, p_presupuesto: quote.id }));
    res.json({ success: true });
  }));
  app.post("/browse/consultas/:id/pagar", feature, consumerAuth, limiter, route(async (req, res) => {
    const consultation = await thread(req, false);
    if (!payments?.enabled) fail("El pago online de presupuestos todavía no está habilitado.", 503);
    res.json(await payments.prepare(consultation, req.body.presupuesto_id));
  }));
  app.post("/webhook/presupuestos/:checkout", feature, limiter, route(async (req, res) => {
    const id = req.query["data.id"];
    if (!UUID.test(req.params.checkout || "") || !verifyQuoteWebhook(req.headers, id, webhookSecret)) fail("Notificación inválida.", 401);
    if (!payments?.enabled) fail("Pago no habilitado.", 503);
    await payments.process(req.params.checkout, id);
    res.json({ success: true });
  }));
  for (const business of [false, true]) {
    app.post(`${business ? "/admin" : "/browse"}/consultas/:id/cerrar`, feature, ...(business ? [requireAuth, owner] : [consumerAuth]), limiter, route(async (req, res) => {
      const consultation = await thread(req, business);
      if (consultation.estado !== "abierta") fail("Solo se pueden cerrar consultas sin reserva.", 409);
      read(await supabase.from("consultas").update({ estado: "cerrada", cerrada_at: new Date().toISOString() }).eq("id", consultation.id).eq("estado", "abierta"));
      res.json({ success: true });
    }));
    app.get(`${business ? "/admin" : "/browse"}/consultas/:id/comprobante`, feature, ...(business ? [requireAuth, owner] : [consumerAuth]), limiter, route(async (req, res) => {
      const consultation = await thread(req, business);
      const quote = read(await supabase.from("consulta_presupuestos").select("turno_id").eq("consulta_id", consultation.id).eq("estado", "reservado").maybeSingle());
      if (!quote?.turno_id) fail("Esta consulta todavía no tiene una reserva.", 404);
      const turno = read(await supabase.from("turnos").select("id,slug,nombre,apellido,email,telefono,fecha,hora,servicio_nombre,equipo_nombre,precio_cobrado,monto_pagado,estado,metodo_pago,pago_estado,tipo_cobro,extras,monto_extras,presupuesto_detalle").eq("id", quote.turno_id).eq("consumidor_id", consultation.consumidor_id).eq("slug", consultation.slug).maybeSingle());
      if (!turno) fail("Reserva no disponible.", 404);
      res.json({ success: true, turno });
    }));
  }
  app.post("/admin/consultas/:id/reservar", feature, requireAuth, owner, limiter, route(async (req, res) => {
    const consultation = await thread(req, true);
    await requireMode(consultation.slug);
    const quote = read(await supabase.from("consulta_presupuestos").select("*").eq("id", req.body.presupuesto_id).eq("consulta_id", consultation.id).maybeSingle());
    if (!quote) fail("Presupuesto no encontrado.", 404);
    if (quote.estado !== "reservado") {
      if (quote.estado !== "aceptado" || Date.parse(quote.vence_at) <= Date.now() || quote.fecha < today()) fail("El cliente debe aceptar un presupuesto vigente.", 409);
      const ctx = await context(consultation.slug, consultation.servicio_id, quote.equipo_id);
      await available(consultation.slug, quote.fecha, quote.hora.slice(0, 5), { duracion: quote.duracion, capacidad: 1 }, ctx.config, ctx.member, consultation.servicio_id);
    }
    const saved = read(await supabase.rpc("consulta_reservar_manual", { p_slug: consultation.slug, p_presupuesto: quote.id }));
    res.json({ success: true, turno_id: saved.id });
  }));
}
