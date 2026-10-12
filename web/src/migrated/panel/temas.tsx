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
import { ThemeEditor_cardBase, ThemeEditor_shimmerCSS, ThemeEditor_PALETAS, ThemeEditor_Tema, ThemeEditor_getSlug, ThemeEditor_getToken, Turnits_useElementWidth, ThemeEditor_TEMA_DEFAULT, TurnitsResolveAccountPlan, ThemeEditor_temaCompleto, TurnitsGlobalSaveManager_get, ThemeEditor_mismoTema, TurnitsLockedStyle } from "./common"
import { Turnits_ImageAdjustDialog } from "./servicios"
import { ThemeEditor_PlaceholderIcon } from "./pagos"
import { TurnitsPlanRequirement } from "./shared"
import { UploadPlaceholderIcon } from "./inicio"

function ThemeEditor_Divider({ label }: { label: string }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "4px 0",
            }}
        >
            <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#cbd5e1",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    whiteSpace: "nowrap",
                }}
            >
                {label}
            </span>
            <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
        </div>
    )
}

function ThemeEditor_ColorField({
    label,
    value,
    onChange,
    accentColor,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    accentColor: string
}) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #f1f5f9",
            }}
        >
            {/* Swatch clickeable que abre el color picker nativo */}
            <label
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: value,
                    flexShrink: 0,
                    cursor: "pointer",
                    boxShadow: `0 2px 6px ${value}55`,
                    position: "relative",
                    display: "block",
                    overflow: "hidden",
                }}
                className="te-color-swatch"
            >
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        cursor: "pointer",
                        width: "100%",
                        height: "100%",
                        border: "none",
                        padding: 0,
                    }}
                />
            </label>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1e293b",
                        marginBottom: 2,
                    }}
                >
                    {label}
                </div>
                <input
                    value={value}
                    onChange={(e) => {
                        const v = e.target.value
                        if (/^#([0-9A-Fa-f]{0,6})$/.test(v)) onChange(v)
                    }}
                    style={{
                        fontSize: 11,
                        color: "#64748b",
                        fontFamily: "monospace",
                        background: "none",
                        border: "none",
                        outline: "none",
                        width: "100%",
                        padding: 0,
                    }}
                />
            </div>
        </div>
    )
}

function ThemeEditor_SkeletonTheme() {
    return (
        <div style={ThemeEditor_cardBase}>
            <style>{ThemeEditor_shimmerCSS}</style>
            <div
                className="te-shimmer"
                style={{
                    width: 180,
                    height: 20,
                    borderRadius: 6,
                    marginBottom: 20,
                }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="te-shimmer"
                        style={{ flex: 1, height: 34, borderRadius: 10 }}
                    />
                ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="te-shimmer"
                        style={{ width: 44, height: 44, borderRadius: 10 }}
                    />
                ))}
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
                <div
                    key={i}
                    className="te-shimmer"
                    style={{ height: 52, borderRadius: 10, marginBottom: 8 }}
                />
            ))}
        </div>
    )
}

