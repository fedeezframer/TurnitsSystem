const TOKEN_KEYS = ["access_token", "user_token", "token", "auth_token", "turnits_token"];

export function storedSessionToken(storage = globalThis.localStorage) {
  try {
    return TOKEN_KEYS.map(key => storage.getItem(key)).find(Boolean) || "";
  } catch {
    return "";
  }
}

export function isBusinessSession(storage = globalThis.localStorage) {
  try {
    const accountType = storage.getItem("account_type");
    return accountType === "negocio" || (!accountType && Boolean(storage.getItem("user_slug")));
  } catch {
    return false;
  }
}

export function safeMessagesReturn(value, origin) {
  if (typeof value !== "string" || !value || typeof origin !== "string" || !origin) return "";
  try {
    const base = new URL(origin);
    const destination = new URL(value, base);
    const legacyChat = destination.pathname === "/consultas";
    const browseMessages = destination.pathname === "/browse" && destination.searchParams.get("vista") === "mensajes";
    if (destination.origin !== base.origin || (!legacyChat && !browseMessages)) return "";
    return `${destination.pathname}${destination.search}`;
  } catch {
    return "";
  }
}
