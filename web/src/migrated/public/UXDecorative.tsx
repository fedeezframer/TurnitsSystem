import * as React from "react"

import { motion, AnimatePresence } from "framer-motion"

const BRAND = "#1B6B1A"
const WDAYS = ["DO", "LU", "MA", "MI", "JU", "VI", "SA"]
const SLOTS = [
    "07:50",
    "08:20",
    "08:50",
    "09:20",
    "09:50",
    "10:20",
    "10:50",
    "11:20",
    "11:50",
    "12:20",
]

const JUNE_FIRST_DAY = 1
const JUNE_DAYS = 30
const FREE_DAYS = [
    2, 3, 4, 8, 9, 10, 11, 15, 16, 17, 18, 22, 23, 24, 25, 29, 30,
]
const UNAVAIL_DAYS = [5, 6, 7, 12, 13, 14, 19, 20, 21, 26, 27, 28]
const TODAY_DAY = 1

// screen: which big screen is shown ("cal" | "slots")
// selectedDay / selectedSlot: null or value, updated in-place without fade
type Screen = "cal" | "slots"

const TIMELINE = [
    { screen: "cal", selectedDay: null, selectedSlot: null, hold: 1800 },
    { screen: "cal", selectedDay: 2, selectedSlot: null, hold: 2000 },
    { screen: "slots", selectedDay: 2, selectedSlot: null, hold: 1800 },
    { screen: "slots", selectedDay: 2, selectedSlot: "10:26", hold: 2800 },
] as const

