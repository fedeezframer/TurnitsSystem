import { appConfig } from "../config"
import * as React from "react"
import { Link } from "react-router"


type Props = {
    apiUrl?: string
    registerUrl?: string
    logoUrl?: string
    accentColor?: string
    style?: React.CSSProperties
}
const GOOGLE_CLIENT_ID =
    "506021794027-nvit4q70o2t0a97024f5cfdcdh70crn0.apps.googleusercontent.com"
type GoogleIdentity = {
    initialize: (options: {
        client_id: string
        nonce: string
        callback: (response: { credential?: string }) => void
        auto_select: boolean
    }) => void
    renderButton: (
        element: HTMLElement,
        options: Record<string, unknown>
    ) => void
}
function googleIdentity(): GoogleIdentity | undefined {
    return (
        window as unknown as { google?: { accounts?: { id?: GoogleIdentity } } }
    ).google?.accounts?.id
}
let googleScriptPromise: Promise<void> | null = null
function loadGoogleScript(): Promise<void> {
    if (googleIdentity()) return Promise.resolve()
    if (googleScriptPromise) return googleScriptPromise
    googleScriptPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
            'script[src="https://accounts.google.com/gsi/client"]'
        )
        const script = existing || document.createElement("script")
        const timer = window.setTimeout(
            () => finish(new Error("Google tardó demasiado en cargar.")),
            20000
        )
        const finish = (error?: Error) => {
            window.clearTimeout(timer)
            script.removeEventListener("load", loaded)
            script.removeEventListener("error", failed)
            if (error) {
                googleScriptPromise = null
                if (!existing) script.remove()
                reject(error)
            } else resolve()
        }
        const loaded = () =>
            googleIdentity()
                ? finish()
                : finish(new Error("Google no está disponible."))
        const failed = () =>
            finish(new Error("No pudimos cargar Google. Revisá tu conexión."))
        script.addEventListener("load", loaded)
        script.addEventListener("error", failed)
        if (!existing) {
            script.src = "https://accounts.google.com/gsi/client"
            script.async = true
            script.defer = true
            document.head.appendChild(script)
        }
    })
    return googleScriptPromise
}
const keys = [
    "access_token",
    "auth_token",
    "turnits_token",
    "user_token",
    "token",
    "user_slug",
    "auth_slug",
    "slug",
    "business_name",
    "user_email",
    "account_type",
    "just_registered",
]
const clearSession = () => keys.forEach((key) => localStorage.removeItem(key))
// Datos ficticios; reproduce las tarjetas compactas de AgendaPanel_CalendarTurno.
const demoTurnos = [
    {
        hora: "09:00",
        nombre: "Lucía Fernández",
        servicio: "Corte y peinado",
        left: "12%",
        top: "23%",
        delay: "-1s",
        color: "var(--accent)",
    },
    {
        hora: "10:30",
        nombre: "Martín Pérez",
        servicio: "Corte clásico",
        left: "53%",
        top: "39%",
        delay: "-5s",
        color: "#F59E0B",
    },
    {
        hora: "12:00",
        nombre: "Sofía García",
        servicio: "Color y tratamiento",
        left: "20%",
        top: "61%",
        delay: "-9s",
        color: "var(--accent)",
    },
    {
        hora: "15:00",
        nombre: "Valentina López",
        servicio: "Manicuría",
        left: "57%",
        top: "72%",
        delay: "-13s",
        color: "#3B82F6",
    },
]
const css = `
.tt-login-v2,.tt-login-v2 *{box-sizing:border-box}
.tt-login-v2{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;overflow:hidden;background:white;color:#191b19;display:block;font-family:Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased;isolation:isolate}
.tt-login-v2-side{position:absolute;inset:0 auto 0 0;width:50%;height:100%;display:flex;align-items:center;justify-content:center;min-width:0;min-height:0;padding:32px;padding-top:max(24px,env(safe-area-inset-top));padding-bottom:max(24px,env(safe-area-inset-bottom))}
.tt-login-v2 form{width:100%;max-width:340px;margin:0}
.tt-login-v2-brand{display:flex;justify-content:center;margin-bottom:20px;color:inherit;text-decoration:none}.tt-login-v2-brand img{width:66px;height:54px;object-fit:contain}
.tt-login-v2 h1{font-size:28px;font-weight:500;letter-spacing:-1px;line-height:1.2;text-align:center;margin:0}
.tt-login-v2-intro{font-size:13px;line-height:1.5;text-align:center;color:#787e78;margin:10px 0 25px}
.tt-login-v2-divider{height:1px;background:#eaede9;margin-bottom:24px}
.tt-login-v2-field{display:block;margin-bottom:20px}.tt-login-v2-label{display:block;font-size:12px;font-weight:500;margin-bottom:8px}
.tt-login-v2-wrap{position:relative}.tt-login-v2 input{width:100%;height:46px;border:1px solid #d9ddd8;border-radius:24px;padding:0 17px;outline:none;font:inherit;font-size:16px;background:white;color:#191b19;transition:border-color .18s,box-shadow .18s}
.tt-login-v2 input::placeholder{color:#a0a59f;font-size:13px}.tt-login-v2 input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}.tt-login-v2 input[aria-invalid=true]{border-color:#d74747;background:#fffafa}.tt-login-v2 input[aria-invalid=true]:focus{border-color:#d74747;box-shadow:0 0 0 3px #d7474715}
.tt-login-v2 input[name=password]{padding-right:54px}.tt-login-v2 button{font:inherit;cursor:pointer}.tt-login-v2 button,.tt-login-v2 a{-webkit-tap-highlight-color:transparent}
.tt-login-v2-eye{position:absolute;right:5px;top:3px;height:40px;width:42px;display:grid;place-items:center;border:0;border-radius:50%;background:none;color:#7b817b}.tt-login-v2-eye svg{width:19px;height:19px}
.tt-login-v2-forgot{display:inline-block;padding:0;border:0;background:none;font-size:12px!important;color:var(--accent);margin:-9px 0 22px}
.tt-login-v2-actions{display:flex;gap:10px}.tt-login-v2-primary,.tt-login-v2-secondary{height:44px;border-radius:5px;display:flex;align-items:center;justify-content:center;gap:16px;text-decoration:none;font-size:13px!important;transition:background .18s,transform .12s}
.tt-login-v2-primary{flex:1;border:1px solid #151715;background:#151715;color:white;padding:0 18px}.tt-login-v2-primary:hover{background:#303630}.tt-login-v2-primary:active{transform:scale(.98)}.tt-login-v2-primary:disabled{opacity:.65;cursor:wait}
.tt-login-v2-secondary{border:1px solid #9ba19b;color:#242924;padding:0 16px;background:white}.tt-login-v2-secondary:hover{background:#f5f7f4}
/* Círculo absoluto bajo el contenido, recortado al marco de cada botón. */
.tt-login-v2-primary,.tt-login-v2-secondary{position:relative;isolation:isolate;overflow:hidden;z-index:0}
.tt-login-v2-primary::before,.tt-login-v2-secondary::before{content:"";position:absolute;left:50%;top:100%;width:280px;height:280px;border-radius:50%;pointer-events:none;z-index:-1;opacity:0;transform:translate(-50%,-50%) scale(0);transition:transform .48s cubic-bezier(.22,1,.36,1),opacity .2s ease-out;background:var(--accent)}
.tt-login-v2-secondary::before{background:color-mix(in srgb,var(--accent) 12%,white)}
@media(hover:hover) and (pointer:fine){.tt-login-v2-primary:not(:disabled):hover::before,.tt-login-v2-secondary:not(:disabled):hover::before{opacity:1;transform:translate(-50%,-50%) scale(1)}}
.tt-login-v2-primary:not(:disabled):focus-visible::before,.tt-login-v2-secondary:not(:disabled):focus-visible::before{opacity:1;transform:translate(-50%,-50%) scale(1)}
.tt-login-v2 button:focus-visible,.tt-login-v2 a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
.tt-login-v2-message{margin:0 0 16px;font-size:12px;line-height:1.5;color:#aa3030}.tt-login-v2-message[data-success=true]{color:var(--accent)}
.tt-login-v2-art{position:absolute;inset:0 0 0 auto;width:50%;height:100%;overflow:hidden;pointer-events:none;color:var(--accent);contain:layout paint}.tt-login-v2-lines{position:absolute;width:110%;height:85%;top:8%;left:-5%;display:block}
.tt-login-v2-turnos{position:absolute;inset:0;pointer-events:none}
.tt-login-v2-turno-float{position:absolute;width:clamp(145px,15vw,190px);animation:tt-turno-appear 16s ease-in-out infinite;will-change:transform,opacity}
.tt-login-v2-turno{min-width:0;padding:7px 8px;border-radius:9px;background:color-mix(in srgb,var(--turno-color) 7%,white);border:1px solid color-mix(in srgb,var(--turno-color) 19%,transparent);box-shadow:0 8px 28px #18352209}
.tt-login-v2-turno-time{font-family:Space Grotesk,Inter Display,-apple-system,sans-serif;display:flex;align-items:center;gap:5px;min-width:0;font-size:11px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;color:#12131A}
.tt-login-v2-turno-dot{width:5px;height:5px;border-radius:50%;background:var(--turno-color);flex-shrink:0}
.tt-login-v2-turno-name{font-family:Inter Display,-apple-system,sans-serif;margin-top:2px;font-size:11px;font-weight:700;color:#12131A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt-login-v2-turno-service{font-family:Inter Display,-apple-system,sans-serif;margin-top:2px;font-size:9px;color:#1B6B1A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@keyframes tt-turno-appear{0%,100%{opacity:0;transform:translateY(20px) scale(.96)}12%,75%{opacity:1}38%{transform:translateY(-7px) scale(1)}75%{transform:translateY(-15px) scale(1)}90%{opacity:0;transform:translateY(-30px) scale(.98)}}
@media(max-width:700px){.tt-login-v2-turnos{display:none}}
@media(prefers-reduced-motion:reduce){.tt-login-v2-turno-float{animation:none;opacity:1;will-change:auto}}
.tt-login-v2-google-area{margin-top:18px;min-height:40px}
.tt-login-v2-google-divider{display:flex;align-items:center;gap:12px;color:#929892;font-size:12px;margin-bottom:16px}
.tt-login-v2-google-divider::before,.tt-login-v2-google-divider::after{content:"";height:1px;flex:1;background:#eaede9}
.tt-login-v2-google-host{width:100%;min-height:40px;display:flex;justify-content:center}
.tt-login-v2-google-status{font-size:11px;line-height:1.4;text-align:center;color:#747b74;margin:8px 0}
.tt-login-v2-google-retry{display:block;margin:8px auto 0;padding:4px;border:0;background:none;color:var(--accent);font-size:12px!important;text-decoration:underline}
@media(max-height:650px){.tt-login-v2-intro{display:none}.tt-login-v2-brand{margin-bottom:10px}.tt-login-v2-google-area{margin-top:10px}.tt-login-v2-google-divider{margin-bottom:10px}.tt-login-v2-divider{margin-top:14px;margin-bottom:14px}}
@media(max-height:500px){.tt-login-v2-brand{display:none}}
.tt-login-v2-spinner{width:15px;height:15px;border:1.5px solid #ffffff55;border-top-color:white;border-radius:50%;animation:tt-spin .7s linear infinite}@keyframes tt-spin{to{transform:rotate(360deg)}}
@media(max-width:700px){.tt-login-v2-side{width:100%}.tt-login-v2-side{padding-left:28px;padding-right:28px;z-index:1}.tt-login-v2-art{inset:0;width:100%;opacity:.25;pointer-events:none}.tt-login-v2-lines{width:150%;left:20%}.tt-login-v2 form{max-width:350px;background:#ffffffed;border-radius:16px;padding:22px 12px}}
@media(max-height:590px){.tt-login-v2-side{padding-top:12px;padding-bottom:12px}.tt-login-v2-brand{margin-bottom:10px}.tt-login-v2-brand svg,.tt-login-v2-brand img{height:36px}.tt-login-v2 h1{font-size:23px}.tt-login-v2-intro{margin:7px 0 12px}.tt-login-v2-divider{margin-bottom:14px}.tt-login-v2-field{margin-bottom:13px}.tt-login-v2-forgot{margin-bottom:15px}.tt-login-v2 form{padding-top:0;padding-bottom:0}}
@media(max-height:430px){.tt-login-v2-brand,.tt-login-v2-intro,.tt-login-v2-divider{display:none}.tt-login-v2 h1{margin-bottom:12px;font-size:21px}.tt-login-v2 input{height:40px}.tt-login-v2-eye{height:34px}.tt-login-v2-field{margin-bottom:10px}.tt-login-v2-message{margin-bottom:8px}.tt-login-v2-primary,.tt-login-v2-secondary{height:39px}}
@media(prefers-reduced-motion:reduce){.tt-login-v2 *{transition:none!important}.tt-login-v2-turno-float{animation:none;opacity:1;will-change:auto}.tt-login-v2-spinner{animation:none}}
`

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function LoginApp(props: Props) {
    const {
        apiUrl = appConfig.apiUrl,
        registerUrl = "/registro",
        logoUrl,
        accentColor = "#398252",
    } = props
    const canvas = false
    const id = React.useId()
    const [email, setEmail] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [visible, setVisible] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [recover, setRecover] = React.useState(false)
    const [message, setMessage] = React.useState("")
    const [success, setSuccess] = React.useState(false)
    const [fieldErrors, setFieldErrors] = React.useState({ email: false, password: false })
    function markInvalidFields(errors: { email: boolean; password: boolean }) {
        setFieldErrors(errors)
        const fields: HTMLElement[] = []
        const emailField = document.getElementById(`${id}-email`)
        const passwordField = document.getElementById(`${id}-password`)
        if (errors.email && emailField) fields.push(emailField)
        if (errors.password && passwordField) fields.push(passwordField)
        if (fields.length) fields[0].focus()
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
        fields.forEach((field) => {
            if (typeof field.animate !== "function") return
            field.getAnimations().forEach((animation) => animation.cancel())
            field.animate([
                { transform: "translateX(0)" },
                { transform: "translateX(-4px)" },
                { transform: "translateX(4px)" },
                { transform: "translateX(-3px)" },
                { transform: "translateX(3px)" },
                { transform: "translateX(0)" },
            ], { duration: 320, easing: "ease-in-out" })
        })
    }
    const [viewport, setViewport] = React.useState<{
        height: number
        top: number
    } | null>(null)
    const busy = React.useRef(false)
    const request = React.useRef<AbortController | null>(null)
    const googleHost = React.useRef<HTMLDivElement | null>(null)
    const googleCallback = React.useRef<
        (credential: string, nonce: string) => void
    >(() => {})
    const [googleReady, setGoogleReady] = React.useState(false)
    const [googleError, setGoogleError] = React.useState("")
    const [googleAttempt, setGoogleAttempt] = React.useState(0)
    React.useEffect(() => {
        if (canvas || recover) return
        let active = true
        const controller = new AbortController()
        const setupTimeout = window.setTimeout(() => controller.abort(), 25000)
        let resize: ResizeObserver | null = null
        setGoogleReady(false)
        setGoogleError("")
        async function setup() {
            try {
                const response = await fetch(
                    `${apiUrl.replace(/\/+$/, "")}/auth/google/challenge`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: "{}",
                        signal: controller.signal,
                        cache: "no-store",
                    }
                )
                const result = await response.json().catch(() => null)
                if (!response.ok || !result?.success || !result.nonce)
                    throw new Error(
                        result?.error ||
                            "El acceso con Google todavía no está disponible."
                    )
                await loadGoogleScript()
                if (!active || !googleHost.current) return
                const identity = googleIdentity()
                if (!identity) throw new Error("Google no está disponible.")
                identity.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    nonce: result.nonce,
                    auto_select: false,
                    callback: (value) => {
                        if (active && value.credential)
                            googleCallback.current(
                                value.credential as string,
                                result.nonce
                            )
                    },
                })
                const render = () => {
                    if (!active || !googleHost.current) return
                    googleHost.current.innerHTML = ""
                    identity.renderButton(googleHost.current, {
                        type: "standard",
                        theme: "outline",
                        size: "large",
                        text: "continue_with",
                        shape: "rectangular",
                        locale: "es",
                        width: Math.min(
                            340,
                            Math.floor(googleHost.current.clientWidth)
                        ),
                    })
                }
                render()
                resize = new ResizeObserver(render)
                resize.observe(googleHost.current)
                setGoogleReady(true)
            } catch (error) {
                if (active)
                    setGoogleError(
                        controller.signal.aborted
                            ? "La conexión tardó demasiado. Reintentá Google."
                            : error instanceof Error
                              ? error.message
                              : "No pudimos cargar Google."
                    )
            } finally {
                window.clearTimeout(setupTimeout)
            }
        }
        void setup()
        return () => {
            active = false
            window.clearTimeout(setupTimeout)
            controller.abort()
            resize?.disconnect()
        }
    }, [canvas, recover, apiUrl, googleAttempt])
    React.useEffect(() => {
        if (canvas) return
        const oldBody = document.body.style.overflow
        const oldHtml = document.documentElement.style.overflow
        document.body.style.overflow = "hidden"
        document.documentElement.style.overflow = "hidden"
        const vv = window.visualViewport
        const update = () =>
            setViewport({
                height: vv?.height ?? window.innerHeight,
                top: vv?.offsetTop ?? 0,
            })
        update()
        vv?.addEventListener("resize", update)
        vv?.addEventListener("scroll", update)
        window.addEventListener("resize", update)
        try {
            localStorage.removeItem("input_login_password")
        } catch {}
        return () => {
            document.body.style.overflow = oldBody
            document.documentElement.style.overflow = oldHtml
            vv?.removeEventListener("resize", update)
            vv?.removeEventListener("scroll", update)
            window.removeEventListener("resize", update)
            request.current?.abort()
        }
    }, [canvas])
    function changeMode(next: boolean) {
        setFieldErrors({ email: false, password: false })
        setRecover(next)
        setMessage("")
        setSuccess(false)
        setPassword("")
    }
    function finishLogin(result: any) {
        const consumer = result.rol === "consumidor" && result.tipo_cuenta === "usuario"
        const slug = String(result.slug || "")
            .trim()
            .toLowerCase()
        if (
            typeof result.token !== "string" ||
            !result.token ||
            (!result.es_admin && !consumer && !slug)
        )
            throw new Error(
                "La respuesta del servicio está incompleta. Volvé a intentar."
            )
        try {
            clearSession()
            localStorage.setItem("access_token", result.token)
            localStorage.setItem("user_email", result.email || email.trim())
            localStorage.setItem("account_type", consumer ? "usuario" : "negocio")
            localStorage.removeItem("input_login_email")
            localStorage.removeItem("input_login_password")
            if (!result.es_admin && !consumer) {
                localStorage.setItem("user_slug", slug)
                localStorage.setItem("auth_slug", slug)
                if (
                    typeof result.business_name === "string" &&
                    result.business_name.trim()
                )
                    localStorage.setItem(
                        "business_name",
                        result.business_name.trim()
                    )
            }
        } catch {
            try {
                clearSession()
            } catch {}
            throw new Error(
                "Habilitá el almacenamiento del navegador para iniciar sesión."
            )
        }
        setPassword("")
        window.location.replace(
            `${window.location.origin}${result.es_admin ? "/internal" : consumer ? "/browse" : `/panel/${encodeURIComponent(slug)}`}`
        )
    }
    async function authenticateGoogle(credential: string, nonce: string) {
        if (busy.current) return
        busy.current = true
        setLoading(true)
        setMessage("")
        setSuccess(false)
        const controller = new AbortController()
        request.current = controller
        const timeout = window.setTimeout(() => controller.abort(), 60000)
        try {
            const response = await fetch(
                `${apiUrl.replace(/\/+$/, "")}/auth/google`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ credential, nonce }),
                    signal: controller.signal,
                    cache: "no-store",
                }
            )
            const result = await response.json().catch(() => null)
            if (result?.code === "google_registration_required") {
                window.location.assign(registerUrl)
                return
            }
            if (!response.ok || !result?.success)
                throw new Error(
                    result?.error || "No pudimos iniciar sesión con Google."
                )
            finishLogin(result)
        } catch (error) {
            setMessage(
                controller.signal.aborted
                    ? "La conexión tardó demasiado. Volvé a intentar."
                    : error instanceof Error
                      ? error.message
                      : "No pudimos conectar con Google."
            )
            setGoogleAttempt((value) => value + 1)
        } finally {
            window.clearTimeout(timeout)
            request.current = null
            busy.current = false
            setLoading(false)
        }
    }
    googleCallback.current = (credential, nonce) => {
        void authenticateGoogle(credential, nonce)
    }
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy.current) return
        setSuccess(false)
        setMessage("")
        const errors = {
            email: !email.trim() || !/^[^\s@]+@[^\s@]+$/.test(email.trim()),
            password: !recover && !password,
        }
        if (errors.email || errors.password) {
            markInvalidFields(errors)
            return
        }
        setFieldErrors({ email: false, password: false })
        if (canvas) {
            setMessage(
                "Probá el acceso desde la vista previa o el sitio publicado."
            )
            return
        }
        busy.current = true
        setLoading(true)
        const controller = new AbortController()
        request.current = controller
        const timeout = window.setTimeout(() => controller.abort(), 60000)
        try {
            const response = await fetch(
                `${apiUrl.replace(/\/+$/, "")}${recover ? "/auth/forgot-password" : "/login"}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    cache: "no-store",
                    signal: controller.signal,
                    body: JSON.stringify(
                        recover
                            ? { email: email.trim() }
                            : { email: email.trim(), password }
                    ),
                }
            )
            const result = await response.json().catch(() => null)
            if (!response.ok || !result?.success) {
                const fallback =
                    response.status === 429
                        ? "Demasiados intentos. Esperá unos minutos y volvé a probar."
                        : response.status >= 500
                          ? "El servicio no está disponible. Probá de nuevo en un momento."
                          : "El correo o la contraseña son incorrectos."
                if (response.status === 401 && !recover) {
                    markInvalidFields({ email: true, password: true })
                    return
                }
                if (response.status === 400 && recover) {
                    markInvalidFields({ email: true, password: false })
                    return
                }
                throw new Error(
                    response.status >= 500
                        ? fallback
                        : result?.error || fallback
                )
            }
            if (recover) {
                setSuccess(true)
                setMessage(
                    "Si ese correo tiene una cuenta, recibirás un enlace para cambiar tu contraseña."
                )
                return
            }
            finishLogin(result)
        } catch (error) {
            setMessage(
                controller.signal.aborted
                    ? "La conexión tardó demasiado. Volvé a intentar."
                    : error instanceof TypeError
                      ? "No pudimos conectar. Revisá tu conexión y volvé a intentar."
                      : error instanceof Error
                        ? error.message
                        : "No pudimos iniciar sesión. Volvé a intentar."
            )
        } finally {
            window.clearTimeout(timeout)
            request.current = null
            busy.current = false
            setLoading(false)
        }
    }
    const rootStyle: React.CSSProperties = canvas
        ? {
              ...props.style,
              position: "relative",
              width: "100%",
              height: "100%",
              display: "block",
              overflow: "hidden",
          }
        : {
              position: "fixed",
              left: 0,
              right: 0,
              top: viewport ? viewport.top : 0,
              bottom: "auto",
              width: "100%",
              height: viewport ? viewport.height : "100dvh",
              display: "block",
              overflow: "hidden",
          }
    const themedStyle = Object.assign({}, rootStyle, {
        "--accent": accentColor,
    })
    return (
        <main className="tt-login-v2" style={themedStyle}>
            <style style={{ display: "none" }}>{css}</style>
            <section
                className="tt-login-v2-side"
                aria-labelledby={`${id}-title`}
            >
                <form noValidate onSubmit={submit} aria-busy={loading}>
                    <Link to="/" className="tt-login-v2-brand" aria-label="Turnits, ir al inicio">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Turnits" />
                        ) : (
                            <svg
                                width="66"
                                height="54"
                                viewBox="0 0 80 64"
                                fill="none"
                                aria-hidden="true"
                            >
                                <circle
                                    cx="40"
                                    cy="29"
                                    r="20"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                />
                                <path
                                    d="M26 28l10 7 13-14"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M21 31C-1 49 17 58 47 43S80 14 60 19"
                                    stroke="currentColor"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                />
                            </svg>
                        )}
                    </Link>
                    <h1 id={`${id}-title`}>
                        {recover ? "Recuperá tu acceso" : "Iniciar sesión"}
                    </h1>
                    <p className="tt-login-v2-intro">
                        {recover
                            ? "Te enviamos un enlace para cambiar tu contraseña."
                            : "Tu agenda, tu equipo y tu negocio en un lugar."}
                    </p>
                    <div className="tt-login-v2-divider" />
                    <label
                        className="tt-login-v2-field"
                        htmlFor={`${id}-email`}
                    >
                        <span className="tt-login-v2-label">
                            Correo electrónico
                        </span>
                        <input
                            id={`${id}-email`}
                            name="email"
                            type="email"
                            autoComplete="username"
                            inputMode="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="Ingresá tu email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                setFieldErrors((previous) => ({ ...previous, email: false }))
                                setMessage("")
                                setSuccess(false)
                            }}
                            required
                            disabled={loading}
                            aria-invalid={fieldErrors.email}
                            aria-describedby={
                                message ? `${id}-message` : undefined
                            }
                        />
                    </label>
                    {!recover && (
                        <>
                            <label
                                className="tt-login-v2-field"
                                htmlFor={`${id}-password`}
                            >
                                <span className="tt-login-v2-label">
                                    Contraseña
                                </span>
                                <div className="tt-login-v2-wrap">
                                    <input
                                        id={`${id}-password`}
                                        name="password"
                                        type={visible ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="Ingresá tu contraseña"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value)
                                            setFieldErrors((previous) => ({ ...previous, password: false }))
                                            setMessage("")
                                        }}
                                        required
                                        disabled={loading}
                                        aria-invalid={fieldErrors.password}
                                        aria-describedby={
                                            message
                                                ? `${id}-message`
                                                : undefined
                                        }
                                    />
                                    <button
                                        className="tt-login-v2-eye"
                                        type="button"
                                        onClick={() => setVisible(!visible)}
                                        aria-label={
                                            visible
                                                ? "Ocultar contraseña"
                                                : "Mostrar contraseña"
                                        }
                                        aria-pressed={visible}
                                        disabled={loading}
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.6"
                                        >
                                            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                                            <circle cx="12" cy="12" r="3" />
                                            {visible && <path d="m3 3 18 18" />}
                                        </svg>
                                    </button>
                                </div>
                            </label>
                            <button
                                className="tt-login-v2-forgot"
                                type="button"
                                onClick={() => changeMode(true)}
                                disabled={loading}
                            >
                                Olvidé mi contraseña
                            </button>
                        </>
                    )}
                    {message && (
                        <p
                            className="tt-login-v2-message"
                            id={`${id}-message`}
                            role={success ? "status" : "alert"}
                            data-success={success}
                        >
                            {message}
                        </p>
                    )}
                    <div className="tt-login-v2-actions">
                        <button
                            className="tt-login-v2-primary"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span
                                        className="tt-login-v2-spinner"
                                        aria-hidden="true"
                                    />
                                    {recover ? "Enviando…" : "Ingresando…"}
                                </>
                            ) : (
                                <>
                                    {recover
                                        ? "Enviar enlace"
                                        : "Iniciar sesión"}
                                </>
                            )}
                        </button>
                        {recover ? (
                            <button
                                className="tt-login-v2-secondary"
                                type="button"
                                disabled={loading}
                                onClick={() => changeMode(false)}
                            >
                                Volver
                            </button>
                        ) : (
                            <a
                                className="tt-login-v2-secondary"
                                href={registerUrl}
                                onClick={(e) => {
                                    if (loading) e.preventDefault()
                                }}
                            >
                                Registrarme
                            </a>
                        )}
                    </div>
                    {!recover && (
                        <div className="tt-login-v2-google-area">
                            <>
                                <div className="tt-login-v2-google-divider">
                                    <span>o</span>
                                </div>
                                <div
                                    className="tt-login-v2-google-host"
                                    ref={googleHost}
                                    style={{
                                        pointerEvents: loading
                                            ? "none"
                                            : "auto",
                                        opacity: loading ? 0.6 : 1,
                                    }}
                                />
                                {!googleReady && !googleError && (
                                    <p className="tt-login-v2-google-status">
                                        {canvas
                                            ? "Continuar con Google · disponible en vista previa"
                                            : "Cargando Google…"}
                                    </p>
                                )}
                                {googleError && (
                                    <>
                                        <p
                                            className="tt-login-v2-google-status"
                                            role="status"
                                        >
                                            {googleError}
                                        </p>
                                        <button
                                            type="button"
                                            className="tt-login-v2-google-retry"
                                            onClick={() =>
                                                setGoogleAttempt(
                                                    (value) => value + 1
                                                )
                                            }
                                        >
                                            Reintentar Google
                                        </button>
                                    </>
                                )}
                            </>
                        </div>
                    )}
                </form>
            </section>
            <div className="tt-login-v2-art">
                <svg
                    className="tt-login-v2-lines"
                    viewBox="0 0 720 720"
                    preserveAspectRatio="xMidYMid slice"
                    fill="none"
                    aria-hidden="true"
                >
                    {Array.from({ length: 17 }, (_, i) => (
                        <path
                            key={i}
                            d={`M-70 ${75 + i * 32} C ${180 + (i % 4) * 42} ${i % 2 ? 760 - i * 22 : -110 + i * 22}, ${440 - (i % 3) * 52} ${i % 2 ? -90 + i * 26 : 780 - i * 20}, 800 ${65 + ((i * 83) % 570)}`}
                            stroke="currentColor"
                            strokeWidth={i % 4 === 0 ? 1.7 : 1}
                            opacity={i % 3 === 0 ? 0.32 : 0.19}
                        />
                    ))}
                </svg>
                <div className="tt-login-v2-turnos" aria-hidden="true">
                    {demoTurnos.map((turno) => (
                        <div
                            key={turno.hora}
                            className="tt-login-v2-turno-float"
                            style={{
                                left: turno.left,
                                top: turno.top,
                                animationDelay: turno.delay,
                            }}
                        >
                            <div
                                className="tt-login-v2-turno"
                                style={{ "--turno-color": turno.color } as React.CSSProperties & { "--turno-color": string }}
                            >
                                <div className="tt-login-v2-turno-time">
                                    <span className="tt-login-v2-turno-dot" />
                                    <span>{turno.hora}</span>
                                </div>
                                <div className="tt-login-v2-turno-name">
                                    {turno.nombre}
                                </div>
                                <div className="tt-login-v2-turno-service">
                                    {turno.servicio}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}


