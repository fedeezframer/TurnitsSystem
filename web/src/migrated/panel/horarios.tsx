import "./horarios.css"
import { ScheduleTimeInput as HorariosConfig_TimeInput } from "./ScheduleTimeInput"
import { BackButton } from "../../components/BackButton"
import LoadingRunner from "../../components/LoadingRunner"
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
import { HorariosConfig_HORARIOS_VACIO, HorariosConfig_getSlug, HorariosConfig_getToken, HorariosConfig_DIAS_CONFIG, TurnitsGlobalSaveManager_get, HorariosConfig_HORARIOS_EJEMPLO_CANVAS, HorariosConfig_cardBase, HorariosConfig_shimmerCSS, HorariosConfig_useContainerWidth, ExcepcionesConfig_shimmerCSS, ExcepcionesConfig_DayPanelProps, ExcepcionesConfig_ExcType, ExcepcionesConfig_Slot, ExcepcionesConfig_MESES, ExcepcionesConfig_timeInputStyle, ExcepcionesConfig_Props, ExcepcionesConfig_useContainerWidth, ExcepcionesConfig_Excepciones, ExcepcionesConfig_getSlug, ExcepcionesConfig_getToken, ExcepcionesConfig_Excepcion, ExcepcionesConfig_getMonthStart, ExcepcionesConfig_getDaysInMonth, ExcepcionesConfig_makeDateKey } from "./common"

