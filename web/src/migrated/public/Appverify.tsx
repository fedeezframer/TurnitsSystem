import { appConfig } from "../../config"
import { useEffect } from "react"


const API_BASE = appConfig.apiUrl
const TOKEN_KEYS = [
    "access_token",
    "user_token",
    "token",
    "auth_token",
    "turnits_token",
]
const SLUG_KEYS = ["user_slug", "auth_slug", "slug"]

type TokenSession = {
    token: string
    slug: string
    exp: number
    iat: number
    role: string
}

function decodeToken(token: string): TokenSession | null {
    try {
        const payload = token.split(".")[1]
        if (!payload) return null
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
        const binary = atob(padded)
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
        const claims = JSON.parse(new TextDecoder().decode(bytes))
        const slug = String(claims?.slug || "")
            .trim()
            .toLowerCase()
        if (!slug) return null
        return {
            token,
            slug,
            exp: Number(claims.exp || 0),
            iat: Number(claims.iat || 0),
            role: String(claims.rol || ""),
        }
    } catch {
        return null
    }
}

function sessionsGuardadas(): TokenSession[] {
    const values: TokenSession[] = []
    for (const key of TOKEN_KEYS) {
        try {
            const token = localStorage.getItem(key)
            if (!token) continue
            const parsed = decodeToken(token)
            if (parsed) values.push(parsed)
        } catch {}
    }
    // Si quedaron claves de sesiones anteriores, gana el JWT emitido más
    // recientemente, en vez de asumir que access_token siempre es el actual.
    return values.sort((a, b) => b.iat - a.iat)
}

function guardarSesionCanonica(session: TokenSession, slug: string) {
    // El panel también prioriza access_token. Dejamos una sola copia vigente
    // para que una clave vieja no vuelva a seleccionar otro usuario/rol.
    for (const key of TOKEN_KEYS) {
        try {
            localStorage.removeItem(key)
        } catch {}
    }
    try {
        localStorage.setItem("access_token", session.token)
        localStorage.setItem("user_slug", slug)
        localStorage.setItem("auth_slug", slug)
        localStorage.setItem("slug", slug)
    } catch {}
}

function limpiarSesion() {
    for (const key of [...TOKEN_KEYS, ...SLUG_KEYS]) {
        try {
            localStorage.removeItem(key)
        } catch {}
    }
}

function irAlPanel(slug: string) {
    // Esta ruta es la que reescribe el Worker a /panel?u=<slug>.
    window.location.replace(`/panel/${encodeURIComponent(slug)}`)
}

export function useAppSessionRedirect() {
    useEffect(() => {
        let cancelled = false

        const checkSession = async () => {
            const now = Math.floor(Date.now() / 1000)
            const session = sessionsGuardadas().find(
                (item) => !item.exp || item.exp > now
            )

            if (!session) {
                limpiarSesion()
                if (!cancelled) window.location.replace("/login")
                return
            }

            try {
                const controller = new AbortController()
                const timeout = window.setTimeout(
                    () => controller.abort(),
                    8000
                )
                let response: Response
                try {
                    response = await fetch(`${API_BASE}/verify-session`, {
                        method: "GET",
                        headers: { Authorization: `Bearer ${session.token}` },
                        cache: "no-store",
                        signal: controller.signal,
                    })
                } finally {
                    window.clearTimeout(timeout)
                }

                const data = await response.json().catch(() => null)
                if (response.status >= 500) {
                    throw new Error(`La API respondió ${response.status}`)
                }
                if (!response.ok || data?.active !== true) {
                    limpiarSesion()
                    if (!cancelled) window.location.replace("/login")
                    return
                }

                // El servidor valida la sesión; su slug es la referencia
                // canónica. No se usa un slug viejo de localStorage para rutear.
                const slug = String(data.slug || session.slug)
                    .trim()
                    .toLowerCase()
                if (!slug) {
                    limpiarSesion()
                    if (!cancelled) window.location.replace("/login")
                    return
                }

                guardarSesionCanonica(session, slug)
                if (!cancelled) irAlPanel(slug)
            } catch (error) {
                // Si la API está temporalmente fuera de línea pero el JWT aún
                // es válido, no borramos la sesión ni expulsamos al usuario.
                console.warn(
                    "Turnits: no se pudo validar la sesión en línea:",
                    error
                )
                if (!cancelled) {
                    guardarSesionCanonica(session, session.slug)
                    irAlPanel(session.slug)
                }
            }
        }

        void checkSession()
        return () => {
            cancelled = true
        }
    }, [])

    return {}
}
