import * as React from "react"
import { createPortal } from "react-dom"
import { BackButton } from "../../components/BackButton"
import { useOverlayPresence } from "./useOverlayPresence"
import { FINANZAS_PICKER_CSS } from "./common"

export function IconOptionPicker({ title, heading, help, icon, value, options, onChange, disabled = false }: {
    title: string
    heading: string
    help: string
    icon: (id: string, size: number) => React.ReactNode
    value: string
    options: { id: string; label: string; color: string; description?: string }[]
    onChange: (value: string) => void
    disabled?: boolean
}) {
    const [open, setOpen] = React.useState(false)
    const presence = useOverlayPresence(open)
    const trigger = React.useRef<HTMLButtonElement>(null)
    const dialog = React.useRef<HTMLDivElement>(null)
    const id = React.useId()
    const selected = options.find(option => option.id === value)
    React.useEffect(() => {
        if (!open) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        const preferred = dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') || dialog.current?.querySelector<HTMLButtonElement>('.fin-exp-option')
        preferred?.focus({preventScroll:true})
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
            const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
            if (!buttons.length) return
            if (event.key === "Tab") {
                const position = buttons.indexOf(document.activeElement as HTMLButtonElement)
                if (position < 0 || (!event.shiftKey && position === buttons.length - 1) || (event.shiftKey && position === 0)) {
                    event.preventDefault()
                    buttons[event.shiftKey ? buttons.length - 1 : 0].focus({preventScroll:true})
                }
            }
            const choices = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('.fin-exp-option') || [])
            const current = choices.indexOf(document.activeElement as HTMLButtonElement)
            if (current < 0) return
            const columns = window.innerWidth <= 560 ? 1 : 2
            const steps: Record<string, number> = {ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns}
            if (event.key in steps) {
                event.preventDefault()
                choices[(current + steps[event.key] + choices.length) % choices.length]?.focus({preventScroll:true})
            } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault()
                choices[event.key === "Home" ? 0 : choices.length - 1]?.focus({preventScroll:true})
            }
        }
        document.addEventListener("keydown", keyboard, true)
        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener("keydown", keyboard, true)
            trigger.current?.focus({preventScroll:true})
        }
    }, [open])
    const overlay = presence.visible ? <div className="fin-exp-overlay" data-closing={presence.closing} onClick={event => { if (event.target === event.currentTarget) setOpen(false) }}>
        <div className="fin-exp-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-heading`} aria-describedby={`${id}-help`}>
            <div className="fin-exp-header">
                <div><h2 id={`${id}-heading`}>{heading}</h2><p id={`${id}-help`}>{help}</p></div>
                <BackButton aria-label="Cerrar opciones" onClick={() => setOpen(false)} />
            </div>
            <div className="fin-exp-grid">
                {options.map(option => <button className="fin-exp-option" type="button" key={option.id} aria-pressed={value === option.id} style={{borderColor:value === option.id ? option.color : undefined}} onClick={() => {onChange(option.id);setOpen(false)}}>
                    <span className="fin-exp-icon" style={{color:option.color,background:`${option.color}12`}}>{icon(option.id, 20)}</span>
                    <span className="fin-exp-option-text"><span className="fin-exp-option-name">{option.label}</span><span className="fin-exp-option-hint">{option.description}</span></span>
                    {value === option.id && <svg className="fin-exp-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={option.color} strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
                </button>)}
            </div>
        </div>
    </div> : null
    return <div style={{display:"grid",gap:6,fontSize:13,minWidth:0}}>
        <style style={{display:"none"}}>{FINANZAS_PICKER_CSS}</style>
        <span id={`${id}-label`}>{title}</span>
        <button className="fin-exp-trigger" type="button" ref={trigger} disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
            <span style={{display:"flex",color:selected?.color || "#64748b",flexShrink:0}}>{icon(selected?.id || "", 18)}</span>
            <span className="fin-exp-selected-label" id={`${id}-value`}>{selected?.label || "Elegir una opción"}</span>
            <img src="/assets/panel-nav/boxicons_arrow-down-filled.svg" width="20" height="20" alt="" aria-hidden="true" style={{flexShrink:0}} />
        </button>
        {overlay && typeof document !== "undefined" ? createPortal(overlay, trigger.current?.closest("dialog") || document.body) : null}
    </div>
}
