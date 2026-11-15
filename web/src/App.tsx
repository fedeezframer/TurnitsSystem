import React, { lazy, Suspense } from "react"
import { Link, Navigate, Route, Routes, useParams, useLocation } from "react-router"
import { appConfig } from "./config"
import Receipt from "./pages/Receipt"
import ResetPassword from "./pages/ResetPassword"
import BrandPreloader, { StartupRouteReady } from "./components/BrandPreloader"
import AppGateway from "./pages/AppGateway"
import { loadBrowse, loadPanel } from "./shared/session-routes"
import { isBusinessSession, storedSessionToken } from "./shared/consultation-session.js"

const Login = lazy(() => import("./migrated/Login"))
const Register = lazy(() => import("./migrated/Register"))
const Browse = lazy(loadBrowse)
const Booking = lazy(() => import("./migrated/Booking"))
const Panel = lazy(loadPanel)
const Home = lazy(() => import("./pages/Home"))
const Legal = lazy(() => import("./pages/Legal"))
const PublicPlans = lazy(() => import("./pages/PublicPlans"))
const Store = lazy(() => import("./pages/Store"))
const Internal = lazy(() => import("./migrated/public/AdminStats"))
const Reschedule = lazy(() => import("./pages/Reschedule"))
const AnimationTest = lazy(() => import("./pages/AnimationTest"))
const BusinessProfile = lazy(() => import("./pages/BusinessProfile"))
const BusinessLanding = lazy(() => import("./pages/BusinessLanding"))
const QuoteAvailability = lazy(() => import("./pages/QuoteAvailability"))

