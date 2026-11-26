const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const basicPlan = "id,slug,nombre,precio_mensual,servicio_ids,producto_ids,cantidades_servicios,cantidades_productos,profesional_ids";
const paymentFields = "id,membresia_id,slug,consumidor_id,nombre,importe,servicios,productos,profesional_ids,vendedor_id,estado,payment_id,payment_url,checkout_vence_at,vence_at,metodo_pago,comprobante_path";
const read = ({ data, error }) => {
  if (error) throw error;
  return data;
};

function stop(status, message) {
  throw Object.assign(new Error(message), { status });
}

function checkoutUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || !/(^|\.)mercadopago\.(com|com\.ar)$/.test(parsed.hostname)) {
    throw new Error("Invalid Mercado Pago destination");
  }
  return parsed.href;
}

export function registerMembershipPayments({ app, supabase, consumerId, business, gateway, apiUrl, siteUrl, limiter, requireAuth, methods, uploadProof, notify }) {
  const table = () => supabase.from("membresia_periodos");
  const wrap = (handler) => async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      return await handler(req, res);
    } catch (error) {
      const status = Number(error.status) || 500;
      if (status >= 500) console.error("Membresía pago:", error.code || error.name);
      return res.status(status).json({
        success: false, error: status < 500 ? error.message : "No pudimos verificar el pago de la suscripción.",
      });
    }
  };

  const identity = async (req) => {
    const id = await consumerId(req);
    if (!id) stop(401, "Iniciá sesión con tu cuenta de cliente.");
    return id;
  };

  async function checkPlan(plan) {
    const selections = [
      ["servicios", plan.servicio_ids, plan.cantidades_servicios],
      ["extras", plan.producto_ids, plan.cantidades_productos],
    ];
    return Promise.all(selections.map(async ([catalog, ids, quantities]) => {
      if (!ids.length) return {};
      const items = read(await supabase.from(catalog).select("id").eq("slug", plan.slug).eq("activo", true).in("id", ids));
      if (items.length !== ids.length) stop(409, "Cambió el catálogo de este plan. Contactá al negocio.");
      return Object.fromEntries(ids.map(id => [id, quantities[id] ?? 1]));
    }));
  }

  async function availableProfessionals(plan) {
    if (!plan.profesional_ids.length) return [];
    const professionals = read(await supabase.from("equipo").select("id")
      .eq("slug", plan.slug).eq("activo", true).in("id", plan.profesional_ids));
    const ids = professionals.map(person => person.id);
    if (!ids.length || !plan.servicio_ids.length) return ids;
    const assignments = read(await supabase.from("servicio_equipo").select("servicio_id,equipo_id")
      .in("equipo_id", ids).in("servicio_id", plan.servicio_ids));
    return ids.filter(id => plan.servicio_ids.every(serviceId => assignments.some(link =>
      link.equipo_id === id && link.servicio_id === serviceId
    )));
  }

  const lockedMethod = "Ya hay un pago pendiente por otro medio. Esperá a que se confirme o contactá al negocio.";
  const path = "/membresias/:slug/:id";
  const orderUrl = order => `${siteUrl}/agenda/${encodeURIComponent(order.slug)}?suscripcion=${order.membresia_id || ""}&pago=${order.id}`;
  const buyerFields = "email,nombre_persona,apellido";
  async function prepare(req, id, method) {
    const { slug, id: planId } = req.params;
    if (!UUID.test(planId)) stop(404, "Suscripción no disponible.");
    const ctx = await business(slug);
    if (!methods(ctx).includes(method)) stop(409, "Este medio no está habilitado por el negocio.");
    const plan = read(await supabase.from("membresias").select(basicPlan).eq("slug", ctx.user.slug)
      .eq("id", planId).eq("publicado", true).maybeSingle());
    if (!plan) stop(404, "Suscripción no disponible.");
    const [[servicios, productos], profesionales] = await Promise.all([checkPlan(plan), availableProfessionals(plan)]);
    if (plan.profesional_ids.length && !profesionales.length) stop(409, "La suscripción ya no tiene un profesional disponible.");
    const now = new Date().toISOString();
    const existing = read(await table().select("id").eq("consumidor_id", id).eq("membresia_id", planId)
      .eq("estado", "activo").gt("vence_at", now).limit(1).maybeSingle());
    if (existing) stop(409, "Este plan todavía está activo. Podés renovarlo cuando termine.");
    const metodo_pago = method === "tarjeta" ? "mercadopago" : method;
    let sellerId = "manual";
    if (metodo_pago === "mercadopago") {
      try { sellerId = String((await gateway.seller(ctx)).id || ""); }
      catch { stop(409, "El negocio debe conectar Mercado Pago para cobrar la suscripción."); }
      if (!/^\d+$/.test(sellerId)) stop(409, "El negocio debe conectar Mercado Pago.");
    }
    read(await table().update({ estado: "vencido" }).eq("consumidor_id", id).eq("membresia_id", planId)
      .eq("estado", "pendiente").lte("checkout_vence_at", now)
      .or("metodo_pago.eq.mercadopago,and(metodo_pago.eq.transferencia,comprobante_path.is.null)"));
    const pending = () => table().select(paymentFields).eq("consumidor_id", id).eq("membresia_id", planId).eq("estado", "pendiente").maybeSingle();
    let order = read(await pending());
    let created = false;
    if (!order) {
      const inserted = await table().insert({
        membresia_id: plan.id, slug: plan.slug, consumidor_id: id, importe: plan.precio_mensual,
        nombre: plan.nombre, servicios, productos, profesional_ids: profesionales, vendedor_id: sellerId, metodo_pago,
      }).select(paymentFields).single();
      order = inserted.error?.code === "23505" ? read(await pending()) : read(inserted);
      created = !inserted.error;
    }
    if (!order || order.metodo_pago !== metodo_pago) stop(409, lockedMethod);
    if (order.vendedor_id !== sellerId) stop(409, "Cambió la cuenta de cobro. Contactá al negocio.");
    return { order, ctx, created };
  }

  app.post(path + "/checkout", limiter, wrap(async (req, res) => {
    const id = await identity(req);
    const method = req.body?.metodo || "mercadopago";
    if (!["mercadopago", "tarjeta"].includes(method)) stop(400, "Medio de pago inválido.");
    const { order, ctx } = await prepare(req, id, method);
    const customer = read(await supabase.from("consumidores").select(buyerFields).eq("id", id).single());
    if (method === "tarjeta") return res.json({ success: true, tarjeta: {
      checkout_token: order.id, public_key: gateway.publicKey, monto: Number(order.importe), email: customer.email,
    } });
    if (order.payment_url) return res.json({ success: true, payment_url: checkoutUrl(order.payment_url) });

    const destination = orderUrl(order);
    const preference = await gateway.preference(ctx, {
      items: [{ title: `${order.nombre} · 1 mes`, quantity: 1, unit_price: Number(order.importe), currency_id: "ARS" }],
      payer: { email: customer.email, name: customer.nombre_persona, ...(customer.apellido ? { surname: customer.apellido } : {}) },
      external_reference: order.id, metadata: { tipo: "membresia_turnits", periodo_id: order.id },
      notification_url: `${apiUrl}/webhook/membresias/${order.id}`,
      back_urls: { success: destination, pending: destination, failure: destination }, auto_return: "approved",
      expires: true, expiration_date_to: order.checkout_vence_at,
    }, `membresia-${order.id}`);
    const url = checkoutUrl(preference.init_point);
    read(await table().update({ payment_url: url }).eq("id", order.id));
    res.json({ success: true, payment_url: url });
  }));

  const reconcile = async (order, paymentId) => {
    const ctx = await business(order.slug, { allowInactive: true });
    const payment = await gateway.payment(ctx, paymentId);
    if (String(payment.id) !== paymentId || payment.external_reference !== order.id ||
        payment.metadata?.tipo !== "membresia_turnits" || payment.metadata?.periodo_id !== order.id ||
        String(payment.collector_id) !== order.vendedor_id || payment.currency_id !== "ARS" ||
        Number(payment.transaction_amount) !== Number(order.importe)) {
      stop(409, "El pago no corresponde a esta suscripción.");
    }
    if (["refunded", "charged_back"].includes(payment.status) && order.payment_id === paymentId) {
      read(await table().update({ estado: "revertido" }).eq("id", order.id).eq("payment_id", paymentId));
      return "revertido";
    }
    if (payment.status !== "approved") return order.estado;
    const refundDuplicate = async (current) => {
      const refund = await gateway.refund(ctx, paymentId, `membresia-duplicado-${order.id}-${paymentId}`);
      if (!refund?.id || (refund.status && refund.status !== "approved")) throw new Error("Membership duplicate refund not confirmed");
      return current.estado;
    };
    if (order.payment_id && order.payment_id !== paymentId) return refundDuplicate(order);
    const paidAt = new Date(payment.date_approved);
    if (!Number.isFinite(paidAt.getTime())) throw new Error("Invalid Mercado Pago approval date");
    const activated = await supabase.rpc("confirmar_periodo_membresia", {
      p_order_id: order.id, p_payment_id: paymentId, p_paid_at: paidAt.toISOString(),
    });
    if (activated.error?.code === "P0001") {
      const current = read(await table().select("payment_id,estado").eq("id", order.id).single());
      if (current.payment_id && current.payment_id !== paymentId) return refundDuplicate(current);
    }
    return read(activated);
  };

  const cardRoute = "/membresias/:slug/tarjeta";
  async function ownOnlineOrder(req) {
    const id = await identity(req);
    const orderId = req.body?.checkout_token;
    if (typeof orderId !== "string" || !UUID.test(orderId)) stop(404, "Pago no encontrado.");
    const order = read(await table().select(paymentFields).eq("slug", req.params.slug)
      .eq("consumidor_id", id).eq("id", orderId).eq("metodo_pago", "mercadopago").maybeSingle());
    if (!order) stop(404, "Pago no encontrado.");
    return order;
  }
  async function cardResult(res, order, payment) {
    if (payment?.status === "approved" || order.estado === "activo") {
      if (order.estado !== "activo") await reconcile(order, String(payment.id));
      return res.json({ status: "approved", success_url: orderUrl(order) });
    }
    if (payment?.status === "rejected" || payment?.status === "cancelled") {
      return res.json({ status: "rejected", message: "La tarjeta no aprobó el pago. Podés continuar con Mercado Pago." });
    }
    if (!payment && Date.parse(order.checkout_vence_at) <= Date.now()) {
      return res.json({ status: "not_charged", message: "Esta sesión venció sin un pago confirmado. Volvé al checkout." });
    }
    return res.json({ status: payment ? "pending" : "not_found", message: "Consultá el estado antes de volver a pagar." });
  }
  async function findPayment(ctx, order) {
    const { results } = await gateway.search(ctx, order.id);
    const approved = results?.find(item => item.status === "approved");
    return approved || results?.[0] || null;
  }

  app.post(cardRoute, limiter, wrap(async (req, res) => {
    const order = await ownOnlineOrder(req);
    if (order.estado === "activo") return cardResult(res, order);
    const ctx = await business(order.slug);
    if (!methods(ctx).includes("tarjeta") || order.estado !== "pendiente" || Date.parse(order.checkout_vence_at) <= Date.now()) {
      return res.status(409).json({ status: "not_charged", error: "El checkout venció o la tarjeta ya no está disponible." });
    }
    const seller = await gateway.seller(ctx);
    if (String(seller.id) !== order.vendedor_id) stop(409, "Cambió la cuenta de cobro. Contactá al negocio.");
    const previous = await findPayment(ctx, order);
    if (previous) return cardResult(res, order, previous);
    const card = req.body.card || {};
    const installments = Number(card.installments);
    if (typeof card.token !== "string" || !/^[a-zA-Z0-9_-]{1,300}$/.test(card.token) ||
        typeof card.payment_method_id !== "string" || card.payment_method_id.length > 40 ||
        !Number.isInteger(installments) || installments < 1 || installments > 48) {
      return res.status(400).json({ status: "not_charged", error: "Revisá los datos de la tarjeta." });
    }
    const available = await gateway.cardMethods(ctx);
    if (!available.some(method => method.id === card.payment_method_id && ["credit_card","debit_card","prepaid_card"].includes(method.payment_type_id))) {
      return res.status(400).json({ status: "not_charged", error: "Elegí una tarjeta de crédito o débito válida." });
    }
    const customer = read(await supabase.from("consumidores").select(buyerFields).eq("id", order.consumidor_id).single());
    const payment = await gateway.card(ctx, {
      token: card.token, payment_method_id: card.payment_method_id, installments,
      transaction_amount: Number(order.importe), description: `${order.nombre} · 1 mes`,
      external_reference: order.id, metadata: { tipo: "membresia_turnits", periodo_id: order.id },
      notification_url: `${apiUrl}/webhook/membresias/${order.id}`,
      payer: { email: customer.email, ...(card.payer?.identification ? { identification: {
        type: String(card.payer.identification.type || "").slice(0, 20),
        number: String(card.payer.identification.number || "").slice(0, 30),
      } } : {}) },
      ...(card.issuer_id ? { issuer_id: String(card.issuer_id).slice(0, 40) } : {}),
    }, `membresia-tarjeta-${order.id}`);
    return cardResult(res, order, payment);
  }));
  app.post(cardRoute + "/estado", limiter, wrap(async (req, res) => {
    const order = await ownOnlineOrder(req);
    if (order.estado === "activo") return cardResult(res, order);
    const ctx = await business(order.slug, { allowInactive: true });
    return cardResult(res, order, await findPayment(ctx, order));
  }));

  app.post(path + "/pago-manual/:medio", limiter, wrap(async (req, res) => {
    const id = await identity(req);
    const method = req.params.medio;
    if (!["transferencia", "efectivo"].includes(method)) stop(400, "Medio de pago inválido.");
    if (method === "transferencia") {
      await uploadProof(req, res);
      if (!req.file) stop(400, "Adjuntá el comprobante de la transferencia.");
    }
    const { order, created } = await prepare(req, id, method);
    let notifyOwner = created && method === "efectivo";
    if (method === "transferencia" && !order.comprobante_path) {
      const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      const extension = extensions[req.file.mimetype];
      if (!extension) stop(400, "Adjuntá una imagen JPG, PNG o WEBP.");
      const filePath = `${order.slug}/suscripciones/${order.id}.${extension}`;
      const stored = await supabase.storage.from("comprobantes").upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype, upsert: false,
      });
      if (stored.error && String(stored.error.statusCode) !== "409") throw stored.error;
      const attached = read(await table().update({ comprobante_path: filePath }).eq("id", order.id)
        .eq("estado", "pendiente").is("comprobante_path", null).select("id").maybeSingle());
      notifyOwner = Boolean(attached);
    }
    if (notifyOwner) await notify(order);
    res.json({ success: true, estado: "pendiente", pago: order.id, metodo: method });
  }));

  const admin = "/admin/membresias/:slug/pagos-manuales";
  const owner = (req, res, next) => {
    if (req.empleado || req.sucursalAdmin) return res.status(403).json({ success: false, error: "Solo el titular puede revisar cobros." });
    next();
  };
  app.get(admin, requireAuth, owner, wrap(async (req, res) => {
    const orders = read(await table().select("id,nombre,importe,metodo_pago,comprobante_path,created_at,consumidor_id")
      .eq("slug", req.params.slug).eq("estado", "pendiente")
      .or("metodo_pago.eq.efectivo,and(metodo_pago.eq.transferencia,comprobante_path.not.is.null)")
      .order("created_at", { ascending: true }).limit(100));
    const ids = [...new Set(orders.map(order => order.consumidor_id))];
    const customers = ids.length ? read(await supabase.from("consumidores").select("id,nombre_persona,apellido,email").in("id", ids)) : [];
    res.json({ success: true, pagos: orders.map(({ consumidor_id, comprobante_path, ...order }) => {
      const customer = customers.find(person => person.id === consumidor_id);
      return { ...order, comprobante: Boolean(comprobante_path), cliente: [customer?.nombre_persona, customer?.apellido].filter(Boolean).join(" "), email: customer?.email };
    }) });
  }));
  app.get(admin + "/:order/comprobante", requireAuth, owner, wrap(async (req, res) => {
    if (!UUID.test(req.params.order)) stop(404, "Comprobante no encontrado.");
    const order = read(await table().select("comprobante_path").eq("slug", req.params.slug)
      .eq("id", req.params.order).eq("metodo_pago", "transferencia").maybeSingle());
    if (!order?.comprobante_path) stop(404, "Comprobante no encontrado.");
    const { signedUrl } = read(await supabase.storage.from("comprobantes").createSignedUrl(order.comprobante_path, 300));
    res.json({ success: true, url: signedUrl });
  }));
  app.put(admin + "/:order", requireAuth, owner, wrap(async (req, res) => {
    if (!UUID.test(req.params.order) || typeof req.body?.aprobar !== "boolean") stop(400, "Acción inválida.");
    const changed = read(await supabase.rpc("revisar_pago_membresia", {
      p_id: req.params.order, p_slug: req.params.slug, p_aprobar: req.body.aprobar,
    }));
    if (!changed) stop(409, "Ese cobro ya no está pendiente.");
    res.json({ success: true });
  }));

  app.post("/webhook/membresias/:order", wrap(async (req, res) => {
    const paymentId = String(req.body?.data?.id || req.query.id || "");
    if (!UUID.test(req.params.order) || !/^\d{1,30}$/.test(paymentId)) return res.sendStatus(200);
    const order = read(await table().select(paymentFields).eq("id", req.params.order).maybeSingle());
    if (order?.metodo_pago === "mercadopago") await reconcile(order, paymentId);
    res.sendStatus(200);
  }));

  app.get("/membresias/:slug/pago/:order", limiter, wrap(async (req, res) => {
    const id = await identity(req);
    if (!UUID.test(req.params.order)) stop(404, "Pago no encontrado.");
    const order = read(await table().select(paymentFields).eq("slug", req.params.slug).eq("consumidor_id", id)
      .eq("id", req.params.order).maybeSingle());
    if (!order) stop(404, "Pago no encontrado.");
    const paymentId = String(req.query.payment_id || "");
    const estado = order.metodo_pago === "mercadopago" && !order.payment_id && /^\d{1,30}$/.test(paymentId) ? await reconcile(order, paymentId)
      : order.metodo_pago === "mercadopago" && order.estado === "pendiente" && Date.parse(order.checkout_vence_at) <= Date.now() ? "vencido" : order.estado;
    res.json({ success: true, estado, nombre: order.nombre, metodo: order.metodo_pago, plan_id: order.membresia_id });
  }));
}
