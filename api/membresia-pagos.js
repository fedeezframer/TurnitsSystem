const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const basicPlan = "id,slug,nombre,precio_mensual,servicio_ids,producto_ids,cantidades_servicios,cantidades_productos,profesional_ids";
const paymentFields = "id,membresia_id,slug,consumidor_id,nombre,importe,servicios,productos,profesional_ids,vendedor_id,estado,payment_id,payment_url,checkout_vence_at,vence_at";
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

export function registerMembershipPayments({ app, supabase, consumerId, business, gateway, apiUrl, siteUrl, limiter }) {
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

  app.post("/membresias/:slug/:id/checkout", limiter, wrap(async (req, res) => {
    const id = await identity(req);
    const { slug, id: planId } = req.params;
    if (!UUID.test(planId)) stop(404, "Suscripción no disponible.");
    const ctx = await business(slug);
    const plan = read(await supabase.from("membresias").select(basicPlan).eq("slug", ctx.user.slug)
      .eq("id", planId).eq("publicado", true).maybeSingle());
    if (!plan) stop(404, "Suscripción no disponible.");
    const [[servicios, productos], profesionales] = await Promise.all([checkPlan(plan), availableProfessionals(plan)]);
    if (plan.profesional_ids.length && !profesionales.length) stop(409, "La suscripción ya no tiene un profesional disponible.");

    const now = new Date().toISOString();
    const existing = read(await table().select("id").eq("consumidor_id", id).eq("membresia_id", planId)
      .eq("estado", "activo").gt("vence_at", now).limit(1).maybeSingle());
    if (existing) stop(409, "Este plan todavía está activo. Podés renovarlo cuando termine.");
    let sellerId;
    try { sellerId = String((await gateway.seller(ctx)).id || ""); }
    catch { stop(409, "El negocio debe conectar Mercado Pago para cobrar la suscripción."); }
    if (!/^\d+$/.test(sellerId)) stop(409, "El negocio debe conectar Mercado Pago.");
    read(await table().update({ estado: "vencido" }).eq("consumidor_id", id).eq("membresia_id", planId)
      .eq("estado", "pendiente").lte("checkout_vence_at", now));
    const pending = () => table().select(paymentFields).eq("consumidor_id", id).eq("membresia_id", planId).eq("estado", "pendiente").maybeSingle();
    let order = read(await pending());
    if (!order) {
      const inserted = await table().insert({
        membresia_id: plan.id, slug: plan.slug, consumidor_id: id, importe: plan.precio_mensual,
        nombre: plan.nombre, servicios, productos, profesional_ids: profesionales, vendedor_id: sellerId,
      }).select(paymentFields).single();
      order = inserted.error?.code === "23505" ? read(await pending()) : read(inserted);
    }
    if (!order || order.vendedor_id !== sellerId) stop(409, "Cambió la cuenta de cobro. Contactá al negocio.");
    if (order.payment_url) return res.json({ success: true, payment_url: checkoutUrl(order.payment_url) });

    const customer = read(await supabase.from("consumidores").select("email,nombre_persona,apellido").eq("id", id).single());
    const destination = `${siteUrl}/suscripciones/${encodeURIComponent(plan.slug)}?pago=${order.id}`;
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

  app.post("/webhook/membresias/:order", wrap(async (req, res) => {
    const paymentId = String(req.body?.data?.id || req.query.id || "");
    if (!UUID.test(req.params.order) || !/^\d{1,30}$/.test(paymentId)) return res.sendStatus(200);
    const order = read(await table().select(paymentFields).eq("id", req.params.order).maybeSingle());
    if (order) await reconcile(order, paymentId);
    res.sendStatus(200);
  }));

  app.get("/membresias/:slug/pago/:order", limiter, wrap(async (req, res) => {
    const id = await identity(req);
    if (!UUID.test(req.params.order)) stop(404, "Pago no encontrado.");
    const order = read(await table().select(paymentFields).eq("slug", req.params.slug).eq("consumidor_id", id)
      .eq("id", req.params.order).maybeSingle());
    if (!order) stop(404, "Pago no encontrado.");
    const paymentId = String(req.query.payment_id || "");
    const estado = !order.payment_id && /^\d{1,30}$/.test(paymentId) ? await reconcile(order, paymentId)
      : order.estado === "pendiente" && Date.parse(order.checkout_vence_at) <= Date.now() ? "vencido" : order.estado;
    res.json({ success: true, estado, nombre: order.nombre });
  }));
}
