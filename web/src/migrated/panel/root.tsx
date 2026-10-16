import * as React from "react"
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
import { TurnitsEmpleadoPanel } from "./empleado"
import { TurnitsPanel_GuardaSesion } from "./sesion"
import { PanelErrorBoundary } from "./shared"
import { appConfig } from "../../config"
import { setPanelScope, type BranchPanelScope } from "../../shared/panel-scope"
import { BranchAdminContext } from "../../components/BranchAdmin"

function TurnitsPanel_SessionRouter(props: any) {
    const [sesion, setSesion] = React.useState<{
        rol: string
        slug: string
        sucursal?: BranchPanelScope
    } | null>(null)
    const [error, setError] = React.useState("")
    React.useEffect(() => {
        let alive = true
        const token =
            [
                "access_token",
                "user_token",
                "token",
                "auth_token",
                "turnits_token",
            ]
                .map((key) => {
                    try {
                        return localStorage.getItem(key)
                    } catch {
                        return null
                    }
                })
                .find(Boolean) || ""
        const claims = token ? GuardaSesion_leerJwt(token) : null
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
            fetch(`${(props.baseUrl || appConfig.apiUrl).replace(/\/+$/, "")}/sesion/panel/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
                .then(async r => { const d = await r.json(); if (!r.ok || !d.success) throw Error(d.error || "No se pudo verificar tu acceso."); return d; })
                .then(d => { if (!alive) return; const branch = d.tipo === "admin_sucursal" ? d.sucursal : null; setPanelScope(branch); setSesion({ rol: branch ? "admin_sucursal" : "empleado", slug, sucursal: branch }); })
                .catch(e => alive && setError(e.message))
        }
        return () => { alive = false }
    }, [props.baseUrl])
    if (error) return <div className="app-page"><section className="app-card"><p role="alert">{error}</p><a className="app-button" href="/login">Volver a iniciar sesión</a></section></div>
    if (false)
        return <TurnitsPanel_Inner {...props} />
    if (!sesion)
        return (
            <div
                className="app-loading"
                role="status"
            >
                Cargando panel…
            </div>
        )
    if (sesion.rol === "empleado")
        return <TurnitsEmpleadoPanel props={props} slug={sesion.slug} />
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
