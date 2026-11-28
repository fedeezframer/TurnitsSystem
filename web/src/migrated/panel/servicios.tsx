import PanelEmptyState from "../../components/PanelEmptyState"
import { OverlayFade } from "../../components/OverlayFade"
import { PromotionDiscountArrow } from "./PromotionDiscountArrow"
import { CatalogToolbar } from "./CatalogToolbar"
import { useCatalogTransition } from "./catalog-motion"
import "./promociones.css"
import { BackButton } from "../../components/BackButton"
import LoadingRunner, { InlineLoading } from "../../components/LoadingRunner"
import { useBranchAdmin } from "../../components/BranchAdmin"
import { appConfig } from "../../config"
import { useQuoteMode } from "../../shared/agenda-mode"
import { TurnitsGlobalSaveManager_get } from "./common"
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
import { PROMO_DAYS, promoDaysLabel } from "../../shared/promotions.js"

const catalogFilters = [{id:"todos",label:"Todos"},{id:"pausados",label:"Pausados"}] as const

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
        <OverlayFade
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
                    <BackButton onClick={onCancel} aria-label="Volver" />
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
        </OverlayFade>,
        document.body
    )
}

function ServiciosManager_ImageUploader({
    value,
    onChange,
    accentColor,
    apiUrl,
    iconoFormUrl,
    onUploadingChange,
    size = 86,
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

        onUploadingChange?.(true)
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
        onUploadingChange?.(false)
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
            <AnimatePresence>{cropFile && (
                <Turnits_ImageAdjustDialog
                    file={cropFile}
                    aspect={1}
                    onCancel={() => setCropFile(null)}
                    onApply={(adjusted) => {
                        setCropFile(null)
                        uploadFile(adjusted)
                    }}
                />
            )}</AnimatePresence>
            <div
                style={{
                    display: size > 100 ? "block" : "flex",
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
                        width: size > 100 ? "min(100%, 450px)" : size,
                        height: size > 100 ? "auto" : size,
                        aspectRatio: size > 100 ? "1 / 1" : undefined,
                        borderRadius: size > 100 ? 20 : 16,
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
                                    opacity: size > 100 ? 1 : 0,
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
                                        fontSize: size > 100 ? 13 : 18,
                                        color: "#fff",
                                        lineHeight: 1.1,
                                        fontWeight: 700,
                                        background: size > 100 ? "rgba(0,0,0,.48)" : "transparent",
                                        borderRadius: 999,
                                        padding: size > 100 ? "9px 13px" : 0,
                                    }}
                                >
                                    {size > 100 ? "Cambiar imagen" : "↑"}
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
                                size={size > 100 ? 52 : 28}
                            />
                            <span
                                style={{
                                    fontSize: size > 100 ? 14 : 9,
                                    color: "#94a3b8",
                                    textAlign: "center",
                                    lineHeight: 1.3,
                                    fontWeight: size > 100 ? 600 : 400,
                                }}
                            >
                                {size > 100 ? "Agregar imagen" : <>Subir<br />foto</>}
                            </span>
                        </div>
                    )}
                </div>

                {size <= 100 && <div
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
                </div>}

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

function ServiciosManager_SkeletonLista() { return <LoadingRunner card label="Cargando servicios…" /> }

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
        case "image":
            return (
                <svg {...common}>
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
            )
        case "user-check":
            return (
                <svg {...common}>
                    <path d="m16 11 2 2 4-4" />
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                </svg>
            )
        case "percent":
            return (
                <svg {...common}>
                    <line x1="19" x2="5" y1="5" y2="19" />
                    <circle cx="6.5" cy="6.5" r="2.5" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
            )
        default:
            return null
    }
}

// Título de un campo con su ícono y una línea de ayuda debajo, igual que en el
// formulario de productos (ServiciosManager_Field), pero con la tipografía del
// formulario de servicios.
function ServiciosManager_FieldTitle({
    icon,
    label,
    hint,
    htmlFor,
    labelStyle,
}: {
    icon: string
    label: string
    hint?: string
    htmlFor?: string
    labelStyle: React.CSSProperties
}) {
    const gap = labelStyle.marginBottom
    return (
        <>
            <label
                htmlFor={htmlFor}
                style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, marginBottom: hint ? 3 : gap }}
            >
                <ServiciosManager_FieldIcon name={icon} size={16} color="#566257" />
                {label}
            </label>
            {hint && <small className="catalog-hint" style={{ marginBottom: gap }}>{hint}</small>}
        </>
    )
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

    if (loading) return <InlineLoading label="Cargando productos relacionados…" />

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

function CatalogSaveState({message, label, saving, onSave}: {
    message: string; label: string; saving: boolean; onSave: () => void
}) {
    const slot = document.getElementById("catalog-save-slot")
    const control = <div className="catalog-save-state" role="region" aria-label={label}>
        <span>{message}</span>
        <button type="button" disabled={saving} onClick={onSave}>{saving ? "Guardando…" : label}</button>
    </div>
    return slot ? createPortal(control, slot) : control
}

