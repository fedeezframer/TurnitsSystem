import React, { lazy, Suspense } from "react"
import { Link, Navigate, Route, Routes, useParams } from "react-router"
import { appConfig } from "./config"
import Receipt from "./pages/Receipt"
import Legal from "./pages/Legal"
import ResetPassword from "./pages/ResetPassword"

const Login = lazy(() => import("./migrated/Login"))
const Register = lazy(() => import("./migrated/Register"))
const Booking = lazy(() => import("./migrated/Booking"))
const Panel = lazy(() => import("./migrated/panel"))
const Plans = lazy(() => import("./migrated/Plans"))

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
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<Login {...appConfig.login} apiUrl={appConfig.apiUrl} registerUrl="/registro" logoUrl={appConfig.loginLogoUrl} accentColor={appConfig.accentColor} />} />
    <Route path="/registro" element={<Register {...appConfig.register} baseUrl={appConfig.apiUrl} logoUrl={appConfig.registerLogoUrl} termsUrl="/terminos" privacyUrl="/privacidad" />} />
    <Route path="/register" element={<Navigate to="/registro" replace />} />
    <Route path="/panel" element={<PanelRoute />} />
    <Route path="/panel/:slug" element={<PanelRoute />} />
    <Route path="/renovar" element={<RenewRoute />} />
    <Route path="/agenda" element={<BookingRoute />} />
    <Route path="/agenda/:slug" element={<BookingRoute />} />
    <Route path="/planes" element={<Plans baseUrl={appConfig.apiUrl} registroUrl="/registro" accentColor={appConfig.accentColor} />} />
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
