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
import { FINANZAS_GASTO_GUIAS, FINANZAS_PICKER_CSS, finanzasFechaParse, finanzasFechaISO, FINANZAS_FECHA_CSS, finanzasHoyLocal, MenuFooter_getSlug, MenuFooter_getToken, FinanzasGasto, finanzasMetricasNegocio, FINANZAS_CATEGORIAS, FINANZAS_CATEGORIAS_MANUALES, FINANZAS_GASTO_TIPOS } from "./common"

function FinanzasGastoIcon({ kind, size = 20 }: { kind: string; size?: number }) {
    const paths: Record<string, React.ReactNode> = {
        productos: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" /></>,
        alquiler: <><path d="m3 10 9-7 9 7M5 9v12h14V9" /><path d="M9 21v-8h6v8" /></>,
        servicios: <><path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z" /></>,
        personal: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" /></>,
        impuestos: <><path d="M6 3h12v19l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 7h6M9 11h6M9 15h3" /></>,
        marketing: <><path d="m4 10 14-6v16L4 14v-4ZM18 9h2v6h-2M7 15l2 6h3l-2-5" /></>,
        mantenimiento: <><path d="M14 6a5 5 0 0 0-6 6l-5 5a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" /></>,
        otros: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
        variable: <><path d="m3 16 6-6 4 4 8-10M16 4h5v5M3 21h18" /></>,
        fijo: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4M16 3v4M4 11h16M9 16h6" /></>,
    }
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] || paths.otros}</svg>
}

