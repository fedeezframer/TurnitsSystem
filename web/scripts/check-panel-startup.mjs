import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import ts from "typescript";

const root = fileURLToPath(new URL("../dist", import.meta.url));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const entry = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
if (!entry) throw new Error("No se encontró la entrada de la aplicación.");
const main = fs.readFileSync(path.join(root, entry), "utf8");
const panel = main.match(/assets\/panel-[\w-]+\.js/)?.[0];
if (!panel) throw new Error("No se encontró la entrada del panel.");

const modules = new Map();
function collect(file) {
  if (modules.has(file)) return;
  const code = fs.readFileSync(path.join(root, file), "utf8");
  modules.set(file, code);
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const statement of source.statements) {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier) {
      const specifier = statement.moduleSpecifier.text;
      if (specifier.startsWith(".") && specifier.endsWith(".js"))
        collect(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
    }
  }
}
collect(entry);
collect("/" + panel);

const eagerEditor = [...modules.keys()].find(file =>
  /\/(servicios|finanzas|perfil|temas|horarios|agenda|clientes|empleado)-.*\.js$/.test(file),
);
if (eagerEditor) throw new Error(`La entrada descarga una sección que debería ser diferida: ${eagerEditor}`);
const bytes = [...modules.values()].reduce((total, code) => total + Buffer.byteLength(code), 0);
const gzip = [...modules.values()].reduce((total, code) => total + gzipSync(code).length, 0);
if (bytes > 700000 || gzip > 220000)
  throw new Error(`El código inicial excede el presupuesto: ${bytes} bytes, ${gzip} con gzip.`);
console.log(`Arranque comprobado: ${modules.size} módulos, ${(bytes / 1000).toFixed(1)} kB de JavaScript (${(gzip / 1000).toFixed(1)} kB con gzip); editores diferidos.`);
