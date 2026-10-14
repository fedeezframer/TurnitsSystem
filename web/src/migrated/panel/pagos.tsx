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
import { MercadoPagoConexion_cardBase, MercadoPagoConexion_globalCSS, Turnits_useElementWidth, MercadoPagoConexion_EstadoConexion, MercadoPagoConexion_MetodoPago, MercadoPagoConexion_DatosBancarios, MercadoPagoConexion_getSlug, MercadoPagoConexion_getToken, TurnitsGlobalSaveManager_get, Pagos_baselineDesdeSettings, MercadoPagoConexion_solicitarUrlOAuth, MercadoPagoConexion_emitPagosChanged, MercadoPagoConexion_CBU_REGEX, MercadoPagoConexion_ALIAS_REGEX, MercadoPagoConexion_inputStyle, ConfigPagos_cardBase, ConfigPagos_shimmerCSS, ConfigPagos_OpcionMetodoProps, ConfigPagos_getSlug, ConfigPagos_getToken, ConfigPagos_useContainerWidth, ConfigPagos_MetodoPago, ConfigPagos_SENA_MINIMA } from "./common"
import { TurnitsPlanRequirement } from "./shared"
import { UploadPlaceholderIcon } from "./inicio"

function MercadoPagoConexion_Skeleton() {
    return (
        <div style={MercadoPagoConexion_cardBase}>
            <style>{MercadoPagoConexion_globalCSS}</style>
            <div
                className="pg-shimmer"
                style={{ width: 140, height: 16, marginBottom: 6 }}
            />
            <div
                className="pg-shimmer"
                style={{ width: 200, height: 12, marginBottom: 24 }}
            />
            <div
                className="pg-shimmer"
                style={{ height: 88, borderRadius: 14, marginBottom: 16 }}
            />
            <div
                className="pg-shimmer"
                style={{ height: 72, borderRadius: 12 }}
            />
        </div>
    )
}

function MercadoPagoConexion_Switch({
    on,
    disabled,
    onColor = "#16a34a",
    onToggle,
}: {
    on: boolean
    disabled?: boolean
    onColor?: string
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation()
                if (!disabled) onToggle()
            }}
            className={`pg-switch ${on ? "on" : "off"}`}
            style={{ background: on ? onColor : undefined }}
            aria-pressed={on}
        >
            <span className="pg-switch-knob" />
        </button>
    )
}

function MercadoPagoConexion_LinkIcon({ size = 12 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    )
}

function MercadoPagoConexion_MetodoIcon({
    src,
    fallback,
}: {
    src?: string
    fallback: string
}) {
    const [error, setError] = React.useState(false)
    return (
        <div
            style={{
                width: 44,
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}
        >
            {src && !error ? (
                <img
                    src={src}
                    alt=""
                    style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                    }}
                    onError={() => setError(true)}
                />
            ) : (
                <span style={{ fontSize: 26 }}>{fallback}</span>
            )}
        </div>
    )
}

const MercadoPagoConexion_MetodoCard = ({
    logo,
    fallback,
    titulo,
    descripcion,
    activo,
    estadoTexto,
    color,
    onToggle,
    locked,
    destacado,
    accion,
    onClickCard,
    orden,
    children,
}: {
    orden?: number
    logo?: string
    fallback: string
    titulo: string
    descripcion: string
    activo: boolean
    estadoTexto: string
    color: string
    onToggle?: () => void
    locked?: boolean
    destacado?: boolean
    accion?: React.ReactNode
    onClickCard?: () => void
    children?: React.ReactNode
}) => (
    <div
        onClick={onClickCard}
        className={onClickCard ? "pg-card-mp" : undefined}
        style={{
            border: `1.5px solid ${
                destacado
                    ? color
                    : locked
                      ? "#e2e8f0"
                      : activo
                        ? color + "40"
                        : "#eef2f7"
            }`,
            background: locked ? "#f8fafc" : destacado ? color + "08" : "#fff",
            order: orden,
            borderRadius: 16,
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            opacity: locked ? 0.55 : 1,
            filter: locked ? "grayscale(1)" : "none",
            cursor: onClickCard ? "pointer" : "default",
            transition: "background 0.15s, border-color 0.15s",
            minWidth: 0,
        }}
    >
        <div
            style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                }}
            >
                <div
                    style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: locked ? "#eef2f7" : color + "14",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <MercadoPagoConexion_MetodoIcon
                        src={logo}
                        fallback={fallback}
                    />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#1e293b",
                            letterSpacing: "-0.2px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {titulo}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            marginTop: 3,
                        }}
                    >
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: locked
                                    ? "#cbd5e1"
                                    : activo
                                      ? color
                                      : "#94a3b8",
                                flexShrink: 0,
                            }}
                        />
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: locked
                                    ? "#94a3b8"
                                    : activo
                                      ? color
                                      : "#64748b",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {estadoTexto}
                        </span>
                    </div>
                </div>
            </div>

            {locked ? (
                <ConfigPagos_PremiumBadge label="Premium" />
            ) : accion ? (
                accion
            ) : onToggle ? (
                <MercadoPagoConexion_Switch
                    on={activo}
                    onColor={color}
                    onToggle={onToggle}
                />
            ) : null}
        </div>

        <div
            style={{
                fontSize: 11.5,
                color: "#94a3b8",
                lineHeight: 1.45,
            }}
        >
            {descripcion}
        </div>

        {/* Contenido desplegable (ej: datos bancarios). Mismo efecto que
            el apartado de Seña: height 0 → auto + fade, 0.2s. El
            marginTop negativo compensa el gap del flex para que no haya
            salto de 12px al montarse. */}
        <AnimatePresence initial={false}>
            {activo && !locked && children && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: "hidden", marginTop: -12 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ paddingTop: 12 }}>{children}</div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
)

