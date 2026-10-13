import * as React from "react"

import { motion, AnimatePresence } from "framer-motion"

// ─────────────────────────────────────────────────────────────
// ReprogramarTurno — página standalone (llega vía link del mail).
//
// FIX: alineado al contrato real del backend:
//   - GET  /reprogramar/info/:turno_id?slug=...&token=...
//   - POST /reprogramar/solicitar { turno_id, slug, token, fecha_nueva, hora_nueva }
// (antes pegaba a /turno/:id y /turnos/reprogramar-solicitud, que
// no existen, y mandaba campos con otros nombres).
//
// El backend exige "slug" en ambos llamados, así que ahora el slug
// SIEMPRE se toma del query param de la URL (?u= o ?slug=), no del
// objeto turno (que no lo trae). Asegurate de que el link del mail
// incluya ese parámetro (armarReprogramarUrl ya lo hace).
// ─────────────────────────────────────────────────────────────

const DIAS = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
]
const padZ = (n: number) => String(n).padStart(2, "0")
const toISO = (y: number, m: number, d: number) =>
    `${y}-${padZ(m + 1)}-${padZ(d)}`

const getHoyBA = () => {
    const d = new Date(
        new Date().toLocaleString("en-US", {
            timeZone: "America/Argentina/Buenos_Aires",
        })
    )
    d.setHours(0, 0, 0, 0)
    return d
}

function getUrlParams() {
    if (typeof window === "undefined") return { id: "", token: "", slug: "" }
    const p = new URLSearchParams(window.location.search)
    return {
        id: p.get("turno_id") || p.get("id") || "",
        token: p.get("token") || p.get("gestion_token") || "",
        slug: p.get("slug") || p.get("u") || "",
    }
}

type Estado =
    | "cargando"
    | "error"
    | "cancelado"
    | "pendiente_ya"
    | "no_disponible"
    | "form"
    | "enviando"
    | "enviado"

