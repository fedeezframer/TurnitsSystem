import { seccionesPagos, type VistaPagos } from "./secciones-pagos"
import { useCatalogTransition } from "./catalog-motion"
import { BackButton } from "../../components/BackButton"
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
import { AmbientOrbs, BrandMark, NavButton, BottomNavIcon, BottomNavMore } from "./navigation"
import { MenuFooter as OwnerMenuFooter, MenuCuentaPagoRetorno, NotificacionesFlotantes } from "./cuenta"
import { SeccionInicio, TurnitsDashboardSidePanel } from "./dashboard"
import { CopyTurnosButton } from "./inicio"
import { PerfilNegocio } from "./profile-section"
import { MisServiciosPanel, ProductosPanel, PromocionesPanel, ClientesGrid, AgendaPanel, HorariosConfig, ExcepcionesConfig, CobrosNegocio, FinanzasPanel, ThemeEditor, EquipoSecciones } from "./section-components"
import { ChatIcon } from "../../components/ChatChrome"
import "./design-refresh.css"
import "./panel-controls.css"

const Consultations = React.lazy(() => import("../../pages/Consultations"))
const SetupGuide = React.lazy(() => import("../../components/SetupGuide"))
const OnboardingNube = React.lazy(() => import("./onboarding").then(module => ({ default: module.OnboardingNube })))

function MenuFooter(props: any) { const branch = useBranchAdmin(); return branch ? <BranchAccountFooter {...props}/> : <OwnerMenuFooter {...props}/> }

