import React, { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import FlowingLines from "./FlowingLines"
import markup from "../published/store-login.html?raw"
import "../published/store-login.css"
import "./published.css"
import { usePublishedPage } from "./usePublishedPage"
export default function Store() {
  const root = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState<HTMLElement | null>(null)
  usePublishedPage(root, "Turnits | Haz tu perfil")
  useLayoutEffect(() => { setTarget(root.current?.querySelector('[data-turnits-lines]') || null) }, [])
  return <main className="published-store-login" ref={root}>
    <div dangerouslySetInnerHTML={{ __html: markup }} />
    {target && createPortal(<FlowingLines />, target)}
  </main>
}
