import * as React from "react"
import { Link, useParams } from "react-router"
import { appConfig } from "../config"
import BrandPreloader from "../components/BrandPreloader"
import { SocialIcon } from "../components/SocialIcon"
import { enlacesPublicos } from "../shared/socials.js"
import { promoDaysLabel } from "../shared/promotions.js"
import "./BusinessLanding.css"

// Página pública del negocio: turnits.com/{slug}
// Reúne lo que más impacta en la reserva (Offer por subasta, combos y
// promociones) con datos que el negocio ya configura desde el panel.

const DEFAULT_COLOR = "#196b1f"
const money = (value: number) => `$${Number(value || 0).toLocaleString("es-AR")}`

interface Offer {
  id: string
  slug: string
  servicio_id: string
  equipo_id: string
  sucursal_id?: string
  nombre: string
  precio: number
  precio_original: number
  fecha: string
  hora: string
  cierre: string
  imagen?: string | null
}
interface Promo {
  id: string
  nombre: string
  tipo: "combo" | "descuento"
  servicio_id: string
  precio_original: number
  precio_final: number
  dias_semana?: number[] | null
  items?: { id: string; tipo: string; nombre: string; cantidad: number }[]
  imagenes?: { id: string; tipo: string; url: string }[]
}

async function getJson(path: string, signal?: AbortSignal) {
  const response = await fetch(`${appConfig.apiUrl}${path}`, { signal, cache: "no-store" })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) throw new Error(data?.error || "No disponible")
  return data
}

