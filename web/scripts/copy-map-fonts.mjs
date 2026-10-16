import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const [rangesFile, webRoot] = process.argv.slice(2);
if (!rangesFile || !webRoot)
  throw new Error(
    "Uso: node copy-map-fonts.mjs calles.mbtiles.glyph-ranges.json web/",
  );
const target = resolve(webRoot, "public/maps/fonts/Noto Sans Regular");
await mkdir(target, { recursive: true });
for (const range of JSON.parse(await readFile(rangesFile, "utf8"))) {
  if (!/^\d+-\d+$/.test(range)) throw new Error("Rango inválido");
  const response = await fetch(
    `https://tiles.openfreemap.org/fonts/Noto%20Sans%20Regular/${range}.pbf`,
  );
  if (!response.ok) throw new Error(`No se pudo descargar el glifo ${range}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (
    !bytes.length ||
    new TextDecoder().decode(bytes.slice(0, 30)).includes("<!DOCTYPE")
  )
    throw new Error("Glifo inválido");
  await writeFile(resolve(target, range + ".pbf"), bytes);
}
console.log(
  "Glifos locales actualizados. No se descargan durante el uso del mapa.",
);
