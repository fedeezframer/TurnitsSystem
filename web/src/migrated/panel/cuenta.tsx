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
import { MenuCuenta_FONT, MenuFooter_getSlug, MenuFooter_getToken, MenuFooter_cerrarSesion, MenuCuenta_Z, MenuCuentaLoadMpSdk, MenuCuentaGraciasImagen, MenuCuentaReduccionImagen, MenuCuentaGraciasPreviewCSS, safeLocalStorage, MenuCuenta_FLY_W, MenuCuenta_TERMINOS_URL, MenuCuenta_PRIVACIDAD_URL, MenuCuenta_SHADOW, MenuUserAvatar, MenuFooter_useLogoNegocio, MenuFooter_useSoporte, OnboardingNube_FONT_DISPLAY, OnboardingNube_ACCENT, OnboardingNube_HAIRLINE, OnboardingNube_FONT_BODY, OnboardingNube_INK, OnboardingNube_MUTED } from "./common"
import { TurnitsPlanIcon } from "./shared"
import { UserGreeting, PlanEstado, BotonNotificaciones, NotificacionesPanel } from "./inicio"

function MenuFooterIconButton({
    icon,
    defaultIcon,
    onClick,
    ariaLabel,
    size = 34,
}: {
    icon?: string
    defaultIcon: React.ReactElement
    onClick: () => void
    ariaLabel: string
    size?: number
}) {
    const [hover, setHover] = React.useState(false)
    return (
        <motion.button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            whileTap={{ scale: 0.92 }}
            aria-label={ariaLabel}
            title={ariaLabel}
            style={{
                width: size,
                height: size,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 9,
                border: `1px solid ${hover ? "#cbd5e1" : "#e5e9f0"}`,
                background: hover ? "#f8fafc" : "#ffffff",
                color: "#475569",
                cursor: "pointer",
                transition: "background 0.15s ease, border-color 0.15s ease",
            }}
        >
            {icon ? (
                <img
                    src={icon}
                    alt={ariaLabel}
                    style={{ width: 17, height: 17, objectFit: "contain" }}
                />
            ) : (
                defaultIcon
            )}
        </motion.button>
    )
}

const MenuFooterSoporteIcon = (
    <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
        <rect x="2.5" y="13" width="5" height="6.5" rx="2" />
        <rect x="16.5" y="13" width="5" height="6.5" rx="2" />
        <path d="M20 19.5a4 4 0 0 1-4 4h-2.5" />
    </svg>
)

const MenuFooterLogoutIcon = (
    <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H15" />
        <path d="M10 8l-4 4 4 4" />
        <path d="M6 12h12" />
    </svg>
)

function MenuCuentaSvg({
    children,
    size = 17,
    style,
}: {
    children: React.ReactNode
    size?: number
    style?: React.CSSProperties
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0, ...style }}
        >
            {children}
        </svg>
    )
}

const MenuCuentaIconPlanes = (
    <MenuCuentaSvg>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16V8" />
        <path d="M8.5 11.5L12 8l3.5 3.5" />
    </MenuCuentaSvg>
)

const MenuCuentaIconInfo = (
    <MenuCuentaSvg>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
    </MenuCuentaSvg>
)

const MenuCuentaIconTrash = (
    <MenuCuentaSvg>
        <path d="M4 7h16" />
        <path d="M9 7V4.5h6V7" />
        <path d="M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
    </MenuCuentaSvg>
)

const MenuCuentaIconExterno = (
    <MenuCuentaSvg size={15}>
        <path d="M14 4h6v6" />
        <path d="M20 4l-9 9" />
        <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </MenuCuentaSvg>
)

function MenuCuentaItem({
    icon,
    label,
    onClick,
    right,
    danger,
    active,
    innerRef,
}: {
    icon?: React.ReactNode
    label: string
    onClick: () => void
    right?: React.ReactNode
    danger?: boolean
    active?: boolean
    innerRef?: React.Ref<HTMLButtonElement>
}) {
    const [hover, setHover] = React.useState(false)
    return (
        <button
            ref={innerRef}
            type="button"
            role="menuitem"
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                height: 38,
                padding: "0 10px",
                border: "none",
                borderRadius: 9,
                background:
                    hover || active
                        ? danger
                            ? "#fef2f2"
                            : "#f1f5f9"
                        : "transparent",
                color: danger ? "#dc2626" : "#0f172a",
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: MenuCuenta_FONT,
                textAlign: "left",
                cursor: "pointer",
                transition: "background 0.12s ease",
            }}
        >
            {icon && (
                <span
                    style={{
                        display: "flex",
                        flexShrink: 0,
                        color: danger ? "#dc2626" : "#475569",
                    }}
                >
                    {icon}
                </span>
            )}
            <span
                style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
            {right && (
                <span
                    style={{
                        display: "flex",
                        flexShrink: 0,
                        color: "#94a3b8",
                    }}
                >
                    {right}
                </span>
            )}
        </button>
    )
}

const MenuCuentaDivider = (
    <div style={{ height: 1, background: "#eef1f6", margin: "6px 4px" }} />
)

