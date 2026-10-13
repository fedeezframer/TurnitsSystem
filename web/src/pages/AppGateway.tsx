import React from "react"
import { useAppSessionRedirect } from "../migrated/public/Appverify"
export default function AppGateway() {
  useAppSessionRedirect()
  return <div className="app-loading" role="status">Abriendo tu panel…</div>
}
