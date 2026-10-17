// Civil dates use UTC at noon so DST and the browser's timezone cannot move a day.
export const calendarDate = (iso) => new Date(`${iso}T12:00:00Z`);
export const calendarKey = (date) => date.toISOString().slice(0, 10);
export function calendarMonthDays(month) {
  const first = calendarDate(month.slice(0, 7) + "-01");
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12),
  );
  const count = Math.ceil((offset + last.getUTCDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(first);
    date.setUTCDate(1 - offset + i);
    return calendarKey(date);
  });
}
export function shiftCalendarMonth(month, delta) {
  const date = calendarDate(month.slice(0, 7) + "-01");
  date.setUTCMonth(date.getUTCMonth() + delta);
  return calendarKey(date).slice(0, 7);
}
export function shiftCalendarDay(iso, delta) {
  const date = calendarDate(iso);
  date.setUTCDate(date.getUTCDate() + delta);
  return calendarKey(date);
}
export const calendarLabel = (iso, options) =>
  calendarDate(iso).toLocaleDateString("es-AR", {
    ...options,
    timeZone: "UTC",
  });
