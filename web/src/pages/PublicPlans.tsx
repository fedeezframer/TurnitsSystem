import React, { useRef } from "react"
import markup from "../published/planes.html?raw"
import "../published/planes.css"
import "./published.css"
import { usePublishedPage } from "./usePublishedPage"
export default function PublicPlans() {
  const root = useRef<HTMLDivElement>(null)
  usePublishedPage(root, "Turnits | Planes y precios")
  return <main className="published-planes" ref={root} dangerouslySetInnerHTML={{ __html: markup }} />
}
