const assert = require("node:assert/strict");
(async () => {
  const { matchingSlots, timeMinutes } = await import("../web/src/shared/discovery.js");
  const slots = [
    { hora: "16:00", disponibles: 1, lleno: false },
    { hora: "16:30", disponibles: 1, lleno: false },
    { hora: "17:00", disponibles: 1, lleno: false },
    { hora: "15:00", disponibles: 0, lleno: true },
  ];
  assert.deepEqual(matchingSlots(slots, 60, "16:00", "17:00").map(slot => slot.hora), ["16:00"]);
  assert.deepEqual(matchingSlots(slots, 30, "16:00", "17:00").map(slot => slot.hora), ["16:00", "16:30"]);
  assert.equal(matchingSlots(slots, 60, "17:00", "16:00").length, 0);
  assert.equal(matchingSlots(slots, "invalid", "", "").length, 0);
  assert.equal(matchingSlots(slots, 30, "", "").length, 3);
  assert(Number.isNaN(timeMinutes("24:00")));
  assert(Number.isNaN(timeMinutes("17:99")));
  assert.equal(matchingSlots([{ hora: "23:45", disponibles: 1 }], 30, "", "").length, 0);
  console.log("PASS discovery: finish-time deadline, duration, occupied slots, invalid times and midnight boundaries.");
})().catch(error => { console.error(error); process.exitCode = 1; });
