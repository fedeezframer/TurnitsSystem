import * as React from "react"
import { BackButton } from "../../components/BackButton"
import { ClientesGrid_getSlug, ClientesGrid_getToken, ServiciosManager_parseDesc } from "./common"

const categories = {servicios:"Servicios",extras:"Productos",promociones:"Promociones"}
type Category = keyof typeof categories
type Item = {id:string; nombre:string; precio:number; imagen:string; descripcion:string}
type Line = {item:Item; count:number}
const money = (value:number) => value.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2})

export function ClientOfferDraft({bookingId,name,baseUrl,onClose}:{bookingId:string;name:string;baseUrl:string;onClose:()=>void}) {
    const list = React.useRef<HTMLDivElement>(null)
    const dialog = React.useRef<HTMLDialogElement>(null)
    const [category,setCategory] = React.useState<Category>("servicios")
    const [items,setItems] = React.useState<Item[]>([])
    const [lines,setLines] = React.useState<Record<string,Line>>({})
    const [price,setPrice] = React.useState("")
    const [fixed,setFixed] = React.useState(false)
    const [validity,setValidity] = React.useState("semana")
    const [status,setStatus] = React.useState("")
    const [date,setDate] = React.useState("")
    const [time,setTime] = React.useState("")
    const [sending,setSending] = React.useState(false)
    const [sendError,setSendError] = React.useState("")
    async function sendOffer() {
        setSending(true)
        setSendError("")
        try {
            const slug=ClientesGrid_getSlug()
            const response=await fetch(baseUrl.replace(/\/$/,"")+"/admin/ofertas-cliente/"+encodeURIComponent(slug),{
                method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+ClientesGrid_getToken()},
                body:JSON.stringify({bookingId,price:Number(price),validity,date:fixed?date:null,time:fixed?time:null,
                    lines:Object.entries(lines).map(([key,line])=>({category:key.split("/")[0],id:line.item.id,count:line.count}))})
            })
            const data=await response.json()
            if(!response.ok || !data.success)throw new Error(data.error || "No se pudo crear la oferta.")
            const link=new URL("/agenda/"+encodeURIComponent(slug),window.location.origin)
            link.searchParams.set("oferta_cliente",data.token)
            const detail=selected.map(line=>line.count+" × "+line.item.nombre).join(", ")
            const productsOnly=Object.keys(lines).every(key=>key.startsWith("extras/"))
            const text=[
                "Hola, "+name+". Te preparé una promoción: "+detail+" por "+money(Number(price))+".",
                productsOnly?"Para usarla, reservá un servicio. El precio del servicio se suma aparte.":null,
                fixed?"Turno propuesto: "+date.split("-").reverse().join("/")+" a las "+time+".":"Elegí el horario que prefieras en la agenda.",
                link.toString(),"Tu código personal es "+data.code+"."
            ].filter(Boolean).join("\n")
            window.location.assign("https://wa.me/"+data.telefono.replace(/\D/g,"")+"?text="+encodeURIComponent(text))
        } catch(e) {setSendError(e instanceof Error?e.message:"No se pudo crear la oferta.")}
        finally {setSending(false)}
    }
    React.useEffect(()=>{ dialog.current?.showModal() },[])
    React.useEffect(()=>{
        const ctrl = new AbortController()
        setItems([])
        setStatus("Cargando catálogo…")
        fetch(baseUrl.replace(/\/$/,"")+"/admin/"+category+"/"+encodeURIComponent(ClientesGrid_getSlug()),{
            headers:{Authorization:"Bearer "+ClientesGrid_getToken()},signal:ctrl.signal
        }).then(async res=>{
            if (!res.ok) throw new Error()
            const data = await res.json()
            if(ctrl.signal.aborted)return
            const rows:Item[] = data[category].filter((item:any)=>item.activo===true || item.activo==="true").map((item:any)=>{
                const desc=ServiciosManager_parseDesc(item.descripcion || "")
                return {id:item.id,nombre:item.nombre,precio:Number(item.precio_final ?? item.precio),imagen:item.imagen_url || desc.imagen,descripcion:desc.descripcion}
            })
            setItems(rows)
            setStatus(rows.length ? "" : "No hay elementos activos en esta categoría.")
        }).catch(()=>{if(!ctrl.signal.aborted)setStatus("No se pudo cargar el catálogo.")})
        return ()=>ctrl.abort()
    },[baseUrl,category])
    function quantity(item:Item,count:number) {
        const key=category+"/"+item.id
        setLines(prev=>{
            const next={...prev}
            if(count>0)next[key]={item,count}
            else delete next[key]
            return next
        })
    }
    const selected=Object.values(lines)
    const total=selected.reduce((sum,line)=>sum+line.count*line.item.precio,0)
    const image=selected.find(line=>line.item.imagen)?.item.imagen || items.find(item=>item.imagen)?.imagen
    return <dialog ref={dialog} className="client-offer" onClose={onClose} aria-labelledby="client-offer-title">
        <BackButton floating onClick={()=>dialog.current?.close()}/>
        <h2 id="client-offer-title">Promoción para {name}</h2><p>Impulsa a que este cliente vuelva</p>
        <div className="offer-main"><div className="offer-cover">{image && <img src={image} alt=""/>}</div>
        <div><div className="offer-fields"><label>¿Qué quieres ofrecer?<select value={category} onChange={e=>setCategory(e.target.value as Category)}>{Object.entries(categories).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
        <label>Vigente durante<select value={validity} onChange={e=>setValidity(e.target.value)}><option value="semana">7 días</option><option value="mes">30 días</option>{fixed && <option value="dia">Solo durante el día seleccionado</option>}</select></label></div>
        <h3>Seleccioná {categories[category].toLowerCase()}</h3><div className="offer-picker"><div className="offer-items" ref={list}>{status && <p role="status">{status}</p>}{items.map(item=>{
            const count=lines[category+"/"+item.id]?.count || 0
            return <div className="offer-item" data-selected={count>0} key={item.id}><button aria-pressed={count>0} onClick={()=>quantity(item,count?0:1)}><span aria-hidden="true" className="offer-check"/>{item.imagen && <img src={item.imagen} alt=""/>}<span><strong>{item.nombre}</strong><small>{item.descripcion || "Sin descripción"}</small></span></button>
            <div><b>{money(item.precio)}</b>{count>0 && <div className="offer-qty"><button aria-label={"Sumar "+item.nombre} onClick={()=>quantity(item,count+1)}>+</button>{count}<button aria-label={"Restar "+item.nombre} onClick={()=>quantity(item,count-1)}>−</button></div>}</div></div>
        })}</div>{items.length>2 && <div className="offer-scroll">{[-1,1].map(dir=><button key={dir} aria-label={dir<0?"Ver anteriores":"Ver siguientes"} onClick={()=>list.current?.scrollBy({top:dir*128,behavior:"smooth"})}>{dir<0?"↑":"↓"}</button>)}</div>}</div></div></div>
        <div className="offer-fields"><label>Precio original<strong>{money(total)}</strong></label><label>Precio de promoción<input type="number" min="0" max={total} value={price} onChange={e=>setPrice(e.target.value)} /></label>
        {Number(price)>0 && Number(price)<total && <span>−{Math.round((1-Number(price)/total)*100)}%</span>}
        <fieldset className="offer-schedule"><legend>Elección de fecha y hora</legend><button aria-pressed={!fixed} onClick={()=>{setFixed(false);if(validity==="dia")setValidity("semana")}}>Libre</button><button aria-pressed={fixed} onClick={()=>setFixed(true)}>Establecer</button></fieldset>
        {fixed && <><label>Día<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Hora<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></>}</div>
        {selected.length>0 && Object.keys(lines).every(key=>key.startsWith("extras/")) && <p>El cliente elige un servicio y reserva un turno para adquirir estos productos con descuento. El servicio se cobra aparte.</p>}
        <footer className="client-offer-send"><button disabled={sending || !selected.length || !(Number(price)>0 && Number(price)<total) || (fixed && (!date || !time))} onClick={sendOffer}>{sending?"Preparando…":"Enviar promoción"}</button><small>Se abre WhatsApp con el enlace y el código personal de reserva.</small></footer>
        {sendError && <p role="alert">{sendError}</p>}
    </dialog>
}
