import * as React from "react"
import { createPortal } from "react-dom"
import { BackButton } from "../../components/BackButton"
import { useOverlayPresence } from "./useOverlayPresence"
import { FINANZAS_PICKER_CSS, FINANZAS_FECHA_CSS, finanzasFechaISO, finanzasFechaParse } from "./common"

export function PanelDatePicker({ value, onChange, disabled = false, forOffer = false }: { value: string; onChange: (value: string) => void; disabled?: boolean; forOffer?: boolean }) {
    const [open,setOpen] = React.useState(false)
    const presence = useOverlayPresence(open)
    const [month,setMonth] = React.useState(() => finanzasFechaParse(value))
    const [focused,setFocused] = React.useState(value || finanzasFechaISO(new Date()))
    const trigger = React.useRef<HTMLButtonElement>(null)
    const dialog = React.useRef<HTMLDivElement>(null)
    const id = React.useId()
    const today = finanzasFechaISO(new Date())
    const start = new Date(month.getFullYear(),month.getMonth(),1,12)
    start.setDate(1 - ((start.getDay()+6)%7))
    const days = Array.from({length:42},(_,index) => { const date = new Date(start);date.setDate(start.getDate()+index);return date })
    const close = () => setOpen(false)
    const select = (date: Date) => {onChange(finanzasFechaISO(date));close()}
    const navigateMonth = (step: number) => {
        const next = new Date(month.getFullYear(),month.getMonth()+step,1,12)
        setMonth(next);setFocused(finanzasFechaISO(next))
    }
    React.useEffect(() => {
        if (!open) return
        const previous = document.body.style.overflow
        document.body.style.overflow = "hidden"
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === "Escape") {event.preventDefault();event.stopPropagation();close();return}
            if (event.key !== "Tab") return
            const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([tabindex="-1"])') || [])
            if (!buttons.length) return
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
            if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === buttons.length-1)) {event.preventDefault();buttons[event.shiftKey ? buttons.length-1 : 0].focus()}
        }
        document.addEventListener("keydown",keyboard,true)
        return () => {document.body.style.overflow=previous;document.removeEventListener("keydown",keyboard,true);trigger.current?.focus()}
    }, [open])
    React.useEffect(() => {
        if (open) dialog.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()
    }, [open,focused,month])
    const overlay = presence.visible ? <div className="fin-exp-overlay" data-closing={presence.closing} onClick={event => {if(event.target === event.currentTarget)close()}}>
        <div className="fin-exp-dialog fin-date-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`}>
            <div className="fin-exp-header"><div><h2 id={`${id}-heading`}>{forOffer ? "Día de la promoción" : "Fecha del gasto"}</h2><p>{forOffer ? "Elegí el día del turno que vas a ofrecer." : "Elegí cuándo se realizó este gasto."}</p></div><BackButton onClick={close} aria-label="Cerrar calendario" /></div>
            <div className="fin-date-body">
                <div className="fin-date-nav">
                    <button className="fin-date-arrow" type="button" onClick={() => navigateMonth(-1)} aria-label="Mes anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
                    <strong aria-live="polite">{month.toLocaleDateString("es-AR",{month:"long",year:"numeric"})}</strong>
                    <button className="fin-date-arrow" type="button" onClick={() => navigateMonth(1)} aria-label="Mes siguiente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
                </div>
                <div className="fin-date-week" aria-hidden="true">{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(day => <span key={day}>{day}</span>)}</div>
                <div className="fin-date-grid" role="group" aria-label="Días del mes">
                    {days.map(date => {
                        const iso = finanzasFechaISO(date)
                        return <button className="fin-date-day" type="button" key={iso} data-date={iso} data-outside={date.getMonth() !== month.getMonth()} data-today={iso === today} aria-current={iso === today ? "date" : undefined} aria-pressed={iso === value} aria-label={date.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} tabIndex={iso === focused ? 0 : -1} onClick={() => select(date)} onKeyDown={event => {
                            const steps: Record<string,number> = {ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7}
                            if (!(event.key in steps)) return
                            event.preventDefault()
                            const next = new Date(date);next.setDate(next.getDate()+steps[event.key]);setFocused(finanzasFechaISO(next))
                            if(next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear())setMonth(new Date(next.getFullYear(),next.getMonth(),1,12))
                        }}>{date.getDate()}</button>
                    })}
                </div>
                <div className="fin-date-shortcuts"><button className="fin-date-quick" type="button" onClick={() => select(new Date())}>Hoy</button><button className="fin-date-quick" type="button" onClick={() => {const day=new Date();day.setDate(day.getDate()+(forOffer ? 1 : -1));select(day)}}>{forOffer ? "Mañana" : "Ayer"}</button></div>
            </div>
        </div>
    </div> : null
    return <div style={{display:"grid",gap:6,fontSize:13,minWidth:0}}>
        <style style={{display:"none"}}>{FINANZAS_PICKER_CSS + FINANZAS_FECHA_CSS}</style>
        <span id={`${id}-label`}>{forOffer ? "Día" : "Fecha"}</span>
        <button className="fin-exp-trigger" type="button" ref={trigger} disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={() => {const current=finanzasFechaParse(value);setMonth(current);setFocused(finanzasFechaISO(current));setOpen(true)}}>
            <span style={{display:"flex",color:"#1b6b1a",flexShrink:0}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 11h16M9 16h6"/></svg></span>
            <span className="fin-exp-selected-label" id={`${id}-value`}>{value ? finanzasFechaParse(value).toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"}) : forOffer ? "Elegí un día" : "Elegir fecha"}</span>
            <img src="/assets/panel-nav/boxicons_arrow-down-filled.svg" width="20" height="20" alt="" aria-hidden="true" style={{flexShrink:0}} />
        </button>
        {overlay && typeof document !== "undefined" ? createPortal(overlay,trigger.current?.closest("dialog") || document.body) : null}
    </div>
}
