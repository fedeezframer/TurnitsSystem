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
import { safeLocalStorage, UserGreeting_textStyle, PlanEstado_getSlug, PlanEstado_esperar, PlanEstado_getStatusPago, PlanEstado_limpiarStatusPago, PlanEstado_DIAS_PARA_RENOVAR, PlanEstado_MOCK, BotonNotificaciones_Props, BotonNotificaciones_useNoLeidas, BotonNotificaciones_scrollToTop, BotonNotificaciones_API_BASE_URL_DEFAULT, NotificacionesPanel_Props, NotificacionesPanel_Notificacion, NotificacionesPanel_EstadoPush, NotificacionesPanel_getSlugFromUrl, NotificacionesPanel_decodeJWT, NotificacionesPanel_observarVisibles, NotificacionesPanel_normalizarTipo, NotificacionesPanel_SECCION_POR_TIPO, NotificacionesPanel_esIOS, NotificacionesPanel_esStandalone, NotificacionesPanel_urlBase64ToUint8Array, NotificacionesPanel_TIPO_CONFIG, NotificacionesPanel_tiempoRelativo, TurnosHoy_getSlug, TurnosHoy_getToken, TurnosHoy_MOCK, TurnosHoy_useBreakpoint, TurnosHoy_makeCardBase, TurnosHoy_shimmerCSS, TurnosHoy_makeTitleStyle, TurnosHoy_getMinutosArg, TurnosHoy_makeSectionTitle, TurnosHoy_makeBtnAgenda, RendimientoEquipo_useBreakpoint, RendimientoEquipo_getSlug, RendimientoEquipo_getToken, RendimientoEquipo_MOCK, RendimientoEquipo_makeCardBase, RendimientoEquipo_shimmerCSS, RendimientoEquipo_makeTitleStyle, RendimientoEquipo_PERIODOS, TurnitsDashboard_money, IngresosEstimados_getSlug, IngresosEstimados_getToken, IngresosEstimados_MOCK_STATS, IngresosEstimados_useBreakpoint, IngresosEstimados_makeCardBase, IngresosEstimados_shimmerCSS, IngresosEstimados_makeTitleStyle, IngresosEstimados_calcularIngresos, IngresosEstimados_calcularIngresosHoy, IngresosEstimados_buildUltimos7, IngresosEstimados_formatCurrency, IngresosEstimados_formatFull, IngresosEstimados_makeSectionTitle, TurnosMes_getSlug, TurnosMes_getToken, TurnosMes_MOCK_STATS, TurnosMes_useBreakpoint, TurnosMes_makeCardBase, TurnosMes_shimmerCSS, TurnosMes_makeTitleStyle, ClientesCard_getSlug, ClientesCard_getToken, ClientesCard_MOCK_STATS, ClientesCard_useBreakpoint, ClientesCard_makeCardBase, ClientesCard_shimmerCSS, ClientesCard_makeTitleStyle, MejoresDias_getSlug, MejoresDias_getToken, MejoresDias_MOCK_STATS, MejoresDias_useBreakpoint, MejoresDias_makeCardBase, MejoresDias_shimmerCSS, MejoresDias_makeTitleStyle, MejoresDias_calcularRanking, MejoresDias_DIAS_LABEL, TopServicios_ServicioData, TopServicios_procesarTurnos, TopServicios_MOCK_TURNOS, TopServicios_getSlug, TopServicios_getToken, TopServicios_useBreakpoint, TopServicios_makeCardBase, TopServicios_shimmerCSS, TopServicios_makeTitleStyle, HorasTrabajadas_getSlug, HorasTrabajadas_getToken, HorasTrabajadas_MOCK_STATS, HorasTrabajadas_useBreakpoint, HorasTrabajadas_makeCardBase, HorasTrabajadas_shimmerCSS, HorasTrabajadas_makeTitleStyle, HorasTrabajadas_diasUnicos, HorasTrabajadas_minutosATexto, HorasTrabajadas_makeSectionTitle } from "./common"
import { TurnitsPlanIcon, TurnitsPlanRequirement } from "./shared"

function UploadPlaceholderIcon({ size = 24 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M7 18h9.5a4 4 0 0 0 .58-7.96 5.5 5.5 0 0 0-10.6-1.98A4.5 4.5 0 0 0 7 18Z" />
            <path d="M12 9.5v7.5" />
            <path d="M9.25 12.25 12 9.5l2.75 2.75" />
        </svg>
    )
}

function CopyTurnosLink(props) {
    const { customIcon, accentColor, successText, urlColor, linkLabel } = props
    const [copied, setCopied] = useState(false)

    const baseUrl = "https://turnits.com/agenda/"

    const currentSlug = React.useMemo(() => {
        if (typeof window === "undefined") return "usuario"
        try {
            const m = (window.location.pathname || "").match(
                /\/panel(?:-test)?\/([^\/?#]+)/i
            )
            if (m && m[1]) return decodeURIComponent(m[1]).toLowerCase()
        } catch {}
        const urlParams = new URLSearchParams(window.location.search)
        const uParam = urlParams.get("u")
        if (uParam) return uParam.toLowerCase()
        return localStorage.getItem("user_slug") || "usuario"
    }, [])

    const fullUrl = `${baseUrl}${currentSlug}`

    const handleCopy = async () => {
        if (copied) return
        try {
            await navigator.clipboard.writeText(fullUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error("Error:", err)
        }
    }

    return (
        <div
            onClick={handleCopy}
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                cursor: "pointer",
                padding: "10px 0",
                width: "100%",
            }}
        >
            {customIcon && (
                <img
                    src={customIcon}
                    alt="copy icon"
                    style={{
                        width: 24,
                        height: 24,
                        objectFit: "contain",
                        flexShrink: 0,
                    }}
                />
            )}

            {/* Contenedor de texto con altura fija = una línea */}
            <div
                style={{
                    position: "relative",
                    overflow: "hidden",
                    height: "28px",
                    flex: 1,
                }}
            >
                {/* Texto normal */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        fontFamily:
                            "\'Inter Display\', -apple-system, sans-serif",
                        fontSize: 18,
                        fontWeight: 400,
                        color: urlColor,
                        whiteSpace: "nowrap",
                        transition: "opacity 0.3s, transform 0.3s",
                        opacity: copied ? 0 : 1,
                        transform: copied
                            ? "translateY(-8px)"
                            : "translateY(0)",
                        pointerEvents: copied ? "none" : "auto",
                    }}
                >
                    {linkLabel}
                </div>

                {/* Mensaje éxito */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        fontFamily:
                            "\'Inter Display\', -apple-system, sans-serif",
                        fontSize: 18,
                        fontWeight: 600,
                        letterSpacing: "0.5px",
                        color: accentColor,
                        whiteSpace: "nowrap",
                        transition: "opacity 0.3s, transform 0.3s",
                        opacity: copied ? 1 : 0,
                        transform: copied ? "translateY(0)" : "translateY(8px)",
                        pointerEvents: copied ? "auto" : "none",
                    }}
                >
                    {successText}
                </div>
            </div>
        </div>
    )
}

function CopyTurnosButton(props) {
    const { customIcon, checkIcon, accentColor, successText, urlColor, size } =
        props
    const [copied, setCopied] = useState(false)

    const baseUrl = "https://turnits.com/agenda/"

    const currentSlug = React.useMemo(() => {
        if (typeof window === "undefined") return "usuario"
        try {
            const m = (window.location.pathname || "").match(
                /\/panel(?:-test)?\/([^\/?#]+)/i
            )
            if (m && m[1]) return decodeURIComponent(m[1]).toLowerCase()
        } catch {}
        const urlParams = new URLSearchParams(window.location.search)
        const uParam = urlParams.get("u")
        if (uParam) return uParam.toLowerCase()
        return localStorage.getItem("user_slug") || "usuario"
    }, [])

    const fullUrl = `${baseUrl}${currentSlug}`

    const handleCopy = async () => {
        if (copied) return
        try {
            await navigator.clipboard.writeText(fullUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch (err) {
            console.error("Error:", err)
        }
    }

    const iconSize = size * 0.45

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: size,
            }}
        >
            {/* Tooltip arriba */}
            <div
                style={{
                    position: "absolute",
                    bottom: size + 10,
                    left: "50%",
                    transform: copied
                        ? "translateX(-50%) translateY(0)"
                        : "translateX(-50%) translateY(6px)",
                    backgroundColor: accentColor,
                    color: "#fff",
                    fontFamily: "\'Inter Display\', -apple-system, sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    whiteSpace: "nowrap",
                    padding: "5px 12px",
                    borderRadius: 999,
                    opacity: copied ? 1 : 0,
                    transition: "opacity 0.25s, transform 0.25s",
                    pointerEvents: "none",
                }}
            >
                {successText}
                <div
                    style={{
                        position: "absolute",
                        bottom: -5,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 0,
                        height: 0,
                        borderLeft: "5px solid transparent",
                        borderRight: "5px solid transparent",
                        borderTop: `5px solid ${accentColor}`,
                    }}
                />
            </div>

            {/* Círculo botón */}
            <div
                onClick={handleCopy}
                style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    backgroundColor: urlColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    overflow: "hidden",
                    position: "relative",
                    WebkitTapHighlightColor: "transparent",
                }}
            >
                {/* Icono link — sube y desaparece.
                    Nota: al ser position:absolute, top/left + el translate(-50%,-50%)
                    de base son los que lo centran dentro del círculo; el
                    translateY extra sólo se suma arriba de ese centrado para
                    la animación. Antes faltaba ese centrado base y el ícono
                    quedaba pegado a la esquina superior izquierda (por eso
                    a veces "no se veía" — estaba ahí pero corrido). Si no
                    hay customIcon, se muestra un ícono de link por defecto
                    en vez de dejar el botón vacío. */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: iconSize,
                        height: iconSize,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        transition: "opacity 0.3s, transform 0.3s",
                        opacity: copied ? 0 : 1,
                        transform: copied
                            ? "translate(-50%, -50%) translateY(-14px)"
                            : "translate(-50%, -50%) translateY(0)",
                        pointerEvents: "none",
                    }}
                >
                    {customIcon ? (
                        <img
                            src={customIcon}
                            alt="copy icon"
                            style={{
                                width: iconSize,
                                height: iconSize,
                                objectFit: "contain",
                            }}
                        />
                    ) : (
                        <svg
                            width={iconSize}
                            height={iconSize}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" />
                            <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.42-1.42" />
                        </svg>
                    )}
                </div>

                {/* Icono check — sube desde abajo (mismo centrado base) */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        width: iconSize,
                        height: iconSize,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        transition: "opacity 0.3s, transform 0.3s",
                        opacity: copied ? 1 : 0,
                        transform: copied
                            ? "translate(-50%, -50%) translateY(0)"
                            : "translate(-50%, -50%) translateY(14px)",
                        pointerEvents: "none",
                    }}
                >
                    {checkIcon ? (
                        <img
                            src={checkIcon}
                            alt="check icon"
                            style={{
                                width: iconSize,
                                height: iconSize,
                                objectFit: "contain",
                            }}
                        />
                    ) : (
                        <svg
                            width={iconSize}
                            height={iconSize}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    )}
                </div>
            </div>
        </div>
    )
}

