export type StoredSession = {
  token: string;
  slug: string;
  exp: number;
  iat: number;
  role: string;
};

export type SessionVerification = {
  ok: boolean;
  status: number;
  data: { active?: boolean; rol?: string; slug?: string } | null;
};

// Self-contained: the HTML bootstrap uses the same selection and validation
// code as React, before the application modules finish downloading.
export function selectStoredSession(): StoredSession | null {
  const sessions: StoredSession[] = [];
  for (const key of ["access_token", "user_token", "token", "auth_token", "turnits_token"]) {
    try {
      const token = localStorage.getItem(key);
      if (!token) continue;
      const payload = token.split(".")[1];
      if (!payload) continue;
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
      const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
      const claims = JSON.parse(new TextDecoder().decode(bytes));
      const slug = String(claims?.slug || "").trim().toLowerCase();
      if (!slug && !(claims.rol === "consumidor" && claims.consumidorId)) continue;
      sessions.push({ token, slug, exp: Number(claims.exp || 0), iat: Number(claims.iat || 0), role: String(claims.rol || "") });
    } catch {}
  }
  const now = Math.floor(Date.now() / 1000);
  return sessions.sort((a, b) => b.iat - a.iat).find(session => !session.exp || session.exp > now) || null;
}

export async function verifyStoredSession(apiUrl: string, token: string): Promise<SessionVerification> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${apiUrl}/verify-session`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

type StartupVerification = {
  token: string;
  role: string;
  apiUrl: string;
  request: Promise<SessionVerification>;
};
type StartupWindow = Window & { __turnitsSessionStartup?: StartupVerification };

export function clearStartupVerification() {
  delete (window as StartupWindow).__turnitsSessionStartup;
}

export function takeStartupVerification(session: StoredSession, apiUrl: string) {
  const target = window as StartupWindow;
  const startup = target.__turnitsSessionStartup;
  clearStartupVerification();
  // A login/logout in another tab or a different API must never reuse the
  // initial request. Nothing is persisted or reused on later /app visits.
  return startup?.token === session.token && startup.apiUrl === apiUrl
    ? startup.request
    : verifyStoredSession(apiUrl, session.token);
}

export function sessionStartupHtml(apiUrl: string) {
  const api = JSON.stringify(apiUrl).replace(/</g, "\\u003c");
  return `<script>(()=>{if(!/^\\/app\\/?$/i.test(location.pathname))return;const select=${selectStoredSession.toString()};const verify=${verifyStoredSession.toString()};const session=select();if(!session)return;const apiUrl=${api};const request=verify(apiUrl,session.token);void request.catch(()=>{});window.__turnitsSessionStartup={token:session.token,role:session.role,apiUrl,request};})()</script>`;
}

export function sessionPreloadHtml(assets: { panel: string[]; browse: string[] }) {
  const files = JSON.stringify(assets).replace(/</g, "\\u003c");
  // modulepreload downloads and prepares public code without mounting a route
  // or accessing account data. React later imports these exact fingerprinted URLs.
  return `<script>(()=>{const startup=window.__turnitsSessionStartup;if(!startup)return;const assets=${files};const files=startup.role==="consumidor"?assets.browse:assets.panel;const loaded=new Set([...document.querySelectorAll('link[rel="modulepreload"]')].map(link=>link.href));for(const file of files){if(loaded.has(new URL(file,location.href).href))continue;const link=document.createElement("link");link.rel="modulepreload";link.crossOrigin="";link.fetchPriority="low";link.href=file;document.head.appendChild(link);}})()</script>`;
}
