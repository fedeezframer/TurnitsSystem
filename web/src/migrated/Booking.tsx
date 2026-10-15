import { appConfig } from "../config"
import * as React from "react"
import { promoAppliesOn, promoDaysLabel } from "../shared/promotions.js"
import type {MapBranch} from "../components/BranchMap"
const BranchSelection=React.lazy(()=>import("../components/BranchMap").then(m=>({default:m.BranchSelection})))

import { motion, AnimatePresence } from "framer-motion"

const SUCCESS_URL = "https://turnits.com/success"
const PENDIENTE_URL = "https://turnits.com/pendiente"
const ALERT_URL = "https://turnits.com/alert"
const ERROR_URL = "https://turnits.com/error"

const MIN_DIGITOS_TEL = 5
const MIN_DIGITOS_TEL_BOTON = 7
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp"]
const MAX_BYTES = 3 * 1024 * 1024 // 3MB
const GRID_GAP = 10
const CUALQUIER_PROFESIONAL = "cualquiera"

const DEFAULT_TEMA = {
    primario: "#1F2937",
    secundario: "#6B7280",
    fondo: "#FFFFFF",
    texto: "#111827",
    acento: "#9CA3AF",
}

// Máximo de días que se muestran en el paso de elegir día (2 filas de 4)
const MAX_DIAS_VISIBLES = 8
// Con "Ver más días" se suman 2 filas más de 4
const MAX_DIAS_EXPANDIDO = 16

const DIAS = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
]

const PAISES = [
    { code: "AR", flag: "🇦🇷", dial: "+54", name: "Argentina" },
    { code: "UY", flag: "🇺🇾", dial: "+598", name: "Uruguay" },
    { code: "CL", flag: "🇨🇱", dial: "+56", name: "Chile" },
    { code: "PY", flag: "🇵🇾", dial: "+595", name: "Paraguay" },
    { code: "BO", flag: "🇧🇴", dial: "+591", name: "Bolivia" },
    { code: "BR", flag: "🇧🇷", dial: "+55", name: "Brasil" },
    { code: "PE", flag: "🇵🇪", dial: "+51", name: "Perú" },
    { code: "CO", flag: "🇨🇴", dial: "+57", name: "Colombia" },
    { code: "MX", flag: "🇲🇽", dial: "+52", name: "México" },
    { code: "US", flag: "🇺🇸", dial: "+1", name: "Estados Unidos" },
    { code: "ES", flag: "🇪🇸", dial: "+34", name: "España" },
]

interface Tema {
    primario: string
    secundario: string
    fondo: string
    texto: string
    acento: string
}
interface DatosBancarios {
    banco?: string
    titular?: string
    cbu?: string
    alias?: string
}
interface Negocio {
    business_name: string
    logo_url: string | null
    tema: Tema
    horarios: Record<string, { activo: boolean }>
    excepciones: any[]
    suspendido?: boolean
    plan: "gratis" | "basico" | "premium"
    tiene_mp: boolean
    metodos_pago_disponibles: string[]
    metodo_pago: "none" | "sena" | "total"
    agenda_sin_pagos?: boolean
    porcentaje_sena: number
    datos_bancarios: DatosBancarios | null
}
interface BookingPromo {
 dias_semana?: number[] | null;
 imagenes?:{id:string;tipo:string;url:string}[];
 id:string;nombre:string;tipo:"combo"|"descuento";servicio_id:string;precio_original:number;precio_final:number;duracion:number;fecha_inicio:string;fecha_fin:string;items:{id:string;tipo:string;nombre:string;cantidad:number}[]
}
interface Servicio {
    precio_original?: number
    promo_id?: string
    id: string
    nombre: string
    descripcion: string
    imagen: string
    duracion: number
    precio: number
    capacidad: number
}
interface Profesional {
    id: string
    nombre: string
    apellido: string | null
    color: string
    foto_url: string | null
}
interface Slot {
    hora: string
    lleno: boolean
    disponibles: number
    equipo_id?: string | null
}
interface Extra {
    id: string
    nombre: string
    descripcion?: string | null
    precio: number
    imagen_url?: string | null
}
interface ExtraSeleccionado {
    cantidad: number
    id: string
    nombre: string
    precio: number
    imagen_url?: string | null
}
type MetodoKey = "mercadopago" | "tarjeta" | "transferencia" | "efectivo"
type FranjaId = "todos" | "manana" | "tarde" | "noche"

interface ExcepcionInfo {
    type: "block" | "custom"
    slots?: [string, string][]
}
type ExcepcionesMap = Record<string, ExcepcionInfo>

function normalizarExcepciones(raw: any): ExcepcionesMap {
    const map: ExcepcionesMap = {}
    if (!Array.isArray(raw)) return map
    for (const exc of raw) {
        if (typeof exc === "string") {
            map[exc] = { type: "block" }
        } else if (exc && typeof exc === "object" && exc.fecha) {
            map[exc.fecha] = {
                type: exc.type === "custom" ? "custom" : "block",
                slots: Array.isArray(exc.slots) ? exc.slots : undefined,
            }
        }
    }
    return map
}

/* getSlugFromUrl: lee el slug del negocio desde la URL de la agenda
   pública. Soporta las dos formas de link:
     - Nueva (URL amigable):  https://turnits.com/agenda/maria
     - Anterior (querystring): https://turnits.com/agenda?u=maria
   Se prioriza el path (/agenda/maria) y, si no matchea, se cae al
   querystring (?u=maria) para no romper enlaces viejos ya compartidos
   (WhatsApp, Instagram bio, Google, etc.). Si ninguno de los dos está
   presente, se usa manualSlug (el de prueba en Framer) o el último
   slug guardado en localStorage. */
function getSlugFromUrl(manualSlug: string): string {
    if (typeof window === "undefined") return manualSlug || ""

    let fromUrl = ""
    try {
        const path = window.location.pathname || ""
        const match = path.match(/\/agenda\/([^\/?#]+)/i)
        if (match && match[1]) fromUrl = decodeURIComponent(match[1])
    } catch {}

    if (!fromUrl) {
        try {
            fromUrl = new URLSearchParams(window.location.search).get("u") || ""
        } catch {}
    }

    if (fromUrl) {
        const clean = fromUrl.toLowerCase().trim()
        try {
            localStorage.setItem("user_slug", clean)
        } catch {}
        return clean
    }

    try {
        return manualSlug?.trim() || localStorage.getItem("user_slug") || ""
    } catch {
        return manualSlug?.trim() || ""
    }
}

const padZ = (n: number) => String(n).padStart(2, "0")
const toISO = (y: number, m: number, d: number) =>
    `${y}-${padZ(m + 1)}-${padZ(d)}`

function getHoyBA(): Date {
    const d = new Date(
        new Date().toLocaleString("en-US", {
            timeZone: "America/Argentina/Buenos_Aires",
        })
    )
    d.setHours(0, 0, 0, 0)
    return d
}
function getHoyBAISO(): string {
    return new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Argentina/Buenos_Aires",
    })
}
function getMinutosAhoraBA(): number {
    const str = new Date().toLocaleString("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    })
    const [h, m] = str.split(":").map(Number)
    return h * 60 + m
}

function formatearFecha(fechaISO: string): string {
    if (!fechaISO) return ""
    try {
        const [y, m, d] = fechaISO.split("-").map(Number)
        const date = new Date(y, m - 1, d, 12)
        const texto = date.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
        })
        return texto.charAt(0).toUpperCase() + texto.slice(1)
    } catch {
        return fechaISO
    }
}
function formatearMoneda(valor: number): string {
    try {
        return valor.toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0,
        })
    } catch {
        return `$${valor}`
    }
}
function parseDesc(raw: string): { imagen: string; descripcion: string } {
    const match = (raw || "").match(/^\[img:(.*?)\](.*)$/s)
    if (match) return { imagen: match[1].trim(), descripcion: match[2].trim() }
    return { imagen: "", descripcion: raw || "" }
}
function flagUrl(code: string): string {
    return `https://flagcdn.com/${code.toLowerCase()}.svg`
}

function minutosDeHora(hora: string): number {
    const [h, m] = hora.split(":").map(Number)
    return h * 60 + (m || 0)
}
function getFranjaDeSlot(
    hora: string,
    corteManana: number,
    corteTarde: number
): Exclude<FranjaId, "todos"> {
    const mins = minutosDeHora(hora)
    if (mins < corteManana * 60) return "manana"
    if (mins < corteTarde * 60) return "tarde"
    return "noche"
}
// ────────────────────────────────────────────────────────────
// Helpers de color de tema. El componente puede vivir sobre
// cualquier fondo de página (el fondo de la página NO es el
// mismo que negocio.tema.fondo), así que en vez de usar grises
// fijos ("#111827", "#6B7280", "#94a3b8", etc.) en cada estilo
// inline, generamos variables CSS a partir del tema del negocio
// y las aplicamos en el contenedor raíz. Todo lo demás referencia
// esas variables (var(--bf-text), var(--bf-text-muted), etc.) en
// vez de un color fijo, así el contraste siempre es correcto sin
// importar qué "tema.fondo" y "tema.texto" haya elegido el
// negocio, ni qué color de fondo tenga la página que lo rodea.
// ────────────────────────────────────────────────────────────
function withAlpha(hex: string, alphaHex: string): string {
    if (!hex || hex[0] !== "#") return hex
    // ya trae alpha (8 dígitos) → lo reemplazamos
    const base = hex.length === 9 ? hex.slice(0, 7) : hex
    return `${base}${alphaHex}`
}

function buildTemaVars(tema: Tema): React.CSSProperties {
    return {
        "--bf-bg": tema.fondo,
        "--bf-text": tema.texto,
        "--bf-text-muted": withAlpha(tema.texto, "99"), // ~60%
        "--bf-text-faint": withAlpha(tema.texto, "66"), // ~40%
        "--bf-border": withAlpha(tema.texto, "1f"), // ~12%
        "--bf-border-strong": withAlpha(tema.texto, "40"), // ~25%
        "--bf-card-bg": `color-mix(in srgb, ${tema.fondo} 97%, ${tema.texto} 3%)`,
        "--bf-panel-bg": `color-mix(in srgb, ${tema.fondo} 94%, ${tema.texto} 6%)`,
        "--bf-input-bg": `color-mix(in srgb, ${tema.fondo} 100%, white 0%)`,
    } as React.CSSProperties
}

const shimmerCSS = `
@keyframes bf-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.bf-shimmer {
    background: linear-gradient(90deg, color-mix(in srgb, var(--bf-bg, #F9FAFB) 85%, var(--bf-text, #111827) 15%) 25%, color-mix(in srgb, var(--bf-bg, #F9FAFB) 75%, var(--bf-text, #111827) 25%) 50%, color-mix(in srgb, var(--bf-bg, #F9FAFB) 85%, var(--bf-text, #111827) 15%) 75%);
    background-size: 200% 100%;
    animation: bf-shimmer 1.4s infinite;
}
.bf-extras-row::-webkit-scrollbar { display: none; }

* { box-sizing: border-box; }

.bf-flag-emoji {
    display: inline-block;
    width: 20px;
    height: 14px;
    border-radius: 2px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
}
.bf-flag-code {
    display: inline;
    font-weight: 700;
    letter-spacing: 0.02em;
}

/* FIX-SCROLL: listas que pueden crecer sin límite (muchos
   servicios, muchos profesionales, muchos horarios) reciben un
   alto máximo + scroll vertical propio, en vez de empujar el
   layout hacia abajo indefinidamente. Scrollbar finita y con los
   colores del tema del negocio (no gris fijo), visible solo si
   hace falta. */
.bf-scroll-list {
    scrollbar-width: thin;
    scrollbar-color: var(--bf-border-strong) transparent;
}
.bf-scroll-list::-webkit-scrollbar {
    width: 6px;
}
.bf-scroll-list::-webkit-scrollbar-track {
    background: transparent;
}
.bf-scroll-list::-webkit-scrollbar-thumb {
    background-color: var(--bf-border-strong);
    border-radius: 999px;
}


@media (min-width: 861px) {
    .bf-catalog-shell {max-width:800px!important;padding:0 32px!important}
    .bf-professionals-grid {display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px!important;max-height:none!important;overflow:visible!important;padding-right:0!important;margin-right:0!important}
    .bf-services-grid {grid-template-columns:repeat(3,minmax(0,1fr))!important;column-gap:22px!important;row-gap:26px!important}
    .bf-days-block {max-width:720px!important}
    .bf-days-grid {grid-template-columns:repeat(5,minmax(0,1fr))!important}
    .bf-days-grid > button {min-height:80px;padding:14px 16px!important}
    .bf-days-grid > button > span:first-child {font-size:20px!important}
    .bf-combos-desktop-stage {max-width:1080px;margin:0 auto;gap:24px;padding:24px 20px!important;align-items:center!important}
    .bf-combos-desktop-stage > .bf-catalog-shell {order:1;flex:0 1 800px;margin:0!important;padding:0 18px!important;min-width:0}
    .bf-combos-desktop-menu {order:2;flex:0 0 220px;min-width:0}
    .bf-times-grid {grid-template-columns:repeat(4,minmax(0,1fr))!important}
    .bf-extras-desktop-wrap {max-width:100%!important;overflow:visible!important;mask-image:none!important;-webkit-mask-image:none!important}
    .bf-extras-desktop-wrap .bf-extras-row {flex-wrap:wrap;gap:12px!important;justify-content:flex-start!important;width:100%!important;transform:none!important}
}

.bf-checkout-shell {
    width: 100%;
    max-width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: stretch;
    overflow-x: hidden;
}
.bf-checkout-left {
    flex: 0 0 50%;
    width: 50%;
    display: flex;
    justify-content: center;
    padding: 56px 40px;
    box-sizing: border-box;
    min-width: 0;
    max-width: 50%;
}
.bf-checkout-left-inner {
    width: 100%;
    max-width: 460px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.bf-checkout-right {
    flex: 0 0 33%;
    max-width: 420px;
    min-width: 320px;
    background: transparent;
    padding: 56px 40px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 0;
    align-self: flex-start;
}
@media (max-width: 860px) {
    .bf-checkout-shell {
        flex-direction: column;
        min-height: 0;
        width: 100%;
        max-width: 100vw;
        overflow-x: hidden;
    }
    .bf-checkout-left,
    .bf-checkout-right {
        flex-basis: auto;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        position: static;
        padding: 24px 16px;
    }
    .bf-checkout-left-inner {
        max-width: 100%;
    }
}

.bf-row-2 {
    display: flex;
    gap: 10px;
    width: 100%;
    min-width: 0;
}
.bf-row-2 > * {
    flex: 1 1 0%;
    min-width: 0;
}
`

function Skeleton({ h = 52, r = 14 }: { h?: number; r?: number }) {
    return (
        <div
            className="bf-shimmer"
            style={{ width: "100%", height: h, borderRadius: r }}
        />
    )
}

function Reveal({
    visible,
    children,
}: {
    visible: boolean
    children: React.ReactNode
}) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    style={{ width: "100%" }}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function SectionLabel({ text, accent }: { text: string; accent: string }) {
    return (
        <div
            style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--bf-text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
                marginTop: 4,
            }}
        >
            {text}
        </div>
    )
}

function ProgressBar({
    steps,
    stepIndex,
    labels,
    accent,
    onJump,
}: {
    steps: string[]
    stepIndex: number
    labels: Record<string, string>
    accent: string
    onJump: (id: string) => void
}) {
    if (steps.length <= 1) return null
    return (
        <div style={{ width: "100%", minWidth: 0 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 8,
                    gap: 8,
                }}
            >
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--bf-text)",
                        flexShrink: 0,
                    }}
                >
                    Paso {stepIndex + 1} de {steps.length}
                </span>
                <span
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: accent,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {labels[steps[stepIndex]]}
                </span>
            </div>
            <div style={{ display: "flex", gap: 5, width: "100%" }}>
                {steps.map((id, i) => {
                    const done = i < stepIndex
                    const activo = i === stepIndex
                    return (
                        <div
                            key={id}
                            onClick={() => done && onJump(id)}
                            title={labels[id]}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                height: 5,
                                borderRadius: 999,
                                background:
                                    done || activo
                                        ? accent
                                        : "var(--bf-border-strong)",
                                opacity: activo ? 1 : done ? 0.55 : 1,
                                cursor: done ? "pointer" : "default",
                                transition: "background 0.25s ease",
                            }}
                        />
                    )
                })}
            </div>
        </div>
    )
}

function BackLink({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                background: "transparent",
                color: "var(--bf-text-muted)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
                marginBottom: 2,
            }}
        >
            ‹ Volver
        </button>
    )
}

