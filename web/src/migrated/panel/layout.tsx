import { fetchPanelRead } from "../../shared/panel-requests"
import { SectionLoadingBoundary } from "../../components/LoadingRunner"
import { BranchAccountFooter, BranchSchedule, OwnerOnly, useBranchAdmin } from "../../components/BranchAdmin"
import { appConfig } from "../../config"
import { loadQuoteMode, useQuoteMode } from "../../shared/agenda-mode"
import { messagePreview } from "../../shared/consultations.js"
import { useGlobalDiscardRevision } from "./common"
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
import { useSearchParams } from "react-router"
import { SeccionId, Turnits_useElementWidth, TurnitsGlobalSaveManager_get, MenuFooter_getSlug, MenuFooter_getToken, NAV_ITEMS, SeccionHeader } from "./common"
import { TurnitsBetaInstallPrompt, QrFlotante, TurnitsGlobalSaveBar } from "./interfaz"
import { OnboardingNube } from "./onboarding"
import { AmbientOrbs, BrandMark, NavButton, BottomNavIcon, BottomNavMore } from "./navigation"
import { MenuFooter as OwnerMenuFooter, MenuCuentaPagoRetorno, NotificacionesFlotantes } from "./cuenta"
import { SeccionInicio, TurnitsDashboardSidePanel } from "./dashboard"
import { PerfilNegocio } from "./profile-section"
import { ServiciosManager, ClientesGrid, AgendaPanel, HorariosConfig, ExcepcionesConfig, PagosSettingsGuard, MercadoPagoConexion, ConfigPagos, FinanzasPanel, ThemeEditor, EquipoSecciones } from "./section-components"
import Consultations from "../../pages/Consultations"
import { ChatIcon } from "../../components/ChatChrome"
import "./design-refresh.css"

function MenuFooter(props: any) { const branch = useBranchAdmin(); return branch ? <BranchAccountFooter {...props}/> : <OwnerMenuFooter {...props}/> }