export default function ReprogramarTurno(props: any) {
    const {
        baseUrl,
        useNegocioTheme: usarTemaProp,
        brandColor = "#1B6B1A",
    } = props

    // El backend arma el link como:
    // REPROGRAMAR_URL?turno_id=...&token=...&slug=...
    const { id, token, slug } = React.useMemo(getUrlParams, [])
    const hoyBA = React.useMemo(() => getHoyBA(), [])

    const [estado, setEstado] = React.useState<Estado>("cargando")
    const [turno, setTurno] = React.useState<any>(null)
    const [errorMsg, setErrorMsg] = React.useState("")

    // Datos del negocio (para calendario)
    const [horarios, setHorarios] = React.useState<any>({})
    const [excepciones, setExcepciones] = React.useState<
        Record<string, string>
    >({})
    const [tema, setTema] = React.useState<any>(null)

    // Calendario
    const [monthOffset, setMonthOffset] = React.useState(0)
    const [diasLlenos, setDiasLlenos] = React.useState<string[]>([])
    const [diasCargando, setDiasCargando] = React.useState<string[]>([])
    const [nuevaFecha, setNuevaFecha] = React.useState("")

    // Horarios del día elegido
    const [slots, setSlots] = React.useState<any[]>([])
    const [slotsLoading, setSlotsLoading] = React.useState(false)
    const [nuevaHora, setNuevaHora] = React.useState("")

    const [submitting, setSubmitting] = React.useState(false)
    const [submitError, setSubmitError] = React.useState("")

    const usarTema = usarTemaProp !== false
    const accent = usarTema && tema?.primario ? tema.primario : brandColor

    // ── 1) Cargar turno + negocio ──────────────────────────────
    // NOTA: /reprogramar/info/:turno_id NO devuelve servicio_id,
    // solo "servicio" (nombre). Si tus servicios tienen duraciones
    // distintas entre sí, pedile al backend que agregue servicio_id
    // al SELECT de esa ruta para que /slots-disponibles calcule bien
    // la duración; mientras tanto se usa la duración general del negocio.
    React.useEffect(() => {
        if (!id || !token || !slug) {
            setErrorMsg("Este link de reprogramación no es válido.")
            setEstado("error")
            return
        }

        const cargar = async () => {
            try {
                const res = await fetch(
                    `${baseUrl}/reprogramar/info/${id}?slug=${encodeURIComponent(
                        slug
                    )}&token=${encodeURIComponent(token)}`
                )
                const data = await res.json()
                if (!data.success || !data.turno) {
                    setErrorMsg(
                        data.error ||
                            "No encontramos este turno, o el link venció."
                    )
                    setEstado("error")
                    return
                }

                setTurno(data.turno)

                if (data.turno.estado === "cancelado") {
                    setEstado("cancelado")
                    return
                }
                if (data.solicitud_pendiente) {
                    setEstado("pendiente_ya")
                    return
                }
                if (!data.puede_reprogramar) {
                    setErrorMsg(
                        "Este turno ya no se puede reprogramar (pasó la fecha o cambió de estado)."
                    )
                    setEstado("no_disponible")
                    return
                }

                const resNeg = await fetch(`${baseUrl}/negocio/${slug}`)
                const dataNeg = await resNeg.json()
                if (dataNeg.success && dataNeg.negocio) {
                    setHorarios(dataNeg.negocio.horarios || {})
                    setTema(dataNeg.negocio.tema || null)
                    const excMap: Record<string, string> = {}
                    ;(dataNeg.negocio.excepciones || []).forEach((e: any) => {
                        if (typeof e === "string") excMap[e] = "block"
                        else if (e?.fecha) excMap[e.fecha] = e.type || "block"
                    })
                    setExcepciones(excMap)
                }

                setEstado("form")
            } catch (e) {
                setErrorMsg("Error al conectar con el servidor.")
                setEstado("error")
            }
        }

        cargar()
    }, [baseUrl, id, token, slug])

    // ── 2) Precalcular días llenos del mes visible ─────────────
    React.useEffect(() => {
        if (estado !== "form") return
        if (!slug || Object.keys(horarios).length === 0) return

        const displayDate = new Date(
            hoyBA.getFullYear(),
            hoyBA.getMonth() + monthOffset,
            1
        )
        const year = displayDate.getFullYear()
        const month = displayDate.getMonth()
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        const candidatos: string[] = []
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month, d)
            dateObj.setHours(0, 0, 0, 0)
            if (dateObj < hoyBA) continue
            const iso = toISO(year, month, d)
            const excType = excepciones[iso]
            if (excType === "block") continue
            const diaNombre = DIAS[dateObj.getDay()]
            if (excType !== "custom" && !horarios[diaNombre]?.activo) continue
            candidatos.push(iso)
        }

        setDiasCargando(candidatos)
        setDiasLlenos([])

        const chunks: string[][] = []
        for (let i = 0; i < candidatos.length; i += 10)
            chunks.push(candidatos.slice(i, i + 10))
        const llenos: string[] = []

        const procesarChunk = async (chunk: string[]) => {
            await Promise.all(
                chunk.map(async (fecha) => {
                    try {
                        const res = await fetch(
                            `${baseUrl}/slots-disponibles/${slug}?fecha=${fecha}`
                        )
                        const data = await res.json()
                        if (data.success) {
                            const hayDisponibles = (data.slots || []).some(
                                (s: any) => !s.lleno && s.disponibles > 0
                            )
                            if (!hayDisponibles) llenos.push(fecha)
                        }
                    } catch {}
                })
            )
        }

        const run = async () => {
            for (const chunk of chunks) await procesarChunk(chunk)
            setDiasLlenos([...llenos])
            setDiasCargando([])
        }
        run()
    }, [monthOffset, horarios, excepciones, estado])

    // ── 3) Fetch horarios del día elegido ──────────────────────
    React.useEffect(() => {
        if (!nuevaFecha) {
            setSlots([])
            return
        }
        const fetchSlots = async () => {
            setSlotsLoading(true)
            setNuevaHora("")
            try {
                // servicio_id no viene en /reprogramar/info; si el
                // backend llega a agregarlo, esto lo va a tomar solo.
                let url = `${baseUrl}/slots-disponibles/${slug}?fecha=${nuevaFecha}`
                if (turno?.servicio_id)
                    url += `&servicio_id=${turno.servicio_id}`
                const res = await fetch(url)
                const data = await res.json()
                setSlots(data.success ? data.slots || [] : [])
            } catch {
                setSlots([])
            } finally {
                setSlotsLoading(false)
            }
        }
        fetchSlots()
    }, [nuevaFecha])

    const slotsDisponibles = React.useMemo(
        () => slots.filter((s) => !s.lleno && s.disponibles > 0),
        [slots]
    )

    const handleSubmit = async () => {
        if (!nuevaFecha || !nuevaHora) return
        setSubmitting(true)
        setSubmitError("")
        try {
            const res = await fetch(`${baseUrl}/reprogramar/solicitar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    turno_id: id,
                    slug,
                    token,
                    fecha_nueva: nuevaFecha,
                    hora_nueva: nuevaHora,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setEstado("enviado")
                if (props.onReprogramSuccess) props.onReprogramSuccess()
            } else {
                setSubmitError(data.error || "No se pudo enviar la solicitud.")
            }
        } catch (e) {
            setSubmitError("Error al conectar con el servidor.")
        } finally {
            setSubmitting(false)
        }
    }

    // ── Render por estado ───────────────────────────────────────
    if (estado === "cargando") return <StatusCard text="Cargando tu turno..." />
    if (estado === "error") return <StatusCard text={errorMsg} />
    if (estado === "no_disponible") return <StatusCard text={errorMsg} />
    if (estado === "cancelado")
        return (
            <StatusCard text="Este turno ya fue cancelado. Si fue un error, contactá directamente al negocio." />
        )
    if (estado === "pendiente_ya")
        return (
            <StatusCard text="Ya enviaste una solicitud de reprogramación. Te va a confirmar el negocio en breve." />
        )
    if (estado === "enviado")
        return (
            <div style={styles.wrapper}>
                <SuccessCard
                    accent={accent}
                    nuevaFecha={nuevaFecha}
                    nuevaHora={nuevaHora}
                />
            </div>
        )

    const displayDate = new Date(
        hoyBA.getFullYear(),
        hoyBA.getMonth() + monthOffset,
        1
    )
    const year = displayDate.getFullYear()
    const month = displayDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstWeekday = displayDate.getDay()
    const monthLabel = displayDate
        .toLocaleString("es-AR", { month: "long", year: "numeric" })
        .replace(/^\w/, (c) => c.toUpperCase())

    return (
        <div style={styles.wrapper}>
            {/* Turno actual */}
            <div style={styles.currentCard}>
                <div style={styles.currentLabel}>Turno actual</div>
                <div style={styles.currentValue}>
                    {turno?.servicio ? `${turno.servicio} — ` : ""}
                    {turno?.fecha} a las {turno?.hora}hs
                </div>
            </div>

            <div style={styles.sectionTitle}>Elegí una nueva fecha</div>

            {/* Header calendario */}
            <div style={styles.header}>
                <NavButton
                    onClick={() => setMonthOffset((p) => p - 1)}
                    disabled={monthOffset <= 0}
                >
                    ‹
                </NavButton>
                <AnimatePresence mode="wait">
                    <motion.span
                        key={monthLabel}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.15 }}
                        style={styles.monthLabel}
                    >
                        {monthLabel}
                    </motion.span>
                </AnimatePresence>
                <NavButton onClick={() => setMonthOffset((p) => p + 1)}>
                    ›
                </NavButton>
            </div>

            <div style={styles.weekRow}>
                {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((d) => (
                    <span key={d} style={styles.weekDay}>
                        {d}
                    </span>
                ))}
            </div>
            <div style={styles.divider} />

            <AnimatePresence mode="wait">
                <motion.div
                    key={`${year}-${month}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={styles.grid}
                >
                    {Array.from({ length: firstWeekday }).map((_, i) => (
                        <div key={`empty-${i}`} style={styles.emptyCell} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1
                        const dateObj = new Date(year, month, day)
                        dateObj.setHours(0, 0, 0, 0)
                        const iso = toISO(year, month, day)
                        const diaNombre = DIAS[dateObj.getDay()]
                        const isPast = dateObj < hoyBA
                        const excType = excepciones[iso]
                        const isExcepcionBlock = excType === "block"
                        const isExcepcionCustom = excType === "custom"
                        const isWorkingDay = isExcepcionCustom
                            ? true
                            : !!horarios[diaNombre]?.activo
                        const isFull = diasLlenos.includes(iso)
                        const isChecking = diasCargando.includes(iso)
                        const isBlocked =
                            isPast ||
                            isExcepcionBlock ||
                            !isWorkingDay ||
                            isFull
                        const isSelected = nuevaFecha === iso

                        return (
                            <DayCell
                                key={iso}
                                day={day}
                                accent={accent}
                                isSelected={isSelected}
                                isBlocked={isBlocked}
                                isChecking={isChecking}
                                onClick={() => !isBlocked && setNuevaFecha(iso)}
                            />
                        )
                    })}
                </motion.div>
            </AnimatePresence>

            {/* Horarios del día elegido */}
            <AnimatePresence>
                {nuevaFecha && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ width: "100%", overflow: "hidden" }}
                    >
                        <div style={{ ...styles.sectionTitle, marginTop: 20 }}>
                            Elegí un horario
                        </div>
                        {slotsLoading ? (
                            <StatusCard text="Buscando horarios..." small />
                        ) : slotsDisponibles.length === 0 ? (
                            <StatusCard
                                text="No hay horarios libres ese día. Probá otra fecha."
                                small
                            />
                        ) : (
                            <div style={styles.slotsGrid}>
                                {slotsDisponibles.map((s) => {
                                    const isSelected = nuevaHora === s.hora
                                    return (
                                        <motion.button
                                            key={s.hora}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setNuevaHora(s.hora)}
                                            style={{
                                                ...styles.slotBtn,
                                                border: isSelected
                                                    ? `1px solid ${accent}`
                                                    : "1px solid #EEE",
                                                backgroundColor: isSelected
                                                    ? accent
                                                    : "#FFF",
                                                color: isSelected
                                                    ? "#FFF"
                                                    : "#000",
                                            }}
                                        >
                                            {s.hora}
                                        </motion.button>
                                    )
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {submitError && <div style={styles.submitError}>{submitError}</div>}

            <motion.button
                whileTap={nuevaFecha && nuevaHora ? { scale: 0.97 } : {}}
                onClick={handleSubmit}
                disabled={!nuevaFecha || !nuevaHora || submitting}
                style={{
                    ...styles.confirmBtn,
                    backgroundColor: accent,
                    opacity:
                        !nuevaFecha || !nuevaHora ? 0.4 : submitting ? 0.7 : 1,
                    cursor:
                        !nuevaFecha || !nuevaHora || submitting
                            ? "default"
                            : "pointer",
                }}
            >
                {submitting ? "Enviando..." : "Solicitar reprogramación"}
            </motion.button>
        </div>
    )
}

// ─── Sub-componentes ──────────────────────────────────────────

function DayCell({
    day,
    accent,
    isSelected,
    isBlocked,
    isChecking,
    onClick,
}: any) {
    return (
        <motion.button
            whileHover={!isBlocked ? { scale: 1.08 } : {}}
            whileTap={!isBlocked ? { scale: 0.93 } : {}}
            onClick={onClick}
            disabled={isBlocked}
            style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                border: isSelected
                    ? `1.5px solid ${accent}`
                    : isBlocked
                      ? "1.5px solid #EBEBEB"
                      : `1.5px solid ${accent}`,
                background: isSelected ? accent : "transparent",
                color: isSelected ? "#FFF" : isBlocked ? "#C8C8C8" : "#111",
                fontSize: "13px",
                fontWeight: isSelected ? "700" : "400",
                cursor: isBlocked ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isBlocked ? 0.5 : 1,
                transition: "background 0.12s, color 0.12s, border 0.12s",
                fontFamily: "inherit",
            }}
        >
            {isChecking ? (
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.9,
                        ease: "linear",
                    }}
                    style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        border: `2px solid ${accent}`,
                        borderTopColor: "transparent",
                    }}
                />
            ) : (
                day
            )}
        </motion.button>
    )
}

