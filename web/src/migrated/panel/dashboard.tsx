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
import { Turnits_useElementWidth, TurnitsDashboard_shortMoney, TurnitsDashboard_dateLabel, TurnitsDashboard_money, TurnitsDashboard_COLOR_SUBE, TurnitsDashboard_COLOR_BAJA, TurnitsDashboard_COLOR_IGUAL, TurnitsDashboard_rangoLabel, TurnitsDashboard_variacion, TurnitsDashboard_getSlug, TurnitsDashboard_getToken, QrPanel_slug, TurnitsDashboard_percent } from "./common"
import { PlanEstado, RendimientoEquipo } from "./inicio"
import { MercadoPagoConexion_LinkIcon } from "./pagos"

function TurnitsDashboard_MetricCard({ label, value, trend, cardStyle }: any) {
    const trendColor =
        trend?.tono === "sube"
            ? "#1B6B1A"
            : trend?.tono === "baja"
              ? "#dc2626"
              : "#64748b"
    return (
        <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.16 }}
            style={{
                background: "#fff",
                border: "1px solid #e8edf2",
                borderRadius: 16,
                padding: "18px 18px 16px",
                minWidth: 0,
                boxShadow: "0 1px 2px rgba(15,23,42,.02)",
                position: "relative",
                overflow: "hidden",
                ...cardStyle,
            }}
        >
            <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
                {label}
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: 10,
                    marginTop: 8,
                    flexWrap: "wrap",
                }}
            >
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 30,
                                lineHeight: 1.05,
                                fontWeight: 760,
                                letterSpacing: "-1.2px",
                                color: "#111827",
                                fontVariantNumeric: "tabular-nums",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {value}
                        </div>
                        {trend && (
                            <span
                                style={{
                                    color: trendColor,
                                    fontSize: 11.5,
                                    fontWeight: 750,
                                    padding: "3px 7px",
                                    borderRadius: 6,
                                    background: `${trendColor}20`,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {trend.texto}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function TurnitsDashboard_Sparkline({ values, accentColor }: any) {
    const nums = values.map((v: any) => Number(v || 0))
    const max = Math.max(...nums, 1)
    const min = Math.min(...nums, 0)
    const range = Math.max(max - min, 1)
    const points = nums
        .map((v: number, i: number) => {
            const x = (i / Math.max(nums.length - 1, 1)) * 84
            const y = 30 - ((v - min) / range) * 26
            return `${x},${y}`
        })
        .join(" ")
    return (
        <svg
            width="86"
            height="34"
            viewBox="0 0 86 34"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
        >
            <polyline
                points={points}
                fill="none"
                stroke={accentColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity=".8"
            />
        </svg>
    )
}

function TurnitsDashboard_Chart({
    stats,
    accentColor,
    monthMode = false,
}: any) {
    const [metric, setMetric] = React.useState<"turnos" | "ingresos">("turnos")
    const [range, setRange] = React.useState("30d")
    // Ancho real de la tarjeta: el SVG se dibuja a ese ancho (1 unidad = 1px)
    // para que llene todo el espacio y los textos se vean a tamaño real.
    const wrapRef = React.useRef<HTMLDivElement>(null)
    const wrapW = Turnits_useElementWidth(wrapRef, 760)
    const data = React.useMemo(() => {
        if (metric === "turnos") {
            return (stats?.chartData || []).map((d: any) => ({
                label: d.label,
                value: Number(d.turnos || 0),
            }))
        }
        if (monthMode) {
            return (stats?.chartData || []).map((d: any) => ({
                label: d.label,
                value: Number(d.ingresos || 0),
            }))
        }
        const map = stats?.ventasPorDia || {}
        const now = new Date()
        const days = range === "7d" ? 7 : 30
        return Array.from({ length: days }, (_, i) => {
            const d = new Date(now)
            d.setDate(now.getDate() - (days - 1 - i))
            const iso = d.toISOString().slice(0, 10)
            return {
                label: d
                    .toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                    })
                    .replace(".", ""),
                value: Number(map?.[iso]?.volumen || 0),
            }
        })
    }, [stats, metric, range, monthMode])

    const fmtValue = (n: number) =>
        metric === "ingresos"
            ? TurnitsDashboard_shortMoney(n)
            : Math.round(n).toLocaleString("es-AR")

    const values = data.map((d: any) => d.value)
    const total = values.reduce((a: number, b: number) => a + b, 0)
    const max = Math.max(...values, 1)
    const min = 0 // los ejes arrancan siempre en 0, más fácil de leer

    const w = Math.max(Math.round(wrapW), 240)
    const isNarrow = w < 520
    const h = isNarrow ? 230 : 270
    const fontSize = isNarrow ? 11 : 11.5
    // márgenes: a la izquierda para los valores del eje Y, abajo para las
    // etiquetas de fecha del eje X.
    const marginLeft = isNarrow ? 46 : 54
    const marginRight = isNarrow ? 12 : 16
    const marginTop = 16
    const marginBottom = 30
    const usableW = w - marginLeft - marginRight
    const usableH = h - marginTop - marginBottom
    const pts = data.map((d: any, i: number) => {
        const x = marginLeft + (i / Math.max(data.length - 1, 1)) * usableW
        const y =
            marginTop +
            usableH -
            ((d.value - min) / Math.max(max - min, 1)) * usableH
        return { x, y, ...d }
    })
    const line = pts.map((p: any) => `${p.x},${p.y}`).join(" ")
    const area = pts.length
        ? `${marginLeft},${marginTop + usableH} ${line} ${w - marginRight},${marginTop + usableH}`
        : ""

    // Cuántas etiquetas del eje X mostrar sin amontonarlas según el ancho
    // disponible (todas si son pocas —ej. 4 semanas—, si no una cada tantos
    // puntos contando desde la última, así la más reciente siempre se ve).
    const maxLabels = Math.max(2, Math.floor(usableW / 62))
    const labelStep = Math.max(1, Math.ceil(data.length / maxLabels))
    const xLabelIdx = new Set<number>()
    for (let i = data.length - 1; i >= 0; i -= labelStep) xLabelIdx.add(i)

    const yTicks = [0, 0.25, 0.5, 0.75, 1]

    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e8edf2",
                borderRadius: 16,
                padding: "18px 18px 14px",
                boxShadow: "0 1px 2px rgba(15,23,42,.02)",
                boxSizing: "border-box",
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 750,
                            color: "#111827",
                        }}
                    >
                        Rendimiento
                    </div>
                    <div
                        style={{
                            fontSize: 12.5,
                            color: "#94a3b8",
                            marginTop: 3,
                        }}
                    >
                        {data.length > 0
                            ? `${metric === "ingresos" ? "Facturaste" : "Hiciste"} ${fmtValue(total)}${metric === "ingresos" ? "" : " turnos"} en este período`
                            : "Evolución reciente de tu negocio"}
                    </div>
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 4,
                        background: "#f6f8fa",
                        padding: 3,
                        borderRadius: 9,
                    }}
                >
                    {[
                        ["turnos", "Turnos"],
                        ["ingresos", "Ingresos"],
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setMetric(id as any)}
                            style={{
                                border: "none",
                                borderRadius: 7,
                                padding: "6px 10px",
                                background:
                                    metric === id ? "#fff" : "transparent",
                                color: metric === id ? accentColor : "#64748b",
                                fontWeight: 700,
                                fontSize: 11.5,
                                boxShadow:
                                    metric === id
                                        ? "0 1px 2px rgba(15,23,42,.06)"
                                        : "none",
                                cursor: "pointer",
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            {metric === "ingresos" && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 8,
                        gap: 4,
                    }}
                >
                    {["7d", "30d"].map((id) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setRange(id)}
                            style={{
                                border: "none",
                                background:
                                    range === id
                                        ? `${accentColor}10`
                                        : "transparent",
                                color: range === id ? accentColor : "#94a3b8",
                                borderRadius: 7,
                                padding: "5px 8px",
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {id === "7d" ? "7 días" : "30 días"}
                        </button>
                    ))}
                </div>
            )}
            <div
                ref={wrapRef}
                style={{
                    position: "relative",
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    height: data.length > 0 ? h : undefined,
                    overflow: "hidden",
                    marginTop: 4,
                }}
            >
                {data.length > 0 ? (
                    <svg
                        viewBox={`0 0 ${w} ${h}`}
                        preserveAspectRatio="none"
                        width="100%"
                        height={h}
                        // En absoluto: el SVG nunca aporta ancho propio al
                        // layout, así no puede ensanchar la tarjeta (overflow-x)
                        // ni en el primer render, antes de medir el ancho.
                        style={{
                            display: "block",
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: h,
                            maxWidth: "100%",
                        }}
                        role="img"
                        aria-label={`Gráfico de ${metric === "ingresos" ? "ingresos" : "turnos"} por ${metric === "ingresos" ? "día" : "semana"}`}
                    >
                        {yTicks.map((p) => {
                            const y = marginTop + usableH * p
                            const value = max - p * (max - min)
                            return (
                                <g key={p}>
                                    <line
                                        x1={marginLeft}
                                        x2={w - marginRight}
                                        y1={y}
                                        y2={y}
                                        stroke="#eef2f5"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={marginLeft - 8}
                                        y={y + fontSize / 3}
                                        textAnchor="end"
                                        fontSize={fontSize}
                                        fill="#94a3b8"
                                    >
                                        {fmtValue(value)}
                                    </text>
                                </g>
                            )
                        })}
                        <polygon
                            points={area}
                            fill={accentColor || "#22c55e"}
                            fillOpacity={0.08}
                        />
                        <polyline
                            points={line}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {pts.map((p: any, i: number) => (
                            <g key={i}>
                                {!isNarrow && (
                                    <circle
                                        cx={p.x}
                                        cy={p.y}
                                        r={data.length > 20 ? 2.5 : 3.5}
                                        fill="#fff"
                                        stroke={accentColor}
                                        strokeWidth="1.6"
                                    >
                                        <title>{`${p.label}: ${fmtValue(p.value)}${metric === "ingresos" ? "" : " turnos"}`}</title>
                                    </circle>
                                )}
                                {xLabelIdx.has(i) && (
                                    <text
                                        x={Math.min(Math.max(p.x, 20), w - 20)}
                                        y={h - 8}
                                        textAnchor="middle"
                                        fontSize={fontSize}
                                        fill="#94a3b8"
                                    >
                                        {p.label}
                                    </text>
                                )}
                            </g>
                        ))}
                    </svg>
                ) : (
                    <div
                        style={{
                            height: 220,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#94a3b8",
                            fontSize: 13,
                        }}
                    >
                        Todavía no hay suficiente actividad para mostrar el
                        gráfico.
                    </div>
                )}
            </div>
        </div>
    )
}