export default function AssocieBookingLoop(props: any) {
    const { businessName } = props
    const [idx, setIdx] = React.useState(0)
    const current = TIMELINE[idx]

    // Which screen we're transitioning between (for AnimatePresence key)
    const screenKey = current.screen

    React.useEffect(() => {
        const t = setTimeout(
            () => setIdx((i) => (i + 1) % TIMELINE.length),
            current.hold
        )
        return () => clearTimeout(t)
    }, [idx])

    return (
        <div style={s.wrapper}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={screenKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28 }}
                    style={s.page}
                >
                    <p style={s.bizTitle}>{businessName}</p>

                    {screenKey === "cal" && (
                        <>
                            <p style={s.sectionLbl}>Selecciona el Día</p>
                            <CalendarBox
                                selectedDay={current.selectedDay ?? null}
                            />
                            <div style={s.btnRow}>
                                <BtnBack>Volver</BtnBack>
                                <BtnCta green={current.selectedDay !== null}>
                                    Continuar →
                                </BtnCta>
                            </div>
                        </>
                    )}

                    {screenKey === "slots" && (
                        <>
                            <p style={s.sectionLbl}>Selecciona el Horario</p>
                            <SlotsBox
                                selectedSlot={current.selectedSlot ?? null}
                            />
                            <div style={s.btnRow}>
                                <BtnBack>Volver</BtnBack>
                                <BtnCta green={current.selectedSlot !== null}>
                                    Reservar
                                </BtnCta>
                            </div>
                        </>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

// ─── Calendar ────────────────────────────────────────────────
function CalendarBox({ selectedDay }: { selectedDay: number | null }) {
    return (
        <div style={s.calBox}>
            <div style={s.calHeader}>
                <NavBtn disabled>‹</NavBtn>
                <span style={s.calMonth}>Junio de 2026</span>
                <NavBtn>›</NavBtn>
            </div>
            <div style={s.weekRow}>
                {WDAYS.map((d) => (
                    <span key={d} style={s.wname}>
                        {d}
                    </span>
                ))}
            </div>
            <div style={s.calDivider} />
            <div style={s.calGrid}>
                {Array.from({ length: JUNE_FIRST_DAY }).map((_, i) => (
                    <div key={`e${i}`} style={s.dcEmpty} />
                ))}
                {Array.from({ length: JUNE_DAYS }).map((_, i) => {
                    const day = i + 1
                    const isSel = day === selectedDay
                    const isToday = day === TODAY_DAY
                    const isFree = FREE_DAYS.includes(day)
                    const isUnavail = UNAVAIL_DAYS.includes(day)

                    let border = "1.5px solid transparent"
                    let bg = "transparent"
                    let color = "#111"
                    let fontWeight: any = 400

                    if (isSel) {
                        bg = BRAND
                        border = `1.5px solid ${BRAND}`
                        color = "#fff"
                        fontWeight = 700
                    } else if (isToday) {
                        border = `1.5px dashed ${BRAND}`
                        fontWeight = 700
                    } else if (isFree) {
                        border = `1.5px solid ${BRAND}`
                    } else if (isUnavail) {
                        border = "1.5px solid #E8E8E8"
                        color = "#CCCCCC"
                    }

                    return (
                        <div
                            key={day}
                            style={{
                                ...s.dc,
                                border,
                                background: bg,
                                color,
                                fontWeight,
                                transition:
                                    "background 0.12s, border-color 0.12s, color 0.12s",
                            }}
                        >
                            {day}
                            {isToday && !isSel && <span style={s.todayDot} />}
                        </div>
                    )
                })}
            </div>
            <div style={s.legend}>
                <LegItem color={BRAND} label="Disponible" />
                <LegItem
                    color="transparent"
                    border="#E0E0E0"
                    label="Sin turnos"
                />
                <LegItem
                    color="transparent"
                    border={BRAND}
                    dashed
                    label="Hoy"
                />
            </div>
        </div>
    )
}

// ─── Slots ───────────────────────────────────────────────────
function SlotsBox({ selectedSlot }: { selectedSlot: string | null }) {
    return (
        <div style={s.slotsOuter}>
            <div style={s.slotsGrid}>
                {SLOTS.map((hora) => {
                    const isSel = hora === selectedSlot
                    return (
                        <div
                            key={hora}
                            style={{
                                ...s.slotBtn,
                                background: isSel ? "#111" : "#fff",
                                border: isSel
                                    ? "1px solid #111"
                                    : "1px solid #EEEEEE",
                                color: isSel ? "#fff" : "#111",
                                transition: "none",
                            }}
                        >
                            {hora}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Small components ────────────────────────────────────────
function NavBtn({ children, disabled = false }: any) {
    return (
        <div
            style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "0.5px solid #E0E0E0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 600,
                color: disabled ? "#CCC" : "#111",
                userSelect: "none",
            }}
        >
            {children}
        </div>
    )
}

function BtnBack({ children }: any) {
    return <div style={s.btnBack}>{children}</div>
}

function BtnCta({ children, green }: any) {
    return (
        <div
            style={{
                ...s.btnCta,
                background: green ? BRAND : "#111",
                transition: "background 0.15s",
            }}
        >
            {children}
        </div>
    )
}

function LegItem({ color, border = "none", dashed = false, label }: any) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: color,
                    border:
                        border !== "none"
                            ? `1.5px ${dashed ? "dashed" : "solid"} ${border}`
                            : "none",
                    flexShrink: 0,
                }}
            />
            <span style={{ fontSize: 11, color: "#999" }}>{label}</span>
        </div>
    )
}

// ─── Styles ──────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
    wrapper: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "32px 20px",
        overflow: "hidden",
    },
    page: {
        width: "100%",
        maxWidth: 420,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },
    bizTitle: {
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "#111",
        textAlign: "center",
        marginBottom: 32,
    },
    sectionLbl: {
        fontSize: 14,
        fontWeight: 400,
        color: "#666",
        alignSelf: "flex-start",
        marginBottom: 12,
        width: "100%",
    },
    calBox: {
        width: "100%",
        background: "#fff",
        border: "0.5px solid #E0E0E0",
        borderRadius: 16,
        padding: "16px 18px 14px",
    },
    calHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
    },
    calMonth: { fontSize: 13, fontWeight: 500, color: "#111" },
    weekRow: {
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        marginBottom: 6,
    },
    wname: {
        textAlign: "center",
        fontSize: 10,
        fontWeight: 500,
        color: "#BBBBBB",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "2px 0",
    },
    calDivider: { height: 1, background: "#F0F0F0", marginBottom: 8 },
    calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 },
    dc: {
        aspectRatio: "1",
        borderRadius: 10,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        position: "relative",
        userSelect: "none",
    },
    dcEmpty: { aspectRatio: "1" },
    todayDot: {
        position: "absolute",
        bottom: 3,
        left: "50%",
        transform: "translateX(-50%)",
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: BRAND,
    },
    legend: {
        display: "flex",
        justifyContent: "center",
        gap: 18,
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid #F0F0F0",
    },
    slotsOuter: {
        width: "100%",
        maxHeight: 300,
        overflowY: "auto",
        border: "0.5px solid #E0E0E0",
        borderRadius: 14,
        padding: 10,
    },
    slotsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    slotBtn: {
        padding: "13px 8px",
        borderRadius: 13,
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
        userSelect: "none",
    },
    btnRow: {
        display: "flex",
        gap: 12,
        marginTop: 28,
        width: "100%",
        justifyContent: "center",
    },
    btnBack: {
        padding: "13px 28px",
        borderRadius: 12,
        border: "1px solid #E0E0E0",
        background: "transparent",
        color: "#111",
        fontSize: 14,
        fontWeight: 400,
        userSelect: "none",
    },
    btnCta: {
        padding: "13px 28px",
        borderRadius: 12,
        color: "#fff",
        fontSize: 14,
        fontWeight: 500,
        userSelect: "none",
    },
}


