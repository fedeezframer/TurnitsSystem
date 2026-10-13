import React, { useEffect } from "react"
import { Link } from "react-router"
import terms from "../content/terms.html?raw"
import privacy from "../content/privacy.html?raw"
import "./legal.css"
export default function Legal({ document }: { document: "terms" | "privacy" }) {
  const title = document === "terms" ? "Términos y Condiciones" : "Política de Privacidad"
  useEffect(() => {
    const previous = window.document.title
    window.document.title = `Turnits | ${title}`
    return () => { window.document.title = previous }
  }, [title])
  return <main className="turnits-legal-page">
    <header className="turnits-legal-header"><Link to="/" aria-label="Turnits, inicio">turnits</Link></header>
    <article className="turnits-legal-content" dangerouslySetInnerHTML={{ __html: document === "terms" ? terms : privacy }} />
  </main>
}