function NavButton({ onClick, disabled = false, children }: any) {
    return (
        <motion.button
            whileHover={!disabled ? { scale: 1.1 } : {}}
            whileTap={!disabled ? { scale: 0.9 } : {}}
            onClick={onClick}
            disabled={disabled}
            style={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                border: "1.5px solid #E0E0E0",
                background: "transparent",
                color: disabled ? "#CCC" : "#111",
                fontSize: "18px",
                fontWeight: "600",
                cursor: disabled ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "inherit",
            }}
        >
            {children}
        </motion.button>
    )
}

function SuccessCard({ accent, nuevaFecha, nuevaHora }: any) {
    return (
        <div
            style={{
                ...styles.currentCard,
                borderColor: accent,
                textAlign: "center" as const,
            }}
        >
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#111",
                    marginBottom: 6,
                }}
            >
                ¡Listo, enviamos tu pedido!
            </div>
            <div style={{ fontSize: 13, color: "#777", lineHeight: 1.5 }}>
                Solicitaste pasar tu turno al {nuevaFecha} a las {nuevaHora}hs.
                El negocio te va a confirmar en breve.
            </div>
        </div>
    )
}

function StatusCard({
    text,
    small = false,
}: {
    text: string
    small?: boolean
}) {
    return (
        <div
            style={{
                padding: small ? "16px 10px" : "32px 20px",
                textAlign: "center",
                fontSize: 13,
                color: "#999",
            }}
        >
            {text}
        </div>
    )
}

