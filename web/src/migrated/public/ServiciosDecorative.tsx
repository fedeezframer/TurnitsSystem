import { useEffect, useRef, useState } from "react"


interface Servicio {
    id: string
    nombre: string
    precio: number
    duracion: number
    activo: boolean
}

const T_PAUSE = 1200
const T_FORM_OPEN = 600
const T_TYPING = 1400
const T_SAVING = 900
const T_ROW_SETTLE = 1600
const T_TOGGLE = 500
const T_DELETE = 500

type Phase =
    | "idle"
    | "form-open"
    | "saving"
    | "created"
    | "toggling"
    | "deleting"

export default function ServiciosDemo(props: any) {
    const {
        accentColor = "#22c55e",
        servicio1 = "Corte Clásico",
        servicio2 = "Corte + Barba",
        servicio3 = "Coloración",
        servicio4 = "Keratina",
        servicio5 = "Rayitos",
        servicioIcono,
        style,
    } = props

    const [servicios, setServicios] = useState<Servicio[]>([])
    const [phase, setPhase] = useState<Phase>("idle")
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [newVisible, setNewVisible] = useState(false)
    const alive = useRef(true)

    useEffect(() => {
        alive.current = true

        const base: Servicio[] = [
            {
                id: "1",
                nombre: servicio1,
                precio: 9500,
                duracion: 30,
                activo: true,
            },
            {
                id: "2",
                nombre: servicio2,
                precio: 14000,
                duracion: 45,
                activo: true,
            },
            {
                id: "3",
                nombre: servicio3,
                precio: 16000,
                duracion: 90,
                activo: true,
            },
            {
                id: "4",
                nombre: servicio4,
                precio: 21000,
                duracion: 120,
                activo: false,
            },
        ]
        const newSvc: Servicio = {
            id: "5",
            nombre: servicio5,
            precio: 25000,
            duracion: 60,
            activo: true,
        }

        setServicios([...base])

        const go = (fn: () => void, ms: number) =>
            setTimeout(() => {
                if (alive.current) fn()
            }, ms)

        function runLoop() {
            go(() => {
                setServicios([...base])
                setNewVisible(false)
                setPhase("form-open")
            }, T_PAUSE)

            go(() => setPhase("saving"), T_PAUSE + T_FORM_OPEN + T_TYPING)

            go(
                () => {
                    setPhase("created")
                    setServicios((p) => [...p, newSvc])
                    setNewVisible(true)
                },
                T_PAUSE + T_FORM_OPEN + T_TYPING + T_SAVING
            )

            go(
                () => {
                    setPhase("toggling")
                    setTogglingId("4")
                    setTimeout(() => {
                        if (!alive.current) return
                        setServicios((p) =>
                            p.map((s) =>
                                s.id === "4" ? { ...s, activo: true } : s
                            )
                        )
                        setTogglingId(null)
                        setPhase("idle")
                    }, T_TOGGLE)
                },
                T_PAUSE + T_FORM_OPEN + T_TYPING + T_SAVING + T_ROW_SETTLE
            )

            go(
                () => {
                    setPhase("deleting")
                    setDeletingId("3")
                    setTimeout(() => {
                        if (!alive.current) return
                        setServicios((p) => p.filter((s) => s.id !== "3"))
                        setDeletingId(null)
                        setPhase("idle")
                    }, T_DELETE)
                },
                T_PAUSE +
                    T_FORM_OPEN +
                    T_TYPING +
                    T_SAVING +
                    T_ROW_SETTLE +
                    T_PAUSE +
                    T_TOGGLE +
                    T_PAUSE
            )

            const totalTime =
                T_PAUSE +
                T_FORM_OPEN +
                T_TYPING +
                T_SAVING +
                T_ROW_SETTLE +
                T_PAUSE +
                T_TOGGLE +
                T_PAUSE +
                T_DELETE +
                T_PAUSE +
                800

            go(() => {
                setPhase("idle")
                setNewVisible(false)
                setTogglingId(null)
                setDeletingId(null)
                setServicios([...base])
                setTimeout(runLoop, 600)
            }, totalTime)
        }

        const kick = setTimeout(runLoop, 400)
        return () => {
            alive.current = false
            clearTimeout(kick)
        }
    }, [servicio1, servicio2, servicio3, servicio4, servicio5])

    const activos = servicios.filter((s) => s.activo).length
    const inactivos = servicios.filter((s) => !s.activo).length
    const showForm = phase === "form-open" || phase === "saving"

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'DM Sans', -apple-system, sans-serif",
                ...style,
            }}
        >
            <style>{getCSS()}</style>

            <div
                style={{
                    width: "100%",
                    maxWidth: 380,
                    background: "#fff",
                    borderRadius: 20,
                    padding: 22,
                    boxShadow:
                        "0 1px 3px rgba(0,0,0,.06), 0 4px 24px rgba(0,0,0,.07)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 16,
                    }}
                >
                    <div>
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#1e293b",
                                letterSpacing: "-0.3px",
                            }}
                        >
                            Servicios
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "#94a3b8",
                                marginTop: 2,
                            }}
                        >
                            {activos} activo{activos !== 1 ? "s" : ""}
                            {inactivos > 0
                                ? `, ${inactivos} inactivo${inactivos !== 1 ? "s" : ""}`
                                : ""}
                        </div>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            borderRadius: 10,
                            background: accentColor,
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            opacity: showForm ? 0.6 : 1,
                            transition: "opacity 0.3s",
                        }}
                    >
                        {phase === "saving" ? (
                            <Spinner color="#fff" size={13} />
                        ) : (
                            <span style={{ fontSize: 16, lineHeight: 1 }}>
                                +
                            </span>
                        )}
                        {phase === "saving" ? "Guardando…" : "Nuevo"}
                    </div>
                </div>

                {/* Form */}
                <div
                    style={{
                        overflow: "hidden",
                        maxHeight: showForm ? 220 : 0,
                        opacity: showForm ? 1 : 0,
                        transition:
                            "max-height 0.45s cubic-bezier(.22,1,.36,1), opacity 0.3s ease",
                        marginBottom: showForm ? 12 : 0,
                    }}
                >
                    <div
                        style={{
                            background: "#f8fafc",
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            padding: 14,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "#1e293b",
                                }}
                            >
                                Nuevo servicio
                            </span>
                            <span
                                style={{
                                    color: "#94a3b8",
                                    fontSize: 20,
                                    lineHeight: 1,
                                }}
                            >
                                ×
                            </span>
                        </div>
                        <FakeInput
                            label="Nombre del servicio"
                            value={servicio5}
                            accentColor={accentColor}
                            typing={phase === "form-open"}
                            full
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                            <FakeInput
                                label="Precio"
                                value="$11.000"
                                accentColor={accentColor}
                                typing={phase === "form-open"}
                            />
                            <FakeInput
                                label="Duración"
                                value="60 min"
                                accentColor={accentColor}
                                typing={phase === "form-open"}
                            />
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                justifyContent: "flex-end",
                                paddingTop: 2,
                            }}
                        >
                            <div
                                style={{
                                    padding: "7px 14px",
                                    borderRadius: 9,
                                    border: "1px solid #e2e8f0",
                                    fontSize: 12,
                                    color: "#64748b",
                                }}
                            >
                                Cancelar
                            </div>
                            <div
                                style={{
                                    padding: "7px 14px",
                                    borderRadius: 9,
                                    background:
                                        phase === "saving"
                                            ? accentColor
                                            : "#e2e8f0",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color:
                                        phase === "saving" ? "#fff" : "#94a3b8",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    transition: "background 0.3s, color 0.3s",
                                }}
                            >
                                {phase === "saving" && (
                                    <Spinner color="#fff" size={11} />
                                )}
                                {phase === "saving"
                                    ? "Guardando…"
                                    : "Crear servicio"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Rows */}
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 5 }}
                >
                    {servicios.map((svc, i) => (
                        <ServiceRow
                            key={svc.id}
                            svc={svc}
                            accentColor={accentColor}
                            isDeleting={deletingId === svc.id}
                            isToggling={togglingId === svc.id}
                            isNew={svc.id === "5" && newVisible}
                            delay={i * 0.04}
                            iconoUrl={servicioIcono}
                        />
                    ))}
                </div>

                {/* Footer */}
                <div
                    style={{
                        marginTop: 16,
                        paddingTop: 12,
                        borderTop: "1px solid #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                        Actualizado ahora
                    </span>
                </div>
            </div>
        </div>
    )
}

