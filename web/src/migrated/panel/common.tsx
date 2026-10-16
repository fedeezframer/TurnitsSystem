import { appConfig } from "../../config"
import { DEFAULT_APPEARANCE, CARD_SHAPES, ICON_SHAPES } from "../../shared/appearance.js"
import type { BusinessAppearance } from "../../shared/appearance.js"
import { perfilDraft, perfilPayload } from "../../shared/profile-draft"
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


async function TurnitsResolveAccountPlan(api: string, slug: string, token: string, data: any, employeeMode = false): Promise<string> {
    const response = await fetch(api.replace(/\/$/, "") + (employeeMode ? "/empleado/" + encodeURIComponent(slug) + "/config" : "/settings/" + encodeURIComponent(slug)), {
        headers: { Authorization: "Bearer " + token }, cache: "no-store",
    })
    if (response.status === 401) throw new Error("Sesión expirada. Volvé a iniciar sesión.")
    const settings = await response.json().catch(() => ({}))
    const plan = response.ok ? settings?.settings?.plan : undefined
    const normalized = String(plan || data?.plan || data?.settings?.plan || data?.usuario?.plan || "").trim().toLowerCase()
    if (!["gratis", "basico", "premium"].includes(normalized)) {
        throw new Error(settings.error || "No se pudo verificar tu plan. Volvé a cargar el panel.")
    }
    return normalized
}

const TurnitsLockedStyle: React.CSSProperties = { opacity: 0.55, filter: "grayscale(1)" }

function safeLocalStorage(key: string): string | null {
    try {
        if (typeof window === "undefined") return null
        return window.localStorage.getItem(key)
    } catch (e) {
        console.warn(`[safeLocalStorage] no se pudo leer "${key}":`, e)
        return null
    }
}

function safeLocalStorageSet(key: string, value: string): void {
    try {
        if (typeof window === "undefined") return
        window.localStorage.setItem(key, value)
    } catch (e) {
        console.warn(`[safeLocalStorage] no se pudo guardar "${key}":`, e)
    }
}

const Turnits_useIsoLayoutEffect =
    typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

function Turnits_useElementWidth(
    ref: React.RefObject<HTMLElement>,
    fallback = 600
): number {
    // OJO: el valor inicial tiene que ser IGUAL en el servidor y en el
    // navegador (Framer renderiza en el servidor y después "hidrata").
    // Si acá se leyera window.innerWidth, el servidor dibujaría el layout de
    // escritorio y el celular el mobile → desajuste de hidratación y DOM
    // mezclado. Por eso arranca con `fallback` y se corrige en el layout
    // effect, que corre ANTES de que el navegador pinte (no hay parpadeo).
    const [width, setWidth] = React.useState<number>(fallback)
    const elRef = React.useRef<HTMLElement | null>(null)
    const roRef = React.useRef<ResizeObserver | null>(null)
    // Sin array de dependencias: corre en cada render y solo actúa
    // cuando el elemento observado cambió (apareció, se reemplazó o se fue).
    Turnits_useIsoLayoutEffect(() => {
        const el = ref.current
        if (el === elRef.current) return
        roRef.current?.disconnect()
        roRef.current = null
        elRef.current = el
        if (!el) return
        const w = el.getBoundingClientRect().width
        if (w) setWidth(w)
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(([entry]) => {
            const nw = entry.contentRect.width
            if (nw) setWidth(nw)
        })
        ro.observe(el)
        roRef.current = ro
    })
    React.useEffect(() => () => roRef.current?.disconnect(), [])
    return width
}

const PANEL_BUILD_VERSION = "2026.10.12-reduccion-planes-v5"

const AUTO_UPDATE_GUARD_KEY = "turnits_autoupdate_guard_v1"

const AUTO_UPDATE_GUARD_MS = 6 * 60 * 60 * 1000

const AUTO_UPDATE_CACHE_PARAM = "_r"

type AutoUpdate_Motivo = "arranque" | "periodico" | "regreso"

type AutoUpdate_Resultado = {
    hayUpdate: boolean
    target: string
    via: "html" | "servidor" | ""
}

function AutoUpdate_hash(str: string): string {
    let h = 5381
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0
    }
    return (h >>> 0).toString(36)
}

async function AutoUpdate_fetch(
    url: string,
    init: RequestInit = {},
    ms = 8000
): Promise<Response> {
    const ctrl =
        typeof AbortController !== "undefined" ? new AbortController() : null
    const timer = ctrl ? window.setTimeout(() => ctrl.abort(), ms) : 0
    try {
        return await fetch(url, ctrl ? { ...init, signal: ctrl.signal } : init)
    } finally {
        if (timer) window.clearTimeout(timer)
    }
}

function AutoUpdate_scriptsDeHtml(html: string): string[] {
    const out: string[] = []
    const re = /<script\b[^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(html))) {
        const tag = m[0]
        if (!/\btype\s*=\s*["']?module["']?/i.test(tag)) continue
        const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
        if (!src) continue
        try {
            out.push(
                new URL(src[1].replace(/&amp;/g, "&"), window.location.href)
                    .href
            )
        } catch {}
    }
    return out
}

function AutoUpdate_scriptsVivos(): Set<string> {
    const set = new Set<string>()
    document.querySelectorAll('script[type="module"][src]').forEach((s) => {
        const src = (s as HTMLScriptElement).src
        if (src) set.add(src)
    })
    return set
}

async function AutoUpdate_detectar(
    baseUrl: string
): Promise<AutoUpdate_Resultado> {
    // 1) Huella de scripts (sin mantenimiento).
    try {
        const url = new URL(window.location.href)
        url.searchParams.delete(AUTO_UPDATE_CACHE_PARAM)
        url.hash = ""
        const res = await AutoUpdate_fetch(url.toString(), {
            cache: "no-store",
            credentials: "same-origin",
            headers: { Accept: "text/html" },
        })
        const ct = res.headers.get("content-type") || ""
        if (res.ok && ct.includes("text/html")) {
            const nuevos = AutoUpdate_scriptsDeHtml(await res.text())
            const vivos = AutoUpdate_scriptsVivos()
            // Si no pudimos leer scripts de alguno de los dos lados, no
            // opinamos (mejor no detectar que dar un falso positivo).
            if (nuevos.length > 0 && vivos.size > 0) {
                const faltan = nuevos.filter((u) => !vivos.has(u)).sort()
                if (faltan.length > 0) {
                    return {
                        hayUpdate: true,
                        target: "h:" + AutoUpdate_hash(faltan.join("|")),
                        via: "html",
                    }
                }
            }
        }
    } catch {}

    // 2) Versión declarada por el servidor (opcional).
    try {
        const res = await AutoUpdate_fetch(
            `${String(baseUrl || "").replace(/\/+$/, "")}/panel-version`,
            { cache: "no-store" }
        )
        if (res.ok) {
            const data = await res.json()
            const v =
                typeof data?.version === "string" ? data.version.trim() : ""
            if (v && v !== PANEL_BUILD_VERSION) {
                return { hayUpdate: true, target: "v:" + v, via: "servidor" }
            }
        }
    } catch {}

    return { hayUpdate: false, target: "", via: "" }
}

function AutoUpdate_esMomentoSeguro(): boolean {
    try {
        const m = (window as any).__turnitsGlobalSaveManager
        if (m?.hasDirty?.() || m?.isSaving?.()) return false
        if ((window as any).__turnitsAgendaModalAbierto) return false
        const el = document.activeElement as HTMLElement | null
        if (el) {
            const tag = el.tagName
            if (
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT" ||
                el.isContentEditable
            )
                return false
        }
    } catch {}
    return true
}

function AutoUpdate_yaIntentado(target: string): boolean {
    try {
        const raw = safeLocalStorage(AUTO_UPDATE_GUARD_KEY)
        if (!raw) return false
        const g = JSON.parse(raw)
        return (
            g?.target === target &&
            Date.now() - Number(g?.at || 0) < AUTO_UPDATE_GUARD_MS
        )
    } catch {
        return false
    }
}

function AutoUpdate_recargarLimpio() {
    const ir = () => {
        try {
            const url = new URL(window.location.href)
            url.searchParams.set(AUTO_UPDATE_CACHE_PARAM, String(Date.now()))
            window.location.replace(url.toString())
        } catch {
            window.location.reload()
        }
    }
    const limpiar = async () => {
        try {
            if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations()
                await Promise.all(regs.map((r) => r.update().catch(() => {})))
            }
            if ("caches" in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map((k) => caches.delete(k)))
            }
        } catch {}
    }
    // Tope de 1.5 s: si algo se cuelga (sin red, SW trabado) igual recargamos.
    Promise.race([
        limpiar(),
        new Promise<void>((r) => window.setTimeout(r, 1500)),
    ]).then(ir, ir)
}

function AutoUpdate_ejecutar(target: string | null) {
    if (target) {
        safeLocalStorageSet(
            AUTO_UPDATE_GUARD_KEY,
            JSON.stringify({ target, at: Date.now() })
        )
    }
    AutoUpdate_recargarLimpio()
}

function AutoUpdate_limpiarParam() {
    try {
        const url = new URL(window.location.href)
        if (!url.searchParams.has(AUTO_UPDATE_CACHE_PARAM)) return
        url.searchParams.delete(AUTO_UPDATE_CACHE_PARAM)
        window.history.replaceState(
            window.history.state,
            "",
            url.pathname + url.search + url.hash
        )
    } catch {}
}

function usePanelAutoUpdate({
    baseUrl,
    activo,
    modo,
    minutos,
}: {
    baseUrl: string
    activo: boolean
    modo: "automatico" | "aviso"
    minutos: number
}) {
    const [pendiente, setPendiente] = React.useState<string | null>(null)
    const pendienteRef = React.useRef<string | null>(null)
    const descartadoRef = React.useRef<string | null>(null)

    React.useEffect(() => {
        if (typeof window === "undefined") return
        AutoUpdate_limpiarParam()
        if (!activo || false) return

        let cancelado = false
        let enCurso = false
        let ultimo = 0

        const chequear = async (motivo: AutoUpdate_Motivo) => {
            if (enCurso) return
            // Evita ráfagas (ej. visibilitychange + pageshow + online juntos).
            if (Date.now() - ultimo < 30_000) return
            enCurso = true
            ultimo = Date.now()
            try {
                const r = await AutoUpdate_detectar(baseUrl)
                if (cancelado) return
                if (!r.hayUpdate) {
                    pendienteRef.current = null
                    setPendiente(null)
                    return
                }
                // Ya lo intentamos hace poco y sigue igual: no insistir.
                if (AutoUpdate_yaIntentado(r.target)) return

                console.info(
                    `[AutoUpdate] Versión nueva detectada (${r.via}). Motivo del chequeo: ${motivo}.`
                )
                const puedeSola =
                    modo === "automatico" && AutoUpdate_esMomentoSeguro()
                if (puedeSola) {
                    AutoUpdate_ejecutar(r.target)
                    return
                }
                pendienteRef.current = r.target
                if (descartadoRef.current !== r.target) setPendiente(r.target)
            } finally {
                enCurso = false
            }
        }

        const tArranque = window.setTimeout(() => chequear("arranque"), 4000)
        const iv = window.setInterval(
            () => {
                if (!document.hidden) chequear("periodico")
            },
            Math.max(1, Number(minutos) || 5) * 60_000
        )
        const onVisible = () => {
            if (!document.hidden) chequear("regreso")
        }
        const onPageShow = (e: any) => {
            if (e?.persisted) chequear("regreso")
        }
        const onOnline = () => chequear("regreso")

        document.addEventListener("visibilitychange", onVisible)
        window.addEventListener("pageshow", onPageShow)
        window.addEventListener("online", onOnline)
        ;(window as any).__turnitsAutoUpdate = {
            version: PANEL_BUILD_VERSION,
            detectar: async () => {
                const r = await AutoUpdate_detectar(baseUrl)
                console.info("[AutoUpdate] detectar():", r)
                return r
            },
        }

        return () => {
            cancelado = true
            window.clearTimeout(tArranque)
            window.clearInterval(iv)
            document.removeEventListener("visibilitychange", onVisible)
            window.removeEventListener("pageshow", onPageShow)
            window.removeEventListener("online", onOnline)
        }
    }, [baseUrl, activo, modo, minutos])

    return {
        pendiente,
        aplicar: () => AutoUpdate_ejecutar(pendienteRef.current),
        descartar: () => {
            descartadoRef.current = pendienteRef.current
            setPendiente(null)
        },
    }
}

type TurnitsGlobalSaveSection = "horarios" | "excepciones" | "pagos" | "tema" | "perfil"

type TurnitsGlobalPending = Record<string, any>

const TURNITS_GLOBAL_PENDING_KEY = "turnits_global_pending_v3"

function TurnitsGlobalSave_key(): string {
    let slug = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) slug = decodeURIComponent(m[1])
        if (!slug)
            slug = new URLSearchParams(window.location.search).get("u") || ""
    } catch {}
    slug = (slug || safeLocalStorage("user_slug") || "").toLowerCase().trim()
    const token =
        ["access_token", "user_token", "token", "auth_token", "turnits_token"]
            .map(safeLocalStorage)
            .find(Boolean) || ""
    const claims = token ? GuardaSesion_leerJwt(token) : null
    const identidad =
        claims?.rol === "empleado"
            ? `empleado:${claims.equipoId || "sin-id"}`
            : "owner"
    return `${TURNITS_GLOBAL_PENDING_KEY}:${slug}:${identidad}`
}

const TURNITS_PAGOS_CAMPOS = [
    "metodo_pago",
    "porcentaje_sena",
    "acepta_transferencia",
    "acepta_efectivo",
    "datos_bancarios",
]

function TurnitsGlobalSave_pagosDiff(candidate: any, base: any) {
    const out: Record<string, any> = {}
    TURNITS_PAGOS_CAMPOS.forEach((k) => {
        const v = candidate?.[k]
        if (v === undefined) return
        if (TurnitsGlobalSave_stable(v) !== TurnitsGlobalSave_stable(base?.[k]))
            out[k] = v
    })
    return out
}

function TurnitsGlobalSave_safeRead(): TurnitsGlobalPending {
    try {
        if (typeof window === "undefined") return {}
        const raw = window.sessionStorage.getItem(TurnitsGlobalSave_key())
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

function TurnitsGlobalSave_safeWrite(value: TurnitsGlobalPending) {
    try {
        if (typeof window === "undefined") return
        window.sessionStorage.setItem(
            TurnitsGlobalSave_key(),
            JSON.stringify(value)
        )
    } catch {}
}

function TurnitsGlobalSave_stable(value: any): string {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value)
    if (Array.isArray(value))
        return `[${value.map(TurnitsGlobalSave_stable).join(",")}]`
    return `{${Object.keys(value)
        .sort()
        .map(
            (k) => `${JSON.stringify(k)}:${TurnitsGlobalSave_stable(value[k])}`
        )
        .join(",")}}`
}

function TurnitsGlobalSave_partialEqual(data: any, baseline: any): boolean {
    if (data === undefined) return true
    if (data === null || typeof data !== "object")
        return (
            TurnitsGlobalSave_stable(data) ===
            TurnitsGlobalSave_stable(baseline)
        )
    if (baseline === null || typeof baseline !== "object") return false
    if (Array.isArray(data))
        return (
            Array.isArray(baseline) &&
            TurnitsGlobalSave_stable(data) ===
                TurnitsGlobalSave_stable(baseline)
        )
    return Object.keys(data).every((key) =>
        TurnitsGlobalSave_partialEqual(data[key], baseline[key])
    )
}

function TurnitsGlobalSave_emit(edited = false) {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("turnits_global_dirty_changed", { detail: { edited } }))
}

