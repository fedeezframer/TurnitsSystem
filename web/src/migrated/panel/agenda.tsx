import { appConfig } from "../../config"
import { useBranchAdmin } from "../../components/BranchAdmin"
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
import './perfil.css'
import { AgendaPanel_useContainerWidth, AgendaPanel_getSlug, AgendaPanel_getToken, AgendaPanel_filtrarPasados, AgendaPanel_esPendienteAprobacion, AgendaPanel_hoyISO, AgendaPanel_cleanTel, AgendaPanel_formatFecha, AgendaPanel_wrapperBase, AgendaPanel_mockDias, AgendaPanel_globalCSS, AgendaPanel_FONT_BODY, AgendaPanel_SURFACE, AgendaPanel_HAIRLINE, AgendaPanel_INK, AgendaPanel_FONT_DISPLAY, AgendaPanel_SLATE, AgendaPanel_tieneExtras, AgendaPanel_GHOST, AgendaPanel_extrasLabel, AgendaPanel_metodoPagoLabel, AgendaPanel_formatMonto, AgendaPanel_estadoPagoLabel, AgendaPanel_labelStyle, AgendaPanel_inputStyle, AgendaPanel_tieneReprogramacionPendiente, AgendaPanel_faltaProfesional, AgendaPanel_formatFechaParts } from "./common"

