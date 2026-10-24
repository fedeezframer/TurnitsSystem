const KEY_PREFIX = "turnits_guest_consultation:";
const TOKEN_PREFIX = "turnits_guest_";

export function saveGuestConsultationSession(id, token, expiresAt) {
  if (!id || typeof token !== "string" || !token.startsWith(TOKEN_PREFIX)) return;
  try {
    sessionStorage.setItem(`${KEY_PREFIX}${id}`, JSON.stringify({ token, expiresAt }));
  } catch {}
}

export function readGuestConsultationSession(id) {
  if (!id) return null;
  try {
    const key = `${KEY_PREFIX}${id}`;
    const saved = sessionStorage.getItem(key);
    if (!saved) return null;
    const session = JSON.parse(saved);
    if (
      typeof session?.token !== "string" ||
      !session.token.startsWith(TOKEN_PREFIX) ||
      !Number.isFinite(Date.parse(session.expiresAt)) ||
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      sessionStorage.removeItem(key);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearGuestConsultationSession(id) {
  if (!id) return;
  try { sessionStorage.removeItem(`${KEY_PREFIX}${id}`); } catch {}
}