function TurnitsGlobalSaveManager_get() {
    if (typeof window === "undefined") return null
    const w = window as any
    if (!w.__turnitsGlobalSaveManager) {
        let pending: TurnitsGlobalPending = TurnitsGlobalSave_safeRead()
        let baseline: TurnitsGlobalPending = {}
        let baseUrl = appConfig.apiUrl
        let saving = false
        let inFlight: TurnitsGlobalPending = {}
        const blockers: Record<string, string> = {}

        const getSlug = () => {
            let fromUrl = ""
            try {
                const m = (window.location.pathname || "").match(
                    /\/panel(?:-test)?\/([^\/?#]+)/i
                )
                if (m && m[1]) fromUrl = decodeURIComponent(m[1])
            } catch {}
            if (!fromUrl)
                fromUrl =
                    new URLSearchParams(window.location.search).get("u") || ""
            return (
                fromUrl.toLowerCase().trim() ||
                safeLocalStorage("user_slug") ||
                ""
            )
        }
        const getToken = () =>
            safeLocalStorage("access_token") ||
            safeLocalStorage("user_token") ||
            safeLocalStorage("token") ||
            ""

        const api = () => baseUrl.replace(/\/+$/, "")

        w.__turnitsGlobalSaveManager = {
            configure(nextBaseUrl?: string) {
                if (nextBaseUrl) baseUrl = nextBaseUrl
            },
            isSaving() {
                return saving
            },
            setBlocker(section: TurnitsGlobalSaveSection, message: string) {
                if (message) blockers[section] = message
                else delete blockers[section]
                TurnitsGlobalSave_emit()
            },
            getBlocker() {
                return Object.values(blockers)[0] || ""
            },
            hasDirty() {
                return Object.keys(pending).length > 0
            },
            isDirty(section: TurnitsGlobalSaveSection) {
                return pending[section] !== undefined
            },
            getPending(section: TurnitsGlobalSaveSection) {
                return pending[section] ?? null
            },
            clearPendingFields(
                section: TurnitsGlobalSaveSection,
                fields: string[]
            ) {
                if (section !== "pagos" || !pending.pagos) return
                const pagos = { ...pending.pagos }
                fields.forEach((field) => delete pagos[field])
                const next = { ...pending }
                if (Object.keys(pagos).length) next.pagos = pagos
                else delete next.pagos
                pending = next
                TurnitsGlobalSave_safeWrite(pending)
                TurnitsGlobalSave_emit()
            },
            setBaseline(section: TurnitsGlobalSaveSection, data: any) {
                // pagos lo informan DOS componentes (cobro y métodos): se
                // fusionan en vez de pisarse entre sí.
                baseline[section] =
                    section === "pagos"
                        ? { ...(baseline[section] || {}), ...data }
                        : data
                // Limpia cambios viejos de sessionStorage si ya coinciden con
                // lo que realmente está guardado en Supabase.
                if (pending[section] !== undefined && inFlight[section] === undefined) {
                    if (section === "pagos") {
                        const diff = TurnitsGlobalSave_pagosDiff(
                            pending.pagos,
                            baseline.pagos
                        )
                        const next = { ...pending }
                        if (Object.keys(diff).length) next.pagos = diff
                        else delete next.pagos
                        pending = next
                        TurnitsGlobalSave_safeWrite(pending)
                    } else if (
                        TurnitsGlobalSave_partialEqual(pending[section], data)
                    ) {
                        const next = { ...pending }
                        delete next[section]
                        pending = next
                        TurnitsGlobalSave_safeWrite(pending)
                    }
                }
                TurnitsGlobalSave_emit()
            },
            markDirty(section: TurnitsGlobalSaveSection, data: any) {
                if (section === "pagos") {
                    // Sin baseline (todavía no cargó lo real del servidor) no
                    // se puede saber qué cambió: se ignora en vez de inventar.
                    if (baseline.pagos === undefined) return
                    const diff = TurnitsGlobalSave_pagosDiff(
                        { ...(pending.pagos || {}), ...(data || {}) },
                        baseline.pagos
                    )
                    if (Object.keys(diff).length === 0) {
                        if (pending.pagos !== undefined) {
                            const next = { ...pending }
                            delete next.pagos
                            pending = next
                            TurnitsGlobalSave_safeWrite(pending)
                            TurnitsGlobalSave_emit(true)
                        }
                        return
                    }
                    pending = { ...pending, pagos: diff }
                    TurnitsGlobalSave_safeWrite(pending)
                    TurnitsGlobalSave_emit(true)
                    return
                }
                // Si el usuario volvió al valor guardado, deja de estar dirty.
                // IMPORTANTE: para excepciones hay que comparar el objeto completo.
                // `TurnitsGlobalSave_partialEqual` permite subconjuntos (por diseño),
                // así que un {} sería considerado igual a un objeto con fechas y al
                // borrar la última excepción NO aparecería "Guardar cambios".
                const equalToBaseline =
                    baseline[section] !== undefined &&
                    inFlight[section] === undefined &&
                    (section === "excepciones"
                        ? TurnitsGlobalSave_stable(data) ===
                          TurnitsGlobalSave_stable(baseline[section])
                        : TurnitsGlobalSave_partialEqual(
                              data,
                              baseline[section]
                          ))
                if (equalToBaseline) {
                    if (pending[section] !== undefined) {
                        const next = { ...pending }
                        delete next[section]
                        pending = next
                        TurnitsGlobalSave_safeWrite(pending)
                        TurnitsGlobalSave_emit(true)
                    }
                    return
                }
                pending = { ...pending, [section]: data }
                TurnitsGlobalSave_safeWrite(pending)
                TurnitsGlobalSave_emit(true)
            },
            clear(section: TurnitsGlobalSaveSection) {
                if (pending[section] === undefined) return
                const next = { ...pending }
                delete next[section]
                pending = next
                TurnitsGlobalSave_safeWrite(pending)
                TurnitsGlobalSave_emit()
            },
            async saveAll() {
                if (saving || Object.keys(blockers).length || !Object.keys(pending).length) return
                saving = true
                window.dispatchEvent(
                    new CustomEvent("turnits_global_save_state", {
                        detail: { saving: true },
                    })
                )
                const slug = getSlug()
                const token = getToken()
                const results: Record<string, boolean> = {}
                const errors: Record<string, string> = {}
                const savedData: TurnitsGlobalPending = {}

                if (!slug || !token) {
                    saving = false
                    window.dispatchEvent(
                        new CustomEvent("turnits_global_save_error", {
                            detail: { error: "Sin sesión." },
                        })
                    )
                    window.dispatchEvent(
                        new CustomEvent("turnits_global_save_state", {
                            detail: { saving: false },
                        })
                    )
                    return
                }

                const current = { ...pending }
                inFlight = current
                const sesionToken = GuardaSesion_leerJwt(token)
                const configUrl =
                    sesionToken?.rol === "empleado"
                        ? `${api()}/empleado/${encodeURIComponent(slug)}/config`
                        : `${api()}/settings/${slug}`
                const saveSettings = async (
                    section: TurnitsGlobalSaveSection,
                    body: any
                ) => {
                    if (current[section] === undefined) return
                    try {
                        const res = await fetch(configUrl, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify(body),
                        })
                        if (!res.ok) {
                            const d = await res.json().catch(() => ({}))
                            throw new Error(d.error || "Error al guardar.")
                        }
                        results[section] = true
                    } catch (e: any) {
                        results[section] = false
                        errors[section] = e.message || "Error al guardar."
                        console.error(`[TurnitsGlobalSave] ${section}:`, e)
                    }
                }

                const tasks: Promise<void>[] = []
                if (current.horarios !== undefined)
                    tasks.push(
                        saveSettings(
                            "horarios",
                            current.horarios &&
                                typeof current.horarios === "object" &&
                                Object.prototype.hasOwnProperty.call(
                                    current.horarios,
                                    "horarios"
                                )
                                ? current.horarios
                                : { horarios: current.horarios }
                        )
                    )
                if (current.excepciones !== undefined)
                    tasks.push(
                        saveSettings("excepciones", {
                            excepciones: current.excepciones,
                        })
                    )
                if (current.pagos !== undefined)
                    tasks.push(saveSettings("pagos", current.pagos))

                if (current.tema !== undefined) {
                    tasks.push(
                        (async () => {
                            try {
                                const res = await fetch(
                                    `${api()}/admin/tema/${slug}`,
                                    {
                                        method: "PUT",
                                        headers: {
                                            "Content-Type": "application/json",
                                            Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify(current.tema),
                                    }
                                )
                                const d = await res.json().catch(() => ({}))
                                if (!res.ok || !d.success)
                                    throw new Error(
                                        d.error || "Error al guardar el tema."
                                    )
                                results.tema = true
                                savedData.tema = ThemeEditor_temaCompleto(d.tema || current.tema)
                            } catch (e: any) {
                                results.tema = false
                                errors.tema = e.message || "Error al guardar el tema."
                                console.error("[TurnitsGlobalSave] tema:", e)
                            }
                        })()
                    )
                }

                if (current.perfil !== undefined) {
                    tasks.push((async () => {
                        try {
                            const body = perfilPayload(current.perfil)
                            const res = await fetch(`${api()}/admin/perfil/${slug}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify(body),
                            })
                            const d = await res.json().catch(() => ({}))
                            if (!res.ok || !d.success) throw new Error(d.error || "Error al guardar el perfil.")
                            savedData.perfil = perfilDraft(d.perfil || body,
                                Object.hasOwn(current.perfil, "redes_sociales"),
                                Object.hasOwn(current.perfil, "foto_perfil_url"))
                            results.perfil = true
                            window.dispatchEvent(new CustomEvent("turnits_business_photo_changed", { detail: { slug } }))
                        } catch (e: any) {
                            results.perfil = false
                            errors.perfil = e.message || "Error al guardar el perfil."
                        }
                    })())
                }

                await Promise.all(tasks)
                inFlight = {}

                Object.keys(results).forEach((section) => {
                    if (results[section]) {
                        baseline[section] =
                            section === "pagos"
                                ? {
                                      ...(baseline.pagos || {}),
                                      ...current.pagos,
                                  }
                                : savedData[section] || current[section]
                        const next = { ...pending }
                        // Edits made while the request was in flight stay pending.
                        if (TurnitsGlobalSave_stable(next[section]) === TurnitsGlobalSave_stable(current[section]))
                            delete next[section]
                        pending = next
                        window.dispatchEvent(
                            new CustomEvent("turnits_global_saved", {
                                detail: { section, data: baseline[section], submitted: current[section] },
                            })
                        )
                    }
                })
                TurnitsGlobalSave_safeWrite(pending)
                saving = false

                const failed = Object.keys(results).filter((k) => !results[k])
                if (failed.length) {
                    window.dispatchEvent(
                        new CustomEvent("turnits_global_save_error", {
                            detail: {
                                error: failed.map((key) => `${key === "perfil" ? "Perfil" : key === "tema" ? "Temas" : key}: ${errors[key] || "No se pudo guardar."}`).join(" "),
                                failed,
                            },
                        })
                    )
                } else {
                    window.dispatchEvent(new CustomEvent("config_saved"))
                    window.dispatchEvent(
                        new CustomEvent("turnits_global_save_success")
                    )
                }
                window.dispatchEvent(
                    new CustomEvent("turnits_global_save_state", {
                        detail: { saving: false },
                    })
                )
                TurnitsGlobalSave_emit()
            },
        }

        // Pagos ya tiene su bus de cambios local. Una vez creado el manager,
        // cada nuevo evento representa una edición pendiente y se conserva
        // aunque el usuario cambie de sección.
        w.addEventListener("pagos_changed", (e: any) => {
            const data =
                e?.detail ??
                (typeof w.getPagosConfig === "function"
                    ? w.getPagosConfig()
                    : null)
            if (data) w.__turnitsGlobalSaveManager.markDirty("pagos", data)
        })
    }
    return w.__turnitsGlobalSaveManager
}

const UserGreeting_textStyle = {
    fontFamily: '"Inter Display", sans-serif',
    fontWeight: 300,
    lineHeight: 1.2,
    whiteSpace: "nowrap" as const,
}

const PlanEstado_DIAS_PARA_RENOVAR = 3

const PlanEstado_CROWN_COLOR = "#1B6B1A"

function PlanEstado_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl) {
        try {
            fromUrl = new URLSearchParams(window.location.search).get("u") || ""
        } catch {}
    }
    // safeLocalStorage: en algunos navegadores leer localStorage tira excepción.
    return fromUrl.toLowerCase().trim() || safeLocalStorage("user_slug") || ""
}

function PlanEstado_getStatusPago(): "ok" | "cancel" | "" {
    if (typeof window === "undefined") return ""
    try {
        const s = new URLSearchParams(window.location.search).get("status")
        if (s === "renovacion_ok") return "ok"
        if (s === "renovacion_cancel") return "cancel"
    } catch {}
    return ""
}

function PlanEstado_limpiarStatusPago() {
    try {
        const u = new URL(window.location.href)
        u.searchParams.delete("status")
        window.history.replaceState(window.history.state, "", u.toString())
    } catch {}
}

const PlanEstado_esperar = (ms: number) =>
    new Promise<void>((r) => setTimeout(r, ms))

const PlanEstado_MOCK = {
    plan: "basico",
    estado: "activo",
    dias_restantes: 2,
    vencida: false,
    precio_renovacion: 19900,
}

const BotonNotificaciones_API_BASE_URL_DEFAULT =
    appConfig.apiUrl

function BotonNotificaciones_getScrollTargets() {
    const pageScroller = document.scrollingElement || document.documentElement

    const containers = Array.from(document.querySelectorAll("*")).filter(
        (el) => {
            const { overflowY, overflow } = window.getComputedStyle(el)
            return (
                (overflowY === "auto" ||
                    overflowY === "scroll" ||
                    overflow === "auto" ||
                    overflow === "scroll") &&
                el.scrollHeight > el.clientHeight
            )
        }
    )

    return [pageScroller, ...containers.filter((el) => el !== pageScroller)]
}

function BotonNotificaciones_scrollToTop(
    targetSelector: string,
    behavior: ScrollBehavior
) {
    if (targetSelector) {
        const el = document.querySelector(targetSelector)
        if (el) {
            el.scrollTo({ top: 0, behavior })
        } else {
            window.scrollTo({ top: 0, behavior })
        }
    } else {
        BotonNotificaciones_getScrollTargets().forEach((el) =>
            el.scrollTo({ top: 0, behavior })
        )
        window.scrollTo({ top: 0, behavior })
    }
}

function BotonNotificaciones_decodeJWT(token: string): any {
    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
        return JSON.parse(decodeURIComponent(escape(atob(base64))))
    } catch (e) {
        console.error("[BotonNotif] No se pudo decodificar el JWT:", e)
        return null
    }
}

function BotonNotificaciones_getSlugFromUrl(): string | null {
    if (typeof window === "undefined") return null
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) return decodeURIComponent(m[1])
    } catch {}
    const params = new URLSearchParams(window.location.search)
    return params.get("u")
}

function BotonNotificaciones_useNoLeidas(
    apiBaseUrl: string,
    tokenStorageKey: string,
    pollingSeconds: number,
    employeeMode = false
): number {
    const [noLeidas, setNoLeidas] = useState(0)
    const countRequest = useRef(0)

    const getAuth = useCallback(() => {
        if (typeof window === "undefined") return null

        // PASO 1: ¿hay token guardado con esa clave?
        const token =
            window.localStorage.getItem(tokenStorageKey) ||
            [
                "access_token",
                "user_token",
                "token",
                "auth_token",
                "turnits_token",
            ]
                .map((key) => window.localStorage.getItem(key))
                .find(Boolean)
        console.log(
            `[BotonNotif] PASO 1 — token en localStorage["${tokenStorageKey}"]`,
            token ? "encontrado" : "no encontrado"
        )
        if (!token) {
            console.warn(
                `[BotonNotif] ⛔ No hay token con la clave "${tokenStorageKey}". ` +
                    `Corré esto en la consola para ver TODAS las claves guardadas: Object.keys(localStorage)`
            )
            return null
        }

        // PASO 2: ¿de dónde sale el slug?
        const slugUrl = BotonNotificaciones_getSlugFromUrl()
        const slugJwt = BotonNotificaciones_decodeJWT(token)?.slug
        const slug = slugUrl || slugJwt
        console.log(
            `[BotonNotif] PASO 2 — slug desde URL (?u=): "${slugUrl}" | slug desde JWT: "${slugJwt}" | usando: "${slug}"`
        )
        if (!slug) {
            console.warn(
                "[BotonNotif] ⛔ No se pudo determinar el slug (ni por URL ni por JWT)."
            )
            return null
        }

        return { token, slug }
    }, [tokenStorageKey])

    const fetchCount = useCallback(async () => {
        const auth = getAuth()
        if (!auth) return
        const requestId = ++countRequest.current

        const url = employeeMode
            ? `${apiBaseUrl}/empleado/${encodeURIComponent(auth.slug)}/notificaciones?no_leidas=true`
            : `${apiBaseUrl}/notificaciones/${auth.slug}?no_leidas=true`
        console.log(`[BotonNotif] PASO 3 — haciendo fetch a: ${url}`)

        try {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${auth.token}` },
            })
            console.log(
                `[BotonNotif] PASO 4 — status de la respuesta: ${res.status}`
            )

            const data = await res.json()
            console.log("[BotonNotif] PASO 5 — body de la respuesta:", data)

            if (data.success && requestId === countRequest.current) {
                const cantidad = Number(data.no_leidas) || 0
                console.log(`[BotonNotif] ✅ no_leidas parseado: ${cantidad}`)
                setNoLeidas(cantidad)
            } else {
                console.error(
                    "[BotonNotif] ⛔ La API respondió success:false →",
                    data.error
                )
            }
        } catch (e: any) {
            console.error("[BotonNotif] ⛔ Error de red/fetch:", e.message)
        }
    }, [apiBaseUrl, getAuth, employeeMode])

    useEffect(() => {
        fetchCount()
        const interval = setInterval(
            fetchCount,
            Math.max(10, pollingSeconds) * 1000
        )
        let refreshTimer: number | undefined
        const refresh = (event: Event) => {
            const detail = (event as CustomEvent).detail
            const auth = getAuth()
            if (!auth || detail?.slug !== auth.slug || Boolean(detail?.employeeMode) !== employeeMode) return
            window.clearTimeout(refreshTimer)
            refreshTimer = window.setTimeout(fetchCount,150)
        }
        window.addEventListener("turnits-notifications-updated",refresh)
        return () => {clearInterval(interval);window.clearTimeout(refreshTimer);window.removeEventListener("turnits-notifications-updated",refresh)}
    }, [fetchCount, pollingSeconds, getAuth, employeeMode])

    return noLeidas
}

type BotonNotificaciones_Modo = "automatico" | "expandido" | "compacto"

interface BotonNotificaciones_Props {
    icono?: { src: string }
    texto: string
    modo: BotonNotificaciones_Modo
    anchoBreakpoint: number
    colorFondo: string
    colorFondoHover: string
    colorBorde: string
    colorTexto: string
    tintarIcono: boolean
    colorIcono: string
    tamanoIcono: number
    mostrarContador: boolean
    apiBaseUrl: string
    tokenStorageKey: string
    pollingSeconds: number
    employeeMode?: boolean
    colorContador: string
    colorTextoContador: string
    maxContador: number
    scrollAlTop: boolean
    scrollBehavior: ScrollBehavior
    scrollTargetSelector: string
    scrollActionDelay: number
    onClick?: () => void
    style?: React.CSSProperties
}

interface NotificacionesPanel_Notificacion {
    id: string
    tipo: string
    titulo: string
    mensaje: string
    data?: Record<string, any>
    leida: boolean
    created_at: string
}

const NotificacionesPanel_NOTIFS_VISIBLES_ANTES_DE_SCROLL = 3

const NotificacionesPanel_TIPO_CONFIG: Record<
    string,
    { icon: string; color: string }
> = {
    turno_nuevo: { icon: "📅", color: "#6366F1" },
    turno_cancelado: { icon: "❌", color: "#EF4444" },
    turno_pendiente: { icon: "⏱️", color: "#F59E0B" },
    pago_aprobado: { icon: "💰", color: "#10B981" },
    lista_espera: { icon: "⏳", color: "#F59E0B" },
    vencimiento: { icon: "⚠️", color: "#EF4444" },
    recordatorio: { icon: "🔔", color: "#3B82F6" },
    reprogramacion: { icon: "🔁", color: "#0EA5E9" },
    tip: { icon: "💡", color: "#8B5CF6" },
    sistema: { icon: "ℹ️", color: "#6B7280" },
}

const NotificacionesPanel_SECCION_POR_TIPO: Record<string, string> = {
    turno_nuevo: "agenda",
    turno_cancelado: "agenda",
    turno_pendiente: "agenda",
    pago_aprobado: "pagos",
    lista_espera: "agenda",
    vencimiento: "pagos",
    recordatorio: "agenda",
    reprogramacion: "agenda",
    tip: "temas",
    sistema: "inicio",
}

const NotificacionesPanel_TIPO_ALIAS: Record<string, string> = {
    // turno_nuevo
    nuevo_turno: "turno_nuevo",
    turno_creado: "turno_nuevo",
    turno_confirmado: "turno_nuevo",
    // turno_cancelado
    cancelacion: "turno_cancelado",
    cancelación: "turno_cancelado",
    turno_cancelo: "turno_cancelado",
    turno_canceló: "turno_cancelado",
    // turno_pendiente
    turno_pendiente_confirmacion: "turno_pendiente",
    pendiente_confirmacion: "turno_pendiente",
    // pago_aprobado
    pago_confirmado: "pago_aprobado",
    pago_recibido: "pago_aprobado",
    pago_completado: "pago_aprobado",
    // lista_espera
    waitlist: "lista_espera",
    lista_de_espera: "lista_espera",
    // vencimiento
    por_vencer: "vencimiento",
    vencido: "vencimiento",
    // recordatorio
    reminder: "recordatorio",
    // reprogramación (nueva categoría, distintas formas en que puede
    // llegar desde el backend según de dónde se dispare la notificación)
    solicitud_reprogramacion: "reprogramacion",
    solicitud_reprogramación: "reprogramacion",
    reprogramacion_pendiente: "reprogramacion",
    reprogramación_pendiente: "reprogramacion",
    turno_reprogramado: "reprogramacion",
    reprogramación: "reprogramacion",
}

function NotificacionesPanel_normalizarTipo(tipoCrudo: string): string {
    const limpio = (tipoCrudo || "").trim().toLowerCase()
    if (NotificacionesPanel_TIPO_ALIAS[limpio]) {
        return NotificacionesPanel_TIPO_ALIAS[limpio]
    }

    // Fallback difuso: si el backend manda una variante que no está en el
    // alias exacto de arriba (espacios en vez de guiones bajos, con/sin
    // tilde, alguna palabra de más, etc.), buscamos por palabra clave en
    // vez de dejar que caiga silenciosamente en "sistema". Esto es lo que
    // hacía que, por ejemplo, "reprogramacion" con alguna variante nueva
    // se mostrara con el ícono genérico en vez del custom cargado.
    const sinTildes = limpio.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const contiene = (kw: string) => sinTildes.includes(kw)

    if (contiene("reprogram")) return "reprogramacion"
    if (contiene("cancel")) return "turno_cancelado"
    if (contiene("pago") || contiene("cobro")) return "pago_aprobado"
    if (contiene("espera")) return "lista_espera"
    if (contiene("venc")) return "vencimiento"
    if (contiene("record")) return "recordatorio"
    if (contiene("pendiente")) return "turno_pendiente"
    if (contiene("nuevo") && contiene("turno")) return "turno_nuevo"
    if (contiene("tip")) return "tip"

    return limpio
}

function NotificacionesPanel_tiempoRelativo(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diffMs / 60000)
    if (min < 1) return "ahora"
    if (min < 60) return `hace ${min} min`
    const hs = Math.floor(min / 60)
    if (hs < 24) return `hace ${hs} h`
    const dias = Math.floor(hs / 24)
    if (dias < 7) return `hace ${dias} d`
    return new Date(iso).toLocaleDateString("es-AR")
}

function NotificacionesPanel_decodeJWT(token: string): any {
    try {
        const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
        return JSON.parse(decodeURIComponent(escape(atob(base64))))
    } catch {
        return null
    }
}

function NotificacionesPanel_getSlugFromUrl(): string | null {
    if (typeof window === "undefined") return null
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) return decodeURIComponent(m[1])
    } catch {}
    const params = new URLSearchParams(window.location.search)
    return params.get("u")
}

function NotificacionesPanel_esIOS(): boolean {
    if (typeof navigator === "undefined") return false
    return (
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream
    )
}

function NotificacionesPanel_esStandalone(): boolean {
    if (typeof window === "undefined") return false
    return (
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (window.navigator as any).standalone === true
    )
}

function NotificacionesPanel_urlBase64ToUint8Array(
    base64String: string
): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/")
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i++)
        outputArray[i] = rawData.charCodeAt(i)
    return outputArray
}

