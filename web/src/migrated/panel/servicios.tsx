import { useBranchAdmin } from "../../components/BranchAdmin"
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
import { ServiciosManager_ImageUploaderProps, ServiciosManager_getSlug, ServiciosManager_getToken, ServiciosManager_cardBase, ServiciosManager_shimmerCSS, ServiciosManager_Extra, ServiciosManager_FORM_EMPTY, ServiciosManager_FormProps, ServiciosManager_FormData, ServiciosManager_PRECIO_MINIMO, ServiciosManager_DURACIONES, ServiciosManager_formatDuracion, ServiciosManager_EXTRA_FORM_EMPTY, ServiciosManager_ExtraFormProps, ServiciosManager_ExtraFormData, ServiciosManager_PRECIO_MINIMO_EXTRA, ServiciosManager_Servicio, ServiciosManager_EmployeeCardStyle, CatalogoProfesional, ServiciosManager_useContainerWidth, TurnitsResolveAccountPlan, ServiciosManager_parseDesc, ServiciosManager_buildDesc, TurnitsLockedStyle } from "./common"
import { ServiciosManager_PlaceholderIcon } from "./inicio"
import { TurnitsPlanRequirement } from "./shared"
import { PROMO_DAYS, promoDaysLabel, promoHasMatchingDate } from "../../shared/promotions.js"

function Turnits_ImageAdjustDialog({
    file,
    aspect,
    onCancel,
    onApply,
}: {
    file: File
    aspect?: number
    onCancel: () => void
    onApply: (file: File) => void
}) {
    const [src, setSrc] = React.useState("")
    const [imageAspect, setImageAspect] = React.useState(aspect || 1)
    const [zoom, setZoom] = React.useState(1)
    const [offset, setOffset] = React.useState({ x: 0, y: 0 })
    const [drag, setDrag] = React.useState<{
        x: number
        y: number
        ox: number
        oy: number
    } | null>(null)
    const imageRef = React.useRef<HTMLImageElement>(null)
    const viewportW = Math.min(
        300,
        typeof window !== "undefined" ? window.innerWidth - 48 : 300
    )
    const cropAspect = aspect || imageAspect
    const viewportH = viewportW / cropAspect
    const baseScale =
        src && imageRef.current?.naturalWidth
            ? Math.max(
                  viewportW / imageRef.current.naturalWidth,
                  viewportH / imageRef.current.naturalHeight
              )
            : 1
    const imageW =
        (imageRef.current?.naturalWidth || viewportW) * baseScale * zoom
    const imageH =
        (imageRef.current?.naturalHeight || viewportH) * baseScale * zoom

    React.useEffect(() => {
        let cancelado = false
        let objectUrl = ""
        setSrc("")
        const prepararImagen = async () => {
            try {
                // Las fotos de celular pueden superar los 20 MP. Reducimos
                // la imagen de trabajo antes de dibujarla en el editor para
                // evitar picos de memoria y glitches en Safari mobile.
                const bitmap = await createImageBitmap(file, {
                    resizeWidth: 2000,
                    resizeQuality: "high",
                })
                const canvas = document.createElement("canvas")
                canvas.width = bitmap.width
                canvas.height = bitmap.height
                const ctx = canvas.getContext("2d")
                if (!ctx) throw new Error("No se pudo preparar la imagen")
                ctx.drawImage(bitmap, 0, 0)
                bitmap.close()
                const blob = await new Promise<Blob | null>((resolve) =>
                    canvas.toBlob(resolve, "image/webp", 0.94)
                )
                if (!blob) throw new Error("No se pudo comprimir la imagen")
                if (!cancelado) {
                    objectUrl = URL.createObjectURL(blob)
                    setSrc(objectUrl)
                }
            } catch {
                // Compatibilidad con navegadores sin createImageBitmap.
                if (!cancelado) {
                    objectUrl = URL.createObjectURL(file)
                    setSrc(objectUrl)
                }
            }
        }
        prepararImagen()
        return () => {
            cancelado = true
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [file])

    React.useEffect(() => {
        const overflowAnterior = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = overflowAnterior
        }
    }, [])

    const clampOffset = (x: number, y: number, w = imageW, h = imageH) => ({
        x: Math.max((viewportW - w) / 2, Math.min((w - viewportW) / 2, x)),
        y: Math.max((viewportH - h) / 2, Math.min((h - viewportH) / 2, y)),
    })
    const apply = () => {
        const img = imageRef.current
        if (!img) return
        const scale =
            Math.max(
                viewportW / img.naturalWidth,
                viewportH / img.naturalHeight
            ) * zoom
        const left = (viewportW - img.naturalWidth * scale) / 2 + offset.x
        const top = (viewportH - img.naturalHeight * scale) / 2 + offset.y
        const sx = Math.max(0, -left / scale)
        const sy = Math.max(0, -top / scale)
        const sw = Math.min(img.naturalWidth - sx, viewportW / scale)
        const sh = Math.min(img.naturalHeight - sy, viewportH / scale)
        const canvas = document.createElement("canvas")
        canvas.width = 900
        canvas.height = Math.round(900 / cropAspect)
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
            (blob) => {
                if (!blob) return
                const name =
                    file.name.replace(/\.[^.]+$/, "") + "-ajustada.webp"
                onApply(
                    new File([blob], name, {
                        type: "image/webp",
                        lastModified: Date.now(),
                    })
                )
            },
            "image/webp",
            0.9
        )
    }

    if (typeof document === "undefined") return null

    return createPortal(
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(15,23,42,.58)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 18,
            }}
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Ajustar imagen"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(100%, 380px)",
                    maxHeight: "92dvh",
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    background: "white",
                    borderRadius: 20,
                    padding: 20,
                    boxShadow: "0 20px 70px #0f172a44",
                    fontFamily: "'Inter Display', -apple-system, sans-serif",
                }}
            >
                <div
                    style={{ fontSize: 17, fontWeight: 750, color: "#172033" }}
                >
                    Ajustá la imagen
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: "#718096",
                        margin: "5px 0 16px",
                    }}
                >
                    Arrastrá para encuadrar y usá el control para acercar.
                </div>
                <div
                    style={{
                        width: viewportW,
                        height: viewportH,
                        maxWidth: "100%",
                        margin: "0 auto",
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: 14,
                        background: "#f1f5f9",
                        touchAction: "none",
                        cursor: "grab",
                    }}
                    onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId)
                        setDrag({
                            x: e.clientX,
                            y: e.clientY,
                            ox: offset.x,
                            oy: offset.y,
                        })
                    }}
                    onPointerMove={(e) => {
                        if (drag)
                            setOffset(
                                clampOffset(
                                    drag.ox + e.clientX - drag.x,
                                    drag.oy + e.clientY - drag.y
                                )
                            )
                    }}
                    onPointerUp={() => setDrag(null)}
                    onPointerCancel={() => setDrag(null)}
                >
                    <img
                        ref={imageRef}
                        src={src}
                        alt="Vista previa para recortar"
                        onLoad={(e) => {
                            const image = e.currentTarget
                            if (!aspect)
                                setImageAspect(
                                    Math.max(
                                        0.5,
                                        Math.min(
                                            3,
                                            image.naturalWidth /
                                                image.naturalHeight
                                        )
                                    )
                                )
                            setOffset({ x: 0, y: 0 })
                        }}
                        draggable={false}
                        style={{
                            position: "absolute",
                            width: imageW,
                            height: imageH,
                            maxWidth: "none",
                            objectFit: "fill",
                            left: `calc(50% - ${imageW / 2}px + ${offset.x}px)`,
                            top: `calc(50% - ${imageH / 2}px + ${offset.y}px)`,
                            pointerEvents: "none",
                            userSelect: "none",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            border: "1px solid rgba(27,107,26,.5)",
                            pointerEvents: "none",
                        }}
                    />
                </div>
                <label
                    style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        color: "#64748b",
                        fontSize: 12,
                        margin: "16px 0",
                    }}
                >
                    Zoom
                    <input
                        aria-label="Zoom de imagen"
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        value={zoom}
                        onChange={(e) => {
                            const next = Number(e.target.value)
                            setZoom(next)
                            setOffset((p) =>
                                clampOffset(
                                    p.x,
                                    p.y,
                                    (imageRef.current?.naturalWidth ||
                                        viewportW) *
                                        baseScale *
                                        next,
                                    (imageRef.current?.naturalHeight ||
                                        viewportH) *
                                        baseScale *
                                        next
                                )
                            )
                        }}
                        style={{ flex: 1, accentColor: "#1B6B1A" }}
                    />
                </label>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                    }}
                >
                    <button
                        type="button"
                        onClick={onCancel}
                        style={{
                            border: "1px solid #e2e8f0",
                            background: "white",
                            borderRadius: 10,
                            padding: "10px 14px",
                            fontWeight: 650,
                            color: "#475569",
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={apply}
                        style={{
                            border: 0,
                            background: "#1B6B1A",
                            borderRadius: 10,
                            padding: "10px 16px",
                            fontWeight: 700,
                            color: "white",
                        }}
                    >
                        Usar imagen
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}

function ServiciosManager_ImageUploader({
    value,
    onChange,
    accentColor,
    apiUrl,
    iconoFormUrl,
    uploadPath = "/admin/servicios/upload-imagen",
}: ServiciosManager_ImageUploaderProps) {
    const [uploading, setUploading] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)
    const [dragOver, setDragOver] = React.useState(false)
    const [cropFile, setCropFile] = React.useState<File | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const accentVars = {
        "--accent": accentColor,
        "--accent-10": accentColor + "18",
        "--accent-05": accentColor + "0d",
        "--accent-30": accentColor + "44",
    } as React.CSSProperties

    const uploadFile = async (file: File) => {
        if (!file) return
        if (!file.type.startsWith("image/")) {
            alert("Solo se permiten imágenes (JPG, PNG, WEBP).")
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            alert("La imagen no puede superar 3 MB.")
            return
        }

        setUploading(true)
        setImgError(false)

        try {
            const slug = ServiciosManager_getSlug()
            const token = ServiciosManager_getToken()
            if (!token) {
                throw new Error(
                    "No encontramos tu sesión. Cerrá sesión y volvé a ingresar."
                )
            }
            const formData = new FormData()
            formData.append("imagen", file)
            formData.append("slug", slug)

            const res = await fetch(`${apiUrl}${uploadPath}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || "Error al subir imagen")
            onChange(data.url)
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
            else if (file.type.startsWith("image/")) setCropFile(file)
            else alert("Elegí una imagen JPG, PNG o WEBP.")
        }
        e.target.value = ""
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (
            file &&
            file.type.startsWith("image/") &&
            file.size <= 3 * 1024 * 1024
        )
            setCropFile(file)
    }

    const preview = value && !imgError

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
                    gap: 14,
                    alignItems: "flex-start",
                    ...accentVars,
                }}
            >
                <div
                    className="svc-upload-zone"
                    onClick={() => !uploading && inputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    style={{
                        width: 86,
                        height: 86,
                        borderRadius: 16,
                        flexShrink: 0,
                        border: preview
                            ? "1.5px solid #eef2f7"
                            : `1.5px dashed ${dragOver ? accentColor : "#dde3ea"}`,
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
                                    animation: "svc-spin 0.7s linear infinite",
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
                                src={value}
                                alt=""
                                onError={() => setImgError(true)}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
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
                            <ServiciosManager_PlaceholderIcon
                                src={iconoFormUrl}
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
                                foto
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
                        paddingTop: 2,
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
                        Foto
                    </span>
                    <span
                        style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            lineHeight: 1.4,
                        }}
                    >
                        JPG o PNG, máx. 3 MB.
                        <br />
                        Hacé click o arrastrá la imagen.
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
                                onClick={() => {
                                    onChange("")
                                    setImgError(false)
                                }}
                                style={{
                                    padding: "5px 10px",
                                    borderRadius: 7,
                                    border: "1.5px solid #fee2e2",
                                    background: "#fff5f5",
                                    color: "#ef4444",
                                    fontSize: 11,
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

function ServiciosManager_SkeletonLista() {
    return (
        <div style={ServiciosManager_cardBase}>
            <style>{ServiciosManager_shimmerCSS}</style>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 20,
                }}
            >
                <div
                    className="svc-shimmer"
                    style={{ width: 160, height: 20, borderRadius: 6 }}
                />
                <div
                    className="svc-shimmer"
                    style={{ width: 110, height: 34, borderRadius: 10 }}
                />
            </div>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    style={{ display: "flex", gap: 14, marginBottom: 12 }}
                >
                    <div
                        className="svc-shimmer"
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 12,
                            flexShrink: 0,
                        }}
                    />
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        <div
                            className="svc-shimmer"
                            style={{
                                width: "60%",
                                height: 14,
                                borderRadius: 4,
                            }}
                        />
                        <div
                            className="svc-shimmer"
                            style={{
                                width: "40%",
                                height: 12,
                                borderRadius: 4,
                            }}
                        />
                    </div>
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <div
                            className="svc-shimmer"
                            style={{ width: 28, height: 28, borderRadius: 8 }}
                        />
                        <div
                            className="svc-shimmer"
                            style={{ width: 28, height: 28, borderRadius: 8 }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

function ServiciosManager_FormSection({
    label,
    hint,
    children,
}: {
    label: string
    hint?: string
    children: React.ReactNode
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.1px",
                    }}
                >
                    {label}
                </div>
                {hint && (
                    <div
                        style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            marginTop: 1,
                        }}
                    >
                        {hint}
                    </div>
                )}
            </div>
            {children}
        </div>
    )
}

function ServiciosManager_FieldIcon({
    name,
    size = 15,
    color = "#1e293b",
}: {
    name: string
    size?: number
    color?: string
}) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none" as const,
        stroke: color,
        strokeWidth: 2,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    }
    switch (name) {
        case "tag":
            return (
                <svg {...common}>
                    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z" />
                    <circle cx="7.5" cy="7.5" r=".5" fill={color} />
                </svg>
            )
        case "align-left":
            return (
                <svg {...common}>
                    <line x1="21" x2="3" y1="6" y2="6" />
                    <line x1="15" x2="3" y1="12" y2="12" />
                    <line x1="17" x2="3" y1="18" y2="18" />
                </svg>
            )
        case "dollar":
            return (
                <svg {...common}>
                    <line x1="12" x2="12" y1="2" y2="22" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
            )
        case "users":
            return (
                <svg {...common}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            )
        case "list":
            return (
                <svg {...common}>
                    <line x1="8" x2="21" y1="6" y2="6" />
                    <line x1="8" x2="21" y1="12" y2="12" />
                    <line x1="8" x2="21" y1="18" y2="18" />
                    <line x1="3" x2="3.01" y1="6" y2="6" />
                    <line x1="3" x2="3.01" y1="12" y2="12" />
                    <line x1="3" x2="3.01" y1="18" y2="18" />
                </svg>
            )
        case "calendar":
            return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18"/></svg>
        case "clock":
            return (
                <svg {...common}>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            )
        case "package":
            return (
                <svg {...common}>
                    <path d="m7.5 4.27 9 5.15" />
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="M3.3 7 12 12l8.7-5" />
                    <path d="M12 22V12" />
                </svg>
            )
        default:
            return null
    }
}

function ServiciosManager_Field({
    label,
    children,
    hint,
    icon,
}: {
    label: string
    children: React.ReactNode
    hint?: string
    icon?: string
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div>
                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        letterSpacing: "-0.1px",
                    }}
                >
                    {icon && (
                        <ServiciosManager_FieldIcon
                            name={icon}
                            color="#64748b"
                        />
                    )}
                    {label}
                </label>
                {hint && (
                    <div
                        style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}
                    >
                        {hint}
                    </div>
                )}
            </div>
            {children}
        </div>
    )
}

function ServiciosManager_AutoTextarea({ value, onChange, placeholder }: any) {
    const ref = React.useRef<HTMLTextAreaElement>(null)

    React.useEffect(() => {
        const el = ref.current
        if (!el) return
        el.style.height = "auto"
        el.style.height = `${el.scrollHeight}px`
    }, [value])

    return (
        <textarea
            ref={ref}
            className="svc-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={1}
            style={{
                padding: "9px 11px",
                borderRadius: 9,
                border: "1.5px solid #e2e8f0",
                fontSize: 13,
                color: "#1e293b",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                background: "#fff",
                width: "100%",
                boxSizing: "border-box",
                resize: "none",
                overflow: "hidden",
                lineHeight: 1.4,
                transition: "border-color 0.15s, box-shadow 0.15s",
            }}
        />
    )
}

function ServiciosManager_Input({
    value,
    onChange,
    placeholder,
    type = "text",
}: any) {
    return (
        <input
            className="svc-input"
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                padding: "9px 11px",
                borderRadius: 9,
                border: "1.5px solid #e2e8f0",
                fontSize: 13,
                color: "#1e293b",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
                background: "#fff",
                width: "100%",
                boxSizing: "border-box",
                transition: "border-color 0.15s, box-shadow 0.15s",
            }}
        />
    )
}

function ServiciosManager_PrecioInput({
    value,
    onChange,
    placeholder,
    accentColor,
}: any) {
    return (
        <div style={{ position: "relative" }}>
            <span
                style={{
                    position: "absolute",
                    left: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#94a3b8",
                    pointerEvents: "none",
                }}
            >
                $
            </span>
            <input
                className="svc-input"
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    padding: "9px 11px 9px 22px",
                    borderRadius: 9,
                    border: "1.5px solid #e2e8f0",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1e293b",
                    fontFamily: "'Inter Display', -apple-system, sans-serif",
                    background: "#fff",
                    width: "100%",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                }}
            />
        </div>
    )
}

function ServiciosManager_ExtrasVinculados({
    servicioId,
    accentColor,
    apiUrl,
    isMobile,
}: {
    servicioId: string
    accentColor: string
    apiUrl: string
    isMobile: boolean
}) {
    const [loading, setLoading] = React.useState(true)
    const [extras, setExtras] = React.useState<
        (ServiciosManager_Extra & { vinculado: boolean })[]
    >([])
    const [error, setError] = React.useState("")
    const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set())

    React.useEffect(() => {
        let activo = true
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        setLoading(true)
        setError("")
        fetch(
            `${apiUrl}/admin/servicios/${servicioId}/extras-disponibles?slug=${slug}`,
            { headers: { Authorization: `Bearer ${token}` } }
        )
            .then((r) => r.json())
            .then((data) => {
                if (!activo) return
                if (data.success) setExtras(data.extras || [])
                else
                    setError(
                        data.error || "No se pudieron cargar los productos."
                    )
                setLoading(false)
            })
            .catch(() => {
                if (!activo) return
                setError("No se pudieron cargar los productos.")
                setLoading(false)
            })
        return () => {
            activo = false
        }
    }, [servicioId, apiUrl])

    const toggle = async (
        extra: ServiciosManager_Extra & { vinculado: boolean }
    ) => {
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        const nuevoEstado = !extra.vinculado

        setPendingIds((p) => new Set(p).add(extra.id))
        setExtras((prev) =>
            prev.map((e) =>
                e.id === extra.id ? { ...e, vinculado: nuevoEstado } : e
            )
        )

        try {
            const res = nuevoEstado
                ? await fetch(
                      `${apiUrl}/admin/servicios/${servicioId}/extras`,
                      {
                          method: "POST",
                          headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ extra_id: extra.id, slug }),
                      }
                  )
                : await fetch(
                      `${apiUrl}/admin/servicios/${servicioId}/extras/${extra.id}?slug=${slug}`,
                      {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${token}` },
                      }
                  )
            if (!res.ok) throw new Error()
        } catch {
            setExtras((prev) =>
                prev.map((e) =>
                    e.id === extra.id ? { ...e, vinculado: extra.vinculado } : e
                )
            )
        }

        setPendingIds((p) => {
            const next = new Set(p)
            next.delete(extra.id)
            return next
        })
    }

    if (loading) {
        return (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="svc-shimmer"
                        style={{ width: 92, height: 30, borderRadius: 9 }}
                    />
                ))}
            </div>
        )
    }

    if (error) {
        return <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
    }

    if (extras.length === 0) {
        return (
            <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>
                Todavía no cargaste productos extra. Creá el primero desde la
                pestaña «Productos extra» y volvé acá para vincularlo.
            </span>
        )
    }

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {extras.map((extra) => {
                const sel = extra.vinculado
                const pending = pendingIds.has(extra.id)
                return (
                    <button
                        key={extra.id}
                        className={`svc-dur${sel ? " active" : ""}`}
                        onClick={() => !pending && toggle(extra)}
                        disabled={pending}
                        title={extra.descripcion || undefined}
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
                            opacity: pending ? 0.6 : 1,
                        }}
                    >
                        {extra.nombre} · ${extra.precio.toLocaleString("es-AR")}
                    </button>
                )
            })}
        </div>
    )
}