function TurnitsDashboard_Upcoming({
    stats,
    accentColor,
    onNavigate,
    ilustracionVacia,
}: any) {
    const hoy = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date())
    const items = (stats?.turnosLista || [])
        .filter((t: any) => t.fecha === hoy && t.estado !== "cancelado")
        .sort((a: any, b: any) =>
            String(a.hora || "").localeCompare(String(b.hora || ""))
        )
        .slice(0, 5)
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e8edf2",
                borderRadius: 16,
                padding: "18px",
                boxShadow: "0 1px 2px rgba(15,23,42,.02)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 750,
                            color: "#111827",
                        }}
                    >
                        Próximos turnos
                    </div>
                    <div
                        style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}
                    >
                        Hoy · {TurnitsDashboard_dateLabel()}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onNavigate?.("agenda")}
                    style={{
                        border: "none",
                        background: "transparent",
                        color: accentColor,
                        fontSize: 11.5,
                        fontWeight: 750,
                        cursor: "pointer",
                    }}
                >
                    Ver agenda
                </button>
            </div>
            <div
                style={{
                    marginTop: 12,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {items.length ? (
                    items.map((t: any, i: number) => (
                        <div
                            key={t.id || i}
                            style={{
                                display: "grid",
                                gridTemplateColumns: "54px 1fr auto",
                                gap: 10,
                                alignItems: "center",
                                padding: "11px 0",
                                borderTop: i ? "1px solid #f1f5f9" : "none",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 12.5,
                                    fontWeight: 750,
                                    color: "#111827",
                                }}
                            >
                                {t.hora || "—"}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 650,
                                        color: "#334155",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {[t.nombre, t.apellido]
                                        .filter(Boolean)
                                        .join(" ") || "Cliente"}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#94a3b8",
                                        marginTop: 2,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {t.servicio || "Servicio"}
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: "#111827",
                                    }}
                                >
                                    {TurnitsDashboard_money(t.precio_cobrado)}
                                </div>
                                <span
                                    style={{
                                        display: "inline-block",
                                        marginTop: 3,
                                        padding: "2px 6px",
                                        borderRadius: 99,
                                        background:
                                            t.estado === "pendiente"
                                                ? "#fff7ed"
                                                : `${accentColor}10`,
                                        color:
                                            t.estado === "pendiente"
                                                ? "#c2410c"
                                                : accentColor,
                                        fontSize: 9.5,
                                        fontWeight: 750,
                                    }}
                                >
                                    {t.estado === "pendiente"
                                        ? "Pendiente"
                                        : "Confirmado"}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div
                        style={{
                            padding: "20px 8px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            gap: 10,
                        }}
                    >
                        {ilustracionVacia && (
                            <img
                                src={ilustracionVacia}
                                alt=""
                                style={{
                                    maxWidth: 250,
                                    maxHeight: 250,
                                    width: "100%",
                                    height: "auto",
                                    objectFit: "contain",
                                    opacity: 0.9,
                                }}
                            />
                        )}
                        <span style={{ color: "#94a3b8", fontSize: 12.5 }}>
                            No tenés turnos para hoy.
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

function TurnitsDashboard_ServicesMostRequested({
    stats,
    accentColor,
    isMobile,
}: any) {
    const servicios = stats?.serviciosMasPedidos || []
    const max = Math.max(
        ...servicios.map((s: any) => Number(s.cantidad || 0)),
        1
    )
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e8edf2",
                borderRadius: 16,
                padding: 18,
                boxShadow: "0 1px 2px rgba(15,23,42,.02)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 15,
                            fontWeight: 750,
                            color: "#111827",
                        }}
                    >
                        Servicios más pedidos
                    </div>
                    <div
                        style={{
                            fontSize: 11.5,
                            color: "#94a3b8",
                            marginTop: 3,
                        }}
                    >
                        Los servicios con más reservas este mes
                    </div>
                </div>
                <div
                    style={{
                        fontSize: 10.5,
                        color: accentColor,
                        fontWeight: 750,
                    }}
                >
                    Este mes
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 11,
                    marginTop: 15,
                }}
            >
                {servicios.map((s: any) => (
                    <div key={s.nombre}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                marginBottom: 5,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#475569",
                                    fontWeight: 700,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {s.nombre}
                            </div>
                            <div
                                style={{
                                    fontSize: 10.5,
                                    color: "#94a3b8",
                                    fontWeight: 750,
                                    flexShrink: 0,
                                }}
                            >
                                {s.cantidad} · {s.porcentaje}%
                            </div>
                        </div>
                        <div
                            style={{
                                height: 8,
                                borderRadius: 99,
                                background: "#eef2f4",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${Math.max(4, (Number(s.cantidad || 0) / max) * 100)}%`,
                                    height: "100%",
                                    borderRadius: 99,
                                    background: accentColor,
                                }}
                            />
                        </div>
                    </div>
                ))}
                {!servicios.length && (
                    <div
                        style={{
                            padding: "20px 0",
                            textAlign: "center",
                            color: "#94a3b8",
                            fontSize: 11.5,
                        }}
                    >
                        Todavía no hay reservas suficientes para mostrar
                        servicios pedidos.
                    </div>
                )}
            </div>
        </div>
    )
}

function TurnitsDashboard_BusinessMetrics({ stats, accentColor }: any) {
    const dias = stats?.diasRecurrentes || []
    const total = dias.reduce(
        (a: number, d: any) => a + Number(d.cantidad || 0),
        0
    )
    const top = dias[0]
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e8edf2",
                borderRadius: 16,
                padding: 18,
                boxShadow: "0 1px 2px rgba(15,23,42,.02)",
            }}
        >
            <div>
                <div
                    style={{ fontSize: 16, fontWeight: 750, color: "#111827" }}
                >
                    ¿Cuándo vuelven tus clientes?
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                    Días con más visitas de clientes recurrentes
                </div>
            </div>
            {top ? (
                <div
                    style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 11,
                        background: `${accentColor}09`,
                        border: `1px solid ${accentColor}18`,
                    }}
                >
                    <div
                        style={{
                            fontSize: 10.5,
                            color: "#94a3b8",
                            fontWeight: 650,
                        }}
                    >
                        Día más recurrente
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 7,
                            marginTop: 3,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 20,
                                fontWeight: 800,
                                color: "#111827",
                            }}
                        >
                            {top.nombre}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                fontWeight: 750,
                                color: accentColor,
                            }}
                        >
                            {top.porcentaje}%
                        </div>
                    </div>
                </div>
            ) : null}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                    marginTop: 14,
                }}
            >
                {dias.slice(0, 5).map((d: any) => (
                    <div
                        key={d.nombre}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "74px 1fr 36px",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10.5,
                                color: "#64748b",
                                fontWeight: 650,
                            }}
                        >
                            {d.nombre}
                        </div>
                        <div
                            style={{
                                height: 7,
                                borderRadius: 99,
                                background: "#eef2f4",
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${total ? Math.max(5, Math.min(100, d.porcentaje)) : 0}%`,
                                    height: "100%",
                                    borderRadius: 99,
                                    background: accentColor,
                                }}
                            />
                        </div>
                        <div
                            style={{
                                textAlign: "right",
                                fontSize: 10.5,
                                color: "#94a3b8",
                                fontWeight: 700,
                            }}
                        >
                            {d.porcentaje}%
                        </div>
                    </div>
                ))}
                {!dias.length && (
                    <div
                        style={{
                            padding: "18px 0",
                            textAlign: "center",
                            color: "#94a3b8",
                            fontSize: 11.5,
                        }}
                    >
                        Todavía no hay suficientes visitas recurrentes para
                        mostrar un patrón.
                    </div>
                )}
            </div>
        </div>
    )
}

