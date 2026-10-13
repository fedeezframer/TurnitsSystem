import { appConfig } from "../../config"
import * as React from "react"


// ══════════════════════════════════════════════════════════════
// TURNITS — Panel interno de superadmin
// Componente de código para Framer. Pegar en una página protegida
// (ej. /internal). Muestra métricas globales de todos los negocios
// y NO renderiza absolutamente nada hasta confirmar, contra el
// propio backend, que el token guardado es de un superadmin válido.
//
// Cómo funciona el guard de acceso:
//   1. Lee el token de localStorage (access_token / auth_token).
//   2. Si no hay token → redirige a login, sin pintar nada.
//   3. Si hay token, llama a GET /internal/resumen con ese token.
//      Esa ruta usa el middleware requireSuperadmin del backend:
//      si el token no es válido o no es rol "superadmin", el
//      backend responde 401/403 y acá se interpreta como acceso
//      denegado (se limpia el token y se redirige a login).
//   4. Solo si el backend confirma 200 OK se pasa a estado "ready"
//      y recién ahí se muestra el dashboard.
// La validación real vive en el servidor (requireSuperadmin), acá
// solo se respeta esa respuesta — es la única forma correcta de
// hacer esto, porque cualquier chequeo puramente en el cliente
// (ej. "decodificar el JWT y mirar si dice rol=superadmin") se
// puede saltear editando el localStorage a mano.
// ══════════════════════════════════════════════════════════════

const API_URL = appConfig.apiUrl

type EstadoAcceso = "checking" | "ready" | "denied"

interface Negocio {
    id: string
    slug: string
    business_name: string
    nombre_persona: string
    apellido: string
    email: string
    telefono: string
    activo: boolean
    plan: string
    metodo_pago: string
    tiene_mp: boolean
    estado_suscripcion: string
    fecha_vencimiento: string | null
    dias_restantes: number | null
    creado: string
}

interface Resumen {
    total_negocios: number
    negocios_activos: number
    negocios_premium: number
    negocios_vip?: number
    turnos_hoy: number
    registros_hoy: number
    ultimos_negocios: {
        slug: string
        business_name: string
        plan: string
        created_at: string
    }[]
}

interface TurnoHoy {
    id: string
    slug: string
    nombre: string
    apellido: string | null
    hora: string
    servicio_nombre: string | null
    precio_cobrado: number
    estado: string
    pago_estado: string
    metodo_pago: string
}

// ─── Helpers de storage (con guard SSR, por si Framer prerenderiza) ───────
const isBrowser = typeof window !== "undefined"
const getToken = () =>
    isBrowser
        ? localStorage.getItem("access_token") ||
          localStorage.getItem("auth_token") ||
          ""
        : ""
const clearAuth = () => {
    if (!isBrowser) return
    ;[
        "access_token",
        "auth_token",
        "user_slug",
        "auth_slug",
        "business_name",
        "user_email",
    ].forEach((k) => localStorage.removeItem(k))
}

const formatoMoneda = (n: number) =>
    new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(n || 0)

const formatoFecha = (iso: string) => {
    if (!iso) return "—"
    const d = new Date(iso)
    return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    })
}

