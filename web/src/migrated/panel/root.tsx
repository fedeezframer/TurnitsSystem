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

function TurnitsPanel_SessionRouter(props: any) {
    const [sesion, setSesion] = React.useState<{
        rol: string
        slug: string
    } | null>(null)
    React.useEffect(() => {
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
        setSesion({ rol: claims?.rol || "owner", slug })
    }, [])
    if (false)
        return <TurnitsPanel_Inner {...props} />
    if (!sesion)
        return (
            <div
                style={{
                    minHeight: 240,
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                    fontFamily: "sans-serif",
                }}
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
            <TurnitsPanel_Inner {...props} />
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