// ────────────────────────────────────────────────────────────
// FillButton — botón con relleno animado (sube desde abajo en
// hover), ripple de click desde el punto exacto tocado, y leve
// scale al presionar. variant="solid" (fondo negro, texto blanco
// en reposo) o "outline" (fondo blanco, borde negro, texto negro
// en reposo — pasa a blanco apenas arranca el relleno).
// ────────────────────────────────────────────────────────────
function FillButton({
    onClick,
    disabled,
    fill,
    children,
    style,
    variant = "solid",
}: {
    onClick?: () => void
    disabled?: boolean
    fill: string
    children: React.ReactNode
    style?: React.CSSProperties
    variant?: "solid" | "outline"
}) {
    const [pressed, setPressed] = React.useState(false)
    const [hovered, setHovered] = React.useState(false)
    const [ripples, setRipples] = React.useState<
        { id: number; x: number; y: number }[]
    >([])
    const filled = !disabled && (hovered || pressed)
    const isOutline = variant === "outline"
    // outline: texto principal sobre fondo del botón en reposo,
    // blanco apenas el relleno de acento empieza a subir (mismo
    // trigger que la capa de relleno, así el texto nunca queda
    // ilegible contra el fondo de acento)
    const textColor = isOutline ? (filled ? "#fff" : "var(--bf-text)") : "#fff"

    function spawnRipple(clientX: number, clientY: number, rect: DOMRect) {
        const id = Date.now() + Math.random()
        const x = clientX - rect.left
        const y = clientY - rect.top
        setRipples((r) => [...r, { id, x, y }])
        // se auto-elimina cuando termina la animación (600ms) para no
        // acumular nodos si el usuario clickea repetido
        window.setTimeout(() => {
            setRipples((r) => r.filter((rp) => rp.id !== id))
        }, 620)
    }

    return (
        <button
            type="button"
            className="rf-fillbtn"
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
                setHovered(false)
                setPressed(false)
            }}
            onMouseDown={(e) => {
                if (disabled) return
                setPressed(true)
                spawnRipple(
                    e.clientX,
                    e.clientY,
                    e.currentTarget.getBoundingClientRect()
                )
            }}
            onMouseUp={() => setPressed(false)}
            onTouchStart={(e) => {
                if (disabled) return
                setPressed(true)
                const t = e.touches[0]
                if (t)
                    spawnRipple(
                        t.clientX,
                        t.clientY,
                        e.currentTarget.getBoundingClientRect()
                    )
            }}
            onTouchEnd={() => setPressed(false)}
            style={{
                position: "relative",
                overflow: "hidden",
                isolation: "isolate",
                boxSizing: "border-box",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 140,
                maxWidth: "100%",
                padding: "10px 5px",
                borderRadius: 5,
                border: isOutline ? "1.5px solid var(--bf-text)" : "none",
                background: isOutline ? "var(--bf-input-bg, #fff)" : "#000",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 400,
                fontSize: 15,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                WebkitTapHighlightColor: "transparent",
                transform: pressed
                    ? "scale(0.97)"
                    : hovered
                      ? "translateY(-1px)"
                      : "translateY(0)",
                boxShadow:
                    hovered && !pressed
                        ? "0 8px 18px rgba(0,0,0,0.22)"
                        : "0 1px 2px rgba(0,0,0,0.08)",
                transition:
                    "transform 0.18s cubic-bezier(0.4,0,0.2,1), box-shadow 0.18s ease",
                ...style,
            }}
        >
            {/* Capa 1: relleno de acento — el "frame" que sube desde
                abajo y cubre todo el fondo del botón en hover */}
            <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ scaleY: filled ? 1 : 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    position: "absolute",
                    inset: 0,
                    background: fill,
                    transformOrigin: "bottom",
                    zIndex: 0,
                }}
            />

            {/* Capa 2: ripples de click — nacen del punto exacto tocado */}
            {ripples.map((r) => (
                <motion.span
                    key={r.id}
                    aria-hidden="true"
                    initial={{
                        width: 0,
                        height: 0,
                        opacity: 0.4,
                        x: r.x,
                        y: r.y,
                    }}
                    animate={{
                        width: 240,
                        height: 240,
                        opacity: 0,
                        x: r.x - 120,
                        y: r.y - 120,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.35)",
                        zIndex: 1,
                        pointerEvents: "none",
                    }}
                />
            ))}

            {/* Capa 3: contenido, siempre arriba de todo */}
            <motion.span
                animate={{ scale: pressed ? 0.97 : 1 }}
                transition={{ duration: 0.12 }}
                style={{
                    position: "relative",
                    zIndex: 2,
                    color: textColor,
                    transition: "color 0.15s ease",
                    whiteSpace: "normal",
                    textAlign: "center",
                }}
            >
                {children}
            </motion.span>
        </button>
    )
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 */
export default function BookingFlow(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        manualSlug = "",
        useNegocioTheme: usarTemaProp,
        accentColor = "#000000",
        placeholderImage,
        placeholderAvatar,
        iconoCualquiera,
        iconoVerCombo,
        habilitarListaEspera = true,
        habilitarFiltroFranja = true,
        franjaCorteManana = 13,
        franjaCorteTarde = 19,
        logoTarjeta,
        logoMercadoPago,
        logoTransferencia,
        logoEfectivo,
        iconoSinPago,
        imagenNoDisponible,
        iconoAdjuntar,
        notaMaxCaracteres = 300,
        notaPlaceholder = "Ej: preferencia de color, alergias, algo que debamos saber antes del turno...",
        habilitarExtras = true,
        tituloExtras = "Sumá algo más a tu turno",
    } = props

    const api = baseUrl.replace(/\/+$/, "")
    const isCanvas = false
    const slug = getSlugFromUrl(manualSlug)

    const [negocio, setNegocio] = React.useState<Negocio | null>(null)
    const [loadingNegocio, setLoadingNegocio] = React.useState(true)
    const [errorNegocio, setErrorNegocio] = React.useState("")

    const [profesionales, setProfesionales] = React.useState<Profesional[]>([])
    const [sucursales,setSucursales]=React.useState<MapBranch[]>([])
    const [sucursalId,setSucursalId]=React.useState('')
    const [loadingProf, setLoadingProf] = React.useState(true)
    const [errorSedes,setErrorSedes]=React.useState("")
    const [equipoId, setEquipoId] = React.useState<string | null>(null)
    const [equipoIdReservado, setEquipoIdReservado] = React.useState<
        string | null
    >(null)

    const [servicios, setServicios] = React.useState<Servicio[]>([])
    const [promociones,setPromociones] = React.useState<BookingPromo[]>([])
    const [promocionId,setPromocionId] = React.useState<string|null>(null)
    const [errorPromos,setErrorPromos] = React.useState("")
    const [loadingPromos,setLoadingPromos] = React.useState(false)
    const [esDesktop,setEsDesktop]=React.useState(false)
    React.useEffect(()=>{const media=window.matchMedia("(min-width: 861px)");const sync=()=>setEsDesktop(media.matches);sync();media.addEventListener("change",sync);return ()=>media.removeEventListener("change",sync)},[])
    const promoElegida = promociones.find(p=>p.id===promocionId) || null
    const descuentoServicio = (id:string) => promociones.filter(p=>p.tipo === "descuento" && p.servicio_id===id && p.precio_final < Number(servicios.find(s=>s.id===id)?.precio || 0)).sort((a,b)=>a.precio_final-b.precio_final)[0]

    const [loadingServicios, setLoadingServicios] = React.useState(false)
    const [errorServicios, setErrorServicios] = React.useState("")
    const [servicioId, setServicioId] = React.useState<string | null>(null)

    const hoyBA = React.useMemo(() => getHoyBA(), [])
    const [verMasDias, setVerMasDias] = React.useState(false)
    const [fecha, setFecha] = React.useState<string>("")
    const promoParaFecha = (dia:string) => promoElegida?.tipo === "combo" ? (promoAppliesOn(promoElegida,dia) ? promoElegida : null) : promociones.filter(p=>p.tipo === "descuento" && p.servicio_id===servicioId && promoAppliesOn(p,dia) && p.precio_final<Number(servicios.find(s=>s.id===servicioId)?.precio || 0)).sort((a,b)=>a.precio_final-b.precio_final)[0] || null
    const promoAplicada = fecha ? promoParaFecha(fecha) : promoElegida
    const [diasLlenos, setDiasLlenos] = React.useState<string[]>([])
    const [diasSinDisponibilidad, setDiasSinDisponibilidad] = React.useState<
        string[]
    >([])
    const [diasCargando, setDiasCargando] = React.useState<string[]>([])

    const [slots, setSlots] = React.useState<Slot[]>([])
    const [loadingSlots, setLoadingSlots] = React.useState(false)
    const [errorSlots, setErrorSlots] = React.useState("")
    const [hora, setHora] = React.useState<string>("")
    const [puedeAnotarseEspera, setPuedeAnotarseEspera] = React.useState(false)

    const [esperaNombre, setEsperaNombre] = React.useState("")
    const [esperaEmail, setEsperaEmail] = React.useState("")
    const [esperaSubmitting, setEsperaSubmitting] = React.useState(false)
    const [esperaError, setEsperaError] = React.useState<string | null>(null)
    const [esperaSuccess, setEsperaSuccess] = React.useState(false)

    const [nombre, setNombre] = React.useState("")
    const [apellido, setApellido] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [telefono, setTelefono] = React.useState("")
    const [pais, setPais] = React.useState(PAISES[0])
    const [paisDropdownOpen, setPaisDropdownOpen] = React.useState(false)
    const [emailError, setEmailError] = React.useState("")
    const [telError, setTelError] = React.useState("")
    const paisBtnRef = React.useRef<HTMLButtonElement>(null)

    const [nota, setNota] = React.useState("")
    const [notaAbierta, setNotaAbierta] = React.useState(false)
    const [notaBorrador, setNotaBorrador] = React.useState("")

    const [extras, setExtras] = React.useState<Extra[]>([])
    const [loadingExtras, setLoadingExtras] = React.useState(false)
    const [extrasConCantidades,setExtrasConCantidades]=React.useState(false)
    const [extrasSeleccionados, setExtrasSeleccionados] = React.useState<
        ExtraSeleccionado[]
    >([])

    const [tarjetaDisponible,setTarjetaDisponible]=React.useState(false)
    const [cardSession,setCardSession]=React.useState<any>(null)
    React.useEffect(()=>{let active=true;fetch(api+"/api/card-config").then(r=>r.ok?r.json():{enabled:false}).then(d=>{if(active)setTarjetaDisponible(d.enabled===true)}).catch(()=>{});return()=>{active=false}},[api])
    const [metodo, setMetodo] = React.useState<MetodoKey | "">("")
    const [comprobante, setComprobante] = React.useState<File | null>(null)
    const [errorArchivo, setErrorArchivo] = React.useState("")

    const [submitEstado, setSubmitEstado] = React.useState<
        "idle" | "loading" | "error"
    >("idle")
    const [submitError, setSubmitError] = React.useState("")
    const [modalSinPago, setModalSinPago] = React.useState(false)

    const usarTema = usarTemaProp !== false
    const tema: Tema = { ...DEFAULT_TEMA, ...(negocio?.tema || {}) }
    const accent = usarTema ? tema.primario : accentColor
    const waitlistColor = "#F59E0B"
    const temaVars = React.useMemo(() => buildTemaVars(tema), [tema])

    const excepcionesMap = React.useMemo(
        () => normalizarExcepciones(negocio?.excepciones),
        [negocio]
    )

    React.useEffect(() => {
        if (isCanvas) {
            setLoadingNegocio(false)
            return
        }
        if (!slug) {
            setErrorNegocio("No se encontró el negocio.")
            setLoadingNegocio(false)
            return
        }
        let alive = true
        fetch(`${api}/negocio/${slug}`, { cache: "no-store" })
            .then((r) => r.json())
            .then((data) => {
                if (!alive) return
                if (!data.success || !data.negocio) {
                    setErrorNegocio("Negocio no encontrado.")
                    return
                }
                // El backend manda `suspendido` a nivel raíz, no dentro de
                // `negocio`: hay que copiarlo o la pantalla nunca aparece.
                setNegocio({ ...data.negocio, suspendido: !!data.suspendido })
            })
            .catch(
                () =>
                    alive &&
                    setErrorNegocio("Error al conectar con el servidor.")
            )
            .finally(() => alive && setLoadingNegocio(false))
        return () => {
            alive = false
        }
    }, [api, slug, isCanvas])

    // Al elegir un profesional se carga su configuración individual. En modo
    // "cualquiera" se usa la unión de sus días laborales para armar el calendario.
    React.useEffect(() => {
        if (isCanvas || !slug || !equipoId) return
        let alive = true
        fetch(
            `${api}/negocio/${slug}?equipo_id=${encodeURIComponent(equipoId)}`,
            { cache: "no-store" }
        )
            .then((r) => r.json())
            .then((data) => {
                if (alive && data?.success && data.negocio)
                    setNegocio({
                        ...data.negocio,
                        suspendido: !!data.suspendido,
                    })
            })
            .catch(() => {})
        return () => {
            alive = false
        }
    }, [api, slug, equipoId, isCanvas])

    React.useEffect(() => {
        if (isCanvas) return
        function onFocus() {
            if (!slug) return
            const equipoEfectivo =
                equipoId === CUALQUIER_PROFESIONAL
                    ? equipoIdReservado || CUALQUIER_PROFESIONAL
                    : equipoId || equipoIdReservado
            const filtroEquipo = equipoEfectivo
                ? `?equipo_id=${encodeURIComponent(equipoEfectivo)}`
                : ""
            fetch(`${api}/negocio/${slug}${filtroEquipo}`, {
                cache: "no-store",
            })
                .then((r) => r.json())
                .then((data) => {
                    if (data?.success && data.negocio)
                        setNegocio({
                            ...data.negocio,
                            suspendido: !!data.suspendido,
                        })
                })
                .catch(() => {})
        }
        window.addEventListener("focus", onFocus)
        return () => window.removeEventListener("focus", onFocus)
    }, [api, slug, isCanvas, equipoId, equipoIdReservado])

    React.useEffect(() => {
        if (isCanvas || !slug) {
            setLoadingProf(false)
            return
        }
        let alive = true
        Promise.all([
            fetch(`${api}/equipo/${slug}`).then(async r=>{const d=await r.json();if(!r.ok || !d.success || !Array.isArray(d.equipo))throw new Error('equipo');return d}),
            fetch(`${api}/sucursales/${slug}`).then(async r=>{const d=await r.json();if(!r.ok || !d.success || !Array.isArray(d.sucursales))throw new Error('sucursales');return d}),
        ]).then(([data,sedes]) => {
                if (!alive) return
                const lista = data?.success ? data.equipo || [] : []
                setSucursales((sedes.sucursales || []).map((s:MapBranch)=>({...s,sin_equipo:s.id==='principal' && lista.length===0})))
                setSucursalId(sedes.sucursales.length === 1 ? sedes.sucursales[0].id : '')
                setProfesionales(lista)
                if (lista.length === 1 && !sedes.sucursales?.length) setEquipoId(lista[0].id)
            })
            .catch(() => {if(alive){setProfesionales([]);setErrorSedes('No pudimos cargar las sedes y profesionales. Volvé a intentarlo.')}})
            .finally(() => alive && setLoadingProf(false))
        return () => {
            alive = false
        }
    }, [api, slug, isCanvas])

    const profesionalesVisibles=sucursales.length?profesionales.filter(p=>sucursales.find(s=>s.id===sucursalId)?.equipo_ids?.includes(p.id)):profesionales
    const requiereSucursal = sucursales.length > 1
    const requiereProfesional = profesionales.length > 1 || (sucursales.length>0 && profesionales.length>0)
    const listoParaServicios =
        !loadingProf && !errorSedes && (!requiereProfesional || !!equipoId) && (!sucursales.length || !!sucursalId)

    React.useEffect(()=>{
        if(isCanvas || !slug)return
        let alive=true;setLoadingPromos(true);setPromociones([]);setPromocionId(null);setErrorPromos("")
        const equipoFiltro=equipoId && equipoId!==CUALQUIER_PROFESIONAL ? "?equipo_id="+encodeURIComponent(equipoId) : ""
        fetch(api+"/promociones/"+slug+equipoFiltro,{cache:"no-store"}).then(r=>r.json()).then(async data=>{
            if(!data.success)throw new Error(data.error || "No se pudieron cargar las promos.")
            if(!alive)return
            const consultas=new Map<string,Promise<any[]>>()
            const parsed=await Promise.all((data.promociones || []).map(async(p:any)=>{
                const imagenes=[...(p.imagenes || [])]
                const productos=(p.items || []).filter((item:any)=>item.tipo === "producto" && !imagenes.some((image:any)=>image.tipo === "producto" && image.id===item.id && image.url))
                if(productos.length && p.servicio_id){
                    if(!consultas.has(p.servicio_id))consultas.set(p.servicio_id,fetch(api+"/extras/"+encodeURIComponent(p.servicio_id)+equipoFiltro,{cache:"no-store"}).then(r=>r.json()).then(result=>result.success ? result.extras || [] : []).catch(()=>[]))
                    const catalogo=await consultas.get(p.servicio_id)!
                    for(const item of productos){const producto=catalogo.find((extra:any)=>extra.id===item.id);if(producto?.imagen_url)imagenes.push({id:item.id,tipo:"producto",url:producto.imagen_url})}
                }
                return {...p,imagenes,precio_original:Number(p.precio_original),precio_final:Number(p.precio_final)}
            }))
            if(alive)setPromociones(parsed)
        }).catch(e=>{if(alive)setErrorPromos(e.message)}).finally(()=>{if(alive)setLoadingPromos(false)})
        return()=>{alive=false}
    },[api,slug,equipoId,isCanvas])

    React.useEffect(() => {
        if (isCanvas || !listoParaServicios || !slug) return
        let alive = true
        setLoadingServicios(true)
        setErrorServicios("")
        const filtro =
            equipoId && equipoId !== CUALQUIER_PROFESIONAL
                ? `?equipo_id=${encodeURIComponent(equipoId)}`
                : requiereProfesional && equipoId === CUALQUIER_PROFESIONAL
                  ? `?equipo_id=${CUALQUIER_PROFESIONAL}`
                  : ""
        fetch(`${api}/servicios/${slug}${filtro}`)
            .then((r) => r.json())
            .then((data) => {
                if (!alive) return
                if (!data.success) throw new Error()
                const parsed: Servicio[] = (data.servicios || []).map(
                    (s: any) => {
                        const { imagen, descripcion } = parseDesc(
                            s.descripcion || ""
                        )
                        return {
                            ...s,
                            imagen: s.imagen_url || imagen,
                            descripcion,
                        }
                    }
                )
                setServicios(parsed)
            })
            .catch(
                () =>
                    alive &&
                    setErrorServicios("No se pudieron cargar los servicios.")
            )
            .finally(() => alive && setLoadingServicios(false))
        return () => {
            alive = false
        }
    }, [api, slug, listoParaServicios, equipoId, requiereProfesional, isCanvas])

    React.useEffect(() => {
        if (isCanvas || !habilitarExtras || !servicioId) {
            setExtras([])
            return
        }
        let alive = true
        setLoadingExtras(true)
        fetch(`${api}/extras/${servicioId}${equipoId ? `?equipo_id=${encodeURIComponent(equipoId)}` : ""}`)
            .then((r) => r.json())
            .then((data) => {
                if (!alive) return
                setExtras(data?.success ? data.extras || [] : [])
                setExtrasConCantidades(data?.success && data.cantidades_disponibles === true)
            })
            .catch(() => alive && setExtras([]))
            .finally(() => alive && setLoadingExtras(false))
        return () => {
            alive = false
        }
    }, [api, servicioId, equipoId, habilitarExtras, isCanvas])

    // ────────────────────────────────────────────────────────────
    // Días a mostrar en el paso "Elegí el día": los próximos
    // MAX_DIAS_VISIBLES días reservables (desde hoy), salteando
    // los no laborables y los bloqueados por excepción. Se busca
    // hasta 90 días hacia adelante para cruzar de mes sin problema.
    // ────────────────────────────────────────────────────────────
    const diasTodos = React.useMemo(() => {
        if (!negocio) return [] as string[]
        const lista: string[] = []
        for (let i = 0; i < 90 && lista.length < MAX_DIAS_EXPANDIDO; i++) {
            const dateObj = new Date(
                hoyBA.getFullYear(),
                hoyBA.getMonth(),
                hoyBA.getDate() + i
            )
            dateObj.setHours(0, 0, 0, 0)
            const iso = toISO(
                dateObj.getFullYear(),
                dateObj.getMonth(),
                dateObj.getDate()
            )
            const excInfo = excepcionesMap[iso]
            if (excInfo?.type === "block") continue
            const esCustomConSlots =
                excInfo?.type === "custom" && (excInfo.slots?.length ?? 0) > 0
            const diaNombre = DIAS[dateObj.getDay()]
            if (!esCustomConSlots && !negocio.horarios?.[diaNombre]?.activo)
                continue
            // Filter before the display limit so weekly combos can reach later weeks.
            if (promoElegida?.tipo === "combo" && !promoAppliesOn(promoElegida,iso)) continue
            lista.push(iso)
        }
        return lista
    }, [negocio, excepcionesMap, hoyBA, promoElegida])

    const diasParaSeleccion = React.useMemo(() => diasTodos.filter(f => promoElegida?.tipo !== "combo" || promoAppliesOn(promoElegida,f)), [diasTodos,promoElegida])
    const hayMasDias = diasParaSeleccion.slice(MAX_DIAS_VISIBLES).some(f => !diasSinDisponibilidad.includes(f))
    const diasCandidatos = React.useMemo(
        () => (verMasDias ? diasParaSeleccion : diasParaSeleccion.slice(0, MAX_DIAS_VISIBLES)),
        [diasParaSeleccion, verMasDias]
    )
    // Oculta únicamente las fechas ya consultadas que no tengan horarios
    // reservables. Las fechas completas siguen visibles si admiten lista de espera.
    const diasDisponibles = React.useMemo(
        () => diasCandidatos.filter((f) => !diasSinDisponibilidad.includes(f)),
        [diasCandidatos, diasSinDisponibilidad, promoElegida]
    )

    // Cada fecha se consulta en paralelo y se marca "llena" apenas responde
    // su propio fetch. Al tocar "Ver más días" solo se consultan las fechas
    // nuevas (las que ya se consultaron no se vuelven a pedir ni parpadean).
    const consultadosRef = React.useRef<{ clave: string; fechas: Set<string> }>(
        { clave: "", fechas: new Set() }
    )

    React.useEffect(() => {
        if (isCanvas || !negocio || !slug || !servicioId) return

        const clave = `${slug}|${servicioId}|${equipoId || "negocio"}|${promocionId || ""}`
        if (consultadosRef.current.clave !== clave) {
            consultadosRef.current = { clave, fechas: new Set() }
            setDiasLlenos([])
            setDiasSinDisponibilidad([])
            setDiasCargando([])
        }
        const vigente = () => consultadosRef.current.clave === clave

        const nuevos = diasCandidatos.filter(
            (f) => !consultadosRef.current.fechas.has(f)
        )
        if (nuevos.length === 0) return
        nuevos.forEach((f) => consultadosRef.current.fechas.add(f))
        setDiasCargando((prev) => [
            ...prev,
            ...nuevos.filter((f) => !prev.includes(f)),
        ])

        nuevos.forEach((f) => {
            ;(async () => {
                try {
                    const equipoFiltro = equipoId
                        ? `&equipo_id=${encodeURIComponent(equipoId)}`
                        : ""
                    const promoDia=promoParaFecha(f)
                    const url = `${api}/slots-disponibles/${slug}?fecha=${f}&servicio_id=${servicioId}${equipoFiltro}${promoDia ? "&promocion_id="+encodeURIComponent(promoDia.id) : ""}`
                    const res = await fetch(url)
                    const data = await res.json()
                    if (!vigente()) return
                    if (data.success) {
                        const hay = (data.slots || []).some(
                            (s: any) => !s.lleno && s.disponibles > 0
                        )
                        // Si la fecha es hoy, sólo vale la pena marcarla como
                        // "llena, anotate en lista de espera" cuando todavía
                        // queda algún horario programado más tarde (aunque
                        // esté ocupado). Si ya no queda ninguno, es porque
                        // el local ya cerró por hoy: no tiene sentido ofrecer
                        // lista de espera para horarios que no van a existir.
                        const esHoyF = f === getHoyBAISO()
                        const minutosAhoraF = esHoyF ? getMinutosAhoraBA() : -1
                        const hayRestanteF =
                            !esHoyF ||
                            (data.slots || []).some((s: any) => {
                                const [h, m] = s.hora.split(":").map(Number)
                                return h * 60 + m > minutosAhoraF
                            })
                        if (
                            !hay &&
                            habilitarListaEspera &&
                            data.puede_anotarse_espera &&
                            hayRestanteF
                        ) {
                            setDiasLlenos((prev) =>
                                prev.includes(f) ? prev : [...prev, f]
                            )
                            setDiasSinDisponibilidad((prev) =>
                                prev.filter((d) => d !== f)
                            )
                        } else if (!hay) {
                            setDiasSinDisponibilidad((prev) =>
                                prev.includes(f) ? prev : [...prev, f]
                            )
                            setDiasLlenos((prev) => prev.filter((d) => d !== f))
                        } else {
                            setDiasSinDisponibilidad((prev) =>
                                prev.filter((d) => d !== f)
                            )
                            setDiasLlenos((prev) => prev.filter((d) => d !== f))
                        }
                    }
                } catch {
                    // silencioso: si falla un día puntual, no bloquea al resto
                } finally {
                    if (vigente()) {
                        setDiasCargando((prev) => prev.filter((d) => d !== f))
                    }
                }
            })()
        })
    }, [
        diasCandidatos,
        negocio,
        slug,
        servicioId,
        equipoId,
        api,
        isCanvas,
        habilitarListaEspera,
        promocionId,
    ])

    React.useEffect(() => {
        if (!fecha || !slug) {
            setSlots([])
            setPuedeAnotarseEspera(false)
            return
        }
        let alive = true
        setLoadingSlots(true)
        setErrorSlots("")
        setHora("")
        setEsperaSuccess(false)
        setEsperaError(null)

        let url = `${api}/slots-disponibles/${slug}?fecha=${fecha}`
        if (servicioId) url += `&servicio_id=${servicioId}`
        if (promoAplicada) url += `&promocion_id=${encodeURIComponent(promoAplicada.id)}`
        if (equipoId) url += `&equipo_id=${encodeURIComponent(equipoId)}`

        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (!alive) return
                if (data?.success) {
                    setSlots(data.slots || [])
                    setPuedeAnotarseEspera(
                        habilitarListaEspera &&
                            data.puede_anotarse_espera === true
                    )
                } else {
                    setErrorSlots(
                        data?.error || "No se pudieron cargar los horarios."
                    )
                    setSlots([])
                }
            })
            .catch(
                () =>
                    alive && setErrorSlots("Error al conectar con el servidor.")
            )
            .finally(() => alive && setLoadingSlots(false))

        return () => {
            alive = false
        }
    }, [fecha, servicioId, slug, api, equipoId, habilitarListaEspera, promocionId, promoAplicada?.id])

    const slotsDisponibles = React.useMemo(() => {
        const hoy = getHoyBAISO()
        const esHoy = fecha === hoy
        const minutosAhora = esHoy ? getMinutosAhoraBA() : -1
        return slots.filter((s) => {
            if (s.lleno) return false
            if (!esHoy) return true
            const [h, m] = s.hora.split(":").map(Number)
            return h * 60 + m > minutosAhora
        })
    }, [slots, fecha])

    // Si es hoy, sólo tiene sentido ofrecer lista de espera cuando todavía
    // quedan horarios programados más tarde (aunque estén llenos). Si el
    // local ya cerró por hoy (no queda ningún slot con hora futura), no
    // corresponde anotarse en lista de espera para el día de hoy.
    const hayHorarioRestanteHoy = React.useMemo(() => {
        const hoy = getHoyBAISO()
        if (fecha !== hoy) return true
        const minutosAhora = getMinutosAhoraBA()
        return slots.some((s) => {
            const [h, m] = s.hora.split(":").map(Number)
            return h * 60 + m > minutosAhora
        })
    }, [slots, fecha])

    // Horarios agrupados por franja (Mañana / Tarde / Noche). Solo se
    // incluyen las franjas que tienen al menos un turno libre.
    const franjaGrupos = React.useMemo(() => {
        const porFranja: Record<string, Slot[]> = {
            manana: [],
            tarde: [],
            noche: [],
        }
        for (const s of slotsDisponibles) {
            porFranja[
                getFranjaDeSlot(s.hora, franjaCorteManana, franjaCorteTarde)
            ].push(s)
        }
        return (["manana", "tarde", "noche"] as const)
            .filter((id) => porFranja[id].length > 0)
            .map((id) => ({ id, slots: porFranja[id] }))
    }, [slotsDisponibles, franjaCorteManana, franjaCorteTarde])

    const servicioBase = servicios.find((s) => s.id === servicioId) || null
    const servicioElegido = servicioBase && promoAplicada ? {...servicioBase,nombre:promoAplicada.tipo === "combo" ? promoAplicada.nombre : servicioBase.nombre,precio:promoAplicada.precio_final,duracion:promoAplicada.duracion} : servicioBase
    const esCualquierProfesional = equipoId === CUALQUIER_PROFESIONAL
    const profesionalElegido = esCualquierProfesional
        ? null
        : profesionales.find((p) => p.id === equipoId) || null
    // Si el cliente eligió "cualquiera", no mandamos equipo_id al backend:
    // el turno queda sin profesional asignado (igual que un negocio sin equipo).
    const equipoIdParaEnviar = esCualquierProfesional
        ? equipoIdReservado || undefined
        : equipoId || undefined

    function toggleExtra(extra: Extra) {
        setExtrasSeleccionados((prev) => {
            const yaEsta = prev.some((s) => s.id === extra.id)
            if (yaEsta) return prev.filter((s) => s.id !== extra.id)
            return [
                ...prev,
                {
                    id: extra.id,
                    cantidad: 1,
                    nombre: extra.nombre,
                    precio: Number(extra.precio) || 0,
                    imagen_url: extra.imagen_url || null,
                },
            ]
        })
    }
    function cambiarCantidadExtra(extra: Extra, cambio: number) {
        setExtrasSeleccionados(prev => prev.flatMap(item => {
            if(item.id !== extra.id)return [item]
            const cantidad=Math.max(0,Math.min(99,item.cantidad+cambio))
            return cantidad ? [{...item,cantidad}] : []
        }))
    }
    const totalExtras = React.useMemo(
        () => extrasSeleccionados.reduce((acc, e) => acc + e.precio * e.cantidad, 0),
        [extrasSeleccionados]
    )

    const metodoPagoRequerido = React.useMemo(() => {
        if (!negocio) return false
        if (negocio.agenda_sin_pagos) return false
        if (negocio.plan === "gratis" && !negocio.tiene_mp) return false
        return (negocio.metodos_pago_disponibles || []).length > 0
    }, [negocio])

    const metodosDisponibles = React.useMemo(() => {
        if (!negocio) return []
        const disp = negocio.metodos_pago_disponibles || []
        const out: {
            key: MetodoKey
            emoji: string
            label: string
            detalle: string
        }[] = []
        if (disp.includes("mercadopago")) {
            if(tarjetaDisponible)out.push({key:"tarjeta",emoji:"💳",label:"Tarjeta de crédito o débito",detalle:"Pagá acá, procesado por Mercado Pago"})
            out.push({
                key: "mercadopago",
                emoji: "💳",
                label: "Mercado Pago",
                detalle:
                    negocio.metodo_pago === "sena"
                        ? `Seña del ${negocio.porcentaje_sena || 30}%. Tarjetas aceptadas y dinero en cuenta de Mercado Pago`
                        : "Tarjetas aceptadas y dinero en cuenta de Mercado Pago",
            })
        }
        if (negocio.plan !== "gratis" && disp.includes("transferencia")) {
            out.push({
                key: "transferencia",
                emoji: "🏦",
                label: "Transferencia bancaria",
                detalle: "Adjuntás el comprobante para reservar",
            })
        }
        if (negocio.plan !== "gratis" && disp.includes("efectivo")) {
            out.push({
                key: "efectivo",
                emoji: "💵",
                label: "Efectivo",
                detalle: "Pagás en el local al momento del turno",
            })
        }
        return out
    }, [negocio, tarjetaDisponible])

    React.useEffect(() => {
        if (!negocio) return
        if (metodosDisponibles.length === 1) {
            setMetodo(metodosDisponibles[0].key)
            return
        }
        if (metodo && !metodosDisponibles.some((m) => m.key === metodo)) {
            setMetodo("")
            setComprobante(null)
        }
    }, [metodosDisponibles, negocio])

    const telefonoDigits = telefono.replace(/[^0-9]/g, "")
    const datosPersonalesOk =
        nombre.trim().length >= 2 &&
        apellido.trim().length >= 2 &&
        EMAIL_REGEX.test(email.trim()) &&
        telefonoDigits.length >= MIN_DIGITOS_TEL &&
        !emailError &&
        !telError

    const datosPersonalesOkParaBoton =
        nombre.trim().length >= 2 &&
        EMAIL_REGEX.test(email.trim()) &&
        telefonoDigits.length >= MIN_DIGITOS_TEL &&
        !emailError &&
        !telError

    const metodoPagoValido = React.useMemo(() => {
        if (!metodoPagoRequerido) return true
        if (!metodo) return false
        if (metodo === "transferencia" && !comprobante) return false
        return true
    }, [metodoPagoRequerido, metodo, comprobante])

    const puedeConfirmar =
        !!fecha && !!hora && datosPersonalesOkParaBoton && metodoPagoValido

    const STEP_LABELS: Record<string, string> = {
        sucursal: "Sucursal",
        profesional: "Profesional",
        servicio: "Servicio",
        fecha: "Fecha",
        hora: "Horario",
        checkout: "Confirmar",
    }

    const steps = React.useMemo(() => {
        const s: string[] = []
        if (requiereSucursal) s.push("sucursal")
        if (requiereProfesional) s.push("profesional")
        s.push("servicio")
        s.push("fecha")
        s.push("hora")
        s.push("checkout")
        return s
    }, [requiereProfesional,requiereSucursal])

    const [stepId, setStepId] = React.useState("")

    React.useEffect(() => {
        if (loadingProf) return
        if (!stepId && steps.length > 0) setStepId(steps[0])
    }, [steps, stepId, loadingProf])

    const stepIndex = Math.max(0, steps.indexOf(stepId))
    const enCheckoutStep = stepId === "checkout"

    // Al pasar a un paso nuevo (adelante o atrás) la vista vuelve arriba de
    // todo, así en los pasos largos el usuario no queda abajo ni se pierde.
    // No se dispara con la carga inicial (stepId pasa de "" al primer paso).
    const rootRef = React.useRef<HTMLDivElement>(null)
    const stepPrevRef = React.useRef("")
    React.useEffect(() => {
        const prev = stepPrevRef.current
        stepPrevRef.current = stepId
        if (!prev || !stepId || prev === stepId) return
        if (isCanvas || typeof window === "undefined") return
        // Contenedores con scroll propio (p. ej. un frame de Framer con overflow)
        let node = rootRef.current?.parentElement || null
        while (
            node &&
            node !== document.body &&
            node !== document.documentElement
        ) {
            const overflowY = window.getComputedStyle(node).overflowY
            if (
                (overflowY === "auto" || overflowY === "scroll") &&
                node.scrollHeight > node.clientHeight
            ) {
                node.scrollTop = 0
            }
            node = node.parentElement
        }
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "instant" as ScrollBehavior,
        })
    }, [stepId])

    function irAPaso(id: string) {
        setStepId(id)
    }
    function irSiguientePaso() {
        const next = steps[stepIndex + 1]
        if (next) setStepId(next)
    }
    function volverPaso() {
        const prev = steps[stepIndex - 1]
        if (prev) setStepId(prev)
    }

    function elegirSucursal(id:string) {
        if(id===sucursalId)return
        setSucursalId(id);setEquipoId(null);setEquipoIdReservado(null);setServicioId(null);setPromocionId(null);setExtrasSeleccionados([]);setFecha('');setHora('');setServicios([])
    }
    function elegirProfesional(p: Profesional) {
        setEquipoId(p.id)
        setEquipoIdReservado(null)
        setPromocionId(null)
        setServicioId(null)
        setFecha("")
        setHora("")
        setExtrasSeleccionados([])
        irSiguientePaso()
    }
    async function elegirCualquierProfesional() {
        if (!profesionales.length) return
        // "Cualquiera" es una asignación aleatoria inmediata. Así el cliente
        // ve desde los servicios el precio y los horarios del mismo profesional
        // que quedará asignado al turno.
        const elegido =
            profesionales[Math.floor(Math.random() * profesionales.length)]
        elegirProfesional(elegido)
    }
    function cambiarProfesional() {
        setEquipoId(null)
        setEquipoIdReservado(null)
        setPromocionId(null)
        setServicioId(null)
        setFecha("")
        setHora("")
        setServicios([])
        setExtrasSeleccionados([])
        irAPaso("profesional")
    }
    function elegirPromo(p:BookingPromo) {
        setPromocionId(p.id);setServicioId(p.servicio_id);setExtrasSeleccionados([]);setFecha("");setHora("");setEquipoIdReservado(null);irSiguientePaso()
    }
    function elegirServicio(svc: Servicio) {
        if(loadingPromos)return
        const nuevo = servicioId === svc.id && promoElegida?.tipo !== "combo" ? null : svc.id
        if (nuevo !== servicioId) setExtrasSeleccionados([])
        setPromocionId(nuevo ? descuentoServicio(nuevo)?.id || null : null)
        setServicioId(nuevo)
        setFecha("")
        setHora("")
        setEquipoIdReservado(null)
        if (nuevo) irSiguientePaso()
    }
    function elegirFecha(iso: string) {
        setFecha(iso)
        setHora("")
        setEquipoIdReservado(null)
        irSiguientePaso()
    }
    async function elegirHora(h: string, staffId?: string | null) {
        setHora(h)
        const slotSeleccionado = slots.find((slot) => slot.hora === h)
        const equipoAsignado = esCualquierProfesional
            ? staffId || slotSeleccionado?.equipo_id || null
            : equipoId
        setEquipoIdReservado(equipoAsignado)
        if (equipoAsignado) {
            const [negocioData, serviciosData] = await Promise.all([
                fetch(
                    `${api}/negocio/${slug}?equipo_id=${encodeURIComponent(equipoAsignado)}`,
                    { cache: "no-store" }
                )
                    .then((r) => r.json())
                    .catch(() => null),
                fetch(
                    `${api}/servicios/${slug}?equipo_id=${encodeURIComponent(equipoAsignado)}`,
                    { cache: "no-store" }
                )
                    .then((r) => r.json())
                    .catch(() => null),
            ])
            if (negocioData?.success && negocioData.negocio)
                setNegocio({
                    ...negocioData.negocio,
                    suspendido: !!negocioData.suspendido,
                })
            if (serviciosData?.success && servicioId) {
                const variante = (serviciosData.servicios || []).find(
                    (s: any) => s.id === servicioId
                )
                if (variante)
                    setServicios((prev) =>
                        prev.map((s) =>
                            s.id === servicioId
                                ? {
                                      ...s,
                                      precio: Number(
                                          variante.precio ?? s.precio
                                      ),
                                      imagen: variante.imagen_url || s.imagen,
                                  }
                                : s
                        )
                    )
            }
        }
        irSiguientePaso()
    }

    async function enviarListaEspera() {
        setEsperaError(null)
        const n = esperaNombre.trim()
        if (!n) return setEsperaError("Ingresá tu nombre.")
        if (!EMAIL_REGEX.test(esperaEmail.trim()))
            return setEsperaError("Ingresá un email válido.")

        setEsperaSubmitting(true)
        try {
            const res = await fetch(`${api}/turnos/lista-espera`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug,
                    fecha,
                    servicio_id: servicioId || undefined,
                    nombre: n,
                    email: esperaEmail.trim(),
                    canal_aviso: "email",
                }),
            })
            const data = await res.json()
            if (data.success) setEsperaSuccess(true)
            else
                setEsperaError(
                    data.error || "No se pudo completar la inscripción."
                )
        } catch {
            setEsperaError("Error al conectar con el servidor.")
        } finally {
            setEsperaSubmitting(false)
        }
    }

    async function checkDuplicado(tipo: "email" | "tel", valor: string) {
        if (!slug || !valor) return
        const body: any = { slug }
        if (tipo === "email") body.checkout_email = valor.trim().toLowerCase()
        if (tipo === "tel") body.checkout_telefono = valor
        try {
            const res = await fetch(`${api}/turnos/check-cliente`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (data.existe) {
                if (tipo === "email")
                    setEmailError("Este email ya tiene un turno activo.")
                else setTelError("Este número ya tiene un turno activo.")
            }
        } catch {
            // silencioso, no bloquea si falla la red
        }
    }

    function onBlurEmail() {
        if (!email) return
        if (!email.includes("@")) {
            setEmailError("El email debe contener un @.")
            return
        }
        setEmailError("")
        checkDuplicado("email", email)
    }
    function onBlurTelefono() {
        if (!telefono) return
        if (telefonoDigits.length < MIN_DIGITOS_TEL) {
            setTelError(
                `El teléfono debe tener al menos ${MIN_DIGITOS_TEL} números.`
            )
            return
        }
        setTelError("")
        checkDuplicado("tel", `${pais.dial}${telefonoDigits}`)
    }

    function manejarArchivo(file: File | null) {
        if (!file) return
        if (!TIPOS_ACEPTADOS.includes(file.type)) {
            setErrorArchivo("Formato no permitido. Usá JPG, PNG o WEBP.")
            return
        }
        if (file.size > MAX_BYTES) {
            setErrorArchivo("El archivo pesa más de 3MB.")
            return
        }
        setErrorArchivo("")
        setComprobante(file)
    }

    async function confirmarReserva() {
        if (submitEstado === "loading") return
        setSubmitError("")

        if (!fecha) return setSubmitError("Seleccioná una fecha.")
        if (!hora) return setSubmitError("Seleccioná un horario.")
        if (!nombre.trim() || nombre.trim().length < 2)
            return setSubmitError("El nombre es requerido (mín. 2 caracteres).")
        if (telefonoDigits.length < MIN_DIGITOS_TEL)
            return setSubmitError(
                `El teléfono es requerido (mín. ${MIN_DIGITOS_TEL} dígitos).`
            )
        if (email && !EMAIL_REGEX.test(email.trim()))
            return setSubmitError("El email ingresado no es válido.")
        if (metodoPagoRequerido && !metodo)
            return setSubmitError("Elegí un método de pago para continuar.")
        if (metodo === "transferencia" && !comprobante)
            return setSubmitError("Adjuntá el comprobante de la transferencia.")
        if (!slug)
            return setSubmitError(
                "No se detectó el negocio (falta el slug en la URL /agenda/slug o el slug manual)."
            )

        setSubmitEstado("loading")

        if(extrasSeleccionados.some(e=>e.cantidad>1) && !extrasConCantidades){
            setSubmitEstado("error")
            setSubmitError("Las compras de varias unidades todavía no están disponibles. Intentá nuevamente más tarde.")
            return
        }
        const extraIds = extrasSeleccionados.map((e) => e.id)
        const extraCantidades = Object.fromEntries(extrasSeleccionados.map(e=>[e.id,e.cantidad]))
        const telefonoCompleto = `${pais.dial}${telefonoDigits}`
        const nombreTrim = nombre.trim()
        const apellidoTrim = apellido.trim() || null
        const emailTrim = email.trim() || null

        try {
            if (!metodo) {
                if (negocio?.suspendido) {
                    throw new Error(
                        "Este servicio está pausado temporalmente. Contactá al negocio."
                    )
                }
                if (negocio?.plan === "gratis" && !negocio?.tiene_mp) {
                    setSubmitEstado("idle")
                    setModalSinPago(true)
                    return
                }
                const res = await fetch(`${api}/turnos/reservar`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: nombreTrim,
                        apellido: apellidoTrim,
                        phone: telefonoCompleto,
                        email: emailTrim,
                        fecha,
                        hora,
                        slug,
                        servicio_id: servicioId || undefined,
                        promocion_id: promoAplicada?.id,
                        promocion_precio: promoAplicada?.precio_final,
                        extra_ids: extraIds,
                        extra_cantidades: extraCantidades,
                        equipo_id: equipoIdParaEnviar,
                    }),
                })
                const data = await res.json().catch(() => ({}))
                if (res.ok && data.success) {
                    window.location.href =
                        data.comprobante_url ||
                        `${SUCCESS_URL}?slug=${slug}&turno_id=${data.turno_id}`
                    return
                }
                if (data.error === "free_no_payment_method") {
                    setSubmitEstado("idle")
                    setModalSinPago(true)
                    return
                }
                throw new Error(
                    data.error ||
                        `Error al crear el turno (status ${res.status}).`
                )
            }

            if (metodo === "mercadopago" || metodo === "tarjeta") {
                const res = await fetch(`${api}/api/create-preference`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        card_checkout: metodo === "tarjeta",
                        nombre: nombreTrim,
                        apellido: apellidoTrim,
                        telefono: telefonoCompleto,
                        email: emailTrim,
                        fecha,
                        hora,
                        slug,
                        servicio_id: servicioId || undefined,
                        promocion_id: promoAplicada?.id,
                        promocion_precio: promoAplicada?.precio_final,
                        extra_ids: extraIds,
                        extra_cantidades: extraCantidades,
                        equipo_id: equipoIdParaEnviar,
                    }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok)
                    throw new Error(
                        data.error ||
                            `No se pudo generar el enlace de pago (status ${res.status}).`
                    )
                if(data.card_checkout && metodo === "tarjeta") {
                    setCardSession({...data,email:emailTrim || ""})
                    setSubmitEstado("idle")
                    return
                }
                if (data.payment_url) {
                    window.location.href = data.payment_url
                    return
                }
                if (data.isFree) {
                    setMetodo("")
                    await confirmarReserva()
                    return
                }
                throw new Error("No se recibió el enlace de pago.")
            }

            const form = new FormData()
            form.append("name", nombreTrim)
            form.append("apellido", apellidoTrim || "")
            form.append("phone", telefonoCompleto)
            if (emailTrim) form.append("email", emailTrim)
            form.append("fecha", fecha)
            form.append("hora", hora)
            form.append("slug", slug)
            if(promoAplicada){form.append("promocion_id",promoAplicada.id);form.append("promocion_precio",String(promoAplicada.precio_final))}
            form.append("metodo_pago", metodo)
            if (servicioId) form.append("servicio_id", servicioId)
            if (equipoIdParaEnviar) form.append("equipo_id", equipoIdParaEnviar)
            if (nota.trim()) form.append("nota", nota.trim())
            if (extraIds.length)
                form.append("extra_ids", JSON.stringify(extraIds))
            form.append("extra_cantidades", JSON.stringify(extraCantidades))
            if (metodo === "transferencia") {
                if (!comprobante)
                    throw new Error(
                        "Adjuntá el comprobante de la transferencia."
                    )
                form.append("comprobante", comprobante)
            }
            const res = await fetch(`${api}/turnos/reservar-manual`, {
                method: "POST",
                body: form,
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success)
                throw new Error(
                    data.error ||
                        `No se pudo crear la reserva (status ${res.status}).`
                )
            window.location.href = `${PENDIENTE_URL}?slug=${slug}&turno_id=${data.turno_id}&pendiente=true`
        } catch (err: any) {
            console.error("❌ Error en reserva:", err?.message, {
                slug,
                api,
                metodo,
                nombreTrim,
                telefonoCompleto,
            })
            setSubmitEstado("error")
            setSubmitError(
                err?.message ||
                    "Ocurrió un error de red o de conexión con el servidor."
            )
        }
    }

    const esSena =
        negocio?.metodo_pago === "sena" &&
        !!servicioElegido &&
        metodo !== "efectivo"
    const totalServicioYExtras =
        (servicioElegido?.precio ?? 0) + totalExtras || null
    const montoASenar =
        esSena && servicioElegido
            ? Math.round(
                  ((servicioElegido.precio + totalExtras) *
                      (negocio!.porcentaje_sena || 30)) /
                      100
              )
            : null
    const totalAPagarAhora = esSena
        ? (montoASenar ?? 0)
        : (servicioElegido?.precio ?? 0) + totalExtras
    const totalAMostrar = servicioElegido ? totalAPagarAhora : null
    const totalPendiente =
        esSena && totalServicioYExtras != null
            ? Math.max(totalServicioYExtras - totalAPagarAhora, 0)
            : null

    // Sin extras cargados (o el toggle está apagado): centramos
    // verticalmente la columna de datos personales para que no
    // quede pegada arriba con espacio vacío debajo.
    const sinExtras =
        !habilitarExtras || (!loadingExtras && extras.length === 0)

    function nombreProfesionalTexto(p: Profesional) {
        return `${p.nombre}${p.apellido ? " " + p.apellido : ""}`
    }

    if (isCanvas) {
        return (
            <div style={{ ...wrapperStyle, ...temaVars, padding: 24 }}>
                <div
                    style={{
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: 20,
                        marginBottom: 16,
                        color: "var(--bf-text)",
                    }}
                >
                    Reservar turno
                </div>
                <Skeleton h={200} />
            </div>
        )
    }

    if (loadingNegocio) {
        return (
            <div style={{ ...wrapperStyle, ...temaVars }}>
                <style>{shimmerCSS + "\n.bf-full-viewport{min-height:100vh;min-height:100dvh;box-sizing:border-box;}"}</style>
                <Skeleton h={64} r={16} />
                <Skeleton h={52} />
                <Skeleton h={52} />
                <Skeleton h={52} />
            </div>
        )
    }
    if (errorNegocio || !negocio) {
        return (
            <div style={statusStyle}>
                {errorNegocio || "No se encontró el negocio."}
            </div>
        )
    }
    if(errorSedes)return <div style={{...wrapperStyle,...temaVars,gap:16}}><p role="alert">{errorSedes}</p><button type="button" onClick={()=>window.location.reload()} style={{background:accent,color:'#fff',border:0,borderRadius:10,padding:'12px 18px',cursor:'pointer',fontFamily:'inherit'}}>Volver a cargar</button></div>
    // Plan vencido o deuda de comisiones: el backend responde suspendido:true
    // (sin distinguir el motivo hacia el cliente final).
    if (negocio.suspendido) {
        return (
            <div
                style={{
                    ...wrapperStyle,
                    ...temaVars,
                    maxWidth: 720,
                    minHeight: "70vh",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    textAlign: "center",
                    gap: 12,
                    padding: "72px 24px 48px",
                }}
            >
                <h1
                    style={{
                        margin: 0,
                        fontFamily: "'Inter Display', 'Inter', sans-serif",
                        fontSize: "clamp(30px, 6vw, 44px)",
                        fontWeight: 500,
                        letterSpacing: "-0.03em",
                        lineHeight: 1.1,
                        color: "var(--bf-text, #111827)",
                    }}
                >
                    Esta agenda no se encuentra disponible por ahora
                </h1>
                <p
                    style={{
                        margin: 0,
                        fontFamily: "'Inter Display', 'Inter', sans-serif",
                        fontSize: 16,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.4,
                        color: "var(--bf-text-muted, #6B7280)",
                    }}
                >
                    Volvé a intentarlo más tarde.
                </p>
                {imagenNoDisponible && (
                    <img
                        src={imagenNoDisponible}
                        alt=""
                        style={{
                            width: "100%",
                            maxWidth: 480,
                            height: "auto",
                            objectFit: "contain",
                            marginTop: 36,
                        }}
                    />
                )}
            </div>
        )
    }

    const nombreProfesionalActual = esCualquierProfesional
        ? "Cualquier profesional"
        : profesionalElegido
          ? nombreProfesionalTexto(profesionalElegido)
          : ""

    const mostrarListaEspera =
        !loadingSlots &&
        !errorSlots &&
        slotsDisponibles.length === 0 &&
        puedeAnotarseEspera &&
        hayHorarioRestanteHoy
    const mostrarFiltroFranja =
        habilitarFiltroFranja &&
        !loadingSlots &&
        !errorSlots &&
        !mostrarListaEspera &&
        franjaGrupos.length > 1

    const headerBlock = (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                marginBottom: -6,
            }}
        >
            <LogoBlock negocio={negocio} accent={accent} />
            <h1
                style={{
                    fontFamily: "'Inter Display', serif",
                    fontSize: 28,
                    fontWeight: 400,
                    color: "var(--bf-text)",
                    margin: 0,
                    textAlign: "center",
                }}
            >
                {negocio.business_name}
            </h1>
        </div>
    )

    return (
        <div style={{width:"100%",minHeight:"100dvh",margin:0,boxSizing:"border-box",display:"flex",flexDirection:"column",fontFamily:"'DM Sans', -apple-system, sans-serif",...temaVars}}>
            {!esDesktop && stepId === "servicio" && listoParaServicios && !loadingPromos && <BookingCombosSubheader promociones={promociones.filter(p=>p.tipo === "combo" && servicios.some(s=>s.id===p.servicio_id))} servicios={servicios} accent={accent} icono={iconoVerCombo} onSelect={elegirPromo} />}
        <div className={esDesktop && stepId === "servicio" && listoParaServicios && !loadingPromos && promociones.some(p=>p.tipo === "combo" && servicios.some(s=>s.id===p.servicio_id)) ? "bf-combos-desktop-stage" : undefined} style={{display:"flex",flex:1,width:"100%",alignItems:enCheckoutStep ? "flex-start" : "center",justifyContent:"center",padding:enCheckoutStep ? 0 : "20px 0",boxSizing:"border-box"}}>
        {esDesktop && stepId === "servicio" && listoParaServicios && !loadingPromos && <BookingCombosDesktop promociones={promociones.filter(p=>p.tipo === "combo" && servicios.some(s=>s.id===p.servicio_id))} servicios={servicios} accent={accent} onSelect={elegirPromo}/>}
        <div
            ref={rootRef}
            className={enCheckoutStep ? "bf-full-viewport" : "bf-full-viewport bf-catalog-shell"}
            style={
                enCheckoutStep
                    ? {
                          width: "100%",
                          maxWidth: 1100,
                          minHeight: "100dvh",
                          margin: "0 auto",
                          fontFamily: "'DM Sans', -apple-system, sans-serif",
                          boxSizing: "border-box",
                          overflowX: "hidden",
                          background: "transparent",
                          ...temaVars,
                      }
                    : {
                          ...wrapperStyle,
                          fontFamily: "'DM Sans', -apple-system, sans-serif",
                          background: "transparent",
                          ...temaVars,
                      }
            }
        >
            <style>{shimmerCSS}</style>


            {!enCheckoutStep && headerBlock}

            <div
                className={enCheckoutStep ? "bf-checkout-shell" : undefined}
                style={
                    enCheckoutStep
                        ? undefined
                        : {
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 32,
                              alignItems: "flex-start",
                              width: "100%",
                          }
                }
            >
                <div
                    className={enCheckoutStep ? "bf-checkout-left" : undefined}
                    style={
                        enCheckoutStep
                            ? sinExtras
                                ? { alignItems: "center" }
                                : undefined
                            : {
                                  flex: "1 1 340px",
                                  minWidth: 280,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 16,
                              }
                    }
                >
                    <div
                        className={
                            enCheckoutStep
                                ? "bf-checkout-left-inner"
                                : undefined
                        }
                        style={
                            enCheckoutStep
                                ? undefined
                                : {
                                      display: "contents",
                                  }
                        }
                    >
                        {enCheckoutStep && headerBlock}

                        {sucursalId && stepId!=='sucursal' && <p style={{fontSize:12,margin:'0 0 12px',color:tema.secundario}}>{sucursales.find(s=>s.id===sucursalId)?.nombre}</p>}
                        {stepId && (
                            <ProgressBar
                                steps={steps}
                                stepIndex={stepIndex}
                                labels={STEP_LABELS}
                                accent={accent}
                                onJump={irAPaso}
                            />
                        )}

                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={stepId}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{
                                    duration: 0.24,
                                    ease: [0.4, 0, 0.2, 1],
                                }}
                                style={{
                                    width: "100%",
                                    minWidth: 0,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 14,
                                }}
                            >
                                {stepId === "sucursal" && <div><StepTitle title="Elegí la sucursal"/><React.Suspense fallback={<Skeleton/>}><BranchSelection branches={sucursales} selected={sucursalId} accent={accent} onSelect={elegirSucursal} onContinue={irSiguientePaso}/></React.Suspense></div>}
                                {stepId === "profesional" && (
                                    <div>
                                        {stepIndex>0 && <div style={{marginBottom:14}}><BackLink onClick={volverPaso}/></div>}
                                        <StepTitle
                                            title="Elegí profesional"
                                            hint={sucursales.length?`Elegí con quién querés el turno en ${sucursales.find(s=>s.id===sucursalId)?.nombre || 'esta sede'}.`:'Elegí con quién querés el turno.'}
                                        />


                                        <div
                                            className="bf-scroll-list bf-professionals-grid"
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 10,
                                                height: "auto",
                                                overflow: "visible",
                                                minWidth: 0,
                                            }}
                                        >
                                            {loadingProf ? (
                                                <Skeleton />
                                            ) : (
                                                <>
                                                    {profesionalesVisibles.map((p) => (
                                                        <ProfesionalCard
                                                            key={p.id}
                                                            prof={p}
                                                            accentColor={accent}
                                                            placeholderAvatar={
                                                                placeholderAvatar
                                                            }
                                                            onSelect={() =>
                                                                elegirProfesional(
                                                                    p
                                                                )
                                                            }
                                                        />
                                                    ))}
                                                    {profesionales.length >
                                                        1 && !sucursales.length && (
                                                        <CualquierProfesionalCard
                                                            accentColor={accent}
                                                            iconoCualquiera={
                                                                iconoCualquiera
                                                            }
                                                            onSelect={
                                                                elegirCualquierProfesional
                                                            }
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {stepId === "servicio" &&
                                    listoParaServicios && (
                                        <div>
                                            {stepIndex > 0 && (
                                                <BackLink
                                                    onClick={volverPaso}
                                                />
                                            )}
                                            <StepTitle title="Elegí un servicio" />
                                            {errorPromos && <p role="status" style={{fontSize:12,color:"var(--bf-text-muted)"}}>{errorPromos}</p>}
                                            <div className="bf-services-grid"
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "repeat(2, minmax(0, 1fr))",
                                                    columnGap: 18,
                                                    rowGap: 26,
                                                }}
                                            >
                                                {loadingServicios || loadingPromos ? (
                                                    <>
                                                        <Skeleton
                                                            h={220}
                                                            r={16}
                                                        />
                                                        <Skeleton
                                                            h={220}
                                                            r={16}
                                                        />
                                                    </>
                                                ) : errorServicios ? (
                                                    <div
                                                        style={{
                                                            ...statusStyle,
                                                            gridColumn:
                                                                "1 / -1",
                                                        }}
                                                    >
                                                        {errorServicios}
                                                    </div>
                                                ) : servicios.length === 0 ? (
                                                    <div
                                                        style={{
                                                            ...statusStyle,
                                                            gridColumn:
                                                                "1 / -1",
                                                        }}
                                                    >
                                                        Este negocio no tiene
                                                        servicios configurados.
                                                    </div>
                                                ) : (
                                                    servicios.map((svc) => (
                                                        <ServicioCard
                                                            key={svc.id}
                                                            svc={descuentoServicio(svc.id) ? {...svc,precio:descuentoServicio(svc.id)!.precio_final,precio_original:svc.precio,promo_id:descuentoServicio(svc.id)!.id} : svc}
                                                            isSelected={
                                                                servicioId ===
                                                                svc.id && promoElegida?.tipo !== "combo"
                                                            }
                                                            accentColor={accent}
                                                            placeholderImage={
                                                                placeholderImage
                                                            }
                                                            onSelect={() =>
                                                                elegirServicio(
                                                                    svc
                                                                )
                                                            }
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {stepId === "fecha" && (
                                    <div>
                                        <BackLink onClick={volverPaso} />
                                        <StepTitle title="Elegí el día" />
                                        {promoElegida?.dias_semana != null && <p style={{fontSize:12,lineHeight:1.5,color:"var(--bf-text-muted)",margin:"0 0 12px"}}>Esta promo se aplica los {promoDaysLabel(promoElegida.dias_semana)} dentro de su vigencia.</p>}
                                        {promoElegida?.tipo === "descuento" && <p style={{fontSize:12,lineHeight:1.5,color:"var(--bf-text-muted)",margin:"-4px 0 14px"}}>Los días OFF tienen descuento. Las demás fechas se reservan al precio normal.</p>}
                                        <DiasBlock
                                            accent={accent}
                                            waitlistColor={waitlistColor}
                                            hoyBA={hoyBA}
                                            dias={diasDisponibles}
                                            fecha={fecha}
                                            diasLlenos={diasLlenos}
                                            diasCargando={diasCargando}
                                            cargandoNegocio={!negocio}
                                            hayMas={hayMasDias}
                                            diasPromo={diasDisponibles.filter(dia=>promoElegida?.tipo !== "combo" && !!promoParaFecha(dia))}
                                            expandido={verMasDias}
                                            onToggleMas={() =>
                                                setVerMasDias((v) => !v)
                                            }
                                            onSelect={elegirFecha}
                                        />
                                    </div>
                                )}

                                {stepId === "hora" && (
                                    <div>
                                        <BackLink onClick={volverPaso} />
                                        <StepTitle title="Elegí el horario" />
                                        <HorarioBlock
                                            accent={accent}
                                            loading={loadingSlots}
                                            error={errorSlots}
                                            hora={hora}
                                            onSelect={(
                                                h: string,
                                                staffId?: string | null
                                            ) => elegirHora(h, staffId)}
                                            mostrarFiltroFranja={
                                                mostrarFiltroFranja
                                            }
                                            franjaGrupos={franjaGrupos}
                                            mostrarListaEspera={
                                                mostrarListaEspera
                                            }
                                            espera={{
                                                nombre: esperaNombre,
                                                setNombre: setEsperaNombre,
                                                email: esperaEmail,
                                                setEmail: setEsperaEmail,
                                                onSubmit: enviarListaEspera,
                                                submitting: esperaSubmitting,
                                                error: esperaError,
                                                success: esperaSuccess,
                                                accent,
                                            }}
                                        />
                                    </div>
                                )}

                                {stepId === "checkout" && (
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 20,
                                            minWidth: 0,
                                            width: "100%",
                                        }}
                                    >
                                        <BackLink onClick={volverPaso} />

                                        <div style={{ minWidth: 0 }}>
                                            <SectionLabel
                                                text="Tus datos"
                                                accent={accent}
                                            />
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 10,
                                                    minWidth: 0,
                                                }}
                                            >
                                                <div className="bf-row-2">
                                                    <TextInput
                                                        placeholder="Nombre"
                                                        value={nombre}
                                                        onChange={setNombre}
                                                        accent={accent}
                                                    />
                                                    <TextInput
                                                        placeholder="Apellido"
                                                        value={apellido}
                                                        onChange={setApellido}
                                                        accent={accent}
                                                    />
                                                </div>
                                                <TextInput
                                                    placeholder="Email"
                                                    value={email}
                                                    onChange={(v) => {
                                                        setEmail(v)
                                                        if (emailError)
                                                            setEmailError("")
                                                    }}
                                                    onBlur={onBlurEmail}
                                                    accent={accent}
                                                    error={emailError}
                                                />
                                                <TelInput
                                                    pais={pais}
                                                    setPais={setPais}
                                                    dropdownOpen={
                                                        paisDropdownOpen
                                                    }
                                                    setDropdownOpen={
                                                        setPaisDropdownOpen
                                                    }
                                                    btnRef={paisBtnRef}
                                                    value={telefono}
                                                    onChange={(v) => {
                                                        setTelefono(v)
                                                        if (telError)
                                                            setTelError("")
                                                    }}
                                                    onBlur={onBlurTelefono}
                                                    accent={accent}
                                                    error={telError}
                                                />
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => {
                                                setNotaBorrador(nota)
                                                setNotaAbierta(true)
                                            }}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "12px 14px",
                                                borderRadius: 12,
                                                border: "1.5px dashed var(--bf-border-strong)",
                                                cursor: "pointer",
                                                minWidth: 0,
                                                gap: 8,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: 13,
                                                    color: nota
                                                        ? accent
                                                        : "var(--bf-text-muted)",
                                                    fontWeight: 600,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    minWidth: 0,
                                                }}
                                            >
                                                {nota
                                                    ? "Nota agregada — editar"
                                                    : "Dejar una nota (opcional)"}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: 16,
                                                    color: "var(--bf-text-faint)",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                ›
                                            </span>
                                        </div>

                                        {habilitarExtras &&
                                            (loadingExtras ||
                                                extras.length > 0) && (
                                                <div
                                                    style={{
                                                        minWidth: 0,
                                                        width: "100%",
                                                    }}
                                                >
                                                    <SectionLabel
                                                        text={tituloExtras}
                                                        accent={accent}
                                                    />
                                                    <ExtrasBlock
                                                        accent={accent}
                                                        loading={loadingExtras}
                                                        extras={extras.filter(e=>!promoElegida?.items.some(i=>i.tipo === "producto" && i.id===e.id))}
                                                        seleccionados={
                                                            extrasSeleccionados
                                                        }
                                                        onToggle={toggleExtra}
                                                        onCantidad={cambiarCantidadExtra}
                                                        placeholderImage={
                                                            placeholderImage
                                                        }
                                                    />
                                                </div>
                                            )}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {enCheckoutStep && (
                    <div className="bf-checkout-right">
                        {/* Título con el color de texto del usuario */}
                        <div
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: "var(--bf-text)",
                            }}
                        >
                            Resumen de la reserva
                        </div>

                        {/* Tarjeta de Resumen (Fondo blanco, texto negro, bordes redondeados) */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                minWidth: 0,
                                background: "#FFFFFF",
                                borderRadius: 16,
                                padding: "16px 18px",
                                border: "1px solid #E5E7EB",
                                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                                color: "#111827",
                            }}
                        >
                            {servicioElegido && (
                                <div
                                    style={{
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: "#111827",
                                        overflowWrap: "break-word",
                                    }}
                                >
                                    {servicioElegido.nombre}
                                </div>
                            )}
                            {(profesionalElegido || esCualquierProfesional) && (
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: "#4B5563",
                                        overflowWrap: "break-word",
                                    }}
                                >
                                    Con {nombreProfesionalActual}
                                </div>
                            )}
                            {fecha && (
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: "#4B5563",
                                        overflowWrap: "break-word",
                                    }}
                                >
                                    {formatearFecha(fecha)}
                                    {hora ? ` · ${hora} hs` : ""}
                                </div>
                            )}
                            {promoAplicada && <div style={{fontSize:12,lineHeight:1.5,color:"var(--bf-text-muted)"}}>Promo: {promoAplicada.nombre}{promoAplicada.tipo === "combo" && <div>Incluye {promoAplicada.items.map(i=>`${i.cantidad} × ${i.nombre}`).join(" + ")}</div>}</div>}
                            {extrasSeleccionados.length > 0 && (
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        color: "#4B5563",
                                        marginTop: 2,
                                        overflowWrap: "break-word",
                                    }}
                                >
                                    +{" "}
                                    {extrasSeleccionados
                                        .map((e) => `${e.cantidad} × ${e.nombre}`)
                                        .join(", ")}
                                </div>
                            )}

                            <div
                                style={{
                                    height: 1,
                                    background: "#E5E7EB",
                                    margin: "8px 0",
                                }}
                            />

                            {esSena ? (
                                <>
                                    <FilaResumen
                                        label="Precio del turno"
                                        valor={
                                            totalServicioYExtras != null
                                                ? formatearMoneda(
                                                      totalServicioYExtras
                                                  )
                                                : "—"
                                        }
                                    />
                                    <FilaResumen
                                        label={`Seña${negocio.porcentaje_sena ? ` (${negocio.porcentaje_sena}%)` : ""} — pagás ahora`}
                                        valor={
                                            totalAMostrar != null
                                                ? formatearMoneda(totalAMostrar)
                                                : "—"
                                        }
                                    />
                                    <FilaResumen
                                        label="Resto — pagás en el local"
                                        valor={
                                            totalPendiente != null
                                                ? formatearMoneda(
                                                      totalPendiente
                                                  )
                                                : "—"
                                        }
                                    />
                                </>
                            ) : (
                                <FilaResumen
                                    label={
                                        negocio?.agenda_sin_pagos
                                            ? "Valor del turno"
                                            : "Total a pagar"
                                    }
                                    valor={
                                        totalAMostrar != null
                                            ? formatearMoneda(totalAMostrar)
                                            : "—"
                                    }
                                />
                            )}
                        </div>

                        {metodosDisponibles.length > 0 && (
                            <>
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#6B7280",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    Método de pago
                                </div>

                                <PagoBlock
                                    metodos={metodosDisponibles}
                                    seleccionado={metodo}
                                    onSelect={(k: MetodoKey) => {
                                        setMetodo((prev) =>
                                            prev === k ? "" : k
                                        )
                                        if (k !== "transferencia") {
                                            setComprobante(null)
                                            setErrorArchivo("")
                                        }
                                    }}
                                    logos={{
                                        tarjeta: logoTarjeta,
                                        mercadopago: logoMercadoPago,
                                        transferencia: logoTransferencia,
                                        efectivo: logoEfectivo,
                                    }}
                                    iconoAdjuntar={iconoAdjuntar}
                                    datosBancarios={negocio.datos_bancarios}
                                    comprobante={comprobante}
                                    errorArchivo={errorArchivo}
                                    onArchivo={manejarArchivo}
                                    onQuitarArchivo={() => setComprobante(null)}
                                    esSena={esSena}
                                    montoATransferir={totalAMostrar}
                                    montoPendienteEnLocal={totalPendiente}
                                    accent={accent}
                                />
                            </>
                        )}

                        {submitError && (
                            <div
                                style={{
                                    fontSize: 12.5,
                                    color: "#DC2626",
                                    overflowWrap: "break-word",
                                }}
                            >
                                {submitError}
                            </div>
                        )}

                        <FillButton
                            onClick={confirmarReserva}
                            disabled={
                                !puedeConfirmar || submitEstado === "loading"
                            }
                            fill={accent}
                            style={{
                                width: "100%",
                                marginTop: 4,
                                padding: "14px",
                                borderRadius: 12,
                                fontSize: 14,
                                fontWeight: 700,
                            }}
                        >
                            {submitEstado === "loading"
                                ? "Procesando..."
                                : "Confirmar reserva"}
                        </FillButton>
                    </div>
                )}
            </div>

            {cardSession && <BookingCardPayment session={cardSession} api={api} accent={accent} onClose={()=>setCardSession(null)} />}
            {notaAbierta && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 20,
                    }}
                    onClick={() => setNotaAbierta(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#fff",
                            borderRadius: 16,
                            padding: 18,
                            width: "100%",
                            maxWidth: 380,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                        }}
                    >
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                            Dejar una nota
                        </span>
                        <textarea
                            autoFocus
                            value={notaBorrador}
                            maxLength={notaMaxCaracteres}
                            onChange={(e) => setNotaBorrador(e.target.value)}
                            placeholder={notaPlaceholder}
                            style={{
                                width: "100%",
                                minHeight: 96,
                                resize: "none",
                                border: "1px solid #E5E7EB",
                                borderRadius: 10,
                                padding: 10,
                                fontSize: 13,
                                boxSizing: "border-box",
                                fontFamily: "inherit",
                            }}
                        />
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                {notaBorrador.length}/{notaMaxCaracteres}
                            </span>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    onClick={() => setNotaAbierta(false)}
                                    style={btnSecundario}
                                >
                                    Cancelar
                                </button>
                                <motion.button
                                    whileHover={{
                                        boxShadow: `0 0 0 3px ${accent}40`,
                                    }}
                                    onClick={() => {
                                        setNota(notaBorrador.trim())
                                        setNotaAbierta(false)
                                    }}
                                    style={{
                                        ...btnPrimario,
                                        background: "#111827",
                                        boxShadow: `0 0 0 0px ${accent}00`,
                                        transition: "box-shadow 0.2s ease",
                                    }}
                                >
                                    Guardar
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {modalSinPago && (
                <div
                    onClick={() => setModalSinPago(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 99999,
                        background: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 20,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#fff",
                            borderRadius: 20,
                            padding: "32px 28px 24px",
                            maxWidth: 360,
                            width: "100%",
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            alignItems: "center",
                        }}
                    >
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: "50%",
                                background: "#EFF6FF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 26,
                                overflow: "hidden",
                            }}
                        >
                            {iconoSinPago ? (
                                <img
                                    src={iconoSinPago}
                                    alt=""
                                    style={{
                                        width: "60%",
                                        height: "60%",
                                        objectFit: "contain",
                                    }}
                                />
                            ) : (
                                "💳"
                            )}
                        </div>
                        <h2
                            style={{ margin: 0, fontSize: 17, fontWeight: 700 }}
                        >
                            Método de pago no configurado
                        </h2>
                        <p
                            style={{
                                margin: 0,
                                fontSize: 14,
                                color: "#6B7280",
                                lineHeight: 1.6,
                            }}
                        >
                            Este negocio aún no configuró cómo cobrar sus
                            turnos. Contactalo directamente para reservar.
                        </p>
                        <button
                            onClick={() =>
                                (window.location.href = `${window.location.origin}/agenda/${slug}`)
                            }
                            style={{
                                ...btnPrimario,
                                background: "#111",
                                width: "100%",
                            }}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}
        </div>
        </div>
        </div>
    )
}