function TurnitsDashboard_ReferralPromo({
    accentColor,
    isMobile,
    backgroundImage,
    colorDesde,
    colorHasta,
    onOpenPanel,
}: any) {
    const tieneImagen = !!backgroundImage
    // Degradé personalizable desde Framer (colorDesde / colorHasta),
    // independiente del fondo del banner de referidos del menú. Si no se
    // cargan colores, se mantiene el verde de siempre (colorHasta cae al
    // accentColor del panel). Si además se carga una imagen de fondo, la
    // imagen manda y el degradé queda como respaldo debajo.
    const desde = colorDesde || "#0f5c20"
    const hasta = colorHasta || accentColor
    return (
        <div
            style={{
                position: "relative",
                overflow: "hidden",
                color: "#fff",
                borderRadius: 16,
                padding: 20,
                minHeight: isMobile ? 170 : 190,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 8px 24px rgba(27,107,26,.14)",
                background: `linear-gradient(145deg, ${desde} 0%, ${hasta} 100%)`,
                ...(tieneImagen
                    ? {
                          backgroundImage: `url("${backgroundImage}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                      }
                    : {}),
            }}
        >
            {/* Overlay para que el texto siempre se lea sobre la imagen */}
            {tieneImagen && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(90deg, rgba(0,0,0,.62) 0%, rgba(0,0,0,.28) 100%)",
                        pointerEvents: "none",
                    }}
                />
            )}
            {!tieneImagen && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        width: 150,
                        height: 150,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,.07)",
                        right: -50,
                        top: -55,
                    }}
                />
            )}
            <div style={{ position: "relative" }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        opacity: 0.78,
                    }}
                >
                    Programa de referidos
                </div>
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: 760,
                        marginTop: 10,
                        letterSpacing: "-.4px",
                    }}
                >
                    Sumá negocios y ganá Básico gratis
                </div>
                <div
                    style={{
                        fontSize: 12.5,
                        lineHeight: 1.55,
                        marginTop: 7,
                        opacity: 0.9,
                        maxWidth: 420,
                    }}
                >
                    Invitá a otros negocios a Turnits. Cuando tu grupo llega a
                    25 turnos cada uno, todos ganan 30 días de Básico.
                </div>
            </div>
            <div style={{ position: "relative" }}>
                <button
                    type="button"
                    onClick={() => onOpenPanel?.("crecer")}
                    style={{
                        marginTop: 14,
                        height: 34,
                        padding: "0 14px",
                        borderRadius: 9,
                        border: "none",
                        background: "#fff",
                        color: "#0f3d16",
                        fontSize: 11.5,
                        fontWeight: 750,
                        cursor: "pointer",
                    }}
                >
                    Ver mi link de referidos
                </button>
            </div>
        </div>
    )
}

function TurnitsDashboard_RecentClients({ stats }: any) {
    const seen = new Set<string>()
    const items: any[] = []
    for (const t of stats?.turnosLista || []) {
        const key = `${String(t.nombre || "")
            .trim()
            .toLowerCase()}|${String(t.telefono || "").trim()}`
        if (!key || seen.has(key)) continue
        seen.add(key)
        items.push(t)
        if (items.length >= 4) break
    }
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e8edf2",
                borderRadius: 16,
                padding: "18px",
                boxShadow: "0 1px 2px rgba(15,23,42,.02)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 750,
                            color: "#111827",
                        }}
                    >
                        Clientes recientes
                    </div>
                    <div
                        style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}
                    >
                        Últimas personas que reservaron
                    </div>
                </div>
            </div>
            <div style={{ marginTop: 8 }}>
                {items.length ? (
                    items.map((t: any, i: number) => {
                        const name =
                            [t.nombre, t.apellido].filter(Boolean).join(" ") ||
                            "Cliente"
                        const initials = name
                            .split(" ")
                            .slice(0, 2)
                            .map((x: string) => x[0])
                            .join("")
                            .toUpperCase()
                        return (
                            <div
                                key={`${name}-${i}`}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 0",
                                    borderTop: i ? "1px solid #f1f5f9" : "none",
                                }}
                            >
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 10,
                                        background: "#eef6ee",
                                        color: "#1B6B1A",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        flexShrink: 0,
                                    }}
                                >
                                    {initials}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            color: "#334155",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 10.5,
                                            color: "#94a3b8",
                                            marginTop: 2,
                                        }}
                                    >
                                        {t.servicio || "Servicio"} ·{" "}
                                        {t.fecha || ""}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div
                        style={{
                            padding: "25px 0",
                            textAlign: "center",
                            color: "#94a3b8",
                            fontSize: 12.5,
                        }}
                    >
                        Todavía no hay clientes registrados.
                    </div>
                )}
            </div>
        </div>
    )
}

function TurnitsDashboard_WeeklySummary({ stats, accentColor }: any) {
    const [periodo, setPeriodo] = React.useState<"mes" | "semana">("mes")

    // Servidor viejo (sin `comparativas`): el mes se arma con los campos de
    // siempre. Ahí no hay ingreso del mes anterior, así que ese dato queda sin
    // comparar. La semana necesita el servidor nuevo.
    const legacyMes = {
        actual: {
            turnos: stats?.turnosMes,
            clientes_nuevos: stats?.clientesNuevos,
            ingresos: stats?.ventas?.volumenMes,
        },
        anterior: {
            turnos: stats?.turnosMesAnterior,
            clientes_nuevos: stats?.clientesNuevosMesAnterior,
            ingresos: null,
        },
    }
    const cmp: any =
        stats?.comparativas?.[periodo] ?? (periodo === "mes" ? legacyMes : null)

    const numero = (n: any) => String(Number(n || 0))
    const metricas: any[] = cmp
        ? [
              {
                  label: "Turnos",
                  actual: cmp.actual?.turnos,
                  anterior: cmp.anterior?.turnos,
                  formato: numero,
              },
              {
                  label: "Clientes nuevos",
                  actual: cmp.actual?.clientes_nuevos,
                  anterior: cmp.anterior?.clientes_nuevos,
                  formato: numero,
              },
              {
                  label: "Ingresos",
                  actual: cmp.actual?.ingresos,
                  anterior: cmp.anterior?.ingresos,
                  formato: (n: any) => TurnitsDashboard_shortMoney(n),
              },
          ]
        : []

    const colorDe = (tono: string) =>
        tono === "sube"
            ? TurnitsDashboard_COLOR_SUBE
            : tono === "baja"
              ? TurnitsDashboard_COLOR_BAJA
              : TurnitsDashboard_COLOR_IGUAL

    // Los rangos de fechas hacen de etiqueta de cada barra: así no hace falta
    // un subtítulo aparte ni repetir "actual / anterior" en cada tarjeta.
    const etiquetaActual =
        TurnitsDashboard_rangoLabel(cmp?.actual?.desde, cmp?.actual?.hasta) ||
        "Actual"
    const etiquetaAnterior =
        TurnitsDashboard_rangoLabel(
            cmp?.anterior?.desde,
            cmp?.anterior?.hasta
        ) || "Anterior"

    const etiquetaStyle = {
        fontSize: 10.5,
        color: "#94a3b8",
        whiteSpace: "nowrap" as const,
    }
    const pista = {
        height: 8,
        borderRadius: 99,
        background: "#eef2f4",
        overflow: "hidden" as const,
    }

    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid #e8edf2",
                borderRadius: 16,
                padding: "16px 18px 18px",
                boxShadow: "0 2px 8px rgba(15,23,42,.04)",
            }}
        >
            <div style={{ marginBottom: 12 }}>
                <div
                    style={{
                        fontSize: 15,
                        fontWeight: 750,
                        color: "#172033",
                        letterSpacing: "-0.2px",
                    }}
                >
                    Comparativa de rendimiento
                </div>
                <div
                    style={{
                        marginTop: 4,
                        fontSize: 11.5,
                        lineHeight: 1.45,
                        color: "#7b8798",
                    }}
                >
                    Compará cada período con el mismo tramo anterior.
                </div>
            </div>
            <div
                role="tablist"
                aria-label="Período de comparación"
                style={{
                    display: "inline-flex",
                    gap: 4,
                    background: "#f6f8fa",
                    padding: 3,
                    borderRadius: 9,
                }}
            >
                {(
                    [
                        ["mes", "Este mes"],
                        ["semana", "Esta semana"],
                    ] as const
                ).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={periodo === id}
                        onClick={() => setPeriodo(id)}
                        style={{
                            border: "none",
                            borderRadius: 7,
                            padding: "6px 11px",
                            background: periodo === id ? "#fff" : "transparent",
                            color: periodo === id ? accentColor : "#64748b",
                            fontWeight: 700,
                            fontSize: 11.5,
                            boxShadow:
                                periodo === id
                                    ? "0 1px 2px rgba(15,23,42,.06)"
                                    : "none",
                            cursor: "pointer",
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {metricas.length ? (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit,minmax(210px,1fr))",
                        gap: 10,
                        marginTop: 12,
                    }}
                >
                    {metricas.map((m) => {
                        const v = TurnitsDashboard_variacion(
                            m.actual,
                            m.anterior
                        )
                        const color = v
                            ? colorDe(v.tono)
                            : TurnitsDashboard_COLOR_IGUAL
                        const hayAnterior =
                            m.anterior !== null && m.anterior !== undefined
                        const actual = Number(m.actual || 0)
                        const anterior = Number(m.anterior || 0)
                        // Las dos barras comparten escala; una barra con valor
                        // nunca queda más fina que 4% para que se vea.
                        const max = Math.max(actual, anterior, 1)
                        const ancho = (n: number) =>
                            n > 0 ? Math.max(4, (n / max) * 100) : 0
                        return (
                            <div
                                key={m.label}
                                style={{
                                    padding: "12px 14px",
                                    background: "#f8fafb",
                                    borderRadius: 11,
                                    minWidth: 0,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 720,
                                            color: "#334155",
                                        }}
                                    >
                                        {m.label}
                                    </div>
                                    {v && (
                                        <span
                                            style={{
                                                padding: "2px 8px",
                                                borderRadius: 99,
                                                background: `${color}14`,
                                                color,
                                                fontSize: 11,
                                                fontWeight: 780,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {v.texto}
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "max-content 1fr max-content",
                                        alignItems: "center",
                                        columnGap: 9,
                                        rowGap: 8,
                                        marginTop: 11,
                                    }}
                                >
                                    <span style={etiquetaStyle}>
                                        {etiquetaActual}
                                    </span>
                                    <div style={pista}>
                                        <div
                                            style={{
                                                width: `${ancho(actual)}%`,
                                                height: "100%",
                                                borderRadius: 99,
                                                background: "#1B6B1A",
                                            }}
                                        />
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 780,
                                            color: "#111827",
                                            textAlign: "right",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {m.formato(m.actual)}
                                    </span>

                                    <span style={etiquetaStyle}>
                                        {etiquetaAnterior}
                                    </span>
                                    <div style={pista}>
                                        <div
                                            style={{
                                                width: `${hayAnterior ? ancho(anterior) : 0}%`,
                                                height: "100%",
                                                borderRadius: 99,
                                                background: "#cbd5e1",
                                            }}
                                        />
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 12.5,
                                            fontWeight: 650,
                                            color: "#94a3b8",
                                            textAlign: "right",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {hayAnterior
                                            ? m.formato(m.anterior)
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div
                    style={{
                        marginTop: 12,
                        padding: "18px 8px",
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 12,
                    }}
                >
                    La comparación semanal todavía no está disponible.
                </div>
            )}
        </div>
    )
}

function TurnitsDashboard_ReferralCard({ accentColor, baseUrl, icono }: any) {
    const [data, setData] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [copiado, setCopiado] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setData({
                codigo: "K7M2QX9P",
                link: "https://turnits.com/register?ref=K7M2QX9P",
                reglas: { grupo: 3, turnos_min: 10, dias_premio: 30 },
                como_invitado: {
                    completo: false,
                    faltan_invitados: 1,
                    premio_entregado: false,
                    miembros: [
                        {
                            label: "Tu negocio",
                            turnos: 7,
                            completo: false,
                            propio: true,
                        },
                        { label: "Negocio 2", turnos: 10, completo: true },
                    ],
                },
                grupos: [],
            })
            setLoading(false)
            return
        }
        let cancelled = false
        const slug = TurnitsDashboard_getSlug()
        const token = TurnitsDashboard_getToken()
        if (!slug || !token) {
            setLoading(false)
            return
        }
        const api = String(baseUrl || "").replace(/\/+$/, "")
        fetch(`${api}/referidos/${encodeURIComponent(slug)}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((r) => r.json())
            .then((j) => {
                if (cancelled) return
                if (j?.success) setData(j)
                else setError(j?.error || "No se pudo cargar el programa.")
            })
            .catch(
                () => !cancelled && setError("No se pudo cargar el programa.")
            )
            .finally(() => !cancelled && setLoading(false))
        return () => {
            cancelled = true
        }
    }, [baseUrl])

    const copiar = async (texto: string, key: string) => {
        try {
            await navigator.clipboard.writeText(texto)
        } catch {
            try {
                const ta = document.createElement("textarea")
                ta.value = texto
                document.body.appendChild(ta)
                ta.select()
                document.execCommand("copy")
                document.body.removeChild(ta)
            } catch {}
        }
        setCopiado(key)
        setTimeout(() => setCopiado(""), 1600)
    }

    const reglas = data?.reglas || { grupo: 3, turnos_min: 10, dias_premio: 30 }

    const renderGrupo = (titulo: string, g: any) => (
        <div
            style={{
                marginTop: 10,
                padding: 11,
                borderRadius: 10,
                background: "#ffffff",
                border: "1px solid #e8edf0",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                }}
            >
                <div
                    style={{
                        fontSize: 11.5,
                        fontWeight: 750,
                        color: "#111827",
                    }}
                >
                    {titulo}
                </div>
                {g.premio_entregado ? (
                    <span
                        style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            color: "#15803d",
                            background: "#dcfce7",
                            padding: "2px 7px",
                            borderRadius: 99,
                        }}
                    >
                        Premio entregado
                    </span>
                ) : g.completo ? (
                    <span
                        style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            color: accentColor,
                            background: `${accentColor}14`,
                            padding: "2px 7px",
                            borderRadius: 99,
                        }}
                    >
                        Meta cumplida
                    </span>
                ) : null}
            </div>
            {(g.miembros || []).map((m: any, i: number) => {
                const pct = Math.min(100, (m.turnos / reglas.turnos_min) * 100)
                return (
                    <div key={i} style={{ marginTop: i === 0 ? 0 : 8 }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 10.5,
                                color: m.propio ? "#111827" : "#64748b",
                                fontWeight: m.propio ? 750 : 500,
                            }}
                        >
                            <span>
                                {m.label}
                                {m.registrado_at && (
                                    <span
                                        style={{
                                            color: "#94a3b8",
                                            fontWeight: 400,
                                        }}
                                    >
                                        {" "}
                                        · se registró el{" "}
                                        {new Date(
                                            m.registrado_at
                                        ).toLocaleDateString("es-AR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                        })}
                                    </span>
                                )}
                            </span>
                            <span>
                                {m.turnos}/{reglas.turnos_min} turnos
                            </span>
                        </div>
                        <div
                            style={{
                                height: 5,
                                borderRadius: 99,
                                background: "#eef2f5",
                                marginTop: 4,
                                overflow: "hidden",
                            }}
                        >
                            <div
                                style={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    borderRadius: 99,
                                    background: m.completo
                                        ? "#22c55e"
                                        : accentColor,
                                    transition: "width .3s ease",
                                }}
                            />
                        </div>
                    </div>
                )
            })}
            {g.faltan_invitados > 0 && (
                <div style={{ marginTop: 8, fontSize: 10.5, color: "#94a3b8" }}>
                    {g.faltan_invitados === 1
                        ? "Falta 1 negocio por sumarse al grupo."
                        : `Faltan ${g.faltan_invitados} negocios por sumarse al grupo.`}
                </div>
            )}
        </div>
    )

    const botonCopiar = (texto: string, key: string, label: string) => (
        <button
            type="button"
            onClick={() => copiar(texto, key)}
            style={{
                flex: 1,
                height: 34,
                border: "none",
                borderRadius: 9,
                background: copiado === key ? "#22c55e" : accentColor,
                color: "#fff",
                fontSize: 11.5,
                fontWeight: 750,
                cursor: "pointer",
                transition: "background .2s ease",
            }}
        >
            {copiado === key ? "¡Copiado!" : label}
        </button>
    )

    return (
        <div
            style={{
                padding: 15,
                borderRadius: 13,
                background: `${accentColor}08`,
                border: `1px solid ${accentColor}18`,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: `${accentColor}13`,
                        color: accentColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        overflow: "hidden",
                    }}
                >
                    {icono ? (
                        <img
                            src={icono}
                            alt=""
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                            }}
                        />
                    ) : (
                        "+"
                    )}
                </div>
                <div>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 750,
                            color: "#111827",
                        }}
                    >
                        Programa de referidos
                    </div>
                    <div
                        style={{
                            fontSize: 10.5,
                            color: "#64748b",
                            marginTop: 2,
                        }}
                    >
                        Sumá negocios a Turnits y ganá Básico gratis.
                    </div>
                </div>
            </div>

            <div
                style={{
                    marginTop: 12,
                    fontSize: 11,
                    color: "#64748b",
                    lineHeight: 1.45,
                }}
            >
                Cuando los {reglas.grupo} negocios de un grupo llegan a{" "}
                {reglas.turnos_min} turnos, cada uno gana {reglas.dias_premio}{" "}
                días de Básico.
            </div>

            {loading && (
                <div style={{ marginTop: 12, fontSize: 11, color: "#94a3b8" }}>
                    Cargando...
                </div>
            )}

            {!loading && error && (
                <div style={{ marginTop: 12, fontSize: 11, color: "#b91c1c" }}>
                    {error}
                </div>
            )}

            {!loading && data && (
                <>
                    <div
                        style={{
                            marginTop: 12,
                            padding: "9px 11px",
                            borderRadius: 10,
                            background: "#ffffff",
                            border: `1px dashed ${accentColor}55`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <span style={{ fontSize: 10.5, color: "#64748b" }}>
                            Tu código
                        </span>
                        <span
                            style={{
                                fontSize: 14,
                                fontWeight: 800,
                                letterSpacing: 1.5,
                                color: "#111827",
                                fontFamily: "monospace",
                            }}
                        >
                            {data.codigo}
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        {botonCopiar(data.link, "link", "Copiar link")}
                    </div>

                    {data.resumen?.registrados > 0 && (
                        <div
                            style={{
                                marginTop: 10,
                                padding: "9px 11px",
                                borderRadius: 10,
                                background: "#ffffff",
                                border: "1px solid #e8edf0",
                                display: "flex",
                                justifyContent: "space-around",
                                textAlign: "center",
                            }}
                        >
                            {[
                                ["Registrados", data.resumen.registrados],
                                ["Con turnos", data.resumen.con_turnos],
                                [
                                    "Llegaron a " + reglas.turnos_min,
                                    data.resumen.completaron,
                                ],
                            ].map(([t, n]: any) => (
                                <div key={t}>
                                    <div
                                        style={{
                                            fontSize: 16,
                                            fontWeight: 800,
                                            color: "#111827",
                                        }}
                                    >
                                        {n}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 9.5,
                                            color: "#64748b",
                                            marginTop: 1,
                                        }}
                                    >
                                        {t}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {data.como_invitado &&
                        renderGrupo("Tu grupo", data.como_invitado)}

                    {(data.grupos || []).map((g: any) =>
                        renderGrupo(`Grupo ${g.nro} · invitados por vos`, g)
                    )}

                    {!data.como_invitado &&
                        (data.grupos || []).length === 0 && (
                            <div
                                style={{
                                    marginTop: 10,
                                    fontSize: 10.5,
                                    color: "#94a3b8",
                                    lineHeight: 1.45,
                                }}
                            >
                                Todavía no se registró nadie con tu código.
                                Compartí tu link para armar tu primer grupo.
                            </div>
                        )}
                </>
            )}
        </div>
    )
}

function TurnitsDashboard_Achievements({
    stats,
    accentColor,
    logroPrimerTurno,
    logroDiezClientes,
    logroCincuentaTurnos,
    logroVeinteTurnos,
    logroClienteFrecuente,
    logroDiaFull,
    logroSemanaCompleta,
    logroAfiliados,
    logroFacturacion,
}: any) {
    const achievementsRef = React.useRef<HTMLDivElement>(null)
    const achievementsWidth = Turnits_useElementWidth(achievementsRef, 360)
    const achievementsColumns =
        achievementsWidth < 330 ? "1fr" : "repeat(2, minmax(0, 1fr))"
    // OJO: estos logros salen de stats.logros (histórico de TODOS los
    // tiempos, lo calcula /admin-stats). No usar turnosMes/turnosHoy acá:
    // esos se reinician cada mes/día, y un logro ganado no debería
    // "perderse" solo porque empezó un mes nuevo.
    const logros = stats?.logros || {}
    const turnos = Number(logros.turnosHistoricos || 0)
    const clientes = Number(stats?.totalClientes || 0)
    const clientesFieles = Number(logros.clientesFieles || 0)
    const maxPorDia = Number(logros.maxTurnosPorDia || 0)
    const diasSemana = Number(logros.diasSemanaConTurno || 0)
    const facturacion = Number(logros.facturacionHistorica || 0)
    const facturacionMeta = Number(logros.facturacionMeta || 600000)
    const afiliadosCompleto = !!logros.programaAfiliadosCompleto
    const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
    const items = [
        {
            label: "Primer turno",
            done: turnos >= 1,
            svg: logroPrimerTurno,
            hint:
                turnos >= 1
                    ? "Hiciste tu primer turno."
                    : "Se desbloquea con tu primer turno agendado.",
        },
        {
            label: "20 turnos",
            done: turnos >= 20,
            svg: logroVeinteTurnos,
            hint: `Hacé 20 turnos en total (llevás ${turnos}/20).`,
        },
        {
            label: "50 turnos",
            done: turnos >= 50,
            svg: logroCincuentaTurnos,
            hint: `Hacé 50 turnos en total (llevás ${turnos}/50).`,
        },
        {
            label: "10 clientes",
            done: clientes >= 10,
            svg: logroDiezClientes,
            hint: `Sumá 10 clientes distintos (llevás ${clientes}/10).`,
        },
        {
            label: "Cliente fiel",
            done: clientesFieles >= 1,
            svg: logroClienteFrecuente,
            hint:
                clientesFieles >= 1
                    ? "Ya tenés un cliente fiel."
                    : "Se desbloquea cuando un mismo cliente te reserva 5 turnos o más.",
        },
        {
            label: "Agenda llena",
            done: maxPorDia >= 10,
            svg: logroDiaFull,
            hint: `Tené 10 turnos o más en un mismo día (tu récord: ${maxPorDia}/10).`,
        },
        {
            label: "Semana completa",
            done: diasSemana >= 7,
            svg: logroSemanaCompleta,
            hint: `Tené al menos un turno en cada uno de los 7 días de la semana (llevás ${diasSemana}/7).`,
        },
        {
            label: "Afiliados",
            done: afiliadosCompleto,
            svg: logroAfiliados,
            hint: afiliadosCompleto
                ? "Completaste el programa de referidos."
                : "Se desbloquea al completar el programa de referidos invitando amigos.",
        },
        {
            label: "Facturas",
            done: facturacion >= facturacionMeta,
            svg: logroFacturacion,
            hint: `Facturá ${money(facturacionMeta)} históricos (llevás ${money(facturacion)}).`,
        },
    ]

    // Tooltip con hover en PC y tap en celu: un solo índice "activo" a la
    // vez. En mobile no hay hover, por eso el click también lo abre/cierra.
    // Cualquier tap fuera de la tarjeta lo cierra.
    const [activeIdx, setActiveIdx] = React.useState<number | null>(null)
    React.useEffect(() => {
        if (activeIdx === null) return
        const handlePointerDown = (e: PointerEvent) => {
            if (
                achievementsRef.current &&
                !achievementsRef.current.contains(e.target as Node)
            ) {
                setActiveIdx(null)
            }
        }
        document.addEventListener("pointerdown", handlePointerDown)
        return () =>
            document.removeEventListener("pointerdown", handlePointerDown)
    }, [activeIdx])

    return (
        <div
            ref={achievementsRef}
            style={{
                padding: 15,
                borderRadius: 13,
                background: "#f8fafb",
                border: "1px solid #eef2f4",
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 750, color: "#111827" }}>
                Tus logros
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: achievementsColumns,
                    gap: 8,
                    marginTop: 11,
                }}
            >
                {items.map(({ label, done, svg, hint }, i) => (
                    <div
                        key={String(label)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${label}: ${hint}`}
                        onMouseEnter={() => setActiveIdx(i)}
                        onMouseLeave={() =>
                            setActiveIdx((cur) => (cur === i ? null : cur))
                        }
                        onFocus={() => setActiveIdx(i)}
                        onBlur={() =>
                            setActiveIdx((cur) => (cur === i ? null : cur))
                        }
                        onClick={() =>
                            setActiveIdx((cur) => (cur === i ? null : i))
                        }
                        style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            minWidth: 0,
                            padding: "8px 9px",
                            borderRadius: 10,
                            background: done ? "#fff" : "#f1f5f6",
                            border: "1px solid #eef2f4",
                            cursor: "pointer",
                        }}
                    >
                        <div
                            style={{
                                width: 30,
                                height: 30,
                                flex: "0 0 30px",
                                margin: 0,
                                borderRadius: 10,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: done
                                    ? `${accentColor}12`
                                    : "#eef2f4",
                                color: done ? accentColor : "#cbd5e1",
                                fontSize: 12,
                                fontWeight: 900,
                            }}
                        >
                            {svg ? (
                                <img
                                    src={svg}
                                    alt=""
                                    style={{
                                        width: 22,
                                        height: 22,
                                        objectFit: "contain",
                                        opacity: done ? 1 : 0.35,
                                        filter: done ? "none" : "grayscale(1)",
                                    }}
                                />
                            ) : done ? (
                                "✓"
                            ) : (
                                "•"
                            )}
                        </div>
                        <div
                            style={{
                                fontSize: 10.5,
                                lineHeight: 1.25,
                                fontWeight: done ? 650 : 500,
                                color: done ? "#475569" : "#94a3b8",
                            }}
                        >
                            {label}
                        </div>

                        {activeIdx === i && (
                            <div
                                style={{
                                    position: "absolute",
                                    bottom: "calc(100% + 8px)",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    zIndex: 30,
                                    width: "max-content",
                                    maxWidth: 190,
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    background: "#111827",
                                    color: "#fff",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    textAlign: "left",
                                    boxShadow: "0 4px 14px rgba(15,23,42,.18)",
                                    pointerEvents: "none",
                                }}
                            >
                                {hint}
                                <div
                                    style={{
                                        position: "absolute",
                                        top: "100%",
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        width: 0,
                                        height: 0,
                                        borderLeft: "5px solid transparent",
                                        borderRight: "5px solid transparent",
                                        borderTop: "5px solid #111827",
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function TurnitsDashboardSidePanel({
    baseUrl,
    accentColor,
    isMobile,
    panel,
    onClose,
    onNavigate,
    referidosPlusIcono,
    ilustracionRendimientoVacio,
}: any) {
    // Las métricas de equipo (plan, turnos, facturación por integrante)
    // ahora las resuelve directamente <RendimientoEquipo variant="equipo">
    // más abajo — antes este panel repetía su propio fetch de
    // settings + equipo + resumen, calculado por separado del widget
    // de Inicio.
    if (!panel) return null
    const isPremiumPanel = panel === "basico"
    const width = isMobile ? "100%" : 430

    return (
        <AnimatePresence>
            <motion.div
                key="turnits-side-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 1000,
                    background: "rgba(15,23,42,.28)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                }}
            />
            <motion.aside
                key="turnits-side-panel"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1001,
                    width,
                    maxWidth: "100vw",
                    background: "#fff",
                    borderLeft: "1px solid #e7ecef",
                    boxShadow: "-20px 0 50px rgba(15,23,42,.12)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        padding: isMobile ? "18px 18px 14px" : "22px 22px 16px",
                        borderBottom: "1px solid #eef2f4",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                    }}
                >
                    <div>
                        {isPremiumPanel && (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: accentColor,
                                    fontWeight: 850,
                                    textTransform: "uppercase",
                                    letterSpacing: ".08em",
                                }}
                            >
                                Básico
                            </div>
                        )}
                        <div
                            style={{
                                fontSize: 21,
                                fontWeight: 780,
                                color: "#111827",
                                marginTop: 4,
                            }}
                        >
                            {isPremiumPanel
                                ? "Más herramientas para tu negocio"
                                : "Hacé crecer Turnits con vos"}
                        </div>
                        <div
                            style={{
                                fontSize: 12.5,
                                color: "#64748b",
                                marginTop: 5,
                                lineHeight: 1.45,
                            }}
                        >
                            {isPremiumPanel
                                ? "Métricas avanzadas y herramientas para administrar mejor tu negocio."
                                : "Acciones de crecimiento y retención sin llenar tu dashboard de tarjetas."}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            border: "1px solid #e7ecef",
                            background: "#f8fafb",
                            color: "#64748b",
                            cursor: "pointer",
                            fontSize: 18,
                        }}
                    >
                        ×
                    </button>
                </div>
                <div
                    data-lenis-prevent="true"
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: isMobile
                            ? "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))"
                            : 20,
                    }}
                >
                    {isPremiumPanel ? (
                        <>
                            <div
                                style={{
                                    background: `${accentColor}09`,
                                    border: `1px solid ${accentColor}18`,
                                    borderRadius: 14,
                                    padding: 14,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 750,
                                            color: "#111827",
                                        }}
                                    >
                                        Estado de tu plan
                                    </div>
                                    <div
                                        style={{
                                            color: accentColor,
                                            fontSize: 11,
                                            fontWeight: 800,
                                        }}
                                    >
                                        Básico
                                    </div>
                                </div>
                                <div style={{ marginTop: 10 }}>
                                    <PlanEstado
                                        baseUrl={baseUrl}
                                        accentColor={accentColor}
                                    />
                                </div>
                            </div>
                            <div style={{ marginTop: 18 }}>
                                <RendimientoEquipo
                                    baseUrl={baseUrl}
                                    accentColor={accentColor}
                                    variant="equipo"
                                    ilustracionVacia={
                                        ilustracionRendimientoVacio
                                    }
                                    style={{
                                        boxShadow: "none",
                                        padding: 0,
                                        borderRadius: 0,
                                        height: "auto",
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div
                                style={{
                                    padding: 16,
                                    borderRadius: 14,
                                    background: `linear-gradient(145deg,${accentColor}0D,#fff)`,
                                    border: `1px solid ${accentColor}18`,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 760,
                                        color: "#111827",
                                    }}
                                >
                                    Un panel que crece con tu negocio
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "#64748b",
                                        lineHeight: 1.55,
                                        marginTop: 6,
                                    }}
                                >
                                    La idea es que Turnits no solo gestione
                                    reservas: también te muestre qué está
                                    funcionando y qué podés mejorar.
                                </div>
                            </div>
                            <div style={{ marginTop: 14 }}>
                                <TurnitsDashboard_ReferralCard
                                    accentColor={accentColor}
                                    baseUrl={baseUrl}
                                    icono={referidosPlusIcono}
                                />
                            </div>
                        </>
                    )}
                </div>
            </motion.aside>
        </AnimatePresence>
    )
}

