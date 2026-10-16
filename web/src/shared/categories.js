export const ACCOUNT_CATEGORIES = [
  { id: "barberia", label: "Barbería", icon: "moustache" },
  { id: "manicura", label: "Manicura", icon: "nails" },
  { id: "vehiculos", label: "Vehículos", icon: "wheel" },
  { id: "peluqueria", label: "Peluquería", icon: "scissors" },
  { id: "consultoria", label: "Consultoría", icon: "tie" },
  { id: "otro", label: "Otro", icon: "plus" },
];
export function validCategories(value, multiple = true) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > ACCOUNT_CATEGORIES.length
  )
    return null;
  if (
    value.some(
      (id) =>
        typeof id !== "string" ||
        !ACCOUNT_CATEGORIES.some((category) => category.id === id),
    )
  )
    return null;
  const unique = [...new Set(value)];
  return (!multiple && unique.length !== 1) || unique.length !== value.length
    ? null
    : unique;
}
