import { appConfig } from "../../config"
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
import { ClientesGrid_useContainerWidth, ClientesGrid_getColumnas, ClientesGrid_buildClientes, ClientesGrid_getSlug, ClientesGrid_getToken, ClientesGrid_wrapperBase, ClientesGrid_MOCK_CLIENTES, ClientesGrid_shimmerCSS, ClientesGrid_frecuenciaLabel, TurnitsLockedStyle, ClientesGrid_frecuenciaColor } from "./common"
import { TurnitsPlanRequirement } from "./shared"

function ClientesGrid(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        columnas = 4,
        porPagina = 12,
        style,
    } = props

    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = ClientesGrid_useContainerWidth(containerRef)
    const colsActivas = ClientesGrid_getColumnas(containerWidth, columnas)
    const isMobile = containerWidth < 500

    const [clientes, setClientes] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [visibles, setVisibles] = React.useState(porPagina)
    const [plan, setPlan] = React.useState<"gratis" | "basico" | "premium">("gratis")

    const esPremium = plan !== "gratis"
    const limiteClientes = plan === "premium" ? Infinity : plan === "basico" ? 50 : 10
    // Gratis: solo los 10 más recientes. Básico: todos.
    const clientesFiltrados = clientes.slice(0, limiteClientes)

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }
        const api = baseUrl.replace(/\/+$/, "")
        let retries = 0
        let retryTimer: ReturnType<typeof setTimeout> | null = null

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada.")
                    setLoading(false)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                setPlan(
                    ["basico", "premium"].includes(
                        result?.plan || result?.config?.plan
                    )
                        ? (result?.plan || result?.config?.plan)
                        : "gratis"
                )
                setClientes(
                    ClientesGrid_buildClientes(result?.turnosLista || [])
                )
                setError("")
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = ClientesGrid_getSlug()
            const token = ClientesGrid_getToken()
            if (slug && token) {
                fetchData(slug, token)
                return
            }
            if (++retries >= 10) {
                setError(!slug ? "Falta ?u=slug en la URL." : "Sin sesión.")
                setLoading(false)
                return
            }
            retryTimer = setTimeout(tryInit, 300)
        }
        tryInit()
        return () => {
            if (retryTimer) clearTimeout(retryTimer)
        }
    }, [baseUrl])

    React.useEffect(() => {
        setVisibles(porPagina)
    }, [porPagina])

    if (false) {
        return (
            <div
                ref={containerRef}
                style={{ ...ClientesGrid_wrapperBase, ...style }}
            >
                <ClientesGrid_Shell
                    clientes={ClientesGrid_MOCK_CLIENTES}
                    visibles={porPagina}
                    colsActivas={colsActivas}
                    accentColor={accentColor}
                    isMobile={isMobile}
                    esPremium={true}
                    totalReal={ClientesGrid_MOCK_CLIENTES.length}
                    onVerMas={() => {}}
                />
                <style>{ClientesGrid_shimmerCSS}</style>
            </div>
        )
    }

    if (loading) {
        return (
            <div
                ref={containerRef}
                style={{ ...ClientesGrid_wrapperBase, ...style }}
            >
                <ClientesGrid_SkeletonGrid
                    columnas={colsActivas}
                    isMobile={isMobile}
                />
                <style>{ClientesGrid_shimmerCSS}</style>
            </div>
        )
    }

    if (error) {
        return (
            <div
                ref={containerRef}
                style={{
                    ...ClientesGrid_wrapperBase,
                    ...style,
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 200,
                }}
            >
                <span style={{ fontSize: 13, color: "#ef4444" }}>{error}</span>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            style={{ ...ClientesGrid_wrapperBase, ...style }}
        >
            <ClientesGrid_Shell
                clientes={clientesFiltrados}
                visibles={visibles}
                colsActivas={colsActivas}
                accentColor={accentColor}
                isMobile={isMobile}
                esPremium={esPremium}
                totalReal={clientes.length}
                limiteClientes={limiteClientes}
                plan={plan}
                onVerMas={() => setVisibles((v) => v + porPagina)}
            />
            <style>{ClientesGrid_shimmerCSS}</style>
        </div>
    )
}