function LogoBlock({ negocio, accent }: { negocio: Negocio; accent: string }) {
    const [error, setError] = React.useState(false)
    const size = 64
    const initials =
        negocio.business_name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase())
            .join("") || "?"
    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: size * 0.18,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bf-card-bg, #fff)",
                border: "1px solid var(--bf-border)",
            }}
        >
            {negocio.logo_url && !error ? (
                <img
                    src={negocio.logo_url}
                    alt={negocio.business_name}
                    onError={() => setError(true)}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                    }}
                />
            ) : (
                <span
                    style={{
                        fontSize: size * 0.36,
                        fontWeight: 700,
                        color: accent,
                    }}
                >
                    {initials}
                </span>
            )}
        </div>
    )
}

function ChevronIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9 6l6 6-6 6" />
        </svg>
    )
}

function UsersIcon() {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
            <path d="M16 5.3a3.2 3.2 0 010 5.9M18 14c1.8.7 3 2.3 3 5" />
        </svg>
    )
}

const filaStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 16px 12px 12px",
    borderRadius: 20,
    border: "none",
    background: "var(--bf-card-bg)",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "left",
    fontFamily: "inherit",
    color: "var(--bf-text)",
}

function StepTitle({ title, hint }: { title: string; hint?: string }) {
    return (
        <div style={{ marginTop: 10, marginBottom: 16 }}>
            <div
                style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: "var(--bf-text)",
                }}
            >
                {title}
            </div>
            {hint && (
                <div
                    style={{
                        fontSize: 13,
                        color: "var(--bf-text-muted)",
                        marginTop: 4,
                    }}
                >
                    {hint}
                </div>
            )}
        </div>
    )
}

