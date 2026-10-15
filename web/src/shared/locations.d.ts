export type GeoPoint = { latitud: number; longitud: number };
export function validPoint(point: unknown): point is GeoPoint;
export function distanceKm(a: unknown, b: unknown): number | null;
export function branchesByDistance<
  T extends { latitud?: number | null; longitud?: number | null },
>(
  branches: T[],
  position: unknown,
): (T & { distancia: number | null; orden: number })[];
