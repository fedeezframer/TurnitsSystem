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
                body: JSON.stringify({ email: email.trim().toLowerCase(), challenge, codigo: code }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok || !data?.success) {
                throw new Error(response.status === 429 ? "Esperá unos minutos antes de volver a intentar." : data?.error || "No pudimos continuar. Probá de nuevo.")
            }

            if (challenge && typeof data.token === "string" && data.token) {
                saveBookingToken(data.token)
                onSession?.(data.token)
                setSignedIn(true)
                setOpen(false)
                setChallenge("")
                setCode("")
                setEmail("")
            } else if (!challenge && typeof data.challenge === "string" && data.challenge) {
                setChallenge(data.challenge)
            } else {
                throw new Error("No pudimos continuar. Probá de nuevo.")
            }
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

    if (!open) return (
        <button type="button" style={primaryButton} onClick={() => setOpen(true)}>
            Ingresar con mi correo {accent && <span aria-hidden="true">↗</span>}
        </button>
    )

    return (
        <form onSubmit={submit} style={{ display: "grid", gap: 10, width: "100%", maxWidth: 420, textAlign: "left" }}>
            {challenge ? (
                <label style={{ display: "grid", gap: 6 }}>
                    Código de verificación
                    <input key="code" autoFocus style={control} required inputMode="numeric" autoComplete="one-time-code"
                        pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy}
                        onChange={event => setCode(event.target.value.replace(/\D/g, ""))} />
                </label>
            ) : (
                <label style={{ display: "grid", gap: 6 }}>
                    Correo electrónico
                    <input key="email" autoFocus style={control} required type="email" autoComplete="email"
                        maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
                </label>
            )}
            {challenge && <span role="status">Si tenés una cuenta de cliente con ese correo, te enviamos un código.</span>}
            {error && <span role="alert">{error}</span>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="submit" style={primaryButton} disabled={busy}>{busy ? "Un momento…" : challenge ? "Confirmar código" : "Enviar código"}</button>
                <button type="button" style={button} disabled={busy} onClick={() => {
                    setError("")
                    setCode("")
                    if (challenge) setChallenge("")
                    else setOpen(false)
                }}>{challenge ? "Volver al correo" : "Cancelar"}</button>
            </div>
        </form>
    )
}
