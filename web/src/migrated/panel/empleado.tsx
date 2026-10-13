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
import { AgendaPanel_hoyISO, MenuFooter_cerrarSesion, NAV_ITEMS, TurnitsDashboard_shortMoney, AgendaPanel_labelStyle, AgendaPanel_inputStyle, TurnitsDashboard_money } from "./common"
import { MenuFooterIconButton, MenuFooterSoporteIcon, MenuFooterLogoutIcon, NotificacionesFlotantes } from "./cuenta"
import { TurnitsBetaInstallPrompt, TurnitsGlobalSaveBar, QrFlotante } from "./interfaz"
import { AmbientOrbs, BrandMark, NavButton, BottomNavIcon, BottomNavMore } from "./equipo"
import { TurnitsDashboard_MetricCard, TurnitsDashboard_Chart, TurnitsDashboard_Upcoming } from "./dashboard"
import { ServiciosManager } from "./servicios"
import { HorariosConfig, ExcepcionesConfig } from "./horarios"
import { MercadoPagoConexion, ConfigPagos } from "./pagos"

function TurnitsEmpleadoPanel({ props, slug }: { props: any; slug: string }) {
    const api = String(
        props.baseUrl || appConfig.apiUrl
    ).replace(/\/+$/, "")
    const accentColor = props.accentColor || "#22c55e"
    const imagenSrc = (value: any, depth = 0): string => {
        if (depth > 5 || value == null) return ""
        if (typeof value === "string") return value.trim()
        if (Array.isArray(value)) return imagenSrc(value[0], depth + 1)
        if (typeof value !== "object") return ""

        // Framer Image controls can hydrate as a URL string, {src}, nested
        // {src:{src}}, or an asset object depending on how the published
        // component is restored. Walk the known wrappers so employee icons
        // don't fall back to emoji after reopening the web app.
        for (const key of ["src", "url", "href", "image", "asset", "source"]) {
            const result = imagenSrc(value[key], depth + 1)
            if (result) return result
        }
        const srcSet =
            typeof value.srcSet === "string" ? value.srcSet : value.srcset
        if (typeof srcSet === "string" && srcSet.trim()) {
            const first = srcSet.split(",")[0]?.trim().split(/\s+/)[0]
            if (first) return first
        }
        return ""
    }
    const normalizarGrupoIconos = (group: any) =>
        Object.fromEntries(
            Object.entries(group || {}).map(([key, value]) => [
                key,
                imagenSrc(value),
            ])
        )
    const iconosGrupo = normalizarGrupoIconos(props.iconos)
    // Compatibilidad con propiedades de imagen planas de Framer y con el
    // objeto agrupado usado por el panel principal. Los nombres planos de
    // MercadoPagoConexion (logoMP/logoTransferencia/logoEfectivo) son los que
    // quedan guardados en algunas instancias publicadas.
    const iconos = {
        ...iconosGrupo,
        check: iconosGrupo.check || imagenSrc(props.iconoCheck),
        editar:
            iconosGrupo.editar ||
            imagenSrc(props.iconoEditar) ||
            imagenSrc(props.editar),
        eliminar:
            iconosGrupo.eliminar ||
            imagenSrc(props.iconoEliminar) ||
            imagenSrc(props.eliminar),
        servicioPlaceholder:
            iconosGrupo.servicioPlaceholder ||
            imagenSrc(props.iconoServicioPlaceholder),
        servicioForm:
            iconosGrupo.servicioForm || imagenSrc(props.iconoServicioForm),
        servicioVacio:
            iconosGrupo.servicioVacio || imagenSrc(props.iconoServicioVacio),
        logoMercadoPago:
            iconosGrupo.logoMercadoPago ||
            imagenSrc(props.logoMP) ||
            imagenSrc(props.logoMercadoPago) ||
            iconosGrupo.logoMP,
        logoTransferencia:
            iconosGrupo.logoTransferencia || imagenSrc(props.logoTransferencia),
        logoEfectivo: iconosGrupo.logoEfectivo || imagenSrc(props.logoEfectivo),
        soporte: iconosGrupo.soporte || imagenSrc(props.iconoSoporte),
        logout: iconosGrupo.logout || imagenSrc(props.iconoSalir),
    }
    const navIconos = normalizarGrupoIconos(props.navIconos)
    const iconosNotificaciones = normalizarGrupoIconos(
        props.iconosNotificaciones
    )
    const [tab, setTab] = React.useState<
        "inicio" | "servicios" | "agenda" | "horarios" | "pagos"
    >("inicio")
    const [data, setData] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [guardando, setGuardando] = React.useState(false)
    const [subiendoFoto, setSubiendoFoto] = React.useState(false)
    const [formAbierto, setFormAbierto] = React.useState(false)
    const [servicioEditando, setServicioEditando] = React.useState<any>(null)
    const [form, setForm] = React.useState({
        nombre: "",
        descripcion: "",
        duracion: "30",
        precio: "",
        capacidad: "1",
        imagen_url: "",
        orden: "0",
    })
    const [ancho, setAncho] = React.useState(1200)
    const [menuMobileAbierto, setMenuMobileAbierto] = React.useState(false)
    const [mostrarNotificaciones, setMostrarNotificaciones] =
        React.useState(false)
    const [turnoDetalle, setTurnoDetalle] = React.useState<any>(null)
    const [aprobandoTurno, setAprobandoTurno] = React.useState(false)
    const [comprobanteEmpleado, setComprobanteEmpleado] = React.useState<{
        url: string
        loading: boolean
        error: string
    }>({ url: "", loading: false, error: "" })
    const [manualAbierto, setManualAbierto] = React.useState(false)
    const [manualNombre, setManualNombre] = React.useState("")
    const [manualFecha, setManualFecha] = React.useState(AgendaPanel_hoyISO())
    const [manualHora, setManualHora] = React.useState("")
    const [manualServicio, setManualServicio] = React.useState("")
    const [manualGuardando, setManualGuardando] = React.useState(false)
    const [manualError, setManualError] = React.useState("")
    const rootRef = React.useRef<HTMLDivElement>(null)
    const isMobile = ancho < 860
    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("access_token") ||
              localStorage.getItem("user_token") ||
              localStorage.getItem("token") ||
              localStorage.getItem("auth_token") ||
              localStorage.getItem("turnits_token") ||
              ""
            : ""

    React.useEffect(() => {
        const el = rootRef.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((entries) =>
            setAncho(entries[0]?.contentRect.width || 1200)
        )
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const cargar = React.useCallback(async () => {
        setError("")
        const res = await fetch(
            `${api}/empleado/${encodeURIComponent(slug)}/resumen`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            }
        )
        const body = await res.json().catch(() => ({}))
        if (!res.ok || !body.success)
            throw new Error(body.error || "No se pudo cargar tu panel.")
        setData(body)
    }, [api, slug, token])

    // Los permisos pueden cambiar mientras el empleado mantiene la sesión
    // abierta. Volver a consultar el perfil al navegar hace visible el cambio
    // al entrar a cada sección, sin reiniciar la app ni esperar al polling.
    const navegarA = (
        seccion: "inicio" | "servicios" | "agenda" | "horarios" | "pagos"
    ) => {
        setTab(seccion)
        cargar().catch((e: any) =>
            setError(e.message || "No se pudo actualizar tu panel.")
        )
    }

    React.useEffect(() => {
        let alive = true
        const refrescar = () => {
            if (document.visibilityState === "hidden") return
            cargar()
                .catch((e) => {
                    if (alive)
                        setError(e.message || "No se pudo cargar tu panel.")
                })
                .finally(() => {
                    if (alive) setLoading(false)
                })
        }
        refrescar()
        const intervalo = window.setInterval(refrescar, 30_000)
        window.addEventListener("focus", refrescar)
        window.addEventListener("pageshow", refrescar)
        window.addEventListener("turno_actualizado", refrescar)
        document.addEventListener("visibilitychange", refrescar)
        return () => {
            alive = false
            window.clearInterval(intervalo)
            window.removeEventListener("focus", refrescar)
            window.removeEventListener("pageshow", refrescar)
            window.removeEventListener("turno_actualizado", refrescar)
            document.removeEventListener("visibilitychange", refrescar)
        }
    }, [cargar])

    React.useEffect(() => {
        let vigente = true
        if (
            !turnoDetalle?.tiene_comprobante ||
            turnoDetalle?.metodo_pago !== "transferencia"
        ) {
            setComprobanteEmpleado({ url: "", loading: false, error: "" })
            return () => {
                vigente = false
            }
        }
        setComprobanteEmpleado({ url: "", loading: true, error: "" })
        fetch(
            `${api}/empleado/${encodeURIComponent(slug)}/turnos/${encodeURIComponent(turnoDetalle.id)}/comprobante`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            }
        )
            .then(async (res) => {
                const body = await res.json().catch(() => ({}))
                if (!res.ok || !body.success || !body.url)
                    throw new Error(
                        body.error || "No se pudo cargar el comprobante."
                    )
                if (vigente)
                    setComprobanteEmpleado({
                        url: body.url,
                        loading: false,
                        error: "",
                    })
            })
            .catch((e: any) => {
                if (vigente)
                    setComprobanteEmpleado({
                        url: "",
                        loading: false,
                        error: e.message || "No se pudo cargar el comprobante.",
                    })
            })
        return () => {
            vigente = false
        }
    }, [
        api,
        slug,
        token,
        turnoDetalle?.id,
        turnoDetalle?.tiene_comprobante,
        turnoDetalle?.metodo_pago,
    ])

    const abrirNuevoServicio = () => {
        setServicioEditando(null)
        setForm({
            nombre: "",
            descripcion: "",
            duracion: "30",
            precio: "",
            capacidad: "1",
            imagen_url: "",
            orden: "0",
        })
        setFormAbierto(true)
    }
    const abrirEditarServicio = (s: any) => {
        setServicioEditando(s)
        setForm({
            nombre: s.nombre || "",
            descripcion: s.descripcion || "",
            duracion: String(s.duracion || 30),
            precio: String(s.precio ?? ""),
            capacidad: String(s.capacidad || 1),
            imagen_url: s.imagen_url || "",
            orden: String(s.orden ?? 0),
        })
        setFormAbierto(true)
    }
    const guardarServicio = async () => {
        setError("")
        if (!form.nombre.trim() || !form.precio) {
            setError("Completá el nombre y el precio del servicio.")
            return
        }
        setGuardando(true)
        try {
            const res = await fetch(
                `${api}/empleado/${encodeURIComponent(slug)}/servicios${servicioEditando ? `/${servicioEditando.id}` : ""}`,
                {
                    method: servicioEditando ? "PUT" : "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(
                        servicioEditando
                            ? {
                                  precio: Number(form.precio),
                                  imagen_url: form.imagen_url.trim() || null,
                                  orden: Number(form.orden),
                              }
                            : {
                                  ...form,
                                  duracion: Number(form.duracion),
                                  precio: Number(form.precio),
                                  capacidad: Number(form.capacidad),
                              }
                    ),
                }
            )
            const body = await res.json().catch(() => ({}))
            if (!res.ok || !body.success)
                throw new Error(body.error || "No se pudo guardar el servicio.")
            setFormAbierto(false)
            await cargar()
        } catch (e: any) {
            setError(e.message || "No se pudo guardar el servicio.")
        } finally {
            setGuardando(false)
        }
    }
    const subirFotoServicio = async (file?: File) => {
        if (!file) return
        setError("")
        setSubiendoFoto(true)
        try {
            const body = new FormData()
            body.append("imagen", file)
            const res = await fetch(`${api}/admin/servicios/upload-imagen`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body,
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success || !data.url)
                throw new Error(data.error || "No se pudo subir la imagen.")
            setForm((f) => ({ ...f, imagen_url: data.url }))
        } catch (e: any) {
            setError(e.message || "No se pudo subir la imagen.")
        } finally {
            setSubiendoFoto(false)
        }
    }
    const quitarServicio = async (s: any) => {
        if (!window.confirm(`¿Quitar “${s.nombre}” de tus servicios?`)) return
        setError("")
        try {
            const res = await fetch(
                `${api}/empleado/${encodeURIComponent(slug)}/servicios/${s.id}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            )
            const body = await res.json().catch(() => ({}))
            if (!res.ok || !body.success)
                throw new Error(body.error || "No se pudo quitar el servicio.")
            await cargar()
        } catch (e: any) {
            setError(e.message || "No se pudo quitar el servicio.")
        }
    }

    const salir = () =>
        MenuFooter_cerrarSesion(props.logoutUrl || "/login")
    const aprobarTurnoEmpleado = async (turno: any) => {
        if (!turno?.id || aprobandoTurno) return
        setAprobandoTurno(true)
        setError("")
        try {
            const res = await fetch(
                `${api}/turnos/${encodeURIComponent(turno.id)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ slug, estado: "confirmado" }),
                }
            )
            const body = await res.json().catch(() => ({}))
            if (!res.ok || !body.success)
                throw new Error(
                    body.message || body.error || "No se pudo aprobar el turno."
                )
            setTurnoDetalle(null)
            await cargar()
            window.dispatchEvent(new Event("turno_actualizado"))
        } catch (e: any) {
            setError(e.message || "No se pudo aprobar el turno.")
        } finally {
            setAprobandoTurno(false)
        }
    }
    const rechazarTurnoEmpleado = async (turno: any) => {
        if (!turno?.id || aprobandoTurno) return
        if (
            !window.confirm(
                "¿Querés rechazar este turno? Se cancelará y se notificará al cliente."
            )
        )
            return
        setAprobandoTurno(true)
        setError("")
        try {
            const res = await fetch(
                `${api}/turnos/${encodeURIComponent(turno.id)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ slug, estado: "cancelado" }),
                }
            )
            const body = await res.json().catch(() => ({}))
            if (!res.ok || !body.success)
                throw new Error(body.error || "No se pudo rechazar el turno.")
            setTurnoDetalle(null)
            await cargar()
            window.dispatchEvent(
                new CustomEvent("turno_actualizado", {
                    detail: { id: turno.id },
                })
            )
        } catch (e: any) {
            setError(e.message || "No se pudo rechazar el turno.")
        } finally {
            setAprobandoTurno(false)
        }
    }
    const crearTurnoManualEmpleado = async (forzar = false) => {
        if (manualGuardando) return
        if (
            manualNombre.trim().length < 2 ||
            !manualFecha ||
            !manualHora ||
            ((data?.servicios || []).length && !manualServicio)
        ) {
            setManualError(
                "Completá el nombre, la fecha, la hora y el servicio."
            )
            return
        }
        setManualGuardando(true)
        setManualError("")
        try {
            const res = await fetch(`${api}/admin/turnos/manual`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug,
                    nombre: manualNombre.trim(),
                    fecha: manualFecha,
                    hora: manualHora,
                    servicio_id: manualServicio || null,
                    equipo_id: data?.perfil?.id,
                    forzar,
                }),
            })
            const body = await res.json().catch(() => ({}))
            if (res.status === 409 && body.conflicto && !forzar) {
                if (
                    window.confirm(
                        body.error ||
                            "Ya hay un turno en ese horario. ¿Querés agendarlo igual?"
                    )
                ) {
                    setManualGuardando(false)
                    return crearTurnoManualEmpleado(true)
                }
                setManualError(body.error || "Ya hay un turno en ese horario.")
                return
            }
            if (!res.ok || !body.success)
                throw new Error(body.error || "No se pudo agendar el turno.")
            setManualAbierto(false)
            setManualNombre("")
            setManualHora("")
            setManualServicio("")
            await cargar()
            window.dispatchEvent(
                new CustomEvent("turno_actualizado", {
                    detail: { id: body.turno_id },
                })
            )
        } catch (e: any) {
            setManualError(e.message || "No se pudo agendar el turno.")
        } finally {
            setManualGuardando(false)
        }
    }
    const soporteUrl =
        props.soporteUrl ||
        "https://api.whatsapp.com/send/?phone=5493513087324&text&type=phone_number&app_absent=0"
    const nombreEmpleado = data?.perfil
        ? `${data.perfil.nombre || ""} ${data.perfil.apellido || ""}`.trim()
        : "Mi panel"
    const fotoEmpleado = data?.perfil?.foto_url
    const colorEmpleado = data?.perfil?.color || accentColor
    const FooterEmpleado = ({ mobile = false }: { mobile?: boolean }) => (
        <div
            style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: mobile ? "14px 4px 0" : "12px 4px",
                borderTop: "1px solid #e9edf3",
                marginTop: mobile ? 16 : 12,
            }}
        >
            {fotoEmpleado ? (
                <img
                    src={fotoEmpleado}
                    alt=""
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                    }}
                />
            ) : (
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        background: colorEmpleado,
                        color: "white",
                        fontWeight: 800,
                        flexShrink: 0,
                    }}
                >
                    {nombreEmpleado.slice(0, 1) || "E"}
                </div>
            )}
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontWeight: 650,
                    color: "#334155",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {nombreEmpleado}
            </div>
            <MenuFooterIconButton
                icon={iconos.soporte}
                defaultIcon={MenuFooterSoporteIcon}
                ariaLabel="Contacto y soporte"
                onClick={() =>
                    window.open(soporteUrl, "_blank", "noopener,noreferrer")
                }
            />
            <MenuFooterIconButton
                icon={iconos.logout}
                defaultIcon={MenuFooterLogoutIcon}
                ariaLabel="Cerrar sesión"
                onClick={salir}
            />
        </div>
    )
    const formatoFecha = (iso: string) => {
        if (!iso) return "Fecha sin definir"
        const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
        return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
            weekday: "short",
            day: "numeric",
            month: "short",
        })
    }
    const card: React.CSSProperties = {
        background: "#fff",
        border: "1px solid #e6ebf0",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 2px 8px rgba(15,23,42,.04)",
    }
    const items = NAV_ITEMS.filter((item) =>
        ["inicio", "servicios", "agenda", "horarios", "pagos"].includes(item.id)
    )
    const puedeHorarios = !!data?.perfil?.puede_configurar_horarios
    const puedePagos = !!data?.perfil?.puede_recibir_pagos_personales
    const puedeServicios = !!data?.perfil?.puede_crear_servicios
    const avisoSoloLectura: React.CSSProperties = {
        ...card,
        padding: "10px 14px",
        color: "#64748b",
        fontSize: 12,
        background: "#f1f3f5",
        borderColor: "#e2e5e9",
        boxShadow: "none",
    }
    const titulo = (
        {
            inicio: "Inicio",
            agenda: "Mi Agenda",
            servicios: "Mis Servicios",
            horarios: "Mis Horarios",
            pagos: "Mis Pagos",
        } as any
    )[tab]

    return (
        <div
            ref={rootRef}
            className="turnits-root"
            style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                width: "100%",
                minHeight: isMobile ? 0 : "100vh",
                height: isMobile ? "auto" : "100vh",
                overflow: isMobile ? "visible" : "hidden",
                background: "#f8fafc",
                color: "#172033",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                boxSizing: "border-box",
            }}
        >
            <TurnitsBetaInstallPrompt
                apiBaseUrl={api}
                accentColor={accentColor}
                logoImage={props.logoImage}
                logoText={props.logoText || "Turnits"}
                slug={slug}
            />
            {!isMobile && (
                <aside
                    style={
                        {
                            position: "relative",
                            width: 252,
                            flex: "0 0 252px",
                            height: "100vh",
                            overflow: "hidden",
                            background:
                                "linear-gradient(180deg,#fbfcff 0%,#f6f7fb 100%)",
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
                        <BrandMark
                            logoImage={props.logoImage}
                            logoText={props.logoText || "turnits"}
                        />
                    </div>
                    <nav
                        aria-label="Mi panel"
                        style={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            flex: 1,
                        }}
                    >
                        {items.map((item) => (
                            <NavButton
                                key={item.id}
                                item={item}
                                active={tab === item.id}
                                accentColor={accentColor}
                                onClick={() => navegarA(item.id as any)}
                                navIconos={navIconos}
                            />
                        ))}
                    </nav>
                    <FooterEmpleado />
                </aside>
            )}
            <main
                style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    overflowY: isMobile ? "visible" : "auto",
                    padding: isMobile ? 0 : "28px 32px",
                    boxSizing: "border-box",
                }}
            >
                {isMobile && (
                    <div
                        style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 35,
                            minHeight: 62,
                            display: "flex",
                            alignItems: "center",
                            padding: "6px 16px",
                            background: "rgba(248,250,252,.94)",
                            backdropFilter: "blur(14px)",
                            WebkitBackdropFilter: "blur(14px)",
                            borderBottom: "1px solid #eef1f6",
                            boxSizing: "border-box",
                        }}
                    >
                        <BrandMark
                            logoImage={props.logoImage}
                            logoText={props.logoText || "turnits"}
                            width={104}
                            height={48}
                        />
                    </div>
                )}
                <div
                    style={{
                        maxWidth: 1440,
                        margin: "0 auto",
                        padding: isMobile ? "16px 16px 112px" : 0,
                    }}
                >
                    <div style={{ margin: "6px 0 20px" }}>
                        <div
                            style={{
                                color: "#64748b",
                                fontSize: 12,
                                marginBottom: 4,
                            }}
                        >
                            Mi espacio de trabajo
                        </div>
                        <h1
                            style={{
                                fontSize: 28,
                                letterSpacing: "-.03em",
                                margin: 0,
                                fontWeight: 750,
                            }}
                        >
                            {titulo}
                        </h1>
                        <div
                            style={{
                                color: "#8491a3",
                                fontSize: 13,
                                marginTop: 5,
                            }}
                        >
                            Hola
                            {data?.perfil?.nombre
                                ? `, ${data.perfil.nombre}`
                                : ""}
                            . Administrá tu agenda y tus servicios.
                        </div>
                    </div>
                    {((tab === "horarios" && puedeHorarios) ||
                        (tab === "pagos" && puedePagos)) && (
                        <div
                            style={{
                                position: "sticky",
                                top: isMobile ? 66 : 20,
                                zIndex: 30,
                                display: "flex",
                                flexDirection: "column",
                                marginBottom: 12,
                                background: isMobile
                                    ? "rgba(248,250,252,.96)"
                                    : "rgba(248,250,252,.92)",
                                backdropFilter: "blur(10px)",
                                WebkitBackdropFilter: "blur(10px)",
                            }}
                        >
                            <TurnitsGlobalSaveBar
                                seccionActiva={tab}
                                accentColor={accentColor}
                                isMobile={isMobile}
                            />
                        </div>
                    )}
                    {error && (
                        <div
                            style={{
                                ...card,
                                borderColor: "#fecaca",
                                color: "#b91c1c",
                                marginBottom: 14,
                            }}
                        >
                            {error}
                        </div>
                    )}
                    {loading ? (
                        <div
                            style={{
                                ...card,
                                color: "#94a3b8",
                                textAlign: "center",
                                padding: 40,
                            }}
                        >
                            Cargando tu información…
                        </div>
                    ) : tab === "inicio" ? (
                        <div style={{ display: "grid", gap: 14 }}>
                            <section
                                style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fit,minmax(185px,1fr))",
                                    gap: 12,
                                }}
                            >
                                <TurnitsDashboard_MetricCard
                                    label="Turnos este mes"
                                    value={Number(
                                        data?.inicio?.turnos || 0
                                    ).toLocaleString("es-AR")}
                                />
                                <TurnitsDashboard_MetricCard
                                    label="Ingresos este mes"
                                    value={TurnitsDashboard_shortMoney(
                                        Number(data?.inicio?.ingresos || 0)
                                    )}
                                />
                                <TurnitsDashboard_MetricCard
                                    label="Clientes"
                                    value={Number(
                                        data?.inicio?.clientes || 0
                                    ).toLocaleString("es-AR")}
                                />
                                <TurnitsDashboard_MetricCard
                                    label="Ticket promedio"
                                    value={TurnitsDashboard_shortMoney(
                                        Number(
                                            data?.inicio?.ticket_promedio || 0
                                        )
                                    )}
                                />
                            </section>
                            <section
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: isMobile
                                        ? "1fr"
                                        : "minmax(0,1.7fr) minmax(280px,1fr)",
                                    gap: 12,
                                    alignItems: "start",
                                }}
                            >
                                <div>
                                    <TurnitsDashboard_Chart
                                        stats={data?.inicio?.stats}
                                        accentColor={accentColor}
                                        monthMode
                                    />
                                </div>
                                <TurnitsDashboard_Upcoming
                                    stats={data?.inicio?.stats}
                                    accentColor={accentColor}
                                    onNavigate={(next: any) => navegarA(next)}
                                    ilustracionVacia={
                                        props.ilustracionProximosTurnosVacio
                                    }
                                />
                            </section>
                        </div>
                    ) : tab === "agenda" ? (
                        <section style={{ display: "grid", gap: 10 }}>
                            <div
                                style={{
                                    ...card,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 12,
                                    flexWrap: "wrap",
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 750 }}>
                                        Mi agenda
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "#8491a3",
                                            marginTop: 3,
                                        }}
                                    >
                                        También podés cargar un turno acordado
                                        por fuera de la app.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setManualFecha(AgendaPanel_hoyISO())
                                        setManualNombre("")
                                        setManualHora("")
                                        setManualServicio(
                                            data?.servicios?.[0]?.id || ""
                                        )
                                        setManualError("")
                                        setManualAbierto(true)
                                    }}
                                    style={{
                                        border: 0,
                                        borderRadius: 999,
                                        padding: "10px 15px",
                                        background: accentColor,
                                        color: "#fff",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    }}
                                >
                                    + Agregar turno
                                </button>
                            </div>
                            {(data?.turnos || []).length ? (
                                data.turnos.map((t: any) => (
                                    <button
                                        type="button"
                                        key={t.id}
                                        onClick={() => setTurnoDetalle(t)}
                                        style={{
                                            ...card,
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 12,
                                            width: "100%",
                                            color: "inherit",
                                            textAlign: "left",
                                            font: "inherit",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 700 }}>
                                                {formatoFecha(t.fecha)} ·{" "}
                                                {t.hora}
                                            </div>
                                            <div
                                                style={{
                                                    color: "#475569",
                                                    fontSize: 13,
                                                    marginTop: 4,
                                                }}
                                            >
                                                {t.cliente} · {t.servicio}
                                            </div>
                                            {t.notas && (
                                                <div
                                                    style={{
                                                        color: "#8491a3",
                                                        fontSize: 12,
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    {t.notas}
                                                </div>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                color:
                                                    t.estado === "pendiente"
                                                        ? "#b45309"
                                                        : "#64748b",
                                                background:
                                                    t.estado === "pendiente"
                                                        ? "#fef3c7"
                                                        : "#f1f5f9",
                                                borderRadius: 20,
                                                padding: "5px 9px",
                                                fontSize: 11,
                                                textTransform: "capitalize",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {t.estado} · Ver detalle
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div
                                    style={{
                                        ...card,
                                        color: "#8491a3",
                                        textAlign: "center",
                                        padding: 32,
                                    }}
                                >
                                    Todavía no tenés turnos asignados.
                                </div>
                            )}
                        </section>
                    ) : tab === "servicios" ? (
                        <div style={{ display: "grid", gap: 10 }}>
                            {!puedeServicios && (
                                <div style={avisoSoloLectura}>
                                    Vista de solo lectura. El titular administra
                                    los servicios; podés quitar un servicio de
                                    tu agenda con la X.
                                </div>
                            )}
                            <ServiciosManager
                                baseUrl={api}
                                accentColor={accentColor}
                                employeeMode
                                employeeCanCreate={puedeServicios}
                                iconoPlaceholderUrl={iconos.servicioPlaceholder}
                                iconoFormUrl={iconos.servicioForm}
                                iconoVacioUrl={iconos.servicioVacio}
                                iconoCheck={iconos.check}
                                iconoEditar={iconos.editar}
                                iconoEliminar={iconos.eliminar}
                                style={{
                                    minHeight: 360,
                                    opacity: puedeServicios ? 1 : 0.62,
                                }}
                            />
                        </div>
                    ) : tab === "horarios" ? (
                        <div style={{ display: "grid", gap: 10 }}>
                            {!puedeHorarios && (
                                <div style={avisoSoloLectura}>
                                    Horarios y excepciones del negocio · solo
                                    lectura.
                                </div>
                            )}
                            <div
                                aria-disabled={!puedeHorarios}
                                style={{
                                    display: "grid",
                                    gap: 14,
                                    opacity: puedeHorarios ? 1 : 0.55,
                                    pointerEvents: puedeHorarios
                                        ? "auto"
                                        : "none",
                                    filter: puedeHorarios
                                        ? "none"
                                        : "grayscale(.18)",
                                }}
                            >
                                <HorariosConfig
                                    baseUrl={api}
                                    accentColor={accentColor}
                                    employeeMode
                                    mostrarBotonGuardar={false}
                                />
                                <ExcepcionesConfig
                                    baseUrl={api}
                                    accentColor={accentColor}
                                    employeeMode
                                />
                            </div>
                        </div>
                    ) : tab === "pagos" ? (
                        <div style={{ display: "grid", gap: 10 }}>
                            {!puedePagos && (
                                <div style={avisoSoloLectura}>
                                    Se muestran los medios de pago del negocio ·
                                    solo lectura.
                                </div>
                            )}
                            <div
                                aria-disabled={!puedePagos}
                                style={{
                                    display: "grid",
                                    gap: 14,
                                    opacity: puedePagos ? 1 : 0.55,
                                    pointerEvents: puedePagos ? "auto" : "none",
                                    filter: puedePagos
                                        ? "none"
                                        : "grayscale(.18)",
                                }}
                            >
                                <MercadoPagoConexion
                                    key={`mp-${puedePagos ? "editable" : "readonly"}`}
                                    baseUrl={api}
                                    employeeMode
                                    allowPersonalAccount={puedePagos}
                                    logoMP={iconos.logoMercadoPago}
                                    logoTransferencia={iconos.logoTransferencia}
                                    logoEfectivo={iconos.logoEfectivo}
                                    mpClientId={props.mpClientId}
                                />
                                <ConfigPagos
                                    key={`pagos-${puedePagos ? "editable" : "readonly"}`}
                                    baseUrl={api}
                                    accentColor={accentColor}
                                    employeeMode
                                    mpClientId={props.mpClientId}
                                />
                            </div>
                        </div>
                    ) : (
                        <section style={{ display: "grid", gap: 10 }}>
                            {(data?.clientes || []).length ? (
                                data.clientes.map((c: any, i: number) => (
                                    <article
                                        key={`${c.telefono || c.email || c.nombre}-${i}`}
                                        style={{
                                            ...card,
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700 }}>
                                                {c.nombre}
                                            </div>
                                            <div
                                                style={{
                                                    color: "#64748b",
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                }}
                                            >
                                                {[c.telefono, c.email]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                color: "#8491a3",
                                                fontSize: 11,
                                                textAlign: "right",
                                            }}
                                        >
                                            {c.cantidadTurnos}{" "}
                                            {c.cantidadTurnos === 1
                                                ? "turno"
                                                : "turnos"}
                                            <br />
                                            Último:{" "}
                                            {formatoFecha(c.ultimoTurno)}
                                        </div>
                                    </article>
                                ))
                            ) : (
                                <div
                                    style={{
                                        ...card,
                                        color: "#8491a3",
                                        textAlign: "center",
                                        padding: 32,
                                    }}
                                >
                                    Todavía no tenés clientes registrados.
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </main>
            <AnimatePresence>
                {manualAbierto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() =>
                            !manualGuardando && setManualAbierto(false)
                        }
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 115,
                            background: "rgba(15,23,42,.48)",
                            display: "flex",
                            alignItems: isMobile ? "flex-end" : "center",
                            justifyContent: "center",
                            padding: isMobile ? 0 : 24,
                            boxSizing: "border-box",
                        }}
                    >
                        <motion.section
                            initial={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.96, y: 12 }
                            }
                            animate={
                                isMobile
                                    ? { y: 0 }
                                    : { opacity: 1, scale: 1, y: 0 }
                            }
                            exit={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.96, y: 12 }
                            }
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: isMobile ? "100%" : "min(460px, 100%)",
                                maxHeight: isMobile ? "86svh" : "85vh",
                                overflowY: "auto",
                                background: "#fff",
                                borderRadius: isMobile ? "24px 24px 0 0" : 22,
                                padding: 22,
                                boxSizing: "border-box",
                                boxShadow: "0 24px 64px rgba(15,23,42,.24)",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 21,
                                    fontWeight: 750,
                                    color: "#172033",
                                }}
                            >
                                Agregar turno
                            </div>
                            <div
                                style={{
                                    color: "#8491a3",
                                    fontSize: 13,
                                    margin: "5px 0 18px",
                                }}
                            >
                                Para turnos acordados por fuera de la app. Se
                                asignará a tu agenda.
                            </div>
                            <div style={{ display: "grid", gap: 12 }}>
                                <label style={AgendaPanel_labelStyle}>
                                    Nombre del cliente
                                    <input
                                        autoFocus
                                        maxLength={80}
                                        value={manualNombre}
                                        onChange={(e) =>
                                            setManualNombre(e.target.value)
                                        }
                                        placeholder="Nombre"
                                        style={AgendaPanel_inputStyle}
                                    />
                                </label>
                                {(data?.servicios || []).length > 0 && (
                                    <label style={AgendaPanel_labelStyle}>
                                        Servicio
                                        <select
                                            value={manualServicio}
                                            onChange={(e) =>
                                                setManualServicio(
                                                    e.target.value
                                                )
                                            }
                                            style={AgendaPanel_inputStyle}
                                        >
                                            {(data.servicios || []).map(
                                                (s: any) => (
                                                    <option
                                                        key={s.id}
                                                        value={s.id}
                                                    >
                                                        {s.nombre}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </label>
                                )}
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: 10,
                                    }}
                                >
                                    <label style={AgendaPanel_labelStyle}>
                                        Día
                                        <input
                                            type="date"
                                            min={AgendaPanel_hoyISO()}
                                            value={manualFecha}
                                            onChange={(e) =>
                                                setManualFecha(e.target.value)
                                            }
                                            style={AgendaPanel_inputStyle}
                                        />
                                    </label>
                                    <label style={AgendaPanel_labelStyle}>
                                        Hora
                                        <input
                                            type="time"
                                            value={manualHora}
                                            onChange={(e) =>
                                                setManualHora(e.target.value)
                                            }
                                            style={AgendaPanel_inputStyle}
                                        />
                                    </label>
                                </div>
                            </div>
                            {manualError && (
                                <div
                                    style={{
                                        color: "#b91c1c",
                                        background: "#fef2f2",
                                        borderRadius: 10,
                                        padding: 10,
                                        fontSize: 12,
                                        marginTop: 12,
                                    }}
                                >
                                    {manualError}
                                </div>
                            )}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    gap: 8,
                                    marginTop: 18,
                                }}
                            >
                                <button
                                    type="button"
                                    disabled={manualGuardando}
                                    onClick={() => setManualAbierto(false)}
                                    style={{
                                        border: "1px solid #e2e8f0",
                                        borderRadius: 10,
                                        padding: "10px 14px",
                                        background: "#fff",
                                        color: "#475569",
                                        fontWeight: 650,
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={manualGuardando}
                                    onClick={() => crearTurnoManualEmpleado()}
                                    style={{
                                        border: 0,
                                        borderRadius: 10,
                                        padding: "10px 16px",
                                        background: accentColor,
                                        color: "#fff",
                                        fontWeight: 700,
                                        cursor: manualGuardando
                                            ? "wait"
                                            : "pointer",
                                        opacity: manualGuardando ? 0.7 : 1,
                                    }}
                                >
                                    {manualGuardando
                                        ? "Guardando…"
                                        : "Guardar turno"}
                                </button>
                            </div>
                        </motion.section>
                    </motion.div>
                )}
                {turnoDetalle && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setTurnoDetalle(null)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 120,
                            background: "rgba(15,23,42,.48)",
                            display: "flex",
                            alignItems: isMobile ? "flex-end" : "center",
                            justifyContent: "center",
                            padding: isMobile ? 0 : 24,
                            boxSizing: "border-box",
                        }}
                    >
                        <motion.section
                            initial={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.96, y: 12 }
                            }
                            animate={
                                isMobile
                                    ? { y: 0 }
                                    : { opacity: 1, scale: 1, y: 0 }
                            }
                            exit={
                                isMobile
                                    ? { y: "100%" }
                                    : { opacity: 0, scale: 0.96, y: 12 }
                            }
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: isMobile ? "100%" : "min(520px, 100%)",
                                maxHeight: isMobile ? "84svh" : "85vh",
                                overflowY: "auto",
                                background: "#fff",
                                borderRadius: isMobile ? "24px 24px 0 0" : 22,
                                padding: 22,
                                boxSizing: "border-box",
                                boxShadow: "0 24px 64px rgba(15,23,42,.24)",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    marginBottom: 18,
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            color: "#64748b",
                                            fontSize: 12,
                                        }}
                                    >
                                        Detalle del turno
                                    </div>
                                    <h2
                                        style={{
                                            margin: "4px 0 0",
                                            fontSize: 22,
                                            color: "#172033",
                                        }}
                                    >
                                        {turnoDetalle.cliente}
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    aria-label="Cerrar detalle"
                                    onClick={() => setTurnoDetalle(null)}
                                    style={{
                                        width: 34,
                                        height: 34,
                                        border: 0,
                                        borderRadius: "50%",
                                        background: "#f1f5f9",
                                        color: "#475569",
                                        cursor: "pointer",
                                        fontSize: 20,
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gap: 0,
                                    border: "1px solid #e8edf2",
                                    borderRadius: 14,
                                    overflow: "hidden",
                                }}
                            >
                                {(!turnoDetalle.telefono && !turnoDetalle.email
                                    ? [
                                          [
                                              "Fecha",
                                              formatoFecha(turnoDetalle.fecha),
                                          ],
                                          [
                                              "Servicio",
                                              turnoDetalle.servicio ||
                                                  "Sin servicio",
                                          ],
                                      ]
                                    : [
                                          [
                                              "Fecha y hora",
                                              `${formatoFecha(turnoDetalle.fecha)} · ${turnoDetalle.hora || "—"}`,
                                          ],
                                          [
                                              "Servicio",
                                              turnoDetalle.servicio || "—",
                                          ],
                                          [
                                              "Estado",
                                              turnoDetalle.estado || "—",
                                          ],
                                          [
                                              "Teléfono",
                                              turnoDetalle.telefono ||
                                                  "No informado",
                                          ],
                                          [
                                              "Email",
                                              turnoDetalle.email ||
                                                  "No informado",
                                          ],
                                          [
                                              "Método de pago",
                                              turnoDetalle.metodo_pago ||
                                                  "No especificado",
                                          ],
                                          [
                                              "Estado del pago",
                                              turnoDetalle.pago_estado ||
                                                  "Sin pago",
                                          ],
                                          [
                                              "Importe",
                                              new Intl.NumberFormat("es-AR", {
                                                  style: "currency",
                                                  currency: "ARS",
                                                  maximumFractionDigits: 0,
                                              }).format(
                                                  Number(
                                                      turnoDetalle.precio_cobrado ||
                                                          0
                                                  )
                                              ),
                                          ],
                                          [
                                              "Notas",
                                              turnoDetalle.notas || "Sin notas",
                                          ],
                                      ]
                                ).map(([label, value], i) => (
                                    <div
                                        key={label}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                                "minmax(110px,.7fr) 1.3fr",
                                            gap: 12,
                                            padding: "11px 13px",
                                            borderTop: i
                                                ? "1px solid #eef1f5"
                                                : "none",
                                            fontSize: 13,
                                        }}
                                    >
                                        <span style={{ color: "#8491a3" }}>
                                            {label}
                                        </span>
                                        <span
                                            style={{
                                                color: "#334155",
                                                fontWeight: 600,
                                                overflowWrap: "anywhere",
                                            }}
                                        >
                                            {value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {turnoDetalle.telefono &&
                                turnoDetalle.tipo_cobro === "sena" && (
                                    <div
                                        style={{
                                            ...card,
                                            marginTop: 12,
                                            padding: 13,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontWeight: 700,
                                                fontSize: 13,
                                                marginBottom: 8,
                                            }}
                                        >
                                            Seña y saldo
                                        </div>
                                        <div
                                            style={{ display: "grid", gap: 6 }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 10,
                                                    fontSize: 12,
                                                }}
                                            >
                                                <span
                                                    style={{ color: "#64748b" }}
                                                >
                                                    Seña{" "}
                                                    {Number(
                                                        turnoDetalle.porcentaje_sena ||
                                                            30
                                                    )}
                                                    %
                                                </span>
                                                <strong>
                                                    {TurnitsDashboard_money(
                                                        Number(
                                                            turnoDetalle.monto_pagado ||
                                                                Math.round(
                                                                    (Number(
                                                                        turnoDetalle.precio_cobrado ||
                                                                            0
                                                                    ) *
                                                                        Number(
                                                                            turnoDetalle.porcentaje_sena ||
                                                                                30
                                                                        )) /
                                                                        100
                                                                )
                                                        )
                                                    )}
                                                </strong>
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent:
                                                        "space-between",
                                                    gap: 10,
                                                    fontSize: 12,
                                                }}
                                            >
                                                <span
                                                    style={{ color: "#64748b" }}
                                                >
                                                    Falta abonar
                                                </span>
                                                <strong>
                                                    {TurnitsDashboard_money(
                                                        Math.max(
                                                            Number(
                                                                turnoDetalle.precio_cobrado ||
                                                                    0
                                                            ) -
                                                                Number(
                                                                    turnoDetalle.monto_pagado ||
                                                                        Math.round(
                                                                            (Number(
                                                                                turnoDetalle.precio_cobrado ||
                                                                                    0
                                                                            ) *
                                                                                Number(
                                                                                    turnoDetalle.porcentaje_sena ||
                                                                                        30
                                                                                )) /
                                                                                100
                                                                        )
                                                                ),
                                                            0
                                                        )
                                                    )}
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            {turnoDetalle.telefono &&
                                turnoDetalle.metodo_pago ===
                                    "transferencia" && (
                                    <div
                                        style={{
                                            ...card,
                                            marginTop: 12,
                                            padding: 13,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontWeight: 700,
                                                fontSize: 13,
                                                marginBottom: 8,
                                            }}
                                        >
                                            Comprobante de transferencia
                                        </div>
                                        {comprobanteEmpleado.loading ? (
                                            <div
                                                style={{
                                                    color: "#8491a3",
                                                    fontSize: 12,
                                                }}
                                            >
                                                Cargando comprobante…
                                            </div>
                                        ) : comprobanteEmpleado.error ? (
                                            <div
                                                style={{
                                                    color: "#b91c1c",
                                                    fontSize: 12,
                                                }}
                                            >
                                                {comprobanteEmpleado.error}
                                            </div>
                                        ) : comprobanteEmpleado.url ? (
                                            <a
                                                href={comprobanteEmpleado.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: accentColor,
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Abrir comprobante
                                            </a>
                                        ) : (
                                            <div
                                                style={{
                                                    color: "#8491a3",
                                                    fontSize: 12,
                                                }}
                                            >
                                                {turnoDetalle.tiene_comprobante
                                                    ? "No se pudo mostrar el comprobante."
                                                    : "No hay comprobante adjunto."}
                                            </div>
                                        )}
                                    </div>
                                )}
                            {(turnoDetalle.telefono || turnoDetalle.email) &&
                                Array.isArray(turnoDetalle.extras) &&
                                turnoDetalle.extras.length > 0 && (
                                    <div style={{ marginTop: 14, ...card }}>
                                        <div
                                            style={{
                                                color: "#64748b",
                                                fontSize: 12,
                                                marginBottom: 8,
                                            }}
                                        >
                                            Extras
                                        </div>
                                        {turnoDetalle.extras.map(
                                            (extra: any, i: number) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        fontSize: 13,
                                                        color: "#334155",
                                                        padding: "3px 0",
                                                    }}
                                                >
                                                    {typeof extra === "string"
                                                        ? extra
                                                        : extra.nombre ||
                                                          extra.name ||
                                                          "Extra"}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            {turnoDetalle.telefono &&
                                turnoDetalle.estado === "pendiente" &&
                                ["transferencia", "efectivo"].includes(
                                    turnoDetalle.metodo_pago
                                ) && (
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr",
                                            gap: 9,
                                            marginTop: 16,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            disabled={aprobandoTurno}
                                            onClick={() =>
                                                rechazarTurnoEmpleado(
                                                    turnoDetalle
                                                )
                                            }
                                            style={{
                                                border: "1px solid #fecaca",
                                                borderRadius: 12,
                                                padding: "12px 10px",
                                                background: "#fff7f7",
                                                color: "#b91c1c",
                                                fontWeight: 700,
                                                fontSize: 13,
                                                cursor: aprobandoTurno
                                                    ? "wait"
                                                    : "pointer",
                                            }}
                                        >
                                            Rechazar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={aprobandoTurno}
                                            onClick={() =>
                                                aprobarTurnoEmpleado(
                                                    turnoDetalle
                                                )
                                            }
                                            style={{
                                                border: 0,
                                                borderRadius: 12,
                                                padding: "12px 10px",
                                                background: accentColor,
                                                color: "#fff",
                                                fontWeight: 750,
                                                fontSize: 13,
                                                cursor: aprobandoTurno
                                                    ? "wait"
                                                    : "pointer",
                                                opacity: aprobandoTurno
                                                    ? 0.65
                                                    : 1,
                                            }}
                                        >
                                            {aprobandoTurno
                                                ? "Procesando…"
                                                : "Aprobar turno"}
                                        </button>
                                    </div>
                                )}
                        </motion.section>
                    </motion.div>
                )}
            </AnimatePresence>
            {isMobile && (
                <>
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
                                background: "#fff",
                                borderRadius: 30,
                                padding: "8px 12px",
                                boxShadow:
                                    "0 10px 30px rgba(15,23,42,.18),0 2px 10px rgba(15,23,42,.08)",
                                border: "1px solid #eef1f6",
                            }}
                        >
                            <BottomNavIcon
                                id="inicio"
                                active={tab === "inicio"}
                                accentColor={accentColor}
                                onClick={() => navegarA("inicio")}
                                navIconos={navIconos}
                            />
                            <BottomNavIcon
                                id="servicios"
                                active={tab === "servicios"}
                                accentColor={accentColor}
                                onClick={() => navegarA("servicios")}
                                navIconos={navIconos}
                            />
                            <BottomNavIcon
                                id="agenda"
                                active={tab === "agenda"}
                                accentColor={accentColor}
                                onClick={() => navegarA("agenda")}
                                navIconos={navIconos}
                            />
                            <BottomNavMore
                                onClick={() => setMenuMobileAbierto(true)}
                            />
                        </div>
                    </div>
                    <AnimatePresence>
                        {menuMobileAbierto && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setMenuMobileAbierto(false)}
                                style={{
                                    position: "fixed",
                                    inset: 0,
                                    zIndex: 100,
                                    background: "rgba(15,23,42,.45)",
                                    display: "flex",
                                    alignItems: "flex-end",
                                }}
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
                                            width: "100%",
                                            maxHeight: "78svh",
                                            overflowY: "auto",
                                            position: "relative",
                                            background:
                                                "linear-gradient(180deg,#fbfcff 0%,#f6f7fb 100%)",
                                            borderTopLeftRadius: 24,
                                            borderTopRightRadius: 24,
                                            padding:
                                                "10px 18px calc(28px + env(safe-area-inset-bottom,0px))",
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
                                            logoImage={props.logoImage}
                                            logoText={
                                                props.logoText || "turnits"
                                            }
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
                                        {items.map((item) => (
                                            <NavButton
                                                key={item.id}
                                                item={item}
                                                active={tab === item.id}
                                                accentColor={accentColor}
                                                onClick={() => {
                                                    navegarA(item.id as any)
                                                    setMenuMobileAbierto(false)
                                                }}
                                                navIconos={navIconos}
                                            />
                                        ))}
                                    </div>
                                    <FooterEmpleado mobile />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
            <NotificacionesFlotantes
                baseUrl={api}
                accentColor={accentColor}
                isMobile={isMobile}
                abierto={mostrarNotificaciones}
                onToggle={() => setMostrarNotificaciones((v) => !v)}
                onClose={() => setMostrarNotificaciones(false)}
                iconosNotif={iconosNotificaciones}
                employeeMode
                qrSlot={
                    isMobile ? (
                        <QrFlotante
                            baseUrl={api}
                            accentColor={accentColor}
                            isMobile={isMobile}
                            inline
                            iconoPagosActivos={imagenSrc(
                                props.iconoPagosActivos
                            )}
                            iconoAgendaSinPagos={imagenSrc(
                                props.iconoAgendaSinPagos
                            )}
                        />
                    ) : null
                }
                onNavigate={(section) => {
                    if (
                        [
                            "inicio",
                            "servicios",
                            "agenda",
                            "horarios",
                            "pagos",
                        ].includes(section)
                    )
                        navegarA(section as any)
                    setMostrarNotificaciones(false)
                }}
            />
            {!isMobile && (
                <QrFlotante
                    baseUrl={api}
                    accentColor={accentColor}
                    isMobile={false}
                    iconoPagosActivos={imagenSrc(props.iconoPagosActivos)}
                    iconoAgendaSinPagos={imagenSrc(props.iconoAgendaSinPagos)}
                />
            )}
        </div>
    )
}

export { TurnitsEmpleadoPanel }
