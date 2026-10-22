export function quotePresentation(quote, fallback = "Servicio") {
  const detail = String(quote?.detalle || "");
  const match = detail.match(/^\[servicio:([^\]]+)\]\n?/);
  if (!match) return { service: fallback, observation: detail };
  try { return { service: decodeURIComponent(match[1]), observation: detail.slice(match[0].length) }; }
  catch { return { service: fallback, observation: detail }; }
}

export function quoteDetail(service, observation) {
  return `[servicio:${encodeURIComponent(service.trim())}]\n${observation.trim()}`;
}

export function messagePreview(item, business) {
  if (!item.ultimo_autor) return "Iniciá la conversación";
  const mine = item.ultimo_autor === (business ? "negocio" : "cliente");
  if (item.ultima_foto) return mine ? "Enviaste una foto" : "Te envió una foto";
  const text = String(item.ultimo_texto || "").replace(/\s+/g, " ").trim();
  return mine ? `Vos: ${text}` : text;
}

export function mergeMessages(previous = [], incoming = []) {
  const unique = new Map(previous.map(message => [message.id, message]));
  incoming.forEach(message => unique.set(message.id, message));
  return [...unique.values()].sort((first, second) => first.created_at.localeCompare(second.created_at) || first.id.localeCompare(second.id));
}

export function defaultQuoteExpiry(date, time, now = Date.now()) {
  const start = Date.parse(`${date}T${time}:00-03:00`);
  return Number.isFinite(start) && start > now ? new Date(Math.min(start, now + 7 * 86400000)).toISOString() : "";
}