function AgendaPanel(props: any) {
    const branchAdmin = useBranchAdmin()
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        colorPendiente = "#F59E0B",
        colorReprogramacion = "#3B82F6",
        colorSinProfesional = "#8B5CF6",
        iconoReprogramacion,
        columnasDias = 2,
        style,
    } = props

    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = AgendaPanel_useContainerWidth(containerRef)

    // Breakpoints basados en el contenedor, no en window
    const isMobile = containerWidth < 480
    const isTablet = containerWidth >= 480 && containerWidth < 700

    // En mobile mostramos todo en columna (Hoy arriba, días abajo)
    // En tablet/desktop mantenemos layout horizontal
    const colsDias = isMobile
        ? 1
        : isTablet
          ? Math.min(columnasDias, 2)
          : columnasDias
    const hoyWidth = isMobile ? "100%" : isTablet ? 160 : 180

    const [dias, setDias] = React.useState<any[]>([])
    const [sucursales,setSucursales]=React.useState<any[]>([])
    const [sucursalFiltro,setSucursalFiltro]=React.useState('todas')
    const [principalNombre,setPrincipalNombre]=React.useState('Sede principal')
    React.useEffect(()=>{if(branchAdmin)return;let alive=true;const slug=AgendaPanel_getSlug(),token=AgendaPanel_getToken();if(slug && token)fetch(`${baseUrl.replace(/\/+$/,'')}/admin/sucursales/${slug}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(alive && d?.premium && d?.habilitado){setSucursales(d.sucursales || []);setPrincipalNombre(d.principal?.nombre || 'Sede principal')}}).catch(()=>{});return()=>{alive=false}},[baseUrl,branchAdmin]);
    const agendaRequestId = React.useRef(0)
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [modal, setModal] = React.useState<any>(null)
    const [cancelando, setCancelando] = React.useState(false)
    const [cancelOk, setCancelOk] = React.useState(false)
    const [cancelError, setCancelError] = React.useState("")

    // ─── NUEVO: alta manual de turnos (los que se acuerdan por fuera
    // de la app: WhatsApp, en persona, teléfono). Solo nombre, día,
    // hora y servicio. Pega contra POST /admin/turnos/manual.
    const [servicios, setServicios] = React.useState<any[]>([])

    // ─── NUEVO: equipo del negocio, para poder asignar/reasignar el
    // profesional de un turno directo desde el modal de la agenda
    // (por ejemplo, turnos donde el cliente eligió "Cualquiera" al
    // reservar y quedaron sin profesional asignado). Solo tiene
    // sentido mostrar el selector si hay más de un integrante.
    const [equipo, setEquipo] = React.useState<any[]>([])
    const [asignandoProfesional, setAsignandoProfesional] =
        React.useState(false)
    const [asignarProfesionalError, setAsignarProfesionalError] =
        React.useState("")
    // Se usa tanto para el selector del modal como para resaltar, en
    // las cards de la agenda, los turnos ya aprobados sin profesional.
    // No aplica si el negocio tiene un solo integrante.
    const resaltarSinProfesional = equipo.length > 1

    const [nuevo, setNuevo] = React.useState<any>(null)
    const [nuevoGuardando, setNuevoGuardando] = React.useState(false)
    const [nuevoError, setNuevoError] = React.useState("")
    const [nuevoConflicto, setNuevoConflicto] = React.useState(false)
    const [nuevoOk, setNuevoOk] = React.useState(false)
    const nuevoGuardandoRef = React.useRef(false)

    // ─── estado de comprobante + aprobación de pago manual ─────
    const [comprobante, setComprobante] = React.useState<{
        url: string
        loading: boolean
        error: string
    }>({ url: "", loading: false, error: "" })
    const [aprobando, setAprobando] = React.useState(false)
    const [aprobarOk, setAprobarOk] = React.useState(false)
    const [aprobarError, setAprobarError] = React.useState("")

    // ─── NUEVO: estado de aprobación/rechazo de REPROGRAMACIÓN ──
    // (distinto del bloque de arriba: esto resuelve la solicitud
    // de cambio de fecha/hora, no el pago del turno)
    const [reprogramando, setReprogramando] = React.useState(false)
    const [reprogramandoAccion, setReprogramandoAccion] = React.useState("")
    const [reprogramarOk, setReprogramarOk] = React.useState<
        "" | "aprobada" | "rechazada"
    >("")
    const [reprogramarError, setReprogramarError] = React.useState("")
    // NUEVO: guard sincrónico contra doble clic/doble submit. El estado
    // `reprogramando` de arriba solo se refleja en el DOM después de un
    // re-render, así que un doble clic muy rápido podía disparar la
    // función dos veces: la primera resolvía la solicitud, la segunda
    // pegaba contra un id que ya no estaba "pendiente" → el backend
    // respondía "Solicitud no encontrada o ya resuelta." Un ref se lee
    // y escribe al toque, sin esperar al render, así que corta el
    // segundo intento antes de que llegue a hacer fetch.
    const reprogramandoRef = React.useRef(false)
    const aprobandoRef = React.useRef(false)
    const cancelandoRef = React.useRef(false)

    const fetchAgenda = React.useCallback(async () => {
        const requestId = ++agendaRequestId.current
        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        if (!slug || !token) {
            setError("Sin sesión.")
            setLoading(false)
            return
        }
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const res = await fetch(`${api}/agenda/${slug}`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            })
            if (res.status === 401) {
                if (requestId === agendaRequestId.current) {
                    setError("Sesión expirada.")
                    setLoading(false)
                }
                return
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            if (data.success && requestId === agendaRequestId.current) {
                setDias(AgendaPanel_filtrarPasados(data.dias || []))
                setError("")
            }
        } catch {
            if (requestId === agendaRequestId.current)
                setError("Error de conexión.")
        } finally {
            if (requestId === agendaRequestId.current) setLoading(false)
        }
    }, [baseUrl])

    React.useEffect(() => {
        if (false) {
            setLoading(false)
            return
        }
        let retries = 0
        const tryInit = () => {
            if (AgendaPanel_getSlug() && AgendaPanel_getToken()) {
                fetchAgenda()
                return
            }
            if (++retries >= 10) {
                setError("Sin sesión.")
                setLoading(false)
                return
            }
            setTimeout(tryInit, 300)
        }
        tryInit()
    }, [fetchAgenda])

    // ─── Equipo del negocio (para el selector de "asignar profesional"
    // en el modal). No es crítico para ver la agenda, así que un error
    // acá no bloquea nada: el selector simplemente no aparece.
    React.useEffect(() => {
        if (false) return
        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        if (!slug || !token) return
        const api = baseUrl.replace(/\/+$/, "")
        fetch(`${api}/admin/equipo/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-cache",
        })
            .then((r) => r.json())
            .then((data) => {
                const lista = (data?.equipo || []).filter(
                    (m: any) => m.activo !== false
                )
                setEquipo(lista)
            })
            .catch(() => {})
    }, [baseUrl])

    React.useEffect(() => {
        if (false) return
        const refrescar = () => {
            if (document.visibilityState !== "hidden") fetchAgenda()
        }
        const intervalo = setInterval(refrescar, 20_000)
        window.addEventListener("focus", refrescar)
        window.addEventListener("pageshow", refrescar)
        window.addEventListener("turno_actualizado", refrescar)
        document.addEventListener("visibilitychange", refrescar)
        const filtrarPasados = setInterval(
            () => setDias((prev) => AgendaPanel_filtrarPasados(prev)),
            60_000
        )
        return () => {
            clearInterval(intervalo)
            clearInterval(filtrarPasados)
            window.removeEventListener("focus", refrescar)
            window.removeEventListener("pageshow", refrescar)
            window.removeEventListener("turno_actualizado", refrescar)
            document.removeEventListener("visibilitychange", refrescar)
        }
    }, [fetchAgenda])

    // ─── Cuando se abre el modal de un turno pendiente por
    // transferencia, pedimos la signed URL del comprobante. Nunca
    // se guarda/expone como URL pública (ver backend). Aprovechamos
    // este mismo efecto (se dispara al abrir/cerrar cualquier modal)
    // para resetear también el estado de reprogramación.
    React.useEffect(() => {
        setAprobarOk(false)
        setAprobarError("")
        setComprobante({ url: "", loading: false, error: "" })
        setReprogramarOk("")
        setReprogramarError("")
        setAsignarProfesionalError("")

        if (!modal) return
        if (false) return

        const pendiente = AgendaPanel_esPendienteAprobacion(modal.turno)
        if (!pendiente || modal.turno.metodo_pago !== "transferencia") return

        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        const api = baseUrl.replace(/\/+$/, "")

        setComprobante({ url: "", loading: true, error: "" })
        fetch(
            `${api}/admin/turnos/${modal.turno.id}/comprobante?slug=${encodeURIComponent(slug)}`,
            { headers: { Authorization: `Bearer ${token}` } }
        )
            .then((r) => r.json())
            .then((data) => {
                if (data.success && data.url) {
                    setComprobante({ url: data.url, loading: false, error: "" })
                } else {
                    setComprobante({
                        url: "",
                        loading: false,
                        error:
                            data.error || "No hay comprobante para este turno.",
                    })
                }
            })
            .catch(() => {
                setComprobante({
                    url: "",
                    loading: false,
                    error: "No se pudo cargar el comprobante.",
                })
            })
    }, [modal, baseUrl])

    // ─── Al abrir/cerrar el overlay del turno, avisamos al menú
    // rápido de teléfono (override withMenuSlideOut) mediante el
    // evento "framer-trigger" con detail.event = "agenda-menu" |
    // "agenda-menu-close" — nombre exclusivo para no chocar con el
    // evento "menu" que abre el menú grande en otro lado.
    React.useEffect(() => {
        if (typeof window === "undefined") return
        ;(window as any).__turnitsAgendaModalAbierto = !!(modal || nuevo)
        window.dispatchEvent(
            new CustomEvent("framer-trigger", {
                detail: {
                    event: modal || nuevo ? "agenda-menu" : "agenda-menu-close",
                },
            })
        )
        return () => {
            ;(window as any).__turnitsAgendaModalAbierto = false
        }
    }, [modal, nuevo])

    const handleCancelar = async () => {
        if (!modal) return
        if (false) return
        if (cancelandoRef.current) return
        cancelandoRef.current = true
        setCancelando(true)
        setCancelError("")
        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const res = await fetch(`${api}/turnos/${modal.turno.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ estado: "cancelado", slug }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setCancelOk(true)
                setDias((prev) =>
                    prev
                        .map((d) => ({
                            ...d,
                            turnos: d.turnos.filter(
                                (t: any) => t.id !== modal.turno.id
                            ),
                        }))
                        .filter((d) => d.turnos.length > 0)
                )
                window.dispatchEvent(
                    new CustomEvent("turno_actualizado", {
                        detail: { id: modal.turno.id },
                    })
                )
                setTimeout(() => {
                    setModal(null)
                    setCancelOk(false)
                }, 1400)
            } else {
                setCancelError(data.error || "No se pudo cancelar el turno.")
            }
        } catch {
            setCancelError("Error de conexión.")
        } finally {
            setCancelando(false)
            cancelandoRef.current = false
        }
    }

    // ─── Asignar/reasignar el profesional de un turno (PUT /turnos/:id
    // con equipo_id). Pensado sobre todo para turnos que llegaron sin
    // profesional asignado porque el cliente eligió "Cualquiera" al
    // reservar: el dueño lo puede repartir a mano acá.
    const handleAsignarProfesional = async (equipoIdElegido: string) => {
        if (!modal) return
        if (false) return
        setAsignandoProfesional(true)
        setAsignarProfesionalError("")
        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const res = await fetch(`${api}/turnos/${modal.turno.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ equipo_id: equipoIdElegido, slug }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                const equipoIdNuevo = data.turno?.equipo_id ?? equipoIdElegido
                const equipoNombreNuevo =
                    data.turno?.equipo_nombre ||
                    equipo.find((m: any) => m.id === equipoIdElegido)?.nombre ||
                    ""
                setDias((prev) =>
                    prev.map((d) => ({
                        ...d,
                        turnos: d.turnos.map((t: any) =>
                            t.id === modal.turno.id
                                ? {
                                      ...t,
                                      equipo_id: equipoIdNuevo,
                                      equipo_nombre: equipoNombreNuevo,
                                  }
                                : t
                        ),
                    }))
                )
                window.dispatchEvent(
                    new CustomEvent("turno_actualizado", {
                        detail: { id: modal.turno.id },
                    })
                )
                setModal((prev: any) =>
                    prev
                        ? {
                              ...prev,
                              turno: {
                                  ...prev.turno,
                                  equipo_id: equipoIdNuevo,
                                  equipo_nombre: equipoNombreNuevo,
                              },
                          }
                        : prev
                )
            } else {
                setAsignarProfesionalError(
                    data.error || "No se pudo asignar el profesional."
                )
            }
        } catch {
            setAsignarProfesionalError("Error de conexión.")
        } finally {
            setAsignandoProfesional(false)
        }
    }

    // ─── Aprobar turno pendiente (transferencia/efectivo). El
    // backend (PUT /turnos/:id) ya se encarga de marcar el pago
    // como aprobado y avisar al cliente por mail/WhatsApp si
    // corresponde — acá solo reflejamos el cambio en la UI.
    const handleAprobar = async () => {
        if (!modal) return
        if (false) return
        if (aprobandoRef.current) return
        aprobandoRef.current = true
        setAprobando(true)
        setAprobarError("")
        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const res = await fetch(`${api}/turnos/${modal.turno.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ estado: "confirmado", slug }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setAprobarOk(true)
                setDias((prev) =>
                    prev.map((d) => ({
                        ...d,
                        turnos: d.turnos.map((t: any) =>
                            t.id === modal.turno.id
                                ? {
                                      ...t,
                                      estado: "confirmado",
                                      pago_estado:
                                          data.turno?.pago_estado ??
                                          t.pago_estado,
                                      monto_pagado:
                                          data.turno?.monto_pagado ??
                                          t.monto_pagado,
                                  }
                                : t
                        ),
                    }))
                )
                setModal((prev: any) =>
                    prev
                        ? {
                              ...prev,
                              turno: {
                                  ...prev.turno,
                                  estado: "confirmado",
                                  pago_estado:
                                      data.turno?.pago_estado ?? "aprobado",
                                  monto_pagado:
                                      data.turno?.monto_pagado ??
                                      prev.turno.monto_pagado,
                              },
                          }
                        : prev
                )
                window.dispatchEvent(
                    new CustomEvent("turno_actualizado", {
                        detail: { id: modal.turno.id },
                    })
                )
                fetchAgenda()
                setTimeout(() => {
                    setModal(null)
                    setAprobarOk(false)
                }, 1400)
            } else {
                setAprobarError(data.error || "No se pudo aprobar el turno.")
            }
        } catch {
            setAprobarError("Error de conexión.")
        } finally {
            setAprobando(false)
            aprobandoRef.current = false
        }
    }

    // ─── NUEVO: aprobar o rechazar una solicitud de reprogramación.
    // Pega contra PUT /admin/reprogramaciones/:id (id de la SOLICITUD,
    // no del turno). Si se aprueba, el turno puede cambiar de fecha
    // (y por lo tanto de card en el layout), así que en vez de
    // parchear el estado local a mano, volvemos a pedir toda la
    // agenda — es la forma más simple de no desincronizarnos.
    const handleReprogramacion = async (accion: "aprobar" | "rechazar") => {
        if (!modal?.turno?.reprogramacion_pendiente) return
        if (false) return
        if (reprogramandoRef.current) return
        reprogramandoRef.current = true
        setReprogramando(true)
        setReprogramandoAccion(accion)
        setReprogramarError("")
        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const res = await fetch(
                `${api}/admin/reprogramaciones/${modal.turno.reprogramacion_pendiente.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ slug, accion }),
                }
            )
            const data = await res.json()
            if (res.ok && data.success) {
                setReprogramarOk(
                    accion === "aprobar" ? "aprobada" : "rechazada"
                )
                window.dispatchEvent(
                    new CustomEvent("turno_actualizado", {
                        detail: { id: modal.turno.id },
                    })
                )
                fetchAgenda()
                setTimeout(() => {
                    setModal(null)
                    setReprogramarOk("")
                }, 1400)
            } else {
                setReprogramarError(
                    data.error || "No se pudo procesar la solicitud."
                )
            }
        } catch {
            setReprogramarError("Error de conexión.")
        } finally {
            setReprogramando(false)
            setReprogramandoAccion("")
            reprogramandoRef.current = false
        }
    }

    // ─── NUEVO: alta manual ────────────────────────────────────
    const fetchServicios = React.useCallback(async () => {
        const slug = AgendaPanel_getSlug()
        if (!slug) return
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const res = await fetch(`${api}/${branchAdmin ? "admin/servicios" : "servicios"}/${slug}`, {
                ...(branchAdmin ? {headers:{Authorization:`Bearer ${AgendaPanel_getToken()}`}} : {}),
                cache: "no-cache",
            })
            const data = await res.json()
            if (data.success) setServicios(data.servicios || [])
        } catch {}
    }, [baseUrl,branchAdmin])

    const abrirNuevo = () => {
        setNuevoError("")
        setNuevoConflicto(false)
        setNuevoOk(false)
        setNuevo({
            nombre: "",
            fecha: AgendaPanel_hoyISO(),
            hora: "",
            servicio_id: "",
            equipo_id: branchAdmin?.equipo_id || "",
        })
        fetchServicios()
    }

    const cerrarNuevo = () => {
        setNuevo(null)
        setNuevoError("")
        setNuevoConflicto(false)
        setNuevoOk(false)
    }

    // Al tocar cualquier campo se limpia el aviso de conflicto/error
    const setCampoNuevo = (campo: string, valor: string) => {
        setNuevo((prev: any) => ({ ...prev, [campo]: valor }))
        setNuevoError("")
        setNuevoConflicto(false)
    }

    const handleCrearManual = async (forzar = false) => {
        if (!nuevo) return
        if (false) return
        if (nuevoGuardandoRef.current) return

        if (nuevo.nombre.trim().length < 2) {
            setNuevoError("Ingresá el nombre del cliente.")
            return
        }
        if (!nuevo.fecha) {
            setNuevoError("Elegí el día.")
            return
        }
        if (!nuevo.hora) {
            setNuevoError("Elegí la hora.")
            return
        }
        if (servicios.length > 0 && !nuevo.servicio_id) {
            setNuevoError("Elegí un servicio.")
            return
        }

        nuevoGuardandoRef.current = true
        setNuevoGuardando(true)
        setNuevoError("")
        const slug = AgendaPanel_getSlug()
        const token = AgendaPanel_getToken()
        const api = baseUrl.replace(/\/+$/, "")
        try {
            const res = await fetch(`${api}/admin/turnos/manual`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug,
                    nombre: nuevo.nombre.trim(),
                    fecha: nuevo.fecha,
                    hora: nuevo.hora,
                    servicio_id: nuevo.servicio_id || null,
                    equipo_id: nuevo.equipo_id || null,
                    forzar,
                }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setNuevoOk(true)
                fetchAgenda()
                window.dispatchEvent(
                    new CustomEvent("turno_actualizado", {
                        detail: { id: data.turno_id },
                    })
                )
                setTimeout(() => {
                    setNuevo(null)
                    setNuevoOk(false)
                }, 1200)
            } else if (res.status === 409 && data.conflicto) {
                setNuevoConflicto(true)
                setNuevoError(data.error || "Ya hay un turno en ese horario.")
            } else {
                setNuevoError(data.error || "No se pudo agendar el turno.")
            }
        } catch {
            setNuevoError("Error de conexión.")
        } finally {
            setNuevoGuardando(false)
            nuevoGuardandoRef.current = false
        }
    }

    const handleWhatsApp = () => {
        if (!modal || !modal.turno.telefono) return
        const tel = AgendaPanel_cleanTel(modal.turno.telefono)
        const fecha = AgendaPanel_formatFecha(modal.fecha)
        const msg = encodeURIComponent(
            `Hola ${modal.turno.nombre}! Te recuerdo tu turno el ${fecha} a las ${modal.turno.hora}hs. ¡Te esperamos!`
        )
        window.open(`https://wa.me/54${tel}?text=${msg}`, "_blank")
    }

    if (false) {
        return (
            <div
                ref={containerRef}
                style={{ ...AgendaPanel_wrapperBase, ...style }}
            >
                <AgendaPanel_Layout
                    dias={AgendaPanel_mockDias()}
                    colsDias={colsDias}
                    hoyWidth={hoyWidth}
                    accentColor={accentColor}
                    colorPendiente={colorPendiente}
                    colorReprogramacion={colorReprogramacion}
                    colorSinProfesional={colorSinProfesional}
                    resaltarSinProfesional={resaltarSinProfesional}
                    isMobile={isMobile}
                    isTablet={isTablet}
                    onTurnoClick={() => {}}
                />
                <style>{AgendaPanel_globalCSS}</style>
            </div>
        )
    }

    if (loading)
        return (
            <div
                ref={containerRef}
                style={{ ...AgendaPanel_wrapperBase, ...style }}
            >
                <AgendaPanel_SkeletonAgenda
                    accentColor={accentColor}
                    colsDias={colsDias}
                    isMobile={isMobile}
                />
                <style>{AgendaPanel_globalCSS}</style>
            </div>
        )

    if (error)
        return (
            <div
                ref={containerRef}
                style={{
                    ...AgendaPanel_wrapperBase,
                    ...style,
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <div
                        style={{ fontSize: 26, marginBottom: 8, opacity: 0.5 }}
                    ></div>
                    <span
                        style={{
                            fontSize: 13,
                            color: "#ef4444",
                            fontFamily: AgendaPanel_FONT_BODY,
                        }}
                    >
                        {error}
                    </span>
                </div>
                <style>{AgendaPanel_globalCSS}</style>
            </div>
        )

    const modalPendiente = modal
        ? AgendaPanel_esPendienteAprobacion(modal.turno)
        : false
    const modalReprogramacion = modal
        ? modal.turno.reprogramacion_pendiente
        : null

    const modalEquipoNombre = modal?.turno?.equipo_nombre || ""
    // El selector de "asignar profesional" solo se muestra para turnos
    // que llegaron SIN profesional asignado (el cliente eligió
    // "Cualquiera" al reservar) y el negocio tiene más de un
    // integrante entre quienes elegir. Un turno donde el cliente ya
    // eligió un profesional puntual no se puede reasignar desde acá.
    const mostrarAsignarProfesional =
        modal && resaltarSinProfesional && !modal.turno.equipo_id

    // Turno cargado a mano: no tiene teléfono ni email (las reservas
    // por la app siempre traen teléfono).
    const modalManual = !!modal && !modal.turno.telefono && !modal.turno.email

    return (
        <>
            {sucursales.length>0 && <div className="negocio-editor" style={{marginBottom:14}}><label className="negocio-field" style={{maxWidth:320}}>Sucursal<select aria-label="Sucursal" value={sucursalFiltro} onChange={e=>setSucursalFiltro(e.target.value)}><option value="todas">Todas las sucursales</option><option value="principal">{principalNombre}</option>{sucursales.map(s=><option key={s.id} value={s.id}>{s.nombre}{!s.activo?' · Pausada':''}</option>)}</select></label></div>}
            <div
                ref={containerRef}
                style={{ ...AgendaPanel_wrapperBase, ...style }}
            >
                <AgendaPanel_Layout
                    dias={sucursalFiltro==='todas'?dias:dias.map(d=>({...d,turnos:d.turnos.filter((t:any)=>(t.sucursal_id || 'principal')===sucursalFiltro)})).filter(d=>d.turnos.length)}
                    colsDias={colsDias}
                    hoyWidth={hoyWidth}
                    accentColor={accentColor}
                    colorPendiente={colorPendiente}
                    colorReprogramacion={colorReprogramacion}
                    colorSinProfesional={colorSinProfesional}
                    resaltarSinProfesional={resaltarSinProfesional}
                    isMobile={isMobile}
                    isTablet={isTablet}
                    onNuevoTurno={abrirNuevo}
                    onTurnoClick={(turno: any, fecha: string) => {
                        setCancelOk(false)
                        setCancelError("")
                        setModal({ turno, fecha })
                    }}
                />
                <style>{AgendaPanel_globalCSS}</style>
            </div>

            {/* MODAL */}
            <AnimatePresence>
                {modal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            setModal(null)
                            setCancelOk(false)
                            setCancelError("")
                            setAprobarOk(false)
                            setAprobarError("")
                            setReprogramarOk("")
                            setReprogramarError("")
                        }}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(18,19,26,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 9999,
                            backdropFilter: "blur(3px)",
                            padding: isMobile ? "16px" : 0,
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 10 }}
                            transition={{
                                type: "spring",
                                stiffness: 320,
                                damping: 26,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: AgendaPanel_SURFACE,
                                borderRadius: 22,
                                padding: isMobile
                                    ? "24px 20px 20px"
                                    : "28px 26px 24px",
                                width: isMobile ? "100%" : 340,
                                maxWidth: 360,
                                // PC: 100vh andaba perfecto, se deja fijo.
                                // Mobile: "svh" (small viewport height) en vez
                                // de "dvh" — no se recalcula cuando la barra
                                // de direcciones aparece/desaparece durante el
                                // scroll, así no hay saltos de layout.
                                maxHeight: isMobile ? "88svh" : "86vh",
                                overflowY: "auto",
                                boxShadow: "0 18px 50px rgba(18,19,26,0.14)",
                                border: `1px solid ${AgendaPanel_HAIRLINE}`,
                                fontFamily: AgendaPanel_FONT_BODY,
                            }}
                        >
                            {modalManual ? (
                                <div style={{ display: "grid", gap: 13 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: accentColor,
                                                fontWeight: 750,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                            }}
                                        >
                                            Turno manual
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setModal(null)}
                                            aria-label="Cerrar"
                                            style={{
                                                border: 0,
                                                background: "#f1f5f9",
                                                borderRadius: "50%",
                                                width: 30,
                                                height: 30,
                                                cursor: "pointer",
                                                color: "#64748b",
                                                fontSize: 18,
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 21,
                                            fontWeight: 750,
                                            color: AgendaPanel_INK,
                                        }}
                                    >
                                        {modal.turno.nombre}
                                        {modal.turno.apellido
                                            ? ` ${modal.turno.apellido}`
                                            : ""}
                                    </div>
                                    <AgendaPanel_InfoRow
                                        label="Fecha"
                                        value={AgendaPanel_formatFecha(
                                            modal.fecha
                                        )}
                                    />
                                    <AgendaPanel_InfoRow
                                        label="Servicio"
                                        value={
                                            modal.turno.servicio ||
                                            "Sin servicio"
                                        }
                                    />
                                </div>
                            ) : (
                                <>
                                    <div style={{ marginBottom: 16 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: 8,
                                                marginBottom: 8,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: accentColor,
                                                    fontWeight: 700,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.08em",
                                                    fontFamily:
                                                        AgendaPanel_FONT_DISPLAY,
                                                }}
                                            >
                                                {AgendaPanel_formatFecha(
                                                    modal.fecha
                                                )}{" "}
                                                · {modal.turno.hora}hs
                                            </div>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    gap: 6,
                                                    flexWrap: "wrap",
                                                    justifyContent: "flex-end",
                                                }}
                                            >
                                                {modalReprogramacion && (
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: colorReprogramacion,
                                                            background: `${colorReprogramacion}20`,
                                                            padding: "3px 9px",
                                                            borderRadius: 20,
                                                            fontFamily:
                                                                AgendaPanel_FONT_DISPLAY,
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.04em",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        Reprogramación
                                                    </span>
                                                )}
                                                {modalPendiente && (
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: colorPendiente,
                                                            background: `${colorPendiente}20`,
                                                            padding: "3px 9px",
                                                            borderRadius: 20,
                                                            fontFamily:
                                                                AgendaPanel_FONT_DISPLAY,
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.04em",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        Pendiente
                                                    </span>
                                                )}
                                                {modalManual && (
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                            color: AgendaPanel_SLATE,
                                                            background: `${AgendaPanel_SLATE}18`,
                                                            padding: "3px 9px",
                                                            borderRadius: 20,
                                                            fontFamily:
                                                                AgendaPanel_FONT_DISPLAY,
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.04em",
                                                            whiteSpace:
                                                                "nowrap",
                                                        }}
                                                    >
                                                        Manual
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                fontSize: isMobile ? 19 : 21,
                                                fontWeight: 700,
                                                color: AgendaPanel_INK,
                                                letterSpacing: "-0.4px",
                                                fontFamily:
                                                    AgendaPanel_FONT_DISPLAY,
                                            }}
                                        >
                                            {modal.turno.nombre}
                                            {modal.turno.apellido
                                                ? ` ${modal.turno.apellido}`
                                                : ""}
                                        </div>
                                        {modal.turno.telefono && (
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: AgendaPanel_SLATE,
                                                    marginTop: 6,
                                                }}
                                            >
                                                +54{" "}
                                                {AgendaPanel_cleanTel(
                                                    modal.turno.telefono
                                                )}
                                            </div>
                                        )}
                                        {modal.turno.email && (
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: "#9A9A94",
                                                    marginTop: 2,
                                                }}
                                            >
                                                {modal.turno.email}
                                            </div>
                                        )}
                                        {mostrarAsignarProfesional ? (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 6,
                                                    marginTop: 10,
                                                    padding: "10px 12px",
                                                    borderRadius: 12,
                                                    background:
                                                        modalEquipoNombre
                                                            ? `${accentColor}10`
                                                            : "#FEF3C7",
                                                    border: modalEquipoNombre
                                                        ? `1px solid ${accentColor}25`
                                                        : "1px solid #FCD34D",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "space-between",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            color: modalEquipoNombre
                                                                ? accentColor
                                                                : "#B45309",
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.05em",
                                                        }}
                                                    >
                                                        Profesional
                                                    </span>
                                                    {!modalEquipoNombre && (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                color: "#B45309",
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            Sin asignar · elegí
                                                            a cualquiera
                                                        </span>
                                                    )}
                                                </div>
                                                <select
                                                    value={
                                                        modal.turno.equipo_id ||
                                                        ""
                                                    }
                                                    disabled={
                                                        asignandoProfesional
                                                    }
                                                    onChange={(e) => {
                                                        if (e.target.value)
                                                            handleAsignarProfesional(
                                                                e.target.value
                                                            )
                                                    }}
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        color: AgendaPanel_INK,
                                                        padding: "7px 8px",
                                                        borderRadius: 8,
                                                        border: `1px solid ${AgendaPanel_HAIRLINE}`,
                                                        background: "#fff",
                                                        cursor: asignandoProfesional
                                                            ? "wait"
                                                            : "pointer",
                                                    }}
                                                >
                                                    <option value="" disabled>
                                                        {asignandoProfesional
                                                            ? "Asignando…"
                                                            : "Elegí un profesional"}
                                                    </option>
                                                    {equipo.map((m: any) => (
                                                        <option
                                                            key={m.id}
                                                            value={m.id}
                                                        >
                                                            {m.nombre}
                                                            {m.apellido
                                                                ? ` ${m.apellido}`
                                                                : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                {asignarProfesionalError && (
                                                    <span
                                                        style={{
                                                            fontSize: 11.5,
                                                            color: "#DC2626",
                                                        }}
                                                    >
                                                        {
                                                            asignarProfesionalError
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            modalEquipoNombre && (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 8,
                                                        marginTop: 10,
                                                        padding: "10px 12px",
                                                        borderRadius: 12,
                                                        background: `${accentColor}10`,
                                                        border: `1px solid ${accentColor}25`,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            color: accentColor,
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing:
                                                                "0.05em",
                                                        }}
                                                    >
                                                        Profesional
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                            color: AgendaPanel_INK,
                                                        }}
                                                    >
                                                        {modalEquipoNombre}
                                                    </span>
                                                </div>
                                            )
                                        )}

                                        {(modal.turno.servicio ||
                                            AgendaPanel_tieneExtras(
                                                modal.turno.extras
                                            )) && (
                                            <div
                                                style={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: 6,
                                                    marginTop: 10,
                                                }}
                                            >
                                                {modal.turno.servicio && (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-block",
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            color: accentColor,
                                                            background: `${accentColor}14`,
                                                            padding: "3px 11px",
                                                            borderRadius: 20,
                                                        }}
                                                    >
                                                        {modal.turno.servicio}
                                                    </span>
                                                )}
                                                {AgendaPanel_tieneExtras(
                                                    modal.turno.extras
                                                ) && (
                                                    <span
                                                        style={{
                                                            display:
                                                                "inline-block",
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            color: AgendaPanel_INK,
                                                            background:
                                                                AgendaPanel_GHOST,
                                                            border: `1px solid ${AgendaPanel_HAIRLINE}`,
                                                            padding: "3px 11px",
                                                            borderRadius: 20,
                                                        }}
                                                    >
                                                        +{" "}
                                                        {AgendaPanel_extrasLabel(
                                                            modal.turno.extras
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* NUEVO: bloque de solicitud de reprogramación.
                                Independiente del flujo de pago — un turno
                                puede tener reprogramación pendiente esté o
                                no pendiente de aprobación de pago. */}
                                    {modalReprogramacion && (
                                        <div
                                            style={{
                                                background: `${colorReprogramacion}12`,
                                                border: `1px solid ${colorReprogramacion}30`,
                                                borderRadius: 12,
                                                padding: "12px 14px",
                                                marginBottom: 14,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    color: colorReprogramacion,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.06em",
                                                    marginBottom: 6,
                                                }}
                                            >
                                                Pide reprogramar
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    color: AgendaPanel_INK,
                                                    marginBottom: reprogramarOk
                                                        ? 0
                                                        : 10,
                                                }}
                                            >
                                                Nueva fecha propuesta:{" "}
                                                <strong>
                                                    {AgendaPanel_formatFecha(
                                                        modalReprogramacion.fecha_propuesta
                                                    )}{" "}
                                                    ·{" "}
                                                    {
                                                        modalReprogramacion.hora_propuesta
                                                    }
                                                    hs
                                                </strong>
                                            </div>

                                            {reprogramarOk ? (
                                                <div
                                                    style={{
                                                        fontSize: 12.5,
                                                        fontWeight: 600,
                                                        color:
                                                            reprogramarOk ===
                                                            "aprobada"
                                                                ? "#22c55e"
                                                                : "#EF4444",
                                                    }}
                                                >
                                                    {reprogramarOk ===
                                                    "aprobada"
                                                        ? "Reprogramación aprobada"
                                                        : "Reprogramación rechazada"}
                                                </div>
                                            ) : (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: 8,
                                                    }}
                                                >
                                                    <button
                                                        onClick={() =>
                                                            handleReprogramacion(
                                                                "aprobar"
                                                            )
                                                        }
                                                        disabled={reprogramando}
                                                        style={{
                                                            flex: 1,
                                                            padding: "9px 10px",
                                                            borderRadius: 10,
                                                            border: "none",
                                                            cursor: reprogramando
                                                                ? "wait"
                                                                : "pointer",
                                                            background:
                                                                colorReprogramacion,
                                                            color: "#fff",
                                                            fontSize: 12.5,
                                                            fontWeight: 700,
                                                            fontFamily:
                                                                AgendaPanel_FONT_BODY,
                                                            opacity:
                                                                reprogramando &&
                                                                reprogramandoAccion !==
                                                                    "aprobar"
                                                                    ? 0.35
                                                                    : 1,
                                                        }}
                                                    >
                                                        {reprogramando &&
                                                        reprogramandoAccion ===
                                                            "aprobar"
                                                            ? "Confirmando…"
                                                            : "Aprobar cambio"}
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleReprogramacion(
                                                                "rechazar"
                                                            )
                                                        }
                                                        disabled={reprogramando}
                                                        style={{
                                                            flex: 1,
                                                            padding: "9px 10px",
                                                            borderRadius: 10,
                                                            cursor: reprogramando
                                                                ? "wait"
                                                                : "pointer",
                                                            background:
                                                                "#FEF2F2",
                                                            border: "1px solid #FECACA",
                                                            color: "#EF4444",
                                                            fontSize: 12.5,
                                                            fontWeight: 700,
                                                            fontFamily:
                                                                AgendaPanel_FONT_BODY,
                                                            opacity:
                                                                reprogramando &&
                                                                reprogramandoAccion !==
                                                                    "rechazar"
                                                                    ? 0.35
                                                                    : 1,
                                                        }}
                                                    >
                                                        {reprogramando &&
                                                        reprogramandoAccion ===
                                                            "rechazar"
                                                            ? "Rechazando…"
                                                            : "Rechazar cambio"}
                                                    </button>
                                                </div>
                                            )}
                                            {reprogramarError && (
                                                <div
                                                    style={{
                                                        fontSize: 11.5,
                                                        color: "#EF4444",
                                                        marginTop: 8,
                                                    }}
                                                >
                                                    {reprogramarError}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Info de pago y de compra — método, total,
                                estado y, si el cliente compró algún extra
                                (turno.extras), también se muestra acá. Este
                                bloque aparece si hay un método de pago
                                manual asociado O si hay extras comprados
                                (por si pagó con Mercado Pago). */}
                                    {(modal.turno.metodo_pago !== "none" ||
                                        AgendaPanel_tieneExtras(
                                            modal.turno.extras
                                        )) && (
                                        <div
                                            style={{
                                                background: AgendaPanel_GHOST,
                                                borderRadius: 12,
                                                padding: "12px 14px",
                                                marginBottom: 14,
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 6,
                                            }}
                                        >
                                            {AgendaPanel_tieneExtras(
                                                modal.turno.extras
                                            ) && (
                                                <AgendaPanel_InfoRow
                                                    label="Extras"
                                                    value={AgendaPanel_extrasLabel(
                                                        modal.turno.extras
                                                    )}
                                                />
                                            )}
                                            {modal.turno.metodo_pago !==
                                                "none" && (
                                                <AgendaPanel_InfoRow
                                                    label="Método"
                                                    value={AgendaPanel_metodoPagoLabel(
                                                        modal.turno.metodo_pago
                                                    )}
                                                />
                                            )}
                                            {modal.turno.precio_cobrado > 0 && (
                                                <>
                                                    <AgendaPanel_InfoRow
                                                        label="Total del servicio"
                                                        value={AgendaPanel_formatMonto(
                                                            modal.turno
                                                                .precio_cobrado
                                                        )}
                                                    />
                                                    {modal.turno.metodo_pago !==
                                                        "none" &&
                                                        (() => {
                                                            const total =
                                                                Number(
                                                                    modal.turno
                                                                        .precio_cobrado ||
                                                                        0
                                                                )
                                                            const pagado =
                                                                Math.min(
                                                                    Math.max(
                                                                        Number(
                                                                            modal
                                                                                .turno
                                                                                .monto_pagado ||
                                                                                0
                                                                        ),
                                                                        0
                                                                    ),
                                                                    total
                                                                )
                                                            const pendiente =
                                                                Math.max(
                                                                    total -
                                                                        pagado,
                                                                    0
                                                                )
                                                            return (
                                                                <>
                                                                    <AgendaPanel_InfoRow
                                                                        label="Abonado"
                                                                        value={AgendaPanel_formatMonto(
                                                                            pagado
                                                                        )}
                                                                    />
                                                                    <AgendaPanel_InfoRow
                                                                        label="Saldo pendiente"
                                                                        value={AgendaPanel_formatMonto(
                                                                            pendiente
                                                                        )}
                                                                        highlight={
                                                                            pendiente >
                                                                            0
                                                                        }
                                                                        color={
                                                                            pendiente >
                                                                            0
                                                                                ? colorPendiente
                                                                                : undefined
                                                                        }
                                                                    />
                                                                </>
                                                            )
                                                        })()}
                                                </>
                                            )}
                                            {modal.turno.metodo_pago !==
                                                "none" && (
                                                <AgendaPanel_InfoRow
                                                    label="Estado de pago"
                                                    value={AgendaPanel_estadoPagoLabel(
                                                        modal.turno.pago_estado
                                                    )}
                                                    highlight={
                                                        modal.turno
                                                            .pago_estado ===
                                                        "pendiente"
                                                    }
                                                    color={colorPendiente}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Comprobante de transferencia — signed URL
                                de corta duración, nunca URL pública. */}
                                    {modalPendiente &&
                                        modal.turno.metodo_pago ===
                                            "transferencia" && (
                                            <div style={{ marginBottom: 14 }}>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: "#9A9A94",
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.06em",
                                                        marginBottom: 8,
                                                    }}
                                                >
                                                    Comprobante
                                                </div>
                                                {comprobante.loading && (
                                                    <AgendaPanel_Skel
                                                        width="100%"
                                                        height={140}
                                                        style={{
                                                            borderRadius: 12,
                                                        }}
                                                    />
                                                )}
                                                {!comprobante.loading &&
                                                    comprobante.error && (
                                                        <div
                                                            style={{
                                                                fontSize: 12,
                                                                color: "#EF4444",
                                                                background:
                                                                    "#FEF2F2",
                                                                border: "1px solid #FECACA",
                                                                borderRadius: 10,
                                                                padding:
                                                                    "10px 12px",
                                                            }}
                                                        >
                                                            {comprobante.error}
                                                        </div>
                                                    )}
                                                {!comprobante.loading &&
                                                    comprobante.url && (
                                                        <a
                                                            href={
                                                                comprobante.url
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <img
                                                                src={
                                                                    comprobante.url
                                                                }
                                                                alt="Comprobante de transferencia"
                                                                style={{
                                                                    width: "100%",
                                                                    maxHeight: 220,
                                                                    objectFit:
                                                                        "contain",
                                                                    borderRadius: 12,
                                                                    border: `1px solid ${AgendaPanel_HAIRLINE}`,
                                                                    background:
                                                                        "#FAFAF8",
                                                                    cursor: "zoom-in",
                                                                    display:
                                                                        "block",
                                                                }}
                                                            />
                                                        </a>
                                                    )}
                                            </div>
                                        )}

                                    <div
                                        style={{
                                            height: 1,
                                            background: AgendaPanel_HAIRLINE,
                                            marginBottom: 16,
                                        }}
                                    />

                                    {cancelOk ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            style={{
                                                textAlign: "center",
                                                padding: "10px 0",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 22,
                                                    marginBottom: 6,
                                                    color: "#EF4444",
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: "#EF4444",
                                                }}
                                            >
                                                {modalPendiente
                                                    ? "Turno rechazado"
                                                    : "Turno cancelado"}
                                            </div>
                                        </motion.div>
                                    ) : aprobarOk ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            style={{
                                                textAlign: "center",
                                                padding: "10px 0",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: 22,
                                                    marginBottom: 6,
                                                    color: "#22c55e",
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    color: "#22c55e",
                                                }}
                                            >
                                                Turno aprobado
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 8,
                                            }}
                                        >
                                            {modalPendiente ? (
                                                <>
                                                    {/* Orden pedido: Aprobar -
                                                Rechazar - WhatsApp */}
                                                    <button
                                                        onClick={handleAprobar}
                                                        disabled={aprobando}
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            gap: 8,
                                                            padding: isMobile
                                                                ? "14px 16px"
                                                                : "12px 16px",
                                                            borderRadius: 13,
                                                            border: "none",
                                                            cursor: aprobando
                                                                ? "wait"
                                                                : "pointer",
                                                            background:
                                                                "#22c55e",
                                                            color: "#fff",
                                                            fontSize: isMobile
                                                                ? 15
                                                                : 14,
                                                            fontWeight: 700,
                                                            fontFamily:
                                                                AgendaPanel_FONT_BODY,
                                                            opacity: aprobando
                                                                ? 0.7
                                                                : 1,
                                                        }}
                                                    >
                                                        {aprobando
                                                            ? "Aprobando…"
                                                            : "Aprobar turno"}
                                                    </button>
                                                    <button
                                                        onClick={handleCancelar}
                                                        disabled={cancelando}
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            gap: 8,
                                                            padding: isMobile
                                                                ? "14px 16px"
                                                                : "12px 16px",
                                                            borderRadius: 13,
                                                            cursor: cancelando
                                                                ? "wait"
                                                                : "pointer",
                                                            background:
                                                                "#FEF2F2",
                                                            border: "1px solid #FECACA",
                                                            color: "#EF4444",
                                                            fontSize: isMobile
                                                                ? 15
                                                                : 14,
                                                            fontWeight: 700,
                                                            fontFamily:
                                                                AgendaPanel_FONT_BODY,
                                                            opacity: cancelando
                                                                ? 0.7
                                                                : 1,
                                                        }}
                                                    >
                                                        {cancelando
                                                            ? "Cancelando…"
                                                            : "Rechazar turno"}
                                                    </button>
                                                    <button
                                                        onClick={handleWhatsApp}
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            gap: 8,
                                                            padding: isMobile
                                                                ? "14px 16px"
                                                                : "12px 16px",
                                                            borderRadius: 13,
                                                            border: "none",
                                                            cursor: "pointer",
                                                            background:
                                                                "#25D366",
                                                            color: "#fff",
                                                            fontSize: isMobile
                                                                ? 15
                                                                : 14,
                                                            fontWeight: 700,
                                                            fontFamily:
                                                                AgendaPanel_FONT_BODY,
                                                        }}
                                                    >
                                                        <AgendaPanel_WhatsAppIcon />
                                                        Contactar por WhatsApp
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {!!modal.turno.telefono && (
                                                        <button
                                                            onClick={
                                                                handleWhatsApp
                                                            }
                                                            style={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "center",
                                                                gap: 8,
                                                                padding:
                                                                    isMobile
                                                                        ? "14px 16px"
                                                                        : "12px 16px",
                                                                borderRadius: 13,
                                                                border: "none",
                                                                cursor: "pointer",
                                                                background:
                                                                    "#25D366",
                                                                color: "#fff",
                                                                fontSize:
                                                                    isMobile
                                                                        ? 15
                                                                        : 14,
                                                                fontWeight: 700,
                                                                fontFamily:
                                                                    AgendaPanel_FONT_BODY,
                                                            }}
                                                        >
                                                            <AgendaPanel_WhatsAppIcon />
                                                            Contactar por
                                                            WhatsApp
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={handleCancelar}
                                                        disabled={cancelando}
                                                        style={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            justifyContent:
                                                                "center",
                                                            gap: 8,
                                                            padding: isMobile
                                                                ? "14px 16px"
                                                                : "12px 16px",
                                                            borderRadius: 13,
                                                            cursor: cancelando
                                                                ? "wait"
                                                                : "pointer",
                                                            background:
                                                                "#FEF2F2",
                                                            border: "1px solid #FECACA",
                                                            color: "#EF4444",
                                                            fontSize: isMobile
                                                                ? 15
                                                                : 14,
                                                            fontWeight: 700,
                                                            fontFamily:
                                                                AgendaPanel_FONT_BODY,
                                                            opacity: cancelando
                                                                ? 0.7
                                                                : 1,
                                                        }}
                                                    >
                                                        {cancelando
                                                            ? "Cancelando…"
                                                            : "Cancelar turno"}
                                                    </button>
                                                </>
                                            )}
                                            {(cancelError !== "" ||
                                                aprobarError !== "") && (
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: "#EF4444",
                                                        textAlign: "center",
                                                        padding: "4px 0",
                                                    }}
                                                >
                                                    {aprobarError ||
                                                        cancelError}
                                                </div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setModal(null)
                                                    setCancelError("")
                                                    setAprobarError("")
                                                    setReprogramarError("")
                                                }}
                                                style={{
                                                    padding: "10px",
                                                    borderRadius: 10,
                                                    border: "none",
                                                    cursor: "pointer",
                                                    background: "transparent",
                                                    color: "#A6A6A0",
                                                    fontSize: 13,
                                                    fontWeight: 500,
                                                    fontFamily:
                                                        AgendaPanel_FONT_BODY,
                                                }}
                                            >
                                                Cerrar
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MODAL — ALTA MANUAL DE TURNO */}
            <AnimatePresence>
                {nuevo && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={cerrarNuevo}
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(18,19,26,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 9999,
                            backdropFilter: "blur(3px)",
                            padding: isMobile ? "16px" : 0,
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 10 }}
                            transition={{
                                type: "spring",
                                stiffness: 320,
                                damping: 26,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: AgendaPanel_SURFACE,
                                borderRadius: 22,
                                padding: isMobile
                                    ? "24px 20px 20px"
                                    : "28px 26px 24px",
                                width: isMobile ? "100%" : 340,
                                maxWidth: 360,
                                maxHeight: isMobile ? "88svh" : "86vh",
                                overflowY: "auto",
                                boxShadow: "0 18px 50px rgba(18,19,26,0.14)",
                                border: `1px solid ${AgendaPanel_HAIRLINE}`,
                                fontFamily: AgendaPanel_FONT_BODY,
                                boxSizing: "border-box",
                            }}
                        >
                            {nuevoOk ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        textAlign: "center",
                                        padding: "22px 0",
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: "#22c55e",
                                    }}
                                >
                                    Turno agendado
                                </motion.div>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            fontSize: isMobile ? 19 : 21,
                                            fontWeight: 700,
                                            color: AgendaPanel_INK,
                                            letterSpacing: "-0.4px",
                                            fontFamily:
                                                AgendaPanel_FONT_DISPLAY,
                                        }}
                                    >
                                        Agregar turno
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12.5,
                                            color: "#9A9A94",
                                            marginTop: 4,
                                            marginBottom: 18,
                                        }}
                                    >
                                        Para turnos que acordaste por fuera de
                                        la app.
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 12,
                                        }}
                                    >
                                        <label style={AgendaPanel_labelStyle}>
                                            Nombre
                                            <input
                                                type="text"
                                                value={nuevo.nombre}
                                                maxLength={80}
                                                autoFocus
                                                placeholder="Nombre del cliente"
                                                onChange={(e) =>
                                                    setCampoNuevo(
                                                        "nombre",
                                                        e.target.value
                                                    )
                                                }
                                                style={AgendaPanel_inputStyle}
                                            />
                                        </label>

                                        {equipo.length > 0 && (
                                            <label
                                                style={AgendaPanel_labelStyle}
                                            >
                                                Profesional
                                                <select
                                                    value={
                                                        nuevo.equipo_id || ""
                                                    }
                                                    onChange={(e) =>
                                                        setCampoNuevo(
                                                            "equipo_id",
                                                            e.target.value
                                                        )
                                                    }
                                                    style={
                                                        AgendaPanel_inputStyle
                                                    }
                                                >
                                                    <option value="">
                                                        Sin asignar
                                                    </option>
                                                    {equipo.map(
                                                        (miembro: any) => (
                                                            <option
                                                                key={miembro.id}
                                                                value={
                                                                    miembro.id
                                                                }
                                                            >
                                                                {`${miembro.nombre || ""} ${miembro.apellido || ""}`.trim()}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>
                                        )}

                                        {servicios.length > 0 && (
                                            <label
                                                style={AgendaPanel_labelStyle}
                                            >
                                                Servicio
                                                <select
                                                    value={nuevo.servicio_id}
                                                    onChange={(e) =>
                                                        setCampoNuevo(
                                                            "servicio_id",
                                                            e.target.value
                                                        )
                                                    }
                                                    style={
                                                        AgendaPanel_inputStyle
                                                    }
                                                >
                                                    <option value="">
                                                        Elegí un servicio
                                                    </option>
                                                    {servicios.map(
                                                        (sv: any) => (
                                                            <option
                                                                key={sv.id}
                                                                value={sv.id}
                                                            >
                                                                {sv.nombre}
                                                            </option>
                                                        )
                                                    )}
                                                </select>
                                            </label>
                                        )}

                                        <div
                                            style={{ display: "flex", gap: 10 }}
                                        >
                                            <label
                                                style={{
                                                    ...AgendaPanel_labelStyle,
                                                    flex: 1,
                                                    minWidth: 0,
                                                }}
                                            >
                                                Día
                                                <input
                                                    type="date"
                                                    value={nuevo.fecha}
                                                    min={AgendaPanel_hoyISO()}
                                                    onChange={(e) =>
                                                        setCampoNuevo(
                                                            "fecha",
                                                            e.target.value
                                                        )
                                                    }
                                                    style={
                                                        AgendaPanel_inputStyle
                                                    }
                                                />
                                            </label>
                                            <label
                                                style={{
                                                    ...AgendaPanel_labelStyle,
                                                    flex: 1,
                                                    minWidth: 0,
                                                }}
                                            >
                                                Hora
                                                <input
                                                    type="time"
                                                    value={nuevo.hora}
                                                    onChange={(e) =>
                                                        setCampoNuevo(
                                                            "hora",
                                                            e.target.value
                                                        )
                                                    }
                                                    style={
                                                        AgendaPanel_inputStyle
                                                    }
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {nuevoError && (
                                        <div
                                            style={{
                                                fontSize: 12.5,
                                                color: nuevoConflicto
                                                    ? "#B45309"
                                                    : "#EF4444",
                                                background: nuevoConflicto
                                                    ? "#FFFBEB"
                                                    : "#FEF2F2",
                                                border: `1px solid ${nuevoConflicto ? "#FDE68A" : "#FECACA"}`,
                                                borderRadius: 10,
                                                padding: "10px 12px",
                                                marginTop: 14,
                                            }}
                                        >
                                            {nuevoError}
                                        </div>
                                    )}

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                            marginTop: 18,
                                        }}
                                    >
                                        <button
                                            onClick={() =>
                                                handleCrearManual(
                                                    nuevoConflicto
                                                )
                                            }
                                            disabled={nuevoGuardando}
                                            style={{
                                                padding: isMobile
                                                    ? "14px 16px"
                                                    : "12px 16px",
                                                borderRadius: 13,
                                                border: "none",
                                                cursor: nuevoGuardando
                                                    ? "wait"
                                                    : "pointer",
                                                background: nuevoConflicto
                                                    ? colorPendiente
                                                    : accentColor,
                                                color: "#fff",
                                                fontSize: isMobile ? 15 : 14,
                                                fontWeight: 700,
                                                fontFamily:
                                                    AgendaPanel_FONT_BODY,
                                                opacity: nuevoGuardando
                                                    ? 0.7
                                                    : 1,
                                            }}
                                        >
                                            {nuevoGuardando
                                                ? "Agendando…"
                                                : nuevoConflicto
                                                  ? "Agendar igual"
                                                  : "Agendar turno"}
                                        </button>
                                        <button
                                            onClick={cerrarNuevo}
                                            style={{
                                                padding: "10px",
                                                borderRadius: 10,
                                                border: "none",
                                                cursor: "pointer",
                                                background: "transparent",
                                                color: "#A6A6A0",
                                                fontSize: 13,
                                                fontWeight: 500,
                                                fontFamily:
                                                    AgendaPanel_FONT_BODY,
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

function AgendaPanel_InfoRow({ label, value, highlight, color }: any) {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12.5,
            }}
        >
            <span style={{ color: "#9A9A94" }}>{label}</span>
            <span
                style={{
                    color: highlight ? color : AgendaPanel_INK,
                    fontWeight: 600,
                }}
            >
                {value}
            </span>
        </div>
    )
}