function TurnitsPanel_Inner(props: any) {
    const catalogTransition = useCatalogTransition()
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

    // El tutorial habitual se resuelve primero. Si se omite o queda
    // incompleto, Inicio ofrece el siguiente paso sin volver a bloquear.
    const [onboardingListo, setOnboardingListo] = React.useState(false)
    // ─── Preloader de arranque (logo → "Hola, Nombre" → se difumina) ──

    // ─── Estado de navegación (reemplaza las variantes de Framer) ─────────
    const [seccionActiva, setSeccionActiva] = React.useState<SeccionId>(() => {
        if (searchParams.get("onboarding") !== "mp" && (searchParams.get("seccion") === "pagos" || ["mp_success", "mp_error"].includes(searchParams.get("status") || ""))) return "pagos"
        if (searchParams.get("seccion") === "horarios") return "horarios"
        if (!branchAdmin && searchParams.get("seccion") === "perfil") return "perfil"
        if (searchParams.get("seccion") === "equipo") return "equipo"
        return searchParams.get("seccion") === "consultas" ? "consultas" : "inicio"
    })
    const [agendaConsultaPermitida, setAgendaConsultaPermitida] = React.useState(false)
    const [mensajesSinLeer, setMensajesSinLeer] = React.useState(0)
    const [avisoMensaje, setAvisoMensaje] = React.useState<any>(null)
    const mensajesAnteriores = React.useRef<Record<string, number> | null>(null)
    const [mostrarNotificaciones, setMostrarNotificaciones] =
        React.useState(false)
    const [menuMobileAbierto, setMenuMobileAbierto] = React.useState(false)
    const [scheduleView,setScheduleView] = React.useState<"weekly"|"exceptions">("weekly")
    const vistaPagos = ["mp_success","mp_error"].includes(searchParams.get("status") || "") ? "metodos" : seccionesPagos.find(s => s.id === searchParams.get("vista"))?.id || "metodos"
    const [menuExpandido, setMenuExpandido] = React.useState<SeccionId | null>(["pagos", "equipo", "perfil", "horarios"].includes(seccionActiva) ? seccionActiva : null)
    const [serviciosVistaInicial, setServiciosVistaInicial] = React.useState<"servicios" | "extras" | "promociones">("servicios")
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

    const publicaciones = searchParams.get("vista") === "publicaciones"
    const sucursales = !branchAdmin && searchParams.get("vista") === "sucursales"
    const irA = (id: SeccionId, vista?: VistaPagos | "negocio" | "publicaciones" | "miembros" | "sucursales") => {
        if (branchAdmin && !["inicio","servicios","clientes","agenda","horarios","finanzas","equipo"].includes(id)) return
        if (id === "consultas" && (!appConfig.quoteBookingEnabled || !quoteMode || !agendaConsultaPermitida)) return
        setSeccionActiva(id)
        setSearchParams(previous => {
            const next = new URLSearchParams(previous)
            next.delete("nuevo")
            if (id === "pagos") {
                next.set("seccion", "pagos")
                next.set("vista", vista || vistaPagos)
                next.delete("status")
                next.delete("reason")
                return next
            }
            if (id === "perfil" || id === "equipo") {
                next.set("seccion", id)
                next.set("vista", vista || (id === "perfil" ? "negocio" : "miembros"))
                next.delete("id")
                next.delete("status")
                next.delete("reason")
                return next
            }
            next.delete("vista")
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
    ).sort((a, b) => ["inicio", "servicios", "agenda", "clientes", "horarios", "pagos", "finanzas", "temas", "equipo", "perfil"].indexOf(a.id) - ["inicio", "servicios", "agenda", "clientes", "horarios", "pagos", "finanzas", "temas", "equipo", "perfil"].indexOf(b.id))

    const abrirCatalogo = (vista: "servicios" | "extras" | "promociones") => {
        setServiciosVistaInicial(vista)
        setMenuExpandido("servicios")
        irA("servicios")
    }

    const renderSubsection = (view: string, label: string, icon: string, selected: boolean, open: () => void) => {
        return <button
            key={view}
            type="button"
            onClick={open}
            aria-current={selected ? "page" : undefined}
            style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "11px 8px", border: 0, borderRadius: 8,
                background: "transparent", color: selected ? "#176b24" : "#2b342d",
                fontFamily: "inherit", fontSize: 14, fontWeight: selected ? 600 : 450,
                lineHeight: 1.2, textAlign: "left", cursor: "pointer",
            }}
        >
            <span aria-hidden="true" style={{
                width: 18, height: 18, flexShrink: 0, backgroundColor: "currentColor",
                WebkitMask: `url(${icon}) center / contain no-repeat`,
                mask: `url(${icon}) center / contain no-repeat`,
            }} />
            {label}
        </button>
    }

    const renderNavItems = () => navItemsVisibles.map((item) => (item.id === "servicios" || item.id === "horarios" || item.id === "pagos" || item.id === "perfil" || (item.id === "equipo" && !branchAdmin)) ? (
        <div key={item.id} style={{width:"100%",padding:0,margin:0,background:"transparent"}}>
            <NavButton item={item} active={seccionActiva === item.id} accentColor={accentColor} onClick={() => setMenuExpandido(current => current === item.id ? null : item.id)} navIconos={navIconos} showChevron chevronDown={menuExpandido === item.id} />
            <AnimatePresence initial={false}>
                {menuExpandido === item.id && <motion.div
                    key={item.id+"-submenu"}
                    initial={{height:0,opacity:0,y:-7}}
                    animate={{height:"auto",opacity:1,y:0}}
                    exit={{height:0,opacity:0,y:-5}}
                    transition={{height:{duration:.28,ease:[.22,1,.36,1]},opacity:{duration:.18},y:{duration:.22,ease:[.22,1,.36,1]}}}
                    style={{overflow:"hidden"}}
                >
                    <div style={{display:"flex",flexDirection:"column",gap:0,padding:"2px 0 0 16px"}}>
                        {item.id === "perfil" ? <>
                            {renderSubsection("negocio", "Perfil del negocio", "/assets/panel-nav/famicons_share-social-sharp.svg", seccionActiva === "perfil" && !publicaciones, () => irA("perfil", "negocio"))}
                            {renderSubsection("publicaciones", "Publicaciones", "/assets/panel-nav/boxicons_photo-album.svg", seccionActiva === "perfil" && publicaciones, () => irA("perfil", "publicaciones"))}
                            {!equipoDisponible && renderSubsection("local", "Local", "/assets/panel-nav/famicons_storefront-outline.svg", seccionActiva === "equipo" && sucursales, () => irA("equipo", "sucursales"))}
                        </> : item.id === "equipo" ? <>
                            {renderSubsection("miembros", "Miembros", "/assets/panel-nav/streamline-ultimate_team-meeting-bold.svg", seccionActiva === "equipo" && !sucursales, () => irA("equipo", "miembros"))}
                            {renderSubsection("sucursales", "Sucursales", "/assets/panel-nav/famicons_storefront-outline.svg", seccionActiva === "equipo" && sucursales, () => irA("equipo", "sucursales"))}
                        </> : item.id === "pagos" ? seccionesPagos.map(({id,titulo,icono}) => renderSubsection(id,titulo,icono,seccionActiva === "pagos" && vistaPagos === id, () => irA("pagos",id))) : item.id==="horarios" ? <>
                            {renderSubsection("weekly","Horario semanal","/assets/panel-nav/hugeicons_time-quarter-02.svg", seccionActiva === "horarios" && scheduleView === "weekly", () => {setScheduleView("weekly");irA("horarios")})}
                            {renderSubsection("exceptions","Excepciones laborales","/assets/panel-nav/fa7-regular_calendar-alt.svg", seccionActiva === "horarios" && scheduleView === "exceptions", () => {setScheduleView("exceptions");irA("horarios")})}
                        </> : <>{renderSubsection("servicios","Mis Servicios","/assets/panel-nav/ant-design_product-outlined.svg", seccionActiva === "servicios" && serviciosVistaInicial === "servicios", () => abrirCatalogo("servicios"))}
                        {renderSubsection("extras","Productos","/assets/panel-nav/ix_product-management.svg", seccionActiva === "servicios" && serviciosVistaInicial === "extras", () => abrirCatalogo("extras"))}
                        {renderSubsection("promociones","Promociones","/assets/panel-nav/hugeicons_sale-tag-01.svg", seccionActiva === "servicios" && serviciosVistaInicial === "promociones", () => abrirCatalogo("promociones"))}</>}
                    </div>
                    <motion.div
                        aria-hidden="true"
                        initial={{scaleX:0,opacity:0}}
                        animate={{scaleX:1,opacity:1}}
                        exit={{scaleX:0,opacity:0}}
                        transition={{duration:.24,ease:[.22,1,.36,1],delay:.05}}
                        style={{height:1,margin:"0 12px 6px 8px",background:"#8e9690",transformOrigin:"left center"}}
                    />
                </motion.div>}
            </AnimatePresence>
        </div>
    ) : <NavButton key={item.id} item={item} active={seccionActiva === item.id} accentColor={accentColor} onClick={() => {setMenuExpandido(null);irA(item.id)}} navIconos={navIconos} showChevron={["horarios","pagos","equipo","perfil"].includes(item.id)} />)

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
                background: "#fff",
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
                          minHeight: "100dvh",
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
.turnits-panel-content{background-color:#fff!important;background-image:radial-gradient(ellipse 420px 210px at 55% -7%,rgba(231,246,234,.5),transparent 72%),radial-gradient(ellipse 430px 240px at 100% 3%,rgba(241,249,243,.72),transparent 72%),radial-gradient(ellipse 430px 250px at 100% 100%,rgba(232,247,235,.55),transparent 72%)!important}
@media(max-width:860px){.turnits-panel-content{background-image:radial-gradient(ellipse 300px 140px at 72% 0,rgba(235,247,237,.55),transparent 72%)!important}}
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
                <OwnerOnly><React.Suspense fallback={null}><OnboardingNube
                    baseUrl={baseUrl}
                    accentColor={accentColor}
                    mpClientId={mpClientId}
                    onFinish={() => setOnboardingListo(true)}
                /></React.Suspense></OwnerOnly>
            )}

            {/* ─────────────── SIDEBAR (desktop) ─────────────── */}
            {!isMobile && (
                <div
                    style={
                        {
                            width: 400,
                            flexShrink: 0,
                            // Sticky: el menú nunca se mueve con el scroll del
                            // contenido, queda fijo a la altura del viewport.
                            position: "sticky",
                            top: 0,
                            alignSelf: "flex-start",
                            height: "100vh",
                            overflow: "hidden",
                            background: "#fcfffc",
                            borderRight: "1px solid #e5ece6",
                            display: "flex",
                            flexDirection: "column",
                            padding: "26px 24px 22px",
                            boxSizing: "border-box",
                            "--accent": accentColor,
                        } as React.CSSProperties
                    }
                >
                    <div
                        style={{
                            position: "relative",
                            marginBottom: 20,
                            display: "flex",
                            justifyContent: "flex-start",
                        }}
                    >
                        <BrandMark logoImage={logoImage} logoText={logoText} width={260} height={68} />
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
                            gap: 2,
                            flex: 1,
                            minHeight: 0,
                            overflowY: "auto",
                            overflowX: "hidden",
                        }}
                    >
                        <style>{`.turnits-nav-scroll{scrollbar-width:none;-ms-overflow-style:none}.turnits-nav-scroll::-webkit-scrollbar{display:none}.turnits-nav-scroll>*{min-height:40px}`}</style>
                        {renderNavItems()}
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
                    className="turnits-mobile-topbar"
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
                                    height: "100dvh", display: "flex", flexDirection: "column",
                                    maxHeight: "100dvh",
                                    overflowY: "auto",
                                    overscrollBehavior: "contain",
                                    background: "linear-gradient(180deg, #fbfffb 0%, #ffffff 58%)",
                                    borderRadius: 0,
                                    padding:
                                        "calc(14px + env(safe-area-inset-top, 0px)) 18px calc(28px + env(safe-area-inset-bottom, 0px))",
                                    boxSizing: "border-box",
                                    "--accent": accentColor,
                                } as React.CSSProperties
                            }
                        >
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
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                    <BrandMark logoImage={logoImage} logoText={logoText} width={260} height={68} />
                                    <BackButton aria-label="Cerrar menú" onClick={() => setMenuMobileAbierto(false)} />
                            </div>
                            
                            <div style={{position:"relative",display:"grid",gridTemplateColumns:"1fr",gap:2}}>{renderNavItems()}</div>

                            <div style={{ marginTop: "auto", paddingTop: 16 }}>
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
                            mostrarToggle={false}
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
                    mostrarToggle={false}
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
                        background: "#fff",
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
                    <div id="catalog-save-slot" />
                    <TurnitsGlobalSaveBar
                        seccionActiva={seccionActiva}
                        accentColor={accentColor}
                        isMobile={isMobile}
                    />
                </div>}

                {branchAdmin && seccionActiva !== "consultas" && <div style={{padding:"10px 14px",marginBottom:18,borderRadius:12,background:"#edf5ef",color:"#24492b",fontSize:13}}><strong>{branchAdmin.nombre}</strong> · Administración de sucursal</div>}
                {seccionActiva === "consultas" && quoteMode && agendaConsultaPermitida && !branchAdmin && <SectionLoadingBoundary><Consultations embedded="panel" onInboxChange={actualizarBandejaMensajes} onExit={() => irA("inicio")} /></SectionLoadingBoundary>}
                {seccionActiva === "inicio" && (
                    <>
                    {onboardingListo && !quoteMode && <OwnerOnly><React.Suspense fallback={null}><SetupGuide baseUrl={baseUrl} onNavigate={irA} /></React.Suspense></OwnerOnly>}
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
                    </>
                )}

                {seccionActiva === "servicios" && (
                    <AnimatePresence initial={false} mode="wait">
                    <motion.div key={serviciosVistaInicial} {...catalogTransition}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title={serviciosVistaInicial === "servicios" ? "Servicios" : serviciosVistaInicial === "extras" ? "Productos" : "Promociones"}
                            subtitle={serviciosVistaInicial === "servicios" ? "Administrá los servicios que ofrecés a tus clientes" : serviciosVistaInicial === "extras" ? "Administrá los productos adicionales de tu catálogo" : "Creá y organizá tus promociones"}
                            isMobile={isMobile}
                        />
                        <SectionLoadingBoundary>
                        {React.createElement(serviciosVistaInicial === "extras" ? ProductosPanel : serviciosVistaInicial === "promociones" ? PromocionesPanel : MisServiciosPanel, {
                            baseUrl,
                            accentColor,
                            iconoPlaceholderUrl: iconos.servicioPlaceholder,
                            iconoFormUrl: iconos.servicioForm,
                            iconoVacioUrl: iconos.servicioVacio,
                            iconoCheck: iconos.check,
                            iconoEditar: iconos.editar,
                            iconoEliminar: iconos.eliminar,
                        })}
                        </SectionLoadingBoundary>
                    </motion.div>
                    </AnimatePresence>
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
                            title="Clientes"
                            subtitle="Ofrece promociones a tus clientes, descuentos y combos para mejorar su experiencia"
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
                    <div className="agenda-section"
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title="Mi Agenda"
                            subtitle="Consultá tus próximos turnos y revisá las solicitudes de reprogramación."
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
                    <div data-schedule-view={scheduleView}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                        }}
                    >
                        <SeccionHeader
                            title={scheduleView==="weekly"?"Horario semanal":"Excepciones laborales"}
                            subtitle={scheduleView==="weekly"?"Definí tu jornada y tus descansos para cada día de la semana.":"Ajustá la disponibilidad de una fecha puntual."}
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
                    <SectionLoadingBoundary><CobrosNegocio vista={vistaPagos} baseUrl={baseUrl} iconos={iconos} isMobile={isMobile} /></SectionLoadingBoundary>
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
                        {!sucursales && <SeccionHeader
                            title={sucursales ? "Sucursales" : "Equipo"}
                            subtitle={sucursales ? "Administrá las sedes y sus profesionales." : "Gestioná a las personas que trabajan con vos."}
                            isMobile={isMobile}
                        />}
                        <SectionLoadingBoundary>
                        <EquipoSecciones sucursales={sucursales}
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
                {seccionActiva === "perfil" && <PerfilNegocio publicaciones={publicaciones} baseUrl={baseUrl} isMobile={isMobile}/>}
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

            {/* ─────────────── NAV FLOTANTE (mobile, estilo Instagram) ─── */}
            {isMobile && seccionActiva !== "consultas" && (
                <nav
                    className="turnits-mobile-bottom-nav"
                    aria-label="Navegación principal"
                    style={{
                        position: "fixed",
                        left: 0,
                        right: 0,
                        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
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
                            background: "#ffffff",
                            borderRadius: 30,
                            padding: "8px 12px",
                            boxShadow:
                                "0 10px 30px rgba(15,23,42,0.18), 0 2px 10px rgba(15,23,42,0.08)",
                            border: "1px solid #eef1f6",
                        }}
                    >
                        <BottomNavIcon
                            id="inicio"
                            active={seccionActiva === "inicio"}
                            accentColor={accentColor}
                            onClick={() => irA("inicio")}
                            navIconos={navIconos}
                        />
                        <BottomNavIcon
                            id="servicios"
                            active={seccionActiva === "servicios"}
                            accentColor={accentColor}
                            onClick={() => irA("servicios")}
                            navIconos={navIconos}
                        />
                        <div
                            className="turnits-mobile-copy-link"
                            style={{
                                margin: "0 2px",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <CopyTurnosButton
                                customIcon={iconos.botonCentral}
                                checkIcon={iconos.botonCentralCheck}
                                accentColor="#065f46"
                                urlColor={accentColor}
                                successText="¡Copiado!"
                                size={48}
                            />
                        </div>
                        <BottomNavIcon
                            id="agenda"
                            active={seccionActiva === "agenda"}
                            accentColor={accentColor}
                            onClick={() => irA("agenda")}
                            navIconos={navIconos}
                        />
                        <BottomNavMore
                            active={
                                menuMobileAbierto ||
                                !["inicio", "servicios", "agenda"].includes(seccionActiva)
                            }
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
