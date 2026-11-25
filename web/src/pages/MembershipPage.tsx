import * as React from "react"
import { Link, useParams } from "react-router"
import BookingLogin from "../components/BookingLogin"
import BrandPreloader from "../components/BrandPreloader"
import { appConfig } from "../config"
import { MembershipCatalog, type Membership } from "./MembershipCatalog"
import "./BusinessLanding.css"

type Listing = { name: string; plans: Membership[] }

export default function MembershipPage() {
  const slug = (useParams().slug || "").trim().toLowerCase()
  const businessPath = `/${encodeURIComponent(slug)}`
  const [listing, setListing] = React.useState<Listing | null>(null)
  const [error, setError] = React.useState(false)
  const [retry, setRetry] = React.useState(0)

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
      setListing({ name: business.negocio.business_name || slug, plans: business.suspendido ? [] : catalog.membresias || [] })
    }).catch(() => {
      if (!controller.signal.aborted) setError(true)
    })
    return () => controller.abort()
  }, [businessPath, retry, slug])

  if (!listing && !error) return <BrandPreloader />

  return <main className="bl-page" style={{ paddingBottom: 32 }}>
    <header className="bl-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16 }}>
      <Link to={businessPath}>← Volver al negocio</Link>
      <BookingLogin api={appConfig.apiUrl} accent="var(--bl-ink)" />
    </header>
    <section className="bl-section" aria-labelledby="membership-title">
      <h1 id="membership-title" style={{ margin: "0 0 12px" }}>Suscripciones</h1>
      {error ? <><p>No pudimos cargar las suscripciones.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></> :
        listing && <>
          <p style={{ margin: "0 0 20px" }}>{listing.name}</p>
          {listing.plans.length ? <MembershipCatalog plans={listing.plans} /> : <p>No hay suscripciones disponibles.</p>}
        </>}
    </section>
  </main>
}
