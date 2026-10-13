import { appConfig } from "../config"
import * as React from "react"

import { motion, AnimatePresence } from "framer-motion"

/* ════════════════════════════════════════════════════════════
   RegisterFlow — Code Component único de Framer
   ════════════════════════════════════════════════════════════
   Reemplaza a: withRegisterFree/withRegisterPremium (CheckoutOverrides
   de registro), InputUniversal (usado en los pasos de registro),
   TermsCheckbox, FlujoHorariosEngine.

   ESTÉTICA: tipografía Inter Display, verde de marca #1B6B1A,
   logo de marca configurable por prop, tarjetas de plan en una
   sola fila horizontal que nunca wrapea (en pantallas anchas).
   La lógica de negocio (fetch a /registro/iniciar, /registro/verificar,
   etc.) no cambió.

   ────────────────────────────────────────────────────────────
   FIX (versión 9) — RESPONSIVE REAL: se pasa de @media a
   @container. El problema reportado era que en desktop el
   componente se veía apilado igual que en mobile (o viceversa):
   con @media, el breakpoint reacciona al ancho de la VENTANA del
   navegador, no al ancho real que Framer le da al Frame que
   contiene este componente. Si el Frame está angosto en la versión
   Desktop del sitio (por estar en una columna, un layout dividido,
   etc.), @media seguía pensando que había espacio de sobra porque
   miraba el viewport completo, y el resultado no correspondía al
   tamaño real del componente en pantalla.

   Ahora se envuelve todo en un contenedor extra (.rf-container) con
   `container-type: inline-size`, y las reglas responsive pasan de
   `@media (max-width: Npx)` a `@container rf (max-width: Npx)`.
   Así el breakpoint reacciona al ancho REAL del propio componente,
   sin importar cuán ancha sea la ventana del navegador — el mismo
   Frame angosto en desktop ahora sí se apila, y el mismo Frame
   ancho en mobile (poco común, pero posible) queda en fila.

   Nota técnica: un elemento no puede usarse a sí mismo como
   contenedor de container query, por eso hace falta el wrapper
   .rf-container por fuera de .rf-wrapper (que es el que de verdad
   trae todo el contenido). container-type vive en .rf-container,
   las reglas @container siguen aplicando sobre las mismas clases
   internas de siempre (rf-wrapper, rf-plan-row, rf-plan-card, etc.)

   ────────────────────────────────────────────────────────────
   FIX (versión 8) — MOBILE ROTO EN TODO EL COMPONENTE, no solo en
   piezas sueltas. Causas encontradas y resueltas:

   1) FALTABA `box-sizing: border-box` a nivel global dentro del
      wrapper. Sin esto, cualquier elemento con `width:100%` +
      padding/border propios termina midiendo MÁS que su contenedor,
      y ese desborde se v­a acumulando piso por piso (input > fila >
      caja > wrapper). Esto es, con diferencia, la causa de que "todo"
      se vea mal en mobile y no un elemento puntual. Se agregó:
          .rf-wrapper, .rf-wrapper *, .rf-wrapper *::before, .rf-wrapper *::after
          { box-sizing: border-box; }

   2) El CTA de PlanCard forzaba `whiteSpace:"nowrap"` con textos
      largos ("Empezar Prueba Gratis"). En una tarjeta angosta (mobile,
      una sola columna) eso hace que el botón se estire más ancho que
      la tarjeta y la desborde. Se sacó el nowrap: ahora el texto puede
      partirse en 2 líneas si hace falta.

   3) `FillButton` tenía `minWidth: 140` fijo en INLINE STYLE. Una
      media/container query normal no puede pisar un inline style
      (gana por especificidad), así que ese mínimo se respetaba sí o
      sí, angostando de más la fila Volver/Continuar. Se le agregó
      className="rf-fillbtn" al botón y se sobreescribe
      min-width/padding/font-size con `!important` en el breakpoint
      chico — un inline SÍ puede ser pisado por una regla con
      !important, que es la técnica correcta acá.

   4) El wrapper solo ajustaba padding vertical en el breakpoint más
      chico; el padding horizontal (`max(20px, 5vw)`) quedaba igual
      siempre. En un viewport de 320px eso son 40px perdidos de los
      lados antes de que arranque cualquier contenido. Se agregó
      override de padding horizontal también.

   5) El círculo del StepTracker, al llegar a left:0% o left:100%,
      queda con la mitad afuera del track (se recortaba feo contra
      overflow:hidden del wrapper). Se resolvió reservando 17px
      (mitad del círculo) de cada lado del track para que el círculo
      SIEMPRE quede contenido, en cualquier ancho.

   6) El input de código (paso 4) y el selector de país+teléfono
      podían quedar muy apretados por debajo de 360px. Se agregaron
      reducciones extra de padding/tamaño en un breakpoint de 360px.

   Con estos cambios el componente ya no depende de "que Framer mida
   bien el Frame": el interior no desborda ni se aprieta, porque cada
   pieza respeta su propio contenedor con box-sizing correcto, Y
   ahora además la disposición fila/columna reacciona al ancho real
   del componente (container query) en vez del ancho de la ventana.

   NOTA APARTE (fuera del código): si en Framer el Frame que contiene
   este componente está configurado con `Width: Fixed` en vez de
   `Width: Fill`, el componente va a quedar siempre con ese ancho
   fijo — eso hay que corregirlo en el panel de Framer, no en el
   código.

   ────────────────────────────────────────────────────────────
   FIX (versión 5) — se saca el spotlight que seguía al cursor
   (quedaba raro / no pedido). Queda:

   1) Relleno de acento animado con scaleY, clippeado con
      overflow:hidden para respetar el border-radius — ESTE es
      el "frame que sube" y cubre todo el fondo del botón en
      hover, con el texto pasando a blanco.
   2) Ripple de click: al hacer mousedown/touchstart se guarda el
      punto exacto del click y se monta un motion.span circular
      que nace del tamaño 0 en ese punto y crece/desvanece con
      framer-motion. Se desmonta solo después de la animación.
   3) Lift + sombra en hover, y scale-down en press, aplicados
      directo al <button> (transform/box-shadow con transition
      CSS, no motion, porque son valores del propio elemento y
      no necesitan orquestación con otras capas).

   COLOR DEL RELLENO: todos los botones usan el nuevo prop
   "Color acento" (acentoColor) para el relleno que sube en hover,
   EXCEPTO el botón "Volver" (BackButton), que se deja intacto
   usando el color principal (accentColor) como siempre.
   ════════════════════════════════════════════════════════════ */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 6
const MIN_TEL_DIGITOS = 7
const BORDER = "#E5E7EB"

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

