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
import { OnboardingNube_ACCENT, OnboardingNube_HAIRLINE, OnboardingNube_INK, OnboardingNube_FONT_BODY, OnboardingNube_getSlug, safeLocalStorage, OnboardingNube_getToken, OnboardingNube_marcarVisto, safeLocalStorageSet, OnboardingNube_esperarToken, OnboardingNube_MSG_SIN_SESION, OnboardingNube_DIAS, MercadoPagoConexion_solicitarUrlOAuth, OnboardingNube_MUTED, OnboardingNube_FONT_DISPLAY, OnboardingNube_DURACIONES } from "./common"
import { OnboardingNube_Fondo, OnboardingNube_Glass, OnboardingNube_Folio, OnboardingNube_Input } from "./cuenta"

function OnboardingNube_Chip({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: active
                    ? `1.5px solid ${OnboardingNube_ACCENT}`
                    : `1.5px solid ${OnboardingNube_HAIRLINE}`,
                background: active
                    ? OnboardingNube_ACCENT
                    : "rgba(255,255,255,0.8)",
                color: active ? "#fff" : OnboardingNube_INK,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: OnboardingNube_FONT_BODY,
                transition: "background 0.15s ease, border-color 0.15s ease",
            }}
        >
            {children}
        </button>
    )
}

function OnboardingNube_BotonPrincipal({
    children,
    onClick,
    disabled,
    loading,
}: {
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
    loading?: boolean
}) {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            whileTap={{ scale: 0.98 }}
            style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 12,
                border: "none",
                background:
                    disabled || loading
                        ? "rgba(18,19,26,0.25)"
                        : OnboardingNube_ACCENT,
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: disabled || loading ? "default" : "pointer",
                fontFamily: OnboardingNube_FONT_BODY,
                boxShadow:
                    disabled || loading
                        ? "none"
                        : "0 8px 20px rgba(27,107,26,0.24)",
            }}
        >
            {loading ? "Guardando..." : children}
        </motion.button>
    )
}

