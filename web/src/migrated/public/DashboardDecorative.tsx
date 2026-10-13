import * as React from "react"

import { motion, AnimatePresence } from "framer-motion"

const BRAND_GREEN = "#22c55e"
const PALETTE = [{ line: "#22c55e" }, { line: "#6366f1" }, { line: "#f59e0b" }]

const SERVICIOS = [
    { nombre: "Servicio 1", semanas: [8, 10, 9, 11], total: 38, ...PALETTE[0] },
    { nombre: "Servicio 2", semanas: [4, 6, 5, 7], total: 22, ...PALETTE[1] },
    { nombre: "Servicio 3", semanas: [3, 4, 6, 5], total: 18, ...PALETTE[2] },
]

const ULTIMOS7 = [
    { diaSem: "Lu", diaNum: 26, min: 80 },
    { diaSem: "Ma", diaNum: 27, min: 120 },
    { diaSem: "Mi", diaNum: 28, min: 40 },
    { diaSem: "Ju", diaNum: 29, min: 160 },
    { diaSem: "Vi", diaNum: 30, min: 120 },
    { diaSem: "Sá", diaNum: 31, min: 80 },
    { diaSem: "Do", diaNum: 1, min: 200 },
]
const MAX_MIN = 200

function useIsMobile() {
    const [mobile, setMobile] = React.useState(false)
    React.useEffect(() => {
        const mq = window.matchMedia("(max-width: 600px)")
        setMobile(mq.matches)
        const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [])
    return mobile
}

export default function DashboardLoop(props: any) {
    const [focused, setFocused] = React.useState<0 | 1>(0)
    const isMobile = useIsMobile()

    React.useEffect(() => {
        const t = setInterval(() => setFocused((f) => (f === 0 ? 1 : 0)), 3200)
        return () => clearInterval(t)
    }, [])

    const scaleA = focused === 0 ? 1 : 0.93
    const scaleB = focused === 1 ? 1 : 0.93
    const opacA = focused === 0 ? 1 : 0.45
    const opacB = focused === 1 ? 1 : 0.45
    const zA = focused === 0 ? 2 : 1
    const zB = focused === 1 ? 2 : 1

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "center",
                gap: 20,
                fontFamily: "'DM Sans', -apple-system, sans-serif",
                padding: "16px",
                boxSizing: "border-box",
                overflowY: isMobile ? "auto" : "hidden",
            }}
        >
            <motion.div
                animate={{
                    scale: isMobile ? 1 : scaleA,
                    opacity: isMobile ? 1 : opacA,
                }}
                transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    flex: 1,
                    minWidth: 0,
                    zIndex: zA,
                    position: "relative",
                }}
            >
                <HorasCard focused={focused === 0} />
            </motion.div>

            <motion.div
                animate={{
                    scale: isMobile ? 1 : scaleB,
                    opacity: isMobile ? 1 : opacB,
                }}
                transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    flex: 1,
                    minWidth: 0,
                    zIndex: zB,
                    position: "relative",
                }}
            >
                <TopServiciosCard focused={focused === 1} />
            </motion.div>
        </div>
    )
}

