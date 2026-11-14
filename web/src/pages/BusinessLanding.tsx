import * as React from "react"
import { Link, useParams } from "react-router"
import { appConfig } from "../config"
import BrandPreloader from "../components/BrandPreloader"
import { SocialIcon } from "../components/SocialIcon"
import whatsappLogo from "../components/whatsapp-icon.svg"
import { enlacesPublicos } from "../shared/socials.js"
import { promoAppliesOn, promoDaysLabel } from "../shared/promotions.js"
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
  fecha_inicio: string
  fecha_fin: string
  dias_semana?: number[] | null
  items?: { id: string; tipo: string; nombre: string; cantidad: number }[]
  imagenes?: { id: string; tipo: string; url: string }[]
}
interface Service { id: string; nombre: string; precio: number; duracion: number; descripcion?: string; imagen_url?: string | null }
interface Member { id: string; nombre: string; apellido?: string; color?: string; foto_url?: string | null }
interface Review { id: string; nombre: string; comentario?: string; puntuacion: number; created_at?: string }

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
  const [reviewItems, setReviewItems] = React.useState<Review[]>([])
  const [promos, setPromos] = React.useState<Promo[]>([])
  const [services, setServices] = React.useState<Service[]>([])
  const [members, setMembers] = React.useState<Member[]>([])
  const [availability, setAvailability] = React.useState<Record<string, { date: string; time: string } | null>>({})
  const [offers, setOffers] = React.useState<Offer[]>([])
  const [offset, setOffset] = React.useState(0)
  const [now, setNow] = React.useState(() => Date.now())
  const [logoFailed, setLogoFailed] = React.useState(false)

  React.useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    setState("loading"); setNegocio(null); setPerfil(null); setPromos([]); setOffers([]); setLogoFailed(false); setServices([]); setMembers([]); setReviewItems([]); setAvailability({})
    const s = encodeURIComponent(slug)
    Promise.allSettled([
      getJson(`/negocio/${s}`, controller.signal),
      getJson(`/perfil/${s}`, controller.signal),
      getJson(`/perfil/${s}/resenas`, controller.signal),
      getJson(`/promociones/${s}`, controller.signal),
      getJson(`/servicios/${s}`, controller.signal),
      getJson(`/equipo/${s}`, controller.signal),
    ]).then(async ([biz, profile, rev, promo, srv, team]) => {
      if (controller.signal.aborted) return
      if (biz.status !== "fulfilled" || !biz.value.negocio) return setState("missing")
      if (biz.value.suspendido) return setState("paused")
      setNegocio(biz.value.negocio)
      if (profile.status === "fulfilled") setPerfil(profile.value.perfil)
      if (rev.status === "fulfilled") { setReviews({ promedio: rev.value.promedio || 0, cantidad: rev.value.cantidad || 0 }); setReviewItems(rev.value.resenas || []) }
      if (promo.status === "fulfilled") setPromos(promo.value.promociones || [])
      if (team.status === "fulfilled") setMembers(team.value.equipo || [])
      if (srv.status === "fulfilled") {
        const memberList = team.status === "fulfilled" ? team.value.equipo || [] : []
        const byMember = await Promise.all(memberList.map((member: Member) => getJson(`/servicios/${s}?equipo_id=${encodeURIComponent(member.id)}`, controller.signal).catch(() => ({ servicios: [] }))))
        if (controller.signal.aborted) return
        const all = [...(srv.value.servicios || []), ...byMember.flatMap(data => data.servicios || [])]
        setServices([...new Map(all.map((service: Service) => [service.id, service])).values()])
      }
      setState("ready")
    })
    return () => controller.abort()
  }, [slug])

  React.useEffect(() => {
    if (state !== "ready" || !members.length || !services.length) return
    const controller = new AbortController()
    const firstDate = new Date()
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(firstDate); d.setDate(d.getDate() + i)
      return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(d)
    })
    Promise.all(members.slice(0, 8).map(async member => {
      for (const date of dates) {
        try {
          const data = await getJson(`/slots-disponibles/${encodeURIComponent(slug)}?fecha=${date}&equipo_id=${encodeURIComponent(member.id)}`, controller.signal)
          const slot = (data.slots || []).find((item: any) => !item.lleno)
          if (slot) return [member.id, { date, time: String(slot.hora).slice(0, 5) }] as const
        } catch { if (controller.signal.aborted) return [member.id, null] as const }
      }
      return [member.id, null] as const
    })).then(rows => { if (!controller.signal.aborted) setAvailability(Object.fromEntries(rows)) })
    return () => controller.abort()
  }, [state, slug, members, services])

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

  const color = /^#[0-9a-f]{6}$/i.test(negocio?.tema?.acento || "") ? negocio.tema.acento : /^#[0-9a-f]{6}$/i.test(negocio?.tema?.primario || "") ? negocio.tema.primario : DEFAULT_COLOR
  const style = { "--bl-color": color, "--bl-on": readableOn(color) } as React.CSSProperties
  const name = title || "Negocio"
  const logo = !logoFailed && (negocio?.logo_url || perfil?.foto_perfil_url)
  const tagline = (perfil?.descripcion || perfil?.categoria || "").trim()
  const address = [perfil?.direccion, [perfil?.ciudad, perfil?.provincia].filter(Boolean).join(", ")].filter(Boolean)
  const socials = perfil ? enlacesPublicos(perfil) : []
  const hasPublicProfile = Boolean(perfil && (tagline || address.length || socials.length || perfil.foto_perfil_url || perfil.banner_url || perfil.sitio_web || perfil.fotos?.length || reviews.cantidad > 0))
  const todayISO = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())
  const rankedPromos = promos.filter(p => {
    for (let offset = 0; offset <= 30; offset++) {
      const date = new Date(`${todayISO}T12:00:00Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const candidate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(date)
      if (promoAppliesOn(p, candidate)) return true
    }
    return false
  }).sort((a, b) => ((b.precio_original - b.precio_final) / Math.max(b.precio_original, 1)) - ((a.precio_original - a.precio_final) / Math.max(a.precio_original, 1)))
  const discountForService = (service: Service) => rankedPromos
    .filter(p => p.tipo === "descuento" && p.servicio_id === service.id && p.items?.length === 1 && p.items[0].tipo === "servicio" && p.items[0].cantidad === 1 && p.precio_final < p.precio_original)
    .sort((a, b) => a.precio_final - b.precio_final)[0]
  const enc = encodeURIComponent(slug)
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  const today = new Date().toLocaleDateString("es-AR", { day: "numeric", timeZone: "America/Argentina/Buenos_Aires" })
  const whatsapp = String(perfil?.telefono_publico || "").replace(/\D/g, "")
  const timeUntil = (date: string, time: string) => {
    const [y, m, d] = date.split("-").map(Number), [h, min] = time.split(":").map(Number)
    const target = new Date(y, m - 1, d, h, min).getTime()
    const minutes = Math.max(0, Math.round((target - Date.now()) / 60000))
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim()
  }

  const promoCard = (p: Promo) => (
    <Link key={p.id} className="bl-promo" to={`/agenda/${enc}?${new URLSearchParams({ servicio_id: p.servicio_id, promo_id: p.id })}`}>
      <div className="bl-promo-img">{p.imagenes?.[0]?.url && <img src={p.imagenes[0].url} alt="" loading="lazy" />}{p.imagenes?.some(image => image.tipo === "producto") && <span className="bl-promo-products">{p.imagenes.filter(image => image.tipo === "producto").slice(0, 2).map(image => <img key={image.id} src={image.url} alt="" loading="lazy" />)}</span>}{p.dias_semana != null && <small>{promoDaysLabel(p.dias_semana)}</small>}</div>
      <div className="bl-promo-body">
        <strong>{p.nombre}</strong>
        <span className="bl-promo-price"><b>{money(p.precio_final)}</b></span>
        <span className="bl-promo-cta">Reservar →</span>
      </div>
    </Link>
  )

  return (
    <main className="bl-page" style={style}>
      <div className="bl-wrap">
        {(hasPublicProfile || rankedPromos.length > 0) && <nav className="bl-nav" aria-label="Secciones">
          {hasPublicProfile && <Link to={`/perfil/${enc}`}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1.5-2.5 3.2-3.5 5.5-3.5" /></svg>Perfil</Link>}
          {rankedPromos.length > 0 && <button type="button" onClick={() => goTo("bl-promos")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2 1.6 2.6-.2.9 2.4 2.3 1.3-.6 2.5 1 2.4-1.8 1.9-.2 2.6-2.5.6L12 21l-2.2-1.6-2.5-.6-.2-2.6-1.8-1.9 1-2.4-.6-2.5 2.3-1.3.9-2.4 2.6.2z" /><path d="m9.5 14.5 5-5M9.7 9.7h.01M14.3 14.3h.01" /></svg>Promociones</button>}
        </nav>}

        <header className="bl-bar">
          <Link className="bl-reserve" to={`/agenda/${enc}`}>Reservar Ahora</Link>
        </header>

        <section className="bl-hero">
          <div className="bl-logo">{logo ? <img src={logo} alt={`Logo de ${name}`} onError={() => setLogoFailed(true)} /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}</div>
          <h1 className={name.length > 22 ? "bl-name-long bl-name-extra-long" : name.length > 15 ? "bl-name-long" : undefined}>{name}</h1>
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

        {liveOffers.length > 0 && <section className="bl-section bl-last-minute"><h2>Oferta de último momento</h2><p>Aprovechá los horarios vacíos y reservá con descuento.</p>{liveOffers.slice(0, 1).map(offer => (
          <React.Fragment key={`${offer.id}-${offer.fecha}-${offer.hora}`}>
            <Link className="bl-offer" to={offerLink(slug, offer)}>
              <span className="bl-offer-timer">Disponible por: {countdown(Date.parse(offer.cierre) - serverNow)}</span>
              <div className="bl-offer-img">{offer.imagen && <img src={offer.imagen} alt="" />}</div>
              <div className="bl-offer-body">
                <small className="bl-offer-time">HOY {offer.hora.slice(0, 5)} hs · Con {members.find(m => m.id === offer.equipo_id)?.nombre || "nuestro equipo"}</small>
                <strong>{offer.nombre}</strong>
                <span><b>{money(offer.precio)}</b><s>{money(offer.precio_original)}</s></span>
              </div>
            </Link>
          </React.Fragment>
        ))}</section>}

        {members.length > 0 && services.length > 0 && <section className="bl-section bl-availability"><h2>Próximos turnos disponibles</h2><p>Encontrá el horario más cercano de nuestro equipo.</p><div className="bl-list">{members.slice(0, 8).map((member, index) => {
          const next = availability[member.id], initials = `${member.nombre?.[0] || ""}${member.apellido?.[0] || ""}`.toUpperCase()
          const memberColor = /^#[0-9a-f]{6}$/i.test(member.color || "") ? member.color : color
          return <Link className="bl-member" key={member.id} to={`/agenda/${enc}?equipo_id=${encodeURIComponent(member.id)}`}>
            <span className="bl-avatar" style={{ "--member-color": memberColor } as React.CSSProperties}>{member.foto_url ? <img src={member.foto_url} alt="" /> : initials || member.nombre?.[0]}</span>
            <span className="bl-member-copy"><strong>{member.nombre} {member.apellido}</strong><small>{next ? <>Disponible en <b>{timeUntil(next.date, next.time) || "ahora"}</b></> : "Ver disponibilidad"}</small><span>Reservar con este profesional ↗</span></span>
            <span className="bl-member-rank">{index + 1}</span>
          </Link>
        })}</div></section>}

        {reviewItems.length > 0 && <section className="bl-section bl-reviews-section"><h2>Reseñas</h2><div className="bl-review-list">{reviewItems.slice(0, 3).map(review => <article className="bl-review" key={review.id}><div className="bl-stars" aria-label={`${review.puntuacion} de 5 estrellas`}>{"★".repeat(Math.max(0, Math.min(5, Number(review.puntuacion))))}</div><strong>{review.nombre}</strong>{review.comentario && <p>“{review.comentario}”</p>}</article>)}</div></section>}

        {services.length > 0 && <section id="bl-services" className="bl-section"><h2>Servicios</h2><p>Lo que ofrecemos en {name}</p><div className="bl-service-list">{services.map(service => {
          const discount = discountForService(service)
          return <article className="bl-service" key={service.id}>
            {(service.imagen_url || service.descripcion?.match(/^\[img:(.*?)\]/s)?.[1]) && <img src={service.imagen_url || service.descripcion?.match(/^\[img:(.*?)\]/s)?.[1]} alt="" loading="lazy" />}
            <div><strong>{service.nombre}</strong><b>{discount?.dias_semana != null ? "Desde " : ""}{money(discount?.precio_final ?? service.precio)}</b></div><span>{service.duracion} min</span><Link to={`/agenda/${enc}?servicio_id=${encodeURIComponent(service.id)}`}>Reservar</Link>
          </article>
        })}</div></section>}

        {rankedPromos.length > 0 && <section id="bl-promos" className="bl-section bl-promotions"><h2>Promociones</h2><p>Llevá una experiencia</p><div className="bl-promo-grid">{rankedPromos.map(promoCard)}</div></section>}

        {whatsapp && <section className="bl-section bl-contact"><h2>¿Tenés alguna duda?</h2><p>Contactanos</p><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">Consultas aquí <img src={whatsappLogo} alt="WhatsApp" /></a></section>}
        <section className="bl-signup"><h2>Creá tu agenda ahora con Turnits</h2><Link to="/registro/negocio">Empezar ya</Link></section>

        <footer className="bl-footer"><span>Powered by <b>Turnits</b></span></footer>
      </div>
    </main>
  )
}
