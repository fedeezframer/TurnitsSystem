import * as React from "react"
import { useNavigate, useSearchParams } from "react-router"
import BookingLogin, { readBookingToken, saveBookingToken } from "../components/BookingLogin"
import BackButton from "../components/BackButton"
import BrandPreloader from "../components/BrandPreloader"
import { appConfig } from "../config"
import type { Membership } from "./MembershipCatalog"
import {
  BookingCardPayment, BookingCheckoutFrame, BookingCheckoutHeader, BookingCheckoutSummary,
  FilaResumen, FillButton, PagoBlock, StepTitle, DEFAULT_TEMA, type BookingHeaderBusiness,
} from "../migrated/Booking"
type Method = "mercadopago" | "tarjeta" | "transferencia" | "efectivo"
type Business = Omit<BookingHeaderBusiness, "business_name" | "logo_url"> & {
  business_name?: string; modo_agenda?: string; suspendido?: boolean; logo_url?: string | null
  metodos_pago_disponibles?: Method[]
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
  const navigate = useNavigate()
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
  const [fileError, setFileError] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const bank = business.datos_bancarios
  const methods = (business.metodos_pago_disponibles || []).flatMap(value =>
    value === "mercadopago" && cardEnabled ? [value, "tarjeta" as const] :
      value === "transferencia" && !bank?.alias && !bank?.cbu ? [] : [value])
  const chosen = methods.includes(method as Method) ? method : methods.length === 1 ? methods[0] : ""
  const accent = /^#[\da-f]{6}$/i.test(business.tema?.primario || "") ? business.tema!.primario! : DEFAULT_TEMA.primario

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

  const pay = async () => {
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
  const header = <BookingCheckoutHeader business={{ ...business, business_name: business.business_name || slug, logo_url: business.logo_url || null }} accent={accent} />
  const buttonStyle = { width: "100%", marginTop: 4, padding: 14, borderRadius: 12, fontSize: 14, fontWeight: 700 }
  const left = <>
    {header}
    <BackButton aria-label="Volver a suscripciones" onClick={() => navigate(returnUrl)} />
    <BookingLogin api={appConfig.apiUrl} slug={slug} loginRequest={loginRequest} onSession={setToken} />
    <StepTitle title={order ? "Estado de tu suscripción" : "Confirmá tu suscripción"} />
    {order ? <div role="status" style={{ display: "grid", gap: 12, color: "var(--bf-text)" }}>
      <strong>{status?.nombre || plan?.nombre || "Estado del pago"}</strong>
      <small>{!token ? "Iniciá sesión para consultar el pago." : status?.estado === "activo" ? "Pago confirmado. Tus tickets ya están disponibles." :
        status?.estado === "no_encontrado" ? "Este pago no está disponible para tu cuenta." :
        status?.estado === "revertido" || status?.estado === "vencido" ? "El pago no quedó activo." :
        !online ? "El pago está pendiente de confirmación del negocio." : "Estamos verificando el pago con Mercado Pago."}</small>
      {!token && <FillButton fill={accent} style={buttonStyle} onClick={() => setLoginRequest(value => value + 1)}>Iniciar sesión</FillButton>}
      {status?.estado === "activo" && <FillButton fill={accent} style={buttonStyle} onClick={() => navigate(`/agenda${businessPath}`)}>Reservar con tickets</FillButton>}
      {status && ["revertido", "vencido"].includes(status.estado) && plan && <FillButton fill={accent} style={buttonStyle} onClick={() => {
        setStatus(null); setSearch({ suscripcion: plan.id }, { replace: true })
      }}>Volver al checkout</FillButton>}
    </div> : !plan || !openForSale ? <p style={{ color: "var(--bf-text)" }}>Esta suscripción ya no está disponible.</p> :
      <div style={{ display: "grid", gap: 10, color: "var(--bf-text)" }}>
        {plan.imagen_url && <img src={plan.imagen_url} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 16 }} />}
        <strong>{plan.nombre}</strong><small>Vigencia de un mes · renovación manual</small>
      </div>}
  </>
  const right = !order && plan && openForSale ? <>
    <BookingCheckoutSummary title="Resumen de la suscripción">
      <strong>{plan.nombre}</strong>
      {[...(plan.servicios_incluidos || plan.servicios.map(nombre => ({ nombre, cantidad: 1 }))),
        ...(plan.productos_incluidos || plan.productos.map(nombre => ({ nombre, cantidad: 1 })))].map((item, index) =>
          <span key={index} style={{ color: "#4B5563", fontSize: 13 }}>{item.cantidad} × {item.nombre}</span>)}
      <div style={{ height: 1, background: "#E5E7EB", margin: "8px 0" }} />
      <FilaResumen label="Total a pagar" valor={money.format(plan.precio_mensual)} />
    </BookingCheckoutSummary>
    {methods.length === 0 ? <p style={{ color: "var(--bf-text)" }}>El negocio todavía no configuró un medio de pago.</p> : <>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", textTransform: "uppercase" }}>Método de pago</div>
      <div role="radiogroup" aria-label="Método de pago">
        <PagoBlock metodos={methods.map(key => ({ key, label: methodData[key].label, detalle: methodData[key].hint }))}
          seleccionado={chosen} onSelect={(value: Method) => { setMethod(previous => previous === value ? "" : value); setError(""); setFileError("") }}
          logos={Object.fromEntries(Object.entries(methodData).map(([key, item]) => [key, item.logo]))}
          iconoAdjuntar={appConfig.booking.iconoAdjuntar} datosBancarios={bank} comprobante={proof} errorArchivo={fileError}
          onArchivo={(file: File | null) => {
            if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024)) {
              setFileError("Adjuntá una imagen JPG, PNG o WEBP de hasta 3 MB."); setProof(null)
            } else { setFileError(""); setProof(file) }
          }} onQuitarArchivo={() => { setFileError(""); setProof(null) }}
          montoATransferir={plan.precio_mensual} accent={accent} subscription disabled={busy} />
      </div>
    </>}
    {error && <div role="alert" style={{ fontSize: 12.5, color: "#DC2626" }}>{error}</div>}
    <FillButton fill={accent} style={buttonStyle} disabled={!chosen || busy} onClick={() => void pay()}>
      {busy ? "Procesando…" : !token ? "Iniciar sesión para continuar" : chosen === "efectivo" ? "Elegir pago en el local" :
        chosen === "transferencia" ? "Enviar comprobante" : chosen === "tarjeta" ? "Continuar con tarjeta" : "Continuar a Mercado Pago"}
    </FillButton>
  </> : undefined

  return <>
    <BookingCheckoutFrame theme={business.tema} left={left} right={right} />
    {card && <BookingCardPayment session={card} api={appConfig.apiUrl} accent={accent} authorization={`Bearer ${token}`}
      paymentPath={`/membresias${businessPath}/tarjeta`} statusPath={`/membresias${businessPath}/tarjeta/estado`} onClose={() => setCard(null)} />}
  </>
}
