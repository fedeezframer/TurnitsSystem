import * as React from "react"
import { BackButton } from "../../components/BackButton"
import BookingReceipt from "../../components/BookingReceipt"
import { useNativeDialogExit } from "../../components/useNativeDialogExit"
import { AgendaPanel_esPendienteAprobacion, AgendaPanel_formatMonto, AgendaPanel_getSlug, AgendaPanel_metodoPagoLabel } from "./common"
import { MembershipPaymentReview, type MembershipPayment, type useAgendaMembershipPayments } from "./membership-payment-review"
import "./agenda-dias.css"

export type VistaAgenda = "calendario" | "turnos"
type Turno = {
    id: string; created_at?: string; fecha_pago?: string | null; nombre: string; apellido?: string; hora: string; estado?: string
    servicio?: string; equipo_nombre?: string; sucursal_id?: string
    metodo_pago?: string; tipo_cobro?: string; porcentaje_sena?: number; notas?: string; precio_cobrado: number; monto_pagado: number
    reprogramacion_pendiente?: { id: string } | null
}
type Dia = { fecha: string; turnos: Turno[] }
type ReservasProps = { dias: Dia[]; onTurnoClick: (turno: Turno, fecha: string) => void }
type Comprobante = { url: string; loading: boolean; error: string }

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeZone: "UTC" })
const monthFormat = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
const agendaTimeZone = "America/Argentina/Buenos_Aires"
const listDate = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: agendaTimeZone })
const activityTime = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: agendaTimeZone })
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const toDate = (day: string) => new Date(day + "T12:00:00Z")
const toIso = (date: Date) => date.toISOString().slice(0, 10)
function shiftDay(iso: string, count: number) {
    const date = toDate(iso)
    date.setUTCDate(date.getUTCDate() + count)
    return toIso(date)
}
function shiftMonth(iso: string, count: number) {
    const date = toDate(iso.slice(0, 7) + "-01")
    date.setUTCMonth(date.getUTCMonth() + count)
    return toIso(date)
}
function nameOf(turno: Turno) {
    return [turno.nombre, turno.apellido].filter(Boolean).join(" ")
}
function statusOf(turno: Turno) {
    if (turno.reprogramacion_pendiente) return "Reprogramación solicitada"
    if (AgendaPanel_esPendienteAprobacion(turno)) return "Por aprobar"
    return { confirmado: "Confirmado", completado: "Completado", pendiente: "Pendiente", no_asistio: "No asistió" }[turno.estado || ""] || ""
}
function AgendaRow({ date, time, name, description, status, pending, amount, onClick }: {
    date?: string; time?: string; name: string; description: string; status: string
    pending: boolean; amount?: string; onClick: () => void
}) {
    return <li>
        <button type="button" className="agenda-appointment" onClick={onClick}>
            <span className="agenda-appointment-time">
                {time && <time>{time}</time>}
                {date && <span>{date}</span>}
            </span>
            <span className="agenda-appointment-body">
                <strong>{name}</strong>
                <span>{description}</span>
            </span>
            {(status || amount) && <span className="agenda-appointment-summary">
                {status && <small className="agenda-status" data-action={pending}>{status}</small>}
                {amount && <span>{amount}</span>}
            </span>}
        </button>
    </li>
}

function ReservaRow({ turno, fecha, showDate, onClick }: { turno: Turno; fecha: string; showDate?: boolean; onClick: () => void }) {
    const pending = Boolean(turno.reprogramacion_pendiente || AgendaPanel_esPendienteAprobacion(turno))
    const paid = Number(turno.monto_pagado) || 0
    const deposit = turno.tipo_cobro === "sena"
    const expected = deposit ? Math.round(turno.precio_cobrado * (turno.porcentaje_sena || 30) / 100) : turno.precio_cobrado
    const amount = paid > 0 ? `${paid < turno.precio_cobrado ? "Abonado" : "Cobrado"} ${AgendaPanel_formatMonto(paid)}`
        : AgendaPanel_esPendienteAprobacion(turno) ? `${deposit ? "Seña por cobrar" : "Por cobrar"} ${AgendaPanel_formatMonto(expected)}` : undefined
    const status = statusOf(turno)
    return <AgendaRow date={showDate ? listDate.format(toDate(fecha)) : undefined} time={turno.hora}
        name={nameOf(turno)} description={[turno.servicio, turno.equipo_nombre].filter(Boolean).join(" · ") || "Reserva"}
        status={showDate && status === "Confirmado" ? "Turno confirmado" : status} pending={pending} amount={showDate ? amount : undefined} onClick={onClick} />
}

