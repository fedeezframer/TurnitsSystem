import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  await readFile(
    new URL("../src/generated/argentina-map.json", import.meta.url),
    "utf8",
  ),
);
const archiveHash = createHash("sha256");
let size = 0;
for (const [index, part] of manifest.parts.entries()) {
  if (
    part.path !==
      `/maps/argentina/${manifest.version}/part-${String(index).padStart(3, "0")}.bin` ||
    part.size <= 0 ||
    part.size > manifest.chunkSize
  )
    throw new Error("Manifiesto cartográfico inválido");
  const partHash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(
    new URL("../public" + part.path, import.meta.url),
  )) {
    archiveHash.update(chunk);
    partHash.update(chunk);
    bytes += chunk.length;
  }
  if (bytes !== part.size || partHash.digest("hex") !== part.sha256)
    throw new Error(`Bloque del mapa incompleto: ${part.path}`);
  size += bytes;
}
if (
  !size ||
  size !== manifest.size ||
  archiveHash.digest("hex") !== manifest.sha256
)
  throw new Error("Archivo cartográfico incompleto");
console.log(
  `Mapa local comprobado: ${manifest.parts.length} bloques, ${(size / 1048576).toFixed(1)} MB.`,
);
