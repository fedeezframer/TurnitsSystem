import { BackButton } from "../../components/BackButton"
import LoadingRunner, { InlineLoading } from "../../components/LoadingRunner"
import { OwnerOnly, useBranchAdmin } from "../../components/BranchAdmin"
import { appConfig } from "../../config"
import { useQuoteMode } from "../../shared/agenda-mode"
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
import { TeamManager_getSlug, TeamManager_getToken, TeamManager_COLORES, TeamManager_ServicioAsignable, TeamManager_NetoData, TeamManager_PERIODOS_NETO, TeamManager_fmtPesos, TeamManager_FORM_EMPTY, TeamManager_FormData, TeamManager_ROLES, TeamManager_OwnerFallback, TeamManager_Miembro, TeamManager_cardBase, TeamManager_shimmerCSS, TeamManager_useContainerWidth, TurnitsLockedStyle, SeccionId } from "./common"
import { Turnits_ImageAdjustDialog } from "./servicios"
import { TurnitsPlanRequirement } from "./shared"
import { TeamManager_PlaceholderIcon } from "./temas"

function TeamManager_Avatar({
    nombre,
    color,
    fotoUrl,
    size = 44,
}: {
    nombre: string
    color: string
    fotoUrl?: string | null
    size?: number
}) {
    const [imgError, setImgError] = React.useState(false)
    const showImg = !!fotoUrl && !imgError

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: 6,
                background: showImg ? "#f1f5f9" : color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: size * 0.38,
                flexShrink: 0,
                letterSpacing: "-0.5px",
                boxShadow: showImg ? "none" : `0 2px 8px ${color}44`,
                overflow: "hidden",
            }}
        >
            {showImg ? (
                <img
                    src={fotoUrl as string}
                    alt=""
                    onError={() => setImgError(true)}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            ) : (
                nombre.trim().split(/\s+/).slice(0, 2).map(parte => parte.charAt(0).toUpperCase()).join("")
            )}
        </div>
    )
}

function TeamManager_FotoUploader({
    value,
    nombre,
    color,
    onChange,
    apiUrl,
}: {
    value: string
    nombre: string
    color: string
    onChange: (url: string) => void
    apiUrl: string
}) {
    const [uploading, setUploading] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)
    const [cropFile, setCropFile] = React.useState<File | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const uploadFile = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            alert("Solo se permiten imágenes (JPG, PNG, WEBP).")
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            alert("La imagen no puede superar 3 MB.")
            return
        }
        setUploading(true)
        try {
            const slug = TeamManager_getSlug()
            const token = TeamManager_getToken()
            const formData = new FormData()
            formData.append("foto", file)
            formData.append("slug", slug)

            const res = await fetch(`${apiUrl}/admin/equipo/upload-foto`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || "Error al subir la foto")
            onChange(data.url)
            setImgError(false)
        } catch (e: any) {
            alert("Error al subir: " + e.message)
        }
        setUploading(false)
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 3 * 1024 * 1024)
                alert("La imagen no puede superar 3 MB.")
            else if (
                ["image/jpeg", "image/png", "image/webp"].includes(file.type)
            )
                setCropFile(file)
            else alert("Elegí una imagen JPG, PNG o WEBP.")
        }
        e.target.value = ""
    }

    const showImg = value && !imgError

    return (
        <>
            {cropFile && (
                <Turnits_ImageAdjustDialog
                    file={cropFile}
                    aspect={1}
                    onCancel={() => setCropFile(null)}
                    onApply={(adjusted) => {
                        setCropFile(null)
                        uploadFile(adjusted)
                    }}
                />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                    onClick={() => !uploading && inputRef.current?.click()}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: showImg ? "#f1f5f9" : color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 800,
                        fontSize: 20,
                        cursor: uploading ? "not-allowed" : "pointer",
                        overflow: "hidden",
                        flexShrink: 0,
                        boxShadow: showImg ? "none" : `0 2px 8px ${color}44`,
                    }}
                >
                    {uploading ? (
                        <div
                            style={{
                                width: 18,
                                height: 18,
                                border: "2px solid #ffffff66",
                                borderTop: "2px solid #fff",
                                borderRadius: "50%",
                                animation: "tm-spin 0.7s linear infinite",
                            }}
                        />
                    ) : showImg ? (
                        <img
                            src={value}
                            alt=""
                            onError={() => setImgError(true)}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                        />
                    ) : (
                        (nombre || "?").charAt(0).toUpperCase()
                    )}
                </div>

                <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#64748b",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                        }}
                    >
                        Foto de perfil
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                        <button
                            className="turnits-image-action"
                            onClick={() =>
                                !uploading && inputRef.current?.click()
                            }
                            disabled={uploading}
                            style={{
                                padding: "6px 12px",
                                borderRadius: 8,
                                border: "1.5px solid #e2e8f0",
                                background: "#f8fafc",
                                color: "#64748b",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: uploading ? "not-allowed" : "pointer",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                            }}
                        >
                            {uploading
                                ? "Subiendo…"
                                : showImg
                                  ? "Cambiar foto"
                                  : "Subir foto"}
                        </button>
                        {showImg && (
                            <button
                                onClick={() => {
                                    onChange("")
                                    setImgError(false)
                                }}
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    border: "1.5px solid #fee2e2",
                                    background: "#fff5f5",
                                    color: "#ef4444",
                                    fontSize: 11.5,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontFamily:
                                        "'Inter Display', -apple-system, sans-serif",
                                }}
                            >
                                Quitar
                            </button>
                        )}
                    </div>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFile}
                    style={{ display: "none" }}
                />
            </div>
        </>
    )
}

function TeamManager_RolBadge({
    rol,
    accentColor,
}: {
    rol: string
    accentColor: string
}) {
    const esAdmin = rol === "admin" || rol === "dueño"
    return (
        <span
            style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 20,
                background: esAdmin ? accentColor + "18" : "#f1f5f9",
                color: esAdmin ? accentColor : "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
            }}
        >
            {rol}
        </span>
    )
}

function TeamManager_ColorPicker({
    value,
    onChange,
}: {
    value: string
    onChange: (c: string) => void
}) {
    return (
        <div
            style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
            }}
        >
            {TeamManager_COLORES.map((c) => (
                <div
                    key={c}
                    className="tm-color-dot"
                    onClick={() => onChange(c)}
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: c,
                        cursor: "pointer",
                        transition: "transform 0.12s",
                        outline:
                            value === c
                                ? `3px solid ${c}`
                                : "3px solid transparent",
                        outlineOffset: 2,
                        flexShrink: 0,
                    }}
                />
            ))}
        </div>
    )
}

function TeamManager_Field({
    label,
    children,
    hint,
}: {
    label: string
    children: React.ReactNode
    hint?: string
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label
                style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </label>
            {children}
            {hint && (
                <span style={{ fontSize: 10, color: "#cbd5e1" }}>{hint}</span>
            )}
        </div>
    )
}

