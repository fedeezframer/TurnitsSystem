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

function HorariosConfig_TimeInput({
    value,
    onChange,
    placeholder = "--:--",
    disabled = false,
    accentColor = "#2F8A2F",
}: {
    value: string | null
    onChange: (v: string | null) => void
    placeholder?: string
    disabled?: boolean
    accentColor?: string
}) {
    const [raw, setRaw] = React.useState(value || "")
    const [focused, setFocused] = React.useState(false)

    React.useEffect(() => {
        setRaw(value || "")
    }, [value])

    const handleInput = (v: string) => {
        let clean = v.replace(/[^0-9]/g, "").slice(0, 4)
        if (clean.length >= 2) {
            const hh = parseInt(clean.slice(0, 2))
            if (hh > 23) clean = "23" + clean.slice(2)
        }
        if (clean.length === 4) {
            const mm = parseInt(clean.slice(2, 4))
            if (mm > 59) clean = clean.slice(0, 2) + "59"
        }
        const formatted =
            clean.length > 2 ? clean.slice(0, 2) + ":" + clean.slice(2) : clean
        setRaw(formatted)
        if (formatted.length === 5) onChange(formatted)
        else onChange(null)
    }

    const handleBlur = () => {
        setFocused(false)
        if (raw.length > 0 && raw.length < 5) {
            setRaw("")
            onChange(null)
        }
    }

    const isFilled = raw.length === 5
    return (
        <input
            value={raw}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            onChange={(e) => handleInput(e.target.value)}
            style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: disabled
                    ? "#f5f5f5"
                    : isFilled
                      ? "#fff"
                      : "#f5f5f5",
                color: disabled ? "#222" : isFilled ? "#222" : "#999",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                textAlign: "center" as const,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
                cursor: disabled ? "not-allowed" : "text",
                boxShadow:
                    focused && !disabled ? `0 0 0 2px ${accentColor}` : "none",
                fontFamily: "'Inter', 'Inter Display', sans-serif",
                boxSizing: "border-box" as const,
            }}
        />
    )
}

