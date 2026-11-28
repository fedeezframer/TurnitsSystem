import * as React from "react"
import { BackButton } from "../../components/BackButton"
import BookingReceipt from "../../components/BookingReceipt"
import { useNativeDialogExit } from "../../components/useNativeDialogExit"
import { AgendaPanel_esPendienteAprobacion, AgendaPanel_formatMonto, AgendaPanel_getSlug, AgendaPanel_metodoPagoLabel } from "./common"
import "./agenda-dias.css"

export type VistaAgenda = "calendario" | "turnos"
type Turno = {
    id: string; nombre: string; apellido?: string; hora: string; estado?: string
    servicio?: string; equipo_nombre?: string; sucursal_id?: string
    metodo_pago?: string; notas?: string; precio_cobrado: number; monto_pagado: number
    reprogramacion_pendiente?: { id: string } | null
}
type Dia = { fecha: string; turnos: Turno[] }
type ReservasProps = { dias: Dia[]; onTurnoClick: (turno: Turno, fecha: string) => void }
type Comprobante = { url: string; loading: boolean; error: string }

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "full", timeZone: "UTC" })
const monthFormat = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
const listDate = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
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
function ReservaRow({ turno, fecha, showDate, onClick }: { turno: Turno; fecha: string; showDate?: boolean; onClick: () => void }) {
    const status = statusOf(turno)
    return <li>
        <button type="button" className="agenda-appointment" onClick={onClick}>
            <span className="agenda-appointment-time">
                <time dateTime={fecha + "T" + turno.hora}>{turno.hora}</time>
                {showDate && <span>{listDate.format(toDate(fecha))}</span>}
            </span>
            <span className="agenda-appointment-body">
                <strong>{nameOf(turno)}</strong>
                <span>{[turno.servicio, turno.equipo_nombre].filter(Boolean).join(" · ") || "Reserva"}</span>
            </span>
            {status && <small className="agenda-status" data-action={Boolean(turno.reprogramacion_pendiente || AgendaPanel_esPendienteAprobacion(turno))}>{status}</small>}
        </button>
    </li>
}

export function AgendaPanel_Layout({ dias, today, onTurnoClick }: ReservasProps & { today: string }) {
    // La agenda existente entrega los 30 días siguientes, incluidos los turnos de hoy.
    const lastDay = shiftDay(today, 30)
    const [selectedDay, selectDay] = React.useState(today)
    const selected = selectedDay >= today && selectedDay <= lastDay ? selectedDay : today
    const month = shiftMonth(selected, 0)
    const prevMonth = shiftMonth(month, -1)
    const nextMonth = shiftMonth(month, 1)
    const offset = (toDate(month).getUTCDay() + 6) % 7
    const size = toDate(shiftDay(nextMonth, -1)).getUTCDate()
    const days = new Map(dias.map(day => [day.fecha, day.turnos]))
    const appointments = days.get(selected) || []
    return <div className="agenda-calendar-layout">
        <section className="agenda-calendar" aria-label="Calendario de reservas">
            <header className="agenda-calendar-head">
                <h2 aria-live="polite">{monthFormat.format(toDate(month))}</h2>
                <div className="agenda-calendar-controls">
                    <button type="button" className="agenda-today" onClick={() => selectDay(today)}>Hoy</button>
                    <button type="button" aria-label="Mes anterior" disabled={prevMonth < shiftMonth(today, 0)}
                        onClick={() => selectDay(prevMonth < today ? today : prevMonth)}>
                        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m10 3-5 5 5 5" /></svg>
                    </button>
                    <button type="button" aria-label="Mes siguiente" disabled={nextMonth > lastDay} onClick={() => selectDay(nextMonth)}>
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
                        className="agenda-calendar-day" onClick={() => selectDay(day)}>
                        <span>{index + 1}</span>
                        {count > 0 && <small aria-hidden="true">{count}<span> {count === 1 ? "reserva" : "reservas"}</span></small>}
                    </button>
                })}
            </div>
        </section>
        <section className="agenda-day-reservations" aria-labelledby="agenda-selected-day">
            <header>
                <h2 id="agenda-selected-day">{dateFormat.format(toDate(selected))}</h2>
                <p aria-live="polite">{appointments.length} {appointments.length === 1 ? "reserva" : "reservas"}</p>
            </header>
            {appointments.length > 0 && <ul className="agenda-appointment-list">
                {appointments.map(turno => <ReservaRow key={turno.id} turno={turno} fecha={selected} onClick={() => onTurnoClick(turno, selected)} />)}
            </ul>}
        </section>
    </div>
}

export function AgendaTurnos({ dias, onTurnoClick }: ReservasProps) {
    const [pendingOnly, setPendingOnly] = React.useState(false)
    const turnos = dias.flatMap(day => day.turnos.map(turno => ({ turno, fecha: day.fecha })))
    const pendientes = turnos.filter(({ turno }) => AgendaPanel_esPendienteAprobacion(turno) || turno.reprogramacion_pendiente)
    const visible = pendingOnly ? pendientes : turnos
    return <section className="agenda-turn-list" aria-label="Listado de turnos">
        <div className="agenda-turn-filters" role="group" aria-label="Filtrar turnos">
            <button type="button" aria-pressed={!pendingOnly} onClick={() => setPendingOnly(false)}>Todos <span>{turnos.length}</span></button>
            <button type="button" aria-pressed={pendingOnly} onClick={() => setPendingOnly(true)}>Pendientes <span>{pendientes.length}</span></button>
        </div>
        {visible.length === 0 ? <p className="agenda-empty-note" role="status">{pendingOnly ? "No hay turnos pendientes de revisión." : "No hay reservas para los próximos días."}</p>
            : <ul className="agenda-appointment-list">
                {visible.map(({ turno, fecha }) => <ReservaRow key={turno.id} turno={turno} fecha={fecha} showDate onClick={() => onTurnoClick(turno, fecha)} />)}
            </ul>}
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
            {statusOf(turno) && <div><dt>Estado</dt><dd>{statusOf(turno)}</dd></div>}
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