function ClientesGrid_Shell({
    clientes,
    visibles,
    colsActivas,
    accentColor,
    isMobile,
    esPremium,
    totalReal,
    limiteClientes = 10,
    plan = "gratis",
    onVerMas,
}: any) {
    const slice = clientes.slice(0, visibles)
    const hayMas = esPremium && visibles < clientes.length

    const concurrentes = clientes.filter(
        (c: any) => ClientesGrid_frecuenciaLabel(c.turnos) === "Concurrente"
    ).length
    const regulares = clientes.filter(
        (c: any) => ClientesGrid_frecuenciaLabel(c.turnos) === "Regular"
    ).length
    const esporadicos = clientes.filter(
        (c: any) => ClientesGrid_frecuenciaLabel(c.turnos) === "Irregular"
    ).length

    const totalCeldas = slice.length + (hayMas ? 1 : 0)
    const filas = Math.ceil(totalCeldas / colsActivas)
    const celdas = filas * colsActivas
    const vacias = celdas - slice.length - (hayMas ? 1 : 0)

    return (
        <>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    alignItems: isMobile ? "flex-start" : "center",
                    marginBottom: isMobile ? 12 : 16,
                    gap: isMobile ? 8 : 6,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                    }}
                >
                    <span
                        style={{
                            fontSize: isMobile ? 11 : 12,
                            color: "#94a3b8",
                        }}
                    >
                        {esPremium
                            ? `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""} únicos`
                            : `Últimos ${clientes.length} clientes`}
                    </span>
                    {totalReal > limiteClientes && <span style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:10,color:"#64748b"}}><span>+{totalReal - limiteClientes} clientes</span><TurnitsPlanRequirement premiumOnly={plan === "basico"} /></span>}
                </div>

                {/* Badges frecuencia — solo premium */}
                {esPremium && (
                    <div
                        style={{
                            display: "flex",
                            gap: isMobile ? 4 : 6,
                            flexWrap: "wrap",
                        }}
                    >
                        <ClientesGrid_FrecBadge
                            label={isMobile ? "Conc." : "Concurrentes"}
                            count={concurrentes}
                            color={accentColor}
                            isMobile={isMobile}
                        />
                        <ClientesGrid_FrecBadge
                            label={isMobile ? "Reg." : "Regulares"}
                            count={regulares}
                            color="#f59e0b"
                            isMobile={isMobile}
                        />
                        <ClientesGrid_FrecBadge
                            label={isMobile ? "Irreg." : "Irregulares"}
                            count={esporadicos}
                            color="#94a3b8"
                            isMobile={isMobile}
                        />
                    </div>
                )}
            </div>

            {/* GRILLA */}
            {clientes.length === 0 ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "40px 0",
                        color: "#cbd5e1",
                        fontSize: 13,
                    }}
                >
                    Aún no hay clientes registrados.
                </div>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${colsActivas}, minmax(0, 1fr))`,
                        border: "1px solid #f1f5f9",
                        borderRadius: isMobile ? 12 : 16,
                        overflow: "hidden",
                    }}
                >
                    <AnimatePresence>
                        {slice.map((c: any, i: number) => (
                            <ClientesGrid_ClienteCell
                                key={`${c.telefono || c.email}-${i}`}
                                cliente={c}
                                accentColor={accentColor}
                                index={i}
                                columnas={colsActivas}
                                isMobile={isMobile}
                                esPremium={esPremium}
                            />
                        ))}
                    </AnimatePresence>

                    {/* Ver más — solo premium */}
                    {hayMas && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={onVerMas}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: accentColor,
                                cursor: "pointer",
                                minHeight: isMobile ? 80 : 110,
                                borderLeft: `1px solid ${accentColor}`,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: isMobile ? 12 : 14,
                                    fontWeight: 700,
                                    color: "#fff",
                                    letterSpacing: "-0.2px",
                                }}
                            >
                                Ver más
                            </span>
                        </motion.div>
                    )}

                    {/* Celda upgrade — gratis con más clientes ocultos */}
                    {totalReal > limiteClientes && (
                        <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f8fafc",borderLeft:"1px solid #e5e7eb",borderTop:slice.length >= colsActivas ? "1px solid #e5e7eb" : "none",minHeight:isMobile ? 100 : 110,padding:"36px 8px 10px",...TurnitsLockedStyle}}>
                            <span style={{position:"absolute",top:10,right:10}}><TurnitsPlanRequirement premiumOnly={plan === "basico"} /></span>
                            <span style={{fontSize:isMobile ? 10 : 12,fontWeight:700,color:"#64748b",textAlign:"center",lineHeight:1.4}}>{totalReal - limiteClientes} clientes más</span>
                        </div>
                    )}

                    {Array.from({
                        length:
                            vacias > 0
                                ? vacias -
                                  (totalReal > limiteClientes
                                      ? 1
                                      : 0)
                                : 0,
                    }).map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            style={{
                                background: "#fff",
                                borderLeft: "1px solid #f1f5f9",
                                borderTop: "1px solid #f1f5f9",
                                minHeight: isMobile ? 80 : 110,
                            }}
                        />
                    ))}
                </div>
            )}
        </>
    )
}

function ClientesGrid_ClienteCell({
    cliente,
    accentColor,
    index,
    columnas,
    isMobile,
    esPremium,
}: any) {
    const col = index % columnas
    const fila = Math.floor(index / columnas)
    const frec = ClientesGrid_frecuenciaLabel(cliente.turnos)
    const color = ClientesGrid_frecuenciaColor(frec, accentColor)
    const nombreCompleto = [cliente.nombre, cliente.apellido]
        .filter(Boolean)
        .join(" ")
    const inicial = (cliente.nombre || "?")[0].toUpperCase()
    const avatarSize = isMobile ? 28 : 34

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
                delay: Math.min(index * 0.025, 0.35),
                duration: 0.22,
            }}
            style={{
                padding: isMobile ? "12px 8px" : "16px 14px",
                borderLeft: col > 0 ? "1px solid #f1f5f9" : "none",
                borderTop: fila > 0 ? "1px solid #f1f5f9" : "none",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: isMobile ? 2 : 3,
                minHeight: isMobile ? 80 : 110,
                justifyContent: "center",
            }}
        >
            {/* Avatar */}
            <div
                style={{
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: "50%",
                    background: `${accentColor}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: isMobile ? 3 : 5,
                    flexShrink: 0,
                }}
            >
                <span
                    style={{
                        fontSize: isMobile ? 11 : 13,
                        fontWeight: 700,
                        color: accentColor,
                    }}
                >
                    {inicial}
                </span>
            </div>

            {/* Nombre */}
            <div
                style={{
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: 700,
                    color: "#0f172a",
                    letterSpacing: "-0.2px",
                    lineHeight: 1.2,
                    wordBreak: "break-word",
                    maxWidth: "100%",
                }}
            >
                {nombreCompleto || "—"}
            </div>

            {/* Email — solo desktop y premium */}
            {cliente.email && !isMobile && esPremium && (
                <div
                    style={{
                        fontSize: 9,
                        color: "#94a3b8",
                        wordBreak: "break-all",
                        lineHeight: 1.3,
                    }}
                >
                    {cliente.email}
                </div>
            )}

            {/* Teléfono — solo premium */}
            {cliente.telefono && esPremium && (
                <div
                    style={{
                        fontSize: isMobile ? 9 : 10,
                        color: "#64748b",
                        fontWeight: 500,
                    }}
                >
                    +{cliente.telefono}
                </div>
            )}

            {/* Frecuencia — solo premium */}
            {esPremium && (
                <div
                    style={{
                        marginTop: isMobile ? 2 : 4,
                        fontSize: isMobile ? 9 : 10,
                        fontWeight: 600,
                        color,
                        letterSpacing: "0.01em",
                    }}
                >
                    {frec}
                </div>
            )}

            {/* Turnos */}
            <div style={{ fontSize: 9, color: "#cbd5e1", marginTop: 1 }}>
                {cliente.turnos} turno{cliente.turnos !== 1 ? "s" : ""}
            </div>
        </motion.div>
    )
}