function HorariosConfig(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#2F8A2F",
        mostrarBotonGuardar = true,
        employeeMode = false,
        settingsUrl,
        style,
    } = props

    const [horarios, setHorarios] = React.useState<Record<string, any>>(
        JSON.parse(JSON.stringify(HorariosConfig_HORARIOS_VACIO))
    )
    const [anticipacionMinutos, setAnticipacionMinutos] = React.useState(30)
    const horariosGuardadosRef = React.useRef<{
        horarios: Record<string, any>
        anticipacion_minutos: number
    } | null>(null)
    const [diaActivo, setDiaActivo] = React.useState("lunes")
    const [loading, setLoading] = React.useState(true)
    const [guardando, setGuardando] = React.useState(false)
    const [guardadoOk, setGuardadoOk] = React.useState(false)
    const [error, setError] = React.useState("")

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }

        const api = baseUrl.replace(/\/+$/, "")
        let retries = 0

        const tryFetch = async () => {
            const slug = HorariosConfig_getSlug()
            const token = HorariosConfig_getToken()

            if (!slug || !token) {
                if (++retries < 15) {
                    setTimeout(tryFetch, 300)
                    return
                }
                setError("No se pudo obtener la sesión.")
                setLoading(false)
                return
            }

            try {
                const configUrl = settingsUrl || (employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                    : `${api}/settings/${slug}`)
                const res = await fetch(configUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })

                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    setError(`Error al cargar: ${body.error || res.statusText}`)
                    setLoading(false)
                    return
                }

                const data = await res.json()
                // Arranca vacío; solo se llena si el backend realmente
                // tiene algún día activo guardado. Si el negocio nunca
                // configuró nada, se queda tal cual (todo inactivo) en
                // vez de mostrar un horario de ejemplo.
                let horariosFinales: Record<string, any> = JSON.parse(
                    JSON.stringify(HorariosConfig_HORARIOS_VACIO)
                )

                const hayHorariosGuardados =
                    data.settings?.horarios &&
                    Object.values(data.settings.horarios).some(
                        (d: any) => d?.activo
                    )

                if (hayHorariosGuardados) {
                    const merged: Record<string, any> = {}
                    HorariosConfig_DIAS_CONFIG.forEach(({ key }) => {
                        const remoto = data.settings.horarios[key]
                        const base = HorariosConfig_HORARIOS_VACIO[key]
                        merged[key] = {
                            activo: remoto?.activo ?? base.activo,
                            jornada: remoto?.jornada ?? base.jornada,
                            descanso: remoto?.descanso ?? base.descanso,
                        }
                    })
                    horariosFinales = merged
                }

                const anticipacionFinal = Math.min(
                    43200,
                    Math.max(
                        1,
                        Number(data.settings?.anticipacion_minutos) || 30
                    )
                )
                const configuracionFinal = {
                    horarios: horariosFinales,
                    anticipacion_minutos: anticipacionFinal,
                }
                horariosGuardadosRef.current = configuracionFinal
                const manager = TurnitsGlobalSaveManager_get()
                manager?.setBaseline("horarios", configuracionFinal)
                const pendiente = manager?.getPending("horarios")
                const pendienteTieneConfiguracion =
                    pendiente &&
                    typeof pendiente === "object" &&
                    Object.prototype.hasOwnProperty.call(pendiente, "horarios")
                setHorarios(
                    pendienteTieneConfiguracion
                        ? pendiente.horarios
                        : pendiente || horariosFinales
                )
                setAnticipacionMinutos(
                    pendienteTieneConfiguracion
                        ? Math.min(
                              43200,
                              Math.max(
                                  1,
                                  Number(pendiente.anticipacion_minutos) ||
                                      anticipacionFinal
                              )
                          )
                        : anticipacionFinal
                )

                if (typeof window !== "undefined") {
                    window.dispatchEvent(
                        new CustomEvent("horarios_changed", {
                            detail: horariosFinales,
                        })
                    )
                }
            } catch {
                setError("Error de conexión.")
            }

            setLoading(false)
        }

        tryFetch()
    }, [baseUrl])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        ;(window as any).getHorarios = () => horarios
        window.dispatchEvent(
            new CustomEvent("horarios_changed", { detail: horarios })
        )
        const baseline = horariosGuardadosRef.current
        const configuracion = {
            horarios,
            anticipacion_minutos: anticipacionMinutos,
        }
        if (
            baseline &&
            JSON.stringify(baseline) !== JSON.stringify(configuracion)
        ) {
            TurnitsGlobalSaveManager_get()?.markDirty("horarios", configuracion)
        }
    }, [horarios, anticipacionMinutos])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const onSaved = () => {
            setGuardadoOk(true)
            horariosGuardadosRef.current = JSON.parse(
                JSON.stringify({
                    horarios,
                    anticipacion_minutos: anticipacionMinutos,
                })
            )
            setTimeout(() => setGuardadoOk(false), 2500)
        }
        window.addEventListener("config_saved", onSaved)
        return () => window.removeEventListener("config_saved", onSaved)
    }, [horarios, anticipacionMinutos])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const onReemitir = () => {
            window.dispatchEvent(
                new CustomEvent("horarios_changed", { detail: horarios })
            )
        }
        window.addEventListener("config_reemitir", onReemitir)
        return () => window.removeEventListener("config_reemitir", onReemitir)
    }, [horarios])

    const toggleActivo = (dia: string) => {
        setHorarios((prev) => {
            const wasActivo = prev[dia].activo
            return {
                ...prev,
                [dia]: {
                    ...prev[dia],
                    activo: !wasActivo,
                    // Al prender un día puntual sí sugerimos un horario
                    // razonable para ese día (09:00-20:00) — esto no es
                    // el default de cuenta, es solo para no obligar al
                    // usuario a tipear desde cero cuando activa un día.
                    jornada: wasActivo
                        ? [null, null]
                        : prev[dia].jornada[0]
                          ? prev[dia].jornada
                          : ["09:00", "20:00"],
                    descanso: wasActivo ? [null, null] : prev[dia].descanso,
                },
            }
        })
        setGuardadoOk(false)
    }

    const setJornada = (dia: string, idx: 0 | 1, val: string | null) => {
        setHorarios((prev) => {
            const j = prev[dia].jornada ? [...prev[dia].jornada] : [null, null]
            j[idx] = val
            return { ...prev, [dia]: { ...prev[dia], jornada: j } }
        })
        setGuardadoOk(false)
    }

    const setDescanso = (dia: string, idx: 0 | 1, val: string | null) => {
        setHorarios((prev) => {
            const d = prev[dia].descanso
                ? [...prev[dia].descanso]
                : [null, null]
            d[idx] = val
            return { ...prev, [dia]: { ...prev[dia], descanso: d } }
        })
        setGuardadoOk(false)
    }

    const handleGuardar = async () => {
        const slug = HorariosConfig_getSlug()
        const token = HorariosConfig_getToken()
        if (!slug || !token) {
            setError("Sin sesión.")
            return
        }
        setGuardando(true)
        setError("")
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const configUrl = settingsUrl || (employeeMode
                ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                : `${api}/settings/${slug}`)
            const res = await fetch(configUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    horarios,
                    anticipacion_minutos: anticipacionMinutos,
                }),
            })
            if (res.ok) {
                const configuracionGuardada = {
                    horarios,
                    anticipacion_minutos: anticipacionMinutos,
                }
                TurnitsGlobalSaveManager_get()?.setBaseline(
                    "horarios",
                    configuracionGuardada
                )
                setGuardadoOk(true)
                window.dispatchEvent(new CustomEvent("config_saved"))
                setTimeout(() => setGuardadoOk(false), 2500)
            } else {
                const d = await res.json()
                setError(d.error || "Error al guardar.")
            }
        } catch {
            setError("Error de conexión.")
        }
        setGuardando(false)
    }

    if (false) {
        return (
            <HorariosConfig_Shell
                horarios={HorariosConfig_HORARIOS_EJEMPLO_CANVAS}
                anticipacionMinutos={30}
                onSetAnticipacionMinutos={() => {}}
                diaActivo="lunes"
                accentColor={accentColor}
                onSelectDia={() => {}}
                onToggle={() => {}}
                onSetJornada={() => {}}
                onSetDescanso={() => {}}
                onGuardar={() => {}}
                mostrarBotonGuardar={mostrarBotonGuardar}
                guardando={false}
                guardadoOk={false}
                error=""
                style={style}
            />
        )
    }

    if (loading)
        return (
            <div className="week-loading" style={{ ...HorariosConfig_cardBase, ...style }}>
                <HorariosConfig_SkeletonHorarios />
                <style>{HorariosConfig_shimmerCSS}</style>
            </div>
        )

    return (
        <HorariosConfig_Shell
            horarios={horarios}
            anticipacionMinutos={anticipacionMinutos}
            onSetAnticipacionMinutos={setAnticipacionMinutos}
            diaActivo={diaActivo}
            accentColor={accentColor}
            onSelectDia={setDiaActivo}
            onToggle={toggleActivo}
            onSetJornada={setJornada}
            onSetDescanso={setDescanso}
            onGuardar={handleGuardar}
            mostrarBotonGuardar={mostrarBotonGuardar}
            guardando={guardando}
            guardadoOk={guardadoOk}
            error={error}
            style={style}
        />
    )
}