function MercadoPagoConexion(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        mpClientId = "",
        logoMP = "",
        logoTransferencia = "",
        logoEfectivo = "",
        employeeMode = false,
        allowPersonalAccount = true,
        borderColor = "#009ee3",
        transferenciaColor = "#7c3aed",
        efectivoColor = "#16a34a",
        style,
    } = props

    const api = baseUrl.replace(/\/+$/, "")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = Turnits_useElementWidth(containerRef, 640)
    const isMobile = containerWidth < 560

    const [estado, setEstado] =
        React.useState<MercadoPagoConexion_EstadoConexion>("loading")
    const [loading, setLoading] = React.useState(true)
    const [hover, setHover] = React.useState(false)
    const [oauthNotice, setOauthNotice] = React.useState<{
        kind: "success" | "error"
        text: string
    } | null>(null)

    const [plan, setPlan] = React.useState<"gratis" | "basico" | "premium">("gratis")
    const [esVip, setEsVip] = React.useState(false)
    const [estadoSuscripcion, setEstadoSuscripcion] = React.useState("")
    const [cuentaNegocioDisponible, setCuentaNegocioDisponible] =
        React.useState(false)
    const [mpPersonalConectado, setMpPersonalConectado] = React.useState(false)

    // Mercado Pago: conectado (OAuth) vs activo (metodo_pago !== "none")
    const [metodoPago, setMetodoPago] =
        React.useState<MercadoPagoConexion_MetodoPago>("none")
    const [metodoPreferido, setMetodoPreferido] = React.useState<
        "sena" | "total"
    >("total")

    const [aceptaTransferencia, setAceptaTransferencia] = React.useState(false)
    const [aceptaEfectivo, setAceptaEfectivo] = React.useState(false)
    // La primera vez que se cargan los datos bancarios es hidratación, no una
    // edición del usuario: no se publica como cambio pendiente.
    const datosHidratadosRef = React.useRef(false)
    const [datosBancarios, setDatosBancarios] =
        React.useState<MercadoPagoConexion_DatosBancarios>({
            banco: "",
            titular: "",
            cbu: "",
            alias: "",
        })

    // ── Canvas preview ───────────────────────────────────────
    if (false) {
        return (
            <div style={{ ...MercadoPagoConexion_cardBase, ...style }}>
                <style>{MercadoPagoConexion_globalCSS}</style>
                <MercadoPagoConexion_CanvasPreview
                    logoMP={logoMP}
                    logoTransferencia={logoTransferencia}
                    logoEfectivo={logoEfectivo}
                    borderColor={borderColor}
                    transferenciaColor={transferenciaColor}
                    efectivoColor={efectivoColor}
                />
            </div>
        )
    }

    // ── Fetch settings (plan, MP, transferencia, efectivo) ───
    // Esto solo LEE el estado actual del servidor para mostrarlo.
    // No escribe nada.
    React.useEffect(() => {
        let retries = 0
        const tryLoad = async () => {
            const slug = MercadoPagoConexion_getSlug()
            const token = MercadoPagoConexion_getToken()
            if (!slug || !token) {
                if (++retries < 10) {
                    setTimeout(tryLoad, 300)
                    return
                }
                setLoading(false)
                return
            }
            try {
                const configUrl = employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                    : `${api}/settings/${slug}`
                const res = await fetch(configUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setLoading(false)
                    return
                }
                // Si el servidor respondió error (403 por token de otra cuenta,
                // 429, 5xx…) NO se hidrata con valores por defecto: antes se
                // mostraba "desconectado / sin métodos" y se tomaba eso como
                // la configuración real.
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                if (!data?.success || !data?.settings)
                    throw new Error("Respuesta inválida")
                const s = data.settings
                setCuentaNegocioDisponible(!!s.mp_cuenta_negocio_disponible)
                setMpPersonalConectado(!!s.mp_personal_conectado)
                setEstado(
                    s.mp_status === "Conectado" ? "conectado" : "desconectado"
                )
                setPlan(
                    ["basico", "premium"].includes(s.plan) ? s.plan : "gratis"
                )
                setEsVip(s.plan === "premium")
                setEstadoSuscripcion(s.estado_suscripcion || "")
                const mp: MercadoPagoConexion_MetodoPago = [
                    "none",
                    "sena",
                    "total",
                ].includes(s.metodo_pago)
                    ? s.metodo_pago
                    : "none"
                const esPlanPremium = ["basico", "premium"].includes(s.plan)
                const metodoEfectivo =
                    esPlanPremium && mp === "none" ? "total" : mp
                setMetodoPago(metodoEfectivo)
                if (metodoEfectivo !== "none")
                    setMetodoPreferido(metodoEfectivo)

                setAceptaTransferencia(!!s.acepta_transferencia)
                setAceptaEfectivo(!!s.acepta_efectivo)
                setDatosBancarios({
                    banco: s.datos_bancarios?.banco || "",
                    titular: s.datos_bancarios?.titular || "",
                    cbu: s.datos_bancarios?.cbu || "",
                    alias: s.datos_bancarios?.alias || "",
                })
                TurnitsGlobalSaveManager_get()?.setBaseline(
                    "pagos",
                    Pagos_baselineDesdeSettings(s)
                )
                const pendiente =
                    TurnitsGlobalSaveManager_get()?.getPending("pagos")
                if (pendiente) {
                    if (
                        ["none", "sena", "total"].includes(
                            pendiente.metodo_pago
                        )
                    )
                        setMetodoPago(
                            esPlanPremium && pendiente.metodo_pago === "none"
                                ? "total"
                                : pendiente.metodo_pago
                        )
                    if (pendiente.acepta_transferencia !== undefined)
                        setAceptaTransferencia(!!pendiente.acepta_transferencia)
                    if (pendiente.acepta_efectivo !== undefined)
                        setAceptaEfectivo(!!pendiente.acepta_efectivo)
                    if (pendiente.datos_bancarios)
                        setDatosBancarios(pendiente.datos_bancarios)
                }
                if (esPlanPremium && mp === "none")
                    TurnitsGlobalSaveManager_get()?.markDirty?.("pagos", {
                        ...Pagos_baselineDesdeSettings(s),
                        ...(pendiente || {}),
                        metodo_pago: metodoEfectivo,
                    })

                // (Acá había un setConfigCargada(true) que NO existe en este
                // componente: tiraba ReferenceError, el catch reintentaba 8
                // veces y la sección quedaba en skeleton ~3 s mandando 8
                // requests cada vez que se abría.)
                setLoading(false)
            } catch {
                if (++retries < 8) setTimeout(tryLoad, 400)
                else setLoading(false)
            }
        }
        tryLoad()
    }, [api])

    // ── Leer el resultado de la conexión OAuth ──────────────────
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        const status = params.get("status")
        if (status === "mp_success" || status === "mp_error") {
            if (status === "mp_success") {
                setEstado("conectado")
                setOauthNotice({
                    kind: "success",
                    text: "Mercado Pago quedó conectado correctamente.",
                })
            } else {
                setOauthNotice({
                    kind: "error",
                    text: "Mercado Pago no pudo completar la conexión. Revisá que hayas autorizado el acceso e intentá nuevamente. Si Mercado Pago muestra un aviso de seguridad, el bloqueo debe resolverse desde la configuración de la aplicación o con soporte de Mercado Pago.",
                })
            }
            const url = new URL(window.location.href)
            url.searchParams.delete("status")
            url.searchParams.delete("reason")
            window.history.replaceState({}, "", url.toString())
        }
    }, [])

    const handleConectar = async () => {
        const slug = MercadoPagoConexion_getSlug()
        if (!slug) return
        const token = MercadoPagoConexion_getToken()
        if (!token) {
            setOauthNotice({
                kind: "error",
                text: "Tu sesión venció. Volvé a iniciar sesión e intentá conectar Mercado Pago nuevamente.",
            })
            return
        }
        try {
            const authUrl = await MercadoPagoConexion_solicitarUrlOAuth(
                api,
                slug,
                token,
                employeeMode
            )
            window.location.href = authUrl
        } catch (e: any) {
            setOauthNotice({
                kind: "error",
                text:
                    e?.message ||
                    "No se pudo iniciar la conexión con Mercado Pago.",
            })
        }
    }

    // ── Toggle Mercado Pago (activo / inactivo) — solo local ─
    // No desconecta la cuenta (eso lo hace "Reconfigurar" vía OAuth),
    // solo cambia metodo_pago entre "none" y el último valor usado.
    // Se guarda recién cuando se aprieta el botón de Guardar.
    const toggleMp = () => {
        if (estado !== "conectado") return
        const activando = metodoPago === "none"
        const metodoGuardado =
            typeof (window as any).getPagosConfig === "function"
                ? (window as any).getPagosConfig()?.metodo_pago
                : null
        const nuevoMetodo: MercadoPagoConexion_MetodoPago = activando
            ? ["sena", "total"].includes(metodoGuardado)
                ? metodoGuardado
                : metodoPreferido
            : "none"
        if (!activando) setMetodoPreferido(metodoPago as "sena" | "total")
        setMetodoPago(nuevoMetodo)
        MercadoPagoConexion_emitPagosChanged({ metodo_pago: nuevoMetodo })
    }

    // ── Toggle transferencia — solo local ─────────────────────
    const toggleTransferencia = () => {
        if(plan !== "premium")return
        const nuevoValor = !aceptaTransferencia
        setAceptaTransferencia(nuevoValor)
        MercadoPagoConexion_emitPagosChanged({
            acepta_transferencia: nuevoValor,
        })
    }

    // ── Toggle efectivo — solo local ──────────────────────────
    const toggleEfectivo = () => {
        if(plan !== "premium")return
        const nuevoValor = !aceptaEfectivo
        setAceptaEfectivo(nuevoValor)
        MercadoPagoConexion_emitPagosChanged({ acepta_efectivo: nuevoValor })
    }

    // ── Validación de datos bancarios (igual al backend) ─────
    const cbuValido =
        datosBancarios.cbu === "" ||
        MercadoPagoConexion_CBU_REGEX.test(datosBancarios.cbu)
    const aliasValido =
        datosBancarios.alias === "" ||
        MercadoPagoConexion_ALIAS_REGEX.test(datosBancarios.alias)
    const bancoValido = datosBancarios.banco.length <= 60
    const titularValido = datosBancarios.titular.length <= 80
    const datosBancariosValidos =
        cbuValido && aliasValido && bancoValido && titularValido

    // Mientras los datos bancarios sean válidos, se van reflejando
    // en el caché de "pagos" para que el botón de Guardar los tome.
    // Si están incompletos/mal, no se emiten (se sigue mandando la
    // última versión válida) hasta que se corrijan.
    React.useEffect(() => {
        if (loading) return
        if (!datosHidratadosRef.current) {
            datosHidratadosRef.current = true
            return
        }
        if (!datosBancariosValidos) return
        MercadoPagoConexion_emitPagosChanged({
            datos_bancarios: datosBancarios,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datosBancarios, loading])

    if (loading) return <MercadoPagoConexion_Skeleton />

    const conectado = estado === "conectado"
    const mpActivo = conectado && metodoPago !== "none"
    const esPremium = plan === "basico"
    const esTrialPremium = esPremium && estadoSuscripcion === "trial"

    return (
        <div
            ref={containerRef}
            style={{ ...MercadoPagoConexion_cardBase, ...style }}
        >
            <style>{MercadoPagoConexion_globalCSS}</style>

            {/* ── Header ── */}
            <div style={{ marginBottom: 18 }}>
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.3px",
                    }}
                >
                    Métodos de pago
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Elegí qué medios de pago aceptás para tus clientes.
                </div>
            </div>

            {oauthNotice && (
                <div
                    role="status"
                    style={{
                        marginBottom: 14,
                        padding: "11px 13px",
                        borderRadius: 12,
                        border: `1px solid ${oauthNotice.kind === "success" ? "#bbf7d0" : "#fecaca"}`,
                        background:
                            oauthNotice.kind === "success"
                                ? "#f0fdf4"
                                : "#fef2f2",
                        color:
                            oauthNotice.kind === "success"
                                ? "#166534"
                                : "#991b1b",
                        fontSize: 12,
                        lineHeight: 1.45,
                    }}
                >
                    {oauthNotice.text}
                </div>
            )}

            {/* ── Grid de métodos: Mercado Pago, Transferencia, Efectivo ── */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                        ? "1fr"
                        : "repeat(auto-fit, minmax(220px, 1fr))",
                    alignItems: "start",
                    gap: 14,
                    marginBottom: 12,
                }}
            >
                <MercadoPagoConexion_MetodoCard
                    orden={isMobile ? undefined : 1}
                    logo={logoMP}
                    fallback="💳"
                    titulo="Mercado Pago"
                    descripcion="Incluye tarjetas de crédito y débito aceptadas por Mercado Pago y dinero disponible en tu cuenta de Mercado Pago."
                    activo={mpActivo}
                    estadoTexto={conectado ? "Conectado" : "No conectado"}
                    color={borderColor}
                    // Destacada porque es la vía recomendada para cobrar online.
                    destacado={!conectado}
                    onClickCard={
                        !conectado && (!employeeMode || allowPersonalAccount)
                            ? handleConectar
                            : undefined
                    }
                    onToggle={conectado && !esPremium ? toggleMp : undefined}
                    accion={
                        (!employeeMode || allowPersonalAccount) ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleConectar()
                                }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "6px 12px",
                                    borderRadius: 99,
                                    border: "none",
                                    background: borderColor,
                                    color: "#fff",
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontFamily:
                                        "'Inter Display', -apple-system, sans-serif",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                }}
                            >
                                <MercadoPagoConexion_LinkIcon />
                                {conectado ? "Reconectar" : "Conectar"}
                            </button>
                        ) : undefined
                    }
                />

                {
                    <MercadoPagoConexion_MetodoCard
                        orden={isMobile ? undefined : 2}
                        logo={logoTransferencia}
                        fallback="🏦"
                        titulo="Transferencia bancaria"
                        descripcion="Recibí transferencias directamente en tu cuenta, sin comisión de Turnits."
                        activo={aceptaTransferencia}
                        estadoTexto={
                            aceptaTransferencia ? "Activo" : "Desactivada"
                        }
                        color={transferenciaColor}
                        locked={plan !== "premium"}
                        onToggle={toggleTransferencia}
                    >
                        {/* Datos bancarios — se cargan acá y se guardan con el
                            botón central de Guardar cambios. Se despliegan
                            debajo de la card con el mismo efecto que la Seña. */}
                        <div
                            style={{
                                background: "#fff",
                                borderRadius: 10,
                                padding: isMobile ? "10px" : "14px",
                                border: "1px solid #f1f5f9",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: isMobile ? 10 : 12,
                                    fontWeight: 700,
                                    color: "#64748b",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.06em",
                                    marginBottom: 2,
                                }}
                            >
                                Datos para recibir la transferencia
                            </span>
                            <input
                                style={MercadoPagoConexion_inputStyle}
                                placeholder="Banco (ej: Banco Nación)"
                                maxLength={60}
                                value={datosBancarios.banco}
                                onChange={(e) =>
                                    setDatosBancarios((d) => ({
                                        ...d,
                                        banco: e.target.value,
                                    }))
                                }
                            />
                            <input
                                style={MercadoPagoConexion_inputStyle}
                                placeholder="Titular de la cuenta"
                                maxLength={80}
                                value={datosBancarios.titular}
                                onChange={(e) =>
                                    setDatosBancarios((d) => ({
                                        ...d,
                                        titular: e.target.value,
                                    }))
                                }
                            />
                            <input
                                style={{
                                    ...MercadoPagoConexion_inputStyle,
                                    borderColor: cbuValido
                                        ? "#e2e8f0"
                                        : "#ef4444",
                                }}
                                placeholder="CBU (22 dígitos)"
                                value={datosBancarios.cbu}
                                onChange={(e) =>
                                    setDatosBancarios((d) => ({
                                        ...d,
                                        cbu: e.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 22),
                                    }))
                                }
                            />
                            {!cbuValido && (
                                <span
                                    style={{ fontSize: 10.5, color: "#ef4444" }}
                                >
                                    El CBU debe tener 22 dígitos.
                                </span>
                            )}
                            <input
                                style={{
                                    ...MercadoPagoConexion_inputStyle,
                                    borderColor: aliasValido
                                        ? "#e2e8f0"
                                        : "#ef4444",
                                }}
                                placeholder="Alias"
                                maxLength={30}
                                value={datosBancarios.alias}
                                onChange={(e) =>
                                    setDatosBancarios((d) => ({
                                        ...d,
                                        alias: e.target.value,
                                    }))
                                }
                            />
                            {!aliasValido && (
                                <span
                                    style={{ fontSize: 10.5, color: "#ef4444" }}
                                >
                                    Alias: 6 a 30 caracteres (letras, números,
                                    ".", "_", "-").
                                </span>
                            )}
                            <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
                                Se guarda junto con el resto al tocar Guardar.
                            </span>
                        </div>
                    </MercadoPagoConexion_MetodoCard>
                }

                {
                    <MercadoPagoConexion_MetodoCard
                        orden={isMobile ? undefined : 3}
                        logo={logoEfectivo}
                        fallback="💵"
                        titulo="Efectivo"
                        descripcion="Cobrá en el local al momento del servicio, sin comisión de Turnits."
                        activo={aceptaEfectivo}
                        estadoTexto={aceptaEfectivo ? "Activo" : "Desactivado"}
                        color={efectivoColor}
                        locked={plan !== "premium"}
                        onToggle={toggleEfectivo}
                    />
                }
            </div>

            {employeeMode &&
                cuentaNegocioDisponible &&
                !mpPersonalConectado && (
                    <div
                        style={{
                            marginBottom: 14,
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#64748b",
                            fontSize: 12,
                            lineHeight: 1.5,
                        }}
                    >
                        {allowPersonalAccount
                            ? "Si no conectás una cuenta personal, los cobros de Mercado Pago se reciben en la cuenta del negocio. Podés conectar la tuya desde la tarjeta de Mercado Pago."
                            : "Los cobros de Mercado Pago se reciben en la cuenta del negocio. El titular no habilitó cuentas personales para este perfil."}
                    </div>
                )}

            {conectado && !mpActivo && (
                <div
                    style={{
                        fontSize: 10.5,
                        color: "#94a3b8",
                        marginBottom: 12,
                        paddingLeft: 2,
                    }}
                >
                    Mercado Pago está conectado pero desactivado: no se le va a
                    cobrar a los clientes por acá.
                </div>
            )}

            {plan !== "premium" && (
                <div
                    style={{
                        fontSize: 11.5,
                        color: "#94a3b8",
                        lineHeight: 1.5,
                    }}
                >
                    En Gratis y Básico, los cobros son por Mercado Pago.
                    Actualizá a Premium para sumar transferencia y efectivo.
                </div>
            )}
        </div>
    )
}