function readableOn(color: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#14201a" : "#ffffff"
}
function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(total / 3600))}h ${pad(Math.floor((total % 3600) / 60))}m ${pad(total % 60)}s`
}
function offerLink(slug: string, offer: Offer) {
  const params = new URLSearchParams({
    servicio_id: offer.servicio_id,
    equipo_id: offer.equipo_id,
    fecha: offer.fecha,
    hora: offer.hora,
    browse_offer_id: offer.id,
    ...(offer.sucursal_id ? { sucursal_id: offer.sucursal_id } : {}),
  })
  return `/agenda/${encodeURIComponent(slug)}?${params}`
}

function NotFound({ message, detail }: { message: string; detail: string }) {
  return (
    <main className="app-page">
      <section className="app-card">
        <img className="app-brand" src={appConfig.logoUrl} alt="Turnits" />
        <h1>{message}</h1>
        <p>{detail}</p>
        <Link className="app-button" to="/">Ir a Turnits</Link>
      </section>
    </main>
  )
}

export default function BusinessLanding() {
  const slug = (useParams().slug || "").trim().toLowerCase()
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "paused">("loading")
  const [negocio, setNegocio] = React.useState<any>(null)
  const [perfil, setPerfil] = React.useState<any>(null)
  const [reviews, setReviews] = React.useState({ promedio: 0, cantidad: 0 })
  const [promos, setPromos] = React.useState<Promo[]>([])
  const [offers, setOffers] = React.useState<Offer[]>([])
  const [offset, setOffset] = React.useState(0)
  const [now, setNow] = React.useState(() => Date.now())
  const [logoFailed, setLogoFailed] = React.useState(false)

  React.useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    setState("loading"); setNegocio(null); setPerfil(null); setPromos([]); setOffers([]); setLogoFailed(false)
    const s = encodeURIComponent(slug)
    Promise.allSettled([
      getJson(`/negocio/${s}`, controller.signal),
      getJson(`/perfil/${s}`, controller.signal),
      getJson(`/perfil/${s}/resenas`, controller.signal),
      getJson(`/promociones/${s}`, controller.signal),
    ]).then(([biz, profile, rev, promo]) => {
      if (controller.signal.aborted) return
      if (biz.status !== "fulfilled" || !biz.value.negocio) return setState("missing")
      if (biz.value.suspendido) return setState("paused")
      setNegocio(biz.value.negocio)
      if (profile.status === "fulfilled") setPerfil(profile.value.perfil)
      if (rev.status === "fulfilled") setReviews({ promedio: rev.value.promedio || 0, cantidad: rev.value.cantidad || 0 })
      if (promo.status === "fulfilled") setPromos(promo.value.promociones || [])
      setState("ready")
    })
    return () => controller.abort()
  }, [slug])

  const loadOffers = React.useCallback(() => {
    if (!slug) return
    getJson(`/browse/ofertas?slug=${encodeURIComponent(slug)}`)
      .then(data => {
        setOffset(Date.parse(data.server_time) - Date.now() || 0)
        // Defensa extra: si la API todavía no soporta ?slug=, nunca mostrar ofertas de otros negocios.
        setOffers((data.ofertas || []).filter((o: Offer) => o.slug === slug).sort((a: Offer, b: Offer) => Date.parse(a.cierre) - Date.parse(b.cierre)))
      })
      .catch(() => setOffers([]))
  }, [slug])
  React.useEffect(() => {
    // Pagar una Offer requiere cuenta de cliente: sólo se muestra si esa experiencia está habilitada.
    if (state !== "ready" || !appConfig.customerExperienceEnabled) return
    loadOffers()
    const refresh = window.setInterval(loadOffers, 60000)
    return () => window.clearInterval(refresh)
  }, [state, loadOffers])
  React.useEffect(() => {
    if (!offers.length) return
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [offers.length])

  const title = perfil?.nombre || negocio?.business_name
  React.useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} | Turnits`
    return () => { document.title = previous }
  }, [title])

  const serverNow = now + offset
  const liveOffers = offers.filter(o => Date.parse(o.cierre) > serverNow).slice(0, 3)
  React.useEffect(() => {
    if (offers.length && offers.some(o => Date.parse(o.cierre) <= serverNow)) loadOffers()
  }, [serverNow > 0 && offers.some(o => Date.parse(o.cierre) <= serverNow), loadOffers])

  if (!slug || state === "missing") return <NotFound message="No encontramos este negocio" detail="Revisá el enlace o buscá el negocio desde Turnits." />
  if (state === "paused") return <NotFound message="Agenda no disponible por ahora" detail="Este negocio pausó temporalmente sus reservas." />
  if (state === "loading") return <BrandPreloader />

  const color = /^#[0-9a-f]{6}$/i.test(negocio?.tema?.primario || "") ? negocio.tema.primario : DEFAULT_COLOR
  const style = { "--bl-color": color, "--bl-on": readableOn(color) } as React.CSSProperties
  const name = title || "Negocio"
  const logo = !logoFailed && (negocio?.logo_url || perfil?.foto_perfil_url)
  const tagline = (perfil?.descripcion || perfil?.categoria || "").trim()
  const address = [perfil?.direccion, [perfil?.ciudad, perfil?.provincia].filter(Boolean).join(", ")].filter(Boolean)
  const socials = perfil ? enlacesPublicos(perfil) : []
  const combos = promos.filter(p => p.tipo === "combo")
  const discounts = promos.filter(p => p.tipo === "descuento")
  const enc = encodeURIComponent(slug)
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  const today = new Date().toLocaleDateString("es-AR", { day: "numeric", timeZone: "America/Argentina/Buenos_Aires" })

  const promoCard = (p: Promo) => (
    <Link key={p.id} className="bl-promo" to={`/agenda/${enc}?${new URLSearchParams({ servicio_id: p.servicio_id })}`}>
      <div className="bl-promo-img">{p.imagenes?.[0]?.url && <img src={p.imagenes[0].url} alt="" loading="lazy" />}</div>
      <div className="bl-promo-body">
        <strong>{p.nombre}</strong>
        {p.tipo === "combo" && !!p.items?.length && <small>{p.items.map(i => `${i.cantidad > 1 ? `${i.cantidad} × ` : ""}${i.nombre}`).join(" + ")}</small>}
        {p.dias_semana != null && <small>{promoDaysLabel(p.dias_semana)}</small>}
        <span><b>{money(p.precio_final)}</b>{p.precio_original > p.precio_final && <s>{money(p.precio_original)}</s>}</span>
      </div>
    </Link>
  )

  return (
    <main className="bl-page" style={style}>
      <div className="bl-wrap">
        <nav className="bl-nav" aria-label="Secciones">
          <Link to={`/perfil/${enc}`}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1.5-2.5 3.2-3.5 5.5-3.5s4 1 5.5 3.5" /></svg>Perfil</Link>
          {combos.length > 0 && <button type="button" onClick={() => goTo("bl-combos")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="12" height="12" rx="2" /><path d="M9 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" /></svg>Combos</button>}
          {discounts.length > 0 && <button type="button" onClick={() => goTo("bl-promos")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 1.6 2.6-.2.9 2.4 2.3 1.3-.6 2.5 1 2.4-1.8 1.9-.2 2.6-2.5.6L12 21l-2.2-1.6-2.5-.6-.2-2.6-1.8-1.9 1-2.4-.6-2.5 2.3-1.3.9-2.4 2.6.2z" /><path d="m9.5 14.5 5-5M9.7 9.7h.01M14.3 14.3h.01" /></svg>Promociones</button>}
        </nav>

        <header className="bl-bar">
          <Link className="bl-reserve" to={`/agenda/${enc}`}>Reservar Ahora</Link>
        </header>

        <section className="bl-hero">
          <div className="bl-logo">{logo ? <img src={logo} alt={`Logo de ${name}`} onError={() => setLogoFailed(true)} /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}</div>
          <h1>{name}</h1>
          {tagline && <p className="bl-tagline">{tagline}</p>}
          <div className="bl-info">
            {address.length > 0 && (
              <div className="bl-info-item">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 12 3.5 6.5 6.5 0 0 1 18.5 10c0 5.400-6.500 11-6.500 11Z" /><circle cx="12" cy="10" r="2.400" /></svg>
                <span>{address.map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>)}</span>
              </div>
            )}
            {socials.length > 0 && (
              <div className="bl-socials">
                {socials.slice(0, 3).map((red: any) => <a key={red.key} href={red.url} target="_blank" rel="noopener noreferrer" aria-label={red.label}><SocialIcon name={red.key} /></a>)}
              </div>
            )}
            <Link className="bl-info-item bl-reviews" to={`/perfil/${enc}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.500 2.900 6 6.600.8-4.900 4.500 1.300 6.500L12 17l-5.900 3.300 1.300-6.500L2.500 9.300l6.600-.8z" /></svg>
              <span>Reseñas ({reviews.cantidad}){reviews.cantidad > 0 && <em> · {reviews.promedio.toLocaleString("es-AR")}</em>}</span>
            </Link>
          </div>
        </section>

        {liveOffers.map(offer => (
          <React.Fragment key={`${offer.id}-${offer.fecha}-${offer.hora}`}>
            <Link className="bl-offer" to={offerLink(slug, offer)}>
              <span className="bl-offer-timer">Disponible por: {countdown(Date.parse(offer.cierre) - serverNow)}</span>
              <div className="bl-offer-img">{offer.imagen && <img src={offer.imagen} alt="" />}</div>
              <div className="bl-offer-body">
                <strong>{offer.nombre}</strong>
                <span><b>{money(offer.precio)}</b><s>{money(offer.precio_original)}</s></span>
              </div>
            </Link>
          </React.Fragment>
        ))}
        {liveOffers.length > 0 && <p className="bl-note">Esta oferta es única y funciona por subasta, reserva antes que alguien más lo haga. El horario no es personalizable.</p>}

        <hr className="bl-rule" />
        <Link className="bl-big" to={`/agenda/${enc}`}>
          <span>Ver Agenda</span>
          <i className="bl-icon-cal" aria-hidden="true"><b>{today}</b></i>
        </Link>
        <Link className="bl-big" to={`/perfil/${enc}`}>
          <span>Ver Perfil</span>
          <i className="bl-icon-doc" aria-hidden="true" />
        </Link>

        {combos.length > 0 && <section id="bl-combos" className="bl-section"><h2>Combos</h2><div className="bl-list">{combos.map(promoCard)}</div></section>}
        {discounts.length > 0 && <section id="bl-promos" className="bl-section"><h2>Promociones</h2><div className="bl-list">{discounts.map(promoCard)}</div></section>}

        <footer className="bl-footer"><Link to="/">Agenda online con <b>Turnits</b></Link></footer>
      </div>
    </main>
  )
}
