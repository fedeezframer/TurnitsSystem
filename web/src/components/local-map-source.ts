import {
  FetchSource,
  PMTiles,
  Protocol,
  type RangeResponse,
  type Source,
} from "pmtiles";
import { addProtocol } from "maplibre-gl";
import manifest from "../generated/argentina-map.json";

// One standard PMTiles archive, stored in bounded files so data updates do not
// require Git LFS or a separate map service. Only the requested byte ranges load.
export class LocalMapSource implements Source {
  private parts: FetchSource[];
  constructor(private origin = window.location.origin) {
    this.parts = manifest.parts.map(
      (part) => new FetchSource(new URL(part.path, origin).href),
    );
  }
  getKey() {
    return new URL(
      `/maps/argentina/${manifest.version}/streets.pmtiles`,
      this.origin,
    ).href;
  }
  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Promise<RangeResponse> {
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length <= 0 ||
      offset >= manifest.size
    )
      throw new Error("Rango del mapa inválido.");
    const end = Math.min(offset + length, manifest.size),
      data = new Uint8Array(end - offset);
    let cursor = offset;
    while (cursor < end) {
      signal?.throwIfAborted();
      const index = Math.floor(cursor / manifest.chunkSize),
        start = cursor % manifest.chunkSize;
      const take = Math.min(end - cursor, manifest.parts[index].size - start);
      const chunk = await this.parts[index].getBytes(start, take, signal);
      if (chunk.data.byteLength !== take)
        throw new Error("El archivo del mapa está incompleto.");
      data.set(new Uint8Array(chunk.data), cursor - offset);
      cursor += take;
    }
    return { data: data.buffer };
  }
}

let sourceUrl: string;
export function localMapUrl() {
  if (!sourceUrl) {
    const source = new LocalMapSource(),
      archive = new PMTiles(source),
      protocol = new Protocol();
    protocol.add(archive);
    addProtocol("pmtiles", protocol.tile);
    sourceUrl = `pmtiles://${source.getKey()}`;
  }
  return sourceUrl;
}
