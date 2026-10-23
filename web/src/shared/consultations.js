function encodeProducts(products) {
  const bytes = new TextEncoder().encode(JSON.stringify(products));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeProducts(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const products = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(products)) return [];
  return products.filter(product => product && typeof product.id === "string" && typeof product.nombre === "string" && Number.isInteger(product.cantidad) && product.cantidad > 0 && Number.isFinite(Number(product.precio_unitario)) && Number(product.precio_unitario) >= 0).map(product => ({
    id: product.id,
    nombre: product.nombre,
    cantidad: product.cantidad,
    precio_unitario: Number(product.precio_unitario),
    precio: Math.round(Number(product.precio_unitario) * product.cantidad * 100) / 100,
  }));
}

export function quotePresentation(quote, fallback = "Servicio") {
  let detail = String(quote?.detalle || "");
  let products = [];
  const productsMatch = detail.match(/\n?\[productos:([A-Za-z0-9_-]+)\]\s*$/);
  if (productsMatch) {
    try { products = decodeProducts(productsMatch[1]); detail = detail.slice(0, productsMatch.index).trimEnd(); }
    catch {}
  }
  const match = detail.match(/^\[servicio:([^\]]+)\]\n?/);
  if (!match) return { service: fallback, observation: detail, products };
  try { return { service: decodeURIComponent(match[1]), observation: detail.slice(match[0].length), products }; }
  catch { return { service: fallback, observation: detail, products }; }
}

export function quoteDetail(service, observation, products = []) {
  const productDetail = products.length ? `\n\n[productos:${encodeProducts(products)}]` : "";
  return `[servicio:${encodeURIComponent(service.trim())}]\n${observation.trim()}${productDetail}`;
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

export function availabilityInquiry(params) {
  const date = params.get("fecha") || "", time = params.get("hora") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "";
  const professional = String(params.get("profesional") || "").slice(0, 120);
  return `Hola, me gustaría consultar disponibilidad para el ${date.split("-").reverse().join("/")} a las ${time}${professional ? ` con ${professional}` : ""}. Quisiera coordinar mi proyecto y el presupuesto.`;
}