function ProfesionalCard({
    prof,
    accentColor,
    placeholderAvatar,
    onSelect,
}: {
    prof: Profesional
    accentColor: string
    placeholderAvatar?: string
    onSelect: () => void
}) {
    const [imgError, setImgError] = React.useState(false)
    const showImg = !!prof.foto_url && !imgError
    const nombreCompleto = `${prof.nombre}${prof.apellido ? " " + prof.apellido : ""}`
    const color = prof.color || accentColor
    return (
        <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={onSelect}
            style={filaStyle}
        >
            <div
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    flexShrink: 0,
                    overflow: "hidden",
                    background: showImg ? "var(--bf-border)" : color,
                    boxShadow: `0 0 0 2px var(--bf-bg), 0 0 0 3.5px ${color}`,
                    margin: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 19,
                }}
            >
                {showImg ? (
                    <img
                        src={prof.foto_url as string}
                        alt={nombreCompleto}
                        onError={() => setImgError(true)}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : placeholderAvatar ? (
                    <img
                        src={placeholderAvatar}
                        alt=""
                        style={{ width: "55%", height: "55%", opacity: 0.5 }}
                    />
                ) : (
                    nombreCompleto.charAt(0).toUpperCase()
                )}
            </div>
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 15,
                    fontWeight: 600,
                }}
            >
                {nombreCompleto}
            </div>
            <span style={{ color: "var(--bf-text-faint)", display: "flex" }}>
                <ChevronIcon />
            </span>
        </motion.button>
    )
}