// ─── Estilos ──────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        width: "100%",
        maxWidth: 360,
        margin: "0 auto",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    currentCard: {
        border: "1px solid #EEE",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 18,
        backgroundColor: "#FAFAFA",
    },
    currentLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: "#999",
        textTransform: "uppercase" as const,
        marginBottom: 4,
    },
    currentValue: { fontSize: 14, fontWeight: 700, color: "#111" },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 600,
        color: "#111",
        marginBottom: 10,
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 18,
    },
    monthLabel: {
        fontWeight: 600,
        fontSize: 14,
        color: "#111",
        letterSpacing: "0.2px",
    },
    weekRow: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 40px)",
        gap: "6px",
        marginBottom: 8,
        justifyContent: "center",
    },
    weekDay: {
        width: 40,
        textAlign: "center" as const,
        fontSize: 11,
        fontWeight: 500,
        color: "#BBB",
        letterSpacing: "0.4px",
        textTransform: "uppercase" as const,
    },
    divider: { height: 1, background: "#F0F0F0", marginBottom: 10 },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 40px)",
        gap: "6px",
        justifyContent: "center",
    },
    emptyCell: { width: 40, height: 40 },
    slotsGrid: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: 8,
        marginBottom: 4,
    },
    slotBtn: {
        padding: "10px 14px",
        borderRadius: "12px",
        fontWeight: 700,
        fontSize: "13px",
        cursor: "pointer",
        transition: "background-color 0.15s, color 0.15s, border 0.15s",
    },
    confirmBtn: {
        marginTop: 20,
        width: "100%",
        padding: "13px",
        borderRadius: "12px",
        border: "none",
        color: "#FFF",
        fontSize: 14,
        fontWeight: 700,
        fontFamily: "inherit",
    },
    submitError: {
        fontSize: 12,
        color: "#E55",
        marginTop: 10,
        textAlign: "center" as const,
    },
}