function TurnitsPanel_Inner(props: any) {
    const discardRevision = useGlobalDiscardRevision()
    const branchAdmin = useBranchAdmin()
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        logoText = "turnits",
        logoImage,
        iconoPagosActivos,
        iconoAgendaSinPagos,
        referidosCardBg,
        referidosCardBgDesde = "#0f5c20",
        referidosCardBgHasta,
        referidosCardIcono,
        referidosPromoBg,
        referidosPromoBgDesde = "#0f5c20",
        referidosPromoBgHasta,
        referidosPlusIcono,
        logroPrimerTurno,
        logroDiezClientes,
        logroCincuentaTurnos,
        logroVeinteTurnos,
        logroClienteFrecuente,
        logroDiaFull,
        logroSemanaCompleta,
        logroAfiliados,
        logroFacturacion,
        ilustracionProximosTurnosVacio,
        ilustracionRendimientoVacio,
        iconos = {} as Record<string, string>,
        navIconos = {} as Record<string, string>,
        iconosNotificaciones = {} as Record<string, string>,
        mpClientId = "",
        logoutUrl = "/login",
        soporteUrl = "https://api.whatsapp.com/send/?phone=5493513087324&text&type=phone_number&app_absent=0",
        style,
    } = props
    const quoteMode = useQuoteMode(baseUrl)
    const [searchParams, setSearchParams] = useSearchParams()

    // ─── Onboarding a pantalla completa: mientras el usuario no tenga
    // servicio + horarios + método de cobro, no se muestra el panel.
    const [onboardingListo, setOnboardingListo] = React.useState(false)
    // ─── Preloader de arranque (logo → "Hola, Nombre" → se difumina) ──

    // ─── Estado de navegación (reemplaza las variantes de Framer) ─────────
    const [seccionActiva, setSeccionActiva] = React.useState<SeccionId>(() =>
        searchParams.get("seccion") === "consultas" ? "consultas" : "inicio"
    )
    const [agendaConsultaPermitida, setAgendaConsultaPermitida] = React.useState(false)
    const [mensajesSinLeer, setMensajesSinLeer] = React.useState(0)
    const [avisoMensaje, setAvisoMensaje] = React.useState<any>(null)
    const mensajesAnteriores = React.useRef<Record<string, number> | null>(null)
    const [mostrarNotificaciones, setMostrarNotificaciones] =
        React.useState(false)
    const [menuMobileAbierto, setMenuMobileAbierto] = React.useState(false)
    // ─── Pestaña "Equipo": función Básico (prueba gratis o activo).
    // Arranca oculta y solo se muestra si confirmamos que el plan es
    // premium, así el plan gratis nunca llega a verla en el menú.
    const [equipoDisponible, setEquipoDisponible] = React.useState(false)
    const [panelLateral, setPanelLateral] = React.useState<
        "basico" | "crecer" | null
    >(null)

    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = Turnits_useElementWidth(containerRef, 1200)
    const isMobile = containerWidth < 860

    React.useEffect(() => {
        TurnitsGlobalSaveManager_get()?.configure(baseUrl)
    }, [baseUrl])

    // ─── Plan del negocio, solo para saber si mostramos la pestaña
    // "Equipo" en el menú (Básico en prueba gratis o activo).
    React.useEffect(() => {
        if (false) return
        let retries = 0
        const api = baseUrl.replace(/\/+$/, "")
        const tryLoad = () => {
            const slug = MenuFooter_getSlug()
            const token = MenuFooter_getToken()
            if (!slug || !token) {
                if (++retries < 10) setTimeout(tryLoad, 300)
                return
            }
            fetchPanelRead(`${api}/settings/${slug}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-cache",
            })
                .then((r) => r.json())
                .then((data) => {
                    setEquipoDisponible(
                        ["basico", "premium"].includes(data?.settings?.plan)
                    )
                })
                .catch(() => {})
        }
        tryLoad()
    }, [baseUrl])

    const irA = (id: SeccionId) => {
        if (branchAdmin && !["inicio","servicios","clientes","agenda","horarios","finanzas","equipo"].includes(id)) return
        if (id === "consultas" && (!appConfig.quoteBookingEnabled || !quoteMode || !agendaConsultaPermitida)) return
        setSeccionActiva(id)
        setSearchParams(previous => {
            const next = new URLSearchParams(previous)
            if (id === "consultas") next.set("seccion", "consultas")
            else {
                next.delete("seccion")
                next.delete("id")
                next.delete("servicio_id")
            }
            return next
        }, { replace: true })
        setMenuMobileAbierto(false)
    }

    React.useEffect(() => {
        let active = true
        loadQuoteMode(baseUrl, MenuFooter_getSlug()).then((enabled) => {
            if (!active) return
            setAgendaConsultaPermitida(enabled)
            if (!enabled) {
                setSeccionActiva((current) => current === "consultas" ? "inicio" : current)
                setSearchParams((previous) => {
                    if (previous.get("seccion") !== "consultas") return previous
                    const next = new URLSearchParams(previous)
                    next.delete("seccion")
                    next.delete("id")
                    next.delete("servicio_id")
                    return next
                }, { replace: true })
            }
        }).catch(() => {
            if (!active) return
            setAgendaConsultaPermitida(false)
            setSeccionActiva((current) => current === "consultas" ? "inicio" : current)
            setSearchParams((previous) => {
                if (previous.get("seccion") !== "consultas") return previous
                const next = new URLSearchParams(previous)
                next.delete("seccion")
                next.delete("id")
                next.delete("servicio_id")
                return next
            }, { replace: true })
        })
        return () => { active = false }
    }, [baseUrl, setSearchParams])

    const navItemsVisibles = NAV_ITEMS.filter(
        (item) => item.id !== "consultas" && (!branchAdmin || ["inicio","servicios","clientes","agenda","horarios","finanzas","equipo"].includes(item.id)) && (item.id !== "equipo" || equipoDisponible)
    )

    const actualizarBandejaMensajes = React.useCallback((items: any[]) => {
        const next = Object.fromEntries(items.map(item => [item.id, Number(item.no_leidos) || 0])) as Record<string, number>
        const previous = mensajesAnteriores.current
        const unread = Object.values(next).reduce((total, count) => total + count, 0)
        if (previous && seccionActiva !== "consultas") {
            const incoming = items.find(item => Number(item.no_leidos) > (previous[item.id] || 0))
            if (incoming) {
                const nombre = incoming.interlocutor_nombre || incoming.slug, preview = messagePreview(incoming, true)
                setAvisoMensaje({ id: incoming.id, nombre, preview })
                if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
                    const notification = new Notification(nombre, { body: preview || "Te llegó un mensaje nuevo", tag: `turnits-message-${incoming.id}` })
                    notification.onclick = () => {
                        window.focus()
                        setSeccionActiva("consultas")
                        setSearchParams(previousParams => { const next = new URLSearchParams(previousParams); next.set("seccion", "consultas"); next.set("id", incoming.id); return next }, { replace: true })
                        setMenuMobileAbierto(false)
                        setAvisoMensaje(null)
                        notification.close()
                    }
                }
            }
        }
        mensajesAnteriores.current = next
        setMensajesSinLeer(unread)
    }, [seccionActiva, setSearchParams])

    React.useEffect(() => {
        const slug = MenuFooter_getSlug()
        const token = MenuFooter_getToken()
        if (!appConfig.quoteBookingEnabled || !quoteMode || !agendaConsultaPermitida || branchAdmin || !slug || !token) return
        const controller = new AbortController()
        let active = true, pending = false
        const refresh = async () => {
            if (!active || pending || document.hidden) return
            pending = true
            try {
                const response = await fetchPanelRead(`${baseUrl.replace(/\/+$/, "")}/admin/consultas`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal })
                const data = await response.json()
                if (active && response.ok && data?.success) actualizarBandejaMensajes(data.consultas || [])
            } catch {} finally { pending = false }
        }
        const visible = () => { if (!document.hidden) void refresh() }
        void refresh()
        const timer = window.setInterval(() => void refresh(), 12000)
        document.addEventListener("visibilitychange", visible)
        return () => { active = false; controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
    }, [agendaConsultaPermitida, baseUrl, branchAdmin, quoteMode, actualizarBandejaMensajes])

    React.useEffect(() => {
        if (!avisoMensaje) return
        const timer = window.setTimeout(() => setAvisoMensaje(null), 5500)
        return () => window.clearTimeout(timer)
    }, [avisoMensaje])

    const abrirMensajeNotificado = (id: string) => {
        setSeccionActiva("consultas")
        setSearchParams(previous => { const next = new URLSearchParams(previous); next.set("seccion", "consultas"); next.set("id", id); return next }, { replace: true })
        setMenuMobileAbierto(false)
        setAvisoMensaje(null)
    }

    // Igual que irA: si el banner de referidos del menú se toca desde la
    // hoja inferior mobile, cerramos esa hoja para que no quede "detrás"
    // del panel lateral de referidos que se abre encima.
    const abrirPanelDesdeMenu = (panel: "basico" | "crecer" | null) => {
        setPanelLateral(panel)
        setMenuMobileAbierto(false)
    }

    return (
        <div
            ref={containerRef}
            className={`turnits-root${seccionActiva === "consultas" ? " turnits-messages-active" : ""}`}
            style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                // En móvil el panel participa del alto normal del documento:
                // sin fijarlo al viewport, así el navegador hace un solo scroll natural.
                height: isMobile ? "auto" : "100vh",
                minHeight: isMobile ? 0 : "100vh",
                background: "#f8fafc",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                boxSizing: "border-box",
                overflow: isMobile ? "visible" : "hidden",
                overflowX: isMobile ? "clip" : "hidden",
                ...style,
                // El ancho lo manda el panel, no el frame de Framer.
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
                // El estilo del frame anfitrión no debe volver a fijar la altura
                // ni crear un viewport de scroll interno en celular.
                ...(isMobile
                    ? {
                          height: "auto",
                          minHeight: 0,
                          overflow: "visible",
                          position: "relative" as const,
                      }
                    : null),
            }}
        >
            {/* CSS global de ajustes mobile:
                - iOS Safari hace zoom automático al enfocar un input con
                  font-size < 16px y no vuelve solo. En pantallas táctiles
                  se fuerza 16px en todos los campos de texto del panel.
                - touch-action: manipulation saca el zoom por doble toque
                  y el retraso de 300ms en botones y campos.
                - text-size-adjust evita que el navegador agrande textos
                  al girar el celular. */}
            <style>{`
.turnits-root{-webkit-text-size-adjust:100%;text-size-adjust:100%;max-width:100%;min-width:0}
@keyframes panel-section-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.turnits-root *{min-width:0}
@media(max-width:860px){.turnits-root{width:100%;max-width:100%;overflow-x:clip!important}.turnits-root img,.turnits-root video,.turnits-root canvas{max-width:100%}.turnits-root input,.turnits-root textarea,.turnits-root select{max-width:100%;box-sizing:border-box}}
@media(prefers-reduced-motion:reduce){.turnits-panel-content{animation:none!important}}
.turnits-image-action{padding:8px 13px!important;border:1px solid #dce7df!important;border-radius:10px!important;background:#f5fbf5!important;color:#1B6B1A!important;font-size:12px!important;font-weight:700!important;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:background .15s,border-color .15s,transform .15s}
.turnits-image-action:hover{background:#edf7ed!important;border-color:#a8c9a8!important}
.turnits-root button,.turnits-root a,.turnits-root [role="button"],.turnits-root input,.turnits-root select,.turnits-root textarea{touch-action:manipulation}
@media (pointer:coarse){
.turnits-root input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="button"]):not([type="submit"]),
.turnits-root select,
.turnits-root textarea{font-size:16px !important}
}
`}</style>

            <TurnitsBetaInstallPrompt
                apiBaseUrl={baseUrl}
                accentColor={accentColor}
                logoImage={logoImage}
                logoText={logoText}
            />

            {true && (
                <OwnerOnly><OnboardingNube
                    baseUrl={baseUrl}
                    accentColor={accentColor}
                    mpClientId={mpClientId}
                    onFinish={() => setOnboardingListo(true)}
                /></OwnerOnly>
            )}

            {/* ─────────────── SIDEBAR (desktop) ─────────────── */}
            {!isMobile && (
                <div
                    className="turnits-sidebar"
                    style={
                        {
                            width: 252,
                            flexShrink: 0,
                            // Sticky: el menú nunca se mueve con el scroll del
                            // contenido, queda fijo a la altura del viewport.
                            position: "sticky",
                            top: 0,
                            alignSelf: "flex-start",
                            height: "100vh",
                            overflow: "hidden",
                            background:
                                "linear-gradient(180deg, #fbfcff 0%, #f6f7fb 100%)",
                            borderRight: "1px solid #eef1f6",
                            display: "flex",
                            flexDirection: "column",
                            padding: "26px 18px",
                            boxSizing: "border-box",
                            "--accent": accentColor,
                        } as React.CSSProperties
                    }
                >
                    <AmbientOrbs accentColor={accentColor} />

                    <div
                        className="turnits-sidebar-brand"
                        style={{
                            position: "relative",
                            marginBottom: 30,
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        <BrandMark logoImage={logoImage} logoText={logoText} />
                    </div>

                    <nav
                        className="turnits-nav-scroll"
                        // Si la pantalla es baja, el menú scrollea por dentro y el
                        // footer (plan, soporte, cerrar sesión) siempre queda visible.
                        data-lenis-prevent="true"
                        onWheel={(e) => e.stopPropagation()}
                        style={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            overflowX: "hidden",
                        }}
                    >
                        <style>{`.turnits-nav-scroll{scrollbar-width:none;-ms-overflow-style:none}.turnits-nav-scroll::-webkit-scrollbar{display:none}.turnits-nav-scroll>*{min-height:34px}`}</style>
                        {navItemsVisibles.map((item) => (
                            <NavButton
                                key={item.id}
                                item={item}
                                active={seccionActiva === item.id}
                                accentColor={accentColor}
                                onClick={() => irA(item.id)}
                                navIconos={navIconos}
                            />
                        ))}
                    </nav>

                    {/* Footer: usuario, soporte y cerrar sesión */}
                    <MenuFooter
                        mobile={isMobile}
                        checkoutLogo={logoImage}
                        baseUrl={baseUrl}
                        accentColor={accentColor}
                        logoutUrl={logoutUrl}
                        soporteUrl={soporteUrl}
                        iconos={iconos}
                        onOpenPanel={abrirPanelDesdeMenu}
                        referidosCardBg={referidosCardBg}
                        referidosCardBgDesde={referidosCardBgDesde}
                        referidosCardBgHasta={referidosCardBgHasta}
                        referidosCardIcono={referidosCardIcono}
                    />
                </div>
            )}

            {/* ─────────────── TOPBAR (mobile) ─────────────── */}
            {isMobile && (
                <div
                    style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 20,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 16px",
                        background:
                            "linear-gradient(180deg, #fbfcff 0%, #f6f7fb 100%)",
                        borderBottom: "1px solid #eef1f6",
                        flexShrink: 0,
                    }}
                >
                    <AmbientOrbs accentColor={accentColor} />
                    <div style={{ position: "relative" }}>
                        <BrandMark
                            logoImage={logoImage}
                            logoText={logoText}
                            width={88}
                            height={44}
                        />
                    </div>
                </div>
            )}

            {/* Menú completo mobile: hoja inferior, como el "más" de Instagram */}
            <AnimatePresence>
                {isMobile && menuMobileAbierto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(15,23,42,0.45)",
                            zIndex: 100,
                            display: "flex",
                            alignItems: "flex-end",
                        }}
                        onClick={() => setMenuMobileAbierto(false)}
                    >
                        <motion.div
                            className="turnits-mobile-menu-sheet"
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{
                                type: "spring",
                                stiffness: 340,
                                damping: 34,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={
                                {
                                    position: "relative",
                                    overflow: "hidden",
                                    width: "100%",
                                    maxHeight: "78svh",
                                    overflowY: "auto",
                                    background:
                                        "linear-gradient(180deg, #fbfcff 0%, #f6f7fb 100%)",
                                    borderTopLeftRadius: 24,
                                    borderTopRightRadius: 24,
                                    padding:
                                        "10px 18px calc(28px + env(safe-area-inset-bottom, 0px))",
                                    boxSizing: "border-box",
                                    "--accent": accentColor,
                                } as React.CSSProperties
                            }
                        >
                            <AmbientOrbs accentColor={accentColor} />
                            <div
                                style={{
                                    position: "relative",
                                    width: 40,
                                    height: 4,
                                    borderRadius: 2,
                                    background: "#e2e8f0",
                                    margin: "6px auto 18px",
                                }}
                            />
                            <div
                                style={{
                                    position: "relative",
                                    marginBottom: 16,
                                    paddingLeft: 4,
                                }}
                            >
                                <BrandMark
                                    logoImage={logoImage}
                                    logoText={logoText}
                                    width={104}
                                    height={52}
                                />
                            </div>
                            <div
                                style={{
                                    position: "relative",
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 4,
                                }}
                            >
                                {navItemsVisibles.map((item) => (
                                    <NavButton
                                        key={item.id}
                                        item={item}
                                        active={seccionActiva === item.id}
                                        accentColor={accentColor}
                                        onClick={() => irA(item.id)}
                                        navIconos={navIconos}
                                    />
                                ))}
                            </div>

                            <div style={{ marginTop: 16 }}>
                                <MenuFooter
                                    mobile={isMobile}
                        checkoutLogo={logoImage}
                        baseUrl={baseUrl}
                                    accentColor={accentColor}
                                    logoutUrl={logoutUrl}
                                    soporteUrl={soporteUrl}
                                    iconos={iconos}
                                    onOpenPanel={abrirPanelDesdeMenu}
                                    referidosCardBg={referidosCardBg}
                                    referidosCardBgDesde={referidosCardBgDesde}
                                    referidosCardBgHasta={referidosCardBgHasta}
                                    referidosCardIcono={referidosCardIcono}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <OwnerOnly><MenuCuentaPagoRetorno api={baseUrl} logo={logoImage} /></OwnerOnly>
            {/* Botón flotante de notificaciones + overlay (fuera del menú) */}
            <NotificacionesFlotantes
                baseUrl={baseUrl}
                accentColor={accentColor}
                isMobile={isMobile}
                abierto={mostrarNotificaciones}
                onToggle={() => setMostrarNotificaciones((v) => !v)}
                onClose={() => setMostrarNotificaciones(false)}
                iconosNotif={iconosNotificaciones}
                onNavigate={(seccion) => irA(seccion as SeccionId)}
                messageSlot={appConfig.quoteBookingEnabled && quoteMode && agendaConsultaPermitida && !branchAdmin && seccionActiva !== "consultas" ? (
                    <button className="panel-message-fab" type="button" onClick={() => irA("consultas")} aria-label={mensajesSinLeer ? `Mensajes, ${mensajesSinLeer} sin leer` : "Abrir mensajes"} title="Mensajes">
                        <ChatIcon name="chat" size={21} />
                        {mensajesSinLeer > 0 && <b aria-hidden="true">{mensajesSinLeer > 99 ? "99+" : mensajesSinLeer}</b>}
                    </button>
                ) : null}
                qrSlot={
                    isMobile ? (
                        <QrFlotante
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            isMobile={isMobile}
                            inline
                            mostrarToggle={seccionActiva === "pagos"}
                            iconoPagosActivos={iconoPagosActivos}
                            iconoAgendaSinPagos={iconoAgendaSinPagos}
                        />
                    ) : null
                }
            />

            {/* Cuadradito QR fijo abajo a la derecha (desktop). En mobile va al lado de la campana. */}
            {!isMobile && (
                <QrFlotante
                    baseUrl={baseUrl}
                    accentColor={accentColor}
                    isMobile={isMobile}
                    mostrarToggle={seccionActiva === "pagos"}
                    iconoPagosActivos={iconoPagosActivos}
                    iconoAgendaSinPagos={iconoAgendaSinPagos}
                />
            )}

            {/* ─────────────── CONTENIDO ─────────────── */}
            <div
                key={`${discardRevision}-${seccionActiva}`}
                className="turnits-panel-content"
                // Le avisa a librerías de smooth-scroll (Lenis y similares, muy
                // comunes en sitios de Framer) que este contenedor scrollea solo.
                data-lenis-prevent={isMobile ? undefined : "true"}
                data-lenis-prevent-wheel={isMobile ? undefined : "true"}
                // En PC, un smooth-scroll global captura la rueda con
                // preventDefault y scrollea la página en vez de este contenedor.
                // Cortamos la propagación para que la rueda llegue acá.
                onWheel={isMobile ? undefined : (e) => e.stopPropagation()}
                style={
                    {
                        flex: isMobile ? "0 0 auto" : 1,
                        animation: "panel-section-in .24s cubic-bezier(.2,.75,.25,1) both",
                        minWidth: 0,
                        minHeight: isMobile ? "auto" : 0,
                        padding: isMobile
                            ? seccionActiva === "consultas" ? "12px 12px 16px" : "16px 16px calc(100px + env(safe-area-inset-bottom, 0px))"
                            : 32,
                        boxSizing: "border-box",
                        overflow: isMobile ? "visible" : "auto",
                        WebkitOverflowScrolling: isMobile ? undefined : "touch",
                        overscrollBehavior: isMobile ? "auto" : "contain",
                    } as React.CSSProperties
                }
            >
                {seccionActiva !== "consultas" && <div
                    style={{
                        // Un único bloque sticky conserva el orden en ambas
                        // vistas: header (móvil) → Guardar cambios → Comisiones.
                        position: "sticky",
                        top: isMobile ? 65 : 20,
                        zIndex: 30,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <TurnitsGlobalSaveBar
                        seccionActiva={seccionActiva}
                        accentColor={accentColor}
                        isMobile={isMobile}
                    />
                </div>}

                {branchAdmin && seccionActiva !== "consultas" && <div style={{padding:"10px 14px",marginBottom:18,borderRadius:12,background:"#edf5ef",color:"#24492b",fontSize:13}}><strong>{branchAdmin.nombre}</strong> · Administración de sucursal</div>}
                {seccionActiva === "consultas" && quoteMode && agendaConsultaPermitida && !branchAdmin && <Consultations embedded="panel" onInboxChange={actualizarBandejaMensajes} onExit={() => irA("inicio")} />}
                {seccionActiva === "inicio" && (
                    <SectionLoadingBoundary>
                    <SeccionInicio
                        baseUrl={baseUrl}
                        accentColor={accentColor}
                        isMobile={isMobile}
                        iconos={iconos}
                        onOpenPanel={setPanelLateral}
                        onNavigate={irA}
                        referidosPromoBg={referidosPromoBg}
                        referidosPromoBgDesde={referidosPromoBgDesde}
                        referidosPromoBgHasta={referidosPromoBgHasta}
                        logroPrimerTurno={logroPrimerTurno}
                        logroDiezClientes={logroDiezClientes}
                        logroCincuentaTurnos={logroCincuentaTurnos}
                        logroVeinteTurnos={logroVeinteTurnos}
                        logroClienteFrecuente={logroClienteFrecuente}
                        logroDiaFull={logroDiaFull}
                        logroSemanaCompleta={logroSemanaCompleta}
                        logroAfiliados={logroAfiliados}
                        logroFacturacion={logroFacturacion}
                        ilustracionProximosTurnosVacio={
                            ilustracionProximosTurnosVacio
                        }
                        ilustracionRendimientoVacio={
                            ilustracionRendimientoVacio
                        }
                    />
                    </SectionLoadingBoundary>
                )}

                {seccionActiva === "servicios" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title={quoteMode ? "Servicios" : "Mis Servicios"}
                            subtitle={quoteMode ? "Mantené tu perfil publicado para aparecer en Browse; el precio y la fecha se coordinan por chat." : "Los servicios que ofrecés a tus clientes"}
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        <ServiciosManager
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            iconoPlaceholderUrl={iconos.servicioPlaceholder}
                            iconoFormUrl={iconos.servicioForm}
                            iconoVacioUrl={iconos.servicioVacio}
                            iconoCheck={iconos.check}
                            iconoEditar={iconos.editar}
                            iconoEliminar={iconos.eliminar}
                        />
                        </SectionLoadingBoundary>
                    </div>
                )}

                {seccionActiva === "clientes" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Mis Clientes"
                            subtitle="Todas las personas que reservaron turno con vos"
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        <ClientesGrid
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                        />
                        </SectionLoadingBoundary>
                    </div>
                )}

                {seccionActiva === "agenda" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Mi Agenda"
                            subtitle="Tus turnos organizados por día"
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        <AgendaPanel
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            iconoReprogramacion={
                                iconosNotificaciones.reprogramacion
                            }
                        />
                        </SectionLoadingBoundary>
                    </div>
                )}

                {seccionActiva === "horarios" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Mis Horarios"
                            subtitle="Definí tu disponibilidad y excepciones"
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                            {branchAdmin ? (
                                <BranchSchedule baseUrl={baseUrl} accentColor={accentColor}/>
                            ) : (
                                <>
                                    <HorariosConfig
                                        baseUrl={baseUrl}
                                        accentColor={accentColor}
                                        mostrarBotonGuardar={false}
                                    />
                                    <ExcepcionesConfig
                                        baseUrl={baseUrl}
                                        accentColor={accentColor}
                                    />
                                </>
                            )}
                        </SectionLoadingBoundary>
                    </div>
                )}

                {seccionActiva === "pagos" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Métodos de Pago"
                            subtitle="Configurá cómo te pagan tus clientes"
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        <PagosSettingsGuard baseUrl={baseUrl}>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 20,
                                }}
                            >
                                <MercadoPagoConexion
                                    baseUrl={baseUrl}
                                    mpClientId={mpClientId}
                                    logoMP={iconos.logoMercadoPago}
                                    logoTransferencia={iconos.logoTransferencia}
                                    logoEfectivo={iconos.logoEfectivo}
                                />
                                <ConfigPagos
                                    baseUrl={baseUrl}
                                    accentColor={accentColor}
                                    mpClientId={mpClientId}
                                />
                            </div>
                        </PagosSettingsGuard>
                        </SectionLoadingBoundary>
                    </div>
                )}

                {seccionActiva === "finanzas" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Finanzas"
                            subtitle="Ingresos, gastos, comisiones y rentabilidad estimada de tu negocio"
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        <FinanzasPanel
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                        />
                        </SectionLoadingBoundary>

                    </div>
                )}

                {seccionActiva === "temas" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Temas"
                            subtitle={quoteMode ? "Personalizá los colores de la agenda de consultas" : "Personalizá los colores y las formas de tu agenda"}
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        <ThemeEditor
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            quoteMode={quoteMode}
                            onOpenProfile={() => irA("perfil")}
                        />
                        </SectionLoadingBoundary>
                    </div>
                )}

                {seccionActiva === "equipo" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Mi Equipo"
                            subtitle="Gestioná a las personas que trabajan con vos"
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        <EquipoSecciones
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            iconoVacioUrl={iconos.equipoVacio}
                            iconoCheck={iconos.check}
                            iconoEditar={iconos.editar}
                            iconoEliminar={iconos.eliminar}
                        />
                        </SectionLoadingBoundary>
                    </div>
                )}
                {seccionActiva === "perfil" && <PerfilNegocio baseUrl={baseUrl} isMobile={isMobile}/>}
            </div>

            <OwnerOnly><TurnitsDashboardSidePanel
                baseUrl={baseUrl}
                accentColor={accentColor}
                isMobile={isMobile}
                panel={panelLateral}
                onClose={() => setPanelLateral(null)}
                onNavigate={irA}
                referidosPlusIcono={referidosPlusIcono}
                ilustracionRendimientoVacio={ilustracionRendimientoVacio}
            /></OwnerOnly>

            {/* Navegación móvil basada en las cinco tareas principales. */}
            {isMobile && seccionActiva !== "consultas" && (
                <nav
                    className="turnits-mobile-bottom-nav"
                    aria-label="Navegación del panel"
                    style={{
                        position: "fixed",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: "flex",
                        justifyContent: "center",
                        zIndex: 60,
                        pointerEvents: "none",
                    }}
                >
                    <div
                        className="turnits-mobile-bottom-nav-items"
                        style={{
                            pointerEvents: "auto",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            width: "min(100%, 520px)",
                            background: "rgba(255,255,255,.97)",
                            borderRadius: "18px 18px 0 0",
                            padding: "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))",
                            boxShadow: "0 -6px 24px rgba(26,49,25,.08)",
                            border: "1px solid #e3e9e1",
                        }}
                    >
                        <BottomNavIcon
                            id="inicio"
                            label="Inicio"
                            active={seccionActiva === "inicio"}
                            accentColor={accentColor}
                            onClick={() => irA("inicio")}
                            navIconos={navIconos}
                        />
                        <BottomNavIcon
                            id="agenda"
                            label="Agenda"
                            active={seccionActiva === "agenda"}
                            accentColor={accentColor}
                            onClick={() => irA("agenda")}
                            navIconos={navIconos}
                        />
                        <BottomNavIcon
                            id="clientes"
                            label="Clientes"
                            active={seccionActiva === "clientes"}
                            accentColor={accentColor}
                            onClick={() => irA("clientes")}
                            navIconos={navIconos}
                        />
                        <BottomNavIcon
                            id="finanzas"
                            label="Cobros"
                            active={seccionActiva === "finanzas"}
                            accentColor={accentColor}
                            onClick={() => irA("finanzas")}
                            navIconos={navIconos}
                        />
                        <BottomNavMore
                            active={menuMobileAbierto}
                            onClick={() => setMenuMobileAbierto(true)}
                        />
                    </div>
                </nav>
            )}
            {appConfig.quoteBookingEnabled && quoteMode && agendaConsultaPermitida && !branchAdmin && seccionActiva !== "consultas" && <>
                {avisoMensaje && <div className="panel-message-notice" role="status">
                    <button type="button" onClick={() => abrirMensajeNotificado(avisoMensaje.id)}>
                        <ChatIcon name="chat" size={18} />
                        <span><strong>{avisoMensaje.nombre}</strong><small>{avisoMensaje.preview || "Te llegó un mensaje nuevo"}</small></span>
                    </button>
                    <button type="button" className="panel-message-notice-close" aria-label="Cerrar notificación" onClick={() => setAvisoMensaje(null)}><ChatIcon name="close" size={16} /></button>
                </div>}
            </>}
        </div>
    )
}

export { TurnitsPanel_Inner }