function TeamManager_TmInput({
    value,
    onChange,
    placeholder,
    type = "text",
}: any) {
    return (
        <input
            className="tm-input"
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                fontSize: 13,
                color: "#1e293b",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                background: "#fff",
                width: "100%",
                boxSizing: "border-box" as const,
                transition: "border-color 0.15s",
            }}
        />
    )
}

function TeamManager_ServiciosVinculados({
    equipoId,
    accentColor,
    apiUrl,
    isMobile,
    routePrefix = '/admin/equipo',
}: {
    equipoId: string
    accentColor: string
    apiUrl: string
    isMobile: boolean
    routePrefix?: string
}) {
    const [loading, setLoading] = React.useState(true)
    const quoteMode = useQuoteMode(apiUrl)
    const [servicios, setServicios] = React.useState<
        TeamManager_ServicioAsignable[]
    >([])
    const [error, setError] = React.useState("")
    const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set())

    React.useEffect(() => {
        let activo = true
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        setLoading(true)
        setError("")
        fetch(
            `${apiUrl}${routePrefix}/${equipoId}/servicios-disponibles?slug=${slug}`,
            { headers: { Authorization: `Bearer ${token}` } }
        )
            .then((r) => r.json())
            .then((data) => {
                if (!activo) return
                if (data.success) setServicios(data.servicios || [])
                else
                    setError(
                        data.error || "No se pudieron cargar los servicios."
                    )
                setLoading(false)
            })
            .catch(() => {
                if (!activo) return
                setError("No se pudieron cargar los servicios.")
                setLoading(false)
            })
        return () => {
            activo = false
        }
    }, [equipoId, apiUrl,routePrefix])

    const toggle = async (servicio: TeamManager_ServicioAsignable) => {
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        const nuevoEstado = !servicio.vinculado

        setPendingIds((p) => new Set(p).add(servicio.id))
        setServicios((prev) =>
            prev.map((s) =>
                s.id === servicio.id ? { ...s, vinculado: nuevoEstado } : s
            )
        )

        try {
            const res = nuevoEstado
                ? await fetch(`${apiUrl}${routePrefix}/${equipoId}/servicios`, {
                      method: "POST",
                      headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ servicio_id: servicio.id, slug }),
                  })
                : await fetch(
                      `${apiUrl}${routePrefix}/${equipoId}/servicios/${servicio.id}?slug=${slug}`,
                      {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
                      }
                  )
            if (!res.ok) throw new Error()
        } catch {
            setServicios((prev) =>
                prev.map((s) =>
                    s.id === servicio.id
                        ? { ...s, vinculado: servicio.vinculado }
                        : s
                )
            )
        }

        setPendingIds((p) => {
            const next = new Set(p)
            next.delete(servicio.id)
            return next
        })
    }

    if (loading) return <InlineLoading label="Cargando servicios del miembro…" />

    if (error) {
        return <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
    }

    if (servicios.length === 0) {
        return (
            <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>
                Todavía no cargaste servicios. Creá el primero desde el panel de
                Servicios y volvé acá para asignárselo a este profesional.
            </span>
        )
    }

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {servicios.map((s) => {
                const sel = s.vinculado
                const pending = pendingIds.has(s.id)
                return (
                    <div
                        key={s.id}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                        }}
                    >
                        <button
                            onClick={() => !pending && toggle(s)}
                            disabled={pending}
                            title={
                                !s.activo
                                    ? "Este servicio está inactivo"
                                    : undefined
                            }
                            style={{
                                padding: isMobile ? "7px 12px" : "6px 13px",
                                borderRadius: 9,
                                border: `1.5px solid ${sel ? accentColor : "#e2e8f0"}`,
                                background: sel ? accentColor : "#fff",
                                color: sel ? "#fff" : "#475569",
                                fontSize: isMobile ? 13 : 12,
                                fontWeight: 700,
                                cursor: pending ? "wait" : "pointer",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                                transition: "all 0.12s",
                                opacity: pending ? 0.6 : s.activo ? 1 : 0.55,
                            }}
                        >
                            {s.nombre} · {quoteMode ? "A presupuestar" : `$${s.precio.toLocaleString("es-AR")}`}
                            {!s.activo ? " (inactivo)" : ""}
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

function TeamManager_PromocionesVinculadas({
    equipoId,
    accentColor,
    apiUrl,
    isMobile,
}: {
    equipoId: string
    accentColor: string
    apiUrl: string
    isMobile: boolean
}) {
    const [loading, setLoading] = React.useState(true)
    const [promociones, setPromociones] = React.useState<
        any[]
    >([])
    const [error, setError] = React.useState("")
    const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set())

    React.useEffect(() => {
        let activo = true
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        setLoading(true)
        setError("")
        fetch(
            `${apiUrl}/admin/equipo/${equipoId}/promociones-disponibles?slug=${slug}`,
            { headers: { Authorization: `Bearer ${token}` } }
        )
            .then((r) => r.json())
            .then((data) => {
                if (!activo) return
                if (data.success) setPromociones(data.promociones || [])
                else
                    setError(
                        data.error || "No se pudieron cargar los promociones."
                    )
                setLoading(false)
            })
            .catch(() => {
                if (!activo) return
                setError("No se pudieron cargar los promociones.")
                setLoading(false)
            })
        return () => {
            activo = false
        }
    }, [equipoId, apiUrl])

    const toggle = async (promocion: any) => {
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        if(pendingIds.has(promocion.id))return
        setError("")
        const nuevoEstado = !promocion.vinculado

        setPendingIds((p) => new Set(p).add(promocion.id))
        setPromociones((prev) =>
            prev.map((s) =>
                s.id === promocion.id ? { ...s, vinculado: nuevoEstado } : s
            )
        )

        try {
            const res = nuevoEstado
                ? await fetch(`${apiUrl}/admin/equipo/${equipoId}/promociones`, {
                      method: "POST",
                      headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ promocion_id: promocion.id, slug }),
                  })
                : await fetch(
                      `${apiUrl}/admin/equipo/${equipoId}/promociones/${promocion.id}?slug=${slug}`,
                      {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
                      }
                  )
            const data=await res.json().catch(()=>({}));if (!res.ok || !data.success) throw new Error(data.error || "No se pudo cambiar la asignación.")
        } catch (e: any) {
            setError(e.message || "No se pudo cambiar la asignación.")
            setPromociones((prev) =>
                prev.map((s) =>
                    s.id === promocion.id
                        ? { ...s, vinculado: promocion.vinculado }
                        : s
                )
            )
        }

        setPendingIds((p) => {
            const next = new Set(p)
            next.delete(promocion.id)
            return next
        })
    }

    if (loading) return <InlineLoading label="Cargando promociones del miembro…" />

    if (error && promociones.length === 0) return <span role="alert" style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>

    if (promociones.length === 0) {
        return (
            <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>
                Todavía no cargaste promociones. Creá una desde Servicios → Promociones y volvé acá para asignarla.
            </span>
        )
    }

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {error && <span role="alert" style={{width:"100%",fontSize:12,color:"#ef4444"}}>{error}</span>}
            {promociones.map((s) => {
                const sel = s.vinculado
                const pending = pendingIds.has(s.id)
                return (
                    <div
                        key={s.id}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                        }}
                    >
                        <button
                            type="button"
                            aria-pressed={sel}
                            onClick={() => !pending && toggle(s)}
                            disabled={pending}
                            title={
                                !s.activo
                                    ? "Este promocion está inactivo"
                                    : undefined
                            }
                            style={{
                                padding: isMobile ? "7px 12px" : "6px 13px",
                                borderRadius: 9,
                                border: `1.5px solid ${sel ? accentColor : "#e2e8f0"}`,
                                background: sel ? accentColor : "#fff",
                                color: sel ? "#fff" : "#475569",
                                fontSize: isMobile ? 13 : 12,
                                fontWeight: 700,
                                cursor: pending ? "wait" : "pointer",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                                transition: "all 0.12s",
                                opacity: pending ? 0.6 : s.activo ? 1 : 0.55,
                            }}
                        >
                            {s.nombre} · ${s.precio.toLocaleString("es-AR")}
                            {!s.activo ? " (inactivo)" : ""}
                        </button>
                    </div>
                )
            })}
        </div>
    )
}