export function AgendaPanel_Layout({ dias, today, onTurnoClick }: ReservasProps & { today: string }) {
    // La agenda existente entrega los 30 días siguientes, incluidos los turnos de hoy.
    const lastDay = shiftDay(today, 30)
    const [selectedDay, selectDay] = React.useState("")
    const [browsedMonth, setBrowsedMonth] = React.useState("")
    const dateTrigger = React.useRef<HTMLButtonElement>(null)
    const firstMonth = shiftMonth(today, 0)
    const selected = selectedDay >= today && selectedDay <= lastDay ? selectedDay : ""
    const month = browsedMonth >= firstMonth && browsedMonth <= shiftMonth(lastDay, 0) ? browsedMonth : firstMonth
    function browseMonth(next: string) {
        setBrowsedMonth(next)
        selectDay("")
    }
    const prevMonth = shiftMonth(month, -1)
    const nextMonth = shiftMonth(month, 1)
    const offset = (toDate(month).getUTCDay() + 6) % 7
    const size = toDate(shiftDay(nextMonth, -1)).getUTCDate()
    const days = new Map(dias.map(day => [day.fecha, day.turnos]))
    const appointments = days.get(selected) || []
    return <div className="agenda-calendar-layout" data-day-open={Boolean(selected)}>
        <section className="agenda-calendar" aria-label="Calendario de reservas">
            <header className="agenda-calendar-head">
                <h2 aria-live="polite">{monthFormat.format(toDate(month))}</h2>
                <div className="agenda-calendar-controls">
                    <button type="button" className="agenda-today" onClick={event => { dateTrigger.current = event.currentTarget; setBrowsedMonth(firstMonth); selectDay(today) }}>Hoy</button>
                    <button type="button" aria-label="Mes anterior" disabled={prevMonth < firstMonth}
                        onClick={() => browseMonth(prevMonth)}>
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m10 3-5 5 5 5" /></svg>
                    </button>
                    <button type="button" aria-label="Mes siguiente" disabled={nextMonth > lastDay} onClick={() => browseMonth(nextMonth)}>
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m6 3 5 5-5 5" /></svg>
                    </button>
                </div>
            </header>
            <div className="agenda-calendar-grid">
                {weekdays.map(day => <span className="agenda-weekday" key={day} aria-hidden="true">{day}</span>)}
                {Array.from({ length: offset }, (_, index) => <span aria-hidden="true" key={`pad-${index}`} />)}
                {Array.from({ length: size }, (_, index) => {
                    const day = shiftDay(month, index)
                    const count = days.get(day)?.length || 0
                    const available = day >= today && day <= lastDay
                    return <button type="button" key={day} disabled={!available} aria-pressed={selected === day}
                        aria-current={day === today ? "date" : undefined}
                        aria-label={`${dateFormat.format(toDate(day))}${available ? `, ${count} ${count === 1 ? "reserva" : "reservas"}` : ""}`}
                        className="agenda-calendar-day" onClick={event => { dateTrigger.current = event.currentTarget; selectDay(day) }}>
                        <span>{index + 1}</span>
                        {count > 0 && <small aria-hidden="true">{count}<span> {count === 1 ? "reserva" : "reservas"}</span></small>}
                    </button>
                })}
            </div>
        </section>
        {selected && <section className="agenda-day-reservations" aria-labelledby="agenda-selected-day">
            <header>
                <div>
                    <h2 id="agenda-selected-day">{dateFormat.format(toDate(selected))}</h2>
                    <p aria-live="polite">{appointments.length} {appointments.length === 1 ? "reserva" : "reservas"}</p>
                </div>
                <BackButton aria-label="Cerrar reservas del día" onClick={() => { selectDay(""); dateTrigger.current?.focus({ preventScroll: true }) }} />
            </header>
            {appointments.length > 0 && <ul className="agenda-appointment-list">
                {appointments.map(turno => <ReservaRow key={turno.id} turno={turno} fecha={selected} onClick={() => onTurnoClick(turno, selected)} />)}
            </ul>}
        </section>}
    </div>
}

type Activity = { timestamp: number; pending: boolean } & (
    { kind: "reserva"; turno: Turno; fecha: string } |
    { kind: "suscripcion"; payment: MembershipPayment }
)

