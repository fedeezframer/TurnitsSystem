export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_ERROR = "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.";
export function validNewPassword(value) {
  return typeof value === "string" && value.length >= PASSWORD_MIN_LENGTH && new TextEncoder().encode(value).length <= 72;
}
export const REGISTRATION_PASSWORD_ERROR = "Usá al menos 8 caracteres, con una mayúscula, una minúscula, un número y un símbolo (máximo 72 bytes).";
export function validRegistrationPassword(value) {
  return validNewPassword(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9\s]/.test(value);
}
