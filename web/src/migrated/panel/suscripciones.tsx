import MembershipPaymentReview from "./membership-payment-review"
import * as React from "react"
import { MenuFooter_getSlug, MenuFooter_getToken, ServiciosManager_parseDesc, TurnitsGlobalSaveManager_get } from "./common"
import { BackButton } from "../../components/BackButton"
import { PromotionDiscountArrow } from "./PromotionDiscountArrow"
import { CatalogToolbar } from "./CatalogToolbar"
import { ServiciosManager_FieldIcon, ServiciosManager_ImageUploader, ServiciosManager_RowMenu, ServiciosManager_SeccionIcon } from "./servicios"
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
    cantidades_productos: Record<string, number>
    profesional_ids: string[]
    publicado: boolean
}
type Catalog = { servicios: CatalogItem[]; productos: CatalogItem[]; membresias: Plan[]; equipo?: Professional[] }
type Form = Omit<Plan, "id" | "precio_mensual"> & { precio_mensual: string }
type Selection = "servicio_ids" | "producto_ids"
type Payload = Omit<Plan, "id" | "publicado">
export type SubscriptionDraft = { id?: string; form: Form; payload: Payload; valid: boolean }
const quantityField = { servicio_ids: "cantidades_servicios", producto_ids: "cantidades_productos" } as const
const photoOf = (item?: CatalogItem) => item?.imagen_url || ServiciosManager_parseDesc(item?.descripcion || "").imagen
const quantityOf = (plan: Pick<Plan, "cantidades_servicios" | "cantidades_productos">, key: Selection, id: string) =>
    plan[quantityField[key]]?.[id] ?? 1
const professionalsFor = (catalog: Catalog, id: string, serviceIds: string[]) =>
    serviceIds.every(serviceId => catalog.servicios.find(item => item.id === serviceId)?.profesionales?.some(person => person.id === id))
const payloadFor = (form: Form, catalog: Catalog): Payload => ({
    nombre: form.nombre, descripcion: form.descripcion, precio_mensual: Number(form.precio_mensual.trim().replace(",", ".")),
    servicio_ids: form.servicio_ids, producto_ids: form.producto_ids, imagen_url: form.imagen_url,
    profesional_ids: form.profesional_ids.filter(id => catalog.equipo?.some(person => person.id === id) && professionalsFor(catalog, id, form.servicio_ids)),
    cantidades_servicios: Object.fromEntries(form.servicio_ids.map(id => [id, quantityOf(form, "servicio_ids", id)])),
    cantidades_productos: Object.fromEntries(form.producto_ids.map(id => [id, quantityOf(form, "producto_ids", id)])),
})

