const assert = require("node:assert/strict");
(async () => {
  const {
    calendarMonthDays,
    shiftCalendarDay,
    shiftCalendarMonth,
    calendarLabel,
  } = await import("../web/src/shared/browse-calendar.js");
  for (const month of ["2026-10", "2028-02", "2027-02", "2026-12", "2027-01"]) {
    const days = calendarMonthDays(month);
    assert.equal(days.length % 7, 0);
    assert.equal(new Date(days[0] + "T12:00:00Z").getUTCDay(), 1);
    assert.equal(new Date(days.at(-1) + "T12:00:00Z").getUTCDay(), 0);
    assert.equal(new Set(days).size, days.length);
    for (let i = 1; i < days.length; i++)
      assert.equal(shiftCalendarDay(days[i - 1], 1), days[i]);
  }
  assert(calendarMonthDays("2028-02").includes("2028-02-29"));
  assert(!calendarMonthDays("2027-02").includes("2027-02-29"));
  assert.equal(shiftCalendarDay("2028-02-29", 1), "2028-03-01");
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");
  assert.equal(shiftCalendarMonth("2027-01", -1), "2026-12");
  assert.equal(calendarLabel("2026-10-17", { weekday: "long" }), "sábado");
  console.log(
    "PASS civil calendar: real month lengths, leap day, Monday-to-Sunday alignment, year boundaries and timezone-safe labels.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