function PanelRoute() {
  return <Panel {...appConfig.panel} baseUrl={appConfig.apiUrl} accentColor={appConfig.accentColor} logoImage={appConfig.logoUrl} mpClientId={appConfig.mpClientId} logoutUrl="/login" style={{ width: "100%", minHeight: "100dvh" }} />
}
function LegacyConsultationsRoute() {
  const location = useLocation()
  if (!appConfig.consumerAccountsEnabled && !isBusinessSession()) return <Navigate to="/" replace />
  if (!appConfig.quoteBookingEnabled) return <Navigate to="/browse" replace />
  const business = isBusinessSession()
  if (!storedSessionToken()) {
    const login = new URLSearchParams({ tipo: business ? "negocio" : "usuario", volver: `/consultas${location.search}` })
    return <Navigate to={`/login?${login}`} replace />
  }
  const destination = new URLSearchParams(location.search)
  if (business) {
    destination.delete("vista")
    destination.set("seccion", "consultas")
    const slug = localStorage.getItem("user_slug") || ""
    return <Navigate to={`/panel${slug ? `/${encodeURIComponent(slug)}` : ""}?${destination}`} replace />
  }
  destination.delete("seccion")
  destination.set("vista", "mensajes")
  return <Navigate to={`/browse?${destination}`} replace />
}
function RenewRoute() {
  const query = new URLSearchParams(window.location.search)
  const slug = query.get("u") || query.get("slug") || localStorage.getItem("user_slug") || ""
  if (!slug) return <Navigate to="/login" replace />
  query.set("planes", "actual")
  return <Navigate to={`/panel/${encodeURIComponent(slug)}?${query}`} replace />
}
function BookingRoute() {
  const { slug: pathSlug } = useParams()
  const location = useLocation()
  const slug = (pathSlug || new URLSearchParams(location.search).get("u") || localStorage.getItem("user_slug") || "").trim().toLowerCase()
  const [business, setBusiness] = React.useState<any>(null)
  const [error, setError] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  React.useEffect(() => {
    if (!slug) return
    const controller = new AbortController(); setBusiness(null); setError(false)
    fetch(`${appConfig.apiUrl}/negocio/${encodeURIComponent(slug)}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const data = await response.json()
      if (!response.ok || !data.success || !data.negocio) throw Error("Negocio no disponible")
      if (!controller.signal.aborted) setBusiness({ ...data.negocio, suspendido: data.suspendido })
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [slug, retry])
  if (slug) {
    if (error) return <main className="app-page"><section className="app-card"><h1>No pudimos abrir la agenda</h1><button onClick={() => setRetry(value => value + 1)}>Reintentar</button></section></main>
    if (!business) return <BrandPreloader />
    if (business.modo_agenda === "presupuesto") {
      if (appConfig.quoteBookingEnabled && !business.suspendido) return <QuoteAvailability slug={slug} business={business} />
      return <main className="app-page"><section className="app-card"><h1>Agenda no disponible por ahora</h1><p>Este tipo de agenda está pausado temporalmente.</p><Link className="app-button" to="/browse">Volver a Browse</Link></section></main>
    }
  }
  return <Booking {...appConfig.booking} baseUrl={appConfig.apiUrl} manualSlug={slug || ""} useNegocioTheme={true} />
}
function MissingPage() {
  return <div className="app-page"><section className="app-card"><img className="app-brand" src={appConfig.logoUrl} alt="Turnits" /><h1>Página no encontrada</h1><p>Revisá el enlace o volvé a iniciar sesión.</p><Link className="app-button" to="/login">Ir al login</Link></section></div>
}
function CustomerExperiencePaused() {
  return <main className="app-page"><section className="app-card" aria-labelledby="customer-experience-title"><img className="app-brand" src={appConfig.logoUrl} alt="Turnits" /><p style={{ margin: "0 0 8px", color: "#1b6b1a", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Turnits para clientes</p><h1 id="customer-experience-title">Estamos sumando negocios</h1><p>Primero estamos armando una buena oferta de agendas. Muy pronto vas a poder descubrir negocios y gestionar tus turnos desde acá.</p><Link className="app-button" to="/registro/negocio">Sumá tu negocio a Turnits</Link><p style={{ marginTop: 16 }}><Link to="/">Volver al inicio</Link></p></section></main>
}
function RegisterPage({ accountType = "usuario" }: { accountType?: "usuario" | "negocio" }) {
  const location = useLocation()
  if (accountType === "usuario" && !appConfig.consumerAccountsEnabled) return <Navigate to={`/registro/negocio${location.search}`} replace />
  if (accountType === "usuario" && new URLSearchParams(location.search).get("tipo") === "negocio") return <Navigate to={`/registro/negocio${location.search}`} replace />
  return <Register {...appConfig.register} baseUrl={appConfig.apiUrl} logoUrl={appConfig.registerLogoUrl} termsUrl="/terminos" privacyUrl="/privacidad" accountType={accountType} />
}
function BusinessRegisterRedirect() {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  query.delete("tipo")
  return <Navigate to={`/registro/negocio${query.size ? `?${query}` : ""}`} replace />
}
export default function App() {
  const location = useLocation()
  const loginType = new URLSearchParams(location.search).get("tipo")
  return <Suspense fallback={<BrandPreloader />}>{appConfig.staging && location.pathname !== "/consultas" && <div role="status" style={{position:"relative",zIndex:10000,padding:"8px 16px",textAlign:"center",background:"#fff0b3",color:"#604700",font:"600 13px Arial,sans-serif"}}>TURNITS TEST · Datos de prueba · Sin cobros reales · Funciones en desarrollo</div>}<Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={!appConfig.consumerAccountsEnabled && loginType === "usuario" ? <Navigate to="/" replace /> : <Login {...appConfig.login} apiUrl={appConfig.apiUrl} registerUrl="/registro" logoUrl={appConfig.loginLogoUrl} accentColor={appConfig.accentColor} />} />
    <Route path="/registro" element={<BusinessRegisterRedirect />} />
    <Route path="/registro/negocio" element={<RegisterPage accountType="negocio" />} />
    <Route path="/registro/negocios" element={<Navigate to={`/registro/negocio${window.location.search}`} replace />} />
    <Route path="/register" element={<Navigate to={`/registro/negocio${window.location.search}`} replace />} />
    <Route path="/browse" element={appConfig.customerExperienceEnabled && appConfig.consumerAccountsEnabled ? <Browse /> : <Navigate to="/" replace />} />
    <Route path="/consultas" element={<LegacyConsultationsRoute />} />
    <Route path="/panel" element={<PanelRoute />} />
    <Route path="/panel/:slug" element={<PanelRoute />} />
    <Route path="/renovar" element={<RenewRoute />} />
    <Route path="/agenda" element={<BookingRoute />} />
    <Route path="/agenda/:slug" element={<BookingRoute />} />
    <Route path="/planes" element={<PublicPlans />} />
    <Route path="/perfil/:slug" element={<BusinessProfile />} />
    <Route path="/perfil/:slug/publicaciones" element={<BusinessProfile publications />} />
    <Route path="/store-login" element={<Store />} />
    <Route path="/app" element={<AppGateway />} />
    <Route path="/internal" element={<Internal loginPath="/login" refreshSeconds={60} />} />
    <Route path="/reprogramar" element={<Reschedule />} />
    <Route path="/login-test" element={<Navigate to={`/login${window.location.search}`} replace />} />
    <Route path="/register-test" element={<Navigate to={`/registro/negocio${window.location.search}`} replace />} />
    <Route path="/panel-test" element={<PanelRoute />} />
    <Route path="/agenda-test" element={<BookingRoute />} />
    <Route path="/test" element={<AnimationTest />} />
    <Route path="/success" element={<Receipt />} />
    <Route path="/sucess" element={<Receipt />} />
    <Route path="/pendiente" element={<Receipt />} />
    <Route path="/error" element={<Receipt failed />} />
    <Route path="/alert" element={<Receipt failed />} />
    <Route path="/terminos" element={<Legal document="terms" />} />
    <Route path="/terminos-y-condiciones" element={<Legal document="terms" />} />
    <Route path="/privacidad" element={<Legal document="privacy" />} />
    <Route path="/politica-de-privacidad" element={<Legal document="privacy" />} />
    <Route path="/cambiar-contraseña" element={<ResetPassword />} />
    <Route path="/cambiar-contrasena" element={<ResetPassword />} />
    {/* turnits.com/{slug}: las rutas fijas de arriba tienen prioridad sobre este comodín. */}
    <Route path="/:slug" element={<BusinessLanding />} />
    <Route path="*" element={<MissingPage />} />
  </Routes><StartupRouteReady /></Suspense>
}
