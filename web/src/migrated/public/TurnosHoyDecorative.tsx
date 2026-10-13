import { useEffect, useRef, useState } from "react"


// ── Data ──────────────────────────────────────────────────────────────────────
const TURNOS = [
    { id: "1", nombre: "Gonza", hora: "14:30" },
    { id: "2", nombre: "Joaco", hora: "15:30" },
    { id: "3", nombre: "Mariano", hora: "17:15" },
    { id: "4", nombre: "Pablo", hora: "20:30" },
]
const PRECIO = 12000
const DURACION = 45

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMinutosArg() {
    const str = new Date().toLocaleString("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    })
    const [h, m] = str.split(":").map(Number)
    return h * 60 + m
}

function getFecha() {
    return new Date().toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
    })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TurnosDemo({
    accentColor = "#22c55e",
    style,
}: {
    accentColor?: string
    style?: React.CSSProperties
}) {
    const minAhora = getMinutosArg()

    const turnos = TURNOS.map((t) => {
        const [h, m] = t.hora.split(":").map(Number)
        const minInicio = h * 60 + m
        return { ...t, yaPaso: minInicio + DURACION <= minAhora }
    })
    const idxProximoInicial = turnos.findIndex((t) => !t.yaPaso)

    const [count, setCount] = useState(0)
    const [proximo, setProximo] = useState(
        idxProximoInicial >= 0 ? idxProximoInicial : 0
    )
    const [pulse, setPulse] = useState(false)

    // Counter animation on mount
    useEffect(() => {
        const target = TURNOS.length
        const duration = 700
        const start = performance.now()
        function step(now: number) {
            const p = Math.min((now - start) / duration, 1)
            const ease = 1 - Math.pow(1 - p, 3)
            setCount(Math.round(ease * target))
            if (p < 1) requestAnimationFrame(step)
        }
        const delay = setTimeout(() => requestAnimationFrame(step), 350)
        return () => clearTimeout(delay)
    }, [])

    // Cycle "próximo" every 3s
    useEffect(() => {
        const pendientes = turnos
            .map((t, i) => (!t.yaPaso ? i : -1))
            .filter((i) => i >= 0)
        if (pendientes.length < 2) return
        const interval = setInterval(() => {
            setProximo((prev) => {
                const current = pendientes.indexOf(prev)
                return pendientes[(current + 1) % pendientes.length]
            })
            setPulse(true)
            setTimeout(() => setPulse(false), 400)
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    const completados = turnos.filter((t) => t.yaPaso).length
    const pendientes = turnos.filter((t) => !t.yaPaso).length
    const ingreso = TURNOS.length * PRECIO

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
            <style>{`
                500;600;700&display=swap');
                @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
                @keyframes dotPulse  { 0%,100%{box-shadow:0 0 0 3px ${accentColor}20} 50%{box-shadow:0 0 0 7px ${accentColor}10} }
                @keyframes rowIn     { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
                @keyframes cardIn    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
                @keyframes fadeUp    { from{opacity:0} to{opacity:1} }
                .trow { animation: rowIn 0.4s cubic-bezier(.22,1,.36,1) both; }
                .trow:nth-child(1) { animation-delay: 0.65s }
                .trow:nth-child(2) { animation-delay: 0.73s }
                .trow:nth-child(3) { animation-delay: 0.81s }
                .trow:nth-child(4) { animation-delay: 0.89s }
            `}</style>

            {/* Card */}
            <div
                style={{
                    width: "100%",
                    maxWidth: 360,
                    background: "#fff",
                    borderRadius: 20,
                    padding: 22,
                    boxShadow:
                        "0 1px 3px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.07)",
                    display: "flex",
                    flexDirection: "column",
                    animation:
                        "cardIn 0.5s cubic-bezier(.22,1,.36,1) 0.1s both",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 14,
                    }}
                >
                    <span
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#0f172a",
                            letterSpacing: "-0.3px",
                        }}
                    >
                        Turnos de Hoy
                    </span>
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "#0f172a",
                        }}
                    >
                        {getFecha()}
                    </span>
                </div>

                {/* Big number */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <span
                        style={{
                            fontSize: 52,
                            fontWeight: 700,
                            color: accentColor,
                            lineHeight: 1,
                            letterSpacing: "-2px",
                            animation: "fadeUp 0.5s ease 0.35s both",
                        }}
                    >
                        {count}
                    </span>
                    <div
                        style={{
                            paddingBottom: 6,
                            animation: "fadeUp 0.4s ease 0.5s both",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                color: "#94a3b8",
                                fontWeight: 500,
                            }}
                        >
                            turnos
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: "#cbd5e1",
                                marginTop: 2,
                            }}
                        >
                            {completados} completados · {pendientes} pendientes
                        </div>
                    </div>
                </div>

                {/* Ingresos */}
                <div
                    style={{
                        background: "#f8fafc",
                        borderRadius: 12,
                        padding: "10px 14px",
                        marginBottom: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        animation: "fadeUp 0.4s ease 0.5s both",
                    }}
                >
                    <span
                        style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            fontWeight: 500,
                        }}
                    >
                        Ingresos estimados
                    </span>
                    <span
                        style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#1e293b",
                        }}
                    >
                        ${ingreso.toLocaleString("es-AR")}
                    </span>
                </div>

                {/* Divider */}
                <div
                    style={{
                        height: 1,
                        background: "#f1f5f9",
                        marginBottom: 14,
                    }}
                />

                {/* Section title */}
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 10,
                        animation: "fadeUp 0.4s ease 0.55s both",
                    }}
                >
                    Clientes de Hoy
                </div>

                {/* Rows */}
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 5 }}
                >
                    {turnos.map((t, i) => {
                        const isNext = i === proximo && !t.yaPaso
                        const cls = t.yaPaso ? "done" : isNext ? "next" : ""
                        return (
                            <div
                                key={t.id}
                                className="trow"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "9px 12px",
                                    borderRadius: 12,
                                    background: t.yaPaso
                                        ? "transparent"
                                        : isNext
                                          ? "#f0fdf4"
                                          : "#fafafa",
                                    border: `1px solid ${isNext ? accentColor + "25" : "transparent"}`,
                                    transition:
                                        "background 0.35s, border-color 0.35s",
                                }}
                            >
                                {/* Dot */}
                                <div
                                    style={{
                                        width: 7,
                                        height: 7,
                                        borderRadius: "50%",
                                        flexShrink: 0,
                                        background: t.yaPaso
                                            ? "#e2e8f0"
                                            : isNext
                                              ? accentColor
                                              : "#cbd5e1",
                                        transition: "background 0.35s",
                                        animation: isNext
                                            ? "dotPulse 2s ease-in-out infinite"
                                            : "none",
                                    }}
                                />

                                {/* Name */}
                                <span
                                    style={{
                                        flex: 1,
                                        fontSize: 13,
                                        fontWeight: t.yaPaso
                                            ? 400
                                            : isNext
                                              ? 700
                                              : 500,
                                        color: t.yaPaso
                                            ? "#cbd5e1"
                                            : isNext
                                              ? accentColor
                                              : "#334155",
                                        letterSpacing: isNext
                                            ? "-0.2px"
                                            : "normal",
                                        transition: "color 0.35s",
                                    }}
                                >
                                    {t.nombre}
                                </span>

                                {/* Badge */}
                                {isNext && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                            color: accentColor,
                                            background: "#f8fafc",
                                            padding: "2px 6px",
                                            borderRadius: 6,
                                            border: `1px solid ${accentColor}30`,
                                        }}
                                    >
                                        próximo
                                    </span>
                                )}

                                {/* Time */}
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontWeight: isNext ? 600 : 400,
                                        color: t.yaPaso
                                            ? "#e2e8f0"
                                            : isNext
                                              ? accentColor
                                              : "#94a3b8",
                                        fontVariantNumeric: "tabular-nums",
                                        letterSpacing: "0.02em",
                                        transition: "color 0.35s",
                                    }}
                                >
                                    {t.hora}
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px solid #f1f5f9",
                        animation: "fadeUp 0.4s ease 1.1s both",
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            color: "#cbd5e1",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                        }}
                    >
                        Actualizado ahora
                    </span>
                    <button
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: 12,
                            fontWeight: 700,
                            color: accentColor,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            letterSpacing: "0.02em",
                        }}
                    ></button>
                </div>
            </div>
        </div>
    )
}


