// Shared by API and booking. Sunday=0 through Saturday=6; null means every day.
export const PROMO_DAYS = [
  { id: 1, short: "Lun", label: "lunes" }, { id: 2, short: "Mar", label: "martes" },
  { id: 3, short: "Mié", label: "miércoles" }, { id: 4, short: "Jue", label: "jueves" },
  { id: 5, short: "Vie", label: "viernes" }, { id: 6, short: "Sáb", label: "sábados" },
  { id: 0, short: "Dom", label: "domingos" },
];
export function normalizePromoDays(days) {
  if (days == null) return null;
  if (!Array.isArray(days) || !days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error("Elegí al menos un día de la semana válido o usá Todos los días.");
  }
  return [...new Set(days)].sort((a, b) => a - b);
}
export function promoAppliesOn(promo, date) {
  if (!promo || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || date < promo.fecha_inicio || date > promo.fecha_fin) return false;
  const parsed = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  return promo.dias_semana == null || (Array.isArray(promo.dias_semana) && promo.dias_semana.includes(parsed.getUTCDay()));
}
export function promoHasMatchingDate(promo) {
  const start = new Date(promo.fecha_inicio + "T12:00:00Z");
  for (let i = 0; i < 7; i++) {
    if (!Number.isFinite(start.getTime())) return false;
    const date = start.toISOString().slice(0, 10);
    if (date > promo.fecha_fin) return false;
    if (promoAppliesOn(promo, date)) return true;
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return false;
}
export function promoDaysLabel(days) {
  return days == null ? "Todos los días" : PROMO_DAYS.filter(d => days.includes(d.id)).map(d => d.label).join(", ");
}
