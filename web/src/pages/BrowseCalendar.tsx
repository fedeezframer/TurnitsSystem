import * as React from "react";
import "./BrowseCalendar.css";
import { shiftCalendarDay, calendarLabel } from "../shared/browse-calendar.js";

export default function BrowseCalendar({today,appointments,businesses,onDetails,busy,onExplore}:any){
  const [start,setStart]=React.useState(today);
  const [selected,setSelected]=React.useState(()=>appointments.filter((t:any)=>t.estado!=="cancelado" && t.fecha>=today && t.fecha<=shiftCalendarDay(today,20) && (t.browse_tipo!=="offer"||t.pago_estado==="aprobado")).map((t:any)=>t.fecha).sort()[0]||today);
  const grid=React.useRef<HTMLDivElement>(null);
  const days=React.useMemo(()=>Array.from({length:21},(_,i)=>shiftCalendarDay(start,i)),[start]);
  const byDate=React.useMemo(()=>{
    const map=new Map<string,any[]>();
    for(const t of appointments){
      if(t.estado==='cancelado'||(t.browse_tipo==='offer'&&t.pago_estado!=='aprobado'))continue;
      map.set(t.fecha,[...(map.get(t.fecha)||[]),t]);
    }
    map.forEach(items=>items.sort((a,b)=>String(a.hora).localeCompare(String(b.hora))));return map;
  },[appointments]);
  const previous=React.useRef(today);
  React.useEffect(()=>{if(start===previous.current)setStart(today);if(selected===previous.current)setSelected(today);previous.current=today},[today]);
  const select=(day:string,focus=false)=>{
    if(day<start||day>days[20])setStart(day);
    setSelected(day);
    if(focus)requestAnimationFrame(()=>grid.current?.querySelector<HTMLElement>('[data-day="'+day+'"]')?.focus());
  };
  const page=(delta:number)=>{const next=shiftCalendarDay(start,delta*21);setStart(next);setSelected(next)};
  return <section className="browse-user-calendar" aria-label="Calendario de tus turnos">
    <div className="browse-user-calendar-toolbar">
      <span aria-live="polite">{calendarLabel(start,{month:'long',year:'numeric'})}</span>
      <div><button onClick={()=>{setStart(today);setSelected(today)}}>Hoy</button><button aria-label="21 días anteriores" onClick={()=>page(-1)}>‹</button><button aria-label="21 días siguientes" onClick={()=>page(1)}>›</button></div>
    </div>
    <div className="browse-user-calendar-grid" ref={grid}>
      {days.map(day=>{
        const events=byDate.get(day)||[];
        const label=day===today?'Hoy':calendarLabel(day,{day:'numeric',month:'short'}).replace('.','');
        const keyDown=(event:React.KeyboardEvent)=>{const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4};if(delta[event.key]){event.preventDefault();select(shiftCalendarDay(day,delta[event.key]),true)}};
        // The expanded day takes one full row, exactly where that date occurs.
        if(day===selected && events.length)return <div key={day} className="browse-user-calendar-expanded" data-day={day} tabIndex={0} onKeyDown={keyDown} aria-label={calendarLabel(day,{weekday:'long',day:'numeric',month:'long'})}>
          <h2>{label}</h2>
          <div className="browse-user-calendar-turnos">{events.map(t=>{const business=businesses.find((n:any)=>n.slug===t.slug);return <article key={t.id}>
            <span className="browse-calendar-avatar">{business?.foto_perfil_url?<img src={business.foto_perfil_url} alt=""/>:(business?.nombre||t.slug||'T').slice(0,1).toUpperCase()}</span>
            <span className="browse-calendar-service" title={business?.nombre||t.slug}>{t.servicio_nombre}</span>
            <time>{String(t.hora).slice(0,5)}<span>hs</span></time>
            <button disabled={busy} onClick={()=>onDetails(t)}>Ver Detalles</button>
          </article>})}</div>
        </div>;
        return <button key={day} data-day={day} className={'browse-user-calendar-day'+(day===today?' is-today':'')+(day===selected?' selected':'')} aria-pressed={day===selected} aria-current={day===today?'date':undefined} aria-label={calendarLabel(day,{weekday:'long',day:'numeric',month:'long',year:'numeric'})+', '+events.length+' turnos'} onClick={()=>select(day)} onKeyDown={keyDown}>
          <span>{label}</span>{events.length>0&&<i aria-hidden="true">{events.length}</i>}
        </button>;
      })}
    </div>
    {!(byDate.get(selected)||[]).length&&<div className="browse-calendar-empty-day" aria-live="polite"><span>{calendarLabel(selected,{day:'numeric',month:'long'})} · Sin turnos</span><button onClick={onExplore}>Explorar servicios</button></div>}
  </section>;
}
