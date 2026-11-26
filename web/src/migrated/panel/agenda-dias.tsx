import { useNativeDialogExit } from "../../components/useNativeDialogExit"
import * as React from "react"
import { BackButton } from "../../components/BackButton"
import { AgendaPanel_getSlug, AgendaPanel_getToken, AgendaPanel_formatMonto, ServiciosManager_parseDesc } from "./common"
import "./agenda-dias.css"

type Extra = { id?: string; extra_id?: string; nombre?: string; imagen_url?: string }
type Turno = { id:string; nombre:string; hora:string; estado?:string; reprogramacion_pendiente?:{id:string}|null; servicio?:string; servicio_id?:string; precio_cobrado:number; monto_pagado:number; extras?:Array<string|Extra> }
type Dia = { fecha:string; turnos:Turno[] }
type Item = { id:string; nombre:string; imagen_url?:string; descripcion?:string }
const month = new Intl.DateTimeFormat("es-AR",{month:"short",timeZone:"UTC"})
const weekday = new Intl.DateTimeFormat("es-AR",{weekday:"long",timeZone:"UTC"})
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

export function AgendaPanel_Layout({dias,today,baseUrl,turnoOpen,onTurnoClick}:{
    dias:Dia[];today:string;baseUrl:string;turnoOpen:boolean;onTurnoClick:(turno:Turno,fecha:string)=>void
}) {
    const [selected,setSelected] = React.useState("")
    const dialog = React.useRef<HTMLDialogElement>(null)
    const dismissingDay = React.useRef(false)
    const finishDayClose = useNativeDialogExit(() => setSelected(""))
    const dismissDay = () => {
        dismissingDay.current = true
        dialog.current?.close()
    }
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
    // La API entrega los turnos de cada día ordenados por hora.
    const next = days.flatMap(day => day.turnos.filter(t =>
        (day.fecha > today || (day.fecha === today && t.hora >= time)) &&
        (!t.estado || t.estado === "confirmado" || t.estado === "pendiente")
    ))[0]
    function appointmentStatus(turno: Turno) {
        if (turno.reprogramacion_pendiente) return "Reprogramación pendiente"
        if (turno.id === next?.id) return "Próximo turno"
        return {pendiente:"Pendiente", cancelado:"Cancelado"}[turno.estado as "pendiente" | "cancelado"]
    }
    const openDay = (fecha: string) => {
        if (fecha === selected && !turnoOpen && dialog.current && !dialog.current.open) dialog.current.showModal()
        setSelected(fecha)
        setLoadPhotos(true)
    }
    const selectedTurns = days.find(day => day.fecha === selected)?.turnos || []
    return <>
        <div className="agenda-day-grid">
            {days.length === 0 && <div className="agenda-empty-note" role="status">
                <strong>Sin reservas</strong>
                <p>Los turnos agendados aparecen acá.</p>
            </div>}
            {days.map(day => (
                <article className="agenda-day" data-today={day.fecha === today} key={day.fecha}>
                    <header>
                        <div>
                            <p className="agenda-weekday">{day.fecha === today ? "Hoy" : weekday.format(new Date(day.fecha + "T12:00:00Z"))}</p>
                            <h3><time dateTime={day.fecha}>{shortDate(day.fecha)}</time></h3>
                        </div>
                        <button type="button" className="agenda-view-day" onClick={() => openDay(day.fecha)}
                            aria-label={"Ver detalles del " + shortDate(day.fecha)}>{day.turnos.length} {day.turnos.length === 1 ? "turno" : "turnos"}</button>
                    </header>
                    <ol>{day.turnos.map(turno => {
                        const status = appointmentStatus(turno)
                        return <li key={turno.id}>
                            <button className="agenda-appointment" type="button" onClick={() => onTurnoClick(turno, day.fecha)}>
                                <time>{turno.hora}</time>
                                <span className="agenda-appointment-body">
                                    <strong>{turno.nombre}</strong>
                                    {turno.servicio && <span>{turno.servicio}</span>}
                                    {status && <small data-status={status}>{status}</small>}
                                </span>
                            </button>
                        </li>
                    })}</ol>
                </article>
            ))}
        </div>
        <dialog ref={dialog} className="agenda-day-dialog" aria-labelledby="agenda-day-title"
            onCancel={event => { event.preventDefault(); dismissDay() }}
            onClose={event => {
                if (!dismissingDay.current) return
                dismissingDay.current = false
                finishDayClose(event)
            }}
            onClick={event => {
                if (event.target !== event.currentTarget) return
                const bounds = event.currentTarget.getBoundingClientRect()
                if (event.clientX < bounds.left || event.clientX > bounds.right ||
                    event.clientY < bounds.top || event.clientY > bounds.bottom) dismissDay()
            }}>
            <BackButton floating onClick={dismissDay} aria-label="Volver a Mi Agenda"/>
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
                    <span className="agenda-reserva-body"><strong>{t.nombre} <time>{t.hora}</time></strong><strong>{t.servicio || "Turno"} {!!t.extras?.length && <small>+ extra</small>}</strong>
                        {appointmentStatus(t) && <span>{appointmentStatus(t)}</span>}
                        <span>Abonado: {AgendaPanel_formatMonto(t.monto_pagado)}</span><span>Debe pagar: {AgendaPanel_formatMonto(Math.max(0,t.precio_cobrado-t.monto_pagado))}</span>
                    </span>
                </button>
            })}</div>
            {!selectedTurns.length && <p>Sin reservas para este día.</p>}
        </dialog>
    </>
}