type NotificacionesPanel_EstadoPush =
    | "cargando" // todavía no sabemos si ya está suscripto
    | "no_soportado" // navegador sin soporte real (ej. Chrome muy viejo)
    | "requiere_pwa_ios" // iPhone: hay que agregarlo a pantalla de inicio primero
    | "sin_activar"
    | "activando"
    | "activo"
    | "desactivando"

interface NotificacionesPanel_Props {
    apiBaseUrl: string
    employeeMode?: boolean
    tokenStorageKey: string
    pollingSeconds: number
    accentColor: string
    iconoTurnoNuevo?: { src: string }
    iconoTurnoCancelado?: { src: string }
    iconoTurnoPendiente?: { src: string }
    iconoPagoAprobado?: { src: string }
    iconoListaEspera?: { src: string }
    iconoVencimiento?: { src: string }
    iconoRecordatorio?: { src: string }
    iconoReprogramacion?: { src: string }
    iconoTip?: { src: string }
    iconoSistema?: { src: string }
    iconoEliminar?: { src: string }
    // ── Web Push ──
    mostrarBotonPush: boolean
    swPath: string
    textoActivarPush: string
    textoPushActivo: string
    // Se llama al tocar una notificación (después de marcarla como vista),
    // con la sección a la que corresponde según su tipo (o `data.seccion`
    // si el backend la mandó explícita).
    onNavigate?: (
        seccion: string,
        notif: NotificacionesPanel_Notificacion
    ) => void
    style?: React.CSSProperties
}

function NotificacionesPanel_observarVisibles(
    root: HTMLElement,
    items: Map<string, HTMLDivElement>,
    onSeen: (id: string) => Promise<boolean>
) {
    const timers = new Map<string, number>()
    const inFlight = new Set<string>()
    const seen = new Set<string>()
    let active = true
    const visible = (node: HTMLElement) => {
        if (document.visibilityState !== "visible") return false
        const item = node.getBoundingClientRect()
        const list = root.getBoundingClientRect()
        const width = Math.max(0, Math.min(item.right, list.right, window.innerWidth) - Math.max(item.left, list.left, 0))
        const height = Math.max(0, Math.min(item.bottom, list.bottom, window.innerHeight) - Math.max(item.top, list.top, 0))
        if (!(item.width > 0 && item.height > 0 && width * height >= item.width * item.height * .5)) return false
        const x = Math.max(item.left,list.left,0) + width / 2
        const y = Math.max(item.top,list.top,0) + height / 2
        const topElement = document.elementFromPoint(x,y)
        return !!topElement && (node === topElement || node.contains(topElement))
    }
    const cancel = (id: string) => {
        const timer = timers.get(id)
        if (timer !== undefined) window.clearTimeout(timer)
        timers.delete(id)
    }
    const schedule = (id: string, node: HTMLElement) => {
        if (!active || seen.has(id) || inFlight.has(id) || timers.has(id) || !visible(node)) return
        timers.set(id, window.setTimeout(async () => {
            timers.delete(id)
            if (!active || !visible(node)) return
            inFlight.add(id)
            try { if (await onSeen(id)) seen.add(id) }
            finally { inFlight.delete(id) }
        }, 500))
    }
    const scan = () => items.forEach((node, id) => visible(node) ? schedule(id, node) : cancel(id))
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const id = (entry.target as HTMLElement).dataset.notificationId
            if (!id) return
            if (entry.isIntersecting && entry.intersectionRatio >= .5) schedule(id, entry.target as HTMLElement)
            else cancel(id)
        })
    }, {root, threshold:[0,.5,1]}) : null
    items.forEach(node => observer?.observe(node))
    // Revalida también si se mueve el panel, cambia la pestaña o falla el marcado.
    document.addEventListener("visibilitychange", scan)
    window.addEventListener("scroll", scan, true)
    window.addEventListener("resize", scan)
    const retry = window.setInterval(scan, 2000)
    scan()
    return () => {
        active = false
        observer?.disconnect()
        timers.forEach(timer => window.clearTimeout(timer))
        timers.clear()
        window.clearInterval(retry)
        document.removeEventListener("visibilitychange", scan)
        window.removeEventListener("scroll", scan, true)
        window.removeEventListener("resize", scan)
    }
}

function TurnosHoy_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    const isMobile = width < 480
    const isTablet = width >= 480 && width < 768
    return { width, isMobile, isTablet, isDesktop: width >= 768 }
}

function TurnosHoy_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function TurnosHoy_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function TurnosHoy_getMinutosArg(): number {
    const str = new Date().toLocaleString("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    })
    const [h, m] = str.split(":").map(Number)
    return h * 60 + m
}

const TurnosHoy_MOCK: any = {
    turnosHoy: 4,
    turnosHoyDetalle: [
        {
            id: "1",
            nombre: "Gonza",
            hora: "14:30",
            servicio: "Corte Clásico",
            estado: "confirmado",
            precio_cobrado: 12000,
            metodo_pago: "sena",
            pago_estado: "aprobado",
        },
        {
            id: "2",
            nombre: "Joaco",
            hora: "15:30",
            servicio: "Corte Básico",
            estado: "confirmado",
            precio_cobrado: 15000,
            metodo_pago: "none",
            pago_estado: "sin_pago",
        },
        {
            id: "3",
            nombre: "Mariano",
            hora: "17:15",
            servicio: "Corte Clásico",
            estado: "confirmado",
            precio_cobrado: 12000,
            metodo_pago: "total",
            pago_estado: "aprobado",
        },
        {
            id: "4",
            nombre: "Pablito",
            hora: "20:30",
            servicio: null,
            estado: "confirmado",
            precio_cobrado: 9000,
            metodo_pago: "none",
            pago_estado: "sin_pago",
        },
    ],
    config: { duracion: 45 },
}

const TurnosHoy_makeCardBase = (isMobile: boolean): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "16px" : "22px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
})

const TurnosHoy_makeTitleStyle = (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? 14 : 16,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const TurnosHoy_makeSectionTitle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 11 : 13,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
})

const TurnosHoy_makeBtnAgenda = (
    accent: string,
    isMobile: boolean
): React.CSSProperties => ({
    background: "none",
    border: "none",
    fontSize: isMobile ? 11 : 12,
    fontWeight: 700,
    color: accent,
    cursor: "pointer",
    padding: 0,
    letterSpacing: "0.02em",
})

const TurnosHoy_shimmerCSS = `
    @keyframes shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
`

function RendimientoEquipo_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return {
        width,
        isMobile: width < 480,
        isTablet: width >= 480 && width < 768,
    }
}

function RendimientoEquipo_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function RendimientoEquipo_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

const RendimientoEquipo_PERIODOS = [
    { id: "dia", label: "Día" },
    { id: "semana", label: "Semana" },
    { id: "mes", label: "Mes" },
]

const RendimientoEquipo_MOCK = {
    equipo: [
        { id: "mock-1", nombre: "Gonza", color: "#6366F1", foto_url: null },
        { id: "mock-2", nombre: "Joaco", color: "#22C55E", foto_url: null },
    ],
    datos: {
        cantidadTurnos: 8,
        facturacion: 96000,
        minutosTrabajados: 630,
        detalle: [
            {
                id: "1",
                fecha: "2026-09-15",
                hora: "10:00",
                cliente: "Mariano",
                servicio: "Corte Clásico",
                monto: 12000,
            },
            {
                id: "2",
                fecha: "2026-09-16",
                hora: "14:30",
                cliente: "Pablito",
                servicio: "Corte Básico",
                monto: 15000,
            },
            {
                id: "3",
                fecha: "2026-09-17",
                hora: "17:15",
                cliente: "Facu",
                servicio: "Corte Clásico",
                monto: 12000,
            },
        ],
    },
    resumen: {
        totales: { turnos: 14, facturacion: 178000, ticket_promedio: 12714 },
        integrantes: [
            {
                id: "mock-1",
                nombre: "Gonza",
                apellido: "",
                rol: "dueño",
                turnos: 8,
                facturacion: 96000,
                ticket_promedio: 12000,
            },
            {
                id: "mock-2",
                nombre: "Joaco",
                apellido: "",
                rol: "Profesional",
                turnos: 6,
                facturacion: 82000,
                ticket_promedio: 13666,
            },
        ],
    },
}

const RendimientoEquipo_makeCardBase = (
    isMobile: boolean
): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "16px" : "22px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
})

const RendimientoEquipo_makeTitleStyle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 14 : 16,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const RendimientoEquipo_shimmerCSS = `
    @keyframes rendimientoEquipoShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
    @keyframes rendimientoEquipoSpin {
        to { transform: rotate(360deg); }
    }
`

function IngresosEstimados_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return {
        width,
        isMobile: width < 480,
        isTablet: width >= 480 && width < 768,
        isDesktop: width >= 768,
    }
}

function IngresosEstimados_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function IngresosEstimados_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function IngresosEstimados_formatFull(n: number): string {
    return (
        "$" +
        n.toLocaleString("es-AR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        })
    )
}

function IngresosEstimados_formatCurrency(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
    return `$${n.toLocaleString("es-AR")}`
}

function IngresosEstimados_calcularIngresos(
    turnosLista: any[],
    mesActual: string
) {
    let mercadopago = 0
    let transferencia = 0
    let efectivo = 0
    let total = 0

    for (const t of turnosLista) {
        if (!t.fecha?.startsWith(mesActual)) continue
        if (t.estado === "cancelado") continue

        const precio = Number(t.precio_cobrado || 0)
        if (precio <= 0) continue

        total += precio
        if (t.pago_estado !== "aprobado") continue

        if (t.metodo_pago === "mercadopago") mercadopago += precio
        else if (t.metodo_pago === "transferencia") transferencia += precio
        else if (t.metodo_pago === "efectivo") efectivo += precio
    }

    return { mercadopago, transferencia, efectivo, total }
}

function IngresosEstimados_calcularIngresosHoy(
    turnosLista: any[],
    hoyISO: string
) {
    let mercadopago = 0
    let transferencia = 0
    let efectivo = 0
    let total = 0

    for (const t of turnosLista) {
        if (t.fecha !== hoyISO) continue
        if (t.estado === "cancelado") continue

        const precio = Number(t.precio_cobrado || 0)
        if (precio <= 0) continue

        total += precio
        if (t.pago_estado !== "aprobado") continue

        if (t.metodo_pago === "mercadopago") mercadopago += precio
        else if (t.metodo_pago === "transferencia") transferencia += precio
        else if (t.metodo_pago === "efectivo") efectivo += precio
    }

    return { mercadopago, transferencia, efectivo, total }
}

const IngresosEstimados_MOCK_TURNOS = [
    {
        fecha: "2026-06-01",
        estado: "confirmado",
        precio_cobrado: 12000,
        metodo_pago: "mercadopago",
        pago_estado: "aprobado",
    },
    {
        fecha: "2026-06-03",
        estado: "confirmado",
        precio_cobrado: 15000,
        metodo_pago: "efectivo",
        pago_estado: "aprobado",
    },
    {
        fecha: "2026-06-05",
        estado: "confirmado",
        precio_cobrado: 12000,
        metodo_pago: "mercadopago",
        pago_estado: "aprobado",
    },
    {
        fecha: "2026-06-07",
        estado: "confirmado",
        precio_cobrado: 9000,
        metodo_pago: "transferencia",
        pago_estado: "aprobado",
    },
    {
        fecha: "2026-06-10",
        estado: "confirmado",
        precio_cobrado: 12000,
        metodo_pago: "mercadopago",
        pago_estado: "aprobado",
    },
    {
        fecha: "2026-06-12",
        estado: "confirmado",
        precio_cobrado: 18000,
        metodo_pago: "none",
        pago_estado: "sin_pago",
    },
    {
        fecha: "2026-06-14",
        estado: "confirmado",
        precio_cobrado: 12000,
        metodo_pago: "mercadopago",
        pago_estado: "aprobado",
    },
    {
        fecha: "2026-06-19",
        estado: "confirmado",
        precio_cobrado: 12000,
        metodo_pago: "efectivo",
        pago_estado: "aprobado",
    },
    {
        fecha: "2026-06-19",
        estado: "confirmado",
        precio_cobrado: 15000,
        metodo_pago: "transferencia",
        pago_estado: "pendiente",
    },
]

const IngresosEstimados_MOCK_STATS: any = {
    turnosMes: 9,
    turnosHoy: 2,
    config: { metodo_pago: "sena", porcentaje_sena: 30, duracion: 45 },
    turnosLista: IngresosEstimados_MOCK_TURNOS,
    ventas: { ticketPromedio: 13000 },
    ventasPorDia: (() => {
        const out: Record<string, any> = {}
        const now = new Date()
        const curve = [
            1, 1, 2, 1, 3, 2, 4, 6, 3, 4, 5, 4, 3, 5, 6, 5, 4, 7, 6, 8, 9, 10,
            0, 0, 0, 0, 0, 0, 0, 0, 0,
        ]
        for (let d = 1; d <= now.getDate(); d++) {
            const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
            const cant = curve[d - 1] || 0
            out[iso] = { volumen: cant * 12000, cantidad: cant }
        }
        return out
    })(),
}

function IngresosEstimados_buildUltimos7(ventasPorDia: Record<string, any>) {
    const now = new Date()
    const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setDate(now.getDate() - (6 - i))
        const iso = d.toISOString().split("T")[0]
        const entry = ventasPorDia?.[iso] || {}
        return {
            iso,
            diaNum: d.getDate(),
            diaSem: dias[d.getDay()],
            turnos: entry.cantidad || 0,
            volumen: entry.volumen || 0,
        }
    })
}

const IngresosEstimados_makeCardBase = (
    isMobile: boolean
): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "16px" : "22px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
})

const IngresosEstimados_makeTitleStyle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 14 : 16,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const IngresosEstimados_makeSectionTitle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 11 : 13,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
})

const IngresosEstimados_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

function TurnosMes_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return { isMobile: width < 480, isTablet: width >= 480 && width < 768 }
}

function TurnosMes_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function TurnosMes_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

const TurnosMes_MOCK_STATS: any = {
    turnosMes: 22,
    turnosMesAnterior: 17,
    turnosHoy: 4,
    chartData: [
        { label: "Sem 1", turnos: 4 },
        { label: "Sem 2", turnos: 7 },
        { label: "Sem 3", turnos: 5 },
        { label: "Sem 4", turnos: 6 },
    ],
}

const TurnosMes_makeCardBase = (isMobile: boolean): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "16px" : "22px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
})

const TurnosMes_makeTitleStyle = (isMobile: boolean): React.CSSProperties => ({
    fontSize: isMobile ? 14 : 16,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const TurnosMes_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

function ClientesCard_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return { isMobile: width < 480, isTablet: width >= 480 && width < 768 }
}

function ClientesCard_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function ClientesCard_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

const ClientesCard_MOCK_STATS: any = {
    totalClientes: 18,
    clientesNuevos: 5,
    clientesNuevosMesAnterior: 3,
    clientesRecurrentes: 13,
    clientesFrecuentes: 6,
}

const ClientesCard_makeCardBase = (isMobile: boolean): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "16px" : "22px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
})

const ClientesCard_makeTitleStyle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 14 : 16,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const ClientesCard_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

function MejoresDias_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return { isMobile: width < 480, isTablet: width >= 480 && width < 768 }
}

function MejoresDias_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function MejoresDias_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

const MejoresDias_DIAS_ORDEN = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo",
]

const MejoresDias_DIAS_LABEL: Record<string, string> = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes",
    sabado: "Sábado",
    domingo: "Domingo",
}

const MejoresDias_GETDAY_TO_KEY: Record<number, string> = {
    0: "domingo",
    1: "lunes",
    2: "martes",
    3: "miercoles",
    4: "jueves",
    5: "viernes",
    6: "sabado",
}

function MejoresDias_sanitizarHora(h: any): string | null {
    if (!h || typeof h !== "string") return null
    const match = h.match(/^([01]?\d|2[0-3]):([0-5]\d)/)
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null
}

function MejoresDias_formatHorario(jornada: any[]): string {
    if (!Array.isArray(jornada)) return ""
    const desde = MejoresDias_sanitizarHora(jornada[0])
    const hasta = MejoresDias_sanitizarHora(jornada[1])
    if (!desde || !hasta) return ""
    return `${desde} – ${hasta}`
}

const MejoresDias_MOCK_STATS: any = {
    horarios: {
        lunes: { activo: true, jornada: ["09:00", "18:00"] },
        martes: { activo: true, jornada: ["09:00", "18:00"] },
        miercoles: { activo: false, jornada: [null, null] },
        jueves: { activo: true, jornada: ["09:00", "18:00"] },
        viernes: { activo: true, jornada: ["09:00", "20:00"] },
        sabado: { activo: true, jornada: ["10:00", "14:00"] },
        domingo: { activo: false, jornada: [null, null] },
    },
    turnosMes: 22,
    turnosLista: (() => {
        const now = new Date()
        const anio = now.getFullYear()
        const mes = now.getMonth() + 1
        const hoy = now.getDate()
        const pesosDia: Record<number, number> = {
            1: 4,
            2: 3,
            3: 0,
            4: 3,
            5: 5,
            6: 2,
            0: 0,
        }
        const lista: any[] = []
        for (let d = 1; d <= hoy; d++) {
            const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`
            const dow = new Date(`${fecha}T12:00:00`).getDay()
            for (let t = 0; t < (pesosDia[dow] || 0); t++) lista.push({ fecha })
        }
        return lista
    })(),
}

function MejoresDias_calcularRanking(
    turnosLista: any[],
    horarios: Record<string, any>
) {
    const conteo: Record<string, number> = {}
    MejoresDias_DIAS_ORDEN.forEach((dia) => {
        if (horarios?.[dia]?.activo) conteo[dia] = 0
    })
    ;(turnosLista || []).forEach((t) => {
        if (!t.fecha) return
        const dow = new Date(`${t.fecha}T12:00:00`).getDay()
        const key = MejoresDias_GETDAY_TO_KEY[dow]
        if (key && conteo[key] !== undefined) conteo[key]++
    })

    const totalGeneral = Object.values(conteo).reduce((a, b) => a + b, 0) || 1

    return MejoresDias_DIAS_ORDEN.filter((dia) => horarios?.[dia]?.activo)
        .map((dia) => {
            const total = conteo[dia] || 0
            const porcentaje = Math.round((total / totalGeneral) * 100)
            const horario = MejoresDias_formatHorario(
                horarios[dia]?.jornada || []
            )
            return { dia, total, porcentaje, horario }
        })
        .sort((a, b) => b.total - a.total)
        .filter((item) => item.total > 0)
        .slice(0, 3)
}

const MejoresDias_makeCardBase = (isMobile: boolean): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "16px" : "22px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    border: "1px solid #f1f5f9",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
})

const MejoresDias_makeTitleStyle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 14 : 16,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const MejoresDias_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

function TopServicios_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return { isMobile: width < 480, isTablet: width >= 480 && width < 768 }
}

const TopServicios_PALETTE = [
    { line: "#22c55e", fill: "#22c55e", glow: "rgba(34,197,94,0.25)" },
    { line: "#6366f1", fill: "#6366f1", glow: "rgba(99,102,241,0.25)" },
    { line: "#f59e0b", fill: "#f59e0b", glow: "rgba(245,158,11,0.25)" },
]

function TopServicios_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function TopServicios_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

const TopServicios_MOCK_TURNOS = [
    ...[
        "Corte Clásico",
        "Corte Clásico",
        "Corte Básico",
        "Barba",
        "Corte Clásico",
        "Corte Clásico",
        "Barba",
    ].map((s, i) => ({ fecha: `2025-05-0${i + 1}`, servicio: s })),
    ...[
        "Corte Clásico",
        "Corte Básico",
        "Corte Clásico",
        "Barba",
        "Corte Básico",
        "Barba",
        "Corte Clásico",
    ].map((s, i) => ({ fecha: `2025-05-${i + 8}`, servicio: s })),
    ...[
        "Corte Clásico",
        "Corte Básico",
        "Barba",
        "Corte Básico",
        "Barba",
        "Corte Clásico",
        "Corte Clásico",
    ].map((s, i) => ({ fecha: `2025-05-${i + 15}`, servicio: s })),
    ...[
        "Barba",
        "Corte Clásico",
        "Corte Básico",
        "Corte Clásico",
        "Barba",
        "Corte Clásico",
        "Corte Básico",
    ].map((s, i) => ({ fecha: `2025-05-${i + 22}`, servicio: s })),
]

interface TopServicios_ServicioData {
    nombre: string
    semanas: number[]
    total: number
    line: string
    fill: string
    glow: string
}

function TopServicios_procesarTurnos(
    turnosLista: any[]
): TopServicios_ServicioData[] {
    const porServicio: Record<string, number[]> = {}
    turnosLista.forEach((t) => {
        const svc = t.servicio || t.servicio_nombre || ""
        if (!svc || svc === "null") return
        const dia = parseInt((t.fecha || "").split("-")[2] || "1")
        const semIdx = dia <= 7 ? 0 : dia <= 14 ? 1 : dia <= 21 ? 2 : 3
        if (!porServicio[svc]) porServicio[svc] = [0, 0, 0, 0]
        porServicio[svc][semIdx]++
    })
    return Object.entries(porServicio)
        .map(([nombre, semanas]) => ({
            nombre,
            semanas,
            total: semanas.reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3)
        .map((s, i) => ({ ...s, ...TopServicios_PALETTE[i] }))
}

const TopServicios_makeCardBase = (isMobile: boolean): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "16px" : "22px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    border: "1px solid #f1f5f9",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "visible",
    position: "relative",
})

const TopServicios_makeTitleStyle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 14 : 16,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const TopServicios_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

function HorasTrabajadas_useBreakpoint() {
    const [width, setWidth] = React.useState(
        typeof window !== "undefined" ? window.innerWidth : 375
    )
    React.useEffect(() => {
        const handler = () => setWidth(window.innerWidth)
        window.addEventListener("resize", handler)
        return () => window.removeEventListener("resize", handler)
    }, [])
    return { isMobile: width < 480, isTablet: width >= 480 && width < 768 }
}

function HorasTrabajadas_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function HorasTrabajadas_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function HorasTrabajadas_minutosATexto(min: number): {
    horas: number
    minutos: number
    corto: string
    largo: string
} {
    const horas = Math.floor(min / 60)
    const minutos = min % 60
    const corto = minutos > 0 ? `${horas}h ${minutos}m` : `${horas}h`
    const largo =
        horas === 0
            ? `${minutos} min`
            : minutos === 0
              ? `${horas} hora${horas !== 1 ? "s" : ""}`
              : `${horas}h ${minutos}m`
    return { horas, minutos, corto, largo }
}

const HorasTrabajadas_MOCK_STATS: any = {
    turnosMes: 22,
    turnosHoy: 4,
    config: { duracion: 40 },
    turnosLista: (() => {
        const now = new Date()
        const anio = now.getFullYear()
        const mes = now.getMonth() + 1
        const hoy = now.getDate()
        const curve = [
            1, 1, 2, 1, 3, 2, 4, 3, 2, 3, 4, 3, 2, 3, 4, 3, 2, 3, 4, 3, 4, 3, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
        ]
        const lista: any[] = []
        for (let d = 1; d <= hoy; d++) {
            const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`
            for (let t = 0; t < (curve[d - 1] || 0); t++)
                lista.push({ fecha, duracion: 40 })
        }
        return lista
    })(),
}

