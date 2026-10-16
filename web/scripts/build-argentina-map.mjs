// Node >=24. Local build tool; never runs in the booking or API process.
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import { writeFileSync, existsSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output || existsSync(output))
  throw new Error(
    "Uso: node build-argentina-map.mjs original.mbtiles calles-nuevo.mbtiles (salida nueva)",
  );
const keep = new Set(["streets", "street_labels"]),
  ranges = new Set([0, 256, 512, 768, 8192]);
function varint(bytes, state) {
  let value = 0,
    shift = 0,
    byte;
  do {
    if (state.pos >= bytes.length || shift > 49)
      throw new Error("Protobuf inválido");
    byte = bytes[state.pos++];
    value += (byte & 127) * 2 ** shift;
    shift += 7;
  } while (byte & 128);
  return value;
}
function* fields(bytes) {
  const state = { pos: 0 };
  while (state.pos < bytes.length) {
    const start = state.pos,
      tag = varint(bytes, state),
      wire = tag & 7;
    let payload;
    if (wire === 0) varint(bytes, state);
    else if (wire === 1) state.pos += 8;
    else if (wire === 5) state.pos += 4;
    else if (wire === 2) {
      const size = varint(bytes, state);
      payload = bytes.subarray(state.pos, state.pos + size);
      state.pos += size;
    } else throw new Error("Tipo Protobuf no soportado");
    if (state.pos > bytes.length) throw new Error("Protobuf incompleto");
    yield { tag: tag >> 3, payload, raw: bytes.subarray(start, state.pos) };
  }
}
function encodedVarint(value) {
  const bytes = [];
  do {
    const next = value % 128;
    value = Math.floor(value / 128);
    bytes.push(next | (value ? 128 : 0));
  } while (value);
  return Buffer.from(bytes);
}
const message = (tag, data) =>
  Buffer.concat([encodedVarint(tag * 8 + 2), encodedVarint(data.length), data]);
const roadKinds = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
  "pedestrian",
  "service",
  "track",
  "path",
  "footway",
  "cycleway",
  "steps",
  "busway",
  "bus_guideway",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);
function compactLayer(attributes, name) {
  const oldKeys = attributes
    .filter((f) => f.tag === 3)
    .map((f) => f.payload.toString("utf8"));
  const oldValues = attributes.filter((f) => f.tag === 4);
  const keys = name === "streets" ? ["kind"] : ["kind", "name"];
  const values = [],
    valueMap = new Map(),
    features = [];
  for (const feature of attributes.filter((f) => f.tag === 2)) {
    const parts = [...fields(feature.payload)],
      tags = parts.find((p) => p.tag === 2)?.payload;
    if (!tags) continue;
    const state = { pos: 0 },
      pairs = [];
    let kind;
    while (state.pos < tags.length) {
      const key = varint(tags, state),
        value = varint(tags, state);
      if (oldKeys[key] === "kind")
        kind = [...fields(oldValues[value].payload)]
          .find((f) => f.tag === 1)
          ?.payload?.toString("utf8");
      if (keys.includes(oldKeys[key]))
        pairs.push([keys.indexOf(oldKeys[key]), value]);
    }
    if (!roadKinds.has(kind)) continue;
    const mapped = [];
    for (const [key, value] of pairs) {
      if (!valueMap.has(value)) {
        valueMap.set(value, values.length);
        values.push(oldValues[value].raw);
        if (name === "street_labels" && keys[key] === "name")
          for (const f of fields(oldValues[value].payload))
            if (f.tag === 1 && f.payload)
              for (const char of f.payload.toString("utf8"))
                ranges.add(Math.floor(char.codePointAt(0) / 256) * 256);
      }
      mapped.push(encodedVarint(key), encodedVarint(valueMap.get(value)));
    }
    features.push(
      message(
        2,
        Buffer.concat([
          message(2, Buffer.concat(mapped)),
          ...parts.filter((p) => p.tag === 3 || p.tag === 4).map((p) => p.raw),
        ]),
      ),
    );
  }
  if (!features.length) return null;
  return message(
    3,
    Buffer.concat([
      ...attributes.filter((f) => [1, 5, 15].includes(f.tag)).map((f) => f.raw),
      ...features,
      ...keys.map((key) => message(3, Buffer.from(key))),
      ...values,
    ]),
  );
}
function filterTile(compressed) {
  const bytes = Buffer.from(compressed);
  const raw = bytes[0] === 31 && bytes[1] === 139 ? gunzipSync(bytes) : bytes;
  const layers = [];
  for (const field of fields(raw)) {
    if (field.tag !== 3 || !field.payload) continue;
    const attributes = [...fields(field.payload)];
    const name = attributes.find((f) => f.tag === 1)?.payload?.toString("utf8");
    if (!keep.has(name)) continue;
    const compact = compactLayer(attributes, name);
    if (compact) layers.push(compact);
  }
  return layers.length
    ? gzipSync(Buffer.concat(layers), { level: 9, mtime: 0 })
    : null;
}
const source = new DatabaseSync(input, { readOnly: true }),
  dest = new DatabaseSync(output);
dest.exec(
  "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; CREATE TABLE metadata(name TEXT,value TEXT); CREATE TABLE tiles(zoom_level INTEGER,tile_column INTEGER,tile_row INTEGER,tile_data BLOB); BEGIN",
);
const insertMeta = dest.prepare("INSERT INTO metadata VALUES (?,?)");
for (const { name, value } of source
  .prepare("SELECT name,value FROM metadata")
  .iterate()) {
  if (name === "json") {
    const json = JSON.parse(value);
    json.vector_layers = json.vector_layers.filter((layer) =>
      keep.has(layer.id),
    );
    insertMeta.run(name, JSON.stringify(json));
  } else
    insertMeta.run(
      name,
      name === "name" ? "Turnits · Calles de Argentina" : value,
    );
}
const insert = dest.prepare("INSERT INTO tiles VALUES (?,?,?,?)");
let visited = 0,
  written = 0,
  size = 0;
for (const row of source
  .prepare("SELECT zoom_level,tile_column,tile_row,tile_data FROM tiles")
  .iterate()) {
  const tile = filterTile(row.tile_data);
  if (tile) {
    insert.run(row.zoom_level, row.tile_column, row.tile_row, tile);
    written++;
    size += tile.length;
  }
  if (++visited % 5000 === 0) {
    dest.exec("COMMIT; BEGIN");
    console.log(
      JSON.stringify({
        visited,
        written,
        megabytes: Math.round(size / 1048576),
      }),
    );
  }
}
dest.exec(
  "COMMIT; CREATE UNIQUE INDEX tile_index ON tiles(zoom_level,tile_column,tile_row)",
);
source.close();
dest.close();
writeFileSync(
  output + ".glyph-ranges.json",
  JSON.stringify(
    [...ranges].sort((a, b) => a - b).map((s) => `${s}-${s + 255}`),
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    complete: true,
    visited,
    written,
    megabytes: Math.round(size / 1048576),
  }),
);