function TeamManager_MetricaNeto({
    equipoId,
    accentColor,
    apiUrl,
    isMobile,
}: {
    equipoId: string
    accentColor: string
    apiUrl: string
    isMobile: boolean
}) {
    const [periodo, setPeriodo] = React.useState("mes")
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [data, setData] = React.useState<TeamManager_NetoData | null>(null)

    React.useEffect(() => {
        let activo = true
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        setLoading(true)
        setError("")
        fetch(
            `${apiUrl}/admin/equipo/${equipoId}/neto?periodo=${periodo}&slug=${slug}`,
            { headers: { Authorization: `Bearer ${token}` }, cache: "no-cache" }
        )
            .then((r) => r.json())
            .then((d) => {
                if (!activo) return
                if (d.success) setData(d)
                else
                    setError(d.error || "No se pudieron calcular los ingresos.")
                setLoading(false)
            })
            .catch(() => {
                if (!activo) return
                setError("No se pudieron calcular los ingresos.")
                setLoading(false)
            })
        return () => {
            activo = false
        }
    }, [equipoId, periodo, apiUrl])

    const fila = (label: string, valor: string, resta = false) => (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                fontSize: isMobile ? 12 : 12.5,
                color: "#64748b",
            }}
        >
            <span>{label}</span>
            <span style={{ fontWeight: 600, color: "#475569" }}>
                {resta ? "− " : ""}
                {valor}
            </span>
        </div>
    )

    return (
        <TeamManager_Field
            label="Ingresos netos"
            hint="Neto = turnos cobrados menos las comisiones de Mercado Pago. Efectivo y transferencia no tienen comisión."
        >
            <div style={{ display: "flex", gap: 6 }}>
                {TeamManager_PERIODOS_NETO.map((p) => {
                    const sel = p.id === periodo
                    return (
                        <button
                            key={p.id}
                            onClick={() => setPeriodo(p.id)}
                            style={{
                                flex: 1,
                                padding: isMobile ? "7px 0" : "6px 0",
                                borderRadius: 8,
                                border: "none",
                                fontSize: isMobile ? 12 : 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                background: sel ? accentColor : "#f1f5f9",
                                color: sel ? "#fff" : "#64748b",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                            }}
                        >
                            {p.label}
                        </button>
                    )
                })}
            </div>

            {error ? (
                <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
            ) : loading && !data ? (
                <div
                    className="tm-shimmer"
                    style={{ height: 96, borderRadius: 12 }}
                />
            ) : data ? (
                <div
                    style={{
                        padding: isMobile ? "12px" : "14px",
                        borderRadius: 12,
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        opacity: loading ? 0.5 : 1,
                        transition: "opacity 0.15s",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 8,
                        }}
                    >
                        <span
                            style={{
                                fontSize: isMobile ? 22 : 26,
                                fontWeight: 800,
                                color: "#0f172a",
                                letterSpacing: "-0.5px",
                            }}
                        >
                            {TeamManager_fmtPesos(data.neto)}
                        </span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            {data.turnos}{" "}
                            {data.turnos === 1 ? "turno" : "turnos"}
                        </span>
                    </div>
                    <div
                        style={{
                            borderTop: "1px solid #f1f5f9",
                            paddingTop: 8,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                        }}
                    >
                        {fila("Bruto", TeamManager_fmtPesos(data.bruto))}
                        {fila(
                            "Comisión Mercado Pago",
                            TeamManager_fmtPesos(data.comision_mp),
                            true
                        )}
                        {data.comision_plataforma > 0 &&
                            fila(
                                "Comisión Turnits",
                                TeamManager_fmtPesos(data.comision_plataforma),
                                true
                            )}
                    </div>
                    {data.turnos_sin_comision > 0 && (
                        <span
                            style={{
                                fontSize: 10.5,
                                color: "#b45309",
                                lineHeight: 1.4,
                                marginTop: 2,
                            }}
                        >
                            {data.turnos_sin_comision}{" "}
                            {data.turnos_sin_comision === 1
                                ? "turno cobrado por Mercado Pago no tiene"
                                : "turnos cobrados por Mercado Pago no tienen"}{" "}
                            la comisión registrada (son anteriores a esta
                            función): se cuentan sin descuento.
                        </span>
                    )}
                </div>
            ) : null}
        </TeamManager_Field>
    )
}

