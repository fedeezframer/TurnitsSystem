export const PROMO_DAYS: { id: number; short: string; label: string }[];
export function normalizePromoDays(days: unknown): number[] | null;
export function promoAppliesOn(promo: { fecha_inicio: string; fecha_fin: string; dias_semana?: number[] | null }, date: string): boolean;
export function promoHasMatchingDate(promo: { fecha_inicio: string; fecha_fin: string; dias_semana?: number[] | null }): boolean;
export function promoDaysLabel(days?: number[] | null): string;