const emptyForm = (): Form => ({
    nombre: "", descripcion: "", precio_mensual: "", servicio_ids: [], producto_ids: [], imagen_url: null, cantidades_servicios: {}, cantidades_productos: {}, profesional_ids: [], publicado: false,
})
function formFromPlan(plan: Plan): Form {
    const { id: _id, ...rest } = plan
    return { ...rest, imagen_url: plan.imagen_url ?? null, cantidades_servicios: plan.cantidades_servicios ?? {},
        cantidades_productos: plan.cantidades_productos ?? {}, profesional_ids: plan.profesional_ids ?? [], precio_mensual: String(plan.precio_mensual) }
}
const sections = [["Servicios", "servicios", "servicio_ids"], ["Productos", "productos", "producto_ids"]] as const
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const filters = [{ id: "todos", label: "Todos" }, { id: "publicadas", label: "Activas" }, { id: "borradores", label: "Pausadas" }] as const
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
    const [saving, setSaving] = React.useState(false)
    const [draftKey, setDraftKey] = React.useState<string | null>(null)
    const [menuId, setMenuId] = React.useState<string | null>(null)
    const anchor = React.useRef<HTMLButtonElement>(null)
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

    const close = () => { setForm(null); setEditing(null); setDraftKey(null); setError("") }
    const open = (plan: Plan | null) => {
        const drafts: Record<string, SubscriptionDraft> = TurnitsGlobalSaveManager_get()?.getPending("suscripciones") ?? {}
        const key = plan?.id ?? Object.keys(drafts).find(id => !drafts[id].id) ?? crypto.randomUUID()
        setEditing(plan)
        setDraftKey(key)
        setMenuId(null)
        setError("")
        setForm(drafts[key]?.form ?? (plan ? formFromPlan(plan) : emptyForm()))
    }

    React.useEffect(() => {
        const manager = TurnitsGlobalSaveManager_get()
        if (!manager) return
        manager.configure(api)
        manager.setBlocker("suscripciones", uploading ? "Esperá a que termine de subir la portada." : busy ? "Esperá a que se actualice el estado de la suscripción." : "")
        return () => manager.setBlocker("suscripciones", "")
    }, [api, busy, uploading])

    React.useEffect(() => {
        if (!form || !catalog || !draftKey) return
        const manager = TurnitsGlobalSaveManager_get()
        if (!manager) return
        const pending: Record<string, SubscriptionDraft> = { ...manager.getPending("suscripciones") }
        const payload = payloadFor(form, catalog)
        const price = form.precio_mensual.trim().replace(",", ".")
        const size = form.servicio_ids.length + form.producto_ids.length
        const valid = Boolean(form.nombre.trim()) && /^\d{1,10}(?:\.\d{1,2})?$/.test(price) && payload.precio_mensual > 0 && size >= 1 && size <= 100
        if (JSON.stringify(form) === JSON.stringify(editing ? formFromPlan(editing) : emptyForm())) delete pending[draftKey]
        else pending[draftKey] = { id: editing?.id, form, payload, valid }
        if (Object.keys(pending).length) manager.markDirty("suscripciones", pending)
        else manager.clear("suscripciones")
    }, [form, catalog, draftKey, editing])

    React.useEffect(() => {
        const manager = TurnitsGlobalSaveManager_get()
        setSaving(manager?.isSaving() ?? false)
        const onSaving = (event: Event) => setSaving(Boolean((event as CustomEvent).detail?.saving))
        const onSaved = (event: Event) => {
            const detail = (event as CustomEvent).detail
            if (detail?.section !== "suscripciones") return
            const plans = Object.values(detail.data as Record<string, Plan>)
            setCatalog(current => current && {
                ...current,
                membresias: [...plans.filter(plan => !current.membresias.some(item => item.id === plan.id)),
                    ...current.membresias.map(item => plans.find(plan => plan.id === item.id) || item)],
            })
            if (draftKey && detail.data[draftKey] && !manager?.getPending("suscripciones")?.[draftKey]) close()
        }
        window.addEventListener("turnits_global_save_state", onSaving)
        window.addEventListener("turnits_global_saved", onSaved)
        window.addEventListener("turnits_global_discarded", close)
        return () => {
            window.removeEventListener("turnits_global_save_state", onSaving)
            window.removeEventListener("turnits_global_saved", onSaved)
            window.removeEventListener("turnits_global_discarded", close)
        }
    }, [draftKey])

    React.useEffect(() => {
        if (!menuId) return
        const outside = (event: PointerEvent) => {
            if (!(event.target as Element).closest(".svc-row-menu,.promo-menu-trigger")) setMenuId(null)
        }
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") { anchor.current?.focus(); setMenuId(null) }
        }
        document.addEventListener("pointerdown", outside)
        document.addEventListener("keydown", escape)
        return () => {
            document.removeEventListener("pointerdown", outside)
            document.removeEventListener("keydown", escape)
        }
    }, [menuId])

    const changeStatus = async (plan: Plan) => {
        if (!catalog || TurnitsGlobalSaveManager_get()?.isSaving()) return
        setMenuId(null)
        setBusy(true)
        setError("")
        try {
            const suffix = plan.publicado ? `/${plan.id}/despublicar` : `/${plan.id}`
            const body = plan.publicado ? undefined : JSON.stringify({ ...payloadFor(formFromPlan(plan), catalog), publicado: true })
            const { membresia } = await request<{ membresia: Plan }>(suffix, { method: "PUT", body })
            setCatalog(current => current && { ...current, membresias: current.membresias.map(item => item.id === plan.id ? membresia : item) })
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos cambiar el estado de la suscripción.")
        } finally {
            setBusy(false)
        }
    }

    const remove = async (plan: Plan) => {
        const manager = TurnitsGlobalSaveManager_get()
        if (manager?.isSaving() || !window.confirm(`¿Eliminar la suscripción «${plan.nombre}»?`)) return
        setMenuId(null)
        setBusy(true)
        setError("")
        try {
            await request(`/${plan.id}`, { method: "DELETE" })
            setCatalog(current => current && { ...current, membresias: current.membresias.filter(item => item.id !== plan.id) })
            const pending: Record<string, SubscriptionDraft> = { ...manager?.getPending("suscripciones") }
            if (pending[plan.id]) {
                delete pending[plan.id]
                if (Object.keys(pending).length) manager?.markDirty("suscripciones", pending)
                else manager?.clear("suscripciones")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos eliminar la suscripción.")
        } finally {
            setBusy(false)
        }
    }

    if (!catalog) return error ? <div><p role="alert">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></div> : <p role="status">Cargando suscripciones…</p>

    const servicesById = new Map(catalog.servicios.map(item => [item.id, item]))
    const productsById = new Map(catalog.productos.map(item => [item.id, item]))
    const team = catalog.equipo ?? []
    const canOffer = (personId: string, serviceIds: string[]) => professionalsFor(catalog, personId, serviceIds)
    const originalPrice = (plan: Pick<Plan, "servicio_ids" | "producto_ids" | "cantidades_servicios" | "cantidades_productos">) =>
        plan.servicio_ids.reduce((sum, id) => sum + (Number(servicesById.get(id)?.precio) || 0) * quantityOf(plan, "servicio_ids", id), 0) +
        plan.producto_ids.reduce((sum, id) => sum + (Number(productsById.get(id)?.precio) || 0) * quantityOf(plan, "producto_ids", id), 0)
    const cover = (plan: Pick<Plan, "imagen_url" | "servicio_ids" | "cantidades_servicios" | "cantidades_productos">) =>
        plan.imagen_url || [...plan.servicio_ids].sort((a, b) => quantityOf(plan, "servicio_ids", b) - quantityOf(plan, "servicio_ids", a))
            .map(id => photoOf(servicesById.get(id))).find(Boolean) || ""
    const locked = busy || saving
    const original = form ? originalPrice(form) : 0
    const names = (ids: string[], items: CatalogItem[]) => ids.map(id => items.find(item => item.id === id)?.nombre || "Elemento eliminado")
    const toggle = (key: Selection, id: string) =>
        setForm(current => current && {
            ...current,
            [key]: current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id],
        })
    const adjust = (key: Selection, id: string, delta: number) => setForm(current => {
        if (!current) return current
        const cantidad = Math.max(1, Math.min(99, quantityOf(current, key, id) + delta))
        const field = quantityField[key]
        return { ...current, [field]: { ...current[field], [id]: cantidad } }
    })
    const visible = catalog.membresias.filter(plan =>
        (filter === "todos" || plan.publicado === (filter === "publicadas")) &&
        plan.nombre.toLocaleLowerCase("es-AR").includes(search.trim().toLocaleLowerCase("es-AR"))
    )
    if (order === "az") visible.sort((a, b) => a.nombre.localeCompare(b.nombre, "es-AR"))
    if (order === "precio") visible.sort((a, b) => a.precio_mensual - b.precio_mensual)

    return <div style={{ display: "grid", gap: 16 }}>
        {!form && <MembershipPaymentReview request={request} />}
        {!form && <CatalogToolbar<(typeof filters)[number]["id"], (typeof orders)[number]["id"]> label="suscripciones" filters={filters} filterValue={filter} onFilter={setFilter}
            opcionesOrden={orders} sort={order} onSort={setOrder} search={search} onSearch={setSearch}
            onCreate={locked ? undefined : () => open(null)} />}
        <section className="promotions" style={{ "--green": accentColor || "#196b1f" } as React.CSSProperties}>
        {form ? (
            <form className="promo-editor" onSubmit={event => event.preventDefault()}>
                <BackButton floating disabled={locked || uploading} onClick={close} />
                <fieldset disabled={locked}>
                    <label>
                        {fieldTitle("tag", "Nombre de la suscripción")}
                        <small className="catalog-hint">Aparece en la página pública de tu negocio.</small>
                        <input ref={titleRef} required maxLength={100} placeholder="Ej. Club de cortes" value={form.nombre} onChange={event => change("nombre", event.target.value)} />
                    </label>
                    <div className="promo-intro">
                        <div>
                            {fieldTitle("image", "Imagen de portada")}
                            <small className="catalog-hint">Si no subís una portada, se usa la foto de un servicio incluido.</small>
                            <ServiciosManager_ImageUploader size={450} value={cover(form)}
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
                                const { descripcion } = ServiciosManager_parseDesc(item.descripcion || "")
                                const photo = photoOf(item)
                                const selected = form[key].includes(item.id)
                                const quantity = quantityOf(form, key, item.id)
                                return <div className="promo-line" key={item.id} data-selected={selected}>
                                    <button className="promo-choice" type="button" aria-pressed={selected} onClick={() => toggle(key, item.id)}>
                                        <span className="promo-check">{selected && <img src="/assets/panel-nav/akar-icons_check.svg" alt="" width="12" height="12" />}</span>
                                        {photo ? <img src={photo} alt="" loading="lazy" /> : <span className="promo-thumb"><ServiciosManager_SeccionIcon tipo={icon} /></span>}
                                        <span><strong>{item.nombre}</strong>{!item.activo ? <small>No disponible</small> : descripcion && <small>{descripcion}</small>}</span>
                                    </button>
                                    {selected && <div className="promo-count" style={row}>
                                        <button type="button" aria-label={`Reducir cantidad mensual de ${item.nombre}`} disabled={quantity <= 1} onClick={() => adjust(key, item.id, -1)}>−</button>
                                        <span>{quantity}</span>
                                        <button type="button" aria-label={`Aumentar cantidad mensual de ${item.nombre}`} disabled={quantity >= 99} onClick={() => adjust(key, item.id, 1)}>+</button>
                                    </div>}
                                </div>
                            })}
                        </section>
                    })}
                    {error && <p role="alert" className="promo-error">{error}</p>}
                </fieldset>
            </form>
        ) : <>
            {error && <p role="alert" className="promo-error">{error}</p>}
            {!visible.length && <p>{catalog.membresias.length ? "No hay suscripciones que coincidan." : "Todavía no hay suscripciones."}</p>}
            <div className="promo-grid">
                {visible.map(plan => {
                    const original = originalPrice(plan)
                    const img = cover(plan)
                    const professionals = team.filter(person => plan.profesional_ids?.includes(person.id) && canOffer(person.id, plan.servicio_ids))
                    return <article key={plan.id} className="promo-card">
                    <div className="promo-cover">
                        {img ? <img src={img} alt="" loading="lazy" /> : <ServiciosManager_SeccionIcon tipo="promociones" size={48} />}
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
                                            <li key={plan[key][index]}>{quantityOf(plan, key, plan[key][index])} × {name}</li>)}
                                    </ul>
                                </div>)}
                        </div>
                        <span className="promo-status" data-active={plan.publicado}>● {plan.publicado ? "Activa" : "Pausada"}</span>
                        <div className="promo-actions" style={{ flexWrap: "wrap" }}>
                            <button type="button" className="svc-edit-button" disabled={locked} onClick={() => open(plan)}>Editar</button>
                            <button type="button" className="promo-menu-trigger" ref={menuId === plan.id ? anchor : undefined}
                                aria-label={`Opciones de ${plan.nombre}`} aria-expanded={menuId === plan.id} disabled={locked}
                                onClick={() => setMenuId(menuId === plan.id ? null : plan.id)}>•••</button>
                            {menuId === plan.id && <ServiciosManager_RowMenu anchor={anchor}>
                                <button type="button" disabled={locked} onClick={() => void changeStatus(plan)}>{plan.publicado ? "Pausar" : "Activar"}</button>
                                <button type="button" className="is-danger" disabled={locked} onClick={() => void remove(plan)}>Eliminar</button>
                            </ServiciosManager_RowMenu>}
                        </div>
                    </div>
                </article>})}
            </div>
        </>}
        </section>
    </div>
}