function HorasTrabajadas_diasUnicos(turnosLista: any[]): number {
    const fechas = new Set(
        (turnosLista || []).map((t) => t.fecha).filter(Boolean)
    )
    return fechas.size
}

const HorasTrabajadas_makeCardBase = (
    isMobile: boolean
): React.CSSProperties => ({
    width: "100%",
    height: "100%",
    padding: isMobile ? "12px" : "16px",
    borderRadius: isMobile ? 16 : 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    border: "1px solid #f1f5f9",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
})

const HorasTrabajadas_makeTitleStyle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 13 : 14,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.3px",
})

const HorasTrabajadas_makeSectionTitle = (
    isMobile: boolean
): React.CSSProperties => ({
    fontSize: isMobile ? 9 : 10,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
})

const HorasTrabajadas_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

function ServiciosManager_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function ServiciosManager_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("turnits_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function ServiciosManager_parseDesc(raw: string): {
    imagen: string
    descripcion: string
} {
    const match = (raw || "").match(/^\[img:(.*?)\](.*)$/s)
    if (match) return { imagen: match[1].trim(), descripcion: match[2].trim() }
    return { imagen: "", descripcion: raw || "" }
}

function ServiciosManager_buildDesc(
    imagen: string,
    descripcion: string
): string {
    if (!imagen) return descripcion
    return `[img:${imagen.trim()}]${descripcion}`
}

function ServiciosManager_useContainerWidth(
    ref: React.RefObject<HTMLDivElement>
) {
    return Turnits_useElementWidth(ref, 600)
}