function ThemeEditor_CanvasPreview({ accentColor }: { accentColor: string }) {
    return (
        <>
            <div style={{ marginBottom: 16 }}>
                <div
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.3px",
                    }}
                >
                    Apariencia
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Logo, colores y vista previa de la agenda
                </div>
            </div>

            {/* Tabs mock */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {["Logo", "Colores", "Vista previa"].map((t, i) => (
                    <div
                        key={t}
                        style={{
                            flex: 1,
                            textAlign: "center",
                            padding: "8px 0",
                            borderRadius: 10,
                            background: i === 0 ? accentColor : "#f1f5f9",
                            color: i === 0 ? "#fff" : "#64748b",
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        {t}
                    </div>
                ))}
            </div>

            {/* Paletas mock */}
            <div style={{ marginBottom: 14 }}>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 8,
                    }}
                >
                    Paletas
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {ThemeEditor_PALETAS.map((p) => (
                        <div
                            key={p.nombre}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 4,
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1.5px solid #e2e8f0",
                                background: "#fff",
                                cursor: "pointer",
                                minWidth: 56,
                            }}
                        >
                            <div style={{ display: "flex", gap: 3 }}>
                                {[p.tema.primario, p.tema.acento].map(
                                    (c, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                width: 14,
                                                height: 14,
                                                borderRadius: "50%",
                                                background: c,
                                            }}
                                        />
                                    )
                                )}
                            </div>
                            <span
                                style={{
                                    fontSize: 10,
                                    color: "#64748b",
                                    fontWeight: 600,
                                }}
                            >
                                {p.nombre}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Color fields mock */}
            {["Color primario", "Secundario", "Fondo", "Texto", "Acento"].map(
                (l) => (
                    <div
                        key={l}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "#f8fafc",
                            border: "1px solid #f1f5f9",
                            marginBottom: 8,
                        }}
                    >
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: accentColor,
                                flexShrink: 0,
                            }}
                        />
                        <div>
                            <div
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "#1e293b",
                                }}
                            >
                                {l}
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#94a3b8",
                                    fontFamily: "monospace",
                                }}
                            >
                                #6366F1
                            </div>
                        </div>
                    </div>
                )
            )}
        </>
    )
}

function ThemeEditor_AgendaPreview({
    slug,
    isMobile,
    tema,
}: {
    slug: string
    isMobile: boolean
    tema: ThemeEditor_Tema
}) {
    const [reloadKey, setReloadKey] = React.useState(0)
    const [loading, setLoading] = React.useState(true)
    const iframeRef = React.useRef<HTMLIFrameElement>(null)
    const url = `https://turnits.com/agenda/${slug}`

    // Cada vez que el tema cambia, lo empujamos al iframe (vive ahí)
    React.useEffect(() => {
        iframeRef.current?.contentWindow?.postMessage(
            { type: "TURNITS_TEMA_PREVIEW", tema },
            "*"
        )
    }, [tema])

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#1e293b",
                        }}
                    >
                        Vista previa de la agenda
                    </div>
                    <div
                        style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}
                    >
                        Así la ven tus clientes
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                    <button
                        onClick={() => {
                            setLoading(true)
                            setReloadKey((k) => k + 1)
                        }}
                        title="Recargar"
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        ↺
                    </button>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir en nueva pestaña"
                        style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                        }}
                    >
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <path d="M15 3h6v6" />
                            <path d="M10 14 21 3" />
                        </svg>
                    </a>
                </div>
            </div>

            {/* Barra de URL decorativa */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                }}
            >
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {["#fee2e2", "#fef9c3", "#dcfce7"].map((c, i) => (
                        <div
                            key={i}
                            style={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                background: c,
                            }}
                        />
                    ))}
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        fontFamily: "monospace",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                    }}
                >
                    turnits.com/agenda/{slug}
                </span>
            </div>

            {/* iframe wrapper */}
            <div
                style={{
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                    position: "relative",
                    height: isMobile ? 420 : 520,
                    background: "#f8fafc",
                }}
            >
                {loading && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            background: "#f8fafc",
                            zIndex: 2,
                        }}
                    >
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                border: "3px solid #e2e8f0",
                                borderTop: "3px solid #1B6B1A",
                                borderRadius: "50%",
                                animation: "te-spin 0.8s linear infinite",
                            }}
                        />
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                            Cargando agenda…
                        </span>
                    </div>
                )}

                {/* Capa transparente que bloquea cualquier scroll/click sobre el iframe */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 1,
                        cursor: "default",
                    }}
                    onWheel={(e) => e.preventDefault()}
                    onTouchMove={(e) => e.preventDefault()}
                />

                <iframe
                    ref={iframeRef}
                    key={reloadKey}
                    src={url}
                    title="Vista previa agenda"
                    onLoad={() => {
                        setLoading(false)
                        // empujar el tema en vivo apenas termina de cargar
                        iframeRef.current?.contentWindow?.postMessage(
                            { type: "TURNITS_TEMA_PREVIEW", tema },
                            "*"
                        )
                    }}
                    scrolling="no"
                    style={{
                        width: "100%",
                        height: "150%",
                        transform: "translateY(-22%)",
                        border: "none",
                        display: "block",
                        opacity: loading ? 0 : 1,
                        transition: "opacity 0.3s",
                        pointerEvents: "none",
                    }}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                />
            </div>

            <div
                style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#FFFBEB",
                    border: "1px solid #FEF08A",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                }}
            >
                <span style={{ fontSize: 14, flexShrink: 0 }}></span>
                <span
                    style={{ fontSize: 11, color: "#92400E", lineHeight: 1.5 }}
                >
                    Los cambios de color se ven en vivo en esta vista previa.
                    Recordá apretar "Guardar tema" para que queden guardados.
                </span>
            </div>
        </div>
    )
}