function TeamManager_MiembroForm({
    initial = TeamManager_FORM_EMPTY,
    accentColor,
    apiUrl,
    miembroId,
    onSubmit,
    onCancel,
    guardando,
    error,
    modoEdicion,
    isMobile,
    esDueño = false,
}: {
    initial?: TeamManager_FormData
    accentColor: string
    apiUrl: string
    miembroId?: string
    onSubmit: (data: TeamManager_FormData) => Promise<void>
    onCancel: () => void
    guardando: boolean
    error: string
    modoEdicion: boolean
    isMobile: boolean
    esDueño?: boolean
}) {
    const branch = useBranchAdmin()
    const [form, setForm] = React.useState<TeamManager_FormData>(initial)
    const set = (key: keyof TeamManager_FormData) => (val: string) =>
        setForm((p) => ({ ...p, [key]: val }))

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            style={{
                ["--tm-accent" as any]: accentColor,
                background: "#f8fafc",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                padding: isMobile ? "14px" : "18px",
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? 12 : 14,
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <span
                    style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.2px",
                    }}
                >
                    {esDueño
                        ? "Editar titular de la cuenta"
                        : modoEdicion
                          ? "Editar miembro"
                          : "Nuevo miembro"}
                </span>
                <BackButton onClick={onCancel} aria-label="Cerrar" />
            </div>

            {/* Foto de perfil */}
            <TeamManager_FotoUploader
                value={form.foto_url}
                nombre={form.nombre || "?"}
                color={form.color}
                onChange={set("foto_url")}
                apiUrl={apiUrl}
            />

            {/* Preview del nombre + rol en tiempo real */}
            <div>
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: 4,
                    }}
                >
                    {form.nombre || "Nombre del miembro"}
                    {form.apellido ? ` ${form.apellido}` : ""}
                </div>
                <TeamManager_RolBadge
                    rol={esDueño ? "dueño" : form.rol}
                    accentColor={accentColor}
                />
            </div>

            {/* Nombre + Apellido */}
            <div
                style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: isMobile ? "wrap" : "nowrap",
                }}
            >
                <div style={{ flex: 1 }}>
                    <TeamManager_Field label="Nombre *">
                        <TeamManager_TmInput
                            value={form.nombre}
                            onChange={set("nombre")}
                            placeholder="Ana"
                        />
                    </TeamManager_Field>
                </div>
                <div style={{ flex: 1 }}>
                    <TeamManager_Field label="Apellido">
                        <TeamManager_TmInput
                            value={form.apellido}
                            onChange={set("apellido")}
                            placeholder="García"
                        />
                    </TeamManager_Field>
                </div>
            </div>

            {!modoEdicion && !esDueño && (
                <TeamManager_Field
                    label="Email para entrar al panel (opcional)"
                    hint="Le enviamos un enlace para crear su contraseña. Después usa el mismo login que vos."
                >
                    <TeamManager_TmInput
                        type="email"
                        value={form.login_email}
                        onChange={set("login_email")}
                        placeholder="barbero@email.com"
                    />
                </TeamManager_Field>
            )}

            {/* Rol — el dueño queda fijo, el resto elige colaborador/admin */}
            <OwnerOnly>{esDueño ? (
                <TeamManager_Field label="Rol">
                    <div>
                        <TeamManager_RolBadge
                            rol="dueño"
                            accentColor={accentColor}
                        />
                    </div>
                    <span style={{ fontSize: 10, color: "#cbd5e1" }}>
                        El titular de la cuenta siempre es dueño y no se puede
                        desactivar ni eliminar.
                    </span>
                </TeamManager_Field>
            ) : (
                <TeamManager_Field
                    label="Rol"
                    hint="El titular de la cuenta ya figura como dueño"
                >
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {TeamManager_ROLES.map((r) => {
                            const sel = form.rol === r
                            return (
                                <button
                                    key={r}
                                    onClick={() => set("rol")(r)}
                                    style={{
                                        padding: "5px 14px",
                                        borderRadius: 8,
                                        border: `1.5px solid ${sel ? accentColor + "44" : "#e2e8f0"}`,
                                        background: sel
                                            ? accentColor + "18"
                                            : "#fff",
                                        color: sel ? accentColor : "#64748b",
                                        fontSize: 12,
                                        fontWeight: sel ? 700 : 500,
                                        cursor: "pointer",
                                        fontFamily:
                                            "'Inter Display', -apple-system, sans-serif",
                                        transition: "all 0.12s",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {r}
                                </button>
                            )
                        })}
                    </div>
                </TeamManager_Field>
            )}

            </OwnerOnly>{/* Color */}
            <TeamManager_Field label="Color identificador">
                <TeamManager_ColorPicker
                    value={form.color}
                    onChange={(c) => setForm((p) => ({ ...p, color: c }))}
                />
            </TeamManager_Field>

            {!branch && !esDueño && (
                <>
                    <div
                        style={{
                            borderTop: "1px solid #e2e8f0",
                            paddingTop: 12,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#1e293b",
                                marginBottom: 4,
                            }}
                        >
                            Permisos del integrante
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: "#64748b",
                                marginBottom: 10,
                            }}
                        >
                            Como titular, podés cambiar estos permisos cuando
                            quieras.
                        </div>
                        {(
                            [
                                [
                                    "puede_configurar_horarios",
                                    "Puede configurar sus horarios",
                                    "Su disponibilidad y excepciones solo afectan su agenda.",
                                ],
                                [
                                    "puede_recibir_pagos_personales",
                                    "Puede configurar sus pagos",
                                    "Puede administrar los métodos de pago del perfil y conectar su propia cuenta de Mercado Pago.",
                                ],
                                [
                                    "puede_crear_servicios",
                                    "Puede gestionar sus servicios, productos y promociones",
                                    "Lo que cree solo se ofrece en su perfil de la agenda. No modifica el catálogo de otros profesionales.",
                                ],
                            ] as const
                        ).map(([key, label, hint]) => (
                            <label
                                key={key}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 9,
                                    padding: "9px 0",
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!!form[key]}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            [key]: e.target.checked,
                                        }))
                                    }
                                    style={{ marginTop: 2, accentColor }}
                                />
                                <span>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 12,
                                            color: "#1e293b",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {label}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 10.5,
                                            color: "#94a3b8",
                                            marginTop: 2,
                                        }}
                                    >
                                        {hint}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>
                </>
            )}

            {/* Servicios que ofrece — solo disponible editando (dueño o miembro) */}
            {modoEdicion && miembroId && (
                <>
                    <div style={{ borderTop: "1px solid #e2e8f0" }} />
                    <TeamManager_Field
                        label="Servicios que ofrece"
                        hint="Solo estos servicios se le van a mostrar al cliente cuando elija a este profesional"
                    >
                        <TeamManager_ServiciosVinculados
                            equipoId={miembroId}
                            accentColor={accentColor}
                            apiUrl={apiUrl}
                            isMobile={isMobile}
                        />
                    </TeamManager_Field>
                    <TeamManager_Field label="Promociones que ofrece" hint="Asigná primero los servicios del combo. Estas promociones solo aparecen en los perfiles seleccionados; las privadas del empleado siguen siendo suyas.">
                        <TeamManager_PromocionesVinculadas equipoId={miembroId} accentColor={accentColor} apiUrl={apiUrl} isMobile={isMobile} />
                    </TeamManager_Field>

                </>
            )}
            {!modoEdicion && (
                <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                    Una vez creado el miembro vas a poder elegir qué servicios
                    ofrece desde "Editar".
                </span>
            )}

            {error && (
                <span
                    style={{ fontSize: 12, color: "#ef4444", fontWeight: 500 }}
                >
                    {error}
                </span>
            )}

            {/* Botones */}
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: isMobile ? "stretch" : "flex-end",
                    flexDirection: isMobile ? "column-reverse" : "row",
                    paddingTop: 4,
                }}
            >

                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onSubmit(form)}
                    disabled={guardando || !form.nombre.trim()}
                    style={{
                        padding: isMobile ? "11px 20px" : "8px 20px",
                        borderRadius: 10,
                        border: "none",
                        background:
                            guardando || !form.nombre.trim()
                                ? "#94a3b8"
                                : accentColor,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor:
                            guardando || !form.nombre.trim()
                                ? "not-allowed"
                                : "pointer",
                        fontFamily:
                            "'Inter Display', -apple-system, sans-serif",
                        letterSpacing: "-0.2px",
                        transition: "background 0.15s",
                        width: isMobile ? "100%" : "auto",
                    }}
                >
                    {guardando
                        ? "Guardando…"
                        : modoEdicion
                          ? "Guardar cambios"
                          : "Agregar miembro"}
                </motion.button>
            </div>
        </motion.div>
    )
}

