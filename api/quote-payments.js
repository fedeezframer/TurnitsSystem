import crypto from "node:crypto";
import { quotePresentation } from "../web/src/shared/consultations.js";

const read = result => { if (result.error) throw result.error; return result.data; };
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { publicMessage: message, status }); };
export function verifyQuoteWebhook(headers, id, secret, now = Date.now()) {
  if (!secret || !/^[a-z0-9]+$/i.test(String(id || ""))) return false;
  const fields = Object.fromEntries(String(headers["x-signature"] || "").split(",").map(field => field.trim().split("=")));
  const request = headers["x-request-id"], timestamp = Number(fields.ts), millis = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  if (!request || !Number.isFinite(millis) || Math.abs(now - millis) > 600000 || !/^[a-f0-9]{64}$/i.test(fields.v1 || "")) return false;
  const expected = crypto.createHmac("sha256", secret).update(`id:${String(id).toLowerCase()};request-id:${request};ts:${fields.ts};`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(fields.v1, "hex"));
}
export function createQuotePayments({ supabase, context, available, gateway, apiUrl, siteUrl, notify = async () => {}, enabled = process.env.QUOTE_PAYMENTS_ENABLED === "true" && process.env.APP_ENV !== "staging" && !!process.env.MP_WEBHOOK_SECRET }) {
  const enabledCheck = () => { if (!enabled) fail("El pago online de presupuestos todavía no está habilitado.", 503); };
  const load = async id => {
    const checkout = read(await supabase.from("consulta_checkouts").select("*").eq("id", id).maybeSingle());
    if (!checkout) fail("Pago no disponible.", 404);
    const quote = read(await supabase.from("consulta_presupuestos").select("*").eq("id", checkout.presupuesto_id).single());
    const consultation = read(await supabase.from("consultas").select("*").eq("id", quote.consulta_id).single());
    return { checkout, quote, consultation };
  };
  const prepare = async (consultation, quoteId) => {
    enabledCheck();
    if (consultation.estado !== "abierta") fail("Esta consulta ya no admite pagos.");
    const quote = read(await supabase.from("consulta_presupuestos").select("*").eq("id", quoteId).eq("consulta_id", consultation.id).maybeSingle());
    if (!quote || quote.estado !== "aceptado" || Date.parse(quote.vence_at) <= Date.now()) fail("Aceptá un presupuesto vigente antes de pagar.");
    const ctx = await context(consultation.slug, consultation.servicio_id, quote.equipo_id);
    await available(consultation.slug, quote.fecha, quote.hora.slice(0, 5), { duracion: quote.duracion, capacidad: 1 }, ctx.config, ctx.member, consultation.servicio_id);
    const seller = await gateway.seller(ctx), amount = Number(quote.sena) > 0 ? Number(quote.sena) : Number(quote.total);
    let checkout = read(await supabase.from("consulta_checkouts").select("*").eq("presupuesto_id", quote.id).maybeSingle());
    if (!checkout) {
      const inserted = await supabase.from("consulta_checkouts").insert({ presupuesto_id: quote.id, importe: amount, vendedor_id: seller.id }).select("*").single();
      checkout = inserted.error?.code === "23505" ? read(await supabase.from("consulta_checkouts").select("*").eq("presupuesto_id", quote.id).single()) : read(inserted);
    }
    if (checkout.vendedor_id !== seller.id || Number(checkout.importe) !== amount) fail("La cuenta de cobro cambió. Pedí un nuevo presupuesto.");
    const previousPayments = read(await supabase.from("consulta_pagos").select("estado").eq("checkout_id", checkout.id).limit(1));
    if (previousPayments.length) fail("Este presupuesto ya registra un pago o un reintegro. Revisá su estado antes de volver a pagar.");
    if (checkout.payment_url) return { success: true, payment_url: checkout.payment_url, importe: amount };
    const destination = `${siteUrl}/consultas?id=${consultation.id}`;
    const preference = await gateway.preference(ctx, {
      items: [{ title: quotePresentation(quote, consultation.titulo).service, quantity: 1, currency_id: "ARS", unit_price: amount }],
      external_reference: checkout.id, metadata: { tipo: "presupuesto_turnits", checkout_id: checkout.id },
      notification_url: `${apiUrl}/webhook/presupuestos/${checkout.id}`,
      back_urls: { success: destination, pending: destination, failure: destination }, auto_return: "approved",
      expires: true, expiration_date_to: quote.vence_at,
    }, `quote-${checkout.id}`);
    const url = new URL(preference.init_point);
    if (url.protocol !== "https:" || !/(^|\.)mercadopago\.(com|com\.ar)$/.test(url.hostname)) throw Error("Invalid checkout URL");
    read(await supabase.from("consulta_checkouts").update({ preference_id: String(preference.id), payment_url: url.href }).eq("id", checkout.id));
    return { success: true, payment_url: url.href, importe: amount };
  };
  const refund = async (payment, data, ctx) => {
    try {
      const result = await gateway.refund(ctx, payment.payment_id, `quote-refund-${payment.payment_id}`);
      if (!result.id || (result.status && result.status !== "approved")) throw Error("Refund not confirmed");
      read(await supabase.from("consulta_pagos").update({ estado: "reintegrado", refund_id: String(result.id) }).eq("payment_id", payment.payment_id).eq("estado", "reintegro_pendiente"));
      await notify(data.consultation, "reintegro", payment.payment_id);
    } catch (failure) {
      const attempts = Number(payment.intentos) + 1;
      read(await supabase.from("consulta_pagos").update({ intentos: attempts, reintentar_at: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(attempts, 7))).toISOString() }).eq("payment_id", payment.payment_id).eq("estado", "reintegro_pendiente"));
      throw failure;
    }
  };
  const process = async (checkoutId, paymentId) => {
    enabledCheck(); if (!/^\d{1,30}$/.test(String(paymentId))) fail("Pago inválido.", 400);
    const data = await load(checkoutId), { checkout, quote, consultation } = data;
    const ctx = await gateway.context(consultation.slug, quote.equipo_id);
    const payment = await gateway.payment(ctx, paymentId);
    if (String(payment.id) !== String(paymentId) || String(payment.collector_id) !== checkout.vendedor_id || payment.external_reference !== checkout.id) fail("No pudimos verificar este pago.", 400);
    if (["refunded", "charged_back"].includes(payment.status)) {
      const recorded = read(await supabase.from("consulta_pagos").select("turno_id").eq("payment_id", String(paymentId)).eq("checkout_id", checkout.id).maybeSingle());
      if (recorded?.turno_id) read(await supabase.from("turnos").update({ monto_pagado: 0, pago_estado: "reembolsado" }).eq("id", recorded.turno_id).eq("payment_id", String(paymentId)));
      read(await supabase.from("consulta_pagos").update({ estado: "reintegrado" }).eq("payment_id", String(paymentId)).eq("checkout_id", checkout.id)); return;
    }
    if (payment.status !== "approved") return;
    if (!Number.isFinite(Number(payment.transaction_amount)) || Number(payment.transaction_amount) <= 0) fail("Importe inválido.", 400);
    let free = payment.currency_id === "ARS" && Number(payment.transaction_amount) === Number(checkout.importe) && !Number(payment.transaction_amount_refunded || 0);
    if (free && quote.estado !== "reservado") {
      try { const fresh = await context(consultation.slug, consultation.servicio_id, quote.equipo_id); await available(consultation.slug, quote.fecha, quote.hora.slice(0, 5), { duracion: quote.duracion, capacidad: 1 }, fresh.config, fresh.member, consultation.servicio_id); }
      catch (failure) { if (failure.promoValidacion || (failure.status && failure.status < 500)) free = false; else throw failure; }
    }
    const reconciled = read(await supabase.rpc("consulta_conciliar_pago", { p_checkout: checkout.id, p_pago: String(paymentId), p_importe: Number(payment.transaction_amount), p_disponible: free }));
    if (reconciled.estado === "reintegro_pendiente") await refund(reconciled, data, ctx);
  };
  let busy = false;
  const retryRefunds = async () => {
    if (!enabled || busy) return; busy = true;
    try {
      const pending = read(await supabase.from("consulta_pagos").select("*").eq("estado", "reintegro_pendiente").lte("reintentar_at", new Date().toISOString()).order("reintentar_at").limit(20));
      for (const payment of pending || []) { try { await process(payment.checkout_id, payment.payment_id); } catch { console.error("Quote refund retry pending", payment.payment_id); } }
      const checkouts = read(await supabase.from("consulta_checkouts").select("id").lte("revisar_at", new Date().toISOString()).order("revisar_at").limit(20));
      for (const checkout of checkouts || []) {
        try {
          const data = await load(checkout.id), ctx = await gateway.context(data.consultation.slug, data.quote.equipo_id);
          const payments = await gateway.search(ctx, checkout.id);
          for (const payment of payments.results || []) await process(checkout.id, String(payment.id));
        } catch { console.error("Quote payment verification pending", checkout.id); }
        finally { read(await supabase.from("consulta_checkouts").update({ revisar_at: new Date(Date.now() + 300000).toISOString() }).eq("id", checkout.id)); }
      }
    } finally { busy = false; }
  };
  return { enabled, prepare, process, retryRefunds };
}