function ServiciosManager_formatDuracion(min: number): string {
    if (min < 60) return `${min} min`
    if (min === 90) return "1h 30min"
    if (min % 60 === 0) return `${min / 60}h`
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m}min`
}

interface ServiciosManager_Servicio {
    owner_equipo_id?: string | null
    creador?: CatalogoProfesional | null
    profesionales?: CatalogoProfesional[]
    id: string
    nombre: string
    descripcion: string
    imagen: string
    duracion: number
    precio: number
    capacidad: number
    activo: boolean
    orden: number
}

interface ServiciosManager_FormData {
    nombre: string
    descripcion: string
    imagen: string
    duracion: string
    precio: string
    capacidad: string
    orden: string
}

interface ServiciosManager_Extra {
    owner_equipo_id?: string | null
    creador?: CatalogoProfesional | null
    profesionales?: CatalogoProfesional[]
    compartido?: boolean
    puede_editar?: boolean
    id: string
    nombre: string
    descripcion: string
    precio: number
    imagen_url: string
    activo: boolean
    orden: number
}

interface ServiciosManager_ExtraFormData {
    nombre: string
    descripcion: string
    precio: string
    imagen_url: string
    orden: string
}

const ServiciosManager_PRECIO_MINIMO = 2500

const ServiciosManager_PRECIO_MINIMO_EXTRA = 1500

const ServiciosManager_FORM_EMPTY: ServiciosManager_FormData = {
    nombre: "",
    descripcion: "",
    imagen: "",
    duracion: "30",
    precio: "0",
    capacidad: "1",
    orden: "0",
}

const ServiciosManager_EXTRA_FORM_EMPTY: ServiciosManager_ExtraFormData = {
    nombre: "",
    descripcion: "",
    precio: "0",
    imagen_url: "",
    orden: "0",
}

const ServiciosManager_DURACIONES = [15, 20, 30, 45, 60, 90, 120]

const ServiciosManager_cardBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "22px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
}

const ServiciosManager_shimmerCSS = `
@keyframes svc-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.svc-shimmer {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: svc-shimmer 1.4s infinite;
}
.svc-card:hover { background: #fafcff !important; }
.svc-input:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-10); }
.svc-btn-icon:hover { opacity: 0.7; }
.svc-dur:hover { border-color: var(--accent-30) !important; }
.svc-dur.active { background: var(--accent) !important; color: #fff !important; border-color: var(--accent) !important; box-shadow: 0 2px 8px var(--accent-30); }
.svc-upload-zone:hover { border-color: var(--accent) !important; background: var(--accent-05) !important; }
.svc-save-btn:hover { filter: brightness(1.06); }
.svc-tab { padding: 7px 14px; border-radius: 9px; border: none; background: transparent; font-size: 12.5px; font-weight: 700; color: #94a3b8; cursor: pointer; font-family: 'Inter Display', -apple-system, sans-serif; transition: all 0.15s; white-space: nowrap; }
@media (max-width: 600px) {
 .svc-catalog-tabs .svc-tab {min-width:0;padding:7px 3px;font-size:11px;gap:4px!important;}
 .svc-catalog-tabs .svc-tab svg {width:14px;height:14px;flex-shrink:0;}
}
.svc-tab.active { background: #fff; color: #1e293b; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
@keyframes svc-spin { to { transform: rotate(360deg); } }
`

interface ServiciosManager_ImageUploaderProps {
    value: string
    onChange: (url: string) => void
    accentColor: string
    apiUrl: string
    iconoFormUrl?: string
    uploadPath?: string
}

interface ServiciosManager_FormProps {
    initial?: ServiciosManager_FormData
    accentColor: string
    apiUrl: string
    iconoFormUrl?: string
    onSubmit: (data: ServiciosManager_FormData) => Promise<void>
    onCancel: () => void
    guardando: boolean
    error: string
    modoEdicion: boolean
    isMobile: boolean
    servicioId?: string
    uploadPath?: string
    employeeVariant?: boolean
    employeeMode?: boolean
}

interface ServiciosManager_ExtraFormProps {
    employeeMode?: boolean
    initial?: ServiciosManager_ExtraFormData
    accentColor: string
    apiUrl: string
    iconoFormUrl?: string
    onSubmit: (data: ServiciosManager_ExtraFormData) => Promise<void>
    onCancel: () => void
    guardando: boolean
    error: string
    modoEdicion: boolean
    isMobile: boolean
}

function ServiciosManager_EmployeeCardStyle(item:any):React.CSSProperties {
    if(!item.owner_equipo_id)return {}
    const miembro=item.creador || item.profesionales?.find((p:any)=>p.id === item.owner_equipo_id)
    let color=String(miembro?.color || "#64748b").trim()
    if(/^#[0-9a-f]{3}$/i.test(color))color="#"+color.slice(1).split("").map(c=>c+c).join("")
    if(!/^#[0-9a-f]{6}$/i.test(color))color="#64748b"
    // Mezclar con blanco mantiene un fondo suave y reconocible sobre cualquier panel.
    const canales=[1,3,5].map(i=>Math.round(255*0.88+parseInt(color.slice(i,i+2),16)*0.12))
    return {background:`rgb(${canales.join(",")})`,borderColor:color+"20",opacity: item.activo === false || item.activo === "false" ? 0.5 : 0.8}
}

type CatalogoProfesional = {id:string;nombre:string;apellido?:string;foto_url?:string;color?:string}

function ClientesGrid_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function ClientesGrid_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function ClientesGrid_useContainerWidth(ref: React.RefObject<HTMLDivElement>) {
    return Turnits_useElementWidth(ref, 800)
}

function ClientesGrid_getColumnas(
    containerWidth: number,
    columnasProp: number
): number {
    if (containerWidth < 360) return 2
    if (containerWidth < 500) return Math.min(columnasProp, 2)
    if (containerWidth < 680) return Math.min(columnasProp, 3)
    return columnasProp
}

function ClientesGrid_buildClientes(turnosLista: any[]): any[] {
    const map = new Map<string, any>()
    ;(turnosLista || []).forEach((t) => {
        const key = t.telefono || t.email || ""
        if (!key) return
        if (!map.has(key)) {
            map.set(key, {
                nombre: t.nombre || "—",
                apellido: t.apellido || "",
                email: t.email || null,
                telefono: t.telefono || null,
                turnos: 0,
                ultima_fecha: t.fecha || "",
            })
        }
        const c = map.get(key)
        c.turnos++
        // Guardamos la fecha más reciente para ordenar después
        if (t.fecha && t.fecha > c.ultima_fecha) c.ultima_fecha = t.fecha
    })
    // Ordenados por fecha más reciente primero
    return Array.from(map.values()).sort((a, b) =>
        b.ultima_fecha.localeCompare(a.ultima_fecha)
    )
}

function ClientesGrid_frecuenciaLabel(turnos: number): string {
    if (turnos >= 5) return "Concurrente"
    if (turnos >= 2) return "Regular"
    return "Irregular"
}

function ClientesGrid_frecuenciaColor(f: string, accent: string): string {
    if (f === "Concurrente") return accent
    if (f === "Regular") return "#f59e0b"
    return "#94a3b8"
}

const ClientesGrid_MOCK_CLIENTES = Array.from({ length: 12 }, (_, i) => ({
    nombre: ["Gonzalo", "Valentina", "Marcos", "Lucía"][i % 4],
    apellido: ["Pérez", "López", "Suárez", "García"][i % 4],
    email: i % 3 === 0 ? "cliente@gmail.com" : null,
    telefono: `351${String(2000000 + i * 111111).slice(0, 7)}`,
    turnos: i < 4 ? 7 : i < 8 ? 3 : 1,
    ultima_fecha: "2025-06-01",
}))

const ClientesGrid_LIMITE_GRATIS = 10

const ClientesGrid_wrapperBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "22px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "auto",
}

const ClientesGrid_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

function AgendaPanel_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function AgendaPanel_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function AgendaPanel_formatFecha(iso: string): string {
    const [, m, d] = iso.split("-").map(Number)
    const meses = [
        "Ene",
        "Feb",
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep",
        "Oct",
        "Nov",
        "Dic",
    ]
    return `${String(d).padStart(2, "0")} de ${meses[m - 1]}`
}

function AgendaPanel_formatFechaParts(iso: string): {
    dia: string
    semana: string
} {
    const [, , d] = iso.split("-").map(Number)
    const semanas = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const fecha = new Date(`${iso}T12:00:00`)
    return { dia: String(d).padStart(2, "0"), semana: semanas[fecha.getDay()] }
}

function AgendaPanel_hoyISO(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function AgendaPanel_cleanTel(tel: string): string {
    const digits = (tel || "").replace(/\D/g, "")
    return digits.startsWith("54") ? digits.slice(2) : digits
}

function AgendaPanel_filtrarPasados(dias: any[]): any[] {
    const ahora = new Date()
    return dias
        .map((d) => ({
            ...d,
            turnos: d.turnos.filter((t: any) => {
                const fechaTurno = new Date(`${d.fecha}T${t.hora}:00`)
                return fechaTurno > ahora
            }),
        }))
        .filter((d) => d.turnos.length > 0)
}

function AgendaPanel_esPendienteAprobacion(turno: any): boolean {
    return (
        turno?.estado === "pendiente" &&
        (turno?.metodo_pago === "transferencia" ||
            turno?.metodo_pago === "efectivo")
    )
}

function AgendaPanel_tieneReprogramacionPendiente(turno: any): boolean {
    return !!turno?.reprogramacion_pendiente
}

function AgendaPanel_faltaProfesional(turno: any): boolean {
    return turno?.estado === "confirmado" && !turno?.equipo_id
}

function AgendaPanel_metodoPagoLabel(metodo: string): string {
    if (metodo === "transferencia") return "Transferencia"
    if (metodo === "efectivo") return "Efectivo"
    if (metodo === "mercadopago") return "Mercado Pago"
    return "Sin especificar"
}

function AgendaPanel_estadoPagoLabel(estado: string): string {
    if (estado === "aprobado") return "Aprobado"
    if (estado === "pendiente") return "Pendiente de revisión"
    if (estado === "rechazado") return "Rechazado"
    return "Sin pago"
}

function AgendaPanel_formatMonto(v: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(v || 0)
}

function AgendaPanel_extrasLabel(extras: any): string {
    if (!Array.isArray(extras) || extras.length === 0) return ""
    return extras
        .map((e) => (typeof e === "string" ? e : e?.nombre))
        .filter(Boolean)
        .join(", ")
}

function AgendaPanel_tieneExtras(extras: any): boolean {
    return Array.isArray(extras) && extras.length > 0
}

function AgendaPanel_useContainerWidth(ref: React.RefObject<HTMLDivElement>) {
    return Turnits_useElementWidth(ref, 800)
}

function AgendaPanel_mockDias() {
    const now = new Date()
    const hoy = now.toISOString().split("T")[0]
    const dias: any[] = [
        {
            fecha: hoy,
            esHoy: true,
            turnos: [
                {
                    id: "1",
                    nombre: "Fede",
                    hora: "15:30",
                    telefono: "3512110001",
                    email: "fede@mail.com",
                    estado: "confirmado",
                    metodo_pago: "mercadopago",
                    pago_estado: "aprobado",
                },
                {
                    id: "2",
                    nombre: "Gonzalo",
                    hora: "16:30",
                    telefono: "3512110002",
                    email: null,
                    estado: "pendiente",
                    metodo_pago: "transferencia",
                    pago_estado: "pendiente",
                    servicio: "Corte + Barba",
                    extras: [
                        { id: "e1", nombre: "Cera capilar", precio: 1500 },
                    ],
                    precio_cobrado: 12000,
                },
                {
                    id: "3",
                    nombre: "Lauta",
                    hora: "17:00",
                    telefono: "3512110003",
                    email: "lauta@mail.com",
                    estado: "confirmado",
                    metodo_pago: "none",
                    pago_estado: "sin_pago",
                    // NUEVO: ejemplo de turno con reprogramación pendiente
                    reprogramacion_pendiente: {
                        id: "r1",
                        fecha_propuesta: hoy,
                        hora_propuesta: "19:00",
                    },
                },
                {
                    id: "4",
                    nombre: "Juan Pablo",
                    hora: "17:30",
                    telefono: "3512110004",
                    email: null,
                    estado: "pendiente",
                    metodo_pago: "efectivo",
                    pago_estado: "sin_pago",
                    servicio: "Corte",
                    extras: [{ id: "e2", nombre: "Lavado", precio: 1500 }],
                    precio_cobrado: 9500,
                },
                {
                    id: "5",
                    nombre: "Tomi",
                    hora: "18:30",
                    telefono: "3512110005",
                    email: "tomi@mail.com",
                    estado: "confirmado",
                    metodo_pago: "mercadopago",
                    pago_estado: "aprobado",
                    extras: [
                        { id: "e3", nombre: "Shampoo anticaspa", precio: 1200 },
                    ],
                    precio_cobrado: 5000,
                },
            ],
        },
    ]
    for (let i = 1; i <= 5; i++) {
        const d = new Date(now)
        d.setDate(now.getDate() + i * 2)
        const fecha = d.toISOString().split("T")[0]
        const cant = 2 + (i % 3)
        dias.push({
            fecha,
            esHoy: false,
            turnos: Array.from({ length: cant }, (_, t) => ({
                id: `mock-${i}-${t}`,
                nombre: ["Fede", "Gonza", "Vale", "Marcos", "Sofi"][t % 5],
                hora: `${14 + t}:${t % 2 === 0 ? "00" : "30"}`,
                telefono: `351211000${t}`,
                email: t % 2 === 0 ? "cliente@mail.com" : null,
                estado: t === 0 && i % 2 === 0 ? "pendiente" : "confirmado",
                metodo_pago:
                    t === 0 && i % 2 === 0 ? "transferencia" : "mercadopago",
                pago_estado: t === 0 && i % 2 === 0 ? "pendiente" : "aprobado",
            })),
        })
    }
    return dias
}

const AgendaPanel_INK = "#12131A"

const AgendaPanel_SLATE = "#1B6B1A"

const AgendaPanel_HAIRLINE = "#E7E5E2"

const AgendaPanel_CANVAS = "#FFFFFF"

const AgendaPanel_SURFACE = "#FFFFFF"

const AgendaPanel_GHOST = "rgba(18,19,26,0.05)"

const AgendaPanel_FONT_DISPLAY =
    "'Space Grotesk', 'Inter Display', -apple-system, sans-serif"

const AgendaPanel_FONT_BODY = "'Inter Display', -apple-system, sans-serif"

const AgendaPanel_labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontSize: 11,
    fontWeight: 700,
    color: "#9A9A94",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
}

const AgendaPanel_inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 11,
    border: `1px solid ${AgendaPanel_HAIRLINE}`,
    background: "#FFFFFF",
    color: AgendaPanel_INK,
    // 16px evita el zoom automático de iOS al enfocar un input
    fontSize: 16,
    fontWeight: 500,
    fontFamily: AgendaPanel_FONT_BODY,
    textTransform: "none",
    letterSpacing: "normal",
    outline: "none",
}

const AgendaPanel_wrapperBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "20px",
    border: "1px solid #E2E2E2",
    borderRadius: 22,
    background: AgendaPanel_CANVAS,
    display: "flex",
    flexDirection: "column",
    fontFamily: AgendaPanel_FONT_BODY,
    boxSizing: "border-box",
    overflow: "hidden",
}

const AgendaPanel_globalCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`

const HorariosConfig_DIAS_CONFIG = [
    { key: "lunes", label: "Lunes" },
    { key: "martes", label: "Martes" },
    { key: "miercoles", label: "Miércoles" },
    { key: "jueves", label: "Jueves" },
    { key: "viernes", label: "Viernes" },
    { key: "sabado", label: "Sábado" },
    { key: "domingo", label: "Domingo" },
]

const HorariosConfig_HORARIOS_VACIO: Record<string, any> = {
    lunes: { activo: false, jornada: [null, null], descanso: [null, null] },
    martes: { activo: false, jornada: [null, null], descanso: [null, null] },
    miercoles: { activo: false, jornada: [null, null], descanso: [null, null] },
    jueves: { activo: false, jornada: [null, null], descanso: [null, null] },
    viernes: { activo: false, jornada: [null, null], descanso: [null, null] },
    sabado: { activo: false, jornada: [null, null], descanso: [null, null] },
    domingo: { activo: false, jornada: [null, null], descanso: [null, null] },
}

const HorariosConfig_HORARIOS_EJEMPLO_CANVAS: Record<string, any> = {
    lunes: {
        activo: true,
        jornada: ["09:00", "20:00"],
        descanso: ["13:00", "15:00"],
    },
    martes: {
        activo: true,
        jornada: ["09:00", "20:00"],
        descanso: ["13:00", "15:00"],
    },
    miercoles: {
        activo: true,
        jornada: ["09:00", "20:00"],
        descanso: ["13:00", "15:00"],
    },
    jueves: {
        activo: true,
        jornada: ["09:00", "20:00"],
        descanso: ["13:00", "15:00"],
    },
    viernes: {
        activo: true,
        jornada: ["09:00", "20:00"],
        descanso: ["13:00", "15:00"],
    },
    sabado: { activo: false, jornada: [null, null], descanso: [null, null] },
    domingo: { activo: false, jornada: [null, null], descanso: [null, null] },
}

function HorariosConfig_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    if (fromUrl) return fromUrl.toLowerCase().trim()
    return (
        localStorage.getItem("user_slug") || localStorage.getItem("slug") || ""
    )
}

function HorariosConfig_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function HorariosConfig_useContainerWidth(
    ref: React.RefObject<HTMLDivElement>
) {
    return Turnits_useElementWidth(ref, 600)
}

const HorariosConfig_cardBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "22px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
}

const HorariosConfig_shimmerCSS = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`

type ExcepcionesConfig_ExcType = "block" | "custom"

type ExcepcionesConfig_Slot = [string, string]

type ExcepcionesConfig_Excepcion = {
    type: ExcepcionesConfig_ExcType
    slots?: ExcepcionesConfig_Slot[]
}

type ExcepcionesConfig_Excepciones = Record<string, ExcepcionesConfig_Excepcion>

const ExcepcionesConfig_MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
]

function ExcepcionesConfig_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function ExcepcionesConfig_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function ExcepcionesConfig_makeDateKey(
    y: number,
    m: number,
    d: number
): string {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

function ExcepcionesConfig_getMonthStart(y: number, m: number): number {
    const dow = new Date(y, m, 1).getDay()
    return dow === 0 ? 6 : dow - 1
}

function ExcepcionesConfig_getDaysInMonth(y: number, m: number): number {
    return new Date(y, m + 1, 0).getDate()
}

function ExcepcionesConfig_useContainerWidth(
    ref: React.RefObject<HTMLDivElement>
) {
    return Turnits_useElementWidth(ref, 600)
}

const ExcepcionesConfig_shimmerCSS = `
@keyframes exc-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.exc-shimmer {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: exc-shimmer 1.4s infinite;
    border-radius: 8px;
}
`

const ExcepcionesConfig_timeInputStyle: React.CSSProperties = {
    flex: 1,
    width: "100%",
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 13,
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    color: "#1e293b",
    background: "#fff",
    boxSizing: "border-box",
}

interface ExcepcionesConfig_DayPanelProps {
    dayKey: string
    excepcion: ExcepcionesConfig_Excepcion | null
    accentColor: string
    isMobile: boolean
    onSave: (key: string, exc: ExcepcionesConfig_Excepcion | null) => void
    onClose: () => void
}

interface ExcepcionesConfig_Props {
    baseUrl: string
    accentColor: string
    employeeMode?: boolean
    style?: React.CSSProperties
}

function MercadoPagoConexion_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function MercadoPagoConexion_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

async function MercadoPagoConexion_solicitarUrlOAuth(
    api: string,
    slug: string,
    token: string,
    employeeMode = false
): Promise<string> {
    const res = await fetch(
        employeeMode
            ? `${api.replace(/\/+$/, "")}/empleado/${encodeURIComponent(slug)}/mp/connect`
            : `${api.replace(/\/+$/, "")}/mp/connect/${encodeURIComponent(slug)}`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.authorization_url) {
        throw new Error(
            data.error || "No se pudo iniciar la conexión con Mercado Pago."
        )
    }
    return data.authorization_url
}

function Pagos_baselineDesdeSettings(s: any) {
    const b = s?.datos_bancarios || {}
    // Básico/Premium nunca queda sin Seña ni Total: si el servidor trae "none"
    // (o nada) se toma Total como default. Es solo un default: el cliente
    // puede cambiar a Seña cuando quiera.
    const esPremiumPlan = ["basico", "premium"].includes(s?.plan)
    return {
        metodo_pago: ["none", "sena", "total"].includes(s?.metodo_pago)
            ? esPremiumPlan && s.metodo_pago === "none"
                ? "total"
                : s.metodo_pago
            : esPremiumPlan
              ? "total"
              : "none",
        porcentaje_sena: Number(s?.porcentaje_sena ?? 30),
        acepta_transferencia: !!s?.acepta_transferencia,
        acepta_efectivo: !!s?.acepta_efectivo,
        datos_bancarios: {
            banco: b.banco || "",
            titular: b.titular || "",
            cbu: b.cbu || "",
            alias: b.alias || "",
        },
    }
}

function MercadoPagoConexion_emitPagosChanged(cambios: Record<string, any>) {
    if (typeof window === "undefined") return
    const actual =
        typeof (window as any).getPagosConfig === "function"
            ? (window as any).getPagosConfig() || {}
            : {}
    const nuevo = { ...actual, ...cambios }
    ;(window as any).getPagosConfig = () => nuevo
    window.dispatchEvent(new CustomEvent("pagos_changed", { detail: nuevo }))
}

const MercadoPagoConexion_globalCSS = `
@keyframes pg-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.pg-shimmer {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: pg-shimmer 1.4s infinite;
    border-radius: 8px;
}
.pg-card-mp {
    transition: box-shadow 0.15s, transform 0.15s;
    cursor: pointer;
}
.pg-card-mp:hover {
    transform: translateY(-1px);
}
.pg-switch {
    position: relative;
    width: 38px;
    height: 22px;
    border-radius: 99px;
    flex-shrink: 0;
    cursor: pointer;
    border: none;
    padding: 0;
    transition: background 0.18s;
}
.pg-switch-knob {
    position: absolute;
    top: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    transition: left 0.18s;
}
.pg-switch.off { background: #cbd5e1; }
.pg-switch.off .pg-switch-knob { left: 2px; }
.pg-switch.on .pg-switch-knob { left: 18px; }
.pg-switch:disabled { opacity: 0.5; cursor: default; }
`

const MercadoPagoConexion_cardBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "22px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "auto",
}

const MercadoPagoConexion_inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    fontSize: 12.5,
    padding: "9px 11px",
    borderRadius: 9,
    border: "1px solid #e2e8f0",
    outline: "none",
    color: "#1e293b",
    background: "#fff",
}

const MercadoPagoConexion_CBU_REGEX = /^\d{22}$/

const MercadoPagoConexion_ALIAS_REGEX = /^[a-zA-Z0-9._-]{6,30}$/

type MercadoPagoConexion_EstadoConexion =
    | "conectado"
    | "desconectado"
    | "loading"

type MercadoPagoConexion_MetodoPago = "none" | "sena" | "total"

type MercadoPagoConexion_DatosBancarios = {
    banco: string
    titular: string
    cbu: string
    alias: string
}

const ConfigPagos_SENA_MINIMA = 20

function ConfigPagos_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function ConfigPagos_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function ConfigPagos_useContainerWidth(ref: React.RefObject<HTMLDivElement>) {
    return Turnits_useElementWidth(ref, 600)
}

type ConfigPagos_MetodoPago = "none" | "sena" | "total"

const ConfigPagos_cardBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "22px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
}

const ConfigPagos_shimmerCSS = `
@keyframes cp-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.cp-shimmer {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: cp-shimmer 1.4s infinite;
    border-radius: 8px;
}
.cp-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--accent, #22c55e);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    border: 2px solid #fff;
}
.cp-slider::-moz-range-thumb {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: var(--accent, #22c55e);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    border: 2px solid #fff;
}
.cp-slider {
    -webkit-appearance: none;
    width: 100%; height: 4px;
    border-radius: 4px;
    outline: none;
    cursor: pointer;
}
`

interface ConfigPagos_OpcionMetodoProps {
    id: ConfigPagos_MetodoPago
    activo: boolean
    accentColor: string
    icono: string
    titulo: string
    descripcion: string
    tag?: string
    isMobile: boolean
    onClick: () => void
    locked?: boolean
    children?: React.ReactNode
}

function ThemeEditor_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function ThemeEditor_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("auth_token") ||
        ""
    )
}

interface ThemeEditor_Tema extends BusinessAppearance {
    primario: string
    secundario: string
    fondo: string
    texto: string
    acento: string
}

const ThemeEditor_TEMA_DEFAULT: ThemeEditor_Tema = {
    ...DEFAULT_APPEARANCE,
    primario: "#1F2937",
    secundario: "#6B7280",
    fondo: "#FFFFFF",
    texto: "#111827",
    acento: "#9CA3AF",
}

const ThemeEditor_COLOR_KEYS: Array<keyof ThemeEditor_Tema> = [
    "primario",
    "secundario",
    "fondo",
    "texto",
    "acento",
]

function ThemeEditor_temaCompleto(
    raw?: Partial<ThemeEditor_Tema> | null
): ThemeEditor_Tema {
    return { ...ThemeEditor_TEMA_DEFAULT, ...(raw || {}),
        forma_tarjetas: CARD_SHAPES.some(s => s.value === raw?.forma_tarjetas) ? raw!.forma_tarjetas : DEFAULT_APPEARANCE.forma_tarjetas,
        forma_icono: ICON_SHAPES.some(s => s.value === raw?.forma_icono) ? raw!.forma_icono : DEFAULT_APPEARANCE.forma_icono }
}

function ThemeEditor_mismoTema(
    a: ThemeEditor_Tema,
    b: ThemeEditor_Tema
): boolean {
    return (a.forma_tarjetas || "original") === (b.forma_tarjetas || "original") &&
        (a.forma_icono || "original") === (b.forma_icono || "original") && ThemeEditor_COLOR_KEYS.every(
        (k) => (a[k] || "").toLowerCase() === (b[k] || "").toLowerCase()
    )
}

const ThemeEditor_PALETAS = [
    {
        nombre: "Neutro",
        tema: {
            primario: "#1F2937",
            secundario: "#6B7280",
            fondo: "#FFFFFF",
            texto: "#111827",
            acento: "#9CA3AF",
        },
    },
    {
        nombre: "Rosa pálido",
        tema: {
            primario: "#9B6977",
            secundario: "#E9D8DD",
            fondo: "#FFFCFD",
            texto: "#3F3437",
            acento: "#D5B4BE",
        },
    },
    {
        nombre: "Menta suave",
        tema: {
            primario: "#567261",
            secundario: "#DCE9E1",
            fondo: "#FBFDFC",
            texto: "#2F3B34",
            acento: "#AEC8B7",
        },
    },
    {
        nombre: "Cielo suave",
        tema: {
            primario: "#587B91",
            secundario: "#DCE8EF",
            fondo: "#FBFDFE",
            texto: "#2C3840",
            acento: "#A9C1D1",
        },
    },
    {
        nombre: "Arena suave",
        tema: {
            primario: "#796847",
            secundario: "#ECE5D9",
            fondo: "#FFFDF9",
            texto: "#3C352A",
            acento: "#CBBB9F",
        },
    },
    { nombre: "Lavanda", tema: { primario: "#6D598C", secundario: "#E8E0F1", fondo: "#FDFBFF", texto: "#352C43", acento: "#C7B5DD" } },
    { nombre: "Durazno", tema: { primario: "#9C614B", secundario: "#F3E2D9", fondo: "#FFFCFA", texto: "#48332B", acento: "#DEB6A1" } },
    { nombre: "Oliva", tema: { primario: "#66714B", secundario: "#E5E9D9", fondo: "#FCFDF9", texto: "#343A29", acento: "#BCC79E" } },
    { nombre: "Coral", tema: { primario: "#A45655", secundario: "#F4DFDD", fondo: "#FFFBFA", texto: "#482D2D", acento: "#DDA5A0" } },
    { nombre: "Lino", tema: { primario: "#776754", secundario: "#EBE5DC", fondo: "#FEFCF8", texto: "#3F372E", acento: "#C9BBA6" } },
    { nombre: "Celeste gris", tema: { primario: "#546F87", secundario: "#DFE7EE", fondo: "#FAFCFE", texto: "#2B3742", acento: "#ADC0D0" } },
    { nombre: "Malva", tema: { primario: "#875F7C", secundario: "#EDDFE9", fondo: "#FFFBFE", texto: "#402F3B", acento: "#D2ACC7" } },
]

const ThemeEditor_cardBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "22px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box" as const,
    overflow: "hidden",
}

const ThemeEditor_shimmerCSS = `
@keyframes te-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.te-shimmer {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: te-shimmer 1.4s infinite;
}
@keyframes te-spin { to { transform: rotate(360deg); } }
@keyframes te-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
.te-paleta:hover { transform: scale(1.06); box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important; }
.te-drop-zone:hover { border-color: var(--accent) !important; background: var(--accent-05) !important; }
.te-color-swatch:hover { transform: scale(1.08); }
.te-tab:hover { background: #f1f5f9 !important; }
`

function TeamManager_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function TeamManager_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

interface TeamManager_Miembro {
    id: string
    nombre: string
    apellido: string | null
    color: string
    rol: string
    activo: boolean
    foto_url: string | null
    es_dueño: boolean
    login_email?: string | null
    login_activado?: boolean
    puede_configurar_horarios?: boolean
    puede_recibir_pagos_personales?: boolean
    puede_crear_servicios?: boolean
    created_at: string
}

interface TeamManager_OwnerFallback {
    nombre: string
    apellido: string
}

interface TeamManager_FormData {
    nombre: string
    apellido: string
    color: string
    rol: string
    foto_url: string
    login_email: string
    puede_configurar_horarios: boolean
    puede_recibir_pagos_personales: boolean
    puede_crear_servicios: boolean
}

interface TeamManager_ServicioAsignable {
    id: string
    nombre: string
    precio: number
    duracion: number
    activo: boolean
    vinculado: boolean
}

const TeamManager_COLORES = [
    "#6366F1",
    "#EC4899",
    "#10B981",
    "#F59E0B",
    "#3B82F6",
    "#EF4444",
    "#8B5CF6",
    "#14B8A6",
    "#F97316",
    "#06B6D4",
]

const TeamManager_ROLES = ["colaborador", "admin"]

const TeamManager_FORM_EMPTY: TeamManager_FormData = {
    nombre: "",
    apellido: "",
    color: TeamManager_COLORES[0],
    rol: "colaborador",
    foto_url: "",
    login_email: "",
    puede_configurar_horarios: false,
    puede_recibir_pagos_personales: false,
    puede_crear_servicios: false,
}

const TeamManager_cardBase: React.CSSProperties = {
    width: "100%",
    height: "100%",
    padding: "22px",
    borderRadius: 20,
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter Display', -apple-system, sans-serif",
    boxSizing: "border-box",
    overflow: "hidden",
}

const TeamManager_shimmerCSS = `
@keyframes tm-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
@keyframes tm-spin {
    to { transform: rotate(360deg); }
}
.tm-shimmer {
    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
    background-size: 200% 100%;
    animation: tm-shimmer 1.4s infinite;
}
.tm-card:hover { background: #fafcff !important; }
.tm-input:focus { outline: none; border-color: var(--tm-accent) !important; }
.tm-btn-icon:hover { opacity: 0.7; }
.tm-color-dot:hover { transform: scale(1.2); }
`

const TeamManager_PERIODOS_NETO = [
    { id: "dia", label: "Hoy" },
    { id: "semana", label: "Semana" },
    { id: "mes", label: "Mes" },
]

interface TeamManager_NetoData {
    turnos: number
    bruto: number
    comision_mp: number
    comision_plataforma: number
    neto: number
    turnos_sin_comision: number
}

function TeamManager_fmtPesos(n: number): string {
    return (
        "$" +
        (Number(n) || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })
    )
}

function TeamManager_useContainerWidth(ref: React.RefObject<HTMLDivElement>) {
    return Turnits_useElementWidth(ref, 600)
}

type SeccionId =
    | "perfil"
    | "inicio"
    | "servicios"
    | "clientes"
    | "agenda"
    | "horarios"
    | "pagos"
    | "finanzas"
    | "temas"
    | "equipo"

const NAV_ITEMS: { id: SeccionId; label: string }[] = [
    { id: "inicio", label: "Inicio" },
    { id: "servicios", label: "Servicios" },
    { id: "clientes", label: "Clientes" },
    { id: "agenda", label: "Agenda" },
    { id: "horarios", label: "Horarios" },
    { id: "pagos", label: "Pagos" },
    { id: "finanzas", label: "Finanzas" },
    { id: "temas", label: "Temas" },
    { id: "equipo", label: "Equipo" },
    { id: "perfil", label: "Perfil" },
]

function MenuUserAvatar({
    logoImage,
    size = 34,
}: {
    logoImage?: string | null
    size?: number
}) {
    const [imgError, setImgError] = React.useState(false)
    const mostrarImagen = !!logoImage && !imgError

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#e2e8f0",
            }}
        >
            {mostrarImagen ? (
                <img
                    src={logoImage!}
                    alt="Perfil"
                    onError={() => setImgError(true)}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            ) : (
                <svg
                    width={size * 0.62}
                    height={size * 0.62}
                    viewBox="0 0 24 24"
                    fill="#94a3b8"
                >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7v1H4v-1Z" />
                </svg>
            )}
        </div>
    )
}

function MenuFooter_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function MenuFooter_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("auth_token") ||
        ""
    )
}

function MenuFooter_useLogoNegocio(baseUrl: string): string | null {
    const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
    React.useEffect(() => {
        const slug = MenuFooter_getSlug()
        const token = MenuFooter_getToken()
        if (!slug || !token) return
        let alive = true
        const load = () => fetch(`${baseUrl.replace(/\/+$/, "")}/admin/perfil/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-cache",
        })
            .then((r) => r.json())
            .then((d) => {
                if (alive && d.success) setLogoUrl(d.imagenes_habilitadas ? d.perfil?.foto_perfil_url || null : d.logo_url || null)
            })
            .catch(() => {})
        load()
        const onChanged = (e: any) => { if (e.detail?.slug === slug) load() }
        window.addEventListener("turnits_business_photo_changed", onChanged)
        return () => { alive = false; window.removeEventListener("turnits_business_photo_changed", onChanged) }
    }, [baseUrl])
    return logoUrl
}

function MenuFooter_limpiarDatosDeCuenta(slug: string) {
    if (typeof window === "undefined" || !slug) return
    const s = String(slug).toLowerCase()
    const sufijos = [`_${s}`, `:${s}`]
    const limpiar = (storage: Storage) => {
        try {
            for (let i = storage.length - 1; i >= 0; i--) {
                const k = storage.key(i)
                if (k && sufijos.some((suf) => k.toLowerCase().endsWith(suf)))
                    storage.removeItem(k)
            }
        } catch {}
    }
    limpiar(window.localStorage)
    limpiar(window.sessionStorage)
}