function TeamManager_OwnerFallbackCard({
    owner,
    accentColor,
    isMobile,
}: {
    owner: TeamManager_OwnerFallback
    accentColor: string
    isMobile: boolean
}) {
    const nombreCompleto =
        `${owner.nombre || ""} ${owner.apellido || ""}`.trim() ||
        "Titular de la cuenta"

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 10 : 12,
                padding: isMobile ? "10px" : "12px",
                borderRadius: 12,
                background: accentColor + "0A",
                border: `1.5px solid ${accentColor}33`,
                marginBottom: isMobile ? 5 : 6,
            }}
        >
            <TeamManager_Avatar
                nombre={nombreCompleto}
                color={accentColor}
                size={isMobile ? 38 : 44}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.2px",
                    }}
                >
                    {nombreCompleto}
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 3,
                        alignItems: "center",
                    }}
                >
                    <TeamManager_RolBadge
                        rol="dueño"
                        accentColor={accentColor}
                    />
                </div>
            </div>

            <span
                style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    fontWeight: 600,
                    flexShrink: 0,
                    textAlign: "right" as const,
                    maxWidth: isMobile ? 64 : 100,
                    lineHeight: 1.3,
                }}
            >
                Titular de la cuenta
            </span>
        </motion.div>
    )
}

function TeamManager_MiembroCard({
    miembro,
    accentColor,
    iconoCheck,
    iconoEditar,
    iconoEliminar,
    onEdit,
    onToggle,
    onDelete,
    isMobile,
}: {
    miembro: TeamManager_Miembro
    accentColor: string
    iconoCheck?: string
    iconoEditar?: string
    iconoEliminar?: string
    onEdit: () => void
    onToggle: () => void
    onDelete: () => void
    isMobile: boolean
}) {
    const [confirmDelete, setConfirmDelete] = React.useState(false)
    const branch = useBranchAdmin()
    const locked = !!branch && miembro.es_dueño
    const ownBranchAccess = !!branch && miembro.id === branch.equipo_id
    const esDueño = miembro.es_dueño

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="tm-card"
            style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 10 : 12,
                padding: isMobile ? "10px" : "12px",
                borderRadius: 18,
                background: miembro.activo ? "#fff" : "#f8fafc",
                border: "1px solid #aaa",
                opacity: miembro.activo ? 1 : 0.55,
                transition: "background 0.15s, opacity 0.2s",
            }}
        >
            <TeamManager_Avatar
                nombre={[miembro.nombre, miembro.apellido].filter(Boolean).join(" ")}
                color={miembro.color}
                fotoUrl={miembro.foto_url}
                size={isMobile ? 40 : 58}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.2px",
                    }}
                >
                    {miembro.nombre}
                    {miembro.apellido ? ` ${miembro.apellido}` : ""}
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 3,
                        alignItems: "center",
                    }}
                >
                    <span style={{fontSize: 14, color: "#525252"}}>
                        {esDueño ? "Dueño" : miembro.login_activado ? "Empleado con acceso" : "Colaborador"}
                    </span>
                    {!esDueño && !miembro.activo && (
                        <span style={{ fontSize: 10, color: "#cbd5e1" }}>
                            inactivo
                        </span>
                    )}
                </div>
                {!esDueño && miembro.login_email && (
                    <div
                        style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}
                    >
                        {miembro.login_email.replace(/^(.{1,3})[^@]*(@.*)$/, "$1••••$2")} ·{" "}
                        {miembro.login_activado
                            ? "acceso activo"
                            : "invitación pendiente"}
                    </div>
                )}
            </div>

            <div
                style={{
                    display: locked ? "none" : "flex",
                    gap: isMobile ? 3 : 4,
                    alignItems: "center",
                    flexShrink: 0,
                }}
            >
                {/* Toggle activo / disponible — el dueño no se puede desactivar */}
                {!esDueño && !ownBranchAccess && (
                    <button
                        className="tm-btn-icon"
                        title={miembro.activo ? "Desactivar" : "Activar"}
                        onClick={onToggle}
                        style={{
                            width: isMobile ? 28 : 30,
                            height: isMobile ? 28 : 30,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: miembro.activo
                                ? accentColor + "12"
                                : "#f1f5f9",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isMobile ? 12 : 13,
                            color: miembro.activo ? accentColor : "#94a3b8",
                            transition: "opacity 0.15s",
                        }}
                    >
                        {iconoCheck ? (
                            <img
                                src={iconoCheck}
                                alt=""
                                style={{
                                    width: isMobile ? 14 : 16,
                                    height: isMobile ? 14 : 16,
                                    objectFit: "contain",
                                    opacity: miembro.activo ? 1 : 0.4,
                                }}
                            />
                        ) : miembro.activo ? (
                            "●"
                        ) : (
                            "○"
                        )}
                    </button>
                )}

                {/* Editar — siempre disponible, incluso para el dueño */}
                <button
                    className="tm-btn-icon"
                    title="Editar"
                    onClick={onEdit}
                    style={{
                        width: "auto", padding: "0 10px", gap: 4,
                        height: isMobile ? 28 : 30,
                        borderRadius: 20,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isMobile ? 12 : 13,
                        color: "#64748b",
                        transition: "opacity 0.15s",
                    }}
                >
                    {iconoEditar ? (
                        <img
                            src={iconoEditar}
                            alt=""
                            style={{
                                width: isMobile ? 14 : 16,
                                height: isMobile ? 14 : 16,
                                objectFit: "contain",
                            }}
                        />
                    ) : (
                        "✎"
                    )}
                    {!isMobile && "Editar"}
                </button>

                {/* Eliminar — el dueño no se puede eliminar */}
                {!esDueño && !ownBranchAccess &&
                    (confirmDelete ? (
                        <div style={{ display: "flex", gap: 3 }}>
                            <button
                                onClick={() => {
                                    onDelete()
                                    setConfirmDelete(false)
                                }}
                                style={{
                                    padding: isMobile ? "4px 6px" : "4px 8px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "#ef4444",
                                    color: "#fff",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    fontFamily:
                                        "'Inter Display', -apple-system, sans-serif",
                                }}
                            >
                                Sí
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                style={{
                                    padding: isMobile ? "4px 6px" : "4px 8px",
                                    borderRadius: 6,
                                    border: "1px solid #e2e8f0",
                                    background: "none",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    fontFamily:
                                        "'Inter Display', -apple-system, sans-serif",
                                }}
                            >
                                No
                            </button>
                        </div>
                    ) : (
                        <button
                            className="tm-btn-icon"
                            title="Eliminar"
                            onClick={() => setConfirmDelete(true)}
                            style={{
                                width: isMobile ? 28 : 30,
                                height: isMobile ? 28 : 30,
                                borderRadius: 8,
                                border: "1px solid #fee2e2",
                                background: "#fff5f5",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: isMobile ? 12 : 13,
                                color: "#ef4444",
                                transition: "opacity 0.15s",
                            }}
                        >
                            {iconoEliminar ? (
                                <img
                                    src={iconoEliminar}
                                    alt=""
                                    style={{
                                        width: isMobile ? 14 : 16,
                                        height: isMobile ? 14 : 16,
                                        objectFit: "contain",
                                    }}
                                />
                            ) : (
                                "×"
                            )}
                        </button>
                    ))}
            </div>
        </motion.div>
    )
}