function OnboardingNube({ baseUrl, accentColor, mpClientId, onFinish }: any) {
    const api = (baseUrl || "https://negosocio.onrender.com").replace(
        /\/+$/,
        ""
    )

    const [fase, setFase] = React.useState<
        "cargando" | "paso" | "listo" | "oculto"
    >("cargando")

    // Si la verificación tarda (server despertando, red lenta) el overlay
    // "Preparando tu agenda..." deja de tapar el panel y se sigue
    // verificando en segundo plano.
    const [verificacionLenta, setVerificacionLenta] = React.useState(false)

    const [paso, setPaso] = React.useState(0)
    const [guardando, setGuardando] = React.useState(false)
    const [errorMsg, setErrorMsg] = React.useState("")

    const [tieneServicios, setTieneServicios] = React.useState(false)
    const [tieneHorarios, setTieneHorarios] = React.useState(false)
    const [metodoListo, setMetodoListo] = React.useState(false)

    const [plan, setPlan] = React.useState<"gratis" | "basico">("gratis")

    const esPremium = plan === "basico"

    const [svcNombre, setSvcNombre] = React.useState("")
    const [svcPrecio, setSvcPrecio] = React.useState("")
    const [svcDuracion, setSvcDuracion] = React.useState(30)

    const [diasSel, setDiasSel] = React.useState<Set<string>>(
        new Set(["lunes", "martes", "miercoles", "jueves", "viernes"])
    )

    const [horaInicio, setHoraInicio] = React.useState("09:00")
    const [horaFin, setHoraFin] = React.useState("20:00")

    // ─── Descanso (opcional): igual que en la configuración de
    // horarios del panel — un bloque "De/A" aparte de la jornada, que
    // si se deja vacío no se guarda (queda [null, null]).
    const [descansoInicio, setDescansoInicio] = React.useState("")
    const [descansoFin, setDescansoFin] = React.useState("")

    React.useEffect(() => {
        if (typeof window === "undefined") return

        // El flag de "omitido" ahora se guarda POR CUENTA (por slug), no
        // global para todo el navegador. Antes, si un solo negocio lo
        // omitía una vez en este dispositivo, quedaba oculto para
        // siempre para CUALQUIER cuenta que se loguee ahí después — ese
        // era el bug de "se salta solo y no muestra nada".
        const slugParaFlag = OnboardingNube_getSlug()
        const claveOmitido = slugParaFlag
            ? `onboarding_omitido_${slugParaFlag}`
            : "onboarding_omitido"

        if (slugParaFlag && safeLocalStorage(claveOmitido) === "1") {
            console.warn(
                `[OnboardingNube] ⛔ localStorage['${claveOmitido}'] === '1' → ` +
                    "el tutorial se oculta sin más chequeos para esta cuenta. " +
                    "Si querés que vuelva a aparecer, corré: " +
                    `localStorage.removeItem('${claveOmitido}')`
            )
            setFase("oculto")
            return
        }

        console.log("[OnboardingNube] arrancando tryLoad...")

        // ── Verificación del estado de la cuenta ─────────────────────────
        // REGLA: el tutorial SOLO se muestra si el servidor CONFIRMÓ que
        // falta algo. Si no se puede verificar (sin token, red caída, 429,
        // 5xx, 401/403…) NO se muestra. Antes se abría igual ("fail-open")
        // y una cuenta vieja ya configurada veía el tutorial pidiéndole
        // cargar todo de nuevo — y "Guardar" en horarios le habría pisado
        // los suyos con los valores por defecto.
        //  · 401 / 403 / 404 → error definitivo: no se reintenta.
        //  · 429 / 5xx / red → transitorio: se reintenta con espera creciente
        //    (1, 2, 4, 8, 16, 30 s…) hasta 3 min. Antes se reintentaba cada
        //    300 ms (60 requests en 10 s), que agravaba un 429.
        //  · Sin token/slug: se espera hasta 10 s a que aparezca (lo escribe
        //    el login) y después se sigue reintentando con espera creciente.
        // Si al final no se pudo verificar, el tutorial no aparece en esta
        // carga y se vuelve a intentar en la próxima apertura del panel.
        const inicio = Date.now()
        const PRESUPUESTO_MS = 3 * 60 * 1000
        let intento = 0
        let cancelado = false
        let timer: any = null

        const lentoTimer = setTimeout(() => {
            if (!cancelado) setVerificacionLenta(true)
        }, 3500)

        const abandonar = (motivo: string) => {
            if (cancelado) return
            console.warn(
                `[OnboardingNube] No se pudo verificar la cuenta (${motivo}). ` +
                    "El tutorial NO se muestra; se reintenta en la próxima carga del panel."
            )
            setFase("oculto")
        }

        const reintentar = (motivo: string) => {
            if (cancelado) return
            intento++
            const espera = Math.min(30000, 1000 * 2 ** Math.min(intento - 1, 5))
            if (Date.now() - inicio + espera > PRESUPUESTO_MS) {
                abandonar(motivo)
                return
            }
            console.warn(
                `[OnboardingNube] Verificación falló (${motivo}). Reintento ${intento} en ${espera / 1000}s.`
            )
            timer = setTimeout(tryLoad, espera)
        }

        const tryLoad = async () => {
            if (cancelado) return
            const slug = OnboardingNube_getSlug()
            const token = OnboardingNube_getToken()

            console.log("[OnboardingNube] intento", intento, {
                slug,
                tieneToken: Boolean(token),
                localStorageKeys: (() => {
                    try {
                        return typeof window !== "undefined"
                            ? Object.keys(window.localStorage)
                            : []
                    } catch {
                        return []
                    }
                })(),
            })

            if (!slug || !token) {
                if (Date.now() - inicio < 10000) {
                    timer = setTimeout(tryLoad, 300)
                    return
                }
                reintentar(!slug ? "sin slug" : "sin token en localStorage")
                return
            }

            try {
                const [settingsRes, serviciosRes] = await Promise.all([
                    fetch(`${api}/settings/${slug}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        cache: "no-cache",
                    }),
                    fetch(`${api}/admin/servicios/${slug}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        cache: "no-cache",
                    }),
                ])
                if (cancelado) return

                console.log("[OnboardingNube] respuestas HTTP", {
                    settingsStatus: settingsRes.status,
                    serviciosStatus: serviciosRes.status,
                })

                const detalle = `settings=${settingsRes.status} servicios=${serviciosRes.status}`
                if (
                    [settingsRes.status, serviciosRes.status].some(
                        (s) => s === 401 || s === 403 || s === 404
                    )
                ) {
                    abandonar(`HTTP ${detalle}`)
                    return
                }
                if (!settingsRes.ok || !serviciosRes.ok) {
                    reintentar(`HTTP ${detalle}`)
                    return
                }

                const settingsData = await settingsRes.json()
                const serviciosData = await serviciosRes.json()
                if (cancelado) return

                const s = settingsData?.settings || {}
                const horarios = s.horarios || {}

                const yaHorarios = Object.values(horarios).some(
                    (d: any) => d?.activo
                )

                const yaMetodo =
                    s.mp_status === "Conectado" || !!s.acepta_efectivo

                const yaServicios = (serviciosData?.servicios || []).length > 0

                console.log("[OnboardingNube] estado calculado", {
                    yaServicios,
                    yaHorarios,
                    yaMetodo,
                    settingsData,
                    serviciosData,
                })

                setTieneServicios(yaServicios)
                setTieneHorarios(yaHorarios)
                setMetodoListo(yaMetodo)
                setPlan(
                    ["basico", "premium"].includes(s.plan) ? "basico" : "gratis"
                )

                // El tutorial es SOLO para cuentas nuevas. La señal de "cuenta ya
                // usada" es tener servicios: los horarios NO sirven de señal
                // porque el registro puede crearlos ya cargados (la cuenta nueva
                // los tendría desde el día 1 y nunca vería el tutorial). Al
                // ocultarlo se deja marcado para que no vuelva a aparecer (ni
                // siquiera si más adelante borra todos sus servicios). Antes se
                // exigía también el método de pago, y una cuenta vieja que cobra
                // por transferencia o sin seña (mp_status desconectado y
                // acepta_efectivo vacío) veía el tutorial en cada carga.
                if (yaServicios) {
                    console.log(
                        "[OnboardingNube] cuenta ya configurada → se oculta y no vuelve a mostrarse"
                    )
                    OnboardingNube_marcarVisto(slug)
                    setFase("oculto")
                    return
                }

                setPaso(!yaServicios ? 0 : !yaHorarios ? 1 : 2)

                setFase("paso")
            } catch (err) {
                console.error("[OnboardingNube] error en tryLoad:", err)
                reintentar("error de red")
            }
        }

        tryLoad()

        return () => {
            cancelado = true
            if (timer) clearTimeout(timer)
            clearTimeout(lentoTimer)
        }
    }, [api])

    React.useEffect(() => {
        if (fase === "oculto") onFinish?.()
    }, [fase])

    const avanzar = () => {
        setErrorMsg("")

        if (paso < 2) {
            setPaso((p) => p + 1)
        } else {
            OnboardingNube_marcarVisto()
            setFase("listo")

            setTimeout(() => {
                setFase("oculto")
            }, 1700)
        }
    }

    const omitirTodo = () => {
        try {
            // Usa la misma clave por-cuenta que se lee al montar el
            // componente, para no pisar/afectar a otras cuentas que usen
            // el mismo navegador.
            const slugActual = OnboardingNube_getSlug()
            const clave = slugActual
                ? `onboarding_omitido_${slugActual}`
                : "onboarding_omitido"
            safeLocalStorageSet(clave, "1")
        } catch {}

        setFase("oculto")
    }

    const crearServicio = async () => {
        if (!svcNombre.trim()) {
            setErrorMsg("Ponele un nombre al servicio")
            return
        }

        const slug = OnboardingNube_getSlug()
        setGuardando(true)
        setErrorMsg("")

        const token = await OnboardingNube_esperarToken("crearServicio")
        if (!token) {
            setErrorMsg(OnboardingNube_MSG_SIN_SESION)
            setGuardando(false)
            return
        }

        try {
            const res = await fetch(`${api}/admin/servicios`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug,
                    nombre: svcNombre.trim(),
                    descripcion: "",
                    duracion: svcDuracion,
                    precio: Number(svcPrecio) || 0,
                    capacidad: 1,
                    orden: 0,
                }),
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || `Error ${res.status}`)
            }

            setTieneServicios(true)
            avanzar()
        } catch (e: any) {
            setErrorMsg(e.message || "No se pudo crear el servicio")
        }

        setGuardando(false)
    }

    const guardarHorarios = async () => {
        if (diasSel.size === 0) {
            setErrorMsg("Elegí al menos un día")
            return
        }

        const slug = OnboardingNube_getSlug()
        setGuardando(true)
        setErrorMsg("")

        const token = await OnboardingNube_esperarToken("guardarHorarios")
        if (!token) {
            setErrorMsg(OnboardingNube_MSG_SIN_SESION)
            setGuardando(false)
            return
        }

        try {
            const horarios: Record<string, any> = {}

            // El descanso es opcional: si el usuario no cargó ambos
            // horarios (desde y hasta), no se guarda nada para ese
            // bloque — mismo criterio que en la configuración de
            // horarios del panel.
            const descansoCargado = descansoInicio && descansoFin

            OnboardingNube_DIAS.forEach(({ key }) => {
                horarios[key] = diasSel.has(key)
                    ? {
                          activo: true,
                          jornada: [horaInicio, horaFin],
                          descanso: descansoCargado
                              ? [descansoInicio, descansoFin]
                              : [null, null],
                      }
                    : {
                          activo: false,
                          jornada: [null, null],
                          descanso: [null, null],
                      }
            })

            const res = await fetch(`${api}/settings/${slug}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    horarios,
                }),
            })

            if (!res.ok) {
                const d = await res.json().catch(() => ({}))

                throw new Error(d.error || "Error al guardar horarios")
            }

            setTieneHorarios(true)
            avanzar()
        } catch (e: any) {
            setErrorMsg(e.message || "No se pudo guardar el horario")
        }

        setGuardando(false)
    }

    const conectarMercadoPago = async () => {
        const slug = OnboardingNube_getSlug()

        if (!slug) {
            setErrorMsg(
                "La conexión con Mercado Pago no está configurada todavía."
            )
            return
        }

        setGuardando(true)
        setErrorMsg("")
        const token = await OnboardingNube_esperarToken("conectarMercadoPago")
        if (!token) {
            setErrorMsg(OnboardingNube_MSG_SIN_SESION)
            setGuardando(false)
            return
        }

        try {
            const authUrl = await MercadoPagoConexion_solicitarUrlOAuth(
                api,
                slug,
                token
            )
            window.location.href = authUrl
        } catch (e: any) {
            setErrorMsg(e.message || "No se pudo conectar Mercado Pago")
            setGuardando(false)
        }
    }

    const cobrarEnEfectivo = async () => {
        const slug = OnboardingNube_getSlug()
        setGuardando(true)
        setErrorMsg("")

        const token = await OnboardingNube_esperarToken("cobrarEnEfectivo")
        if (!token) {
            setErrorMsg(OnboardingNube_MSG_SIN_SESION)
            setGuardando(false)
            return
        }

        try {
            const res = await fetch(`${api}/settings/${slug}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    acepta_efectivo: true,
                }),
            })

            if (!res.ok) {
                const d = await res.json().catch(() => ({}))

                throw new Error(d.error || "Error al guardar")
            }

            setMetodoListo(true)
            avanzar()
        } catch (e: any) {
            setErrorMsg(e.message || "No se pudo guardar")
        }

        setGuardando(false)
    }

    if (fase === "oculto") return null

    // Verificando en segundo plano: el panel queda usable (sin overlay).
    if (fase === "cargando" && verificacionLenta) return null

    return (
        <div
            className="tn-onb-root"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                boxSizing: "border-box",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
            }}
        >
            {/* Si la tarjeta es más alta que la pantalla (teclado abierto,
                celulares chicos) se puede scrollear en vez de quedar
                cortada arriba. "safe center" evita el corte del tope. */}
            <style>{`
.tn-onb-root{overflow-y:auto}
@supports (align-items:safe center){.tn-onb-root{align-items:safe center !important}}
.tn-onb-time-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px;row-gap:10px;width:100%;min-width:0}
.tn-onb-time-row>label{width:100%;max-width:100%;min-width:0}
.tn-onb-time-row input[type=time]{display:block;width:calc(100% - 6px) !important;max-width:calc(100% - 6px) !important;min-width:0 !important;box-sizing:border-box;font-size:16px !important;padding:7px 4px !important;justify-self:start}
@media (max-width:640px){
.tn-onb-root{padding:60px 14px 24px !important}
.tn-onb-glass{padding:26px 20px !important}
}
`}</style>
            <OnboardingNube_Fondo />

            {fase !== "listo" && fase !== "cargando" && (
                <button
                    onClick={omitirTodo}
                    style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 2,
                        background: "transparent",
                        border: "none",
                        padding: "7px 4px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: OnboardingNube_MUTED,
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                        cursor: "pointer",
                        fontFamily: OnboardingNube_FONT_BODY,
                    }}
                >
                    Saltear por ahora
                </button>
            )}

            <AnimatePresence mode="wait">
                {fase === "cargando" && (
                    <motion.div
                        key="cargando"
                        initial={{
                            opacity: 0,
                        }}
                        animate={{
                            opacity: 1,
                        }}
                        exit={{
                            opacity: 0,
                        }}
                        style={{
                            position: "relative",
                            zIndex: 1,
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: OnboardingNube_ACCENT,
                            fontFamily: OnboardingNube_FONT_BODY,
                        }}
                    >
                        Preparando tu agenda...
                    </motion.div>
                )}

                {fase === "paso" && (
                    <motion.div
                        key={`paso-${paso}`}
                        initial={{
                            opacity: 0,
                            y: 18,
                            scale: 0.98,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            y: -14,
                            scale: 0.98,
                        }}
                        transition={{
                            duration: 0.28,
                            ease: "easeOut",
                        }}
                    >
                        <OnboardingNube_Glass>
                            <div
                                style={{
                                    textAlign: "left" as const,
                                    marginBottom: 22,
                                }}
                            >
                                <OnboardingNube_Folio
                                    total={3}
                                    current={paso}
                                />

                                <div
                                    style={{
                                        fontFamily: OnboardingNube_FONT_DISPLAY,
                                        fontSize: 22,
                                        fontWeight: 700,
                                        color: OnboardingNube_INK,
                                        letterSpacing: "-0.01em",
                                        marginTop: 10,
                                        marginBottom: 6,
                                    }}
                                >
                                    {paso === 0 && "Creá tu primer servicio"}

                                    {paso === 1 && "Elegí tu disponibilidad"}

                                    {paso === 2 && "¿Cómo te van a pagar?"}
                                </div>

                                <div
                                    style={{
                                        fontSize: 13,
                                        color: OnboardingNube_MUTED,
                                        lineHeight: 1.45,
                                    }}
                                >
                                    {paso === 0 &&
                                        "Lo básico para que tus clientes puedan reservar. Después podés sumar más y editarlo."}

                                    {paso === 1 &&
                                        "Marcá los días que atendés y un horario — lo podés afinar más adelante."}

                                    {paso === 2 &&
                                        (esPremium
                                            ? "Conectá Mercado Pago o arrancá cobrando en efectivo, lo que prefieras ahora."
                                            : "Conectá Mercado Pago para poder cobrarle a tus clientes al reservar.")}
                                </div>
                            </div>

                            {paso === 0 && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 14,
                                    }}
                                >
                                    <OnboardingNube_Input
                                        label="Nombre del servicio"
                                        placeholder="Nombre del servicio"
                                        value={svcNombre}
                                        onChange={(e: any) =>
                                            setSvcNombre(e.target.value)
                                        }
                                    />

                                    <OnboardingNube_Input
                                        label="Precio"
                                        type="number"
                                        prefix="$"
                                        placeholder="0"
                                        value={svcPrecio}
                                        onChange={(e: any) =>
                                            setSvcPrecio(e.target.value)
                                        }
                                    />

                                    <div>
                                        <span
                                            style={{
                                                display: "block",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: OnboardingNube_INK,
                                                marginBottom: 6,
                                            }}
                                        >
                                            Duración
                                        </span>

                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 8,
                                                flexWrap: "wrap" as const,
                                            }}
                                        >
                                            {OnboardingNube_DURACIONES.map(
                                                (d) => (
                                                    <OnboardingNube_Chip
                                                        key={d}
                                                        active={
                                                            svcDuracion === d
                                                        }
                                                        onClick={() =>
                                                            setSvcDuracion(d)
                                                        }
                                                    >
                                                        {d} min
                                                    </OnboardingNube_Chip>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {errorMsg && (
                                        <div
                                            style={{
                                                fontSize: 12.5,
                                                color: "#dc2626",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {errorMsg}
                                        </div>
                                    )}

                                    <OnboardingNube_BotonPrincipal
                                        onClick={crearServicio}
                                        loading={guardando}
                                    >
                                        Crear y continuar
                                    </OnboardingNube_BotonPrincipal>
                                </div>
                            )}

                            {paso === 1 && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 14,
                                    }}
                                >
                                    <div>
                                        <span
                                            style={{
                                                display: "block",
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: OnboardingNube_INK,
                                                marginBottom: 6,
                                            }}
                                        >
                                            Días que atendés
                                        </span>

                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 6,
                                                flexWrap: "wrap" as const,
                                            }}
                                        >
                                            {OnboardingNube_DIAS.map((d) => {
                                                const on = diasSel.has(d.key)

                                                return (
                                                    <OnboardingNube_Chip
                                                        key={d.key}
                                                        active={on}
                                                        onClick={() =>
                                                            setDiasSel(
                                                                (prev) => {
                                                                    const next =
                                                                        new Set(
                                                                            prev
                                                                        )

                                                                    if (on)
                                                                        next.delete(
                                                                            d.key
                                                                        )
                                                                    else
                                                                        next.add(
                                                                            d.key
                                                                        )

                                                                    return next
                                                                }
                                                            )
                                                        }
                                                    >
                                                        {d.label}
                                                    </OnboardingNube_Chip>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="tn-onb-time-row">
                                        <OnboardingNube_Input
                                            label="Desde"
                                            type="time"
                                            className="tn-onb-time-input"
                                            value={horaInicio}
                                            onChange={(e: any) =>
                                                setHoraInicio(e.target.value)
                                            }
                                        />

                                        <OnboardingNube_Input
                                            label="Hasta"
                                            type="time"
                                            className="tn-onb-time-input"
                                            value={horaFin}
                                            onChange={(e: any) =>
                                                setHoraFin(e.target.value)
                                            }
                                        />
                                    </div>

                                    <div
                                        style={{
                                            paddingTop: 12,
                                            borderTop: `1px solid ${OnboardingNube_HAIRLINE}`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: OnboardingNube_INK,
                                                marginBottom: 8,
                                            }}
                                        >
                                            Descanso{" "}
                                            <span
                                                style={{
                                                    fontSize: 10.5,
                                                    fontWeight: 500,
                                                    color: OnboardingNube_MUTED,
                                                }}
                                            >
                                                opcional
                                            </span>
                                        </div>
                                        <div className="tn-onb-time-row">
                                            <OnboardingNube_Input
                                                label="Desde"
                                                type="time"
                                                className="tn-onb-time-input"
                                                value={descansoInicio}
                                                onChange={(e: any) =>
                                                    setDescansoInicio(
                                                        e.target.value
                                                    )
                                                }
                                            />

                                            <OnboardingNube_Input
                                                label="Hasta"
                                                type="time"
                                                className="tn-onb-time-input"
                                                value={descansoFin}
                                                onChange={(e: any) =>
                                                    setDescansoFin(
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    {errorMsg && (
                                        <div
                                            style={{
                                                fontSize: 12.5,
                                                color: "#dc2626",
                                                fontWeight: 600,
                                            }}
                                        >
                                            {errorMsg}
                                        </div>
                                    )}

                                    <OnboardingNube_BotonPrincipal
                                        onClick={guardarHorarios}
                                        loading={guardando}
                                    >
                                        Guardar y continuar
                                    </OnboardingNube_BotonPrincipal>
                                </div>
                            )}

                            {paso === 2 && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                    }}
                                >
                                    <OnboardingNube_BotonPrincipal
                                        onClick={conectarMercadoPago}
                                    >
                                        Conectar Mercado Pago
                                    </OnboardingNube_BotonPrincipal>

                                    {esPremium && (
                                        <>
                                            <div
                                                style={{
                                                    textAlign:
                                                        "center" as const,
                                                    fontSize: 12,
                                                    color: OnboardingNube_MUTED,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                — o —
                                            </div>

                                            <button
                                                onClick={cobrarEnEfectivo}
                                                disabled={guardando}
                                                style={{
                                                    width: "100%",
                                                    padding: "12px 16px",
                                                    borderRadius: 12,
                                                    border: `1.5px solid ${OnboardingNube_HAIRLINE}`,
                                                    background:
                                                        "rgba(255,255,255,0.8)",
                                                    color: OnboardingNube_INK,
                                                    fontSize: 13.5,
                                                    fontWeight: 700,
                                                    cursor: "pointer",
                                                    fontFamily:
                                                        OnboardingNube_FONT_BODY,
                                                }}
                                            >
                                                {guardando
                                                    ? "Guardando..."
                                                    : "Prefiero cobrar en efectivo por ahora"}
                                            </button>
                                        </>
                                    )}

                                    {!esPremium && (
                                        <div
                                            style={{
                                                textAlign: "center" as const,
                                                fontSize: 11.5,
                                                color: OnboardingNube_MUTED,
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            Cobrar en efectivo o por
                                            transferencia está disponible en el
                                            Plan Básico.
                                        </div>
                                    )}

                                    {errorMsg && (
                                        <div
                                            style={{
                                                fontSize: 12.5,
                                                color: "#dc2626",
                                                fontWeight: 600,
                                                textAlign: "center" as const,
                                            }}
                                        >
                                            {errorMsg}
                                        </div>
                                    )}
                                </div>
                            )}
                        </OnboardingNube_Glass>
                    </motion.div>
                )}

                {fase === "listo" && (
                    <motion.div
                        key="listo"
                        initial={{
                            opacity: 0,
                            scale: 0.9,
                        }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            scale: 1.05,
                        }}
                        transition={{
                            duration: 0.3,
                            ease: "easeOut",
                        }}
                    >
                        <OnboardingNube_Glass>
                            <div
                                style={{
                                    textAlign: "center" as const,
                                    padding: "10px 0",
                                }}
                            >
                                <div
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: "50%",
                                        background: OnboardingNube_ACCENT,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        margin: "0 auto 16px",
                                        boxShadow:
                                            "0 10px 24px rgba(27,107,26,0.32)",
                                    }}
                                >
                                    <svg
                                        width="26"
                                        height="26"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#fff"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                </div>

                                <div
                                    style={{
                                        fontFamily: OnboardingNube_FONT_DISPLAY,
                                        fontSize: 18,
                                        fontWeight: 700,
                                        color: OnboardingNube_INK,
                                        marginBottom: 4,
                                    }}
                                >
                                    ¡Tu agenda ya está lista!
                                </div>

                                <div
                                    style={{
                                        fontSize: 13,
                                        color: OnboardingNube_MUTED,
                                    }}
                                >
                                    Ya podés empezar a recibir turnos.
                                </div>
                            </div>
                        </OnboardingNube_Glass>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export { OnboardingNube_Chip, OnboardingNube_BotonPrincipal, OnboardingNube }