// Textos de cada paso (encabezado tipo "Paso N: lead + highlight")
const STEP_META = {
    personal: {
        lead: "Paso 1: Querémos",
        highlight: "Conocerte",
        label: "Información Personal",
        subtitle: "Se usará para contactarte",
    },
    negocio: {
        lead: "Paso 2: Contanos de",
        highlight: "tu Negocio",
        label: "Datos del Negocio",
        subtitle: "Vas a poder cambiarlo cuando quieras desde el panel",
    },
    verificar: {
        lead: "Paso 4: Verificá tu",
        highlight: "Cuenta",
        label: "Código de Verificación",
        subtitle: "Revisá tu email, puede tardar unos minutos",
    },
}

// Bandera SVG por código de país (ISO 3166-1 alpha-2), servida por
// flagcdn.com — mismo criterio que BookingFlow: evita depender de la
// fuente de emoji de banderas del sistema operativo (en Windows o
// algunos Android no renderiza bien y se ve como texto "AR").
function flagUrl(code) {
    return `https://flagcdn.com/${code.toLowerCase()}.svg`
}

function maskEmail(email) {
    return email.replace(
        /^(.{2})(.*)(@.*)$/,
        (_, a, b, c) => a + "*".repeat(Math.max(b.length, 3)) + c
    )
}

// ────────────────────────────────────────────────────────────
// Íconos
// ────────────────────────────────────────────────────────────
function BrandMark({ color = "#111827", size = 38 }) {
    // Marca tipo "ojo" — fallback cuando no se cargó un logo propio.
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <path
                d="M4 24C4 24 12 12 24 12C36 12 44 24 44 24C44 24 36 36 24 36C12 36 4 24 4 24Z"
                stroke={color}
                strokeWidth="2.2"
                strokeLinejoin="round"
            />
            <circle cx="24" cy="24" r="7" stroke={color} strokeWidth="2.2" />
            <circle cx="24" cy="24" r="2.6" fill={color} />
        </svg>
    )
}

// Logo de marca — si se carga una imagen por prop, se usa esa;
// si no, cae al ícono "ojo" (BrandMark) como antes.
function BrandLogo({ logoUrl, color = "#111827", size = 38 }) {
    if (logoUrl) {
        return (
            <img
                src={logoUrl}
                alt="Logo"
                style={{
                    width: size,
                    height: size,
                    objectFit: "contain",
                    display: "block",
                }}
            />
        )
    }
    return <BrandMark color={color} size={size} />
}

