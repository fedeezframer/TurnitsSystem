const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("../web/node_modules/typescript");
(async () => {
  const discovery = await import("../web/src/shared/discovery.js");
  let cursor = 0;
  const states = [], refs = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useEffect: () => {},
    useRef: value => { const index = cursor++; return refs[index] ||= { current: value }; },
    useState: initial => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial; return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
  };
  const requests = [];
  const context = { exports: {}, URLSearchParams, AbortController, Intl, Date, fetch: async url => {
    requests.push(url);
    return { ok: true, json: async () => ({ success: true, slots: [{ hora: "16:30", disponibles: 1, lleno: false }, { hora: "17:00", disponibles: 1, lleno: false }] }) };
  }, require: name => name === "react" ? React : name.includes("discovery.js") ? discovery : { appConfig: { apiUrl: "https://test.invalid" } } };
  const source = fs.readFileSync("web/src/components/IntentDiscovery.tsx", "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
  const props = { services: [{ id: "one", slug: "local", nombre: "Corte", duracion: 30, equipo: [{ id: "member", nombre: "Ana", precio: 100 }] }, { id: "two", slug: "local", nombre: "Color", duracion: 60, equipo: [{ id: "other", nombre: "Sol", precio: 200 }] }], renderService: service => ({ type: "result", props: { service }, children: [] }) };
  const render = () => { cursor = 0; return context.exports.default(props); };
  const all = (tree, predicate) => !tree || typeof tree !== "object" ? [] : [...(predicate(tree) ? [tree] : []), ...(tree.children || []).flatMap(child => all(child, predicate))];
  let tree = render();
  const inputs = all(tree, node => node.type === "input");
  inputs[2].props.onChange({ target: { value: "16:30" } });
  inputs[3].props.onChange({ target: { value: "17:00" } });
  inputs[4].props.onChange({ target: { value: "150" } });
  tree = render();
  await all(tree, node => node.type === "form")[0].props.onSubmit({ preventDefault() {} });
  tree = render();
  const results = all(tree, node => node.type === "result");
  assert.equal(results.length, 1);
  assert.equal(results[0].props.service.id, "one");
  assert.equal(results[0].props.service.discovery.hora, "16:30");
  assert.equal(results[0].props.service.precio, 100);
  assert.equal(requests.length, 1, "professionals outside the budget are not queried");
  all(tree, node => node.type === "form")[0].props.onChange();
  assert.equal(all(render(), node => node.type === "result").length, 0, "editing criteria clears stale results");
  console.log("PASS intent discovery: budget per professional, real slots, finish-time limit, selected member and stale-result reset.");
})().catch(error => { console.error(error); process.exitCode = 1; });
