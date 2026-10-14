import React from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { appConfig } from "../config"
import "./Receipt.css"

type ReceiptState = "confirmed" | "pending" | "cancelled" | "rejected"
const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const money = (value: unknown) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value) || 0)
function formatDate(value: string) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number)
  if (!year || !month || !day) return ""
  return `${weekdays[new Date(year, month - 1, day).getDay()]} ${day} de ${months[month - 1]}`
}
function reservationState(turno: any): ReceiptState {
  if (turno.estado === "cancelado") return "cancelled"
  if (turno.pago_estado === "rechazado") return "rejected"
  if (["confirmado", "completado"].includes(turno.estado)) return "confirmed"
  return "pending"
}
function StatusIcon({ state }: { state: ReceiptState | "loading" | "unavailable" }) {
  return <div className={`receipt-status receipt-status-${state}`} aria-hidden="true">
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {state === "confirmed" ? <path d="m5 12 4 4 10-10" /> : ["cancelled", "rejected"].includes(state) ? <path d="m5 5 14 14M19 5 5 19" /> : <><path d="M5 2h14M5 22h14M7 2v5l10 10v5M17 2v5L7 17v5" /></>}
    </svg>
  </div>
}
function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "paid" | "due" }) {
  return <div className="receipt-row"><dt>{label}</dt><dd className={tone ? `receipt-value-${tone}` : undefined}>{children}</dd></div>
}
function PriceDetails({ turno }: { turno: any }) {
  const total = Number(turno.precio_cobrado) || 0, paid = Number(turno.monto_pagado) || 0
  // The API supplies the remaining balance, including partial payments.
  const due = Number(turno.monto_pendiente_local ?? Math.max(total - paid, 0)) || 0
  const approved = turno.pago_estado === "aprobado"
  const method = ({ mercadopago: "Mercado Pago", transferencia: "Transferencia bancaria", efectivo: "Efectivo" } as Record<string, string>)[turno.metodo_pago]
  const extras = Array.isArray(turno.extras) ? turno.extras : []
  if (!total && !paid) return null
  return <>
    <div className="receipt-divider" />
    {extras.length > 0 && <Row label="Servicio">{money(Math.max(total - Number(turno.monto_extras || 0), 0))}</Row>}
    {approved && paid > 0 ? <>
      {due > 0 && <Row label="Precio total">{money(total)}</Row>}
      <Row label={due > 0 ? "Seña abonada" : extras.length ? "Total abonado (servicio + productos)" : "Total abonado"} tone="paid">{money(paid)}</Row>
      {method && <Row label="Método de pago">{method}</Row>}
      {due > 0 && <Row label="Saldo a pagar en el turno" tone="due">{money(due)}</Row>}
    </> : <>
      <Row label={extras.length ? "Total a abonar (servicio + productos)" : "Total a abonar"}>{money(due)}</Row>
      {method && <Row label="Forma de pago">{turno.metodo_pago === "efectivo" ? "Pagás en efectivo en el local" : method}</Row>}
    </>}
  </>
}