function HorariosConfig_Anticipacion({
    minutos = 30,
    onChange,
    accentColor = "#2F8A2F",
    isMobile = false,
}: any) {
    const unidades: Record<string, number> = {
        minutos: 1,
        horas: 60,
        dias: 1440,
    }
    const valoresPredeterminados: Record<string, number> = {
        minutos: 30,
        horas: 1,
        dias: 1,
    }
    const unidadInicial = (valor: number) =>
        valor >= 1440 && valor % 1440 === 0
            ? "dias"
            : valor >= 60 && valor % 60 === 0
              ? "horas"
              : "minutos"
    const formatearCantidad = (valor: number, unidad: string) =>
        String(Math.max(1, Math.round(valor / unidades[unidad])))
    const [unidad, setUnidad] = React.useState(unidadInicial(minutos))
    const [cantidad, setCantidad] = React.useState(
        formatearCantidad(minutos, unidadInicial(minutos))
    )
    const [cantidadValida, setCantidadValida] = React.useState(
        formatearCantidad(minutos, unidadInicial(minutos))
    )

    React.useEffect(() => {
        const siguienteUnidad = unidadInicial(minutos)
        setUnidad(siguienteUnidad)
        const siguienteCantidad = formatearCantidad(minutos, siguienteUnidad)
        setCantidad(siguienteCantidad)
        setCantidadValida(siguienteCantidad)
    }, [minutos])

    const cambiarUnidad = (siguiente: string) => {
        const valorPredeterminado = valoresPredeterminados[siguiente]
        const nuevaCantidad = String(valorPredeterminado)
        setUnidad(siguiente)
        setCantidad(nuevaCantidad)
        setCantidadValida(nuevaCantidad)
        onChange(Math.min(43200, valorPredeterminado * unidades[siguiente]))
    }
    const cambiarCantidad = (valor: string) => {
        // Acepta sólo dígitos; así no se pueden ingresar fracciones como 0,17.
        if (valor !== "" && !/^\d+$/.test(valor)) return
        setCantidad(valor)
        const numero = Number(valor)
        if (!Number.isInteger(numero) || numero <= 0) return
        const cantidadLimitada = Math.min(
            numero,
            Math.floor(43200 / unidades[unidad])
        )
        const valorLimitado = String(cantidadLimitada)
        setCantidad(valorLimitado)
        setCantidadValida(valorLimitado)
        onChange(cantidadLimitada * unidades[unidad])
    }
    const restaurarCantidad = () => {
        if (!/^\d+$/.test(cantidad) || Number(cantidad) <= 0)
            setCantidad(cantidadValida)
    }

    return <div className="week-notice">
        <strong>Anticipación de Reserva</strong>
        <div className="week-notice-input"><input aria-label="Tiempo de anticipación" inputMode="numeric" value={cantidad} onChange={e=>cambiarCantidad(e.target.value)} onBlur={restaurarCantidad}/>
            <select aria-label="Unidad de anticipación" value={unidad} onChange={e=>cambiarUnidad(e.target.value)}><option value="minutos">min</option><option value="horas">hs</option><option value="dias">días</option></select>
        </div>
        <small>El tiempo establecido aquí será cuánto antes alguien deba reservar</small>
    </div>
}

