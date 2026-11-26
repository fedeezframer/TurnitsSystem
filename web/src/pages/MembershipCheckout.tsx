import * as React from "react"
import { Link, useSearchParams } from "react-router"
import BookingLogin, { readBookingToken, saveBookingToken } from "../components/BookingLogin"
import BackButton from "../components/BackButton"
import BrandPreloader from "../components/BrandPreloader"
import { appConfig } from "../config"
import type { Membership } from "./MembershipCatalog"
import "./MembershipCheckout.css"

const CardPayment = React.lazy(() => import("../migrated/Booking").then(module => ({ default: module.BookingCardPayment })))
type Method = "mercadopago" | "tarjeta" | "transferencia" | "efectivo"
type Business = {
  business_name?: string; modo_agenda?: string; suspendido?: boolean; logo_url?: string
  tema?: { primario?: string }; metodos_pago_disponibles?: Method[]
  datos_bancarios?: { alias?: string; cbu?: string; titular?: string; banco?: string }
}
type PaymentState = { estado: string; nombre?: string; metodo?: Method; plan_id?: string }
type CardSession = { checkout_token: string; public_key: string; monto: number; email: string }
const methodData = {
  mercadopago: { label: "Mercado Pago", hint: "Pagá desde tu cuenta de Mercado Pago.", logo: appConfig.booking.logoMercadoPago },
  tarjeta: { label: "Tarjeta de crédito o débito", hint: "Completá el pago desde esta agenda.", logo: appConfig.booking.logoTarjeta },
  transferencia: { label: "Transferencia bancaria", hint: "Adjuntá el comprobante para que el negocio lo confirme.", logo: appConfig.booking.logoTransferencia },
  efectivo: { label: "Efectivo", hint: "Pagá en el local y el negocio confirmará el cobro.", logo: appConfig.booking.logoEfectivo },
}
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i

