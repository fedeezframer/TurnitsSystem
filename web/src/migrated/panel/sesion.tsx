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
import { GuardaSesion_detectar, MenuFooter_cerrarSesion } from "./common"

function TurnitsPanel_GuardaSesion({
    children,
    logoutUrl,
}: {
    children: React.ReactNode
    logoutUrl: string
}) {
    const [chequeado, setChequeado] = React.useState(false)
    const [conflicto, setConflicto] = React.useState<{
        slugUrl: string
        slugsToken: string[]
    } | null>(null)

    const [sinStorage, setSinStorage] = React.useState(false)

    React.useEffect(() => {
        if (true) {
            try {
                window.localStorage.getItem("__turnits_probe")
            } catch {
                setSinStorage(true)
            }
            const c = GuardaSesion_detectar()
            if (c) console.warn("[GuardaSesion] Token de otra cuenta", c)
            setConflicto(c)
        }
        setChequeado(true)
    }, [])

    if (!chequeado) return <div className="app-loading" role="status">Verificando sesión…</div>
    if (sinStorage) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    height: "100svh",
                    width: "100%",
                    padding: 24,
                    boxSizing: "border-box",
                    textAlign: "center",
                    fontFamily: "'Inter Display', -apple-system, sans-serif",
                    color: "#0f172a",
                    background: "#f8fafc",
                }}
            >
                <div style={{ fontSize: 17, fontWeight: 600 }}>
                    Tu navegador bloquea el almacenamiento
                </div>
                <div style={{ fontSize: 14, color: "#64748b", maxWidth: 360 }}>
                    Para mantener tu sesión hace falta permitirlo. Abrí el panel
                    en Chrome o Safari (no desde el navegador interno de
                    WhatsApp o Instagram) y desactivá el modo privado.
                </div>
            </div>
        )
    }
    if (!conflicto) return <>{children}</>

    const unica =
        conflicto.slugsToken.length === 1 ? conflicto.slugsToken[0] : ""

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                height: "100svh",
                width: "100%",
                padding: 24,
                boxSizing: "border-box",
                textAlign: "center",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                color: "#0f172a",
                background: "#f8fafc",
            }}
        >
            <div style={{ fontSize: 17, fontWeight: 600 }}>
                Esta sesión es de otra cuenta
            </div>
            <div style={{ fontSize: 14, color: "#64748b", maxWidth: 360 }}>
                Estás en el panel de <b>{conflicto.slugUrl}</b>, pero tu sesión
                guardada en este dispositivo es de{" "}
                <b>{conflicto.slugsToken.join(", ")}</b>. Cerrá sesión e ingresá
                de nuevo con la cuenta correcta.
            </div>
            <button
                onClick={() => MenuFooter_cerrarSesion(logoutUrl)}
                style={{
                    marginTop: 8,
                    padding: "10px 20px",
                    borderRadius: 10,
                    border: "none",
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                }}
            >
                Cerrar sesión
            </button>
            {unica && (
                <button
                    onClick={() => {
                        window.location.href = `/panel/${unica}`
                    }}
                    style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: "transparent",
                        color: "#0f172a",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    Ir al panel de {unica}
                </button>
            )}
        </div>
    )
}

export { TurnitsPanel_GuardaSesion }
