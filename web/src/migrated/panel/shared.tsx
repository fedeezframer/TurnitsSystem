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
import { AutoUpdate_ejecutar } from "./common"

function TurnitsPlanIcon({ plan, size = 20 }: { plan: "basico" | "premium"; size?: number }) {
    return plan === "basico" ? (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
<path d="M12.532 2.6252L15.6952 5.9674L20.2584 6.562C21.2547 6.6919 22 7.5406 22 8.5453C22 8.8795 21.9162 9.2084 21.7564 9.5019L19.5553 13.5431L20.3998 18.0667C20.4224 18.1878 20.4338 18.3107 20.4338 18.4338C20.4338 19.5384 19.5384 20.4338 18.4338 20.4338C18.3107 20.4338 18.1878 20.4224 18.0667 20.3998L13.5431 19.5553L9.5019 21.7564C9.2084 21.9162 8.8795 22 8.5453 22C7.5406 22 6.6919 21.2547 6.562 20.2584L5.9674 15.6952L2.6252 12.532C2.2261 12.1542 2 11.6289 2 11.0794C2 10.3075 2.4442 9.6045 3.1414 9.2731L7.2975 7.2975L9.2731 3.1414C9.6045 2.4442 10.3075 2 11.0794 2C11.6289 2 12.1542 2.2261 12.532 2.6252Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
<path d="M9.87109 8.75514L10.5822 13.4194M13.8254 8.15234L14.5365 12.8166" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
<path d="M10 16C12.4932 16.884 13.8431 16.8887 16 15.5" stroke="currentColor" strokeWidth="1.5"/>
</svg>
) : (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
<path d="M4.48264 7.84546L5.38921 15.5035H18.6302L19.5316 7.73372L16.1974 9L11.9962 5.38589L7.68164 9L4.48264 7.84546ZM14.9187 5.84844L14.8376 5.9355L14.9842 5.95369L16.1974 7.90133L17.6914 6.28761L17.837 6.3058L17.7725 6.19925L20.2812 3.48892C20.4416 3.316 20.6404 3.20842 20.851 3.18058C21.0616 3.15273 21.2741 3.20596 21.4598 3.33313C21.6456 3.46031 21.7958 3.65536 21.8905 3.89218C21.9851 4.129 22.0196 4.39629 21.9893 4.65829L20.4299 18.1021H3.59477L2.01138 4.71936C1.97993 4.4559 2.01403 4.18674 2.10906 3.94831C2.20409 3.70989 2.35546 3.51372 2.54267 3.38639C2.72987 3.25906 2.94387 3.20671 3.15568 3.23644C3.36749 3.26617 3.56686 3.37653 3.72681 3.55259L6.11905 6.18366L6.06707 6.26162L6.18039 6.25123L7.68164 7.90133L8.9417 5.96148L9.05502 5.94979L8.99265 5.88223L11.2081 2.47937C11.3068 2.32775 11.4316 2.20592 11.5732 2.12293C11.7148 2.03995 11.8696 1.99795 12.0259 2.00008C12.1823 2.0022 12.3363 2.04839 12.4764 2.13519C12.6165 2.222 12.7392 2.3472 12.8352 2.50146L14.9187 5.84844ZM3.67587 19.4014C10.0827 20.8573 13.2192 21.3213 20.3103 19.4014V20.7007C20.3103 21.0453 20.2008 21.3758 20.0058 21.6194C19.8108 21.8631 19.5464 22 19.2706 22H4.71552C4.43978 22 4.17535 21.8631 3.98037 21.6194C3.7854 21.3758 3.67587 21.0453 3.67587 20.7007V19.4014Z" fill="currentColor"/>
<path d="M10 9V12" stroke="currentColor" strokeWidth="1.5"/>
<path d="M14 9V12" stroke="currentColor" strokeWidth="1.5"/>
<path d="M10 13C11.5073 13.9414 12.493 13.8575 14 13" stroke="currentColor"/>
</svg>
)
}

function TurnitsPlanRequirement({ premiumOnly = false, color = "#64748b" }: { premiumOnly?: boolean; color?: string }) {
    const label = premiumOnly ? "Requiere Plan Premium" : "Disponible con Plan Básico o Plan Premium"
    return <span role="img" aria-label={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, color, flexShrink: 0 }}>
        {!premiumOnly && <TurnitsPlanIcon plan="basico" />}
        <TurnitsPlanIcon plan="premium" />
    </span>
}

class PanelErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props)
        this.state = { error: null }
    }
    static getDerivedStateFromError(error: Error) {
        return { error }
    }
    componentDidCatch(error: Error, info: any) {
        console.error("[TurnitsPanel] Error no controlado:", error, info)
    }
    render() {
        if (this.state.error) {
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
                        fontFamily:
                            "'Inter Display', -apple-system, sans-serif",
                        color: "#0f172a",
                        background: "#f8fafc",
                    }}
                >
                    <div style={{ fontSize: 17, fontWeight: 600 }}>
                        Algo falló al cargar el panel
                    </div>
                    <div
                        style={{
                            fontSize: 14,
                            color: "#64748b",
                            maxWidth: 340,
                        }}
                    >
                        Probá recargar la página. Si el problema sigue, avisale
                        a soporte.
                    </div>
                    <button
                        onClick={() => AutoUpdate_ejecutar(null)}
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
                        Recargar
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

function PanelUpdateBanner({
    visible,
    accentColor,
    onUpdate,
    onDismiss,
}: {
    visible: boolean
    accentColor: string
    onUpdate: () => void
    onDismiss: () => void
}) {
    return (
        <AnimatePresence>
            {visible && (
                <div
                    style={{
                        position: "fixed",
                        left: 0,
                        right: 0,
                        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
                        display: "flex",
                        justifyContent: "center",
                        padding: "0 12px",
                        pointerEvents: "none",
                        zIndex: 99999,
                    }}
                >
                    <motion.div
                        role="status"
                        aria-live="polite"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            pointerEvents: "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            maxWidth: 420,
                            padding: "10px 10px 10px 16px",
                            borderRadius: 14,
                            background: "#0f172a",
                            color: "#fff",
                            boxShadow: "0 8px 30px rgba(15,23,42,0.28)",
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                            fontSize: 14,
                            fontWeight: 500,
                        }}
                    >
                        <span style={{ flex: 1 }}>
                            Hay una nueva versión del panel
                        </span>
                        <button
                            onClick={onDismiss}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#94a3b8",
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                padding: "6px 4px",
                            }}
                        >
                            Después
                        </button>
                        <button
                            onClick={onUpdate}
                            style={{
                                border: "none",
                                background: accentColor,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                padding: "8px 14px",
                                borderRadius: 10,
                            }}
                        >
                            Actualizar
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

export { TurnitsPlanIcon, TurnitsPlanRequirement, PanelErrorBoundary, PanelUpdateBanner }