function AgendaPanel_Layout({
    dias,
    colsDias,
    hoyWidth,
    accentColor,
    colorPendiente,
    colorReprogramacion,
    colorSinProfesional,
    resaltarSinProfesional,
    isMobile,
    isTablet,
    onTurnoClick,
    onNuevoTurno,
}: any) {
    const hoy = dias.find((d: any) => d.esHoy)
    const diasConTurnos = dias.filter((d: any) => d.turnos.length > 0).length
    const totalTurnos = dias.reduce(
        (total: number, d: any) => total + d.turnos.length,
        0
    )
    const primerDia = dias.length
        ? new Date(`${dias[0].fecha}T12:00:00`)
        : new Date()
    const mesActual = primerDia.toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
    })

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? 12 : 16,
                width: "100%",
                minWidth: 0,
                flex: 1,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: isMobile ? "flex-start" : "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: isMobile ? "14px 14px" : "16px 18px",
                    borderRadius: isMobile ? 16 : 20,
                    border: `1px solid ${AgendaPanel_HAIRLINE}`,
                    background: AgendaPanel_SURFACE,
                }}
            >
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                        }}
                    >
                        <span
                            style={{
                                fontFamily: AgendaPanel_FONT_DISPLAY,
                                fontSize: isMobile ? 18 : 21,
                                fontWeight: 800,
                                color: AgendaPanel_INK,
                                letterSpacing: "-0.5px",
                            }}
                        >
                            Calendario de turnos
                        </span>
                        <span
                            style={{
                                fontSize: isMobile ? 12 : 13,
                                fontWeight: 800,
                                color: AgendaPanel_SLATE,
                                textTransform: "capitalize",
                                letterSpacing: "-0.1px",
                            }}
                        >
                            {mesActual}
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: accentColor,
                                background: `${accentColor}15`,
                                padding: "4px 9px",
                                borderRadius: 999,
                                whiteSpace: "nowrap",
                            }}
                        >
                            Próximos 30 días
                        </span>
                    </div>
                    <div
                        style={{
                            marginTop: 5,
                            fontSize: 12,
                            color: AgendaPanel_SLATE,
                        }}
                    >
                        Tocá un turno para ver todos sus detalles.
                    </div>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        fontSize: 11,
                        color: AgendaPanel_SLATE,
                    }}
                >
                    <span>{`${totalTurnos} turnos`}</span>
                    <span>{`${diasConTurnos} días ocupados`}</span>
                    {onNuevoTurno && (
                        <button
                            onClick={onNuevoTurno}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: isMobile ? "9px 14px" : "8px 14px",
                                borderRadius: 999,
                                border: "none",
                                cursor: "pointer",
                                background: accentColor,
                                color: "#fff",
                                fontSize: 12.5,
                                fontWeight: 700,
                                fontFamily: AgendaPanel_FONT_BODY,
                                whiteSpace: "nowrap",
                            }}
                        >
                            <span style={{ fontSize: 15, lineHeight: 1 }}>
                                +
                            </span>
                            Agregar turno
                        </button>
                    )}
                </div>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                        ? "minmax(0, 1fr)"
                        : "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: isMobile ? 10 : 12,
                    width: "100%",
                    minWidth: 0,
                    padding: isMobile ? 6 : 10,
                    borderRadius: isMobile ? 16 : 20,
                    backgroundColor: `${AgendaPanel_INK}03`,
                    backgroundImage: `linear-gradient(${AgendaPanel_INK}08 1px, transparent 1px), linear-gradient(90deg, ${AgendaPanel_INK}08 1px, transparent 1px)`,
                    backgroundSize: isMobile ? "22px 22px" : "30px 30px",
                    boxSizing: "border-box",
                }}
            >
                {diasConTurnos === 0 ? (
                    <div
                        style={{
                            gridColumn: "1 / -1",
                            display: "flex",
                            justifyContent: "center",
                            padding: isMobile ? "26px 10px" : "40px 10px",
                        }}
                    >
                        <div
                            style={{
                                position: "relative",
                                width: isMobile ? 190 : 212,
                                padding: "24px 16px 28px",
                                background: "#FEF3C7",
                                boxShadow:
                                    "0 12px 26px rgba(15,23,42,0.14), 0 2px 6px rgba(15,23,42,0.08)",
                                transform: "rotate(-2.5deg)",
                                textAlign: "center",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    top: -9,
                                    left: "50%",
                                    transform: "translateX(-50%) rotate(-3deg)",
                                    width: 44,
                                    height: 16,
                                    background: "rgba(250, 204, 21, 0.6)",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                                }}
                            />
                            <div
                                style={{
                                    fontFamily: AgendaPanel_FONT_DISPLAY,
                                    fontSize: isMobile ? 14.5 : 15.5,
                                    fontWeight: 800,
                                    color: "#78350F",
                                    lineHeight: 1.45,
                                }}
                            >
                                Aún no tienes turnos
                            </div>
                        </div>
                    </div>
                ) : (
                    dias
                        .filter((dia: any) => dia.turnos.length > 0)
                        .map((dia: any) => {
                            const fecha = new Date(`${dia.fecha}T12:00:00`)
                            const numero = fecha.getDate()
                            const nombreDia = fecha.toLocaleDateString(
                                "es-AR",
                                {
                                    weekday: "long",
                                }
                            )
                            const tituloDia = `${nombreDia.charAt(0).toUpperCase()}${nombreDia.slice(1)} ${numero}`
                            const esHoy = !!dia.esHoy
                            const pendientes = dia.turnos.filter(
                                AgendaPanel_esPendienteAprobacion
                            ).length
                            const reprog = dia.turnos.filter(
                                AgendaPanel_tieneReprogramacionPendiente
                            ).length
                            const sinProfesional = resaltarSinProfesional
                                ? dia.turnos.filter(
                                      AgendaPanel_faltaProfesional
                                  ).length
                                : 0

                            return (
                                <div
                                    key={dia.fecha}
                                    style={{
                                        minWidth: 0,
                                        minHeight: isMobile ? 0 : 148,
                                        padding: isMobile ? 12 : 13,
                                        borderRadius: isMobile ? 14 : 17,
                                        border: esHoy
                                            ? `1.5px solid ${accentColor}`
                                            : `1px solid ${AgendaPanel_HAIRLINE}`,
                                        background: esHoy
                                            ? `linear-gradient(155deg, ${accentColor}12 0%, ${AgendaPanel_SURFACE} 72%)`
                                            : AgendaPanel_SURFACE,
                                        boxShadow: esHoy
                                            ? `0 5px 16px ${accentColor}12`
                                            : "none",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 9,
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 8,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                minWidth: 0,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontFamily:
                                                        AgendaPanel_FONT_DISPLAY,
                                                    fontSize: isMobile
                                                        ? 16
                                                        : 17,
                                                    fontWeight: 800,
                                                    color: AgendaPanel_INK,
                                                    lineHeight: 1.2,
                                                }}
                                            >
                                                {tituloDia}
                                            </span>
                                            {esHoy && (
                                                <span
                                                    style={{
                                                        fontSize: 10,
                                                        fontWeight: 800,
                                                        color: accentColor,
                                                        background: `${accentColor}18`,
                                                        padding: "4px 8px",
                                                        borderRadius: 999,
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing: "0.04em",
                                                    }}
                                                >
                                                    Hoy
                                                </span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                color: AgendaPanel_SLATE,
                                                fontVariantNumeric:
                                                    "tabular-nums",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {`${dia.turnos.length} ${dia.turnos.length === 1 ? "turno" : "turnos"}`}
                                        </span>
                                    </div>

                                    {(pendientes > 0 ||
                                        reprog > 0 ||
                                        sinProfesional > 0) && (
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: 5,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            {pendientes > 0 && (
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 800,
                                                        color: colorPendiente,
                                                        background: `${colorPendiente}18`,
                                                        padding: "3px 7px",
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    {`${pendientes} pend.`}
                                                </span>
                                            )}
                                            {reprog > 0 && (
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 800,
                                                        color: colorReprogramacion,
                                                        background: `${colorReprogramacion}18`,
                                                        padding: "3px 7px",
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    {`${reprog} reprog.`}
                                                </span>
                                            )}
                                            {sinProfesional > 0 && (
                                                <span
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 800,
                                                        color: colorSinProfesional,
                                                        background: `${colorSinProfesional}18`,
                                                        padding: "3px 7px",
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    {`${sinProfesional} sin asignar`}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 6,
                                            minWidth: 0,
                                        }}
                                    >
                                        {dia.turnos.map((turno: any) => (
                                            <AgendaPanel_CalendarTurno
                                                key={turno.id}
                                                turno={turno}
                                                accentColor={accentColor}
                                                colorPendiente={colorPendiente}
                                                colorReprogramacion={
                                                    colorReprogramacion
                                                }
                                                colorSinProfesional={
                                                    colorSinProfesional
                                                }
                                                resaltarSinProfesional={
                                                    resaltarSinProfesional
                                                }
                                                isMobile={isMobile}
                                                onClick={() =>
                                                    onTurnoClick(
                                                        turno,
                                                        dia.fecha
                                                    )
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                        })
                )}
            </div>
        </div>
    )
}

function AgendaPanel_CalendarTurno({
    turno,
    accentColor,
    colorPendiente,
    colorReprogramacion,
    isMobile,
    onClick,
}: any) {
    const pendiente = AgendaPanel_esPendienteAprobacion(turno)
    const reprogramacion = AgendaPanel_tieneReprogramacionPendiente(turno)
    const color = reprogramacion
        ? colorReprogramacion
        : pendiente
          ? colorPendiente
          : accentColor

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(event: any) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onClick()
                }
            }}
            style={{
                minWidth: 0,
                padding: isMobile ? "6px 7px" : "7px 8px",
                borderRadius: 9,
                background: `${color}12`,
                border: `1px solid ${color}30`,
                cursor: "pointer",
                outline: "none",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    minWidth: 0,
                }}
            >
                <span
                    style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                    }}
                />
                <span
                    style={{
                        fontFamily: AgendaPanel_FONT_DISPLAY,
                        fontSize: isMobile ? 10 : 11,
                        fontWeight: 800,
                        color: AgendaPanel_INK,
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                    }}
                >
                    {turno.hora}
                </span>
            </div>
            <div
                style={{
                    marginTop: 2,
                    fontSize: isMobile ? 10 : 11,
                    fontWeight: 700,
                    color: AgendaPanel_INK,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {`${turno.nombre || "Cliente"}${turno.apellido ? ` ${turno.apellido}` : ""}`}
            </div>
            <div
                style={{
                    marginTop: 2,
                    fontSize: 9,
                    color: AgendaPanel_SLATE,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                {turno.servicio || "Turno"}
            </div>
        </div>
    )
}

function AgendaPanel_DiaCard({
    dia,
    span,
    accentColor,
    colorPendiente,
    colorReprogramacion,
    isMobile,
    onTurnoClick,
}: any) {
    const { dia: numero, semana } = AgendaPanel_formatFechaParts(dia.fecha)
    const pendientesCount = dia.turnos.filter(
        AgendaPanel_esPendienteAprobacion
    ).length
    const reprogCount = dia.turnos.filter(
        AgendaPanel_tieneReprogramacionPendiente
    ).length

    return (
        <div
            style={{
                gridColumn: `span ${span}`,
                background: AgendaPanel_SURFACE,
                borderRadius: isMobile ? 14 : 16,
                border: `1px solid ${AgendaPanel_HAIRLINE}`,
                padding: isMobile ? "12px 12px" : "16px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 0,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: isMobile ? 8 : 12,
                    flexWrap: "wrap",
                }}
            >
                <span
                    style={{
                        fontFamily: AgendaPanel_FONT_DISPLAY,
                        fontSize: isMobile ? 22 : 26,
                        fontWeight: 700,
                        color: AgendaPanel_INK,
                        letterSpacing: "-0.5px",
                        lineHeight: 1,
                    }}
                >
                    {numero}
                </span>
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: AgendaPanel_SLATE,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                    }}
                >
                    {semana}
                </span>
                {reprogCount > 0 && (
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: colorReprogramacion,
                            background: `${colorReprogramacion}1A`,
                            padding: "2px 8px",
                            borderRadius: 20,
                            fontFamily: AgendaPanel_FONT_DISPLAY,
                        }}
                    >
                        {reprogCount} reprog.
                    </span>
                )}
                {pendientesCount > 0 && (
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: colorPendiente,
                            background: `${colorPendiente}1A`,
                            padding: "2px 8px",
                            borderRadius: 20,
                            fontFamily: AgendaPanel_FONT_DISPLAY,
                        }}
                    >
                        {pendientesCount} pend.
                    </span>
                )}
                <span
                    style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        color: "#B7B6B0",
                        fontFamily: AgendaPanel_FONT_DISPLAY,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {dia.turnos.length}{" "}
                    {dia.turnos.length === 1 ? "cita" : "citas"}
                </span>
            </div>

            <AgendaPanel_TimelineList
                turnos={dia.turnos}
                accentColor={accentColor}
                colorPendiente={colorPendiente}
                colorReprogramacion={colorReprogramacion}
                isMobile={isMobile}
                onItemClick={onTurnoClick}
            />
        </div>
    )
}

