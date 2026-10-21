const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("../web/node_modules/typescript");
const crypto = require("node:crypto");
const serviceId = crypto.randomUUID();
const members = ["Ana", "Luis", "No asignado"].map(nombre => ({ id: crypto.randomUUID(), nombre, activo: true }));
let draft = { offers: [], recompensas: [] }, dirty = 0, cursor = 0;
const states = [];
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  useEffect: () => {},
  useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
};
const context = {
  exports: {}, crypto, window: {},
  require: name => name === "react" ? React : name === "./browse-config" ? {
    useBrowseBusiness: () => ({ data: { equipo: members, servicios: [{ id: serviceId, precio: 15000, servicio_equipo: members.slice(0, 2).map((member, index) => ({ equipo_id: member.id, precio_override: index ? 12000 : null })) }] }, draft, update: fn => { draft = fn(draft); dirty++; } }),
  } : {},
};
const source = fs.readFileSync(require("node:path").join(__dirname, "../web/src/migrated/panel/service-browse-config.tsx"), "utf8");
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
const render = () => { cursor = 0; return context.exports.default({ api: "/api", serviceId, name: "Corte", price: 15000 }); };
function all(tree, predicate) { return !tree || typeof tree !== "object" ? [] : [...(predicate(tree) ? [tree] : []), ...(tree.children || []).flatMap(child => all(child, predicate))]; }
let tree = render();
all(tree, node => node.props["aria-label"] === "Habilitar Turnits Offers")[0].props.onChange({ target: { checked: true } });
tree = render();
all(tree, node => node.props["aria-label"] === "Tarifa mínima")[0].props.onChange({ target: { value: "8000" } });
tree = render();
let group = all(tree, node => node.props.className === "service-browse-members")[0];
let checkboxes = all(group, node => node.type === "input");
assert.equal(checkboxes.length, 2, "only assigned active professionals are selectable");
checkboxes[1].props.onChange({ target: { checked: true } });
assert.equal(draft.offers.length, 2);
assert(draft.offers.every(offer => offer.precio_minimo === 8000 && offer.activo));
tree = render();
assert.equal(all(tree, node => node.props["aria-label"] === "Tarifa mínima")[0].props.max, 11999.99);
all(tree, node => node.props["aria-label"] === "Tarifa mínima")[0].props.onChange({ target: { value: "9000" } });
assert(draft.offers.every(offer => offer.precio_minimo === 9000));
tree = render();
group = all(tree, node => node.props.className === "service-browse-members")[0];
all(group, node => node.type === "input")[0].props.onChange({ target: { checked: false } });
assert.equal(draft.offers.length, 1);
assert.equal(draft.offers[0].equipo_id, members[1].id);
assert(dirty > 0, "configuration uses the global draft update");
assert(!all(tree, node => node.type === "button").some(node => node.children.some(child => typeof child === "string" && /guardar/i.test(child))));
console.log("PASS service Offers: shared minimum, multiple assigned professionals, per-member price bound, deselection and global draft without an inner save button.");