// Los borradores de productos y promociones viven en el gestor global de
// guardado, igual que los de servicios. Esto ajusta o descarta uno sin pasar
// por la API (por ejemplo, al pausar o eliminar un elemento con edición abierta).
function ServiciosManager_updatePending(section: "productos" | "promociones", id: string, update: ((draft: any) => any) | null) {
    const manager = TurnitsGlobalSaveManager_get()
    const pending = { ...manager?.getPending(section) }
    if (pending[id] === undefined) return
    if (update) pending[id] = update(pending[id])
    else delete pending[id]
    if (Object.keys(pending).length) manager?.markDirty(section, pending)
    else manager?.clear(section)
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
    const quoteMode = useQuoteMode(apiUrl)
    const branch = useBranchAdmin()
    const [uploadingImage,setUploadingImage] = React.useState(false)
    const globalEdit = !!(modoEdicion && servicioId && !employeeVariant && !employeeMode && !branch)
    const [form, setForm] = React.useState<ServiciosManager_FormData>(() => globalEdit ? TurnitsGlobalSaveManager_get()?.getPending("servicios")?.[servicioId!] || initial : initial)
    const [precioError, setPrecioError] = React.useState("")
    const [profesionales, setProfesionales] = React.useState<CatalogoProfesional[]>([])
    const [avisoProfesional, setAvisoProfesional] = React.useState("")
    const avisoTimer = React.useRef<number | undefined>(undefined)

    React.useEffect(() => {
        if (employeeMode || employeeVariant || branch) return
        let activo = true
        const token = ServiciosManager_getToken()
        const slug = ServiciosManager_getSlug()
        fetch(`${apiUrl.replace(/\/+$/, "")}/admin/equipo/${encodeURIComponent(slug)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-cache",
        })
            .then((response) => response.ok ? response.json() : Promise.reject())
            .then((data) => {
                if (activo) setProfesionales(Array.isArray(data.equipo)
                    ? data.equipo.filter((person: any) => person && (person.activo === true || person.activo === "true"))
                    : [])
            })
            .catch(() => { if (activo) setProfesionales([]) })
        return () => { activo = false }
    }, [apiUrl, employeeMode, employeeVariant, branch])

    const selectedProfesionales = form.profesionalesIds || initial.profesionalesIds || []
    const toggleProfesional = (profesional: CatalogoProfesional) => {
        const selected = selectedProfesionales.includes(profesional.id)
        const nombre = [profesional.nombre, profesional.apellido].filter(Boolean).join(" ")
        setForm((previous) => ({
            ...previous,
            profesionalesInicialesIds: previous.profesionalesInicialesIds || initial.profesionalesInicialesIds || [],
            profesionalesIds: selected
                ? (previous.profesionalesIds || initial.profesionalesIds || []).filter((id) => id !== profesional.id)
                : [...(previous.profesionalesIds || initial.profesionalesIds || []), profesional.id],
        }))
        setAvisoProfesional(`${selected ? "Quitaste a" : "Agregaste a"} ${nombre}`)
        if (avisoTimer.current) window.clearTimeout(avisoTimer.current)
        avisoTimer.current = window.setTimeout(() => setAvisoProfesional(""), 1500)
    }
    React.useEffect(() => () => { if (avisoTimer.current) window.clearTimeout(avisoTimer.current) }, [])

    React.useEffect(() => {
        if (!globalEdit || !servicioId) return
        const manager = TurnitsGlobalSaveManager_get()
        manager?.configure(apiUrl)
        const pending = { ...manager?.getPending("servicios") }
        if (JSON.stringify(form) === JSON.stringify(initial)) delete pending[servicioId]
        else pending[servicioId] = form
        if (Object.keys(pending).length) manager?.markDirty("servicios", pending)
        else manager?.clear("servicios")
    }, [form, globalEdit, servicioId, apiUrl])

    const set = (key: keyof ServiciosManager_FormData) => (value: string) =>
        setForm((previous) => ({ ...previous, [key]: value }))

    const inputStyle: React.CSSProperties = {
        width: "100%", minWidth: 0, height: 44,
        boxSizing: "border-box", border: "1px solid #aaa", borderRadius: 999,
        padding: isMobile ? "0 15px" : "0 18px", background: "#fff",
        color: "#111", fontFamily: "inherit", fontSize: isMobile ? 15 : 16,
        outlineColor: accentColor,
    }
    const labelStyle: React.CSSProperties = {
        display: "block", marginBottom: isMobile ? 6 : 8,
        color: "#111", fontSize: isMobile ? 15 : 16,
        fontWeight: 450, lineHeight: 1.2,
    }
    const fieldStyle: React.CSSProperties = { minWidth: 0 }
    const handleSubmit = () => {
        if (!quoteMode && Number(form.precio) < ServiciosManager_PRECIO_MINIMO) {
            setPrecioError(`El precio mínimo es $${ServiciosManager_PRECIO_MINIMO.toLocaleString("es-AR")}.`)
            return
        }
        setPrecioError("")
        onSubmit(quoteMode ? { ...form, precio: "0" } : form)
    }

    const readyToSave = !uploadingImage && !!form.nombre.trim() && (quoteMode || Number(form.precio) >= ServiciosManager_PRECIO_MINIMO)
        && Number(form.duracion) >= 1 && Number(form.capacidad) >= 1
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.2 }}
            style={{
                background: "#fff", borderRadius: isMobile ? 24 : 18,
                border: "1px solid #b6b6b6", boxShadow: "none",
                padding: isMobile ? 18 : 24,
                boxSizing: "border-box", overflow: "hidden", position: "relative",
                fontFamily: "'Inter Display', -apple-system, sans-serif",
            }}
        >
            <style>{ServiciosManager_shimmerCSS}</style>
            <div style={{ ...fieldStyle, marginBottom: isMobile ? 16 : 20 }}>
                <ServiciosManager_FieldTitle icon="tag" label="Nombre del Servicio" hint="Así lo van a ver tus clientes al reservar." htmlFor="servicio-nombre" labelStyle={labelStyle} />
                <input
                    id="servicio-nombre" className="svc-input" value={form.nombre}
                    onChange={(event) => set("nombre")(event.target.value)}
                    placeholder="Ej. Corte de pelo" maxLength={80}
                    style={{ ...inputStyle, fontWeight: 700 }}
                />
            </div>

            <div style={{
                display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(200px, 320px) minmax(0, 1fr)",
                gap: isMobile ? 16 : 24, alignItems: "stretch",
            }}>
                <div style={{ ...fieldStyle, display: "flex", flexDirection: "column" }}>
                    <ServiciosManager_FieldTitle icon="image" label="Imagen del Servicio" hint="Elegí una foto donde se distinga el servicio." labelStyle={labelStyle} />
                    <ServiciosManager_ImageUploader onUploadingChange={setUploadingImage}
                        value={form.imagen} onChange={set("imagen")} accentColor={accentColor}
                        apiUrl={apiUrl} iconoFormUrl={iconoFormUrl}
                        size={isMobile ? 300 : 450} uploadPath={uploadPath}
                    />
                </div>

                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: isMobile ? 14 : 16, minWidth: 0 }}>
                    <div style={fieldStyle}>
                        <ServiciosManager_FieldTitle icon="align-left" label="Descripción" hint="Detallá qué incluye y cualquier aclaración útil." htmlFor="servicio-descripcion" labelStyle={labelStyle} />
                        <textarea
                            id="servicio-descripcion" className="svc-input" value={form.descripcion}
                            onChange={(event) => set("descripcion")(event.target.value)}
                            placeholder="Contá qué incluye el servicio."
                            style={{
                                ...inputStyle, height: isMobile ? 110 : 112,
                                borderRadius: 18, padding: isMobile ? 11 : 15, resize: "vertical",
                                fontSize: isMobile ? 14 : 16, lineHeight: 1.4,
                            }}
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: isMobile ? 10 : 14 }}>
                        <div style={{ ...fieldStyle, display: "flex", flexDirection: "column" }}>
                            <ServiciosManager_FieldTitle icon="dollar" label="Precio" hint={quoteMode ? undefined : `Desde $${ServiciosManager_PRECIO_MINIMO.toLocaleString("es-AR")} por turno.`} htmlFor="servicio-precio" labelStyle={labelStyle} />
                            <div style={{ position: "relative", marginTop: "auto" }}>
                                <span aria-hidden="true" style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#666" }}>$</span>
                                <input
                                    id="servicio-precio" className="svc-input" type="number" min={quoteMode ? 0 : ServiciosManager_PRECIO_MINIMO}
                                    value={form.precio} onChange={(event) => { set("precio")(event.target.value); if (Number(event.target.value) >= ServiciosManager_PRECIO_MINIMO) setPrecioError("") }}
                                    placeholder={quoteMode ? "0" : String(ServiciosManager_PRECIO_MINIMO)} style={{ ...inputStyle, paddingLeft: 36 }}
                                />
                            </div>
                            {precioError &&<span style={{ display: "block", marginTop: 5, color: "#b42318", fontSize: 12 }}>{precioError}</span>}
                        </div>
                        <div style={{ ...fieldStyle, display: "flex", flexDirection: "column" }}>
                            <ServiciosManager_FieldTitle icon="clock" label="Duración (minutos)" hint="Cuánto dura cada turno." htmlFor="servicio-duracion" labelStyle={labelStyle} />
                            <input id="servicio-duracion" className="svc-input" type="number" min={1} step={1} value={form.duracion} onChange={e => set("duracion")(e.target.value)} style={{ ...inputStyle, marginTop: "auto" }} />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: isMobile ? 10 : 14 }}>
                        <div style={{ ...fieldStyle, display: "flex", flexDirection: "column" }}>
                            <ServiciosManager_FieldTitle icon="users" label="Personas por turno" hint="Cuántos clientes entran a la vez." htmlFor="servicio-capacidad" labelStyle={{ ...labelStyle, fontSize: isMobile ? 13 : 14, marginBottom: 5 }} />
                            <input id="servicio-capacidad" className="svc-input" type="number" min={1} value={form.capacidad} onChange={(event) => set("capacidad")(event.target.value)} style={{ ...inputStyle, height: isMobile ? 38 : 40, fontSize: isMobile ? 14 : 15, paddingLeft: 14, marginTop: "auto" }} />
                        </div>
                        <div style={{ ...fieldStyle, display: "flex", flexDirection: "column" }}>
                            <ServiciosManager_FieldTitle icon="list" label="Orden en el listado" hint="Los números más bajos aparecen primero." htmlFor="servicio-orden" labelStyle={{ ...labelStyle, fontSize: isMobile ? 13 : 14, marginBottom: 5 }} />
                            <input id="servicio-orden" className="svc-input" type="number" min={0} value={form.orden} onChange={(event) => set("orden")(event.target.value)} style={{ ...inputStyle, height: isMobile ? 38 : 40, fontSize: isMobile ? 14 : 15, paddingLeft: 14, marginTop: "auto" }} />
                        </div>
                    </div>

                    {!employeeVariant && !employeeMode && !branch && profesionales.length > 0 && (
                        <div style={fieldStyle}>
                            <ServiciosManager_FieldTitle icon="user-check" label="Profesionales que lo ofrecen" hint="Tocá un profesional para sumarlo o quitarlo." labelStyle={{ ...labelStyle, marginBottom: isMobile ? 7 : 8 }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: 46 }}>
                                {profesionales.map((profesional) => {
                                    const selected = selectedProfesionales.includes(profesional.id)
                                    const initials = [profesional.nombre, profesional.apellido].filter(Boolean).map((value) => value?.trim()[0]).join("").toUpperCase().slice(0, 2)
                                    const fullName = [profesional.nombre, profesional.apellido].filter(Boolean).join(" ")
                                    return (
                                        <button
                                            key={profesional.id} type="button" aria-label={`${selected ? "Quitar" : "Agregar"} a ${fullName}`}
                                            aria-pressed={selected} title={`${fullName}${selected ? " · asignado" : " · agregar"}`}
                                            onClick={() => toggleProfesional(profesional)}
                                            style={{
                                                position: "relative", width: isMobile ? 38 : 42, height: isMobile ? 38 : 42,
                                                padding: 0, borderRadius: "50%", border: `2px solid ${selected ? accentColor : "transparent"}`,
                                                background: profesional.color || "#94a3b8", color: "white", cursor: "pointer",
                                                display: "grid", placeItems: "center", boxShadow: selected ? `0 0 0 2px ${accentColor}25` : "none",
                                            }}
                                        >
                                            <span aria-hidden="true" style={{ fontSize: isMobile ? 15 : 18, position: "relative" }}>{initials || "P"}</span>
                                            {profesional.foto_url && <img src={profesional.foto_url} alt="" onError={(event) => { event.currentTarget.style.display = "none" }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />}
                                            {selected && <span aria-hidden="true" style={{ position: "absolute", right: -4, bottom: -4, width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", border: `1px solid ${accentColor}`, background: "white" }}><img src="/assets/panel-nav/akar-icons_check.svg" alt="" width="12" height="12" /></span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && <div role="alert" style={{ marginTop: 22, padding: "10px 14px", borderRadius: 10, background: "#fff5f5", border: "1px solid #fee2e2", color: "#b42318", fontSize: 13 }}>{error}</div>}

            {!globalEdit && readyToSave && <CatalogSaveState message={modoEdicion ? "Cambios en el servicio" : "Servicio listo para guardar"} label="Guardar servicio" saving={guardando} onSave={handleSubmit} />}
            {typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {avisoProfesional && <div key="aviso-profesional" style={{ position: "fixed", inset: 0, zIndex: 10001, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "calc(76px + env(safe-area-inset-top, 0px)) 16px 16px", pointerEvents: "none" }}>
                        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} role="status" style={{ maxWidth: "min(420px, 100%)", padding: "16px 26px", borderRadius: 14, background: "#fff", border: "1px solid #d6e3d6", boxShadow: "0 14px 44px rgba(15,23,42,.22)", color: "#166534", fontSize: 15, fontWeight: 650, textAlign: "center" }}>{avisoProfesional}</motion.div>
                    </div>}
                </AnimatePresence>,
                document.body
            )}
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
    extraId,
}: ServiciosManager_ExtraFormProps) {
    // Edición de un producto existente: el borrador vive en el estado global
    // (barra "Guardar cambios"), no en un botón propio.
    const globalEdit = !!(modoEdicion && extraId && !employeeMode)
    const [form, setForm] =
        React.useState<ServiciosManager_ExtraFormData>(() => {
            if (globalEdit) {
                const draft = TurnitsGlobalSaveManager_get()?.getPending("productos")?.[extraId!]
                if (draft) return draft as ServiciosManager_ExtraFormData
            }
            return initial
        })
    const [precioError, setPrecioError] = React.useState("")

    React.useEffect(() => {
        if (!globalEdit) return
        const manager = TurnitsGlobalSaveManager_get()
        if (!manager) return
        manager.configure(apiUrl)
        const pending = { ...manager.getPending("productos") }
        if (JSON.stringify(form) === JSON.stringify(initial)) delete pending[extraId!]
        else pending[extraId!] = form
        if (Object.keys(pending).length) manager.markDirty("productos", pending)
        else manager.clear("productos")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, globalEdit, extraId, apiUrl])

    const set = (key: keyof ServiciosManager_ExtraFormData) => (val: string) =>
        setForm((p) => ({ ...p, [key]: val }))

    const accentVars = {
        "--accent": accentColor,
        "--accent-10": accentColor + "18",
        "--accent-05": accentColor + "0d",
        "--accent-30": accentColor + "44",
    } as React.CSSProperties

    const [uploadingImage, setUploadingImage] = React.useState(false)
    const readyToSave = !uploadingImage && !!form.nombre.trim() && Number(form.precio) >= ServiciosManager_PRECIO_MINIMO_EXTRA
        && (!modoEdicion || JSON.stringify(form) !== JSON.stringify(initial))
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
                <BackButton onClick={onCancel} aria-label="Cerrar" />
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
                <small className="catalog-hint">Elegí una foto donde se distinga el producto.</small>
                <ServiciosManager_ImageUploader onUploadingChange={setUploadingImage}
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
                        label="Nombre del producto" hint="Así lo van a ver tus clientes al reservar."
                        icon="tag"
                    >
                        <ServiciosManager_Input
                            value={form.nombre}
                            onChange={set("nombre")}
                            placeholder="Ej: Cera para peinar"
                        />
                    </ServiciosManager_Field>

                    <ServiciosManager_Field
                        label="Descripción" hint="Indicá la presentación, el tamaño o el uso."
                        icon="align-left"
                    >
                        <ServiciosManager_AutoTextarea
                            value={form.descripcion}
                            onChange={set("descripcion")}
                            placeholder="Ej. Cera mate de 100 g, fijación media."
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
                        hint={`Precio de una unidad. Mínimo $${ServiciosManager_PRECIO_MINIMO_EXTRA.toLocaleString("es-AR")}`}
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
                        hint="Los números más bajos aparecen primero."
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

                {readyToSave && !globalEdit && <CatalogSaveState message={modoEdicion ? "Cambios en el producto" : "Producto listo para guardar"} label="Guardar producto" saving={guardando} onSave={handleSubmit} />}
            </div>
        </motion.div>
    )
}

const catalogThumbSize = (mobile: boolean) => mobile ? 52 : 48

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
    menuAbierto,
    onToggleMenu,
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
    menuAbierto: boolean
    onToggleMenu: () => void
}) {
    const quoteMode = useQuoteMode()
    const branch = useBranchAdmin()
    const [confirmDelete, setConfirmDelete] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)
    const moreButtonRef = React.useRef<HTMLButtonElement>(null)


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
                gap: isMobile ? 8 : 11,
                padding: "5px 9px",
                borderRadius: 11,
                background: "#fff",
                border: "1px solid #bfc3bf",
                opacity: svc.activo ? 1 : 0.55,
                transition: "background 0.15s, opacity 0.2s",
                ...(!employeeMode ? ServiciosManager_EmployeeCardStyle(svc) : {}),
            }}
        >
            <div
                style={{
                    width: catalogThumbSize(isMobile),
                    height: catalogThumbSize(isMobile),
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

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{fontSize:12,fontWeight:650,color:"#111",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{svc.nombre}</div>
                <div style={{fontSize:9.5,color:"#5f665f",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{svc.descripcion || "Sin descripción"}</div>
                {!employeeMode && <ServiciosManager_Creador item={svc} />}
                {!employeeMode && <ServiciosManager_Profesionales profesionales={svc.profesionales} />}
            </div>

            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:"auto"}}>
                {employeeCanEdit && <button type="button" onClick={onEdit} className="svc-edit-button" aria-label={`Editar ${svc.nombre}`}>
                    {iconoEditar ? <img src={iconoEditar} alt="" /> : <span aria-hidden="true">✎</span>} Editar
                </button>}
                {!branch && employeeCanEdit && <div style={{position:"relative"}}>
                    <button ref={moreButtonRef} type="button" className="svc-more-button" aria-label={`Más opciones para ${svc.nombre}`} aria-expanded={menuAbierto} onClick={() => {onToggleMenu();setConfirmDelete(false)}}>•••</button>
                    <AnimatePresence>
                        {menuAbierto && <ServiciosManager_RowMenu key="row-menu" anchor={moreButtonRef}>
                            {confirmDelete ? <>
                                <button type="button" className="is-danger" onClick={() => {onDelete();setConfirmDelete(false);onToggleMenu()}}>Confirmar eliminación</button>
                                <button type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                            </> : <>
                                {!employeeMode && <button type="button" onClick={() => {onToggle();onToggleMenu()}}>{svc.activo ? "Pausar" : "Activar"}</button>}
                                <button type="button" className="is-danger" onClick={() => setConfirmDelete(true)}>Eliminar</button>
                            </>}
                        </ServiciosManager_RowMenu>}
                    </AnimatePresence>
                </div>}
            </div>
            {!quoteMode && <strong className="svc-row-price">{`$${Number(svc.precio || 0).toLocaleString("es-AR")}`}</strong>}
        </motion.div>
    )
}

// Menú "..." de cada fila. Se dibuja en un portal con posición fija, así no lo
// recortan los contenedores de la lista ni lo tapa la barra inferior, y se abre
// hacia arriba cuando abajo no hay lugar (últimas filas).
export function ServiciosManager_RowMenu({ anchor, children }: { anchor: React.RefObject<HTMLElement | null>; children: React.ReactNode }) {
    const ref = React.useRef<HTMLDivElement>(null)
    const [pos, setPos] = React.useState<{ top: number; right: number } | null>(null)
    const place = React.useCallback(() => {
        const trigger = anchor.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const height = ref.current?.offsetHeight || 84
        const below = window.innerHeight - rect.bottom
        const top = below >= height + 12 || below >= rect.top
            ? rect.bottom + 4
            : Math.max(8, rect.top - height - 4)
        const right = Math.max(8, window.innerWidth - rect.right)
        setPos((previous) => previous && previous.top === top && previous.right === right ? previous : { top, right })
    }, [anchor])
    React.useLayoutEffect(() => { place() })
    React.useEffect(() => {
        window.addEventListener("scroll", place, true)
        window.addEventListener("resize", place)
        return () => {
            window.removeEventListener("scroll", place, true)
            window.removeEventListener("resize", place)
        }
    }, [place])
    if (typeof document === "undefined") return null
    return createPortal(
        <motion.div
            ref={ref}
            className="svc-row-menu"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{ position: "fixed", top: pos ? pos.top : 0, right: pos ? pos.right : 0, zIndex: 10000, visibility: pos ? "visible" : "hidden" }}
        >
            {children}
        </motion.div>,
        document.body
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

function ServiciosManager_Profesionales({profesionales=[]}:{profesionales?:CatalogoProfesional[] | null}) {
    if (!Array.isArray(profesionales)) profesionales = []
    if(!profesionales.length)return null
    return <div aria-label="Profesionales que lo ofrecen" style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:3,marginTop:7}}>{profesionales.map(prof=><ServiciosManager_ProfesionalAvatar key={prof.id} prof={prof}/>)}</div>
}

function ServiciosManager_ExtraCard({
    employeeMode = false, extra, canEdit = true, accentColor,
    iconoPlaceholderUrl, iconoEditar, onEdit, onToggle, onDelete, isMobile,
}: {
    canEdit?: boolean; employeeMode?: boolean; extra: ServiciosManager_Extra; accentColor: string;
    iconoPlaceholderUrl?: string; iconoCheck?: string; iconoEditar?: string; iconoEliminar?: string;
    onEdit: () => void; onToggle: () => void; onDelete: () => void; isMobile: boolean;
}) {
    const [confirmDelete, setConfirmDelete] = React.useState(false)
    const [menuAbierto, setMenuAbierto] = React.useState(false)
    const [imgError, setImgError] = React.useState(false)
    const moreButtonRef = React.useRef<HTMLButtonElement>(null)
    return (
        <motion.div layout initial={{opacity:0,y:6}} animate={{opacity:!employeeMode && extra.owner_equipo_id ? (extra.activo ? .8 : .5) : (extra.activo ? 1 : .55),y:0}} exit={{opacity:0,scale:.96}} transition={{duration:.18}} className="svc-card product-card" style={{display:"flex",alignItems:"center",flexWrap:"nowrap",gap:10,padding:"9px 9px",borderRadius:11,background:"#fff",border:"1px solid #bfc3bf",opacity:extra.activo?1:.55,transition:"background .15s, opacity .2s",...(!employeeMode?ServiciosManager_EmployeeCardStyle(extra):{})}}>
            <div style={{width:catalogThumbSize(isMobile),height:catalogThumbSize(isMobile),borderRadius:5,flexShrink:0,overflow:"hidden",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {extra.imagen_url && !imgError ? <img src={extra.imagen_url} alt={extra.nombre} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={()=>setImgError(true)}/> : <ServiciosManager_PlaceholderIcon src={iconoPlaceholderUrl} size={22}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#171b18",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{extra.nombre}</div>
                <div style={{fontSize:10,color:"#69716a",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{extra.descripcion || "Sin descripción"}</div>
                {!employeeMode && <ServiciosManager_Creador item={extra}/>}
                {extra.compartido && <div style={{fontSize:10,color:"#64716b",marginTop:2}}>Producto del negocio · lo administra el titular</div>}
            </div>
            {canEdit && <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                <button className="svc-edit-button" type="button" onClick={onEdit} title="Editar">{iconoEditar?<img src={iconoEditar} alt=""/>:<span aria-hidden="true">✎</span>} Editar</button>
                <div className="svc-row-menu-anchor">
                    <button ref={moreButtonRef} className="svc-more-button" type="button" aria-label={menuAbierto?"Cerrar opciones":"Más opciones"} aria-expanded={menuAbierto} onClick={()=>{setMenuAbierto(value=>!value);setConfirmDelete(false)}}>···</button>
                    <AnimatePresence>{menuAbierto && <ServiciosManager_RowMenu key="row-menu" anchor={moreButtonRef}>
                        {confirmDelete ? <><span className="svc-delete-confirm-label">¿Eliminar producto?</span><button type="button" className="is-danger" onClick={()=>{onDelete();setMenuAbierto(false);setConfirmDelete(false)}}>Sí, eliminar</button><button type="button" onClick={()=>setConfirmDelete(false)}>Cancelar</button></> : <><button type="button" onClick={()=>{onToggle();setMenuAbierto(false)}}>{extra.activo?"Pausar":"Reactivar"}</button><button type="button" className="is-danger" onClick={()=>setConfirmDelete(true)}>Eliminar</button></>}
                    </ServiciosManager_RowMenu>}</AnimatePresence>
                </div>
            </div>}
            <strong className="svc-row-price">{"$"+extra.precio.toLocaleString("es-AR")}</strong>
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
        initialView = "servicios",
        style,
    } = props

    const branch = useBranchAdmin()
    const api = baseUrl.replace(/\/+$/, "")
    const containerRef = React.useRef<HTMLDivElement>(null)
    const containerWidth = ServiciosManager_useContainerWidth(containerRef)
    const isMobile = containerWidth < 480

    const [puedePromociones, setPuedePromociones] = React.useState(false)
    const [vista, setVista] = React.useState<"servicios" | "extras" | "promociones">(
        initialView
    )
    React.useEffect(() => { setVista(initialView) }, [initialView])
    const [serviciosMasPedidos, setServiciosMasPedidos] = React.useState<any[]>([])
    const [filtroServicios, setFiltroServicios] = React.useState<"todos" | "pausados">("todos")
    const [ordenServicios, setOrdenServicios] = React.useState<"pedidos" | "az" | "za" | "precio-desc" | "precio-asc">("pedidos")
    const [menuServicioAbierto, setMenuServicioAbierto] = React.useState<string | null>(null)
    const [busquedaServicio, setBusquedaServicio] = React.useState("")
    const [filtroProductos, setFiltroProductos] = React.useState<"todos" | "pausados">("todos")
    const [ordenProductos, setOrdenProductos] = React.useState<"az" | "za" | "precio-desc" | "precio-asc">("az")
    const [busquedaProducto, setBusquedaProducto] = React.useState("")
    React.useEffect(() => {
        if (vista !== "servicios" || ordenServicios !== "pedidos") return
        let cancelled = false
        let retryTimer: ReturnType<typeof setTimeout> | undefined
        let pollTimer: ReturnType<typeof setInterval> | undefined
        let retries = 0
        const loadPopularity = async () => {
            const slug = ServiciosManager_getSlug()
            const token = ServiciosManager_getToken()
            if (!slug || !token) {
                if (retries++ < 12) retryTimer = setTimeout(loadPopularity, 300)
                return
            }
            try {
                const response = await fetch(`${api}/admin-stats/${encodeURIComponent(slug)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (!response.ok) return
                const data = await response.json()
                if (!cancelled) setServiciosMasPedidos(Array.isArray(data?.serviciosMasPedidos) ? data.serviciosMasPedidos : [])
            } catch {}
        }
        const refresh = () => { if (document.visibilityState !== "hidden") loadPopularity() }
        loadPopularity()
        pollTimer = setInterval(refresh, 60000)
        window.addEventListener("turno_actualizado", refresh)
        window.addEventListener("turno_cancelado", refresh)
        return () => {
            cancelled = true
            if (retryTimer) clearTimeout(retryTimer)
            if (pollTimer) clearInterval(pollTimer)
            window.removeEventListener("turno_actualizado", refresh)
            window.removeEventListener("turno_cancelado", refresh)
        }
    }, [api, ordenServicios, vista])
    // ── Estado: Servicios ──
    const [loading, setLoading] = React.useState(true)
    const [servicios, setServicios] = React.useState<
        ServiciosManager_Servicio[]
    >([])
    const [error, setError] = React.useState("")
    const [formError, setFormError] = React.useState("")
    const [guardando, setGuardando] = React.useState(false)
    const [catalogRevision, setCatalogRevision] = React.useState(0)
    React.useEffect(() => {
        const reload = (event: any) => {
            const section = event.detail?.section
            if (event.type === "turnits_global_saved" && section !== "servicios" && section !== "browse" && section !== "productos") return
            setCatalogRevision(value => value + 1)
            if (event.type === "turnits_global_discarded" || section !== "productos") setEditando(null)
            if (event.type === "turnits_global_discarded" || section === "productos") setEditandoExtra(null)
        }
        window.addEventListener("turnits_global_saved", reload)
        window.addEventListener("turnits_global_discarded", reload)
        return () => {
            window.removeEventListener("turnits_global_saved", reload)
            window.removeEventListener("turnits_global_discarded", reload)
        }
    }, [])
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
                    Array.isArray(data.servicios) ? data.servicios : []
                ).filter((s: any) => s && typeof s === "object").map((s: any) => {
                    const { imagen, descripcion } = ServiciosManager_parseDesc(
                        typeof s.descripcion === "string" ? s.descripcion : ""
                    )
                    return { ...s, nombre: s.nombre || "Servicio", precio: Number(s.precio) || 0, duracion: Number(s.duracion) || 30, capacidad: Number(s.capacidad) || 1, orden: Number(s.orden) || 0, profesionales: Array.isArray(s.profesionales) ? s.profesionales.filter(Boolean) : [], activo: s.activo === true || s.activo === "true", imagen: s.imagen_url || imagen, descripcion }
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
    }, [api, employeeMode, catalogRevision])

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
                setExtras(Array.isArray(data.extras) ? data.extras.filter(Boolean) : [])
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
    }, [api, employeeMode, catalogRevision])

    // ── Handlers: Servicios (sin cambios funcionales) ──
    const syncProfesionales = async (servicioId: string, anteriores: string[] = [], nuevos: string[] = []) => {
        const token = ServiciosManager_getToken()
        const slug = ServiciosManager_getSlug()
        const quitar = anteriores.filter(id => !nuevos.includes(id))
        const sumar = nuevos.filter(id => !anteriores.includes(id))
        const results = await Promise.all([...quitar.map(id => fetch(`${api}/admin/equipo/${encodeURIComponent(id)}/servicios/${encodeURIComponent(servicioId)}?slug=${encodeURIComponent(slug)}`, { method:"DELETE", headers:{Authorization:`Bearer ${token}`} })), ...sumar.map(id => fetch(`${api}/admin/equipo/${encodeURIComponent(id)}/servicios`, { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({slug,servicio_id:servicioId}) }))])
        if (results.some(r => !r.ok)) throw new Error("No se pudieron actualizar los profesionales asignados.")
    }
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
            if (!employeeMode && data.servicio?.id && form.profesionalesIds?.length) {
                await syncProfesionales(data.servicio.id, [], form.profesionalesIds)
                setCatalogRevision(value => value + 1)
            }
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
            if (!employeeMode) {
                await syncProfesionales(editando.id, (editando.profesionales || []).map((p: any) => p.id), form.profesionalesIds || [])
                setCatalogRevision(value => value + 1)
            }
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
            ServiciosManager_updatePending("productos", extra.id, null)
        } catch {
            setExtras((p) => [...p, extra].sort((a, b) => a.orden - b.orden))
        }
    }

    if ((vista !== "extras" && loading) || (vista !== "servicios" && loadingExtras)) return <InlineLoading label={vista === "extras" ? "Cargando productos…" : vista === "servicios" ? "Cargando servicios…" : "Cargando promociones…"} />

    const initialEditar: ServiciosManager_FormData | undefined = editando
        ? {
              nombre: editando.nombre,
              descripcion: editando.descripcion,
              imagen: editando.imagen,
              duracion: String(editando.duracion),
                precio: String(Number(editando.precio) || 0),
              capacidad: String(editando.capacidad),
              orden: String(editando.orden),
              profesionalesIds: (editando.profesionales || []).map((p: any) => p.id),
              profesionalesInicialesIds: (editando.profesionales || []).map((p: any) => p.id),
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
    const popularidad = new Map<string, number>(serviciosMasPedidos.map((item: any): [string, number] => [String(item.nombre || "").trim().toLocaleLowerCase("es"), Number(item.cantidad || 0)]))
    const serviciosVisibles = servicios
        .filter((item) => filtroServicios !== "pausados" || !item.activo)
        .filter((item) => item.nombre.toLocaleLowerCase("es").includes(busquedaServicio.trim().toLocaleLowerCase("es")))
        .sort((a, b) => {
            if (ordenServicios === "pedidos") return (popularidad.get(b.nombre.trim().toLocaleLowerCase("es")) || 0) - (popularidad.get(a.nombre.trim().toLocaleLowerCase("es")) || 0) || a.orden - b.orden
            if (ordenServicios === "az") return a.nombre.localeCompare(b.nombre, "es", {sensitivity:"base"})
            if (ordenServicios === "za") return b.nombre.localeCompare(a.nombre, "es", {sensitivity:"base"})
            if (ordenServicios === "precio-desc") return Number(b.precio) - Number(a.precio) || a.orden - b.orden
            return Number(a.precio) - Number(b.precio) || a.orden - b.orden
        })
    const extrasVisibles = extras
        .filter((item) => filtroProductos !== "pausados" || !item.activo)
        .filter((item) => item.nombre.toLocaleLowerCase("es").includes(busquedaProducto.trim().toLocaleLowerCase("es")))
        .sort((a, b) => {
            if (ordenProductos === "az") return a.nombre.localeCompare(b.nombre, "es", {sensitivity:"base"})
            if (ordenProductos === "za") return b.nombre.localeCompare(a.nombre, "es", {sensitivity:"base"})
            if (ordenProductos === "precio-desc") return Number(b.precio) - Number(a.precio) || a.orden - b.orden
            return Number(a.precio) - Number(b.precio) || a.orden - b.orden
        })

    const sectionProps = { branch, api, isMobile, accentColor, iconoPlaceholderUrl, iconoFormUrl, iconoVacioUrl, iconoCheck, iconoEditar, iconoEliminar, employeeMode, employeeCanCreate, handleCrear, handleEditar, handleToggle, handleDelete, handleCrearExtra, handleEditarExtra, handleToggleExtra, handleDeleteExtra, initialEditar, initialEditarExtra, extrasActivos, extrasInactivos, serviciosVisibles, extrasVisibles, puedePromociones, filtroServicios, setFiltroServicios, ordenServicios, setOrdenServicios, busquedaServicio, setBusquedaServicio, filtroProductos, setFiltroProductos, ordenProductos, setOrdenProductos, busquedaProducto, setBusquedaProducto, servicios, error, formError, guardando, mostrarForm, setMostrarForm, editando, setEditando, setFormError, menuServicioAbierto, setMenuServicioAbierto, extras, errorExtras, formErrorExtra, setFormErrorExtra, guardandoExtra, mostrarFormExtra, setMostrarFormExtra, editandoExtra, setEditandoExtra }

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

            {vista === "servicios"
                ? <ServiciosManager_ServiciosSection {...sectionProps} />
                : vista === "extras"
                    ? <ServiciosManager_ProductosSection {...sectionProps} />
                    : <ServiciosManager_PromocionesSection {...sectionProps} />}
        </div>
    )
}