function ClientesGrid_FrecBadge({ label, count, color, isMobile }: any) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: isMobile ? "3px 6px" : "3px 8px",
                borderRadius: 20,
                background: `${color}10`,
            }}
        >
            <div
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                }}
            />
            <span
                style={{
                    fontSize: isMobile ? 9 : 10,
                    fontWeight: 600,
                    color,
                    whiteSpace: "nowrap",
                }}
            >
                {count} {label}
            </span>
        </div>
    )
}

function ClientesGrid_SkeletonGrid({ columnas, isMobile }: any) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div
                style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    justifyContent: "space-between",
                    marginBottom: isMobile ? 12 : 16,
                    gap: isMobile ? 8 : 0,
                }}
            >
                <ClientesGrid_Skel width={130} height={12} />
                <div style={{ display: "flex", gap: 6 }}>
                    <ClientesGrid_Skel
                        width={isMobile ? 60 : 90}
                        height={24}
                        style={{ borderRadius: 20 }}
                    />
                    <ClientesGrid_Skel
                        width={isMobile ? 54 : 80}
                        height={24}
                        style={{ borderRadius: 20 }}
                    />
                    <ClientesGrid_Skel
                        width={isMobile ? 58 : 85}
                        height={24}
                        style={{ borderRadius: 20 }}
                    />
                </div>
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
                    border: "1px solid #f1f5f9",
                    borderRadius: isMobile ? 12 : 16,
                    overflow: "hidden",
                }}
            >
                {Array.from({ length: columnas * 3 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            padding: isMobile ? "12px 8px" : "16px 14px",
                            borderLeft:
                                i % columnas > 0 ? "1px solid #f1f5f9" : "none",
                            borderTop:
                                i >= columnas ? "1px solid #f1f5f9" : "none",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            minHeight: isMobile ? 80 : 110,
                            justifyContent: "center",
                        }}
                    >
                        <ClientesGrid_Skel
                            width={isMobile ? 28 : 34}
                            height={isMobile ? 28 : 34}
                            style={{ borderRadius: "50%" }}
                        />
                        <ClientesGrid_Skel
                            width="65%"
                            height={isMobile ? 10 : 12}
                        />
                        {!isMobile && (
                            <ClientesGrid_Skel width="85%" height={9} />
                        )}
                        <ClientesGrid_Skel width="50%" height={10} />
                        <ClientesGrid_Skel width="45%" height={10} />
                    </div>
                ))}
            </div>
        </div>
    )
}

function ClientesGrid_Skel({ width, height, style = {} }: any) {
    return (
        <div
            style={{
                width,
                height,
                borderRadius: 6,
                background:
                    "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
                ...style,
            }}
        />
    )
}

export { ClientesGrid, ClientesGrid_Shell, ClientesGrid_ClienteCell, ClientesGrid_FrecBadge, ClientesGrid_SkeletonGrid, ClientesGrid_Skel }
