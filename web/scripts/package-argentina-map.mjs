import { open, mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const [input, webRoot] = process.argv.slice(2);
if (!input || !webRoot)
  throw new Error("Uso: node package-argentina-map.mjs calles.pmtiles web/");
const hash = createHash("sha256");
for await (const bytes of createReadStream(input)) hash.update(bytes);
const sha256 = hash.digest("hex"),
  version = sha256.slice(0, 16),
  chunkSize = 45 * 1024 * 1024;
const directory = resolve(webRoot, "public/maps/argentina", version),
  file = await open(input, "r"),
  size = (await file.stat()).size;
await mkdir(directory, { recursive: true });
const parts = [];
for (let offset = 0, index = 0; offset < size; offset += chunkSize, index++) {
  const length = Math.min(size - offset, chunkSize),
    data = Buffer.alloc(length);
  let read = 0;
  while (read < length) {
    const next = await file.read(data, read, length - read, offset + read);
    if (!next.bytesRead) throw new Error("Archivo PMTiles incompleto");
    read += next.bytesRead;
  }
  const name = `part-${String(index).padStart(3, "0")}.bin`;
  await writeFile(resolve(directory, name), data);
  parts.push({
    path: `/maps/argentina/${version}/${name}`,
    size: length,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
await file.close();
const manifest = { version, size, sha256, chunkSize, parts };
await mkdir(resolve(webRoot, "src/generated"), { recursive: true });
await writeFile(
  resolve(webRoot, "src/generated/argentina-map.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  resolve(directory, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({ ...manifest, megabytes: +(size / 1048576).toFixed(1) }),
);
