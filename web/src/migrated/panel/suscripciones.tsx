import * as React from "react"
import { MenuFooter_getSlug, MenuFooter_getToken } from "./common"
import "./promociones.css"

type CatalogItem = { id: string; nombre: string; activo: boolean }
type Plan = {
    id: string
    nombre: string
    descripcion: string
    precio_mensual: number
    servicio_ids: string[]
    producto_ids: string[]
    publicado: boolean
}
type Catalog = { servicios: CatalogItem[]; productos: CatalogItem[]; membresias: Plan[] }
type Form = Omit<Plan, "id" | "precio_mensual"> & { precio_mensual: string }
type Selection = "servicio_ids" | "producto_ids"

const emptyForm = (): Form => ({
    nombre: "", descripcion: "", precio_mensual: "", servicio_ids: [], producto_ids: [], publicado: false,
})
const sections = [["Servicios", "servicios", "servicio_ids"], ["Productos", "productos", "producto_ids"]] as const
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid #c9cdc9", font: "inherit" }
const action: React.CSSProperties = { padding: "9px 14px", borderRadius: 10, border: "1px solid #c9cdc9", background: "white", color: "#19211a", font: "inherit", cursor: "pointer" }
const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }

export function SuscripcionesPanel({ api, accentColor }: { api: string; accentColor: string }) {
    const slug = MenuFooter_getSlug()
    const token = MenuFooter_getToken()
    const [catalog, setCatalog] = React.useState<Catalog | null>(null)
    const [form, setForm] = React.useState<Form | null>(null)
    const [editing, setEditing] = React.useState<Plan | null>(null)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState("")
    const [status, setStatus] = React.useState("")
    const [retry, setRetry] = React.useState(0)
    const titleRef = React.useRef<HTMLInputElement>(null)

    const request = React.useCallback(async <T,>(suffix = "", init: RequestInit = {}): Promise<T> => {
        if (!slug || !token) throw new Error("Volvé a iniciar sesión para administrar las suscripciones.")
        const response = await fetch(`${api}/admin/membresias/${encodeURIComponent(slug)}${suffix}`, {
            ...init, cache: "no-store",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.error || "No pudimos completar la operación.")
        return data
    }, [api, slug, token])

    React.useEffect(() => {
        const controller = new AbortController()
        setError("")
        request<Catalog>("", { signal: controller.signal })
            .then(data => { if (!controller.signal.aborted) setCatalog(data) })
            .catch(err => { if (!controller.signal.aborted) setError(err.message) })
        return () => controller.abort()
    }, [request, retry])

    const formOpen = form !== null
    React.useEffect(() => { if (formOpen) titleRef.current?.focus() }, [formOpen])

    const change = <Key extends keyof Form>(key: Key, value: Form[Key]) =>
        setForm(current => current && { ...current, [key]: value })

    const open = (plan: Plan | null) => {
        setEditing(plan)
        setError("")
        setStatus("")
        setForm(plan ? { ...plan, precio_mensual: String(plan.precio_mensual) } : emptyForm())
    }

    const persist = async (message: string, suffix: string, method: string, body?: Omit<Plan, "id">) => {
        setBusy(true)
        setError("")
        setStatus("")
        try {
            const { membresia } = await request<{ membresia: Plan }>(suffix, { method, body: body && JSON.stringify(body) })
            setCatalog(current => current && {
                ...current,
                membresias: current.membresias.some(plan => plan.id === membresia.id)
                    ? current.membresias.map(plan => plan.id === membresia.id ? membresia : plan)
                    : [membresia, ...current.membresias],
            })
            setForm(null)
            setEditing(null)
            setStatus(message)
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos guardar la suscripción.")
        } finally {
            setBusy(false)
        }
    }

    if (!catalog) return error ? <div><p role="alert">{error}</p><button type="button" style={action} onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> : <p role="status">Cargando suscripciones…</p>

    const primary = { ...action, background: accentColor || "#196b1f", color: "#fff", borderColor: "transparent" }
    const names = (ids: string[], items: CatalogItem[]) => ids.map(id => items.find(item => item.id === id)?.nombre || "Elemento eliminado")
    const check = (key: Selection, id: string, checked: boolean) =>
        setForm(current => current && { ...current, [key]: checked ? [...current[key], id] : current[key].filter(value => value !== id) })

    return <div style={{ display: "grid", gap: 16 }}>
        {status && <p role="status" style={{ margin: 0 }}>{status}</p>}
        {!form && <div style={row}><button type="button" style={primary} disabled={busy} onClick={() => open(null)}>Nueva suscripción</button></div>}
        {form ? (
            <form onSubmit={event => {
                event.preventDefault()
                if (busy) return
                const price = form.precio_mensual.trim().replace(",", ".")
                if (!form.nombre.trim() || !/^\d{1,10}(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || ![...form.servicio_ids, ...form.producto_ids].length) {
                    setError("Ingresá el nombre, un precio mensual válido y al menos un servicio o producto.")
                    return
                }
                const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
                const publicado = editing?.publicado || submitter?.value === "publicar"
                void persist(publicado ? "Suscripción publicada." : "Borrador guardado.", editing ? `/${editing.id}` : "", editing ? "PUT" : "POST", {
                    nombre: form.nombre, descripcion: form.descripcion, precio_mensual: Number(price),
                    servicio_ids: form.servicio_ids, producto_ids: form.producto_ids, publicado,
                })
            }} className="promo-card" style={{ padding: "clamp(16px, 3vw, 28px)", gap: 16 }}>
                <h3 style={{ margin: 0 }}>{editing ? "Editar suscripción" : "Nueva suscripción"}</h3>
                <label>Nombre<input ref={titleRef} required maxLength={100} value={form.nombre} onChange={event => change("nombre", event.target.value)} style={field} disabled={busy} /></label>
                <label>Descripción<textarea rows={3} maxLength={600} value={form.descripcion} onChange={event => change("descripcion", event.target.value)} style={{ ...field, resize: "vertical" }} disabled={busy} /></label>
                <label>Precio mensual (ARS)<input required inputMode="decimal" maxLength={13} value={form.precio_mensual} onChange={event => change("precio_mensual", event.target.value)} style={field} disabled={busy} /></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 245px),1fr))", gap: 12 }}>
                    {sections.map(([label, items, key]) => {
                        const options = catalog[items].filter(item => item.activo || form[key].includes(item.id))
                        const missing = form[key].filter(id => !options.some(item => item.id === id))
                        return <fieldset key={key} disabled={busy} style={{ minWidth: 0, border: "1px solid #c9cdc9", borderRadius: 12, margin: 0, padding: 12 }}>
                            <legend>{label} incluidos ({form[key].length})</legend>
                            {!options.length && !missing.length && <span>No hay {label.toLowerCase()} activos en tu catálogo.</span>}
                            {[...options, ...missing.map(id => ({ id, nombre: "Elemento eliminado", activo: false }))].map(item => (
                                <label key={item.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0", overflowWrap: "anywhere" }}>
                                    <input type="checkbox" style={{ accentColor }} checked={form[key].includes(item.id)}
                                        onChange={event => check(key, item.id, event.target.checked)} />
                                    <span>{item.nombre}{!item.activo && " (no disponible)"}</span>
                                </label>
                            ))}
                        </fieldset>
                    })}
                </div>
                {error && <p role="alert" style={{ color: "#9f211a", margin: 0 }}>{error}</p>}
                <div style={row}>
                    <button type="button" style={action} disabled={busy} onClick={() => { setForm(null); setError("") }}>Cancelar</button>
                    {!editing?.publicado && <button type="submit" style={action} disabled={busy}>Guardar borrador</button>}
                    <button type="submit" style={primary} disabled={busy} value="publicar">{busy ? "Guardando…" : editing?.publicado ? "Guardar cambios" : "Publicar"}</button>
                </div>
            </form>
        ) : <>
            {error && <p role="alert" style={{ color: "#9f211a", margin: 0 }}>{error}</p>}
            {!catalog.membresias.length && <p>Todavía no hay suscripciones.</p>}
            <div className="promo-grid">
                {catalog.membresias.map(plan => <article key={plan.id} className="promo-card" style={{ padding: 16, gap: 10, overflowWrap: "anywhere" }}>
                    <span style={{ fontSize: 13 }}>{plan.publicado ? "Publicada" : "Borrador"}</span>
                    <h3 style={{ margin: 0 }}>{plan.nombre}</h3>
                    <strong>{money.format(plan.precio_mensual)} / mes</strong>
                    {plan.descripcion && <p style={{ margin: 0 }}>{plan.descripcion}</p>}
                    {sections.map(([label, items, key]) => plan[key].length > 0 &&
                        <div key={key}><strong>{label}</strong><ul style={{ margin: "4px 0", paddingLeft: 19 }}>{names(plan[key], catalog[items]).map((name, index) => <li key={plan[key][index]}>{name}</li>)}</ul></div>)}
                    <div style={{ ...row, marginTop: "auto" }}>
                        <button type="button" style={action} disabled={busy} onClick={() => open(plan)}>Editar</button>
                        {plan.publicado && <button type="button" style={action} disabled={busy} onClick={() => void persist("Suscripción despublicada.", `/${plan.id}/despublicar`, "PUT")}>Despublicar</button>}
                    </div>
                </article>)}
            </div>
        </>}
    </div>
}
