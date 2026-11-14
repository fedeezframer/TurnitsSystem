export function setupProgress(settings: any, services: any[], now = Date.now()) {
  const service = services.some(item =>
    [true, "true"].includes(item.activo) && Number(item.precio) > 0 && Number(item.duracion) > 0,
  );
  const schedule = Object.values(settings.horarios || {}).some((day: any) =>
    day?.activo === true && Array.isArray(day.jornada) &&
    day.jornada.every((time: unknown) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) &&
    day.jornada.length === 2 && day.jornada[0] < day.jornada[1],
  );
  const premium = settings.plan === "premium";
  const payment = settings.mp_status === "Conectado" ||
    (premium && (settings.agenda_sin_pagos === true || settings.acepta_efectivo === true ||
      (settings.acepta_transferencia === true && Boolean(settings.datos_bancarios?.cbu || settings.datos_bancarios?.alias))));
  const expiry = settings.fecha_vencimiento ? Date.parse(settings.fecha_vencimiento) : null;
  const paused = ![true, "true"].includes(settings.activo) || settings.estado_suscripcion === "suspendido" ||
    (expiry !== null && (!Number.isFinite(expiry) || expiry <= now));
  const steps = [
    { id: "servicios", title: "Servicios", description: "Agregá el precio y la duración para que tus clientes puedan reservar.", done: service },
    { id: "horarios", title: "Horarios", description: "Elegí qué días atendés y en qué horarios.", done: schedule },
    { id: "pagos", title: "Cómo confirman la reserva", description: premium
      ? "Elegí si pedís un pago al reservar o cobrás en el local."
      : "Conectá Mercado Pago para recibir reservas con seña o pago total.", done: payment },
  ];
  return { steps, completed: steps.filter(step => step.done).length, paused, ready: !paused && steps.every(step => step.done) };
}