function ServiciosManager_ServicioForm({
    initial = ServiciosManager_FORM_EMPTY,
    accentColor,
    apiUrl,
    iconoFormUrl,
    onSubmit,
    onCancel,
    guardando,
    error,
    modoEdicion,
    isMobile,
    servicioId,
    uploadPath,
    employeeVariant = false,
    employeeMode = false,
}: ServiciosManager_FormProps) {
    const [form, setForm] = React.useState<ServiciosManager_FormData>(initial)
    const [precioError, setPrecioError] = React.useState("")

    const set = (key: keyof ServiciosManager_FormData) => (val: string) =>
        setForm((p) => ({ ...p, [key]: val }))

    const accentVars = {
        "--accent": accentColor,
        "--accent-10": accentColor + "18",
        "--accent-05": accentColor + "0d",
        "--accent-30": accentColor + "44",
    } as React.CSSProperties

    const handleSubmit = () => {
        if (Number(form.precio) < ServiciosManager_PRECIO_MINIMO) {
            setPrecioError(
                `El precio mínimo es $${ServiciosManager_PRECIO_MINIMO.toLocaleString("es-AR")}.`
            )
            return
        }
        setPrecioError("")
        onSubmit(form)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            style={{
                ...accentVars,
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #eef2f7",
                boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
                overflow: "hidden",
            }}
        >
            <style>{ServiciosManager_shimmerCSS}</style>

            {/* Header plano, sin franja de color ni ilustraciones decorativas */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: isMobile ? "16px 16px 0" : "20px 20px 0",
                    flexShrink: 0,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: isMobile ? 18 : 20,
                            fontWeight: 800,
                            color: "#111827",
                            letterSpacing: "-0.4px",
                            lineHeight: 1.25,
                        }}
                    >
                        {modoEdicion ? "Editar servicio" : "Crear un servicio"}
                    </div>
                    <div
                        style={{
                            fontSize: 12.5,
                            color: "#64748b",
                            marginTop: 4,
                            lineHeight: 1.45,
                            maxWidth: 460,
                        }}
                    >
                        {modoEdicion
                            ? "Los cambios se reflejan al instante en tu link de reservas."
                            : "Agregá los detalles de tu servicio para que tus clientes puedan reservarlo fácilmente."}
                    </div>
                </div>
                <button
                    onClick={onCancel}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        fontSize: 20,
                        lineHeight: 1,
                        padding: "0 2px",
                        flexShrink: 0,
                    }}
                >
                    ×
                </button>
            </div>

            <div
                style={{
                    padding: isMobile ? "16px" : "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 18 : 20,
                }}
            >
                {/* Foto del servicio: se deja arriba de la grilla, es funcional
                    (no decorativa) así que no sigue el layout del mockup. */}
                <ServiciosManager_ImageUploader
                    value={form.imagen}
                    onChange={set("imagen")}
                    accentColor={accentColor}
                    apiUrl={apiUrl}
                    iconoFormUrl={iconoFormUrl}
                    uploadPath={uploadPath}
                />

                {/* Nombre + Descripción lado a lado, sin título de sección,
                    igual que el mockup. La descripción arranca del mismo
                    alto que el input de nombre y crece con el contenido. */}
                {!employeeVariant && (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                            gap: isMobile ? 18 : 20,
                            alignItems: "start",
                        }}
                    >
                        <ServiciosManager_Field
                            label="Nombre del servicio"
                            icon="tag"
                        >
                            <ServiciosManager_Input
                                value={form.nombre}
                                onChange={set("nombre")}
                                placeholder="Ej: Corte de pelo"
                            />
                        </ServiciosManager_Field>

                        <ServiciosManager_Field
                            label="Descripción"
                            icon="align-left"
                        >
                            <ServiciosManager_AutoTextarea
                                value={form.descripcion}
                                onChange={set("descripcion")}
                                placeholder="Contá brevemente qué incluye el servicio…"
                            />
                        </ServiciosManager_Field>
                    </div>
                )}

                {/* Precio, capacidad y orden en una fila, sin selector de
                    moneda (el precio siempre es en la moneda de la cuenta). */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: isMobile
                            ? "1fr 1fr"
                            : "1fr 1fr 1fr",
                        gap: isMobile ? 14 : 20,
                    }}
                >
                    <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
                        <ServiciosManager_Field
                            label="Precio"
                            icon="dollar"
                            hint={`Mínimo $${ServiciosManager_PRECIO_MINIMO.toLocaleString("es-AR")}`}
                        >
                            <ServiciosManager_PrecioInput
                                value={form.precio}
                                onChange={(val: string) => {
                                    set("precio")(val)
                                    if (
                                        Number(val) >=
                                        ServiciosManager_PRECIO_MINIMO
                                    )
                                        setPrecioError("")
                                }}
                                placeholder={String(
                                    ServiciosManager_PRECIO_MINIMO
                                )}
                                accentColor={accentColor}
                            />
                            {precioError && (
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: "#ef4444",
                                        fontWeight: 500,
                                        marginTop: 2,
                                        display: "block",
                                    }}
                                >
                                    {precioError}
                                </span>
                            )}
                        </ServiciosManager_Field>
                    </div>
                    {!employeeVariant && (
                        <ServiciosManager_Field
                            label="Capacidad"
                            icon="users"
                            hint="Personas por turno"
                        >
                            <ServiciosManager_Input
                                value={form.capacidad}
                                onChange={set("capacidad")}
                                type="number"
                                placeholder="1"
                            />
                        </ServiciosManager_Field>
                    )}
                    <ServiciosManager_Field
                        label="Orden"
                        icon="list"
                        hint="Posición en la lista"
                    >
                        <ServiciosManager_Input
                            value={form.orden}
                            onChange={set("orden")}
                            type="number"
                            placeholder="0"
                        />
                    </ServiciosManager_Field>
                </div>

                {/* Duración */}
                {!employeeVariant && (
                    <ServiciosManager_Field
                        label="Duración"
                        icon="clock"
                        hint="Cuánto tiempo dura cada turno de este servicio."
                    >
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 7,
                            }}
                        >
                            {ServiciosManager_DURACIONES.map((min) => {
                                const sel =
                                    String(form.duracion) === String(min)
                                return (
                                    <button
                                        key={min}
                                        className={`svc-dur${sel ? " active" : ""}`}
                                        onClick={() =>
                                            set("duracion")(String(min))
                                        }
                                        style={{
                                            padding: isMobile
                                                ? "7px 12px"
                                                : "6px 13px",
                                            borderRadius: 9,
                                            border: `1.5px solid ${sel ? accentColor : "#e2e8f0"}`,
                                            background: sel
                                                ? accentColor
                                                : "#fff",
                                            color: sel ? "#fff" : "#475569",
                                            fontSize: isMobile ? 13 : 12,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            fontFamily:
                                                "'Inter Display', -apple-system, sans-serif",
                                            transition: "all 0.12s",
                                            minHeight: isMobile ? 36 : "auto",
                                        }}
                                    >
                                        {ServiciosManager_formatDuracion(min)}
                                    </button>
                                )
                            })}
                            {!ServiciosManager_DURACIONES.includes(
                                Number(form.duracion)
                            ) && (
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: accentColor,
                                        padding: "6px 4px",
                                        fontWeight: 700,
                                    }}
                                >
                                    {form.duracion} min
                                </span>
                            )}
                            <input
                                type="number"
                                value={
                                    ServiciosManager_DURACIONES.includes(
                                        Number(form.duracion)
                                    )
                                        ? ""
                                        : form.duracion
                                }
                                onChange={(e) =>
                                    set("duracion")(e.target.value)
                                }
                                placeholder="otro (min)"
                                style={{
                                    width: 84,
                                    padding: "6px 10px",
                                    borderRadius: 9,
                                    border: "1.5px dashed #dde3ea",
                                    fontSize: 12,
                                    color: "#64748b",
                                    fontFamily:
                                        "'Inter Display', -apple-system, sans-serif",
                                    background: "transparent",
                                }}
                                title="Duración personalizada"
                            />
                        </div>
                    </ServiciosManager_Field>
                )}

                {/* Productos relacionados. La vinculación necesita el id del
                    servicio, así que solo se puede elegir editando; al crear
                    se deja el aviso de siempre en el mismo estilo de campo. */}
                {!employeeVariant && !employeeMode && (
                    <ServiciosManager_Field
                        label="Productos relacionados"
                        icon="package"
                        hint="Elegí qué productos extra ofrecer junto con este servicio."
                    >
                        {modoEdicion && servicioId ? (
                            <ServiciosManager_ExtrasVinculados
                                servicioId={servicioId}
                                accentColor={accentColor}
                                apiUrl={apiUrl}
                                isMobile={isMobile}
                            />
                        ) : (
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 10,
                                    background: accentColor + "0a",
                                    border: `1px solid ${accentColor}22`,
                                    fontSize: 12,
                                    color: "#64748b",
                                    lineHeight: 1.5,
                                }}
                            >
                                Podés crear productos extra en la pestaña
                                «Productos extra». Una vez creado este servicio,
                                vas a poder vincularlos desde "Editar".
                            </div>
                        )}
                    </ServiciosManager_Field>
                )}

                {error && (
                    <div
                        style={{
                            padding: "9px 12px",
                            borderRadius: 9,
                            background: "#fff5f5",
                            border: "1px solid #fee2e2",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                color: "#ef4444",
                                fontWeight: 500,
                            }}
                        >
                            {error}
                        </span>
                    </div>
                )}

                {/* Botones */}
                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: isMobile ? "stretch" : "flex-end",
                        flexDirection: isMobile ? "column-reverse" : "row",
                        paddingTop: 2,
                    }}
                >
                    <button
                        onClick={onCancel}
                        style={{
                            padding: isMobile ? "11px 16px" : "9px 16px",
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                            background: "none",
                            fontSize: 13,
                            cursor: "pointer",
                            color: "#64748b",
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                            width: isMobile ? "100%" : "auto",
                        }}
                    >
                        Cancelar
                    </button>
                    <motion.button
                        className="svc-save-btn"
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSubmit}
                        disabled={guardando || !form.nombre.trim()}
                        style={{
                            padding: isMobile ? "11px 20px" : "9px 22px",
                            borderRadius: 10,
                            border: "none",
                            background:
                                guardando || !form.nombre.trim()
                                    ? "#cbd5e1"
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
                            transition: "background 0.15s, filter 0.15s",
                            boxShadow:
                                guardando || !form.nombre.trim()
                                    ? "none"
                                    : `0 4px 14px ${accentColor}40`,
                            width: isMobile ? "100%" : "auto",
                        }}
                    >
                        {guardando
                            ? "Guardando…"
                            : modoEdicion
                              ? "Guardar cambios"
                              : "Guardar servicio"}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    )
}