function AgendaPanel_TimelineList({
    turnos,
    accentColor,
    colorPendiente,
    colorReprogramacion,
    isMobile,
    onItemClick,
}: any) {
    return (
        <div style={{ display: "flex", flexDirection: "column" }}>
            {turnos.map((t: any, i: number) => (
                <AgendaPanel_TurnoRow
                    key={t.id}
                    turno={t}
                    accentColor={accentColor}
                    colorPendiente={colorPendiente}
                    colorReprogramacion={colorReprogramacion}
                    isMobile={isMobile}
                    isFirst={i === 0}
                    isLast={i === turnos.length - 1}
                    onClick={() => onItemClick(t)}
                />
            ))}
        </div>
    )
}

function AgendaPanel_TurnoRow({
    turno,
    accentColor,
    colorPendiente,
    colorReprogramacion,
    isMobile,
    isFirst,
    isLast,
    onClick,
}: any) {
    const [hover, setHover] = React.useState(false)
    const railWidth = isMobile ? 18 : 16
    const pendiente = AgendaPanel_esPendienteAprobacion(turno)
    const reprogramacion = AgendaPanel_tieneReprogramacionPendiente(turno)
    // Prioridad visual: pago pendiente > reprogramación pedida > normal
    const nodeColor = pendiente
        ? colorPendiente
        : reprogramacion
          ? colorReprogramacion
          : accentColor
    const destacado = pendiente || reprogramacion

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "stretch",
                cursor: "pointer",
                borderRadius: 8,
                background: destacado
                    ? hover
                        ? `${nodeColor}1F`
                        : `${nodeColor}12`
                    : hover
                      ? `${accentColor}09`
                      : "transparent",
                border: "1px solid transparent",
                transition: "background 0.15s",
            }}
        >
            {/* Rail: hilo + nodo */}
            <div
                style={{
                    width: railWidth,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        flex: 1,
                        width: 1,
                        background: isFirst
                            ? "transparent"
                            : AgendaPanel_HAIRLINE,
                    }}
                />
                <motion.div
                    animate={{
                        background:
                            hover || destacado
                                ? nodeColor
                                : AgendaPanel_SURFACE,
                        borderColor:
                            hover || destacado
                                ? nodeColor
                                : AgendaPanel_HAIRLINE,
                    }}
                    transition={{ duration: 0.15 }}
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        border: "1.5px solid",
                        flexShrink: 0,
                        margin: isMobile ? "8px 0" : "6px 0",
                    }}
                />
                <div
                    style={{
                        flex: 1,
                        width: 1,
                        background: isLast
                            ? "transparent"
                            : AgendaPanel_HAIRLINE,
                    }}
                />
            </div>

            {/* Contenido */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: isMobile ? "8px 8px 8px 2px" : "6px 8px 6px 2px",
                    minHeight: isMobile ? 20 : "auto",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexWrap: "wrap",
                        rowGap: 4,
                    }}
                >
                    <span
                        style={{
                            fontFamily: AgendaPanel_FONT_DISPLAY,
                            fontSize: isMobile ? 13 : 12.5,
                            fontWeight: 500,
                            color:
                                hover || destacado
                                    ? nodeColor
                                    : AgendaPanel_SLATE,
                            fontVariantNumeric: "tabular-nums",
                            minWidth: isMobile ? 40 : 36,
                            transition: "color 0.15s",
                        }}
                    >
                        {turno.hora}
                    </span>
                    <span
                        style={{
                            fontSize: isMobile ? 14 : 13,
                            fontWeight: 500,
                            color: AgendaPanel_INK,
                            fontFamily: AgendaPanel_FONT_BODY,
                        }}
                    >
                        {turno.nombre}
                    </span>
                    {pendiente && (
                        <span
                            style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: colorPendiente,
                                background: `${colorPendiente}22`,
                                padding: "2px 7px",
                                borderRadius: 20,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                fontFamily: AgendaPanel_FONT_DISPLAY,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {AgendaPanel_metodoPagoLabel(turno.metodo_pago)}
                        </span>
                    )}
                    {reprogramacion && (
                        <span
                            style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: colorReprogramacion,
                                background: `${colorReprogramacion}22`,
                                padding: "2px 7px",
                                borderRadius: 20,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                fontFamily: AgendaPanel_FONT_DISPLAY,
                                whiteSpace: "nowrap",
                            }}
                        >
                            Reprogramación
                        </span>
                    )}
                </div>
                <motion.span
                    animate={{
                        x: hover ? 2 : 0,
                        opacity: hover ? 1 : 0,
                    }}
                    transition={{ duration: 0.15 }}
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: destacado ? nodeColor : accentColor,
                        display: "inline-block",
                    }}
                ></motion.span>
            </div>
        </div>
    )
}

