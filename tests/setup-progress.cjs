const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const ts = require("../web/node_modules/typescript");
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("web/src/shared/setup-progress.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { setupProgress } = context.exports;
const settings = { activo: true, plan: "basico", mp_status: "Conectado", horarios: {
  lunes: { activo: true, jornada: ["09:00", "18:00"] },
} };
const services = [{ activo: true, precio: 8500, duracion: 30 }];
assert.equal(setupProgress(settings, services).ready, true);
assert.equal(setupProgress(settings, []).completed, 2);
for (const item of [{ activo: false, precio: 8500, duracion: 30 }, { activo: true, precio: 0, duracion: 30 }, { activo: true, precio: 8500, duracion: 0 }]) {
  assert.equal(setupProgress(settings, [item]).ready, false);
}
for (const jornada of [[], ["09:00"], ["18:00", "09:00"], ["bad", "18:00"], ["09:00", "25:00"]]) {
  assert.equal(setupProgress({ ...settings, horarios: { lunes: { activo: true, jornada } } }, services).ready, false);
}
assert.equal(setupProgress({ ...settings, horarios: { lunes: { activo: false, jornada: ["09:00", "18:00"] } } }, services).ready, false);
const offline = { ...settings, mp_status: "Desconectado", acepta_efectivo: true };
assert.equal(setupProgress({ ...offline, plan: "gratis" }, services).ready, false);
for (const plan of ["basico", "premium"]) assert.equal(setupProgress({ ...offline, plan }, services).ready, true);
assert.equal(setupProgress({ ...offline, acepta_efectivo: false, plan: "premium", agenda_sin_pagos: true }, services).ready, true);
const transfer = { ...offline, acepta_efectivo: false, plan: "premium", acepta_transferencia: true };
assert.equal(setupProgress(transfer, services).ready, false);
assert.equal(setupProgress({ ...transfer, datos_bancarios: { alias: "cuenta.negocio" } }, services).ready, true);
for (const status of [{ activo: false }, { estado_suscripcion: "suspendido" }, { fecha_vencimiento: "2020-01-01" }, { fecha_vencimiento: "invalid" }]) {
  assert.equal(setupProgress({ ...settings, ...status }, services).ready, false);
}
assert.equal(setupProgress({ ...settings, fecha_vencimiento: "2030-01-01" }, services, Date.parse("2026-11-01")).ready, true);
console.log("PASS setup progress: active services, valid schedules, plan-specific payment methods, transfer details, inactive/suspended/expired accounts; no network or writes.");