function HorariosConfig_Shell({
    horarios,
    anticipacionMinutos = 30,
    onSetAnticipacionMinutos = () => {},
    diaActivo,
    accentColor,
    onSelectDia,
    onToggle,
    onSetJornada,
    onSetDescanso,
    onGuardar,
    mostrarBotonGuardar,
    guardando,
    guardadoOk,
    error,
    style,
}: any) {
    const day = horarios[diaActivo]
    const hasBreak = Boolean(day?.descanso?.some(Boolean))
    const minutes = (time: string | null) => {
        if (!time) return NaN
        const [h,m] = time.split(":").map(Number)
        return h*60+m
    }
    const start = minutes(day?.jornada?.[0]), end = minutes(day?.jornada?.[1])
    const setBreak = () => {
        const format = (n:number) => String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")
        const third = Math.floor((end-start)/3)
        const suggested = start < 13*60 && end > 15*60 ? ["13:00","15:00"] : [format(start+third),format(end-third)]
        const values = hasBreak ? [null,null] : suggested
        onSetDescanso(diaActivo,0,values[0])
        onSetDescanso(diaActivo,1,values[1])
    }
    return <div className="week-editor" style={style}>
        <HorariosConfig_Anticipacion minutos={anticipacionMinutos} onChange={onSetAnticipacionMinutos}/>
        <div className="week-days" role="group" aria-label="Día de la semana">
            {HorariosConfig_DIAS_CONFIG.map(({key,label})=><button key={key} aria-pressed={diaActivo===key} onClick={()=>onSelectDia(key)}>{label}</button>)}
        </div>
        <hr/>
        <div key={diaActivo}>
            {["jornada","descanso"].map((field,index)=>{
                const rest = index===1
                const enabled = day?.activo && (!rest || hasBreak)
                const title = rest ? "Descanso" : "Horario Fijo"
                return <section className="week-period" key={field} aria-label={title}>
                    <h3>{title}<button type="button" className="week-switch" role="switch" aria-label={rest?"Activar descanso":"Abrir este día"} aria-checked={Boolean(rest?hasBreak:day?.activo)} disabled={rest && (!day?.activo || (!hasBreak && !(end-start>=3)))} onClick={rest?setBreak:()=>onToggle(diaActivo)} /></h3>
                    <div className="week-range">{["De","Hasta"].map((label,i)=><label key={label}>{label}
                        <span className="week-clock" data-display={day?.[field]?.[i] ? day[field][i]+"hs" : undefined}><HorariosConfig_TimeInput value={day?.[field]?.[i]} disabled={!enabled} placeholder={(rest?["13:00hs","15:00hs"]:["10:00hs","21:00hs"])[i]}
                            onChange={v=>(rest?onSetDescanso:onSetJornada)(diaActivo,i,v)}/></span>
                    </label>)}</div>
                </section>
            })}
        </div>
        {error && <p role="alert">{error}</p>}
        {mostrarBotonGuardar && <button className="week-save" disabled={guardando} onClick={onGuardar}>{guardando?"Guardando…":guardadoOk?"Horarios guardados":"Guardar horarios"}</button>}
    </div>
}