function ThemeEditor_LogoSection({
    api,
    accentColor,
    iconoLogoUrl,
}: {
    api: string
    accentColor: string
    iconoLogoUrl?: string
}) {
    const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
    const [uploading, setUploading] = React.useState(false)
    const [deleting, setDeleting] = React.useState(false)
    const [dragOver, setDragOver] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)
    const [error, setError] = React.useState("")
    const [cropFile, setCropFile] = React.useState<File | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const accentVars = {
        "--accent": accentColor,
        "--accent-10": accentColor + "18",
        "--accent-05": accentColor + "0d",
        "--accent-30": accentColor + "44",
    } as React.CSSProperties

    // Cargar el logo existente
    React.useEffect(() => {
        const slug = ThemeEditor_getSlug()
        const token = ThemeEditor_getToken()
        if (!slug || !token) return
        fetch(`${api}/admin/tema/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-cache",
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.success) setLogoUrl(d.logo_url || null)
            })
            .catch(() => {})
    }, [api])

    const uploadFile = async (file: File) => {
        if (!file) return
        if (
            ![
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/svg+xml",
            ].includes(file.type)
        ) {
            setError("Solo JPG, PNG, WEBP o SVG.")
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            setError("La imagen no puede superar 3 MB.")
            return
        }

        setUploading(true)
        setError("")
        setImgError(false)

        try {
            const slug = ThemeEditor_getSlug()
            const token = ThemeEditor_getToken()
            const formData = new FormData()
            formData.append("logo", file)

            const res = await fetch(`${api}/admin/logo/${slug}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || "Error al subir imagen")
            setLogoUrl(data.logo_url)
        } catch (e: any) {
            setError(e.message || "Error de red")
        }
        setUploading(false)
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 3 * 1024 * 1024)
                setError("La imagen no puede superar 3 MB.")
            else if (
                ["image/jpeg", "image/png", "image/webp"].includes(file.type)
            )
                setCropFile(file)
            else
                setError(
                    "Elegí una imagen JPG, PNG o WEBP para poder ajustarla."
                )
        }
        e.target.value = ""
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (
            file &&
            file.size <= 3 * 1024 * 1024 &&
            ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        )
            setCropFile(file)
    }

    const handleDelete = async () => {
        setDeleting(true)
        setError("")
        try {
            const slug = ThemeEditor_getSlug()
            const token = ThemeEditor_getToken()
            const res = await fetch(`${api}/admin/logo/${slug}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || "Error al eliminar")
            setLogoUrl(null)
            setImgError(false)
        } catch (e: any) {
            setError(e.message || "Error al eliminar")
        }
        setDeleting(false)
    }

    const preview = logoUrl && !imgError

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
            <div
                style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    ...accentVars,
                }}
            >
                <div
                    className="te-drop-zone"
                    onClick={() => !uploading && inputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 14,
                        flexShrink: 0,
                        border: `2px solid "transparent"`,
                        background: dragOver
                            ? accentColor + "0d"
                            : preview
                              ? "transparent"
                              : "#f8fafc",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: uploading ? "not-allowed" : "pointer",
                        transition: "border-color 0.15s, background 0.15s",
                        position: "relative",
                    }}
                >
                    {uploading ? (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <div
                                style={{
                                    width: 20,
                                    height: 20,
                                    border: `2px solid ${accentColor}33`,
                                    borderTop: `2px solid ${accentColor}`,
                                    borderRadius: "50%",
                                    animation: "te-spin 0.7s linear infinite",
                                }}
                            />
                            <span
                                style={{
                                    fontSize: 9,
                                    color: accentColor,
                                    fontWeight: 700,
                                }}
                            >
                                Subiendo…
                            </span>
                        </div>
                    ) : preview ? (
                        <>
                            <img
                                src={logoUrl!}
                                alt=""
                                onError={() => setImgError(true)}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    padding: 10,
                                }}
                            />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "rgba(0,0,0,0.45)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    opacity: 0,
                                    transition: "opacity 0.15s",
                                }}
                                onMouseEnter={(e) =>
                                    (e.currentTarget.style.opacity = "1")
                                }
                                onMouseLeave={(e) =>
                                    (e.currentTarget.style.opacity = "0")
                                }
                            >
                                <span
                                    style={{
                                        fontSize: 18,
                                        color: "#fff",
                                        lineHeight: 1,
                                    }}
                                >
                                    ↑
                                </span>
                            </div>
                        </>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 4,
                            }}
                        >
                            <ThemeEditor_PlaceholderIcon
                                src={iconoLogoUrl}
                                size={28}
                            />
                            <span
                                style={{
                                    fontSize: 9,
                                    color: "#94a3b8",
                                    textAlign: "center",
                                    lineHeight: 1.3,
                                }}
                            >
                                Subir
                                <br />
                                logo
                            </span>
                        </div>
                    )}
                </div>

                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                    }}
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
                        Logo del negocio
                    </span>
                    <span
                        style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            lineHeight: 1.4,
                        }}
                    >
                        PNG, JPG, SVG o WEBP, máx. 3 MB.
                        <br />
                        Hacé click o arrastrá el logo.
                    </span>
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button
                            className="turnits-image-action"
                            onClick={() =>
                                !uploading && inputRef.current?.click()
                            }
                            disabled={uploading}
                            style={{
                                padding: "5px 10px",
                                borderRadius: 7,
                                border: `1.5px solid ${accentColor}44`,
                                background: accentColor + "12",
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: uploading ? "not-allowed" : "pointer",
                                fontFamily:
                                    "'Inter Display', -apple-system, sans-serif",
                            }}
                        >
                            {uploading
                                ? "Subiendo…"
                                : preview
                                  ? "Cambiar"
                                  : "Elegir archivo"}
                        </button>
                        {preview && (
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{
                                    padding: "5px 10px",
                                    borderRadius: 7,
                                    border: "1.5px solid #fee2e2",
                                    background: "#fff5f5",
                                    color: deleting ? "#94a3b8" : "#ef4444",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: deleting
                                        ? "not-allowed"
                                        : "pointer",
                                    fontFamily:
                                        "'Inter Display', -apple-system, sans-serif",
                                }}
                            >
                                {deleting ? "Quitando…" : "Quitar"}
                            </button>
                        )}
                    </div>
                    {error && (
                        <span
                            style={{
                                fontSize: 11,
                                color: "#ef4444",
                                fontWeight: 500,
                            }}
                        >
                            {error}
                        </span>
                    )}
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

function ThemeEditor(props: any) {
    const {
        baseUrl = "https://negosocio.onrender.com",
        accentColor = "#1B6B1A",
        iconoLogoUrl = "",
        style,
    } = props

    const api = baseUrl.replace(/\/+$/, "")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = Turnits_useElementWidth(containerRef, 600)
    const isMobile = containerWidth < 500

    const [puedePersonalizar, setPuedePersonalizar] = React.useState(false)
    const [loading, setLoading] = React.useState(true)
    const [tema, setTema] = React.useState<ThemeEditor_Tema>(
        ThemeEditor_TEMA_DEFAULT
    )
    const [temaGuardado, setTemaGuardado] = React.useState<ThemeEditor_Tema>(
        ThemeEditor_TEMA_DEFAULT
    )
    const [guardando, setGuardando] = React.useState(false)
    const [guardado, setGuardado] = React.useState(false)
    const [error, setError] = React.useState("")
    const [tab, setTab] = React.useState<"logo" | "colores" | "preview">("logo")
    const [slug, setSlug] = React.useState("")

    if (false) {
        return (
            <div style={{ ...ThemeEditor_cardBase, ...style }}>
                <style>{ThemeEditor_shimmerCSS}</style>
                <ThemeEditor_CanvasPreview accentColor={accentColor} />
            </div>
        )
    }

    // Cargar tema y slug
    React.useEffect(() => {
        let retries = 0
        const tryLoad = async () => {
            const s = ThemeEditor_getSlug()
            const t = ThemeEditor_getToken()
            if (!s || !t) {
                if (++retries < 10) {
                    setTimeout(tryLoad, 300)
                    return
                }
                setLoading(false)
                return
            }
            setSlug(s)
            try {
                const res = await fetch(`${api}/admin/tema/${s}`, {
                    headers: { Authorization: `Bearer ${t}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada")
                    setLoading(false)
                    return
                }
                const data = await res.json()
                if (!res.ok || data.success === false) throw new Error(data.error || "Error al cargar el tema")
                const accountPlan = await TurnitsResolveAccountPlan(api, s, t, data)
                setPuedePersonalizar(["basico", "premium"].includes(accountPlan))
                if (data.success && data.tema) {
                    const temaFull = ThemeEditor_temaCompleto(data.tema)
                    setTema(temaFull)
                    setTemaGuardado(temaFull)
                    TurnitsGlobalSaveManager_get()?.setBaseline(
                        "tema",
                        temaFull
                    )
                    const pendiente =
                        TurnitsGlobalSaveManager_get()?.getPending("tema")
                    if (pendiente) setTema(ThemeEditor_temaCompleto(pendiente))
                }
                setLoading(false)
            } catch {
                if (++retries < 10) setTimeout(tryLoad, 300)
                else {
                    setLoading(false)
                    setError("Error al cargar el tema")
                }
            }
        }
        tryLoad()
    }, [api])

    // FIX: comparación completa de los 5 colores, no solo JSON.stringify (que
    // podía dar falsos positivos/negativos por orden de claves o claves faltantes)
    const hayDiff = !ThemeEditor_mismoTema(tema, temaGuardado)

    React.useEffect(() => {
        if (typeof window === "undefined" || loading) return
        const manager = TurnitsGlobalSaveManager_get()
        if (hayDiff) manager?.markDirty("tema", tema)
        else if (manager?.isDirty("tema")) manager?.clear("tema")
    }, [hayDiff, tema, loading])

    React.useEffect(() => {
        if (typeof window === "undefined") return
        const onSaved = (e: any) => {
            if (e?.detail?.section !== "tema") return
            setTemaGuardado((prev) => ({ ...prev, ...tema }))
        }
        window.addEventListener("turnits_global_saved", onSaved)
        return () => window.removeEventListener("turnits_global_saved", onSaved)
    }, [tema])

    const guardarTema = async () => {
        const s = ThemeEditor_getSlug()
        const t = ThemeEditor_getToken()
        setGuardando(true)
        setError("")
        setGuardado(false)
        try {
            const res = await fetch(`${api}/admin/tema/${s}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${t}`,
                },
                body: JSON.stringify(tema),
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || "Error al guardar")
            setTemaGuardado({ ...tema })
            setGuardado(true)
            setTimeout(() => setGuardado(false), 2500)
        } catch (e: any) {
            setError(e.message || "Error de red")
        }
        setGuardando(false)
    }

    const aplicarPaleta = (t: ThemeEditor_Tema) => {
        setTema({ ...t })
    }

    const TABS = [
        { id: "logo" as const, label: "Logo" },
        { id: "colores" as const, label: "Colores" },
        { id: "preview" as const, label: "Vista previa" },
    ]

    if (loading) return <ThemeEditor_SkeletonTheme />
    if (error && !puedePersonalizar) return <div style={{...ThemeEditor_cardBase,...style}}><p role="alert" style={{color:"#b91c1c",fontSize:13}}>{error}</p><button onClick={() => window.location.reload()} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer"}}>Volver a cargar</button></div>
    if (!puedePersonalizar) return <div style={{...ThemeEditor_cardBase,...style}}><ThemeEditor_LogoSection api={api} accentColor={accentColor} iconoLogoUrl={iconoLogoUrl || undefined} /><div style={{marginTop:18,padding:18,border:"1px solid #e5e7eb",borderRadius:14,...TurnitsLockedStyle}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><strong style={{fontSize:14}}>Personalización de temas</strong><TurnitsPlanRequirement /></div><p style={{fontSize:13,color:"#64748b"}}>La personalización de colores y temas está incluida en Básico y Premium.</p><a href="/planes" style={{color:accentColor,fontSize:13}}>Ver planes</a></div></div>

    return (
        <div
            ref={containerRef}
            style={{
                ...ThemeEditor_cardBase,
                padding: isMobile ? "16px" : "22px",
                gap: 0,
                ...style,
            }}
        >
            <style>{ThemeEditor_shimmerCSS}</style>

            {/* Header */}
            <div style={{ marginBottom: isMobile ? 14 : 16 }}>
                <div
                    style={{
                        fontSize: isMobile ? 15 : 16,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.3px",
                    }}
                >
                    Apariencia
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Logo, colores y vista previa de la agenda
                </div>
            </div>

            {/* Tabs */}
            <div
                style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 18,
                    background: "#f8fafc",
                    borderRadius: 12,
                    padding: 4,
                }}
            >
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        className="te-tab"
                        onClick={() => setTab(t.id)}
                        style={{
                            flex: 1,
                            padding: "7px 0",
                            borderRadius: 9,
                            border: "none",
                            background: tab === t.id ? "#fff" : "transparent",
                            color: tab === t.id ? "#1e293b" : "#94a3b8",
                            fontSize: isMobile ? 11 : 12,
                            fontWeight: tab === t.id ? 700 : 500,
                            cursor: "pointer",
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                            boxShadow:
                                tab === t.id
                                    ? "0 1px 4px rgba(0,0,0,0.08)"
                                    : "none",
                            transition: "all 0.15s",
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Contenido por tab */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                }}
            >
                <AnimatePresence mode="wait">
                    {/* ── TAB LOGO ── */}
                    {tab === "logo" && (
                        <motion.div
                            key="logo"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                        >
                            <ThemeEditor_LogoSection
                                api={api}
                                accentColor={tema.primario || accentColor}
                                iconoLogoUrl={iconoLogoUrl || undefined}
                            />
                        </motion.div>
                    )}

                    {/* ── TAB COLORES ── */}
                    {tab === "colores" && (
                        <motion.div
                            key="colores"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                            }}
                        >
                            {/* Paletas predefinidas */}
                            <div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#64748b",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.06em",
                                        marginBottom: 10,
                                    }}
                                >
                                    Paletas predefinidas
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {ThemeEditor_PALETAS.map((p) => {
                                        // FIX: comparación completa, no solo primario/acento
                                        const activa = ThemeEditor_mismoTema(
                                            ThemeEditor_temaCompleto(p.tema),
                                            tema
                                        )
                                        return (
                                            <button
                                                key={p.nombre}
                                                className="te-paleta"
                                                onClick={() =>
                                                    aplicarPaleta(p.tema)
                                                }
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    gap: 5,
                                                    padding: "8px 10px",
                                                    borderRadius: 10,
                                                    border: `1.5px solid ${activa ? p.tema.primario : "#e2e8f0"}`,
                                                    background: activa
                                                        ? p.tema.primario + "0f"
                                                        : "#fff",
                                                    cursor: "pointer",
                                                    minWidth: 54,
                                                    transition:
                                                        "transform 0.15s, box-shadow 0.15s",
                                                    fontFamily:
                                                        "'Inter Display', -apple-system, sans-serif",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: 3,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: 14,
                                                            height: 14,
                                                            borderRadius: "50%",
                                                            background:
                                                                p.tema.primario,
                                                        }}
                                                    />
                                                    <div
                                                        style={{
                                                            width: 14,
                                                            height: 14,
                                                            borderRadius: "50%",
                                                            background:
                                                                p.tema.acento,
                                                        }}
                                                    />
                                                </div>
                                                <span
                                                    style={{
                                                        fontSize: 10,
                                                        color: activa
                                                            ? p.tema.primario
                                                            : "#64748b",
                                                        fontWeight: activa
                                                            ? 700
                                                            : 500,
                                                    }}
                                                >
                                                    {p.nombre}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <ThemeEditor_Divider label="Vista previa" />

                            {/* Mini preview del tema actual */}
                            <div
                                style={{
                                    borderRadius: 12,
                                    overflow: "hidden",
                                    border: "1px solid #f1f5f9",
                                    background: tema.fondo,
                                }}
                            >
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        background: tema.primario,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: "rgba(255,255,255,0.5)",
                                        }}
                                    />
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: "#fff",
                                        }}
                                    >
                                        Tu agenda
                                    </span>
                                </div>
                                <div
                                    style={{
                                        padding: "12px 14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 6,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: tema.texto,
                                        }}
                                    >
                                        Reservar turno
                                    </span>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        {["10:00", "11:00", "14:30"].map(
                                            (h) => (
                                                <div
                                                    key={h}
                                                    style={{
                                                        padding: "4px 10px",
                                                        borderRadius: 6,
                                                        background:
                                                            tema.primario,
                                                        color: "#fff",
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {h}
                                                </div>
                                            )
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 6,
                                            marginTop: 2,
                                        }}
                                    >
                                        <div
                                            style={{
                                                padding: "3px 10px",
                                                borderRadius: 6,
                                                background: tema.acento + "22",
                                                color: tema.acento,
                                                fontSize: 11,
                                                fontWeight: 700,
                                            }}
                                        >
                                            Servicio
                                        </div>
                                        <div
                                            style={{
                                                padding: "3px 10px",
                                                borderRadius: 6,
                                                background:
                                                    tema.secundario + "18",
                                                color: tema.secundario,
                                                fontSize: 11,
                                                fontWeight: 700,
                                            }}
                                        >
                                            Detalle
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── TAB PREVIEW ── */}
                    {tab === "preview" && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                        >
                            {slug ? (
                                <ThemeEditor_AgendaPreview
                                    slug={slug}
                                    isMobile={isMobile}
                                    tema={tema}
                                />
                            ) : (
                                <div
                                    style={{
                                        textAlign: "center",
                                        color: "#94a3b8",
                                        fontSize: 13,
                                        paddingTop: 40,
                                    }}
                                >
                                    No se pudo obtener el slug del negocio.
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

function TeamManager_PlaceholderIcon({
    src,
    size = 24,
}: {
    src?: string
    size?: number
}) {
    if (!src) return <UploadPlaceholderIcon size={size} />
    return (
        <img
            src={src}
            alt=""
            style={{
                width: size,
                height: size,
                objectFit: "contain",
                opacity: 0.5,
            }}
        />
    )
}

export { ThemeEditor_Divider, ThemeEditor_ColorField, ThemeEditor_SkeletonTheme, ThemeEditor_CanvasPreview, ThemeEditor_AgendaPreview, ThemeEditor_LogoSection, ThemeEditor, TeamManager_PlaceholderIcon }
