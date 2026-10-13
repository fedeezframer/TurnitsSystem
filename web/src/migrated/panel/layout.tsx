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
import { SeccionId, Turnits_useElementWidth, TurnitsGlobalSaveManager_get, MenuFooter_getSlug, MenuFooter_getToken, usePanelAutoUpdate, NAV_ITEMS, SeccionHeader } from "./common"
import { TurnitsBetaInstallPrompt, TurnitsPanel_Splash, QrFlotante, TurnitsGlobalSaveBar } from "./interfaz"
import { PanelUpdateBanner } from "./shared"
import { OnboardingNube } from "./onboarding"
import { AmbientOrbs, BrandMark, NavButton, TeamManager, BottomNavIcon, BottomNavMore } from "./equipo"
import { MenuFooter, MenuCuentaPagoRetorno, NotificacionesFlotantes } from "./cuenta"
import { SeccionInicio, TurnitsDashboardSidePanel } from "./dashboard"
import { ServiciosManager } from "./servicios"
import { ClientesGrid } from "./clientes"
import { AgendaPanel } from "./agenda"
import { HorariosConfig, ExcepcionesConfig } from "./horarios"
import { PagosSettingsGuard, MercadoPagoConexion, ConfigPagos } from "./pagos"
import { FinanzasPanel } from "./finanzas"
import { ThemeEditor } from "./temas"
import { CopyTurnosButton } from "./inicio"

function TurnitsPanel_Inner(props: any) {
    const {
        baseUrl = "https://negosocio.onrender.com",
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
        actualizacionAuto = true,
        actualizacionModo = "automatico",
        actualizacionMinutos = 5,
        style,
    } = props

    // ─── Onboarding a pantalla completa: mientras el usuario no tenga
    // servicio + horarios + método de cobro, no se muestra el panel.
    const [onboardingListo, setOnboardingListo] = React.useState(false)
    // ─── Preloader de arranque (logo → "Hola, Nombre" → se difumina) ──
    const [splashListo, setSplashListo] = React.useState(false)

    // ─── Estado de navegación (reemplaza las variantes de Framer) ─────────
    const [seccionActiva, setSeccionActiva] =
        React.useState<SeccionId>("inicio")
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
            fetch(`${api}/settings/${slug}`, {
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

    // ─── Auto-actualización: detecta versión nueva publicada y recarga ─────
    const autoUpdate = usePanelAutoUpdate({
        baseUrl,
        activo: !!actualizacionAuto,
        modo: actualizacionModo === "aviso" ? "aviso" : "automatico",
        minutos: Number(actualizacionMinutos) || 5,
    })

    const irA = (id: SeccionId) => {
        setSeccionActiva(id)
        setMenuMobileAbierto(false)
    }

    const navItemsVisibles = NAV_ITEMS.filter(
        (item) => item.id !== "equipo" || equipoDisponible
    )

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
            className="turnits-root"
            style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                width: "100%",
                // En móvil el panel participa del alto normal del documento:
                // sin fijarlo al viewport, así el navegador hace un solo scroll natural.
                height: isMobile ? "auto" : "100vh",
                minHeight: isMobile ? 0 : "100vh",
                background: "#f8fafc",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                boxSizing: "border-box",
                overflow: isMobile ? "visible" : "hidden",
                ...style,
                // El ancho lo manda el panel, no el frame de Framer.
                width: "100%",
                minWidth: 0,
                maxWidth: "none",
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
.turnits-root{-webkit-text-size-adjust:100%;text-size-adjust:100%}
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

            <PanelUpdateBanner
                visible={!!autoUpdate.pendiente}
                accentColor={accentColor}
                onUpdate={autoUpdate.aplicar}
                onDismiss={autoUpdate.descartar}
            />

            {true && (
                <OnboardingNube
                    baseUrl={baseUrl}
                    accentColor={accentColor}
                    mpClientId={mpClientId}
                    onFinish={() => setOnboardingListo(true)}
                />
            )}

            {/* Preloader: tapa el "trabón" del primer render mientras los
                widgets hacen sus fetches iniciales en paralelo, abajo. */}
            <AnimatePresence>
                {true &&
                    !splashListo && (
                        <TurnitsPanel_Splash
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            logoImage={logoImage}
                            logoText={logoText}
                            onDone={() => setSplashListo(true)}
                        />
                    )}
            </AnimatePresence>

            {/* ─────────────── SIDEBAR (desktop) ─────────────── */}
            {!isMobile && (
                <div
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

            <MenuCuentaPagoRetorno api={baseUrl} logo={logoImage} />
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
                        minWidth: 0,
                        minHeight: isMobile ? "auto" : 0,
                        padding: isMobile
                            ? "16px 16px calc(100px + env(safe-area-inset-bottom, 0px))"
                            : 32,
                        boxSizing: "border-box",
                        overflow: isMobile ? "visible" : "auto",
                        WebkitOverflowScrolling: isMobile ? undefined : "touch",
                        overscrollBehavior: isMobile ? "auto" : "contain",
                    } as React.CSSProperties
                }
            >
                <div
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
                </div>

                {seccionActiva === "inicio" && (
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
                            title="Mis Servicios"
                            subtitle="Los servicios que ofrecés a tus clientes"
                            isMobile={isMobile}
                        />
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
                        <ClientesGrid
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                        />
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
                        <AgendaPanel
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            iconoReprogramacion={
                                iconosNotificaciones.reprogramacion
                            }
                        />
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
                        <HorariosConfig
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            mostrarBotonGuardar={false}
                        />
                        <ExcepcionesConfig
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                        />
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
                        <FinanzasPanel
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                        />

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
                            title="Tema y Marca"
                            subtitle="Personalizá el logo y los colores de tu agenda"
                            isMobile={isMobile}
                        />
                        <ThemeEditor
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            iconoLogoUrl={iconos.logo}
                        />
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
                        <TeamManager
                            baseUrl={baseUrl}
                            accentColor={accentColor}
                            iconoVacioUrl={iconos.equipoVacio}
                            iconoCheck={iconos.check}
                            iconoEditar={iconos.editar}
                            iconoEliminar={iconos.eliminar}
                        />
                    </div>
                )}
            </div>

            <TurnitsDashboardSidePanel
                baseUrl={baseUrl}
                accentColor={accentColor}
                isMobile={isMobile}
                panel={panelLateral}
                onClose={() => setPanelLateral(null)}
                onNavigate={irA}
                referidosPlusIcono={referidosPlusIcono}
                ilustracionRendimientoVacio={ilustracionRendimientoVacio}
            />

            {/* ─────────────── NAV FLOTANTE (mobile, estilo Instagram) ─── */}
            {isMobile && (
                <div
                    style={{
                        position: "fixed",
                        left: 0,
                        right: 0,
                        bottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
                        display: "flex",
                        justifyContent: "center",
                        zIndex: 60,
                        pointerEvents: "none",
                    }}
                >
                    <div
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
                            onClick={() => setMenuMobileAbierto(true)}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export { TurnitsPanel_Inner }