function UserGreeting(props) {
    const {
        baseUrl = appConfig.apiUrl,
        fontSize = 16,
        color = "#000000",
    } = props

    const [nombre, setNombre] = React.useState("")

    React.useEffect(() => {
        if (false) return

        const fetchNombre = async () => {
            const token = safeLocalStorage("access_token")
            const slug = safeLocalStorage("user_slug")
            if (!token || !slug) return

            try {
                const res = await fetch(
                    `${baseUrl.replace(/\/+$/, "")}/settings/${slug}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                )
                const data = await res.json()
                if (data.success && data.settings?.nombre_persona) {
                    setNombre(data.settings.nombre_persona)
                }
            } catch (e) {
                console.warn("[UserGreeting] Error:", e)
            }
        }

        fetchNombre()
    }, [baseUrl])

    if (false) {
        return (
            <div style={{ ...UserGreeting_textStyle, fontSize, color }}>
                Federico
            </div>
        )
    }

    return (
        <div style={{ ...UserGreeting_textStyle, fontSize, color }}>
            {nombre}
        </div>
    )
}

function PlanEstado(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        textColor = "#0f172a",
        mutedColor = "#64748b",
        warningColor = "#dc2626",
        style,
    } = props

    const [loading, setLoading] = React.useState(true)
    const [info, setInfo] = React.useState<any>(null)
    const [redirigiendo, setRedirigiendo] = React.useState(false)
    const [checkoutError, setCheckoutError] = React.useState("")
    const [aviso, setAviso] = React.useState("")

    const isCanvas = false
    const api = String(baseUrl).replace(/\/+$/, "")

    const cargarInfo = React.useCallback(async (): Promise<any> => {
        const slug = PlanEstado_getSlug()
        if (!slug) return null
        try {
            const res = await fetch(`${api}/renovacion/info/${slug}`, {
                cache: "no-cache",
            })
            const data = await res.json()
            if (data?.success) {
                setInfo(data)
                return data
            }
        } catch (e) {
            console.warn("[PlanEstado] No se pudo cargar el plan:", e)
        }
        return null
    }, [api])

    // Carga inicial + manejo de la vuelta desde Mercado Pago.
    React.useEffect(() => {
        if (isCanvas) {
            setLoading(false)
            return
        }
        let cancelado = false
        let avisoTimer: ReturnType<typeof setTimeout> | null = null

        const arrancar = async () => {
            // El slug puede tardar un instante en estar disponible tras el login.
            let data: any = null
            for (let i = 0; i < 10 && !cancelado; i++) {
                if (PlanEstado_getSlug()) {
                    data = await cargarInfo()
                    break
                }
                await PlanEstado_esperar(300)
            }
            if (cancelado) return
            setLoading(false)

            const status = PlanEstado_getStatusPago()
            if (!status) return
            PlanEstado_limpiarStatusPago()

            if (status === "cancel") {
                setAviso("El pago no se completó. Podés intentarlo de nuevo.")
                return
            }

            // status === "ok": el webhook de Mercado Pago puede tardar unos
            // segundos en sumar los días, así que consultamos hasta verlo.
            setAviso("¡Pago recibido! Estamos actualizando tu plan…")
            // Referencia "antes del pago". Si la lectura inicial falló
            // (data === null) se reintenta: sin referencia, el primer
            // chequeo daba un falso "¡Listo!" antes de que el webhook
            // sumara los días.
            let base = data
            for (let i = 0; i < 3 && !base && !cancelado; i++) {
                base = await cargarInfo()
                if (!base) await PlanEstado_esperar(1500)
            }
            if (cancelado) return
            const tieneBase = !!base
            const planAntes = base?.plan
            const diasAntes =
                typeof base?.dias_restantes === "number"
                    ? base.dias_restantes
                    : 0
            for (let i = 0; i < 12 && !cancelado; i++) {
                await PlanEstado_esperar(4000)
                const nueva = await cargarInfo()
                if (!nueva) continue
                const dn =
                    typeof nueva.dias_restantes === "number"
                        ? nueva.dias_restantes
                        : null
                const activo = nueva.plan === "basico" && !nueva.vencida
                // Con referencia: se compara contra el estado previo.
                // Sin referencia (no hubo forma de leerla): solo se da por
                // renovado si ya no está en zona de alerta.
                const renovado = tieneBase
                    ? (nueva.plan === "basico" && planAntes !== "basico") ||
                      (dn !== null && dn > diasAntes)
                    : activo && dn !== null && dn > PlanEstado_DIAS_PARA_RENOVAR
                if (renovado) {
                    setAviso("¡Listo! Tu plan Básico está activo.")
                    return
                }
            }
            if (!cancelado) {
                // El pago llegó pero el webhook todavía no impactó. En vez
                // de borrar el aviso sin decir nada, se explica qué pasa.
                setAviso(
                    "Tu pago está en proceso y puede tardar unos minutos en reflejarse. Si después no se actualiza, escribinos a soporte."
                )
                avisoTimer = setTimeout(() => setAviso(""), 20000)
            }
        }

        arrancar()
        return () => {
            cancelado = true
            if (avisoTimer) clearTimeout(avisoTimer)
        }
    }, [isCanvas, cargarInfo])

    // Al volver a la pestaña (o con el botón "atrás" desde Mercado Pago)
    // se refresca el estado y se destraba el botón.
    React.useEffect(() => {
        if (isCanvas || typeof window === "undefined") return
        const refrescar = () => {
            if (document.visibilityState === "hidden") return
            setRedirigiendo(false)
            cargarInfo()
        }
        document.addEventListener("visibilitychange", refrescar)
        window.addEventListener("pageshow", refrescar)
        return () => {
            document.removeEventListener("visibilitychange", refrescar)
            window.removeEventListener("pageshow", refrescar)
        }
    }, [isCanvas, cargarInfo])

    const handleCheckout = () => {
        if (isCanvas || redirigiendo) return
        setCheckoutError("")
        window.dispatchEvent(new CustomEvent("turnits:abrir-checkout-plan", { detail: { plan: info?.plan, periodo: "mensual" } }))
    }

    const data = isCanvas ? PlanEstado_MOCK : info

    if (loading) {
        return (
            <div
                style={{
                    height: 42,
                    borderRadius: 14,
                    background:
                        "linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%)",
                    backgroundSize: "200% 100%",
                    animation: "planEstadoShimmer 1.4s infinite",
                    ...style,
                }}
            >
                <style>{`
                    @keyframes planEstadoShimmer {
                        0%   { background-position: 200% 0; }
                        100% { background-position: -200% 0; }
                    }
                `}</style>
            </div>
        )
    }

    // Sin datos (sin slug / error de red): no mostramos nada en el menú.
    if (!data) return null

    const esPremium = data.plan === "basico"
    const esVip = data.plan === "premium"
    const dias: number | null =
        typeof data.dias_restantes === "number" ? data.dias_restantes : null
    const vencida =
        (esPremium || esVip) && (!!data.vencida || (dias !== null && dias <= 0))
    const porVencer =
        (esPremium || esVip) &&
        !vencida &&
        dias !== null &&
        dias <= PlanEstado_DIAS_PARA_RENOVAR
    const enAlerta = vencida || porVencer

    // Contador de días (ej: "26d"). Vencido → "Venció".
    const etiquetaDias = vencida ? "Venció" : dias !== null ? `${dias}d` : ""
    const precio = Number(data.precio_renovacion) || 0
    const precioTxt = precio > 0 ? ` · $${precio.toLocaleString("es-AR")}` : ""

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                boxSizing: "border-box",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                ...style,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    minHeight: 24,
                }}
            >
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: textColor,
                        whiteSpace: "nowrap",
                    }}
                >
                    {(esPremium || esVip) && (
                        <TurnitsPlanIcon plan={esVip ? "premium" : "basico"} size={17} />
                    )}
                    {esVip
                        ? "Plan Premium"
                        : esPremium
                          ? "Plan Básico"
                          : "Plan Gratis"}
                </span>

                {esVip || esPremium ? (
                    etiquetaDias ? (
                        <span
                            title={
                                vencida
                                    ? `Tu plan ${esVip ? "Premium" : "Básico"} venció`
                                    : `Te quedan ${dias} ${dias === 1 ? "día" : "días"}`
                            }
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: enAlerta ? warningColor : accentColor,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {etiquetaDias}
                        </span>
                    ) : null
                ) : (
                    <button
                        onClick={handleCheckout}
                        disabled={redirigiendo}
                        title={`Mejorar a Básico${precioTxt}/mes`}
                        style={{
                            padding: "5px 14px",
                            borderRadius: 99,
                            border: "none",
                            background: accentColor,
                            color: "#ffffff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: redirigiendo ? "default" : "pointer",
                            opacity: redirigiendo ? 0.7 : 1,
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                        }}
                    >
                        {redirigiendo ? "Redirigiendo…" : "Mejorar"}
                    </button>
                )}
            </div>

            {/* Básico con 3 días o menos (o vencido): botón de renovar.
                Tiene un brillo que lo cruza cada tanto, para que no se
                vea como un botón estático. */}
            {(esPremium || esVip) && enAlerta && (
                <div
                    className="pe-renovar-wrap"
                    data-busy={redirigiendo ? "true" : "false"}
                    style={{ position: "relative", width: "100%" }}
                >
                    <style>{`
                        .pe-renovar-btn {
                            position: relative;
                            overflow: hidden;
                            transition: transform 0.15s ease, filter 0.15s ease;
                        }
                        .pe-renovar-btn:not(:disabled):hover {
                            transform: translateY(-1px);
                            filter: brightness(1.07);
                        }
                        .pe-renovar-btn:not(:disabled):active {
                            transform: scale(0.98);
                        }
                        .pe-renovar-shine {
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 45%;
                            height: 100%;
                            pointer-events: none;
                            background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
                            transform: translateX(-160%) skewX(-18deg);
                            animation: peRenovarShine 2.8s ease-in-out infinite;
                        }
                        @keyframes peRenovarShine {
                            0%, 55% { transform: translateX(-160%) skewX(-18deg); }
                            100%    { transform: translateX(320%) skewX(-18deg); }
                        }
                        .pe-renovar-wrap[data-busy="true"] .pe-renovar-shine {
                            animation-play-state: paused;
                        }
                        @media (prefers-reduced-motion: reduce) {
                            .pe-renovar-shine { display: none; }
                        }
                    `}</style>
                    <button
                        className="pe-renovar-btn"
                        onClick={handleCheckout}
                        disabled={redirigiendo}
                        title={`Se suman 30 días a los que te quedan${precioTxt}`}
                        style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "none",
                            background: accentColor,
                            color: "#ffffff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: redirigiendo ? "default" : "pointer",
                            opacity: redirigiendo ? 0.7 : 1,
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                        }}
                    >
                        <span className="pe-renovar-shine" aria-hidden="true" />
                        <span style={{ position: "relative" }}>
                            {redirigiendo ? "Redirigiendo…" : "Renovar plan"}
                        </span>
                    </button>
                </div>
            )}

            {checkoutError && (
                <span style={{ fontSize: 10, color: warningColor }}>
                    {checkoutError}
                </span>
            )}

            {aviso && (
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: accentColor,
                    }}
                >
                    {aviso}
                </span>
            )}
        </div>
    )
}

function BotonNotificaciones_CampanaFallback({
    color,
    size,
}: {
    color: string
    size: number
}) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path
                d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                fill={color}
            />
        </svg>
    )
}

function BotonNotificaciones(props: BotonNotificaciones_Props) {
    const {
        icono,
        texto,
        modo,
        anchoBreakpoint,
        colorFondo,
        colorFondoHover,
        colorBorde,
        colorTexto,
        tintarIcono,
        colorIcono,
        tamanoIcono,
        mostrarContador,
        apiBaseUrl,
        tokenStorageKey,
        pollingSeconds,
        employeeMode = false,
        colorContador,
        colorTextoContador,
        maxContador,
        scrollAlTop,
        scrollBehavior,
        scrollTargetSelector,
        scrollActionDelay,
        onClick,
        style,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const [compactoAuto, setCompactoAuto] = useState(false)
    const [hover, setHover] = useState(false)

    const noLeidas = BotonNotificaciones_useNoLeidas(
        apiBaseUrl,
        tokenStorageKey,
        pollingSeconds,
        employeeMode
    )
    const hayNotificaciones = mostrarContador && noLeidas > 0

    useEffect(() => {
        console.log(
            `[BotonNotif] RENDER — noLeidas=${noLeidas}, mostrarContador=${mostrarContador}, hayNotificaciones=${hayNotificaciones}`
        )
    }, [noLeidas, mostrarContador, hayNotificaciones])

    useEffect(() => {
        if (modo !== "automatico") return
        const el = containerRef.current
        if (!el) return

        const medir = (ancho: number) =>
            setCompactoAuto(ancho < anchoBreakpoint)
        medir(el.getBoundingClientRect().width)

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) medir(entry.contentRect.width)
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [anchoBreakpoint, modo])

    const compacto =
        modo === "compacto" ? true : modo === "expandido" ? false : compactoAuto

    const handleClick = useCallback(() => {
        if (!scrollAlTop) {
            onClick?.()
            return
        }

        BotonNotificaciones_scrollToTop(scrollTargetSelector, scrollBehavior)
        setTimeout(() => {
            onClick?.()
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    BotonNotificaciones_scrollToTop(
                        scrollTargetSelector,
                        scrollBehavior
                    )
                })
            })
        }, scrollActionDelay)
    }, [
        onClick,
        scrollAlTop,
        scrollTargetSelector,
        scrollBehavior,
        scrollActionDelay,
    ])

    const iconoNode = icono?.src ? (
        <img
            src={icono.src}
            alt="Notificaciones"
            style={{
                width: tamanoIcono,
                height: tamanoIcono,
                objectFit: "contain",
                display: "block",
                ...(tintarIcono
                    ? { filter: `brightness(0) saturate(100%)` }
                    : {}),
            }}
        />
    ) : (
        <BotonNotificaciones_CampanaFallback
            color={colorIcono}
            size={tamanoIcono}
        />
    )

    const textoContador =
        noLeidas > maxContador ? `${maxContador}+` : noLeidas.toString()

    return (
        <div
            ref={containerRef}
            onClick={handleClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleClick()
            }}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                cursor: "pointer",
                userSelect: "none",
                boxSizing: "border-box",
                background: hover ? colorFondoHover : colorFondo,
                border: compacto ? "none" : `1px solid ${colorBorde}`,
                borderRadius: compacto ? "50%" : 999,
                padding: compacto ? 8 : "8px 16px",
                width: compacto ? tamanoIcono + 16 : "fit-content",
                height: compacto ? tamanoIcono + 16 : "fit-content",
                transition: "background 0.15s ease",
                fontFamily: "inherit",
                position: "relative",
                overflow: "visible", // ← NUEVO
                ...style,
            }}
        >
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    overflow: "visible",
                }}
            >
                {" "}
                {/* ← overflow agregado */}
                {iconoNode}
                {hayNotificaciones && (
                    <span
                        style={{
                            position: "absolute",
                            top: -4,
                            right: -6,
                            minWidth: 15,
                            height: 15,
                            padding: "0 3px",
                            borderRadius: 999,
                            background: colorContador,
                            color: colorTextoContador,
                            fontSize: 9.5,
                            fontWeight: 700,
                            lineHeight: "15px",
                            textAlign: "center",
                            boxSizing: "border-box",
                            border: "1.5px solid #fff",
                            zIndex: 10, // ← NUEVO
                        }}
                    >
                        {textoContador}
                    </span>
                )}
            </div>
            {!compacto && (
                <span
                    style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: colorTexto,
                        whiteSpace: "nowrap",
                        lineHeight: 1,
                    }}
                >
                    {texto}
                </span>
            )}
        </div>
    )
}

BotonNotificaciones.defaultProps = {
    texto: "Notificaciones",
    modo: "automatico",
    anchoBreakpoint: 140,
    colorFondo: "#FFFFFF",
    colorFondoHover: "#F5F5F5",
    colorBorde: "#E5E5E5",
    colorTexto: "#111111",
    tintarIcono: false,
    colorIcono: "#111111",
    tamanoIcono: 20,
    mostrarContador: true,
    apiBaseUrl: BotonNotificaciones_API_BASE_URL_DEFAULT,
    tokenStorageKey: "auth_token",
    pollingSeconds: 30,
    colorContador: "#10B981",
    colorTextoContador: "#FFFFFF",
    maxContador: 99,
    scrollAlTop: true,
    scrollBehavior: "instant",
    scrollTargetSelector: "",
    scrollActionDelay: 50,
}

function NotificacionesPanel(props: NotificacionesPanel_Props) {
    const {
        apiBaseUrl,
        employeeMode = false,
        tokenStorageKey,
        pollingSeconds,
        accentColor,
        iconoTurnoNuevo,
        iconoTurnoCancelado,
        iconoTurnoPendiente,
        iconoPagoAprobado,
        iconoListaEspera,
        iconoVencimiento,
        iconoRecordatorio,
        iconoReprogramacion,
        iconoTip,
        iconoSistema,
        iconoEliminar,
        mostrarBotonPush,
        swPath,
        textoActivarPush,
        textoPushActivo,
        onNavigate,
        style,
    } = props

    const [notifs, setNotifs] = useState<NotificacionesPanel_Notificacion[]>([])
    const [noLeidas, setNoLeidas] = useState(0)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hoverId, setHoverId] = useState<string | null>(null)
    const [hoverBtnId, setHoverBtnId] = useState<string | null>(null)

    // ── Estado de Web Push ───────────────────────────────────────
    const [estadoPush, setEstadoPush] =
        useState<NotificacionesPanel_EstadoPush>("cargando")
    const [hoverPush, setHoverPush] = useState(false)
    const [errorPush, setErrorPush] = useState<string | null>(null)

    // ── La lista de notificaciones ocupa el 100% del alto disponible
    // del contenedor (lo que le dé el padre) y recién a partir de ahí
    // scrollea, en vez de cortarse siempre a un número fijo de items.
    const listRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
    const readConfirmed = useRef<Set<string>>(new Set())
    const readInFlight = useRef<Set<string>>(new Set())
    const notifsCurrent = useRef(notifs)
    notifsCurrent.current = notifs

    const iconosPorTipo: Record<string, string | undefined> = {
        turno_nuevo: iconoTurnoNuevo?.src,
        turno_cancelado: iconoTurnoCancelado?.src,
        turno_pendiente: iconoTurnoPendiente?.src,
        pago_aprobado: iconoPagoAprobado?.src,
        lista_espera: iconoListaEspera?.src,
        vencimiento: iconoVencimiento?.src,
        recordatorio: iconoRecordatorio?.src,
        reprogramacion: iconoReprogramacion?.src,
        tip: iconoTip?.src,
        sistema: iconoSistema?.src,
    }

    const getAuth = useCallback(() => {
        if (typeof window === "undefined") return null
        const token =
            window.localStorage.getItem(tokenStorageKey) ||
            [
                "access_token",
                "user_token",
                "token",
                "auth_token",
                "turnits_token",
            ]
                .map((key) => window.localStorage.getItem(key))
                .find(Boolean)
        if (!token) return null
        const slugUrl = NotificacionesPanel_getSlugFromUrl()
        const slug = slugUrl || NotificacionesPanel_decodeJWT(token)?.slug
        if (!slug) return null
        return { token, slug }
    }, [tokenStorageKey])

    const fetchNotifs = useCallback(async () => {
        const auth = getAuth()
        if (!auth) {
            setError("no_auth")
            setCargando(false)
            return
        }
        try {
            const res = await fetch(
                employeeMode
                    ? `${apiBaseUrl}/empleado/${encodeURIComponent(auth.slug)}/notificaciones`
                    : `${apiBaseUrl}/notificaciones/${auth.slug}`,
                { headers: { Authorization: `Bearer ${auth.token}` } }
            )
            const data = await res.json()
            if (data.success) {
                const incoming: NotificacionesPanel_Notificacion[] = data.notificaciones || []
                const confirmedInResponse = incoming.filter(n => !n.leida && readConfirmed.current.has(n.id)).length
                setNotifs(incoming.map(n => readConfirmed.current.has(n.id) ? {...n,leida:true} : n))
                setNoLeidas(Math.max(0, Number(data.no_leidas || 0) - confirmedInResponse))
                setError(null)
            } else {
                console.error("NotificacionesPanel error:", data.error)
                setError(data.error || "error")
            }
        } catch (e: any) {
            console.error("NotificacionesPanel fetch error:", e.message)
            setError(e.message)
        } finally {
            setCargando(false)
        }
    }, [apiBaseUrl, getAuth, employeeMode])

    useEffect(() => {
        fetchNotifs()
        const interval = setInterval(
            fetchNotifs,
            Math.max(10, pollingSeconds) * 1000
        )
        return () => clearInterval(interval)
    }, [fetchNotifs, pollingSeconds])

    const marcarLeida = useCallback(async (id: string): Promise<boolean> => {
        if (readConfirmed.current.has(id)) return true
        if (readInFlight.current.has(id)) return false
        const current = notifsCurrent.current.find(n => n.id === id)
        if (!current || current.leida) return true
        const auth = getAuth()
        if (!auth) return false
        readInFlight.current.add(id)
        try {
            const response = await fetch(
                employeeMode
                    ? `${apiBaseUrl}/empleado/${encodeURIComponent(auth.slug)}/notificaciones/${id}/leida`
                    : `${apiBaseUrl}/notificaciones/${id}/leida`,
                {
                    method: "PUT",
                    headers: {"Content-Type":"application/json", Authorization: `Bearer ${auth.token}`},
                    body: JSON.stringify({slug:auth.slug}),
                }
            )
            const result = await response.json().catch(() => null)
            if (!response.ok || !result?.success) throw new Error("No se pudo marcar la notificación como leída.")
            readConfirmed.current.add(id)
            setNotifs(previous => previous.map(n => n.id === id ? {...n,leida:true} : n))
            if (notifsCurrent.current.some(n => n.id === id && !n.leida)) setNoLeidas(previous => Math.max(0,previous - 1))
            window.dispatchEvent(new CustomEvent("turnits-notifications-updated", {detail:{slug:auth.slug,employeeMode}}))
            return true
        } catch (error) {
            console.error("Error marcando leída:", error)
            return false
        } finally {readInFlight.current.delete(id)}
    }, [apiBaseUrl, employeeMode, getAuth])

    useEffect(() => {
        if (!listRef.current || cargando || error) return
        const unread = new Map<string, HTMLDivElement>()
        notifs.forEach(n => {
            const element = itemRefs.current.get(n.id)
            if (!n.leida && element) unread.set(n.id,element)
        })
        return NotificacionesPanel_observarVisibles(listRef.current,unread,marcarLeida)
    }, [notifs, cargando, error, marcarLeida])

    // A qué sección navegar al tocar una notificación: prioriza lo que
    // mande el backend en `data.seccion` (si vino) y si no, el default
    // según el tipo normalizado de la notificación.
    const seccionDeNotif = (
        n: NotificacionesPanel_Notificacion
    ): string | undefined => {
        const desdeData = n.data?.seccion
        if (typeof desdeData === "string" && desdeData) return desdeData
        const tipoNormalizado = NotificacionesPanel_normalizarTipo(n.tipo)
        return NotificacionesPanel_SECCION_POR_TIPO[tipoNormalizado]
    }

    const abrirNotif = (n: NotificacionesPanel_Notificacion) => {
        // Abrirla ya cuenta como "vista" — no hace falta un botón aparte.
        if (!n.leida) marcarLeida(n.id)
        const seccion = seccionDeNotif(n)
        if (seccion) onNavigate?.(seccion, n)
    }

    const eliminar = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const auth = getAuth()
        if (!auth) return
        const era = notifs.find((n) => n.id === id)
        setNotifs((prev) => prev.filter((n) => n.id !== id))
        if (era && !era.leida) setNoLeidas((prev) => Math.max(0, prev - 1))
        itemRefs.current.delete(id)
        try {
            await fetch(
                employeeMode
                    ? `${apiBaseUrl}/empleado/${encodeURIComponent(auth.slug)}/notificaciones/${id}`
                    : `${apiBaseUrl}/notificaciones/${id}?slug=${auth.slug}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${auth.token}` },
                }
            )
        } catch (e: any) {
            console.error("Error eliminando notificación:", e.message)
        }
    }

    // ── Web Push: chequeo inicial (¿ya está suscripto este navegador?) ──
    useEffect(() => {
        if (!mostrarBotonPush) return
        let cancelado = false

        async function chequear() {
            if (typeof window === "undefined") return

            const soportado =
                "serviceWorker" in navigator &&
                "PushManager" in window &&
                "Notification" in window

            if (!soportado) {
                if (cancelado) return
                // En iPhone, "no soportado" casi siempre significa "todavía
                // no lo agregaste a la pantalla de inicio", no que el
                // dispositivo no pueda. Se lo decimos en vez de escondernos.
                setEstadoPush(
                    NotificacionesPanel_esIOS() &&
                        !NotificacionesPanel_esStandalone()
                        ? "requiere_pwa_ios"
                        : "no_soportado"
                )
                return
            }

            try {
                const reg =
                    await navigator.serviceWorker.getRegistration(swPath)
                const sub = reg ? await reg.pushManager.getSubscription() : null
                if (!cancelado) setEstadoPush(sub ? "activo" : "sin_activar")
            } catch {
                if (!cancelado) setEstadoPush("sin_activar")
            }
        }

        chequear()
        return () => {
            cancelado = true
        }
    }, [mostrarBotonPush, swPath])

    const activarPush = async () => {
        const auth = getAuth()
        if (!auth) return

        setEstadoPush("activando")
        setErrorPush(null)

        // Vamos marcando en qué paso estamos para poder dar un mensaje
        // de error específico si algo falla — sin esto, cualquier error
        // (permiso, VAPID, sw.js, red) mostraba el mismo texto genérico
        // y no había forma de saber qué revisar sin abrir la consola.
        let paso = "permiso"

        try {
            // 1) Permiso del navegador.
            const permiso = await Notification.requestPermission()
            if (permiso !== "granted") {
                setEstadoPush("sin_activar")
                setErrorPush(
                    permiso === "denied"
                        ? "Bloqueaste las notificaciones para este sitio. Activalas desde el candado (🔒) de la barra de direcciones y volvé a intentar."
                        : "No se activaron los permisos."
                )
                return
            }

            // 2) Registrar el service worker.
            paso = "service_worker"
            const reg = await navigator.serviceWorker.register(swPath)
            await navigator.serviceWorker.ready

            // 3) Pedirle al backend la VAPID public key.
            paso = "vapid_key"
            const resKey = await fetch(`${apiBaseUrl}/push/vapid-public-key`)
            const dataKey = await resKey.json()
            if (!dataKey.success)
                throw new Error(dataKey.error || "vapid_no_configurada")

            // 4) Suscribirse en el navegador.
            paso = "subscribe"
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: NotificacionesPanel_urlBase64ToUint8Array(
                    dataKey.publicKey
                ),
            })

            // 5) Mandarle la suscripción al backend.
            paso = "guardar_backend"
            const resSub = await fetch(`${apiBaseUrl}/push/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${auth.token}`,
                },
                body: JSON.stringify({ slug: auth.slug, subscription }),
            })
            const dataSub = await resSub.json()
            if (!dataSub.success)
                throw new Error(dataSub.error || "no_guardo_backend")

            setEstadoPush("activo")
        } catch (e: any) {
            // Log completo a consola para vos/mí si hace falta debuggear más hondo.
            console.error(
                `[NotificacionesPanel] Error activando push (paso: ${paso}):`,
                e
            )
            setEstadoPush("sin_activar")

            const mensajesPorPaso: Record<string, string> = {
                service_worker:
                    "No se pudo registrar el service worker. Entrá directo a tu-dominio.com/sw.js en el navegador y confirmá que devuelve código, no un error.",
                vapid_key:
                    "El servidor no tiene configurada la clave de notificaciones (VAPID). Revisá VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en las variables de entorno de Render.",
                subscribe:
                    "El navegador rechazó la suscripción. Es común si la VAPID key quedó con un espacio o salto de línea de más al pegarla en Render — volvé a copiarla y pegarla con cuidado.",
                guardar_backend:
                    "Se generó la suscripción pero no se pudo guardar en el servidor. Probá de nuevo en unos segundos.",
            }

            setErrorPush(
                mensajesPorPaso[paso] ||
                    `No se pudieron activar las notificaciones${e?.message ? ` (${e.message})` : ""}.`
            )
        }
    }

    const desactivarPush = async () => {
        const auth = getAuth()
        setEstadoPush("desactivando")
        setErrorPush(null)

        try {
            const reg = await navigator.serviceWorker.getRegistration(swPath)
            const sub = reg ? await reg.pushManager.getSubscription() : null

            if (sub) {
                const endpoint = sub.endpoint
                await sub.unsubscribe()

                if (auth) {
                    await fetch(`${apiBaseUrl}/push/subscribe`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${auth.token}`,
                        },
                        body: JSON.stringify({ endpoint }),
                    }).catch(() => {})
                }
            }

            setEstadoPush("sin_activar")
        } catch (e: any) {
            console.error(
                "[NotificacionesPanel] Error desactivando push:",
                e.message
            )
            setErrorPush("No se pudo desactivar. Probá de nuevo.")
            setEstadoPush("activo")
        }
    }

    const pushActivo = estadoPush === "activo"
    const pushEnCurso =
        estadoPush === "activando" || estadoPush === "desactivando"
    const requierePwaIOS = estadoPush === "requiere_pwa_ios"
    const mostrarPush =
        mostrarBotonPush &&
        estadoPush !== "cargando" &&
        estadoPush !== "no_soportado"

    // En iPhone, tocar el botón sin haber agregado el sitio a la pantalla
    // de inicio no debe intentar activarPush(): `Notification` directamente
    // no existe en ese contexto y explota con un ReferenceError críptico.
    // Acá lo frenamos antes y le mostramos la instrucción real.
    const onClickPush = () => {
        if (requierePwaIOS) {
            setErrorPush(
                'En iPhone, las notificaciones solo funcionan si primero agregás este panel a tu pantalla de inicio: tocá el botón de Compartir (□↑) en Safari y elegí "Agregar a pantalla de inicio". Después abrilo desde ahí (no desde Safari) y volvé a intentar. Necesitás iOS 16.4 o superior.'
            )
            return
        }
        if (pushActivo) {
            desactivarPush()
        } else {
            activarPush()
        }
    }

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                background: "#fff",
                fontFamily: "inherit",
                ...style,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 8,
                    padding: mostrarPush ? "10px 16px" : "0 16px",
                    borderBottom: mostrarPush ? "1px solid #F0F0F0" : "none",
                    flexShrink: 0,
                    background: "#fff",
                    flexWrap: "wrap",
                }}
            >
                {/* ── Toggle de Web Push ── */}
                {mostrarPush && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 4,
                        }}
                    >
                        <button
                            onClick={onClickPush}
                            disabled={pushEnCurso}
                            onMouseEnter={() => setHoverPush(true)}
                            onMouseLeave={() => setHoverPush(false)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                border: `1px solid ${pushActivo ? accentColor : "#E5E5E5"}`,
                                background: pushActivo
                                    ? hoverPush
                                        ? `${accentColor}15`
                                        : `${accentColor}0D`
                                    : hoverPush
                                      ? "#F5F5F5"
                                      : "#FFFFFF",
                                color: pushActivo ? accentColor : "#111111",
                                fontSize: 11.5,
                                fontWeight: 600,
                                padding: "6px 12px",
                                borderRadius: 999,
                                cursor: pushEnCurso ? "default" : "pointer",
                                opacity: pushEnCurso ? 0.7 : 1,
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {pushEnCurso
                                ? "Un momento..."
                                : requierePwaIOS
                                  ? "Cómo activar en iPhone"
                                  : pushActivo
                                    ? textoPushActivo
                                    : textoActivarPush}
                        </button>
                        {errorPush && (
                            <div
                                style={{
                                    fontSize: 10.5,
                                    color: "#EF4444",
                                    maxWidth: 220,
                                    textAlign: "right",
                                }}
                            >
                                {errorPush}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {cargando && (
                <div
                    style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#999",
                        fontSize: 13,
                    }}
                >
                    Cargando...
                </div>
            )}

            {!cargando && error === "no_auth" && (
                <div
                    style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#999",
                        fontSize: 13,
                    }}
                >
                    Iniciá sesión para ver tus notificaciones.
                </div>
            )}

            {!cargando && error && error !== "no_auth" && (
                <div
                    style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#EF4444",
                        fontSize: 13,
                    }}
                >
                    No se pudieron cargar las notificaciones.
                </div>
            )}

            {!cargando && !error && notifs.length === 0 && (
                <div
                    style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#999",
                        fontSize: 13,
                    }}
                >
                    No tenés notificaciones por ahora.
                </div>
            )}

            {!cargando && !error && notifs.length > 0 && (
                <div
                    ref={listRef}
                    className="notifs-scroll-area"
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        ["--scroll-thumb" as any]: `${accentColor}80`,
                        ["--scroll-thumb-hover" as any]: accentColor,
                        ["--scroll-track" as any]: `${accentColor}0D`,
                    }}
                >
                    <style>{`
                        .notifs-scroll-area {
                            scrollbar-width: thin;
                            scrollbar-color: var(--scroll-thumb) var(--scroll-track);
                        }
                        .notifs-scroll-area::-webkit-scrollbar {
                            width: 8px;
                        }
                        .notifs-scroll-area::-webkit-scrollbar-track {
                            background: var(--scroll-track);
                            margin: 4px 0;
                            border-radius: 999px;
                        }
                        .notifs-scroll-area::-webkit-scrollbar-thumb {
                            background-color: var(--scroll-thumb);
                            border-radius: 999px;
                            border: 2px solid transparent;
                            background-clip: padding-box;
                            transition: background-color 0.15s ease;
                        }
                        .notifs-scroll-area::-webkit-scrollbar-thumb:hover {
                            background-color: var(--scroll-thumb-hover);
                            border: 1.5px solid transparent;
                            background-clip: padding-box;
                        }
                    `}</style>
                    {notifs.map((n) => {
                        const tipoNormalizado =
                            NotificacionesPanel_normalizarTipo(n.tipo)
                        const cfg =
                            NotificacionesPanel_TIPO_CONFIG[tipoNormalizado] ||
                            NotificacionesPanel_TIPO_CONFIG.sistema
                        const iconoCustom = iconosPorTipo[tipoNormalizado]
                        const enHover = hoverId === n.id
                        const enHoverBtn = hoverBtnId === n.id
                        return (
                            <div
                                key={n.id}
                                data-notification-id={n.id}
                                ref={(el) => {
                                    if (el) itemRefs.current.set(n.id, el)
                                    else itemRefs.current.delete(n.id)
                                }}
                                onClick={() => abrirNotif(n)}
                                onMouseEnter={() => setHoverId(n.id)}
                                onMouseLeave={() => {
                                    setHoverId(null)
                                    setHoverBtnId(null)
                                }}
                                style={{
                                    position: "relative",
                                    display: "flex",
                                    gap: 10,
                                    padding: "12px 40px 12px 16px",
                                    borderLeft: !n.leida
                                        ? `3px solid ${accentColor}`
                                        : "3px solid transparent",
                                    borderBottom: "1px solid #F5F5F5",
                                    background: n.leida
                                        ? enHover
                                            ? "#FAFAFA"
                                            : "#fff"
                                        : enHover
                                          ? "#F0EEFF"
                                          : "#F8F7FF",
                                    cursor: "pointer",
                                    transition: "background 0.12s ease",
                                }}
                            >
                                <div
                                    style={{
                                        width: 20,
                                        height: 20,
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 18,
                                        lineHeight: 1,
                                    }}
                                >
                                    {iconoCustom ? (
                                        <img
                                            src={iconoCustom}
                                            alt={n.tipo}
                                            style={{
                                                width: 20,
                                                height: 20,
                                                objectFit: "contain",
                                            }}
                                        />
                                    ) : (
                                        cfg.icon
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            fontWeight: n.leida ? 500 : 700,
                                            fontSize: 13.5,
                                            color: "#111",
                                            marginBottom: 2,
                                        }}
                                    >
                                        {n.titulo}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            color: "#666",
                                            marginBottom: 4,
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {n.mensaje}
                                    </div>
                                    <div
                                        style={{ fontSize: 11, color: "#AAA" }}
                                    >
                                        {NotificacionesPanel_tiempoRelativo(
                                            n.created_at
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={(e) => eliminar(n.id, e)}
                                    onMouseEnter={(e) => {
                                        e.stopPropagation()
                                        setHoverBtnId(n.id)
                                    }}
                                    onMouseLeave={(e) => {
                                        e.stopPropagation()
                                        setHoverBtnId(
                                            n.id === hoverId ? n.id : null
                                        )
                                        setHoverBtnId(null)
                                    }}
                                    aria-label="Eliminar notificación"
                                    title="Eliminar"
                                    style={{
                                        position: "absolute",
                                        top: 10,
                                        right: 10,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 22,
                                        height: 22,
                                        borderRadius: "50%",
                                        border: "none",
                                        background: enHoverBtn
                                            ? "#FEE2E2"
                                            : "transparent",
                                        cursor: "pointer",
                                        padding: 0,
                                        opacity: enHover ? 1 : 0,
                                        transition:
                                            "opacity 0.15s ease, background 0.15s ease",
                                    }}
                                >
                                    {iconoEliminar?.src ? (
                                        <img
                                            src={iconoEliminar.src}
                                            alt="Eliminar"
                                            style={{
                                                width: 11,
                                                height: 11,
                                                objectFit: "contain",
                                                filter: enHoverBtn
                                                    ? "none"
                                                    : "opacity(0.55)",
                                            }}
                                        />
                                    ) : (
                                        <svg
                                            width="11"
                                            height="11"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <path
                                                d="M18 6L6 18M6 6l12 12"
                                                stroke={
                                                    enHoverBtn
                                                        ? "#EF4444"
                                                        : "#999"
                                                }
                                                strokeWidth="2.4"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

NotificacionesPanel.defaultProps = {
    apiBaseUrl: appConfig.apiUrl,
    tokenStorageKey: "auth_token",
    pollingSeconds: 30,
    accentColor: "#6366F1",
    mostrarBotonPush: true,
    swPath: "/sw.js",
    textoActivarPush: "Activar notificaciones",
    textoPushActivo: "Notificaciones activadas",
}

function TurnosHoy(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        onVerAgenda,
        style,
    } = props

    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }

        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let pollInterval: ReturnType<typeof setInterval> | null = null
        let retries = 0
        const MAX_RETRIES = 10

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada. Volvé a iniciar sesión.")
                    setLoading(false)
                    if (pollInterval) clearInterval(pollInterval)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                if (result?.turnosHoy !== undefined) {
                    setStats(result)
                    setError("")
                } else {
                    setError("Respuesta inesperada del servidor.")
                }
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = TurnosHoy_getSlug()
            const token = TurnosHoy_getToken()
            if (slug && token) {
                fetchData(slug, token)
                pollInterval = setInterval(() => fetchData(slug, token), 60000)
                return
            }
            retries++
            if (retries >= MAX_RETRIES) {
                setError(
                    !slug
                        ? "Falta ?u=slug en la URL."
                        : "Sin sesión. Iniciá sesión primero."
                )
                setLoading(false)
                return
            }
            retryTimer = setTimeout(tryInit, 300)
        }

        tryInit()

        const onCancelado = () => {
            const slug = TurnosHoy_getSlug()
            const token = TurnosHoy_getToken()
            if (slug && token) fetchData(slug, token)
        }
        window.addEventListener("turno_cancelado", onCancelado)

        return () => {
            if (retryTimer) clearTimeout(retryTimer)
            if (pollInterval) clearInterval(pollInterval)
            window.removeEventListener("turno_cancelado", onCancelado)
        }
    }, [baseUrl])

    if (false) {
        return (
            <TurnosHoy_CardShell
                accentColor={accentColor}
                stats={TurnosHoy_MOCK}
                onVerAgenda={onVerAgenda}
                style={style}
            />
        )
    }

    if (loading) return <TurnosHoy_LoadingSkeleton style={style} />
    if (error || !stats)
        return <TurnosHoy_ErrorState error={error} style={style} />

    return (
        <TurnosHoy_CardShell
            accentColor={accentColor}
            stats={stats}
            onVerAgenda={onVerAgenda}
            style={style}
        />
    )
}

function TurnosHoy_LoadingSkeleton({ style }: any) {
    const { isMobile } = TurnosHoy_useBreakpoint()
    return (
        <div style={{ ...TurnosHoy_makeCardBase(isMobile), ...style }}>
            <TurnosHoy_SkeletonPulse width="45%" height={13} />
            <TurnosHoy_SkeletonPulse
                width="30%"
                height={isMobile ? 40 : 48}
                style={{ marginTop: 12 }}
            />
            <div
                style={{ height: 1, background: "#f0f0f0", margin: "20px 0" }}
            />
            <TurnosHoy_SkeletonPulse
                width="40%"
                height={13}
                style={{ marginBottom: 12 }}
            />
            {[80, 70, 75, 65].map((w, i) => (
                <TurnosHoy_SkeletonPulse
                    key={i}
                    width={`${w}%`}
                    height={isMobile ? 30 : 36}
                    style={{ marginBottom: 8, borderRadius: 10 }}
                />
            ))}
            <style>{TurnosHoy_shimmerCSS}</style>
        </div>
    )
}

function TurnosHoy_ErrorState({ error, style }: any) {
    const { isMobile } = TurnosHoy_useBreakpoint()
    return (
        <div style={{ ...TurnosHoy_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 14,
                }}
            >
                <span style={TurnosHoy_makeTitleStyle(isMobile)}>
                    Turnos de Hoy
                </span>
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        fontStyle: "italic",
                    }}
                >
                    {error || "Aún no hay datos."}
                </span>
            </div>
        </div>
    )
}

function TurnosHoy_CardShell({ accentColor, stats, onVerAgenda, style }: any) {
    const { isMobile, isTablet } = TurnosHoy_useBreakpoint()
    const minAhora = TurnosHoy_getMinutosArg()
    const duracion = stats.config?.duracion || 60

    const turnos: any[] = React.useMemo(() => {
        const lista = (stats.turnosHoyDetalle || []).map((t: any) => {
            const [h, m] = t.hora.split(":").map(Number)
            const minInicio = h * 60 + m
            const yaPaso = minInicio + duracion <= minAhora
            return { ...t, yaPaso, minInicio }
        })
        const idxProximo = lista.findIndex((t: any) => !t.yaPaso)
        return lista.map((t: any, i: number) => ({
            ...t,
            esProximo: i === idxProximo,
        }))
    }, [stats.turnosHoyDetalle, duracion, minAhora])

    const totalHoy = stats.turnosHoy ?? turnos.length
    const completados = turnos.filter((t) => t.yaPaso).length
    const pendientes = turnos.filter((t) => !t.yaPaso).length

    const ingresoTotal = React.useMemo(() => {
        let total = 0
        for (const t of turnos) {
            const precio = Number(t.precio_cobrado || 0)
            if (precio <= 0) continue
            if (t.metodo_pago !== "none" && t.pago_estado === "aprobado") {
                total += precio
            } else if (
                t.metodo_pago === "none" ||
                t.pago_estado === "sin_pago"
            ) {
                total += precio
            }
        }
        return total
    }, [turnos])

    const maxTurnos = isMobile ? 4 : isTablet ? 5 : 6
    const fmt = (n: number) =>
        "$" +
        n.toLocaleString("es-AR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        })

    return (
        <div style={{ ...TurnosHoy_makeCardBase(isMobile), ...style }}>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: isMobile ? 10 : 14,
                }}
            >
                <span style={TurnosHoy_makeTitleStyle(isMobile)}>
                    Turnos de Hoy
                </span>
            </div>

            {/* BIG NUMBER */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: isMobile ? 8 : 12,
                    marginBottom: isMobile ? 12 : 16,
                }}
            >
                <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                        fontSize: isMobile ? 40 : 52,
                        fontWeight: 700,
                        color: accentColor,
                        lineHeight: 1,
                        letterSpacing: "-2px",
                    }}
                >
                    {totalHoy}
                </motion.span>
                <div style={{ paddingBottom: isMobile ? 4 : 6 }}>
                    <div
                        style={{
                            fontSize: isMobile ? 11 : 12,
                            color: "#94a3b8",
                            fontWeight: 500,
                        }}
                    >
                        turnos
                    </div>
                    <div
                        style={{
                            fontSize: isMobile ? 10 : 11,
                            color: "#cbd5e1",
                            marginTop: 1,
                        }}
                    >
                        {completados} completados · {pendientes} pendientes
                    </div>
                </div>
            </div>

            {/* INGRESOS HOY */}
            <div
                style={{
                    background: "#f8fafc",
                    borderRadius: 12,
                    padding: isMobile ? "8px 12px" : "10px 14px",
                    marginBottom: isMobile ? 12 : 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <span
                    style={{
                        fontSize: isMobile ? 11 : 12,
                        color: "#94a3b8",
                        fontWeight: 500,
                    }}
                >
                    Ingresos estimados
                </span>
                <span
                    style={{
                        fontSize: isMobile ? 13 : 15,
                        fontWeight: 700,
                        color: "#1e293b",
                    }}
                >
                    {fmt(ingresoTotal)}
                </span>
            </div>

            <div
                style={{
                    height: 1,
                    background: "#f1f5f9",
                    marginBottom: isMobile ? 10 : 14,
                }}
            />

            {/* LISTA CLIENTES */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: isMobile ? 8 : 10,
                }}
            >
                <span style={TurnosHoy_makeSectionTitle(isMobile)}>
                    Clientes de Hoy
                </span>
                {turnos.length > maxTurnos && (
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                        +{turnos.length - maxTurnos} más
                    </span>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 4 : 6,
                    flex: 1,
                }}
            >
                <AnimatePresence>
                    {turnos.length === 0 ? (
                        <div
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "20px 0",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 13,
                                    color: "#cbd5e1",
                                    fontStyle: "italic",
                                }}
                            >
                                Aún no tienes turnos
                            </span>
                        </div>
                    ) : (
                        turnos
                            .slice(0, maxTurnos)
                            .map((t, i) => (
                                <TurnosHoy_TurnoRow
                                    key={t.id || i}
                                    turno={t}
                                    index={i}
                                    accentColor={accentColor}
                                    isMobile={isMobile}
                                />
                            ))
                    )}
                </AnimatePresence>
            </div>

            {/* FOOTER */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    marginTop: isMobile ? 10 : 14,
                    paddingTop: isMobile ? 10 : 12,
                    borderTop: "1px solid #f1f5f9",
                }}
            >
                {onVerAgenda && (
                    <button
                        onClick={onVerAgenda}
                        style={TurnosHoy_makeBtnAgenda(accentColor, isMobile)}
                    >
                        Ver agenda
                    </button>
                )}
            </div>

            <style>{TurnosHoy_shimmerCSS}</style>
        </div>
    )
}