function TurnitsDashboard_Fetch({
    baseUrl,
    accentColor,
    onData,
    isMobile,
    onOpenPanel,
    onNavigate,
    referidosPromoBg,
    referidosPromoBgDesde,
    referidosPromoBgHasta,
    logroPrimerTurno,
    logroDiezClientes,
    logroCincuentaTurnos,
    logroVeinteTurnos,
    logroClienteFrecuente,
    logroDiaFull,
    logroSemanaCompleta,
    logroAfiliados,
    logroFacturacion,
    ilustracionProximosTurnosVacio,
    ilustracionRendimientoVacio,
}: any) {
    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            const mock = {
                turnosMes: 24,
                turnosMesAnterior: 20,
                turnosHoy: 3,
                totalClientes: 67,
                clientesNuevos: 8,
                clientesNuevosMesAnterior: 6,
                clientesRecurrentes: 31,
                clientesFrecuentes: 12,
                logros: {
                    turnosHistoricos: 58,
                    clientesFieles: 4,
                    maxTurnosPorDia: 7,
                    diasSemanaConTurno: 6,
                    facturacionHistorica: 410000,
                    facturacionMeta: 600000,
                    programaAfiliadosCompleto: false,
                },
                ventas: {
                    volumenMes: 184500,
                    ticketPromedio: 7690,
                    cantidadTotal: 67,
                },
                chartData: [
                    { label: "Sem 1", turnos: 5 },
                    { label: "Sem 2", turnos: 7 },
                    { label: "Sem 3", turnos: 6 },
                    { label: "Sem 4", turnos: 6 },
                ],
                ventasPorDia: {},
                turnosLista: [],
            }
            setStats(mock)
            onData?.(mock)
            setLoading(false)
            return
        }
        let timer: any = null
        let interval: any = null
        let cancelled = false
        let tries = 0
        const api = String(baseUrl).replace(/\/+$/, "")
        const load = async () => {
            const slug = TurnitsDashboard_getSlug()
            const token = TurnitsDashboard_getToken()
            if (!slug || !token) {
                if (tries++ < 12) {
                    timer = setTimeout(load, 300)
                    return
                }
                if (!cancelled) {
                    setError("No se pudo identificar la sesión.")
                    setLoading(false)
                }
                return
            }
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401)
                    throw new Error("Sesión expirada. Volvé a iniciar sesión.")
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                if (!data || data.turnosMes === undefined)
                    throw new Error("Respuesta inesperada del servidor.")
                if (cancelled) return
                setStats(data)
                setError("")
                setLoading(false)
                onData?.(data)
            } catch (e: any) {
                if (cancelled) return
                setError(e?.message || "Error de conexión.")
                setLoading(false)
            }
        }
        load()
        interval = setInterval(load, 30000)
        const refresh = () => {
            if (document.visibilityState !== "hidden") load()
        }
        window.addEventListener("turno_cancelado", refresh)
        window.addEventListener("turno_actualizado", refresh)
        window.addEventListener("pageshow", refresh)
        window.addEventListener("focus", refresh)
        document.addEventListener("visibilitychange", refresh)
        return () => {
            cancelled = true
            if (timer) clearTimeout(timer)
            if (interval) clearInterval(interval)
            window.removeEventListener("turno_cancelado", refresh)
            window.removeEventListener("turno_actualizado", refresh)
            window.removeEventListener("pageshow", refresh)
            window.removeEventListener("focus", refresh)
            document.removeEventListener("visibilitychange", refresh)
        }
    }, [baseUrl])
    if (loading || !stats)
        return <TurnitsDashboard_Loading accentColor={accentColor} />
    if (error) return <TurnitsDashboard_Error error={error} />
    return (
        <TurnitsDashboard_Content
            stats={stats}
            accentColor={accentColor}
            onData={onData}
            isMobile={isMobile}
            onOpenPanel={onOpenPanel}
            onNavigate={onNavigate}
            referidosPromoBg={referidosPromoBg}
            referidosPromoBgDesde={referidosPromoBgDesde}
            referidosPromoBgHasta={referidosPromoBgHasta}
            baseUrl={baseUrl}
            logroPrimerTurno={logroPrimerTurno}
            logroDiezClientes={logroDiezClientes}
            logroCincuentaTurnos={logroCincuentaTurnos}
            logroVeinteTurnos={logroVeinteTurnos}
            logroClienteFrecuente={logroClienteFrecuente}
            logroDiaFull={logroDiaFull}
            logroSemanaCompleta={logroSemanaCompleta}
            logroAfiliados={logroAfiliados}
            logroFacturacion={logroFacturacion}
            ilustracionProximosTurnosVacio={ilustracionProximosTurnosVacio}
            ilustracionRendimientoVacio={ilustracionRendimientoVacio}
        />
    )
}

