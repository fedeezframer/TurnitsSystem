import React from "react"
import { Link } from "react-router"
import { appConfig } from "../config"
import Form from "../migrated/public/ReprogramarTurno"
export default function Reschedule() {
  return <main style={{ background: "white", minHeight: "100dvh", padding: "0 16px 48px" }}>
    <header style={{ height: 100, display: "grid", placeItems: "center" }}>
      <Link to="/" aria-label="Turnits, inicio"><img src={appConfig.logoUrl} alt="Turnits" style={{ width: 150, height: 70, objectFit: "contain" }} /></Link>
    </header>
    <Form baseUrl={appConfig.apiUrl} useNegocioTheme brandColor={appConfig.accentColor} />
  </main>
}
