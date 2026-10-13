import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router"
import markup from "../published/home.html?raw"
import "../published/home.css"
import "./published.css"
import Turnos from "../migrated/public/TurnosHoyDecorative"
import Servicios from "../migrated/public/ServiciosDecorative"
import BookingDemo from "../migrated/public/UXDecorative"
import DashboardDemo from "../migrated/public/DashboardDecorative"
import { usePublishedPage } from "./usePublishedPage"

export default function Home() {
  const root = useRef<HTMLDivElement>(null)
  const [targets, setTargets] = useState<Array<{ type: number; node: HTMLElement }>>([])
  const navigate = useNavigate()
  usePublishedPage(root, "Turnits | Plataforma de Agenda Online")
  useLayoutEffect(() => {
    const nodes = ["framer-1jc9o8v-container", "framer-1vg9fim-container", "framer-l8pqpu-container", "framer-hn2xd-container"].flatMap((cls, type) => Array.from(root.current!.querySelectorAll<HTMLElement>(`.${cls}`)).map(node => ({ type, node })))
    nodes.forEach(({ node }) => node.replaceChildren())
    setTargets(nodes)
  }, [])
  useEffect(() => {
    const faqs = Array.from(root.current?.querySelectorAll<HTMLElement>(".framer-oFwoM") || [])
    const dispose = faqs.map(faq => {
    const desktop = ["1f38hk2", "gqlgut", "1s5kbrh", "1k40el5", "1cgvdwx", "1yt944k", "1icbckj", "emesxz"]
    const mobile = ["wn6y17", "8q1aid", "1nbu0qa", "bp174", "qqf1bi", "1v2p3ag", "guxgbk", "1pplb07"]
    let selected = 0
    const headings = Array.from(faq.querySelectorAll("h3")).filter(el => !el.closest('[data-framer-name^="Q"]'))
    const buttons = headings.map(el => el.parentElement!.parentElement!)
    const answers = Array.from(faq.querySelectorAll<HTMLElement>('[data-framer-name^="Q"]'))
    const apply = () => {
      Array.from(faq.classList).filter(cls => cls.startsWith("framer-v-")).forEach(cls => faq.classList.remove(cls))
      faq.classList.add(`framer-v-${(matchMedia("(min-width:1440px)").matches ? desktop : mobile)[selected]}`)
      buttons.forEach((button, index) => button.setAttribute("aria-expanded", String(selected === index + 1)))
      answers.forEach((answer, index) => { answer.inert = selected !== index + 1; answer.setAttribute("aria-hidden", String(selected !== index + 1)) })
    }
    const cleanups: Array<() => void> = []
    buttons.forEach((button, index) => {
      button.setAttribute("role", "button"); button.tabIndex = 0
      const open = () => { selected = selected === index + 1 ? 0 : index + 1; apply() }
      const keyboard = (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open() } }
      button.addEventListener("click", open); button.addEventListener("keydown", keyboard)
      cleanups.push(() => { button.removeEventListener("click", open); button.removeEventListener("keydown", keyboard) })
    })
    answers.forEach(answer => {
      const close = (event: MouseEvent) => { if (!(event.target as Element).closest("a")) { selected = 0; apply() } }
      answer.addEventListener("click", close); cleanups.push(() => answer.removeEventListener("click", close))
    })
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { selected = 0; apply() } }
    faq.addEventListener("keydown", escape); window.addEventListener("resize", apply); apply()
    return () => { cleanups.forEach(cleanup => cleanup()); faq.removeEventListener("keydown", escape); window.removeEventListener("resize", apply) }
    })
    return () => dispose.forEach(cleanup => cleanup())
  }, [])
  const followLink = (event: React.MouseEvent) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]")
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === "_blank") return
    const url = new URL(link.href)
    if (url.origin === location.origin && !url.hash) { event.preventDefault(); window.scrollTo(0, 0); navigate(url.pathname + url.search) }
  }
  return <div className="published-home" ref={root} onClick={followLink}>
    <div dangerouslySetInnerHTML={{ __html: markup }} />
    {targets.map(({ type, node }, index) => createPortal([
      <Turnos accentColor="#22c55e" style={{ width: "100%", height: "100%" }} />,
      <Servicios accentColor="#22c55e" servicio1="Servicio 1" servicio2="Servicio 2" servicio3="Servicio 3" servicio4="Servicio 4" servicio5="Servicio 5" servicioIcono="/assets/site/VpxjmTO3yFofIpLVKsnzIHuDV4.svg" />,
      <BookingDemo businessName="" />,
      <DashboardDemo accentColor="#22c55e" style={{ width: "100%" }} />,
    ][type], node, String(index)))}

  </div>
}