// ══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function AdminDashboard(props) {
    const { loginPath, refreshSeconds } = props

    const [acceso, setAcceso] = React.useState<EstadoAcceso>("checking")
    const [resumen, setResumen] = React.useState<Resumen | null>(null)
    const [turnosHoy, setTurnosHoy] = React.useState<TurnoHoy[]>([])
    const [negocios, setNegocios] = React.useState<Negocio[]>([])
    const [nombreAdmin, setNombreAdmin] = React.useState("")
    const [filtro, setFiltro] = React.useState("")
    const [filtroPlan, setFiltroPlan] = React.useState<
        "todos" | "premium" | "basico" | "gratis"
    >("todos")
    const [error, setError] = React.useState("")
    const [ultimaActualizacion, setUltimaActualizacion] =
        React.useState<Date | null>(null)

    const irALogin = React.useCallback(() => {
        clearAuth()
        if (isBrowser) window.location.href = loginPath || "/login"
    }, [loginPath])

    const cerrarSesion = () => irALogin()

    // ── Carga de datos, con el chequeo de acceso como paso 1 ──
    const cargarTodo = React.useCallback(async () => {
        const token = getToken()
        if (!token) {
            setAcceso("denied")
            irALogin()
            return
        }

        const headers = { Authorization: `Bearer ${token}` }

        try {
            const resResumen = await fetch(`${API_URL}/internal/resumen`, {
                headers,
            })

            if (resResumen.status === 401 || resResumen.status === 403) {
                setAcceso("denied")
                irALogin()
                return
            }
            if (!resResumen.ok)
                throw new Error("El servidor no respondió correctamente.")

            const dataResumen = await resResumen.json()
            if (!dataResumen.success)
                throw new Error(
                    dataResumen.error || "No se pudo validar el acceso."
                )

            // A partir de acá el token quedó confirmado como superadmin válido.
            setResumen(dataResumen.resumen)
            setNombreAdmin(localStorage.getItem("user_email") || "")
            setAcceso("ready")
            setError("")

            const [resTurnos, resNegocios] = await Promise.all([
                fetch(`${API_URL}/internal/turnos-hoy`, { headers }),
                fetch(`${API_URL}/superadmin/negocios`, { headers }),
            ])

            if (resTurnos.ok) {
                const dTurnos = await resTurnos.json()
                if (dTurnos.success) setTurnosHoy(dTurnos.turnos || [])
            }
            if (resNegocios.ok) {
                const dNegocios = await resNegocios.json()
                if (dNegocios.success) setNegocios(dNegocios.negocios || [])
            }

            setUltimaActualizacion(new Date())
        } catch (e: any) {
            setError(e.message || "Error de conexión con el servidor.")
            // Si ya habíamos confirmado acceso antes, no lo revocamos por un
            // error de red puntual; solo mostramos el aviso.
            setAcceso((prev) => (prev === "checking" ? "denied" : prev))
        }
    }, [irALogin])

    React.useEffect(() => {
        cargarTodo()
        if (!refreshSeconds || refreshSeconds <= 0) return
        const id = setInterval(cargarTodo, refreshSeconds * 1000)
        return () => clearInterval(id)
    }, [cargarTodo, refreshSeconds])

    // ── Mientras no esté confirmado el acceso, NO se pinta nada del dashboard ──
    if (acceso === "checking") {
        return (
            <div style={styles.pantallaCompleta}>
                <div style={styles.spinner} />
                <div style={styles.textoVerificando}>Verificando acceso…</div>
            </div>
        )
    }

    if (acceso === "denied") {
        return (
            <div style={styles.pantallaCompleta}>
                <div style={styles.textoVerificando}>Redirigiendo…</div>
            </div>
        )
    }

    // ── Filtro de negocios (búsqueda en vivo) ──
    const negociosFiltrados = negocios.filter((n) => {
        const coincideTexto =
            !filtro ||
            n.business_name?.toLowerCase().includes(filtro.toLowerCase()) ||
            n.email?.toLowerCase().includes(filtro.toLowerCase()) ||
            n.slug?.toLowerCase().includes(filtro.toLowerCase())
        const coincidePlan = filtroPlan === "todos" || n.plan === filtroPlan
        return coincideTexto && coincidePlan
    })

    return (
        <div style={styles.contenedor}>
            <style>{`
                @keyframes girar { to { transform: rotate(360deg) } }
                .ad-row:hover { background: #15161c !important; }
                .ad-input::placeholder { color: #55575f; }
                .ad-input:focus, .ad-select:focus { outline: none; border-color: #6366F1 !important; }
                .ad-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
                .ad-scroll::-webkit-scrollbar-thumb { background: #2a2b33; border-radius: 8px; }
            `}</style>

            {/* ── Header ── */}
            <div style={styles.header}>
                <div>
                    <div style={styles.eyebrow}>TURNITS · PANEL INTERNO</div>
                    <h1 style={styles.titulo}>Estado de la plataforma</h1>
                </div>
                <div style={styles.headerDerecha}>
                    {ultimaActualizacion && (
                        <span style={styles.tsActualizacion}>
                            Actualizado{" "}
                            {ultimaActualizacion.toLocaleTimeString("es-AR")}
                        </span>
                    )}
                    {nombreAdmin && (
                        <span style={styles.emailAdmin}>{nombreAdmin}</span>
                    )}
                    <button style={styles.botonSalir} onClick={cerrarSesion}>
                        Cerrar sesión
                    </button>
                </div>
            </div>

            {error && <div style={styles.bannerError}>⚠ {error}</div>}

            {/* ── KPIs ── */}
            <div style={styles.grillaKpis}>
                <TarjetaKpi
                    label="Negocios totales"
                    valor={resumen?.total_negocios ?? "—"}
                    acento="#6366F1"
                />
                <TarjetaKpi
                    label="Negocios activos"
                    valor={resumen?.negocios_activos ?? "—"}
                    acento="#22C55E"
                />
                <TarjetaKpi
                    label="En plan Básico"
                    valor={resumen?.negocios_premium ?? "—"}
                    acento="#EC4899"
                />
                <TarjetaKpi
                    label="En plan Premium"
                    valor={resumen?.negocios_vip ?? "—"}
                    acento="#F59E0B"
                />
                <TarjetaKpi
                    label="Turnos de hoy"
                    valor={resumen?.turnos_hoy ?? "—"}
                    acento="#F59E0B"
                />
                <TarjetaKpi
                    label="Registros hoy"
                    valor={resumen?.registros_hoy ?? "—"}
                    acento="#38BDF8"
                />
            </div>

            {/* ── Dos columnas: turnos de hoy / últimos negocios ── */}
            <div style={styles.grillaDosColumnas}>
                <Panel titulo={`Turnos de hoy (${turnosHoy.length})`}>
                    <div className="ad-scroll" style={styles.scrollVertical}>
                        {turnosHoy.length === 0 ? (
                            <EstadoVacio texto="No hay turnos registrados hoy todavía." />
                        ) : (
                            <table style={styles.tabla}>
                                <thead>
                                    <tr>
                                        <Th>Hora</Th>
                                        <Th>Negocio</Th>
                                        <Th>Cliente</Th>
                                        <Th>Servicio</Th>
                                        <Th align="right">Monto</Th>
                                        <Th>Estado</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {turnosHoy.map((t) => (
                                        <tr key={t.id} className="ad-row">
                                            <Td mono>{t.hora?.slice(0, 5)}</Td>
                                            <Td>{t.slug}</Td>
                                            <Td>
                                                {t.nombre} {t.apellido || ""}
                                            </Td>
                                            <Td muted>
                                                {t.servicio_nombre || "—"}
                                            </Td>
                                            <Td align="right" mono>
                                                {formatoMoneda(
                                                    t.precio_cobrado
                                                )}
                                            </Td>
                                            <Td>
                                                <Badge estado={t.estado} />
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Panel>

                <Panel titulo="Últimos negocios registrados">
                    <div className="ad-scroll" style={styles.scrollVertical}>
                        {(resumen?.ultimos_negocios?.length ?? 0) === 0 ? (
                            <EstadoVacio texto="Todavía no hay registros." />
                        ) : (
                            <table style={styles.tabla}>
                                <thead>
                                    <tr>
                                        <Th>Negocio</Th>
                                        <Th>Plan</Th>
                                        <Th align="right">Alta</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumen!.ultimos_negocios.map((n) => (
                                        <tr key={n.slug} className="ad-row">
                                            <Td>{n.business_name}</Td>
                                            <Td>
                                                <Badge plan={n.plan} />
                                            </Td>
                                            <Td align="right" muted mono>
                                                {formatoFecha(n.created_at)}
                                            </Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Panel>
            </div>

            {/* ── Tabla completa de negocios ── */}
            <Panel
                titulo={`Todos los negocios (${negociosFiltrados.length}${
                    negociosFiltrados.length !== negocios.length
                        ? ` de ${negocios.length}`
                        : ""
                })`}
            >
                <div style={styles.filtrosFila}>
                    <input
                        className="ad-input"
                        style={styles.input}
                        placeholder="Buscar por nombre, email o slug…"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                    />
                    <select
                        className="ad-select"
                        style={styles.select}
                        value={filtroPlan}
                        onChange={(e) => setFiltroPlan(e.target.value as any)}
                    >
                        <option value="todos">Todos los planes</option>
                        <option value="basico">Básico</option>
                        <option value="premium">Premium</option>
                        <option value="gratis">Gratis</option>
                    </select>
                </div>

                <div
                    className="ad-scroll"
                    style={{ ...styles.scrollVertical, maxHeight: 420 }}
                >
                    {negociosFiltrados.length === 0 ? (
                        <EstadoVacio texto="Ningún negocio coincide con ese filtro." />
                    ) : (
                        <table style={styles.tabla}>
                            <thead>
                                <tr>
                                    <Th>Negocio</Th>
                                    <Th>Dueño</Th>
                                    <Th>Contacto</Th>
                                    <Th>Plan</Th>
                                    <Th>MP</Th>
                                    <Th>Suscripción</Th>
                                    <Th align="right">Vence en</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {negociosFiltrados.map((n) => (
                                    <tr key={n.id} className="ad-row">
                                        <Td>
                                            <div style={{ fontWeight: 600 }}>
                                                {n.business_name}
                                            </div>
                                            <div style={styles.subtexto}>
                                                /{n.slug}
                                            </div>
                                        </Td>
                                        <Td muted>
                                            {n.nombre_persona}{" "}
                                            {n.apellido || ""}
                                        </Td>
                                        <Td muted>
                                            <div>{n.email}</div>
                                            <div style={styles.subtexto}>
                                                {n.telefono || "—"}
                                            </div>
                                        </Td>
                                        <Td>
                                            <Badge plan={n.plan} />
                                        </Td>
                                        <Td>
                                            <span
                                                style={{
                                                    color: n.tiene_mp
                                                        ? "#22C55E"
                                                        : "#55575f",
                                                }}
                                            >
                                                {n.tiene_mp ? "Conectado" : "—"}
                                            </span>
                                        </Td>
                                        <Td>
                                            <Badge
                                                estadoSuscripcion={
                                                    !n.activo
                                                        ? "desactivado"
                                                        : n.estado_suscripcion
                                                }
                                            />
                                        </Td>
                                        <Td align="right" mono muted>
                                            {n.dias_restantes === null
                                                ? "—"
                                                : n.dias_restantes <= 0
                                                  ? "Vencido"
                                                  : `${n.dias_restantes}d`}
                                        </Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Panel>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════
// SUBCOMPONENTES DE PRESENTACIÓN
// ══════════════════════════════════════════════════════════════
function TarjetaKpi({
    label,
    valor,
    acento,
}: {
    label: string
    valor: React.ReactNode
    acento: string
}) {
    return (
        <div style={{ ...styles.tarjetaKpi, borderTopColor: acento }}>
            <div style={styles.kpiValor}>{valor}</div>
            <div style={styles.kpiLabel}>{label}</div>
        </div>
    )
}

function Panel({
    titulo,
    children,
}: {
    titulo: string
    children: React.ReactNode
}) {
    return (
        <div style={styles.panel}>
            <div style={styles.panelTitulo}>{titulo}</div>
            {children}
        </div>
    )
}

function EstadoVacio({ texto }: { texto: string }) {
    return <div style={styles.estadoVacio}>{texto}</div>
}

function Th({
    children,
    align = "left",
}: {
    children: React.ReactNode
    align?: "left" | "right"
}) {
    return <th style={{ ...styles.th, textAlign: align }}>{children}</th>
}

function Td({
    children,
    align = "left",
    mono = false,
    muted = false,
}: {
    children: React.ReactNode
    align?: "left" | "right"
    mono?: boolean
    muted?: boolean
}) {
    return (
        <td
            style={{
                ...styles.td,
                textAlign: align,
                fontFamily: mono
                    ? "'JetBrains Mono', 'SF Mono', monospace"
                    : undefined,
                color: muted ? "#8a8c96" : undefined,
            }}
        >
            {children}
        </td>
    )
}

function Badge({
    plan,
    estado,
    estadoSuscripcion,
}: {
    plan?: string
    estado?: string
    estadoSuscripcion?: string
}) {
    let texto = ""
    let color = "#8a8c96"
    let fondo = "#FFFFFF"

    if (plan) {
        texto = plan === "premium" ? "Premium" : plan === "basico" ? "Básico" : "Gratis"
        color = plan === "premium" ? "#EC4899" : "#8a8c96"
        fondo =
            plan === "premium"
                ? "rgba(236,72,153,0.14)"
                : "rgba(138,140,150,0.12)"
    } else if (estado) {
        const mapa: Record<string, [string, string, string]> = {
            confirmado: ["Confirmado", "#22C55E", "rgba(34,197,94,0.14)"],
            pendiente: ["Pendiente", "#F59E0B", "rgba(245,158,11,0.14)"],
            cancelado: ["Cancelado", "#EF4444", "rgba(239,68,68,0.14)"],
            completado: ["Completado", "#38BDF8", "rgba(56,189,248,0.14)"],
            no_asistio: ["No asistió", "#8a8c96", "rgba(138,140,150,0.12)"],
        }
        ;[texto, color, fondo] = mapa[estado] || [
            estado,
            "#8a8c96",
            "rgba(138,140,150,0.12)",
        ]
    } else if (estadoSuscripcion) {
        const mapa: Record<string, [string, string, string]> = {
            activo: ["Activo", "#22C55E", "rgba(34,197,94,0.14)"],
            trial: ["Trial", "#38BDF8", "rgba(56,189,248,0.14)"],
            suspendido: ["Suspendido", "#EF4444", "rgba(239,68,68,0.14)"],
            desactivado: ["Desactivado", "#8a8c96", "rgba(138,140,150,0.12)"],
        }
        ;[texto, color, fondo] = mapa[estadoSuscripcion] || [
            estadoSuscripcion,
            "#8a8c96",
            "rgba(138,140,150,0.12)",
        ]
    }

    return (
        <span
            style={{
                display: "inline-block",
                padding: "3px 9px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color,
                background: fondo,
                whiteSpace: "nowrap",
            }}
        >
            {texto}
        </span>
    )
}

// ══════════════════════════════════════════════════════════════
// ESTILOS
// ══════════════════════════════════════════════════════════════
const FUENTE =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif"

const styles: Record<string, React.CSSProperties> = {
    contenedor: {
        fontFamily: FUENTE,
        background: "#0b0c10",
        color: "#e7e8ec",
        minHeight: "100%",
        width: "100%",
        padding: "28px 32px 60px",
        boxSizing: "border-box",
    },
    pantallaCompleta: {
        fontFamily: FUENTE,
        background: "#0b0c10",
        color: "#8a8c96",
        width: "100%",
        height: "100%",
        minHeight: 400,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
    },
    spinner: {
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: "3px solid #23242c",
        borderTopColor: "#6366F1",
        animation: "girar 0.8s linear infinite",
    },
    textoVerificando: { fontSize: 14, letterSpacing: 0.3 },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 26,
        flexWrap: "wrap",
        gap: 12,
    },
    eyebrow: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.5,
        color: "#6366F1",
        marginBottom: 6,
    },
    titulo: { fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.3 },
    headerDerecha: { display: "flex", alignItems: "center", gap: 14 },
    tsActualizacion: { fontSize: 12, color: "#55575f" },
    emailAdmin: { fontSize: 13, color: "#8a8c96" },
    botonSalir: {
        background: "transparent",
        border: "1px solid #2a2b33",
        color: "#e7e8ec",
        borderRadius: 8,
        padding: "7px 14px",
        fontSize: 13,
        cursor: "pointer",
        fontFamily: FUENTE,
    },
    bannerError: {
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.3)",
        color: "#fca5a5",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        marginBottom: 20,
    },
    grillaKpis: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 14,
        marginBottom: 24,
    },
    tarjetaKpi: {
        background: "#121319",
        border: "1px solid #1e1f27",
        borderTop: "3px solid",
        borderRadius: 12,
        padding: "16px 18px",
    },
    kpiValor: {
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: -0.5,
        fontVariantNumeric: "tabular-nums",
    },
    kpiLabel: { fontSize: 12.5, color: "#8a8c96", marginTop: 4 },
    grillaDosColumnas: {
        display: "grid",
        gridTemplateColumns: "1.3fr 1fr",
        gap: 16,
        marginBottom: 16,
    },
    panel: {
        background: "#121319",
        border: "1px solid #1e1f27",
        borderRadius: 12,
        padding: "16px 18px 8px",
        marginBottom: 16,
    },
    panelTitulo: {
        fontSize: 13,
        fontWeight: 700,
        color: "#c7c8ce",
        marginBottom: 12,
    },
    scrollVertical: { maxHeight: 340, overflowY: "auto" },
    filtrosFila: {
        display: "flex",
        gap: 10,
        marginBottom: 12,
        flexWrap: "wrap",
    },
    input: {
        flex: 1,
        minWidth: 200,
        background: "#0b0c10",
        border: "1px solid #23242c",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#e7e8ec",
        fontSize: 13,
        fontFamily: FUENTE,
    },
    select: {
        background: "#0b0c10",
        border: "1px solid #23242c",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#e7e8ec",
        fontSize: 13,
        fontFamily: FUENTE,
    },
    tabla: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: {
        position: "sticky",
        top: 0,
        background: "#121319",
        color: "#55575f",
        fontWeight: 600,
        fontSize: 11.5,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        padding: "8px 10px",
        borderBottom: "1px solid #1e1f27",
    },
    td: { padding: "10px 10px", borderBottom: "1px solid #17181e" },
    subtexto: { fontSize: 11.5, color: "#55575f", marginTop: 2 },
    estadoVacio: {
        padding: "30px 10px",
        textAlign: "center",
        color: "#55575f",
        fontSize: 13,
    },
}

// ══════════════════════════════════════════════════════════════
// PROPERTY CONTROLS (configurables desde el panel de Framer)
// ══════════════════════════════════════════════════════════════

