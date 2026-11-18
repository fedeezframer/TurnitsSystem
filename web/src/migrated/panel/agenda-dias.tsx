import { motion, useReducedMotion } from "framer-motion"
import * as React from "react"
import { BackButton } from "../../components/BackButton"
import { AgendaPanel_getSlug, AgendaPanel_getToken, AgendaPanel_formatMonto, ServiciosManager_parseDesc } from "./common"
import "./agenda-dias.css"

type Extra = { id?: string; extra_id?: string; nombre?: string; imagen_url?: string }
type Turno = { id:string; nombre:string; hora:string; servicio?:string; servicio_id?:string; precio_cobrado:number; monto_pagado:number; extras?:Array<string|Extra> }
type Dia = { fecha:string; turnos:Turno[] }
type Item = { id:string; nombre:string; imagen_url?:string; descripcion?:string }
const month = new Intl.DateTimeFormat("es-AR",{month:"short",timeZone:"UTC"})
function shortDate(iso:string) {
    const date = new Date(iso+"T12:00:00Z")
    const name = month.format(date).replace(".","")
    return date.getUTCDate()+" "+name[0].toUpperCase()+name.slice(1)
}
function photo(items:Item[],id?:string,name?:string) {
    const matches = id ? items.filter(i => i.id === id) : items.filter(i => i.nombre === name)
    if(matches.length !== 1) return ""
    return matches[0].imagen_url || ServiciosManager_parseDesc(matches[0].descripcion || "").imagen
}

// Keep each composition tied to its date, including when branches are filtered.
function ribbonFrames(seed: number) {
    let state = seed >>> 0
    const sample = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        return state / 4294967296
    }
    const circle = Math.PI * 2
    const angle = sample() * Math.PI
    const bend = 45 + sample() * 70
    const frequency = 1.2 + sample() * 1.7
    const offset = sample() * circle
    const centerY = 105 + sample() * 105
    const frames = Array.from({length: 12}, (_, frame) => {
        const phase = frame * circle / 12
        const points = Array.from({length: 19}, (_, index) => {
            const t = index / 18
            const wave = t * circle + offset
            const along = (t - 0.5) * 640 + 55 * Math.sin(wave * frequency + phase)
            const across = bend * Math.sin(wave * frequency + 0.65 * Math.cos(phase))
                + 36 * Math.cos(wave * 1.6 - phase)
            return [
                Math.round(160 + along * Math.cos(angle) - across * Math.sin(angle)),
                Math.round(centerY + along * Math.sin(angle) + across * Math.cos(angle)),
            ]
        })
        const commands = [`M ${points[0].join(" ")}`]
        for (let i = 1; i < points.length - 1; i++) {
            const [x,y] = points[i]
            const [nx,ny] = points[i + 1]
            commands.push(`Q ${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`)
        }
        commands.push(`T ${points[points.length - 1].join(" ")}`)
        return commands.join(" ")
    })
    return [...frames, frames[0]]
}

function DayBackdrop({date}: {date:string}) {
    const reduced = useReducedMotion()
    const day = Math.floor(Date.parse(date) / 86400000)
    const ribbons = React.useMemo(() => [13, 4].map((width, index) => ({
        width,
        frames: ribbonFrames(Math.imul(day, 2654435761) + index * 1013904223),
        duration: 13 + day % 5 + index * 4,
    })), [day])
    return <div aria-hidden="true" className="agenda-day-backdrop">
        <motion.span className="agenda-day-glow" initial={{x:0,y:0}}
            animate={reduced ? {x:0,y:0} : {x:[0,57,-28,0],y:[0,-38,27,0]}}
            transition={{duration:13 + day % 5,repeat:Infinity,ease:"easeInOut"}} />
        <svg className="agenda-day-ribbons" viewBox="0 0 320 300" preserveAspectRatio="none">
            {ribbons.map(({width, frames, duration}) => <motion.path key={width} strokeWidth={width}
                initial={{d:frames[0]}} animate={{d:reduced ? frames[0] : frames}}
                transition={{duration:reduced ? 0 : duration, repeat:reduced ? 0 : Infinity, ease:"linear"}} />)}
        </svg>
    </div>
}

