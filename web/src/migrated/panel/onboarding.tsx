import { fetchPanelRead } from "../../shared/panel-requests"
import { appConfig } from "../../config"
import { useSearchParams } from "react-router"
import { loadQuoteMode } from "../../shared/agenda-mode"
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
import { OnboardingNube_Input } from "./cuenta"
import SetupArtwork, { type SetupStep } from "../../components/SetupArtwork"
import "./onboarding.css"

function OnboardingSetupCard({ step, children }: { step: SetupStep; children: React.ReactNode }) {
    return <section className="tn-onb-card" data-step={step} aria-label="Configuración inicial">
        <div className="tn-onb-art"><SetupArtwork step={step} /></div>
        <div className="tn-onb-content">{children}</div>
    </section>
}

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
                borderRadius: 999,
                border: "none",
                background:
                    disabled || loading
                        ? "rgba(18,19,26,0.25)"
                        : OnboardingNube_ACCENT,
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 500,
                cursor: disabled || loading ? "default" : "pointer",
                fontFamily: OnboardingNube_FONT_BODY,
                boxShadow: "none",
            }}
        >
            {loading ? "Guardando..." : children}
        </motion.button>
    )
}

function OnboardingNube({ baseUrl, accentColor, mpClientId, onFinish }: any) {
    const [returnParams, setReturnParams] = useSearchParams()
    const [mpReturn] = React.useState(() => returnParams.get("onboarding") === "mp" && ["mp_success", "mp_error"].includes(returnParams.get("status") || "") ? returnParams.get("status") : null)
    const api = (baseUrl || appConfig.apiUrl).replace(
        /\/+$/,
        ""
    )

    const [fase, setFase] = React.useState<
        "cargando" | "paso" | "listo" | "oculto"
    >("cargando")


    const [paso, setPaso] = React.useState(0)
    const [guardando, setGuardando] = React.useState(false)
    const [errorMsg, setErrorMsg] = React.useState("")

    const [tieneServicios, setTieneServicios] = React.useState(false)
    const [tieneHorarios, setTieneHorarios] = React.useState(false)
    const [metodoListo, setMetodoListo] = React.useState(false)
    const [quoteMode, setQuoteMode] = React.useState(false)

    const [plan, setPlan] = React.useState<"gratis" | "basico" | "premium">("gratis")

    const esPremium = plan === "premium"

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

        if (!mpReturn && slugParaFlag && safeLocalStorage(claveOmitido) === "1") {
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
                const [settingsRes, serviciosRes, isQuoteMode] = await Promise.all([
                    fetchPanelRead(`${api}/settings/${slug}`, {
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
                    loadQuoteMode(api, slug),
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
                setQuoteMode(isQuoteMode)
                setPlan(
                    ["basico", "premium"].includes(s.plan) ? s.plan : "gratis"
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
                if (mpReturn) {
                    setReturnParams(previous => {
                        const next = new URLSearchParams(previous)
                        next.delete("onboarding"); next.delete("status"); next.delete("reason")
                        return next
                    }, { replace: true })
                    if (mpReturn === "mp_success" && s.mp_status === "Conectado" && yaServicios && (isQuoteMode || yaHorarios)) {
                        OnboardingNube_marcarVisto(slug)
                        setFase("listo")
                        timer = setTimeout(() => { if (!cancelado) setFase("oculto") }, 1700)
                        return
                    }
                    setErrorMsg(mpReturn === "mp_error"
                        ? "La conexión no se completó. Tus servicios y horarios siguen guardados; podés volver a intentarlo."
                        : "No pudimos confirmar la conexión con Mercado Pago. Volvé a intentarlo.")
                    setPaso(!yaServicios ? 0 : isQuoteMode || yaHorarios ? (isQuoteMode ? 1 : 2) : 1)
                    setFase("paso")
                    return
                }
                if (yaServicios) {
                    console.log(
                        "[OnboardingNube] cuenta ya configurada → se oculta y no vuelve a mostrarse"
                    )
                    OnboardingNube_marcarVisto(slug)
                    setFase("oculto")
                    return
                }

                setPaso(isQuoteMode ? 0 : !yaServicios ? 0 : !yaHorarios ? 1 : 2)

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
        }
    }, [api])

    React.useEffect(() => {
        if (fase === "oculto") onFinish?.()
    }, [fase])

    const totalPasos = quoteMode ? 2 : 3
    const pasoPago = quoteMode ? 1 : 2

    const avanzar = () => {
        setErrorMsg("")

        if (paso < totalPasos - 1) {
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
                    duracion: quoteMode ? 30 : svcDuracion,
                    precio: quoteMode ? 0 : Number(svcPrecio) || 0,
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
        if (!horaInicio || !horaFin || horaInicio >= horaFin) {
            setErrorMsg("La hora de cierre tiene que ser posterior a la de apertura.")
            return
        }
        if (Boolean(descansoInicio) !== Boolean(descansoFin) ||
            (descansoInicio && descansoFin && (descansoInicio >= descansoFin || descansoInicio < horaInicio || descansoFin > horaFin))) {
            setErrorMsg("Completá el inicio y el fin del descanso dentro de tu horario de atención, o dejá ambos vacíos.")
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
                token,
                false,
                "onboarding"
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

    // La verificación inicial corre detrás del panel, sin pantalla intermedia.
    if (fase === "oculto" || fase === "cargando") return null

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

            <AnimatePresence mode="wait">
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
                        style={{
                            width: "min(100%, 880px)",
                            boxSizing: "border-box",
                            margin: "0 auto",
                        }}
                    >
                        <OnboardingSetupCard step={paso === 0 ? "servicios" : paso === pasoPago ? "pagos" : "horarios"}>
                            <button
                                className="tn-onb-skip"
                                onClick={omitirTodo}
                            >
                                Seguir después desde Inicio
                            </button>
                            <div className="tn-onb-heading">
                                <div className="tn-onb-progress" role="img" aria-label={`Paso ${paso + 1} de ${totalPasos}`}>
                                    {Array.from({ length: totalPasos }, (_, index) => <span key={index} data-active={index <= paso} />)}
                                </div>

                                <h2 className="tn-onb-title">
                                    {paso === 0 && (quoteMode ? "Mostrá qué trabajos realizás" : "Creá tu primer servicio")}

                                    {paso === 1 && !quoteMode && "Elegí tu disponibilidad"}

                                    {paso === pasoPago && (quoteMode ? "¿Cómo querés cobrar después?" : "Cómo confirman la reserva")}
                                </h2>

                                <div className="tn-onb-description">
                                    {paso === 0 &&
                                        (quoteMode
                                            ? "Creá una opción para que te encuentren en Browse. Cuando publiques tu perfil, van a poder consultarte por chat. El precio, el tiempo y el alcance se acuerdan en cada consulta."
                                            : "Es lo que tus clientes van a elegir al reservar. Empezá con uno; después podés agregar más.")}

                                    {paso === 1 && !quoteMode && "Marcá los días que atendés y un horario — lo podés afinar más adelante."}

                                    {paso === pasoPago &&
                                        (quoteMode
                                            ? "Configurá Mercado Pago para ofrecer una seña o el pago acordado una vez que definan el trabajo."
                                            : esPremium
                                                ? "Conectá Mercado Pago o arrancá cobrando en efectivo, lo que prefieras ahora."
                                                : "Conectá Mercado Pago. Después, en Pagos, elegí si pedís una seña o el pago total al reservar.")}
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
                                        label={quoteMode ? "Tipo de trabajo o servicio" : "Nombre del servicio"}
                                        placeholder={quoteMode ? "Ej.: Tatuaje personalizado" : "Ej.: Corte de cabello"}
                                        value={svcNombre}
                                        onChange={(e: any) =>
                                            setSvcNombre(e.target.value)
                                        }
                                    />

                                    {quoteMode ? (
                                        <div style={{ fontSize: 12.5, color: OnboardingNube_MUTED, lineHeight: 1.5, padding: "11px 13px", borderRadius: 10, background: "rgba(27,107,26,0.07)" }}>
                                            No hace falta definir un precio ni una duración fijos. Vas a acordarlos con cada cliente por chat.
                                        </div>
                                    ) : (
                                        <>
                                            <OnboardingNube_Input
                                                label="Precio total del servicio"
                                                type="number"
                                                prefix="$"
                                                placeholder="0"
                                                value={svcPrecio}
                                                onChange={(e: any) => setSvcPrecio(e.target.value)}
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
                                            Cuánto tiempo necesitás para atenderlo
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
                                        </>
                                    )}

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

                            {paso === 1 && !quoteMode && (
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

                            {paso === pasoPago && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                    }}
                                >
                                    <OnboardingNube_BotonPrincipal
                                        onClick={conectarMercadoPago}
                                        loading={guardando}
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
                                            Plan Premium.
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
                        </OnboardingSetupCard>
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
                        style={{
                            width: "min(100%, 880px)",
                            boxSizing: "border-box",
                            margin: "0 auto",
                        }}
                    >
                        <OnboardingSetupCard step="horarios">
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
                                    {quoteMode ? "Configuración de consultas guardada" : "Configuración guardada"}
                                </div>

                                <div
                                    style={{
                                        fontSize: 13,
                                        color: OnboardingNube_MUTED,
                                    }}
                                >
                                    {quoteMode
                                        ? "Tus clientes podrán contarte qué necesitan. Acordá el alcance, el precio, el tiempo y la fecha por chat."
                                        : "En Inicio podés revisar lo que falta, abrir tu agenda y copiar el enlace para tus clientes."}
                                </div>
                            </div>
                        </OnboardingSetupCard>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export { OnboardingNube_Chip, OnboardingNube_BotonPrincipal, OnboardingNube }