function MercadoPagoConexion_CanvasPreview({
    logoMP,
    logoTransferencia,
    logoEfectivo,
    borderColor,
    transferenciaColor,
    efectivoColor,
}: {
    logoMP: string
    logoTransferencia: string
    logoEfectivo: string
    borderColor: string
    transferenciaColor: string
    efectivoColor: string
}) {
    const filaPreview = (
        icono: string,
        img: string,
        titulo: string,
        color: string
    ) => (
        <div
            style={{
                border: `1.5px solid ${color}`,
                background: color + "07",
                borderRadius: 14,
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 12,
            }}
        >
            <div
                style={{
                    width: 44,
                    height: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {img ? (
                    <img
                        src={img}
                        alt=""
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                        }}
                    />
                ) : (
                    <span style={{ fontSize: 26 }}>{icono}</span>
                )}
            </div>
            <div style={{ flex: 1 }}>
                <div
                    style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}
                >
                    {titulo}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color }}>
                    Activo
                </div>
            </div>
            <div
                style={{
                    position: "relative" as const,
                    width: 38,
                    height: 22,
                    borderRadius: 99,
                    background: color,
                }}
            >
                <span className="pg-switch-knob" style={{ left: 18 }} />
            </div>
        </div>
    )

    return (
        <>
            <div style={{ marginBottom: 20 }}>
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.3px",
                    }}
                >
                    Métodos de Pago
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Elegí cómo van a pagar tus clientes al reservar
                </div>
            </div>
            {filaPreview("💳", logoMP, "Mercado Pago", borderColor)}
            {filaPreview(
                "🏦",
                logoTransferencia,
                "Transferencia bancaria",
                transferenciaColor
            )}
            {filaPreview("💵", logoEfectivo, "Efectivo", efectivoColor)}
        </>
    )
}