export function AgendaTurnos({ dias, onTurnoClick, membership, includeMembership }: ReservasProps & {
    includeMembership: boolean
    membership: ReturnType<typeof useAgendaMembershipPayments>
}) {
    const [pendingOnly, setPendingOnly] = React.useState(false)
    const [selectedPayment, selectPayment] = React.useState<MembershipPayment | null>(null)
    const entries: Activity[] = [
        ...dias.flatMap(day => day.turnos.map(turno => ({
            kind: "reserva" as const, turno, fecha: day.fecha,
            timestamp: Date.parse(turno.fecha_pago || turno.created_at || day.fecha + "T" + turno.hora + ":00-03:00") || 0,
            pending: Boolean(AgendaPanel_esPendienteAprobacion(turno) || turno.reprogramacion_pendiente),
        }))),
        ...(includeMembership ? membership.payments : []).map(payment => ({
            kind: "suscripcion" as const, payment,
            timestamp: Date.parse(payment.pagado_at || payment.created_at) || 0,
            pending: payment.estado !== "cobrado",
        })),
    ]
    entries.sort((a, b) => b.timestamp - a.timestamp)
    const pendientes = entries.filter(entry => entry.pending)
    const visible = pendingOnly ? pendientes : entries
    const loading = includeMembership && membership.loading
    const error = includeMembership ? membership.error : ""
    return <section className="agenda-turn-list" aria-label="Listado de turnos">
        <div className="agenda-turn-filters" role="group" aria-label="Filtrar turnos y cobros">
            <button type="button" aria-pressed={!pendingOnly} onClick={() => setPendingOnly(false)}>Todos <span>{entries.length}</span></button>
            <button type="button" aria-pressed={pendingOnly} onClick={() => setPendingOnly(true)}>Pendientes <span>{pendientes.length}</span></button>
        </div>
        {loading && visible.length === 0 && <p className="agenda-empty-note" role="status">Cargando cobros…</p>}
        {error && <p className="agenda-empty-note" role="alert">{error} <button type="button" onClick={membership.retry}>Reintentar</button></p>}
        {visible.length === 0 && !loading && !error && <div className="agenda-empty-state" role="status">
            <picture>
                <source media="(prefers-reduced-motion: reduce)" srcSet="/assets/agenda/agendita-quieta.png" />
                <img src="/assets/agenda/agendita-rodadoras.gif" width={560} height={300} alt="" />
            </picture>
            <p className="agenda-empty-note">{pendingOnly ? "No hay reservas ni cobros pendientes de revisión." : "No hay reservas ni cobros para mostrar."}</p>
        </div>}
        {visible.length > 0 && <ul className="agenda-appointment-list">
            {visible.map(entry => {
                if (entry.kind === "reserva") return <ReservaRow key={`reserva-${entry.turno.id}`} turno={entry.turno} fecha={entry.fecha}
                    showDate onClick={() => onTurnoClick(entry.turno, entry.fecha)} />
                const { payment, timestamp, pending } = entry
                return <AgendaRow key={`suscripcion-${payment.id}`}
                    date={timestamp ? listDate.format(timestamp) : undefined} time={timestamp ? activityTime.format(timestamp) : undefined}
                    name={payment.cliente || payment.email || "Cliente"} description={`Suscripción · ${payment.nombre}`}
                    status={pending ? "Por confirmar" : "Cobrado"} pending={pending} amount={AgendaPanel_formatMonto(payment.importe)}
                    onClick={() => selectPayment(payment)} />
            })}
        </ul>}
        {selectedPayment && <MembershipPaymentReview payment={selectedPayment} request={membership.request}
            review={membership.review} onClose={() => selectPayment(null)} />}
    </section>
}

export function AgendaReservaDetalle({ turno, fecha, comprobante, onClose }: { turno: Turno; fecha: string; comprobante: Comprobante; onClose: () => void }) {
    const dialog = React.useRef<HTMLDialogElement>(null)
    const title = React.useId()
    const finishClose = useNativeDialogExit(onClose)
    React.useEffect(() => {
        if (!dialog.current?.open) dialog.current?.showModal()
    }, [])
    return <dialog className="agenda-reservation-dialog" ref={dialog} aria-labelledby={title} onClose={finishClose}
        onClick={event => {
            if (event.target !== event.currentTarget) return
            const bounds = event.currentTarget.getBoundingClientRect()
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close()
        }}>
        <header>
            <div><h2 id={title}>{nameOf(turno)}</h2><p>{dateFormat.format(toDate(fecha))} · {turno.hora}</p></div>
            <BackButton onClick={() => dialog.current?.close()} aria-label="Cerrar detalle de reserva" autoFocus />
        </header>
        <dl className="agenda-reservation-facts">
            <div><dt>Servicio</dt><dd>{turno.servicio || "Reserva"}</dd></div>
            {turno.equipo_nombre && <div><dt>Profesional</dt><dd>{turno.equipo_nombre}</dd></div>}
            {statusOf(turno) && <div><dt>Estado del turno</dt><dd>{statusOf(turno)}</dd></div>}
            {turno.metodo_pago && turno.metodo_pago !== "none" && <div><dt>Medio de pago</dt><dd>{AgendaPanel_metodoPagoLabel(turno.metodo_pago)}</dd></div>}
            <div><dt>Total</dt><dd>{AgendaPanel_formatMonto(turno.precio_cobrado)}</dd></div>
            <div><dt>Abonado</dt><dd>{AgendaPanel_formatMonto(turno.monto_pagado)}</dd></div>
            {turno.notas && <div><dt>Notas</dt><dd>{turno.notas}</dd></div>}
        </dl>
        {turno.metodo_pago === "transferencia" && <div className="agenda-proof">
            <strong>Comprobante de transferencia</strong>
            {comprobante.loading && <span role="status">Cargando comprobante…</span>}
            {comprobante.error && <span role="status">{comprobante.error}</span>}
            {comprobante.url && <a href={comprobante.url} target="_blank" rel="noopener noreferrer">Abrir comprobante</a>}
        </div>}
        <details className="agenda-receipt">
            <summary>Comprobante de reserva</summary>
            <BookingReceipt turno={{ ...turno, fecha, slug: AgendaPanel_getSlug(), servicio_nombre: turno.servicio }} />
        </details>
    </dialog>
}