function CualquierProfesionalCard({
    accentColor,
    iconoCualquiera,
    onSelect,
}: {
    accentColor: string
    iconoCualquiera?: string
    onSelect: () => void
}) {
    return (
        <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={onSelect}
            style={{
                ...filaStyle,
                background: "transparent",
                boxShadow: "inset 0 0 0 1.5px var(--bf-border-strong)",
            }}
        >
            <div
                style={{
                    width: 52,
                    height: 52,
                    margin: 2,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: withAlpha(accentColor, "14"),
                    color: accentColor,
                    overflow: "hidden",
                }}
            >
                {iconoCualquiera ? (
                    <img
                        src={iconoCualquiera}
                        alt=""
                        style={{
                            width: "55%",
                            height: "55%",
                            objectFit: "contain",
                        }}
                    />
                ) : (
                    <UsersIcon />
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Cualquiera</div>
                <div
                    style={{
                        fontSize: 12.5,
                        color: "var(--bf-text-muted)",
                        marginTop: 2,
                    }}
                >
                    No tengo preferencia
                </div>
            </div>
            <span style={{ color: "var(--bf-text-faint)", display: "flex" }}>
                <ChevronIcon />
            </span>
        </motion.button>
    )
}

function ClockIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </svg>
    )
}

function BookingCombosDesktop({promociones,servicios,accent,onSelect}:{promociones:BookingPromo[];servicios:Servicio[];accent:string;onSelect:(promo:BookingPromo)=>void}) {
    if(!promociones.length)return null
    return <aside className="bf-combos-desktop-menu" aria-label="Combos disponibles" style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:15,fontWeight:700,color:"var(--bf-text)"}}>Combos disponibles</div>
        {promociones.map(p=><div key={p.id} style={{padding:14,border:"1px solid var(--bf-border)",borderRadius:12,background:"var(--bf-card-bg)",display:"flex",flexDirection:"column",gap:9,minWidth:0}}>
            <strong style={{fontSize:13,lineHeight:1.4,color:"var(--bf-text)",overflowWrap:"anywhere"}}>{p.nombre}</strong>
            {p.dias_semana != null && <span style={{fontSize:11,lineHeight:1.4,color:"var(--bf-text-muted)"}}>Sólo los {promoDaysLabel(p.dias_semana)}</span>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:5}}>{p.items.map(item=>{const url=p.imagenes?.find(i=>i.tipo===item.tipo && i.id===item.id)?.url || (item.tipo === "servicio" ? servicios.find(s=>s.id===item.id)?.imagen : "");return <span key={item.tipo+item.id} title={`${item.cantidad} × ${item.nombre}`} style={{aspectRatio:"1",position:"relative",display:"grid",placeItems:"center",borderRadius:5,overflow:"hidden",background:"var(--bf-panel-bg)",minWidth:0}}>{url ? <img src={url} alt={item.nombre} style={{width:"100%",height:"100%",objectFit:item.tipo === "producto" ? "contain" : "cover",borderRadius:5}}/> : <span style={{fontSize:10,padding:4,textAlign:"center",color:"var(--bf-text-muted)",overflowWrap:"anywhere"}}>{item.nombre}</span>}{item.cantidad>1 && <span style={{position:"absolute",right:2,bottom:2,fontSize:9,padding:"1px 3px",borderRadius:3,background:"var(--bf-card-bg)",color:"var(--bf-text)"}}>×{item.cantidad}</span>}</span>})}</div>
            <div style={{fontSize:10,lineHeight:1.5,color:"var(--bf-text-muted)",overflowWrap:"anywhere"}}>Incluye: {p.items.map(i=>`${i.cantidad} × ${i.nombre}`).join(" + ")}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap",color:"var(--bf-text)"}}><strong style={{fontSize:15}}>$ {p.precio_final.toLocaleString("es-AR")}</strong><del style={{fontSize:11,color:"var(--bf-text-muted)"}}>$ {p.precio_original.toLocaleString("es-AR")}</del></div>
            <button type="button" onClick={()=>onSelect(p)} style={{border:0,borderRadius:8,padding:"9px 10px",background:accent,color:"white",font:"inherit",fontSize:12,fontWeight:600,cursor:"pointer"}}>Agendar Combo</button>
        </div>)}
    </aside>
}

