export type PhoneCountry = { code: string; dial: string; name: string; lengths: number[] };
export const PHONE_COUNTRIES: PhoneCountry[];
export function phoneCountry(code: string): PhoneCountry | undefined;
export function phoneLimit(code: string, value?: string): number;
export function validNationalPhone(value: unknown, code: string): boolean;
export function validInternationalPhone(value: unknown): boolean;
export function parsePhoneInput(value: string, code: string): { code: string; digits: string; tooLong: boolean };
export function phoneHint(code: string): string;