function ServiciosManager_ExtraForm({
    employeeMode = false,
    initial = ServiciosManager_EXTRA_FORM_EMPTY,
    accentColor,
    apiUrl,
    iconoFormUrl,
    onSubmit,
    onCancel,
    guardando,
    error,
    modoEdicion,
    isMobile,
}: ServiciosManager_ExtraFormProps) {
    const [form, setForm] =
        React.useState<ServiciosManager_ExtraFormData>(initial)
    const [precioError, setPrecioError] = React.useState("")

    const set = (key: keyof ServiciosManager_ExtraFormData) => (val: string) =>
        setForm((p) => ({ ...p, [key]: val }))

    const accentVars = {
        "--accent": accentColor,
        "--accent-10": accentColor + "18",
        "--accent-05": accentColor + "0d",
        "--accent-30": accentColor + "44",
    } as React.CSSProperties

    const handleSubmit = () => {
        if (Number(form.precio) < ServiciosManager_PRECIO_MINIMO_EXTRA) {
            setPrecioError(
                `El precio mínimo es $${ServiciosManager_PRECIO_MINIMO_EXTRA.toLocaleString("es-AR")}.`
            )
            return
        }
        setPrecioError("")
        onSubmit(form)
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            style={{
                ...accentVars,
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #eef2f7",
                boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
                overflow: "hidden",
            }}
        >
            <style>{ServiciosManager_shimmerCSS}</style>

            {/* Header plano, sin franja de color ni ilustraciones decorativas
                — mismo tratamiento que ServiciosManager_ServicioForm. */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: isMobile ? "16px 16px 0" : "20px 20px 0",
                    flexShrink: 0,
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: isMobile ? 18 : 20,
                            fontWeight: 800,
                            color: "#111827",
                            letterSpacing: "-0.4px",
                            lineHeight: 1.25,
                        }}
                    >
                        {modoEdicion ? "Editar producto" : "Crear un producto"}
                    </div>
                    <div
                        style={{
                            fontSize: 12.5,
                            color: "#64748b",
                            marginTop: 4,
                            lineHeight: 1.45,
                            maxWidth: 460,
                        }}
                    >
                        {modoEdicion
                            ? "Los cambios se reflejan donde esté vinculado."
                            : "Después podés vincularlo a uno o más servicios."}
                    </div>
                </div>
                <button
                    onClick={onCancel}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        fontSize: 20,
                        lineHeight: 1,
                        padding: "0 2px",
                        flexShrink: 0,
                    }}
                >
                    ×
                </button>
            </div>

            <div
                style={{
                    padding: isMobile ? "16px" : "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? 18 : 20,
                }}
            >
                {/* Foto del producto: igual tratamiento que la foto de
                    servicio, arriba de la grilla. */}
                <ServiciosManager_ImageUploader
                    value={form.imagen_url}
                    onChange={set("imagen_url")}
                    accentColor={accentColor}
                    apiUrl={apiUrl}
                    iconoFormUrl={iconoFormUrl}
                    uploadPath={employeeMode ? `/empleado/${encodeURIComponent(ServiciosManager_getSlug())}/extras/upload-imagen` : "/admin/extras/upload-imagen"}
                />

                {/* Nombre + Descripción lado a lado, con íconos en el label,
                    igual que en el formulario de servicios. */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                        gap: isMobile ? 18 : 20,
                        alignItems: "start",
                    }}
                >
                    <ServiciosManager_Field
                        label="Nombre del producto"
                        icon="tag"
                    >
                        <ServiciosManager_Input
                            value={form.nombre}
                            onChange={set("nombre")}
                            placeholder="Ej: Cera para peinar"
                        />
                    </ServiciosManager_Field>

                    <ServiciosManager_Field
                        label="Descripción"
                        icon="align-left"
                    >
                        <ServiciosManager_AutoTextarea
                            value={form.descripcion}
                            onChange={set("descripcion")}
                            placeholder="Describí brevemente el producto…"
                        />
                    </ServiciosManager_Field>
                </div>

                {/* Precio y orden en una fila, mismo criterio que precio /
                    capacidad / orden en servicios. */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
                        gap: isMobile ? 14 : 20,
                    }}
                >
                    <ServiciosManager_Field
                        label="Precio"
                        icon="dollar"
                        hint={`Mínimo $${ServiciosManager_PRECIO_MINIMO_EXTRA.toLocaleString("es-AR")}`}
                    >
                        <ServiciosManager_PrecioInput
                            value={form.precio}
                            onChange={(val: string) => {
                                set("precio")(val)
                                if (
                                    Number(val) >=
                                    ServiciosManager_PRECIO_MINIMO_EXTRA
                                )
                                    setPrecioError("")
                            }}
                            placeholder={String(
                                ServiciosManager_PRECIO_MINIMO_EXTRA
                            )}
                            accentColor={accentColor}
                        />
                        {precioError && (
                            <span
                                style={{
                                    fontSize: 11,
                                    color: "#ef4444",
                                    fontWeight: 500,
                                    marginTop: 2,
                                }}
                            >
                                {precioError}
                            </span>
                        )}
                    </ServiciosManager_Field>

                    <ServiciosManager_Field
                        label="Orden"
                        icon="list"
                        hint="Posición en la lista"
                    >
                        <ServiciosManager_Input
                            value={form.orden}
                            onChange={set("orden")}
                            type="number"
                            placeholder="0"
                        />
                    </ServiciosManager_Field>
                </div>

                {error && (
                    <div
                        style={{
                            padding: "9px 12px",
                            borderRadius: 9,
                            background: "#fff5f5",
                            border: "1px solid #fee2e2",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 12,
                                color: "#ef4444",
                                fontWeight: 500,
                            }}
                        >
                            {error}
                        </span>
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: isMobile ? "stretch" : "flex-end",
                        flexDirection: isMobile ? "column-reverse" : "row",
                        paddingTop: 2,
                    }}
                >
                    <button
                        onClick={onCancel}
                        style={{
                            padding: isMobile ? "11px 16px" : "9px 16px",
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                            background: "none",
                            fontSize: 13,
                            cursor: "pointer",
                            color: "#64748b",
                            fontFamily:
                                "'Inter Display', -apple-system, sans-serif",
                            width: isMobile ? "100%" : "auto",
                        }}
                    >
                        Cancelar
                    </button>
                    <motion.button
                        className="svc-save-btn"
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSubmit}
                        disabled={guardando || !form.nombre.trim()}
                        style={{
                            padding: isMobile ? "11px 20px" : "9px 22px",
                            borderRadius: 10,
                            border: "none",
                            background:
                                guardando || !form.nombre.trim()
                                    ? "#cbd5e1"
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
                            transition: "background 0.15s, filter 0.15s",
                            boxShadow:
                                guardando || !form.nombre.trim()
                                    ? "none"
                                    : `0 4px 14px ${accentColor}40`,
                            width: isMobile ? "100%" : "auto",
                        }}
                    >
                        {guardando
                            ? "Guardando…"
                            : modoEdicion
                              ? "Guardar cambios"
                              : "Guardar producto"}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    )
}

