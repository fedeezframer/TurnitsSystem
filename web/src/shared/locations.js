export function validPoint(point) {
  return (
    !!point &&
    typeof point.latitud === "number" &&
    Number.isFinite(point.latitud) &&
    Math.abs(point.latitud) <= 90 &&
    typeof point.longitud === "number" &&
    Number.isFinite(point.longitud) &&
    Math.abs(point.longitud) <= 180
  );
}
export function distanceKm(a, b) {
  if (!validPoint(a) || !validPoint(b)) return null;
  const rad = Math.PI / 180,
    dlat = (b.latitud - a.latitud) * rad,
    dlon = (b.longitud - a.longitud) * rad;
  const value =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitud * rad) *
      Math.cos(b.latitud * rad) *
      Math.sin(dlon / 2) ** 2;
  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(Math.max(0, Math.min(1, value))),
      Math.sqrt(Math.max(0, 1 - value)),
    )
  );
}
export function branchesByDistance(branches, position) {
  return branches
    .map((s, index) => ({
      ...s,
      distancia: distanceKm(position, s),
      orden: index,
    }))
    .sort(
      (a, b) =>
        (a.distancia ?? Infinity) - (b.distancia ?? Infinity) ||
        a.orden - b.orden,
    );
}
