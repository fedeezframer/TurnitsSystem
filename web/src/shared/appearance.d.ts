export type CardShape = "original" | "rectas" | "suaves" | "redondeadas";
export type IconShape = "original" | "cuadrado" | "redondeado" | "circular";
export type BusinessAppearance = {
  forma_tarjetas?: CardShape;
  forma_icono?: IconShape;
};
export const CARD_SHAPES: {
  value: CardShape;
  label: string;
  radius: string | null;
}[];
export const ICON_SHAPES: {
  value: IconShape;
  label: string;
  radius: string | null;
}[];
export const DEFAULT_APPEARANCE: Required<BusinessAppearance>;
export function cardRadius(shape?: string, fallback?: string): string;
export function iconRadius(shape?: string, fallback?: string): string;
export function appearanceChanges(
  raw: Record<string, unknown>,
): BusinessAppearance;