function ServiciosManager_ServicioCard({
    svc,
    accentColor,
    iconoPlaceholderUrl,
    iconoCheck,
    iconoEditar,
    iconoEliminar,
    onEdit,
    onToggle,
    onDelete,
    isMobile,
    employeeMode = false,
    employeeCanEdit = true,
}: {
    svc: ServiciosManager_Servicio
    accentColor: string
    iconoPlaceholderUrl?: string
    iconoCheck?: string
    iconoEditar?: string
    iconoEliminar?: string
    onEdit: () => void
    onToggle: () => void
    onDelete: () => void
    isMobile: boolean
    employeeMode?: boolean
    employeeCanEdit?: boolean
}) {
    const branch = useBranchAdmin()
    const [confirmDelete, setConfirmDelete] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)

    const thumbSize = isMobile ? 46 : 52

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: !employeeMode && svc.owner_equipo_id ? (svc.activo ? 0.8 : 0.5) : (svc.activo ? 1 : 0.55), y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="svc-card"
            style={{
                display: "flex",
                alignItems: "center",
                // Mobile: si no entra todo en una línea, los botones
                // bajan en vez de apretar/cortar el nombre.
                flexWrap: isMobile ? "wrap" : "nowrap",
                gap: isMobile ? 10 : 12,
                padding: isMobile ? "12px" : "12px",
                borderRadius: 12,
                background: svc.activo ? "#fff" : "#f8fafc",
                border: "1px solid #f1f5f9",
                opacity: svc.activo ? 1 : 0.55,
                transition: "background 0.15s, opacity 0.2s",
                ...(!employeeMode ? ServiciosManager_EmployeeCardStyle(svc) : {}),
            }}
        >
            <div
                style={{
                    width: thumbSize,
                    height: thumbSize,
                    borderRadius: 10,
                    flexShrink: 0,
                    overflow: "hidden",
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {svc.imagen && !imgError ? (
                    <img
                        src={svc.imagen}
                        alt={svc.nombre}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <ServiciosManager_PlaceholderIcon
                        src={iconoPlaceholderUrl}
                        size={isMobile ? 20 : 24}
                    />
                )}
            </div>

            <div style={{ flex: isMobile ? "1 1 150px" : 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: isMobile ? 13.5 : 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        whiteSpace: isMobile ? "normal" : "nowrap",
                        overflowWrap: "anywhere",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.2px",
                    }}
                >
                    {svc.nombre}
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 3,
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: accentColor,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        ${svc.precio.toLocaleString("es-AR")}
                    </span>
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>·</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {ServiciosManager_formatDuracion(svc.duracion)}
                    </span>
                    {svc.capacidad > 1 && !isMobile && (
                        <>
                            <span style={{ fontSize: 11, color: "#cbd5e1" }}>
                                ·
                            </span>
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                {svc.capacidad} personas
                            </span>
                        </>
                    )}
                </div>
                {!employeeMode && <ServiciosManager_Creador item={svc} />}
                {!employeeMode && <ServiciosManager_Profesionales profesionales={svc.profesionales} />}
                {svc.descripcion && (
                    <div
                        style={{
                            fontSize: 11.5,
                            color: "#94a3b8",
                            marginTop: 4,
                            lineHeight: 1.4,
                            ...(isMobile
                                ? {
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical" as any,
                                      overflow: "hidden",
                                  }
                                : {
                                      whiteSpace: "nowrap" as any,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                  }),
                        }}
                    >
                        {svc.descripcion}
                    </div>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    gap: isMobile ? 6 : 4,
                    alignItems: "center",
                    flexShrink: 0,
                    marginLeft: isMobile ? "auto" : 0,
                }}
            >
                {!branch && !employeeMode && (
                    <button
                        className="svc-btn-icon"
                        title={svc.activo ? "Desactivar" : "Activar"}
                        onClick={onToggle}
                        style={{
                            width: isMobile ? 36 : 30,
                            height: isMobile ? 36 : 30,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: svc.activo
                                ? accentColor + "12"
                                : "#f1f5f9",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isMobile ? 12 : 13,
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
                                    opacity: svc.activo ? 1 : 0.4,
                                }}
                            />
                        ) : svc.activo ? (
                            ""
                        ) : (
                            "○"
                        )}
                    </button>
                )}
                {employeeCanEdit && (
                    <button
                        className="svc-btn-icon"
                        title="Editar"
                        onClick={onEdit}
                        style={{
                            width: isMobile ? 36 : 30,
                            height: isMobile ? 36 : 30,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: isMobile ? 12 : 13,
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
                    </button>
                )}
                {!branch && (employeeMode || employeeCanEdit) &&
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
                            className="svc-btn-icon"
                            title="Eliminar"
                            onClick={() => setConfirmDelete(true)}
                            style={{
                                width: isMobile ? 36 : 30,
                                height: isMobile ? 36 : 30,
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

function ServiciosManager_Creador({item}:{item:any}) {
    if(!item.owner_equipo_id)return null
    const nombre=[item.creador?.nombre,item.creador?.apellido].filter(Boolean).join(" ") || "Empleado"
    return <div style={{fontSize:10,fontWeight:600,color:item.creador?.color || "#64748b",marginTop:5}}>Creado por {nombre}</div>
}

function ServiciosManager_ProfesionalAvatar({prof}:{prof:CatalogoProfesional}) {
    const [error,setError]=React.useState(false)
    React.useEffect(()=>setError(false),[prof.foto_url])
    const nombre=[prof.nombre,prof.apellido].filter(Boolean).join(" ")
    const iniciales=[prof.nombre,prof.apellido].filter(Boolean).map(v=>v!.trim()[0]).join("").toUpperCase().slice(0,2) || "P"
    return <span role="img" aria-label={nombre} title={nombre} style={{width:25,height:25,borderRadius:"50%",border:"2px solid white",boxSizing:"border-box",overflow:"hidden",background:prof.color || "#e2e8f0",color:prof.color ? "white" : "#475569",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0}}>
        {prof.foto_url && !error ? <img src={prof.foto_url} alt="" onError={()=>setError(true)} style={{display:"block",width:"100%",height:"100%",objectFit:"cover"}}/> : iniciales}
    </span>
}

function ServiciosManager_Profesionales({profesionales=[]}:{profesionales?:CatalogoProfesional[]}) {
    if(!profesionales.length)return null
    return <div aria-label="Profesionales que lo ofrecen" style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:3,marginTop:7}}>{profesionales.map(prof=><ServiciosManager_ProfesionalAvatar key={prof.id} prof={prof}/>)}</div>
}

function ServiciosManager_ExtraCard({
    employeeMode = false,
    extra,
    canEdit = true,
    accentColor,
    iconoPlaceholderUrl,
    iconoCheck,
    iconoEditar,
    iconoEliminar,
    onEdit,
    onToggle,
    onDelete,
    isMobile,
}: {
    canEdit?: boolean
    employeeMode?: boolean
    extra: ServiciosManager_Extra
    accentColor: string
    iconoPlaceholderUrl?: string
    iconoCheck?: string
    iconoEditar?: string
    iconoEliminar?: string
    onEdit: () => void
    onToggle: () => void
    onDelete: () => void
    isMobile: boolean
}) {
    const [confirmDelete, setConfirmDelete] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)
    const thumbSize = isMobile ? 46 : 52

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: !employeeMode && extra.owner_equipo_id ? (extra.activo ? 0.8 : 0.5) : (extra.activo ? 1 : 0.55), y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="svc-card"
            style={{
                display: "flex",
                alignItems: "center",
                flexWrap: isMobile ? "wrap" : "nowrap",
                gap: isMobile ? 10 : 12,
                padding: isMobile ? "12px" : "12px",
                borderRadius: 12,
                background: extra.activo ? "#fff" : "#f8fafc",
                border: "1px solid #f1f5f9",
                opacity: extra.activo ? 1 : 0.55,
                transition: "background 0.15s, opacity 0.2s",
                ...(!employeeMode ? ServiciosManager_EmployeeCardStyle(extra) : {}),
            }}
        >
            <div
                style={{
                    width: thumbSize,
                    height: thumbSize,
                    borderRadius: 10,
                    flexShrink: 0,
                    overflow: "hidden",
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                {extra.imagen_url && !imgError ? (
                    <img
                        src={extra.imagen_url}
                        alt={extra.nombre}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <ServiciosManager_PlaceholderIcon
                        src={iconoPlaceholderUrl}
                        size={isMobile ? 20 : 24}
                    />
                )}
            </div>

            <div style={{ flex: isMobile ? "1 1 150px" : 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: isMobile ? 13.5 : 13,
                        fontWeight: 700,
                        color: "#1e293b",
                        whiteSpace: isMobile ? "normal" : "nowrap",
                        overflowWrap: "anywhere",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        letterSpacing: "-0.2px",
                    }}
                >
                    {extra.nombre}
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 3,
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
                    <span
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: accentColor,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        ${extra.precio.toLocaleString("es-AR")}
                    </span>
                </div>
                {!employeeMode && <ServiciosManager_Creador item={extra} />}
                {!employeeMode && <ServiciosManager_Profesionales profesionales={extra.profesionales} />}
                {extra.compartido && <div style={{fontSize:10,color:"#64748b",marginTop:4}}>Producto del negocio · lo administra el titular</div>}
                {extra.descripcion && (
                    <div
                        style={{
                            fontSize: 11.5,
                            color: "#94a3b8",
                            marginTop: 4,
                            lineHeight: 1.4,
                            ...(isMobile
                                ? {
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical" as any,
                                      overflow: "hidden",
                                  }
                                : {
                                      whiteSpace: "nowrap" as any,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                  }),
                        }}
                    >
                        {extra.descripcion}
                    </div>
                )}
            </div>

            <div
                style={{
                    display: canEdit ? "flex" : "none",
                    gap: isMobile ? 6 : 4,
                    alignItems: "center",
                    flexShrink: 0,
                    marginLeft: isMobile ? "auto" : 0,
                }}
            >
                <button
                    className="svc-btn-icon"
                    title={extra.activo ? "Desactivar" : "Activar"}
                    onClick={onToggle}
                    style={{
                        width: isMobile ? 36 : 30,
                        height: isMobile ? 36 : 30,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: extra.activo
                            ? accentColor + "12"
                            : "#f1f5f9",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isMobile ? 12 : 13,
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
                                opacity: extra.activo ? 1 : 0.4,
                            }}
                        />
                    ) : extra.activo ? (
                        ""
                    ) : (
                        "○"
                    )}
                </button>
                <button
                    className="svc-btn-icon"
                    title="Editar"
                    onClick={onEdit}
                    style={{
                        width: isMobile ? 36 : 30,
                        height: isMobile ? 36 : 30,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isMobile ? 12 : 13,
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
                </button>
                {confirmDelete ? (
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
                        className="svc-btn-icon"
                        title="Eliminar"
                        onClick={() => setConfirmDelete(true)}
                        style={{
                            width: isMobile ? 36 : 30,
                            height: isMobile ? 36 : 30,
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
                )}
            </div>
        </motion.div>
    )
}

function ServiciosManager(props: any) {
    const {
        baseUrl = appConfig.apiUrl,
        accentColor = "#22c55e",
        iconoPlaceholderUrl = "",
        iconoFormUrl = "",
        iconoVacioUrl = "",
        iconoCheck = "",
        iconoEditar = "",
        iconoEliminar = "",
        employeeMode = false,
        employeeCanCreate = false,
        style,
    } = props

    const branch = useBranchAdmin()
    const api = baseUrl.replace(/\/+$/, "")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = ServiciosManager_useContainerWidth(containerRef)
    const isMobile = containerWidth < 480

    const [puedePromociones, setPuedePromociones] = React.useState(false)
    const [vista, setVista] = React.useState<"servicios" | "extras" | "promociones">(
        "servicios"
    )

    // ── Estado: Servicios ──
    const [loading, setLoading] = React.useState(true)
    const [servicios, setServicios] = React.useState<
        ServiciosManager_Servicio[]
    >([])
    const [error, setError] = React.useState("")
    const [formError, setFormError] = React.useState("")
    const [guardando, setGuardando] = React.useState(false)
    const [mostrarForm, setMostrarForm] = React.useState(false)
    const [editando, setEditando] =
        React.useState<ServiciosManager_Servicio | null>(null)

    // ── Estado: Productos extra ──
    const [loadingExtras, setLoadingExtras] = React.useState(true)
    const [extras, setExtras] = React.useState<ServiciosManager_Extra[]>([])
    const [errorExtras, setErrorExtras] = React.useState("")
    const [formErrorExtra, setFormErrorExtra] = React.useState("")
    const [guardandoExtra, setGuardandoExtra] = React.useState(false)
    const [mostrarFormExtra, setMostrarFormExtra] = React.useState(false)
    const [editandoExtra, setEditandoExtra] =
        React.useState<ServiciosManager_Extra | null>(null)

    if (false) {
        return (
            <div
                style={{ ...ServiciosManager_cardBase, ...style }}
                ref={containerRef}
            >
                <style>{ServiciosManager_shimmerCSS}</style>
                <ServiciosManager_CanvasPreview
                    accentColor={accentColor}
                    iconoPlaceholderUrl={iconoPlaceholderUrl}
                    iconoCheck={iconoCheck || undefined}
                    iconoEditar={iconoEditar || undefined}
                    iconoEliminar={iconoEliminar || undefined}
                    isMobile={isMobile}
                />
            </div>
        )
    }

    // ── Carga inicial: servicios ──
    React.useEffect(() => {
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
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
                const res = await fetch(
                    employeeMode
                        ? `${api}/empleado/${encodeURIComponent(slug)}/resumen`
                        : `${api}/admin/servicios/${slug}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        cache: "no-cache",
                    }
                )
                if (res.status === 401) {
                    setError("Sesión expirada")
                    setLoading(false)
                    return
                }
                const data = await res.json()
                if (!res.ok || data.success === false) throw new Error(data.error || "Error al cargar servicios")
                const accountPlan = await TurnitsResolveAccountPlan(api, slug, token, data, employeeMode)
                setPuedePromociones(["basico", "premium"].includes(accountPlan))
                const parsed: ServiciosManager_Servicio[] = (
                    data.servicios || []
                ).map((s: any) => {
                    const { imagen, descripcion } = ServiciosManager_parseDesc(
                        s.descripcion || ""
                    )
                    return { ...s, activo: s.activo === true || s.activo === "true", imagen: s.imagen_url || imagen, descripcion }
                })
                setServicios(parsed)
                setLoading(false)
            } catch (e: any) {
                if (++retries < 10) setTimeout(tryLoad, 300)
                else {
                    setLoading(false)
                    setError(e.message || "Error al cargar servicios")
                }
            }
        }
        tryLoad()
    }, [api, employeeMode])

    // ── Carga inicial: productos extra ──
    React.useEffect(() => {
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        let retries = 0

        const tryLoad = async () => {

            if (!slug || !token) {
                if (++retries < 10) {
                    setTimeout(tryLoad, 300)
                    return
                }
                setLoadingExtras(false)
                return
            }
            try {
                const res = await fetch(employeeMode ? `${api}/empleado/${encodeURIComponent(slug)}/extras` : `${api}/admin/extras/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setErrorExtras("Sesión expirada")
                    setLoadingExtras(false)
                    return
                }
                const data = await res.json()
                setExtras(data.extras || [])
                setLoadingExtras(false)
            } catch {
                if (++retries < 10) setTimeout(tryLoad, 300)
                else {
                    setLoadingExtras(false)
                    setErrorExtras("Error al cargar productos")
                }
            }
        }
        tryLoad()
    }, [api, employeeMode])

    // ── Handlers: Servicios (sin cambios funcionales) ──
    const handleCrear = async (form: ServiciosManager_FormData) => {
        if (employeeMode && !employeeCanCreate) return
        if (!form.nombre.trim()) {
            setFormError("El nombre es obligatorio")
            return
        }
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        setGuardando(true)
        setFormError("")
        try {
            const res = await fetch(
                employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/servicios`
                    : `${api}/admin/servicios`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        slug,
                        nombre: form.nombre.trim(),
                        descripcion: employeeMode
                            ? form.descripcion.trim()
                            : ServiciosManager_buildDesc(
                                  form.imagen.trim(),
                                  form.descripcion.trim()
                              ),
                        ...(employeeMode
                            ? { imagen_url: form.imagen.trim() || null }
                            : {}),
                        duracion: parseInt(form.duracion) || 30,
                        precio: Number(form.precio) || 0,
                        capacidad: parseInt(form.capacidad) || 1,
                        orden: parseInt(form.orden) || 0,
                    }),
                }
            )
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || `Error ${res.status}`)
            const { imagen, descripcion } = ServiciosManager_parseDesc(
                data.servicio.descripcion || ""
            )
            setServicios((p) => [
                ...p,
                {
                    ...data.servicio,
                    imagen: data.servicio.imagen_url || imagen,
                    descripcion,
                },
            ])
            setMostrarForm(false)

            // ── Vinculación automática (dirección inversa) ──────────
            // Si ya tenías productos extra cargados, el servicio nuevo
            // arranca con todos ellos vinculados de una, sin tener que
            // entrar a tildarlos manualmente.
            if (data.servicio?.id && extras.length > 0) {
                Promise.allSettled(
                    extras.map((ex) =>
                        fetch(
                            `${api}/admin/servicios/${data.servicio.id}/extras`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                    extra_id: ex.id,
                                    slug,
                                }),
                            }
                        )
                    )
                )
            }
        } catch (e: any) {
            setFormError(e.message || "Error al crear")
        }
        setGuardando(false)
    }

    const handleEditar = async (form: ServiciosManager_FormData) => {
        if (employeeMode && !employeeCanCreate) return
        if (!editando) return
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        setGuardando(true)
        setFormError("")
        try {
            const res = await fetch(
                employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/servicios/${editando.id}`
                    : `${api}/admin/servicios/${editando.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(
                        employeeMode
                            ? {
                                  nombre: form.nombre.trim(),
                                  descripcion: ServiciosManager_buildDesc(form.imagen.trim(), form.descripcion.trim()),
                                  duracion: parseInt(form.duracion) || 30,
                                  capacidad: parseInt(form.capacidad) || 1,
                                  precio: Number(form.precio) || 0,
                                  imagen_url: form.imagen.trim() || null,
                                  orden: parseInt(form.orden) || 0,
                              }
                            : {
                                  slug,
                                  nombre: form.nombre.trim(),
                                  descripcion: ServiciosManager_buildDesc(
                                      form.imagen.trim(),
                                      form.descripcion.trim()
                                  ),
                                  duracion: parseInt(form.duracion) || 30,
                                  precio: Number(form.precio) || 0,
                                  capacidad: parseInt(form.capacidad) || 1,
                                  orden: parseInt(form.orden) || 0,
                              }
                    ),
                }
            )
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || `Error ${res.status}`)
            const { imagen, descripcion } = ServiciosManager_parseDesc(
                data.servicio.descripcion || ""
            )
            setServicios((p) =>
                p.map((s) =>
                    s.id === editando.id
                        ? {
                              ...s,
                              ...data.servicio,
                              imagen: data.servicio.imagen_url || imagen,
                              descripcion,
                          }
                        : s
                )
            )
            setEditando(null)
        } catch (e: any) {
            setFormError(e.message || "Error al guardar")
        }
        setGuardando(false)
    }

    const handleToggle = async (svc: ServiciosManager_Servicio) => {
        if (employeeMode) return
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        const nuevo = !svc.activo
        setServicios((p) =>
            p.map((s) => (s.id === svc.id ? { ...s, activo: nuevo } : s))
        )
        try {
            const res = await fetch(`${api}/admin/servicios/${svc.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ slug, activo: nuevo }),
            })
            if (!res.ok) throw new Error()
        } catch {
            setServicios((p) =>
                p.map((s) =>
                    s.id === svc.id ? { ...s, activo: svc.activo } : s
                )
            )
        }
    }

    const handleDelete = async (svc: ServiciosManager_Servicio) => {
        if (employeeMode && !employeeCanCreate) return
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        setServicios((p) => p.filter((s) => s.id !== svc.id))
        try {
            const res = await fetch(
                employeeMode
                    ? `${api}/empleado/${encodeURIComponent(slug)}/servicios/${svc.id}`
                    : `${api}/admin/servicios/${svc.id}?slug=${slug}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            )
            if (!res.ok) throw new Error()
        } catch {
            setServicios((p) => [...p, svc].sort((a, b) => a.orden - b.orden))
        }
    }

    // ── Handlers: Productos extra ──
    const handleCrearExtra = async (form: ServiciosManager_ExtraFormData) => {
        if (!form.nombre.trim()) {
            setFormErrorExtra("El nombre es obligatorio")
            return
        }
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        setGuardandoExtra(true)
        setFormErrorExtra("")
        try {
            const res = await fetch(employeeMode ? `${api}/empleado/${encodeURIComponent(slug)}/extras` : `${api}/admin/extras`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug,
                    nombre: form.nombre.trim(),
                    descripcion: form.descripcion.trim(),
                    precio: Number(form.precio) || 0,
                    imagen_url: form.imagen_url.trim() || null,
                    orden: parseInt(form.orden) || 0,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || `Error ${res.status}`)
            setExtras((p) => [...p, {...data.extra, ...(employeeMode ? {compartido:false,puede_editar:true} : {})}])
            setMostrarFormExtra(false)

            // ── Vinculación automática ──────────────────────────────
            // Antes había que ir servicio por servicio y tildar el
            // producto nuevo a mano en "Productos vinculados". Ahora,
            // apenas se crea un producto extra, se vincula solo a TODOS
            // los servicios existentes (no bloquea la UI: si alguna
            // vinculación individual falla, no rompe la creación del
            // producto, que ya quedó guardado).
            if (!employeeMode && data.extra?.id && servicios.length > 0) {
                Promise.allSettled(
                    servicios.map((s) =>
                        fetch(`${api}/admin/servicios/${s.id}/extras`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                                extra_id: data.extra.id,
                                slug,
                            }),
                        })
                    )
                )
            }
        } catch (e: any) {
            setFormErrorExtra(e.message || "Error al crear")
        }
        setGuardandoExtra(false)
    }

    const handleEditarExtra = async (form: ServiciosManager_ExtraFormData) => {
        if (!editandoExtra) return
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        setGuardandoExtra(true)
        setFormErrorExtra("")
        try {
            const res = await fetch(employeeMode ? `${api}/empleado/${encodeURIComponent(slug)}/extras/${editandoExtra.id}` : `${api}/admin/extras/${editandoExtra.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    slug,
                    nombre: form.nombre.trim(),
                    descripcion: form.descripcion.trim() || null,
                    precio: Number(form.precio) || 0,
                    imagen_url: form.imagen_url.trim() || null,
                    orden: parseInt(form.orden) || 0,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success)
                throw new Error(data.error || `Error ${res.status}`)
            setExtras((p) =>
                p.map((e) => (e.id === editandoExtra.id ? {...e,...data.extra} : e))
            )
            setEditandoExtra(null)
        } catch (e: any) {
            setFormErrorExtra(e.message || "Error al guardar")
        }
        setGuardandoExtra(false)
    }

    const handleToggleExtra = async (extra: ServiciosManager_Extra) => {
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        const nuevo = !extra.activo
        setExtras((p) =>
            p.map((e) => (e.id === extra.id ? { ...e, activo: nuevo } : e))
        )
        try {
            const res = await fetch(employeeMode ? `${api}/empleado/${encodeURIComponent(slug)}/extras/${extra.id}` : `${api}/admin/extras/${extra.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ slug, activo: nuevo }),
            })
            if (!res.ok) throw new Error()
        } catch {
            setExtras((p) =>
                p.map((e) =>
                    e.id === extra.id ? { ...e, activo: extra.activo } : e
                )
            )
        }
    }

    const handleDeleteExtra = async (extra: ServiciosManager_Extra) => {
        const slug = ServiciosManager_getSlug()
        const token = ServiciosManager_getToken()
        setExtras((p) => p.filter((e) => e.id !== extra.id))
        try {
            const res = await fetch(
                employeeMode ? `${api}/empleado/${encodeURIComponent(slug)}/extras/${extra.id}` : `${api}/admin/extras/${extra.id}?slug=${slug}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            )
            if (!res.ok) throw new Error()
        } catch {
            setExtras((p) => [...p, extra].sort((a, b) => a.orden - b.orden))
        }
    }

    if (loading || loadingExtras) return <ServiciosManager_SkeletonLista />

    const initialEditar: ServiciosManager_FormData | undefined = editando
        ? {
              nombre: editando.nombre,
              descripcion: editando.descripcion,
              imagen: editando.imagen,
              duracion: String(editando.duracion),
              precio: String(editando.precio),
              capacidad: String(editando.capacidad),
              orden: String(editando.orden),
          }
        : undefined

    const initialEditarExtra: ServiciosManager_ExtraFormData | undefined =
        editandoExtra
            ? {
                  nombre: editandoExtra.nombre ?? "",
                  descripcion: editandoExtra.descripcion ?? "",
                  precio: String(editandoExtra.precio ?? 0),
                  imagen_url: editandoExtra.imagen_url ?? "",
                  orden: String(editandoExtra.orden ?? 0),
              }
            : undefined

    const activos = servicios.filter((s) => s.activo)
    const inactivos = servicios.filter((s) => !s.activo)
    const extrasActivos = extras.filter((e) => e.activo)
    const extrasInactivos = extras.filter((e) => !e.activo)

    return (
        <div
            ref={containerRef}
            style={{
                ...ServiciosManager_cardBase,
                padding: isMobile ? "16px" : "22px",
                ...style,
            }}
        >
            <style>{ServiciosManager_shimmerCSS}</style>

            {/* Secciones del catálogo */}
            <div role="group" aria-label="Secciones del catálogo" className="svc-catalog-tabs" style={{display:isMobile ? "grid" : "flex",gridTemplateColumns:isMobile ? ((!employeeMode || employeeCanCreate) ? "repeat(3,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))") : undefined,flexWrap:"nowrap",gap:4,padding:4,borderRadius:12,background:"#f1f5f9",marginBottom:isMobile ? 12 : 16,width:isMobile ? "100%" : "fit-content",maxWidth:"100%",boxSizing:"border-box"}}>
                <button type="button" className={`svc-tab${vista === "servicios" ? " active" : ""}`} aria-pressed={vista === "servicios"} onClick={() => setVista("servicios")} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7}}><ServiciosManager_SeccionIcon tipo="servicios" />Servicios</button>
                {<><button type="button" className={`svc-tab${vista === "extras" ? " active" : ""}`} aria-pressed={vista === "extras"} onClick={() => setVista("extras")} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7}}><ServiciosManager_SeccionIcon tipo="extras" />Productos</button>{(!employeeMode || employeeCanCreate) && <button type="button" className={`svc-tab${vista === "promociones" ? " active" : ""}`} aria-pressed={vista === "promociones"} onClick={() => setVista("promociones")} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7}}><ServiciosManager_SeccionIcon tipo="promociones" />{isMobile ? "Promos" : "Promociones"}</button>}</>}
            </div>

            {vista === "servicios" ? (
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
                                Servicios
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#94a3b8",
                                    marginTop: 2,
                                }}
                            >
                                {servicios.length === 0
                                    ? "Sin servicios aún"
                                    : `${activos.length} activo${activos.length !== 1 ? "s" : ""}${inactivos.length > 0 ? `, ${inactivos.length} inactivo${inactivos.length !== 1 ? "s" : ""}` : ""}`}
                            </div>
                        </div>
                        {!mostrarForm &&
                            !editando &&
                            (!branch && (!employeeMode || employeeCanCreate)) && (
                                <motion.button
                                    whileHover={{ scale: 1.04 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => setMostrarForm(true)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: isMobile
                                            ? "9px 12px"
                                            : "8px 14px",
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
                                    <span
                                        style={{ fontSize: 16, lineHeight: 1 }}
                                    >
                                        +
                                    </span>
                                    {isMobile ? "" : " Nuevo"}
                                </motion.button>
                            )}
                    </div>

                    {error && (
                        <div
                            style={{
                                fontSize: 12,
                                color: "#ef4444",
                                marginBottom: 10,
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <AnimatePresence>
                        {mostrarForm && !editando && (
                            <div style={{ marginBottom: 14 }}>
                                <ServiciosManager_ServicioForm
                                            employeeMode={employeeMode}
                                    accentColor={accentColor}
                                    apiUrl={api}
                                    iconoFormUrl={iconoFormUrl || undefined}
                                    uploadPath={
                                        employeeMode
                                            ? `/empleado/${encodeURIComponent(ServiciosManager_getSlug())}/servicios/upload-imagen`
                                            : undefined
                                    }
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

                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: isMobile ? 5 : 6,
                        }}
                    >
                        {servicios.length === 0 && !mostrarForm && (
                            <div
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 10,
                                    opacity: 0.5,
                                    paddingTop: 40,
                                }}
                            >
                                <ServiciosManager_PlaceholderIcon
                                    src={iconoVacioUrl || undefined}
                                    size={36}
                                />
                                <span
                                    style={{ fontSize: 13, color: "#94a3b8" }}
                                >
                                    Todavía no hay servicios
                                </span>
                            </div>
                        )}
                        <AnimatePresence mode="popLayout">
                            {servicios.map((svc) =>
                                editando?.id === svc.id ? (
                                    <motion.div
                                        key={svc.id + "-edit"}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        style={{ marginBottom: 6 }}
                                    >
                                        <ServiciosManager_ServicioForm
                                            employeeMode={employeeMode}
                                            initial={initialEditar}
                                            accentColor={accentColor}
                                            apiUrl={api}
                                            iconoFormUrl={
                                                iconoFormUrl || undefined
                                            }
                                            uploadPath={
                                                employeeMode
                                                    ? `/empleado/${encodeURIComponent(ServiciosManager_getSlug())}/servicios/upload-imagen`
                                                    : undefined
                                            }
                                            onSubmit={handleEditar}
                                            onCancel={() => {
                                                setEditando(null)
                                                setFormError("")
                                            }}
                                            guardando={guardando}
                                            error={formError}
                                            modoEdicion={true}
                                            isMobile={isMobile}
                                            servicioId={editando.id}
                                            employeeVariant={employeeMode && !(editando as any)?.perfil_propio}
                                        />
                                    </motion.div>
                                ) : (
                                    <ServiciosManager_ServicioCard
                                        key={svc.id}
                                        svc={svc}
                                        accentColor={accentColor}
                                        iconoPlaceholderUrl={
                                            iconoPlaceholderUrl || undefined
                                        }
                                        iconoCheck={iconoCheck || undefined}
                                        iconoEditar={iconoEditar || undefined}
                                        iconoEliminar={
                                            iconoEliminar || undefined
                                        }
                                        onEdit={() => {
                                            setEditando(svc)
                                            setMostrarForm(false)
                                            setFormError("")
                                        }}
                                        onToggle={() => handleToggle(svc)}
                                        onDelete={() => handleDelete(svc)}
                                        isMobile={isMobile}
                                        employeeMode={employeeMode}
                                        employeeCanEdit={
                                            !branch && (!employeeMode || employeeCanCreate)
                                        }
                                    />
                                )
                            )}
                        </AnimatePresence>
                    </div>
                </>
            ) : vista === "extras" ? (
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
                                Productos extra
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "#94a3b8",
                                    marginTop: 2,
                                }}
                            >
                                {extras.length === 0
                                    ? "Sin productos aún"
                                    : `${extrasActivos.length} activo${extrasActivos.length !== 1 ? "s" : ""}${extrasInactivos.length > 0 ? `, ${extrasInactivos.length} inactivo${extrasInactivos.length !== 1 ? "s" : ""}` : ""}`}
                            </div>
                        </div>
                        {(!employeeMode || employeeCanCreate) && !mostrarFormExtra && !editandoExtra && (
                            <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setMostrarFormExtra(true)}
                                style={{
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
                                <span style={{ fontSize: 16, lineHeight: 1 }}>
                                    +
                                </span>
                                {isMobile ? "" : " Nuevo"}
                            </motion.button>
                        )}
                    </div>

                    {errorExtras && (
                        <div
                            style={{
                                fontSize: 12,
                                color: "#ef4444",
                                marginBottom: 10,
                            }}
                        >
                            {errorExtras}
                        </div>
                    )}

                    <AnimatePresence>
                        {mostrarFormExtra && !editandoExtra && (
                            <div style={{ marginBottom: 14 }}>
                                <ServiciosManager_ExtraForm
                                    employeeMode={employeeMode}
                                    accentColor={accentColor}
                                    apiUrl={api}
                                    iconoFormUrl={iconoFormUrl || undefined}
                                    onSubmit={handleCrearExtra}
                                    onCancel={() => {
                                        setMostrarFormExtra(false)
                                        setFormErrorExtra("")
                                    }}
                                    guardando={guardandoExtra}
                                    error={formErrorExtra}
                                    modoEdicion={false}
                                    isMobile={isMobile}
                                />
                            </div>
                        )}
                    </AnimatePresence>

                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: isMobile ? 5 : 6,
                        }}
                    >
                        {extras.length === 0 && !mostrarFormExtra && (
                            <div
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 10,
                                    opacity: 0.5,
                                    paddingTop: 40,
                                }}
                            >
                                <ServiciosManager_PlaceholderIcon
                                    src={iconoVacioUrl || undefined}
                                    size={36}
                                />
                                <span
                                    style={{ fontSize: 13, color: "#94a3b8" }}
                                >
                                    Todavía no hay productos extra
                                </span>
                            </div>
                        )}
                        <AnimatePresence mode="popLayout">
                            {extras.map((extra) =>
                                editandoExtra?.id === extra.id ? (
                                    <motion.div
                                        key={extra.id + "-edit"}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        style={{ marginBottom: 6 }}
                                    >
                                        <ServiciosManager_ExtraForm
                                    employeeMode={employeeMode}
                                            initial={initialEditarExtra}
                                            accentColor={accentColor}
                                            apiUrl={api}
                                            iconoFormUrl={
                                                iconoFormUrl || undefined
                                            }
                                            onSubmit={handleEditarExtra}
                                            onCancel={() => {
                                                setEditandoExtra(null)
                                                setFormErrorExtra("")
                                            }}
                                            guardando={guardandoExtra}
                                            error={formErrorExtra}
                                            modoEdicion={true}
                                            isMobile={isMobile}
                                        />
                                    </motion.div>
                                ) : (
                                    <ServiciosManager_ExtraCard
                                        key={extra.id}
                                        extra={extra}
                                        employeeMode={employeeMode}
                                        canEdit={!branch && (!employeeMode || (employeeCanCreate && extra.puede_editar === true))}
                                        accentColor={accentColor}
                                        iconoPlaceholderUrl={
                                            iconoPlaceholderUrl || undefined
                                        }
                                        iconoCheck={iconoCheck || undefined}
                                        iconoEditar={iconoEditar || undefined}
                                        iconoEliminar={
                                            iconoEliminar || undefined
                                        }
                                        onEdit={() => {
                                            setEditandoExtra(extra)
                                            setMostrarFormExtra(false)
                                            setFormErrorExtra("")
                                        }}
                                        onToggle={() =>
                                            handleToggleExtra(extra)
                                        }
                                        onDelete={() =>
                                            handleDeleteExtra(extra)
                                        }
                                        isMobile={isMobile}
                                    />
                                )
                            )}
                        </AnimatePresence>
                    </div>
                </>
            ) : (
                <>{puedePromociones ? <ServiciosManager_Promociones employeeMode={employeeMode} api={api} servicios={servicios} productos={extras} accentColor={accentColor} isMobile={isMobile} /> : <div style={{padding:24,border:"1px solid #e5e7eb",borderRadius:14,...TurnitsLockedStyle}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><h3 style={{margin:"0 0 8px"}}>Combos y promociones</h3><TurnitsPlanRequirement /></div><p style={{fontSize:13,color:"#64748b"}}>Armá combos y descuentos para tu catálogo.</p><a href="/planes" style={{color:accentColor,fontSize:13}}>Ver planes</a></div>}</>
            )}
        </div>
    )
}

