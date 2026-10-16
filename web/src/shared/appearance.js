export const CARD_SHAPES = [
  { value: "original", label: "Original", radius: null },
  { value: "rectas", label: "Rectas", radius: "0px" },
  { value: "suaves", label: "Suaves", radius: "12px" },
  { value: "redondeadas", label: "Redondeadas", radius: "24px" },
];
export const ICON_SHAPES = [
  { value: "original", label: "Original", radius: null },
  { value: "cuadrado", label: "Cuadrado", radius: "0px" },
  { value: "redondeado", label: "Redondeado", radius: "18%" },
  { value: "circular", label: "Circular", radius: "50%" },
];
export const DEFAULT_APPEARANCE = {
  forma_tarjetas: "original",
  forma_icono: "original",
};
export function cardRadius(shape, fallback = "18px") {
  return CARD_SHAPES.find((s) => s.value === shape)?.radius ?? fallback;
}
export function iconRadius(shape, fallback = "50%") {
  return ICON_SHAPES.find((s) => s.value === shape)?.radius ?? fallback;
}
export function appearanceChanges(raw) {
  const data = {};
  for (const [key, options] of [
    ["forma_tarjetas", CARD_SHAPES],
    ["forma_icono", ICON_SHAPES],
  ]) {
    if (!Object.hasOwn(raw, key)) continue;
    if (!options.some((option) => option.value === raw[key]))
      throw new Error("Revisá la forma de las tarjetas y del ícono.");
    data[key] = raw[key];
  }
  return data;
}