function TurnosHoy_TurnoRow({ turno, index, accentColor, isMobile }: any) {
    const { nombre, hora, yaPaso, esProximo } = turno
    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06, duration: 0.3 }}
            style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 8 : 10,
                padding: isMobile ? "7px 10px" : "9px 12px",
                borderRadius: 12,
                background: yaPaso ? "transparent" : "#fafafa",
                border: "1px solid transparent",
            }}
        >
            <div
                style={{
                    width: isMobile ? 6 : 7,
                    height: isMobile ? 6 : 7,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: esProximo
                        ? accentColor
                        : yaPaso
                          ? "#e2e8f0"
                          : "#cbd5e1",
                }}
            />
            <span
                style={{
                    flex: 1,
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: esProximo ? 700 : yaPaso ? 400 : 500,
                    color: esProximo
                        ? accentColor
                        : yaPaso
                          ? "#cbd5e1"
                          : "#334155",
                    letterSpacing: esProximo ? "-0.2px" : "normal",
                }}
            >
                {nombre}
            </span>
            <span
                style={{
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: esProximo ? 600 : 400,
                    color: esProximo
                        ? accentColor
                        : yaPaso
                          ? "#e2e8f0"
                          : "#94a3b8",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "0.02em",
                }}
            >
                {hora}
            </span>
            {esProximo && (
                <span
                    style={{
                        fontSize: isMobile ? 8 : 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: accentColor,
                        background: "#f8fafc",
                        padding: isMobile ? "2px 4px" : "2px 6px",
                        borderRadius: 6,
                        border: `1px solid ${accentColor}30`,
                    }}
                >
                    próximo
                </span>
            )}
        </motion.div>
    )
}