function TeamManager_SkeletonTeam() { return <LoadingRunner card label="Cargando equipo…" /> }

function TeamManager_CanvasPreview({
    accentColor,
    iconoCheck,
    iconoEditar,
    iconoEliminar,
    isMobile,
}: {
    accentColor: string
    iconoCheck?: string
    iconoEditar?: string
    iconoEliminar?: string
    isMobile: boolean
}) {
    const fakeOwner: TeamManager_OwnerFallback = {
        nombre: "Valentina",
        apellido: "Ruiz",
    }
    const fake = [
        {
            nombre: "Martín",
            apellido: "López",
            rol: "admin",
            color: "#10B981",
        },
        {
            nombre: "Sofía",
            apellido: "Torres",
            rol: "colaborador",
            color: "#EC4899",
        },
    ]
    return (
        <>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: isMobile ? 12 : 16,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: isMobile ? 15 : 16,
                            fontWeight: 700,
                            color: "#1e293b",
                            letterSpacing: "-0.3px",
                        }}
                    >
                        Equipo
                    </div>
                    <div
                        style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}
                    >
                        1 dueño · 2 colaboradores
                    </div>
                </div>
                <div
                    style={{
                        padding: isMobile ? "9px 12px" : "8px 14px",
                        borderRadius: 10,
                        background: accentColor,
                        color: "#fff",
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                    {!isMobile && " Nuevo"}
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 5 : 6,
                }}
            >
                <TeamManager_OwnerFallbackCard
                    owner={fakeOwner}
                    accentColor={accentColor}
                    isMobile={isMobile}
                />
                {fake.map((m, i) => (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: isMobile ? 10 : 12,
                            padding: isMobile ? "10px" : "12px",
                            borderRadius: 12,
                            background: "#fff",
                            border: "1px solid #f1f5f9",
                        }}
                    >
                        <div
                            style={{
                                width: isMobile ? 38 : 44,
                                height: isMobile ? 38 : 44,
                                borderRadius: "50%",
                                background: m.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: isMobile ? 15 : 17,
                                flexShrink: 0,
                                boxShadow: `0 2px 8px ${m.color}44`,
                            }}
                        >
                            {m.nombre[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: isMobile ? 12 : 13,
                                    fontWeight: 700,
                                    color: "#1e293b",
                                }}
                            >
                                {m.nombre} {m.apellido}
                            </div>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 7px",
                                    borderRadius: 20,
                                    background:
                                        m.rol === "admin"
                                            ? accentColor + "18"
                                            : "#f1f5f9",
                                    color:
                                        m.rol === "admin"
                                            ? accentColor
                                            : "#94a3b8",
                                    textTransform: "uppercase" as const,
                                    letterSpacing: "0.05em",
                                }}
                            >
                                {m.rol}
                            </span>
                        </div>
                        <div style={{ display: "flex", gap: isMobile ? 3 : 4 }}>
                            {[
                                {
                                    ico: "●",
                                    img: iconoCheck,
                                    bg: accentColor + "12",
                                    border: "#e2e8f0",
                                    color: accentColor,
                                },
                                {
                                    ico: "✎",
                                    img: iconoEditar,
                                    bg: "#f8fafc",
                                    border: "#e2e8f0",
                                    color: "#64748b",
                                },
                                {
                                    ico: "×",
                                    img: iconoEliminar,
                                    bg: "#fff5f5",
                                    border: "#fee2e2",
                                    color: "#ef4444",
                                },
                            ].map(({ ico, img, bg, border, color }, j) => (
                                <div
                                    key={j}
                                    style={{
                                        width: isMobile ? 28 : 30,
                                        height: isMobile ? 28 : 30,
                                        borderRadius: 8,
                                        background: bg,
                                        border: `1px solid ${border}`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: isMobile ? 12 : 13,
                                        color,
                                    }}
                                >
                                    {img ? (
                                        <img
                                            src={img}
                                            alt=""
                                            style={{
                                                width: isMobile ? 14 : 16,
                                                height: isMobile ? 14 : 16,
                                                objectFit: "contain",
                                            }}
                                        />
                                    ) : (
                                        ico
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    )
}

function TeamManager(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#6366F1",
        iconoVacioUrl = "",
        iconoCheck = "",
        iconoEditar = "",
        iconoEliminar = "",
        style,
    } = props

    const branch = useBranchAdmin()
    const api = baseUrl.replace(/\/+$/, "")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = TeamManager_useContainerWidth(containerRef)
    const isMobile = containerWidth < 480

    const [loading, setLoading] = React.useState(true)
    const [esPremium, setEsPremium] = React.useState(false)
    const [planEquipo,setPlanEquipo]=React.useState("gratis")
    const [equipo, setEquipo] = React.useState<TeamManager_Miembro[]>([])
    const [ownerFallback, setOwnerFallback] =
        React.useState<TeamManager_OwnerFallback | null>(null)
    const [error, setError] = React.useState("")
    const [formError, setFormError] = React.useState("")
    const [aviso, setAviso] = React.useState("")
    const [guardando, setGuardando] = React.useState(false)
    const [mostrarForm, setMostrarForm] = React.useState(false)
    const [editando, setEditando] = React.useState<TeamManager_Miembro | null>(
        null
    )

    if (false) {
        return (
            <div
                style={{ ...TeamManager_cardBase, ...style }}
                ref={containerRef}
            >
                <style>{TeamManager_shimmerCSS}</style>
                <TeamManager_CanvasPreview
                    accentColor={accentColor}
                    iconoCheck={iconoCheck || undefined}
                    iconoEditar={iconoEditar || undefined}
                    iconoEliminar={iconoEliminar || undefined}
                    isMobile={isMobile}
                />
            </div>
        )
    }

    React.useEffect(() => {
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        let retries = 0

        const tryLoad = async () => {
            if (!slug || !token) {
                if (++retries < 10) {
                    setTimeout(tryLoad, 300)
                    return
                }
                setLoading(false)
                return
            }
            try {
                // El equipo (tabla `equipo`) ya incluye al dueño como
                // una fila más (es_dueño=true), así que no hace falta
                // pedir /settings salvo como fallback de compatibilidad
                // para cuentas que todavía no tengan esa fila creada.
                // Ahora también pedimos /settings para saber el plan:
                // la gestión de equipo es una función Básico (trial o
                // activo), en el plan gratis no se muestra.
                const headers = { Authorization: `Bearer ${token}` }
                const [equipoRes, settingsRes] = await Promise.all([
                    fetch(`${api}/admin/equipo/${slug}`, {
                        headers,
                        cache: "no-cache",
                    }),
                    fetch(`${api}/settings/${slug}`, {
                        headers,
                        cache: "no-cache",
                    }),
                ])

                if (equipoRes.status === 401 || settingsRes.status === 401) {
                    setError("Sesión expirada")
                    setLoading(false)
                    return
                }

                const settingsData = await settingsRes.json().catch(() => ({}))
                const cfg = settingsData?.settings || {}
                setPlanEquipo(cfg.plan || "gratis")
                setEsPremium(cfg.plan === "basico" || cfg.plan === "premium")

                const equipoData = await equipoRes.json()
                const listaEquipo: TeamManager_Miembro[] =
                    equipoData.equipo || []
                setEquipo(listaEquipo)

                // Fallback: solo si esta cuenta todavía no tiene su fila
                // de dueño en `equipo` (backfill no corrido todavía).
                // Ya tenemos los settings de la llamada de arriba, no
                // hace falta pedirlos de nuevo.
                if (!branch && !listaEquipo.some((m) => m.es_dueño) && cfg) {
                    setOwnerFallback({
                        nombre: cfg.nombre_persona || "",
                        apellido: cfg.apellido || "",
                    })
                }

                setLoading(false)
            } catch {
                if (++retries < 10) setTimeout(tryLoad, 300)
                else {
                    setLoading(false)
                    setError("Error al cargar el equipo")
                }
            }
        }
        tryLoad()
    }, [api])

    const handleCrear = async (form: TeamManager_FormData) => {
        if (!form.nombre.trim()) {
            setFormError("El nombre es obligatorio")
            return
        }
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        setGuardando(true)
        setFormError("")
        try {
            const res = await fetch(`${api}/admin/equipo`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug,
                    nombre: form.nombre.trim(),
                    apellido: form.apellido.trim() || null,
                    login_email: form.login_email.trim() || null,
                    color: form.color,
                    rol: form.rol,
                    foto_url: form.foto_url.trim() || null,
                    puede_configurar_horarios: form.puede_configurar_horarios,
                    puede_recibir_pagos_personales:
                        form.puede_recibir_pagos_personales,
                    puede_crear_servicios: form.puede_crear_servicios,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || `Error ${res.status}`)
            setEquipo((p) => [...p, data.miembro])
            setAviso(
                form.login_email.trim()
                    ? data.invitacion_enviada
                        ? `Invitación enviada a ${form.login_email.trim()}.`
                        : "Integrante creado, pero no se pudo enviar la invitación. Revisá la configuración de email."
                    : "Integrante creado. No tiene acceso al panel todavía."
            )
            setMostrarForm(false)
            setFormError("")
        } catch (e: any) {
            setFormError(e.message || "Error al agregar")
        }
        setGuardando(false)
    }

    const handleEditar = async (form: TeamManager_FormData) => {
        if (!editando) return
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        setGuardando(true)
        setFormError("")
        try {
            const res = await fetch(`${api}/admin/equipo/${editando.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug,
                    nombre: form.nombre.trim(),
                    apellido: form.apellido.trim() || null,
                    color: form.color,
                    // El dueño no manda rol: el backend lo ignora/protege
                    // igual, pero evitamos mandar un valor que no aplica.
                    ...(editando.es_dueño || branch ? {} : { rol: form.rol }),
                    foto_url: form.foto_url.trim() || null,
                    ...(editando.es_dueño || branch
                        ? {}
                        : {
                              puede_configurar_horarios:
                                  form.puede_configurar_horarios,
                              puede_recibir_pagos_personales:
                                  form.puede_recibir_pagos_personales,
                              puede_crear_servicios: form.puede_crear_servicios,
                          }),
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || `Error ${res.status}`)
            setEquipo((p) =>
                p.map((m) => (m.id === editando.id ? data.miembro : m))
            )
            setEditando(null)
            setFormError("")
        } catch (e: any) {
            setFormError(e.message || "Error al guardar")
        }
        setGuardando(false)
    }

    const handleToggle = async (miembro: TeamManager_Miembro) => {
        if (miembro.es_dueño) return // blindaje extra en el cliente
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        const nuevo = !miembro.activo
        // Optimistic update
        setEquipo((p) =>
            p.map((m) => (m.id === miembro.id ? { ...m, activo: nuevo } : m))
        )
        try {
            const res = await fetch(`${api}/admin/equipo/${miembro.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ slug, activo: nuevo }),
            })
            if (!res.ok) throw new Error()
        } catch {
            // Revertir si falla
            setEquipo((p) =>
                p.map((m) =>
                    m.id === miembro.id ? { ...m, activo: miembro.activo } : m
                )
            )
        }
    }

    const handleDelete = async (miembro: TeamManager_Miembro) => {
        if (miembro.es_dueño) return // blindaje extra en el cliente
        const slug = TeamManager_getSlug()
        const token = TeamManager_getToken()
        // Optimistic remove
        setEquipo((p) => p.filter((m) => m.id !== miembro.id))
        try {
            const res = await fetch(
                `${api}/admin/equipo/${miembro.id}?slug=${slug}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            )
            if (!res.ok) throw new Error()
        } catch {
            // Revertir
            setEquipo((p) =>
                [...p, miembro].sort((a, b) =>
                    a.created_at.localeCompare(b.created_at)
                )
            )
        }
    }

    if (loading) return <TeamManager_SkeletonTeam />

    // Gestión de equipo: función Básico (prueba gratis o plan
    // activo). En el plan gratis mostramos un aviso en vez del panel.
    if (!esPremium) {
        return (
            <div
                ref={containerRef}
                style={{
                    ...TeamManager_cardBase,
                    ...TurnitsLockedStyle,
                    padding: isMobile ? "16px" : "22px",
                    ...style,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 10,
                        gap: 8,
                    }}
                >
                    <div
                        style={{
                            fontSize: isMobile ? 15 : 16,
                            fontWeight: 700,
                            color: "#1e293b",
                            letterSpacing: "-0.3px",
                        }}
                    >
                        Equipo
                    </div>
                    <TurnitsPlanRequirement />
                </div>
                <span
                    style={{
                        fontSize: isMobile ? 12 : 13,
                        color: "#64748b",
                        lineHeight: 1.5,
                    }}
                >
                    Sumá profesionales a tu negocio, asignales servicios y llevá
                    la cuenta de cada uno.
                </span>
            </div>
        )
    }

    const dueño = equipo.find((m) => m.es_dueño) || null
    const miembros = equipo.filter((m) => !m.es_dueño)
    const limiteEquipoBasico=planEquipo === "basico"
    const activos = miembros.filter((m) => m.activo)
    const inactivos = miembros.filter((m) => !m.activo)

    const initialEditar: TeamManager_FormData | undefined = editando
        ? {
              nombre: editando.nombre,
              apellido: editando.apellido || "",
              color: editando.color,
              rol: editando.rol,
              foto_url: editando.foto_url || "",
              login_email: editando.login_email || "",
              puede_configurar_horarios: !!editando.puede_configurar_horarios,
              puede_recibir_pagos_personales:
                  !!editando.puede_recibir_pagos_personales,
              puede_crear_servicios: !!editando.puede_crear_servicios,
          }
        : undefined

    const subtitulo =
        miembros.length === 0
            ? "Solo vos, por ahora"
            : `${activos.length} colaborador${activos.length !== 1 ? "es" : ""}${
                  inactivos.length > 0
                      ? ` · ${inactivos.length} inactivo${inactivos.length !== 1 ? "s" : ""}`
                      : ""
              }`

    return (
        <div
            ref={containerRef}
            style={{
                ...TeamManager_cardBase,
                padding: isMobile ? "16px" : "22px",
                ...style,
            }}
        >
            <style>{TeamManager_shimmerCSS}</style>

            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: isMobile ? 12 : 16,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: isMobile ? 15 : 16,
                            fontWeight: 700,
                            color: "#1e293b",
                            letterSpacing: "-0.3px",
                        }}
                    >
                        Equipo
                    </div>
                    <div
                        style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            marginTop: 2,
                        }}
                    >
                        {subtitulo}
                    </div>
                </div>
                {!mostrarForm && !editando && (
                    <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        title={limiteEquipoBasico ? `Básico: ${miembros.length}/2 miembros adicionales al titular` : "Ampliá tu equipo"}
                        onClick={() => {
                            if(planEquipo === "basico" && miembros.length>=2){setAviso("Llegaste a los 2 miembros adicionales de Básico. Premium permite ampliar tu equipo.");return}
                            setMostrarForm(true)
                        }}
                        style={{
                            ...(limiteEquipoBasico && miembros.length >= 2 ? TurnitsLockedStyle : {}),
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: isMobile ? "9px 12px" : "8px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: accentColor,
                            color: "#fff",
                            fontSize: isMobile ? 12 : 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                            letterSpacing: "-0.2px",
                            flexShrink: 0,
                        }}
                    >
                        {limiteEquipoBasico && miembros.length >= 2 ? <TurnitsPlanRequirement premiumOnly color="#ffffff" /> : <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>}
                        {isMobile ? "" : " Nuevo"}
                    </motion.button>
                )}
            </div>

            {aviso && (
                <div
                    style={{ fontSize: 12, color: "#15803d", marginBottom: 10 }}
                >
                    {aviso}
                </div>
            )}

            {error && (
                <div
                    style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}
                >
                    {error}
                </div>
            )}

            {/* Formulario nuevo */}
            <AnimatePresence>
                {mostrarForm && !editando && (
                    <div style={{ marginBottom: 14 }}>
                        <TeamManager_MiembroForm
                            accentColor={accentColor}
                            apiUrl={api}
                            onSubmit={handleCrear}
                            onCancel={() => {
                                setMostrarForm(false)
                                setFormError("")
                            }}
                            guardando={guardando}
                            error={formError}
                            modoEdicion={false}
                            isMobile={isMobile}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* Lista */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 5 : 6,
                }}
            >
                {/* Tarjeta del dueño: real y editable si ya existe la fila
                    en `equipo`; si no, fallback no editable desde /settings. */}
                {dueño ? (
                    editando?.id === dueño.id ? (
                        <motion.div
                            key={dueño.id + "-edit"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ marginBottom: 6 }}
                        >
                            <TeamManager_MiembroForm
                                initial={initialEditar}
                                accentColor={accentColor}
                                apiUrl={api}
                                miembroId={dueño.id}
                                esDueño
                                onSubmit={handleEditar}
                                onCancel={() => {
                                    setEditando(null)
                                    setFormError("")
                                }}
                                guardando={guardando}
                                error={formError}
                                modoEdicion={true}
                                isMobile={isMobile}
                            />
                        </motion.div>
                    ) : (
                        <TeamManager_MiembroCard
                            miembro={dueño}
                            accentColor={accentColor}
                            iconoCheck={iconoCheck || undefined}
                            iconoEditar={iconoEditar || undefined}
                            iconoEliminar={iconoEliminar || undefined}
                            onEdit={() => {
                                setEditando(dueño)
                                setMostrarForm(false)
                                setFormError("")
                            }}
                            onToggle={() => {}}
                            onDelete={() => {}}
                            isMobile={isMobile}
                        />
                    )
                ) : (
                    ownerFallback && (
                        <TeamManager_OwnerFallbackCard
                            owner={ownerFallback}
                            accentColor={accentColor}
                            isMobile={isMobile}
                        />
                    )
                )}

                {miembros.length === 0 && !mostrarForm && (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            opacity: 0.5,
                            paddingTop: 24,
                        }}
                    >
                        <TeamManager_PlaceholderIcon
                            src={iconoVacioUrl || undefined}
                            size={36}
                        />
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>
                            Todavía no sumaste colaboradores
                        </span>
                    </div>
                )}

                <AnimatePresence mode="popLayout">
                    {miembros.map((miembro) =>
                        editando?.id === miembro.id ? (
                            <motion.div
                                key={miembro.id + "-edit"}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ marginBottom: 6 }}
                            >
                                <TeamManager_MiembroForm
                                    initial={initialEditar}
                                    accentColor={accentColor}
                                    apiUrl={api}
                                    miembroId={editando.id}
                                    onSubmit={handleEditar}
                                    onCancel={() => {
                                        setEditando(null)
                                        setFormError("")
                                    }}
                                    guardando={guardando}
                                    error={formError}
                                    modoEdicion={true}
                                    isMobile={isMobile}
                                />
                            </motion.div>
                        ) : (
                            <TeamManager_MiembroCard
                                key={miembro.id}
                                miembro={miembro}
                                accentColor={accentColor}
                                iconoCheck={iconoCheck || undefined}
                                iconoEditar={iconoEditar || undefined}
                                iconoEliminar={iconoEliminar || undefined}
                                onEdit={() => {
                                    setEditando(miembro)
                                    setMostrarForm(false)
                                    setFormError("")
                                }}
                                onToggle={() => handleToggle(miembro)}
                                onDelete={() => handleDelete(miembro)}
                                isMobile={isMobile}
                            />
                        )
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

export { TeamManager_Avatar, TeamManager_FotoUploader, TeamManager_RolBadge, TeamManager_ColorPicker, TeamManager_Field, TeamManager_TmInput, TeamManager_ServiciosVinculados, TeamManager_PromocionesVinculadas, TeamManager_MetricaNeto, TeamManager_MiembroForm, TeamManager_OwnerFallbackCard, TeamManager_MiembroCard, TeamManager_SkeletonTeam, TeamManager_CanvasPreview, TeamManager }
