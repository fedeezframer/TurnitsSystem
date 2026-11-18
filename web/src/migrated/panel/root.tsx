import { selectStoredSession } from "../../shared/session-startup"
import * as React from "react"
import BrandPreloader from "../../components/BrandPreloader"
import {
    useState,
    useEffect,
    useRef,
    useCallback,
    useLayoutEffect,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createPortal } from "react-dom"
import { GuardaSesion_leerJwt } from "./common"
import { TurnitsPanel_Inner } from "./layout"
import { TurnitsPanel_GuardaSesion } from "./sesion"
import { PanelErrorBoundary } from "./shared"
import { appConfig } from "../../config"
import { setPanelScope, type BranchPanelScope } from "../../shared/panel-scope"
import { BranchAdminContext } from "../../components/BranchAdmin"

const loadEmployeePanel = () => import("./empleado").then(m => ({ default: m.TurnitsEmpleadoPanel }))
const TurnitsEmpleadoPanel = React.lazy(loadEmployeePanel)

function TurnitsPanel_SessionRouter(props: any) {
    const [sesion, setSesion] = React.useState<{
        rol: string
        slug: string
        sucursal?: BranchPanelScope
    } | null>(null)
    const [error, setError] = React.useState("")
    React.useEffect(() => {
        let alive = true
        const session = selectStoredSession()
        if (!session) { window.location.replace("/login"); return }
        const token = session.token
        // Legacy components read different aliases. Keep them on the selected session.
        for (const key of ["access_token","user_token","token","auth_token","turnits_token"]) {
            if (key === "access_token") localStorage.setItem(key,token)
            else if (localStorage.getItem(key) && localStorage.getItem(key) !== token) localStorage.removeItem(key)
        }
        const claims = token ? GuardaSesion_leerJwt(token) : null
        if (claims?.rol === "consumidor") {
            setPanelScope(null)
            window.location.replace("/browse")
            return
        }
        const slug =
            claims?.slug ||
            (() => {
                try {
                    return localStorage.getItem("user_slug") || ""
                } catch {
                    return ""
                }
            })()
        if (claims?.rol !== "empleado") {
            setPanelScope(null)
            setSesion({ rol: claims?.rol || "owner", slug })
        } else {
            void loadEmployeePanel().catch(() => {})
            fetch(`${(props.baseUrl || appConfig.apiUrl).replace(/\/+$/, "")}/sesion/panel/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
                .then(async r => { const d = await r.json(); if (!r.ok || !d.success) throw Error(d.error || "No se pudo verificar tu acceso."); return d; })
                .then(d => { if (!alive) return; const branch = d.tipo === "admin_sucursal" ? d.sucursal : null; setPanelScope(branch); setSesion({ rol: branch ? "admin_sucursal" : "empleado", slug, sucursal: branch }); })
                .catch(e => alive && setError(e.message))
        }
        return () => { alive = false }
    }, [props.baseUrl])
    React.useEffect(() => {
        const session = selectStoredSession()
        if (!session?.exp) return
        let timer: number
        const check = () => {
            window.clearTimeout(timer)
            const current = selectStoredSession()
            if (!current) { window.location.replace("/login"); return }
            if (current.token !== session.token) { window.location.replace("/app"); return }
            timer = window.setTimeout(check, Math.min(2_147_000_000, Math.max(1000,current.exp * 1000 - Date.now())))
        }
        const visible = () => { if (!document.hidden) check() }
        check()
        document.addEventListener("visibilitychange",visible)
        return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange",visible) }
    },[])
    if (error) return <div className="app-page"><section className="app-card"><p role="alert">{error}</p><a className="app-button" href="/login">Volver a iniciar sesión</a></section></div>
    if (false)
        return <TurnitsPanel_Inner {...props} />
    if (!sesion) return <BrandPreloader />
    if (sesion.rol === "empleado")
        return <React.Suspense fallback={<BrandPreloader />}><TurnitsEmpleadoPanel props={props} slug={sesion.slug} /></React.Suspense>
    return (
        <TurnitsPanel_GuardaSesion
            logoutUrl={props.logoutUrl || "/login"}
        >
            <BranchAdminContext.Provider value={sesion.sucursal || null}>
                <TurnitsPanel_Inner {...props} branchAdmin={sesion.sucursal} />
            </BranchAdminContext.Provider>
        </TurnitsPanel_GuardaSesion>
    )
}

function TurnitsPanel(props: any) {
    return (
        <PanelErrorBoundary>
            <TurnitsPanel_SessionRouter {...props} />
        </PanelErrorBoundary>
    )
}

export { TurnitsPanel_SessionRouter, TurnitsPanel }
