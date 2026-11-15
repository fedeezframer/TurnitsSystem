import { quotePresentation } from "./consultations.js";
const amount = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(Math.round(number * 100) / 100, 0) : 0;
};
export const receiptMoney = value => new Intl.NumberFormat("es-AR", {
  style: "currency", currency: "ARS", minimumFractionDigits: 2,
}).format(amount(value));
export function receiptDate(value) {
  const date = new Date(String(value || "").slice(0, 10) + "T12:00:00");
  return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(date);
}
export function bookingReceipt(turno) {
  const quote = turno.presupuesto_detalle ? quotePresentation({ detalle: turno.presupuesto_detalle }, turno.servicio_nombre || turno.servicio) : null;
  const receiptExtras = Array.isArray(turno.extras) ? turno.extras : [];
  const quotedExtras = (quote?.products || []).map(product => ({
    id: product.id,
    nombre: product.nombre,
    cantidad: product.cantidad,
    precio: product.precio,
  }));
  const quotedIds = new Set(quotedExtras.map(extra => extra.id));
  const extras = [...receiptExtras.filter(extra => !quotedIds.has(extra.id)), ...quotedExtras].map(extra => ({
    name: String(extra.nombre || "Producto"),
    quantity: Math.max(1, Number(extra.cantidad) || 1),
    total: amount(extra.precio),
  }));
  const total = amount(turno.precio_cobrado);
  const paid = amount(turno.monto_pagado);
  const due = amount(total - paid);
  const state = ({ confirmado: "Confirmado", completado: "Completado", cancelado: "Cancelado", pendiente: "Pendiente de confirmación" })[turno.estado] || "Pendiente de confirmación";
  const payment = ({ aprobado: "Aprobado", pendiente: "Pendiente de verificación", rechazado: "Rechazado", reembolsado: "Reembolsado", sin_pago: "Sin pago registrado" })[turno.pago_estado] || "Sin pago registrado";
  const method = ({ mercadopago: "Mercado Pago", transferencia: "Transferencia bancaria", efectivo: "Efectivo", canje: "No informado", none: "Sin pago online" })[turno.metodo_pago] || "No informado";
  const rows = [
    ["Negocio", turno.business_name || turno.negocio_nombre || turno.slug],
    ["Reservó", [turno.nombre, turno.apellido].filter(Boolean).join(" ") || turno.cliente],
    ["Email", turno.email], ["Teléfono", turno.telefono],
    ["Servicio", quote?.service || turno.servicio_nombre || turno.servicio],
    ["Detalle acordado", quote?.observation],
    ["Profesional", turno.equipo_nombre], ["Sucursal", turno.sucursal_nombre],
    ["Día", receiptDate(turno.fecha)], ["Hora", turno.hora ? String(turno.hora).slice(0, 5) + " hs" : "Sin horario"],
  ].filter(([, value]) => value).map(([label, value]) => [label, String(value)]);
  const financialRows = [
    ["Servicio", receiptMoney(Math.max(total - extras.reduce((sum, extra) => sum + extra.total, 0), 0))],
    ...extras.map(extra => [`${extra.quantity} × ${extra.name}`, receiptMoney(extra.total)]),
    ["Total de la reserva", receiptMoney(total)],
    ["Abonado registrado", receiptMoney(paid)],
    ["Saldo pendiente", receiptMoney(due)],
    ["Método de pago", method], ["Estado del pago", payment],
  ];
  const note = turno.estado === "cancelado" ? "Reserva cancelada. Los reintegros y cualquier saldo deben coordinarse con el negocio."
    : turno.pago_estado === "reembolsado" ? "Pago reembolsado. Consultá al negocio antes de realizar un nuevo pago."
    : turno.pago_estado === "pendiente" ? "Los pagos pendientes de verificación no se consideran abonados hasta que sean acreditados."
    : due > 0 ? "Queda un saldo pendiente. Coordiná con el negocio cómo abonarlo."
    : "No hay saldo pendiente registrado.";
  return { id: String(turno.id || ""), state, payment, total, paid, due, extras, rows, financialRows, note };
}
export function receiptHome(storage) {
  try {
    if (!storage.getItem("access_token")) return "/";
    return storage.getItem("account_type") === "usuario" ? "/browse" : "/app";
  } catch { return "/"; }
}