function BookingCombosSubheader({promociones,servicios,accent,icono,onSelect}:{promociones:BookingPromo[];servicios:Servicio[];accent:string;icono?:string;onSelect:(promo:BookingPromo)=>void}) {
    const [abierto,setAbierto]=React.useState(false)
    const [indice,setIndice]=React.useState(0)
    const id=React.useId()
    const carrusel=React.useRef<HTMLDivElement>(null)
    const destinoSlide=React.useRef<number | null>(null)
    const [progreso,setProgreso]=React.useState(0)
    const [alturaCombo,setAlturaCombo]=React.useState(34)
    React.useEffect(()=>{
        if(!abierto)return
        const el=carrusel.current
        const tarjeta=el?.children[Math.min(indice,promociones.length-1)] as HTMLElement | undefined
        if(!el || !tarjeta)return
        const medir=()=>setAlturaCombo(Math.ceil(tarjeta.getBoundingClientRect().height)+4)
        medir()
        const observer=new ResizeObserver(medir)
        observer.observe(tarjeta)
        observer.observe(el)
        return ()=>observer.disconnect()
    },[abierto,indice,promociones])
    React.useEffect(()=>{
        if(abierto && carrusel.current)carrusel.current.scrollTo({left:indice*carrusel.current.clientWidth,behavior:"auto"})
    },[abierto])
    React.useEffect(()=>{
        if(!abierto || !promociones.length){setProgreso(0);return}
        let frame=0
        let inicio:number | null=null
        let cancelado=false
        const avanzar=(ahora:number)=>{
            if(cancelado)return
            if(inicio===null)inicio=ahora
            const transcurrido=ahora-inicio
            setProgreso(Math.min(transcurrido/6000,1))
            if(transcurrido>=6000){
                const siguiente=(indice+1)%promociones.length
                destinoSlide.current=siguiente
                carrusel.current?.scrollTo({left:siguiente*carrusel.current.clientWidth,behavior:"smooth"})
                setIndice(siguiente)
                setProgreso(0)
                if(siguiente!==indice)return
                inicio=ahora
            }
            frame=requestAnimationFrame(avanzar)
        }
        frame=requestAnimationFrame(avanzar)
        return ()=>{cancelado=true;cancelAnimationFrame(frame)}
    },[abierto,indice,promociones.length])
    if(!promociones.length)return null
    return <div style={{position:"sticky",top:0,height:34,width:"calc(100% - 20px)",maxWidth:420,margin:"0 auto",zIndex:30,flexShrink:0}} onKeyDown={event=>{if(event.key === "Escape")setAbierto(false)}}>
        <style>{`@keyframes bf-combos-shine {0%,65% {transform:translateX(-140%) skewX(-18deg)} 100% {transform:translateX(520%) skewX(-18deg)}} .bf-combos-shine {animation:bf-combos-shine 4.5s ease-in-out infinite} @media(prefers-reduced-motion:reduce){.bf-combos-shine {animation:none;display:none}}`}</style>
        <motion.div id={id} initial={false} animate={{height:abierto ? alturaCombo : 34}} transition={{duration:0.3,ease:[0.22,1,0.36,1]}} style={{position:"absolute",inset:"0 0 auto",boxSizing:"border-box",border:"1px solid var(--bf-border)",borderRadius:4,background:"var(--bf-card-bg)",overflow:"hidden"}}>
        {!abierto ? <button type="button" aria-expanded={false} aria-controls={id} onClick={()=>setAbierto(true)} style={{width:"100%",height:32,boxSizing:"border-box",padding:"6px 8px",textAlign:"left",display:"flex",alignItems:"center",gap:5,border:0,borderRadius:4,position:"relative",overflow:"hidden",background:"transparent",color:"var(--bf-text)",font:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}><span>Ver Combos</span>{icono ? <img src={icono} alt="" aria-hidden="true" style={{width:14,height:14,objectFit:"contain",flexShrink:0}}/> : <span aria-hidden="true">↘</span>}<span aria-hidden="true" className="bf-combos-shine" style={{position:"absolute",inset:"0 auto 0 0",width:"28%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)",pointerEvents:"none"}}/></button> : <div>
            <div ref={carrusel} aria-label="Combos disponibles" onPointerDown={()=>{destinoSlide.current=null}} onWheel={()=>{destinoSlide.current=null}} onScroll={event=>{const el=event.currentTarget;if(!el.clientWidth)return;if(destinoSlide.current!==null){if(Math.abs(el.scrollLeft-destinoSlide.current*el.clientWidth)>1)return;destinoSlide.current=null}setIndice(Math.max(0,Math.min(promociones.length-1,Math.round(el.scrollLeft/el.clientWidth))))}} style={{display:"flex",overflowX:"auto",scrollSnapType:"x mandatory",alignItems:"flex-start",scrollbarWidth:"none"}}>
                {promociones.map(p=>{const imagenes=p.items.map(item=>({...item,url:p.imagenes?.find(image=>image.tipo===item.tipo && image.id===item.id)?.url || (item.tipo === "servicio" ? servicios.find(service=>service.id===item.id)?.imagen : "")}));return <div key={p.id} style={{flex:"0 0 100%",minWidth:0,boxSizing:"border-box",scrollSnapAlign:"start",display:"flex",flexDirection:"column",gap:8,padding:"8px 10px 10px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                        <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:5}}>
                            <button type="button" aria-label="Cerrar combos" onClick={()=>setAbierto(false)} style={{display:"block",maxWidth:"100%",border:0,padding:0,background:"transparent",color:"var(--bf-text)",font:"inherit",fontSize:12,lineHeight:"16px",textAlign:"left",overflowWrap:"anywhere",cursor:"pointer"}}>{p.nombre}</button>
                            {p.dias_semana != null && <span style={{fontSize:10,lineHeight:1.4,color:"var(--bf-text-muted)"}}>Sólo los {promoDaysLabel(p.dias_semana)}</span>}
                            <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap",fontSize:12,lineHeight:"16px",color:"var(--bf-text)"}}><strong style={{fontWeight:600}}>$ {p.precio_final.toLocaleString("es-AR")}</strong><del style={{fontSize:10,color:"var(--bf-text-muted)",fontWeight:400}}>$ {p.precio_original.toLocaleString("es-AR")}</del></div>
                            <button type="button" onClick={()=>onSelect(p)} style={{border:0,borderRadius:20,padding:"4px 7px",background:accent,color:"white",font:"inherit",fontSize:10,lineHeight:"13px",cursor:"pointer",whiteSpace:"nowrap"}}>Agendar Combo</button>
                        </div>
                        <div aria-label="Imágenes de todos los elementos del combo" style={{display:"grid",gridTemplateColumns:imagenes.length>4 ? "repeat(3,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))",width:imagenes.length>4 ? 126 : 100,gap:4,flexShrink:0}}>
                            {imagenes.map(item=><span key={item.tipo+item.id} title={`${item.cantidad} × ${item.nombre}`} style={{position:"relative",aspectRatio:"1",minWidth:0,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,overflow:"hidden",background:"var(--bf-panel-bg)",border:"1px solid var(--bf-border)",boxSizing:"border-box"}}>
                                {item.url ? <img src={item.url} alt={item.nombre} style={{display:"block",width:item.tipo === "producto" ? "auto" : "100%",height:item.tipo === "producto" ? "auto" : "100%",maxWidth:"100%",maxHeight:"100%",objectFit:item.tipo === "producto" ? "contain" : "cover",borderRadius:3}}/> : <span role="img" aria-label={item.nombre} style={{color:"var(--bf-text-faint)",display:"flex"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg></span>}
                                {item.cantidad>1 && <span style={{position:"absolute",right:2,bottom:2,padding:"1px 3px",borderRadius:3,background:"var(--bf-card-bg)",color:"var(--bf-text)",fontSize:9,fontWeight:600}}>×{item.cantidad}</span>}
                            </span>)}
                        </div>
                    </div>
                    <div style={{fontSize:10,lineHeight:1.5,color:"var(--bf-text-muted)",overflowWrap:"anywhere"}}><strong style={{fontWeight:600}}>Incluye: </strong>{p.items.map(item=>`${item.cantidad} × ${item.nombre}`).join(" + ")}</div>
                </div>})}
            </div>
            <div aria-hidden="true" style={{position:"absolute",bottom:0,left:0,height:2,width:"100%",transform:`scaleX(${progreso})`,transformOrigin:"left",background:accent}}/>
        </div>}
        </motion.div>
    </div>
}
function ComboImagenVacia({ancho}:{ancho:number}) {
    return <span aria-hidden="true" style={{width:ancho,height:48,display:"grid",placeItems:"center",background:"#eee",borderRadius:ancho===48 ? 9 : 3}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg></span>
}

function ServicioCard({
    svc,
    isSelected,
    accentColor,
    placeholderImage,
    onSelect,
}: {
    svc: Servicio
    isSelected: boolean
    accentColor: string
    placeholderImage?: string
    onSelect: () => void
}) {
    const [imgError, setImgError] = React.useState(false)
    const [verDesc, setVerDesc] = React.useState(false)
    const [tactil, setTactil] = React.useState(false)
    const timer = React.useRef<any>(null)
    const largo = React.useRef(false)

    React.useEffect(() => {
        try {
            setTactil(window.matchMedia("(hover: none)").matches)
        } catch {}
        return () => clearTimeout(timer.current)
    }, [])

    const showImg = svc.imagen && !imgError
    const desc = (svc.descripcion || "").trim()
    const tieneDesc = desc.length > 0
    const durLabel =
        svc.duracion < 60
            ? `${svc.duracion} min`
            : svc.duracion % 60 === 0
              ? `${svc.duracion / 60} h`
              : `${Math.floor(svc.duracion / 60)} h ${svc.duracion % 60} min`

    // Mobile: mantener presionado muestra la descripción mientras se sostiene.
    const alPresionar = (e: React.PointerEvent) => {
        largo.current = false
        if (e.pointerType === "mouse" || !tieneDesc) return
        timer.current = setTimeout(() => {
            largo.current = true
            setVerDesc(true)
        }, 380)
    }
    const alSoltar = () => {
        clearTimeout(timer.current)
        if (largo.current) setVerDesc(false)
    }
    const alClickear = () => {
        if (largo.current) {
            largo.current = false
            return
        }
        onSelect()
    }

    return (
        <motion.div
            role="button"
            tabIndex={0}
            whileTap={{ scale: 0.985 }}
            onClick={alClickear}
            onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelect()
                }
            }}
            onPointerDown={alPresionar}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            onPointerLeave={alSoltar}
            onContextMenu={(e: React.MouseEvent) => {
                if (tieneDesc && tactil) e.preventDefault()
            }}
            onMouseLeave={() => !tactil && setVerDesc(false)}
            style={
                {
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                    cursor: "pointer",
                    overflow: "hidden",
                    borderRadius: 0,
                    background: "#fff",
                    border: "1px solid color-mix(in srgb, var(--bf-text) 16%, transparent)",
                    outline: `2px solid ${isSelected ? accentColor : "transparent"}`,
                    outlineOffset: 2,
                    transition: "outline-color 0.2s ease",
                    color: "var(--bf-text)",
                    userSelect: tactil ? "none" : undefined,
                    WebkitUserSelect: tactil ? "none" : undefined,
                    WebkitTouchCallout: "none",
                } as any
            }
        >
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 0,
                    overflow: "hidden",
                    background: "var(--bf-panel-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {showImg ? (
                    <img
                        src={svc.imagen}
                        alt={svc.nombre}
                        draggable={false}
                        onError={() => setImgError(true)}
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            pointerEvents: "none",
                        }}
                    />
                ) : placeholderImage ? (
                    <img
                        src={placeholderImage}
                        alt=""
                        draggable={false}
                        style={{ width: "34%", height: "34%", opacity: 0.45 }}
                    />
                ) : (
                    <span style={{ fontSize: 30, opacity: 0.35 }}>✂</span>
                )}

                <AnimatePresence>
                    {isSelected && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            style={{
                                position: "absolute",
                                top: 10,
                                left: 10,
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: accentColor,
                                color: "#fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                        </motion.span>
                    )}
                </AnimatePresence>

                {tieneDesc && !tactil && (
                    <button
                        type="button"
                        aria-label="Ver descripción"
                        onMouseEnter={() => setVerDesc(true)}
                        onFocus={() => setVerDesc(true)}
                        onBlur={() => setVerDesc(false)}
                        onClick={(e) => {
                            e.stopPropagation()
                            setVerDesc(true)
                        }}
                        style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            border: "none",
                            background:
                                "color-mix(in srgb, var(--bf-bg) 78%, transparent)",
                            backdropFilter: "blur(6px)",
                            WebkitBackdropFilter: "blur(6px)",
                            color: "var(--bf-text)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <circle cx="5" cy="12" r="1.8" />
                            <circle cx="12" cy="12" r="1.8" />
                            <circle cx="19" cy="12" r="1.8" />
                        </svg>
                    </button>
                )}

                <AnimatePresence>
                    {verDesc && tieneDesc && (
                        <motion.div
                            key="desc"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.16 }}
                            onClick={(e: React.MouseEvent) => {
                                if (tactil) return
                                e.stopPropagation()
                                setVerDesc(false)
                            }}
                            style={{
                                position: "absolute",
                                inset: 0,
                                padding: "14px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                gap: 4,
                                background:
                                    "color-mix(in srgb, var(--bf-bg) 94%, transparent)",
                                backdropFilter: "blur(8px)",
                                WebkitBackdropFilter: "blur(8px)",
                                cursor: "default",
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {svc.nombre}
                            </div>
                            <div
                                style={{
                                    fontSize: 12.5,
                                    lineHeight: 1.45,
                                    color: "var(--bf-text-muted)",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 6,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                }}
                            >
                                {desc}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    padding: "12px 12px 14px",
                    background: "#fff",
                }}
            >
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        letterSpacing: "-0.01em",
                        color: isSelected ? accentColor : "var(--bf-text)",
                        transition: "color 0.2s",
                    }}
                >
                    {svc.promo_id && <div style={{marginBottom:4,fontSize:11,color:accentColor}}>PROMO</div>}
                    <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}}><span>${svc.precio.toLocaleString("es-AR")}</span>{svc.promo_id && <del style={{fontSize:11,color:"var(--bf-text-muted)",fontWeight:400}}>$ {Number(svc.precio_original).toLocaleString("es-AR")}</del>}</div>
                </div>
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {svc.nombre}
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        marginTop: 2,
                        fontSize: 13,
                        color: "var(--bf-text-muted)",
                    }}
                >
                    <ClockIcon />
                    {durLabel}
                </div>
            </div>
        </motion.div>
    )
}

const DIAS_ABREV = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"]

// Selector de día en formato "chips": 4 por fila, máximo 2 filas
// (MAX_DIAS_VISIBLES). Cada chip muestra el número y el día abreviado.
function DiasBlock({
    accent,
    waitlistColor,
    hoyBA,
    dias,
    fecha,
    diasLlenos,
    diasPromo = [],
    diasCargando,
    cargandoNegocio,
    hayMas,
    expandido,
    onToggleMas,
    onSelect,
}: any) {
    const hoyISO = toISO(hoyBA.getFullYear(), hoyBA.getMonth(), hoyBA.getDate())
    if (!cargandoNegocio && dias.length === 0 && !hayMas) {
        return (
            <p
                style={{
                    fontSize: 14,
                    color: "var(--bf-text-muted)",
                    textAlign: "center",
                    margin: "24px 0",
                }}
            >
                No hay días disponibles por el momento.
            </p>
        )
    }
    const hayLlenos = dias.some((iso: string) => diasLlenos.includes(iso))
    return (
        <div className="bf-days-block" style={{ width: "100%", maxWidth: 340, margin: "0 auto" }}>
            <div className="bf-days-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                }}
            >
                {dias.map((iso: string) => {
                    const [y, m, d] = iso.split("-").map(Number)
                    const dateObj = new Date(y, m - 1, d)
                    return (
                        <DiaChip
                            key={iso}
                            numero={padZ(d)}
                            nombre={DIAS_ABREV[dateObj.getDay()]}
                            accent={accent}
                            waitlistColor={waitlistColor}
                            isSelected={fecha === iso}
                            isHoy={iso === hoyISO}
                            isFull={diasLlenos.includes(iso)}
                            isPromo={diasPromo.includes(iso)}
                            isChecking={diasCargando.includes(iso)}
                            onClick={() => onSelect(iso)}
                        />
                    )
                })}
            </div>
            {hayMas && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        marginTop: 10,
                    }}
                >
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={onToggleMas}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            borderRadius: 999,
                            border: "none",
                            background: "transparent",
                            color: "var(--bf-text-muted)",
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: "pointer",
                        }}
                    >
                        {expandido ? "Ver menos" : "Ver más días"}
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            aria-hidden="true"
                            style={{
                                transform: expandido
                                    ? "rotate(180deg)"
                                    : "none",
                            }}
                        >
                            <path
                                d="M2.5 4.5 6 8l3.5-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </motion.button>
                </div>
            )}
            {hayLlenos && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        marginTop: 14,
                    }}
                >
                    <LegendItem
                        color="transparent"
                        label="Lista de espera"
                        border={waitlistColor}
                        dashed
                    />
                </div>
            )}
        </div>
    )
}

function DiaChip({
    numero,
    nombre,
    accent,
    waitlistColor,
    isSelected,
    isHoy,
    isFull,
    isChecking,
    isPromo,
    onClick,
}: any) {
    const background = isSelected
        ? accent
        : "color-mix(in srgb, var(--bf-text) 7%, transparent)"
    const color = isSelected ? "#FFF" : isFull ? "#B45309" : "var(--bf-text)"
    const border =
        isFull && !isSelected
            ? `1.5px dashed ${waitlistColor}`
            : isHoy && !isSelected
              ? `1.5px solid ${accent}`
              : "1.5px solid transparent"
    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            title={isFull ? "Sin turnos libres — lista de espera" : isPromo ? "Descuento disponible este día" : "Precio normal"}
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                padding: "10px 12px",
                borderRadius: 8,
                border,
                background,
                color,
                fontFamily: "inherit",
                fontVariantNumeric: "tabular-nums",
                textAlign: "left",
                cursor: "pointer",
                position: "relative",
                lineHeight: 1.25,
            }}
        >
            <span style={{ fontSize: 16, fontWeight: 600 }}>{numero}</span>
            <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.85 }}>
                {nombre}
            </span>
            {isPromo && <span style={{position:"absolute",top:0,right:0,padding:"3px 3px 3px 10px",background:accent,color:"white",fontSize:8,fontWeight:700,lineHeight:1,clipPath:"polygon(0 0,100% 0,100% 100%,0 100%,7px 50%)",borderTopRightRadius:6}}>OFF</span>}
            {isChecking && !isSelected && (
                <motion.span
                    aria-hidden="true"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{
                        repeat: Infinity,
                        duration: 1.1,
                        ease: "easeInOut",
                    }}
                    style={{
                        position: "absolute",
                        top: isPromo ? 20 : 6,
                        right: 6,
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "var(--bf-text-faint)",
                    }}
                />
            )}
        </motion.button>
    )
}

