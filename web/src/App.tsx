import React, { lazy, Suspense } from "react"
import { Link, Navigate, Route, Routes, useParams } from "react-router"
import { appConfig } from "./config"
import Receipt from "./pages/Receipt"
import ResetPassword from "./pages/ResetPassword"

const Login = lazy(() => import("./migrated/Login"))
const Register = lazy(() => import("./migrated/Register"))
const Booking = lazy(() => import("./migrated/Booking"))
const Panel = lazy(() => import("./migrated/panel"))
const Home = lazy(() => import("./pages/Home"))
const Legal = lazy(() => import("./pages/Legal"))
const PublicPlans = lazy(() => import("./pages/PublicPlans"))
const Store = lazy(() => import("./pages/Store"))
const AppGateway = lazy(() => import("./pages/AppGateway"))
const Internal = lazy(() => import("./migrated/public/AdminStats"))
const Reschedule = lazy(() => import("./pages/Reschedule"))
const AnimationTest = lazy(() => import("./pages/AnimationTest"))
const BusinessProfile = lazy(() => import("./pages/BusinessProfile"))

function PanelRoute() {
  return <Panel {...appConfig.panel} baseUrl={appConfig.apiUrl} accentColor={appConfig.accentColor} logoImage={appConfig.logoUrl} mpClientId={appConfig.mpClientId} logoutUrl="/login" style={{ width: "100%", minHeight: "100dvh" }} />
}
function RenewRoute() {
  const query = new URLSearchParams(window.location.search)
  const slug = query.get("u") || query.get("slug") || localStorage.getItem("user_slug") || ""
  if (!slug) return <Navigate to="/login" replace />
  query.set("planes", "actual")
  return <Navigate to={`/panel/${encodeURIComponent(slug)}?${query}`} replace />
}
function BookingRoute() {
  const { slug } = useParams()
  return <Booking {...appConfig.booking} baseUrl={appConfig.apiUrl} manualSlug={slug || ""} useNegocioTheme={true} />
}
function MissingPage() {
  return <div className="app-page"><section className="app-card"><img className="app-brand" src={appConfig.logoUrl} alt="Turnits" /><h1>Página no encontrada</h1><p>Revisá el enlace o volvé a iniciar sesión.</p><Link className="app-button" to="/login">Ir al login</Link></section></div>
}
export default function App() {
  return <Suspense fallback={<div className="app-loading" role="status">Cargando Turnits…</div>}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<Login {...appConfig.login} apiUrl={appConfig.apiUrl} registerUrl="/registro" logoUrl={appConfig.loginLogoUrl} accentColor={appConfig.accentColor} />} />
    <Route path="/registro" element={<Register {...appConfig.register} baseUrl={appConfig.apiUrl} logoUrl={appConfig.registerLogoUrl} termsUrl="/terminos" privacyUrl="/privacidad" />} />
    <Route path="/register" element={<Navigate to={`/registro${window.location.search}`} replace />} />
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
    <Route path="/register-test" element={<Navigate to={`/registro${window.location.search}`} replace />} />
    <Route path="/panel-test" element={<PanelRoute />} />
    <Route path="/agenda-test" element={<BookingRoute />} />
    <Route path="/test" element={<AnimationTest />} />
    <Route path="/success" element={<Receipt />} />
    <Route path="/pendiente" element={<Receipt />} />
    <Route path="/error" element={<Receipt failed />} />
    <Route path="/alert" element={<Receipt failed />} />
    <Route path="/terminos" element={<Legal document="terms" />} />
    <Route path="/terminos-y-condiciones" element={<Legal document="terms" />} />
    <Route path="/privacidad" element={<Legal document="privacy" />} />
    <Route path="/politica-de-privacidad" element={<Legal document="privacy" />} />
    <Route path="/cambiar-contraseña" element={<ResetPassword />} />
    <Route path="/cambiar-contrasena" element={<ResetPassword />} />
    <Route path="*" element={<MissingPage />} />
  </Routes></Suspense>
}
