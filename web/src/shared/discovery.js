export function timeMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ""))) return NaN;
  const [hours, minutes] = value.split(":").map(Number);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : NaN;
}

export function matchingSlots(slots, duration, from, until) {
  const length = Number(duration);
  if (!Number.isFinite(length) || length <= 0) return [];
  const start = from ? timeMinutes(from) : 0;
  const end = until ? timeMinutes(until) : 1440;
  return slots.filter(slot => {
    const minute = timeMinutes(slot.hora);
    return !slot.lleno && Number(slot.disponibles) > 0 && minute >= start && minute + length <= end;
  });
}