function ConfigPagos_Skeleton() {
    return (
        <div style={ConfigPagos_cardBase}>
            <style>{ConfigPagos_shimmerCSS}</style>
            <div
                className="cp-shimmer"
                style={{ width: 180, height: 18, marginBottom: 6 }}
            />
            <div
                className="cp-shimmer"
                style={{ width: 240, height: 13, marginBottom: 24 }}
            />
            {[110, 110, 110].map((h, i) => (
                <div
                    key={i}
                    className="cp-shimmer"
                    style={{ height: h, borderRadius: 14, marginBottom: 10 }}
                />
            ))}
        </div>
    )
}

function ConfigPagos_PremiumBadge({label}: {label?: string} = {}) {
    return <TurnitsPlanRequirement premiumOnly />
}

function ConfigPagos_OpcionMetodo({
    activo,
    accentColor,
    icono,
    titulo,
    descripcion,
    tag,
    isMobile,
    onClick,
    locked = false,
    children,
}: ConfigPagos_OpcionMetodoProps) {
    return (
        <div
            onClick={locked ? undefined : onClick}
            style={{
                position: "relative",
                borderRadius: 14,
                border: `1.5px solid ${locked ? "#e2e8f0" : activo ? accentColor + "55" : "#e2e8f0"}`,
                background: locked
                    ? "#f8fafc"
                    : activo
                      ? accentColor + "06"
                      : "#fafafa",
                padding: isMobile ? "12px" : "14px 16px",
                cursor: locked ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                userSelect: "none",
                opacity: locked ? 0.55 : 1,
                filter: locked ? "grayscale(1)" : "none",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: isMobile ? 10 : 12,
                    paddingRight: locked ? 28 : 0,
                }}
            >
                {locked ? (
                    <div
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            flexShrink: 0,
                            border: "2px solid #cbd5e1",
                            background: "#f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                        }}
                    ></div>
                ) : (
                    <div
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            flexShrink: 0,
                            border: `2px solid ${activo ? accentColor : "#cbd5e1"}`,
                            background: activo ? accentColor : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s",
                        }}
                    >
                        {activo && (
                            <div
                                style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: "#fff",
                                }}
                            />
                        )}
                    </div>
                )}

                <span style={{ fontSize: isMobile ? 18 : 20 }}>{icono}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                        }}
                    >
                        <span
                            style={{
                                fontSize: isMobile ? 13 : 14,
                                fontWeight: 700,
                                color: locked
                                    ? "#94a3b8"
                                    : activo
                                      ? "#1e293b"
                                      : "#64748b",
                                letterSpacing: "-0.2px",
                            }}
                        >
                            {titulo}
                        </span>
                        {locked && <span style={{position:"absolute",top:12,right:12}}><ConfigPagos_PremiumBadge /></span>}
                        {!locked && tag && (
                            <span
                                style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 99,
                                    background: accentColor + "18",
                                    color: accentColor,
                                    letterSpacing: "0.04em",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {tag}
                            </span>
                        )}
                    </div>
                    {(!isMobile || activo) && (
                        <div
                            style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                marginTop: 2,
                                lineHeight: 1.4,
                            }}
                        >
                            {descripcion}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {activo && !locked && children && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ paddingTop: 12 }}>{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function PagosSettingsGuard({
    baseUrl,
    children,
}: {
    baseUrl: string
    children: React.ReactNode
}) {
    const [agendaSinPagos, setAgendaSinPagos] = React.useState(false)

    React.useEffect(() => {
        const slug = ConfigPagos_getSlug()
        const token = ConfigPagos_getToken()
        if (!slug || !token) return

        fetch(`${baseUrl.replace(/\/+$/, "")}/settings/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-cache",
        })
            .then((res) => res.json())
            .then((data) =>
                setAgendaSinPagos(data?.settings?.agenda_sin_pagos === true)
            )
            .catch(() => {})

        const onChange = (event: Event) => {
            setAgendaSinPagos((event as CustomEvent).detail === true)
        }
        window.addEventListener("agenda_sin_pagos_changed", onChange)
        return () =>
            window.removeEventListener("agenda_sin_pagos_changed", onChange)
    }, [baseUrl])

    return (
        <div aria-disabled={agendaSinPagos}>
            <div
                style={{
                    filter: agendaSinPagos ? "grayscale(1)" : "none",
                    opacity: agendaSinPagos ? 0.55 : 1,
                    pointerEvents: agendaSinPagos ? "none" : "auto",
                    transition: "filter 0.2s ease, opacity 0.2s ease",
                }}
            >
                {children}
            </div>
        </div>
    )
}

function ConfigPagos(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        mpClientId = "",
        employeeMode = false,
        style,
    } = props

    const api = baseUrl.replace(/\/+$/, "")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = ConfigPagos_useContainerWidth(containerRef)
    const isMobile = containerWidth < 420
    // Umbral aparte (más alto) para pasar la grilla de 3 columnas de las
    // opciones de cobro a 1 sola columna: en un ancho "tablet" ya no entran
    // cómodas 3 cards, aunque todavía no sea "mobile" para el resto del layout.
    const isGridNarrow = containerWidth < 720

    const [loading, setLoading] = React.useState(true)
    const [savedOk, setSavedOk] = React.useState(false)
    const [error, setError] = React.useState("")
    // "total" es solo el default inicial. No se publica al Save Manager
    // hasta que terminamos de cargar la configuración real desde Supabase.
    const [configCargada, setConfigCargada] = React.useState(false)
    const [metodo, setMetodo] = React.useState<ConfigPagos_MetodoPago>("total")
    const [porcentaje, setPorcentaje] = React.useState(ConfigPagos_SENA_MINIMA)
    const pagosHydratedRef = React.useRef(false)
    const pagosLastEmittedRef = React.useRef("")
    // Solo se publican como cambio los campos que el usuario TOCÓ. Lo que la
    // UI muestra por defecto/coaccionado (ej. plan gratis con "none" mostrado
    // como "total") no se envía al servidor si nadie lo cambió.
    const metodoTocadoRef = React.useRef(false)
    const pctTocadoRef = React.useRef(false)
    const [porcentajeInput, setPorcentajeInput] = React.useState(
        String(ConfigPagos_SENA_MINIMA)
    )
    const [mpStatus, setMpStatus] = React.useState("Desconectado")
    const [mobbexStatus, setMobbexStatus] = React.useState("Desconectado")
    const [plan, setPlan] = React.useState<"gratis" | "basico" | "premium">("gratis")
    const [estadoSuscripcion, setEstadoSuscripcion] = React.useState("")

    const tienePasarela =
        mpStatus === "Conectado" || mobbexStatus === "Conectado"
    const esPremium = plan === "basico"
    const isCanvas = false

    React.useEffect(() => {
        if (typeof window === "undefined" || isCanvas || !configCargada) return

        // Se fusiona con lo último conocido (window.getPagosConfig) porque
        // el Save Manager REEMPLAZA el objeto "pagos" completo en cada
        // evento y ese objeto es el body del PUT. Sin esto, cambiar el % de
        // seña pisaría transferencia / efectivo / datos bancarios que se
        // hayan editado en MercadoPagoConexion (que hace la fusión inversa).
        const previo =
            typeof (window as any).getPagosConfig === "function"
                ? (window as any).getPagosConfig() || {}
                : {}
        const config: Record<string, any> = { ...previo }
        if (metodoTocadoRef.current) config.metodo_pago = metodo
        if (pctTocadoRef.current) config.porcentaje_sena = porcentaje
        ;(window as any).getPagosConfig = () => config

        const serialized = JSON.stringify(config)

        // La primera emisión después de cargar Supabase solo hidrata el
        // estado global. NO es una edición del usuario.
        if (!pagosHydratedRef.current) {
            pagosHydratedRef.current = true
            pagosLastEmittedRef.current = serialized
            return
        }

        // Evita volver a marcar dirty si el estado realmente no cambió.
        if (pagosLastEmittedRef.current === serialized) return

        pagosLastEmittedRef.current = serialized

        window.dispatchEvent(
            new CustomEvent("pagos_changed", {
                detail: config,
            })
        )
    }, [metodo, porcentaje, isCanvas, configCargada])

    React.useEffect(() => {
        if (typeof window === "undefined" || isCanvas) return
        const onSaved = () => {
            setSavedOk(true)
            setTimeout(() => setSavedOk(false), 3000)
        }
        window.addEventListener("config_saved", onSaved)
        return () => window.removeEventListener("config_saved", onSaved)
    }, [isCanvas])

    React.useEffect(() => {
        if (isCanvas) return
        const slug = ConfigPagos_getSlug()
        const token = ConfigPagos_getToken()
        let retries = 0
        const tryLoad = async () => {
            if (!slug || !token) {
                if (++retries < 10) {
                    setTimeout(tryLoad, 300)
                    return
                }
                setLoading(false)
                return
            }
            try {
                const configUrl = employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                    : `${api}/settings/${slug}`
                const res = await fetch(configUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada")
                    setLoading(false)
                    return
                }
                // Error del servidor (403/429/5xx) → NO hidratar con defaults.
                // Antes se tomaba {} como config real ("total", 20 %, sin
                // métodos) y cualquier "Guardar" posterior la escribía.
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const data = await res.json()
                if (!data?.success || !data?.settings)
                    throw new Error("Respuesta inválida")
                const cfg = data.settings

                const planRecibido: "gratis" | "basico" | "premium" = [
                    "basico",
                    "premium",
                ].includes(data?.plan || cfg?.plan)
                    ? (data?.plan || cfg?.plan)
                    : "gratis"
                setPlan(planRecibido)
                const estadoRecibido = cfg.estado_suscripcion || ""
                setEstadoSuscripcion(estadoRecibido)
                const metodoRecibido = cfg.metodo_pago || "total"
                // El valor del servidor manda al hidratar. Solo se normaliza
                // "none" donde la cuenta no puede usar reservas sin cobro.
                // Nadie queda sin Seña/Total marcado: "none" se muestra como
                // Total (default). Si ya hay "sena" guardado se respeta.
                let metodoHidratado =
                    metodoRecibido === "none" ? "total" : metodoRecibido
                setMetodo(metodoHidratado as ConfigPagos_MetodoPago)

                setMpStatus(cfg.mp_status || "Desconectado")
                setMobbexStatus(cfg.mobbex_status || "Desconectado")
                const pct = Math.max(
                    ConfigPagos_SENA_MINIMA,
                    Number(cfg.porcentaje_sena ?? ConfigPagos_SENA_MINIMA)
                )
                let porcentajeHidratado = pct
                setPorcentaje(pct)
                setPorcentajeInput(String(pct))
                TurnitsGlobalSaveManager_get()?.setBaseline(
                    "pagos",
                    Pagos_baselineDesdeSettings({
                        ...cfg,
                        plan: planRecibido,
                        estado_suscripcion: estadoRecibido,
                    })
                )
                const managerPagos = TurnitsGlobalSaveManager_get()
                const pendienteAntesDeHidratar =
                    managerPagos?.getPending("pagos")
                // Un método pendiente que contradice al valor que el servidor
                // acaba de confirmar es un evento viejo (p. ej. "total") y no
                // debe reemplazar la configuración guardada al reabrir Pagos.
                if (
                    pendienteAntesDeHidratar?.metodo_pago !== undefined &&
                    pendienteAntesDeHidratar.metodo_pago !== metodoHidratado
                ) {
                    managerPagos?.clearPendingFields("pagos", ["metodo_pago"])
                }
                const pendiente = managerPagos?.getPending("pagos")
                if (pendiente) {
                    if (
                        ["none", "sena", "total"].includes(
                            pendiente.metodo_pago
                        )
                    )
                        metodoHidratado =
                            planRecibido === "basico" &&
                            pendiente.metodo_pago === "none"
                                ? "total"
                                : pendiente.metodo_pago
                    if (pendiente.metodo_pago !== undefined)
                        setMetodo(metodoHidratado as ConfigPagos_MetodoPago)
                    if (pendiente.porcentaje_sena != null) {
                        const pp = Math.max(
                            ConfigPagos_SENA_MINIMA,
                            Number(pendiente.porcentaje_sena)
                        )
                        porcentajeHidratado = pp
                        setPorcentaje(pp)
                        setPorcentajeInput(String(pp))
                    }
                }
                // Mantener el caché compartido alineado con lo que acaba de
                // hidratar el selector; otros eventos de pagos lo reutilizan.
                const configHidratada = {
                    ...Pagos_baselineDesdeSettings({
                        ...cfg,
                        plan: planRecibido,
                        estado_suscripcion: estadoRecibido,
                    }),
                    ...(pendiente || {}),
                    metodo_pago: metodoHidratado,
                    porcentaje_sena: porcentajeHidratado,
                }
                ;(window as any).getPagosConfig = () => configHidratada
                // Básico (no trial) con "none" en el servidor: se deja
                // Total como pendiente para que lo mostrado coincida con lo
                // que realmente se cobra. Conserva transferencia/efectivo.
                if (
                    planRecibido === "basico" &&
                    cfg.metodo_pago !== "sena" &&
                    cfg.metodo_pago !== "total"
                )
                    TurnitsGlobalSaveManager_get()?.markDirty?.("pagos", {
                        ...configHidratada,
                        metodo_pago: "total",
                    })
                // Recién ahora la configuración real está hidratada. Desde
                // este punto los cambios del usuario (método / % de seña)
                // sí se publican al Save Manager y aparece "Guardar cambios".
                // Sin esto el efecto de abajo quedaba bloqueado para siempre.
                setConfigCargada(true)
                setLoading(false)
            } catch {
                if (++retries < 10) setTimeout(tryLoad, 400)
                else {
                    setLoading(false)
                    setError("Error al cargar configuración")
                }
            }
        }
        tryLoad()
    }, [api, isCanvas])

    if (isCanvas) {
        return (
            <div style={{ ...ConfigPagos_cardBase, ...style }}>
                <style>{ConfigPagos_shimmerCSS}</style>
                <ConfigPagos_CanvasPreview accentColor={accentColor} />
            </div>
        )
    }

    if (loading) return <ConfigPagos_Skeleton />

    const elegirMetodo = (m: ConfigPagos_MetodoPago) => {
        if (esPremium && m === "none") return
        metodoTocadoRef.current = true
        setMetodo(m)
        // Persiste la selección de inmediato y junto con el porcentaje que
        // está visible, sin esperar al efecto de React ni perderla si el
        // selector de Mercado Pago conserva un estado anterior.
        MercadoPagoConexion_emitPagosChanged({
            metodo_pago: m,
            porcentaje_sena: porcentaje,
        })
    }
    const handleSlider = (val: number) => {
        pctTocadoRef.current = true
        const clamped = Math.max(ConfigPagos_SENA_MINIMA, val)
        setPorcentaje(clamped)
        setPorcentajeInput(String(clamped))
    }
    const handleInputPct = (raw: string) => {
        setPorcentajeInput(raw)
        const n = parseFloat(raw)
        if (!isNaN(n) && n >= ConfigPagos_SENA_MINIMA && n <= 100) {
            pctTocadoRef.current = true
            setPorcentaje(Math.round(n))
        }
    }
    const handleInputPctBlur = () => {
        const n = parseFloat(porcentajeInput)
        if (isNaN(n) || n < ConfigPagos_SENA_MINIMA) {
            if (porcentaje !== ConfigPagos_SENA_MINIMA)
                pctTocadoRef.current = true
            setPorcentaje(ConfigPagos_SENA_MINIMA)
            setPorcentajeInput(String(ConfigPagos_SENA_MINIMA))
        } else if (n > 100) {
            setPorcentaje(100)
            setPorcentajeInput("100")
        } else {
            setPorcentaje(Math.round(n))
            setPorcentajeInput(String(Math.round(n)))
        }
    }

    const fillPct =
        ((porcentaje - ConfigPagos_SENA_MINIMA) /
            (100 - ConfigPagos_SENA_MINIMA)) *
        100
    const sliderBg = `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${fillPct}%, #e2e8f0 ${fillPct}%, #e2e8f0 100%)`
    const pctButtons = [20, 30, 50, 75, 100]

    return (
        <div
            ref={containerRef}
            style={
                {
                    ...ConfigPagos_cardBase,
                    ...style,
                    "--accent": accentColor,
                } as React.CSSProperties
            }
        >
            <style>{ConfigPagos_shimmerCSS}</style>

            {/* Header */}
            <div style={{ marginBottom: 16 }}>
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.3px",
                    }}
                >
                    Configuración de cobro
                </div>
                {!isMobile && (
                    <div
                        style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}
                    >
                        Elegí cómo y cuándo cobrarle al cliente tu servicio.
                    </div>
                )}
            </div>

            {/* Opciones: en grilla de 3 columnas en desktop, apiladas en
                mobile/tablet angosto — mismo criterio que Métodos de pago. */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isGridNarrow
                        ? "1fr"
                        : "repeat(auto-fit, minmax(200px, 1fr))",
                    alignItems: "start",
                    gap: 10,
                    marginBottom: 14,
                }}
            >
                {/* "Sin cobro online" se quitó por ahora (puede volver como
                    un modelo de agenda aparte). Para dejar de cobrar online
                    se usa el switch de Mercado Pago en Métodos de pago. */}

                {/* Seña — BÁSICO */}
                <ConfigPagos_OpcionMetodo
                    id="sena"
                    activo={metodo === "sena"}
                    accentColor={accentColor}
                    icono=""
                    titulo="Seña"
                    tag="RECOMENDADO"
                    isMobile={isMobile}
                    descripcion="El cliente paga un porcentaje del servicio al reservar."
                    onClick={() => elegirMetodo("sena")}
                    locked={false}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 10,
                            padding: isMobile ? "10px" : "14px",
                            border: "1px solid #f1f5f9",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 10,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: isMobile ? 10 : 12,
                                        fontWeight: 700,
                                        color: "#64748b",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                    }}
                                >
                                    {isMobile ? "Seña" : "Porcentaje de seña"}
                                </span>
                                <span
                                    style={{ fontSize: 10, color: "#94a3b8" }}
                                >
                                    Mínimo {ConfigPagos_SENA_MINIMA}%
                                </span>
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                }}
                            >
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={porcentajeInput}
                                    onChange={(e) =>
                                        handleInputPct(e.target.value)
                                    }
                                    onBlur={handleInputPctBlur}
                                    style={{
                                        width: isMobile ? 54 : 68,
                                        padding: "4px 8px",
                                        borderRadius: 8,
                                        border: "1.5px solid transparent",
                                        fontSize: isMobile ? 14 : 15,
                                        fontWeight: 800,
                                        color: accentColor,
                                        textAlign: "center",
                                        fontFamily:
                                            "'Inter Display', -apple-system, sans-serif",
                                        background: accentColor + "08",
                                        fontVariantNumeric: "tabular-nums",
                                        outline: "none",
                                        boxSizing: "border-box",
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: isMobile ? 14 : 16,
                                        fontWeight: 700,
                                        color: accentColor,
                                    }}
                                >
                                    %
                                </span>
                            </div>
                        </div>

                        <input
                            className="cp-slider"
                            type="range"
                            min={ConfigPagos_SENA_MINIMA}
                            max={100}
                            step={1}
                            value={porcentaje}
                            onChange={(e) =>
                                handleSlider(Number(e.target.value))
                            }
                            style={{ background: sliderBg }}
                        />

                        {!isMobile && (
                            <div
                                style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 10,
                                    flexWrap: "nowrap",
                                }}
                            >
                                {pctButtons.map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => handleSlider(v)}
                                        style={{
                                            flex: 1,
                                            padding: "4px 10px",
                                            borderRadius: 8,
                                            border: "none",
                                            background:
                                                porcentaje === v
                                                    ? accentColor
                                                    : "#f1f5f9",
                                            color:
                                                porcentaje === v
                                                    ? "#fff"
                                                    : "#64748b",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            fontFamily:
                                                "'Inter Display', -apple-system, sans-serif",
                                            transition: "all 0.12s",
                                            minWidth: 0,
                                        }}
                                    >
                                        {v}%
                                    </button>
                                ))}
                            </div>
                        )}

                        <div
                            style={{
                                marginTop: 10,
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: "#f8fafc",
                                border: "1px solid #f1f5f9",
                                fontSize: isMobile ? 11 : 12,
                                color: "#64748b",
                                lineHeight: 1.6,
                            }}
                        >
                            {isMobile ? (
                                <>
                                    Ej: $10.000 seña{" "}
                                    <strong style={{ color: accentColor }}>
                                        $
                                        {Math.round(
                                            (10000 * porcentaje) / 100
                                        ).toLocaleString("es-AR")}
                                    </strong>
                                </>
                            ) : (
                                <>
                                    Ej: servicio de{" "}
                                    <strong style={{ color: "#1e293b" }}>
                                        $10.000
                                    </strong>{" "}
                                    → seña de{" "}
                                    <strong style={{ color: accentColor }}>
                                        $
                                        {Math.round(
                                            (10000 * porcentaje) / 100
                                        ).toLocaleString("es-AR")}
                                    </strong>{" "}
                                    ({porcentaje}%)
                                </>
                            )}
                        </div>
                    </div>
                </ConfigPagos_OpcionMetodo>

                {/* Total — disponible para todos */}
                <ConfigPagos_OpcionMetodo
                    id="total"
                    activo={metodo === "total"}
                    accentColor={accentColor}
                    icono=""
                    titulo="Total del servicio"
                    isMobile={isMobile}
                    descripcion="El cliente paga el precio completo al momento de reservar."
                    onClick={() => elegirMetodo("total")}
                    locked={false}
                />
            </div>

            {/* Footer */}
            <div
                style={{
                    marginTop: "auto",
                    paddingTop: 14,
                    borderTop: "1px solid #f1f5f9",
                    display: "flex",
                    justifyContent: "flex-start",
                }}
            >
                {error ? (
                    <span style={{ fontSize: 11, color: "#ef4444" }}>
                        {error}
                    </span>
                ) : savedOk ? (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            fontSize: 11,
                            color: "#22c55e",
                            fontWeight: 600,
                        }}
                    >
                        Guardado
                    </motion.span>
                ) : null}
            </div>
        </div>
    )
}

