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
import { safeLocalStorage, SeccionId, TurnitsGlobalSaveManager_get, TurnitsGlobalSaveSection, QrPanel_slug, MenuFooter_getToken, QrPanel_encode, QrPanel_path, QrPanel_guardarCanvas, QrPanel_canvasCartel, QrPanel_canvasQr, QrPanel_guardarBlob, QrPanel_svgString, TurnitsInstallPromptEvent, MenuFooter_getSlug, safeLocalStorageSet, NotificacionesPanel_urlBase64ToUint8Array } from "./common"
import { AmbientOrbs } from "./equipo"

function TurnitsPanel_Splash({
    baseUrl,
    accentColor,
    logoImage,
    logoText,
    onDone,
}: {
    baseUrl: string
    accentColor: string
    logoImage?: string
    logoText?: string
    onDone: () => void
}) {
    const [fase, setFase] = React.useState<"logo" | "saludo" | "saliendo">(
        "logo"
    )
    const [nombre, setNombre] = React.useState("")

    // Mismo criterio que UserGreeting para traer el nombre de la persona.
    React.useEffect(() => {
        const token = safeLocalStorage("access_token")
        const slug = safeLocalStorage("user_slug")
        if (!token || !slug) return
        fetch(`${baseUrl.replace(/\/+$/, "")}/settings/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.success && d.settings?.nombre_persona) {
                    setNombre(d.settings.nombre_persona)
                }
            })
            .catch(() => {})
    }, [baseUrl])

    // Secuencia fija: logo (0.9s) → saludo (2.9s) → fade out (0.46s) → onDone.
    // No espera a que terminen los fetches de cada widget (eso variaría
    // mucho); en ese lapso ya alcanzan a resolver de sobra en paralelo.
    React.useEffect(() => {
        const t1 = setTimeout(() => setFase("saludo"), 900)
        const t2 = setTimeout(() => setFase("saliendo"), 3800)
        const t3 = setTimeout(() => onDone(), 4260)
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
            clearTimeout(t3)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{
                opacity: fase === "saliendo" ? 0 : 1,
                filter: fase === "saliendo" ? "blur(10px)" : "blur(0px)",
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={
                {
                    position: "fixed",
                    inset: 0,
                    zIndex: 9999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    background:
                        "linear-gradient(180deg, #fbfcff 0%, #f6f7fb 100%)",
                    pointerEvents: fase === "saliendo" ? "none" : "auto",
                    "--accent": accentColor,
                } as React.CSSProperties
            }
        >
            <AmbientOrbs accentColor={accentColor} />

            <AnimatePresence mode="wait">
                {fase === "logo" ? (
                    <motion.div
                        key="logo"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        {logoImage ? (
                            <img
                                src={logoImage}
                                alt=""
                                style={{
                                    width: 88,
                                    height: 88,
                                    objectFit: "contain",
                                }}
                            />
                        ) : (
                            <span
                                style={{
                                    fontSize: 30,
                                    fontWeight: 500,
                                    letterSpacing: "-0.02em",
                                    color: accentColor,
                                    fontFamily:
                                        "'Inter Display', -apple-system, sans-serif",
                                }}
                            >
                                {logoText || "turnits"}
                            </span>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="saludo"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        style={{ position: "relative", textAlign: "center" }}
                    >
                        <div
                            style={{
                                fontSize: 24,
                                fontWeight: 500,
                                letterSpacing: "-0.02em",
                                color: "#0f172a",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                            }}
                        >
                            Hola{nombre ? `, ${nombre}` : ""}
                        </div>
                        <div
                            style={{
                                marginTop: 4,
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#94a3b8",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                            }}
                        >
                            Preparando tu panel…
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function TurnitsGlobalSaveBar({
    seccionActiva,
    accentColor = "#1B6B1A",
    isMobile = false,
}: {
    seccionActiva: SeccionId
    accentColor?: string
    isMobile?: boolean
}) {
    const [dirty, setDirty] = React.useState(false)
    const [dirtySections, setDirtySections] = React.useState<string[]>([])
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState("")
    const [success, setSuccess] = React.useState(false)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const manager = TurnitsGlobalSaveManager_get()
        const sync = () => {
            const sections = [
                ["horarios", "Horarios"],
                ["excepciones", "Excepciones"],
                ["pagos", "Pagos"],
                ["tema", "Tema"],
            ]
                .filter(([key]) =>
                    manager?.isDirty(key as TurnitsGlobalSaveSection)
                )
                .map(([, label]) => label)
            setDirtySections(sections)
            setDirty(sections.length > 0)
        }
        const onState = (e: any) => setSaving(!!e?.detail?.saving)
        const onSuccess = () => {
            setError("")
            setSuccess(true)
            setTimeout(() => setSuccess(false), 2200)
            sync()
        }
        const onError = (e: any) => {
            setError(
                e?.detail?.error || "No se pudieron guardar todos los cambios."
            )
            setSaving(false)
            sync()
        }
        sync()
        window.addEventListener("turnits_global_dirty_changed", sync)
        window.addEventListener("turnits_global_save_state", onState)
        window.addEventListener("turnits_global_save_success", onSuccess)
        window.addEventListener("turnits_global_save_error", onError)
        return () => {
            window.removeEventListener("turnits_global_dirty_changed", sync)
            window.removeEventListener("turnits_global_save_state", onState)
            window.removeEventListener("turnits_global_save_success", onSuccess)
            window.removeEventListener("turnits_global_save_error", onError)
        }
    }, [])
    if (seccionActiva === "inicio" || (!dirty && !saving && !error && !success))
        return null
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                position: "relative",
                top: "auto",
                zIndex: "auto",
                display: "flex",
                alignItems: "center",
                gap: 12,
                minHeight: 52,
                padding: "8px 12px 10px",
                marginTop: isMobile ? 0 : -34,
                marginBottom: isMobile ? 8 : 16,
                boxSizing: "border-box",
                background: isMobile ? "#ffffff" : "rgba(248,250,252,0.96)",
                border: isMobile ? "1px solid #e2e8f0" : "none",
                borderRadius: isMobile ? 14 : 0,
                boxShadow: isMobile ? "0 4px 14px rgba(15,23,42,0.08)" : "none",
                backdropFilter: isMobile ? "none" : "blur(10px)",
                WebkitBackdropFilter: isMobile ? "none" : "blur(10px)",
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: error
                            ? "#dc2626"
                            : success
                              ? accentColor
                              : "#1e293b",
                    }}
                >
                    {error ||
                        (success
                            ? "Cambios guardados"
                            : saving
                              ? "Guardando cambios…"
                              : "Hay cambios sin guardar")}
                </div>
                {!error && !success && !saving && (
                    <div
                        style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}
                    >
                        {dirtySections.length > 0
                            ? `Se modificó: ${dirtySections.join(", ")}.`
                            : "Guardalos para que queden aplicados en tu agenda."}
                    </div>
                )}
            </div>
            {!success && (
                <motion.button
                    // No escalar al pulsar: el transform de Framer se veía
                    // cortado dentro de la barra sticky en pantallas chicas.
                    whileTap={{ opacity: !saving ? 0.78 : 1 }}
                    type="button"
                    onClick={() => {
                        setError("")
                        setSuccess(false)
                        TurnitsGlobalSaveManager_get()?.saveAll()
                    }}
                    disabled={saving || !dirty}
                    style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        border: "none",
                        boxSizing: "border-box",
                        minWidth: 124,
                        background: dirty && !saving ? accentColor : "#e2e8f0",
                        color: dirty && !saving ? "#fff" : "#94a3b8",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: dirty && !saving ? "pointer" : "default",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                    }}
                >
                    {saving ? "Guardando…" : "Guardar cambios"}
                </motion.button>
            )}
        </motion.div>
    )
}

function QrPanel_Glifo({ size = 24 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h4v-3" />
        </svg>
    )
}

function QrFlotante({
    baseUrl,
    accentColor,
    isMobile,
    inline = false,
    mostrarToggle = false,
    iconoPagosActivos,
    iconoAgendaSinPagos,
}: {
    baseUrl: string
    accentColor: string
    isMobile: boolean
    inline?: boolean
    mostrarToggle?: boolean
    iconoPagosActivos?: string
    iconoAgendaSinPagos?: string
}) {
    const [montado, setMontado] = React.useState(false)
    const [slug, setSlug] = React.useState("")
    const [abierto, setAbierto] = React.useState(false)
    const [negocio, setNegocio] = React.useState("")
    const [copiado, setCopiado] = React.useState(false)
    const [hover, setHover] = React.useState(false)
    const [hoverToggle, setHoverToggle] = React.useState(false)
    const [esPremium, setEsPremium] = React.useState(false)
    const [agendaSinPagos, setAgendaSinPagos] = React.useState(false)
    const [guardandoAgendaSinPagos, setGuardandoAgendaSinPagos] =
        React.useState(false)
    const pidioNombre = React.useRef(false)

    React.useEffect(() => {
        if (false) return
        setSlug(QrPanel_slug())
        setMontado(true)
    }, [])

    React.useEffect(() => {
        if (!mostrarToggle || !slug) return
        const token = MenuFooter_getToken()
        if (!token) return
        fetch(`${baseUrl.replace(/\/+$/, "")}/settings/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-cache",
        })
            .then((r) => r.json())
            .then((d) => {
                const cfg = d?.settings || {}
                setEsPremium(cfg.plan === "premium")
                setAgendaSinPagos(cfg.agenda_sin_pagos === true)
            })
            .catch(() => {})
    }, [mostrarToggle, slug, baseUrl])

    const toggleAgendaSinPagos = async () => {
        if (!esPremium || guardandoAgendaSinPagos) return
        const token = MenuFooter_getToken()
        if (!token) return
        const nuevoValor = !agendaSinPagos
        setGuardandoAgendaSinPagos(true)
        try {
            const res = await fetch(
                `${baseUrl.replace(/\/+$/, "")}/settings/${slug}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ agenda_sin_pagos: nuevoValor }),
                }
            )
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.success) {
                setAgendaSinPagos(nuevoValor)
                window.dispatchEvent(
                    new CustomEvent("agenda_sin_pagos_changed", {
                        detail: nuevoValor,
                    })
                )
            }
        } catch (e) {
            console.error(
                "[QrFlotante] No se pudo cambiar el modo de cobro:",
                e
            )
        } finally {
            setGuardandoAgendaSinPagos(false)
        }
    }

    // Nombre del negocio (para el cartel): se pide una sola vez, al abrir.
    React.useEffect(() => {
        if (!abierto || pidioNombre.current || !slug) return
        pidioNombre.current = true
        const token = MenuFooter_getToken()
        if (!token) return
        fetch(`${baseUrl.replace(/\/+$/, "")}/settings/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.success && d.settings?.business_name)
                    setNegocio(String(d.settings.business_name))
            })
            .catch(() => {})
    }, [abierto, slug, baseUrl])

    React.useEffect(() => {
        if (!abierto) return
        const onKey = (e: KeyboardEvent) =>
            e.key === "Escape" && setAbierto(false)
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [abierto])

    const url = slug ? `https://turnits.com/agenda/${slug}` : ""
    const matriz = React.useMemo(() => {
        if (!url) return null
        try {
            return QrPanel_encode(url)
        } catch {
            return null
        }
    }, [url])

    if (!montado || false) return null

    const n = matriz ? matriz.length + 8 : 0

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(url)
        } catch {
            const t = document.createElement("textarea")
            t.value = url
            document.body.appendChild(t)
            t.select()
            try {
                document.execCommand("copy")
            } catch {}
            t.remove()
        }
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1800)
    }

    const btnBase: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "'Inter Display', -apple-system, sans-serif",
        padding: "11px 14px",
        border: "1.5px solid #e5e9f0",
        background: "#ffffff",
        color: "#334155",
        textDecoration: "none",
        boxSizing: "border-box",
    }

    const contenido = (
        <>
            {/* Cuadradito fijo abajo a la derecha */}
            {mostrarToggle && esPremium && (
                <motion.button
                    onClick={toggleAgendaSinPagos}
                    onMouseEnter={() => setHoverToggle(true)}
                    onMouseLeave={() => setHoverToggle(false)}
                    whileTap={{ scale: 0.92 }}
                    disabled={guardandoAgendaSinPagos}
                    aria-label={
                        agendaSinPagos
                            ? "Desactivar agenda sin pagos"
                            : "Activar agenda sin pagos"
                    }
                    title={
                        agendaSinPagos
                            ? "Agenda sin pagos activada"
                            : "Activar agenda sin pagos"
                    }
                    style={{
                        position: inline ? "relative" : "fixed",
                        right: inline ? undefined : 84,
                        bottom: inline ? undefined : 22,
                        zIndex: inline ? undefined : 65,
                        flexShrink: 0,
                        width: inline ? 38 : 52,
                        height: inline ? 38 : 52,
                        borderRadius: inline ? 12 : 16,
                        border: `1.5px solid ${hoverToggle ? accentColor + "66" : "#eef1f6"}`,
                        background: "#ffffff",
                        color: agendaSinPagos ? "#808080" : "#1B6B1A",
                        boxShadow: hoverToggle
                            ? "0 12px 30px rgba(15,23,42,0.20), 0 2px 8px rgba(15,23,42,0.08)"
                            : "0 8px 24px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)",
                        cursor: guardandoAgendaSinPagos ? "wait" : "pointer",
                        opacity: guardandoAgendaSinPagos ? 0.6 : 1,
                        padding: 0,
                        transition:
                            "box-shadow 0.15s ease, border-color 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {(
                        agendaSinPagos ? iconoAgendaSinPagos : iconoPagosActivos
                    ) ? (
                        <img
                            src={
                                agendaSinPagos
                                    ? iconoAgendaSinPagos
                                    : iconoPagosActivos
                            }
                            alt=""
                            style={{
                                width: inline ? 20 : 26,
                                height: inline ? 20 : 26,
                                objectFit: "contain",
                            }}
                        />
                    ) : (
                        <svg
                            width={inline ? 21 : 27}
                            height={inline ? 21 : 27}
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M12 2v20M17 6.5C16.2 5.5 14.8 5 12.8 5 10.3 5 9 6.1 9 7.8c0 4.2 8 1.7 8 6 0 1.9-1.7 3.2-4.7 3.2-2.2 0-3.8-.7-4.8-2"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                            />
                            {agendaSinPagos && (
                                <path
                                    d="M4 4l16 16"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                />
                            )}
                        </svg>
                    )}
                </motion.button>
            )}
            <motion.button
                onClick={() => setAbierto(true)}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                whileTap={{ scale: 0.92 }}
                aria-label="Ver mi código QR"
                title="Mi código QR"
                style={{
                    ...(inline
                        ? { position: "relative" as const, flexShrink: 0 }
                        : {
                              position: "fixed" as const,
                              right: 22,
                              bottom: 22,
                              zIndex: 65,
                          }),
                    width: inline ? 38 : 52,
                    height: inline ? 38 : 52,
                    borderRadius: inline ? 12 : 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ffffff",
                    color: accentColor,
                    border: `1.5px solid ${hover ? accentColor + "66" : "#eef1f6"}`,
                    boxShadow: hover
                        ? "0 12px 30px rgba(15,23,42,0.20), 0 2px 8px rgba(15,23,42,0.08)"
                        : "0 8px 24px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)",
                    cursor: "pointer",
                    padding: 0,
                    transition:
                        "box-shadow 0.15s ease, border-color 0.15s ease",
                }}
            >
                <QrPanel_Glifo size={inline ? 20 : 26} />
            </motion.button>

            <AnimatePresence>
                {abierto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setAbierto(false)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 120,
                            background: "rgba(15,23,42,0.45)",
                            display: "flex",
                            alignItems: isMobile ? "flex-end" : "center",
                            justifyContent: "center",
                            padding: isMobile ? 0 : 20,
                            boxSizing: "border-box",
                        }}
                    >
                        <motion.div
                            initial={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.96, y: 10 }
                            }
                            animate={
                                isMobile
                                    ? { y: 0 }
                                    : { opacity: 1, scale: 1, y: 0 }
                            }
                            exit={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.96, y: 10 }
                            }
                            transition={{
                                type: "spring",
                                stiffness: 340,
                                damping: 34,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: "100%",
                                maxWidth: 400,
                                maxHeight: isMobile ? "92svh" : "92vh",
                                overflowY: "auto",
                                background: "#ffffff",
                                borderRadius: isMobile ? "24px 24px 0 0" : 24,
                                padding: isMobile
                                    ? "18px 18px 26px"
                                    : "22px 22px 24px",
                                boxSizing: "border-box",
                                boxShadow: "0 24px 60px rgba(15,23,42,0.28)",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                            }}
                        >
                            {/* Encabezado */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 12,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            fontSize: 18,
                                            fontWeight: 800,
                                            color: "#0f172a",
                                        }}
                                    >
                                        Tu código QR
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            color: "#64748b",
                                            marginTop: 3,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        Tus clientes lo escanean con la cámara y
                                        reservan directo.
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAbierto(false)}
                                    aria-label="Cerrar"
                                    style={{
                                        width: 32,
                                        height: 32,
                                        flexShrink: 0,
                                        borderRadius: 10,
                                        border: "1px solid #e5e9f0",
                                        background: "#f8fafc",
                                        color: "#64748b",
                                        fontSize: 18,
                                        lineHeight: 1,
                                        cursor: "pointer",
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {!matriz ? (
                                <div
                                    style={{
                                        marginTop: 16,
                                        padding: "14px 16px",
                                        borderRadius: 12,
                                        background: "#fff7ed",
                                        border: "1px solid #fed7aa",
                                        color: "#9a3412",
                                        fontSize: 13,
                                        lineHeight: 1.5,
                                    }}
                                >
                                    No pudimos detectar el link de tu agenda en
                                    este dispositivo. Cerrá sesión, volvé a
                                    entrar y probá de nuevo.
                                </div>
                            ) : (
                                <>
                                    {/* QR */}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            marginTop: 16,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 220,
                                                height: 220,
                                                borderRadius: 18,
                                                border: "1.5px solid #eef1f6",
                                                background: "#ffffff",
                                                boxShadow:
                                                    "0 6px 20px rgba(15,23,42,0.06)",
                                                overflow: "hidden",
                                                maxWidth: "100%",
                                            }}
                                        >
                                            <svg
                                                viewBox={`0 0 ${n} ${n}`}
                                                width="100%"
                                                height="100%"
                                                shapeRendering="crispEdges"
                                                role="img"
                                                aria-label={`Código QR de ${url}`}
                                            >
                                                <rect
                                                    width={n}
                                                    height={n}
                                                    fill="#ffffff"
                                                />
                                                <path
                                                    d={QrPanel_path(
                                                        matriz as boolean[][]
                                                    )}
                                                    fill="#0f172a"
                                                />
                                            </svg>
                                        </div>
                                        {negocio && (
                                            <div
                                                style={{
                                                    marginTop: 12,
                                                    fontSize: 14,
                                                    fontWeight: 700,
                                                    color: "#0f172a",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {negocio}
                                            </div>
                                        )}
                                    </div>

                                    {/* Destino */}
                                    <div style={{ marginTop: 16 }}>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: "#64748b",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                                marginBottom: 6,
                                            }}
                                        >
                                            Al escanearlo lleva a
                                        </div>
                                        <div
                                            style={{
                                                padding: "10px 12px",
                                                borderRadius: 12,
                                                background: "#f8fafc",
                                                border: "1px solid #eef1f6",
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: accentColor,
                                                wordBreak: "break-all",
                                                lineHeight: 1.35,
                                            }}
                                        >
                                            {url.replace(/^https?:\/\//, "")}
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                marginTop: 8,
                                            }}
                                        >
                                            <button
                                                onClick={copiar}
                                                style={{ ...btnBase, flex: 1 }}
                                            >
                                                {copiado
                                                    ? "¡Link copiado!"
                                                    : "Copiar link"}
                                            </button>
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ ...btnBase, flex: 1 }}
                                            >
                                                Abrir agenda
                                            </a>
                                        </div>
                                    </div>

                                    {/* Descargas */}
                                    <div
                                        style={{
                                            marginTop: 16,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: "#64748b",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                            }}
                                        >
                                            Descargar
                                        </div>
                                        <button
                                            onClick={() =>
                                                QrPanel_guardarCanvas(
                                                    QrPanel_canvasCartel(
                                                        matriz as boolean[][],
                                                        url,
                                                        negocio,
                                                        accentColor
                                                    ),
                                                    `cartel-qr-${slug}.png`,
                                                    isMobile
                                                )
                                            }
                                            style={{
                                                ...btnBase,
                                                background: accentColor,
                                                border: `1.5px solid ${accentColor}`,
                                                color: "#ffffff",
                                            }}
                                        >
                                            Cartel para imprimir (PNG)
                                        </button>
                                        <div
                                            style={{ display: "flex", gap: 8 }}
                                        >
                                            <button
                                                onClick={() =>
                                                    QrPanel_guardarCanvas(
                                                        QrPanel_canvasQr(
                                                            matriz as boolean[][]
                                                        ),
                                                        `qr-${slug}.png`,
                                                        isMobile
                                                    )
                                                }
                                                style={{ ...btnBase, flex: 1 }}
                                            >
                                                Solo QR (PNG)
                                            </button>
                                            <button
                                                onClick={() =>
                                                    QrPanel_guardarBlob(
                                                        new Blob(
                                                            [
                                                                QrPanel_svgString(
                                                                    matriz as boolean[][]
                                                                ),
                                                            ],
                                                            {
                                                                type: "image/svg+xml",
                                                            }
                                                        ),
                                                        `qr-${slug}.svg`,
                                                        isMobile
                                                    )
                                                }
                                                style={{ ...btnBase, flex: 1 }}
                                            >
                                                Vectorial (SVG)
                                            </button>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            marginTop: 14,
                                            fontSize: 11.5,
                                            color: "#94a3b8",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        Imprimilo y pegalo en tu local, o
                                        compartilo en redes. El QR siempre lleva
                                        a tu agenda: si algún día cambia tu
                                        link, volvé a descargarlo.
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )

    return contenido
}

