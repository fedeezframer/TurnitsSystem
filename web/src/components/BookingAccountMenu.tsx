import React from "react"
import BackButton from "./BackButton"
import "./BookingAccountMenu.css"

type Profile = { nombre_persona?: string; apellido?: string; email?: string; telefono?: string }
type Field = "nombre_persona" | "apellido" | "telefono"
type Reservation = { id: string; servicio: string; negocio: string; fecha: string; hora: string; estado: string; actual: boolean; imagen?: string; reprogramar?: string }
type Subscription = { id: string; nombre: string; tickets: number; usos: { nombre: string; cantidad: number }[] }
type History = { reservas: Reservation[]; suscripciones: Subscription[]; hay_mas: boolean }

const labels = { nombre_persona: "Nombre", apellido: "Apellido", email: "Correo electrónico", telefono: "Teléfono" }
const fields = ["nombre_persona", "apellido", "email", "telefono"] as const
const relativeDay = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto", style: "short" })

function timeLabel(booking: Reservation) {
    if (booking.actual) return "actual"
    if (booking.estado === "cancelado") return "Cancelada"
    const date = Date.parse(`${booking.fecha}T12:00:00-03:00`)
    if (!Number.isFinite(date)) return ""
    const days = Math.round((date - Date.now()) / 86400000)
    if (Math.abs(days) >= 30) return relativeDay.format(Math.round(days / 30), "month")
    if (Math.abs(days) >= 7) return relativeDay.format(Math.round(days / 7), "week")
    return relativeDay.format(days, "day")
}

function Ticket() {
    return <svg className="bam-ticket-icon" width="18" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
        <path d="M1.5 1.5h17v3a2.5 2.5 0 0 0 0 5v3h-17v-3a2.5 2.5 0 0 0 0-5zM8 5.5l2 2 2-2" />
    </svg>
}