// ── HorasCard ─────────────────────────────────────────────────────────────────
function HorasCard({ focused }: { focused: boolean }) {
    const accentColor = BRAND_GREEN
    const [displayMin, setDisplayMin] = React.useState(0)
    const TARGET = 880

    React.useEffect(() => {
        if (!focused) {
            setDisplayMin(0)
            return
        }
        let start = 0
        const step = Math.ceil(TARGET / 28)
        const t = setInterval(() => {
            start += step
            if (start >= TARGET) {
                setDisplayMin(TARGET)
                clearInterval(t)
            } else setDisplayMin(start)
        }, 32)
        return () => clearInterval(t)
    }, [focused])

    const horas = Math.floor(displayMin / 60)
    const mins = displayMin % 60
    const label = mins > 0 ? `${horas}h ${mins}m` : `${horas}h`

    return (
        <div style={cardBase}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 4,
                }}
            >
                <span style={titleStyle}>Horas trabajadas</span>
                <span
                    style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8" }}
                >
                    1 jun
                </span>
            </div>

            <div style={{ margin: "6px 0 3px" }}>
                <div
                    style={{
                        fontSize: 38,
                        fontWeight: 700,
                        color: accentColor,
                        lineHeight: 1,
                        letterSpacing: "-2px",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {label || "0h"}
                </div>
                <div
                    style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        marginTop: 3,
                        fontWeight: 500,
                    }}
                >
                    22 turnos × 40 min
                </div>
            </div>

            <div style={{ display: "flex", gap: 6, margin: "10px 0 12px" }}>
                <Chip
                    label="Hoy"
                    valor="2h 40m"
                    sub="4 turnos"
                    accent={accentColor}
                    highlight
                />
                <Chip label="Promedio/día" valor="2h 56m" sub="15 días" />
            </div>

            <div
                style={{ height: 1, background: "#f1f5f9", marginBottom: 10 }}
            />
            <span style={sectionTitle}>Últimos 7 días</span>

            <div style={{ display: "flex", gap: 3, flex: 1, marginTop: 8 }}>
                {ULTIMOS7.map((d, i) => {
                    const esHoy = i === 6
                    const ratio = d.min / MAX_MIN
                    const t = {
                        horas: Math.floor(d.min / 60),
                        minutos: d.min % 60,
                    }
                    const delay = focused ? i * 0.06 : 0
                    return (
                        <motion.div
                            key={i}
                            initial={false}
                            animate={{ opacity: focused ? 1 : 0.4 }}
                            transition={{ delay, duration: 0.3 }}
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 3,
                                padding: "7px 1px 6px",
                                borderRadius: 10,
                                background: esHoy
                                    ? `${accentColor}10`
                                    : "#f8fafc",
                                border: esHoy
                                    ? `1px solid ${accentColor}25`
                                    : "1px solid transparent",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 8,
                                    fontWeight: 600,
                                    color: esHoy ? accentColor : "#94a3b8",
                                    textTransform: "uppercase" as const,
                                }}
                            >
                                {d.diaSem}
                            </span>
                            {d.min === 0 ? (
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#e2e8f0",
                                        lineHeight: 1,
                                    }}
                                >
                                    —
                                </span>
                            ) : (
                                <div
                                    style={{
                                        textAlign: "center",
                                        lineHeight: 1,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 9 + Math.round(ratio * 4),
                                            fontWeight: 700,
                                            color:
                                                esHoy || ratio >= 0.7
                                                    ? accentColor
                                                    : `rgba(34,197,94,${0.4 + ratio * 0.6})`,
                                        }}
                                    >
                                        {t.horas}h
                                    </div>
                                    {t.minutos > 0 && (
                                        <div
                                            style={{
                                                fontSize: 8,
                                                fontWeight: 600,
                                                color: esHoy
                                                    ? accentColor
                                                    : `rgba(34,197,94,${0.3 + ratio * 0.5})`,
                                                marginTop: 1,
                                            }}
                                        >
                                            {t.minutos}m
                                        </div>
                                    )}
                                </div>
                            )}
                            <span
                                style={{
                                    fontSize: 8,
                                    color: esHoy ? accentColor : "#cbd5e1",
                                    fontWeight: esHoy ? 700 : 400,
                                }}
                            >
                                {d.diaNum}
                            </span>
                        </motion.div>
                    )
                })}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-start",
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid #f1f5f9",
                }}
            >
                <span style={{ fontSize: 10, color: "#cbd5e1" }}>
                    Actualizado ahora
                </span>
            </div>
        </div>
    )
}

