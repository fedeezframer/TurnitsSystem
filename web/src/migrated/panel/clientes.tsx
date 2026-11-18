import * as React from "react"
import { CatalogToolbar } from "./CatalogToolbar"
import LoadingRunner from "../../components/LoadingRunner"
import { appConfig } from "../../config"
import { ClientesGrid_getSlug, ClientesGrid_getToken } from "./common"
import { TurnitsPlanRequirement } from "./shared"
import { ClientOfferDraft } from "./client-offer"
import "./clientes.css"

const clientFilters = [{id:"todos",label:"Todos"},{id:"recurrentes",label:"Recurrentes"},{id:"nuevos",label:"Una reserva"}] as const
const clientSorts = [{id:"recientes",label:"Recientes"},{id:"reservas",label:"Más reservas"},{id:"total",label:"Mayor total"},{id:"nombre",label:"Nombre A–Z"}] as const

const avatarColors = ["#d5e9df", "#f3dccf", "#dce4fb", "#ebdef4", "#f3e6b9", "#d2e9ed", "#f2dce3", "#dee7c8", "#dce2e7"]
function ClientAvatar({nombre,apellido,identity}: {nombre:string; apellido?:string; identity:string}) {
    let hash = 0
    for (const char of identity) hash = (Math.imul(hash,31) + char.charCodeAt(0)) >>> 0
    const initials = [nombre,apellido].map(part=>Array.from(part?.trim() || "")[0]).join("").toLocaleUpperCase("es")
    return <b className="client-avatar" aria-hidden="true" style={{backgroundColor:avatarColors[hash % avatarColors.length]}}>{initials}</b>
}

export function ClientesGrid({baseUrl = appConfig.apiUrl, porPagina = 12}: {baseUrl?:string; porPagina?:number; accentColor?:string}) {
    const [sort,setSort] = React.useState("recientes")
    const [query,setQuery] = React.useState("")
    const [filter,setFilter] = React.useState("todos")
    const [recipient,setRecipient] = React.useState<any>(null)
    const [total,setTotal]=React.useState(0)
    const [clientes, setClientes] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState("")
    const [visibles, setVisibles] = React.useState(porPagina)
    const [plan, setPlan] = React.useState<"gratis" | "basico" | "premium">("gratis")

    const esPremium = plan !== "gratis"
    const limiteClientes = plan === "premium" ? Infinity : plan === "basico" ? 50 : 10
    const clientesFiltrados = clientes.slice(0, limiteClientes)

    React.useEffect(() => {
        const api = baseUrl.replace(/\/+$/, "")
        let retries = 0
        let retryTimer: ReturnType<typeof setTimeout> | null = null

        const fetchData = async (slug: string, token: string) => {
            try {
                const res = await fetch(`${api}/admin/clientes/${slug}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-cache",
                })
                if (res.status === 401) {
                    setError("Sesión expirada.")
                    setLoading(false)
                    return
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const result = await res.json()
                setPlan(
                    ["basico", "premium"].includes(
                        result?.plan || result?.config?.plan
                    )
                        ? (result?.plan || result?.config?.plan)
                        : "gratis"
                )
                setClientes(result.clientes || [])
                setTotal(result.total || 0)
                setError("")
            } catch {
                setError("Error de conexión.")
            } finally {
                setLoading(false)
            }
        }

        const tryInit = () => {
            const slug = ClientesGrid_getSlug()
            const token = ClientesGrid_getToken()
            if (slug && token) {
                fetchData(slug, token)
                return
            }
            if (++retries >= 10) {
                setError(!slug ? "Falta ?u=slug en la URL." : "Sin sesión.")
                setLoading(false)
                return
            }
            retryTimer = setTimeout(tryInit, 300)
        }
        tryInit()
        return () => {
            if (retryTimer) clearTimeout(retryTimer)
        }
    }, [baseUrl])

    React.useEffect(() => {
        setVisibles(porPagina)
    }, [porPagina])


    if (loading) return <LoadingRunner card label="Cargando clientes…" />
    if (error) return <p role="alert">{error}</p>
    const search = query.trim().toLocaleLowerCase("es")
    const results = clientesFiltrados.filter(c => (filter === "todos" || (filter === "recurrentes" ? c.turnos > 1 : c.turnos === 1)) &&
        [c.nombre,c.apellido,esPremium && c.telefono,esPremium && c.email].filter(Boolean).join(" ").toLocaleLowerCase("es").includes(search))
    if(sort==="reservas")results.sort((a,b)=>b.turnos-a.turnos)
    if(sort==="total")results.sort((a,b)=>b.total-a.total)
    if(sort==="nombre")results.sort((a,b)=>(a.nombre+" "+(a.apellido || "")).localeCompare(b.nombre+" "+(b.apellido || ""),"es"))
    return <section className="clients-panel">
        <CatalogToolbar label="clientes" filters={clientFilters} filterValue={filter} onFilter={setFilter}
            sort={sort} onSort={setSort} opcionesOrden={clientSorts} search={query} onSearch={setQuery}/>
        <div className="clients-board">
            {results.slice(0,visibles).map(c=><article key={c.bookingId}>
                <header><ClientAvatar nombre={c.nombre} apellido={c.apellido} identity={c.telefono || c.email || [c.nombre,c.apellido].join(" ")} /><div><h3>{c.nombre} {c.apellido}</h3>
                {esPremium && <><small>{c.email}</small><small>{c.telefono}</small></>}</div></header>
                <dl><div><dt>Reservas</dt><dd>{c.turnos}</dd></div><div><dt>Total</dt><dd>{money.format(c.total)}</dd></div>
                <div><dt>Última visita</dt><dd>{c.ultimaVisita || "Sin visitas"}</dd></div>
                <div><dt>Recurre cada</dt><dd>{c.intervalo ? c.intervalo+" días" : "—"}</dd></div></dl>
                {esPremium && <footer><button disabled={!c.telefono || !c.email} title={!c.telefono || !c.email ? "Se necesita teléfono y correo para enviar una promoción." : undefined} onClick={()=>setRecipient(c)}>Ofrecer Promoción</button>
                {c.telefono && <a target="_blank" rel="noreferrer" href={"https://wa.me/"+c.telefono.replace(/\D/g,"")}>Contactar</a>}</footer>}
            </article>)}
            {!results.length && <p>{clientes.length ? "No hay clientes que coincidan." : "Aún no hay clientes registrados."}</p>}
        </div>
        {visibles < results.length && <button onClick={()=>setVisibles(v=>v+porPagina)}>Ver más</button>}
        {total > limiteClientes && <p>{total-limiteClientes} clientes más <TurnitsPlanRequirement premiumOnly={plan==="basico"}/></p>}
        {recipient && <ClientOfferDraft bookingId={recipient.bookingId} baseUrl={baseUrl} name={[recipient.nombre,recipient.apellido].filter(Boolean).join(" ")} onClose={()=>setRecipient(null)}/>}
    </section>
}
const money = new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0})
