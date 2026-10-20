import { appConfig } from "../../config"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { prepareAppDestinationPreloader } from "../../components/BrandPreloader"
import { preloadSessionDestination } from "../../shared/session-routes"
import { clearStartupVerification, selectStoredSession, takeStartupVerification, type StoredSession, type SessionVerification } from "../../shared/session-startup"


const API_BASE = appConfig.apiUrl
const TOKEN_KEYS = [
    "access_token",
    "user_token",
    "token",
    "auth_token",
    "turnits_token",
]
const SLUG_KEYS = ["user_slug", "auth_slug", "slug"]

function guardarSesionCanonica(session: StoredSession, slug: string) {
    // El panel también prioriza access_token. Dejamos una sola copia vigente
    // para que una clave vieja no vuelva a seleccionar otro usuario/rol.
    for (const key of TOKEN_KEYS) {
        try {
            localStorage.removeItem(key)
        } catch {}
    }
    try {
        localStorage.setItem("access_token", session.token)
        localStorage.setItem("account_type", session.role === "consumidor" ? "usuario" : "negocio")
        if (session.role === "consumidor") {
            for (const key of [...SLUG_KEYS, "business_name", "just_registered"]) localStorage.removeItem(key)
            return
        }
        localStorage.setItem("user_slug", slug)
        localStorage.setItem("auth_slug", slug)
        localStorage.setItem("slug", slug)
    } catch {}
}

function limpiarSesion() {
    for (const key of [...TOKEN_KEYS, ...SLUG_KEYS, "account_type"]) {
        try {
            localStorage.removeItem(key)
        } catch {}
    }
}

export function useAppSessionRedirect() {
    const navigate = useNavigate()
    const verification = useRef<{ token: string; request: Promise<SessionVerification> } | null>(null)
    useEffect(() => {
        let cancelled = false
        const enter = (path: string) => {
            if (cancelled) return
            prepareAppDestinationPreloader(path)
            void navigate(path, { replace: true })
        }

        const checkSession = async () => {
            const session = selectStoredSession()

            if (!session) {
                clearStartupVerification()
                limpiarSesion()
                enter("/login")
                return
            }

            try {
                preloadSessionDestination(session.role)
                // Reuse only this mount's initial HTML request, including a
                // StrictMode effect replay. Later visits always validate again.
                if (verification.current?.token !== session.token) {
                    verification.current = { token: session.token, request: takeStartupVerification(session, API_BASE) }
                }
                const response = await verification.current.request
                const { data } = response
                if (cancelled) return
                if (selectStoredSession()?.token !== session.token) {
                    verification.current = null
                    void checkSession()
                    return
                }
                if (response.status >= 500) {
                    throw new Error(`La API respondió ${response.status}`)
                }
                if (!response.ok || data?.active !== true) {
                    limpiarSesion()
                    enter("/login")
                    return
                }

                // El servidor valida el tipo de cuenta antes de elegir el destino.
                if (data.rol === "consumidor") {
                    guardarSesionCanonica(session, "")
                    enter("/browse")
                    return
                }
                // El slug del servidor es la referencia canónica para negocios.
                const slug = String(data.slug || session.slug)
                    .trim()
                    .toLowerCase()
                if (!slug) {
                    limpiarSesion()
                    enter("/login")
                    return
                }

                guardarSesionCanonica(session, slug)
                enter(`/panel/${encodeURIComponent(slug)}`)
            } catch (error) {
                // Si la API está temporalmente fuera de línea pero el JWT aún
                // es válido, no borramos la sesión ni expulsamos al usuario.
                if (cancelled) return
                if (selectStoredSession()?.token !== session.token) {
                    verification.current = null
                    void checkSession()
                    return
                }
                console.warn(
                    "Turnits: no se pudo validar la sesión en línea:",
                    error
                )
                if (!cancelled) {
                    guardarSesionCanonica(session, session.slug)
                    if (session.role === "consumidor") enter("/browse")
                    else enter(`/panel/${encodeURIComponent(session.slug)}`)
                }
            }
        }

        void checkSession()
        return () => {
            cancelled = true
        }
    }, [navigate])

    return {}
}
