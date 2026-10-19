const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const ts = require("../web/node_modules/typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../web/src/migrated/panel/common.tsx"),
  "utf8",
);
const code = ts.transpileModule(
  source.slice(
    source.indexOf("type TurnitsGlobalSaveSection"),
    source.indexOf("const UserGreeting_textStyle"),
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const storage = new Map([["unrelated-user-draft", "keep"]]);
const win = new EventTarget();
win.location = { pathname: "/panel/prueba", search: "" };
win.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
let writes = 0,
  release;
const ctx = {
  window: win,
  exports: {},
  React: {},
  appConfig: { apiUrl: "/api" },
  safeLocalStorage: (key) => (key === "access_token" ? "fixture-token" : ""),
  GuardaSesion_leerJwt: () => ({ rol: "owner" }),
  getPanelScope: () => null,
  CustomEvent,
  URLSearchParams,
  console,
  fetch: async () => {
    writes++;
    await new Promise((resolve) => (release = resolve));
    return { ok: true, json: async () => ({ success: true }) };
  },
};
const manager = vm.runInNewContext(
  code + ";TurnitsGlobalSaveManager_get()",
  ctx,
);
(async () => {
  let resetEvents = 0;
  win.addEventListener("turnits_global_discarded", () => resetEvents++);
  manager.setBaseline("horarios", { dia: "lunes" });
  manager.setBaseline("perfil", { nombre: "Guardado" });
  manager.markDirty("horarios", { dia: "martes" });
  manager.markDirty("perfil", { nombre: "Pendiente" });
  assert(manager.hasDirty());
  assert.equal(manager.discardAll(), true);
  assert.equal(manager.hasDirty(), false);
  assert.equal(writes, 0);
  assert.equal(resetEvents, 1);
  assert.equal(storage.get("unrelated-user-draft"), "keep");
  assert([...storage.values()].includes("{}"));
  manager.markDirty("perfil", { nombre: "Guardado" });
  assert.equal(manager.hasDirty(), false, "discard preserves saved baseline");
  manager.markDirty("perfil", { nombre: "Otro" });
  manager.setBlocker("perfil", "Subiendo fotos");
  assert.equal(manager.discardAll(), false);
  assert(manager.hasDirty());
  assert.equal(resetEvents, 1);
  manager.setBlocker("perfil", "");
  assert.equal(manager.discardAll(), true);
  manager.markDirty("horarios", { dia: "miercoles" });
  const save = manager.saveAll();
  assert(manager.isSaving());
  assert.equal(manager.discardAll(), false);
  assert(manager.hasDirty());
  release();
  await save;
  assert.equal(manager.hasDirty(), false);
  assert.equal(writes, 1);
  assert.equal(resetEvents, 2);
  console.log(
    "PASS discard: clears all pending sections and scoped storage, preserves baseline/other users, emits reset without requests, blocked during uploads and in-flight save. Real manager; no external writes.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