function TurnitsBetaInstallPrompt({
    apiBaseUrl,
    accentColor = "#1b6b1a",
    logoImage,
    logoText = "Turnits",
    slug: slugProp,
}: {
    apiBaseUrl: string
    accentColor?: string
    logoImage?: string
    logoText?: string
    slug?: string
}) {
    const [visible, setVisible] = React.useState(false)
    const [tipoPopup, setTipoPopup] = React.useState<
        "instalar" | "notificaciones"
    >("instalar")
    const [standalone, setStandalone] = React.useState(false)
    const [ios, setIos] = React.useState(false)
    const [deferredPrompt, setDeferredPrompt] =
        React.useState<TurnitsInstallPromptEvent | null>(null)
    const [instrucciones, setInstrucciones] = React.useState(false)
    const [activando, setActivando] = React.useState(false)
    const [error, setError] = React.useState("")
    const api = String(apiBaseUrl || "").replace(/\/+$/, "")

    React.useEffect(() => {
        if (
            false ||
            typeof window === "undefined"
        )
            return

        let cancelado = false
        let timer: number | undefined
        const ua = navigator.userAgent || ""
        const esIOS =
            /iPad|iPhone|iPod/i.test(ua) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        const esMobile =
            esIOS ||
            /Android|Mobile/i.test(ua) ||
            (window.matchMedia("(pointer: coarse)").matches &&
                window.innerWidth < 900)
        const previewTipo =
            new URLSearchParams(window.location.search).get(
                "betaPopupPreview"
            ) || ""
        const previewForzado = previewTipo === "1" || previewTipo === "instalar"
        const previewNotificaciones = previewTipo === "notificaciones"
        const estaStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as any).standalone === true
        setIos(esIOS)
        setStandalone(estaStandalone)
        if (!esMobile) return

        const onInstallPrompt = (event: Event) => {
            event.preventDefault()
            setDeferredPrompt(event as TurnitsInstallPromptEvent)
        }
        const onInstalled = () => setStandalone(true)
        window.addEventListener("beforeinstallprompt", onInstallPrompt)
        window.addEventListener("appinstalled", onInstalled)

        const token =
            safeLocalStorage("access_token") ||
            safeLocalStorage("user_token") ||
            safeLocalStorage("token") ||
            safeLocalStorage("auth_token") ||
            safeLocalStorage("turnits_token") ||
            ""
        let cuenta = slugProp || ""
        if (!cuenta) {
            try {
                cuenta = MenuFooter_getSlug()
            } catch {}
        }
        const evaluar = async () => {
            if (!token || !cuenta) return
            let pushActiva = false
            if (!previewForzado && !previewNotificaciones) {
                try {
                    if (
                        typeof Notification !== "undefined" &&
                        Notification.permission === "granted" &&
                        "serviceWorker" in navigator
                    ) {
                        const registration =
                            await navigator.serviceWorker.getRegistration(
                                "/sw.js"
                            )
                        const subscription = registration
                            ? await registration.pushManager.getSubscription()
                            : null
                        pushActiva = !!subscription
                    }
                } catch {}
            }
            if (
                cancelado ||
                (estaStandalone &&
                    pushActiva &&
                    !previewForzado &&
                    !previewNotificaciones)
            )
                return

            const ahora = Date.now()
            const intervalo = 2 * 24 * 60 * 60 * 1000
            const keyInstalar = `turnits_beta_popup_instalar_${cuenta}`
            const keyNotificaciones = `turnits_beta_popup_notificaciones_${cuenta}`
            const ultimaInstalacion = Number(safeLocalStorage(keyInstalar) || 0)
            const ultimaNotificacion = Number(
                safeLocalStorage(keyNotificaciones) || 0
            )
            const opciones: Array<{
                tipo: "instalar" | "notificaciones"
                ultima: number
            }> = []

            if (previewForzado) opciones.push({ tipo: "instalar", ultima: 0 })
            else if (previewNotificaciones)
                opciones.push({ tipo: "notificaciones", ultima: 0 })
            else {
                if (!estaStandalone && ahora - ultimaInstalacion >= intervalo)
                    opciones.push({
                        tipo: "instalar",
                        ultima: ultimaInstalacion,
                    })
                const pushDisponible =
                    esIOS ||
                    ("Notification" in window &&
                        "serviceWorker" in navigator &&
                        "PushManager" in window)
                if (
                    !pushActiva &&
                    pushDisponible &&
                    ahora - ultimaNotificacion >= intervalo
                )
                    opciones.push({
                        tipo: "notificaciones",
                        ultima: ultimaNotificacion,
                    })
            }

            if (!opciones.length) return
            // Si las dos invitaciones vencen juntas, primero mostramos la de
            // instalación. La otra queda pendiente para la próxima apertura.
            opciones.sort(
                (a, b) =>
                    a.ultima - b.ultima || (a.tipo === "instalar" ? -1 : 1)
            )
            const siguiente = opciones[0].tipo
            const wait = previewForzado || previewNotificaciones ? 500 : 8_000
            timer = window.setTimeout(() => {
                if (cancelado) return
                setTipoPopup(siguiente)
                if (!previewForzado && !previewNotificaciones)
                    safeLocalStorageSet(
                        siguiente === "instalar"
                            ? keyInstalar
                            : keyNotificaciones,
                        String(Date.now())
                    )
                setVisible(true)
            }, wait)
        }
        evaluar()

        return () => {
            cancelado = true
            if (timer) window.clearTimeout(timer)
            window.removeEventListener("beforeinstallprompt", onInstallPrompt)
            window.removeEventListener("appinstalled", onInstalled)
        }
    }, [slugProp])

    const cerrar = () => setVisible(false)

    const instalar = async () => {
        setError("")
        if (deferredPrompt) {
            try {
                await deferredPrompt.prompt()
                const choice = await deferredPrompt.userChoice
                setDeferredPrompt(null)
                if (choice.outcome === "accepted") setStandalone(true)
            } catch {
                setInstrucciones(true)
            }
            return
        }
        setInstrucciones(true)
    }

    const activarNotificaciones = async () => {
        setError("")
        if (ios && !standalone) {
            setInstrucciones(true)
            return
        }
        if (
            !("Notification" in window) ||
            !("serviceWorker" in navigator) ||
            !("PushManager" in window)
        ) {
            setError("Este navegador no permite activar notificaciones push.")
            return
        }
        const token =
            safeLocalStorage("access_token") ||
            safeLocalStorage("user_token") ||
            safeLocalStorage("token") ||
            safeLocalStorage("auth_token") ||
            safeLocalStorage("turnits_token") ||
            ""
        let cuenta = slugProp || ""
        if (!cuenta) {
            try {
                cuenta = MenuFooter_getSlug()
            } catch {}
        }
        if (!token || !cuenta) {
            setError("No pudimos validar tu sesión. Volvé a abrir el panel.")
            return
        }
        setActivando(true)
        try {
            const permiso = await Notification.requestPermission()
            if (permiso !== "granted") {
                setError(
                    permiso === "denied"
                        ? "Las notificaciones están bloqueadas para este sitio. Permitilas desde la configuración del navegador."
                        : "No se activaron las notificaciones."
                )
                return
            }
            const registration =
                await navigator.serviceWorker.register("/sw.js")
            await navigator.serviceWorker.ready
            let subscription = await registration.pushManager.getSubscription()
            if (!subscription) {
                const keyResponse = await fetch(`${api}/push/vapid-public-key`)
                const keyBody = await keyResponse.json()
                if (!keyResponse.ok || !keyBody.success || !keyBody.publicKey)
                    throw new Error(
                        keyBody.error || "No se pudo preparar la suscripción."
                    )
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey:
                        NotificacionesPanel_urlBase64ToUint8Array(
                            keyBody.publicKey
                        ),
                })
            }
            const response = await fetch(`${api}/push/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ slug: cuenta, subscription }),
            })
            const body = await response.json().catch(() => ({}))
            if (!response.ok || !body.success)
                throw new Error(
                    body.error || "No se pudieron guardar las notificaciones."
                )
            setVisible(false)
        } catch (e: any) {
            setError(
                e?.message ||
                    "No se pudieron activar las notificaciones. Probá de nuevo."
            )
        } finally {
            setActivando(false)
        }
    }

    if (!visible || typeof document === "undefined") return null

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={cerrar}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 10050,
                    display: "grid",
                    placeItems: "center",
                    padding: 14,
                    background: "rgba(15,23,42,.38)",
                    backdropFilter: "blur(5px)",
                    WebkitBackdropFilter: "blur(5px)",
                }}
            >
                <motion.section
                    initial={{ opacity: 0, y: 18, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="turnits-beta-title"
                    style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "min(100%, 520px)",
                        minHeight: 218,
                        padding: "22px 18px 18px 22px",
                        overflow: "hidden",
                        boxSizing: "border-box",
                        border: "1px solid rgba(255,255,255,.9)",
                        borderRadius: 24,
                        background:
                            "linear-gradient(145deg,#fff 0%,#f4f8f2 100%)",
                        boxShadow: "0 24px 70px rgba(15,23,42,.24)",
                        fontFamily:
                            "'Inter Display', -apple-system, sans-serif",
                    }}
                >
                    <button
                        type="button"
                        aria-label="Cerrar"
                        onClick={cerrar}
                        style={{
                            position: "absolute",
                            top: 9,
                            right: 10,
                            width: 30,
                            height: 30,
                            border: 0,
                            borderRadius: "50%",
                            background: "rgba(15,23,42,.06)",
                            color: "#64748b",
                            fontSize: 20,
                            lineHeight: 1,
                            cursor: "pointer",
                        }}
                    >
                        ×
                    </button>
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            alignSelf: "stretch",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            paddingRight: 2,
                        }}
                    >
                        <h2
                            id="turnits-beta-title"
                            style={{
                                maxWidth: 270,
                                margin: 0,
                                color: "#111827",
                                fontSize: 22,
                                lineHeight: 1.08,
                                letterSpacing: "-.035em",
                                fontWeight: 760,
                            }}
                        >
                            {instrucciones
                                ? ios && !standalone
                                    ? "Sumá Turnits a tu inicio"
                                    : "Instalá Turnits"
                                : tipoPopup === "notificaciones"
                                  ? "No te pierdas ningún turno"
                                  : "Más comodidad para la Beta"}
                        </h2>
                        {instrucciones && ios && !standalone ? (
                            <div
                                style={{
                                    margin: "9px 0 13px",
                                    maxWidth: 285,
                                    color: "#667085",
                                    fontSize: 11.5,
                                    lineHeight: 1.35,
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: 700,
                                        color: "#344054",
                                        marginBottom: 7,
                                    }}
                                >
                                    En Safari:
                                </div>
                                <div style={{ display: "grid", gap: 7 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <span>
                                            1. Tocá <b>⋯</b> y después
                                        </span>
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 4,
                                                color: "#344054",
                                                fontWeight: 700,
                                            }}
                                        >
                                            <svg
                                                width="15"
                                                height="15"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-label="Compartir"
                                            >
                                                <path d="M12 15V3" />
                                                <path d="m7 8 5-5 5 5" />
                                                <path d="M5 12v7h14v-7" />
                                            </svg>
                                            Compartir
                                        </span>
                                    </div>
                                    <div>
                                        2. En las opciones, tocá <b>Ver más</b>{" "}
                                        o desplazate por la lista.
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <span>3. Elegí</span>
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 4,
                                                color: "#344054",
                                                fontWeight: 700,
                                            }}
                                        >
                                            <svg
                                                width="15"
                                                height="15"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-label="Agregar a Inicio"
                                            >
                                                <path d="M3 10.5 12 3l9 7.5" />
                                                <path d="M5 9.5V21h14V9.5" />
                                                <path d="M12 13v5m-2.5-2.5h5" />
                                            </svg>
                                            Agregar a Inicio
                                        </span>
                                    </div>
                                    <div>
                                        4. Confirmá tocando <b>Agregar</b>.
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p
                                style={{
                                    margin: "9px 0 13px",
                                    maxWidth: 285,
                                    color: "#667085",
                                    fontSize: 12.5,
                                    lineHeight: 1.42,
                                }}
                            >
                                {instrucciones
                                    ? "En el menú del navegador elegí “Instalar aplicación” o “Agregar a pantalla de inicio”."
                                    : tipoPopup === "notificaciones"
                                      ? "Activá las notificaciones para enterarte enseguida cuando llegue un turno o haya novedades en tu agenda."
                                      : "Instalá Turnits en tu pantalla de inicio para tener la agenda más a mano durante la beta."}
                            </p>
                        )}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "stretch",
                                gap: 7,
                                maxWidth: 220,
                            }}
                        >
                            <button
                                type="button"
                                disabled={activando}
                                onClick={
                                    instrucciones
                                        ? cerrar
                                        : tipoPopup === "notificaciones"
                                          ? activarNotificaciones
                                          : standalone
                                            ? cerrar
                                            : instalar
                                }
                                style={{
                                    minHeight: 36,
                                    border: 0,
                                    borderRadius: 999,
                                    padding: "8px 15px",
                                    background: accentColor,
                                    color: "#fff",
                                    fontSize: 12,
                                    fontWeight: 750,
                                    cursor: activando ? "wait" : "pointer",
                                    boxShadow: "0 5px 12px rgba(27,107,26,.18)",
                                    opacity: activando ? 0.7 : 1,
                                }}
                            >
                                {instrucciones
                                    ? "Entendido"
                                    : tipoPopup === "notificaciones"
                                      ? activando
                                          ? "Activando…"
                                          : "Activar notificaciones"
                                      : standalone
                                        ? "Ya tenés Turnits instalado"
                                        : "Instalar Beta"}
                            </button>
                        </div>
                        {error && (
                            <div
                                role="status"
                                style={{
                                    marginTop: 7,
                                    color: "#b42318",
                                    fontSize: 10.5,
                                    lineHeight: 1.35,
                                }}
                            >
                                {error}
                            </div>
                        )}
                    </div>
                    {tipoPopup === "notificaciones" ? (
                        <div
                            aria-hidden="true"
                            style={{
                                flex: "0 0 126px",
                                width: 126,
                                height: 160,
                                display: "grid",
                                placeItems: "center",
                                alignSelf: "center",
                                borderRadius: 26,
                                background:
                                    "radial-gradient(circle at 50% 44%,#fff4cc 0%,#fff9e8 46%,rgba(255,255,255,0) 74%)",
                            }}
                        >
                            <svg
                                width="112"
                                height="126"
                                viewBox="0 0 112 126"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <defs>
                                    <linearGradient
                                        id="turnits-bell-gold-3d"
                                        x1="27"
                                        y1="27"
                                        x2="91"
                                        y2="88"
                                        gradientUnits="userSpaceOnUse"
                                    >
                                        <stop stopColor="#FFF0B0" />
                                        <stop offset=".2" stopColor="#F7D878" />
                                        <stop
                                            offset=".48"
                                            stopColor="#E5AE3A"
                                        />
                                        <stop
                                            offset=".76"
                                            stopColor="#B97818"
                                        />
                                        <stop offset="1" stopColor="#F0C65D" />
                                    </linearGradient>
                                    <linearGradient
                                        id="turnits-bell-rim-3d"
                                        x1="18"
                                        y1="0"
                                        x2="94"
                                        y2="0"
                                        gradientUnits="userSpaceOnUse"
                                    >
                                        <stop stopColor="#9D6113" />
                                        <stop
                                            offset=".22"
                                            stopColor="#FFE99A"
                                        />
                                        <stop
                                            offset=".55"
                                            stopColor="#C88721"
                                        />
                                        <stop offset=".8" stopColor="#F9D875" />
                                        <stop offset="1" stopColor="#8E5710" />
                                    </linearGradient>
                                    <linearGradient
                                        id="turnits-bell-clapper-3d"
                                        x1="47"
                                        y1="98"
                                        x2="68"
                                        y2="113"
                                        gradientUnits="userSpaceOnUse"
                                    >
                                        <stop stopColor="#FFE99A" />
                                        <stop
                                            offset=".48"
                                            stopColor="#D99A28"
                                        />
                                        <stop offset="1" stopColor="#9C6012" />
                                    </linearGradient>
                                    <clipPath id="turnits-bell-body-clip">
                                        <path d="M56 20c-16 0-27 12-27 30v18c0 9-4 16-12 23h78c-8-7-12-14-12-23V50c0-18-11-30-27-30Z" />
                                    </clipPath>
                                </defs>
                                <circle cx="56" cy="63" r="48" fill="#FFF3CF" />
                                <ellipse
                                    cx="56"
                                    cy="107"
                                    rx="27"
                                    ry="4.5"
                                    fill="#9B6419"
                                    fillOpacity=".16"
                                />
                                <path
                                    d="M48 22c0-7 3-11 8-11s8 4 8 11"
                                    stroke="url(#turnits-bell-rim-3d)"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M56 20c-16 0-27 12-27 30v18c0 9-4 16-12 23h78c-8-7-12-14-12-23V50c0-18-11-30-27-30Z"
                                    fill="url(#turnits-bell-gold-3d)"
                                    stroke="#996011"
                                    strokeWidth="2.5"
                                    strokeLinejoin="round"
                                />
                                <g clipPath="url(#turnits-bell-body-clip)">
                                    <path
                                        d="M31 46c3-12 9-18 19-21v63H23c7-8 10-15 10-24V46Z"
                                        fill="#FFF8D8"
                                        fillOpacity=".25"
                                    />
                                    <path
                                        d="M74 25c9 6 12 15 12 28v17c0 9 4 16 11 23H67c8-9 10-16 10-25V49c0-10-1-17-3-24Z"
                                        fill="#75430A"
                                        fillOpacity=".12"
                                    />
                                    <path
                                        d="M38 38c3-6 8-10 15-12"
                                        stroke="#FFFCEB"
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                        strokeOpacity=".9"
                                    />
                                </g>
                                <path
                                    d="M18 90.5c23 3.5 53 3.5 76 0"
                                    stroke="url(#turnits-bell-rim-3d)"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                />
                                <path
                                    d="M45 98c1 9 5 14 11 14s10-5 11-14"
                                    fill="url(#turnits-bell-clapper-3d)"
                                    stroke="#89540E"
                                    strokeWidth="2.5"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M51 102c.7 3.1 2.1 4.8 4.3 5.5"
                                    stroke="#FFF0B0"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeOpacity=".8"
                                />
                            </svg>
                        </div>
                    ) : (
                        <div
                            aria-hidden="true"
                            style={{
                                position: "relative",
                                flex: "0 0 126px",
                                width: 126,
                                height: 174,
                                alignSelf: "flex-end",
                                marginBottom: -18,
                                borderRadius: "19px 19px 0 0",
                                border: "5px solid #16251b",
                                borderBottom: 0,
                                boxSizing: "border-box",
                                padding: "18px 8px 8px",
                                background:
                                    "linear-gradient(180deg,#f3f8f2,#fff)",
                                boxShadow: "-8px 0 20px rgba(15,23,42,.13)",
                                transform: "rotate(4deg)",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: 35,
                                    height: 7,
                                    borderRadius: 8,
                                    background: "#16251b",
                                    position: "absolute",
                                    top: 5,
                                    left: "calc(50% - 17px)",
                                }}
                            />
                            {logoImage ? (
                                <img
                                    src={logoImage}
                                    alt={logoText}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        height: 17,
                                        objectFit: "contain",
                                        objectPosition: "left center",
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        color: "#1b6b1a",
                                        fontSize: 9,
                                        fontWeight: 800,
                                    }}
                                >
                                    turnits
                                </div>
                            )}
                            <div
                                style={{
                                    marginTop: 7,
                                    padding: 6,
                                    borderRadius: 7,
                                    background: "#fff",
                                    border: "1px solid #e8eee8",
                                }}
                            >
                                <div style={{ color: "#64748b", fontSize: 6 }}>
                                    Balance
                                </div>
                                <div
                                    style={{
                                        marginTop: 2,
                                        color: "#111827",
                                        fontSize: 11,
                                        fontWeight: 800,
                                    }}
                                >
                                    $96.0K
                                </div>
                            </div>
                            <div
                                style={{
                                    height: 62,
                                    marginTop: 7,
                                    padding: 5,
                                    borderRadius: 7,
                                    background: "#fff",
                                    border: "1px solid #e8eee8",
                                }}
                            >
                                <div
                                    style={{ color: "#64748b", fontSize: 5.5 }}
                                >
                                    Rendimiento
                                </div>
                                <svg
                                    viewBox="0 0 100 45"
                                    preserveAspectRatio="none"
                                    style={{
                                        width: "100%",
                                        height: 43,
                                        marginTop: 3,
                                    }}
                                >
                                    <path
                                        d="M2 39 L25 31 L48 34 L73 16 L98 7"
                                        fill="none"
                                        stroke={accentColor}
                                        strokeWidth="2.4"
                                    />
                                    <path
                                        d="M2 39 L25 31 L48 34 L73 16 L98 7 L98 45 L2 45Z"
                                        fill={accentColor}
                                        opacity=".08"
                                    />
                                </svg>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 4,
                                    marginTop: 6,
                                }}
                            >
                                <div
                                    style={{
                                        flex: 1,
                                        height: 17,
                                        borderRadius: 6,
                                        background: "#eef6ee",
                                    }}
                                />
                                <div
                                    style={{
                                        flex: 1,
                                        height: 17,
                                        borderRadius: 6,
                                        background: "#eef6ee",
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </motion.section>
            </motion.div>
        </AnimatePresence>,
        document.body
    )
}

export { TurnitsPanel_Splash, TurnitsGlobalSaveBar, QrPanel_Glifo, QrFlotante, TurnitsBetaInstallPrompt }