function ServiciosManager_Promociones({api,servicios,productos,accentColor,isMobile,employeeMode=false}:{api:string;servicios:any[];productos:any[];accentColor:string;isMobile:boolean;employeeMode?:boolean}) {
    const branch = useBranchAdmin();
    const hoy = () => new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Argentina/Buenos_Aires"}).format(new Date())
    const initial = () => ({nombre:"",tipo:"combo",items:[] as {tipo:string;id:string;cantidad:number}[],descuento_tipo:"precio_final",valor:"",fecha_inicio:hoy(),fecha_fin:hoy(),dias_semana:null as number[] | null,activo:true})
    const [form,setForm]=React.useState(initial)
    const [lista,setLista]=React.useState<any[]>([])
    const [diasHabilitados,setDiasHabilitados]=React.useState(false)
    const [loading,setLoading]=React.useState(true)
    const [error,setError]=React.useState("")
    const [busy,setBusy]=React.useState(false)
    const [mostrar,setMostrar]=React.useState(false)
    const [editando,setEditando]=React.useState<string|null>(null)
    const slug=ServiciosManager_getSlug(),token=ServiciosManager_getToken()
    const money=(n:number)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2}).format(n)
    const date=(v:string)=>new Date(v+"T12:00:00").toLocaleDateString("es-AR")
    const request=async(path:string,method="GET",body?:any)=>{
        const response=await fetch(employeeMode ? `${api}/empleado/${encodeURIComponent(slug)}/promociones${path}` : `${api}/admin/promociones/${encodeURIComponent(slug)}${path}`,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body ? {body:JSON.stringify(body)} : {}),cache:"no-store"})
        const result=await response.json()
        if(!response.ok || !result.success)throw new Error(result.error || "No se pudo completar la operación.")
        return result
    }
    React.useEffect(()=>{let active=true;request("").then(r=>{if(active){setLista(r.promociones);setDiasHabilitados(r.dias_semana_habilitado===true)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[api,slug,token])
    const catalogo=[...servicios.filter(s=>s.activo).map(s=>({...s,tipo:"servicio"})),...productos.filter(p=>p.activo === true || p.activo === "true").map(p=>({...p,tipo:"producto"}))]
    const selected=form.items.map(item=>({...item,source:catalogo.find(c=>c.tipo===item.tipo && c.id===item.id)}))
    const original=selected.reduce((sum,item)=>sum+Number(item.source?.precio || 0)*item.cantidad,0)
    const duracionElegida = form.fecha_inicio && form.fecha_fin ? Math.round((Date.parse(form.fecha_fin+"T12:00:00Z")-Date.parse(form.fecha_inicio+"T12:00:00Z"))/86400000)+1 : 0
    const valor=Number(form.valor)
    const final=Math.round((form.descuento_tipo === "porcentaje" ? original*(1-valor/100) : valor)*100)/100
    const validPrice=Number.isFinite(final)&&valor>0&&final>0&&final<original
    const toggle=(item:any)=>setForm(prev=>({...prev,items:prev.items.some(i=>i.id===item.id&&i.tipo===item.tipo) ? prev.items.filter(i=>!(i.id===item.id&&i.tipo===item.tipo)) : prev.tipo === "descuento" ? [{tipo:item.tipo,id:item.id,cantidad:1}] : [...prev.items,{tipo:item.tipo,id:item.id,cantidad:1}]}))
    const guardar=async(e:React.FormEvent)=>{
        e.preventDefault();setError("")
        if(form.dias_semana !== null && !diasHabilitados) {setError("La programación por días todavía no está disponible. Volvé a cargar las promociones.");return}
        if(!promoHasMatchingDate(form)) {setError("No hay ningún día seleccionado dentro de la vigencia. Elegí al menos un día que coincida con las fechas.");return}
        if(!form.nombre.trim() || !form.items.length || selected.some(i=>!i.source) || !form.fecha_inicio || !form.fecha_fin || form.fecha_fin<form.fecha_inicio || !validPrice || (form.tipo === "combo" && form.items.reduce((sum,i)=>sum+i.cantidad,0)<2)) {setError("Completá el nombre, los elementos, un precio menor al original y una vigencia válida. Los combos necesitan al menos dos unidades.");return}
        setBusy(true)
        try {const result=await request(editando ? `/${editando}` : "",editando ? "PUT" : "POST",{...form,valor});setLista(prev=>[result.promocion,...prev.filter(p=>p.id!==result.promocion.id)]);setMostrar(false);setEditando(null);setForm(initial())}catch(e:any){setError(e.message)}finally{setBusy(false)}
    }
    const editar=(promo:any)=>{setForm({...promo,dias_semana:promo.dias_semana ?? null,valor:String(promo.valor),items:promo.items.map((i:any)=>({tipo:i.tipo,id:i.id,cantidad:i.cantidad}))});setEditando(promo.id);setMostrar(true);setError("")}
    const cambiarEstado=async(promo:any)=>{setBusy(true);setError("");try{const result=await request(`/${promo.id}/estado`,"PUT",{activo:!promo.activo});setLista(prev=>prev.map(p=>p.id===promo.id ? result.promocion : p));if(editando===promo.id)setForm(prev=>({...prev,activo:result.promocion.activo}))}catch(e:any){setError(e.message)}finally{setBusy(false)}}
    const eliminar=async(id:string)=>{if(!window.confirm("¿Eliminar esta promoción?"))return;setBusy(true);setError("");try{await request(`/${id}`,"DELETE");setLista(prev=>prev.filter(p=>p.id!==id))}catch(e:any){setError(e.message)}finally{setBusy(false)}}
    const input:React.CSSProperties={width:"100%",minWidth:0,boxSizing:"border-box",border:"1.5px solid #e2e8f0",borderRadius:9,padding:"9px 11px",font:"inherit",fontSize:13,background:"white",color:"#1e293b",transition:"border-color .15s, box-shadow .15s"}
    const button:React.CSSProperties={border:0,borderRadius:10,padding:"10px 14px",background:accentColor,color:"white",font:"inherit",fontWeight:650,cursor:busy ? "wait" : "pointer"}
    const label:React.CSSProperties={display:"grid",gap:7,fontSize:13,fontWeight:700,color:"#1e293b"}
    return <div className="svc-promos" style={{fontSize:13,"--promo-accent":accentColor} as React.CSSProperties}>
        <style>{` .svc-promos .promo-input:focus {outline:none;border-color:var(--promo-accent)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--promo-accent) 12%,transparent)} .svc-promos button:focus-visible,.svc-promos .promo-check:focus-visible + span,.svc-promos .promo-switch:focus-visible {outline:2px solid var(--promo-accent);outline-offset:3px} .svc-promos .promo-check {position:absolute;opacity:0;width:20px;height:20px;margin:0} .svc-promos .promo-switch {appearance:none;-webkit-appearance:none;width:36px;height:21px;border:0;border-radius:99px;background:#cbd5e1;position:relative;flex-shrink:0;cursor:pointer;margin:0;transition:background .18s} .svc-promos .promo-switch:checked {background:var(--promo-accent)} .svc-promos .promo-switch:after {content:"";position:absolute;top:3px;left:3px;width:15px;height:15px;border-radius:50%;background:white;box-shadow:0 1px 3px #0002;transition:transform .18s} .svc-promos .promo-switch:checked:after {transform:translateX(15px)} .svc-promos .promo-input::-webkit-inner-spin-button {appearance:none} .svc-promos button:disabled {opacity:.55;cursor:wait} `}</style>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div><div style={{display:"flex",alignItems:"center",gap:8,fontSize:16,fontWeight:700}}>Promociones</div><p style={{margin:"6px 0",color:"#64748b",fontSize:12}}>Armá combos o descuentos con una vigencia definida.</p></div>
            {!branch && !mostrar && <button type="button" style={button} onClick={()=>{setForm(initial());setEditando(null);setError("");setMostrar(true)}}>+ Crear promo</button>}
        </div>
        {error && <div role="alert" style={{padding:12,marginTop:12,borderRadius:10,background:"#fff1f2",color:"#b91c1c"}}>{error}</div>}
        {mostrar && <form noValidate onSubmit={guardar} style={{marginTop:18,padding:isMobile ? 14 : 22,border:"1px solid #e2e8f0",borderRadius:16,display:"grid",gap:18}}>
            <div style={{fontWeight:700}}>{editando ? "Editar promoción" : "Nueva promoción"}</div>
            <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0,display:"grid",gap:18}}>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["combo","Combo"],["descuento","Descuento en servicio"]].map(([key,title])=><button type="button" key={key} aria-pressed={form.tipo===key} onClick={()=>setForm(prev=>({...prev,tipo:key,items:[]}))} style={{...button,background:form.tipo===key ? accentColor : "#f1f5f9",color:form.tipo===key ? "white" : "#475569"}}>{title}</button>)}</div>
                <label style={label}><span style={{display:"flex",alignItems:"center",gap:7}}><ServiciosManager_SeccionIcon tipo="promociones" size={15}/>Nombre de la promo</span><input className="promo-input" style={input} value={form.nombre} maxLength={100} placeholder="Ej. Corte + polvo texturizante" onChange={e=>setForm({...form,nombre:e.target.value})}/></label>
                <div><div style={{fontWeight:650,marginBottom:9}}>{form.tipo === "combo" ? "Elegí servicios y productos" : "Elegí el servicio"}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:8,maxHeight:300,overflowY:"auto",padding:2}}>
                    {catalogo.filter(c=>form.tipo === "combo" || c.tipo === "servicio").map(item=>{const included=form.items.find(i=>i.id===item.id&&i.tipo===item.tipo);return <div key={item.tipo+item.id} style={{border:included ? `1px solid ${accentColor}` : "1px solid #e2e8f0",borderRadius:11,padding:12,background:included ? "#f1f8f2" : "white"}}>
                        <label style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}><span style={{position:"relative",display:"inline-flex",flexShrink:0}}><input className="promo-check" type={form.tipo === "descuento" ? "radio" : "checkbox"} name="promo-elemento" checked={!!included} onChange={()=>toggle(item)}/><span aria-hidden="true" style={{width:19,height:19,boxSizing:"border-box",border:included ? `1.5px solid ${accentColor}` : "1.5px solid #cbd5e1",borderRadius:form.tipo === "descuento" ? "50%" : 5,background:included ? accentColor : "white",display:"grid",placeItems:"center",color:"white",transition:"background .15s,border-color .15s"}}>{included && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>}</span></span><ServiciosManager_SeccionIcon tipo={item.tipo === "servicio" ? "servicios" : "extras"}/><span style={{flex:1,minWidth:0}}>{item.nombre}<small style={{display:"block",color:"#64748b",marginTop:4}}>{money(Number(item.precio))} · {item.tipo === "servicio" ? "Servicio" : "Producto"}</small></span></label>
                        {included && form.tipo === "combo" && <label style={{...label,gridTemplateColumns:"1fr 65px",alignItems:"center",marginTop:10}}>Cantidad<input className="promo-input" type="number" min={1} max={99} step={1} value={included.cantidad} style={{...input,padding:6}} onChange={e=>setForm(prev=>({...prev,items:prev.items.map(i=>i.id===item.id&&i.tipo===item.tipo ? {...i,cantidad:Math.max(1,Math.min(99,Math.trunc(Number(e.target.value)||1)))} : i)}))}/></label>}
                    </div>})}
                    {!catalogo.filter(c=>form.tipo === "combo" || c.tipo === "servicio").length && <p style={{color:"#64748b"}}>Primero agregá servicios o productos activos a tu catálogo.</p>}
                    </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12}}>
                    <div style={label}><span style={{display:"flex",alignItems:"center",gap:7}}><ServiciosManager_SeccionIcon tipo="promociones" size={15}/>Cómo aplicar el descuento</span><div role="group" aria-label="Cómo aplicar el descuento" style={{display:"flex",gap:4,padding:4,borderRadius:10,background:"#f1f5f9"}}>{[["precio_final","Precio final"],["porcentaje","Porcentaje"]].map(([key,title])=><button key={key} type="button" aria-pressed={form.descuento_tipo===key} onClick={()=>setForm({...form,descuento_tipo:key,valor:""})} style={{flex:1,minWidth:0,padding:"7px 8px",border:0,borderRadius:7,background:form.descuento_tipo===key ? "white" : "transparent",boxShadow:form.descuento_tipo===key ? "0 1px 3px #0f172a14" : "none",color:form.descuento_tipo===key ? "#1e293b" : "#64748b",font:"inherit",fontSize:12,fontWeight:600,cursor:"pointer"}}>{title}</button>)}</div></div>
                    <label style={label}>{form.descuento_tipo === "porcentaje" ? "Descuento (%)" : "Precio final ($)"}<div style={{position:"relative"}}><span aria-hidden="true" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>{form.descuento_tipo === "porcentaje" ? "%" : "$"}</span><input className="promo-input" style={{...input,paddingLeft:32}} type="number" min="0.01" step="0.01" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})} placeholder="0"/></div></label>
                    <label style={label}><span style={{display:"flex",alignItems:"center",gap:7}}><ServiciosManager_FieldIcon name="calendar" color="#64748b"/>Desde</span><input className="promo-input" style={input} type="date" value={form.fecha_inicio} onChange={e=>setForm({...form,fecha_inicio:e.target.value})}/></label>
                    <label style={label}><span style={{display:"flex",alignItems:"center",gap:7}}><ServiciosManager_FieldIcon name="calendar" color="#64748b"/>Hasta (inclusive)</span><input className="promo-input" style={input} type="date" min={form.fecha_inicio} value={form.fecha_fin} onChange={e=>setForm({...form,fecha_fin:e.target.value})}/></label>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[7,15,30].map(days=><button type="button" key={days} aria-pressed={duracionElegida===days} style={{...button,background:duracionElegida===days ? accentColor : "#f1f5f9",color:duracionElegida===days ? "white" : "#475569",fontSize:12,transition:"background .15s,color .15s"}} onClick={()=>{const d=new Date((form.fecha_inicio || hoy())+"T12:00:00");d.setDate(d.getDate()+days-1);const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;setForm({...form,fecha_inicio:form.fecha_inicio || hoy(),fecha_fin:end})}}>{days} días</button>)}</div>
                <div style={{padding:14,borderRadius:12,background:"#f1f8f2",lineHeight:1.7}}><div>Precio original: <strong>{money(original)}</strong></div><div>Precio de la promo: <strong>{validPrice ? money(final) : "—"}</strong></div><div>Ahorro: <strong>{validPrice ? `${money(original-final)} (${((original-final)/original*100).toFixed(1)}%)` : "—"}</strong></div></div>
                <div style={{display:"grid",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><span style={{fontWeight:700}}>Días de la promo <small style={{fontWeight:400,color:"#64748b"}}>· opcional</small></span><label style={{display:"flex",alignItems:"center",gap:8,cursor:diasHabilitados ? "pointer" : "default",fontWeight:400}}><input className="promo-switch" role="switch" type="checkbox" disabled={!diasHabilitados} checked={form.dias_semana !== null} onChange={e=>setForm({...form,dias_semana:e.target.checked ? [] : null})}/>Elegir días específicos</label></div>
                    <div className="promo-days-grid" role="group" aria-label="Días de la semana de la promoción" aria-disabled={busy || !diasHabilitados || form.dias_semana === null} style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:5,opacity:form.dias_semana === null || !diasHabilitados ? 0.45 : 1,transition:"opacity .18s"}}>{PROMO_DAYS.map(day=><button disabled={busy || !diasHabilitados || form.dias_semana === null} type="button" key={day.id} aria-label={day.label} aria-pressed={form.dias_semana?.includes(day.id) || false} style={{...button,padding:"10px 2px",fontSize:12,background:form.dias_semana?.includes(day.id) ? accentColor : "#f1f5f9",color:form.dias_semana?.includes(day.id) ? "white" : "#475569",opacity:1,cursor:busy || !diasHabilitados || form.dias_semana === null ? "default" : "pointer"}} onClick={()=>setForm(prev=>({...prev,dias_semana:prev.dias_semana!.includes(day.id) ? prev.dias_semana!.filter(id=>id!==day.id) : [...prev.dias_semana!,day.id]}))}>{day.short}</button>)}</div>
                    <p style={{margin:0,fontSize:12,color:"#64748b",lineHeight:1.5}}>{form.dias_semana === null ? "Se aplica todos los días dentro de las fechas elegidas." : form.dias_semana.length ? `Se repite los ${promoDaysLabel(form.dias_semana)} dentro de la vigencia.` : "Elegí los días en los que querés ofrecer esta promo."}</p>
                </div>
            </fieldset>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button disabled={busy} type="submit" style={button}>{busy ? "Guardando…" : "Guardar promo"}</button><button disabled={busy} type="button" style={{...button,background:"#f1f5f9",color:"#475569"}} onClick={()=>{setMostrar(false);setError("")}}>Cancelar</button></div>
        </form>}
        {loading ? <p>Cargando promociones…</p> : !lista.length && !mostrar ? <div style={{padding:30,textAlign:"center",border:"1px dashed #dbe2ea",borderRadius:16,marginTop:18,color:"#64748b"}}>Todavía no hay promos. Creá un combo o un descuento para empezar.</div> : <div style={{display:"grid",gridTemplateColumns:isMobile ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))",gap:12,marginTop:18}}>{lista.map(p=>{
            const today=hoy()
            const status=today>p.fecha_fin ? "Vencida" : !p.activo ? "Pausada" : today<p.fecha_inicio ? "Programada" : "Vigente"
            const imagenes=p.items.map((item:any)=>{
                const source=(item.tipo === "servicio" ? servicios : productos).find((c:any)=>c.id===item.id)
                const url=item.tipo === "servicio" ? source?.imagen || source?.imagen_url || ServiciosManager_parseDesc(source?.descripcion || "").imagen : source?.imagen_url
                return {url,nombre:item.nombre,tipo:item.tipo,id:item.id,cantidad:item.cantidad}
            })
            return <div key={p.id} style={{position:"relative",border:"1px solid #e2e8f0",padding:isMobile ? 14 : 16,borderRadius:15,display:"flex",alignItems:"center",gap:isMobile ? 12 : 18,minWidth:0,background:"white",opacity:p.activo ? 1 : 0.65,...(!employeeMode ? ServiciosManager_EmployeeCardStyle(p) : {})}}>
                <span style={{position:"absolute",right:16,top:16,fontSize:10,padding:"3px 7px",borderRadius:5,background:status === "Vigente" ? "#eaf4ec" : "#f1f5f9",color:status === "Vigente" ? "#18732a" : "#64748b"}}>{status}</span>
                {!!imagenes.length && <div aria-label="Elementos del combo" style={{display:"grid",gridTemplateColumns:imagenes.length===1 ? "minmax(0,1fr)" : imagenes.length>4 && !isMobile ? "repeat(3,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))",width:isMobile ? (imagenes.length===1 ? 64 : 104) : (imagenes.length===1 ? 100 : 164),gap:isMobile ? 6 : 8,flexShrink:0,alignSelf:"center"}}>{imagenes.map((image:any)=><span key={image.tipo+image.id} title={`${image.cantidad} × ${image.nombre}`} style={{position:"relative",width:"100%",aspectRatio:"1",minWidth:0,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:8,overflow:"hidden",background:"#f8fafc",border:"1px solid #eef2f6",boxSizing:"border-box"}}>
                    {image.url ? <img src={image.url} alt={image.nombre} style={{display:"block",width:image.tipo === "producto" ? "auto" : "100%",height:image.tipo === "producto" ? "auto" : "100%",maxWidth:"100%",maxHeight:"100%",objectFit:image.tipo === "producto" ? "contain" : "cover",borderRadius:8}}/> : <span role="img" aria-label={image.nombre} style={{display:"grid",justifyItems:"center",gap:3,padding:4,textAlign:"center",color:"#64748b",maxWidth:"100%",boxSizing:"border-box"}}><ServiciosManager_SeccionIcon tipo={image.tipo === "servicio" ? "servicios" : "extras"} size={16}/><span style={{fontSize:9,lineHeight:1.2,overflowWrap:"anywhere",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{image.nombre}</span></span>}
                    {image.cantidad>1 && <span style={{position:"absolute",right:3,bottom:3,borderRadius:5,padding:"2px 4px",fontSize:9,fontWeight:700,lineHeight:1.2,background:"#fff",color:"#1e293b",boxShadow:"0 1px 4px #0f172a1a"}}>×{image.cantidad}</span>}
                </span>)}</div>}
                <div style={{minWidth:0,flex:1,paddingTop:isMobile ? 22 : 4,paddingBottom:4}}>
                    <strong style={{display:"block",fontSize:13,lineHeight:1.4,paddingRight:isMobile ? 0 : 72,overflowWrap:"anywhere"}}>{p.nombre}</strong>
                    <div style={{fontSize:12,color:"#64748b",lineHeight:1.5,marginTop:2,overflowWrap:"anywhere"}}>{p.items.map((i:any)=>`${i.cantidad} × ${i.nombre}`).join(" + ")}</div>
                    <div style={{display:"flex",alignItems:"baseline",gap:5,flexWrap:"wrap",marginTop:1}}><del style={{color:"#94a3b8",fontSize:12}}>{money(Number(p.precio_original))}</del><strong style={{fontSize:20,lineHeight:1.25,color:accentColor}}>{money(Number(p.precio_final))}</strong></div>
                    {!employeeMode && <ServiciosManager_Creador item={p} />}
                    {!employeeMode && <ServiciosManager_Profesionales profesionales={p.profesionales} />}
                    <div style={{fontSize:10,color:"#64748b",lineHeight:1.5,marginTop:1}}>{date(p.fecha_inicio)} al {date(p.fecha_fin)} · inclusive</div>
                    {today>p.fecha_fin && <div style={{fontSize:11,color:"#64748b",lineHeight:1.5}}>La vigencia terminó. Editá las fechas para volver a mostrarla.</div>}
                    {p.dias_semana != null && <div style={{fontSize:11,color:accentColor,lineHeight:1.5}}>Sólo los {promoDaysLabel(p.dias_semana)}</div>}
                    <div style={{display:branch ? "none" : "flex",gap:7,marginTop:3,flexWrap:"wrap"}}><button disabled={busy} type="button" style={{...button,padding:"8px 13px",borderRadius:9,background:"#f1f5f9",color:"#475569",fontSize:12}} onClick={()=>editar(p)}>Editar</button><button disabled={busy} type="button" style={{...button,padding:"8px 13px",borderRadius:9,background:"#f1f5f9",color:p.activo ? "#475569" : accentColor,fontSize:12}} onClick={()=>cambiarEstado(p)}>{p.activo ? "Pausar" : "Reactivar"}</button><button disabled={busy} type="button" style={{...button,padding:"8px 13px",borderRadius:9,background:"#fff1f2",color:"#b91c1c",fontSize:12}} onClick={()=>eliminar(p.id)}>Eliminar</button></div>
                </div>
            </div>
        })}</div>}
    </div>
}