export default function MembershipCheckout({ slug, business }: { slug: string; business: Business }) {
  const [search, setSearch] = useSearchParams()
  const planId = search.get("suscripcion") || ""
  const order = search.get("pago") || ""
  const paymentId = search.get("payment_id") || ""
  const businessPath = `/${encodeURIComponent(slug)}`
  const endpoint = `${appConfig.apiUrl}/membresias${businessPath}`
  const [plan, setPlan] = React.useState<Membership | null | undefined>()
  const [status, setStatus] = React.useState<PaymentState | null>(null)
  const [token, setToken] = React.useState(readBookingToken)
  const [loginRequest, setLoginRequest] = React.useState(0)
  const [cardEnabled, setCardEnabled] = React.useState(false)
  const [card, setCard] = React.useState<CardSession | null>(null)
  const [method, setMethod] = React.useState<Method | "">("")
  const [proof, setProof] = React.useState<File | null>(null)
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const bank = business.datos_bancarios
  const methods = (business.metodos_pago_disponibles || []).flatMap(value =>
    value === "mercadopago" && cardEnabled ? [value, "tarjeta" as const] :
      value === "transferencia" && !bank?.alias && !bank?.cbu ? [] : [value])
  const chosen = methods.includes(method as Method) ? method : methods.length === 1 ? methods[0] : ""
  const accent = /^#[\da-f]{6}$/i.test(business.tema?.primario || "") ? business.tema!.primario! : "#196b1f"

  React.useEffect(() => { window.scrollTo(0, 0) }, [planId])

  React.useEffect(() => {
    const controller = new AbortController()
    if (!UUID.test(planId)) { setPlan(null); return }
    setPlan(undefined)
    fetch(endpoint, { signal: controller.signal, cache: "no-store" })
      .then(async res => {
        const result = await res.json()
        if (!res.ok || !result.success) throw new Error()
        if (!controller.signal.aborted) setPlan((result.membresias as Membership[]).find(item => item.id === planId) || null)
      }).catch(() => { if (!controller.signal.aborted) setPlan(null) })
    fetch(`${appConfig.apiUrl}/api/card-config`, { signal: controller.signal })
      .then(res => res.json()).then(result => { if (!controller.signal.aborted) setCardEnabled(result.enabled === true) }).catch(() => {})
    return () => controller.abort()
  }, [endpoint, planId])

  React.useEffect(() => {
    if (!UUID.test(order) || !token || (status && status.estado !== "pendiente")) return
    const controller = new AbortController()
    const check = async () => {
      try {
        const res = await fetch(`${endpoint}/pago/${order}?payment_id=${encodeURIComponent(paymentId)}`, {
          signal: controller.signal, cache: "no-store", headers: { Authorization: `Bearer ${token}` },
        })
        const result = await res.json()
        if (controller.signal.aborted) return
        if (res.status === 401) { saveBookingToken(""); setToken(""); return }
        if (res.status === 404) { setStatus({ estado: "no_encontrado" }); return }
        if (res.ok && result.success) setStatus(result)
      } catch {}
    }
    void check()
    const timer = window.setInterval(check, 7000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [endpoint, order, paymentId, token, status?.estado])

  const pay = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!plan || !chosen || busy) return
    setError("")
    if (!token) { setLoginRequest(value => value + 1); return }
    if (chosen === "transferencia" && !proof) { setError("Adjuntá el comprobante."); return }
    setBusy(true)
    const offline = chosen === "transferencia" || chosen === "efectivo"
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    let body: BodyInit | undefined
    if (!offline) {
      headers["Content-Type"] = "application/json"
      body = JSON.stringify({ metodo: chosen })
    } else if (proof && chosen === "transferencia") {
      const data = new FormData()
      data.append("comprobante", proof)
      body = data
    }
    try {
      const url = `${endpoint}/${plan.id}/${offline ? "pago-manual/" + chosen : "checkout"}`
      const res = await fetch(url, { method: "POST", headers, body })
      const result = await res.json()
      if (res.status === 401) {
        saveBookingToken("")
        setToken("")
        setLoginRequest(value => value + 1)
      }
      if (!res.ok || !result.success) throw new Error(result.error || "No se pudo iniciar el pago.")
      if (result.payment_url) window.location.assign(result.payment_url)
      else if (result.tarjeta) setCard(result.tarjeta)
      else if (result.pago) {
        setStatus({ estado: "pendiente", metodo: chosen, nombre: plan.nombre })
        setSearch({ suscripcion: plan.id, pago: result.pago }, { replace: true })
      } else throw new Error("No recibimos la confirmación del pago.")
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo iniciar el pago.")
    } finally { setBusy(false) }
  }

  if (plan === undefined && !order) return <BrandPreloader />

  const online = status?.metodo === "mercadopago" || !status?.metodo
  const returnUrl = businessPath + "#bl-memberships"
  const openForSale = !business.suspendido && business.modo_agenda !== "presupuesto"
  return <main className="membership-checkout" style={{ "--membership-accent": accent } as React.CSSProperties}>
    <header className="mc-header">
      <div className="mc-business">{business.logo_url && <img src={business.logo_url} alt="" />}<strong>{business.business_name || slug}</strong></div>
      <BookingLogin api={appConfig.apiUrl} slug={slug} accent={accent} loginRequest={loginRequest} onSession={setToken} />
    </header>
    <div className="mc-inner">
      <div className="mc-back"><BackButton aria-label="Volver a suscripciones" onClick={() => window.location.assign(returnUrl)} /><span>Suscripciones</span></div>
      <h1>Confirmá tu suscripción</h1>
      {order ? <div className="mc-status" role="status">
        <strong>{status?.nombre || plan?.nombre || "Estado del pago"}</strong>
        <p>{!token ? "Iniciá sesión para consultar el pago." : status?.estado === "activo" ? "Pago confirmado. Tus tickets ya están disponibles." :
          status?.estado === "no_encontrado" ? "Este pago no está disponible para tu cuenta." :
          status?.estado === "revertido" || status?.estado === "vencido" ? "El pago no quedó activo." :
          !online ? "El pago está pendiente de confirmación del negocio." : "Estamos verificando el pago con Mercado Pago."}</p>
        {!token && <button type="button" className="mc-button" onClick={() => setLoginRequest(value => value + 1)}>Iniciar sesión</button>}
        {status?.estado === "activo" && <Link className="mc-button" to={`/agenda${businessPath}`}>Reservar con tickets</Link>}
        {status && ["revertido", "vencido"].includes(status.estado) && plan && <button className="mc-button" onClick={() => {
          setStatus(null); setSearch({ suscripcion: plan.id }, { replace: true })
        }}>Volver al checkout</button>}
      </div> : !plan || !openForSale ? <p>Esta suscripción ya no está disponible.</p> : <div className="mc-grid">
        <form className="mc-card" onSubmit={pay}>
          <h2>Método de pago</h2>
          {methods.length === 0 ? <p>El negocio todavía no configuró un medio de pago.</p> : <fieldset className="mc-methods" aria-label="Método de pago" disabled={busy}>
            {methods.map(item => <label key={item} data-selected={chosen === item}>
              <img src={methodData[item].logo} alt="" />
              <span><b>{methodData[item].label}</b><small>{methodData[item].hint}</small></span>
              <input type="radio" name="membership-method" value={item} checked={chosen === item} onChange={() => { setMethod(item); setError("") }} />
            </label>)}
          </fieldset>}
          {chosen === "transferencia" && <div className="mc-bank">
            {bank?.titular && <div>Titular: <b>{bank.titular}</b></div>}
            {bank?.banco && <div>Banco: <b>{bank.banco}</b></div>}
            {bank?.alias && <div>Alias: <b>{bank.alias}</b></div>}
            {bank?.cbu && <div>CBU: <b>{bank.cbu}</b></div>}
            <label>Comprobante<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
              const file = event.target.files?.[0] || null
              if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024)) {
                setError("Adjuntá una imagen JPG, PNG o WEBP de hasta 3 MB."); event.target.value = ""; setProof(null)
              } else { setError(""); setProof(file) }
            }} /></label>
          </div>}
          {error && <p className="mc-error" role="alert">{error}</p>}
          <button className="mc-button" disabled={!chosen || busy} type="submit">
            {busy ? "Procesando…" : !token ? "Iniciar sesión para continuar" : chosen === "efectivo" ? "Elegir pago en el local" :
              chosen === "transferencia" ? "Enviar comprobante" : chosen === "tarjeta" ? "Continuar con tarjeta" : "Continuar a Mercado Pago"}
          </button>
        </form>
        <aside className="mc-card mc-summary" aria-label="Resumen de la compra">
          <h2>Resumen de la compra</h2>
          {plan.imagen_url && <img src={plan.imagen_url} alt="" />}
          <div><strong>{plan.nombre}</strong><p>Vigencia de un mes · renovación manual</p></div>
          <ul>
            {(plan.servicios_incluidos || plan.servicios.map(nombre => ({ nombre, cantidad: 1 }))).map((item, i) => <li key={`s${i}`}>{item.cantidad} × {item.nombre}</li>)}
            {(plan.productos_incluidos || plan.productos.map(nombre => ({ nombre, cantidad: 1 }))).map((item, i) => <li key={`p${i}`}>{item.cantidad} × {item.nombre}</li>)}
          </ul>
          <div className="mc-total"><span>Total del mes</span><strong>{money.format(plan.precio_mensual)}</strong></div>
        </aside>
      </div>}
    </div>
    {card && <React.Suspense fallback={<BrandPreloader />}><CardPayment session={card} api={appConfig.apiUrl}
      accent={accent} authorization={`Bearer ${token}`} paymentPath={`/membresias${businessPath}/tarjeta`}
      statusPath={`/membresias${businessPath}/tarjeta/estado`} onClose={() => setCard(null)} /></React.Suspense>}
  </main>
}
