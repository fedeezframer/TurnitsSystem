import { storedSessionToken } from "./consultation-session.js";

export function consumerHeaders(): Record<string, string> {
  try {
    const token = storedSessionToken();
    return token && localStorage.getItem("account_type") === "usuario"
      ? { Authorization: `Bearer ${token}` }
      : {};
  } catch {
    return {};
  }
}