export default function BookingAccountMenu({ api, slug, token, name, accent, onClose, onLogout, onProfileChange }: {
    api: string; slug?: string; token: string; name: string; accent: string;
    onClose: () => void; onLogout: () => void; onProfileChange: (profile: Profile) => void
}) {
    const dialog = React.useRef<HTMLDialogElement>(null)
    const [profile, setProfile] = React.useState<Profile | null>(null)
    const [profileError, setProfileError] = React.useState("")
    const [history, setHistory] = React.useState<History | null>(null)
    const [historyError, setHistoryError] = React.useState("")
    const [page, setPage] = React.useState(0)
    const [expanded, setExpanded] = React.useState(false)
    const [loadingMore, setLoadingMore] = React.useState(false)
    const [edit, setEdit] = React.useState<Field | null>(null)
    const [value, setValue] = React.useState("")
    const [editError, setEditError] = React.useState("")
    const [saving, setSaving] = React.useState(false)
    const [retry, setRetry] = React.useState(0)
    const titleId = React.useId()

    const request = React.useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
        const res = await fetch(api + path, {
            ...init, cache: "no-store",
            headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error || "No pudimos cargar tus datos.")
        return data
    }, [api, token])
    const historyPath = (index: number) => `/browse/mi-cuenta/turnos?page=${index}&slug=${encodeURIComponent(slug || "")}`

    React.useEffect(() => {
        dialog.current?.showModal()
    }, [])
    React.useEffect(() => {
        const controller = new AbortController()
        setProfileError("")
        setHistoryError("")
        request<{ perfil: Profile }>("/browse/identidad", { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setProfile(result.perfil) })
            .catch(error => { if (!controller.signal.aborted) setProfileError(error.message) })
        request<History>(historyPath(0), { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) { setHistory(result); setPage(0) } })
            .catch(error => { if (!controller.signal.aborted) setHistoryError(error.message) })
        return () => controller.abort()
    }, [request, slug, retry])

    async function loadMore() {
        setLoadingMore(true)
        setHistoryError("")
        try {
            const next = await request<History>(historyPath(page + 1))
            setHistory(current => current && {
                ...current, hay_mas: next.hay_mas,
                reservas: [...current.reservas, ...next.reservas.filter(row => !current.reservas.some(item => item.id === row.id))],
            })
            setPage(page + 1)
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : "No pudimos cargar más reservas.")
        } finally {
            setLoadingMore(false)
        }
    }

    async function saveField(event: React.FormEvent) {
        event.preventDefault()
        if (!edit || saving) return
        setSaving(true)
        setEditError("")
        try {
            const result = await request<{ valor: string }>("/browse/mi-cuenta/datos", {
                method: "PATCH", body: JSON.stringify({ campo: edit, valor: value }),
            })
            const next = { ...profile, [edit]: result.valor }
            setProfile(next)
            onProfileChange(next)
            setEdit(null)
        } catch (error) {
            setEditError(error instanceof Error ? error.message : "No pudimos guardar el cambio.")
        } finally {
            setSaving(false)
        }
    }

    const fullName = [profile?.nombre_persona, profile?.apellido].filter(Boolean).join(" ") || name
    const reservations = expanded ? history?.reservas || [] : history?.reservas.slice(0, 4) || []
    const displayValue = (key: typeof fields[number]) => {
        const field = profile?.[key] || ""
        return key === "telefono" && field && !field.startsWith("+") ? "+" + field : field
    }

    return <dialog ref={dialog} className="booking-account-menu" aria-labelledby={titleId}
        style={{ "--bam-accent": accent } as React.CSSProperties}
        onCancel={event => { event.preventDefault(); onClose() }}
        onClick={event => {
            if (event.target !== event.currentTarget) return
            const panel = event.currentTarget.getBoundingClientRect()
            if (event.clientX < panel.left || event.clientX > panel.right || event.clientY < panel.top || event.clientY > panel.bottom) onClose()
        }}>
        <header className="bam-header">
            <span className="bam-avatar" aria-hidden="true">{Array.from(fullName)[0]?.toLocaleUpperCase("es") || "U"}</span>
            <div className="bam-identity"><h2 id={titleId}>{fullName}</h2>{profile?.email && <p>{profile.email}</p>}</div>
            <BackButton aria-label="Cerrar menú de cuenta" onClick={onClose} />
        </header>
        <div className="bam-body">
            {!!history?.suscripciones.length && <section className="bam-subscriptions" aria-label="Tu suscripción">
                {history.suscripciones.map((plan, index) => <div className="bam-plan" key={plan.id}>
                    <div>
                        {index === 0 && <h3>Tu suscripción</h3>}
                        <div className="bam-tickets"><span>Tickets</span><strong>{plan.tickets} <Ticket /></strong></div>
                    </div>
                    <div className="bam-usage"><h3>{plan.nombre}</h3>
                        {plan.usos.map((use, n) => <p key={n}>−{use.cantidad} <Ticket /> {use.nombre}</p>)}
                    </div>
                </div>)}
            </section>}
            <section aria-label="Tus últimas reservas">
                <div className="bam-title"><h3>{expanded ? "Tus reservas" : "Tus últimas reservas"}</h3>
                    {!!history?.reservas.length && (history.reservas.length > 4 || history.hay_mas) && <button type="button" className="bam-text-button" aria-expanded={expanded} onClick={() => setExpanded(current => !current)}>{expanded ? "Ver recientes" : "Ver todas"}</button>}
                </div>
                {historyError ? <p role="alert">{historyError} <button type="button" className="bam-text-button" onClick={() => setRetry(x => x + 1)}>Reintentar</button></p>
                    : !history ? <p role="status">Cargando tus reservas…</p> : !reservations.length && <p>Todavía no tenés reservas en tu cuenta.</p>}
                <ul className="bam-reservations">{reservations.map(row => <li key={row.id}>
                    {row.imagen ? <img alt="" src={row.imagen} loading="lazy" /> : <span className="bam-thumb" aria-hidden="true">{row.servicio.charAt(0)}</span>}
                    <div className="bam-reservation-name"><strong>{row.servicio}</strong><span>en {row.negocio}</span></div>
                    <div className="bam-reservation-meta"><time dateTime={row.fecha}>{timeLabel(row)}</time>
                        {row.reprogramar && <a href={row.reprogramar} referrerPolicy="no-referrer">Reprogramar ↘</a>}
                    </div>
                </li>)}</ul>
                {expanded && history?.hay_mas && <button type="button" className="bam-text-button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Cargando…" : "Ver más reservas"}</button>}
            </section>
            <section aria-label="Tus datos">
                <h3 className="bam-data-title">Tus datos</h3>
                {profileError ? <p role="alert">{profileError} <button type="button" className="bam-text-button" onClick={() => setRetry(x => x + 1)}>Reintentar</button></p> :
                    !profile ? <p role="status">Cargando tus datos…</p> :
                    <div className="bam-fields">{fields.map(key => <div key={key}>
                        <span>{labels[key]}</span>
                        {key === "email" ? <span className="bam-field" title={displayValue(key)}>{displayValue(key)}</span> :
                            <button type="button" className="bam-field" aria-label={`Editar ${labels[key].toLowerCase()}`}
                                onClick={() => { setEdit(key); setValue(displayValue(key)); setEditError("") }}>
                                <span>{displayValue(key) || "Completar"}</span><span aria-hidden="true">✎</span>
                            </button>}
                    </div>)}</div>}
                {edit && <form className="bam-edit" onSubmit={saveField}>
                    <label>{labels[edit]}<input autoFocus required maxLength={edit === "telefono" ? 24 : 80}
                        type={edit === "telefono" ? "tel" : "text"} value={value} onChange={event => setValue(event.target.value)} /></label>
                    {editError && <p role="alert">{editError}</p>}
                    <div><button type="button" disabled={saving} onClick={() => setEdit(null)}>Cancelar</button>
                        <button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></div>
                </form>}
            </section>
            <button type="button" className="bam-text-button bam-logout" onClick={onLogout}>Cerrar sesión</button>
        </div>
    </dialog>
}
