import React from "react"
import { appConfig } from "../config"
import { Link } from "react-router"
export default function Receipt({ failed = false }: { failed?: boolean }) {
  const [turno, setTurno] = React.useState<any>(null)
  const [error, setError] = React.useState("")
  const query = new URLSearchParams(window.location.search)
  const slug = query.get("slug") || query.get("u") || ""
  const id = query.get("turno_id"), paymentId = query.get("payment_id") || query.get("collection_id")
  React.useEffect(() => {
    if (failed) return
    if (!slug || (!id && !paymentId)) { setError("No hay datos suficientes para consultar el turno. Revisá el enlace que recibiste."); return }
    const controller = new AbortController(); let timer: number | undefined, attempts = 0
    const load = async () => {
      attempts++
      try {
        const path = id ? `/turnos/publico/${encodeURIComponent(id)}?slug=${encodeURIComponent(slug)}` : `/turnos/by-payment?payment_id=${encodeURIComponent(paymentId!)}&slug=${encodeURIComponent(slug)}`
        const r = await fetch(appConfig.apiUrl + path, { signal: controller.signal }); const data = await r.json()
        if (!r.ok || !data.success || !data.turno) throw Error("Todavía no pudimos confirmar el turno. Si pagaste, conservá el comprobante y contactá al negocio.")
        if (!controller.signal.aborted) setTurno(data.turno)
      } catch (e) {
        if (controller.signal.aborted) return
        if (attempts < 10) timer = window.setTimeout(load, 3000)
        else setError(e instanceof Error ? e.message : "No se pudo consultar el turno.")
      }
    }
    load(); return () => { controller.abort(); window.clearTimeout(timer) }
  }, [slug, id, paymentId, failed])
  const confirmed = turno && ["confirmado", "completado"].includes(turno.estado)
  return <main className="app-page"><section className="app-card"><img className="app-brand" src={appConfig.logoUrl} alt="Turnits" /><h1>{failed ? "El pago no se completó" : confirmed ? "Tu turno está confirmado" : turno ? "Tu reserva está pendiente" : "Consultando tu reserva…"}</h1>
    {failed && <p>Podés volver a la agenda y elegir otro medio de pago.</p>}
    {error && <p role="alert">{error}</p>}
    {turno && <><p>{turno.servicio_nombre}<br />{turno.fecha} · {turno.hora}</p><p>Estado del pago: {turno.pago_estado || "sin pago online"}</p>{Number(turno.monto_pendiente_local)>0 && <p>Saldo en el local: ${Number(turno.monto_pendiente_local).toLocaleString("es-AR")}</p>}</>}
    {slug && <Link className="app-button" to={`/agenda/${encodeURIComponent(slug)}`}>Volver a la agenda</Link>}
  </section></main>
}
