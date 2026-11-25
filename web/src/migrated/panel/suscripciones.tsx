import * as React from "react"
import { MenuFooter_getSlug, MenuFooter_getToken, ServiciosManager_parseDesc } from "./common"
import { BackButton } from "../../components/BackButton"
import { PromotionDiscountArrow } from "./PromotionDiscountArrow"
import { CatalogToolbar } from "./CatalogToolbar"
import { ServiciosManager_FieldIcon, ServiciosManager_ImageUploader, ServiciosManager_SeccionIcon } from "./servicios"
import "./promociones.css"

type Professional = { id: string; nombre: string; apellido?: string; foto_url?: string; color?: string }
type CatalogItem = { id: string; nombre: string; activo: boolean; precio?: number; descripcion?: string; imagen_url?: string; profesionales?: Professional[] }
const professionalName = (person: Professional) => [person.nombre, person.apellido].filter(Boolean).join(" ")
type Plan = {
    id: string
    nombre: string
    descripcion: string
    precio_mensual: number
    servicio_ids: string[]
    producto_ids: string[]
    imagen_url: string | null
    cantidades_servicios: Record<string, number>
    profesional_ids: string[]
    publicado: boolean
}
type Catalog = { servicios: CatalogItem[]; productos: CatalogItem[]; membresias: Plan[]; equipo?: Professional[] }
type Form = Omit<Plan, "id" | "precio_mensual"> & { precio_mensual: string }
type Selection = "servicio_ids" | "producto_ids"

const emptyForm = (): Form => ({
    nombre: "", descripcion: "", precio_mensual: "", servicio_ids: [], producto_ids: [], imagen_url: null, cantidades_servicios: {}, profesional_ids: [], publicado: false,
})
const sections = [["Servicios", "servicios", "servicio_ids"], ["Productos", "productos", "producto_ids"]] as const
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const filters = [{ id: "todos", label: "Todos" }, { id: "publicadas", label: "Publicadas" }, { id: "borradores", label: "Borradores" }] as const
const orders = [{ id: "recientes", label: "Recientes" }, { id: "az", label: "A–Z" }, { id: "precio", label: "Precio" }] as const
const fieldTitle = (icon: string, text: string) =>
    <span className="catalog-field-title"><ServiciosManager_FieldIcon name={icon} size={16} color="#566257" />{text}</span>
const countServices = (plan: Pick<Plan, "servicio_ids" | "cantidades_servicios">) =>
    plan.servicio_ids.reduce((total, id) => total + (plan.cantidades_servicios?.[id] ?? 1), 0)
