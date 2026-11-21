import * as React from "react"
import { Link, useParams } from "react-router"
import { appConfig } from "../config"
import BrandPreloader from "../components/BrandPreloader"
import { SocialIcon } from "../components/SocialIcon"
import whatsappLogo from "../components/whatsapp-icon.svg"
import arrowUpRightIcon from "../components/bi_arrow-up-short.svg"
import { enlacesPublicos } from "../shared/socials.js"
import { promoAppliesOn, promoDaysLabel } from "../shared/promotions.js"
import "./BusinessLanding.css"

// Página pública del negocio: turnits.com/{slug}
// Reúne lo que más impacta en la reserva (Offer por subasta, combos y
// promociones) con datos que el negocio ya configura desde el panel.

const DEFAULT_COLOR = "#196b1f"
const money = (value: number) => `$${Number(value || 0).toLocaleString("es-AR")}`
const maskedIcon = (source: string): React.CSSProperties => ({ maskImage: `url("${source}")`, WebkitMaskImage: `url("${source}")` })

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
interface Service { id: string; nombre: string; precio: number; duracion: number; descripcion?: string; imagen_url?: string | null; reservas_90d?: number; orden?: number }
interface Member { id: string; nombre: string; apellido?: string; color?: string; foto_url?: string | null }
interface Review { id: string; nombre: string; comentario?: string; puntuacion: number; created_at?: string }
interface Branch { id: string; nombre: string; direccion: string; latitud?: number | null; longitud?: number | null }

async function getJson(path: string, signal?: AbortSignal) {
  const response = await fetch(`${appConfig.apiUrl}${path}`, { signal, cache: "no-store" })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) throw new Error(data?.error || "No disponible")
  return data
}