function ServiciosManager_SeccionIcon({tipo,size=17}:{tipo:"servicios"|"extras"|"promociones";size?:number}) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flexShrink:0}}>
        {tipo === "servicios" ? <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h7M17.5 14v7"/></> : tipo === "extras" ? <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9M8 5.25l8 4.5"/></> : <><path d="M3 4h8l10 10-7 7L3 10V4Z"/><circle cx="7.5" cy="8" r="1"/><path d="m11 16 5-5M11.5 11.5h.01M15.5 15.5h.01"/></>}
    </svg>
}

function ServiciosManager_CanvasPreview({
    accentColor,
    iconoPlaceholderUrl,
    iconoCheck,
    iconoEditar,
    iconoEliminar,
    isMobile,
}: {
    accentColor: string
    iconoPlaceholderUrl?: string
    iconoCheck?: string
    iconoEditar?: string
    iconoEliminar?: string
    isMobile: boolean
}) {
    const fake = [
        { nombre: "Corte + barba", precio: 4500, duracion: 45 },
        { nombre: "Coloración", precio: 8000, duracion: 90 },
        { nombre: "Keratina", precio: 12000, duracion: 120 },
    ]
    const thumbSize = isMobile ? 46 : 52
    return (
        <>
            <div
                style={{
                    display: "inline-flex",
                    gap: 4,
                    padding: 4,
                    borderRadius: 12,
                    background: "#f1f5f9",
                    marginBottom: isMobile ? 12 : 16,
                    alignSelf: "flex-start",
                }}
            >
                <div
                    className="svc-tab active"
                    style={{ pointerEvents: "none" }}
                >
                    Servicios
                </div>
                <div className="svc-tab" style={{ pointerEvents: "none" }}>
                    Productos extra
                </div>
            </div>
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
                        Servicios
                    </div>
                    <div
                        style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}
                    >
                        3 activos
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
                {fake.map((s, i) => (
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
                                width: thumbSize,
                                height: thumbSize,
                                borderRadius: 10,
                                background: "#f1f5f9",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <ServiciosManager_PlaceholderIcon
                                src={iconoPlaceholderUrl || undefined}
                                size={isMobile ? 20 : 24}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: isMobile ? 12 : 13,
                                    fontWeight: 700,
                                    color: "#1e293b",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {s.nombre}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 6,
                                    marginTop: 3,
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: accentColor,
                                    }}
                                >
                                    ${s.precio.toLocaleString("es-AR")}
                                </span>
                                <span
                                    style={{ fontSize: 11, color: "#cbd5e1" }}
                                >
                                    ·
                                </span>
                                <span
                                    style={{ fontSize: 11, color: "#94a3b8" }}
                                >
                                    {ServiciosManager_formatDuracion(
                                        s.duracion
                                    )}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: isMobile ? 3 : 4 }}>
                            {[
                                {
                                    ico: "●",
                                    img: iconoCheck,
                                    bg: "#f8fafc",
                                    border: "#e2e8f0",
                                    color: "#64748b",
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

export { Turnits_ImageAdjustDialog, ServiciosManager_ImageUploader, ServiciosManager_SkeletonLista, ServiciosManager_FormSection, ServiciosManager_FieldIcon, ServiciosManager_Field, ServiciosManager_AutoTextarea, ServiciosManager_Input, ServiciosManager_PrecioInput, ServiciosManager_ExtrasVinculados, ServiciosManager_ServicioForm, ServiciosManager_ExtraForm, ServiciosManager_ServicioCard, ServiciosManager_Creador, ServiciosManager_ProfesionalAvatar, ServiciosManager_Profesionales, ServiciosManager_ExtraCard, ServiciosManager, ServiciosManager_Promociones, ServiciosManager_SeccionIcon, ServiciosManager_CanvasPreview }