function ServiciosManager_ServiciosSection(props: any) {
    const transition = useCatalogTransition()
    const opcionesOrden = [
        {id:"pedidos",label:"Más Pedidos"},
        {id:"az",label:"A-Z"},
        {id:"za",label:"Z-A"},
        {id:"precio-desc",label:"Mayor precio"},
        {id:"precio-asc",label:"Menor precio"},
    ] as const
    const {branch,api,isMobile,accentColor,iconoPlaceholderUrl,iconoFormUrl,iconoVacioUrl,iconoCheck,iconoEditar,iconoEliminar,employeeMode,employeeCanCreate,handleCrear,handleEditar,handleToggle,handleDelete,initialEditar,serviciosVisibles,error,formError,guardando,mostrarForm,setMostrarForm,editando,setEditando,setFormError,filtroServicios,setFiltroServicios,ordenServicios,setOrdenServicios,busquedaServicio,setBusquedaServicio,menuServicioAbierto,setMenuServicioAbierto}=props
    const mostrarFormulario = mostrarForm || !!editando
    const volverALista = () => {
        setMostrarForm(false)
        setEditando(null)
        setFormError("")
        setMenuServicioAbierto(null)
    }
    const abrirCreacion = () => {
        setMenuServicioAbierto(null)
        setFormError("")
        setMostrarForm(true)
    }
    const uploadPath = employeeMode
        ? `/empleado/${encodeURIComponent(ServiciosManager_getSlug())}/servicios/upload-imagen`
        : undefined

    return (
        <AnimatePresence mode="wait" initial={false}>
            {mostrarFormulario ? (
                <motion.div
                    key={editando ? `service-edit-${editando.id}` : "service-create"}
                    {...transition}
                    style={{ width: "100%" }}
                >
                    <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 12px" }}>
                        <BackButton className="svc-back-button" onClick={volverALista} aria-label="Volver a la lista de servicios" />
                    </div>
                    <ServiciosManager_ServicioForm
                        key={editando ? `service-form-${editando.id}` : "service-form-new"}
                        employeeMode={employeeMode}
                        initial={editando ? initialEditar : ServiciosManager_FORM_EMPTY}
                        accentColor={accentColor}
                        apiUrl={api}
                        iconoFormUrl={iconoFormUrl || undefined}
                        uploadPath={uploadPath}
                        onSubmit={editando ? handleEditar : handleCrear}
                        onCancel={volverALista}
                        guardando={guardando}
                        error={formError}
                        modoEdicion={!!editando}
                        isMobile={isMobile}
                        servicioId={editando?.id}
                        employeeVariant={!!(employeeMode && editando && !(editando as any)?.perfil_propio)}
                    />
                </motion.div>
            ) : (
                <motion.div
                    key="service-list"
                    {...transition}
                    style={{ width: "100%" }}
                >
<CatalogToolbar filters={catalogFilters} label="servicios" filterValue={filtroServicios} onFilter={setFiltroServicios} sort={ordenServicios} onSort={setOrdenServicios} opcionesOrden={opcionesOrden} search={busquedaServicio} onSearch={setBusquedaServicio} onCreate={!branch && (!employeeMode || employeeCanCreate) ? abrirCreacion : undefined} />
                    {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 10 }}>{error}</div>}
                    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: isMobile ? 5 : 6 }}>
                        {!error && serviciosVisibles.length === 0 && (
                            <PanelEmptyState>{busquedaServicio || filtroServicios === "pausados" ? "No hay servicios que coincidan con este filtro." : "Todavía no hay servicios."}</PanelEmptyState>
                        )}
                        <AnimatePresence mode="popLayout">
                            {serviciosVisibles.map((svc) => (
                                <ServiciosManager_ServicioCard
                                    key={svc.id}
                                    svc={svc}
                                    accentColor={accentColor}
                                    iconoPlaceholderUrl={iconoPlaceholderUrl || undefined}
                                    iconoCheck={iconoCheck || undefined}
                                    iconoEditar={iconoEditar || undefined}
                                    iconoEliminar={iconoEliminar || undefined}
                                    onEdit={() => {
                                        setMenuServicioAbierto(null)
                                        setEditando(svc)
                                        setMostrarForm(false)
                                        setFormError("")
                                    }}
                                    onToggle={() => handleToggle(svc)}
                                    onDelete={() => handleDelete(svc)}
                                    isMobile={isMobile}
                                    employeeMode={employeeMode}
                                    employeeCanEdit={!branch && (!employeeMode || employeeCanCreate)}
                                    menuAbierto={menuServicioAbierto === svc.id}
                                    onToggleMenu={() => setMenuServicioAbierto(open => open === svc.id ? null : svc.id)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}


function ServiciosManager_ProductosSection(props: any) {
    const transition = useCatalogTransition()
    const opcionesOrden = [
        {id:"az",label:"A-Z"},
        {id:"za",label:"Z-A"},
        {id:"precio-desc",label:"Mayor precio"},
        {id:"precio-asc",label:"Menor precio"},
    ] as const
    const {branch,api,isMobile,accentColor,iconoPlaceholderUrl,iconoFormUrl,iconoVacioUrl,iconoCheck,iconoEditar,iconoEliminar,employeeMode,employeeCanCreate,handleCrearExtra,handleEditarExtra,handleToggleExtra,handleDeleteExtra,initialEditarExtra,extrasActivos,extrasInactivos,mostrarFormExtra,setMostrarFormExtra,editandoExtra,setEditandoExtra,extrasVisibles,extras,errorExtras,formErrorExtra,setFormErrorExtra,guardandoExtra,filtroProductos,setFiltroProductos,ordenProductos,setOrdenProductos,busquedaProducto,setBusquedaProducto}=props
    return (<>
<CatalogToolbar filters={catalogFilters} label="productos" filterValue={filtroProductos} onFilter={setFiltroProductos} sort={ordenProductos} onSort={setOrdenProductos} opcionesOrden={opcionesOrden} search={busquedaProducto} onSearch={setBusquedaProducto} onCreate={!branch && (!employeeMode || employeeCanCreate) && !mostrarFormExtra && !editandoExtra ? () => setMostrarFormExtra(true) : undefined} />
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
                            <motion.div key="create-product" {...transition} style={{ marginBottom: 14 }}>
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
                            </motion.div>
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
                        {!errorExtras && !mostrarFormExtra && extrasVisibles.length === 0 && (
                            <PanelEmptyState>{busquedaProducto || filtroProductos === "pausados" ? "No hay productos que coincidan con este filtro." : "Todavía no hay productos extra."}</PanelEmptyState>
                        )}
                        <AnimatePresence mode="popLayout">
                            {extrasVisibles.map((extra) =>
                                editandoExtra?.id === extra.id ? (
                                    <motion.div
                                        key={extra.id + "-edit"}
                                        {...transition}
                                        style={{ marginBottom: 6 }}
                                    >
                                        <ServiciosManager_ExtraForm
                                    employeeMode={employeeMode}
                                            extraId={extra.id}
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
                </>)
}
function ServiciosManager_PromocionesSection(props: any) {
    const {isMobile,accentColor,employeeMode,puedePromociones,api,servicios,extras,iconoEditar}=props
    return (<>{puedePromociones ? <ServiciosManager_Promociones employeeMode={employeeMode} api={api} servicios={servicios} productos={extras} accentColor={accentColor} isMobile={isMobile} iconoEditar={iconoEditar} /> : <div style={{padding:24,border:"1px solid #e5e7eb",borderRadius:14,...TurnitsLockedStyle}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}><h3 style={{margin:"0 0 8px"}}>Promociones</h3><TurnitsPlanRequirement /></div><p style={{fontSize:13,color:"#64748b"}}>Ofrecé descuentos y combinaciones para tu catálogo.</p><a href="/planes" style={{color:accentColor,fontSize:13}}>Ver planes</a></div>}</>)
}
function ServiciosManager_Promociones({api,servicios,productos,accentColor,isMobile,employeeMode=false,iconoEditar}:{api:string;servicios:any[];productos:any[];accentColor:string;isMobile:boolean;employeeMode?:boolean;iconoEditar?:string}) {
    const transition = useCatalogTransition()
    const branch = useBranchAdmin();
    const hoy = () => new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Argentina/Buenos_Aires"}).format(new Date())
    const initial = () => ({nombre:"",descripcion:"",imagen_url:"",owner_equipo_id:null as string|null,tipo:"combo",items:[] as {tipo:string;id:string;cantidad:number}[],descuento_tipo:"precio_final",valor:"",fecha_inicio:hoy(),fecha_fin:"2099-12-31",dias_semana:null as number[] | null,hora_desde:null as string|null,hora_hasta:null as string|null,activo:true})
    const [form,setForm]=React.useState(initial)
    const [lista,setLista]=React.useState<any[]>([])
    const [diasHabilitados,setDiasHabilitados]=React.useState(false)
    const [loading,setLoading]=React.useState(true)
    const [error,setError]=React.useState("")
    const [busy,setBusy]=React.useState(false)
    const [mostrar,setMostrar]=React.useState(false)
    const [editando,setEditando]=React.useState<string|null>(null)
    const slug=ServiciosManager_getSlug(),token=ServiciosManager_getToken()
    const [revision,setRevision]=React.useState(0)
    React.useEffect(()=>{
        const reload=(event:any)=>{
            if(event.type==="turnits_global_saved" && event.detail?.section!=="promociones") return
            setRevision(value=>value+1)
            setMostrar(false);setEditando(null);setForm(initial());setError("")
        }
        window.addEventListener("turnits_global_saved",reload)
        window.addEventListener("turnits_global_discarded",reload)
        return()=>{window.removeEventListener("turnits_global_saved",reload);window.removeEventListener("turnits_global_discarded",reload)}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[])
    const title=(icon:string,text:string)=><span className="catalog-field-title"><ServiciosManager_FieldIcon name={icon} size={16} color="#566257"/>{text}</span>
    const money=(n:number)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",minimumFractionDigits:0,maximumFractionDigits:2}).format(n)
    const request=async(path:string,method="GET",body?:any)=>{
        const response=await fetch(employeeMode ? `${api}/empleado/${encodeURIComponent(slug)}/promociones${path}` : `${api}/admin/promociones/${encodeURIComponent(slug)}${path}`,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body ? {body:JSON.stringify(body)} : {}),cache:"no-store"})
        const result=await response.json()
        if(!response.ok || !result.success)throw new Error(result.error || "No se pudo completar la operación.")
        return result
    }
    React.useEffect(()=>{let active=true;request("").then(r=>{if(active){setLista(r.promociones);setDiasHabilitados(r.dias_semana_habilitado===true)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[api,slug,token,revision])
    const catalogo=[...servicios.filter(s=>s.activo).map(s=>({...s,tipo:"servicio"})),...productos.filter(p=>p.activo === true || p.activo === "true").map(p=>({...p,tipo:"producto"}))]
    const [equipo,setEquipo]=React.useState<CatalogoProfesional[]>([])
    const [uploadingCover,setUploadingCover]=React.useState(false)
    const [assigned,setAssigned]=React.useState<string[]>([])
    React.useEffect(()=>{
        if (employeeMode || branch || !mostrar) return
        const controller = new AbortController()
        fetch(`${api}/admin/equipo/${encodeURIComponent(slug)}`,{signal:controller.signal,headers:{Authorization:`Bearer ${token}`}})
            .then(async r=>{if(!r.ok) throw new Error(); return r.json()})
            .then(r=>setEquipo((r.equipo || []).filter((p:any)=>p.activo===true || p.activo==="true")))
            .catch(()=>{if(!controller.signal.aborted)setError("No se pudo cargar el equipo.")})
        return ()=>controller.abort()
    },[api,slug,token,employeeMode,branch,mostrar])
    const selected=form.items.map(item=>({...item,source:catalogo.find(c=>c.tipo===item.tipo && c.id===item.id)}))
    const original=selected.reduce((sum,item)=>sum+Number(item.source?.precio || 0)*item.cantidad,0)
    const valor=Number(form.valor)
    const final=Math.round((form.descuento_tipo === "porcentaje" ? original*(1-valor/100) : valor)*100)/100
    const validPrice=Number.isFinite(final)&&valor>0&&final>0&&final<original
    const horasValidas=(!form.hora_desde && !form.hora_hasta) || (!!form.hora_desde && !!form.hora_hasta && form.hora_desde < form.hora_hasta)
    const toggle=(item:any)=>setForm(prev=>({...prev,items:prev.items.some(i=>i.id===item.id&&i.tipo===item.tipo) ? prev.items.filter(i=>!(i.id===item.id&&i.tipo===item.tipo)) : [...prev.items,{tipo:item.tipo,id:item.id,cantidad:1}]}))
    const toggleDay = (id:number) => setForm(prev => {
        const days = prev.dias_semana ?? []
        const next = days.includes(id) ? days.filter(day => day !== id) : [...days, id]
        return {...prev, dias_semana: next.length ? next : null}
    })
    const formRef = React.useRef<HTMLFormElement>(null)
    const originalDraft = React.useRef("")
    const draftKey = (draft:typeof form, people:string[]) => JSON.stringify([draft, [...people].sort()])
    const tipo = form.items.length === 1 && form.items[0].tipo === "servicio" && form.items[0].cantidad === 1 ? "descuento" : "combo"
    const validOffer = !!form.nombre.trim() && form.items.length > 0 && selected.every(i => i.source) && validPrice
        && (tipo === "descuento" || form.items.reduce((sum,i) => sum + i.cantidad, 0) >= 2)
    const readyToSave = validOffer && horasValidas && !uploadingCover && (form.dias_semana === null || diasHabilitados)
        && originalDraft.current !== draftKey(form, assigned)
    // Editar una promoción existente: el borrador va al estado global (barra "Guardar cambios").
    const globalEdit = mostrar && !!editando && !employeeMode && !branch && originalDraft.current !== ""
    const guardar=async(e:React.FormEvent)=>{
        e.preventDefault();setError("")
        if(globalEdit) return
        if(uploadingCover || busy) return
        if(form.dias_semana !== null && !diasHabilitados) {setError("La programación por días todavía no está disponible. Volvé a cargar las promociones.");return}
        if(!horasValidas) {setError("Revisá la hora de inicio y fin de la promoción.");return}
        if (!validOffer) {setError("Revisá los elementos y el descuento de la promoción.");return}
        setBusy(true)
        try {
            const result=await request(editando ? `/${editando}` : "",editando ? "PUT" : "POST",{...form,tipo,valor,dias_semana:form.dias_semana?.length === PROMO_DAYS.length ? null : form.dias_semana})
            const promo=result.promocion
            setEditando(promo.id)
            setLista(prev=>[promo,...prev.filter(p=>p.id!==promo.id)])
            if (!employeeMode && !branch && !promo.owner_equipo_id) {
                for (const person of equipo) {
                    const want=assigned.includes(person.id) && isEligible(person.id)
                    const had=(promo.profesionales || []).some((p:any)=>p.id===person.id)
                    if (want===had) continue
                    const path=`${api}/admin/equipo/${person.id}/promociones`
                    const response=await fetch(want ? path : `${path}/${promo.id}`,{
                        method:want ? "POST" : "DELETE",
                        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
                        body:JSON.stringify({slug,promocion_id:promo.id})
                    })
                    if(!response.ok) throw new Error((await response.json()).error || "Revisá los profesionales y volvé a guardar.")
                }
                if(equipo.length) setLista(prev=>prev.map(p=>p.id===promo.id?{...p,profesionales:equipo.filter(person=>assigned.includes(person.id) && isEligible(person.id))}:p))
            }
            setMostrar(false);setEditando(null);setForm(initial())
        }catch(e:any){setError(e.message)}finally{setBusy(false)}
    }
    const editar=(promo:any)=>{
        const people = (promo.profesionales || []).map((p:any)=>p.id)
        const draft = {...promo,descripcion:promo.descripcion || "",imagen_url:promo.imagen_url || "",dias_semana:promo.dias_semana?.length ? promo.dias_semana : null,hora_desde:promo.hora_desde ? String(promo.hora_desde).slice(0,5) : null,hora_hasta:promo.hora_hasta ? String(promo.hora_hasta).slice(0,5) : null,valor:String(promo.valor),items:promo.items.map((i:any)=>({tipo:i.tipo,id:i.id,cantidad:i.cantidad}))}
        originalDraft.current = draftKey(draft,people)
        const saved = !employeeMode && !branch ? TurnitsGlobalSaveManager_get()?.getPending("promociones")?.[promo.id] : undefined
        setAssigned(saved?.assigned || people); setForm(saved?.form || draft); setEditando(promo.id); setMostrar(true); setError("")
    }
    const promoActiva=(promo:any)=>promo.activo===true && hoy()>=promo.fecha_inicio && hoy()<=promo.fecha_fin
    const cambiarEstado=async(promo:any)=>{setBusy(true);setError("");try{const result=await request(`/${promo.id}/estado`,"PUT",{activo:!promoActiva(promo)});setLista(prev=>prev.map(p=>p.id===promo.id ? result.promocion : p));if(editando===promo.id)setForm(prev=>({...prev,activo:result.promocion.activo}));ServiciosManager_updatePending("promociones",promo.id,d=>({...d,form:{...d.form,activo:result.promocion.activo},payload:{...d.payload,activo:result.promocion.activo}}))}catch(e:any){setError(e.message)}finally{setBusy(false)}}
    const eliminar=async(id:string)=>{if(!window.confirm("¿Eliminar esta promoción?"))return;setBusy(true);setError("");try{await request(`/${id}`,"DELETE");setLista(prev=>prev.filter(p=>p.id!==id));ServiciosManager_updatePending("promociones",id,null)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
    const photo = (item:any) => item?.imagen_url || item?.imagen || ServiciosManager_parseDesc(item?.descripcion || "").imagen
    const lookup = (item:any) => (item.tipo === "servicio" ? servicios : productos).find(s => s.id === item.id)
    const fallbackCover = (items:any[]) => items.map(lookup).map(photo).find(Boolean) || ""
    const close = () => { setMostrar(false); setEditando(null); setError("") }
    const openNew = () => { originalDraft.current = ""; setUploadingCover(false); setForm(initial()); setAssigned([]); setEditando(null); setMostrar(true); setError("") }
    const isEligible = (id:string) => selected.every(i => i.tipo !== "servicio" || i.source?.profesionales?.some((p:any) => p.id === id))
    React.useEffect(() => {
        if (!globalEdit || !editando) return
        const manager = TurnitsGlobalSaveManager_get()
        if (!manager) return
        manager.configure(api)
        const pending = { ...manager.getPending("promociones") }
        if (draftKey(form, assigned) === originalDraft.current) delete pending[editando]
        else pending[editando] = {
            form, assigned,
            payload: {...form, tipo, valor, dias_semana: form.dias_semana?.length === PROMO_DAYS.length ? null : form.dias_semana},
            profesionalesIds: assigned.filter(isEligible),
            equipoIds: equipo.map(p => p.id),
            valid: validOffer && horasValidas && (form.dias_semana === null || diasHabilitados),
        }
        if (Object.keys(pending).length) manager.markDirty("promociones", pending)
        else manager.clear("promociones")
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalEdit, editando, draftKey(form, assigned), validOffer, diasHabilitados, equipo.length, api])
    const [filtroPromo,setFiltroPromo] = React.useState("todos")
    const [ordenPromo,setOrdenPromo] = React.useState("actual")
    const [busquedaPromo,setBusquedaPromo] = React.useState("")
    const [menuId,setMenuId] = React.useState<string|null>(null)
    const anchor = React.useRef<HTMLButtonElement>(null)
    React.useEffect(() => {
        if (!menuId) return
        const outside = (e:PointerEvent) => { if (!(e.target as Element).closest(".svc-row-menu,.promo-menu-trigger")) setMenuId(null) }
        const escape = (e:KeyboardEvent) => { if(e.key === "Escape") {anchor.current?.focus();setMenuId(null)} }
        document.addEventListener("pointerdown",outside)
        document.addEventListener("keydown",escape)
        return () => {document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape)}
    },[menuId])
    const opcionesOrden = [{id:"actual",label:"Orden actual"},{id:"az",label:"A-Z"},{id:"precio",label:"Menor precio"}]
    const visibles = lista.filter(p => (filtroPromo !== "pausados" || !promoActiva(p)) && p.nombre.toLocaleLowerCase().includes(busquedaPromo.trim().toLocaleLowerCase()))
    if (ordenPromo === "az") visibles.sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"))
    if (ordenPromo === "precio") visibles.sort((a,b)=>Number(a.precio_final)-Number(b.precio_final))
    return <>
        {!mostrar && <CatalogToolbar filters={catalogFilters} label="promociones" filterValue={filtroPromo} onFilter={setFiltroPromo} sort={ordenPromo} onSort={setOrdenPromo} opcionesOrden={opcionesOrden} search={busquedaPromo} onSearch={setBusquedaPromo} onCreate={!branch ? openNew : undefined} />}
        <section className="promotions">
        {error && <p role="alert" className="promo-error">{error}</p>}
        <AnimatePresence mode="wait" initial={false}>
        {mostrar ? <motion.form ref={formRef} key="editor" {...transition} className="promo-editor" onSubmit={guardar}>
            <BackButton floating onClick={close} disabled={busy || uploadingCover}/>
            <fieldset disabled={busy}>
                <label>{title("tag","Nombre de la promoción")}<small className="catalog-hint">Este nombre aparece en tu agenda pública.</small><input required placeholder="Ej. Corte + barba" maxLength={100} value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label>
                <div className="promo-intro">
                    <div>{title("image","Imagen de la promoción")}<small className="catalog-hint">Subí una portada o usá la foto de un elemento incluido.</small><ServiciosManager_ImageUploader size={450} onUploadingChange={setUploadingCover} value={form.imagen_url || fallbackCover(form.items)} onChange={imagen_url=>setForm(prev=>({...prev,imagen_url}))} apiUrl={api} accentColor={accentColor} uploadPath={employeeMode ? `/empleado/${encodeURIComponent(slug)}/extras/upload-imagen` : undefined}/></div>
                    <div className="promo-details"><label>{title("align-left","Descripción")}<small className="catalog-hint">Explicá qué incluye la oferta y sus condiciones.</small><textarea aria-label="Descripción" placeholder="Contá qué incluye y cuándo se puede usar." maxLength={2000} value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></label>
                        <div className="promo-prices"><div>{title("dollar","Precio original")}<small className="catalog-hint">Suma de las unidades elegidas.</small><output>{money(original)}</output></div>
                            <PromotionDiscountArrow original={original} final={final} />
                            <label>{form.descuento_tipo==="porcentaje" ? title("percent","Descuento (%)") : title("dollar","Precio promo")}<small className="catalog-hint">{form.descuento_tipo === "porcentaje" ? "Porcentaje que se descuenta del precio original." : "Total que paga el cliente con la promoción."}</small><span className="promo-money-input">{form.descuento_tipo !== "porcentaje" && <span aria-hidden="true">$</span>}<input required type="number" min="0.01" step="0.01" value={form.valor} placeholder={form.descuento_tipo === "porcentaje" ? "Ej. 15" : "Ej. 30000"} onChange={e=>setForm({...form,valor:e.target.value})}/></span></label></div>
                        {form.descuento_tipo==="porcentaje" && <output>Precio promo {money(final)}</output>}
                        {!branch && !employeeMode && !form.owner_equipo_id && equipo.length>0 && <div>{title("user-check","Profesionales que lo ofrecen")}<small className="catalog-hint">Elegí quiénes pueden realizar todos los servicios incluidos.</small><div className="promo-people">{equipo.map(person=>{
                            const active=assigned.includes(person.id) && isEligible(person.id)
                            const name=[person.nombre,person.apellido].filter(Boolean).join(" ")
                            return <button type="button" key={person.id} aria-label={name} title={isEligible(person.id)?name:`${name} debe ofrecer todos los servicios elegidos`} aria-pressed={active} disabled={!isEligible(person.id)} style={{background:person.color || "#704dad"}} onClick={()=>setAssigned(ids=>active?ids.filter(id=>id!==person.id):[...ids,person.id])}>{person.foto_url?<img src={person.foto_url} alt=""/>:name.charAt(0)}{active && <small><img src="/assets/panel-nav/akar-icons_check.svg" alt="" width="12" height="12" /></small>}</button>
                        })}</div></div>}
                    </div>
                </div>
                {["servicio","producto"].map(tipo=><section className="promo-items" key={tipo}><h3 className="catalog-field-title"><ServiciosManager_SeccionIcon tipo={tipo==="servicio"?"servicios":"extras"} size={16}/>{tipo==="servicio"?"Servicios":"Productos"} que incluye la promoción</h3><small className="catalog-hint">Seleccioná los elementos y ajustá sus cantidades. Un combo requiere al menos dos unidades.</small>
                    {catalogo.filter(i=>i.tipo===tipo).map(item=>{
                        const entry=form.items.find(i=>i.id===item.id && i.tipo===tipo)
                        const quantity=(delta:number)=>setForm(prev=>({...prev,items:prev.items.map(i=>i.id===item.id && i.tipo===tipo?{...i,cantidad:i.cantidad+delta}:i)}))
                        return <div className="promo-line" key={item.id} data-selected={!!entry}>
                            <button className="promo-choice" type="button" aria-pressed={!!entry} onClick={()=>toggle(item)}><span className="promo-check">{entry && <img src="/assets/panel-nav/akar-icons_check.svg" alt="" width="12" height="12" />}</span>
                                {photo(item)?<img src={photo(item)} alt=""/>:<span className="promo-thumb"><ServiciosManager_SeccionIcon tipo={tipo==="servicio"?"servicios":"extras"}/></span>}
                                <span><strong>{item.nombre}</strong><small>{ServiciosManager_parseDesc(item.descripcion || "").descripcion || "Sin descripción"}</small></span></button>
                            <div className="promo-count"><b>{money(Number(item.precio))}</b>{entry && <div><button aria-label={`Aumentar cantidad de ${item.nombre}`} type="button" disabled={entry.cantidad>=99} onClick={()=>quantity(1)}>+</button> {entry.cantidad} <button aria-label={`Reducir cantidad de ${item.nombre}`} type="button" disabled={entry.cantidad<=1} onClick={()=>quantity(-1)}>−</button></div>}</div>
                        </div>
                    })}
                    {!catalogo.some(i=>i.tipo===tipo) && <p>No hay {tipo==="servicio"?"servicios":"productos"} activos.</p>}
                </section>)}
                {diasHabilitados && <section className="promo-options" aria-labelledby="promo-valid-days">
                    <h3 id="promo-valid-days" className="catalog-field-title"><ServiciosManager_FieldIcon name="calendar" size={16} color="#566257"/>Días de vigencia</h3>
                    <small className="catalog-hint">Opcional. Si no marcás ningún día, la promoción se ofrece todos los días.</small>
                    <div className="promo-option-list">
                        {PROMO_DAYS.map(day => <button key={day.id} type="button"
                            aria-pressed={form.dias_semana?.includes(day.id) ?? false}
                            onClick={() => toggleDay(day.id)}>
                            {["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][day.id]}
                        </button>)}
                    </div>
                </section>}
                <section className="promo-options" aria-labelledby="promo-valid-hours">
                    <h3 id="promo-valid-hours" className="catalog-field-title"><ServiciosManager_FieldIcon name="calendar" size={16} color="#566257"/>Horario de vigencia</h3>
                    <small className="catalog-hint">Opcional. Se aplica a los días elegidos; el servicio debe entrar completo en la franja.</small>
                    <label className="promo-hours-toggle"><input type="checkbox" checked={form.hora_desde !== null} onChange={e=>setForm(prev=>({...prev,hora_desde:e.target.checked?"15:00":null,hora_hasta:e.target.checked?"16:30":null}))}/>Limitar a una franja horaria</label>
                    {form.hora_desde !== null && <div className="promo-hours-fields"><label>Desde<input type="time" value={form.hora_desde} onChange={e=>setForm(prev=>({...prev,hora_desde:e.target.value}))}/></label><label>Hasta<input type="time" value={form.hora_hasta || ""} onChange={e=>setForm(prev=>({...prev,hora_hasta:e.target.value}))}/></label></div>}
                </section>
                <section className="promo-options" aria-labelledby="promo-discount-mode">
                    <h3 id="promo-discount-mode" className="catalog-field-title"><ServiciosManager_FieldIcon name="percent" size={16} color="#566257"/>Reducción del precio</h3>
                    <small className="catalog-hint">Elegí si vas a ingresar el precio final en pesos o el porcentaje de descuento sobre el precio original.</small>
                    <div className="promo-option-list">
                        {[["precio_final","Precio establecido"],["porcentaje","Porcentaje %"]].map(([mode,label]) =>
                            <button type="button" key={mode} aria-pressed={form.descuento_tipo === mode}
                                onClick={() => setForm(prev => prev.descuento_tipo === mode ? prev : {...prev, descuento_tipo:mode, valor:""})}>
                                {label}
                            </button>
                        )}
                    </div>
                </section>
                {readyToSave && !globalEdit && <CatalogSaveState message={editando ? "Cambios en la promoción" : "Promoción lista para guardar"} label="Guardar promoción" saving={busy} onSave={()=>formRef.current?.requestSubmit()} />}
            </fieldset>
        </motion.form> : loading ? <InlineLoading label="Cargando promociones…"/> : !visibles.length ? (!error && <PanelEmptyState>{lista.length ? "No hay promociones que coincidan." : "Todavía no hay promociones."}</PanelEmptyState>) : <motion.div key="list" {...transition} className="promo-grid">{visibles.map(p=>{
            const active=promoActiva(p),cover=p.imagen_url || fallbackCover(p.items)
            const repeated=p.items.length===1 && p.items[0].cantidad>1
            return <article className="promo-card" key={p.id}><div className="promo-cover">
                {cover ? <img src={cover} alt={p.nombre}/> : <ServiciosManager_SeccionIcon tipo="promociones" size={48}/>}
                <div className="promo-badges"><b>{p.tipo==="combo" && !repeated?"Combo":"Descuento"}</b>
                    {p.dias_semana!=null && <span>Solo los {promoDaysLabel(p.dias_semana)}</span>}
                    {p.hora_desde && p.hora_hasta && <span>De {String(p.hora_desde).slice(0,5)} a {String(p.hora_hasta).slice(0,5)}</span>}
                    <div>{p.items.filter((i:any)=>i.tipo==="producto" && photo(lookup(i))).map((i:any)=><img key={i.id} src={photo(lookup(i))} alt={i.nombre}/>)}</div>
                </div>{repeated && <b className="promo-multiple">x{p.items[0].cantidad}</b>}
                </div><div className="promo-foot"><div className="promo-heading"><strong>{p.nombre}</strong><div className="promo-cost">{money(Number(p.precio_final))} <del>{money(Number(p.precio_original))}</del></div></div>
                    <span className="promo-status" data-active={active}>● {active?"Activa":"Pausada"}</span>
                    {!branch && <div className="promo-actions"><button className="svc-edit-button" disabled={busy} onClick={()=>editar(p)}>{iconoEditar?<img src={iconoEditar} alt=""/>:<span aria-hidden="true">✎</span>}Editar</button><button type="button" className="promo-menu-trigger" ref={menuId===p.id ? anchor : undefined} aria-label={`Opciones de ${p.nombre}`} aria-expanded={menuId===p.id} onClick={()=>setMenuId(menuId===p.id ? null : p.id)}>•••</button>{menuId===p.id && <ServiciosManager_RowMenu anchor={anchor}><button disabled={busy} onClick={()=>{setMenuId(null);cambiarEstado(p)}}>{active?"Pausar":"Activar"}</button><button disabled={busy} className="is-danger" onClick={()=>{setMenuId(null);eliminar(p.id)}}>Eliminar</button></ServiciosManager_RowMenu>}</div>}
                </div></article>
        })}</motion.div>}
        </AnimatePresence>
        </section>
    </>
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
                    Crear <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">+</span>
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

function MisServiciosPanel(props: any) {
    return <ServiciosManager {...props} initialView="servicios" />
}
function ProductosPanel(props: any) {
    return <ServiciosManager {...props} initialView="extras" />
}
function PromocionesPanel(props: any) {
    return <ServiciosManager {...props} initialView="promociones" />
}

export { Turnits_ImageAdjustDialog, ServiciosManager_ImageUploader, ServiciosManager_SkeletonLista, ServiciosManager_FormSection, ServiciosManager_FieldIcon, ServiciosManager_Field, ServiciosManager_AutoTextarea, ServiciosManager_Input, ServiciosManager_PrecioInput, ServiciosManager_ExtrasVinculados, ServiciosManager_ServicioForm, ServiciosManager_ExtraForm, ServiciosManager_ServicioCard, ServiciosManager_Creador, ServiciosManager_ProfesionalAvatar, ServiciosManager_Profesionales, ServiciosManager_ExtraCard, ServiciosManager, MisServiciosPanel, ProductosPanel, PromocionesPanel, ServiciosManager_Promociones, ServiciosManager_SeccionIcon, ServiciosManager_CanvasPreview }