function TurnitsDashboard_Loading({ accentColor }: any) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
                style={{
                    height: 70,
                    borderRadius: 16,
                    background:
                        "linear-gradient(90deg,#f3f6f7 25%,#e9eef0 50%,#f3f6f7 75%)",
                    backgroundSize: "200% 100%",
                    animation: "turnitsDashboardShimmer 1.2s infinite",
                }}
            />
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                    gap: 12,
                }}
            >
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        style={{
                            height: 112,
                            borderRadius: 16,
                            background: "#fff",
                            border: "1px solid #edf1f3",
                        }}
                    />
                ))}
            </div>
            <div
                style={{
                    height: 320,
                    borderRadius: 16,
                    background: "#fff",
                    border: "1px solid #edf1f3",
                }}
            />
            <style>{`@keyframes turnitsDashboardShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
    )
}

function TurnitsDashboard_Error({ error }: any) {
    return (
        <div
            style={{
                minHeight: 320,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 24,
            }}
        >
            <div>
                <div
                    style={{ fontSize: 16, fontWeight: 750, color: "#111827" }}
                >
                    No pudimos cargar el resumen
                </div>
                <div style={{ marginTop: 6, fontSize: 12.5, color: "#64748b" }}>
                    {error}
                </div>
            </div>
        </div>
    )
}

function TurnitsDashboard_CopyAgendaLink({ accentColor }: any) {
    const [copiado, setCopiado] = React.useState(false)
    const handleCopy = async () => {
        if (copiado) return
        const slug = QrPanel_slug()
        if (!slug) return
        const url = `https://turnits.com/agenda/${slug}`
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
        setTimeout(() => setCopiado(false), 2000)
    }
    return (
        <div
            onClick={handleCopy}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                userSelect: "none",
            }}
        >
            <MercadoPagoConexion_LinkIcon size={14} />
            <div
                style={{
                    position: "relative",
                    display: "grid",
                    overflow: "hidden",
                    height: 18,
                }}
            >
                <span
                    style={{
                        gridArea: "1 / 1",
                        display: "flex",
                        alignItems: "center",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "#334155",
                        whiteSpace: "nowrap",
                        transition: "opacity 0.25s, transform 0.25s",
                        opacity: copiado ? 0 : 1,
                        transform: copiado
                            ? "translateY(-8px)"
                            : "translateY(0)",
                        pointerEvents: copiado ? "none" : "auto",
                    }}
                >
                    Copiar link de tu agenda
                </span>
                <span
                    style={{
                        gridArea: "1 / 1",
                        display: "flex",
                        alignItems: "center",
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: accentColor,
                        whiteSpace: "nowrap",
                        transition: "opacity 0.25s, transform 0.25s",
                        opacity: copiado ? 1 : 0,
                        transform: copiado
                            ? "translateY(0)"
                            : "translateY(8px)",
                        pointerEvents: copiado ? "auto" : "none",
                    }}
                >
                    ¡Copiado!
                </span>
            </div>
        </div>
    )
}