function MenuFooter_cerrarSesion(
    logoutUrl: string,
    cuentaEliminada: boolean = false
) {
    // Si la cuenta se eliminó, también se borra lo que el navegador guardó
    // POR SLUG (ej. onboarding_omitido_<slug>, cambios pendientes de
    // sessionStorage). Los slugs se reutilizan: si se vuelve a crear una
    // cuenta con el mismo nombre le toca el mismo slug, y sin esta limpieza
    // heredaría esas marcas (por ejemplo, el tutorial no volvería a salir).
    if (cuentaEliminada) {
        try {
            MenuFooter_limpiarDatosDeCuenta(MenuFooter_getSlug())
        } catch {}
    }
    ;[
        "access_token",
        "auth_token",
        "turnits_token",
        "token",
        "user_token",
        "user_slug",
        "auth_slug",
        "slug",
        "business_name",
        "user_email",
    ].forEach((k) => {
        try {
            localStorage.removeItem(k)
        } catch (e) {}
    })
    if (typeof window !== "undefined") {
        window.location.href = logoutUrl
    }
}

const MenuCuenta_TERMINOS_URL = "/terminos-y-condiciones"

const MenuCuenta_PRIVACIDAD_URL = "/politica-de-privacidad"

const MenuCuenta_FONT = "'Inter Display', -apple-system, sans-serif"

const MenuCuenta_Z = 100000

const MenuCuenta_FLY_W = 236

const MenuCuenta_SHADOW =
    "0 12px 32px rgba(15,23,42,0.14), 0 2px 6px rgba(15,23,42,0.06)"

let MenuCuentaMpSdkPromise: Promise<void> | null = null

function MenuCuentaLoadMpSdk(): Promise<void> {
    if ((window as any).MercadoPago) return Promise.resolve()
    if (!MenuCuentaMpSdkPromise) MenuCuentaMpSdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = "https://sdk.mercadopago.com/js/v2"
        script.onload = () => resolve()
        script.onerror = () => { script.remove(); MenuCuentaMpSdkPromise = null; reject(new Error("No se pudo cargar el formulario de tarjeta.")) }
        document.head.appendChild(script)
    })
    return MenuCuentaMpSdkPromise
}

const MenuCuentaGraciasImagen = "/assets/gracias-calendario.png"

const MenuCuentaReduccionImagen = "/assets/aviso-reduccion.jpg"

const MenuCuentaGraciasPreviewCSS = `
          .tn-planes-overlay{position:fixed;inset:0;z-index:100020;background:rgba(15,23,42,.38);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;overflow:auto}
          .tn-planes-dialog{width:100%;max-width:1040px;max-height:calc(100dvh - 48px);overflow:auto;padding:30px;border-radius:24px;background:#fff;box-shadow:0 24px 80px #0f172a26;box-sizing:border-box;color:#111827;font-family:${MenuCuenta_FONT};outline:none}
          .tn-planes-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:32px}
          .tn-planes-card{position:relative;border:1px solid #e2e8f0;border-radius:18px;padding:28px 23px;display:flex;flex-direction:column;min-width:0;gap:18px}
          .tn-planes-card.featured{border:1.5px solid #196b1f;background:linear-gradient(180deg,#196b1f0d,#fff 48%);box-shadow:0 8px 28px #196b1f15}
          .tn-planes-dialog button:focus-visible,.tn-planes-dialog a:focus-visible{outline:2px solid #196b1f;outline-offset:3px}
          .tn-planes-dialog button:not(:disabled):hover{filter:brightness(.96)}
          @media(max-width:760px){.tn-planes-overlay{padding:12px}.tn-planes-dialog{padding:24px 18px;max-height:calc(100dvh - 24px);border-radius:20px}.tn-planes-grid{grid-template-columns:1fr;gap:26px}.tn-planes-card{padding:26px 22px}}
          .tn-planes-dialog.tn-checkout-dialog{position:relative;min-height:min(716px,calc(100dvh - 48px))}
          .tn-checkout-controls{position:absolute;right:30px;top:30px;display:flex;gap:16px;z-index:2}
          .tn-checkout-control{width:34px;height:34px;border:0;border-radius:11px;background:#f1f5f9;color:#64748b;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
          .tn-checkout-control:disabled{opacity:.45;cursor:default}
          .tn-checkout-layout{display:grid;grid-template-columns:248px minmax(0,1fr);gap:44px;width:calc(100% - 118px);margin-left:82px;min-height:656px}
          .tn-checkout-left{padding-top:58px;min-width:0}
          .tn-checkout-brand{margin-left:26px;width:184px;height:64px;display:flex;align-items:center;gap:9px;color:#000}
          .tn-checkout-brand img{width:100%;height:100%;object-fit:contain}
          .tn-checkout-brand span{font-size:36px;font-weight:750;letter-spacing:-1.8px}
          .tn-checkout-methods h3{font-size:16px;line-height:20px;margin:34px 0 20px;font-weight:700;color:#000}
          .tn-checkout-options{display:grid;gap:22px}
          .tn-checkout-option{height:122px;width:100%;padding:16px;display:grid;grid-template-columns:32px minmax(0,1fr);gap:16px;align-items:center;box-sizing:border-box;border:1px solid #111;border-radius:20px;background:white;color:#000;text-align:left;font-family:inherit;cursor:pointer}
          .tn-checkout-option:disabled{cursor:default}
          .tn-checkout-option:not(:disabled):hover{filter:none!important}
          .tn-checkout-option:disabled:not([aria-checked="true"]){opacity:.72}
          .tn-checkout-radio{width:32px;height:32px;box-sizing:border-box;border:5px solid #f0f0f0;border-radius:50%;background:#b5b5b5}
          .tn-checkout-radio.selected{border:5px solid #000;background:#fff}
          .tn-checkout-option-copy{display:flex;flex-direction:column;gap:5px;min-width:0}
          .tn-checkout-option-copy strong{font-size:20px;line-height:24px;font-weight:700;letter-spacing:-.25px}
          .tn-checkout-option-copy>span{font-size:16px;line-height:19px;font-weight:400}
          .tn-checkout-card-brands{display:flex;align-items:center;gap:7px;white-space:nowrap}
          .tn-checkout-card-brands svg{flex-shrink:0}
          .tn-checkout-right{min-width:0;padding-top:6px;align-self:start}
          .tn-checkout-plan-title{font-size:26px;line-height:32px;font-weight:700;color:#090e1a;margin:0;letter-spacing:-.6px}
          .tn-checkout-summary{height:76px;padding:20px;box-sizing:border-box;border-radius:16px;background:#f8f9fb;margin-top:22px;display:flex;align-items:center;justify-content:space-between;gap:18px}
          .tn-checkout-summary>div{display:flex;flex-direction:column;gap:5px;min-width:0}
          .tn-checkout-summary strong{font-size:12px;line-height:16px;font-weight:650;color:#111827}
          .tn-checkout-summary span{font-size:12px;line-height:16px;color:#64748b}
          .tn-checkout-summary b{font-size:26px;line-height:32px;font-weight:750;letter-spacing:-.7px;color:#080d19;white-space:nowrap}
          .tn-checkout-layout.is-card .tn-checkout-summary{margin-left:-12px;width:100%}
          .tn-checkout-card-form{margin-top:24px;width:calc(100% - 32px)}
          .tn-checkout-field{min-width:0}
          .tn-checkout-field label{display:block;font-size:14px;line-height:16px;margin:0 0 4px;color:#000}
          .tn-checkout-card-form>.tn-checkout-field+.tn-checkout-field,.tn-checkout-field-pair{margin-top:20px}
          .tn-checkout-field-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
          .tn-checkout-field-pair+.tn-checkout-field{margin-top:20px}
          .tn-checkout-card-form>.tn-checkout-field:nth-child(4){margin-top:16px}
          .tn-checkout-secure,.tn-checkout-field>input,.tn-checkout-document{width:100%;height:40px;border:1px solid #bfbfbf;border-radius:12px;box-sizing:border-box;background:#fff;overflow:hidden}
          .tn-checkout-secure{position:relative}
          .tn-checkout-secure iframe{display:block;width:100%;height:100%;border:0}
          .tn-checkout-field>input{padding:0 12px;font-family:inherit;font-size:16px;color:#111;outline:none}
          .tn-checkout-field input::placeholder{color:#929292;opacity:1}
          .tn-checkout-field>input:focus,.tn-checkout-document:focus-within,.tn-checkout-secure:focus-within{border-color:#777}
          .tn-checkout-document{display:grid;grid-template-columns:82px minmax(0,1fr);align-items:center}
          .tn-checkout-document select{height:28px;width:100%;padding:0 9px;border:0;border-right:1px solid #bfbfbf;border-radius:0;background:transparent;font-family:inherit;font-size:16px;color:#111;outline:none}
          .tn-checkout-document input{height:38px;width:100%;min-width:0;padding:0 11px;border:0;background:transparent;font-family:inherit;font-size:16px;color:#111;outline:none}
          .tn-checkout-cvv-wrap{position:relative}
          .tn-checkout-cvv-icon{position:absolute;right:8px;top:5px;pointer-events:none}
          .tn-checkout-pay{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:159px;height:48px;padding:0 16px;box-sizing:border-box;border:0;border-radius:12px;background:#196b1f;color:#fff;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap}
          .tn-checkout-card-form>.tn-checkout-pay{margin-top:36px}
          .tn-checkout-pay:disabled{opacity:.55;cursor:default}
          .tn-checkout-layout.is-mp .tn-checkout-right{align-self:center;padding-top:8px}
          .tn-checkout-layout.is-mp .tn-checkout-plan-title{padding-left:12px}
          .tn-checkout-mp-action{margin-top:38px;padding-left:12px}
          .tn-checkout-message{font-size:13px;line-height:1.6;margin:16px 0 0;color:#64748b}
          .tn-checkout-message.error{color:#b91c1c}
          .tn-checkout-result{margin-top:18px;color:#64748b;font-size:13px;line-height:1.6}
          .tn-checkout-check{border:0;background:#f1f5f9;padding:10px 14px;border-radius:10px;color:#475569;font-family:inherit;font-size:12px;cursor:pointer}
          .tn-checkout-retry{margin-top:24px}
          @media(min-width:761px) and (max-width:1090px){.tn-checkout-layout{width:100%;margin-left:0;grid-template-columns:230px minmax(0,1fr);gap:32px}.tn-checkout-option{padding:14px;gap:12px}.tn-checkout-option-copy strong{font-size:18px}.tn-checkout-option-copy>span{font-size:14px}.tn-checkout-card-brands{gap:5px}.tn-checkout-card-form{width:100%}.tn-checkout-layout.is-card .tn-checkout-summary{margin-left:0}}
          @media(max-width:760px){.tn-planes-dialog.tn-checkout-dialog{min-height:0;padding:68px 22px 30px}.tn-checkout-controls{top:20px;right:20px;gap:12px}.tn-checkout-layout{grid-template-columns:1fr;width:100%;margin-left:0;gap:24px;min-height:0}.tn-checkout-left,.tn-checkout-right{display:contents}.tn-checkout-layout>.tn-checkout-left>.tn-checkout-brand{order:1}.tn-checkout-details{order:2;min-width:0}.tn-checkout-methods{order:3;min-width:0}.tn-checkout-payment{order:4;min-width:0}.tn-checkout-brand{margin:0 auto;width:168px;height:50px}.tn-checkout-brand span{font-size:32px}.tn-checkout-methods h3{margin:0 0 14px;font-size:15px}.tn-checkout-options{gap:12px}.tn-checkout-option{height:100px;border-radius:17px;grid-template-columns:28px minmax(0,1fr);gap:14px;padding:16px}.tn-checkout-radio{height:28px;width:28px;border-width:4px}.tn-checkout-radio.selected{border-width:4px}.tn-checkout-option-copy strong{font-size:18px;line-height:21px}.tn-checkout-option-copy>span{font-size:14px;line-height:18px}.tn-checkout-right{padding-top:0}.tn-checkout-plan-title{font-size:23px;line-height:28px}.tn-checkout-summary{margin-top:16px;padding:16px;gap:8px}.tn-checkout-summary b{font-size:23px}.tn-checkout-layout.is-card .tn-checkout-summary{margin-left:0}.tn-checkout-card-form{width:100%;margin-top:0}.tn-checkout-field-pair{gap:12px}.tn-checkout-field label{font-size:12px;line-height:16px}.tn-checkout-document{grid-template-columns:70px minmax(0,1fr)}.tn-checkout-layout.is-mp .tn-checkout-plan-title{padding-left:0}.tn-checkout-mp-action{margin-top:0;padding-left:0}}

          .tn-thanks-dialog{position:relative;min-height:min(716px,calc(100dvh - 48px))}.tn-thanks-brand .tn-checkout-brand{margin:0 auto;height:44px}.tn-thanks-copy{width:min(620px,100%);margin:70px auto 0;padding-left:44px;box-sizing:border-box}.tn-thanks-copy h2{margin:0;font-size:34px;line-height:42px;letter-spacing:-1px;font-weight:700;color:#000;white-space:nowrap}.tn-thanks-copy p{font-size:16px;line-height:20px;color:#111;margin:8px 0 0}.tn-thanks-art{position:relative;overflow:hidden;width:300px;height:280px;max-width:100%;margin:64px auto 0}.tn-thanks-illustration{display:block;position:absolute;left:50%;top:50%;width:630px;height:auto;max-width:none;transform:translate(-50%,-50%)}@media(max-width:760px){.tn-thanks-dialog{min-height:0;padding:64px 24px 40px}.tn-thanks-copy{margin-top:38px;padding-left:0;text-align:center}.tn-thanks-copy h2{font-size:26px;line-height:32px;white-space:normal}.tn-thanks-copy p{font-size:14px;line-height:21px}.tn-thanks-art{margin-top:34px;width:260px;height:250px}.tn-thanks-illustration{width:550px}}
          @media(prefers-reduced-motion:reduce){.tn-planes-dialog *{transition:none!important}}
        `

function MenuFooter_useSoporte(baseUrl: string, soporteUrl: string) {
    const [plan, setPlan] = React.useState("gratis")
    React.useEffect(() => {
        const slug = MenuFooter_getSlug()
        if (!slug) return
        const controller = new AbortController()
        fetch(`${baseUrl.replace(/\/+$/, "")}/renovacion/info/${encodeURIComponent(slug)}`, {signal:controller.signal})
            .then(r => r.json()).then(data => {if(data.success) setPlan(data.plan || "gratis")}).catch(() => {})
        return () => controller.abort()
    }, [baseUrl])
    const prioritario = plan === "premium"
    let url = soporteUrl
    try {
        const target = new URL(soporteUrl)
        if (["api.whatsapp.com", "wa.me", "web.whatsapp.com"].includes(target.hostname)) {
            const label = prioritario ? "Soporte prioritario — Plan Premium" : "Soporte — Lista de espera"
            target.searchParams.set("text", `${label}. Negocio: ${MenuFooter_getSlug()}. ${target.searchParams.get("text") || "Hola, necesito ayuda con Turnits."}`)
            url = target.toString()
        }
    } catch {}
    return {url,prioritario}
}

const OnboardingNube_INK = "#12131A"

const OnboardingNube_ACCENT = "#1B6B1A"

const OnboardingNube_ACCENT_SOFT = "rgba(27,107,26,0.12)"

const OnboardingNube_MUTED = "rgba(18,19,26,0.56)"

const OnboardingNube_HAIRLINE = "rgba(18,19,26,0.12)"

const OnboardingNube_FONT_DISPLAY =
    "'Space Grotesk', 'Inter Display', -apple-system, sans-serif"

const OnboardingNube_FONT_BODY = "'Inter Display', -apple-system, sans-serif"

function OnboardingNube_getSlug(): string {
    if (typeof window === "undefined") return ""
    let fromUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) fromUrl = decodeURIComponent(m[1])
    } catch {}
    if (!fromUrl)
        fromUrl = new URLSearchParams(window.location.search).get("u") || ""
    return (
        fromUrl.toLowerCase().trim() || localStorage.getItem("user_slug") || ""
    )
}

function OnboardingNube_getToken(): string {
    if (typeof window === "undefined") return ""
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("user_token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("token") ||
        ""
    )
}

function OnboardingNube_marcarVisto(slug?: string) {
    try {
        const s = slug || OnboardingNube_getSlug()
        if (s) safeLocalStorageSet(`onboarding_omitido_${s}`, "1")
    } catch {}
}

const OnboardingNube_MSG_SIN_SESION =
    "No encontramos tu sesión en este dispositivo. Cerrá sesión y volvé a iniciar sesión para continuar."

async function OnboardingNube_esperarToken(origen: string): Promise<string> {
    for (let i = 0; i < 10; i++) {
        const t = OnboardingNube_getToken()
        if (t) return t
        await new Promise((r) => setTimeout(r, 300))
    }
    let keys: string[] = []
    try {
        keys = Object.keys(window.localStorage)
    } catch {}
    console.warn(`[OnboardingNube] ${origen}: no hay token en localStorage`, {
        slug: OnboardingNube_getSlug(),
        origin: window.location.origin,
        localStorageKeys: keys,
    })
    return ""
}

const OnboardingNube_DIAS = [
    { key: "lunes", label: "Lun" },
    { key: "martes", label: "Mar" },
    { key: "miercoles", label: "Mié" },
    { key: "jueves", label: "Jue" },
    { key: "viernes", label: "Vie" },
    { key: "sabado", label: "Sáb" },
    { key: "domingo", label: "Dom" },
]

const OnboardingNube_DURACIONES = [30, 45, 60, 90]

const QrPanel_ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]

const QrPanel_NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]

function QrPanel_alignPositions(ver: number): number[] {
    if (ver === 1) return []
    const num = Math.floor(ver / 7) + 2
    const size = ver * 4 + 17
    const step = Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2
    const res = [6]
    for (let pos = size - 7; res.length < num; pos -= step)
        res.splice(1, 0, pos)
    return res
}

function QrPanel_rawModules(ver: number): number {
    let r = (16 * ver + 128) * ver + 64
    if (ver >= 2) {
        const n = Math.floor(ver / 7) + 2
        r -= (25 * n - 10) * n - 55
        if (ver >= 7) r -= 36
    }
    return r
}

function QrPanel_dataCodewords(ver: number): number {
    return (
        Math.floor(QrPanel_rawModules(ver) / 8) -
        QrPanel_ECC_PER_BLOCK[ver] * QrPanel_NUM_BLOCKS[ver]
    )
}

function QrPanel_gfMul(x: number, y: number): number {
    let z = 0
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d)
        z ^= ((y >>> i) & 1) * x
    }
    return z & 0xff
}

function QrPanel_rsDivisor(degree: number): number[] {
    const res: number[] = []
    for (let i = 0; i < degree - 1; i++) res.push(0)
    res.push(1)
    let root = 1
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < res.length; j++) {
            res[j] = QrPanel_gfMul(res[j], root)
            if (j + 1 < res.length) res[j] ^= res[j + 1]
        }
        root = QrPanel_gfMul(root, 0x02)
    }
    return res
}

function QrPanel_rsRemainder(data: number[], divisor: number[]): number[] {
    const res = divisor.map(() => 0)
    for (const b of data) {
        const factor = b ^ (res.shift() as number)
        res.push(0)
        divisor.forEach((coef, i) => (res[i] ^= QrPanel_gfMul(coef, factor)))
    }
    return res
}

function QrPanel_utf8(text: string): number[] {
    const s = unescape(encodeURIComponent(text))
    const out: number[] = []
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i))
    return out
}

function QrPanel_penalty(m: boolean[][], size: number): number {
    let result = 0
    // Regla 1: rachas de 5+ módulos iguales (filas y columnas)
    for (let pass = 0; pass < 2; pass++) {
        for (let a = 0; a < size; a++) {
            let run = 1
            for (let b = 1; b < size; b++) {
                const cur = pass === 0 ? m[a][b] : m[b][a]
                const prev = pass === 0 ? m[a][b - 1] : m[b - 1][a]
                if (cur === prev) {
                    run++
                    if (run === 5) result += 3
                    else if (run > 5) result++
                } else run = 1
            }
        }
    }
    // Regla 2: bloques de 2x2
    for (let y = 0; y < size - 1; y++)
        for (let x = 0; x < size - 1; x++) {
            const c = m[y][x]
            if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1])
                result += 3
        }
    // Regla 3: patrones tipo buscador (1:1:3:1:1) con 4 claros
    const pA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
    const pB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
    for (let pass = 0; pass < 2; pass++)
        for (let a = 0; a < size; a++)
            for (let b = 0; b <= size - 11; b++) {
                let okA = true
                let okB = true
                for (let k = 0; k < 11 && (okA || okB); k++) {
                    const v = pass === 0 ? m[a][b + k] : m[b + k][a]
                    const bit = v ? 1 : 0
                    if (bit !== pA[k]) okA = false
                    if (bit !== pB[k]) okB = false
                }
                if (okA) result += 40
                if (okB) result += 40
            }
    // Regla 4: balance de oscuros/claros
    let dark = 0
    for (const row of m) for (const v of row) if (v) dark++
    const total = size * size
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1
    result += Math.max(k, 0) * 10
    return result
}

