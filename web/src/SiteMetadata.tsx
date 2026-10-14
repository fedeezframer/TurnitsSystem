import { useEffect } from "react"
import { useLocation } from "react-router"

const publicOrigin = new URL(import.meta.env.VITE_SITE_URL || "https://turnits.com").origin
const publicPages: Record<string, string> = {
  "/": "/",
  "/planes": "/planes",
  "/terminos": "/terminos-y-condiciones",
  "/terminos-y-condiciones": "/terminos-y-condiciones",
  "/privacidad": "/politica-de-privacidad",
  "/politica-de-privacidad": "/politica-de-privacidad",
}

export default function SiteMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname === "/" ? "/" : pathname.replace(/\/$/, "")
    if (/^\/panel(?:\/|$|-test$)/.test(path)) document.title = "Turnits | Panel"
    else if (/^\/agenda(?:\/|$|-test$)/.test(path)) document.title = "Turnits | Agendar turno"
    else document.title = "Turnits | Agenda online"
    const canonicalPath = publicPages[path] || (/^\/agenda\/[^/]+$/.test(path) ? path : null)
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement("meta")
      robots.name = "robots"
      document.head.appendChild(robots)
    }
    robots.content = canonicalPath ? "index,follow" : "noindex,follow"
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonicalPath) {
      if (!canonical) {
        canonical = document.createElement("link")
        canonical.rel = "canonical"
        document.head.appendChild(canonical)
      }
      canonical.href = publicOrigin + canonicalPath
      document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", canonical.href)
    } else {
      canonical?.remove()
    }
  }, [pathname])
  return null
}