function TurnitsDashboard_Content({
    stats,
    accentColor,
    isMobile,
    onOpenPanel,
    onNavigate,
    referidosPromoBg,
    referidosPromoBgDesde,
    referidosPromoBgHasta,
    baseUrl,
    logroPrimerTurno,
    logroDiezClientes,
    logroCincuentaTurnos,
    logroVeinteTurnos,
    logroClienteFrecuente,
    logroDiaFull,
    logroSemanaCompleta,
    logroAfiliados,
    logroFacturacion,
    ilustracionProximosTurnosVacio,
    ilustracionRendimientoVacio,
}: any) {
    const turnos = Number(stats?.turnosMes || 0)
    const prevTurnos = Number(stats?.turnosMesAnterior || 0)
    const ingresos = Number(stats?.ventas?.volumenMes || 0)
    const nuevos = Number(stats?.clientesNuevos || 0)
    const comparativaMes = stats?.comparativas?.mes
    const tramoActual = comparativaMes?.actual
    const tramoAnterior = comparativaMes?.anterior
    const turnosActuales = Number(tramoActual?.turnos ?? turnos)
    const turnosAnteriores = Number(tramoAnterior?.turnos ?? prevTurnos)
    const ingresosActuales = Number(tramoActual?.ingresos ?? ingresos)
    const ingresosAnteriores =
        tramoAnterior?.ingresos == null ? null : Number(tramoAnterior.ingresos)
    const clientesActuales = Number(tramoActual?.clientes_nuevos ?? nuevos)
    const clientesAnteriores = Number(
        tramoAnterior?.clientes_nuevos ?? stats?.clientesNuevosMesAnterior ?? 0
    )
    const ticketActual =
        turnosActuales > 0 ? ingresosActuales / turnosActuales : 0
    const ticketAnterior =
        ingresosAnteriores != null && turnosAnteriores > 0
            ? ingresosAnteriores / turnosAnteriores
            : null
    const metricCardMobile: React.CSSProperties | undefined = isMobile
        ? {
              flex: "0 0 auto",
              width: "min(236px, 72vw)",
              scrollSnapAlign: "start",
              padding: "20px 20px 18px",
          }
        : undefined
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                maxWidth: 1480,
                margin: "0 auto",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    gap: 16,
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 12.5,
                            color: "#64748b",
                            fontWeight: 600,
                        }}
                    >
                        Resumen del negocio
                    </div>
                    <h1
                        style={{
                            margin: "4px 0 0",
                            fontSize: isMobile ? 25 : 30,
                            lineHeight: 1.08,
                            letterSpacing: "-1.2px",
                            fontWeight: 780,
                            color: "#111827",
                        }}
                    >
                        Balance
                    </h1>
                    <div
                        style={{
                            marginTop: 6,
                            fontSize: 12.5,
                            color: "#94a3b8",
                        }}
                    >
                        Actividad reciente y métricas importantes para tomar
                        decisiones.
                    </div>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        flexWrap: "wrap",
                    }}
                >
                    <TurnitsDashboard_CopyAgendaLink
                        accentColor={accentColor}
                    />
                </div>
            </div>

            <style>{`.tn-hscroll{scrollbar-width:none;-ms-overflow-style:none}.tn-hscroll::-webkit-scrollbar{display:none}`}</style>
            <div
                className="tn-hscroll"
                data-lenis-prevent="true"
                style={
                    isMobile
                        ? {
                              // Mobile: una fila que se desliza hacia el
                              // costado. Cada tarjeta tiene su ancho y aire,
                              // y la siguiente asoma para que se note el scroll.
                              display: "flex",
                              gap: 12,
                              overflowX: "auto",
                              overflowY: "hidden",
                              WebkitOverflowScrolling: "touch",
                              scrollSnapType: "x mandatory",
                              scrollPaddingLeft: 16,
                              margin: "0 -16px",
                              padding: "2px 16px 8px",
                              overscrollBehaviorX: "contain",
                          }
                        : {
                              display: "grid",
                              gridTemplateColumns: "repeat(4,minmax(0,1fr))",
                              gap: 12,
                          }
                }
            >
                <TurnitsDashboard_MetricCard
                    cardStyle={metricCardMobile}
                    label="Turnos"
                    value={turnosActuales}
                    trend={TurnitsDashboard_percent(
                        turnosActuales,
                        turnosAnteriores
                    )}
                />
                <TurnitsDashboard_MetricCard
                    cardStyle={metricCardMobile}
                    label="Ingresos"
                    value={TurnitsDashboard_shortMoney(ingresosActuales)}
                    trend={
                        ingresosAnteriores == null
                            ? null
                            : TurnitsDashboard_percent(
                                  ingresosActuales,
                                  ingresosAnteriores
                              )
                    }
                />
                <TurnitsDashboard_MetricCard
                    cardStyle={metricCardMobile}
                    label="Clientes"
                    value={clientesActuales}
                    trend={TurnitsDashboard_percent(
                        clientesActuales,
                        clientesAnteriores
                    )}
                />
                <TurnitsDashboard_MetricCard
                    cardStyle={metricCardMobile}
                    label="Ticket promedio"
                    value={TurnitsDashboard_shortMoney(ticketActual)}
                    trend={
                        ticketAnterior == null
                            ? null
                            : TurnitsDashboard_percent(
                                  ticketActual,
                                  ticketAnterior
                              )
                    }
                />
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                        ? "1fr"
                        : "minmax(0,1.55fr) minmax(320px,.8fr)",
                    gap: 12,
                }}
            >
                <TurnitsDashboard_Chart
                    stats={stats}
                    accentColor={accentColor}
                />
                <TurnitsDashboard_Upcoming
                    stats={stats}
                    accentColor={accentColor}
                    onNavigate={onNavigate}
                    ilustracionVacia={ilustracionProximosTurnosVacio}
                />
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                        ? "1fr"
                        : "minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)",
                    gap: 12,
                }}
            >
                <TurnitsDashboard_BusinessMetrics
                    stats={stats}
                    accentColor={accentColor}
                />
                <TurnitsDashboard_ReferralPromo
                    accentColor={accentColor}
                    isMobile={isMobile}
                    backgroundImage={referidosPromoBg}
                    colorDesde={referidosPromoBgDesde}
                    colorHasta={referidosPromoBgHasta}
                    onOpenPanel={onOpenPanel}
                />
                <TurnitsDashboard_RecentClients stats={stats} />
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                        ? "1fr"
                        : "minmax(0,1.55fr) minmax(300px,.8fr)",
                    gap: 12,
                }}
            >
                <RendimientoEquipo
                    baseUrl={baseUrl}
                    accentColor={accentColor}
                    variant="resumen"
                    ilustracionVacia={ilustracionRendimientoVacio}
                />
                <TurnitsDashboard_Achievements
                    stats={stats}
                    accentColor={accentColor}
                    logroPrimerTurno={logroPrimerTurno}
                    logroDiezClientes={logroDiezClientes}
                    logroCincuentaTurnos={logroCincuentaTurnos}
                    logroVeinteTurnos={logroVeinteTurnos}
                    logroClienteFrecuente={logroClienteFrecuente}
                    logroDiaFull={logroDiaFull}
                    logroSemanaCompleta={logroSemanaCompleta}
                    logroAfiliados={logroAfiliados}
                    logroFacturacion={logroFacturacion}
                />
            </div>

            <TurnitsDashboard_WeeklySummary
                stats={stats}
                accentColor={accentColor}
            />

            <TurnitsDashboard_ServicesMostRequested
                stats={stats}
                accentColor={accentColor}
                isMobile={isMobile}
            />
        </div>
    )
}

