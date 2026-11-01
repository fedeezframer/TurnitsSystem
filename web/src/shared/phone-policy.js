// Argentina: https://www.argentina.gob.ar/pais/codigo-telefonia
// Lengths describe national numbers, excluding the selected country dial code.
export const PHONE_COUNTRIES = [
  { code: 'AR', dial: '+54', name: 'Argentina', lengths: [10, 11] },
  { code: 'UY', dial: '+598', name: 'Uruguay', lengths: [8] },
  { code: 'CL', dial: '+56', name: 'Chile', lengths: [9] },
  { code: 'PY', dial: '+595', name: 'Paraguay', lengths: [9] },
  { code: 'BO', dial: '+591', name: 'Bolivia', lengths: [8] },
  { code: 'BR', dial: '+55', name: 'Brasil', lengths: [10, 11] },
  { code: 'PE', dial: '+51', name: 'Perú', lengths: [8, 9] },
  { code: 'CO', dial: '+57', name: 'Colombia', lengths: [10] },
  { code: 'MX', dial: '+52', name: 'México', lengths: [10] },
  { code: 'US', dial: '+1', name: 'Estados Unidos', lengths: [10] },
  { code: 'ES', dial: '+34', name: 'España', lengths: [9] },
];
export const phoneCountry = code => PHONE_COUNTRIES.find(country => country.code === code);
export const phoneLimit = (code, value = '') => code === 'AR' ? (value.startsWith('9') ? 11 : 10) : Math.max(...(phoneCountry(code)?.lengths || [15]));
export function validNationalPhone(value, code) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return false;
  const country = phoneCountry(code);
  if (!country) return /^[1-9]\d{6,14}$/.test(value);
  if (!country.lengths.includes(value.length)) return false;
  // Geographic area codes begin with 11, 2 or 3; do not accept trunk 0 or 15.
  return code !== 'AR' || /^9?(?:11|[23]\d)\d{8}$/.test(value);
}
export function validInternationalPhone(value) {
  if (typeof value !== 'string' || !/^\+?[1-9]\d{6,14}$/.test(value)) return false;
  const digits = value.replace(/^\+/, '');
  const country = [...PHONE_COUNTRIES].sort((a,b) => b.dial.length-a.dial.length)
    .find(country => digits.startsWith(country.dial.slice(1)));
  if (!country) return true; // Other countries retain the E.164 maximum.
  let national = digits.slice(country.dial.length-1);
  if (country.code === 'AR' && national.length === 11 && national.startsWith('9')) national = national.slice(1);
  return validNationalPhone(national, country.code);
}
export function parsePhoneInput(value, code) {
  let country = phoneCountry(code), digits = String(value).replace(/\D/g, '');
  if (/^\s*(\+|00)/.test(value)) {
    if (/^\s*00/.test(value)) digits = digits.slice(2);
    const detected = [...PHONE_COUNTRIES].sort((a,b) => b.dial.length-a.dial.length)
      .find(item => digits.startsWith(item.dial.slice(1)));
    if (detected) { country = detected; digits = digits.slice(country.dial.length-1); }
  }
  return { code: country?.code || code, digits, tooLong: digits.length > phoneLimit(country?.code || code, digits) };
}
export function phoneHint(code) {
  return code === 'AR' ? 'Código de área y número, sin 0 ni 15. Ej.: 3515551234.' : 'Ingresá el número con código de área, sin repetir el prefijo del país.';
}