function MenuCuentaEliminarModal({
    api,
    email,
    plan,
    logoutUrl,
    onClose,
}: {
    api: string
    email: string
    plan: string
    logoutUrl: string
    onClose: () => void
}) {
    const [password, setPassword] = React.useState("")
    const [cargando, setCargando] = React.useState(false)
    const [error, setError] = React.useState("")
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 60)
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !cargando) onClose()
        }
        document.addEventListener("keydown", onKey)
        return () => {
            clearTimeout(t)
            document.removeEventListener("keydown", onKey)
        }
    }, [cargando, onClose])

    const eliminar = async () => {
        if (cargando) return
        if (!password) {
            setError("Ingresá tu contraseña para confirmar.")
            return
        }
        const slug = MenuFooter_getSlug()
        const token = MenuFooter_getToken()
        if (!slug || !token) {
            setError("Tu sesión expiró. Volvé a iniciar sesión.")
            return
        }
        setCargando(true)
        setError("")
        try {
            const res = await fetch(`${api}/cuenta/eliminar/${slug}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ password }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data?.success) {
                // Cuenta borrada: limpia la sesión (y lo guardado por slug)
                // y vuelve al login.
                MenuFooter_cerrarSesion(logoutUrl, true)
                return
            }
            setError(
                data?.error || "No se pudo eliminar la cuenta. Probá de nuevo."
            )
        } catch {
            setError("No se pudo conectar con el servidor. Probá de nuevo.")
        }
        setCargando(false)
    }

    return (
        <div
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !cargando) onClose()
            }}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: MenuCuenta_Z + 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                boxSizing: "border-box",
                background: "rgba(15,23,42,0.45)",
                fontFamily: MenuCuenta_FONT,
            }}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Eliminar cuenta"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                style={{
                    width: "100%",
                    maxWidth: 420,
                    boxSizing: "border-box",
                    padding: 22,
                    background: "#ffffff",
                    borderRadius: 18,
                    boxShadow: "0 24px 60px rgba(15,23,42,0.28)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 12,
                    }}
                >
                    <div
                        style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: "#fef2f2",
                            color: "#dc2626",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        {MenuCuentaIconTrash}
                    </div>
                    <div
                        style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: "#0f172a",
                        }}
                    >
                        Eliminar cuenta
                    </div>
                </div>

                <p
                    style={{
                        margin: "0 0 10px",
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        color: "#475569",
                    }}
                >
                    Vas a borrar tu negocio y todo lo que tiene adentro: turnos,
                    servicios, equipo, extras y configuración. Esta acción es
                    permanente y no se puede deshacer.
                    {plan === "basico" &&
                        " Tu plan Básico también se pierde."}
                </p>

                {email && (
                    <p
                        style={{
                            margin: "0 0 14px",
                            fontSize: 12.5,
                            color: "#64748b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Cuenta:{" "}
                        <strong style={{ color: "#0f172a" }}>{email}</strong>
                    </p>
                )}

                <label
                    style={{
                        display: "block",
                        marginBottom: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#0f172a",
                    }}
                >
                    Para confirmar, ingresá tu contraseña
                </label>
                <input
                    ref={inputRef}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    disabled={cargando}
                    onChange={(e) => {
                        setPassword(e.target.value)
                        if (error) setError("")
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") eliminar()
                    }}
                    placeholder="Contraseña"
                    style={{
                        width: "100%",
                        height: 42,
                        boxSizing: "border-box",
                        padding: "0 12px",
                        borderRadius: 10,
                        border: `1px solid ${error ? "#dc2626" : "#e2e8f0"}`,
                        outline: "none",
                        fontSize: 16, // 16px evita el zoom automático en iOS
                        fontFamily: MenuCuenta_FONT,
                        color: "#0f172a",
                        background: cargando ? "#f8fafc" : "#ffffff",
                    }}
                />
                {error && (
                    <div
                        style={{
                            marginTop: 8,
                            fontSize: 12.5,
                            color: "#dc2626",
                        }}
                    >
                        {error}
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 18,
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={cargando}
                        style={{
                            height: 40,
                            padding: "0 16px",
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            color: "#0f172a",
                            fontSize: 13.5,
                            fontWeight: 600,
                            fontFamily: MenuCuenta_FONT,
                            cursor: cargando ? "default" : "pointer",
                            opacity: cargando ? 0.6 : 1,
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={eliminar}
                        disabled={cargando || !password}
                        style={{
                            height: 40,
                            padding: "0 16px",
                            borderRadius: 10,
                            border: "none",
                            background: "#dc2626",
                            color: "#ffffff",
                            fontSize: 13.5,
                            fontWeight: 700,
                            fontFamily: MenuCuenta_FONT,
                            cursor:
                                cargando || !password ? "default" : "pointer",
                            opacity: cargando || !password ? 0.55 : 1,
                        }}
                    >
                        {cargando ? "Eliminando…" : "Eliminar cuenta"}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

function MenuCuentaCheckoutLock() {
    return <svg width="15" height="17" viewBox="0 0 20 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="4" y="10" width="12" height="11" rx="2" /><path d="M6.5 10V6.5a3.5 3.5 0 0 1 7 0V10M10 14v3" /></svg>
}

function MenuCuentaCheckoutBrand({ logo }: { logo?: string }) {
    return <div className="tn-checkout-brand" aria-label="Turnits">
        {logo ? <img src={logo} alt="turnits" /> : <><svg width="39" height="39" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="24" cy="21" r="13" /><path d="m18 19 5 4 8-9M12 25C-1 39 19 40 35 29S48 11 35 16M11 32c9 3 22-3 29-12" /></svg><span>turnits</span></>}
    </div>
}

function MenuCuentaCheckoutMethods({ value, disabled, cardAvailable, onChange }: any) {
    return <aside className="tn-checkout-methods">
        <h3>Método de pago</h3>
        <div role="radiogroup" aria-label="Método de pago" className="tn-checkout-options">
            <button type="button" role="radio" aria-checked={value === "tarjeta"} disabled={disabled || !cardAvailable} onClick={() => onChange("tarjeta")} className="tn-checkout-option">
                <span className={"tn-checkout-radio" + (value === "tarjeta" ? " selected" : "")} aria-hidden="true" />
                <span className="tn-checkout-option-copy"><strong>Tarjeta de crédito<br />o débito</strong><span className="tn-checkout-card-brands">Pagá con <svg width="30" height="14" viewBox="-3 -2 63 28" style={{ overflow: "visible" }} aria-label="Visa"><text x="0" y="19" fontFamily="Arial,sans-serif" fontSize="22" fontWeight="900" fontStyle="italic">VISA</text></svg><span>o</span><svg width="36" height="29" viewBox="0 0 42 34" aria-label="Mastercard"><circle cx="16" cy="13" r="11" fill="#eb001b" /><circle cx="28" cy="13" r="11" fill="#f79e1b" /><path d="M22 3.78a11 11 0 0 1 0 18.44 11 11 0 0 1 0-18.44Z" fill="#ff5f00" /><text x="21" y="32" textAnchor="middle" fontSize="5" fill="#111" fontFamily="Arial,sans-serif">mastercard</text></svg></span></span>
            </button>
            <button type="button" role="radio" aria-checked={value === "mercadopago"} disabled={disabled} onClick={() => onChange("mercadopago")} className="tn-checkout-option">
                <span className={"tn-checkout-radio" + (value === "mercadopago" ? " selected" : "")} aria-hidden="true" />
                <span className="tn-checkout-option-copy"><strong>Mercado Pago</strong><span>Pagá con el dinero<br />disponible de tu cuenta</span></span>
            </button>
        </div>
    </aside>
}

function MenuCuentaPlanTarjeta({ compra, busy, onSubmit, onError }: any) {
    const formId = React.useRef("tn-plan-form-" + Math.random().toString(36).slice(2))
    const callbacks = React.useRef({ onSubmit, onError })
    callbacks.current = { onSubmit, onError }
    const [ready, setReady] = React.useState(false)
    const [fetching, setFetching] = React.useState(0)
    const sending = React.useRef(false)
    const id = (name: string) => formId.current + "-" + name
    React.useEffect(() => {
        if (!compra?.id || !compra.public_key) return
        let cancelled = false, controller: any = null
        setReady(false)
        const autoSelect = (name: string, preferred?: string) => {
            if (cancelled) return
            const select = document.getElementById(id(name)) as HTMLSelectElement | null
            if (!select) return
            const option = Array.from(select.options).find(o => o.value === preferred) || Array.from(select.options).find(o => o.value)
            if (option) { select.value = option.value; select.dispatchEvent(new Event("change", { bubbles: true })) }
        }
        MenuCuentaLoadMpSdk().then(() => {
            if (cancelled) return
            const email = document.getElementById(id("email")) as HTMLInputElement | null
            if (email) email.value = compra.email || ""
            const mp = new (window as any).MercadoPago(compra.public_key, { locale: "es-AR" })
            const fieldStyle = { fontSize: "16px", fontFamily: "Arial, sans-serif", color: "#111111", placeholderColor: "#929292", height: "100%", padding: "0 12px" }
            controller = mp.cardForm({
                amount: String(compra.monto), iframe: true,
                form: {
                    id: formId.current,
                    cardNumber: { id: id("number"), placeholder: "1234 1234 1234 1234", style: fieldStyle },
                    expirationDate: { id: id("expiry"), placeholder: "MM/AA", mode: "short", style: fieldStyle },
                    securityCode: { id: id("cvv"), placeholder: "Ej.: 123", style: { ...fieldStyle, paddingRight: "49px" } },
                    cardholderName: { id: id("name"), placeholder: "María López" },
                    identificationType: { id: id("doc-type") },
                    identificationNumber: { id: id("doc"), placeholder: "99999999" },
                    issuer: { id: id("issuer") }, installments: { id: id("installments") },
                    cardholderEmail: { id: id("email") },
                },
                callbacks: {
                    onFormMounted: (error: any) => { if (!cancelled && error) callbacks.current.onError("No se pudo cargar el formulario de tarjeta.") },
                    onReady: () => { if (!cancelled) setReady(true) },
                    onIdentificationTypesReceived: () => { queueMicrotask(() => autoSelect("doc-type", "DNI")) },
                    onIssuersReceived: () => { queueMicrotask(() => autoSelect("issuer")) },
                    onInstallmentsReceived: () => { queueMicrotask(() => autoSelect("installments", "1")) },
                    onError: () => { if (!cancelled) callbacks.current.onError("Revisá los datos de la tarjeta y del titular.") },
                    onFetching: () => {
                        if (!cancelled) setFetching(n => n + 1)
                        return () => { if (!cancelled) setFetching(n => Math.max(0, n - 1)) }
                    },
                    onSubmit: async (event: Event) => {
                        event.preventDefault()
                        if (cancelled || sending.current || !controller) return
                        const data = controller.getCardFormData()
                        if (!data.token || !data.paymentMethodId || Number(data.installments) !== 1) {
                            callbacks.current.onError("Revisá la tarjeta. Esta compra se realiza en un solo pago.")
                            return
                        }
                        sending.current = true
                        try { await callbacks.current.onSubmit({ token: data.token, payment_method_id: data.paymentMethodId, issuer_id: data.issuerId, installments: 1,
                            payer: { email: data.cardholderEmail || compra.email, identification: { type: data.identificationType, number: data.identificationNumber } } }) }
                        catch {} finally { sending.current = false }
                    },
                },
            })
            if (cancelled) controller.unmount()
        }).catch(e => { if (!cancelled) callbacks.current.onError(e.message || "No se pudo cargar el formulario.") })
        return () => { cancelled = true; if (controller) Promise.resolve(controller.unmount()).catch(() => {}) }
    }, [compra?.id])
    return <form id={formId.current} className="tn-checkout-card-form" noValidate onSubmit={e => e.preventDefault()} style={{ display: !compra || compra.status === "nuevo" ? "block" : "none" }}>
        <div className="tn-checkout-field"><label htmlFor={id("number")}>Número de tarjeta</label><div id={id("number")} className="tn-checkout-secure" aria-label="Número de tarjeta" /></div>
        <div className="tn-checkout-field-pair">
            <div className="tn-checkout-field"><label htmlFor={id("expiry")}>Vencimiento</label><div id={id("expiry")} className="tn-checkout-secure" aria-label="Vencimiento" /></div>
            <div className="tn-checkout-field"><label htmlFor={id("cvv")}>Código de seguridad</label><div className="tn-checkout-cvv-wrap"><div id={id("cvv")} className="tn-checkout-secure" aria-label="Código de seguridad" /><svg className="tn-checkout-cvv-icon" width="41" height="28" viewBox="0 0 44 30" fill="none" aria-hidden="true"><rect x="2" y="7" width="36" height="22" rx="3" stroke="#dadada" strokeWidth="2"/><path d="M3 13h34" stroke="#dadada" strokeWidth="5"/><path d="M8 23h11" stroke="#dadada" strokeWidth="3"/><circle cx="34" cy="9" r="9" fill="#b7b7b7"/><circle cx="29.5" cy="9" r="1.2" fill="white"/><circle cx="34" cy="9" r="1.2" fill="white"/><circle cx="38.5" cy="9" r="1.2" fill="white"/></svg></div></div>
        </div>
        <div className="tn-checkout-field"><label htmlFor={id("name")}>Nombre del titular como aparece en la tarjeta</label><input id={id("name")} placeholder="María López" autoComplete="cc-name" /></div>
        <div className="tn-checkout-field"><label htmlFor={id("doc")}>Documento del titular</label><div className="tn-checkout-document"><select id={id("doc-type")} aria-label="Tipo de documento"><option value="DNI">DNI</option></select><input id={id("doc")} placeholder="99999999" inputMode="numeric" autoComplete="off" /></div></div>
        <div hidden aria-hidden="true"><select id={id("issuer")} tabIndex={-1} /><select id={id("installments")} tabIndex={-1} /><input id={id("email")} type="email" defaultValue={compra?.email || ""} tabIndex={-1} /></div>
        <button type="submit" className="tn-checkout-pay" disabled={busy || !ready || fetching > 0 || !compra || compra.status !== "nuevo"}><MenuCuentaCheckoutLock />{busy ? "Procesando…" : !ready ? "Preparando…" : "Pagar"}</button>
    </form>
}

function MenuCuentaGraciasCalendario() {
    return <div className="tn-thanks-art"><img className="tn-thanks-illustration" src={MenuCuentaGraciasImagen} alt="Calendario celebrando" /></div>
}

function MenuCuentaGraciasPlanes({ logo, nombre, fecha }: { logo?: string; nombre: string; fecha: string }) {
    return <div className="tn-thanks-content">
        <div className="tn-thanks-brand"><MenuCuentaCheckoutBrand logo={logo} /></div>
        <div className="tn-thanks-copy"><h2 id="tn-planes-title">¡Gracias por renovar con Turnits!</h2><p>Tu pago se realizó correctamente. Tienes vigencia en el Plan {nombre}<br />hasta el {new Date(fecha).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p></div>
        <MenuCuentaGraciasCalendario />
    </div>
}

function MenuCuentaPlanesModal({ api, checkoutLogo, planInicial, onClose }: { api: string; checkoutLogo?: string; planInicial?: string; onClose: () => void }) {
    const [catalogo, setCatalogo] = React.useState<any[]>([])
    const [cuenta, setCuenta] = React.useState<any>(null)
    const [periodo, setPeriodo] = React.useState("mensual")
    const [seleccion, setSeleccion] = React.useState<any>(null)
    const [avisoPlan, setAvisoPlan] = React.useState<any>(null)
    const [compra, setCompra] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState("")
    const [mensaje, setMensaje] = React.useState("")
    const [medio, setMedio] = React.useState("tarjeta")
    const busyRef = React.useRef(false)
    const dialog = React.useRef<HTMLDivElement>(null)
    const mounted = React.useRef(true)
    const closeRef = React.useRef(onClose)
    closeRef.current = () => { if (compra?.status === "approved") { const url = new URL(window.location.href); url.searchParams.delete("status"); window.history.replaceState(window.history.state, "", url.toString()); window.location.reload() } else onClose() }
    const slug = MenuFooter_getSlug()
    const money = (n: number) => "$" + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })
    async function request(path: string, body?: any) {
        const token = MenuFooter_getToken()
        if (!slug || !token) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.")
        const response = await fetch(api + path, { method: body === undefined ? "GET" : "POST", cache: "no-store",
            headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.success) {
            if (data.compra && mounted.current) { setCompra(data.compra); setSeleccion(null); setMedio(data.compra.medio) }
            const e: any = new Error(data.error || "No se pudo completar la operación.")
            e.status = data.status
            throw e
        }
        return data
    }
    React.useEffect(() => {
        mounted.current = true
        const previous = document.activeElement as HTMLElement
        const overflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        dialog.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !busyRef.current) closeRef.current()
            if (e.key !== "Tab") return
            const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), iframe, [tabindex="0"]') || []).filter(el => el.getClientRects().length)
            const first = nodes[0], last = nodes[nodes.length - 1]
            if (!first) { e.preventDefault(); dialog.current?.focus(); return }
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus() }
        }
        document.addEventListener("keydown", onKey)
        Promise.all([request("/planes"), request("/suscripcion/" + encodeURIComponent(slug) + (new URLSearchParams(window.location.search).get("status")?.startsWith("renovacion_") ? "?retorno=1" : ""))]).then(async ([planes, account]) => {
            if (!mounted.current) return
            if (planInicial && account.compra && account.compra.status !== "approved" && (planInicial === "gratis" || account.compra.plan !== account.plan || account.compra.periodo !== "mensual")) {
                try {
                    await request(`/suscripcion/${encodeURIComponent(slug)}/compra/${account.compra.id}/cancelar`, {})
                    account.compra = null
                } catch (e) {
                    if (mounted.current) setError(e instanceof Error ? e.message : "Hay una compra en curso.")
                }
                if (!mounted.current) return
            }
            setCatalogo(planes.planes); setCuenta(account); setCompra(account.compra); setMedio(account.compra?.medio || (account.tarjeta_disponible ? "tarjeta" : "mercadopago")); if (account.compra?.periodo) setPeriodo(account.compra.periodo)
            if (planInicial && !account.compra) {
                const elegido = planes.planes.find((p: any) => p.id === (planInicial === "gratis" ? "gratis" : account.plan) && (planInicial === "gratis" || ["basico", "premium"].includes(p.id)))
                if (elegido) {
                    elegirOferta(elegido, account)
                }
            }
        }).catch(e => { if (mounted.current) setError(e.message) }).finally(() => { if (mounted.current) setLoading(false) })
        return () => { mounted.current = false; document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus() }
    }, [api, slug, planInicial])
    async function action(fn: () => Promise<void>) {
        if (busyRef.current) return
        busyRef.current = true; setBusy(true); setError("")
        try { await fn() } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Error de conexión.") }
        finally { busyRef.current = false; if (mounted.current) setBusy(false) }
    }
    function showResult(data: any) {
        if (!mounted.current) return
        setCompra((prev: any) => ({ ...prev, status: data.status }))
        setMensaje(["rejected", "cancelled", "refunded", "charged_back"].includes(data.status) ? (data.message || "El pago no se aprobó.") : "")
        if (data.status === "approved") setCuenta((prev: any) => ({ ...prev, plan: data.plan, estado: "activo", fecha_vencimiento: data.fecha_vencimiento }))
    }
    React.useEffect(() => {
        if (!compra?.id || compra.status === "approved" || ["rejected", "cancelled", "refunded", "charged_back"].includes(compra.status) || (compra.medio === "tarjeta" && compra.status === "nuevo")) return
        let stopped = false, checking = false
        const check = async () => {
            if (stopped || checking || busyRef.current) return
            checking = true
            try { const data = await request(`/suscripcion/${encodeURIComponent(slug)}/compra/${compra.id}/estado`); if (!stopped) showResult(data) } catch {} finally { checking = false }
        }
        check()
        const timer = window.setInterval(check, 5000)
        window.addEventListener("focus", check)
        document.addEventListener("visibilitychange", check)
        return () => { stopped = true; clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check) }
    }, [api, slug, compra?.id, compra?.status])
    async function prepararTarjeta(plan: any, intervalo: string) {
        const data = await request("/suscripcion/" + encodeURIComponent(slug) + "/compra", { plan: plan.id, periodo: intervalo, medio: "tarjeta" })
        if (mounted.current) { setCompra(data.compra); setMensaje("") }
    }
    function elegirOferta(plan: any, account = cuenta) {
        if (busyRef.current) return
        if (!["gratis", "basico", "premium"].includes(account?.plan)) {
            setError("No se pudo confirmar tu plan actual. Volvé a abrir los planes.")
            return
        }
        if (plan.id === "gratis") {
            setSeleccion(null); setError(""); setMensaje("")
            setAvisoPlan(account.plan === "gratis" ? null : plan)
            return
        }
        const orden = { gratis: 0, basico: 1, premium: 2 }
        if (orden[plan.id] < orden[account?.plan] || account?.reducciones?.[plan.id]?.miembros_a_eliminar?.length) {
            setAvisoPlan(plan); setError(""); setMensaje("")
            return
        }
        confirmarOferta(plan, account)
    }
    async function revisarOferta(plan: any) {
        if (busyRef.current) return
        let account: any = null
        await action(async () => {
            account = await request(`/suscripcion/${encodeURIComponent(slug)}`)
            if (mounted.current) setCuenta(account)
        })
        if (account && mounted.current) elegirOferta(plan, account)
    }
    function confirmarOferta(plan: any, account = cuenta) {
        if (busyRef.current) return
        if (plan.id === "gratis") { elegirOferta(plan, account); return }
        setSeleccion(plan); setError(""); setMensaje("")
        const next = account?.tarjeta_disponible ? "tarjeta" : "mercadopago"
        setMedio(next)
        if (plan.id !== "gratis" && next === "tarjeta") action(() => prepararTarjeta(plan, periodo))
    }
    function aceptarReduccion() {
        if (busyRef.current || !avisoPlan) return
        if (avisoPlan.id === "gratis") {
            action(aplicarPlanGratis)
        } else {
            const plan = avisoPlan
            setAvisoPlan(null)
            confirmarOferta(plan)
        }
    }
    async function aplicarPlanGratis() {
        const account = await request(`/suscripcion/${encodeURIComponent(slug)}`)
        if (!mounted.current) return
        setCuenta(account)
        if (account.plan === "gratis") {
            setAvisoPlan(null); setSeleccion(null); setError(""); setMensaje("")
            return
        }
        if (!["basico", "premium"].includes(account.plan)) throw new Error("No se pudo confirmar tu plan actual.")
        await request(`/renovacion/downgrade/${encodeURIComponent(slug)}`, {})
        const url = new URL(window.location.href)
        url.searchParams.delete("planes"); url.searchParams.delete("status")
        window.history.replaceState(window.history.state, "", url.toString())
        window.location.reload()
    }
    const cambiarMedio = (next: string, retry = false) => {
        if (busyRef.current || (next === metodoActual && !retry)) return
        
        action(async () => {
            if (compra && !terminal) await request(`/suscripcion/${encodeURIComponent(slug)}/compra/${compra.id}/cancelar`, {})
            if (!mounted.current) return
            setSeleccion(oferta); setCompra(null); setMedio(next); setMensaje("")
            if (next === "tarjeta") await prepararTarjeta(oferta, compra?.periodo || periodo)
        })
    }
    const pagarMercadoPago = () => {
        if (busyRef.current) return
        const tab = window.open("about:blank", "_blank")
        if (tab) tab.opener = null
        action(async () => {
            try {
                const data = await request("/suscripcion/" + encodeURIComponent(slug) + "/compra", { plan: oferta.id, periodo, medio: "mercadopago" })
                if (!data.compra?.payment_url) throw new Error("No se pudo abrir Mercado Pago.")
                if (mounted.current) { setCompra(data.compra); setMensaje("") }
                if (tab) tab.location.href = data.compra.payment_url
                else if (mounted.current) setError("Tu navegador bloqueó la ventana. Tocá Pagar para abrir Mercado Pago.")
            } catch (e) { tab?.close(); throw e }
        })
    }
    async function pagarTarjeta(card: any) {
        if (busyRef.current || compra.status !== "nuevo") throw new Error("Hay un pago en curso.")
        busyRef.current = true; setBusy(true); setError(""); setCompra((prev: any) => ({ ...prev, status: "procesando" }))
        try { showResult(await request(`/suscripcion/${encodeURIComponent(slug)}/compra/${compra.id}/pagar`, { card })) }
        catch (e: any) {
            if (mounted.current) { setCompra((prev: any) => ({ ...prev, status: e.status || "unknown" })); setError(e.message || "Consultá el estado antes de volver a pagar.") }
            throw e
        } finally { busyRef.current = false; if (mounted.current) setBusy(false) }
    }
    const volver = () => action(async () => {
        
        if (compra && !terminal) await request(`/suscripcion/${encodeURIComponent(slug)}/compra/${compra.id}/cancelar`, {})
        if (mounted.current) { setCompra(null); setSeleccion(null); setMensaje("") }
    })
    const features = (id: string) => id === "gratis" ? ["Agenda y recordatorios", "Servicios y productos ilimitados", "Sólo el titular", "Hasta 10 clientes visibles", "Estadísticas básicas y finanzas", "Mercado Pago: tarjetas y saldo", "$300 o 2% por cobro, el mayor"] : id === "basico" ? ["Todo lo de Gratis", "Titular + 2 miembros de equipo", "Hasta 50 clientes visibles", "Temas y estadísticas completas", "Combos y promociones", "Acceso y rendimiento del equipo", "$100 o 0,8% por cobro, el mayor"] : ["Todo lo de Básico", "Profesionales y clientes ilimitados", "Transferencia y efectivo", "Reservas sin cobro previo", "Soporte prioritario", "Sin comisión Turnits"]
    const button: React.CSSProperties = { border: 0, borderRadius: 11, padding: "13px 18px", background: "#181b18", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 650, cursor: busy ? "wait" : "pointer", opacity: busy ? .6 : 1 }
    const oferta = seleccion || (compra ? catalogo.find(p => p.id === compra.plan) : null)
    const total = compra?.monto ?? (periodo === "anual" ? seleccion?.precio_anual : seleccion?.precio_mensual)
    const anual = compra ? compra.periodo === "anual" : periodo === "anual"
    const terminal = compra && ["rejected", "cancelled", "refunded", "charged_back"].includes(compra.status)
    const metodoActual = compra?.medio || medio
    const isSuccess = compra?.status === "approved"
    const isCheckout = !!oferta && oferta.id !== "gratis" && compra?.status !== "approved"
    const miembrosReducidos = cuenta?.reducciones?.[avisoPlan?.id]?.miembros_a_eliminar || []
    React.useLayoutEffect(() => {
        if (dialog.current) dialog.current.scrollTop = 0
    }, [isCheckout, metodoActual, seleccion?.id, avisoPlan?.id])
    return <div className="tn-planes-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busyRef.current) closeRef.current() }}>
        <style>{`
          .tn-planes-overlay{position:fixed;inset:0;z-index:100020;background:rgba(15,23,42,.38);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;overflow:auto}
          .tn-planes-dialog{width:100%;max-width:1040px;max-height:calc(100dvh - 48px);overflow:auto;padding:30px;border-radius:24px;background:#fff;box-shadow:0 24px 80px #0f172a26;box-sizing:border-box;color:#111827;font-family:${MenuCuenta_FONT};outline:none}
          .tn-planes-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:32px}
          .tn-planes-card{position:relative;border:1px solid #e2e8f0;border-radius:18px;padding:28px 23px;display:flex;flex-direction:column;min-width:0;gap:18px}
          .tn-planes-card.featured{border:1.5px solid #196b1f;background:linear-gradient(180deg,#196b1f0d,#fff 48%);box-shadow:0 8px 28px #196b1f15}
          .tn-planes-dialog button:focus-visible,.tn-planes-dialog a:focus-visible{outline:2px solid #196b1f;outline-offset:3px}
          .tn-planes-dialog button:not(:disabled):hover{filter:brightness(.96)}
          @media(max-width:760px){.tn-planes-overlay{padding:12px}.tn-planes-dialog{padding:24px 18px;max-height:calc(100dvh - 24px);border-radius:20px}.tn-planes-grid{grid-template-columns:1fr;gap:26px}.tn-planes-card{padding:26px 22px}}
          .tn-planes-dialog.tn-checkout-dialog{position:relative;min-height:min(716px,calc(100dvh - 48px))}
          .tn-checkout-controls{position:absolute;right:30px;top:30px;display:flex;gap:16px;z-index:2}
          .tn-checkout-control{width:34px;height:34px;border:0;border-radius:11px;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
          .tn-checkout-control:disabled{opacity:.45;cursor:default}
          .tn-checkout-layout{display:grid;grid-template-columns:248px minmax(0,1fr);gap:44px;width:calc(100% - 118px);margin-left:82px;min-height:656px}
          .tn-checkout-left{padding-top:58px;min-width:0}
          .tn-checkout-brand{margin-left:26px;width:184px;height:64px;display:flex;align-items:center;gap:9px;color:#000}
          .tn-checkout-brand img{width:100%;height:100%;object-fit:contain}
          .tn-checkout-brand span{font-size:36px;font-weight:750;letter-spacing:-1.8px}
          .tn-checkout-methods h3{font-size:16px;line-height:20px;margin:34px 0 20px;font-weight:700;color:#000}
          .tn-checkout-options{display:grid;gap:22px}
          .tn-checkout-option{height:122px;width:100%;padding:16px;display:grid;grid-template-columns:32px minmax(0,1fr);gap:16px;align-items:center;box-sizing:border-box;border:1px solid #111;border-radius:20px;background:white;color:#000;text-align:left;font-family:inherit;cursor:pointer}
          .tn-checkout-option:disabled{cursor:default}
          .tn-checkout-option:not(:disabled):hover{filter:none!important}
          .tn-checkout-option:disabled:not([aria-checked="true"]){opacity:.72}
          .tn-checkout-radio{width:32px;height:32px;box-sizing:border-box;border:5px solid #f0f0f0;border-radius:50%;background:#b5b5b5}
          .tn-checkout-radio.selected{border:5px solid #000;background:#fff}
          .tn-checkout-option-copy{display:flex;flex-direction:column;gap:5px;min-width:0}
          .tn-checkout-option-copy strong{font-size:20px;line-height:24px;font-weight:700;letter-spacing:-.25px}
          .tn-checkout-option-copy>span{font-size:16px;line-height:19px;font-weight:400}
          .tn-checkout-card-brands{display:flex;align-items:center;gap:7px;white-space:nowrap}
          .tn-checkout-card-brands svg{flex-shrink:0}
          .tn-checkout-right{min-width:0;padding-top:6px;align-self:start}
          .tn-checkout-plan-title{font-size:26px;line-height:32px;font-weight:700;color:#090e1a;margin:0;letter-spacing:-.6px}
          .tn-checkout-summary{height:76px;padding:20px;box-sizing:border-box;border-radius:16px;background:#f8f9fb;margin-top:22px;display:flex;align-items:center;justify-content:space-between;gap:18px}
          .tn-checkout-summary>div{display:flex;flex-direction:column;gap:5px;min-width:0}
          .tn-checkout-summary strong{font-size:12px;line-height:16px;font-weight:650;color:#111827}
          .tn-checkout-summary span{font-size:12px;line-height:16px;color:#64748b}
          .tn-checkout-summary b{font-size:26px;line-height:32px;font-weight:750;letter-spacing:-.7px;color:#080d19;white-space:nowrap}
          .tn-checkout-layout.is-card .tn-checkout-summary{margin-left:-12px;width:100%}
          .tn-checkout-card-form{margin-top:24px;width:calc(100% - 32px)}
          .tn-checkout-field{min-width:0}
          .tn-checkout-field label{display:block;font-size:14px;line-height:16px;margin:0 0 4px;color:#000}
          .tn-checkout-card-form>.tn-checkout-field+.tn-checkout-field,.tn-checkout-field-pair{margin-top:20px}
          .tn-checkout-field-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
          .tn-checkout-field-pair+.tn-checkout-field{margin-top:20px}
          .tn-checkout-card-form>.tn-checkout-field:nth-child(4){margin-top:16px}
          .tn-checkout-secure,.tn-checkout-field>input,.tn-checkout-document{width:100%;height:40px;border:1px solid #bfbfbf;border-radius:12px;box-sizing:border-box;background:#fff;overflow:hidden}
          .tn-checkout-secure{position:relative}
          .tn-checkout-secure iframe{display:block;width:100%;height:100%;border:0}
          .tn-checkout-field>input{padding:0 12px;font-family:inherit;font-size:16px;color:#111;outline:none}
          .tn-checkout-field input::placeholder{color:#929292;opacity:1}
          .tn-checkout-field>input:focus,.tn-checkout-document:focus-within,.tn-checkout-secure:focus-within{border-color:#777}
          .tn-checkout-document{display:grid;grid-template-columns:82px minmax(0,1fr);align-items:center}
          .tn-checkout-document select{height:28px;width:100%;padding:0 9px;border:0;border-right:1px solid #bfbfbf;border-radius:0;background:transparent;font-family:inherit;font-size:16px;color:#111;outline:none}
          .tn-checkout-document input{height:38px;width:100%;min-width:0;padding:0 11px;border:0;background:transparent;font-family:inherit;font-size:16px;color:#111;outline:none}
          .tn-checkout-cvv-wrap{position:relative}
          .tn-checkout-cvv-icon{position:absolute;right:8px;top:5px;pointer-events:none}
          .tn-checkout-pay{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:159px;height:48px;padding:0 16px;box-sizing:border-box;border:0;border-radius:12px;background:#196b1f;color:#fff;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
          .tn-checkout-card-form>.tn-checkout-pay{margin-top:36px}
          .tn-checkout-pay:disabled{opacity:.55;cursor:default}
          .tn-checkout-layout.is-mp .tn-checkout-right{align-self:center;padding-top:8px}
          .tn-checkout-layout.is-mp .tn-checkout-plan-title{padding-left:12px}
          .tn-checkout-mp-action{margin-top:38px;padding-left:12px}
          .tn-checkout-message{font-size:13px;line-height:1.6;margin:16px 0 0;color:#64748b}
          .tn-checkout-message.error{color:#b91c1c}
          .tn-checkout-result{margin-top:18px;color:#64748b;font-size:13px;line-height:1.6}
          .tn-checkout-check{border:0;background:#f1f5f9;padding:10px 14px;border-radius:10px;color:#475569;font-family:inherit;font-size:12px;cursor:pointer}
          .tn-checkout-retry{margin-top:24px}
          @media(min-width:761px) and (max-width:1090px){.tn-checkout-layout{width:100%;margin-left:0;grid-template-columns:230px minmax(0,1fr);gap:32px}.tn-checkout-option{padding:14px;gap:12px}.tn-checkout-option-copy strong{font-size:18px}.tn-checkout-option-copy>span{font-size:14px}.tn-checkout-card-brands{gap:5px}.tn-checkout-card-form{width:100%}.tn-checkout-layout.is-card .tn-checkout-summary{margin-left:0}}
          @media(max-width:760px){.tn-planes-dialog.tn-checkout-dialog{min-height:0;padding:68px 22px 30px}.tn-checkout-controls{top:20px;right:20px;gap:12px}.tn-checkout-layout{grid-template-columns:1fr;width:100%;margin-left:0;gap:24px;min-height:0}.tn-checkout-left,.tn-checkout-right{display:contents}.tn-checkout-layout>.tn-checkout-left>.tn-checkout-brand{order:1}.tn-checkout-details{order:2;min-width:0}.tn-checkout-methods{order:3;min-width:0}.tn-checkout-payment{order:4;min-width:0}.tn-checkout-brand{margin:0 auto;width:168px;height:50px}.tn-checkout-brand span{font-size:32px}.tn-checkout-methods h3{margin:0 0 14px;font-size:15px}.tn-checkout-options{gap:12px}.tn-checkout-option{height:100px;border-radius:17px;grid-template-columns:28px minmax(0,1fr);gap:14px;padding:16px}.tn-checkout-radio{height:28px;width:28px;border-width:4px}.tn-checkout-radio.selected{border-width:4px}.tn-checkout-option-copy strong{font-size:18px;line-height:21px}.tn-checkout-option-copy>span{font-size:14px;line-height:18px}.tn-checkout-right{padding-top:0}.tn-checkout-plan-title{font-size:23px;line-height:28px}.tn-checkout-summary{margin-top:16px;padding:16px;gap:8px}.tn-checkout-summary b{font-size:23px}.tn-checkout-layout.is-card .tn-checkout-summary{margin-left:0}.tn-checkout-card-form{width:100%;margin-top:0}.tn-checkout-field-pair{gap:12px}.tn-checkout-field label{font-size:12px;line-height:16px}.tn-checkout-document{grid-template-columns:70px minmax(0,1fr)}.tn-checkout-layout.is-mp .tn-checkout-plan-title{padding-left:0}.tn-checkout-mp-action{margin-top:0;padding-left:0}}

          .tn-thanks-dialog{position:relative;min-height:min(716px,calc(100dvh - 48px))}.tn-thanks-brand .tn-checkout-brand{margin:0 auto;height:44px}.tn-thanks-copy{width:min(620px,100%);margin:70px auto 0;padding-left:44px;box-sizing:border-box}.tn-thanks-copy h2{margin:0;font-size:34px;line-height:42px;letter-spacing:-1px;font-weight:700;color:#000;white-space:nowrap}.tn-thanks-copy p{font-size:16px;line-height:20px;color:#111;margin:8px 0 0}.tn-thanks-art{position:relative;overflow:hidden;width:300px;height:280px;max-width:100%;margin:64px auto 0}.tn-thanks-illustration{display:block;position:absolute;left:50%;top:50%;width:630px;height:auto;max-width:none;transform:translate(-50%,-50%)}@media(max-width:760px){.tn-thanks-dialog{min-height:0;padding:64px 24px 40px}.tn-thanks-copy{margin-top:38px;padding-left:0;text-align:center}.tn-thanks-copy h2{font-size:26px;line-height:32px;white-space:normal}.tn-thanks-copy p{font-size:14px;line-height:21px}.tn-thanks-art{margin-top:34px;width:260px;height:250px}.tn-thanks-illustration{width:550px}}
          @media(prefers-reduced-motion:reduce){.tn-planes-dialog *{transition:none!important}}
          .tn-reduction-dialog{position:relative;max-width:760px;padding:64px 34px 32px;text-align:center}
          .tn-reduction-title{margin:0;color:#000;font-size:34px;line-height:42px;font-weight:700;letter-spacing:-.6px}
          .tn-reduction-description{max-width:570px;margin:8px auto 0;font-size:16px;line-height:20px;color:#111}
          .tn-reduction-art{position:relative;overflow:hidden;width:330px;aspect-ratio:330/295;max-width:100%;margin:20px auto 0}
          .tn-reduction-art img{position:absolute;left:50%;top:-44.068%;transform:translateX(-50%);width:205.76%;height:auto;max-width:none}
          .tn-reduction-details{margin:8px auto 0;max-width:600px;font-size:13px;line-height:20px;color:#475569}
          .tn-reduction-details p{margin:8px 0}
          .tn-reduction-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:22px}
          @media(max-width:760px){.tn-reduction-dialog{padding:64px 22px 28px}.tn-reduction-title{font-size:27px;line-height:34px}.tn-reduction-description{font-size:14px;line-height:20px}.tn-reduction-art{margin-top:16px}.tn-reduction-details{font-size:12px;line-height:18px}}
        `}</style>
        <motion.div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tn-planes-title" className={"tn-planes-dialog" + (avisoPlan ? " tn-reduction-dialog" : isCheckout ? " tn-checkout-dialog" : isSuccess ? " tn-thanks-dialog" : "")} initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .18 }}>
            {avisoPlan ? <div className="tn-checkout-controls"><button type="button" className="tn-checkout-control" disabled={busy} onClick={onClose} aria-label="Cerrar aviso">×</button></div> : <>
            {isSuccess ? <div className="tn-checkout-controls"><button type="button" className="tn-checkout-control" onClick={() => closeRef.current()} aria-label="Cerrar confirmación"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div> : isCheckout ? <div className="tn-checkout-controls"><button type="button" className="tn-checkout-control" disabled={busy} onClick={volver} aria-label="Volver a los planes"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 5-5 5 5 5M4 10h9a7 7 0 0 1 7 7v2" /></svg></button><button type="button" className="tn-checkout-control" disabled={busy} onClick={onClose} aria-label="Cerrar planes"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div> : <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <h2 id="tn-planes-title" style={{ margin: 0, fontSize: 25, fontWeight: 650 }}>{compra?.status === "approved" ? "Tu plan ya está activo" : oferta ? `Plan ${oferta.nombre}` : "Un plan para cada etapa"}</h2>
                <button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar planes" style={{ border: 0, borderRadius: 10, background: "#f1f5f9", width: 34, height: 34, flexShrink: 0, cursor: "pointer", color: "#64748b", fontSize: 24 }}>×</button>
            </div>}
            {!oferta && <p style={{ margin: "9px 0 20px", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>Elegí las herramientas que necesita tu negocio.{cuenta && <> Tu plan actual: <strong>{catalogo.find(p => p.id === cuenta.plan)?.nombre || cuenta.plan}</strong>{cuenta.estado === "trial" ? " · en prueba" : ""}.</>}</p>}
            </>}
            {error && !isCheckout && <p role="alert" style={{ fontSize: 13, color: "#b91c1c", padding: 12, background: "#fef2f2", borderRadius: 10 }}>{error}</p>}
            {loading ? <p role="status">Cargando planes…</p> : avisoPlan ? <>
                <h2 id="tn-planes-title" className="tn-reduction-title">¡Aviso de reducción!</h2>
                <p className="tn-reduction-description">Estás por pasar tu cuenta a un plan con menos funcionalidades,<br /> por lo que perderás acceso y configuraciones.</p>
                <div className="tn-reduction-art"><img src={MenuCuentaReduccionImagen} alt="Calendario con una señal de advertencia" /></div>
                <div className="tn-reduction-details">
                    {miembrosReducidos.length > 0 && <p>Al activar Plan {avisoPlan.nombre}, se eliminarán los últimos {miembrosReducidos.length} empleados agregados que excedan el límite y su catálogo propio. Actualmente: <strong>{miembrosReducidos.map((m: any) => m.nombre).join(", ")}</strong>. Esta eliminación es permanente.</p>}
                    <p>{avisoPlan.id === "gratis" ? "Quedará sólo el titular, se desactivarán las promociones y se restablecerá el tema. Se deshabilitarán transferencia, efectivo y reservas sin cobro." : "Quedarán el titular y hasta 2 empleados. Se deshabilitarán transferencia, efectivo y reservas sin cobro."} El listado mostrará hasta {avisoPlan.id === "gratis" ? "10" : "50"} clientes.</p>
                    {avisoPlan.id !== "gratis" && <p>La reducción se aplicará únicamente cuando se apruebe el pago.</p>}
                </div>
                <div className="tn-reduction-actions"><button type="button" disabled={busy} style={{...button,background:"#f1f5f9",color:"#475569"}} onClick={() => {setAvisoPlan(null);setError("")}}>Volver</button><button type="button" disabled={busy} style={{...button,background:"#196b1f"}} onClick={aceptarReduccion}>{busy ? "Aplicando…" : `Continuar con Plan ${avisoPlan.nombre}`}</button></div>
            </> : !oferta && !compra ? <>
                <div style={{ display: "flex", justifyContent: "center" }}><div role="group" aria-label="Período del plan" style={{ display: "inline-flex", gap: 4, background: "#f1f5f9", borderRadius: 12, padding: 4 }}>
                    {["mensual", "anual"].map(v => <button key={v} type="button" aria-pressed={periodo === v} onClick={() => setPeriodo(v)} style={{ border: 0, borderRadius: 9, padding: "10px 15px", fontFamily: "inherit", background: periodo === v ? "#fff" : "transparent", boxShadow: periodo === v ? "0 2px 5px #0f172a0c" : "none", color: periodo === v ? "#196b1f" : "#64748b", fontWeight: 650, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>{v === "anual" ? "Anual" : "Mensual"}{v === "anual" && <span style={{ fontSize: 10, background: "#e8f4e9", padding: "3px 6px", borderRadius: 5 }}>33% OFF</span>}</button>)}
                </div></div>
                <div className="tn-planes-grid">{catalogo.map(p => {
                    const gratis = p.id === "gratis", featured = p.id === "basico", monto = periodo === "anual" && !gratis ? p.precio_anual : p.precio_mensual
                    const actual = cuenta?.plan === p.id && (gratis || (cuenta?.estado === "activo" && (!cuenta.fecha_vencimiento || new Date(cuenta.fecha_vencimiento) > new Date())))
                    return <div key={p.id} className={"tn-planes-card" + (featured ? " featured" : "")}>
                        {featured && <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "6px 13px", borderRadius: 99, background: "#196b1f", color: "#fff", fontSize: 12, fontWeight: 700 }}><TurnitsPlanIcon plan="basico" size={14} />Más elegido</span>}
                        <div style={{ textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 15, color: featured ? "#196b1f" : "#111827" }}>{!gratis && <TurnitsPlanIcon plan={p.id} size={20} />}Plan {p.nombre}</div>
                            <div style={{ fontSize: 31, fontWeight: 800, marginTop: 12, color: featured ? "#196b1f" : "#111827", letterSpacing: "-.7px" }}>{gratis ? "GRATIS" : money(monto)}</div>
                            <div style={{ minHeight: 39, marginTop: 7, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{gratis ? "Sin suscripción" : periodo === "anual" ? <><s>{money(p.precio_mensual * 12)}</s> / año<br />Equivale a {money(monto / 12)} / mes</> : "Por período de 30 días"}</div>
                        </div>
                        <div style={{ height: 1, background: "#e2e8f0" }} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{features(p.id).map(f => <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.5 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#196b1f" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg><span>{f}</span></div>)}</div>
                        <button type="button" disabled={busy || (gratis && actual)} onClick={() => revisarOferta(p)} style={{ ...button, marginTop: "auto", width: "100%", background: featured ? "#196b1f" : gratis ? "#f1f5f9" : "#181b18", color: gratis ? "#475569" : "#fff", opacity: gratis && actual ? .6 : 1 }}>{gratis ? actual ? "Plan actual" : "Pasar a Gratis" : actual ? "Renovar plan" : "Comprar plan"}</button>
                    </div>
                })}</div>
                <p style={{ margin: "20px 0 0", fontSize: 12, lineHeight: 1.6, color: "#64748b", textAlign: "center" }}>Anual: un pago por 365 días, con 33% de descuento sobre 12 mensualidades. Mercado Pago cobra sus costos de procesamiento por separado.</p>
            </> : isSuccess ? <MenuCuentaGraciasPlanes logo={checkoutLogo} nombre={catalogo.find(p => p.id === (compra?.plan || cuenta?.plan))?.nombre || "Premium"} fecha={cuenta.fecha_vencimiento} /> : oferta && <div className={"tn-checkout-layout " + (metodoActual === "tarjeta" ? "is-card" : "is-mp")}>
                <div className="tn-checkout-left">
                    <MenuCuentaCheckoutBrand logo={checkoutLogo} />
                    <MenuCuentaCheckoutMethods value={metodoActual} cardAvailable={cuenta?.tarjeta_disponible} disabled={busy} onChange={cambiarMedio} />
                </div>
                <div className="tn-checkout-right">
                    <div className="tn-checkout-details">
                    <h2 id="tn-planes-title" className="tn-checkout-plan-title">Plan {oferta.nombre}</h2>
                    <div className="tn-checkout-summary"><div><strong>{anual ? "Plan anual · 33% OFF" : "Plan mensual"}</strong><span>{anual ? "365 días · un solo pago" : "30 días · un solo pago"}</span></div><b>{money(total)}</b></div>
                    </div>
                    <div className="tn-checkout-payment">
                    {metodoActual === "tarjeta" && <MenuCuentaPlanTarjeta compra={compra} busy={busy} onSubmit={pagarTarjeta} onError={setError} />}
                    {metodoActual === "mercadopago" && (!compra || compra.payment_url) && <div className="tn-checkout-mp-action">
                        {compra?.payment_url ? <a className="tn-checkout-pay" href={compra.payment_url} target="_blank" rel="noopener noreferrer"><MenuCuentaCheckoutLock />Pagar</a> : <button type="button" className="tn-checkout-pay" disabled={busy} onClick={pagarMercadoPago}><MenuCuentaCheckoutLock />{busy ? "Preparando…" : "Pagar"}</button>}
                    </div>}
                    {error && <p role="alert" className="tn-checkout-message error">{error}</p>}
                    {mensaje && <p role="status" className="tn-checkout-message">{mensaje}</p>}
                    {terminal && <button type="button" disabled={busy} className="tn-checkout-pay tn-checkout-retry" onClick={() => cambiarMedio(metodoActual, true)}>Volver a intentar</button>}
                    </div>
                </div>
            </div>}
        </motion.div>
    </div>
}

function MenuCuentaGraciasDemo({ api, logo, onClose }: { api: string; logo?: string; onClose: () => void }) {
    const [cuenta, setCuenta] = React.useState<any>(null)
    const dialog = React.useRef<HTMLDivElement>(null)
    React.useEffect(() => {
        let active = true
        const previous = document.activeElement as HTMLElement
        const overflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        dialog.current?.focus()
        const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "Tab") { e.preventDefault(); dialog.current?.querySelector<HTMLButtonElement>("button")?.focus() } }
        document.addEventListener("keydown", key)
        const slug = MenuFooter_getSlug(), token = MenuFooter_getToken()
        if (slug && token) fetch(String(api).replace(/\/+$/, "") + "/suscripcion/" + encodeURIComponent(slug), { headers: { Authorization: "Bearer " + token }, cache: "no-store" }).then(r => r.json()).then(data => { if (active && data.success) setCuenta(data) }).catch(() => {})
        return () => { active = false; document.body.style.overflow = overflow; document.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus() }
    }, [api])
    const nombre = cuenta?.plan === "premium" ? "Premium" : "Básico"
    const fecha = cuenta?.fecha_vencimiento || new Date(Date.now() + 30 * 86400000).toISOString()
    return <div className="tn-planes-overlay" data-preview="gracias-pagarplan" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><style>{MenuCuentaGraciasPreviewCSS}</style><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tn-planes-title" className="tn-planes-dialog tn-thanks-dialog"><div className="tn-checkout-controls"><button type="button" className="tn-checkout-control" aria-label="Cerrar vista previa" onClick={onClose}>×</button></div><MenuCuentaGraciasPlanes logo={logo} nombre={nombre} fecha={fecha} /><span style={{position:"absolute",bottom:22,left:0,right:0,textAlign:"center",fontSize:11,color:"#94a3b8"}}>Vista previa · no confirma ni realiza un pago</span></div></div>
}

function MenuCuentaPagoRetorno({ api, logo }: { api: string; logo?: string }) {
    const [visible, setVisible] = React.useState(false)
    const [planInicial, setPlanInicial] = React.useState<string | undefined>(undefined)
    const [graciasDemo, setGraciasDemo] = React.useState(false)
    React.useEffect(() => {
        if (new URLSearchParams(window.location.search).get("status")?.startsWith("renovacion_")) setVisible(true)
        if (new URLSearchParams(window.location.search).get("gracias") === "pagarplan") { setGraciasDemo(true); setVisible(true) }
        if (new URLSearchParams(window.location.search).get("planes") === "gratis") { setPlanInicial("gratis"); setVisible(true) }
        if (new URLSearchParams(window.location.search).get("planes") === "actual") { setPlanInicial("actual"); setVisible(true) }
        const abrir = (event: Event) => {
            setPlanInicial((event as CustomEvent).detail?.plan || "actual")
            setVisible(true)
        }
        window.addEventListener("turnits:abrir-checkout-plan", abrir)
        return () => window.removeEventListener("turnits:abrir-checkout-plan", abrir)
    }, [])
    if (!visible || typeof document === "undefined") return null
    if (graciasDemo) return createPortal(<MenuCuentaGraciasDemo api={api} logo={logo} onClose={() => { const url = new URL(window.location.href); url.searchParams.delete("gracias"); url.searchParams.delete("status"); window.history.replaceState(window.history.state, "", url.toString()); setVisible(false); setGraciasDemo(false) }} />, document.body)
    return createPortal(<MenuCuentaPlanesModal api={String(api).replace(/\/+$/, "")} checkoutLogo={logo} planInicial={planInicial} onClose={() => { const url = new URL(window.location.href); url.searchParams.delete("status"); url.searchParams.delete("planes"); window.history.replaceState(window.history.state, "", url.toString()); setVisible(false); setPlanInicial(undefined) }} />, document.body)
}

function MenuCuenta({
    baseUrl,
    logoutUrl,
    logoImage,
    checkoutLogo,
}: {
    baseUrl: string
    logoutUrl: string
    logoImage: string | null
    checkoutLogo?: string
}) {
    const api = String(baseUrl).replace(/\/+$/, "")
    const isCanvas = false

    const [abierto, setAbierto] = React.useState(false)
    const [hoverTrigger, setHoverTrigger] = React.useState(false)
    const [subAbierto, setSubAbierto] = React.useState(false)
    const [fly, setFly] = React.useState<{ top: number; left: number } | null>(
        null
    )
    const [pos, setPos] = React.useState<{
        left: number
        width: number
        bottom: number
    } | null>(null)
    const [email, setEmail] = React.useState("")
    const [plan, setPlan] = React.useState("")
    const [borrarAbierto, setBorrarAbierto] = React.useState(false)
    const [planesAbierto, setPlanesAbierto] = React.useState(false)

    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const flyRef = React.useRef<HTMLDivElement>(null)
    const subRowRef = React.useRef<HTMLButtonElement>(null)

    const cargarDatos = React.useCallback(async () => {
        if (isCanvas) {
            setEmail("tu@email.com")
            return
        }
        const guardado = safeLocalStorage("user_email")
        if (guardado) setEmail((prev) => prev || guardado)
        try {
            const slug = MenuFooter_getSlug()
            const token = MenuFooter_getToken()
            if (!slug || !token) return
            const res = await fetch(`${api}/settings/${slug}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-cache",
            })
            const data = await res.json()
            if (data?.success) {
                if (data.settings?.email) setEmail(data.settings.email)
                setPlan(data.settings?.plan || "")
            }
        } catch {}
    }, [api, isCanvas])

    const cerrar = React.useCallback(() => {
        setAbierto(false)
        setSubAbierto(false)
        setFly(null)
    }, [])

    const alternar = () => {
        if (abierto) {
            cerrar()
            return
        }
        const btn = triggerRef.current
        const fila = btn?.parentElement
        if (btn && fila) {
            const t = btn.getBoundingClientRect()
            const f = fila.getBoundingClientRect()
            setPos({
                left: f.left,
                width: f.width,
                bottom: window.innerHeight - t.top + 8,
            })
        }
        setAbierto(true)
        cargarDatos()
    }

    const alternarSub = () => {
        if (subAbierto) {
            setSubAbierto(false)
            return
        }
        const m = menuRef.current?.getBoundingClientRect()
        const fila = subRowRef.current?.getBoundingClientRect()
        if (m && fila && window.innerWidth - m.right >= MenuCuenta_FLY_W + 12) {
            // Hay lugar a la derecha (PC): submenú al costado.
            setFly({
                left: m.right + 6,
                top: Math.max(
                    8,
                    Math.min(fila.top - 6, window.innerHeight - 110)
                ),
            })
        } else {
            // Mobile: se despliega dentro del mismo menú.
            setFly(null)
        }
        setSubAbierto(true)
    }

    // Cierra al tocar afuera, con Escape, al redimensionar o al scrollear.
    React.useEffect(() => {
        if (!abierto) return
        const onDown = (e: Event) => {
            const t = e.target as Node
            if (
                menuRef.current?.contains(t) ||
                flyRef.current?.contains(t) ||
                triggerRef.current?.contains(t)
            )
                return
            cerrar()
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") cerrar()
        }
        const onScroll = (e: Event) => {
            const t = e.target as any
            const btn = triggerRef.current
            if (btn && t && typeof t.contains === "function" && t.contains(btn))
                cerrar()
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("touchstart", onDown, { passive: true })
        document.addEventListener("keydown", onKey)
        window.addEventListener("resize", cerrar)
        window.addEventListener("scroll", onScroll, true)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("touchstart", onDown)
            document.removeEventListener("keydown", onKey)
            window.removeEventListener("resize", cerrar)
            window.removeEventListener("scroll", onScroll, true)
        }
    }, [abierto, cerrar])

    const abrirUrl = (url: string) => {
        cerrar()
        window.open(url, "_blank", "noopener,noreferrer")
    }

    const itemsInfo = (
        <>
            <MenuCuentaItem
                label="Términos y condiciones"
                right={MenuCuentaIconExterno}
                onClick={() => abrirUrl(MenuCuenta_TERMINOS_URL)}
            />
            <MenuCuentaItem
                label="Política de privacidad"
                right={MenuCuentaIconExterno}
                onClick={() => abrirUrl(MenuCuenta_PRIVACIDAD_URL)}
            />
        </>
    )

    const cardStyle: React.CSSProperties = {
        position: "fixed",
        zIndex: MenuCuenta_Z,
        boxSizing: "border-box",
        padding: 6,
        background: "#ffffff",
        border: "1px solid #e5e9f0",
        borderRadius: 14,
        boxShadow: MenuCuenta_SHADOW,
        fontFamily: MenuCuenta_FONT,
    }

    return (
        <>
            <style>{`.tn-cuenta-name > div { overflow: hidden; text-overflow: ellipsis; }`}</style>
            <button
                ref={triggerRef}
                type="button"
                onClick={alternar}
                onMouseEnter={() => setHoverTrigger(true)}
                onMouseLeave={() => setHoverTrigger(false)}
                aria-haspopup="menu"
                aria-expanded={abierto}
                aria-label="Menú de la cuenta"
                title="Cuenta"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    minWidth: 0,
                    padding: "3px 8px 3px 3px",
                    margin: "-3px 0 -3px -3px",
                    border: "none",
                    borderRadius: 12,
                    background:
                        abierto || hoverTrigger ? "#eef1f6" : "transparent",
                    cursor: "pointer",
                    fontFamily: MenuCuenta_FONT,
                    textAlign: "left",
                    transition: "background 0.15s ease",
                }}
            >
                <MenuUserAvatar logoImage={logoImage} size={34} />
                <div
                    className="tn-cuenta-name"
                    style={{ minWidth: 0, overflow: "hidden" }}
                >
                    <UserGreeting
                        baseUrl={baseUrl}
                        fontSize={14}
                        color="#0f172a"
                    />
                </div>
                <MenuCuentaSvg
                    size={15}
                    style={{
                        color: "#94a3b8",
                        transform: abierto ? "rotate(180deg)" : "none",
                        transition: "transform 0.18s ease",
                    }}
                >
                    <path d="M6 9l6 6 6-6" />
                </MenuCuentaSvg>
            </button>

            {typeof document !== "undefined" &&
                createPortal(
                    <>
                        <AnimatePresence>
                            {abierto && pos && (
                                <motion.div
                                    key="menu-cuenta"
                                    ref={menuRef}
                                    role="menu"
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                    transition={{
                                        duration: 0.14,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        ...cardStyle,
                                        left: pos.left,
                                        bottom: pos.bottom,
                                        width: pos.width,
                                        transformOrigin: "bottom left",
                                    }}
                                >
                                    <div
                                        title={email}
                                        style={{
                                            padding: "8px 10px 6px",
                                            fontSize: 12,
                                            color: "#64748b",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {email || "Tu cuenta"}
                                    </div>
                                    {MenuCuentaDivider}

                                    <MenuCuentaItem
                                        icon={MenuCuentaIconPlanes}
                                        label="Planes"
                                        onClick={() => {
                                            cerrar()
                                            setPlanesAbierto(true)
                                        }}
                                    />
                                    <MenuCuentaItem
                                        innerRef={subRowRef}
                                        icon={MenuCuentaIconInfo}
                                        label="Más información"
                                        active={subAbierto}
                                        onClick={alternarSub}
                                        right={
                                            <MenuCuentaSvg
                                                size={15}
                                                style={{
                                                    transform:
                                                        subAbierto && !fly
                                                            ? "rotate(90deg)"
                                                            : "none",
                                                    transition:
                                                        "transform 0.15s ease",
                                                }}
                                            >
                                                <path d="M9 6l6 6-6 6" />
                                            </MenuCuentaSvg>
                                        }
                                    />
                                    {subAbierto && !fly && (
                                        <div
                                            style={{
                                                padding: "2px 0 4px 18px",
                                            }}
                                        >
                                            {itemsInfo}
                                        </div>
                                    )}

                                    {MenuCuentaDivider}
                                    <MenuCuentaItem
                                        danger
                                        icon={MenuCuentaIconTrash}
                                        label="Eliminar cuenta"
                                        onClick={() => {
                                            cerrar()
                                            setBorrarAbierto(true)
                                        }}
                                    />
                                </motion.div>
                            )}

                            {abierto && subAbierto && fly && (
                                <motion.div
                                    key="menu-cuenta-info"
                                    ref={flyRef}
                                    role="menu"
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -6 }}
                                    transition={{
                                        duration: 0.12,
                                        ease: "easeOut",
                                    }}
                                    style={{
                                        ...cardStyle,
                                        left: fly.left,
                                        top: fly.top,
                                        width: MenuCuenta_FLY_W,
                                    }}
                                >
                                    {itemsInfo}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {planesAbierto && <MenuCuentaPlanesModal api={api} checkoutLogo={checkoutLogo} onClose={() => setPlanesAbierto(false)} />}
                        {borrarAbierto && (
                            <MenuCuentaEliminarModal
                                api={api}
                                email={email}
                                plan={plan}
                                logoutUrl={logoutUrl}
                                onClose={() => setBorrarAbierto(false)}
                            />
                        )}
                    </>,
                    document.body
                )}
        </>
    )
}

function MenuFooterReferidosBanner({
    accentColor = "#22c55e",
    onOpenPanel,
    backgroundImage,
    colorDesde,
    colorHasta,
    icono,
}: {
    accentColor?: string
    onOpenPanel?: (panel: "basico" | "crecer" | null) => void
    backgroundImage?: string
    colorDesde?: string
    colorHasta?: string
    icono?: string
}) {
    const tieneImagen = !!backgroundImage
    // El degradé es personalizable desde Framer (colorDesde / colorHasta).
    // Si no se cargan, se mantiene el verde de siempre (colorHasta cae al
    // accentColor del panel). Si además se carga una imagen de fondo, la
    // imagen manda y el degradé queda como respaldo debajo.
    const desde = colorDesde || "#0f5c20"
    const hasta = colorHasta || accentColor
    return (
        <button
            type="button"
            onClick={() => onOpenPanel?.("crecer")}
            style={{
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 9,
                width: "100%",
                padding: "9px 10px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: "#fff",
                background: `linear-gradient(135deg, ${desde} 0%, ${hasta} 100%)`,
                ...(tieneImagen
                    ? {
                          backgroundImage: `url("${backgroundImage}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                      }
                    : {}),
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                transition: "filter 0.15s ease, transform 0.15s ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(0.97)"
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.filter = "none"
            }}
        >
            {/* Overlay para que el texto siempre se lea sobre la imagen */}
            {tieneImagen && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        inset: 0,
                        background:
                            "linear-gradient(90deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.15) 100%)",
                        pointerEvents: "none",
                    }}
                />
            )}
            <span
                aria-hidden="true"
                style={{
                    position: "relative",
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: icono ? "transparent" : "rgba(255,255,255,.22)",
                    fontSize: 13,
                    lineHeight: 1,
                    overflow: "hidden",
                }}
            >
                {icono ? (
                    <img
                        src={icono}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                        }}
                    />
                ) : (
                    "🎁"
                )}
            </span>
            <span
                style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    minWidth: 0,
                }}
            >
                <span
                    style={{
                        fontSize: 11.5,
                        fontWeight: 750,
                        color: "#fff",
                        lineHeight: 1.25,
                    }}
                >
                    Ganá 1 mes de Básico gratis
                </span>
                <span
                    style={{
                        fontSize: 10,
                        fontWeight: 650,
                        color: "rgba(255,255,255,.9)",
                        lineHeight: 1.2,
                    }}
                >
                    Invitá a otros negocios
                </span>
            </span>
        </button>
    )
}

function MenuFooter({
    baseUrl,
    checkoutLogo,
    logoutUrl,
    soporteUrl,
    iconos,
    accentColor,
    onOpenPanel,
    referidosCardBg,
    referidosCardBgDesde,
    referidosCardBgHasta,
    referidosCardIcono,
}: {
    baseUrl: string
    checkoutLogo?: string
    logoutUrl: string
    soporteUrl: string
    iconos?: Record<string, string>
    accentColor?: string
    onOpenPanel?: (panel: "basico" | "crecer" | null) => void
    referidosCardBg?: string
    referidosCardBgDesde?: string
    referidosCardBgHasta?: string
    referidosCardIcono?: string
}) {
    const logoNegocio = MenuFooter_useLogoNegocio(baseUrl)
    const soporte = MenuFooter_useSoporte(baseUrl, soporteUrl)

    return (
        <div
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            {/* Banner de referidos: siempre visible, arriba del estado del
                plan. Lleva al mismo panel "crecer" que la card de Inicio. */}
            <MenuFooterReferidosBanner
                accentColor={accentColor}
                onOpenPanel={onOpenPanel}
                backgroundImage={referidosCardBg}
                colorDesde={referidosCardBgDesde}
                colorHasta={referidosCardBgHasta}
                icono={referidosCardIcono}
            />

            {/* Plan: gratis → "Mejorar"; premium → días restantes (26d) y,
                con 3 días o menos, botón "Renovar". */}
            <PlanEstado baseUrl={baseUrl} accentColor={accentColor} />
            <div
                style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    paddingTop: 14,
                    borderTop: "1px solid #eef1f6",
                }}
            >
                {/* Avatar + nombre + flechita: abre el menú de la cuenta
                    (email, Planes, Más información, Eliminar cuenta). */}
                <MenuCuenta
                    baseUrl={baseUrl}
                    logoutUrl={logoutUrl}
                    logoImage={logoNegocio}
                    checkoutLogo={checkoutLogo}
                />
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                    }}
                >
                    <MenuFooterIconButton
                        icon={iconos?.soporte}
                        defaultIcon={MenuFooterSoporteIcon}
                        ariaLabel={soporte.prioritario ? "Soporte prioritario" : "Soporte: lista de espera"}
                        onClick={() => window.open(soporte.url, "_blank", "noopener,noreferrer")}
                    />
                    <MenuFooterIconButton
                        icon={iconos?.logout}
                        defaultIcon={MenuFooterLogoutIcon}
                        ariaLabel="Cerrar sesión"
                        onClick={() => MenuFooter_cerrarSesion(logoutUrl)}
                    />
                </div>
            </div>
        </div>
    )
}

function NotificacionesFlotantes({
    baseUrl,
    accentColor,
    isMobile,
    abierto,
    onToggle,
    onClose,
    iconosNotif,
    employeeMode = false,
    onNavigate,
    qrSlot,
}: {
    qrSlot?: React.ReactNode
    baseUrl: string
    accentColor: string
    isMobile: boolean
    abierto: boolean
    onToggle: () => void
    onClose: () => void
    iconosNotif?: Record<string, string>
    employeeMode?: boolean
    onNavigate?: (seccion: string) => void
}) {
    return (
        <>
            <div
                style={{
                    position: "fixed",
                    top: isMobile ? 14 : 22,
                    right: isMobile ? 14 : 22,
                    zIndex: 70,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                {qrSlot}
                <BotonNotificaciones
                    apiBaseUrl={baseUrl}
                    modo="compacto"
                    employeeMode={employeeMode}
                    colorContador={accentColor}
                    onClick={onToggle}
                    icono={
                        iconosNotif?.botonAbrir
                            ? { src: iconosNotif.botonAbrir }
                            : undefined
                    }
                    style={{
                        border: "1px solid #eef1f6",
                        boxShadow:
                            "0 8px 20px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.08)",
                    }}
                />
            </div>
            <AnimatePresence>
                {abierto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 90,
                            background: "rgba(15,23,42,0.55)",
                            backdropFilter: "blur(3px)",
                            WebkitBackdropFilter: "blur(3px)",
                            display: "flex",
                            alignItems: isMobile ? "flex-end" : "center",
                            justifyContent: "center",
                            padding: isMobile ? 0 : 24,
                            boxSizing: "border-box",
                        }}
                    >
                        <motion.div
                            initial={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.94, y: 14 }
                            }
                            animate={
                                isMobile
                                    ? { y: 0 }
                                    : { opacity: 1, scale: 1, y: 0 }
                            }
                            exit={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.94, y: 14 }
                            }
                            transition={{
                                type: "spring",
                                stiffness: 340,
                                damping: 32,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: isMobile
                                    ? "100%"
                                    : "clamp(420px, 60vw, 820px)",
                                height: isMobile
                                    ? undefined
                                    : "clamp(440px, 60vh, 760px)",
                                // PC: vh fijo (andaba bien). Mobile: svh, no
                                // se recalcula durante el scroll como dvh.
                                maxHeight: isMobile ? "84svh" : "88vh",
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                                background:
                                    "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
                                borderTopLeftRadius: 26,
                                borderTopRightRadius: 26,
                                borderBottomLeftRadius: isMobile ? 0 : 26,
                                borderBottomRightRadius: isMobile ? 0 : 26,
                                boxShadow:
                                    "0 30px 70px rgba(15,23,42,0.35), 0 10px 26px rgba(15,23,42,0.16)",
                                boxSizing: "border-box",
                            }}
                        >
                            {isMobile && (
                                <div
                                    style={{
                                        width: 40,
                                        height: 4,
                                        borderRadius: 2,
                                        background: "#e2e8f0",
                                        margin: "10px auto 0",
                                        flexShrink: 0,
                                    }}
                                />
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    padding: isMobile
                                        ? "14px 18px 12px"
                                        : "20px 22px 14px",
                                    borderBottom: "1px solid #f1f5f9",
                                    flexShrink: 0,
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
                                            width: 30,
                                            height: 30,
                                            borderRadius: 9,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            background: `${accentColor}18`,
                                            color: accentColor,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.9"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                                        </svg>
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 17,
                                            fontWeight: 700,
                                            color: "#0f172a",
                                            letterSpacing: "-0.3px",
                                            fontFamily:
                                                "'Inter Display', -apple-system, sans-serif",
                                        }}
                                    >
                                        Notificaciones
                                    </span>
                                </div>
                                <button
                                    onClick={onClose}
                                    aria-label="Cerrar"
                                    style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: "50%",
                                        border: "none",
                                        background: "#f1f5f9",
                                        color: "#64748b",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.3"
                                        strokeLinecap="round"
                                    >
                                        <path d="M6 6l12 12M18 6L6 18" />
                                    </svg>
                                </button>
                            </div>

                            <div
                                style={{
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: "auto",
                                }}
                            >
                                <NotificacionesPanel
                                    apiBaseUrl={baseUrl}
                                    employeeMode={employeeMode}
                                    accentColor={accentColor}
                                    mostrarBotonPush
                                    iconoTurnoNuevo={
                                        iconosNotif?.turnoNuevo
                                            ? { src: iconosNotif.turnoNuevo }
                                            : undefined
                                    }
                                    iconoTurnoCancelado={
                                        iconosNotif?.turnoCancelado
                                            ? {
                                                  src: iconosNotif.turnoCancelado,
                                              }
                                            : undefined
                                    }
                                    iconoTurnoPendiente={
                                        iconosNotif?.turnoPendiente
                                            ? {
                                                  src: iconosNotif.turnoPendiente,
                                              }
                                            : undefined
                                    }
                                    iconoPagoAprobado={
                                        iconosNotif?.pagoAprobado
                                            ? { src: iconosNotif.pagoAprobado }
                                            : undefined
                                    }
                                    iconoListaEspera={
                                        iconosNotif?.listaEspera
                                            ? { src: iconosNotif.listaEspera }
                                            : undefined
                                    }
                                    iconoVencimiento={
                                        iconosNotif?.vencimiento
                                            ? { src: iconosNotif.vencimiento }
                                            : undefined
                                    }
                                    iconoRecordatorio={
                                        iconosNotif?.recordatorio
                                            ? { src: iconosNotif.recordatorio }
                                            : undefined
                                    }
                                    iconoReprogramacion={
                                        iconosNotif?.reprogramacion
                                            ? {
                                                  src: iconosNotif.reprogramacion,
                                              }
                                            : undefined
                                    }
                                    iconoTip={
                                        iconosNotif?.tip
                                            ? { src: iconosNotif.tip }
                                            : undefined
                                    }
                                    iconoSistema={
                                        iconosNotif?.sistema
                                            ? { src: iconosNotif.sistema }
                                            : undefined
                                    }
                                    onNavigate={(seccion) => {
                                        onNavigate?.(seccion)
                                        onClose()
                                    }}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

function OnboardingNube_Fondo() {
    const blobs = [
        { size: 520, top: "-18%", left: "-12%", dur: 26, delay: 0 },
        { size: 420, top: "55%", left: "-14%", dur: 30, delay: 2 },
        { size: 480, top: "-10%", left: "55%", dur: 28, delay: 1 },
        { size: 380, top: "62%", left: "60%", dur: 24, delay: 3 },
        { size: 300, top: "30%", left: "30%", dur: 32, delay: 1.5 },
    ]

    const tonos = [
        "rgba(27,107,26,0.30)",
        "rgba(74,157,72,0.30)",
        "rgba(27,107,26,0.22)",
        "rgba(163,201,140,0.34)",
        "rgba(74,157,72,0.24)",
    ]

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                overflow: "hidden",
                background:
                    "linear-gradient(180deg, #FBF9F5 0%, #F3F6EF 45%, #FBF9F5 100%)",
            }}
        >
            {blobs.map((b, i) => (
                <motion.div
                    key={i}
                    style={{
                        position: "absolute",
                        width: b.size,
                        height: b.size,
                        top: b.top,
                        left: b.left,
                        borderRadius: "50%",
                        filter: "blur(70px)",
                        background: `radial-gradient(circle, ${
                            tonos[i % tonos.length]
                        } 0%, transparent 72%)`,
                    }}
                    animate={{
                        x: [0, 40, -30, 0],
                        y: [0, -30, 20, 0],
                        scale: [1, 1.12, 0.96, 1],
                        opacity: [0.55, 0.85, 0.6, 0.55],
                    }}
                    transition={{
                        duration: b.dur,
                        delay: b.delay,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            ))}

            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                    background:
                        "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.35), rgba(255,255,255,0.08) 60%)",
                }}
            />
        </div>
    )
}

function OnboardingNube_Folio({
    total,
    current,
}: {
    total: number
    current: number
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 4,
            }}
        >
            <div
                style={{
                    fontFamily: OnboardingNube_FONT_DISPLAY,
                    fontSize: 40,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: OnboardingNube_ACCENT,
                    letterSpacing: "-0.02em",
                }}
            >
                {String(current + 1).padStart(2, "0")}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {Array.from({ length: total }).map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            width: i === current ? 30 : 16,
                            backgroundColor:
                                i <= current
                                    ? OnboardingNube_ACCENT
                                    : OnboardingNube_HAIRLINE,
                        }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        style={{ height: 3, borderRadius: 2 }}
                    />
                ))}
            </div>
        </div>
    )
}

function OnboardingNube_Glass({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            className="tn-onb-glass"
            animate={{
                borderRadius: [
                    "42px 46px 44px 48px / 46px 42px 48px 44px",
                    "48px 42px 46px 44px / 42px 48px 44px 46px",
                    "42px 46px 44px 48px / 46px 42px 48px 44px",
                ],
            }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            style={{
                position: "relative",
                zIndex: 1,
                width: "min(100%, 460px)",
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(22px) saturate(160%)",
                WebkitBackdropFilter: "blur(22px) saturate(160%)",
                border: "1px solid rgba(255,255,255,0.8)",
                boxShadow:
                    "0 30px 70px rgba(18,19,26,0.14), 0 8px 24px rgba(18,19,26,0.06)",
                padding: "34px 30px",
                boxSizing: "border-box",
                fontFamily: OnboardingNube_FONT_BODY,
            }}
        >
            {children}
        </motion.div>
    )
}

function OnboardingNube_Input({
    label,
    optional,
    prefix,
    ...rest
}: {
    label: string
    optional?: boolean
    prefix?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <label
            style={{
                display: "block",
                width: "100%",
                minWidth: 0,
                flex: "1 1 0%",
            }}
        >
            <span
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: OnboardingNube_INK,
                    marginBottom: 6,
                }}
            >
                {label}
                {optional && (
                    <span
                        style={{
                            fontSize: 10.5,
                            fontWeight: 500,
                            color: OnboardingNube_MUTED,
                        }}
                    >
                        opcional
                    </span>
                )}
            </span>

            <div style={{ position: "relative", minWidth: 0 }}>
                {prefix && (
                    <span
                        style={{
                            position: "absolute",
                            left: 13,
                            top: "50%",
                            transform: "translateY(-50%)",
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: OnboardingNube_MUTED,
                            pointerEvents: "none",
                        }}
                    >
                        {prefix}
                    </span>
                )}
                <input
                    {...rest}
                    style={{
                        width: "100%",
                        minWidth: 0,
                        padding: prefix ? "11px 13px 11px 26px" : "11px 13px",
                        borderRadius: 10,
                        border: `1.5px solid ${OnboardingNube_HAIRLINE}`,
                        background: "rgba(255,255,255,0.9)",
                        fontSize: 14.5,
                        fontFamily: OnboardingNube_FONT_BODY,
                        color: OnboardingNube_INK,
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>
        </label>
    )
}

export { MenuFooterIconButton, MenuFooterSoporteIcon, MenuFooterLogoutIcon, MenuCuentaSvg, MenuCuentaIconPlanes, MenuCuentaIconInfo, MenuCuentaIconTrash, MenuCuentaIconExterno, MenuCuentaItem, MenuCuentaDivider, MenuCuentaEliminarModal, MenuCuentaCheckoutLock, MenuCuentaCheckoutBrand, MenuCuentaCheckoutMethods, MenuCuentaPlanTarjeta, MenuCuentaGraciasCalendario, MenuCuentaGraciasPlanes, MenuCuentaPlanesModal, MenuCuentaGraciasDemo, MenuCuentaPagoRetorno, MenuCuenta, MenuFooterReferidosBanner, MenuFooter, NotificacionesFlotantes, OnboardingNube_Fondo, OnboardingNube_Folio, OnboardingNube_Glass, OnboardingNube_Input }