export function AgendaPanel_Layout({dias,today,baseUrl,turnoOpen,onTurnoClick}:{
    dias:Dia[];today:string;baseUrl:string;turnoOpen:boolean;onTurnoClick:(turno:Turno,fecha:string)=>void
}) {
    const [selected,setSelected] = React.useState("")
    const dialog = React.useRef<HTMLDialogElement>(null)
    const [services,setServices] = React.useState<Item[]>([])
    const [extras,setExtras] = React.useState<Item[]>([])
    const [loadPhotos,setLoadPhotos] = React.useState(false)
    React.useEffect(()=>{
        if (!loadPhotos) return
        const controller = new AbortController()
        const slug = encodeURIComponent(AgendaPanel_getSlug())
        for (const key of ["servicios","extras"] as const) {
            fetch(baseUrl.replace(/\/$/,"")+"/admin/"+key+"/"+slug,{signal:controller.signal,headers:{Authorization:"Bearer "+AgendaPanel_getToken()}})
                .then(async r=>r.ok ? (await r.json())[key] : [])
                .then(items=>{if(Array.isArray(items) && !controller.signal.aborted)(key==="extras"?setExtras:setServices)(items)})
                .catch(()=>{})
        }
        return ()=>controller.abort()
    },[baseUrl,loadPhotos])
    React.useEffect(()=>{
        const el = dialog.current
        if(selected && !turnoOpen && el && !el.open) el.showModal()
        else if(el?.open && (!selected || turnoOpen)) el.close()
    },[selected,turnoOpen])
    const days = dias.filter(day => day.turnos.length > 0).sort((a,b) => a.fecha.localeCompare(b.fecha))
    const time = new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"America/Argentina/Buenos_Aires"}).format(new Date())
    const openDay = (fecha:string) => {setSelected(fecha);setLoadPhotos(true)}
    const selectedTurns = days.find(day => day.fecha === selected)?.turnos || []
    return <>
        <div className="agenda-day-grid">
            {days.length === 0 && <p className="agenda-empty-note" role="status">Aún no tienes reservas</p>}
            {days.map(day=>{
                const next = day.fecha === today ? day.turnos.find(t=>t.hora>=time)?.id : null
                return <article className="agenda-day" data-today={day.fecha===today} key={day.fecha}>
                    <DayBackdrop date={day.fecha} />
                    <header><h3>{day.fecha===today?"Hoy":shortDate(day.fecha)}</h3><button onClick={()=>openDay(day.fecha)} aria-label={"Ver detalles del "+shortDate(day.fecha)}>Ver detalles</button></header>
                    <ol>{day.turnos.map(t=><li key={t.id} data-state={t.id===next?"next":day.fecha===today && t.hora<time?"past":"upcoming"}>
                        <button onClick={()=>onTurnoClick(t,day.fecha)}>{t.nombre} <time>{t.hora}</time></button>
                    </li>)}</ol>
                </article>
            })}
        </div>
        <dialog ref={dialog} className="agenda-day-dialog" aria-labelledby="agenda-day-title" onCancel={()=>setSelected("")} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setSelected("")}}}>
            <BackButton floating onClick={()=>setSelected("")} aria-label="Volver a Mi Agenda"/>
            <h2 id="agenda-day-title">{selected && shortDate(selected)}</h2><p>Detalles de tus reservas</p>
            <div className="agenda-reservas">{selectedTurns.map(t=>{
                const cover=photo(services,t.servicio_id,t.servicio)
                return <button className="agenda-reserva" key={t.id} onClick={()=>onTurnoClick(t,selected)}>
                    <span className="agenda-photo">{cover ? <img src={cover} alt="" loading="lazy"/> : <img className="agenda-placeholder" src="/assets/panel-nav/ant-design_product-outlined.svg" alt=""/>}
                        <span className="agenda-extra-photos">{(t.extras || []).map((x,i)=>{
                            const item=typeof x==="string"?{nombre:x}:x
                            const url=item.imagen_url || photo(extras,item.extra_id || item.id,item.nombre)
                            return url && <img key={i} src={url} alt={item.nombre || "Producto adicional"}/>
                        })}</span>
                    </span>
                    <span className="agenda-reserva-body"><span>{t.nombre} {t.hora}</span><strong>{t.servicio || "Turno"} {!!t.extras?.length && <small>+ extra</small>}</strong>
                        <span>Abonado: {AgendaPanel_formatMonto(t.monto_pagado)}</span><span>Debe pagar: {AgendaPanel_formatMonto(Math.max(0,t.precio_cobrado-t.monto_pagado))}</span>
                    </span>
                </button>
            })}</div>
            {!selectedTurns.length && <p>Sin reservas para este día.</p>}
        </dialog>
    </>
}