function QrPanel_encode(text: string): boolean[][] {
    const bytes = QrPanel_utf8(text)

    // 1) Elegir la menor versión donde entra el texto
    let ver = 1
    for (; ver <= 10; ver++) {
        const ccBits = ver < 10 ? 8 : 16
        if (4 + ccBits + bytes.length * 8 <= QrPanel_dataCodewords(ver) * 8)
            break
    }
    if (ver > 10) throw new Error("Texto demasiado largo para el QR")
    const size = ver * 4 + 17

    // 2) Bits de datos
    const bits: number[] = []
    const push = (val: number, len: number) => {
        for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
    }
    push(0x4, 4)
    push(bytes.length, ver < 10 ? 8 : 16)
    bytes.forEach((b) => push(b, 8))
    const capBits = QrPanel_dataCodewords(ver) * 8
    push(0, Math.min(4, capBits - bits.length))
    push(0, (8 - (bits.length % 8)) % 8)
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) push(pad, 8)
    const data: number[] = []
    for (let i = 0; i < bits.length; i += 8) {
        let v = 0
        for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
        data.push(v)
    }

    // 3) Reed-Solomon + intercalado de bloques
    const nBlocks = QrPanel_NUM_BLOCKS[ver]
    const eccLen = QrPanel_ECC_PER_BLOCK[ver]
    const rawCw = Math.floor(QrPanel_rawModules(ver) / 8)
    const nShort = nBlocks - (rawCw % nBlocks)
    const shortLen = Math.floor(rawCw / nBlocks)
    const div = QrPanel_rsDivisor(eccLen)
    const blocks: number[][] = []
    for (let i = 0, k = 0; i < nBlocks; i++) {
        const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1))
        k += dat.length
        const ecc = QrPanel_rsRemainder(dat, div)
        if (i < nShort) dat.push(0)
        blocks.push(dat.concat(ecc))
    }
    const all: number[] = []
    for (let i = 0; i < blocks[0].length; i++)
        blocks.forEach((blk, j) => {
            if (i !== shortLen - eccLen || j >= nShort) all.push(blk[i])
        })

    // 4) Matriz + patrones de función
    const m: boolean[][] = []
    const fn: boolean[][] = []
    for (let y = 0; y < size; y++) {
        m.push(new Array(size).fill(false))
        fn.push(new Array(size).fill(false))
    }
    const setFn = (x: number, y: number, dark: boolean) => {
        m[y][x] = dark
        fn[y][x] = true
    }
    for (let i = 0; i < size; i++) {
        setFn(6, i, i % 2 === 0)
        setFn(i, 6, i % 2 === 0)
    }
    const finder = (cx: number, cy: number) => {
        for (let dy = -4; dy <= 4; dy++)
            for (let dx = -4; dx <= 4; dx++) {
                const d = Math.max(Math.abs(dx), Math.abs(dy))
                const x = cx + dx
                const y = cy + dy
                if (x >= 0 && x < size && y >= 0 && y < size)
                    setFn(x, y, d !== 2 && d !== 4)
            }
    }
    finder(3, 3)
    finder(size - 4, 3)
    finder(3, size - 4)
    const ap = QrPanel_alignPositions(ver)
    ap.forEach((px, i) =>
        ap.forEach((py, j) => {
            if (
                (i === 0 && j === 0) ||
                (i === 0 && j === ap.length - 1) ||
                (i === ap.length - 1 && j === 0)
            )
                return
            for (let dy = -2; dy <= 2; dy++)
                for (let dx = -2; dx <= 2; dx++)
                    setFn(
                        px + dx,
                        py + dy,
                        Math.max(Math.abs(dx), Math.abs(dy)) !== 1
                    )
        })
    )
    const drawFormat = (mask: number) => {
        const d = (0 << 3) | mask // nivel M = 0
        let rem = d
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
        const f = ((d << 10) | rem) ^ 0x5412
        const bit = (i: number) => ((f >>> i) & 1) !== 0
        for (let i = 0; i <= 5; i++) setFn(8, i, bit(i))
        setFn(8, 7, bit(6))
        setFn(8, 8, bit(7))
        setFn(7, 8, bit(8))
        for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i))
        for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i))
        for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i))
        setFn(8, size - 8, true)
    }
    drawFormat(0)
    if (ver >= 7) {
        let rem = ver
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
        const v = (ver << 12) | rem
        for (let i = 0; i < 18; i++) {
            const b = ((v >>> i) & 1) !== 0
            const a = size - 11 + (i % 3)
            const c = Math.floor(i / 3)
            setFn(a, c, b)
            setFn(c, a, b)
        }
    }

    // 5) Colocar los datos en zigzag
    let idx = 0
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5
        for (let vert = 0; vert < size; vert++)
            for (let j = 0; j < 2; j++) {
                const x = right - j
                const upward = ((right + 1) & 2) === 0
                const y = upward ? size - 1 - vert : vert
                if (!fn[y][x] && idx < all.length * 8) {
                    m[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0
                    idx++
                }
            }
    }

    // 6) Elegir la mejor máscara
    const applyMask = (mask: number) => {
        for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
                let inv = false
                switch (mask) {
                    case 0:
                        inv = (x + y) % 2 === 0
                        break
                    case 1:
                        inv = y % 2 === 0
                        break
                    case 2:
                        inv = x % 3 === 0
                        break
                    case 3:
                        inv = (x + y) % 3 === 0
                        break
                    case 4:
                        inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
                        break
                    case 5:
                        inv = ((x * y) % 2) + ((x * y) % 3) === 0
                        break
                    case 6:
                        inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
                        break
                    default:
                        inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
                }
                if (inv && !fn[y][x]) m[y][x] = !m[y][x]
            }
    }
    let best = 0
    let bestPen = Infinity
    for (let mask = 0; mask < 8; mask++) {
        applyMask(mask)
        drawFormat(mask)
        const p = QrPanel_penalty(m, size)
        if (p < bestPen) {
            bestPen = p
            best = mask
        }
        applyMask(mask)
    }
    applyMask(best)
    drawFormat(best)
    return m
}

function QrPanel_path(m: boolean[][], quiet = 4): string {
    let d = ""
    for (let y = 0; y < m.length; y++)
        for (let x = 0; x < m.length; x++)
            if (m[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`
    return d
}

function QrPanel_svgString(m: boolean[][], fg = "#0f172a"): string {
    const n = m.length + 8
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="1024" height="1024" shape-rendering="crispEdges">` +
        `<rect width="${n}" height="${n}" fill="#ffffff"/>` +
        `<path d="${QrPanel_path(m)}" fill="${fg}"/></svg>`
    )
}

function QrPanel_dibujarQr(
    ctx: CanvasRenderingContext2D,
    m: boolean[][],
    x0: number,
    y0: number,
    total: number,
    fg = "#0f172a"
) {
    const n = m.length + 8
    const cell = total / n
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(x0, y0, total, total)
    ctx.fillStyle = fg
    for (let y = 0; y < m.length; y++)
        for (let x = 0; x < m.length; x++)
            if (m[y][x])
                ctx.fillRect(
                    x0 + (x + 4) * cell,
                    y0 + (y + 4) * cell,
                    Math.ceil(cell),
                    Math.ceil(cell)
                )
}

function QrPanel_canvasQr(m: boolean[][]): HTMLCanvasElement {
    const n = m.length + 8
    const cell = Math.max(1, Math.floor(1200 / n))
    const c = document.createElement("canvas")
    c.width = c.height = cell * n
    const ctx = c.getContext("2d") as CanvasRenderingContext2D
    QrPanel_dibujarQr(ctx, m, 0, 0, c.width)
    return c
}

function QrPanel_canvasCartel(
    m: boolean[][],
    url: string,
    negocio: string,
    accent: string
): HTMLCanvasElement {
    const W = 1200
    const H = 1700
    const c = document.createElement("canvas")
    c.width = W
    c.height = H
    const ctx = c.getContext("2d") as CanvasRenderingContext2D
    const font = "'Inter Display', 'Segoe UI', Helvetica, Arial, sans-serif"
    const fit = (
        text: string,
        weight: number,
        max: number,
        min: number,
        w: number
    ) => {
        let s = max
        ctx.font = `${weight} ${s}px ${font}`
        while (ctx.measureText(text).width > w && s > min) {
            s -= 2
            ctx.font = `${weight} ${s}px ${font}`
        }
        return s
    }
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, W, H)
    // Banda superior
    ctx.fillStyle = "#1B6B1A"
    ctx.fillRect(0, 0, W, 444)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#ffffff"
    if (negocio) {
        fit(negocio, 800, 96, 44, 1040)
        ctx.fillText(negocio, W / 2, 190)
        ctx.fillStyle = "rgba(255,255,255,0.78)"
        ctx.font = `500 46px ${font}`
        ctx.fillText("Reservá tu turno online", W / 2, 320)
    } else {
        ctx.font = `800 96px ${font}`
        ctx.fillText("Reservá tu turno", W / 2, 215)
        ctx.fillStyle = "rgba(255,255,255,0.78)"
        ctx.font = `500 46px ${font}`
        ctx.fillText("de forma online", W / 2, 320)
    }
    // Tarjeta del QR
    const card = 820
    const cx = (W - card) / 2
    const cy = 560
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
    }
    ctx.save()
    ctx.shadowColor = "rgba(15,23,42,0.18)"
    ctx.shadowBlur = 50
    ctx.shadowOffsetY = 18
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    rr(cx, cy, card, card, 44)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = "#e5e9f0"
    ctx.lineWidth = 3
    ctx.beginPath()
    rr(cx, cy, card, card, 44)
    ctx.stroke()
    QrPanel_dibujarQr(ctx, m, cx + 20, cy + 20, card - 40)
    // Textos inferiores
    ctx.fillStyle = "#0f172a"
    ctx.font = `700 54px ${font}`
    ctx.fillText("Escaneá con la cámara de tu celular", W / 2, 1470)
    ctx.fillStyle = "#64748b"
    fit(url.replace(/^https?:\/\//, ""), 500, 38, 22, 1040)
    ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, 1545)
    ctx.fillStyle = "#94a3b8"
    ctx.font = `600 30px ${font}`
    ctx.fillText("Hecho con turnits", W / 2, 1626)
    return c
}

async function QrPanel_guardarBlob(
    blob: Blob,
    nombre: string,
    isMobile: boolean
) {
    try {
        const nav: any = navigator
        const file = new File([blob], nombre, { type: blob.type })
        if (isMobile && nav.canShare && nav.canShare({ files: [file] })) {
            await nav.share({ files: [file] })
            return
        }
    } catch (e: any) {
        if (e && e.name === "AbortError") return
    }
    const u = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = u
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(u), 4000)
}

function QrPanel_guardarCanvas(
    c: HTMLCanvasElement,
    nombre: string,
    isMobile: boolean
) {
    c.toBlob((b) => {
        if (b) QrPanel_guardarBlob(b, nombre, isMobile)
    }, "image/png")
}

function QrPanel_slug(): string {
    let v = ""
    try {
        v = MenuFooter_getSlug()
    } catch {}
    if (!v) v = safeLocalStorage("user_slug") || safeLocalStorage("slug") || ""
    if (!v) {
        // Último recurso: el slug viaja dentro del token de sesión (JWT).
        const tk =
            safeLocalStorage("access_token") ||
            safeLocalStorage("user_token") ||
            safeLocalStorage("token") ||
            ""
        try {
            let b64 = (tk.split(".")[1] || "")
                .replace(/-/g, "+")
                .replace(/_/g, "/")
            while (b64.length % 4) b64 += "="
            const json = decodeURIComponent(escape(atob(b64)))
            v = String(JSON.parse(json).slug || "")
        } catch {}
    }
    return v.toLowerCase().trim()
}

type TurnitsInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type FinanzasGasto = {
    id: string
    descripcion: string
    categoria: string
    monto: number
    fecha: string
    tipo: "fijo" | "variable"
    recurrente: boolean
    origen_recurrente?: boolean
    fecha_inicio?: string
}

const FINANZAS_CATEGORIAS: { id: string; label: string; color: string }[] = [
    { id: "productos", label: "Productos e insumos", color: "#b73535" },
    { id: "alquiler", label: "Alquiler", color: "#22c55e" },
    { id: "servicios", label: "Servicios (luz, wifi, agua)", color: "#5146e5" },
    { id: "personal", label: "Personal y comisiones", color: "#f59e0b" },
    { id: "impuestos", label: "Impuestos", color: "#0891b2" },
    { id: "marketing", label: "Marketing", color: "#db2777" },
    { id: "mantenimiento", label: "Mantenimiento", color: "#7c3aed" },
    { id: "otros", label: "Otros gastos", color: "#64748b" },
    {
        id: "comision_mercadopago",
        label: "Comisión Mercado Pago",
        color: "#2878d0",
    },
    { id: "comision_turnits", label: "Comisión Turnits", color: "#475569" },
]

const FINANZAS_CATEGORIAS_MANUALES = FINANZAS_CATEGORIAS.filter(
    (c) => !c.id.startsWith("comision_")
)

const finanzasHoyLocal = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const FINANZAS_GASTO_GUIAS: Record<string, string> = {
    productos: "Materiales, mercadería y productos para trabajar.",
    alquiler: "Alquiler del local o del espacio de trabajo.",
    servicios: "Luz, agua, internet y otros servicios del negocio.",
    personal: "Sueldos, honorarios y comisiones del equipo.",
    impuestos: "Impuestos, tasas y obligaciones del negocio.",
    marketing: "Publicidad, campañas y difusión de tu negocio.",
    mantenimiento: "Reparaciones y cuidado del local o los equipos.",
    otros: "Gastos que no encajan en las otras categorías.",
}

const FINANZAS_GASTO_TIPOS = [
    { id: "variable", label: "Variable", color: "#2563eb", description: "Cambia según tu actividad, como compras de insumos o publicidad." },
    { id: "fijo", label: "Fijo", color: "#1b6b1a", description: "Un costo estable, como el alquiler o un abono mensual. La repetición mensual se activa por separado." },
]

const FINANZAS_PICKER_CSS = `
.fin-exp-trigger{width:100%;min-width:0;min-height:44px;display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid #dbe2ea;border-radius:10px;background:#fff;color:#172033;cursor:pointer;font:inherit;text-align:left;transition:border-color .15s,box-shadow .15s}
.fin-exp-trigger:hover{border-color:#9aa9a1;box-shadow:0 2px 8px #17203308}.fin-exp-trigger:disabled{opacity:.6;cursor:wait}
.fin-exp-trigger:focus-visible,.fin-exp-option:focus-visible,.fin-exp-close:focus-visible{outline:2px solid #18732a;outline-offset:3px}
.fin-exp-overlay{position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.38);backdrop-filter:blur(3px);animation:fin-exp-fade .16s ease-out}
.fin-exp-dialog{width:min(100%,660px);max-height:calc(100dvh - 40px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #e5eaf0;border-radius:22px;background:#fff;color:#172033;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 24px 90px #0f172a30;animation:fin-exp-enter .2s ease-out}
.fin-exp-header{padding:24px 24px 18px;display:flex;align-items:flex-start;gap:16px;justify-content:space-between;border-bottom:1px solid #edf0f3;flex-shrink:0}
.fin-exp-header h2{margin:0;font-size:19px;font-weight:700;letter-spacing:-.4px;line-height:1.3}.fin-exp-header p{margin:7px 0 0;font-size:12px;line-height:1.5;color:#64748b;max-width:480px}
.fin-exp-close{width:34px;height:34px;flex-shrink:0;border:1px solid #e5eaf0;border-radius:10px;background:#fff;color:#64748b;display:grid;place-items:center;cursor:pointer}.fin-exp-close:hover{background:#f6f8f7}
.fin-exp-grid{padding:20px 24px 24px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;overflow:auto;overscroll-behavior:contain}
.fin-exp-option{position:relative;display:flex;align-items:flex-start;gap:11px;width:100%;min-width:0;padding:14px 32px 14px 13px;border:1px solid #e5eaf0;border-radius:14px;background:#fff;text-align:left;cursor:pointer;font:inherit;transition:background .15s,border-color .15s,transform .15s}
.fin-exp-option:hover{background:#f8faf8;border-color:#b5c7bb;transform:translateY(-1px)}.fin-exp-option[aria-pressed=true]{background:#f5faf5}
.fin-exp-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}.fin-exp-option-text{min-width:0;flex:1}.fin-exp-option-name{display:block;font-size:12.5px;font-weight:650;line-height:1.4}.fin-exp-option-hint{display:block;font-size:11px;line-height:1.55;color:#64748b;margin-top:5px}
.fin-exp-check{position:absolute;right:10px;top:15px}.fin-exp-selected-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
@keyframes fin-exp-fade{from{opacity:0}to{opacity:1}}@keyframes fin-exp-enter{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@media(max-width:560px){.fin-exp-overlay{padding:12px}.fin-exp-dialog{max-height:calc(100dvh - 24px);border-radius:18px}.fin-exp-header{padding:18px 18px 15px}.fin-exp-header h2{font-size:18px}.fin-exp-grid{grid-template-columns:1fr;padding:14px 18px 18px;gap:8px}.fin-exp-option{padding-top:12px;padding-bottom:12px}}
@media(prefers-reduced-motion:reduce){.fin-exp-overlay,.fin-exp-dialog{animation:none}.fin-exp-option,.fin-exp-trigger{transition:none}.fin-exp-option:hover{transform:none}}
`

const FINANZAS_FECHA_CSS = `
.fin-date-dialog{width:min(100%,380px)}.fin-date-body{padding:18px 22px 22px;overflow:auto;overscroll-behavior:contain}
.fin-date-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:10px}.fin-date-nav strong{font-size:14px;text-transform:capitalize;letter-spacing:-.2px}.fin-date-arrow{width:34px;height:34px;display:grid;place-items:center;border:1px solid #e5eaf0;border-radius:10px;background:white;color:#475569;cursor:pointer}.fin-date-arrow:hover{background:#f5f8f5}
.fin-date-week,.fin-date-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.fin-date-week{margin-bottom:8px;color:#94a3b8;font-size:10px;text-align:center}.fin-date-week span{padding:3px}
.fin-date-day{height:38px;min-width:0;padding:0;border:1px solid transparent;border-radius:11px;background:transparent;color:#172033;cursor:pointer;font-family:inherit;font-size:12px;transition:background .15s}.fin-date-day:hover{background:#eef5ee}.fin-date-day[data-outside=true]{color:#a6afb7}.fin-date-day[data-today=true]{border-color:#bbd9bf;font-weight:700}.fin-date-day[aria-pressed=true]{background:#18732a;color:white;border-color:#18732a;font-weight:650}.fin-date-day:focus-visible,.fin-date-arrow:focus-visible,.fin-date-quick:focus-visible{outline:2px solid #18732a;outline-offset:2px}
.fin-date-shortcuts{display:flex;gap:8px;margin-top:18px;padding-top:16px;border-top:1px solid #edf0f3}.fin-date-quick{flex:1;padding:9px 12px;border:1px solid #dbe6dd;border-radius:10px;color:#1b6b1a;background:#f8fbf8;cursor:pointer;font:inherit;font-size:12px}.fin-date-quick:hover{background:#edf5ed}
@media(max-width:560px){.fin-date-body{padding:16px 18px 18px}.fin-date-day{height:36px}}
@media(prefers-reduced-motion:reduce){.fin-date-day{transition:none}}
`

const finanzasFechaISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`

function finanzasFechaParse(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "")
    if (!match) return new Date()
    const date = new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12)
    return finanzasFechaISO(date) === value ? date : new Date()
}

function finanzasMetricasNegocio(summary: any, gastos: FinanzasGasto[]) {
    const number = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0
    const ingresos = number(summary.ingresosBrutos)
    const total = number(summary.gastosTotales)
    const turnos = Math.max(0, number(summary.cantidadTurnos))
    const fijos = gastos.filter(g => g.tipo === "fijo" || g.origen_recurrente).reduce((sum, g) => sum + number(g.monto), 0)
    const variables = Math.max(0, total - fijos)
    return { fijos, variables,
        ticket: turnos > 0 ? ingresos / turnos : null,
        costoTurno: turnos > 0 ? total / turnos : null,
        resultadoTurno: turnos > 0 ? (ingresos - total) / turnos : null,
        comisionIngresos: ingresos > 0 ? number(summary.comisionesTotales) / ingresos * 100 : null }
}

function TurnitsSidebarUtilityButton(accentColor: string): React.CSSProperties {
    return {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 9px",
        border: "none",
        borderRadius: 10,
        background: "transparent",
        color: "#475569",
        fontSize: 12.5,
        fontWeight: 650,
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "background .16s ease, color .16s ease",
    }
}

function TurnitsSidebarUtilityIcon(accentColor: string): React.CSSProperties {
    return {
        width: 25,
        height: 25,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${accentColor}10`,
        color: accentColor,
        fontSize: 13,
        fontWeight: 800,
        flexShrink: 0,
    }
}

function TurnitsSidebarUtilityBadge(accentColor: string): React.CSSProperties {
    return {
        padding: "2px 6px",
        borderRadius: 99,
        background: `${accentColor}12`,
        color: accentColor,
        fontSize: 9,
        fontWeight: 800,
    }
}

function TurnitsDashboard_getSlug(): string {
    if (typeof window === "undefined") return ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m?.[1]) return decodeURIComponent(m[1]).toLowerCase().trim()
        return (
            new URLSearchParams(window.location.search).get("u") ||
            safeLocalStorage("user_slug") ||
            ""
        )
            .toLowerCase()
            .trim()
    } catch {
        return safeLocalStorage("user_slug") || ""
    }
}

function TurnitsDashboard_getToken(): string {
    return (
        safeLocalStorage("access_token") ||
        safeLocalStorage("user_token") ||
        safeLocalStorage("token") ||
        ""
    )
}

function TurnitsDashboard_money(n: any): string {
    const value = Number(n || 0)
    return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
}

function TurnitsDashboard_shortMoney(n: any): string {
    const value = Number(n || 0)
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
    return TurnitsDashboard_money(value)
}

function TurnitsDashboard_percent(
    current: number,
    previous: number
): { tono: "sube" | "baja" | "igual"; texto: string } | null {
    return TurnitsDashboard_variacion(current, previous)
}

function TurnitsDashboard_dateLabel(date = new Date()): string {
    return date
        .toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        .replace(".", "")
}

const TurnitsDashboard_COLOR_SUBE = "#16a34a"

const TurnitsDashboard_COLOR_BAJA = "#dc2626"

const TurnitsDashboard_COLOR_IGUAL = "#64748b"

const TurnitsDashboard_MESES_CORTOS = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
]

function TurnitsDashboard_rangoLabel(desde?: string, hasta?: string): string {
    if (!desde || !hasta) return ""
    const parte = (iso: string) => {
        const [, m, d] = iso.split("-").map(Number)
        return { d, m: TurnitsDashboard_MESES_CORTOS[(m || 1) - 1] || "" }
    }
    const a = parte(desde)
    const b = parte(hasta)
    if (desde === hasta) return `${a.d} ${a.m}`
    return a.m === b.m
        ? `${a.d} – ${b.d} ${b.m}`
        : `${a.d} ${a.m} – ${b.d} ${b.m}`
}

function TurnitsDashboard_variacion(
    actual: any,
    anterior: any
): { tono: "sube" | "baja" | "igual"; texto: string } | null {
    if (anterior === null || anterior === undefined) return null
    const a = Number(actual || 0)
    const b = Number(anterior || 0)
    if (b === 0) {
        // Con base cero no hay un porcentaje matemáticamente válido.
        return a === 0 ? { tono: "igual", texto: "0%" } : null
    }
    const pct = Math.round(((a - b) / b) * 100)
    if (pct === 0) return { tono: "igual", texto: "0%" }
    return pct > 0
        ? { tono: "sube", texto: `↑ ${pct}%` }
        : { tono: "baja", texto: `↓ ${Math.abs(pct)}%` }
}

const GuardaSesion_TOKEN_KEYS = [
    "access_token",
    "auth_token",
    "turnits_token",
    "user_token",
    "token",
]

function GuardaSesion_leerJwt(
    t: string
): { slug: string; rol: string; equipoId?: string } | null {
    try {
        const b64 = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
        const json = decodeURIComponent(
            atob(b64)
                .split("")
                .map(
                    (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                )
                .join("")
        )
        const p = JSON.parse(json)
        return {
            slug: String(p?.slug || "").toLowerCase(),
            rol: String(p?.rol || ""),
            equipoId: String(p?.equipoId || "") || undefined,
        }
    } catch {
        return null
    }
}

function GuardaSesion_detectar(): {
    slugUrl: string
    slugsToken: string[]
} | null {
    if (typeof window === "undefined") return null
    let slugUrl = ""
    try {
        const m = (window.location.pathname || "").match(
            /\/panel(?:-test)?\/([^\/?#]+)/i
        )
        if (m && m[1]) slugUrl = decodeURIComponent(m[1])
        if (!slugUrl)
            slugUrl = new URLSearchParams(window.location.search).get("u") || ""
    } catch {}
    slugUrl = slugUrl.toLowerCase().trim()
    if (!slugUrl) return null

    const otros = new Set<string>()
    for (const k of GuardaSesion_TOKEN_KEYS) {
        const t = safeLocalStorage(k)
        if (!t) continue
        const j = GuardaSesion_leerJwt(t)
        if (!j || !j.slug) continue
        if (j.rol === "superadmin") continue
        if (j.slug !== slugUrl) otros.add(j.slug)
    }
    return otros.size > 0 ? { slugUrl, slugsToken: Array.from(otros) } : null
}

function CardBox({ children, style }: any) {
    return (
        <div
            style={{
                background: "#ffffff",
                borderRadius: 20,
                boxShadow:
                    "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
                minHeight: 260,
                boxSizing: "border-box",
                ...style,
            }}
        >
            {children}
        </div>
    )
}

function SeccionHeader({
    title,
    subtitle,
    isMobile,
}: {
    title: string
    subtitle?: string
    isMobile?: boolean
}) {
    return (
        <div style={{ marginBottom: 4 }}>
            <h1
                style={{
                    fontFamily: "'Inter Display', -apple-system, sans-serif",
                    fontSize: isMobile ? 22 : 28,
                    fontWeight: 500,
                    color: "#0f172a",
                    margin: 0,
                }}
            >
                {title}
            </h1>
            {subtitle && (
                <p
                    style={{
                        fontFamily:
                            "'Inter Display', -apple-system, sans-serif",
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#64748b",
                        margin: "4px 0 0",
                    }}
                >
                    {subtitle}
                </p>
            )}
        </div>
    )
}

export { TurnitsResolveAccountPlan, TurnitsLockedStyle, safeLocalStorage, safeLocalStorageSet, Turnits_useIsoLayoutEffect, Turnits_useElementWidth, PANEL_BUILD_VERSION, AUTO_UPDATE_GUARD_KEY, AUTO_UPDATE_GUARD_MS, AUTO_UPDATE_CACHE_PARAM, AutoUpdate_Motivo, AutoUpdate_Resultado, AutoUpdate_hash, AutoUpdate_fetch, AutoUpdate_scriptsDeHtml, AutoUpdate_scriptsVivos, AutoUpdate_detectar, AutoUpdate_esMomentoSeguro, AutoUpdate_yaIntentado, AutoUpdate_recargarLimpio, AutoUpdate_ejecutar, AutoUpdate_limpiarParam, usePanelAutoUpdate, TurnitsGlobalSaveSection, TurnitsGlobalPending, TURNITS_GLOBAL_PENDING_KEY, TurnitsGlobalSave_key, TURNITS_PAGOS_CAMPOS, TurnitsGlobalSave_pagosDiff, TurnitsGlobalSave_safeRead, TurnitsGlobalSave_safeWrite, TurnitsGlobalSave_stable, TurnitsGlobalSave_partialEqual, TurnitsGlobalSave_emit, TurnitsGlobalSaveManager_get, UserGreeting_textStyle, PlanEstado_DIAS_PARA_RENOVAR, PlanEstado_CROWN_COLOR, PlanEstado_getSlug, PlanEstado_getStatusPago, PlanEstado_limpiarStatusPago, PlanEstado_esperar, PlanEstado_MOCK, BotonNotificaciones_API_BASE_URL_DEFAULT, BotonNotificaciones_getScrollTargets, BotonNotificaciones_scrollToTop, BotonNotificaciones_decodeJWT, BotonNotificaciones_getSlugFromUrl, BotonNotificaciones_useNoLeidas, BotonNotificaciones_Modo, BotonNotificaciones_Props, NotificacionesPanel_Notificacion, NotificacionesPanel_NOTIFS_VISIBLES_ANTES_DE_SCROLL, NotificacionesPanel_TIPO_CONFIG, NotificacionesPanel_SECCION_POR_TIPO, NotificacionesPanel_TIPO_ALIAS, NotificacionesPanel_normalizarTipo, NotificacionesPanel_tiempoRelativo, NotificacionesPanel_decodeJWT, NotificacionesPanel_getSlugFromUrl, NotificacionesPanel_esIOS, NotificacionesPanel_esStandalone, NotificacionesPanel_urlBase64ToUint8Array, NotificacionesPanel_EstadoPush, NotificacionesPanel_Props, NotificacionesPanel_observarVisibles, TurnosHoy_useBreakpoint, TurnosHoy_getSlug, TurnosHoy_getToken, TurnosHoy_getMinutosArg, TurnosHoy_MOCK, TurnosHoy_makeCardBase, TurnosHoy_makeTitleStyle, TurnosHoy_makeSectionTitle, TurnosHoy_makeBtnAgenda, TurnosHoy_shimmerCSS, RendimientoEquipo_useBreakpoint, RendimientoEquipo_getSlug, RendimientoEquipo_getToken, RendimientoEquipo_PERIODOS, RendimientoEquipo_MOCK, RendimientoEquipo_makeCardBase, RendimientoEquipo_makeTitleStyle, RendimientoEquipo_shimmerCSS, IngresosEstimados_useBreakpoint, IngresosEstimados_getSlug, IngresosEstimados_getToken, IngresosEstimados_formatFull, IngresosEstimados_formatCurrency, IngresosEstimados_calcularIngresos, IngresosEstimados_calcularIngresosHoy, IngresosEstimados_MOCK_TURNOS, IngresosEstimados_MOCK_STATS, IngresosEstimados_buildUltimos7, IngresosEstimados_makeCardBase, IngresosEstimados_makeTitleStyle, IngresosEstimados_makeSectionTitle, IngresosEstimados_shimmerCSS, TurnosMes_useBreakpoint, TurnosMes_getSlug, TurnosMes_getToken, TurnosMes_MOCK_STATS, TurnosMes_makeCardBase, TurnosMes_makeTitleStyle, TurnosMes_shimmerCSS, ClientesCard_useBreakpoint, ClientesCard_getSlug, ClientesCard_getToken, ClientesCard_MOCK_STATS, ClientesCard_makeCardBase, ClientesCard_makeTitleStyle, ClientesCard_shimmerCSS, MejoresDias_useBreakpoint, MejoresDias_getSlug, MejoresDias_getToken, MejoresDias_DIAS_ORDEN, MejoresDias_DIAS_LABEL, MejoresDias_GETDAY_TO_KEY, MejoresDias_sanitizarHora, MejoresDias_formatHorario, MejoresDias_MOCK_STATS, MejoresDias_calcularRanking, MejoresDias_makeCardBase, MejoresDias_makeTitleStyle, MejoresDias_shimmerCSS, TopServicios_useBreakpoint, TopServicios_PALETTE, TopServicios_getSlug, TopServicios_getToken, TopServicios_MOCK_TURNOS, TopServicios_ServicioData, TopServicios_procesarTurnos, TopServicios_makeCardBase, TopServicios_makeTitleStyle, TopServicios_shimmerCSS, HorasTrabajadas_useBreakpoint, HorasTrabajadas_getSlug, HorasTrabajadas_getToken, HorasTrabajadas_minutosATexto, HorasTrabajadas_MOCK_STATS, HorasTrabajadas_diasUnicos, HorasTrabajadas_makeCardBase, HorasTrabajadas_makeTitleStyle, HorasTrabajadas_makeSectionTitle, HorasTrabajadas_shimmerCSS, ServiciosManager_getSlug, ServiciosManager_getToken, ServiciosManager_parseDesc, ServiciosManager_buildDesc, ServiciosManager_useContainerWidth, ServiciosManager_formatDuracion, ServiciosManager_Servicio, ServiciosManager_FormData, ServiciosManager_Extra, ServiciosManager_ExtraFormData, ServiciosManager_PRECIO_MINIMO, ServiciosManager_PRECIO_MINIMO_EXTRA, ServiciosManager_FORM_EMPTY, ServiciosManager_EXTRA_FORM_EMPTY, ServiciosManager_DURACIONES, ServiciosManager_cardBase, ServiciosManager_shimmerCSS, ServiciosManager_ImageUploaderProps, ServiciosManager_FormProps, ServiciosManager_ExtraFormProps, ServiciosManager_EmployeeCardStyle, CatalogoProfesional, ClientesGrid_getSlug, ClientesGrid_getToken, ClientesGrid_useContainerWidth, ClientesGrid_getColumnas, ClientesGrid_buildClientes, ClientesGrid_frecuenciaLabel, ClientesGrid_frecuenciaColor, ClientesGrid_MOCK_CLIENTES, ClientesGrid_LIMITE_GRATIS, ClientesGrid_wrapperBase, ClientesGrid_shimmerCSS, AgendaPanel_getSlug, AgendaPanel_getToken, AgendaPanel_formatFecha, AgendaPanel_formatFechaParts, AgendaPanel_hoyISO, AgendaPanel_cleanTel, AgendaPanel_filtrarPasados, AgendaPanel_esPendienteAprobacion, AgendaPanel_tieneReprogramacionPendiente, AgendaPanel_faltaProfesional, AgendaPanel_metodoPagoLabel, AgendaPanel_estadoPagoLabel, AgendaPanel_formatMonto, AgendaPanel_extrasLabel, AgendaPanel_tieneExtras, AgendaPanel_useContainerWidth, AgendaPanel_mockDias, AgendaPanel_INK, AgendaPanel_SLATE, AgendaPanel_HAIRLINE, AgendaPanel_CANVAS, AgendaPanel_SURFACE, AgendaPanel_GHOST, AgendaPanel_FONT_DISPLAY, AgendaPanel_FONT_BODY, AgendaPanel_labelStyle, AgendaPanel_inputStyle, AgendaPanel_wrapperBase, AgendaPanel_globalCSS, HorariosConfig_DIAS_CONFIG, HorariosConfig_HORARIOS_VACIO, HorariosConfig_HORARIOS_EJEMPLO_CANVAS, HorariosConfig_getSlug, HorariosConfig_getToken, HorariosConfig_useContainerWidth, HorariosConfig_cardBase, HorariosConfig_shimmerCSS, ExcepcionesConfig_ExcType, ExcepcionesConfig_Slot, ExcepcionesConfig_Excepcion, ExcepcionesConfig_Excepciones, ExcepcionesConfig_MESES, ExcepcionesConfig_getSlug, ExcepcionesConfig_getToken, ExcepcionesConfig_makeDateKey, ExcepcionesConfig_getMonthStart, ExcepcionesConfig_getDaysInMonth, ExcepcionesConfig_useContainerWidth, ExcepcionesConfig_shimmerCSS, ExcepcionesConfig_timeInputStyle, ExcepcionesConfig_DayPanelProps, ExcepcionesConfig_Props, MercadoPagoConexion_getSlug, MercadoPagoConexion_getToken, MercadoPagoConexion_solicitarUrlOAuth, Pagos_baselineDesdeSettings, MercadoPagoConexion_emitPagosChanged, MercadoPagoConexion_globalCSS, MercadoPagoConexion_cardBase, MercadoPagoConexion_inputStyle, MercadoPagoConexion_CBU_REGEX, MercadoPagoConexion_ALIAS_REGEX, MercadoPagoConexion_EstadoConexion, MercadoPagoConexion_MetodoPago, MercadoPagoConexion_DatosBancarios, ConfigPagos_SENA_MINIMA, ConfigPagos_getSlug, ConfigPagos_getToken, ConfigPagos_useContainerWidth, ConfigPagos_MetodoPago, ConfigPagos_cardBase, ConfigPagos_shimmerCSS, ConfigPagos_OpcionMetodoProps, ThemeEditor_getSlug, ThemeEditor_getToken, ThemeEditor_Tema, ThemeEditor_TEMA_DEFAULT, ThemeEditor_COLOR_KEYS, ThemeEditor_temaCompleto, ThemeEditor_mismoTema, ThemeEditor_PALETAS, ThemeEditor_cardBase, ThemeEditor_shimmerCSS, TeamManager_getSlug, TeamManager_getToken, TeamManager_Miembro, TeamManager_OwnerFallback, TeamManager_FormData, TeamManager_ServicioAsignable, TeamManager_COLORES, TeamManager_ROLES, TeamManager_FORM_EMPTY, TeamManager_cardBase, TeamManager_shimmerCSS, TeamManager_PERIODOS_NETO, TeamManager_NetoData, TeamManager_fmtPesos, TeamManager_useContainerWidth, SeccionId, NAV_ITEMS, MenuUserAvatar, MenuFooter_getSlug, MenuFooter_getToken, MenuFooter_useLogoNegocio, MenuFooter_limpiarDatosDeCuenta, MenuFooter_cerrarSesion, MenuCuenta_TERMINOS_URL, MenuCuenta_PRIVACIDAD_URL, MenuCuenta_FONT, MenuCuenta_Z, MenuCuenta_FLY_W, MenuCuenta_SHADOW, MenuCuentaMpSdkPromise, MenuCuentaLoadMpSdk, MenuCuentaGraciasImagen, MenuCuentaReduccionImagen, MenuCuentaGraciasPreviewCSS, MenuFooter_useSoporte, OnboardingNube_INK, OnboardingNube_ACCENT, OnboardingNube_ACCENT_SOFT, OnboardingNube_MUTED, OnboardingNube_HAIRLINE, OnboardingNube_FONT_DISPLAY, OnboardingNube_FONT_BODY, OnboardingNube_getSlug, OnboardingNube_getToken, OnboardingNube_marcarVisto, OnboardingNube_MSG_SIN_SESION, OnboardingNube_esperarToken, OnboardingNube_DIAS, OnboardingNube_DURACIONES, QrPanel_ECC_PER_BLOCK, QrPanel_NUM_BLOCKS, QrPanel_alignPositions, QrPanel_rawModules, QrPanel_dataCodewords, QrPanel_gfMul, QrPanel_rsDivisor, QrPanel_rsRemainder, QrPanel_utf8, QrPanel_penalty, QrPanel_encode, QrPanel_path, QrPanel_svgString, QrPanel_dibujarQr, QrPanel_canvasQr, QrPanel_canvasCartel, QrPanel_guardarBlob, QrPanel_guardarCanvas, QrPanel_slug, TurnitsInstallPromptEvent, FinanzasGasto, FINANZAS_CATEGORIAS, FINANZAS_CATEGORIAS_MANUALES, finanzasHoyLocal, FINANZAS_GASTO_GUIAS, FINANZAS_GASTO_TIPOS, FINANZAS_PICKER_CSS, FINANZAS_FECHA_CSS, finanzasFechaISO, finanzasFechaParse, finanzasMetricasNegocio, TurnitsSidebarUtilityButton, TurnitsSidebarUtilityIcon, TurnitsSidebarUtilityBadge, TurnitsDashboard_getSlug, TurnitsDashboard_getToken, TurnitsDashboard_money, TurnitsDashboard_shortMoney, TurnitsDashboard_percent, TurnitsDashboard_dateLabel, TurnitsDashboard_COLOR_SUBE, TurnitsDashboard_COLOR_BAJA, TurnitsDashboard_COLOR_IGUAL, TurnitsDashboard_MESES_CORTOS, TurnitsDashboard_rangoLabel, TurnitsDashboard_variacion, GuardaSesion_TOKEN_KEYS, GuardaSesion_leerJwt, GuardaSesion_detectar, CardBox, SeccionHeader }
