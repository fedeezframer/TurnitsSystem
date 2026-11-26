import * as React from "react"
import { Link, useParams, useSearchParams } from "react-router"
import BookingLogin, { readBookingToken } from "../components/BookingLogin"
import { fetchMembershipTickets, ticketCount, type MembershipTickets } from "../shared/membership-tickets"
import BrandPreloader from "../components/BrandPreloader"
import { appConfig } from "../config"
import { MembershipCatalog, type Membership } from "./MembershipCatalog"
import "./BusinessLanding.css"

type Listing = { name: string; plans: Membership[]; canPurchase: boolean }

export default function MembershipPage() {
  const slug = (useParams().slug || "").trim().toLowerCase()
  const businessPath = `/${encodeURIComponent(slug)}`
  const [listing, setListing] = React.useState<Listing | null>(null)
  const [error, setError] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const [token, setToken] = React.useState(readBookingToken)
  const [plans, setPlans] = React.useState<MembershipTickets[]>([])
  const [paymentState, setPaymentState] = React.useState("")
  const [search] = useSearchParams()
  const order = search.get("pago") || ""
  const payment = search.get("payment_id") || ""
  const base = `${appConfig.apiUrl}/membresias${businessPath}`

  React.useEffect(() => {
    const controller = new AbortController()
    setListing(null)
    setError(false)
    const get = async (path: string) => {
      const res = await fetch(`${appConfig.apiUrl}/${path}${businessPath}`, { signal: controller.signal, cache: "no-store" })
      if (!res.ok) throw new Error()
      return res.json()
    }
    Promise.all([get("negocio"), get("membresias")]).then(([business, catalog]) => {
      if (controller.signal.aborted) return
      if (!business.success || !business.negocio || !catalog.success) throw new Error()
      setListing({ name: business.negocio.business_name || slug, plans: business.suspendido ? [] : catalog.membresias || [], canPurchase: business.negocio.modo_agenda !== "presupuesto" })
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    })
    return () => controller.abort()
  }, [businessPath, retry, slug])

  React.useEffect(() => {
    if (!token) { setPlans([]); return }
    const controller = new AbortController()
    fetchMembershipTickets(appConfig.apiUrl, slug, `Bearer ${token}`, controller.signal)
      .then(result => { if (!controller.signal.aborted) setPlans(result) }).catch(() => {})
    return () => controller.abort()
  }, [slug, token, paymentState])

  React.useEffect(() => {
    if (!order || !token || ["activo", "vencido", "revertido"].includes(paymentState)) return
    const controller = new AbortController()
    const check = async () => {
      try {
        const res = await fetch(`${base}/pago/${encodeURIComponent(order)}?payment_id=${encodeURIComponent(payment)}`, {
          signal: controller.signal, headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
        })
        const data = await res.json()
        if (controller.signal.aborted) return
        if (res.ok && data.success) setPaymentState(data.estado)
      } catch {}
    }
    void check()
    const timer = window.setInterval(check, 5000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [base, order, payment, token, paymentState])

  if (!listing && !error) return <BrandPreloader />

  return <main className="bl-page" style={{ paddingBottom: 32 }}>
    <header className="bl-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16 }}>
      <Link to={businessPath}>← Volver al negocio</Link>
      <BookingLogin api={appConfig.apiUrl} slug={slug} accent="var(--bl-ink)" onSession={setToken} />
    </header>
    <section className="bl-section" aria-labelledby="membership-title">
      <h1 id="membership-title" style={{ margin: "0 0 12px" }}>Suscripciones</h1>
      {error ? <><p>No pudimos cargar las suscripciones.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></> :
        listing && <>
          <p style={{ margin: "0 0 20px" }}>{listing.name}</p>
          {order && <p role="status">{!token ? "Iniciá sesión para consultar el estado del pago." :
            paymentState === "activo" ? "Pago aprobado. Tus tickets aparecen en Mis tickets." :
              paymentState === "vencido" || paymentState === "revertido" ? "El pago no quedó activo." : "Estamos verificando el pago con Mercado Pago."}</p>}
          {plans.length > 0 && <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 8px" }}>Mis tickets</h2>
            {plans.map(plan => <div key={plan.id} style={{ marginBottom: 10 }}>
              <b>{plan.nombre}</b> · {ticketCount(plan.servicios)} para servicios · {ticketCount(plan.productos)} para productos
              <div><Link style={{ color: "var(--bl-ink)", fontWeight: 700 }} to={`/agenda${businessPath}`}>Reservar con tickets →</Link></div>
            </div>)}
          </div>}
          {listing.plans.length ? <MembershipCatalog plans={listing.plans} action={plan =>
            !listing.canPurchase ? null : plans.some(period => period.membresia_id === plan.id) ? <Link className="bl-reserve" to={`/agenda${businessPath}`}>Usar mis tickets →</Link> :
              <Link className="bl-membership-buy" to={`/agenda${businessPath}?suscripcion=${encodeURIComponent(plan.id)}`}>Comprar ↗</Link>
          } /> : <p>No hay suscripciones disponibles.</p>}
        </>}
    </section>
  </main>
}