function SeccionInicio({
    baseUrl,
    accentColor,
    isMobile,
    iconos,
    onOpenPanel,
    onNavigate,
    referidosPromoBg,
    referidosPromoBgDesde,
    referidosPromoBgHasta,
    logroPrimerTurno,
    logroDiezClientes,
    logroCincuentaTurnos,
    logroVeinteTurnos,
    logroClienteFrecuente,
    logroDiaFull,
    logroSemanaCompleta,
    logroAfiliados,
    logroFacturacion,
    ilustracionProximosTurnosVacio,
    ilustracionRendimientoVacio,
}: any) {
    return (
        <TurnitsDashboard_Fetch
            baseUrl={baseUrl}
            accentColor={accentColor}
            isMobile={isMobile}
            onOpenPanel={onOpenPanel}
            onNavigate={onNavigate}
            referidosPromoBg={referidosPromoBg}
            referidosPromoBgDesde={referidosPromoBgDesde}
            referidosPromoBgHasta={referidosPromoBgHasta}
            logroPrimerTurno={logroPrimerTurno}
            logroDiezClientes={logroDiezClientes}
            logroCincuentaTurnos={logroCincuentaTurnos}
            logroVeinteTurnos={logroVeinteTurnos}
            logroClienteFrecuente={logroClienteFrecuente}
            logroDiaFull={logroDiaFull}
            logroSemanaCompleta={logroSemanaCompleta}
            logroAfiliados={logroAfiliados}
            logroFacturacion={logroFacturacion}
            ilustracionProximosTurnosVacio={ilustracionProximosTurnosVacio}
            ilustracionRendimientoVacio={ilustracionRendimientoVacio}
        />
    )
}

export { TurnitsDashboard_MetricCard, TurnitsDashboard_Sparkline, TurnitsDashboard_Chart, TurnitsDashboard_Upcoming, TurnitsDashboard_ServicesMostRequested, TurnitsDashboard_BusinessMetrics, TurnitsDashboard_ReferralPromo, TurnitsDashboard_RecentClients, TurnitsDashboard_WeeklySummary, TurnitsDashboard_ReferralCard, TurnitsDashboard_Achievements, TurnitsDashboardSidePanel, TurnitsDashboard_Fetch, TurnitsDashboard_Loading, TurnitsDashboard_Error, TurnitsDashboard_CopyAgendaLink, TurnitsDashboard_Content, SeccionInicio }