function LegendItem({ color, label, border = "none", dashed = false }: any) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    border:
                        border !== "none"
                            ? `1.5px ${dashed ? "dashed" : "solid"} ${border}`
                            : "none",
                    flexShrink: 0,
                }}
            />
            <span style={{ fontSize: 11.5, color: "var(--bf-text-muted)" }}>
                {label}
            </span>
        </div>
    )
}

// Cantidad de columnas de horarios dentro de cada franja
const COLUMNAS_HORARIOS = 2

const FRANJA_LABELS: Record<string, string> = {
    manana: "Mañana",
    tarde: "Tarde",
    noche: "Noche",
}

function FranjaIcon({ id, size = 20 }: { id: string; size?: number }) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
    }
    if (id === "manana")
        return (
            <svg {...common}>
                <path d="M12 2v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="M20 12h2" />
                <path d="m19.07 4.93-1.41 1.41" />
                <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
                <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
            </svg>
        )
    if (id === "tarde")
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
            </svg>
        )
    return (
        <svg {...common}>
            <path d="M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6Z" />
            <path d="M10.1 9A6 6 0 0 1 16 4a4.24 4.24 0 0 0 6 6 6 6 0 0 1-3 5.197" />
        </svg>
    )
}

function HorarioBlock({
    accent,
    loading,
    error,
    hora,
    onSelect,
    mostrarFiltroFranja,
    franjaGrupos,
    mostrarListaEspera,
    espera,
}: any) {
    const seccionRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
    const horariosRef = React.useRef<HTMLDivElement | null>(null)
    const [mostrarFiltroSticky, setMostrarFiltroSticky] = React.useState(false)
    const filtroStickyEvaluado = React.useRef(false)
    const bloqueoScrollHasta = React.useRef(0)
    const [franjaActivaState, setFranjaActivaState] = React.useState("")
    // Franja que se resalta unos segundos después de tocar la botonera
    const [franjaResaltada, setFranjaResaltada] = React.useState("")
    const resaltadoTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
        null
    )
    React.useEffect(
        () => () => {
            if (resaltadoTimer.current) clearTimeout(resaltadoTimer.current)
        },
        []
    )

    // La decisión se toma una sola vez según si el final de los horarios queda
    // fuera del primer viewport. Así no cambia al movernos por la página.
    React.useEffect(() => {
        if (filtroStickyEvaluado.current) return
        if (typeof window === "undefined") return
        const elemento = horariosRef.current
        if (!elemento) return
        filtroStickyEvaluado.current = true
        const esMobile = window.matchMedia("(max-width: 860px)").matches
        const horariosQuedanFueraDelViewport =
            elemento.getBoundingClientRect().bottom > window.innerHeight
        setMostrarFiltroSticky(esMobile && horariosQuedanFueraDelViewport)
    }, [loading, error, mostrarListaEspera, franjaGrupos])

    const franjaActiva = franjaGrupos.some(
        (g: any) => g.id === franjaActivaState
    )
        ? franjaActivaState
        : franjaGrupos[0]?.id

    // El scroll es el natural de la página: se escucha el scroll (en
    // captura, para que funcione aunque Framer scrollee dentro de otro
    // contenedor) y se marca como activa la última franja cuyo título ya
    // pasó el 35% superior de la pantalla.
    React.useEffect(() => {
        if (typeof window === "undefined" || franjaGrupos.length < 2) return
        const calcular = () => {
            if (Date.now() < bloqueoScrollHasta.current) return
            const umbral = window.innerHeight * 0.35
            let actual = franjaGrupos[0].id
            for (const g of franjaGrupos) {
                const el = seccionRefs.current[g.id]
                if (el && el.getBoundingClientRect().top <= umbral)
                    actual = g.id
            }
            setFranjaActivaState(actual)
        }
        window.addEventListener("scroll", calcular, {
            passive: true,
            capture: true,
        })
        window.addEventListener("resize", calcular)
        return () => {
            window.removeEventListener("scroll", calcular, true)
            window.removeEventListener("resize", calcular)
        }
    }, [franjaGrupos])

    function irAFranja(id: string) {
        const el = seccionRefs.current[id]
        if (!el) return
        setFranjaActivaState(id)
        bloqueoScrollHasta.current = Date.now() + 1000
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        setFranjaResaltada(id)
        if (resaltadoTimer.current) clearTimeout(resaltadoTimer.current)
        resaltadoTimer.current = setTimeout(() => setFranjaResaltada(""), 2800)
    }

    if (loading) return <div style={statusStyle}>Cargando horarios...</div>
    if (error)
        return <div style={{ ...statusStyle, color: "#e55" }}>{error}</div>
    if (mostrarListaEspera) return <WaitlistForm {...espera} />
    if (franjaGrupos.length === 0)
        return (
            <div style={statusStyle}>
                No hay turnos disponibles para este día. Probá eligiendo otra
                fecha.
            </div>
        )

    const mostrarTitulos = franjaGrupos.length > 1

    return (
        <div
            ref={horariosRef}
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                // La botonera se "mete" en el padding lateral del componente
                // para quedar más pegada al borde derecho y darle más ancho
                // a los horarios.
                marginRight: -10,
                minWidth: 0,
            }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                {franjaGrupos.map((g: any, i: number) => (
                    <div
                        key={g.id}
                        ref={(el) => {
                            seccionRefs.current[g.id] = el
                        }}
                        style={{
                            marginTop: i === 0 ? 0 : 22,
                            scrollMarginTop: 16,
                        }}
                    >
                        {mostrarTitulos && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    marginBottom: 10,
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color:
                                        franjaResaltada === g.id
                                            ? accent
                                            : "var(--bf-text-muted)",
                                    transition: "color .3s",
                                }}
                            >
                                <FranjaIcon id={g.id} size={15} />
                                {FRANJA_LABELS[g.id]}
                            </div>
                        )}
                        <div className="bf-times-grid"
                            style={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${COLUMNAS_HORARIOS}, minmax(0, 1fr))`,
                                gap: GRID_GAP,
                            }}
                        >
                            {g.slots.map((slot: Slot) => {
                                const isSelected = hora === slot.hora
                                const resaltado =
                                    franjaResaltada === g.id && !isSelected
                                return (
                                    <motion.button
                                        key={slot.hora}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() =>
                                            onSelect(slot.hora, slot.equipo_id)
                                        }
                                        style={{
                                            boxSizing: "border-box",
                                            minWidth: 0,
                                            padding: "13px 8px",
                                            borderRadius: 12,
                                            fontWeight: 600,
                                            fontSize: 14,
                                            fontFamily: "inherit",
                                            fontVariantNumeric: "tabular-nums",
                                            textAlign: "center",
                                            cursor: "pointer",
                                            border: "none",
                                            backgroundColor: isSelected
                                                ? accent
                                                : resaltado
                                                  ? withAlpha(accent, "26")
                                                  : "var(--bf-card-bg)",
                                            boxShadow: resaltado
                                                ? `inset 0 0 0 1.5px ${accent}`
                                                : "inset 0 0 0 1.5px transparent",
                                            transition:
                                                "background-color .3s, box-shadow .3s",
                                            color: isSelected
                                                ? "#FFF"
                                                : "var(--bf-text)",
                                        }}
                                    >
                                        {slot.hora}
                                    </motion.button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
            {mostrarFiltroFranja && mostrarFiltroSticky && (
                <div
                    role="tablist"
                    aria-label="Ir a mañana, tarde o noche"
                    style={{
                        flexShrink: 0,
                        // sticky: acompaña al usuario mientras scrollea la página
                        position: "sticky",
                        top: "max(16px, calc(50vh - 60px))",
                        alignSelf: "flex-start",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: 4,
                        borderRadius: 999,
                        border: "1.5px solid var(--bf-text-faint)",
                        boxSizing: "border-box",
                    }}
                >
                    {franjaGrupos.map((g: any) => {
                        const activa = g.id === franjaActiva
                        return (
                            <motion.button
                                key={g.id}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => irAFranja(g.id)}
                                aria-label={`Ir a ${FRANJA_LABELS[g.id].toLowerCase()}`}
                                aria-selected={activa}
                                role="tab"
                                style={{
                                    width: 34,
                                    height: 34,
                                    padding: 0,
                                    borderRadius: "50%",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: activa
                                        ? accent
                                        : "transparent",
                                    color: activa
                                        ? "#FFF"
                                        : "var(--bf-text-muted)",
                                    transition:
                                        "background-color .2s, color .2s",
                                }}
                            >
                                <FranjaIcon id={g.id} />
                            </motion.button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function WaitlistForm({
    accent,
    nombre,
    setNombre,
    email,
    setEmail,
    onSubmit,
    submitting,
    error,
    success,
}: {
    accent: string
    nombre: string
    setNombre: (v: string) => void
    email: string
    setEmail: (v: string) => void
    onSubmit: () => void
    submitting: boolean
    error: string | null
    success: boolean
}) {
    if (success) {
        return (
            <div style={waitlistCard}>
                <div
                    style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--bf-text)",
                    }}
                >
                    ¡Listo, te anotamos!
                </div>
                <div style={{ fontSize: 12.5, color: "var(--bf-text-muted)" }}>
                    Si se libera un turno ese día, te avisamos por email.
                </div>
            </div>
        )
    }
    return (
        <div style={waitlistCard}>
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--bf-text)",
                }}
            >
                No quedan turnos libres
            </div>
            <div style={{ fontSize: 12.5, color: "var(--bf-text-muted)" }}>
                Anotate en la lista de espera y te avisamos apenas se libere un
                lugar.
            </div>
            <input
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                style={waitlistInput}
            />
            <input
                type="email"
                placeholder="Tu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={waitlistInput}
            />
            {error && (
                <div style={{ fontSize: 12, color: "#E55" }}>{error}</div>
            )}
            <FillButton
                onClick={onSubmit}
                disabled={submitting}
                fill={accent}
                style={{
                    width: "100%",
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 13.5,
                    fontWeight: 700,
                    marginTop: 4,
                }}
            >
                {submitting ? "Enviando..." : "Anotarme en la lista de espera"}
            </FillButton>
        </div>
    )
}

function TextInput({
    placeholder,
    value,
    onChange,
    onBlur,
    accent,
    error,
}: any) {
    const [focused, setFocused] = React.useState(false)
    const border = error
        ? "#EF4444"
        : focused
          ? accent
          : "var(--bf-border-strong)"
    return (
        <div style={{ width: "100%", minWidth: 0 }}>
            <input
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                    setFocused(false)
                    onBlur?.()
                }}
                style={{
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                    padding: 12,
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    fontSize: 14,
                    outline: "none",
                    fontFamily: "inherit",
                    background: "var(--bf-input-bg, transparent)",
                    color: "var(--bf-text)",
                }}
            />
            {error && (
                <p
                    style={{
                        margin: "4px 0 0 2px",
                        fontSize: 11,
                        color: "#EF4444",
                    }}
                >
                    {error}
                </p>
            )}
        </div>
    )
}

function TelInput({
    pais,
    setPais,
    dropdownOpen,
    setDropdownOpen,
    btnRef,
    value,
    onChange,
    onBlur,
    accent,
    error,
}: any) {
    const [focused, setFocused] = React.useState(false)
    const border = error
        ? "#EF4444"
        : focused
          ? accent
          : "var(--bf-border-strong)"
    return (
        <div style={{ width: "100%", minWidth: 0 }}>
            <div
                style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderRadius: 10,
                    border: `1px solid ${border}`,
                    minWidth: 0,
                    width: "100%",
                    boxSizing: "border-box",
                    background: "var(--bf-input-bg, transparent)",
                }}
            >
                <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                        ref={btnRef}
                        type="button"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "12px 10px",
                            background: "none",
                            border: "none",
                            borderRight: `1px solid ${border}`,
                            cursor: "pointer",
                            fontSize: 14,
                        }}
                    >
                        <img
                            className="bf-flag-emoji"
                            src={flagUrl(pais.code)}
                            alt={pais.code}
                        />
                        <span style={{ fontSize: 9, color: "var(--bf-text)" }}>
                            ▾
                        </span>
                    </button>
                    {dropdownOpen && (
                        <div
                            className="bf-scroll-list"
                            style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                marginTop: 4,
                                width: 220,
                                maxWidth: "calc(100vw - 32px)",
                                maxHeight: 220,
                                overflowY: "auto",
                                background: "var(--bf-panel-bg, #fff)",
                                border: "1px solid var(--bf-border)",
                                borderRadius: 10,
                                boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                                zIndex: 50,
                            }}
                        >
                            {PAISES.map((c) => (
                                <div
                                    key={c.code}
                                    onClick={() => {
                                        setPais(c)
                                        setDropdownOpen(false)
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "8px 12px",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        color: "var(--bf-text)",
                                        background:
                                            pais.code === c.code
                                                ? accent + "18"
                                                : "transparent",
                                    }}
                                >
                                    <img
                                        src={flagUrl(c.code)}
                                        alt={c.code}
                                        style={{
                                            width: 20,
                                            height: 14,
                                            borderRadius: 2,
                                            objectFit: "cover",
                                            flexShrink: 0,
                                            boxShadow:
                                                "0 0 0 1px rgba(0,0,0,0.08)",
                                        }}
                                    />
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        {c.name}
                                    </span>
                                    <span
                                        style={{
                                            color: "var(--bf-text-faint)",
                                            fontSize: 12,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {c.dial}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Número de teléfono"
                    value={value}
                    onChange={(e) =>
                        onChange(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false)
                        onBlur?.()
                    }}
                    style={{
                        flex: "1 1 0%",
                        minWidth: 0,
                        width: "100%",
                        padding: 12,
                        border: "none",
                        outline: "none",
                        fontSize: 14,
                        fontFamily: "inherit",
                        background: "transparent",
                        color: "var(--bf-text)",
                    }}
                />
            </div>
            {error && (
                <p
                    style={{
                        margin: "4px 0 0 2px",
                        fontSize: 11,
                        color: "#EF4444",
                    }}
                >
                    {error}
                </p>
            )}
        </div>
    )
}

// ────────────────────────────────────────────────────────────
// Extras — ticker horizontal.
// Si el contenido entra en el ancho disponible, se muestra como
// una fila estática (sin animación, sin scroll). Si NO entra
// (el "stack" supera el ancho máximo), se duplica el contenido
// y se activa un ticker continuo en una sola dirección (hacia la
// izquierda, sin ida y vuelta): cuando el scroll llega a la mitad
// del contenido duplicado, se resetea instantáneamente a 0 — como
// el contenido está repetido, el salto es invisible y da la
// sensación de loop infinito. Tocar/arrastrar el stack pausa el
// ticker 3 segundos. El contenedor externo tiene un ancho máximo
// fijo y `overflow: hidden`, así el ticker nunca puede desbordar
// el layout, ni en mobile ni en desktop.
// ────────────────────────────────────────────────────────────
function ExtrasBlock({
    accent,
    loading,
    extras,
    seleccionados,
    onToggle,
    onCantidad,
    placeholderImage,
}: {
    accent: string
    loading: boolean
    extras: Extra[]
    seleccionados: ExtraSeleccionado[]
    onToggle: (extra: Extra) => void
    onCantidad: (extra: Extra, cambio: number) => void
    placeholderImage?: string
}) {
    const outerRef = React.useRef<HTMLDivElement>(null)
    const trackRef = React.useRef<HTMLDivElement>(null)
    const offsetRef = React.useRef(0)
    const pausedRef = React.useRef(false)
    const rafRef = React.useRef<number | null>(null)
    const resumeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
        null
    )
    const [necesitaTicker, setNecesitaTicker] = React.useState(false)
    const [desktop,setDesktop]=React.useState(false)
    React.useEffect(()=>{const media=window.matchMedia("(min-width: 861px)");const sync=()=>setDesktop(media.matches);sync();media.addEventListener("change",sync);return ()=>media.removeEventListener("change",sync)},[])
    const VELOCIDAD = 0.35 // px por frame, igual que ExtrasCarousel

    // Mide, después de cada render (y ante cambios de tamaño de
    // pantalla), si el contenido real ocupa más ancho que el
    // disponible. outerRef siempre contiene UNA sola copia de las
    // tarjetas, así la medición no se ve afectada por la
    // duplicación que se agrega para el loop.
    // Además de la medición inmediata y el ResizeObserver, se hace
    // una remedición corta después del montaje (setTimeout 60ms) y
    // otra al evento "load" de la ventana: esto cubre el caso en que
    // el layout todavía no está asentado en el primer frame (fuentes
    // cargando, animación de entrada del paso de checkout, etc.) y
    // la primera medición da un ancho incorrecto.
    React.useEffect(() => {
        const outerEl = outerRef.current
        if (!outerEl) return

        function medir() {
            if (!outerEl) return
            const overflow = outerEl.scrollWidth > outerEl.clientWidth + 1
            setNecesitaTicker(overflow)
        }

        medir()
        const t1 = setTimeout(medir, 60)
        const t2 = setTimeout(medir, 350)
        const ro = new ResizeObserver(medir)
        ro.observe(outerEl)
        window.addEventListener("resize", medir)
        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
            ro.disconnect()
            window.removeEventListener("resize", medir)
        }
    }, [extras])

    // Reinicia el offset cada vez que cambia la lista de extras
    // (mismo patrón que ExtrasCarousel al cambiar de servicio), para
    // no arrancar el loop desde una posición vieja.
    React.useEffect(() => {
        offsetRef.current = 0
        if (trackRef.current)
            trackRef.current.style.transform = "translateX(0px)"
    }, [extras])

    // Loop del ticker: exactamente el mismo mecanismo que usa
    // ExtrasCarousel — mueve un `translateX` sobre el track (en vez
    // de scrollLeft) y, al llegar a la mitad del contenido duplicado
    // (fin de la primera copia), reacomoda el offset sin que se note
    // el salto, porque la segunda copia es idéntica.
    React.useEffect(() => {
        if (!necesitaTicker || desktop) return

        function step() {
            if (trackRef.current && !pausedRef.current) {
                offsetRef.current -= VELOCIDAD
                const mitad = trackRef.current.scrollWidth / 2
                if (mitad > 0 && -offsetRef.current >= mitad) {
                    offsetRef.current += mitad
                }
                trackRef.current.style.transform = `translateX(${offsetRef.current}px)`
            }
            rafRef.current = requestAnimationFrame(step)
        }
        rafRef.current = requestAnimationFrame(step)
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [necesitaTicker, extras, desktop])

    function pausarAuto() {
        pausedRef.current = true
        if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    }
    function reanudarAutoLuego() {
        if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
        // se frena 700ms desde que el usuario suelta/deja de tocar,
        // igual que ExtrasCarousel
        resumeTimeoutRef.current = setTimeout(() => {
            pausedRef.current = false
        }, 700)
    }

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    gap: 10,
                    width: "100%",
                    maxWidth: 416,
                    boxSizing: "border-box",
                }}
            >
                <div style={{ width: 130, flexShrink: 0 }}>
                    <Skeleton h={150} r={14} />
                </div>
                <div style={{ width: 130, flexShrink: 0 }}>
                    <Skeleton h={150} r={14} />
                </div>
            </div>
        )
    }
    const estaSeleccionado = (id: string) =>
        seleccionados.some((s) => s.id === id)

    // Cuando el ticker está activo duplicamos las tarjetas para
    // el loop infinito; si no hace falta, se muestra una sola vez.
    const itemsARenderizar = necesitaTicker && !desktop ? [...extras, ...extras] : extras

    function renderCard(extra: Extra, key: string) {
        const activo = estaSeleccionado(extra.id)
        const cantidad = seleccionados.find(s=>s.id===extra.id)?.cantidad || 0
        return (
            <div
                key={key}
                style={{
                    width: 132,
                    flexShrink: 0,
                    border: activo
                        ? `1.5px solid ${accent}`
                        : "1.5px solid var(--bf-border)",
                    borderRadius: 14,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    background: "var(--bf-card-bg, #fff)",
                }}
            >
                <div
                    style={{
                        width: "100%",
                        height: 96,
                        background: "var(--bf-border)",
                        position: "relative",
                    }}
                >
                    {extra.imagen_url ? (
                        <img
                            src={extra.imagen_url}
                            alt={extra.nombre}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                            }}
                        />
                    ) : placeholderImage ? (
                        <img
                            src={placeholderImage}
                            alt=""
                            style={{
                                width: "50%",
                                height: "50%",
                                opacity: 0.4,
                                margin: "25% auto",
                                display: "block",
                            }}
                        />
                    ) : null}
                    <div
                        style={{
                            position: "absolute",
                            bottom: 6,
                            left: 6,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.92)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#111827",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                        }}
                    >
                        {formatearMoneda(Number(extra.precio) || 0)}
                    </div>
                </div>
                <div
                    style={{
                        padding: "8px 10px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                    }}
                >
                    <div
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--bf-text)",
                            lineHeight: 1.3,
                            minHeight: "2.6em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                        }}
                    >
                        {extra.nombre}
                    </div>
                    {activo ? <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:4,border:"1px solid var(--bf-border-strong)",borderRadius:8,padding:2}}>
                        <button type="button" aria-label={`Quitar una unidad de ${extra.nombre}`} onClick={()=>onCantidad(extra,-1)} style={{width:30,height:28,border:0,borderRadius:6,background:"transparent",color:"var(--bf-text)",fontSize:18,cursor:"pointer"}}>−</button>
                        <span aria-live="polite" style={{fontSize:12,fontWeight:700,color:"var(--bf-text)"}}>{cantidad}</span>
                        <button type="button" aria-label={`Agregar una unidad de ${extra.nombre}`} disabled={cantidad>=99} onClick={()=>onCantidad(extra,1)} style={{width:30,height:28,border:0,borderRadius:6,background:accent,color:"white",fontSize:18,cursor:cantidad>=99 ? "default" : "pointer",opacity:cantidad>=99 ? .5 : 1}}>+</button>
                    </div> : <button
                        onClick={() => onToggle(extra)}
                        style={{
                            width: "100%",
                            padding: "6px 0",
                            borderRadius: 8,
                            border: activo
                                ? "none"
                                : "1px solid var(--bf-border-strong)",
                            background: activo ? accent : "transparent",
                            color: activo ? "#fff" : "var(--bf-text)",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        {activo ? "Agregado" : "+ Agregar"}
                    </button>}

                </div>
            </div>
        )
    }

    return (
        <div
            ref={outerRef}
            className="bf-extras-desktop-wrap"
            onPointerDown={pausarAuto}
            onPointerUp={reanudarAutoLuego}
            onPointerLeave={reanudarAutoLuego}
            onTouchStart={pausarAuto}
            onTouchEnd={reanudarAutoLuego}
            onWheel={pausarAuto}
            style={{
                width: "100%",
                maxWidth: 416, // ancho fijo: 3 tarjetas de 132px + 2 gaps de 10px
                minWidth: 0,
                overflow: "hidden",
                boxSizing: "border-box",
                // mismo fade en los bordes que usa ExtrasCarousel
                WebkitMaskImage: necesitaTicker
                    ? "linear-gradient(90deg, transparent, black 20px, black calc(100% - 20px), transparent)"
                    : undefined,
                maskImage: necesitaTicker
                    ? "linear-gradient(90deg, transparent, black 20px, black calc(100% - 20px), transparent)"
                    : undefined,
            }}
        >
            <div
                ref={trackRef}
                className="bf-extras-row"
                style={{
                    display: "flex",
                    gap: 10,
                    width: necesitaTicker ? "max-content" : "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    justifyContent: necesitaTicker ? "flex-start" : "center",
                    willChange: necesitaTicker ? "transform" : undefined,
                }}
            >
                {itemsARenderizar.map((extra, i) =>
                    renderCard(
                        extra,
                        necesitaTicker ? `${extra.id}-${i}` : extra.id
                    )
                )}
            </div>
        </div>
    )
}

function PagoBlock({
    metodos,
    seleccionado,
    onSelect,
    logos,
    iconoAdjuntar,
    datosBancarios,
    comprobante,
    errorArchivo,
    onArchivo,
    onQuitarArchivo,
    esSena,
    montoATransferir,
    montoPendienteEnLocal,
    accent,
}: any) {
    if (metodos.length === 0) return null
    const transferenciaActiva = seleccionado === "transferencia"
    const visibles = transferenciaActiva
        ? metodos.filter((m: any) => m.key === "transferencia")
        : metodos
    const hayDatosBancarios =
        datosBancarios &&
        (datosBancarios.banco ||
            datosBancarios.titular ||
            datosBancarios.cbu ||
            datosBancarios.alias)

    return (
        <motion.div
            layout
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minWidth: 0,
                width: "100%",
            }}
        >
            <AnimatePresence mode="popLayout" initial={false}>
                {visibles.map((m: any) => {
                    const activo = seleccionado === m.key
                    const esUnica = metodos.length === 1
                    return (
                        <motion.div
                            key={m.key}
                            layout
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            onClick={() => !esUnica && onSelect(m.key)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px 14px",
                                borderRadius: 12,
                                border: activo
                                    ? "1.5px solid #111827"
                                    : "1.5px solid #E5E7EB",
                                background: activo ? "#F9FAFB" : "#FFFFFF",
                                cursor: esUnica ? "default" : "pointer",
                                minWidth: 0,
                                boxSizing: "border-box",
                            }}
                        >
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    background: "#F3F4F6",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                    flexShrink: 0,
                                }}
                            >
                                {logos[m.key] ? (
                                    <img
                                        src={logos[m.key]}
                                        alt={m.label}
                                        style={{
                                            width: 20,
                                            height: 20,
                                            objectFit: "contain",
                                        }}
                                    />
                                ) : (
                                    <span style={{ fontSize: 17 }}>
                                        {m.emoji}
                                    </span>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#111827",
                                    }}
                                >
                                    {m.label}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        color: "#6B7280",
                                        overflowWrap: "break-word",
                                    }}
                                >
                                    {m.detalle}
                                </div>
                            </div>
                            {!esUnica && (
                                <div
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: "50%",
                                        border: activo
                                            ? "6px solid #111827"
                                            : "1.5px solid #D1D5DB",
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                        </motion.div>
                    )
                })}

                {seleccionado === "transferencia" && (
                    <motion.div
                        key="detalle-transferencia"
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            padding: "10px 12px",
                            borderRadius: 12,
                            background: "#F9FAFB",
                            border: "1.5px solid #E5E7EB",
                            minWidth: 0,
                            boxSizing: "border-box",
                        }}
                    >
                        {/* FIX-SEÑA: si el negocio cobra con seña, se
                            repite acá — justo al lado de los datos
                            bancarios, en el punto donde el cliente
                            realmente hace la transferencia — cuánto
                            corresponde transferir ahora y cuánto queda
                            para pagar en el local. Antes este dato solo
                            estaba en el resumen de arriba, separado del
                            formulario, lo que generaba confusión sobre
                            si había que transferir el total o la seña. */}
                        {esSena && montoATransferir != null && (
                            <div
                                style={{
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    background: "#F3F4F6",
                                    border: "1.5px solid #D1D5DB",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: "#111827",
                                    }}
                                >
                                    Transferí{" "}
                                    {formatearMoneda(montoATransferir)}{" "}
                                    <span
                                        style={{
                                            fontWeight: 500,
                                            color: "#6B7280",
                                        }}
                                    >
                                        (seña para reservar)
                                    </span>
                                </div>
                                {montoPendienteEnLocal != null &&
                                    montoPendienteEnLocal > 0 && (
                                        <div
                                            style={{
                                                fontSize: 11.5,
                                                color: "#6B7280",
                                                marginTop: 2,
                                            }}
                                        >
                                            El resto (
                                            {formatearMoneda(
                                                montoPendienteEnLocal
                                            )}
                                            ) se abona en el local.
                                        </div>
                                    )}
                            </div>
                        )}
                        {hayDatosBancarios && (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 3,
                                    fontSize: 12.5,
                                    color: "#111827",
                                    wordBreak: "break-word",
                                    overflowWrap: "break-word",
                                }}
                            >
                                {datosBancarios.banco && (
                                    <span>
                                        <strong>Banco:</strong>{" "}
                                        {datosBancarios.banco}
                                    </span>
                                )}
                                {datosBancarios.titular && (
                                    <span>
                                        <strong>Titular:</strong>{" "}
                                        {datosBancarios.titular}
                                    </span>
                                )}
                                {datosBancarios.alias && (
                                    <span>
                                        <strong>Alias:</strong>{" "}
                                        {datosBancarios.alias}
                                    </span>
                                )}
                                {datosBancarios.cbu && (
                                    <span>
                                        <strong>CBU:</strong>{" "}
                                        {datosBancarios.cbu}
                                    </span>
                                )}
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            id="bf-comprobante-input"
                            style={{ display: "none" }}
                            onChange={(e) =>
                                onArchivo(e.target.files?.[0] || null)
                            }
                        />
                        {!comprobante ? (
                            <label
                                htmlFor="bf-comprobante-input"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 8,
                                    padding: 10,
                                    borderRadius: 10,
                                    border: "1.5px dashed #D1D5DB",
                                    background: "#FFFFFF",
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: "#111827",
                                    cursor: "pointer",
                                }}
                            >
                                {iconoAdjuntar ? (
                                    <img
                                        src={iconoAdjuntar}
                                        alt=""
                                        style={{ width: 20, height: 20 }}
                                    />
                                ) : (
                                    <span>📎</span>
                                )}
                                Adjuntar comprobante
                            </label>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "1.5px solid #111827",
                                    background: "#FFFFFF",
                                    fontSize: 12.5,
                                    minWidth: 0,
                                    color: "#111827",
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 600,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        minWidth: 0,
                                    }}
                                >
                                    {comprobante.name}
                                </span>
                                <button
                                    onClick={onQuitarArchivo}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "#6B7280",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        flexShrink: 0,
                                    }}
                                >
                                    Quitar
                                </button>
                            </div>
                        )}
                        {errorArchivo && (
                            <span style={{ fontSize: 11.5, color: "#DC2626" }}>
                                {errorArchivo}
                            </span>
                        )}
                        <span
                            style={{
                                fontSize: 11.5,
                                color: "#6B7280",
                            }}
                        >
                            Tu turno queda como "pendiente" hasta que el negocio
                            confirme el pago.
                        </span>
                    </motion.div>
                )}

                {seleccionado === "efectivo" && (
                    <motion.span
                        key="nota-efectivo"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: 12, color: "#6B7280" }}
                    >
                        Tu turno queda como "pendiente" hasta que el negocio lo
                        confirme.
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function FilaResumen({ label, valor }: { label: string; valor: string }) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                width: "100%",
                minWidth: 0,
            }}
        >
            <div
                style={{
                    fontSize: 14,
                    color: "#6B7280",
                    minWidth: 0,
                    overflowWrap: "break-word",
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#111827",
                    textAlign: "right",
                    flexShrink: 0,
                }}
            >
                {valor}
            </div>
        </div>
    )
}

const wrapperStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 440,
    margin: "0 auto",
    padding: "0 18px",
    display: "flex",
    flexDirection: "column",
    gap: 22,
    boxSizing: "border-box",
}
const statusStyle: React.CSSProperties = {
    textAlign: "center",
    padding: 24,
    color: "var(--bf-text-faint, #94a3b8)",
    fontSize: 13,
}
const waitlistCard: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 18,
    borderRadius: 16,
    border: "1px solid var(--bf-border)",
    backgroundColor: "var(--bf-card-bg, #FAFAFA)",
    textAlign: "center",
}
const waitlistInput: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 10,
    border: "1px solid var(--bf-border-strong, #E5E5E5)",
    fontSize: 13,
    outline: "none",
    background: "var(--bf-input-bg, transparent)",
    color: "var(--bf-text)",
}
const btnPrimario: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
    border: "none",
    cursor: "pointer",
}
const btnSecundario: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    color: "#6B7280",
    background: "transparent",
    border: "1px solid #E5E7EB",
    cursor: "pointer",
}




// Los campos sensibles pertenecen al SDK de MP; Turnits recibe solamente el token.
let bookingMpSdkPromise: Promise<void> | null = null
function loadBookingMpSdk(): Promise<void> {
    if((window as any).MercadoPago)return Promise.resolve()
    if(!bookingMpSdkPromise)bookingMpSdkPromise=new Promise((resolve,reject)=>{
        const script=document.createElement("script")
        script.src="https://sdk.mercadopago.com/js/v2"
        script.onload=()=>resolve()
        script.onerror=()=>{script.remove();bookingMpSdkPromise=null;reject(new Error("No se pudo cargar el formulario de tarjeta."))}
        document.head.appendChild(script)
    })
    return bookingMpSdkPromise
}
function BookingCardPayment({session,api,accent,onClose}:any) {
    const [message,setMessage]=React.useState("")
    const [ready,setReady]=React.useState(false)
    const [busy,setBusy]=React.useState(false)
    const [state,setState]=React.useState("idle")
    const busyRef=React.useRef(false)
    const stateRef=React.useRef("idle")
    const container=React.useRef("turnits-card-"+Math.random().toString(36).slice(2))
    const resultRef=React.useRef<(d:any)=>void>(()=>{})
    resultRef.current=(data:any)=>{
        if(data.success_url){window.location.href=data.success_url;return}
        const next=data.status || "unknown"
        stateRef.current=next;setState(next)
        setMessage(data.message || data.error || "Consultá el estado antes de volver a pagar.")
    }
    React.useEffect(()=>{
        let cancelled=false,controller:any=null
        loadBookingMpSdk().then(async()=>{
            if(cancelled)return
            const mp=new (window as any).MercadoPago(session.public_key,{locale:"es-AR"})
            const instance=await mp.bricks().create("cardPayment",container.current,{
                initialization:{amount:session.monto,payer:{email:session.email}},
                customization:{visual:{hideFormTitle:true,style:{theme:"default",customVariables:{baseColor:accent,borderRadiusMedium:"12px"}}}},
                callbacks:{
                    onReady:()=>{if(!cancelled)setReady(true)},
                    onError:()=>{if(!cancelled)setMessage("Revisá los datos. Si el formulario no carga, podés pagar con la opción Mercado Pago.")},
                    onSubmit:async(card:any)=>{
                        if(busyRef.current || stateRef.current!=="idle")throw new Error("Consultá el estado del pago.")
                        busyRef.current=true;setBusy(true);setMessage("")
                        try{
                            const response=await fetch(api+"/api/card-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkout_token:session.checkout_token,card})})
                            const data=await response.json()
                            if(cancelled)return
                            resultRef.current(data)
                            if(!response.ok)throw new Error("No se pudo confirmar el pago.")
                        }catch(e){if(!cancelled && stateRef.current==="idle")resultRef.current({status:"unknown",message:"No pudimos confirmar el resultado. Consultá el estado antes de volver a pagar."});throw e}
                        finally{busyRef.current=false;if(!cancelled)setBusy(false)}
                    }
                }
            })
            if(cancelled)instance.unmount();else controller=instance
        }).catch(()=>{if(!cancelled)setMessage("No se pudo cargar el formulario. Volvé y elegí Mercado Pago.")})
        return()=>{cancelled=true;controller?.unmount()}
    },[session,api,accent])
    React.useEffect(()=>{
        if(state!=="pending" && state!=="unknown" && state!=="not_found")return
        let cancelled=false
        const timer=window.setInterval(()=>{
            if(busyRef.current)return
            fetch(api+"/api/card-payment/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkout_token:session.checkout_token})}).then(r=>r.json()).then(d=>{if(!cancelled && d.status && d.status!=="not_found")resultRef.current(d)}).catch(()=>{})
        },10000)
        return()=>{cancelled=true;window.clearInterval(timer)}
    },[state,api,session])
    async function checkStatus(){
        if(busyRef.current)return
        busyRef.current=true;setBusy(true)
        try{const r=await fetch(api+"/api/card-payment/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkout_token:session.checkout_token})});resultRef.current(await r.json())}
        catch{setMessage("No pudimos consultar el pago. Contactá al negocio antes de volver a pagar.")}
        finally{busyRef.current=false;setBusy(false)}
    }
    const unresolved=["pending","unknown","not_found","review"].includes(state)
    return <div role="dialog" aria-modal="true" aria-label="Pago con tarjeta" style={{position:"fixed",inset:0,zIndex:10001,background:"rgba(15,23,42,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
        <div style={{width:"100%",maxWidth:480,maxHeight:"calc(100dvh - 32px)",overflowY:"auto",background:"var(--bf-card-bg, #fff)",color:"var(--bf-text, #111827)",borderRadius:20,padding:24,boxShadow:"0 24px 80px rgba(0,0,0,.2)"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
                <strong style={{fontSize:19}}>Pagá con tarjeta</strong>
                {!busy && !unresolved && <button type="button" onClick={onClose} aria-label="Volver al checkout" style={{border:0,background:"transparent",color:"inherit",cursor:"pointer",fontSize:24}}>×</button>}
            </div>
            <p style={{fontSize:14}}>Importe a pagar: <strong>{formatearMoneda(session.monto)}</strong></p>
            {!ready && state==="idle" && <p>Cargando formulario seguro...</p>}
            <div id={container.current} style={{display:state==="idle"?"block":"none"}} />
            {busy && <p role="status">Procesando, esperá un momento...</p>}
            {message && <p role="status" style={{fontSize:13,lineHeight:1.5}}>{message}</p>}
            {unresolved && state!=="review" && <button type="button" disabled={busy} onClick={checkStatus} style={{background:accent,color:"#fff",border:0,borderRadius:10,padding:"12px 16px",cursor:"pointer"}}>Consultar estado del pago</button>}
            {(state==="rejected" || state==="not_charged") && <button type="button" onClick={onClose} style={{background:accent,color:"#fff",border:0,borderRadius:10,padding:"12px 16px",cursor:"pointer"}}>Volver al checkout</button>}
            <p style={{fontSize:11,color:"var(--bf-text-muted, #6b7280)",marginTop:16}}>Pago procesado por Mercado Pago. Turnits no guarda el número de tarjeta ni el CVV.</p>
        </div>
    </div>
}
