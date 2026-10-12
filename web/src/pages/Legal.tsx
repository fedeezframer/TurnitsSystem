import React from "react"
import { Link } from "react-router"
export default function Legal({ document }: { document: "terms" | "privacy" }) {
  const title = document === "terms" ? "Términos y condiciones" : "Política de privacidad"
  const href = document === "terms" ? "https://turnits.com/terminos-y-condiciones" : "https://turnits.com/politica-de-privacidad"
  return <main className="app-page"><section className="app-card"><Link to="/login">← Turnits</Link><h1 style={{marginTop:24}}>{title}</h1><p>Consultá el documento publicado en la web de Turnits.</p><a className="app-button" href={href} target="_blank" rel="noopener noreferrer">Abrir {title.toLowerCase()}</a></section></main>
}