function ServiceRow({
    svc,
    accentColor,
    isDeleting,
    isToggling,
    isNew,
    delay,
    iconoUrl,
}: {
    svc: Servicio
    accentColor: string
    isDeleting: boolean
    isToggling: boolean
    isNew: boolean
    delay: number
    iconoUrl?: string
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 12,
                background: isNew
                    ? accentColor + "0e"
                    : svc.activo
                      ? "#fff"
                      : "#f8fafc",
                border: `1px solid ${isNew ? accentColor + "35" : "#f1f5f9"}`,
                opacity: isDeleting ? 0 : svc.activo ? 1 : 0.5,
                transform: isDeleting
                    ? "scale(0.97) translateY(4px)"
                    : "scale(1) translateY(0)",
                transition:
                    "opacity 0.45s ease, transform 0.45s ease, background 0.35s, border-color 0.35s",
                animation: isNew
                    ? "rowIn 0.4s cubic-bezier(.22,1,.36,1) both"
                    : undefined,
            }}
        >
            {/* Thumb */}
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: svc.activo ? accentColor + "14" : "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    transition: "background 0.3s",
                }}
            >
                {iconoUrl && (
                    <img
                        src={iconoUrl}
                        alt=""
                        style={{
                            width: "60%",
                            height: "60%",
                            objectFit: "contain",
                            filter: svc.activo
                                ? "opacity(0.85)"
                                : "opacity(0.3) grayscale(1)",
                            transition: "filter 0.3s",
                        }}
                    />
                )}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {svc.nombre}
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 3,
                        alignItems: "center",
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: accentColor,
                        }}
                    >
                        ${svc.precio.toLocaleString("es-AR")}
                    </span>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>·</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {svc.duracion < 60
                            ? `${svc.duracion} min`
                            : `${svc.duracion / 60}h`}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <div
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: svc.activo ? accentColor + "15" : "#f1f5f9",
                        border: `1px solid ${svc.activo ? accentColor + "40" : "#e2e8f0"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: svc.activo ? accentColor : "#94a3b8",
                        fontWeight: 700,
                        transition: "all 0.3s",
                    }}
                >
                    {isToggling ? (
                        <Spinner color={accentColor} size={10} />
                    ) : svc.activo ? (
                        "✓"
                    ) : (
                        "○"
                    )}
                </div>
                <div
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        color: "#64748b",
                    }}
                >
                    ✎
                </div>
                <div
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "#fff5f5",
                        border: "1px solid #fee2e2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        color: "#ef4444",
                    }}
                >
                    {isDeleting ? <Spinner color="#ef4444" size={10} /> : "×"}
                </div>
            </div>
        </div>
    )
}

function FakeInput({
    label,
    value,
    accentColor,
    typing,
    full,
}: {
    label: string
    value: string
    accentColor: string
    typing: boolean
    full?: boolean
}) {
    const [displayed, setDisplayed] = useState("")
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (typing) {
            setDisplayed("")
            let i = 0
            timerRef.current = setInterval(() => {
                i++
                setDisplayed(value.slice(0, i))
                if (i >= value.length && timerRef.current)
                    clearInterval(timerRef.current)
            }, T_TYPING / value.length)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
            setDisplayed("")
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [typing, value])

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: full ? undefined : 1,
                width: full ? "100%" : undefined,
            }}
        >
            <label
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </label>
            <div
                style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: `1.5px solid ${typing ? accentColor : "#e2e8f0"}`,
                    fontSize: 13,
                    color: "#1e293b",
                    background: "#fff",
                    minHeight: 34,
                    display: "flex",
                    alignItems: "center",
                    transition: "border-color 0.2s",
                }}
            >
                <span>{displayed}</span>
                {typing && (
                    <span
                        style={{
                            display: "inline-block",
                            width: 1.5,
                            height: 14,
                            background: accentColor,
                            marginLeft: 2,
                            animation: "blink 0.8s step-end infinite",
                        }}
                    />
                )}
            </div>
        </div>
    )
}

function Spinner({ color, size }: { color: string; size: number }) {
    return (
        <div
            style={{
                width: size,
                height: size,
                border: `2px solid ${color}44`,
                borderTop: `2px solid ${color}`,
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                flexShrink: 0,
            }}
        />
    )
}

function getCSS() {
    return `
        500;600;700&display=swap');
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes rowIn { from{opacity:0;transform:translateY(-6px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
    `
}