export default function Receipt({ failed = false }: { failed?: boolean }) {
  const location = useLocation(), navigate = useNavigate()
  const query = new URLSearchParams(location.search)
  const slug = query.get("slug") || query.get("u") || ""
  const id = query.get("turno_id") || "", paymentId = query.get("payment_id") || query.get("collection_id") || ""
  const requestKey = `${slug}/${id}/${paymentId}`
  const [snapshot, setSnapshot] = React.useState<any>(null)
  const turno = snapshot?.key === requestKey ? snapshot.turno : null
  const [error, setError] = React.useState(""), [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    setSnapshot(null); setError(""); setLoading(true)
    if (!slug || (!id && !paymentId)) {
      setLoading(false); setError("No se encontró la información de la reserva. Revisá el enlace que recibiste."); return
    }
    const controller = new AbortController()
    let timer: number | undefined, misses = 0, latest: any = null
    const load = async () => {
      try {
        const path = id ? `/turnos/publico/${encodeURIComponent(id)}?slug=${encodeURIComponent(slug)}` : `/turnos/by-payment?payment_id=${encodeURIComponent(paymentId)}&slug=${encodeURIComponent(slug)}`
        const response = await fetch(appConfig.apiUrl + path, { signal: controller.signal, cache: "no-store" })
        const data = await response.json()
        if (!response.ok || !data.success || !data.turno || (id && data.turno.id !== id)) throw new Error("Reserva no disponible")
        if (controller.signal.aborted) return
        latest = data.turno; misses = 0
        setSnapshot({ key: requestKey, turno: latest }); setError(""); setLoading(false)
        if (reservationState(latest) === "pending") timer = window.setTimeout(load, 5000)
      } catch {
        if (controller.signal.aborted) return
        if (++misses < 10) timer = window.setTimeout(load, 5000)
        else { setLoading(false); setError(latest ? "No pudimos actualizar el estado. Conservá este comprobante y consultá al negocio." : "Todavía no pudimos confirmar la reserva. Si pagaste, conservá el comprobante y contactá al negocio.") }
      }
    }
    load()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [slug, id, paymentId, requestKey])
  const state = turno ? reservationState(turno) : null
  React.useEffect(() => {
    if (!state) return
    const destination = state === "confirmed" ? "/success" : state === "pending" ? "/pendiente" : "/alert"
    if (location.pathname === destination) return
    // Only identifiers travel in the redirect; client-supplied names,
    // amounts and payment statuses never confirm a reservation.
    const params = new URLSearchParams({ slug })
    if (turno.id) params.set("turno_id", turno.id)
    else if (paymentId) params.set("payment_id", paymentId)
    navigate(`${destination}?${params}`, { replace: true })
  }, [state, turno?.id, slug, paymentId, location.pathname, navigate])
  const visual = state || (loading ? "loading" : "unavailable")
  const title = state === "confirmed" ? "Turno Confirmado" : state === "pending" ? "Turno Pendiente" : state === "cancelled" ? "Tu turno fue cancelado" : state === "rejected" ? "El pago fue rechazado" : loading ? "Consultando tu reserva…" : failed ? "No pudimos verificar la reserva" : "Comprobante no disponible"
  const fullName = turno ? [turno.nombre, turno.apellido].filter(Boolean).join(" ") : ""
  const extras = Array.isArray(turno?.extras) ? turno.extras : []
  const message = state === "confirmed"
    ? turno.metodo_pago === "efectivo" ? "Por favor, sé puntual. Pagás en efectivo en el local. Si necesitás reprogramar, hacelo desde tu correo electrónico." : "Por favor, sé puntual. Si necesitás reprogramar, hacelo desde tu correo electrónico."
    : state === "pending" ? turno.pago_estado === "aprobado" ? "Tu pago está aprobado. La reserva espera la confirmación del prestador." : "Ya hemos notificado al prestador, esperá su aprobación."
    : state === "cancelled" ? "Cualquier pago realizado se coordina por separado con el negocio."
    : state === "rejected" ? "No se pudo confirmar el pago. Podés intentar reservar de nuevo." : ""
  return <div className="receipt-page">
    <header className="receipt-header"><Link to="/" aria-label="Turnits, volver al inicio">turnits</Link></header>
    <main className="receipt-main"><section className={`receipt-card${turno ? " receipt-card-with-details" : ""}`} aria-labelledby="receipt-title">
      <StatusIcon state={visual} /><h1 id="receipt-title" className={`receipt-title receipt-title-${visual}`}>{title}</h1>
      {loading && <p role="status" className="receipt-loading">Estamos consultando la información de tu reserva.</p>}
      {error && <p role="alert" className="receipt-error">{error}</p>}
      {turno && <div className="receipt-information">
        {message && <p className="receipt-message" role="status">{message}</p>}
        <dl className="receipt-details">
          {fullName && <Row label="Nombre">{fullName}</Row>}
          {turno.email && <Row label="Email">{turno.email}</Row>}
          {turno.telefono && <Row label="Teléfono">{turno.telefono}</Row>}
          {turno.fecha && <Row label="Día">{formatDate(turno.fecha)}</Row>}
          {turno.hora && <Row label="Hora">{String(turno.hora).slice(0, 5)} hs</Row>}
          {turno.servicio_nombre && <Row label="Servicio">{turno.servicio_nombre}</Row>}
          {extras.length > 0 && <><div className="receipt-divider" /><Row label="Productos adicionales"><ul className="receipt-extras">{extras.map((extra: any, index: number) => <li key={extra.id || index}>
            <span>{Number(extra.cantidad) > 1 ? `${extra.cantidad} × ` : ""}{extra.nombre}</span><span>{money(extra.precio)}</span>
          </li>)}</ul></Row></>}
          {state !== "cancelled" && state !== "rejected" && <PriceDetails turno={turno} />}
        </dl>
        {turno.id && <p className="receipt-code">Turno N.º {String(turno.id).slice(0, 8).toUpperCase()}</p>}
      </div>}
      <Link className="receipt-back" to="/">Volver al Inicio <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></Link>
    </section></main>
  </div>
}