// ── TopServiciosCard ──────────────────────────────────────────────────────────
function TopServiciosCard({ focused }: { focused: boolean }) {
    const totalMes = SERVICIOS.reduce((a, s) => a + s.total, 0)
    const W = 400,
        H = 160
    const PL = 24,
        PR = 10,
        PT = 14,
        PB = 22
    const cW = W - PL - PR,
        cH = H - PT - PB
    const maxVal = Math.max(...SERVICIOS.flatMap((s) => s.semanas), 1)
    const toY = (v: number) => PT + cH - (v / maxVal) * cH
    const toX = (i: number) => PL + (i / 3) * cW

    const buildPath = (semanas: number[]) => {
        const pts = semanas.map((v, i) => ({ x: toX(i), y: toY(v) }))
        let d = `M ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i - 1],
                c = pts[i],
                cx = (p.x + c.x) / 2
            d += ` C ${cx} ${p.y}, ${cx} ${c.y}, ${c.x} ${c.y}`
        }
        return d
    }

    const LABELS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"]

    return (
        <div style={cardBase}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 20,
                    flexShrink: 0,
                }}
            >
                <div>
                    <div style={titleStyle}>Top Servicios</div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            marginTop: 3,
                            fontWeight: 500,
                        }}
                    >
                        Evolución semanal · mes actual
                    </div>
                </div>
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#64748b",
                        background: "#f8fafc",
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: "1px solid #f1f5f9",
                    }}
                >
                    1 jun
                </span>
            </div>

            <div
                style={{
                    width: "100%",
                    flexShrink: 0,
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                }}
            >
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    width="100%"
                    style={{ display: "block" }}
                >
                    <defs>
                        {SERVICIOS.map((s, i) => (
                            <linearGradient
                                key={i}
                                id={`dlg-${i}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor={s.line}
                                    stopOpacity="0.22"
                                />
                                <stop
                                    offset="100%"
                                    stopColor={s.line}
                                    stopOpacity="0"
                                />
                            </linearGradient>
                        ))}
                    </defs>
                    {[0, 0.5, 1].map((pct, i) => (
                        <line
                            key={i}
                            x1={PL}
                            y1={PT + cH * (1 - pct)}
                            x2={W - PR}
                            y2={PT + cH * (1 - pct)}
                            stroke={i === 0 ? "#e2e8f0" : "#eef0f4"}
                            strokeWidth={0.75}
                            strokeDasharray={i > 0 ? "3 4" : "0"}
                        />
                    ))}
                    {SERVICIOS.map((s, i) => {
                        const pts = s.semanas.map((v, j) => ({
                            x: toX(j),
                            y: toY(v),
                        }))
                        let area = `M ${pts[0].x} ${PT + cH} L ${pts[0].x} ${pts[0].y}`
                        for (let j = 1; j < pts.length; j++) {
                            const p = pts[j - 1],
                                c = pts[j],
                                cx = (p.x + c.x) / 2
                            area += ` C ${cx} ${p.y}, ${cx} ${c.y}, ${c.x} ${c.y}`
                        }
                        area += ` L ${pts[pts.length - 1].x} ${PT + cH} Z`
                        return <path key={i} d={area} fill={`url(#dlg-${i})`} />
                    })}
                    {SERVICIOS.map((s, i) => (
                        <motion.path
                            key={i}
                            d={buildPath(s.semanas)}
                            fill="none"
                            stroke={s.line}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{
                                pathLength: focused ? 1 : 0.1,
                                opacity: focused ? 1 : 0.3,
                            }}
                            transition={{
                                pathLength: {
                                    delay: i * 0.12,
                                    duration: 0.9,
                                    ease: "easeOut",
                                },
                                opacity: { duration: 0.3 },
                            }}
                        />
                    ))}
                    {SERVICIOS.map((s, i) =>
                        s.semanas.map((v, j) => (
                            <motion.circle
                                key={`${i}-${j}`}
                                cx={toX(j)}
                                cy={toY(v)}
                                r={2.5}
                                fill="#fff"
                                stroke={s.line}
                                strokeWidth={1.5}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{
                                    scale: focused ? 1 : 0,
                                    opacity: focused ? 1 : 0,
                                }}
                                transition={{
                                    delay: focused
                                        ? i * 0.12 + j * 0.06 + 0.5
                                        : 0,
                                    duration: 0.2,
                                }}
                            />
                        ))
                    )}
                    {LABELS.map((lbl, j) => (
                        <text
                            key={j}
                            x={toX(j)}
                            y={H - 7}
                            textAnchor="middle"
                            fontSize={8}
                            fill="#c9d0db"
                            fontFamily="'DM Sans', sans-serif"
                            fontWeight="500"
                        >
                            {lbl}
                        </text>
                    ))}
                </svg>
            </div>

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 10,
                    paddingTop: 14,
                    paddingBottom: 2,
                }}
            >
                {SERVICIOS.map((s, i) => {
                    const pct =
                        totalMes > 0
                            ? Math.round((s.total / totalMes) * 100)
                            : 0
                    return (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 5,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <div
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: s.line,
                                        flexShrink: 0,
                                    }}
                                />
                                <span
                                    style={{
                                        flex: 1,
                                        fontSize: 12,
                                        fontWeight: 500,
                                        color: "#475569",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap" as const,
                                    }}
                                >
                                    {s.nombre}
                                </span>
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: "#0f172a",
                                        fontVariantNumeric: "tabular-nums",
                                        marginRight: 4,
                                    }}
                                >
                                    {s.total}
                                </span>
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: "#94a3b8",
                                        minWidth: 28,
                                        textAlign: "right" as const,
                                    }}
                                >
                                    {pct}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: 3,
                                    borderRadius: 3,
                                    background: "#f1f5f9",
                                    overflow: "hidden",
                                    marginLeft: 16,
                                }}
                            >
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{
                                        width: focused ? `${pct}%` : "0%",
                                    }}
                                    transition={{
                                        delay: focused ? i * 0.08 + 0.3 : 0,
                                        duration: 0.6,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        height: "100%",
                                        borderRadius: 3,
                                        background: s.line,
                                        opacity: 0.7,
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #f1f5f9",
                    flexShrink: 0,
                }}
            >
                <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                    Actualizado ahora
                </span>
                <span
                    style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {totalMes} reservas en el mes
                </span>
            </div>
        </div>
    )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Chip({ label, valor, sub, accent, highlight }: any) {
    return (
        <div
            style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 8,
                background: highlight ? `${accent}08` : "#f8fafc",
            }}
        >
            <div
                style={{
                    fontSize: 9,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: 1,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: highlight ? accent : "#1e293b",
                }}
            >
                {valor}
            </div>
            {sub && (
                <div style={{ fontSize: 8, color: "#cbd5e1", marginTop: 1 }}>
                    {sub}
                </div>
            )}
        </div>
    )
}

const cardBase: React.CSSProperties = {
    width: "100%",
    padding: "16px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    border: "1px solid #f1f5f9",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
}

const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
}

const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
}