function HorariosConfig(props: any) {
    const {
        baseUrl = "https://negosocio.onrender.com",
        accentColor = "#2F8A2F",
        mostrarBotonGuardar = true,
        employeeMode = false,
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
                const configUrl = employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                    : `${api}/settings/${slug}`
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
            const configUrl = employeeMode
                ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                : `${api}/settings/${slug}`
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
            <div style={{ ...HorariosConfig_cardBase, ...style }}>
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

    return (
        <div
            style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: 14,
                padding: 16,
                marginBottom: 18,
                border: "1px solid #e7e9ee",
                borderRadius: 14,
                background: "#fbfcfe",
                boxSizing: "border-box",
            }}
        >
            <div style={{ minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#1e293b",
                    }}
                >
                    Anticipación por turnos
                </div>
                <div
                    style={{
                        marginTop: 4,
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: "#64748b",
                    }}
                >
                    Definí cuánto antes se pueden reservar. Por ejemplo, 1 día
                    permite organizar la agenda desde la noche anterior.
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    flexShrink: 0,
                    width: isMobile ? "100%" : 210,
                }}
            >
                <input
                    type="number"
                    min={1}
                    max={Math.floor(43200 / unidades[unidad])}
                    step={1}
                    inputMode="numeric"
                    aria-label="Tiempo de anticipación"
                    value={cantidad}
                    onChange={(event) => cambiarCantidad(event.target.value)}
                    onBlur={restaurarCantidad}
                    style={{
                        width: 0,
                        flex: 1,
                        minWidth: 0,
                        height: 42,
                        padding: "0 12px",
                        border: "1px solid #dce1e8",
                        borderRadius: 10,
                        background: "#fff",
                        color: "#1e293b",
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                    }}
                />
                <select
                    aria-label="Unidad de anticipación"
                    value={unidad}
                    onChange={(event) => cambiarUnidad(event.target.value)}
                    style={{
                        width: 92,
                        height: 42,
                        padding: "0 10px",
                        border: "1px solid #dce1e8",
                        borderRadius: 10,
                        background: "#fff",
                        color: accentColor,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                    }}
                >
                    <option value="minutos">min</option>
                    <option value="horas">hs</option>
                    <option value="dias">días</option>
                </select>
            </div>
        </div>
    )
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
    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = HorariosConfig_useContainerWidth(containerRef)
    const isMobile = containerWidth < 480

    const dia = horarios[diaActivo]
    const accentBg = `${accentColor}18`

    return (
        <div
            ref={containerRef}
            style={{ ...HorariosConfig_cardBase, ...style }}
        >
            <style>{`
                ${HorariosConfig_shimmerCSS}
                .dia-btn:hover { background: #f5f5f5 !important; }
                .dias-scroll::-webkit-scrollbar { display: none; }
                .dias-scroll { scrollbar-width: none; -ms-overflow-style: none; }
            `}</style>

            <HorariosConfig_Anticipacion
                minutos={anticipacionMinutos}
                onChange={onSetAnticipacionMinutos}
                accentColor={accentColor}
                isMobile={isMobile}
            />

            {isMobile ? (
                /* ══════════════ LAYOUT MÓVIL ══════════════ */
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    {/* Días: scroll horizontal */}
                    <div
                        className="dias-scroll"
                        style={{
                            display: "flex",
                            gap: 6,
                            overflowX: "auto",
                            paddingBottom: 4,
                            flexShrink: 0,
                        }}
                    >
                        {HorariosConfig_DIAS_CONFIG.map(({ key, label }) => {
                            const sel = diaActivo === key
                            const isActivo = horarios[key]?.activo
                            return (
                                <button
                                    key={key}
                                    className="dia-btn"
                                    onClick={() => onSelectDia(key)}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "8px 12px",
                                        borderRadius: 12,
                                        border: sel
                                            ? `1.5px solid ${accentColor}`
                                            : "1.5px solid transparent",
                                        background: sel ? accentBg : "#f7f7f7",
                                        cursor: "pointer",
                                        fontFamily: "'Inter', sans-serif",
                                        flexShrink: 0,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: sel ? 700 : 500,
                                            color: sel ? accentColor : "#555",
                                        }}
                                    >
                                        {label.slice(0, 3)}
                                    </span>
                                    {/* Dot indicador de activo */}
                                    <div
                                        style={{
                                            width: 5,
                                            height: 5,
                                            borderRadius: "50%",
                                            background: isActivo
                                                ? accentColor
                                                : "#ddd",
                                        }}
                                    />
                                </button>
                            )
                        })}
                    </div>

                    {/* Panel del día */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={diaActivo}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                            }}
                        >
                            {/* Header del día */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <span
                                    style={{
                                        display: "inline-block",
                                        padding: "5px 14px",
                                        background: dia?.activo
                                            ? accentBg
                                            : "#f5f5f5",
                                        color: dia?.activo
                                            ? accentColor
                                            : "#bbb",
                                        borderRadius: 8,
                                        fontSize: 14,
                                        fontWeight: 700,
                                        fontFamily: "'Inter', sans-serif",
                                        letterSpacing: "0.02em",
                                    }}
                                >
                                    {diaActivo.toUpperCase()}
                                </span>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: "#999",
                                            fontFamily: "'Inter', sans-serif",
                                        }}
                                    >
                                        ¿Abrimos?
                                    </span>
                                    <HorariosConfig_Toggle
                                        activo={dia?.activo}
                                        accentColor={accentColor}
                                        onToggle={() => onToggle(diaActivo)}
                                    />
                                </div>
                            </div>

                            {/* Bloques: en móvil van en columna */}
                            {dia?.activo ? (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 12,
                                    }}
                                >
                                    <HorariosConfig_BloqueHorario
                                        titulo="Jornada"
                                        desde={dia.jornada?.[0] || null}
                                        hasta={dia.jornada?.[1] || null}
                                        accentColor={accentColor}
                                        onDesde={(v: string | null) =>
                                            onSetJornada(diaActivo, 0, v)
                                        }
                                        onHasta={(v: string | null) =>
                                            onSetJornada(diaActivo, 1, v)
                                        }
                                        horizontal
                                    />
                                    <HorariosConfig_BloqueHorario
                                        titulo="Descanso"
                                        opcional
                                        desde={dia.descanso?.[0] || null}
                                        hasta={dia.descanso?.[1] || null}
                                        accentColor={accentColor}
                                        onDesde={(v: string | null) =>
                                            onSetDescanso(diaActivo, 0, v)
                                        }
                                        onHasta={(v: string | null) =>
                                            onSetDescanso(diaActivo, 1, v)
                                        }
                                        horizontal
                                    />
                                </div>
                            ) : (
                                <HorariosConfig_DiaDeshabilitado />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            ) : (
                /* ══════════════ LAYOUT DESKTOP (original) ══════════════ */
                <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>
                    {/* Columna días */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            width: 130,
                            flexShrink: 0,
                            paddingRight: 16,
                            borderRight: "1px solid #f0f0f0",
                        }}
                    >
                        {HorariosConfig_DIAS_CONFIG.map(({ key, label }) => {
                            const sel = diaActivo === key
                            return (
                                <button
                                    key={key}
                                    className="dia-btn"
                                    onClick={() => onSelectDia(key)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        padding: "9px 12px",
                                        borderRadius: 10,
                                        border: sel
                                            ? `1.5px solid ${accentColor}`
                                            : "1.5px solid transparent",
                                        background: sel
                                            ? accentBg
                                            : "transparent",
                                        cursor: "pointer",
                                        fontFamily: "'Inter', sans-serif",
                                        width: "100%",
                                        textAlign: "left" as const,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 13,
                                            fontWeight: sel ? 700 : 500,
                                            color: sel ? accentColor : "#555",
                                        }}
                                    >
                                        {label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Panel derecho */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={diaActivo}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                flex: 1,
                                paddingLeft: 24,
                                display: "flex",
                                flexDirection: "column",
                                gap: 20,
                            }}
                        >
                            {/* Header del día */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <span
                                    style={{
                                        display: "inline-block",
                                        padding: "5px 14px",
                                        background: dia?.activo
                                            ? accentBg
                                            : "#f5f5f5",
                                        color: dia?.activo
                                            ? accentColor
                                            : "#bbb",
                                        borderRadius: 8,
                                        fontSize: 15,
                                        fontWeight: 700,
                                        fontFamily: "'Inter', sans-serif",
                                        letterSpacing: "0.02em",
                                    }}
                                >
                                    {diaActivo.toUpperCase()}
                                </span>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: "#999",
                                            fontFamily: "'Inter', sans-serif",
                                        }}
                                    >
                                        ¿Abrimos?
                                    </span>
                                    <HorariosConfig_Toggle
                                        activo={dia?.activo}
                                        accentColor={accentColor}
                                        onToggle={() => onToggle(diaActivo)}
                                    />
                                </div>
                            </div>

                            {/* Bloques horarios */}
                            {dia?.activo ? (
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 16,
                                    }}
                                >
                                    <HorariosConfig_BloqueHorario
                                        titulo="Jornada"
                                        desde={dia.jornada?.[0] || null}
                                        hasta={dia.jornada?.[1] || null}
                                        accentColor={accentColor}
                                        onDesde={(v: string | null) =>
                                            onSetJornada(diaActivo, 0, v)
                                        }
                                        onHasta={(v: string | null) =>
                                            onSetJornada(diaActivo, 1, v)
                                        }
                                    />
                                    <HorariosConfig_BloqueHorario
                                        titulo="Descanso"
                                        opcional
                                        desde={dia.descanso?.[0] || null}
                                        hasta={dia.descanso?.[1] || null}
                                        accentColor={accentColor}
                                        onDesde={(v: string | null) =>
                                            onSetDescanso(diaActivo, 0, v)
                                        }
                                        onHasta={(v: string | null) =>
                                            onSetDescanso(diaActivo, 1, v)
                                        }
                                    />
                                </div>
                            ) : (
                                <HorariosConfig_DiaDeshabilitado />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            {/* ── FOOTER ── */}
            {mostrarBotonGuardar && (
                <div
                    style={{
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: "1px solid #f0f0f0",
                        display: "flex",
                        alignItems: isMobile ? "stretch" : "center",
                        flexDirection: isMobile ? "column" : "row",
                        justifyContent: "space-between",
                        gap: isMobile ? 10 : 0,
                    }}
                >
                    {error ? (
                        <span
                            style={{
                                fontSize: 12,
                                color: "#ef4444",
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            {error}
                        </span>
                    ) : guardadoOk ? (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{
                                fontSize: 12,
                                color: accentColor,
                                fontWeight: 700,
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            Horarios guardados
                        </motion.span>
                    ) : (
                        <span
                            style={{
                                fontSize: 12,
                                color: "#bbb",
                                fontFamily: "'Inter', sans-serif",
                            }}
                        >
                            Los cambios se aplicarán al guardar
                        </span>
                    )}
                    <button
                        onClick={onGuardar}
                        disabled={guardando}
                        style={{
                            padding: "10px 22px",
                            borderRadius: 10,
                            border: "none",
                            background: guardando ? "#ccc" : "#000",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: guardando ? "wait" : "pointer",
                            fontFamily: "'Inter', sans-serif",
                            transition: "background 0.2s",
                            width: isMobile ? "100%" : "auto",
                        }}
                    >
                        {guardando ? "Guardando…" : "Guardar horarios"}
                    </button>
                </div>
            )}
        </div>
    )
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

function HorariosConfig_SkeletonHorarios() {
    return (
        <div style={{ display: "flex", gap: 16, flex: 1 }}>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    width: 130,
                }}
            >
                {HorariosConfig_DIAS_CONFIG.map(({ key }) => (
                    <HorariosConfig_Skel
                        key={key}
                        width="100%"
                        height={38}
                        style={{ borderRadius: 10 }}
                    />
                ))}
            </div>
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    paddingLeft: 16,
                }}
            >
                <HorariosConfig_Skel
                    width={100}
                    height={28}
                    style={{ borderRadius: 8 }}
                />
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                    }}
                >
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            style={{
                                background: "#fafafa",
                                borderRadius: 14,
                                padding: 16,
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                            }}
                        >
                            <HorariosConfig_Skel width={70} height={14} />
                            <HorariosConfig_Skel
                                width="100%"
                                height={38}
                                style={{ borderRadius: 10 }}
                            />
                            <HorariosConfig_Skel
                                width="100%"
                                height={38}
                                style={{ borderRadius: 10 }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

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

function ExcepcionesConfig_SkeletonCalendar() {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                padding: "22px",
                borderRadius: 20,
                background: "#fff",
                boxShadow:
                    "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <style>{ExcepcionesConfig_shimmerCSS}</style>
            <div
                style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: 20,
                }}
            >
                <div
                    className="exc-shimmer"
                    style={{ width: 140, height: 18 }}
                />
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                    gap: 6,
                }}
            >
                {Array(35)
                    .fill(0)
                    .map((_, i) => (
                        <div
                            key={i}
                            className="exc-shimmer"
                            style={{ aspectRatio: "1", borderRadius: 10 }}
                        />
                    ))}
            </div>
        </div>
    )
}

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
                <button
                    onClick={onClose}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        fontSize: 18,
                        lineHeight: 1,
                        padding: "2px 4px",
                    }}
                >
                    ×
                </button>
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
                    onClick={onClose}
                    style={{
                        padding: "7px 14px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "none",
                        fontSize: 13,
                        cursor: "pointer",
                        color: "#64748b",
                        fontFamily:
                            "'Inter Display', -apple-system, sans-serif",
                    }}
                >
                    Cancelar
                </button>
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
    style,
}: ExcepcionesConfig_Props) {
    const api = baseUrl.replace(/\/+$/, "")
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = ExcepcionesConfig_useContainerWidth(containerRef)
    const isMobile = containerWidth < 420

    // Padding adaptativo
    const pad = isMobile ? 14 : 22

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
                const configUrl = employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/config`
                    : `${api}/admin-stats/${slug}`
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

    const startOffset = ExcepcionesConfig_getMonthStart(curYear, curMonth)
    const totalDays = ExcepcionesConfig_getDaysInMonth(curYear, curMonth)
    const cells: (number | null)[] = [
        ...Array(startOffset).fill(null),
        ...Array.from({ length: totalDays }, (_, i) => i + 1),
    ]

    // FIX: los "chips" de abajo (fecha + botón × para borrar) ya no
    // muestran fechas que ya pasaron — no tiene sentido poder "borrar"
    // un bloqueo/excepción de un día que ya fue, y confundía al usuario.
    // El calendario de arriba NO se toca: sigue pintando todas las
    // excepciones (pasadas y futuras) leyendo directo de `exceptions`,
    // así el historial se mantiene visible ahí.
    const todayKey = ExcepcionesConfig_makeDateKey(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    )
    const excKeys = Object.keys(exceptions)
        .filter((k) => k >= todayKey)
        .sort()

    const navBtnStyle: React.CSSProperties = {
        background: "none",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        width: 30,
        height: 30,
        cursor: "pointer",
        color: "#64748b",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    }

    const mesLabel = isMobile
        ? `${ExcepcionesConfig_MESES[curMonth].substring(0, 3)} ${curYear}`
        : `${ExcepcionesConfig_MESES[curMonth]} ${curYear}`

    const cardStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        padding: `${pad}px`, // ← padding adaptativo, no fijo
        borderRadius: 20,
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter Display', -apple-system, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden", // ← corta cualquier desborde interno
        minWidth: 0, // ← evita que flex-children expandan el contenedor
        ...style,
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden", // ← wrapper también corta
                boxSizing: "border-box",
            }}
        >
            <div style={cardStyle}>
                <style>{ExcepcionesConfig_shimmerCSS}</style>

                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        marginBottom: 16,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <button onClick={prevMonth} style={navBtnStyle}>
                            ‹
                        </button>
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#1e293b",
                                minWidth: isMobile ? 72 : 110,
                                textAlign: "center",
                            }}
                        >
                            {mesLabel}
                        </span>
                        <button onClick={nextMonth} style={navBtnStyle}>
                            ›
                        </button>
                    </div>
                </div>

                {/* Días semana */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        gap: isMobile ? 3 : 6,
                        marginBottom: isMobile ? 3 : 6,
                    }}
                >
                    {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((d) => (
                        <div
                            key={d}
                            style={{
                                textAlign: "center",
                                fontSize: isMobile ? 10 : 11,
                                fontWeight: 600,
                                color: "#94a3b8",
                                padding: "4px 0",
                                letterSpacing: "0.04em",
                            }}
                        >
                            {d}
                        </div>
                    ))}
                </div>

                {/* Grilla */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                        gap: isMobile ? 3 : 6,
                    }}
                >
                    {cells.map((d, i) => {
                        if (!d) return <div key={`e-${i}`} />
                        const key = ExcepcionesConfig_makeDateKey(
                            curYear,
                            curMonth,
                            d
                        )
                        const cellDate = new Date(curYear, curMonth, d)
                        const isPast = cellDate < today
                        const isToday = cellDate.getTime() === today.getTime()
                        const exc = exceptions[key]
                        const isSelected = selectedKey === key

                        return (
                            <div
                                key={key}
                                onClick={() =>
                                    !isPast &&
                                    setSelectedKey(isSelected ? null : key)
                                }
                                style={{
                                    aspectRatio: "1",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: isMobile ? 7 : 10,
                                    border: `1px solid ${isSelected ? accentColor : exc?.type === "block" ? "#ef444466" : exc?.type === "custom" ? "#f9731666" : isToday ? `${accentColor}33` : "#e2e8f0"}`,
                                    background: isSelected
                                        ? `${accentColor}15`
                                        : exc?.type === "block"
                                          ? "#fef2f2"
                                          : exc?.type === "custom"
                                            ? "#fff7ed"
                                            : isToday
                                              ? `${accentColor}08`
                                              : "#ffffff",
                                    cursor: isPast ? "default" : "pointer",
                                    opacity: isPast ? 0.3 : 1,
                                    position: "relative",
                                    transition: "all 0.12s",
                                    minHeight: isMobile ? 34 : 52,
                                    overflow: "hidden",
                                }}
                            >
                                {exc && (
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: isMobile ? 3 : 5,
                                            right: isMobile ? 3 : 5,
                                            width: isMobile ? 5 : 6,
                                            height: isMobile ? 5 : 6,
                                            borderRadius: "50%",
                                            background:
                                                exc.type === "block"
                                                    ? "#ef4444"
                                                    : "#f97316",
                                        }}
                                    />
                                )}
                                <span
                                    style={{
                                        fontSize: isMobile ? 12 : 18,
                                        fontWeight: 400,
                                        lineHeight: 1,
                                        color:
                                            exc?.type === "block"
                                                ? "#dc2626"
                                                : exc?.type === "custom"
                                                  ? "#ea580c"
                                                  : isToday
                                                    ? accentColor
                                                    : "#1e293b",
                                    }}
                                >
                                    {d}
                                </span>
                                {!isMobile && (
                                    <span
                                        style={{
                                            fontSize: 9,
                                            color: "#cbd5e1",
                                            marginTop: 2,
                                        }}
                                    >
                                        {ExcepcionesConfig_MESES[curMonth]
                                            .substring(0, 3)
                                            .toLowerCase()}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Panel día */}
                <AnimatePresence>
                    {selectedKey && (
                        <ExcepcionesConfig_DayPanel
                            dayKey={selectedKey}
                            excepcion={exceptions[selectedKey] ?? null}
                            accentColor={accentColor}
                            isMobile={isMobile}
                            onSave={handleDaySave}
                            onClose={() => setSelectedKey(null)}
                        />
                    )}
                </AnimatePresence>

                <div
                    style={{
                        height: 1,
                        background: "#f1f5f9",
                        margin: "16px 0",
                    }}
                />

                {/* Leyenda */}
                <div
                    style={{
                        display: "flex",
                        gap: isMobile ? 8 : 16,
                        flexWrap: "wrap",
                        marginBottom: excKeys.length > 0 ? 12 : 0,
                    }}
                >
                    {[
                        { color: "#ef4444", label: "Día bloqueado" },
                        { color: "#f97316", label: "Intervalos propios" },
                        { color: accentColor, label: "Hoy" },
                    ].map(({ color, label }) => (
                        <div
                            key={label}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                fontSize: isMobile ? 10 : 11,
                                color: "#64748b",
                            }}
                        >
                            <div
                                style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: color,
                                    flexShrink: 0,
                                }}
                            />
                            {label}
                        </div>
                    ))}
                </div>

                {/* Chips activos */}
                {excKeys.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {excKeys.map((k) => {
                            const exc = exceptions[k]
                            const [, mm, dd] = k.split("-")
                            const lbl = `${parseInt(dd)} ${ExcepcionesConfig_MESES[parseInt(mm) - 1].substring(0, 3)}`
                            const isBlock = exc.type === "block"
                            return (
                                <div
                                    key={k}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        padding: "3px 10px",
                                        borderRadius: 99,
                                        fontSize: isMobile ? 11 : 12,
                                        fontWeight: 600,
                                        background: isBlock
                                            ? "#fef2f2"
                                            : "#fff7ed",
                                        border: `1px solid ${isBlock ? "#ef444444" : "#f9731644"}`,
                                        color: isBlock ? "#dc2626" : "#ea580c",
                                    }}
                                >
                                    {lbl}
                                    {exc.type === "custom" && exc.slots?.length
                                        ? ` (${exc.slots.length})`
                                        : ""}
                                    <button
                                        onClick={() => handleDaySave(k, null)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "inherit",
                                            fontSize: 14,
                                            lineHeight: 1,
                                            padding: 0,
                                            opacity: 0.6,
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Footer */}
                <div
                    style={{
                        marginTop: "auto",
                        paddingTop: 14,
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
        </div>
    )
}

export { HorariosConfig_TimeInput, HorariosConfig, HorariosConfig_Anticipacion, HorariosConfig_Shell, HorariosConfig_Toggle, HorariosConfig_DiaDeshabilitado, HorariosConfig_BloqueHorario, HorariosConfig_SkeletonHorarios, HorariosConfig_Skel, ExcepcionesConfig_SkeletonCalendar, ExcepcionesConfig_DayPanel, ExcepcionesConfig }