function StepIconSvg({ step, color = "#fff", size = 16 }) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
    }
    if (step === "personal")
        return (
            <svg {...common}>
                <circle
                    cx="12"
                    cy="8"
                    r="3.2"
                    stroke={color}
                    strokeWidth="1.8"
                />
                <path
                    d="M5 19c0-3.5 3-6 7-6s7 2.5 7 6"
                    stroke={color}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                />
            </svg>
        )
    if (step === "negocio")
        return (
            <svg {...common}>
                <path
                    d="M4 9l1-4h14l1 4M4 9h16M4 9v9a1 1 0 001 1h4v-5h6v5h4a1 1 0 001-1V9"
                    stroke={color}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </svg>
        )
    if (step === "plan")
        return (
            <svg {...common}>
                <path
                    d="M20.4 12.3L12 20.7a1.5 1.5 0 01-2.1 0l-7-7a1.5 1.5 0 010-2.1L11.3 3.2a1.5 1.5 0 011.1-.4h6.5A1.6 1.6 0 0120.5 4.4v6.5c0 .4-.1.8-.4 1.1z"
                    stroke={color}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                />
                <circle cx="15.5" cy="8.5" r="1.4" fill={color} />
            </svg>
        )
    return (
        <svg {...common}>
            <path
                d="M12 3.5l6.5 2.6v5.4c0 4.4-2.8 7.6-6.5 9-3.7-1.4-6.5-4.6-6.5-9V6.1L12 3.5z"
                stroke={color}
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
            <path
                d="M9 12l2 2 4-4"
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

function CheckIcon({ color = "#1B6B1A", size = 16 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            style={{ flexShrink: 0, marginTop: 1 }}
        >
            <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.6" />
            <path
                d="M8 12.5l2.5 2.5L16 9.5"
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

// ────────────────────────────────────────────────────────────
// UI compartida
// ────────────────────────────────────────────────────────────
// Botón con relleno animado (el "frame" que sube y ocupa todo el
// fondo del botón en hover) + ripple de click.
// TODO el efecto vive acá adentro, en React state + framer-motion.
// Nada de esto depende de un <style> externo cargando a tiempo ni
// de :hover en CSS: colores, padding y las capas absolutas están
// todas en JS/inline, así que siempre se ve bien y el efecto siempre
// corre. overflow:hidden + isolation:isolate en el botón aseguran
// que ninguna capa (relleno, ripple) se salga del border-radius,
// sin importar cuántas se sumen.
//
// FIX mobile: se agrega className="rf-fillbtn" para que el
// breakpoint chico pueda pisar con !important el minWidth/padding
// que acá abajo están en inline (un inline normal no se puede pisar
// desde CSS sin !important, por eso antes el botón no achicaba en
// mobile por más reglas que hubiera).
function FillButton({
    onClick,
    disabled = false,
    fill,
    children,
    style,
    variant = "solid",
}: { onClick?: React.MouseEventHandler<HTMLButtonElement>; disabled?: boolean; fill: string; children: React.ReactNode; style?: React.CSSProperties; variant?: "solid" | "outline" }) {
    const [pressed, setPressed] = React.useState(false)
    const [hovered, setHovered] = React.useState(false)
    const [ripples, setRipples] = React.useState([])
    const filled = !disabled && (hovered || pressed)
    const isOutline = variant === "outline"
    // outline: negro sobre blanco en reposo, blanco apenas el relleno
    // de acento empieza a subir (mismo trigger que la capa de relleno,
    // así el texto nunca queda ilegible contra el fondo de acento)
    const textColor = isOutline ? (filled ? "#fff" : "#111827") : "#fff"

    function spawnRipple(clientX, clientY, rect) {
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
                border: isOutline ? "1.5px solid #111827" : "none",
                background: isOutline ? "#fff" : "#000",
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

// Botón "Volver" — variante outline: fondo blanco, borde y texto
// negro en reposo. Conserva el mismo relleno de acento y ripple que
// el resto de los botones; el texto pasa a blanco recién cuando el
// relleno de acento sube encima. SIN CAMBIOS respecto a la versión
// anterior: sigue usando el color principal (fillColor), no el
// nuevo "color acento".
function BackButton({ onClick, fillColor, style }: { onClick: React.MouseEventHandler<HTMLButtonElement>; fillColor: string; style?: React.CSSProperties }) {
    return (
        <FillButton
            onClick={onClick}
            fill={fillColor}
            variant="outline"
            style={style}
        >
            Volver
        </FillButton>
    )
}

// Stepper: línea fina con un ícono circular que se desliza según el paso.
// FIX mobile: el track ahora reserva 17px (mitad del círculo de 34px) a
// cada lado, así el círculo nunca queda con la mitad afuera del wrapper
// en los extremos (stepIndex 0 o último paso), sin importar el ancho.
function StepTracker({ steps, stepIndex, accent }) {
    const pct = steps.length > 1 ? (stepIndex / (steps.length - 1)) * 100 : 0
    const CIRCLE = 34
    const HALF = CIRCLE / 2
    return (
        <div
            style={{
                width: "100%",
                padding: `0 ${HALF}px`,
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: 2,
                    background: BORDER,
                    borderRadius: 2,
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: `${pct}%`,
                        transform: "translate(-50%, -50%)",
                        width: CIRCLE,
                        height: CIRCLE,
                        borderRadius: "50%",
                        background: accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                        transition: "left 0.3s ease",
                    }}
                >
                    <StepIconSvg
                        step={steps[stepIndex]}
                        color="#fff"
                        size={16}
                    />
                </div>
            </div>
        </div>
    )
}

// Caja que agrupa varios campos con divisores internos (look "tabla")
function FieldBox({ children }) {
    return (
        <div
            style={{
                border: `1.5px solid ${BORDER}`,
                borderRadius: 16,
                overflow: "hidden",
                background: "#fff",
                width: "100%",
                boxSizing: "border-box",
            }}
        >
            {children}
        </div>
    )
}

function FieldRow({ children, noBorder = false, className }: { children: React.ReactNode; noBorder?: boolean; className?: string }) {
    return (
        <div
            className={className}
            style={{
                display: "flex",
                borderBottom: noBorder ? "none" : `1px solid ${BORDER}`,
                width: "100%",
                boxSizing: "border-box",
            }}
        >
            {children}
        </div>
    )
}

function FlatInput({
    placeholder,
    value,
    onChange,
    type = "text",
    inputMode,
    style,
    rightSlot,
}: { placeholder?: string; value: string; onChange: (value: string) => void; type?: React.HTMLInputTypeAttribute; inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"]; style?: React.CSSProperties; rightSlot?: React.ReactNode }) {
    return (
        <div
            style={{
                position: "relative",
                flex: 1,
                display: "flex",
                alignItems: "center",
                minWidth: 0,
            }}
        >
            <input
                className="rf-input"
                type={type}
                inputMode={inputMode}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    padding: "14px 16px",
                    fontSize: 14,
                    fontFamily: "inherit",
                    background: "transparent",
                    color: "#111827",
                    boxSizing: "border-box",
                    ...style,
                }}
            />
            {rightSlot}
        </div>
    )
}

function ErrorList({ errors }: { errors: Record<string, string> }) {
    const msgs = Object.values(errors || {}).filter(Boolean)
    if (!msgs.length) return null
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {msgs.map((m, i) => (
                <p
                    key={i}
                    style={{ margin: 0, fontSize: 11.5, color: "#EF4444" }}
                >
                    {m}
                </p>
            ))}
        </div>
    )
}

function CountrySelect({ pais, setPais, accentSoft }) {
    const [open, setOpen] = React.useState(false)
    return (
        <div
            style={{
                position: "relative",
                borderRight: `1px solid ${BORDER}`,
                flexShrink: 0,
            }}
        >
            <button
                type="button"
                className="rf-country-btn"
                onClick={() => setOpen(!open)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "14px 12px",
                    height: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                }}
            >
                <img
                    src={flagUrl(pais.code)}
                    alt={pais.code}
                    style={{
                        width: 20,
                        height: 14,
                        borderRadius: 2,
                        objectFit: "cover",
                        flexShrink: 0,
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
                    }}
                />
                <span
                    className="rf-country-dial"
                    style={{ fontSize: 12.5, color: "#6B7280" }}
                >
                    {pais.dial}
                </span>
                <span style={{ fontSize: 9, color: "#9CA3AF" }}>▾</span>
            </button>
            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 4,
                        width: "min(220px, 80vw)",
                        maxHeight: 220,
                        overflowY: "auto",
                        background: "#fff",
                        border: `1px solid ${BORDER}`,
                        borderRadius: 12,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                        zIndex: 50,
                    }}
                >
                    {PAISES.map((c) => (
                        <div
                            key={c.code}
                            onClick={() => {
                                setPais(c)
                                setOpen(false)
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontSize: 13,
                                background:
                                    pais.code === c.code
                                        ? accentSoft
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
                                    boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
                                }}
                            />
                            <span style={{ flex: 1 }}>{c.name}</span>
                            <span style={{ color: "#9CA3AF", fontSize: 12 }}>
                                {c.dial}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function PasswordFieldInline({ value, onChange }) {
    const [show, setShow] = React.useState(false)
    return (
        <FlatInput
            placeholder="Contraseña"
            type={show ? "text" : "password"}
            value={value}
            onChange={onChange}
            style={{ paddingRight: 40 }}
            rightSlot={
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    style={{
                        position: "absolute",
                        right: 14,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#9CA3AF",
                        display: "flex",
                    }}
                >
                    {show ? (
                        <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                    ) : (
                        <svg
                            width="17"
                            height="17"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    )}
                </button>
            }
        />
    )
}

// Tarjeta de plan — precio grande, checklist con ícono de check y botón
// negro/blanco con relleno de acento, igual que Continuar/Volver.
// Ancho y alto mínimo para que las tarjetas se estiren más en vez de
// quedar angostas/bajas en pantallas grandes. Los valores del
// breakpoint chico se pisan desde CSS (clase .rf-plan-card), no
// desde acá — así cuando el componente tiene espacio real de sobra
// queda igual que siempre.
//
// FIX mobile: se sacó el whiteSpace:"nowrap" que tenía el CTA — con
// texto largo ("Empezar Prueba Gratis") en una tarjeta angosta (una
// sola columna en mobile), ese nowrap estiraba el botón más ancho
// que la propia tarjeta y la desbordaba. Ahora el texto puede pasar
// a una segunda línea si no entra.
function PlanCard({
    titulo,
    priceNode,
    features,
    featureTextColor,
    checkColor,
    cta,
    accentColor,
    onClick,
    loading,
    selected = false,
    featured = false,
    loadingText = "Confirmando…",
}) {
    return (
        <div
            className="rf-plan-card"
            style={{
                flex: "1 1 0",
                position: "relative",
                minWidth: 0,
                minHeight: 400,
                boxSizing: "border-box",
                border: `1.5px solid ${selected || featured ? checkColor : BORDER}`,
                borderRadius: 18,
                padding: "32px 30px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                background: featured ? `linear-gradient(180deg, ${checkColor}0D, #fff 48%)` : "#fff",
                boxShadow: featured ? `0 8px 28px ${checkColor}18` : "0 1px 3px rgba(0,0,0,0.04)",
            }}
        >
            {featured && (
                <span style={{position:"absolute",top:-14,left:"50%",transform:"translateX(-50%)",display:"inline-flex",alignItems:"center",gap:6,padding:"6px 13px",borderRadius:99,background:checkColor,color:"#fff",fontSize:12,fontWeight:700,lineHeight:1.25,whiteSpace:"nowrap",boxShadow:`0 3px 9px ${checkColor}26`}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" /></svg>
                    Más elegido
                </span>
            )}
            <div style={{ textAlign: "center" }}>
                <div
                    style={{ fontSize: 15, fontWeight: 400, color: "#111827" }}
                >
                    {titulo}
                </div>
                <div style={{ marginTop: 8 }}>{priceNode}</div>
            </div>
            <div style={{ height: 1, background: BORDER, width: "100%" }} />
            <div>
                <div
                    style={{
                        fontSize: 13.5,
                        fontWeight: 400,
                        color: "#6B7280",
                        marginBottom: 12,
                    }}
                >
                    Incluye:
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    {features.map((f, i) => (
                        <div
                            key={f}
                            style={{
                                display: "flex",
                                gap: 9,
                                alignItems: "flex-start",
                                fontSize: 13.5,
                                lineHeight: 1.4,
                            }}
                        >
                            <CheckIcon color={checkColor} />
                            <span style={{ color: featureTextColor(i) }}>
                                {f}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            <FillButton
                disabled={loading}
                onClick={onClick}
                fill={accentColor}
                style={{
                    marginTop: "auto",
                    alignSelf: "center",
                    maxWidth: "100%",
                }}
            >
                {loading ? loadingText : cta}
            </FillButton>
        </div>
    )
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function RegisterFlow(props) {
    const {
        baseUrl = appConfig.apiUrl,
        logoUrl,
        accentColor = "#111827",
        successColor = "#1B6B1A",
        acentoColor = "#1B6B1A",
        termsUrl = "/terminos",
        privacyUrl = "/privacidad",
        precioPremium = "$19.900/mes", // prop histórica del Básico
        precioPlanPremium = "$49.900/mes",
    } = props

    const api = baseUrl.replace(/\/+$/, "")
    const isCanvas = false
    const accent = accentColor
    const acento = acentoColor
    const accentSoft = `${successColor}1A` // fondo suave para hover/selección

    const steps = ["personal", "negocio", "plan", "verificar"]
    const [stepId, setStepId] = React.useState("personal")
    const stepIndex = steps.indexOf(stepId)

    // ── Datos personales ──
    const [nombre, setNombre] = React.useState("")
    const [apellido, setApellido] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [telefono, setTelefono] = React.useState("")
    const [pais, setPais] = React.useState(PAISES[0])
    const [errPersonal, setErrPersonal] = React.useState<Record<string, string>>({})

    // ── Negocio ──
    const [businessName, setBusinessName] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [acepta, setAcepta] = React.useState(false)
    const [errNegocio, setErrNegocio] = React.useState<Record<string, string>>({})

    const [catalogoPlanes, setCatalogoPlanes] = React.useState(null)
    React.useEffect(() => {
        if (isCanvas) return
        const controller = new AbortController()
        fetch(api + "/planes", {signal:controller.signal}).then(r => {if(!r.ok) throw Error(); return r.json()}).then(data => {
            if(data.success && Array.isArray(data.planes)) setCatalogoPlanes(data)
        }).catch(() => {})
        return () => controller.abort()
    }, [api,isCanvas])
    const mostrarPrecio = (plan,fallback) => {
        const precio = catalogoPlanes?.planes?.find(p => p.id === plan)?.precio_mensual
        return Number.isFinite(precio) ? "$" + precio.toLocaleString("es-AR") + "/mes" : fallback
    }
    const precioBasicoActual = mostrarPrecio("basico",precioPremium)
    const precioPremiumActual = mostrarPrecio("premium",precioPlanPremium)
    async function pagarPremium(slug) {
        const response = await fetch(api + "/renovacion/checkout/" + encodeURIComponent(slug), {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan:"premium"})})
        const checkout = await response.json()
        if(!response.ok || !checkout.payment_url) throw Error(checkout.error || "No pudimos abrir el pago. Intentá de nuevo.")
        window.location.href = checkout.payment_url
    }

    // ── Plan / submit ──
    const [planSubmitting, setPlanSubmitting] = React.useState(false)
    const [selectedPlan, setSelectedPlan] = React.useState("")
    const [planError, setPlanError] = React.useState("")
    const [emailRegistrado, setEmailRegistrado] = React.useState("")

    // ── Verificación ──
    const [codigo, setCodigo] = React.useState("")
    const [verifSubmitting, setVerifSubmitting] = React.useState(false)
    const [verifError, setVerifError] = React.useState("")
    const [reenviarLoading, setReenviarLoading] = React.useState(false)
    const [reenviarMsg, setReenviarMsg] = React.useState("")
    const [exito, setExito] = React.useState(null) // { panel_url, slug }

    // ── Referidos: código de invitación (?ref=CODIGO) ──
    const [refCode, setRefCode] = React.useState("")

    const telDigits = telefono.replace(/[^0-9]/g, "")

    // Completitud de cada paso — controla si el botón de acción
    // principal se muestra o no (con fade-in cuando pasa a estar
    // completo). No dispara validaciones ni errores, solo gatea
    // la aparición del botón.
    const personalCompleto =
        nombre.trim().length >= 2 &&
        apellido.trim().length >= 2 &&
        EMAIL_REGEX.test(email.trim()) &&
        telDigits.length >= MIN_TEL_DIGITOS
    const negocioCompleto =
        businessName.trim().length >= 2 &&
        password.length >= MIN_PASSWORD &&
        acepta
    const verificarCompleto = codigo.trim().length === 6

    // ────────────────────────────────────────────────────────
    // Validaciones
    // ────────────────────────────────────────────────────────
    function validarPersonal() {
        const e: Record<string, string> = {}
        if (nombre.trim().length < 2) e.nombre = "Ingresá tu nombre."
        if (apellido.trim().length < 2) e.apellido = "Ingresá tu apellido."
        if (!EMAIL_REGEX.test(email.trim())) e.email = "Email inválido."
        // Teléfono obligatorio: antes solo se validaba el largo SI el
        // usuario había escrito algo, y si lo dejaba vacío pasaba igual.
        if (!telDigits) e.telefono = "Ingresá tu teléfono."
        else if (telDigits.length < MIN_TEL_DIGITOS)
            e.telefono = `Mínimo ${MIN_TEL_DIGITOS} dígitos.`
        setErrPersonal(e)
        return Object.keys(e).length === 0
    }

    function validarNegocio() {
        const e: Record<string, string> = {}
        if (businessName.trim().length < 2)
            e.business = "Ingresá el nombre de tu negocio."
        if (password.length < MIN_PASSWORD)
            e.password = `Mínimo ${MIN_PASSWORD} caracteres.`
        setErrNegocio(e)
        return Object.keys(e).length === 0
    }

    function irSiguiente() {
        if (stepId === "personal" && !validarPersonal()) return
        if (stepId === "negocio") {
            if (!validarNegocio()) return
            if (!acepta) {
                setErrNegocio((e) => ({
                    ...e,
                    terminos: "Tenés que aceptar los Términos y Condiciones.",
                }))
                return
            }
        }
        const next = steps[stepIndex + 1]
        if (next) setStepId(next)
    }
    function volver() {
        const prev = steps[stepIndex - 1]
        if (prev) setStepId(prev)
    }

    // ────────────────────────────────────────────────────────
    // Elegir plan → dispara /registro/iniciar
    // ────────────────────────────────────────────────────────
    async function elegirPlan(plan) {
        if (planSubmitting) return
        setPlanError("")
        setSelectedPlan(plan)
        setPlanSubmitting(true)
        try {
            const body = {
                nombre_persona: nombre.trim(),
                apellido: apellido.trim(),
                email: email.trim().toLowerCase(),
                telefono: `${pais.dial}${telDigits}`,
                business_name: businessName.trim(),
                password,
                plan,
                ref: refCode || undefined,
            }
            const res = await fetch(`${api}/registro/iniciar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success)
                throw new Error(data.error || "No se pudo iniciar el registro.")
            setEmailRegistrado(email.trim().toLowerCase())
            setStepId("verificar")
        } catch (err) {
            setPlanError(err.message || "Error de conexión.")
        } finally {
            setPlanSubmitting(false)
            setSelectedPlan("")
        }
    }

    // ────────────────────────────────────────────────────────
    // Verificar código
    // ────────────────────────────────────────────────────────
    async function verificarCodigo() {
        if (verifSubmitting) return
        if (codigo.trim().length !== 6) {
            setVerifError("El código tiene 6 dígitos.")
            return
        }
        setVerifError("")
        setVerifSubmitting(true)
        try {
            const res = await fetch(`${api}/registro/verificar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: emailRegistrado,
                    codigo: codigo.trim(),
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success)
                throw new Error(data.error || "No se pudo verificar el código.")

            // El panel busca la sesión bajo estas keys — se guardan todas
            // para no depender de qué nombre use cada pantalla del panel.
            try {
                if (data.token) {
                    localStorage.setItem("access_token", data.token)
                    localStorage.setItem("auth_token", data.token)
                    localStorage.setItem("turnits_token", data.token)
                }
                if (data.slug) {
                    localStorage.setItem("user_slug", data.slug)
                    localStorage.setItem("auth_slug", data.slug)
                }
                if (data.business_name)
                    localStorage.setItem("business_name", data.business_name)
                localStorage.setItem("just_registered", "1")
                localStorage.removeItem("turnits_ref")
            } catch {}

            setExito({ panel_url: data.panel_url, slug: data.slug, requiere_pago: data.requiere_pago })
            if (data.requiere_pago) {
                try { await pagarPremium(data.slug) } catch(error) { setVerifError(error.message) }
            }
        } catch (err) {
            setVerifError(err.message || "Error de conexión.")
        } finally {
            setVerifSubmitting(false)
        }
    }

    async function reenviarCodigo() {
        if (reenviarLoading) return
        setReenviarMsg("")
        setReenviarLoading(true)
        try {
            const res = await fetch(`${api}/registro/reenviar-codigo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailRegistrado }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success)
                throw new Error(data.error || "No se pudo reenviar.")
            setReenviarMsg("Te reenviamos el código.")
        } catch (err) {
            setReenviarMsg(err.message || "Error al reenviar.")
        } finally {
            setReenviarLoading(false)
        }
    }

    // Referidos: toma ?ref= de la URL y lo recuerda (localStorage) por si la
    // persona navega a otra página antes de terminar el registro.
    React.useEffect(() => {
        if (isCanvas || typeof window === "undefined") return
        const planEnUrl = new URLSearchParams(window.location.search).get("plan")
        if (["gratis", "basico", "premium"].includes(planEnUrl)) setSelectedPlan(planEnUrl)
        const valido = (c) => /^[A-Za-z0-9]{6,12}$/.test(c || "")
        let code = ""
        try {
            const fromUrl = new URLSearchParams(window.location.search).get(
                "ref"
            )
            if (valido(fromUrl)) {
                code = fromUrl.toUpperCase()
                try {
                    localStorage.setItem("turnits_ref", code)
                } catch {}
            } else {
                const saved = localStorage.getItem("turnits_ref")
                if (valido(saved)) code = saved.toUpperCase()
            }
        } catch {}
        if (code) setRefCode(code)
    }, [isCanvas])

    // Redirección automática al panel apenas se verifica — sin botón.
    // Este hook se llama SIEMPRE (no puede ir después de un return
    // condicional, rompería las reglas de hooks de React).
    React.useEffect(() => {
        if (!exito || isCanvas || exito.requiere_pago) return
        const destino = exito.slug ? `/panel/${encodeURIComponent(exito.slug)}?from=register` : "/panel"
        const t = setTimeout(() => {
            window.location.href = destino
        }, 1500)
        return () => clearTimeout(t)
    }, [exito, isCanvas])

    if (isCanvas) {
        return (
            <div
                style={{
                    padding: 24,
                    textAlign: "center",
                    fontFamily: "'Inter Display', 'Inter', sans-serif",
                }}
            >
                Crear cuenta — RegisterFlow
            </div>
        )
    }

    // ── Pantalla de éxito: redirige sola ──
    if (exito) {
        return (
            <div className="rf-container">
                <div className="rf-wrapper" style={wrapperStyle("personal")}>
                    <style>{globalCss}</style>
                    <div
                        style={{
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                            alignItems: "center",
                        }}
                    >
                        <BrandLogo
                            logoUrl={logoUrl}
                            color={successColor}
                            size={44}
                        />
                        <h1
                            style={{ fontSize: 22, fontWeight: 400, margin: 0 }}
                        >
                            ¡Tu cuenta está lista!
                        </h1>
                        <p
                            style={{
                                fontSize: 14,
                                color: "#6B7280",
                                margin: 0,
                            }}
                        >
                            {exito.requiere_pago ? "Activá Premium con tu primer pago mensual." : "Entrando a tu panel..."}
                        </p>
                        {exito.requiere_pago && <>
                            {verifError && <p role="alert" style={{color:"#DC2626",fontSize:13}}>{verifError}</p>}
                            <FillButton fill={acento} disabled={verifSubmitting} onClick={async () => {setVerifSubmitting(true);setVerifError("");try {await pagarPremium(exito.slug)}catch(error){setVerifError(error.message)}finally{setVerifSubmitting(false)}}}>Activar Premium</FillButton>
                        </>}
                        <div
                            className="rf-spinner-lg"
                            style={{
                                borderTopColor: successColor,
                                borderColor: `${successColor}26`,
                            }}
                        />
                    </div>
                </div>
            </div>
        )
    }

    const meta = STEP_META[stepId]

    return (
        <div className="rf-container">
            <div
                className="rf-wrapper"
                style={{
                    ...wrapperStyle(stepId),
                    fontFamily:
                        "'Inter Display', 'Inter', -apple-system, sans-serif",
                }}
            >
                <style>{globalCss}</style>

                <StepTracker
                    steps={steps}
                    stepIndex={stepIndex}
                    accent={accent}
                />

                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={stepId}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.22 }}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 16,
                            width: "100%",
                        }}
                    >
                        {/* ── Paso 1: datos personales ── */}
                        {stepId === "personal" && (
                            <>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "center",
                                    }}
                                >
                                    <BrandLogo
                                        logoUrl={logoUrl}
                                        color={accent}
                                        size={38}
                                    />
                                </div>
                                <h2
                                    className="rf-h2"
                                    style={{
                                        textAlign: "center",
                                        fontSize: 21,
                                        fontWeight: 400,
                                        margin: 0,
                                        color: "#111827",
                                    }}
                                >
                                    {meta.lead}{" "}
                                    <span style={{ color: successColor }}>
                                        {meta.highlight}
                                    </span>
                                </h2>
                                {refCode && (
                                    <div
                                        style={{
                                            textAlign: "center",
                                            fontSize: 12.5,
                                            color: successColor,
                                            background: accentSoft,
                                            borderRadius: 10,
                                            padding: "8px 12px",
                                        }}
                                    >
                                        Te invitaron a Turnits. Código aplicado:{" "}
                                        <strong>{refCode}</strong>
                                    </div>
                                )}
                                <div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 400,
                                            color: "#374151",
                                            marginBottom: 2,
                                        }}
                                    >
                                        {meta.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            color: "#9CA3AF",
                                        }}
                                    >
                                        {meta.subtitle}
                                    </div>
                                </div>

                                <FieldBox>
                                    <FieldRow className="rf-name-row">
                                        <div
                                            className="rf-name-col"
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                borderRight: `1px solid ${BORDER}`,
                                            }}
                                        >
                                            <FlatInput
                                                placeholder="Nombre"
                                                value={nombre}
                                                onChange={setNombre}
                                            />
                                        </div>
                                        <div
                                            className="rf-name-col"
                                            style={{ flex: 1, minWidth: 0 }}
                                        >
                                            <FlatInput
                                                placeholder="Apellido"
                                                value={apellido}
                                                onChange={setApellido}
                                            />
                                        </div>
                                    </FieldRow>
                                    <FieldRow>
                                        <FlatInput
                                            placeholder="Correo Electrónico"
                                            type="email"
                                            value={email}
                                            onChange={setEmail}
                                        />
                                    </FieldRow>
                                    <FieldRow noBorder>
                                        <CountrySelect
                                            pais={pais}
                                            setPais={setPais}
                                            accentSoft={accentSoft}
                                        />
                                        <FlatInput
                                            placeholder="Teléfono"
                                            inputMode="numeric"
                                            value={telefono}
                                            onChange={(v) =>
                                                setTelefono(
                                                    v.replace(/[^0-9]/g, "")
                                                )
                                            }
                                        />
                                    </FieldRow>
                                </FieldBox>
                                <ErrorList errors={errPersonal} />

                                <AnimatePresence>
                                    {personalCompleto && (
                                        <motion.div
                                            key="btn-continuar-personal"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <FillButton
                                                onClick={irSiguiente}
                                                fill={acento}
                                            >
                                                Continuar
                                            </FillButton>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}

                        {/* ── Paso 2: negocio + contraseña + términos ── */}
                        {stepId === "negocio" && (
                            <>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "center",
                                    }}
                                >
                                    <BrandLogo
                                        logoUrl={logoUrl}
                                        color={accent}
                                        size={38}
                                    />
                                </div>
                                <h2
                                    className="rf-h2"
                                    style={{
                                        textAlign: "center",
                                        fontSize: 21,
                                        fontWeight: 400,
                                        margin: 0,
                                        color: "#111827",
                                    }}
                                >
                                    {meta.lead}{" "}
                                    <span style={{ color: successColor }}>
                                        {meta.highlight}
                                    </span>
                                </h2>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 400,
                                            color: "#374151",
                                            marginBottom: 2,
                                        }}
                                    >
                                        {meta.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            color: "#9CA3AF",
                                        }}
                                    >
                                        {meta.subtitle}
                                    </div>
                                </div>

                                <FieldBox>
                                    <FieldRow>
                                        <FlatInput
                                            placeholder="Nombre del Negocio"
                                            value={businessName}
                                            onChange={setBusinessName}
                                        />
                                    </FieldRow>
                                    <FieldRow noBorder>
                                        <PasswordFieldInline
                                            value={password}
                                            onChange={setPassword}
                                        />
                                    </FieldRow>
                                </FieldBox>
                                <ErrorList errors={errNegocio} />

                                <label
                                    style={{
                                        display: "flex",
                                        gap: 10,
                                        alignItems: "flex-start",
                                        fontSize: 12.5,
                                        color: "#374151",
                                        cursor: "pointer",
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={acepta}
                                        onChange={(e) => {
                                            setAcepta(e.target.checked)
                                            setErrNegocio((prev) => ({
                                                ...prev,
                                                terminos: undefined,
                                            }))
                                        }}
                                        style={{
                                            marginTop: 2,
                                            accentColor: successColor,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <span>
                                        He leído y acepto los{" "}
                                        <a
                                            href={termsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: successColor,
                                                fontWeight: 600,
                                            }}
                                        >
                                            Términos y Condiciones de Uso
                                        </a>{" "}
                                        y la{" "}
                                        <a
                                            href={privacyUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: successColor,
                                                fontWeight: 600,
                                            }}
                                        >
                                            Política de Privacidad
                                        </a>{" "}
                                        de Turnits.
                                    </span>
                                </label>
                                {errNegocio.terminos && (
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 11,
                                            color: "#EF4444",
                                        }}
                                    >
                                        {errNegocio.terminos}
                                    </p>
                                )}

                                <div
                                    className="rf-btn-row"
                                    style={{
                                        display: "flex",
                                        gap: 12,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexWrap: "nowrap",
                                    }}
                                >
                                    <BackButton
                                        onClick={volver}
                                        fillColor={accent}
                                    />
                                    <AnimatePresence>
                                        {negocioCompleto && (
                                            <motion.div
                                                key="btn-continuar-negocio"
                                                className="rf-btn-continuar"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{
                                                    duration: 0.25,
                                                }}
                                            >
                                                <FillButton
                                                    onClick={irSiguiente}
                                                    fill={acento}
                                                >
                                                    Continuar
                                                </FillButton>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </>
                        )}

                        {/* ── Paso 3: elegir plan (dispara el registro) ── */}
                        {stepId === "plan" && (
                            <>
                                <h2
                                    className="rf-h2-plan"
                                    style={{
                                        textAlign: "center",
                                        fontSize: 22,
                                        fontWeight: 400,
                                        margin: "0 0 4px 0",
                                        color: "#111827",
                                    }}
                                >
                                    Empezá tu agenda ahora
                                </h2>
                                {planError && (
                                    <p
                                        style={{
                                            margin: "0 0 4px 0",
                                            fontSize: 12.5,
                                            color: "#DC2626",
                                            textAlign: "center",
                                        }}
                                    >
                                        {planError}
                                    </p>
                                )}
                                {/* Fila en row FIJO: antes esto usaba CSS
                                    Grid con auto-fit, que "decide solo"
                                    apilar en columna en cuanto detecta
                                    que no entran 260px+260px+gap — eso
                                    competía con nuestro propio breakpoint
                                    de @container y podía apilar antes de
                                    lo esperado. Ahora queda en row fijo
                                    (flexWrap: nowrap) y el ÚNICO que
                                    decide apilar es el @container de acá
                                    abajo (680px), nada de auto-decisión
                                    del navegador. */}
                                <div
                                    className="rf-plan-row"
                                    style={{
                                        display: "flex",
                                        flexWrap: "nowrap",
                                        gap: 20,
                                        width: "100%",
                                    }}
                                >
                                    <PlanCard
                                        titulo="Plan Gratis"
                                        selected={selectedPlan === "gratis"}
                                        priceNode={
                                            <div
                                                style={{
                                                    fontSize: 30,
                                                    fontWeight: 800,
                                                    color: "#111827",
                                                }}
                                            >
                                                GRATIS
                                            </div>
                                        }
                                        features={[
                                            "Automatización de tu agenda",
                                            "Recordatorios Automáticos",
                                            "Cobros Totales y Señas",
                                            "Estadísticas básicas y hasta 10 clientes",
                                            "Finanzas y gastos",
                                            "Mercado Pago: tarjetas aceptadas y saldo",
                                            "1 profesional: el titular",
                                            "Fee Turnits: $300 o 2%, el mayor",
                                        ]}
                                        featureTextColor={() => "#374151"}
                                        checkColor={successColor}
                                        cta="Registrarme"
                                        accentColor={acento}
                                        loading={
                                            planSubmitting &&
                                            selectedPlan === "gratis"
                                        }
                                        loadingText="Registrando…"
                                        onClick={() => elegirPlan("gratis")}
                                    />
                                    <PlanCard
                                        selected={selectedPlan === "basico"}
                                        featured
                                        titulo={
                                            <span>
                                                Plan{" "}
                                                <span
                                                    style={{
                                                        color: successColor,
                                                    }}
                                                >
                                                    Básico
                                                </span>
                                            </span>
                                        }
                                        priceNode={
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "baseline",
                                                    justifyContent: "center",
                                                    gap: 4,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: 30,
                                                        fontWeight: 800,
                                                        color: successColor,
                                                    }}
                                                >
                                                    {
                                                        precioBasicoActual.split(
                                                            "/"
                                                        )[0]
                                                    }
                                                </span>
                                                <span
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 500,
                                                        color: "#9CA3AF",
                                                    }}
                                                >
                                                    /
                                                    {precioBasicoActual.split(
                                                        "/"
                                                    )[1] || "mes"}
                                                </span>
                                            </div>
                                        }
                                        features={[
                                            "Todo lo de Gratis",
                                            "Listado de hasta 50 clientes",
                                            "Cobro total y seña por Mercado Pago",
                                            "Temas personalizados y métricas completas",
                                            "Titular + 2 miembros de equipo",
                                            "Combos y promociones",
                                            "Tras la prueba: fee de $100 o 0,8%, el mayor",
                                        ]}
                                        featureTextColor={(i) =>
                                            i === 0 ? "#111827" : successColor
                                        }
                                        checkColor={successColor}
                                        cta="Empezar Prueba Gratis"
                                        accentColor={acento}
                                        loading={
                                            planSubmitting &&
                                            selectedPlan === "basico"
                                        }
                                        loadingText="Preparando Básico…"
                                        onClick={() => elegirPlan("basico")}
                                    />
                                    <PlanCard selected={selectedPlan === "premium"} titulo="Plan Premium" priceNode={<div style={{fontSize:30,fontWeight:800,color:successColor}}>{precioPremiumActual.split("/")[0]}<span style={{fontSize:14,fontWeight:500,color:"#9CA3AF"}}>/mes</span></div>}
                                        features={["Todo lo de Básico","Equipo y clientes sin límite","Transferencia, efectivo y agenda sin cobro","Soporte prioritario","Finanzas y rendimiento del equipo","Combos, promociones y productos","Tras la prueba: sin comisión Turnits"]}
                                        featureTextColor={() => "#374151"} checkColor={successColor} cta="Empezar Prueba Gratis"
                                        accentColor={acento} loading={planSubmitting && selectedPlan === "premium"}
                                        loadingText="Preparando Premium…" onClick={() => elegirPlan("premium")} />
                                </div>
                                <p style={{fontSize:12,color:"#6B7280",textAlign:"center",lineHeight:1.6,margin:0}}>Básico y Premium incluyen {catalogoPlanes?.dias_prueba_basico ?? 30} días de prueba con las funciones de cada plan. Durante cualquier prueba, los cobros online tienen el fee de Gratis: $300 o 2%, el mayor. Mercado Pago cobra sus comisiones por separado.</p>
                                <a href="/planes" target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",fontSize:13,color:successColor,textAlign:"center",marginTop:10}}>Comparar todas las características</a>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "center",
                                        marginTop: 4,
                                    }}
                                >
                                    <BackButton
                                        onClick={volver}
                                        fillColor={accent}
                                    />
                                </div>
                            </>
                        )}

                        {/* ── Paso 4: verificación de código ── */}
                        {stepId === "verificar" && (
                            <>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "center",
                                    }}
                                >
                                    <BrandLogo
                                        logoUrl={logoUrl}
                                        color={accent}
                                        size={38}
                                    />
                                </div>
                                <h2
                                    className="rf-h2"
                                    style={{
                                        textAlign: "center",
                                        fontSize: 21,
                                        fontWeight: 400,
                                        margin: 0,
                                        color: "#111827",
                                    }}
                                >
                                    {meta.lead}{" "}
                                    <span style={{ color: successColor }}>
                                        {meta.highlight}
                                    </span>
                                </h2>
                                <p
                                    style={{
                                        fontSize: 13.5,
                                        color: "#6B7280",
                                        margin: 0,
                                        textAlign: "center",
                                    }}
                                >
                                    Enviamos un código de 6 dígitos a{" "}
                                    <strong style={{ color: "#111827" }}>
                                        {maskEmail(emailRegistrado)}
                                    </strong>
                                    .
                                </p>

                                <FieldBox>
                                    <FieldRow noBorder>
                                        <input
                                            className="rf-code-input"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="000000"
                                            value={codigo}
                                            onChange={(e) =>
                                                setCodigo(
                                                    e.target.value
                                                        .replace(/[^0-9]/g, "")
                                                        .slice(0, 6)
                                                )
                                            }
                                            style={{
                                                width: "100%",
                                                boxSizing: "border-box",
                                                border: "none",
                                                outline: "none",
                                                padding: 16,
                                                fontSize: 24,
                                                fontWeight: 400,
                                                textAlign: "center",
                                                letterSpacing: 10,
                                                fontFamily: "inherit",
                                            }}
                                        />
                                    </FieldRow>
                                </FieldBox>
                                {verifError && (
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 12,
                                            color: "#EF4444",
                                            textAlign: "center",
                                        }}
                                    >
                                        {verifError}
                                    </p>
                                )}

                                <AnimatePresence>
                                    {verificarCompleto && (
                                        <motion.div
                                            key="btn-verificar"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                                width: "100%",
                                            }}
                                        >
                                            <FillButton
                                                onClick={verificarCodigo}
                                                disabled={verifSubmitting}
                                                fill={acento}
                                                style={{ width: "100%" }}
                                            >
                                                {verifSubmitting
                                                    ? "Verificando..."
                                                    : "Verificar y Crear Cuenta"}
                                            </FillButton>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div style={{ textAlign: "center" }}>
                                    <button
                                        onClick={reenviarCodigo}
                                        disabled={reenviarLoading}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#9CA3AF",
                                            fontSize: 12.5,
                                            cursor: "pointer",
                                            textDecoration: "underline",
                                        }}
                                    >
                                        {reenviarLoading
                                            ? "Reenviando..."
                                            : "Reenviar código"}
                                    </button>
                                    {reenviarMsg && (
                                        <p
                                            style={{
                                                margin: "4px 0 0 0",
                                                fontSize: 11.5,
                                                color: "#6B7280",
                                            }}
                                        >
                                            {reenviarMsg}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}

// El paso "plan" necesita más ancho para que las dos tarjetas entren
// cómodamente en una sola fila sin wrapear; el resto de los pasos usa
// el ancho angosto tipo formulario, igual que en las capturas. Los
// ajustes de padding/gap para el componente angosto viven en la clase
// .rf-wrapper (ver globalCss), no acá — así con espacio real de sobra
// esto queda exactamente igual que antes.
function wrapperStyle(stepId): React.CSSProperties {
    return {
        width: "100%",
        maxWidth: stepId === "plan" ? 1060 : 460,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        // Padding horizontal proporcional al viewport (mínimo 20px, o
        // 5% del ancho si eso es mayor). Esto es a prueba de que el
        // Frame de Framer no se achique como debería: nunca va a
        // quedar pegado al borde, sin importar el ancho real que
        // termine recibiendo el componente. Por debajo del breakpoint
        // chico este valor se sobreescribe con !important desde
        // globalCss para ganar espacio útil.
        padding: "24px max(20px, 5vw)",
        boxSizing: "border-box",
        overflowX: "hidden",
        transition: "max-width 0.2s ease",
    }
}

// El <style> global maneja: el foco del input, el spinner de la
// pantalla de éxito, el reset de box-sizing, y el responsive real vía
// @container queries. El efecto de los botones (relleno, ripple,
// lift) sigue viviendo enteramente en el componente FillButton de más
// arriba — no depende de que este bloque cargue a tiempo.
//
// CLAVE DEL FIX DE RESPONSIVE: .rf-container es el elemento que
// declara `container-type: inline-size`, así que las reglas
// `@container rf (...)` de acá abajo miden el ancho real de ESE
// contenedor (el propio componente dentro de Framer), no el ancho de
// la ventana del navegador. Esto es lo que corrige que en desktop se
// viera apilado igual que en mobile: antes, con @media, todo dependía
// del viewport completo sin importar cuánto espacio tuviera realmente
// el Frame.
//
// Se usa !important en las reglas responsive a propósito: están
// pisando estilos inline (que normalmente ganan por especificidad), y
// solo aplican por debajo de cada breakpoint de contenedor, así que
// no afectan en absoluto el diseño cuando el componente tiene espacio
// de sobra.
const globalCss = `
    @import url('https://fonts.googleapis.com/css2?family=Inter+Display:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

    /* Contenedor de container query: mide el ancho real del propio
       componente, no el de la ventana del navegador. */
    .rf-container {
        width: 100%;
        container-type: inline-size;
        container-name: rf;
    }

    /* FIX CLAVE: sin esto, cualquier elemento con width:100% + padding
       propio mide más que su contenedor y desborda. Es la causa raíz
       de que "todo" el componente se vea mal cuando el espacio es
       chico. */
    .rf-wrapper, .rf-wrapper *, .rf-wrapper *::before, .rf-wrapper *::after {
        box-sizing: border-box;
    }

    .rf-input:focus { background: #FAFAFA; }

    .rf-spinner-lg {
        display: inline-block; width: 30px; height: 30px;
        border: 3px solid rgba(27,107,26,0.15);
        border-top-color: #1B6B1A; border-radius: 50%;
        animation: rf-spin 0.8s linear infinite;
    }
    @keyframes rf-spin { to { transform: rotate(360deg); } }

    /* ── Responsive real, basado en el ancho del propio componente ── */
    @container rf (max-width: 480px) {
    .rf-wrapper {
        padding-top: 16px !important;
        padding-bottom: 16px !important;
        padding-left: 14px !important;
        padding-right: 14px !important;
        gap: 16px !important;
    }
    .rf-h2 { font-size: 18px !important; }
    .rf-h2-plan { font-size: 19px !important; }
    .rf-code-input {
        font-size: 20px !important;
        letter-spacing: 6px !important;
        padding: 12px !important;
    }
    .rf-fillbtn {
        min-width: 0 !important;
        width: auto !important;
        padding: 10px 18px !important;
        font-size: 13.5px !important;
    }
}
    @container rf (max-width: 860px) {
        /* Tarjetas de plan: el inline flexWrap:"nowrap" se pisa acá para
           pasar a columna — este @container es ahora el ÚNICO lugar que
           decide el apilamiento, ya no depende de auto-fit de Grid. */
        .rf-plan-row {
            flex-direction: column !important;
            flex-wrap: wrap !important;
        }
        .rf-plan-card {
            min-width: 0 !important;
            min-height: auto !important;
            padding: 26px 22px !important;
        }
    }
    @container rf (max-width: 360px) {
        .rf-name-row { flex-direction: column !important; }
        .rf-name-col { border-right: none !important; }
        .rf-name-col:first-child {
            border-bottom: 1px solid ${BORDER} !important;
        }
        .rf-country-btn { padding: 12px 8px !important; }
        .rf-country-dial { font-size: 11px !important; }
        .rf-code-input {
            font-size: 17px !important;
            letter-spacing: 3px !important;
            padding: 10px !important;
        }
        .rf-plan-card { padding: 20px 16px !important; }
    }
`