function readableAccent(color: string) {
  const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
  const luminance = (values: number[]) => values.map(value => {
    const channel = value / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
  let result = rgb
  while (luminance(result) > .12) result = result.map(value => Math.max(0, Math.floor(value * .88)))
  return `#${result.map(value => value.toString(16).padStart(2, "0")).join("")}`
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
  const [branches, setBranches] = React.useState<Branch[]>([])
  const [availability, setAvailability] = React.useState<Record<string, { date: string; time: string } | null>>({})
  const [todaySlots, setTodaySlots] = React.useState<number | null>(null)
  const [offers, setOffers] = React.useState<Offer[]>([])
  const [offerIndex, setOfferIndex] = React.useState(0)
  const [offerPaused, setOfferPaused] = React.useState(false)
  const [offset, setOffset] = React.useState(0)
  const [now, setNow] = React.useState(() => Date.now())
  const [logoFailed, setLogoFailed] = React.useState(false)
  const [bannerFailed, setBannerFailed] = React.useState(false)
  const [shareStatus, setShareStatus] = React.useState("")
  const [headlineIndex, setHeadlineIndex] = React.useState(0)

  React.useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    setState("loading"); setNegocio(null); setPerfil(null); setPromos([]); setOffers([]); setLogoFailed(false); setBannerFailed(false); setServices([]); setMembers([]); setBranches([]); setReviewItems([]); setAvailability({}); setTodaySlots(null)
    const s = encodeURIComponent(slug)
    getJson(`/negocio/${s}`, controller.signal).then(data => {
      if (controller.signal.aborted) return
      if (!data.negocio) return setState("missing")
      if (data.suspendido) return setState("paused")
      setNegocio(data.negocio)
      setState("ready")
    }).catch(() => { if (!controller.signal.aborted) setState("missing") })
    const update = (path: string, apply: (data: any) => void) => {
      getJson(path, controller.signal).then(data => { if (!controller.signal.aborted) apply(data) }).catch(() => {})
    }
    update(`/perfil/${s}`, data => setPerfil(data.perfil))
    update(`/perfil/${s}/resenas`, data => { setReviews({ promedio: data.promedio || 0, cantidad: data.cantidad || 0 }); setReviewItems(data.resenas || []) })
    update(`/promociones/${s}`, data => setPromos(data.promociones || []))
    update(`/sucursales/${s}`, data => setBranches(data.sucursales || []))
    const teamRequest = getJson(`/equipo/${s}`, controller.signal).catch(() => ({ equipo: [] }))
    teamRequest.then(data => { if (!controller.signal.aborted) setMembers(data.equipo || []) })
    const showServices = (list: Service[]) => setServices([...new Map(list.map(service => [service.id, service])).values()].sort((a, b) =>
        Number(b.reservas_90d || 0) - Number(a.reservas_90d || 0) ||
        Number(a.orden || 0) - Number(b.orden || 0) ||
        a.nombre.localeCompare(b.nombre, "es"),
      ))
    const servicesRequest = getJson(`/servicios/${s}`, controller.signal).catch(() => ({ servicios: [] }))
    servicesRequest.then(data => { if (!controller.signal.aborted) showServices(data.servicios || []) })
    Promise.all([servicesRequest, teamRequest]).then(async ([srv, team]) => {
      if (controller.signal.aborted) return
      const memberList: Member[] = team.equipo || []
      const base: Service[] = srv.servicios || []
      const byMember = await Promise.all(memberList.map(member => getJson(`/servicios/${s}?equipo_id=${encodeURIComponent(member.id)}`, controller.signal).catch(() => ({ servicios: [] }))))
      if (!controller.signal.aborted) showServices([...base, ...byMember.flatMap(data => data.servicios || [])])
    })
    return () => controller.abort()
  }, [slug])

  React.useEffect(() => {
    if (state !== "ready" || !members.length || !services.length) return
    const controller = new AbortController()
    const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" })
    const firstDate = new Date(`${formatter.format(new Date())}T12:00:00Z`)
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(firstDate); d.setUTCDate(d.getUTCDate() + i)
      return formatter.format(d)
    })
    const checkedMembers = members.slice(0, 6)
    Promise.all(checkedMembers.map(async member => {
      try {
        const data = await getJson(`/slots-disponibles/${encodeURIComponent(slug)}?fecha=${dates[0]}&equipo_id=${encodeURIComponent(member.id)}`, controller.signal)
        const open = (data.slots || []).filter((item: any) => !item.lleno)
        return { id: member.id, next: open[0] ? { date: dates[0], time: String(open[0].hora).slice(0, 5) } : null, todayCount: open.length }
      } catch { return { id: member.id, next: null, todayCount: null } }
    })).then(async todayRows => {
      if (controller.signal.aborted) return
      setTodaySlots(todayRows.some(row => row.todayCount !== null) ? todayRows.reduce((total, row) => total + (row.todayCount || 0), 0) : null)
      setAvailability(Object.fromEntries(todayRows.map(row => [row.id, row.next])))
      const futureRows = await Promise.all(todayRows.filter(row => !row.next).map(async row => {
        for (const date of dates.slice(1)) {
        try {
          const data = await getJson(`/slots-disponibles/${encodeURIComponent(slug)}?fecha=${date}&equipo_id=${encodeURIComponent(row.id)}`, controller.signal)
          const open = (data.slots || []).filter((item: any) => !item.lleno)
          if (open[0]) return { id: row.id, next: { date, time: String(open[0].hora).slice(0, 5) } }
        } catch { if (controller.signal.aborted) break }
        }
        return { id: row.id, next: null }
      }))
      if (!controller.signal.aborted) setAvailability(Object.fromEntries([...todayRows.filter(row => row.next), ...futureRows].map(row => [row.id, row.next])))
    })
    return () => controller.abort()
  }, [state, slug, members, services])

  const loadOffers = React.useCallback(() => {
    if (!slug) return
    getJson(`/browse/ofertas?slug=${encodeURIComponent(slug)}`)
      .then(data => {
        setOffset(Date.parse(data.server_time) - Date.now() || 0)
        // Defensa extra: si la API todavía no soporta ?slug=, nunca mostrar ofertas de otros negocios.
        const popularity = new Map(services.map(service => [service.id, Number(service.reservas_90d || 0)]))
        setOffers((data.ofertas || []).filter((o: Offer) => o.slug === slug).sort((a: Offer, b: Offer) =>
          Date.parse(a.cierre) - Date.parse(b.cierre) ||
          (popularity.get(b.servicio_id) || 0) - (popularity.get(a.servicio_id) || 0) ||
          a.nombre.localeCompare(b.nombre, "es"),
        ))
      })
      .catch(() => setOffers([]))
  }, [slug, services])
  React.useEffect(() => {
    // Pagar una Offer requiere cuenta de cliente: sólo se muestra si esa experiencia está habilitada.
    if (state !== "ready" || !appConfig.customerExperienceEnabled) return
    loadOffers()
    const refresh = window.setInterval(loadOffers, 60000)
    return () => window.clearInterval(refresh)
  }, [state, loadOffers])
  React.useEffect(() => {
    if (!offers.length && !members.length) return
    const tick = window.setInterval(() => setNow(Date.now()), offers.length ? 1000 : 60000)
    return () => window.clearInterval(tick)
  }, [offers.length, members.length])

  const title = perfil?.nombre || negocio?.business_name
  React.useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = `${title} | Turnits`
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = description?.content
    if (description) description.content = (perfil?.descripcion || `Reservá tu turno en ${title} desde Turnits.`).slice(0, 160)
    return () => { document.title = previous; if (description && previousDescription) description.content = previousDescription }
  }, [title, perfil?.descripcion])

  const serverNow = now + offset
  const liveOffers = offers.filter(o => Date.parse(o.cierre) > serverNow)
  const todayISO = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())
  const headlines = [
    ...(todaySlots != null && todaySlots > 0 ? [{ text: `${todaySlots} ${todaySlots === 1 ? "horario libre" : "horarios libres"} hoy`, action: "Reservar ahora", href: `/agenda/${encodeURIComponent(slug)}` }] : []),
    ...(promos.some(promo => promoAppliesOn(promo, todayISO)) ? [{ text: "Hoy hay promociones para vos", action: "Ver promos", href: "#bl-promos" }] : []),
    ...(liveOffers.some(offer => offer.fecha === todayISO) ? [{ text: "Ofertas de último momento para hoy", action: "Ver ofertas", href: "#bl-offers" }] : []),
  ]
  if (!headlines.length) headlines.push({ text: "Elegí tu próximo turno en minutos", action: "Reservar ahora", href: `/agenda/${encodeURIComponent(slug)}` })
  React.useEffect(() => {
    if (headlines.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(() => setHeadlineIndex(index => (index + 1) % headlines.length), 6000)
    return () => window.clearInterval(timer)
  }, [headlines.length])
  const headline = headlines[headlineIndex % headlines.length]
  React.useEffect(() => {
    if (offerIndex >= liveOffers.length) setOfferIndex(0)
  }, [liveOffers.length, offerIndex])
  React.useEffect(() => {
    if (liveOffers.length < 2 || offerPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(() => setOfferIndex(index => (index + 1) % liveOffers.length), 7000)
    return () => window.clearInterval(timer)
  }, [liveOffers.length, offerPaused, offerIndex])
  React.useEffect(() => {
    if (offers.length && offers.some(o => Date.parse(o.cierre) <= serverNow)) loadOffers()
  }, [serverNow > 0 && offers.some(o => Date.parse(o.cierre) <= serverNow), loadOffers])

  if (!slug || state === "missing") return <NotFound message="No encontramos este negocio" detail="Revisá el enlace o buscá el negocio desde Turnits." />
  if (state === "paused") return <NotFound message="Agenda no disponible por ahora" detail="Este negocio pausó temporalmente sus reservas." />
  if (state === "loading") return <BrandPreloader />

  const color = /^#[0-9a-f]{6}$/i.test(negocio?.tema?.acento || "") ? negocio.tema.acento : /^#[0-9a-f]{6}$/i.test(negocio?.tema?.primario || "") ? negocio.tema.primario : DEFAULT_COLOR
  const style = { "--bl-color": color, "--bl-ink": readableAccent(color) } as React.CSSProperties
  const name = title || "Negocio"
  const logo = !logoFailed && (perfil?.foto_perfil_url || negocio?.logo_url)
  const banner = !bannerFailed && perfil?.banner_url
  const tagline = (perfil?.descripcion || perfil?.categoria || "").trim()
  const branchAddress = String(branches[0]?.direccion || "").trim()
  const locality = [perfil?.ciudad, perfil?.provincia].filter(Boolean).join(", ")
  const address = [branchAddress || perfil?.direccion, locality && (!branchAddress || !perfil?.ciudad || !branchAddress.toLocaleLowerCase("es-AR").includes(String(perfil.ciudad).toLocaleLowerCase("es-AR"))) ? locality : ""].filter(Boolean)
  const socials = perfil ? enlacesPublicos(perfil) : []
  const works = (Array.isArray(perfil?.fotos) ? perfil.fotos : []).filter((url: unknown): url is string => typeof url === "string" && !!url).map((url: string) => ({ url, post: perfil?.publicaciones?.[url], description: perfil?.publicaciones?.[url]?.descripcion || perfil?.titulos_fotos?.[url] || "" }))
  const rankedMembers = [...members].sort((a, b) => {
    const left = availability[a.id], right = availability[b.id]
    return (left ? `${left.date}T${left.time}` : "9999").localeCompare(right ? `${right.date}T${right.time}` : "9999")
  })
  const rankedPromos = promos.filter(p => {
    for (let offset = 0; offset <= 30; offset++) {
      const date = new Date(`${todayISO}T12:00:00Z`)
      date.setUTCDate(date.getUTCDate() + offset)
      const candidate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(date)
      if (promoAppliesOn(p, candidate)) return true
    }
    return false
  }).sort((a, b) => Number(promoAppliesOn(b, todayISO)) - Number(promoAppliesOn(a, todayISO)) || ((b.precio_original - b.precio_final) / Math.max(b.precio_original, 1)) - ((a.precio_original - a.precio_final) / Math.max(a.precio_original, 1)))
  const discountForService = (service: Service) => rankedPromos
    .filter(p => p.tipo === "descuento" && p.servicio_id === service.id && p.items?.length === 1 && p.items[0].tipo === "servicio" && p.items[0].cantidad === 1 && p.precio_final < p.precio_original)
    .sort((a, b) => a.precio_final - b.precio_final)[0]
  const enc = encodeURIComponent(slug)
  const sharePage = async () => {
    const url = `${appConfig.siteUrl}/${enc}`
    try {
      if (navigator.share) await navigator.share({ title: name, url })
      else { await navigator.clipboard.writeText(url); setShareStatus("Enlace copiado") }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") setShareStatus("No pudimos copiar el enlace")
    }
  }
  const whatsappLink = socials.find((red: any) => red.key === "whatsapp")?.url || (perfil?.telefono_publico ? `https://wa.me/${String(perfil.telefono_publico).replace(/\D/g, "")}` : "")
  const timeUntil = (date: string, time: string) => {
    const target = Date.parse(`${date}T${time}:00-03:00`)
    const minutes = Math.max(0, Math.ceil((target - now) / 60000))
    if (minutes === 0) return "ahora"
    if (minutes < 60) return `en ${minutes} min`
    if (minutes < 1440) return `en ${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`
    const days = Math.floor(minutes / 1440)
    const hours = Math.floor((minutes % 1440) / 60)
    return `en ${days} ${days === 1 ? "día" : "días"}${hours ? ` y ${hours} h` : ""}`
  }
  const offerDateLabel = (date: string) => {
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())
    if (date === today) return "HOY"
    const tomorrowDate = new Date(`${today}T12:00:00Z`)
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1)
    if (date === tomorrowDate.toISOString().slice(0, 10)) return "MAÑANA"
    return new Date(`${date}T12:00:00-03:00`).toLocaleDateString("es-AR", {
      weekday: "short", day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires",
    }).replaceAll(".", "").toLocaleUpperCase("es-AR")
  }

  const promoCard = (p: Promo) => {
    const isToday = promoAppliesOn(p, todayISO)
    const serviceQuantity = p.items?.filter(item => item.tipo === "servicio")
      .reduce((total, item) => total + Math.max(0, Number(item.cantidad) || 0), 0) || 0
    return (
      <Link key={p.id} className={`bl-promo${isToday ? " bl-promo-today" : ""}`} to={`/agenda/${enc}?${new URLSearchParams({ servicio_id: p.servicio_id, promo_id: p.id })}`}>
        <div className="bl-promo-img">{p.imagenes?.[0]?.url && <img src={p.imagenes[0].url} alt="" loading="lazy" />}{isToday && <span className="bl-promo-today-badge">Disponible hoy</span>}{p.imagenes?.some(image => image.tipo === "producto") && <span className="bl-promo-products">{p.imagenes.filter(image => image.tipo === "producto").slice(0, 2).map(image => <img key={image.id} src={image.url} alt="" loading="lazy" />)}</span>}{p.dias_semana?.length ? <small>SOLO {promoDaysLabel(p.dias_semana).toLocaleUpperCase("es-AR")}</small> : null}{serviceQuantity > 1 && <span className="bl-promo-quantity" aria-label={`${serviceQuantity} servicios incluidos`}>x{serviceQuantity}</span>}</div>
        <div className="bl-promo-body">
          <strong>{p.nombre}</strong>
          <span className="bl-promo-price"><b>{money(p.precio_final)}</b>{p.precio_original > p.precio_final && <s>{money(p.precio_original)}</s>}</span>
          <span className="bl-promo-cta">Reservar <i className="bl-mask-icon" style={maskedIcon(arrowUpRightIcon)} aria-hidden="true" /></span>
        </div>
      </Link>
    )
  }

  return (
    <main className="bl-page" style={style}>
      <div className="bl-wrap">
        <header className="bl-bar">
          <span>{headline.text}</span>
          {headline.href.startsWith("#") ? <a className="bl-reserve" href={headline.href}>{headline.action}</a> : <Link className="bl-reserve" to={headline.href}>{headline.action} <i className="bl-mask-icon" style={maskedIcon(arrowUpRightIcon)} aria-hidden="true" /></Link>}
        </header>

        <section className={`bl-hero${banner ? " bl-hero-with-banner" : ""}`}>
          {banner ? <img className="bl-hero-banner" src={banner} alt="" onError={() => setBannerFailed(true)} /> : <div className="bl-hero-pattern" aria-hidden="true" />}
          <div className="bl-logo">{logo ? <img src={logo} alt={`Logo de ${name}`} onError={() => setLogoFailed(true)} /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}</div>
          <h1 className={name.length > 22 ? "bl-name-long bl-name-extra-long" : name.length > 15 ? "bl-name-long" : undefined}>{name}</h1>
          {tagline && <p className="bl-tagline">{tagline}</p>}
          <div className="bl-info">
            {address.length > 0 && (
              <a className="bl-info-item" href={branches[0]?.latitud != null && branches[0]?.longitud != null ? `https://www.google.com/maps/search/?api=1&query=${branches[0].latitud},${branches[0].longitud}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.join(", "))}`} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 12 3.5 6.5 6.5 0 0 1 18.5 10c0 5.400-6.500 11-6.500 11Z" /><circle cx="12" cy="10" r="2.400" /></svg>
                <span>{address.map((line, i) => <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>)}</span>
              </a>
            )}
            {reviews.cantidad > 0 && <a className="bl-info-item bl-reviews" href="#bl-reviews" aria-label={`${reviews.cantidad} reseñas, calificación ${reviews.promedio.toLocaleString("es-AR")} de 5`}>
              {reviews.cantidad > 0 && <strong className="bl-review-score">{reviews.promedio.toLocaleString("es-AR")}</strong>}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.500 2.900 6 6.600.8-4.900 4.500 1.300 6.500L12 17l-5.900 3.300 1.300-6.500L2.500 9.300l6.600-.8z" /></svg>
              <span>{reviews.cantidad} {reviews.cantidad === 1 ? "reseña" : "reseñas"}</span>
            </a>}
          </div>
          {socials.length > 0 && <div className="bl-socials">{socials.slice(0, 4).map((red: any) => <a key={red.key} href={red.url} target="_blank" rel="noopener noreferrer" aria-label={red.label}><SocialIcon name={red.key} /></a>)}{socials.length > 4 && <Link className="bl-social-more" to={`/perfil/${enc}`} aria-label="Ver todas las redes sociales">+{socials.length - 4}</Link>}</div>}
          <button className="bl-share" type="button" onClick={sharePage}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M5 13.5v5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-5" /></svg>Compartir página</button>
          {shareStatus && <span className="bl-share-status" role="status">{shareStatus}</span>}
        </section>

        <nav className="bl-nav" aria-label="Explorar este negocio">
          {services.length > 0 && <a href="#bl-services">Servicios</a>}
          {works.length > 0 && <a href="#bl-works">Trabajos</a>}
          {rankedPromos.length > 0 && <a href="#bl-promos">Promociones</a>}
          {reviews.cantidad > 0 && <a href="#bl-reviews">Reseñas</a>}
        </nav>

        {liveOffers.length > 0 && <section id="bl-offers" className="bl-section bl-last-minute"><div className="bl-section-heading"><div><span className="bl-kicker">Solo por tiempo limitado</span><h2>Oferta de último momento</h2><p>Un horario libre, un mejor precio. Reservalo antes de que termine.</p></div></div>
          <div className="bl-offer-slider" onMouseEnter={() => setOfferPaused(true)} onMouseLeave={() => setOfferPaused(false)} onFocusCapture={() => setOfferPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOfferPaused(false) }}>
            {(() => {
              const offer = liveOffers[offerIndex] || liveOffers[0]
              return <Link key={`${offer.id}-${offer.fecha}-${offer.hora}`} className="bl-offer" to={offerLink(slug, offer)} aria-label={`Reservar ${offer.nombre} a ${money(offer.precio)}, ${offerDateLabel(offer.fecha)} ${offer.hora.slice(0, 5)}`}>
                <span className="bl-offer-timer">Termina en {countdown(Date.parse(offer.cierre) - serverNow)}</span>
                <div className="bl-offer-img">{offer.imagen && <img src={offer.imagen} alt="" />}</div>
                <div className="bl-offer-body">
                  <small className="bl-offer-time">{offerDateLabel(offer.fecha)} {offer.hora.slice(0, 5)} hs · Con {members.find(m => m.id === offer.equipo_id)?.nombre || "nuestro equipo"}</small>
                  <strong>{offer.nombre}</strong>
                  <span><b>{money(offer.precio)}</b><s>{money(offer.precio_original)}</s></span>
                  <span className="bl-offer-cta">Reservar oferta <i className="bl-mask-icon" style={maskedIcon(arrowUpRightIcon)} aria-hidden="true" /></span>
                </div>
              </Link>
            })()}
            {liveOffers.length > 1 && <div className="bl-offer-controls" aria-label="Más ofertas disponibles">
              <button type="button" aria-label="Oferta anterior" onClick={() => setOfferIndex(index => (index - 1 + liveOffers.length) % liveOffers.length)}>‹</button>
              <div className="bl-offer-dots" role="group" aria-label="Elegir oferta">
                {liveOffers.map((offer, index) => <button key={`${offer.id}-${offer.fecha}-${offer.hora}`} type="button" aria-label={`Ver oferta ${index + 1} de ${liveOffers.length}`} aria-pressed={index === offerIndex} onClick={() => setOfferIndex(index)} />)}
              </div>
              <button type="button" aria-label="Oferta siguiente" onClick={() => setOfferIndex(index => (index + 1) % liveOffers.length)}>›</button>
            </div>}
          </div>
        </section>}

        {members.length > 0 && services.length > 0 && <section className="bl-section bl-availability"><div className="bl-section-heading"><div><h2>Tu próximo turno, más cerca</h2><p>Una vista rápida de los horarios de nuestro equipo.</p></div><Link to={`/agenda/${enc}`}>Ver agenda</Link></div><div className="bl-list">{rankedMembers.slice(0, 6).map((member) => {
          const next = availability[member.id], initials = `${member.nombre?.[0] || ""}${member.apellido?.[0] || ""}`.toUpperCase()
          const memberColor = /^#[0-9a-f]{6}$/i.test(member.color || "") ? member.color : color
          return <Link className="bl-member" key={member.id} to={`/agenda/${enc}?equipo_id=${encodeURIComponent(member.id)}`}>
            <span className="bl-avatar" style={{ "--member-color": memberColor } as React.CSSProperties}>{member.foto_url ? <img src={member.foto_url} alt="" /> : initials || member.nombre?.[0]}</span>
            <span className="bl-member-copy"><strong>{member.nombre} {member.apellido}</strong><small>{next ? <>Disponible <b>{timeUntil(next.date, next.time)}</b></> : "Ver disponibilidad"}</small></span>
            <span className="bl-member-arrow" aria-hidden="true"><i className="bl-mask-icon" style={maskedIcon(arrowUpRightIcon)} /></span>
          </Link>
        })}</div></section>}

        {services.length > 0 && <section id="bl-services" className="bl-section"><div className="bl-section-heading"><div><h2>Elegí lo que necesitás</h2><p>Servicios claros, precios a la vista y tu turno a un toque.</p></div></div><div className="bl-service-list">{services.map(service => {
          const discount = discountForService(service)
          const image = service.imagen_url || service.descripcion?.match(/^\[img:(.*?)\]/s)?.[1] || works.find(work => work.post?.servicio_id === service.id)?.url
          return <article className="bl-service" key={service.id}>
            {image ? <img src={image} alt="" loading="lazy" /> : <span className="bl-service-placeholder" aria-hidden="true">✦</span>}
            <div><strong>{service.nombre}</strong><span className="bl-service-price"><b>{discount?.dias_semana != null ? "Desde " : ""}{money(discount?.precio_final ?? service.precio)}</b>{discount && <s>{money(service.precio)}</s>}</span></div><span className="bl-service-duration">{service.duracion} min</span><Link to={`/agenda/${enc}?servicio_id=${encodeURIComponent(service.id)}`} aria-label={`Reservar ${service.nombre}`}><i className="bl-mask-icon" style={maskedIcon(arrowUpRightIcon)} aria-hidden="true" /></Link>
          </article>
        })}</div></section>}

        {works.length > 0 && <section id="bl-works" className="bl-section bl-works"><div className="bl-section-heading"><div><h2>Trabajos que hablan por sí solos</h2><p>Explorá resultados reales y reservá el servicio que te gusta.</p></div>{works.length > 4 && <Link to={`/perfil/${enc}/publicaciones`}>Ver todos</Link>}</div><div className="bl-work-list">{works.slice(0, 4).map(({ url, post, description }) => {
          const linked = services.find(service => service.id === post?.servicio_id)
          return <article className="bl-work" key={url}><div className="bl-work-photo"><img src={url} alt={description || "Trabajo realizado por el negocio"} loading="lazy" style={{ objectPosition: `${post?.encuadre_x ?? 50}% ${post?.encuadre_y ?? 50}%`, transform: `scale(${post?.zoom ?? 1})`, transformOrigin: `${post?.encuadre_x ?? 50}% ${post?.encuadre_y ?? 50}%` }} /></div><div className="bl-work-copy">{linked && <span>{linked.nombre}</span>}{description && <p>{description}</p>}<Link to={`/agenda/${enc}${linked ? `?servicio_id=${encodeURIComponent(linked.id)}` : ""}`}>Reservar {linked ? "este servicio" : "turno"} <i className="bl-mask-icon" style={maskedIcon(arrowUpRightIcon)} aria-hidden="true" /></Link></div></article>
        })}</div></section>}

        {rankedPromos.length > 0 && <section id="bl-promos" className="bl-section bl-promotions"><div className="bl-section-heading"><div><h2>Más para vos, por menos</h2><p>Combos y beneficios para tu próxima visita.</p></div></div><div className="bl-promo-grid">{rankedPromos.map(promoCard)}</div></section>}

        {reviewItems.length > 0 && <section id="bl-reviews" className="bl-section bl-reviews-section"><div className="bl-section-heading"><div><h2>Lo dicen quienes ya vinieron</h2><p>{reviews.promedio.toLocaleString("es-AR")} de 5 · {reviews.cantidad} {reviews.cantidad === 1 ? "reseña" : "reseñas"}</p></div><Link to={`/perfil/${enc}`}>Ver reseñas</Link></div><div className="bl-review-list">{reviewItems.slice(0, 3).map(review => <article className="bl-review" key={review.id}><div className="bl-stars" aria-label={`${review.puntuacion} de 5 estrellas`}>{"★".repeat(Math.max(0, Math.min(5, Number(review.puntuacion))))}</div>{review.comentario && <p>“{review.comentario}”</p>}<strong>{review.nombre}</strong></article>)}</div></section>}

        <section className="bl-final-cta"><span>Tu lugar te espera</span><h2>¿Ya sabés cuándo venís?</h2><p>Elegí el servicio y reservá en pocos pasos.</p><Link to={`/agenda/${enc}`}>Encontrar mi turno</Link></section>

        {whatsappLink && <section className="bl-section bl-contact"><div><h2>¿Te quedó alguna duda?</h2><p>Escribinos y te ayudamos a elegir.</p></div><a href={whatsappLink} target="_blank" rel="noopener noreferrer">Consultar por WhatsApp <img src={whatsappLogo} alt="" /></a></section>}
        <section className="bl-signup"><span>Para negocios</span><p>Hacé crecer tu agenda con Turnits.</p><Link to="/registro/negocio">Crear mi agenda</Link></section>

        <footer className="bl-footer"><img src="/assets/turnits-logo-completo.png" alt="Turnits" /></footer>
      </div>
    </main>
  )
}
