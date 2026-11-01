export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_ERROR = "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.";
export function validNewPassword(value) {
  return typeof value === "string" && value.length >= PASSWORD_MIN_LENGTH && new TextEncoder().encode(value).length <= 72;
}