function HorariosConfig_Toggle({ activo, accentColor, onToggle }: any) {
    return (
        <div
            onClick={onToggle}
            style={{
                width: 40,
                height: 22,
                borderRadius: 20,
                background: activo ? accentColor : "#ddd",
                position: "relative",
                cursor: "pointer",
                transition: "background 0.2s",
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: 2,
                    left: activo ? 20 : 2,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                }}
            />
        </div>
    )
}

function HorariosConfig_DiaDeshabilitado() {
    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 6,
                opacity: 0.4,
                minHeight: 80,
            }}
        >
            <div style={{ fontSize: 26 }}></div>
            <span
                style={{
                    fontSize: 12,
                    color: "#999",
                    fontFamily: "'Inter', sans-serif",
                }}
            >
                Día deshabilitado
            </span>
        </div>
    )
}

function HorariosConfig_BloqueHorario({
    titulo,
    desde,
    hasta,
    accentColor,
    onDesde,
    onHasta,
    opcional,
    horizontal = false,
    placeholderDesde,
    placeholderHasta,
}: any) {
    // Si no viene explícito, el placeholder default depende del título:
    // Jornada sugiere 09:00-20:00, Descanso sugiere 13:00-15:00 (el
    // horario de almuerzo típico). Antes ambos bloques mostraban
    // 09:00/18:00 fijo, aunque fuera el bloque de Descanso.
    const esDescanso = titulo === "Descanso"
    const phDesde = placeholderDesde ?? (esDescanso ? "13:00" : "09:00")
    const phHasta = placeholderHasta ?? (esDescanso ? "15:00" : "20:00")

    return (
        <div
            style={{
                background: "#fafafa",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#333",
                        fontFamily: "'Inter', sans-serif",
                    }}
                >
                    {titulo}
                </span>
                {opcional && (
                    <span
                        style={{
                            fontSize: 10,
                            color: "#bbb",
                            fontFamily: "'Inter', sans-serif",
                        }}
                    >
                        opcional
                    </span>
                )}
            </div>

            {/* En móvil (horizontal=true) los inputs van en fila con "De/A" integrados */}
            {horizontal ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                fontSize: 10,
                                color: "#aaa",
                                fontFamily: "'Inter', sans-serif",
                                marginBottom: 4,
                            }}
                        >
                            De
                        </div>
                        <HorariosConfig_TimeInput
                            value={desde}
                            onChange={onDesde}
                            placeholder={phDesde}
                            accentColor={accentColor}
                        />
                    </div>
                    <div
                        style={{
                            color: "#ccc",
                            fontSize: 16,
                            flexShrink: 0,
                            paddingTop: 16,
                        }}
                    ></div>
                    <div style={{ flex: 1 }}>
                        <div
                            style={{
                                fontSize: 10,
                                color: "#aaa",
                                fontFamily: "'Inter', sans-serif",
                                marginBottom: 4,
                            }}
                        >
                            A
                        </div>
                        <HorariosConfig_TimeInput
                            value={hasta}
                            onChange={onHasta}
                            placeholder={phHasta}
                            accentColor={accentColor}
                        />
                    </div>
                </div>
            ) : (
                <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11,
                                color: "#999",
                                width: 22,
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            De
                        </span>
                        <HorariosConfig_TimeInput
                            value={desde}
                            onChange={onDesde}
                            placeholder={phDesde}
                            accentColor={accentColor}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11,
                                color: "#999",
                                width: 22,
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            A
                        </span>
                        <HorariosConfig_TimeInput
                            value={hasta}
                            onChange={onHasta}
                            placeholder={phHasta}
                            accentColor={accentColor}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

function HorariosConfig_SkeletonHorarios() { return <LoadingRunner label="Cargando horarios…" /> }

function HorariosConfig_Skel({ width, height, style = {} }: any) {
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

function ExcepcionesConfig_SkeletonCalendar() { return <div className="exception-loading"><LoadingRunner card size="compact" label="Cargando excepciones…" /></div> }

function ExcepcionesConfig_DayPanel({
    dayKey,
    excepcion,
    accentColor,
    isMobile,
    onSave,
    onClose,
}: ExcepcionesConfig_DayPanelProps) {
    const [type, setType] = React.useState<ExcepcionesConfig_ExcType | null>(
        excepcion?.type ?? null
    )
    const [slots, setSlots] = React.useState<ExcepcionesConfig_Slot[]>(
        excepcion?.slots ?? []
    )
    const [desde, setDesde] = React.useState("09:00")
    const [hasta, setHasta] = React.useState("18:00")
    const [slotError, setSlotError] = React.useState("")

    const [y, m, d] = dayKey.split("-")
    const label = `${parseInt(d)} de ${ExcepcionesConfig_MESES[parseInt(m) - 1]} ${y}`

    const handleAddSlot = () => {
        if (desde && hasta) {
            setSlots((prev) => [...prev, [desde, hasta]])
            setSlotError("")
        }
    }
    const handleRemoveSlot = (i: number) =>
        setSlots((prev) => prev.filter((_, idx) => idx !== i))

    const handleApply = () => {
        if (!type) {
            onSave(dayKey, null)
            return
        }
        if (type === "block") {
            onSave(dayKey, { type: "block" })
            return
        }
        const pendiente: ExcepcionesConfig_Slot | null =
            desde && hasta ? [desde, hasta] : null
        const finalSlots: ExcepcionesConfig_Slot[] =
            pendiente && slots.length === 0
                ? [pendiente]
                : pendiente && slots[slots.length - 1]?.[0] !== desde
                  ? [...slots, pendiente]
                  : slots
        if (finalSlots.length === 0) {
            setSlotError("Agregá al menos un intervalo de atención.")
            return
        }
        setSlotError("")
        onSave(dayKey, { type: "custom", slots: finalSlots })
    }

    const optStyle = (active: boolean, color: string): React.CSSProperties => ({
        flex: 1,
        padding: isMobile ? "8px 4px" : "10px 8px",
        borderRadius: 10,
        border: `1.5px solid ${active ? color + "66" : "#e2e8f0"}`,
        background: active ? color + "10" : "#f8fafc",
        cursor: "pointer",
        fontSize: isMobile ? 11 : 12,
        fontWeight: 600,
        color: active ? color : "#94a3b8",
        textAlign: "center",
        lineHeight: 1.4,
        fontFamily: "'Inter Display', -apple-system, sans-serif",
        transition: "all 0.15s",
    })

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            style={{
                marginTop: 12,
                padding: isMobile ? "12px" : "16px",
                borderRadius: 14,
                border: "1px solid #f1f5f9",
                background: "#fafcff",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 14,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#1e293b",
                        }}
                    >
                        {label}
                    </div>
                    {!isMobile && (
                        <div
                            style={{
                                fontSize: 11,
                                color: "#94a3b8",
                                marginTop: 2,
                            }}
                        >
                            Podés definir uno o más intervalos de atención
                        </div>
                    )}
                </div>
                <BackButton onClick={onClose} aria-label="Cerrar" />
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <button
                    style={optStyle(type === "block", "#ef4444")}
                    onClick={() => setType("block")}
                >
                    {isMobile ? "Bloqueado" : "Día bloqueado"}
                </button>
                <button
                    style={optStyle(type === "custom", "#f97316")}
                    onClick={() => setType("custom")}
                >
                    {isMobile ? "Intervalos" : "Intervalos propios"}
                </button>
                <button
                    style={optStyle(type === null, "#64748b")}
                    onClick={() => setType(null)}
                >
                    Normal
                </button>
            </div>

            {type === "custom" && (
                <div style={{ marginBottom: 12 }}>
                    {slots.map((s, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "6px 10px",
                                background: "#fff7ed",
                                borderRadius: 8,
                                marginBottom: 6,
                                fontSize: 13,
                                color: "#ea580c",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            <span>
                                {s[0]} → {s[1]}
                            </span>
                            <button
                                onClick={() => handleRemoveSlot(i)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#ef4444",
                                    fontSize: 14,
                                    lineHeight: 1,
                                    padding: 0,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-end",
                            marginBottom: 10,
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <label
                                style={{
                                    fontSize: 11,
                                    color: "#64748b",
                                    display: "block",
                                    marginBottom: 4,
                                }}
                            >
                                Desde
                            </label>
                            <input
                                type="time"
                                value={desde}
                                onChange={(e) => setDesde(e.target.value)}
                                style={ExcepcionesConfig_timeInputStyle}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <label
                                style={{
                                    fontSize: 11,
                                    color: "#64748b",
                                    display: "block",
                                    marginBottom: 4,
                                }}
                            >
                                Hasta
                            </label>
                            <input
                                type="time"
                                value={hasta}
                                onChange={(e) => setHasta(e.target.value)}
                                style={ExcepcionesConfig_timeInputStyle}
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleAddSlot}
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#ea580c",
                            fontSize: 12,
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                            fontWeight: 600,
                            padding: 0,
                        }}
                    >
                        + Agregar otro intervalo
                    </button>
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    alignItems: "center",
                    marginTop: 8,
                }}
            >
                {slotError && (
                    <span
                        style={{
                            fontSize: 11,
                            color: "#ef4444",
                            marginRight: "auto",
                        }}
                    >
                        {slotError}
                    </span>
                )}

                <button
                    onClick={handleApply}
                    style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "#1e293b",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily:
                            "'Inter Display', -apple-system, sans-serif",
                    }}
                >
                    Aplicar
                </button>
            </div>
        </motion.div>
    )
}

