export function recommendServices(services, { favorites = [], serviceFavorites = [], interests = [], appointments = [], distance = () => Infinity, limit = 18 } = {}) {
  const saved = new Set(favorites), preferred = new Set(interests);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const completed = appointments.filter(item => item.estado === "completado" || (item.estado === "confirmado" && item.fecha < today));
  const visited = new Set(completed.map(item => item.slug));
  const categories = new Set(services.filter(service => visited.has(service.slug)).map(service => service.negocio?.rubro));
  const score = service => {
    const km = distance(service);
    return (serviceFavorites.includes(service.id) ? 7 : 0) + (saved.has(service.slug) ? 6 : 0) + (preferred.has(service.negocio?.rubro) ? 4 : 0) + (visited.has(service.slug) ? 3 : 0) + (categories.has(service.negocio?.rubro) ? 1 : 0) + (Number.isFinite(km) ? Math.max(0, 3 - km / 5) : 0);
  };
  const sorted = services.map((service, index) => ({ service, index, score: score(service) })).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = [], remaining = [], counts = new Map();
  for (const item of sorted) {
    const count = counts.get(item.service.slug) || 0;
    if (count < 2) { selected.push(item.service); counts.set(item.service.slug, count + 1); }
    else remaining.push(item.service);
  }
  return [...selected, ...remaining].slice(0, limit);
}
