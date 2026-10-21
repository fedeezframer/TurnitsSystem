const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("../web/node_modules/typescript");
let cursor = 0;
const states = [];
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
  lazy: () => () => null,
  useMemo: factory => factory(), useEffect: () => {},
  useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; },
};
const context = { exports: {}, require: name => name === "react" ? React : name.includes("socials") ? { enlacesPublicos: () => [] } : {} };
const source = fs.readFileSync(path.join(__dirname, "../web/src/migrated/panel/perfil-publico.tsx"), "utf8");
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, context);
const perfil = { nombre: "Negocio", descripcion: "Información general", fotos: Array.from({ length: 8 }, (_, index) => `/photo-${index}.jpg`) };
const render = value => { cursor = 0; return context.exports.PerfilContenido({ perfil: value, slug: "negocio" }); };
function all(tree, predicate) { return !tree || typeof tree !== "object" ? [] : [...(predicate(tree) ? [tree] : []), ...(tree.children || []).flatMap(child => all(child, predicate))]; }
let tree = render(perfil);
const photos = value => all(value, node => node.type?.name === "PublicationPhoto");
assert.equal(photos(tree).length, 6);
assert.deepEqual(all(tree, node => node.type === "section").map(node => node.props.className), ["perfil-details", "perfil-inline-publications", "perfil-reviews"]);
all(tree, node => node.props.className === "perfil-publications-more")[0].props.onClick();
tree = render(perfil);
assert.equal(photos(tree).length, 8);
all(tree, node => node.props.className === "perfil-publications-more")[0].props.onClick();
assert.equal(photos(render(perfil)).length, 6);
assert.equal(all(render({ ...perfil, fotos: [] }), node => node.props.className === "perfil-inline-publications").length, 0);
console.log("PASS profile: general information, six inline publications, expand/collapse, reviews after gallery, empty gallery hidden.");