function AgendaPanel_SkeletonAgenda({ accentColor, colsDias, isMobile }: any) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 10 : 12,
                height: "100%",
            }}
        >
            <div
                style={{
                    width: isMobile ? "100%" : 180,
                    flexShrink: 0,
                    border: `1.5px solid ${accentColor}30`,
                    borderRadius: 18,
                    padding: isMobile ? "14px" : "20px 16px",
                    maxHeight: isMobile ? 220 : "none",
                }}
            >
                <AgendaPanel_Skel
                    width={44}
                    height={13}
                    style={{ margin: "0 auto 12px" }}
                />
                {[80, 90, 75, 85, 70].map((w, i) => (
                    <AgendaPanel_Skel
                        key={i}
                        width={`${w}%`}
                        height={isMobile ? 32 : 26}
                        style={{ marginBottom: 6, borderRadius: 8 }}
                    />
                ))}
            </div>
            <div
                style={{
                    flex: 1,
                    display: "grid",
                    gridTemplateColumns: `repeat(${colsDias}, minmax(0, 1fr))`,
                    gap: isMobile ? 8 : 10,
                    alignContent: "start",
                }}
            >
                {[4, 3, 2, 3].map((cant, i) => (
                    <div
                        key={i}
                        style={{
                            background: AgendaPanel_SURFACE,
                            borderRadius: isMobile ? 14 : 16,
                            border: `1px solid ${AgendaPanel_HAIRLINE}`,
                            padding: isMobile ? "12px" : "16px",
                        }}
                    >
                        <AgendaPanel_Skel
                            width={54}
                            height={isMobile ? 20 : 24}
                            style={{ marginBottom: isMobile ? 8 : 12 }}
                        />
                        {Array.from({ length: cant }).map((_, j) => (
                            <AgendaPanel_Skel
                                key={j}
                                width="88%"
                                height={isMobile ? 30 : 24}
                                style={{ marginBottom: 6, borderRadius: 8 }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

function AgendaPanel_Skel({ width, height, style = {} }: any) {
    return (
        <div
            style={{
                width,
                height,
                borderRadius: 6,
                background:
                    "linear-gradient(90deg,#F1F0EC 25%,#E9E8E3 50%,#F1F0EC 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
                ...style,
            }}
        />
    )
}

function AgendaPanel_WhatsAppIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    )
}

export { AgendaPanel, AgendaPanel_InfoRow, AgendaPanel_Layout, AgendaPanel_CalendarTurno, AgendaPanel_DiaCard, AgendaPanel_TimelineList, AgendaPanel_TurnoRow, AgendaPanel_SkeletonAgenda, AgendaPanel_Skel, AgendaPanel_WhatsAppIcon }