function ConfigPagos_CanvasPreview({ accentColor }: { accentColor: string }) {
    const opciones = [
        {
            icono: "",
            label: "Seña",
            activo: false,
            tag: "RECOMENDADO",
            locked: false,
        },
        {
            icono: "",
            label: "Total del servicio",
            activo: true,
            locked: false,
        },
    ]
    return (
        <>
            <div style={{ marginBottom: 18 }}>
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.3px",
                    }}
                >
                    Configuración de cobro
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Elegí cómo y cuándo cobrarle al cliente al reservar
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginBottom: 14,
                }}
            >
                {opciones.map(({ icono, label, activo, tag, locked }) => (
                    <div
                        key={label}
                        style={{
                            borderRadius: 14,
                            padding: "14px 16px",
                            border: `1.5px solid ${locked ? "#e2e8f0" : activo ? accentColor + "55" : "#e2e8f0"}`,
                            background: locked
                                ? "#f8fafc"
                                : activo
                                  ? accentColor + "06"
                                  : "#fafafa",
                            opacity: locked ? 0.55 : 1,
                filter: locked ? "grayscale(1)" : "none",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                            }}
                        >
                            <div
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    border: `2px solid ${locked ? "#cbd5e1" : activo ? accentColor : "#cbd5e1"}`,
                                    background: locked
                                        ? "#f1f5f9"
                                        : activo
                                          ? accentColor
                                          : "transparent",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 9,
                                }}
                            >
                                {locked ? (
                                    ""
                                ) : activo ? (
                                    <div
                                        style={{
                                            width: 7,
                                            height: 7,
                                            borderRadius: "50%",
                                            background: "#fff",
                                        }}
                                    />
                                ) : null}
                            </div>
                            <span style={{ fontSize: 20 }}>{icono}</span>
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: locked
                                                ? "#94a3b8"
                                                : activo
                                                  ? "#1e293b"
                                                  : "#64748b",
                                            letterSpacing: "-0.2px",
                                        }}
                                    >
                                        {label}
                                    </span>
                                    {locked && (
                                        <TurnitsPlanRequirement premiumOnly />
                                    )}
                                    {!locked && tag && (
                                        <span
                                            style={{
                                                fontSize: 10,
                                                fontWeight: 700,
                                                padding: "2px 7px",
                                                borderRadius: 99,
                                                background: accentColor + "18",
                                                color: accentColor,
                                            }}
                                        >
                                            {tag}
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "#94a3b8",
                                        marginTop: 2,
                                    }}
                                >
                                    El cliente paga el precio completo al reservar.
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    )
}

function ThemeEditor_PlaceholderIcon({
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

export { MercadoPagoConexion_Skeleton, MercadoPagoConexion_Switch, MercadoPagoConexion_LinkIcon, MercadoPagoConexion_MetodoIcon, MercadoPagoConexion_MetodoCard, MercadoPagoConexion, MercadoPagoConexion_CanvasPreview, ConfigPagos_Skeleton, ConfigPagos_PremiumBadge, ConfigPagos_OpcionMetodo, PagosSettingsGuard, ConfigPagos, ConfigPagos_CanvasPreview, ThemeEditor_PlaceholderIcon }