function TurnosHoy_SkeletonPulse({ width, height, style = {} }: any) {
    return (
        <div
            style={{
                width,
                height,
                borderRadius: 6,
                background:
                    "linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
                ...style,
            }}
        />
    )
}

function RendimientoEquipo_Spinner() {
    return (
        <span
            role="status"
            aria-label="Cargando"
            style={{
                display: "inline-block",
                width: 22,
                height: 22,
                border: "2.5px solid #d4d4d4",
                borderTopColor: "#111827",
                borderRadius: "50%",
                animation: "rendimientoEquipoSpin .75s linear infinite",
            }}
        />
    )
}

function RendimientoEquipo_EmptyState({
    imagen,
    texto = "Aun no tienes equipo",
    isMobile,
    grow = true,
}: {
    imagen?: string
    texto?: React.ReactNode
    isMobile: boolean
    grow?: boolean
}) {
    return (
        <div
            style={{
                flex: grow ? 1 : "0 0 auto",
                minHeight: imagen ? (isMobile ? 240 : 300) : undefined,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 10,
                padding: imagen ? "10px 6px" : 0,
            }}
        >
            {imagen && (
                <img
                    src={imagen}
                    alt=""
                    style={{
                        maxWidth: isMobile ? 240 : 300,
                        maxHeight: isMobile ? 240 : 300,
                        width: "100%",
                        height: "auto",
                        objectFit: "contain",
                        opacity: 0.9,
                    }}
                />
            )}
            <span
                style={{
                    fontSize: isMobile ? 12 : 13,
                    color: "#94a3b8",
                    lineHeight: 1.5,
                    maxWidth: 260,
                }}
            >
                {texto}
            </span>
        </div>
    )
}