const countLabel = (count: number) => `${count} ${count === 1 ? "servicio" : "servicios"} al mes`
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
    const [uploading, setUploading] = React.useState(false)
    const [filter, setFilter] = React.useState<(typeof filters)[number]["id"]>("todos")
    const [order, setOrder] = React.useState<(typeof orders)[number]["id"]>("recientes")
    const [search, setSearch] = React.useState("")
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
        setForm(plan ? { ...plan, imagen_url: plan.imagen_url ?? null, cantidades_servicios: plan.cantidades_servicios ?? {}, profesional_ids: plan.profesional_ids ?? [], precio_mensual: String(plan.precio_mensual) } : emptyForm())
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

    if (!catalog) return error ? <div><p role="alert">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> : <p role="status">Cargando suscripciones…</p>

    const servicesById = new Map(catalog.servicios.map(item => [item.id, item]))
    const productsById = new Map(catalog.productos.map(item => [item.id, item]))
    const team = catalog.equipo ?? []
    const canOffer = (personId: string, serviceIds: string[]) => serviceIds.every(id =>
        servicesById.get(id)?.profesionales?.some(person => person.id === personId)
    )
    const originalPrice = (plan: Pick<Plan, "servicio_ids" | "producto_ids" | "cantidades_servicios">) =>
        plan.servicio_ids.reduce((sum, id) => sum + (Number(servicesById.get(id)?.precio) || 0) * (plan.cantidades_servicios?.[id] ?? 1), 0) +
        plan.producto_ids.reduce((sum, id) => sum + (Number(productsById.get(id)?.precio) || 0), 0)
    const original = form ? originalPrice(form) : 0
    const names = (ids: string[], items: CatalogItem[]) => ids.map(id => items.find(item => item.id === id)?.nombre || "Elemento eliminado")
    const toggle = (key: Selection, id: string) =>
        setForm(current => current && {
            ...current,
            [key]: current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id],
        })
    const adjust = (id: string, delta: number) => setForm(current => {
        if (!current) return current
        const cantidad = Math.max(1, Math.min(99, (current.cantidades_servicios[id] ?? 1) + delta))
        return { ...current, cantidades_servicios: { ...current.cantidades_servicios, [id]: cantidad } }
    })
    const visible = catalog.membresias.filter(plan =>
        (filter === "todos" || plan.publicado === (filter === "publicadas")) &&
        plan.nombre.toLocaleLowerCase("es-AR").includes(search.trim().toLocaleLowerCase("es-AR"))
    )
    if (order === "az") visible.sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR"))
    if (order === "precio") visible.sort((a, b) => a.precio_mensual - b.precio_mensual)

    return <div style={{ display: "grid", gap: 16 }}>
        {status && <p role="status" style={{ margin: 0 }}>{status}</p>}
        {!form && <CatalogToolbar<(typeof filters)[number]["id"], (typeof orders)[number]["id"]> label="suscripciones" filters={filters} filterValue={filter} onFilter={setFilter}
            opcionesOrden={orders} sort={order} onSort={setOrder} search={search} onSearch={setSearch}
            onCreate={busy ? undefined : () => open(null)} />}
        <section className="promotions" style={{ "--green": accentColor || "#196b1f" } as React.CSSProperties}>
        {form ? (
            <form className="promo-editor" onSubmit={event => {
                event.preventDefault()
                if (busy || uploading) return
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
                    imagen_url: form.imagen_url,
                    profesional_ids: form.profesional_ids.filter(id => team.some(person => person.id === id) && canOffer(id, form.servicio_ids)),
                    cantidades_servicios: Object.fromEntries(form.servicio_ids.map(id => [id, form.cantidades_servicios[id] ?? 1])),
                })
            }}>
                <BackButton floating disabled={busy || uploading} onClick={() => { setForm(null); setError("") }} />
                <fieldset disabled={busy}>
                    <label>
                        {fieldTitle("tag", "Nombre de la suscripción")}
                        <small className="catalog-hint">Aparece en la página pública de tu negocio.</small>
                        <input ref={titleRef} required maxLength={100} placeholder="Ej. Club de cortes" value={form.nombre} onChange={event => change("nombre", event.target.value)} />
                    </label>
                    <div className="promo-intro">
                        <div>
                            {fieldTitle("image", "Imagen de portada")}
                            <small className="catalog-hint">Subí una imagen para la tarjeta de la suscripción.</small>
                            <ServiciosManager_ImageUploader size={450} value={form.imagen_url || ""}
                                onChange={value => change("imagen_url", value || null)} onUploadingChange={setUploading}
                                accentColor={accentColor} apiUrl={api} />
                        </div>
                        <div className="promo-details" style={{ alignContent: "start" }}>
                            <label>
                                {fieldTitle("align-left", "Descripción")}
                                <small className="catalog-hint">Contá cuáles son los beneficios y cómo se usan.</small>
                                <textarea maxLength={600} placeholder="Ej. Incluye cuatro cortes al mes." value={form.descripcion} onChange={event => change("descripcion", event.target.value)} />
                            </label>
                            <div className="promo-prices">
                                <div>
                                    {fieldTitle("dollar", "Precio original")}
                                    <small className="catalog-hint">Total por separado.</small>
                                    <output aria-live="polite" style={{ overflowWrap: "anywhere" }}>{money.format(original)}</output>
                                </div>
                                <PromotionDiscountArrow original={original} final={Number(form.precio_mensual.trim().replace(",", "."))} />
                                <label>
                                    {fieldTitle("dollar", "Precio mensual")}
                                    <span className="promo-money-input"><span aria-hidden="true">$</span>
                                        <input required style={{ flex: 1, minWidth: 0, width: 0, border: 0, paddingInline: 0, outline: "none" }} inputMode="decimal" maxLength={13} placeholder="Ej. 25000" value={form.precio_mensual} onChange={event => change("precio_mensual", event.target.value)} />
                                    </span>
                                </label>
                            </div>
                            <div>
                                {fieldTitle("user-check", "Profesionales que ofrecen la suscripción")}
                                <small className="catalog-hint">Elegí quiénes pueden realizar todos los servicios incluidos.</small>
                                {team.length ? <div className="promo-people" role="group" aria-label="Profesionales que ofrecen la suscripción">
                                    {team.map(person => {
                                        const name = professionalName(person)
                                        const eligible = canOffer(person.id, form.servicio_ids)
                                        const selected = eligible && form.profesional_ids.includes(person.id)
                                        return <button key={person.id} type="button" aria-label={name} aria-pressed={selected} disabled={!eligible}
                                            title={eligible ? name : `${name} no ofrece todos los servicios incluidos`}
                                            style={{ background: person.color || "#704dad" }}
                                            onClick={() => change("profesional_ids", selected ? form.profesional_ids.filter(id => id !== person.id) : [...form.profesional_ids, person.id])}>
                                            {person.foto_url ? <img src={person.foto_url} alt="" /> : name.slice(0, 1)}
                                            {selected && <small><img src="/assets/panel-nav/akar-icons_check.svg" alt="" width="12" height="12" /></small>}
                                        </button>
                                    })}
                                </div> : <small className="catalog-hint">No hay profesionales activos.</small>}
                                <div aria-live="polite" style={{ marginTop: 8, overflowWrap: "anywhere" }}>
                                    {team.filter(person => form.profesional_ids.includes(person.id) && canOffer(person.id, form.servicio_ids)).map(professionalName).join(", ")}
                                </div>
                            </div>
                        </div>
                    </div>
                    {sections.map(([label, items, key]) => {
                        const isService = key === "servicio_ids"
                        const icon = isService ? "servicios" : "extras"
                        const options = catalog[items].filter(item => item.activo || form[key].includes(item.id))
                        const missing = form[key].filter(id => !options.some(item => item.id === id))
                        return <section className="promo-items" key={key}>
                            <h3 className="catalog-field-title"><ServiciosManager_SeccionIcon tipo={icon} size={16} />{label} incluidos</h3>
                            {isService && <output aria-live="polite" style={{ fontWeight: 700 }}>{countLabel(countServices(form))}</output>}
                            {!options.length && !missing.length && <p>No hay {label.toLowerCase()} activos en tu catálogo.</p>}
                            {[...options, ...missing.map(id => ({ id, nombre: "Elemento eliminado", activo: false } as CatalogItem))].map(item => {
                                const { imagen, descripcion } = ServiciosManager_parseDesc(item.descripcion || "")
                                const photo = item.imagen_url || imagen
                                const selected = form[key].includes(item.id)
                                const quantity = form.cantidades_servicios[item.id] ?? 1
                                return <div className="promo-line" key={item.id} data-selected={selected}>
                                    <button className="promo-choice" type="button" aria-pressed={selected} onClick={() => toggle(key, item.id)}>
                                        <span className="promo-check">{selected && <img src="/assets/panel-nav/akar-icons_check.svg" alt="" width="12" height="12" />}</span>
                                        {photo ? <img src={photo} alt="" loading="lazy" /> : <span className="promo-thumb"><ServiciosManager_SeccionIcon tipo={icon} /></span>}
                                        <span><strong>{item.nombre}</strong>{!item.activo ? <small>No disponible</small> : descripcion && <small>{descripcion}</small>}</span>
                                    </button>
                                    {isService && selected && <div className="promo-count" style={row}>
                                        <button type="button" aria-label={`Reducir cantidad mensual de ${item.nombre}`} disabled={quantity <= 1} onClick={() => adjust(item.id, -1)}>−</button>
                                        <span>{quantity}</span>
                                        <button type="button" aria-label={`Aumentar cantidad mensual de ${item.nombre}`} disabled={quantity >= 99} onClick={() => adjust(item.id, 1)}>+</button>
                                    </div>}
                                </div>
                            })}
                        </section>
                    })}
                    {error && <p role="alert" className="promo-error">{error}</p>}
                    <div style={{ ...row, justifyContent: "flex-end" }}>
                        {!editing?.publicado && <button type="submit" className="svc-edit-button" disabled={busy || uploading}>Guardar borrador</button>}
                        <button type="submit" className="promo-primary" disabled={busy || uploading} value="publicar">{busy ? "Guardando…" : editing?.publicado ? "Guardar cambios" : "Publicar"}</button>
                    </div>
                </fieldset>
            </form>
        ) : <>
            {error && <p role="alert" className="promo-error">{error}</p>}
            {!visible.length && <p>{catalog.membresias.length ? "No hay suscripciones que coincidan." : "Todavía no hay suscripciones."}</p>}
            <div className="promo-grid">
                {visible.map(plan => {
                    const original = originalPrice(plan)
                    const professionals = team.filter(person => plan.profesional_ids?.includes(person.id) && canOffer(person.id, plan.servicio_ids))
                    return <article key={plan.id} className="promo-card">
                    <div className="promo-cover">
                        {plan.imagen_url ? <img src={plan.imagen_url} alt="" loading="lazy" /> : <ServiciosManager_SeccionIcon tipo="promociones" size={48} />}
                        {plan.servicio_ids.length > 0 && <div className="promo-badges"><b>{countLabel(countServices(plan))}</b></div>}
                    </div>
                    <div className="promo-foot">
                        <div className="promo-heading">
                            <strong>{plan.nombre}</strong>
                            <div className="promo-cost">{money.format(plan.precio_mensual)} / mes {original > plan.precio_mensual && <del>{money.format(original)}</del>}</div>
                            {professionals.length > 0 && <p style={{ overflowWrap: "anywhere" }}>{professionals.map(professionalName).join(", ")}</p>}
                            {plan.descripcion && <p style={{ overflowWrap: "anywhere" }}>{plan.descripcion}</p>}
                            {sections.map(([label, items, key]) => plan[key].length > 0 &&
                                <div key={key} style={{ marginTop: 8, overflowWrap: "anywhere" }}><b>{label}</b>
                                    <ul style={{ margin: "4px 0", paddingLeft: 19 }}>
                                        {names(plan[key], catalog[items]).map((name, index) =>
                                            <li key={plan[key][index]}>{key === "servicio_ids" && `${plan.cantidades_servicios?.[plan[key][index]] ?? 1} × `}{name}</li>)}
                                    </ul>
                                </div>)}
                        </div>
                        <span className="promo-status" data-active={plan.publicado}>● {plan.publicado ? "Publicada" : "Borrador"}</span>
                        <div className="promo-actions" style={{ flexWrap: "wrap" }}>
                            <button type="button" className="svc-edit-button" disabled={busy} onClick={() => open(plan)}>Editar</button>
                            {plan.publicado && <button type="button" disabled={busy} onClick={() => void persist("Suscripción despublicada.", `/${plan.id}/despublicar`, "PUT")}>Despublicar</button>}
                        </div>
                    </div>
                </article>})}
            </div>
        </>}
        </section>
    </div>
}