function ExcepcionesConfig({
    baseUrl,
    accentColor,
    employeeMode = false,
    settingsUrl,
    style,
}: ExcepcionesConfig_Props) {
    const api = baseUrl.replace(/\/+$/, "")
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = ExcepcionesConfig_useContainerWidth(containerRef)
    const isMobile = containerWidth < 420

    const [weekly,setWeekly] = React.useState<Record<string,any>>({})
    React.useEffect(()=>{
        const update = (event: Event) => setWeekly((event as CustomEvent).detail)
        window.addEventListener("horarios_changed",update)
        window.dispatchEvent(new Event("config_reemitir"))
        return ()=>window.removeEventListener("horarios_changed",update)
    },[])

    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [savedOk, setSavedOk] = React.useState(false)
    const [curYear, setCurYear] = React.useState(today.getFullYear())
    const [curMonth, setCurMonth] = React.useState(today.getMonth())
    const [exceptions, setExceptions] =
        React.useState<ExcepcionesConfig_Excepciones>({})
    const excepcionesGuardadasRef =
        React.useRef<ExcepcionesConfig_Excepciones | null>(null)
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (typeof window === "undefined") return
        ;(window as any).getExcepciones = () => exceptions
        window.dispatchEvent(
            new CustomEvent("excepciones_changed", { detail: exceptions })
        )
        const baseline = excepcionesGuardadasRef.current
        if (
            baseline &&
            JSON.stringify(baseline) !== JSON.stringify(exceptions)
        ) {
            TurnitsGlobalSaveManager_get()?.markDirty("excepciones", exceptions)
        }
    }, [exceptions])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const onSaved = () => {
            setSavedOk(true)
            excepcionesGuardadasRef.current = JSON.parse(
                JSON.stringify(exceptions)
            )
            setTimeout(() => setSavedOk(false), 3000)
        }
        window.addEventListener("config_saved", onSaved)
        return () => window.removeEventListener("config_saved", onSaved)
    }, [exceptions])

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }
        const slug = ExcepcionesConfig_getSlug()
        const token = ExcepcionesConfig_getToken()
        if (!slug || !token) {
            setLoading(false)
            setError("Sin sesión activa")
            return
        }
        let attempt = 0
        const tryLoad = async () => {
            try {
                const configUrl = settingsUrl || (employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                    : `${api}/admin-stats/${slug}`)
                const res = await fetch(configUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada")
                    setLoading(false)
                    return
                }
                const data = await res.json()
                const raw =
                    data?.settings?.excepciones ||
                    data?.excepciones ||
                    data?.config?.excepciones ||
                    []
                const normalized: ExcepcionesConfig_Excepciones = {}
                if (Array.isArray(raw)) {
                    raw.forEach((item: any) => {
                        if (typeof item === "string")
                            normalized[item] = { type: "block" }
                        else if (item?.fecha)
                            normalized[item.fecha] = {
                                type: item.type || "block",
                                slots: item.slots,
                            }
                    })
                }
                excepcionesGuardadasRef.current = normalized
                TurnitsGlobalSaveManager_get()?.setBaseline(
                    "excepciones",
                    normalized
                )
                const pendiente =
                    TurnitsGlobalSaveManager_get()?.getPending("excepciones")
                setExceptions(pendiente || normalized)
                setLoading(false)
            } catch {
                if (attempt < 10) {
                    attempt++
                    setTimeout(tryLoad, 300)
                } else {
                    setLoading(false)
                    setError("Error al cargar")
                }
            }
        }
        tryLoad()
    }, [api])

    const handleDaySave = (
        key: string,
        exc: ExcepcionesConfig_Excepcion | null
    ) => {
        setExceptions((prev) => {
            const next = { ...prev }
            if (!exc) delete next[key]
            else next[key] = exc
            return next
        })
        setSelectedKey(null)
    }

    const prevMonth = () => {
        setSelectedKey(null)
        if (curMonth === 0) {
            setCurYear((y) => y - 1)
            setCurMonth(11)
        } else setCurMonth((m) => m - 1)
    }
    const nextMonth = () => {
        setSelectedKey(null)
        if (curMonth === 11) {
            setCurYear((y) => y + 1)
            setCurMonth(0)
        } else setCurMonth((m) => m + 1)
    }

    if (false || loading) {
        if (loading) return <ExcepcionesConfig_SkeletonCalendar />
    }

    const offset = new Date(curYear,curMonth,1).getDay()
    const count = Math.ceil((offset + ExcepcionesConfig_getDaysInMonth(curYear,curMonth))/7)*7
    return <section className="schedule-exceptions" ref={containerRef} style={style}>
        <header><div><h2>Excepciones Laborales</h2><p>Marca los días que tus Horarios Semanales cambien</p></div>
            <nav aria-label="Mes del calendario"><button aria-label="Mes anterior" onClick={prevMonth}>‹</button>
                <strong aria-live="polite">{ExcepcionesConfig_MESES[curMonth]} {curYear}</strong><button aria-label="Mes siguiente" onClick={nextMonth}>›</button></nav>
        </header>
        <div className="exception-month">{Array.from({length:count},(_,index)=>{
            const date = new Date(curYear,curMonth,index-offset+1)
            const key = ExcepcionesConfig_makeDateKey(date.getFullYear(),date.getMonth(),date.getDate())
            const outside = date.getMonth()!==curMonth
            const exc = exceptions[key]
            const day = weekly[HorariosConfig_DIAS_CONFIG[(date.getDay()+6)%7].key]
            const slots: ExcepcionesConfig_Slot[] = exc ? (exc.type==="custom" ? exc.slots || [] : []) : (day?.activo && day.jornada?.every(Boolean) ? [day.jornada] : [])
            const dateLabel = date.getDate()+" "+ExcepcionesConfig_MESES[date.getMonth()].slice(0,3)
            return <button key={key} disabled={outside || date<today} data-exception={Boolean(exc)} data-outside={outside} aria-pressed={selectedKey===key}
                onClick={()=>setSelectedKey(selectedKey===key?null:key)}>
                <strong>{dateLabel}</strong>
                {slots.length ? slots.map(([from,to],i)=><span key={i} className="exception-hours"><span>De </span>{from}<span>hs</span><br/><span>a </span>{to}<span>hs</span></span>) : <span>Cerrado</span>}
            </button>
        })}</div>
        {selectedKey && <ExcepcionesConfig_DayPanel key={selectedKey} dayKey={selectedKey} excepcion={exceptions[selectedKey] ?? null} accentColor={accentColor} isMobile={isMobile} onSave={handleDaySave} onClose={()=>setSelectedKey(null)}/>}
        {error && <p role="alert">{error}</p>}
        {savedOk && <p role="status">Guardado</p>}
    </section>
}

export { HorariosConfig_TimeInput, HorariosConfig, HorariosConfig_Anticipacion, HorariosConfig_Shell, HorariosConfig_Toggle, HorariosConfig_DiaDeshabilitado, HorariosConfig_BloqueHorario, HorariosConfig_SkeletonHorarios, HorariosConfig_Skel, ExcepcionesConfig_SkeletonCalendar, ExcepcionesConfig_DayPanel, ExcepcionesConfig }
