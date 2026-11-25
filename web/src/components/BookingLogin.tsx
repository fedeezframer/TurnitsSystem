import BackButton from "./BackButton"
import React from "react"

const storageKey = "turnits_booking_consumer_token"
let currentToken = ""

export function readBookingToken() {
    if (currentToken) return currentToken
    try {
        return localStorage.getItem(storageKey) || ""
    } catch {
        return ""
    }
}

export function saveBookingToken(token: string) {
    currentToken = token
    try {
        if (token) localStorage.setItem(storageKey, token)
        else localStorage.removeItem(storageKey)
    } catch {}
}

export default function BookingLogin({ api, onSession, accent }: {
    api: string
    onSession?: (token: string) => void
    accent?: string
}) {
    const [open, setOpen] = React.useState(false)
    const [signedIn, setSignedIn] = React.useState(false)
    const [signup, setSignup] = React.useState(false)
    const dialog = React.useRef<HTMLDialogElement>(null)
    const titleId = React.useId()
    const googleHost = React.useRef<HTMLDivElement>(null)
    const [googleReady, setGoogleReady] = React.useState(false)
    const [googleError, setGoogleError] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [challenge, setChallenge] = React.useState("")
    const [code, setCode] = React.useState("")
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState("")
    const pending = React.useRef(false)

    React.useEffect(() => {
        const token = readBookingToken()
        if (!token) return
        const request = new AbortController()
        fetch(`${api}/browse/identidad`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: request.signal,
        }).then(async response => {
            if (request.signal.aborted) return
            if (!response.ok) {
                if ([401, 403].includes(response.status) && readBookingToken() === token) saveBookingToken("")
                return
            }
            const result = await response.json()
            if (!request.signal.aborted && readBookingToken() === token && result.success && result.perfil) setSignedIn(true)
        }).catch(() => {})
        return () => request.abort()
    }, [api])

    React.useEffect(() => {
        const panel = dialog.current
        if (open && !panel?.open) panel?.showModal()
        if (!open && panel?.open) panel.close()
    }, [open])

    React.useEffect(() => {
        if (!open || signup || challenge) return
        const request = new AbortController()
        let observer: ResizeObserver | undefined
        setGoogleError("")
        setGoogleReady(false)
        const started = Date.now()
        const readiness = window.setInterval(() => {
            const frame = googleHost.current?.querySelector("iframe")
            if (frame && frame.getBoundingClientRect().height > 0) {
                setGoogleReady(true)
                window.clearInterval(readiness)
            } else if (Date.now() - started > 8000) {
                setGoogleError("Google no está disponible en este momento.")
            }
        }, 500)
        async function setup() {
            const [google, response] = await Promise.all([
                import("../migrated/Login"),
                fetch(`${api}/auth/google/challenge`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: "{}", signal: request.signal,
                }),
            ])
            const result = await response.json()
            if (!response.ok || !result.nonce) throw new Error("Google no está disponible en este momento.")
            await google.loadGoogleScript()
            const identity = google.googleIdentity()
            const host = googleHost.current
            if (!identity || !host || request.signal.aborted) return
            identity.initialize({
                client_id: google.GOOGLE_CLIENT_ID, nonce: result.nonce, auto_select: false,
                callback: async ({ credential }) => {
                    if (!credential || request.signal.aborted || pending.current) return
                    pending.current = true
                    setBusy(true)
                    try {
                        const response = await fetch(`${api}/auth/google`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ credential, nonce: result.nonce, tipo_cuenta: "usuario" }),
                            signal: request.signal,
                        })
                        const data = await response.json()
                        if (request.signal.aborted) return
                        if (data.code === "google_registration_required") {
                            setSignup(true)
                            return
                        }
                        if (!response.ok || data.rol !== "consumidor" || !data.token) throw new Error(data.error || "No pudimos iniciar sesión con Google.")
                        finish(data.token)
                    } catch (error) {
                        if (!request.signal.aborted) setGoogleError(error instanceof Error ? error.message : "No pudimos iniciar sesión con Google.")
                    } finally {
                        pending.current = false
                        setBusy(false)
                    }
                },
            })
            observer = new ResizeObserver(() => {
                const width = Math.min(360, Math.floor(host.clientWidth))
                if (request.signal.aborted || width < 200) return
                host.replaceChildren()
                identity.renderButton(host, { type: "standard", theme: "outline", size: "large", text: "signin_with", width, locale: "es" })
            })
            observer.observe(host)
        }
        setup().catch(() => {
            if (!request.signal.aborted) setGoogleError("Google no está disponible en este momento.")
        })
        return () => { request.abort(); observer?.disconnect(); window.clearInterval(readiness) }
    }, [api, open, signup, challenge])

    function close() {
        setOpen(false)
        setSignup(false)
        setEmail("")
        setChallenge("")
        setCode("")
        setError("")
    }

    function finish(token: string) {
        saveBookingToken(token)
        onSession?.(token)
        setSignedIn(true)
        close()
    }

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (pending.current) return
        pending.current = true
        setBusy(true)
        setError("")
        try {
            const action = challenge ? "verificar-codigo" : "enviar-codigo"
            const response = await fetch(`${api}/consumidores/agenda/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase(), challenge, codigo: code, registro: signup }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok || !data?.success) {
                throw new Error(response.status === 429 ? "Esperá unos minutos antes de volver a intentar." : data?.error || "No pudimos continuar. Probá de nuevo.")
            }
            if (challenge && typeof data.token === "string" && data.token) finish(data.token)
            else if (!challenge && typeof data.challenge === "string" && data.challenge) setChallenge(data.challenge)
            else throw new Error("No pudimos continuar. Probá de nuevo.")
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "No pudimos continuar. Probá de nuevo.")
        } finally {
            pending.current = false
            setBusy(false)
        }
    }

    const control: React.CSSProperties = { font: "inherit", border: "1px solid currentColor", borderRadius: 10, padding: "10px 12px", minHeight: 44, color: "inherit", background: "transparent", boxSizing: "border-box", minWidth: 0 }
    const button: React.CSSProperties = { ...control, cursor: "pointer" }

    const primaryButton: React.CSSProperties = accent ? {
        ...button,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        border: 0,
        borderRadius: 999,
        background: accent,
        color: "#fff",
        fontSize: 13,
        fontWeight: 750,
        padding: "10px clamp(12px, 3vw, 17px)",
    } : button

    if (signedIn) return (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <span role="status">Sesión iniciada</span>
            <button type="button" style={button} onClick={() => {
                saveBookingToken("")
                onSession?.("")
                setSignedIn(false)
            }}>Cerrar sesión</button>
        </div>
    )

    const actionColor = accent || "#1b6b1a"
    const [mailName, mailDomain] = email.trim().split("@")
    const maskedEmail = `${mailName.slice(0, 2)}••••${mailDomain ? `@${mailDomain}` : ""}`

    return (
        <>
        <button
            type="button"
            style={accent ? {
                display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
                border: 0, background: "transparent", color: accent,
                padding: "0 4px", font: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
            } : button}
            onClick={() => setOpen(true)}
        >
            {accent && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
                </svg>
            )}
            {accent ? "Iniciar sesión" : "Ingresar con mi correo"}
        </button>
            <style>{`dialog.turnits-booking-login::backdrop{background:rgba(12,16,13,.42)}.turnits-booking-login input:focus-visible{outline:2px solid ${actionColor};outline-offset:2px}.turnits-booking-login .booking-code:focus-within{outline:2px solid ${actionColor};outline-offset:4px;border-radius:5px}`}</style>
            <dialog ref={dialog} className="turnits-booking-login" aria-labelledby={titleId}
                onCancel={event => { event.preventDefault(); if (!busy) close() }}
                style={{ width: "min(calc(100% - 32px), 400px)", maxWidth: "none", maxHeight: "calc(100% - 24px)", boxSizing: "border-box", border: 0, borderRadius: 20, padding: "28px clamp(16px, 5vw, 28px)", color: "#171a17", background: "#fff", boxShadow: "0 24px 90px #1115" }}>
                <BackButton floating aria-label={challenge || signup ? "Volver" : "Cerrar"} disabled={busy}
                    onClick={() => {
                        setError("")
                        if (challenge) { setChallenge(""); setCode("") }
                        else if (signup) setSignup(false)
                        else close()
                    }} />
                <img src="/favicon-light.png" alt="" width={96} height={96} style={{ display: "block", margin: "0 auto 10px" }} />
                <form onSubmit={submit} style={{ display: "grid", gap: 15 }}>
                    <h2 id={titleId} style={{ margin: 0, fontSize: 19, lineHeight: 1.25 }}>
                        {challenge ? "Ingresá el código de verificación" : "Ingresá tu correo electrónico"}
                    </h2>
                    {challenge ? <>
                        <p style={{ margin: 0, color: "#555", overflowWrap: "anywhere" }}>Si podemos verificar ese correo, vas a recibir un código en <strong>{maskedEmail}</strong>.</p>
                        <div className="booking-code" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "clamp(4px, 2vw, 9px)", position: "relative", marginTop: 8 }}>
                            {Array.from({ length: 6 }, (_, i) => <span key={i} aria-hidden="true" style={{ display: "grid", placeItems: "center", height: 44, border: "1px solid #818781", borderRadius: 6, fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{code[i]}</span>)}
                            <input key="code" autoFocus aria-label="Código de verificación" inputMode="numeric" autoComplete="one-time-code"
                                pattern="[0-9]{6}" required value={code} readOnly={busy}
                                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", boxSizing: "border-box", opacity: 0, fontSize: 16 }}
                                onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                        </div>
                        <button type="submit" disabled={busy} style={{ ...primaryButton, background: actionColor, color: "white", border: 0, borderRadius: 999 }}>{busy ? "Verificando…" : "Verificar código"}</button>
                    </> : <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input key="email" autoFocus aria-label="Correo electrónico" required type="email" autoComplete="email"
                                maxLength={254} value={email} readOnly={busy} onChange={event => setEmail(event.target.value)}
                                style={{ ...control, flex: 1, width: 0, borderRadius: 999, fontSize: 16 }} />
                            <button type="submit" disabled={busy} aria-label="Enviar código"
                                style={{ ...button, borderRadius: "50%", width: 44, flex: "0 0 44px", padding: 0, border: 0, background: actionColor, color: "white", fontSize: 22 }}>{busy ? "…" : "→"}</button>
                        </div>
                        {signup ? <>
                            <p style={{ margin: "8px 0 0", color: "#555" }}>Con tu cuenta de Turnits podés acceder a una experiencia personalizada según tus gustos.</p>
                            <p style={{ margin: 0, color: "#555" }}>Al continuar, aceptás los <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{ color: actionColor }}>Términos y Condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: actionColor }}>Política de Privacidad</a>.</p>
                        </> : <>
                            {open && <div style={{ display: "grid", marginTop: 8 }}>
                                <div ref={googleHost} style={{ gridArea: "1 / 1", minHeight: 40, opacity: googleReady ? 1 : 0 }} aria-hidden={!googleReady} />
                                {!googleReady && <button type="button" disabled style={{ ...button, gridArea: "1 / 1", minHeight: 40, padding: "6px 12px", cursor: "default", background: "#fff", zIndex: 1 }}>
                                    {googleError ? "Google no disponible" : "Cargando Google…"}
                                </button>}
                            </div>}
                            {googleReady && googleError && <p role="status" style={{ margin: 0, color: "#555", fontSize: 13 }}>{googleError}</p>}
                            <div style={{ borderTop: "1px solid #d6d9d6", paddingTop: 12, textAlign: "center", color: "#555" }}>
                                <div>¿No tenés cuenta?</div>
                                <button type="button" disabled={busy} onClick={() => { setSignup(true); setError("") }}
                                    style={{ ...button, border: 0, padding: 0, fontWeight: 700, color: actionColor }}>Registrarse</button>
                            </div>
                        </>}
                    </>}
                    {error && <span role="alert" style={{ color: "#a02424" }}>{error}</span>}
                </form>
            </dialog>
        </>
    )
}