function RendimientoEquipo(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        variant = "resumen",
        ilustracionVacia,
        style,
    } = props
    const { isMobile } = RendimientoEquipo_useBreakpoint()
    const esVariantEquipo = variant === "equipo"

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [esPremium, setEsPremium] = React.useState(false)
    const [equipo, setEquipo] = React.useState<any[]>([])
    const [equipoId, setEquipoId] = React.useState("")
    // Inicio no muestra selector de período: usa el mes calendario actual.
    const [periodo, setPeriodo] = React.useState("mes")
    const seleccionManualRef = React.useRef(false)
    const [refreshKey, setRefreshKey] = React.useState(0)

    // Detalle turno por turno de UN integrante (solo variante "resumen").
    const [datos, setDatos] = React.useState<any>(null)
    const [cargandoDatos, setCargandoDatos] = React.useState(false)

    // Resumen del período: totales del negocio + fila por integrante.
    // Lo usan las DOS variantes (antes cada una lo calculaba a su manera).
    const [resumen, setResumen] = React.useState<any>(null)
    const [cargandoResumen, setCargandoResumen] = React.useState(false)
    const [errorResumen, setErrorResumen] = React.useState("")

    const isCanvas = false

    React.useEffect(() => {
        const refrescar = () => setRefreshKey((actual) => actual + 1)
        const alVolverVisible = () => {
            if (document.visibilityState === "visible") refrescar()
        }
        window.addEventListener("focus", refrescar)
        window.addEventListener("pageshow", refrescar)
        document.addEventListener("visibilitychange", alVolverVisible)
        return () => {
            window.removeEventListener("focus", refrescar)
            window.removeEventListener("pageshow", refrescar)
            document.removeEventListener("visibilitychange", alVolverVisible)
        }
    }, [])

    // Carga inicial: plan del negocio + lista de integrantes.
    React.useEffect(() => {
        if (isCanvas) {
            setLoading(false)
            return
        }
        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let retries = 0
        const MAX_RETRIES = 10

        const cargarInicial = async (slug: string, token: string) => {
            try {
                const headers = { Authorization: `Bearer ${token}` }
                const [settingsRes, equipoRes] = await Promise.all([
                    fetch(`${api}/settings/${slug}`, {
                        headers,
                        cache: "no-cache",
                    }),
                    fetch(`${api}/admin/equipo/${slug}`, {
                        headers,
                        cache: "no-cache",
                    }),
                ])
                if (settingsRes.status === 401 || equipoRes.status === 401) {
                    setError("Sesión expirada. Volvé a iniciar sesión.")
                    setLoading(false)
                    return
                }
                const settingsData = await settingsRes.json()
                const cfg = settingsData?.settings || {}
                setEsPremium(cfg.plan === "basico" || cfg.plan === "premium")

                const equipoData = await equipoRes.json()
                const lista = (equipoData.equipo || []).filter(
                    (m: any) => m.activo !== false
                )
                setEquipo(lista)
                if (lista.length) setEquipoId(lista[0].id)
                setError("")
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = RendimientoEquipo_getSlug()
            const token = RendimientoEquipo_getToken()
            if (slug && token) {
                cargarInicial(slug, token)
                return
            }
            retries++
            if (retries >= MAX_RETRIES) {
                setError(
                    !slug
                        ? "Falta ?u=slug en la URL."
                        : "Sin sesión. Iniciá sesión primero."
                )
                setLoading(false)
                return
            }
            retryTimer = setTimeout(tryInit, 300)
        }

        tryInit()
        return () => {
            if (retryTimer) clearTimeout(retryTimer)
        }
    }, [baseUrl, isCanvas])

    // Resumen del período: totales del negocio + fila por integrante.
    // Alimenta los totales de la variante "resumen" Y la lista completa
    // de la variante "equipo" — antes cada una tenía su propio fetch.
    React.useEffect(() => {
        if (isCanvas || !esPremium) return
        const slug = RendimientoEquipo_getSlug()
        const token = RendimientoEquipo_getToken()
        if (!slug || !token) return

        let cancelado = false
        const api = baseUrl.replace(/\/+$/, "")
        setCargandoResumen(true)
        setErrorResumen("")

        fetch(
            `${api}/admin/rendimiento-equipo-resumen/${slug}?periodo=${periodo}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: "no-cache" }
        )
            .then((res) => res.json())
            .then((data) => {
                if (cancelado) return
                if (!data?.success)
                    throw new Error(
                        data?.error ||
                            "No se pudieron cargar las métricas del equipo."
                    )
                setResumen(data)
                if (!seleccionManualRef.current) {
                    const integranteConActividad = (
                        data.integrantes || []
                    ).find((m: any) => Number(m.turnos || 0) > 0)
                    if (integranteConActividad?.id) {
                        setEquipoId(integranteConActividad.id)
                    }
                }
            })
            .catch((e: any) => {
                if (!cancelado) {
                    setResumen(null)
                    setErrorResumen(
                        e?.message || "No se pudieron cargar los datos."
                    )
                }
            })
            .finally(() => {
                if (!cancelado) setCargandoResumen(false)
            })

        return () => {
            cancelado = true
        }
    }, [isCanvas, esPremium, periodo, baseUrl, refreshKey])

    // Detalle turno por turno del integrante elegido (solo "resumen":
    // en "equipo" ya alcanza con la fila de cada uno en el resumen).
    React.useEffect(() => {
        if (isCanvas || esVariantEquipo || !esPremium || !equipoId) return
        const slug = RendimientoEquipo_getSlug()
        const token = RendimientoEquipo_getToken()
        if (!slug || !token) return

        let cancelado = false
        const api = baseUrl.replace(/\/+$/, "")
        setCargandoDatos(true)

        fetch(
            `${api}/admin/rendimiento-equipo/${slug}?equipo_id=${equipoId}&periodo=${periodo}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: "no-cache" }
        )
            .then((res) => res.json())
            .then((data) => {
                if (cancelado) return
                setDatos(data?.success ? data : null)
            })
            .catch(() => {
                if (!cancelado) setDatos(null)
            })
            .finally(() => {
                if (!cancelado) setCargandoDatos(false)
            })

        return () => {
            cancelado = true
        }
    }, [
        isCanvas,
        esVariantEquipo,
        esPremium,
        equipoId,
        periodo,
        baseUrl,
        refreshKey,
    ])

    const dataParaMostrar = isCanvas ? RendimientoEquipo_MOCK.datos : datos
    const equipoParaMostrar = isCanvas ? RendimientoEquipo_MOCK.equipo : equipo
    const resumenParaMostrar = isCanvas
        ? RendimientoEquipo_MOCK.resumen
        : resumen
    const filasEquipo = resumenParaMostrar?.integrantes || []
    const integranteResumen = filasEquipo.find((m: any) => m.id === equipoId)
    const minutosTrabajados = Number(
        dataParaMostrar?.minutosTrabajados ??
            (dataParaMostrar?.detalle || []).reduce(
                (total: number, turno: any) =>
                    total + Number(turno.duracion || 0),
                0
            )
    )
    const horasTrabajadas = `${Math.floor(minutosTrabajados / 60)}H ${String(minutosTrabajados % 60).padStart(2, "0")}M`

    if (loading) {
        return (
            <div
                style={{
                    ...RendimientoEquipo_makeCardBase(isMobile),
                    ...style,
                }}
            >
                <div
                    style={{
                        width: "50%",
                        height: 13,
                        borderRadius: 6,
                        background:
                            "linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%)",
                        backgroundSize: "200% 100%",
                        animation: "rendimientoEquipoShimmer 1.4s infinite",
                        marginBottom: 16,
                    }}
                />
                <div
                    style={{
                        width: "100%",
                        height: 60,
                        borderRadius: 12,
                        background:
                            "linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%)",
                        backgroundSize: "200% 100%",
                        animation: "rendimientoEquipoShimmer 1.4s infinite",
                    }}
                />
                <style>{RendimientoEquipo_shimmerCSS}</style>
            </div>
        )
    }

    if (error) {
        return (
            <div
                style={{
                    ...RendimientoEquipo_makeCardBase(isMobile),
                    ...style,
                }}
            >
                <span style={RendimientoEquipo_makeTitleStyle(isMobile)}>
                    Rendimiento del equipo
                </span>
                <span style={{ fontSize: 13, color: "#94a3b8", marginTop: 10 }}>
                    {error}
                </span>
            </div>
        )
    }

    // Cuenta gratis: mostramos el valor de la función sin los datos.
    if (!isCanvas && !esPremium) {
        return (
            <div
                style={{
                    ...RendimientoEquipo_makeCardBase(isMobile),
                    ...style,
                    filter: "grayscale(1)",
                    opacity: 0.55,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 10,
                    }}
                >
                    <span style={RendimientoEquipo_makeTitleStyle(isMobile)}>
                        Rendimiento del equipo
                    </span>
                    <TurnitsPlanRequirement />
                </div>
                <span
                    style={{
                        fontSize: isMobile ? 12 : 13,
                        color: "#64748b",
                        lineHeight: 1.5,
                    }}
                >
                    {esVariantEquipo
                        ? "Con Básico podés ver cuántos turnos hizo cada integrante y cuánto facturó en el día, semana o mes."
                        : "Mirá cuántos turnos hizo y cuánto facturó cada integrante del equipo por día, semana o mes."}
                </span>
                <RendimientoEquipo_EmptyState
                    imagen={ilustracionVacia}
                    isMobile={isMobile}
                />
            </div>
        )
    }

    /* ─────────────────────── Variante "equipo" ─────────────────────── */
    if (esVariantEquipo) {
        return (
            <div
                style={{
                    ...RendimientoEquipo_makeCardBase(isMobile),
                    gap: 12,
                    ...style,
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
                    <span style={RendimientoEquipo_makeTitleStyle(isMobile)}>
                        Rendimiento del equipo
                    </span>
                    <div style={{ display: "flex", gap: 3 }}>
                        {RendimientoEquipo_PERIODOS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPeriodo(p.id)}
                                disabled={isCanvas}
                                style={{
                                    border: "none",
                                    background:
                                        periodo === p.id
                                            ? `${accentColor}10`
                                            : "transparent",
                                    color:
                                        periodo === p.id
                                            ? accentColor
                                            : "#94a3b8",
                                    borderRadius: 6,
                                    padding: "5px 8px",
                                    fontSize: 10.5,
                                    fontWeight: 750,
                                    cursor: "pointer",
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {cargandoResumen ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                style={{
                                    height: 68,
                                    borderRadius: 12,
                                    background:
                                        "linear-gradient(90deg,#f3f6f7 25%,#e9eef0 50%,#f3f6f7 75%)",
                                    backgroundSize: "200% 100%",
                                    animation:
                                        "rendimientoEquipoShimmer 1.2s infinite",
                                }}
                            />
                        ))}
                        <style>{RendimientoEquipo_shimmerCSS}</style>
                    </div>
                ) : errorResumen ? (
                    <div
                        style={{
                            padding: 14,
                            borderRadius: 12,
                            background: "#fff7ed",
                            color: "#9a3412",
                            fontSize: 12,
                        }}
                    >
                        {errorResumen}
                    </div>
                ) : filasEquipo.length ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            overflowY: "auto",
                        }}
                    >
                        {filasEquipo.map((m: any) => {
                            const name =
                                [m.nombre, m.apellido]
                                    .filter(Boolean)
                                    .join(" ") || "Profesional"
                            const initials = name
                                .split(" ")
                                .slice(0, 2)
                                .map((x: string) => x[0])
                                .join("")
                                .toUpperCase()
                            return (
                                <div
                                    key={m.id}
                                    style={{
                                        padding: 12,
                                        border: "1px solid #edf1f3",
                                        borderRadius: 12,
                                        background: "#fff",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 9,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 10,
                                                background: `${accentColor}10`,
                                                color: accentColor,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: 10.5,
                                                fontWeight: 850,
                                            }}
                                        >
                                            {initials}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div
                                                style={{
                                                    fontSize: 12.5,
                                                    fontWeight: 750,
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
                                                {m.rol === "dueño"
                                                    ? "Dueño"
                                                    : m.rol || "Profesional"}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div
                                                style={{
                                                    fontSize: 15,
                                                    fontWeight: 780,
                                                    color: "#111827",
                                                }}
                                            >
                                                {m.turnos}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 9.5,
                                                    color: "#94a3b8",
                                                }}
                                            >
                                                turnos
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                width: 82,
                                                textAlign: "right",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 12.5,
                                                    fontWeight: 760,
                                                    color: accentColor,
                                                }}
                                            >
                                                {TurnitsDashboard_money(
                                                    m.facturacion
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 9.5,
                                                    color: "#94a3b8",
                                                }}
                                            >
                                                facturación
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 5,
                                            marginTop: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                flex: 1,
                                                height: 5,
                                                borderRadius: 99,
                                                background: "#eef2f4",
                                                overflow: "hidden",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${Math.min(100, resumenParaMostrar?.totales?.turnos ? (m.turnos / resumenParaMostrar.totales.turnos) * 100 : 0)}%`,
                                                    height: "100%",
                                                    background: accentColor,
                                                    borderRadius: 99,
                                                }}
                                            />
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 9.5,
                                                color: "#94a3b8",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {m.ticket_promedio
                                                ? `${TurnitsDashboard_money(m.ticket_promedio)} / turno`
                                                : "Sin actividad"}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <RendimientoEquipo_EmptyState
                        imagen={ilustracionVacia}
                        texto="Todavía no hay profesionales con actividad en este período."
                        isMobile={isMobile}
                    />
                )}

                {resumenParaMostrar?.totales && (
                    <div
                        style={{
                            padding: 12,
                            borderRadius: 12,
                            background: "#f8fafb",
                            display: "grid",
                            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                            gap: 8,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 9.5, color: "#94a3b8" }}>
                                Turnos
                            </div>
                            <div
                                style={{
                                    fontSize: 16,
                                    fontWeight: 800,
                                    color: "#111827",
                                    marginTop: 3,
                                }}
                            >
                                {resumenParaMostrar.totales.turnos}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9.5, color: "#94a3b8" }}>
                                Facturación
                            </div>
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color: accentColor,
                                    marginTop: 3,
                                }}
                            >
                                {TurnitsDashboard_money(
                                    resumenParaMostrar.totales.facturacion
                                )}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9.5, color: "#94a3b8" }}>
                                Ticket
                            </div>
                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color: "#111827",
                                    marginTop: 3,
                                }}
                            >
                                {TurnitsDashboard_money(
                                    resumenParaMostrar.totales.ticket_promedio
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    /* ─────────────────────── Variante "resumen" ────────────────────── */
    const integranteActual =
        equipoParaMostrar.find((m: any) => m.id === equipoId) ||
        equipoParaMostrar[0]
    const sinTurnosEnPeriodo =
        !cargandoResumen &&
        !cargandoDatos &&
        !dataParaMostrar?.detalle?.length &&
        Number(
            integranteResumen?.turnos ?? dataParaMostrar?.cantidadTurnos ?? 0
        ) === 0

    return (
        <div
            style={{
                ...RendimientoEquipo_makeCardBase(isMobile),
                gap: 14,
                ...style,
            }}
        >
            {/* Encabezado del integrante, como en el boceto: avatar + nombre desplegable. */}
            <style>{RendimientoEquipo_shimmerCSS}</style>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 9,
                    width: "100%",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        minWidth: 0,
                    }}
                >
                    <div
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: integranteActual?.color || "#e5e5e5",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                            overflow: "hidden",
                        }}
                    >
                        {integranteActual?.foto_url ? (
                            <img
                                src={integranteActual.foto_url}
                                alt=""
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                            />
                        ) : (
                            (integranteActual?.nombre || "P")
                                .slice(0, 1)
                                .toUpperCase()
                        )}
                    </div>
                    <select
                        value={equipoId}
                        onChange={(e) => {
                            seleccionManualRef.current = true
                            setEquipoId(e.target.value)
                        }}
                        disabled={isCanvas}
                        aria-label="Elegir integrante del equipo"
                        style={{
                            border: 0,
                            padding: "4px 18px 4px 0",
                            background: "transparent",
                            color: "#111827",
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            outline: "none",
                            maxWidth: "100%",
                        }}
                    >
                        {equipoParaMostrar.map((m: any) => (
                            <option key={m.id} value={m.id}>
                                {[m.nombre, m.apellido]
                                    .filter(Boolean)
                                    .join(" ") || m.nombre}
                            </option>
                        ))}
                    </select>
                </div>
                <span
                    style={{
                        fontSize: 10.5,
                        color: "#94a3b8",
                        whiteSpace: "nowrap",
                    }}
                >
                    Este mes
                </span>
            </div>

            {/* Métricas principales */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 8,
                }}
            >
                {[
                    {
                        label: "Ingresos Brutos",
                        value:
                            cargandoDatos || cargandoResumen
                                ? "…"
                                : TurnitsDashboard_money(
                                      integranteResumen?.facturacion ??
                                          dataParaMostrar?.facturacion ??
                                          0
                                  ),
                    },
                    {
                        label: "Horas Trabajadas",
                        value: cargandoDatos ? "…" : horasTrabajadas,
                    },
                ].map((metric) => (
                    <div key={metric.label} style={{ minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: 12,
                                color: "#171717",
                                marginBottom: 8,
                            }}
                        >
                            {metric.label}
                        </div>
                        <div
                            style={{
                                minHeight: 64,
                                padding: "10px 8px",
                                borderRadius: 13,
                                background: "#f0f0f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#050505",
                                fontSize: isMobile ? 21 : 25,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                                letterSpacing: "-0.5px",
                            }}
                        >
                            {(metric.label === "Ingresos Brutos" &&
                                (cargandoDatos || cargandoResumen)) ||
                            (metric.label === "Horas Trabajadas" &&
                                cargandoDatos) ? (
                                <RendimientoEquipo_Spinner />
                            ) : (
                                metric.value
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Detalle: para poder "llevar la cuenta" turno por turno */}
            {!!dataParaMostrar?.detalle?.length && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        maxHeight: isMobile ? 150 : 190,
                        overflowY: "auto",
                        marginTop: 2,
                    }}
                >
                    {dataParaMostrar.detalle.map((t: any) => (
                        <div
                            key={t.id}
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 10px",
                                borderRadius: 10,
                                background: "#fafbfc",
                                border: "1px solid #f1f5f9",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    minWidth: 0,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: isMobile ? 12 : 13,
                                        fontWeight: 700,
                                        color: "#0f172a",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                    }}
                                >
                                    {t.cliente || "Cliente"}
                                </span>
                                <span
                                    style={{
                                        fontSize: isMobile ? 10 : 11,
                                        color: "#94a3b8",
                                    }}
                                >
                                    {t.fecha?.slice(5)} · {t.hora} ·{" "}
                                    {t.servicio || "Servicio"}
                                </span>
                            </div>
                            <span
                                style={{
                                    fontSize: isMobile ? 12 : 13,
                                    fontWeight: 700,
                                    color: "#0f172a",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                ${Number(t.monto || 0).toLocaleString("es-AR")}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {sinTurnosEnPeriodo && (
                <RendimientoEquipo_EmptyState
                    imagen={ilustracionVacia}
                    texto={`${integranteActual?.nombre || "Este integrante"} no tiene turnos en este período.`}
                    isMobile={isMobile}
                />
            )}
        </div>
    )
}

function IngresosEstimados(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        style,
    } = props

    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }

        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let pollInterval: ReturnType<typeof setInterval> | null = null
        let retries = 0

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada. Volvé a iniciar sesión.")
                    setLoading(false)
                    if (pollInterval) clearInterval(pollInterval)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                if (result?.turnosLista !== undefined) {
                    setStats(result)
                    setError("")
                } else {
                    setError("Respuesta inesperada del servidor.")
                }
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = IngresosEstimados_getSlug()
            const token = IngresosEstimados_getToken()
            if (slug && token) {
                fetchData(slug, token)
                pollInterval = setInterval(() => fetchData(slug, token), 60000)
                return
            }
            if (++retries >= 10) {
                setError(
                    !slug
                        ? "Falta ?u=slug en la URL."
                        : "Sin sesión. Iniciá sesión primero."
                )
                setLoading(false)
                return
            }
            retryTimer = setTimeout(tryInit, 300)
        }

        tryInit()

        const onCancelado = () => {
            const s = IngresosEstimados_getSlug()
            const t = IngresosEstimados_getToken()
            if (s && t) fetchData(s, t)
        }
        window.addEventListener("turno_cancelado", onCancelado)
        return () => {
            if (retryTimer) clearTimeout(retryTimer)
            if (pollInterval) clearInterval(pollInterval)
            window.removeEventListener("turno_cancelado", onCancelado)
        }
    }, [baseUrl])

    if (false) {
        return (
            <IngresosEstimados_CardShell
                stats={IngresosEstimados_MOCK_STATS}
                accentColor={accentColor}
                style={style}
            />
        )
    }

    if (loading) return <IngresosEstimados_LoadingSkeleton style={style} />
    if (error || !stats)
        return <IngresosEstimados_ErrorState error={error} style={style} />

    return (
        <IngresosEstimados_CardShell
            stats={stats}
            accentColor={accentColor}
            style={style}
        />
    )
}

function IngresosEstimados_LoadingSkeleton({ style }: any) {
    const { isMobile } = IngresosEstimados_useBreakpoint()
    const skeletons: [string, number, number][] = [
        ["50%", 13, 0],
        ["38%", isMobile ? 32 : 40, 10],
        ["60%", 11, 8],
        ["100%", 1, 18],
        ["100%", isMobile ? 40 : 52, 12],
    ]
    return (
        <div style={{ ...IngresosEstimados_makeCardBase(isMobile), ...style }}>
            {skeletons.map(([w, h, mt], i) => (
                <div
                    key={i}
                    style={{
                        width: w,
                        height: h,
                        borderRadius: 6,
                        marginTop: mt,
                        background:
                            "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite",
                    }}
                />
            ))}
            <style>{IngresosEstimados_shimmerCSS}</style>
        </div>
    )
}

function IngresosEstimados_ErrorState({ error, style }: any) {
    const { isMobile } = IngresosEstimados_useBreakpoint()
    return (
        <div style={{ ...IngresosEstimados_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 14,
                }}
            >
                <span style={IngresosEstimados_makeTitleStyle(isMobile)}>
                    Ingresos Estimados
                </span>
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        fontStyle: "italic",
                    }}
                >
                    {error || "Aún no hay datos."}
                </span>
            </div>
        </div>
    )
}

function IngresosEstimados_CardShell({ stats, accentColor, style }: any) {
    const { isMobile } = IngresosEstimados_useBreakpoint()

    const now = new Date()
    const hoyISO = now.toISOString().split("T")[0]
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const turnosLista = stats.turnosLista || []
    const config = stats.config || {}

    const ingresosMes = IngresosEstimados_calcularIngresos(
        turnosLista,
        mesActual
    )
    const ingresosHoy = IngresosEstimados_calcularIngresosHoy(
        turnosLista,
        hoyISO
    )

    const turnosMes = stats.turnosMes || 0
    const turnosHoy = stats.turnosHoy || 0
    const ticket = stats.ventas?.ticketPromedio || 0

    const metodo = config.metodo_pago || "none"
    const porcentajeSena = config.porcentaje_sena || 30
    const cobraOnline = metodo === "sena" || metodo === "total"
    const labelMetodo =
        metodo === "sena"
            ? `Seña ${porcentajeSena}% por turno`
            : metodo === "total"
              ? "Pago total online"
              : "Sin cobro online"

    const ultimos7 = IngresosEstimados_buildUltimos7(stats.ventasPorDia || {})
    const maxTurnos = Math.max(...ultimos7.map((d) => d.turnos), 1)

    const totalEstimado = ingresosMes.total

    return (
        <div style={{ ...IngresosEstimados_makeCardBase(isMobile), ...style }}>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                }}
            >
                <span style={IngresosEstimados_makeTitleStyle(isMobile)}>
                    Ingresos
                </span>
            </div>

            {/* NÚMERO GRANDE — total estimado */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ margin: isMobile ? "6px 0 12px" : "8px 0 14px" }}
            >
                <div
                    style={{
                        fontSize: isMobile ? 36 : 44,
                        fontWeight: 700,
                        color: accentColor,
                        lineHeight: 1,
                        letterSpacing: "-2px",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {IngresosEstimados_formatCurrency(totalEstimado)}
                </div>
                <div
                    style={{
                        fontSize: isMobile ? 9 : 10,
                        color: "#94a3b8",
                        marginTop: 3,
                        fontWeight: 500,
                    }}
                >
                    Total estimado del mes
                </div>
                {ticket > 0 && (
                    <div
                        style={{
                            fontSize: isMobile ? 10 : 11,
                            color: "#94a3b8",
                            marginTop: 2,
                        }}
                    >
                        Ticket promedio {IngresosEstimados_formatFull(ticket)}
                    </div>
                )}
            </motion.div>

            {/* CHIPS: Mercado Pago / Transferencia / Efectivo */}
            <div
                style={{
                    display: "flex",
                    gap: isMobile ? 5 : 8,
                    marginBottom: isMobile ? 10 : 12,
                }}
            >
                <IngresosEstimados_IngresoChip
                    label="Mercado Pago"
                    valor={IngresosEstimados_formatCurrency(
                        ingresosMes.mercadopago
                    )}
                    sub={`hoy ${IngresosEstimados_formatCurrency(ingresosHoy.mercadopago)}`}
                    color="#3b82f6"
                    isMobile={isMobile}
                />
                <IngresosEstimados_IngresoChip
                    label="Transferencia"
                    valor={IngresosEstimados_formatCurrency(
                        ingresosMes.transferencia
                    )}
                    sub={`hoy ${IngresosEstimados_formatCurrency(ingresosHoy.transferencia)}`}
                    color="#8b5cf6"
                    isMobile={isMobile}
                />
                <IngresosEstimados_IngresoChip
                    label="Efectivo"
                    valor={IngresosEstimados_formatCurrency(
                        ingresosMes.efectivo
                    )}
                    sub={`hoy ${IngresosEstimados_formatCurrency(ingresosHoy.efectivo)}`}
                    color="#10b981"
                    isMobile={isMobile}
                />
            </div>

            {/* ÚLTIMOS 7 DÍAS */}
            <span
                style={{
                    ...IngresosEstimados_makeSectionTitle(isMobile),
                    marginBottom: isMobile ? 8 : 10,
                    display: "block",
                }}
            >
                Últimos 7 días
            </span>

            <div style={{ display: "flex", gap: isMobile ? 3 : 5, flex: 1 }}>
                {ultimos7.map((d, i) => {
                    const esHoy = i === 6
                    const ratio = d.turnos / maxTurnos
                    return (
                        <motion.div
                            key={d.iso}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: isMobile ? 3 : 5,
                                padding: isMobile
                                    ? "8px 2px 6px"
                                    : "10px 4px 8px",
                                borderRadius: isMobile ? 8 : 12,
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
                                    fontSize: isMobile ? 8 : 9,
                                    fontWeight: 600,
                                    color: esHoy ? accentColor : "#94a3b8",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                }}
                            >
                                {isMobile ? String(d.diaNum) : d.diaSem}
                            </span>
                            <span
                                style={{
                                    fontSize:
                                        d.turnos === 0
                                            ? isMobile
                                                ? 12
                                                : 14
                                            : (isMobile ? 10 : 12) +
                                              Math.round(ratio * 7),
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums",
                                    color:
                                        d.turnos === 0
                                            ? "#e2e8f0"
                                            : esHoy || ratio >= 0.7
                                              ? accentColor
                                              : `rgba(34,197,94,${0.35 + ratio * 0.65})`,
                                }}
                            >
                                {d.turnos}
                            </span>
                            {!isMobile && (
                                <span
                                    style={{
                                        fontSize: 9,
                                        color: esHoy ? accentColor : "#cbd5e1",
                                        fontWeight: esHoy ? 700 : 400,
                                    }}
                                >
                                    {d.diaNum}
                                </span>
                            )}
                        </motion.div>
                    )
                })}
            </div>

            {/* MÉTODO DE PAGO ONLINE (config de Mercado Pago) */}
            <div
                style={{
                    marginTop: isMobile ? 10 : 14,
                    background: "#f8fafc",
                    borderRadius: 12,
                    padding: isMobile ? "8px 12px" : "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <span
                    style={{
                        fontSize: isMobile ? 11 : 12,
                        color: "#94a3b8",
                        fontWeight: 500,
                        flexShrink: 0,
                    }}
                >
                    Cobro online (MP)
                </span>
                <span
                    style={{
                        fontSize: isMobile ? 11 : 12,
                        fontWeight: 600,
                        color: cobraOnline ? "#334155" : "#cbd5e1",
                        textAlign: "right",
                    }}
                >
                    {labelMetodo}
                </span>
            </div>

            <style>{IngresosEstimados_shimmerCSS}</style>
        </div>
    )
}

function IngresosEstimados_IngresoChip({
    label,
    valor,
    sub,
    color,
    isMobile,
}: any) {
    return (
        <div
            style={{
                flex: 1,
                padding: isMobile ? "7px 8px" : "10px 12px",
                borderRadius: 12,
                background: `${color}0c`,
                minWidth: 0,
            }}
        >
            <div
                style={{
                    fontSize: isMobile ? 8 : 10,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: 3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: isMobile ? 12 : 14,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: "#1e293b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {valor}
            </div>
            <div
                style={{
                    fontSize: isMobile ? 8 : 9,
                    color,
                    fontWeight: 600,
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {sub}
            </div>
        </div>
    )
}

function TurnosMes(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        onVerAgenda,
        style,
    } = props

    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }

        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let pollInterval: ReturnType<typeof setInterval> | null = null
        let retries = 0

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada. Volvé a iniciar sesión.")
                    setLoading(false)
                    if (pollInterval) clearInterval(pollInterval)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                if (result?.turnosMes !== undefined) {
                    setStats(result)
                    setError("")
                } else {
                    setError("Respuesta inesperada del servidor.")
                }
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = TurnosMes_getSlug()
            const token = TurnosMes_getToken()
            if (slug && token) {
                fetchData(slug, token)
                pollInterval = setInterval(() => fetchData(slug, token), 60000)
                return
            }
            if (++retries >= 10) {
                setError(
                    !slug
                        ? "Falta ?u=slug en la URL."
                        : "Sin sesión. Iniciá sesión primero."
                )
                setLoading(false)
                return
            }
            retryTimer = setTimeout(tryInit, 300)
        }

        tryInit()

        const onCancelado = () => {
            const s = TurnosMes_getSlug()
            const t = TurnosMes_getToken()
            if (s && t) fetchData(s, t)
        }
        window.addEventListener("turno_cancelado", onCancelado)

        return () => {
            if (retryTimer) clearTimeout(retryTimer)
            if (pollInterval) clearInterval(pollInterval)
            window.removeEventListener("turno_cancelado", onCancelado)
        }
    }, [baseUrl])

    if (false) {
        return (
            <TurnosMes_CardShell
                stats={TurnosMes_MOCK_STATS}
                accentColor={accentColor}
                onVerAgenda={onVerAgenda}
                style={style}
            />
        )
    }

    if (loading) return <TurnosMes_LoadingSkeleton style={style} />
    if (error || !stats)
        return <TurnosMes_ErrorState error={error} style={style} />

    return (
        <TurnosMes_CardShell
            stats={stats}
            accentColor={accentColor}
            onVerAgenda={onVerAgenda}
            style={style}
        />
    )
}

function TurnosMes_LoadingSkeleton({ style }: any) {
    const { isMobile } = TurnosMes_useBreakpoint()
    return (
        <div style={{ ...TurnosMes_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    width: "45%",
                    height: 13,
                    borderRadius: 6,
                    marginBottom: isMobile ? 14 : 20,
                    background:
                        "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.4s infinite",
                }}
            />
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: isMobile ? 10 : 16,
                }}
            >
                {[60, 90, 45, 75].map((h, i) => (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            maxWidth: isMobile ? 34 : 46,
                            height: `${h}%`,
                            borderRadius: isMobile ? 8 : 10,
                            background:
                                "linear-gradient(180deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                            backgroundSize: "100% 200%",
                            animation: "shimmer 1.4s infinite",
                        }}
                    />
                ))}
            </div>
            <style>{TurnosMes_shimmerCSS}</style>
        </div>
    )
}

function TurnosMes_ErrorState({ error, style }: any) {
    const { isMobile } = TurnosMes_useBreakpoint()
    return (
        <div style={{ ...TurnosMes_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 14,
                }}
            >
                <span style={TurnosMes_makeTitleStyle(isMobile)}>
                    Turnos del Mes
                </span>
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        fontStyle: "italic",
                        textAlign: "center",
                    }}
                >
                    {error || "Aún no hay datos."}
                </span>
            </div>
        </div>
    )
}

function TurnosMes_CardShell({ stats, accentColor, onVerAgenda, style }: any) {
    const { isMobile } = TurnosMes_useBreakpoint()

    const turnosMes = stats.turnosMes || 0
    const tramoMes = stats.comparativas?.mes
    const turnosComparablesActuales = Number(
        tramoMes?.actual?.turnos ?? stats.turnosMes ?? 0
    )
    const turnosMesAnterior = Number(
        tramoMes?.anterior?.turnos ?? stats.turnosMesAnterior ?? 0
    )
    const turnosHoy = stats.turnosHoy || 0
    const chartData: { label: string; turnos: number }[] = stats.chartData || []
    const maxSemana = Math.max(1, ...chartData.map((d) => d.turnos))
    const barMaxHeight = isMobile ? 60 : 80

    // La tendencia compara el avance hasta hoy con los mismos días del mes anterior.
    const hayComparacionMes = turnosMesAnterior > 0
    const diffMes = turnosComparablesActuales - turnosMesAnterior
    const pctMes = hayComparacionMes
        ? Math.round((diffMes / turnosMesAnterior) * 100)
        : null
    const subeMes = diffMes > 0
    const bajaMes = diffMes < 0

    return (
        <div style={{ ...TurnosMes_makeCardBase(isMobile), ...style }}>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                    gap: 8,
                }}
            >
                <span style={TurnosMes_makeTitleStyle(isMobile)}>
                    Turnos del Mes
                </span>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                    }}
                >
                    {pctMes !== null && (
                        <span
                            title="Comparado con el mismo tramo del mes anterior"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: isMobile ? 9 : 10,
                                fontWeight: 700,
                                color: bajaMes ? "#ef4444" : accentColor,
                                background: bajaMes
                                    ? "#ef444412"
                                    : `${accentColor}12`,
                                padding: "3px 7px",
                                borderRadius: 20,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {subeMes ? "↑" : bajaMes ? "↓" : ""}{" "}
                            {Math.abs(pctMes)}%
                        </span>
                    )}
                    {turnosHoy > 0 && (
                        <span
                            style={{
                                fontSize: isMobile ? 9 : 10,
                                fontWeight: 700,
                                color: "#64748b",
                                background: "#f1f5f9",
                                padding: "3px 7px",
                                borderRadius: 20,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {turnosHoy} hoy
                        </span>
                    )}
                </div>
            </div>

            {/* NÚMERO GRANDE */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ margin: isMobile ? "6px 0 14px" : "8px 0 18px" }}
            >
                <div
                    style={{
                        fontSize: isMobile ? 36 : 44,
                        fontWeight: 700,
                        color: accentColor,
                        lineHeight: 1,
                        letterSpacing: "-2px",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {turnosMes}
                </div>
            </motion.div>

            {/* GRÁFICO DE TORRES */}
            {chartData.length > 0 ? (
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: isMobile ? 10 : 16,
                        minHeight: 0,
                    }}
                >
                    {chartData.map((d, i) => {
                        const h = Math.max(
                            6,
                            (d.turnos / maxSemana) * barMaxHeight
                        )
                        const pctSemana =
                            turnosMes > 0
                                ? Math.round((d.turnos / turnosMes) * 100)
                                : 0
                        return (
                            <div
                                key={i}
                                style={{
                                    flex: 1,
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    gap: isMobile ? 6 : 8,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: isMobile ? 12 : 14,
                                        fontWeight: 700,
                                        color: "#1e293b",
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {pctSemana}%
                                </span>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: h }}
                                    transition={{
                                        duration: 0.45,
                                        delay: i * 0.06,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        width: "100%",
                                        maxWidth: isMobile ? 34 : 46,
                                        borderRadius: isMobile ? 8 : 10,
                                        background: accentColor,
                                        opacity:
                                            d.turnos === 0
                                                ? 0.15
                                                : 0.35 +
                                                  0.65 * (d.turnos / maxSemana),
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: isMobile ? 10 : 11,
                                        color: "#94a3b8",
                                        fontWeight: 600,
                                    }}
                                >
                                    {d.label}
                                </span>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <span
                        style={{
                            fontSize: 13,
                            color: "#cbd5e1",
                            fontStyle: "italic",
                        }}
                    >
                        Sin turnos este mes.
                    </span>
                </div>
            )}

            {/* FOOTER */}
            {onVerAgenda && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        marginTop: isMobile ? 12 : 16,
                        paddingTop: isMobile ? 10 : 12,
                        borderTop: "1px solid #f1f5f9",
                    }}
                >
                    <button
                        onClick={onVerAgenda}
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: isMobile ? 11 : 12,
                            fontWeight: 700,
                            color: accentColor,
                            cursor: "pointer",
                            padding: 0,
                            letterSpacing: "0.02em",
                        }}
                    >
                        Ver agenda
                    </button>
                </div>
            )}

            <style>{TurnosMes_shimmerCSS}</style>
        </div>
    )
}

function ClientesCard(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        style,
    } = props

    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }

        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let pollInterval: ReturnType<typeof setInterval> | null = null
        let retries = 0

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada. Volvé a iniciar sesión.")
                    setLoading(false)
                    if (pollInterval) clearInterval(pollInterval)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                if (result?.totalClientes !== undefined) {
                    setStats(result)
                    setError("")
                } else {
                    setError("Respuesta inesperada del servidor.")
                }
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = ClientesCard_getSlug()
            const token = ClientesCard_getToken()
            if (slug && token) {
                fetchData(slug, token)
                pollInterval = setInterval(() => fetchData(slug, token), 60000)
                return
            }
            if (++retries >= 10) {
                setError(
                    !slug
                        ? "Falta ?u=slug en la URL."
                        : "Sin sesión. Iniciá sesión primero."
                )
                setLoading(false)
                return
            }
            retryTimer = setTimeout(tryInit, 300)
        }

        tryInit()
        return () => {
            if (retryTimer) clearTimeout(retryTimer)
            if (pollInterval) clearInterval(pollInterval)
        }
    }, [baseUrl])

    if (false) {
        return (
            <ClientesCard_CardShell
                stats={ClientesCard_MOCK_STATS}
                accentColor={accentColor}
                style={style}
            />
        )
    }

    if (loading) return <ClientesCard_LoadingSkeleton style={style} />
    if (error || !stats)
        return <ClientesCard_ErrorState error={error} style={style} />

    return (
        <ClientesCard_CardShell
            stats={stats}
            accentColor={accentColor}
            style={style}
        />
    )
}

function ClientesCard_LoadingSkeleton({ style }: any) {
    const { isMobile } = ClientesCard_useBreakpoint()
    const skeletons: [string, number, number][] = [
        ["45%", 13, 0],
        ["30%", isMobile ? 34 : 44, 10],
        ["100%", 8, 16],
        ["100%", isMobile ? 40 : 52, 14],
    ]
    return (
        <div style={{ ...ClientesCard_makeCardBase(isMobile), ...style }}>
            {skeletons.map(([w, h, mt], i) => (
                <div
                    key={i}
                    style={{
                        width: w,
                        height: h,
                        borderRadius: 6,
                        marginTop: mt,
                        background:
                            "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite",
                    }}
                />
            ))}
            <style>{ClientesCard_shimmerCSS}</style>
        </div>
    )
}

function ClientesCard_ErrorState({ error, style }: any) {
    const { isMobile } = ClientesCard_useBreakpoint()
    return (
        <div style={{ ...ClientesCard_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 14,
                }}
            >
                <span style={ClientesCard_makeTitleStyle(isMobile)}>
                    Clientes
                </span>
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        fontStyle: "italic",
                        textAlign: "center",
                    }}
                >
                    {error || "Aún no hay datos."}
                </span>
            </div>
        </div>
    )
}

function ClientesCard_CardShell({ stats, accentColor, style }: any) {
    const { isMobile } = ClientesCard_useBreakpoint()

    const totalClientes = stats.totalClientes || 0
    const clientesNuevos = stats.clientesNuevos || 0
    const clientesNuevosMesAnterior = stats.clientesNuevosMesAnterior || 0
    const clientesRecurrentes = stats.clientesRecurrentes || 0
    const clientesFrecuentes = stats.clientesFrecuentes || 0

    const pctNuevos =
        totalClientes > 0
            ? Math.round((clientesNuevos / totalClientes) * 100)
            : 0
    const pctFrecuentes =
        totalClientes > 0
            ? Math.round((clientesFrecuentes / totalClientes) * 100)
            : 0

    // Tendencia real: clientes nuevos este mes vs. clientes nuevos el mes pasado
    // (antes la "insignia" comparaba nuevos contra el total, algo que no dice
    // si el negocio está captando más o menos gente que el mes anterior).
    const hayComparacion = clientesNuevosMesAnterior > 0
    const diffNuevos = clientesNuevos - clientesNuevosMesAnterior
    const pctTendencia = hayComparacion
        ? Math.round((diffNuevos / clientesNuevosMesAnterior) * 100)
        : null
    const tendenciaSube = diffNuevos > 0
    const tendenciaBaja = diffNuevos < 0

    return (
        <div style={{ ...ClientesCard_makeCardBase(isMobile), ...style }}>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                }}
            >
                <span style={ClientesCard_makeTitleStyle(isMobile)}>
                    Clientes
                </span>
                {pctTendencia !== null && (
                    <span
                        style={{
                            fontSize: isMobile ? 9 : 10,
                            fontWeight: 700,
                            color: tendenciaBaja ? "#ef4444" : accentColor,
                            background: tendenciaBaja
                                ? "#ef444412"
                                : `${accentColor}12`,
                            padding: "3px 7px",
                            borderRadius: 20,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {tendenciaSube ? "+" : tendenciaBaja ? "-" : ""}
                        {Math.abs(pctTendencia)}%
                    </span>
                )}
            </div>

            {/* SUBTÍTULO: cuántos son nuevos este mes, en criollo */}
            <span
                style={{
                    fontSize: isMobile ? 11 : 12,
                    color: "#94a3b8",
                    fontWeight: 500,
                }}
            >
                {clientesNuevos > 0
                    ? `${clientesNuevos} ${clientesNuevos === 1 ? "cliente nuevo" : "clientes nuevos"} este mes`
                    : "Sin clientes nuevos este mes"}
            </span>

            {/* NÚMERO GRANDE */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ margin: isMobile ? "4px 0 10px" : "6px 0 12px" }}
            >
                <div
                    style={{
                        fontSize: isMobile ? 34 : 42,
                        fontWeight: 700,
                        color: accentColor,
                        lineHeight: 1,
                        letterSpacing: "-2px",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {totalClientes}
                </div>
                <div
                    style={{
                        fontSize: isMobile ? 9 : 10,
                        color: "#cbd5e1",
                        fontWeight: 500,
                        marginTop: 2,
                    }}
                >
                    clientes en total
                </div>
            </motion.div>

            {/* BARRA COMPOSICIÓN: nuevos vs recurrentes, sobre el total real */}
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: isMobile ? 6 : 7,
                    borderRadius: 20,
                    overflow: "hidden",
                    background: "#f1f5f9",
                    marginBottom: isMobile ? 4 : 6,
                }}
            >
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctNuevos}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ background: accentColor, height: "100%" }}
                />
                <div
                    style={{
                        width: `${Math.max(0, 100 - pctNuevos)}%`,
                        background: "#cbd5e1",
                        height: "100%",
                    }}
                />
            </div>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: isMobile ? 8 : 9,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: isMobile ? 10 : 14,
                }}
            >
                <span>● Nuevos ({pctNuevos}%)</span>
                <span>● Recurrentes ({Math.max(0, 100 - pctNuevos)}%)</span>
            </div>

            {/* CHIPS RESUMEN — ahora con datos reales, no estimados */}
            <div
                style={{
                    display: "flex",
                    gap: isMobile ? 6 : 8,
                }}
            >
                <ClientesCard_ResumenChip
                    label="Nuevos"
                    valor={String(clientesNuevos)}
                    sub="este mes"
                    accentColor={accentColor}
                    highlight
                    isMobile={isMobile}
                />
                <ClientesCard_ResumenChip
                    label="Recurrentes"
                    valor={String(clientesRecurrentes)}
                    sub="ya te conocían"
                    isMobile={isMobile}
                />
                <ClientesCard_ResumenChip
                    label="Frecuentes"
                    valor={String(clientesFrecuentes)}
                    sub={`3+ visitas · ${pctFrecuentes}%`}
                    isMobile={isMobile}
                />
            </div>

            <style>{ClientesCard_shimmerCSS}</style>
        </div>
    )
}

function ClientesCard_ResumenChip({
    label,
    valor,
    sub,
    accentColor,
    highlight,
    isMobile,
}: any) {
    return (
        <div
            style={{
                flex: 1,
                padding: isMobile ? "6px 7px" : "8px 9px",
                borderRadius: 10,
                background: highlight ? `${accentColor}0d` : "#f8fafc",
                minWidth: 0,
            }}
        >
            <div
                style={{
                    fontSize: isMobile ? 8 : 9,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: highlight ? accentColor : "#1e293b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {valor}
            </div>
            {sub && (
                <div
                    style={{
                        fontSize: isMobile ? 7 : 8,
                        color: "#cbd5e1",
                        marginTop: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {sub}
                </div>
            )}
        </div>
    )
}

function MejoresDias(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        style,
    } = props
    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }
        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let pollInterval: ReturnType<typeof setInterval> | null = null
        let retries = 0

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada.")
                    setLoading(false)
                    if (pollInterval) clearInterval(pollInterval)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                if (result?.horarios !== undefined) {
                    setStats(result)
                    setError("")
                } else setError("Respuesta inesperada.")
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = MejoresDias_getSlug()
            const token = MejoresDias_getToken()
            if (slug && token) {
                fetchData(slug, token)
                pollInterval = setInterval(() => fetchData(slug, token), 60000)
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
            if (pollInterval) clearInterval(pollInterval)
        }
    }, [baseUrl])

    if (false)
        return (
            <MejoresDias_CardShell
                stats={MejoresDias_MOCK_STATS}
                accentColor={accentColor}
                style={style}
            />
        )

    if (loading) return <MejoresDias_LoadingSkeleton style={style} />
    if (error || !stats)
        return <MejoresDias_ErrorState error={error} style={style} />

    return (
        <MejoresDias_CardShell
            stats={stats}
            accentColor={accentColor}
            style={style}
        />
    )
}

function MejoresDias_LoadingSkeleton({ style }: any) {
    const { isMobile } = MejoresDias_useBreakpoint()
    const skeletons: [string, number, number][] = [
        ["45%", 13, 0],
        ["55%", 11, 10],
        ["100%", 1, 14],
        ["100%", isMobile ? 38 : 48, 10],
        ["100%", isMobile ? 38 : 48, 8],
        ["100%", isMobile ? 38 : 48, 8],
    ]
    return (
        <div style={{ ...MejoresDias_makeCardBase(isMobile), ...style }}>
            {skeletons.map(([w, h, mt], i) => (
                <div
                    key={i}
                    style={{
                        width: w,
                        height: h,
                        borderRadius: 8,
                        marginTop: mt,
                        background:
                            "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite",
                    }}
                />
            ))}
            <style>{MejoresDias_shimmerCSS}</style>
        </div>
    )
}

function MejoresDias_ErrorState({ error, style }: any) {
    const { isMobile } = MejoresDias_useBreakpoint()
    return (
        <div style={{ ...MejoresDias_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 14,
                }}
            >
                <span style={MejoresDias_makeTitleStyle(isMobile)}>
                    Mejores Días
                </span>
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        fontStyle: "italic",
                    }}
                >
                    {error || "Aún no hay datos."}
                </span>
            </div>
        </div>
    )
}

function MejoresDias_CardShell({ stats, accentColor, style }: any) {
    const { isMobile } = MejoresDias_useBreakpoint()

    const horarios = stats.horarios || {}
    const turnosMes = stats.turnosMes || 0

    const ranking = MejoresDias_calcularRanking(
        stats.turnosLista || [],
        horarios
    )
    const diasActivos = ranking.length

    const colorForRank = (i: number, total: number): string => {
        if (total === 0) return "#e2e8f0"
        if (i === 0) return accentColor
        if (i === 1) return `${accentColor}bb`
        if (i === 2) return `${accentColor}77`
        return "#94a3b8"
    }

    return (
        <div style={{ ...MejoresDias_makeCardBase(isMobile), ...style }}>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                }}
            >
                <span style={MejoresDias_makeTitleStyle(isMobile)}>
                    Mejores Días
                </span>
            </div>

            <span
                style={{
                    fontSize: isMobile ? 11 : 12,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: isMobile ? 12 : 16,
                }}
            >
                Top {diasActivos} · {turnosMes} turnos este mes
            </span>

            <div
                style={{
                    height: 1,
                    background: "#f1f5f9",
                    marginBottom: isMobile ? 10 : 14,
                }}
            />

            {/* RANKING */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 4 : 6,
                    flex: 1,
                }}
            >
                {ranking.length === 0 ? (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                color: "#cbd5e1",
                                fontStyle: "italic",
                            }}
                        >
                            Aún no hay turnos registrados
                        </span>
                    </div>
                ) : (
                    ranking.map((item, i) => {
                        const esMejor = i === 0
                        const esTop3 = i < 3
                        const color = colorForRank(i, item.total)
                        const bgOpacity = esMejor ? "08" : esTop3 ? "04" : ""
                        // Barra proporcional: el mejor día siempre llena el 100%,
                        // los demás se ven relativos a él — así de un vistazo se
                        // entiende la diferencia real, no solo números sueltos.
                        const maxTotal = ranking[0]?.total || 1
                        const anchoBarra = Math.max(
                            6,
                            Math.round((item.total / maxTotal) * 100)
                        )

                        return (
                            <motion.div
                                key={item.dia}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: isMobile ? 8 : 12,
                                    padding: isMobile
                                        ? "8px 10px"
                                        : "10px 12px",
                                    borderRadius: isMobile ? 10 : 12,
                                    background: esMejor
                                        ? `${accentColor}${bgOpacity}`
                                        : esTop3
                                          ? `${accentColor}${bgOpacity}`
                                          : "#f8fafc",
                                    border: esMejor
                                        ? `1px solid ${accentColor}20`
                                        : "1px solid transparent",
                                }}
                            >
                                {/* Posición */}
                                <span
                                    style={{
                                        fontSize: isMobile ? 10 : 11,
                                        fontWeight: 700,
                                        color:
                                            esTop3 && item.total > 0
                                                ? color
                                                : "#e2e8f0",
                                        width: 14,
                                        textAlign: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    {i + 1}
                                </span>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Nombre + total + badge */}
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            justifyContent: "space-between",
                                            gap: 6,
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 6,
                                                fontSize: isMobile ? 12 : 13,
                                                fontWeight: esMejor
                                                    ? 700
                                                    : esTop3
                                                      ? 600
                                                      : 500,
                                                color:
                                                    item.total > 0
                                                        ? esTop3
                                                            ? color
                                                            : "#64748b"
                                                        : "#cbd5e1",
                                                letterSpacing: esMejor
                                                    ? "-0.2px"
                                                    : "normal",
                                            }}
                                        >
                                            {MejoresDias_DIAS_LABEL[item.dia]}
                                            {esMejor && item.total > 0 && (
                                                <span
                                                    style={{
                                                        fontSize: isMobile
                                                            ? 8
                                                            : 9,
                                                        fontWeight: 700,
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.06em",
                                                        color: accentColor,
                                                        background: "#ffffff",
                                                        padding: isMobile
                                                            ? "2px 4px"
                                                            : "2px 6px",
                                                        borderRadius: 6,
                                                        border: `1px solid ${accentColor}30`,
                                                    }}
                                                >
                                                    top
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: isMobile ? 13 : 15,
                                                fontWeight: 700,
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                                color,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {item.total}
                                            <span
                                                style={{
                                                    fontSize: isMobile ? 9 : 10,
                                                    fontWeight: 500,
                                                    color: "#cbd5e1",
                                                }}
                                            >
                                                {" "}
                                                turnos
                                            </span>
                                        </span>
                                    </div>

                                    {/* BARRA PROPORCIONAL */}
                                    <div
                                        style={{
                                            height: isMobile ? 5 : 6,
                                            borderRadius: 20,
                                            background: "#eef2f6",
                                            marginTop: 5,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{
                                                width: `${anchoBarra}%`,
                                            }}
                                            transition={{
                                                delay: i * 0.05 + 0.1,
                                                duration: 0.4,
                                            }}
                                            style={{
                                                height: "100%",
                                                borderRadius: 20,
                                                background: color,
                                            }}
                                        />
                                    </div>

                                    {/* Horario + participación (% del mes) */}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginTop: 3,
                                            fontSize: isMobile ? 9 : 10,
                                            color: "#94a3b8",
                                        }}
                                    >
                                        <span>{item.horario || ""}</span>
                                        <span>{item.porcentaje}% del mes</span>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </div>

            <style>{MejoresDias_shimmerCSS}</style>
        </div>
    )
}

function TopServicios(props: any) {
    const { baseUrl = appConfig.apiUrl, style } = props
    const [servicios, setServicios] = React.useState<
        TopServicios_ServicioData[]
    >([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setServicios(TopServicios_procesarTurnos(TopServicios_MOCK_TURNOS))
            setLoading(false)
            return
        }
        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let pollInterval: ReturnType<typeof setInterval> | null = null
        let retries = 0

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada.")
                    setLoading(false)
                    if (pollInterval) clearInterval(pollInterval)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                setServicios(
                    TopServicios_procesarTurnos(result?.turnosLista || [])
                )
                setError("")
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = TopServicios_getSlug()
            const token = TopServicios_getToken()
            if (slug && token) {
                fetchData(slug, token)
                pollInterval = setInterval(() => fetchData(slug, token), 60_000)
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
            if (pollInterval) clearInterval(pollInterval)
        }
    }, [baseUrl])

    if (false)
        return (
            <TopServicios_ChartCard
                servicios={TopServicios_procesarTurnos(
                    TopServicios_MOCK_TURNOS
                )}
                style={style}
            />
        )

    if (loading) return <TopServicios_LoadingSkeleton style={style} />

    if (error || servicios.length === 0)
        return <TopServicios_ErrorState error={error} style={style} />

    return <TopServicios_ChartCard servicios={servicios} style={style} />
}

function TopServicios_LoadingSkeleton({ style }: any) {
    const { isMobile } = TopServicios_useBreakpoint()
    return (
        <div style={{ ...TopServicios_makeCardBase(isMobile), ...style }}>
            {(
                [
                    ["55%", 14, 0],
                    ["35%", 11, 6],
                    ["100%", isMobile ? 160 : 200, 16],
                    ["100%", 80, 12],
                ] as [string, number, number][]
            ).map(([w, h, mt], i) => (
                <div
                    key={i}
                    style={{
                        width: w,
                        height: h,
                        borderRadius: 10,
                        marginTop: mt,
                        background:
                            "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite",
                    }}
                />
            ))}
            <style>{TopServicios_shimmerCSS}</style>
        </div>
    )
}

function TopServicios_ErrorState({ error, style }: any) {
    const { isMobile } = TopServicios_useBreakpoint()
    return (
        <div style={{ ...TopServicios_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 18,
                }}
            >
                <div>
                    <div style={TopServicios_makeTitleStyle(isMobile)}>
                        Top Servicios
                    </div>
                    <div
                        style={{
                            fontSize: isMobile ? 10 : 11,
                            color: "#94a3b8",
                            marginTop: 2,
                        }}
                    >
                        Por semana · mes actual
                    </div>
                </div>
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        fontStyle: "italic",
                    }}
                >
                    {error || "Aún no hay servicios registrados."}
                </span>
            </div>
        </div>
    )
}

function TopServicios_ChartCard({
    servicios,
    style,
}: {
    servicios: TopServicios_ServicioData[]
    style?: any
}) {
    const { isMobile } = TopServicios_useBreakpoint()
    const [hoveredSem, setHoveredSem] = React.useState<number | null>(null)
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })
    const containerRef = React.useRef<HTMLDivElement>(null)

    const LABELS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4"]
    const W = 480
    // Chart más chico en mobile
    const H = isMobile ? 170 : 220
    const PAD_L = isMobile ? 20 : 28
    const PAD_R = 12
    const PAD_T = isMobile ? 12 : 18
    const PAD_B = isMobile ? 20 : 26
    const chartW = W - PAD_L - PAD_R
    const chartH = H - PAD_T - PAD_B

    const allVals = servicios.flatMap((s) => s.semanas)
    const maxVal = Math.max(...allVals, 1)
    const toY = (v: number) => PAD_T + chartH - (v / maxVal) * chartH
    const toX = (i: number) => PAD_L + (i / 3) * chartW

    const buildPath = (semanas: number[]) => {
        const pts = semanas.map((v, i) => ({ x: toX(i), y: toY(v) }))
        let d = `M ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i - 1],
                c = pts[i],
                cpX = (p.x + c.x) / 2
            d += ` C ${cpX} ${p.y}, ${cpX} ${c.y}, ${c.x} ${c.y}`
        }
        return d
    }

    const buildArea = (semanas: number[]) => {
        const pts = semanas.map((v, i) => ({ x: toX(i), y: toY(v) }))
        let d = `M ${pts[0].x} ${PAD_T + chartH} L ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i - 1],
                c = pts[i],
                cpX = (p.x + c.x) / 2
            d += ` C ${cpX} ${p.y}, ${cpX} ${c.y}, ${c.x} ${c.y}`
        }
        d += ` L ${pts[pts.length - 1].x} ${PAD_T + chartH} Z`
        return d
    }

    const totalMes = servicios.reduce((acc, s) => acc + s.total, 0)

    // Tooltip — en mobile más angosto
    const TT_W = isMobile ? 160 : 200
    const TT_H = isMobile ? 150 : 180

    return (
        <div style={{ ...TopServicios_makeCardBase(isMobile), ...style }}>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: isMobile ? 14 : 20,
                    flexShrink: 0,
                }}
            >
                <div>
                    <div style={TopServicios_makeTitleStyle(isMobile)}>
                        Top Servicios
                    </div>
                    <div
                        style={{
                            fontSize: isMobile ? 10 : 11,
                            color: "#94a3b8",
                            marginTop: 3,
                            fontWeight: 500,
                        }}
                    >
                        Evolución semanal · mes actual
                    </div>
                </div>
            </div>

            {/* CHART */}
            <div
                ref={containerRef}
                style={{
                    position: "relative",
                    width: "100%",
                    flexShrink: 0,
                    borderRadius: isMobile ? 12 : 16,
                    overflow: "visible",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    zIndex: 1,
                }}
                onMouseLeave={() => setHoveredSem(null)}
                onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect()
                    if (rect)
                        setMousePos({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                        })
                }}
            >
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    width="100%"
                    style={{ display: "block" }}
                >
                    <defs>
                        {servicios.map((s, i) => (
                            <linearGradient
                                key={i}
                                id={`grad3-${i}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor={s.fill}
                                    stopOpacity="0.28"
                                />
                                <stop
                                    offset="75%"
                                    stopColor={s.fill}
                                    stopOpacity="0.04"
                                />
                                <stop
                                    offset="100%"
                                    stopColor={s.fill}
                                    stopOpacity="0"
                                />
                            </linearGradient>
                        ))}
                    </defs>

                    {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                        <line
                            key={i}
                            x1={PAD_L}
                            y1={PAD_T + chartH * (1 - pct)}
                            x2={W - PAD_R}
                            y2={PAD_T + chartH * (1 - pct)}
                            stroke={i === 0 ? "#e2e8f0" : "#eef0f4"}
                            strokeWidth={0.75}
                            strokeDasharray={i > 0 ? "3 4" : "0"}
                        />
                    ))}

                    {[0, Math.round(maxVal / 2), maxVal].map((v, i) => (
                        <text
                            key={i}
                            x={PAD_L - 5}
                            y={toY(v) + 4}
                            textAnchor="end"
                            fontSize={isMobile ? 7 : 8}
                            fill="#d1d5db"
                            fontFamily="'Inter Display', sans-serif"
                            fontWeight="500"
                        >
                            {v}
                        </text>
                    ))}

                    <AnimatePresence>
                        {hoveredSem !== null && (
                            <motion.rect
                                x={toX(hoveredSem) - chartW / 6}
                                y={PAD_T}
                                width={chartW / 3}
                                height={chartH}
                                fill="rgba(100,116,139,0.05)"
                                rx={6}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                            />
                        )}
                    </AnimatePresence>

                    {servicios.map((s, i) => (
                        <motion.path
                            key={`area-${i}`}
                            d={buildArea(s.semanas)}
                            fill={`url(#grad3-${i})`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{
                                delay: i * 0.1 + 0.15,
                                duration: 0.7,
                            }}
                        />
                    ))}

                    {servicios.map((s, i) => (
                        <motion.path
                            key={`glow-${i}`}
                            d={buildPath(s.semanas)}
                            fill="none"
                            stroke={s.line}
                            strokeWidth={5}
                            strokeLinecap="round"
                            opacity={0.07}
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{
                                delay: i * 0.12,
                                duration: 1,
                                ease: "easeOut",
                            }}
                        />
                    ))}

                    {servicios.map((s, i) => (
                        <motion.path
                            key={`line-${i}`}
                            d={buildPath(s.semanas)}
                            fill="none"
                            stroke={s.line}
                            strokeWidth={isMobile ? 1.25 : 1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{
                                pathLength: {
                                    delay: i * 0.12,
                                    duration: 1,
                                    ease: "easeOut",
                                },
                                opacity: { delay: i * 0.12, duration: 0.2 },
                            }}
                        />
                    ))}

                    <AnimatePresence>
                        {hoveredSem !== null && (
                            <motion.line
                                x1={toX(hoveredSem)}
                                y1={PAD_T}
                                x2={toX(hoveredSem)}
                                y2={PAD_T + chartH}
                                stroke="#cbd5e1"
                                strokeWidth={0.75}
                                strokeDasharray="3 3"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                            />
                        )}
                    </AnimatePresence>

                    {servicios.map((s, i) =>
                        s.semanas.map((v, j) => {
                            const isHov = hoveredSem === j
                            return (
                                <motion.circle
                                    key={`dot-${i}-${j}`}
                                    cx={toX(j)}
                                    cy={toY(v)}
                                    r={
                                        isHov
                                            ? isMobile
                                                ? 3.5
                                                : 4.5
                                            : isMobile
                                              ? 2
                                              : 2.5
                                    }
                                    fill={isHov ? s.line : "#fff"}
                                    stroke={s.line}
                                    strokeWidth={isHov ? 0 : 1.5}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{
                                        delay: i * 0.12 + j * 0.06 + 0.5,
                                        duration: 0.2,
                                    }}
                                    style={{ transition: "r 0.12s ease" }}
                                />
                            )
                        })
                    )}

                    {LABELS.map((_, j) => (
                        <rect
                            key={`zone-${j}`}
                            x={toX(j) - chartW / 6}
                            y={PAD_T}
                            width={chartW / 3}
                            height={chartH}
                            fill="transparent"
                            onMouseEnter={() => setHoveredSem(j)}
                        />
                    ))}

                    {LABELS.map((lbl, j) => (
                        <text
                            key={j}
                            x={toX(j)}
                            y={H - 7}
                            textAnchor="middle"
                            fontSize={isMobile ? 7.5 : 8.5}
                            fill={hoveredSem === j ? "#64748b" : "#c9d0db"}
                            fontFamily="'Inter Display', sans-serif"
                            fontWeight={hoveredSem === j ? "700" : "500"}
                            style={{ transition: "fill 0.12s" }}
                        >
                            {lbl}
                        </text>
                    ))}
                </svg>

                {/* TOOLTIP */}
                <AnimatePresence>
                    {hoveredSem !== null &&
                        (() => {
                            const contW =
                                containerRef.current?.offsetWidth || 400
                            const contH =
                                containerRef.current?.offsetHeight || 240
                            const offset = isMobile ? 10 : 16
                            let left: number | "auto" = mousePos.x + offset
                            let right: number | "auto" = "auto"
                            let top = mousePos.y + offset
                            if (mousePos.x + offset + TT_W > contW) {
                                left = "auto"
                                right = contW - mousePos.x + offset
                            }
                            if (top + TT_H > contH)
                                top = mousePos.y - TT_H - offset / 2
                            if (top < 8) top = 8

                            return (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.96 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{
                                        duration: 0.12,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        position: "absolute",
                                        left: left === "auto" ? "auto" : left,
                                        right:
                                            right === "auto" ? "auto" : right,
                                        top,
                                        background: "#ffffff",
                                        borderRadius: isMobile ? 12 : 16,
                                        padding: isMobile
                                            ? "10px 12px"
                                            : "14px 18px",
                                        pointerEvents: "none",
                                        zIndex: 9999,
                                        width: TT_W,
                                        boxShadow:
                                            "0 8px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
                                        border: "1px solid #f1f5f9",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            marginBottom: isMobile ? 8 : 12,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: isMobile ? 9 : 10,
                                                fontWeight: 700,
                                                color: "#94a3b8",
                                                letterSpacing: "0.1em",
                                                textTransform: "uppercase",
                                                fontFamily:
                                                    "'Inter Display', sans-serif",
                                            }}
                                        >
                                            {LABELS[hoveredSem]}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: isMobile ? 9 : 10,
                                                color: "#cbd5e1",
                                                fontFamily:
                                                    "'Inter Display', sans-serif",
                                            }}
                                        >
                                            mes actual
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: isMobile ? 6 : 10,
                                        }}
                                    >
                                        {servicios.map((s, i) => {
                                            const v = s.semanas[hoveredSem]
                                            const totalSem = servicios.reduce(
                                                (a, x) =>
                                                    a + x.semanas[hoveredSem],
                                                0
                                            )
                                            const pct =
                                                totalSem > 0
                                                    ? Math.round(
                                                          (v / totalSem) * 100
                                                      )
                                                    : 0
                                            return (
                                                <div key={i}>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: isMobile
                                                                ? 6
                                                                : 8,
                                                            marginBottom:
                                                                isMobile
                                                                    ? 3
                                                                    : 5,
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: isMobile
                                                                    ? 6
                                                                    : 7,
                                                                height: isMobile
                                                                    ? 6
                                                                    : 7,
                                                                borderRadius:
                                                                    "50%",
                                                                background:
                                                                    s.line,
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                        <span
                                                            style={{
                                                                flex: 1,
                                                                fontSize:
                                                                    isMobile
                                                                        ? 10
                                                                        : 11,
                                                                color: "#64748b",
                                                                fontFamily:
                                                                    "'Inter Display', sans-serif",
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {s.nombre.length >
                                                            (isMobile ? 12 : 16)
                                                                ? s.nombre.slice(
                                                                      0,
                                                                      isMobile
                                                                          ? 12
                                                                          : 16
                                                                  ) + "…"
                                                                : s.nombre}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize:
                                                                    isMobile
                                                                        ? 13
                                                                        : 15,
                                                                fontWeight: 700,
                                                                color: "#0f172a",
                                                                fontFamily:
                                                                    "'Inter Display', sans-serif",
                                                                fontVariantNumeric:
                                                                    "tabular-nums",
                                                                lineHeight: 1,
                                                            }}
                                                        >
                                                            {v}
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{
                                                            height: 2,
                                                            borderRadius: 2,
                                                            background:
                                                                "#f1f5f9",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        <motion.div
                                                            initial={{
                                                                width: 0,
                                                            }}
                                                            animate={{
                                                                width: `${pct}%`,
                                                            }}
                                                            transition={{
                                                                duration: 0.35,
                                                                ease: "easeOut",
                                                            }}
                                                            style={{
                                                                height: "100%",
                                                                borderRadius: 2,
                                                                background:
                                                                    s.line,
                                                                opacity: 0.6,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div
                                        style={{
                                            height: 1,
                                            background: "#f1f5f9",
                                            margin: isMobile
                                                ? "8px 0 6px"
                                                : "12px 0 10px",
                                        }}
                                    />
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: isMobile ? 9 : 10,
                                                color: "#94a3b8",
                                                fontFamily:
                                                    "'Inter Display', sans-serif",
                                                letterSpacing: "0.06em",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            Total
                                        </span>
                                        <span
                                            style={{
                                                fontSize: isMobile ? 15 : 18,
                                                fontWeight: 700,
                                                color: "#0f172a",
                                                fontFamily:
                                                    "'Inter Display', sans-serif",
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                                lineHeight: 1,
                                            }}
                                        >
                                            {servicios.reduce(
                                                (acc, s) =>
                                                    acc + s.semanas[hoveredSem],
                                                0
                                            )}
                                        </span>
                                    </div>
                                </motion.div>
                            )
                        })()}
                </AnimatePresence>
            </div>

            {/* STATS POR SERVICIO */}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: isMobile ? 7 : 10,
                    paddingTop: isMobile ? 10 : 14,
                    paddingBottom: 2,
                }}
            >
                {servicios.map((s, i) => {
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
                                gap: isMobile ? 3 : 5,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: isMobile ? 6 : 8,
                                }}
                            >
                                <div
                                    style={{
                                        width: isMobile ? 6 : 8,
                                        height: isMobile ? 6 : 8,
                                        borderRadius: "50%",
                                        background: s.line,
                                        flexShrink: 0,
                                    }}
                                />
                                <span
                                    style={{
                                        flex: 1,
                                        fontSize: isMobile ? 11 : 12,
                                        fontWeight: 500,
                                        color: "#475569",
                                        fontFamily:
                                            "'Inter Display', sans-serif",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {s.nombre}
                                </span>
                                <span
                                    style={{
                                        fontSize: isMobile ? 13 : 14,
                                        fontWeight: 700,
                                        color: "#0f172a",
                                        fontFamily:
                                            "'Inter Display', sans-serif",
                                        fontVariantNumeric: "tabular-nums",
                                        marginRight: 4,
                                    }}
                                >
                                    {s.total}
                                </span>
                                <span
                                    style={{
                                        fontSize: isMobile ? 9 : 10,
                                        color: "#94a3b8",
                                        fontFamily:
                                            "'Inter Display', sans-serif",
                                        minWidth: 28,
                                        textAlign: "right",
                                    }}
                                >
                                    {pct}%
                                </span>
                            </div>
                            <div
                                style={{
                                    height: isMobile ? 2 : 3,
                                    borderRadius: 3,
                                    background: "#f1f5f9",
                                    overflow: "hidden",
                                    marginLeft: isMobile ? 12 : 16,
                                }}
                            >
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{
                                        delay: i * 0.08 + 0.3,
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

            {/* FOOTER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    marginTop: isMobile ? 8 : 12,
                    paddingTop: isMobile ? 10 : 12,
                    borderTop: "1px solid #f1f5f9",
                    flexShrink: 0,
                }}
            >
                <span
                    style={{
                        fontSize: isMobile ? 10 : 11,
                        color: "#94a3b8",
                        fontFamily: "'Inter Display', sans-serif",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {totalMes} reservas en el mes
                </span>
            </div>

            <style>{TopServicios_shimmerCSS}</style>
        </div>
    )
}

function HorasTrabajadas(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        style,
    } = props

    const [stats, setStats] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }

        const api = baseUrl.replace(/\/+$/, "")
        let retryTimer: ReturnType<typeof setTimeout> | null = null
        let pollInterval: ReturnType<typeof setInterval> | null = null
        let retries = 0

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin-stats/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada.")
                    setLoading(false)
                    if (pollInterval) clearInterval(pollInterval)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                if (result?.turnosMes !== undefined) {
                    setStats(result)
                    setError("")
                } else {
                    setError("Respuesta inesperada del servidor.")
                }
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = HorasTrabajadas_getSlug()
            const token = HorasTrabajadas_getToken()
            if (slug && token) {
                fetchData(slug, token)
                pollInterval = setInterval(() => fetchData(slug, token), 60000)
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
            if (pollInterval) clearInterval(pollInterval)
        }
    }, [baseUrl])

    if (false) {
        return (
            <HorasTrabajadas_CardShell
                stats={HorasTrabajadas_MOCK_STATS}
                accentColor={accentColor}
                style={style}
            />
        )
    }

    if (loading) return <HorasTrabajadas_LoadingSkeleton style={style} />
    if (error || !stats)
        return <HorasTrabajadas_ErrorState error={error} style={style} />

    return (
        <HorasTrabajadas_CardShell
            stats={stats}
            accentColor={accentColor}
            style={style}
        />
    )
}

function HorasTrabajadas_LoadingSkeleton({ style }: any) {
    const { isMobile } = HorasTrabajadas_useBreakpoint()
    const skeletons: [string, number, number][] = [
        ["45%", 12, 0],
        ["55%", isMobile ? 28 : 36, 8],
        ["100%", 1, 12],
        ["100%", isMobile ? 22 : 28, 8],
        ["100%", isMobile ? 22 : 28, 6],
        ["100%", isMobile ? 40 : 52, 12],
    ]
    return (
        <div style={{ ...HorasTrabajadas_makeCardBase(isMobile), ...style }}>
            {skeletons.map(([w, h, mt], i) => (
                <div
                    key={i}
                    style={{
                        width: w,
                        height: h,
                        borderRadius: 6,
                        marginTop: mt,
                        background:
                            "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.4s infinite",
                    }}
                />
            ))}
            <style>{HorasTrabajadas_shimmerCSS}</style>
        </div>
    )
}

function HorasTrabajadas_ErrorState({ error, style }: any) {
    const { isMobile } = HorasTrabajadas_useBreakpoint()
    return (
        <div style={{ ...HorasTrabajadas_makeCardBase(isMobile), ...style }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 14,
                }}
            >
                <span style={HorasTrabajadas_makeTitleStyle(isMobile)}>
                    Horas Trabajadas
                </span>
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        color: "#cbd5e1",
                        fontStyle: "italic",
                    }}
                >
                    {error || "Aún no hay datos."}
                </span>
            </div>
        </div>
    )
}

function HorasTrabajadas_CardShell({ stats, accentColor, style }: any) {
    const { isMobile } = HorasTrabajadas_useBreakpoint()

    const duracionDefault = stats.config?.duracion || 30
    const turnosMes = stats.turnosMes || 0
    const turnosHoy = stats.turnosHoy || 0
    const hoyISO = new Date().toISOString().split("T")[0]

    // Minutos reales sumando la duración de cada turno
    const minTotalesMes = (stats.turnosLista || []).reduce(
        (acc: number, t: any) => acc + (t.duracion || duracionDefault),
        0
    )
    const minTotalesHoy = (stats.turnosLista || [])
        .filter((t: any) => t.fecha === hoyISO)
        .reduce(
            (acc: number, t: any) => acc + (t.duracion || duracionDefault),
            0
        )

    const diasTrabajados = HorasTrabajadas_diasUnicos(stats.turnosLista || [])
    const minPromedioDia =
        diasTrabajados > 0 ? Math.round(minTotalesMes / diasTrabajados) : 0

    const mes = HorasTrabajadas_minutosATexto(minTotalesMes)
    const hoy = HorasTrabajadas_minutosATexto(minTotalesHoy)
    const prom = HorasTrabajadas_minutosATexto(minPromedioDia)

    const ultimos7 = React.useMemo(() => {
        const now = new Date()
        const dias = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"]
        const porFecha: Record<string, { turnos: number; min: number }> = {}
        ;(stats.turnosLista || []).forEach((t: any) => {
            if (!t.fecha) return
            if (!porFecha[t.fecha]) porFecha[t.fecha] = { turnos: 0, min: 0 }
            porFecha[t.fecha].turnos += 1
            porFecha[t.fecha].min += t.duracion || duracionDefault
        })
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now)
            d.setDate(now.getDate() - (6 - i))
            const iso = d.toISOString().split("T")[0]
            const dia = porFecha[iso] || { turnos: 0, min: 0 }
            return {
                iso,
                diaNum: d.getDate(),
                diaSem: dias[d.getDay()],
                turnos: dia.turnos,
                min: dia.min,
            }
        })
    }, [stats.turnosLista, duracionDefault])

    const maxMin = Math.max(...ultimos7.map((d) => d.min), 1)

    return (
        <div style={{ ...HorasTrabajadas_makeCardBase(isMobile), ...style }}>
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 4,
                }}
            >
                <span style={HorasTrabajadas_makeTitleStyle(isMobile)}>
                    Horas trabajadas
                </span>
            </div>

            {/* NÚMERO GRANDE */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                style={{ margin: isMobile ? "4px 0 2px" : "6px 0 3px" }}
            >
                <div
                    style={{
                        fontSize: isMobile ? 30 : 38,
                        fontWeight: 700,
                        color: accentColor,
                        lineHeight: 1,
                        letterSpacing: "-2px",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {mes.corto}
                </div>
                <div
                    style={{
                        fontSize: isMobile ? 9 : 10,
                        color: "#94a3b8",
                        marginTop: 3,
                        fontWeight: 500,
                    }}
                >
                    {turnosMes} turno{turnosMes !== 1 ? "s" : ""}
                </div>
            </motion.div>

            {/* CHIPS */}
            <div
                style={{
                    display: "flex",
                    gap: isMobile ? 4 : 6,
                    margin: isMobile ? "8px 0 10px" : "10px 0 12px",
                }}
            >
                <HorasTrabajadas_ChipCompacto
                    label="Hoy"
                    valor={turnosHoy === 0 ? "—" : hoy.corto}
                    sub={
                        turnosHoy === 0
                            ? "sin turnos"
                            : `${turnosHoy} turno${turnosHoy !== 1 ? "s" : ""}`
                    }
                    accentColor={accentColor}
                    highlight
                    isMobile={isMobile}
                />
                <HorasTrabajadas_ChipCompacto
                    label="Promedio/día"
                    valor={diasTrabajados === 0 ? "—" : prom.corto}
                    sub={
                        diasTrabajados === 0
                            ? "sin datos"
                            : `${diasTrabajados} día${diasTrabajados !== 1 ? "s" : ""}`
                    }
                    isMobile={isMobile}
                />
            </div>

            <div
                style={{
                    height: 1,
                    background: "#f1f5f9",
                    marginBottom: isMobile ? 8 : 10,
                }}
            />

            <span
                style={{
                    ...HorasTrabajadas_makeSectionTitle(isMobile),
                    marginBottom: isMobile ? 6 : 8,
                    display: "block",
                }}
            >
                Últimos 7 días
            </span>

            {/* GRILLA 7 DÍAS */}
            <div style={{ display: "flex", gap: isMobile ? 2 : 3, flex: 1 }}>
                {ultimos7.map((d, i) => {
                    const esHoy = i === 6
                    const ratio = maxMin > 0 ? d.min / maxMin : 0
                    const t = HorasTrabajadas_minutosATexto(d.min)
                    return (
                        <motion.div
                            key={d.iso}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.25 }}
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: isMobile ? 2 : 3,
                                padding: isMobile
                                    ? "5px 1px 4px"
                                    : "7px 1px 6px",
                                borderRadius: isMobile ? 8 : 10,
                                minWidth: 0,
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
                                    fontSize: isMobile ? 7 : 8,
                                    fontWeight: 600,
                                    color: esHoy ? accentColor : "#94a3b8",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.03em",
                                }}
                            >
                                {d.diaSem}
                            </span>

                            {d.min === 0 ? (
                                <span
                                    style={{
                                        fontSize: isMobile ? 10 : 11,
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
                                    {t.horas > 0 && (
                                        <div
                                            style={{
                                                fontSize:
                                                    (isMobile ? 9 : 10) +
                                                    Math.round(ratio * 4),
                                                fontWeight: 700,
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                                color:
                                                    esHoy || ratio >= 0.7
                                                        ? accentColor
                                                        : `rgba(34,197,94,${0.4 + ratio * 0.6})`,
                                            }}
                                        >
                                            {t.horas}h
                                        </div>
                                    )}
                                    {t.horas > 0 && t.minutos > 0 && (
                                        <div
                                            style={{
                                                fontSize: isMobile ? 7 : 8,
                                                fontWeight: 600,
                                                color:
                                                    esHoy || ratio >= 0.7
                                                        ? accentColor
                                                        : `rgba(34,197,94,${0.3 + ratio * 0.5})`,
                                                marginTop: 1,
                                            }}
                                        >
                                            {t.minutos}m
                                        </div>
                                    )}
                                    {t.horas === 0 && t.minutos > 0 && (
                                        <div
                                            style={{
                                                fontSize: isMobile ? 9 : 10,
                                                fontWeight: 700,
                                                color: esHoy
                                                    ? accentColor
                                                    : `rgba(34,197,94,${0.4 + ratio * 0.6})`,
                                            }}
                                        >
                                            {t.minutos}m
                                        </div>
                                    )}
                                </div>
                            )}

                            <span
                                style={{
                                    fontSize: isMobile ? 7 : 8,
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

            <style>{HorasTrabajadas_shimmerCSS}</style>
        </div>
    )
}

function HorasTrabajadas_ChipCompacto({
    label,
    valor,
    sub,
    accentColor,
    highlight,
    isMobile,
}: any) {
    return (
        <div
            style={{
                flex: 1,
                padding: isMobile ? "5px 6px" : "6px 8px",
                borderRadius: 8,
                background: highlight ? `${accentColor}08` : "#f8fafc",
            }}
        >
            <div
                style={{
                    fontSize: isMobile ? 8 : 9,
                    color: "#94a3b8",
                    fontWeight: 500,
                    marginBottom: 1,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: isMobile ? 11 : 12,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: highlight ? accentColor : "#1e293b",
                }}
            >
                {valor}
            </div>
            {sub && (
                <div
                    style={{
                        fontSize: isMobile ? 7 : 8,
                        color: "#cbd5e1",
                        marginTop: 1,
                    }}
                >
                    {sub}
                </div>
            )}
        </div>
    )
}

function ServiciosManager_PlaceholderIcon({
    src,
    size = 24,
}: {
    src?: string
    size?: number
}) {
    if (!src) return <UploadPlaceholderIcon size={size} />
    return (
        <img
            src={src}
            alt=""
            style={{
                width: size,
                height: size,
                objectFit: "contain",
                opacity: 0.5,
            }}
        />
    )
}

export { UploadPlaceholderIcon, CopyTurnosLink, CopyTurnosButton, UserGreeting, PlanEstado, BotonNotificaciones_CampanaFallback, BotonNotificaciones, NotificacionesPanel, TurnosHoy, TurnosHoy_LoadingSkeleton, TurnosHoy_ErrorState, TurnosHoy_CardShell, TurnosHoy_TurnoRow, TurnosHoy_SkeletonPulse, RendimientoEquipo_Spinner, RendimientoEquipo_EmptyState, RendimientoEquipo, IngresosEstimados, IngresosEstimados_LoadingSkeleton, IngresosEstimados_ErrorState, IngresosEstimados_CardShell, IngresosEstimados_IngresoChip, TurnosMes, TurnosMes_LoadingSkeleton, TurnosMes_ErrorState, TurnosMes_CardShell, ClientesCard, ClientesCard_LoadingSkeleton, ClientesCard_ErrorState, ClientesCard_CardShell, ClientesCard_ResumenChip, MejoresDias, MejoresDias_LoadingSkeleton, MejoresDias_ErrorState, MejoresDias_CardShell, TopServicios, TopServicios_LoadingSkeleton, TopServicios_ErrorState, TopServicios_ChartCard, HorasTrabajadas, HorasTrabajadas_LoadingSkeleton, HorasTrabajadas_ErrorState, HorasTrabajadas_CardShell, HorasTrabajadas_ChipCompacto, ServiciosManager_PlaceholderIcon }