function FinanzasExpensePicker({ title, value, options, onChange, disabled = false }: {
    title: string
    value: string
    options: { id: string; label: string; color: string; description?: string }[]
    onChange: (value: string) => void
    disabled?: boolean
}) {
    const [open, setOpen] = React.useState(false)
    const trigger = React.useRef<HTMLButtonElement>(null)
    const dialog = React.useRef<HTMLDivElement>(null)
    const id = React.useId()
    const selected = options.find(option => option.id === value)
    React.useEffect(() => {
        if (!open) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        const preferred = dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') || dialog.current?.querySelector<HTMLButtonElement>('.fin-exp-option')
        preferred?.focus()
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
            const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
            if (!buttons.length) return
            if (event.key === "Tab") {
                const position = buttons.indexOf(document.activeElement as HTMLButtonElement)
                if (position < 0 || (!event.shiftKey && position === buttons.length - 1) || (event.shiftKey && position === 0)) {
                    event.preventDefault()
                    buttons[event.shiftKey ? buttons.length - 1 : 0].focus()
                }
            }
            const choices = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('.fin-exp-option') || [])
            const current = choices.indexOf(document.activeElement as HTMLButtonElement)
            if (current < 0) return
            const columns = window.innerWidth <= 560 ? 1 : 2
            const steps: Record<string, number> = {ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns}
            if (event.key in steps) {
                event.preventDefault()
                choices[(current + steps[event.key] + choices.length) % choices.length]?.focus()
            } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault()
                choices[event.key === "Home" ? 0 : choices.length - 1]?.focus()
            }
        }
        document.addEventListener("keydown", keyboard, true)
        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener("keydown", keyboard, true)
            trigger.current?.focus()
        }
    }, [open])
    const overlay = open ? <div className="fin-exp-overlay" onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}>
        <div className="fin-exp-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-help`}>
            <div className="fin-exp-header">
                <div><h2 id={`${id}-heading`}>{title === "Categoría" ? "¿En qué gastaste?" : "¿Qué tipo de gasto es?"}</h2><p id={`${id}-help`}>{title === "Categoría" ? "Elegí la opción que mejor describe este gasto. Así vas a poder entender a dónde va tu dinero." : "Elegí cómo se comporta este costo. Podés activar la repetición mensual desde el formulario."}</p></div>
                <button className="fin-exp-close" type="button" aria-label="Cerrar opciones" onClick={() => setOpen(false)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
            </div>
            <div className="fin-exp-grid">
                {options.map(option => <button className="fin-exp-option" type="button" key={option.id} aria-pressed={value === option.id} style={{borderColor:value === option.id ? option.color : undefined}} onClick={() => {onChange(option.id);setOpen(false)}}>
                    <span className="fin-exp-icon" style={{color:option.color,background:`${option.color}12`}}><FinanzasGastoIcon kind={option.id} /></span>
                    <span className="fin-exp-option-text"><span className="fin-exp-option-name">{option.label}</span><span className="fin-exp-option-hint">{option.description || FINANZAS_GASTO_GUIAS[option.id]}</span></span>
                    {value === option.id && <svg className="fin-exp-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={option.color} strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
                </button>)}
            </div>
        </div>
    </div> : null
    return <div style={{display:"grid",gap:6,fontSize:13,minWidth:0}}>
        <style style={{display:"none"}}>{FINANZAS_PICKER_CSS}</style>
        <span id={`${id}-label`}>{title}</span>
        <button className="fin-exp-trigger" type="button" ref={trigger} disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
            <span style={{display:"flex",color:selected?.color || "#64748b",flexShrink:0}}><FinanzasGastoIcon kind={selected?.id || "otros"} size={18} /></span>
            <span className="fin-exp-selected-label" id={`${id}-value`}>{selected?.label || "Elegir una opción"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" aria-hidden="true" style={{flexShrink:0}}><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {overlay && typeof document !== "undefined" ? createPortal(overlay, document.body) : null}
    </div>
}

function FinanzasDatePicker({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
    const [open,setOpen] = React.useState(false)
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
    const overlay = open ? <div className="fin-exp-overlay" onClick={event => {if(event.target === event.currentTarget)close()}}>
        <div className="fin-exp-dialog fin-date-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`}>
            <div className="fin-exp-header"><div><h2 id={`${id}-heading`}>Fecha del gasto</h2><p>Elegí cuándo se realizó este gasto.</p></div><button className="fin-exp-close" type="button" onClick={close} aria-label="Cerrar calendario"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
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
                <div className="fin-date-shortcuts"><button className="fin-date-quick" type="button" onClick={() => select(new Date())}>Hoy</button><button className="fin-date-quick" type="button" onClick={() => {const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);select(yesterday)}}>Ayer</button></div>
            </div>
        </div>
    </div> : null
    return <div style={{display:"grid",gap:6,fontSize:13,minWidth:0}}>
        <style style={{display:"none"}}>{FINANZAS_PICKER_CSS + FINANZAS_FECHA_CSS}</style>
        <span id={`${id}-label`}>Fecha</span>
        <button className="fin-exp-trigger" type="button" ref={trigger} disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={() => {const current=finanzasFechaParse(value);setMonth(current);setFocused(finanzasFechaISO(current));setOpen(true)}}>
            <span style={{display:"flex",color:"#1b6b1a",flexShrink:0}}><FinanzasGastoIcon kind="fijo" size={18} /></span>
            <span className="fin-exp-selected-label" id={`${id}-value`}>{value ? finanzasFechaParse(value).toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"}) : "Elegir fecha"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" aria-hidden="true" style={{flexShrink:0}}><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {overlay && typeof document !== "undefined" ? createPortal(overlay,document.body) : null}
    </div>
}

function FinanzasMonthPicker({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
    const [open,setOpen] = React.useState(false)
    const [month,setMonth] = React.useState(() => finanzasFechaParse(value + "-01"))
    const [focused,setFocused] = React.useState(value ? value + "-01" : finanzasFechaISO(new Date()).slice(0,7) + "-01")
    const trigger = React.useRef<HTMLButtonElement>(null)
    const dialog = React.useRef<HTMLDivElement>(null)
    const id = React.useId()
    const today = finanzasFechaISO(new Date())
    const days = Array.from({length:12},(_,index) => new Date(month.getFullYear(),index,1,12))
    const close = () => setOpen(false)
    const select = (date: Date) => {onChange(finanzasFechaISO(date).slice(0,7));close()}
    const navigateMonth = (step: number) => {
        const next = new Date(month.getFullYear(),month.getMonth(),1,12)
        next.setFullYear(next.getFullYear()+step)

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
    const overlay = open ? <div className="fin-exp-overlay" onClick={event => {if(event.target === event.currentTarget)close()}}>
        <div className="fin-exp-dialog fin-date-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`}>
            <div className="fin-exp-header"><div><h2 id={`${id}-heading`}>Mes del resumen</h2><p>Elegí el período que querés consultar.</p></div><button className="fin-exp-close" type="button" onClick={close} aria-label="Cerrar calendario"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
            <div className="fin-date-body">
                <div className="fin-date-nav">
                    <button className="fin-date-arrow" type="button" onClick={() => navigateMonth(-1)} aria-label="Año anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
                    <strong aria-live="polite">{month.getFullYear()}</strong>
                    <button className="fin-date-arrow" type="button" onClick={() => navigateMonth(1)} aria-label="Año siguiente"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
                </div>
                <div className="fin-month-grid" role="group" aria-label="Meses del año">
                    {days.map(date => {
                        const iso = finanzasFechaISO(date)
                        return <button className="fin-date-day fin-month-option" type="button" key={iso} data-date={iso}  data-today={iso.slice(0,7) === today.slice(0,7)} aria-current={iso === today ? "date" : undefined} aria-pressed={iso.slice(0,7) === value} aria-label={date.toLocaleDateString("es-AR",{month:"long",year:"numeric"})} tabIndex={iso === focused ? 0 : -1} onClick={() => select(date)} onKeyDown={event => {
                            const steps: Record<string,number> = {ArrowRight:1,ArrowLeft:-1,ArrowDown:3,ArrowUp:-3}
                            if (!(event.key in steps)) return
                            event.preventDefault()
                            const next = new Date(date);next.setMonth(next.getMonth()+steps[event.key]);setFocused(finanzasFechaISO(next))
                            if(next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear())setMonth(new Date(next.getFullYear(),next.getMonth(),1,12))
                        }}>{date.toLocaleDateString("es-AR",{month:"long"})}</button>
                    })}
                </div>
                <div className="fin-date-shortcuts"><button className="fin-date-quick" type="button" onClick={() => select(new Date())}>Este mes</button></div>
            </div>
        </div>
    </div> : null
    return <div style={{display:"grid",gap:6,fontSize:13,minWidth:0}}>
        <style style={{display:"none"}}>{FINANZAS_PICKER_CSS + FINANZAS_FECHA_CSS + `.fin-month-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.fin-month-option{height:48px;text-transform:capitalize;font-size:12px}.fin-month-trigger{min-width:180px}`}</style>
        <span id={`${id}-label`} style={{position:"absolute",width:1,height:1,overflow:"hidden",clipPath:"inset(50%)"}}>Mes del resumen</span>
        <button className="fin-exp-trigger fin-month-trigger" type="button" ref={trigger} disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={() => {const current=finanzasFechaParse(value + "-01");setMonth(current);setFocused(finanzasFechaISO(current));setOpen(true)}}>
            <span style={{display:"flex",color:"#1b6b1a",flexShrink:0}}><FinanzasGastoIcon kind="fijo" size={18} /></span>
            <span className="fin-exp-selected-label" id={`${id}-value`}>{value ? finanzasFechaParse(value + "-01").toLocaleDateString("es-AR",{month:"long",year:"numeric"}) : "Elegir mes"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" aria-hidden="true" style={{flexShrink:0}}><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {overlay && typeof document !== "undefined" ? createPortal(overlay,document.body) : null}
    </div>
}

function FinanzasPanel({
    baseUrl,
    accentColor,
}: {
    baseUrl: string
    accentColor: string
}) {
    const [mes, setMes] = React.useState(() => finanzasHoyLocal().slice(0, 7))
    const [data, setData] = React.useState<any>(null)
    const [cargando, setCargando] = React.useState(true)
    const [error, setError] = React.useState("")
    const [guardando, setGuardando] = React.useState(false)
    const [modal, setModal] = React.useState(false)
    const [editando, setEditando] = React.useState<string | null>(null)
    const [form, setForm] = React.useState({
        descripcion: "",
        categoria: "productos",
        monto: "",
        fecha: finanzasHoyLocal(),
        tipo: "variable" as "fijo" | "variable",
        recurrente: false,
    })
    const slug = MenuFooter_getSlug()
    const token = MenuFooter_getToken()
    const api = String(baseUrl).replace(/\/+$/, "")
    const solicitudFinanzas = React.useRef(0)
    const periodoActual = React.useRef(mes)
    periodoActual.current = mes
    const cargar = React.useCallback(async () => {
        const solicitud = ++solicitudFinanzas.current
        if (!slug || !token) {
            setError("No encontramos tu sesión. Volvé a iniciar sesión.")
            setCargando(false)
            return
        }
        setCargando(true)
        setError("")
        try {
            const res = await fetch(
                `${api}/finanzas/${encodeURIComponent(slug)}?mes=${mes}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: "no-store",
                }
            )
            const json = await res.json()
            if (!res.ok || !json.success)
                throw new Error(
                    json.error || "No se pudieron cargar las finanzas."
                )
            if (solicitud !== solicitudFinanzas.current || mes !== periodoActual.current) return
            if (json.periodo !== mes) throw new Error("El servidor devolvió un período distinto. Volvé a cargar las finanzas.")
            setData(json)
        } catch (e: any) {
            if (solicitud === solicitudFinanzas.current && mes === periodoActual.current) setError(e?.message || "Error de conexión.")
        } finally {
            if (solicitud === solicitudFinanzas.current && mes === periodoActual.current) setCargando(false)
        }
    }, [api, slug, token, mes])
    React.useEffect(() => {
        cargar()
    }, [cargar])

    const abrirNuevo = () => {
        setEditando(null)
        setForm({
            descripcion: "",
            categoria: "productos",
            monto: "",
            fecha:
                finanzasHoyLocal().slice(0, 7) === mes
                    ? finanzasHoyLocal()
                    : `${mes}-01`,
            tipo: "variable",
            recurrente: false,
        })
        setModal(true)
    }
    const abrirEdicion = (g: FinanzasGasto) => {
        setEditando(g.id)
        setForm({
            descripcion: g.descripcion,
            categoria: g.categoria,
            monto: String(g.monto),
            fecha: g.fecha,
            tipo: g.tipo,
            recurrente: g.recurrente,
        })
        setModal(true)
    }
    const guardar = async () => {
        const monto = Number(form.monto)
        if (!form.descripcion.trim() || !Number.isFinite(monto) || monto <= 0) {
            setError("Completá una descripción y un monto válido mayor a cero.")
            return
        }
        setGuardando(true)
        setError("")
        try {
            const res = await fetch(
                `${api}/finanzas/${encodeURIComponent(slug)}/gastos${editando ? `/${editando}` : ""}`,
                {
                    method: editando ? "PUT" : "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ ...form, monto }),
                }
            )
            const json = await res.json()
            if (!res.ok || !json.success)
                throw new Error(json.error || "No se pudo guardar el gasto.")
            setModal(false)
            await cargar()
        } catch (e: any) {
            setError(e?.message || "Error guardando el gasto.")
        } finally {
            setGuardando(false)
        }
    }
    const eliminar = async (id: string) => {
        const gasto = gastos.find((g) => g.id === id)
        const esSerieConHistorial =
            !!gasto?.recurrente &&
            mes > String(gasto.fecha_inicio || gasto.fecha).slice(0, 7)
        const pregunta = gasto?.recurrente
            ? esSerieConHistorial
                ? `¿Finalizar “${gasto.descripcion}” desde este mes? Se conservarán los meses anteriores.`
                : `¿Eliminar “${gasto.descripcion}” y toda su serie mensual?`
            : "¿Eliminar este gasto?"
        if (!window.confirm(pregunta)) return
        try {
            const res = await fetch(
                `${api}/finanzas/${encodeURIComponent(slug)}/gastos/${id}?desde=${mes}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            )
            const json = await res.json()
            if (!res.ok || !json.success)
                throw new Error(json.error || "No se pudo eliminar.")
            await cargar()
        } catch (e: any) {
            setError(e?.message || "Error eliminando el gasto.")
        }
    }
    const money = (n: number) =>
        new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            maximumFractionDigits: 0,
        }).format(Number(n || 0))
    const summary = data?.periodo === mes ? data.summary || {} : {}
    const gastos: FinanzasGasto[] = data?.periodo === mes ? data.gastos || [] : []
    const indicadores = finanzasMetricasNegocio(summary, gastos)
    const categorias = summary.categorias || []
    const ingresos = Number(summary.ingresosBrutos || 0)
    const balance = Number(summary.balance || 0)
    const colorCategoria = (categoria: string) => FINANZAS_CATEGORIAS.find(x => x.id === categoria)?.color || "#64748b"
    const porcentajeIngresos = (importe: number) => ingresos > 0 ? `${(importe / ingresos * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "—"
    const distribucion = [...categorias, ...(balance > 0 ? [{ categoria: "balance", total: balance }] : [])]
    let cursor = 0
    const conic = distribucion
        .filter((c: any) => Number(c.total) > 0)
        .map((c: any) => {
            const start = cursor
            cursor += (Number(c.total) / (ingresos || 1)) * 100
            const color = c.categoria === "balance" ? "#18732a" : colorCategoria(c.categoria)
            return `${color} ${start}% ${cursor}%`
        })
        .join(", ")
    const card: React.CSSProperties = {
        background: "#fff",
        border: "1px solid #e5eaf0",
        borderRadius: 18,
        padding: 20,
        boxShadow: "0 2px 8px rgba(15,23,42,.025)",
    }
    const button: React.CSSProperties = {
        border: "none",
        borderRadius: 11,
        padding: "11px 15px",
        background: accentColor || "#18732a",
        color: "white",
        fontWeight: 650,
        cursor: "pointer",
    }
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                color: "#172033",
            }}
        >
            <div
                style={{
                    ...card,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                        Resumen financiero
                    </div>
                    <div
                        style={{ color: "#738096", fontSize: 13, marginTop: 4 }}
                    >
                        Ingresos brutos de turnos menos gastos registrados.
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <FinanzasMonthPicker value={mes} onChange={setMes} />
                    <button onClick={abrirNuevo} style={button}>
                        + Cargar gasto
                    </button>
                </div>
            </div>
            {error && (
                <div
                    style={{
                        ...card,
                        borderColor: "#fecaca",
                        color: "#b91c1c",
                        background: "#fffafa",
                    }}
                >
                    {error}
                </div>
            )}
            {cargando || (data && data.periodo !== mes && !error) ? (
                <div style={card}>Cargando finanzas…</div>
            ) : (
                <>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit,minmax(190px,1fr))",
                            gap: 12,
                        }}
                    >
                        {[
                            [
                                "Ingresos brutos",
                                summary.ingresosBrutos,
                                "#172033",
                            ],
                            [
                                "Gastos totales",
                                summary.gastosTotales,
                                "#b73535",
                            ],
                            [
                                "Balance operativo estimado",
                                summary.balance,
                                Number(summary.balance) >= 0
                                    ? "#18732a"
                                    : "#b91c1c",
                            ],
                            [
                                "Margen operativo",
                                summary.margenOperativo == null
                                    ? null
                                    : `${Number(summary.margenOperativo).toFixed(1)}%`,
                                Number(summary.margenOperativo) >= 0
                                    ? "#18732a"
                                    : "#b91c1c",
                            ],
                        ].map(([label, value, color]: any) => (
                            <div key={label} style={card}>
                                <div style={{ fontSize: 13, color: "#738096" }}>
                                    {label}
                                </div>
                                <div
                                    style={{
                                        fontSize: 25,
                                        fontWeight: 720,
                                        color,
                                        marginTop: 9,
                                    }}
                                >
                                    {value == null
                                        ? "—"
                                        : typeof value === "number"
                                          ? money(value)
                                          : value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit,minmax(min(100%,360px),1fr))",
                            gap: 16,
                        }}
                    >
                        <div
                            style={{
                                ...card,
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 24,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <div
                                role="img"
                                aria-label={ingresos <= 0 ? "Sin ingresos para calcular proporciones" : balance < 0 ? "Los gastos superan el valor de los turnos" : `Distribución sobre el valor de los turnos. Balance estimado: ${porcentajeIngresos(balance)}`}
                                style={{
                                    width: 220,
                                    height: 220,
                                    borderRadius: "50%",
                                    background:
                                        ingresos <= 0 ? "#edf1f5" : balance < 0 ? "#b73535" : conic ? `conic-gradient(${conic})` : "#edf1f5",
                                    display: "grid",
                                    placeItems: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        width: 132,
                                        height: 132,
                                        background: "white",
                                        borderRadius: "50%",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        textAlign: "center",
                                        padding: 8,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 12,
                                            color: "#738096",
                                        }}
                                    >
                                        Balance estimado
                                    </span>
                                    <strong
                                        style={{
                                            fontSize: 18,
                                            color:
                                                Number(summary.balance) >= 0
                                                    ? "#18732a"
                                                    : "#b91c1c",
                                            marginTop: 5,
                                        }}
                                    >
                                        {money(summary.balance || 0)}
                                    </strong>
                                </div>
                            </div>
                            <div style={{ flex: "1 1 220px", minWidth: 210 }}>
                                <div
                                    style={{ fontWeight: 700, marginBottom: 8 }}
                                >
                                    Distribución del valor de los turnos
                                </div>
                                <p style={{fontSize:11,lineHeight:1.5,color:"#738096",margin:"0 0 6px"}}>Porcentajes sobre el precio completo de los turnos del mes, incluida la parte que se paga en el local.</p>
                                <div
                                    style={{
                                        borderBottom: "1px solid #e5e7eb",
                                        padding: "9px 0",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        gap: 12,
                                    }}
                                >
                                    <span>Valor total de los turnos</span>
                                    <b>{money(summary.ingresosBrutos)}</b>
                                </div>
                                {categorias.map((c: any) => {
                                    const info = FINANZAS_CATEGORIAS.find(
                                        (x) => x.id === c.categoria
                                    )
                                    return (
                                        <div
                                            key={c.categoria}
                                            style={{
                                                borderBottom:
                                                    "1px solid #e5e7eb",
                                                padding: "9px 0",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                gap: 12,
                                                fontSize: 13,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: "flex",
                                                    gap: 8,
                                                    alignItems: "center",
                                                }}
                                            >
                                                <i
                                                    style={{
                                                        width: 9,
                                                        height: 9,
                                                        borderRadius: "50%",
                                                        background:
                                                            info?.color ||
                                                            "#64748b",
                                                    }}
                                                />
                                                {info?.label || c.label}{" "}
                                                <small
                                                    style={{ color: "#8290a3" }}
                                                >
                                                    {porcentajeIngresos(Number(c.total))}
                                                </small>
                                            </span>
                                            <b>{money(c.total)}</b>
                                        </div>
                                    )
                                })}
                                {balance >= 0 && ingresos > 0 && <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"9px 0",fontSize:13}}><span style={{display:"flex",gap:8,alignItems:"center"}}><i style={{width:9,height:9,borderRadius:"50%",background:"#18732a"}}/>Balance estimado <small style={{color:"#8290a3"}}>{porcentajeIngresos(balance)}</small></span><b>{money(balance)}</b></div>}
                                {balance < 0 && <p style={{fontSize:12,color:"#b73535",lineHeight:1.5}}>Los gastos superan el valor de los turnos en {money(-balance)}. Los porcentajes pueden sumar más del 100%.</p>}
                            </div>
                        </div>
                        <div style={card}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>Indicadores</div>
                            <div style={{ color: "#738096", fontSize: 12, marginTop: 5 }}>Para evaluar los costos y la rentabilidad del período.</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,210px),1fr))", gap: 12, marginTop: 16 }}>
                                {[
                                    ["Ticket promedio", indicadores.ticket, "Ingresos por turno incluido en el período."],
                                    ["Costo promedio por turno", indicadores.costoTurno, "Gastos y comisiones repartidos entre los turnos del período."],
                                    ["Resultado promedio por turno", indicadores.resultadoTurno, "Balance del período dividido por los turnos. Refleja la mezcla real de servicios, sin proyectar reservas futuras."],
                                    ["Costos fijos", indicadores.fijos, "Gastos marcados como fijos y gastos que se repiten mensualmente."],
                                    ["Costos variables", indicadores.variables, "Otros gastos y comisiones asociados a la actividad del período."],
                                    ["Comisiones sobre ingresos", indicadores.comisionIngresos == null ? null : indicadores.comisionIngresos.toLocaleString("es-AR",{maximumFractionDigits:1}) + "%", "Comisiones de Turnits y Mercado Pago sobre el valor completo de los turnos, no sólo sobre las señas."],
                                ].map(([label, value, help]: any) => (
                                    <div key={label} style={{ padding: 15, background: "#f8fafc", borderRadius: 12, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{label}</div>
                                        <div style={{ fontSize: 23, fontWeight: 720, marginTop: 8, color: value != null && parseFloat(String(value)) < 0 ? "#b91c1c" : "#172033", overflowWrap: "anywhere" }}>{value == null ? "—" : typeof value === "number" ? money(value) : value}</div>
                                        <div style={{ color: "#738096", fontSize: 11, lineHeight: 1.5, marginTop: 7 }}>{help}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div style={card}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                                marginBottom: 12,
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>
                                    Gastos del período
                                </div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "#738096",
                                        marginTop: 3,
                                    }}
                                >
                                    Las comisiones de Mercado Pago y Turnits se
                                    calculan automáticamente y aparecen en el
                                    gráfico.
                                </div>
                            </div>
                        </div>
                        {gastos.length === 0 ? (
                            <div
                                style={{ color: "#8290a3", padding: "20px 0" }}
                            >
                                Todavía no cargaste gastos para este mes.
                            </div>
                        ) : (
                            gastos.map((g) => (
                                <div
                                    key={`${g.id}-${g.fecha}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "12px 0",
                                        borderTop: "1px solid #eef1f4",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <div style={{ flex: "1 1 200px" }}>
                                        <b>{g.descripcion}</b>
                                        <div
                                            style={{
                                                color: "#8290a3",
                                                fontSize: 12,
                                                marginTop: 3,
                                            }}
                                        >
                                            {FINANZAS_CATEGORIAS.find(
                                                (x) => x.id === g.categoria
                                            )?.label || g.categoria}{" "}
                                            · {g.fecha}
                                            {g.recurrente
                                                ? " · Mensual"
                                                : ""} ·{" "}
                                            {g.tipo === "fijo"
                                                ? "Fijo"
                                                : "Variable"}
                                        </div>
                                    </div>
                                    <b>{money(g.monto)}</b>
                                    <button
                                        onClick={() => abrirEdicion(g)}
                                        style={{
                                            background: "white",
                                            border: "1px solid #dbe2ea",
                                            borderRadius: 9,
                                            padding: "7px 10px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => eliminar(g.id)}
                                        style={{
                                            background: "white",
                                            border: "1px solid #fecaca",
                                            color: "#b91c1c",
                                            borderRadius: 9,
                                            padding: "7px 10px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {g.recurrente
                                            ? "Eliminar serie"
                                            : "Eliminar"}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    <div style={{ color: "#8290a3", fontSize: 12 }}>
                        Estimación de gestión, no reemplaza la contabilidad. El
                        ingreso bruto se basa en turnos no pendientes ni
                        cancelados y el balance solo descuenta gastos
                        registrados y comisiones de Turnits conocidas.
                    </div>
                </>
            )}
            {modal && (
                <div
                    role="dialog"
                    aria-modal="true"
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 10000,
                        background: "rgba(15,23,42,.45)",
                        display: "grid",
                        placeItems: "center",
                        padding: 16,
                    }}
                >
                    <div
                        style={{
                            ...card,
                            width: "min(100%,520px)",
                            maxHeight: "90vh",
                            overflow: "auto",
                            boxSizing: "border-box",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 18,
                            }}
                        >
                            <b style={{ fontSize: 18 }}>
                                {editando ? "Editar gasto" : "Cargar gasto"}
                            </b>
                            <button
                                onClick={() => setModal(false)}
                                aria-label="Cerrar"
                                style={{
                                    border: 0,
                                    background: "transparent",
                                    fontSize: 22,
                                    cursor: "pointer",
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ display: "grid", gap: 13 }}>
                            {error && (
                                <div
                                    role="alert"
                                    style={{
                                        color: "#b91c1c",
                                        background: "#fff1f2",
                                        padding: 10,
                                        borderRadius: 9,
                                        fontSize: 13,
                                    }}
                                >
                                    {error}
                                </div>
                            )}
                            <label
                                style={{
                                    display: "grid",
                                    gap: 6,
                                    fontSize: 13,
                                }}
                            >
                                Descripción
                                <input
                                    value={form.descripcion}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            descripcion: e.target.value,
                                        })
                                    }
                                    placeholder="Ej. Compra de productos"
                                    style={{
                                        padding: 11,
                                        border: "1px solid #dbe2ea",
                                        borderRadius: 10,
                                    }}
                                />
                            </label>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 10,
                                }}
                            >
                                <FinanzasExpensePicker
                                    title="Categoría"
                                    value={form.categoria}
                                    options={FINANZAS_CATEGORIAS_MANUALES}
                                    disabled={guardando}
                                    onChange={(categoria) => setForm((previous) => ({ ...previous, categoria }))}
                                />
                                <label
                                    style={{
                                        display: "grid",
                                        gap: 6,
                                        fontSize: 13,
                                    }}
                                >
                                    Monto
                                    <div style={{ position: "relative", minWidth: 0 }}>
                                        <span aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }}>$</span>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={form.monto}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                monto: e.target.value,
                                            })
                                        }
                                        placeholder="0"
                                        style={{
                                            padding: "11px 11px 11px 30px",
                                            width: "100%",
                                            minWidth: 0,
                                            boxSizing: "border-box",
                                            border: "1px solid #dbe2ea",
                                            borderRadius: 10,
                                        }}
                                    />
                                    </div>
                                </label>
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 10,
                                }}
                            >
                                <FinanzasDatePicker
                                    value={form.fecha}
                                    disabled={guardando}
                                    onChange={(fecha) => setForm((previous) => ({ ...previous, fecha }))}
                                />
                                <FinanzasExpensePicker
                                    title="Tipo"
                                    value={form.tipo}
                                    options={FINANZAS_GASTO_TIPOS}
                                    disabled={guardando}
                                    onChange={(tipo) => setForm((previous) => ({ ...previous, tipo: tipo as "fijo" | "variable" }))}
                                />
                            </div>
                            <label
                                style={{
                                    display: "flex",
                                    gap: 9,
                                    alignItems: "flex-start",
                                    fontSize: 13,
                                    color: "#475569",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={form.recurrente}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            recurrente: e.target.checked,
                                            tipo: e.target.checked
                                                ? "fijo"
                                                : form.tipo,
                                        })
                                    }
                                />
                                Repetir este importe cada mes desde la fecha
                                indicada. Si editás una serie, el cambio rige
                                desde la fecha que elijas y conserva los meses
                                anteriores.
                            </label>
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    gap: 9,
                                    marginTop: 4,
                                }}
                            >
                                <button
                                    onClick={() => setModal(false)}
                                    style={{
                                        background: "white",
                                        border: "1px solid #dbe2ea",
                                        borderRadius: 10,
                                        padding: "10px 14px",
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={guardar}
                                    disabled={guardando}
                                    style={button}
                                >
                                    {guardando ? "Guardando…" : "Guardar gasto"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export { FinanzasGastoIcon, FinanzasExpensePicker, FinanzasDatePicker, FinanzasMonthPicker, FinanzasPanel }
