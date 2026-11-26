import React from "react"
import BackButton from "./BackButton"

export default function PublicOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    const ref = React.useRef<HTMLDialogElement>(null)
    const label = React.useId()
    React.useEffect(() => {
        const dialog = ref.current
        if (dialog && !dialog.open) dialog.showModal()
        return () => { if (dialog?.open) dialog.close() }
    }, [])
    return <dialog ref={ref} className="turnits-public-overlay" aria-labelledby={label}
        onCancel={event => { event.preventDefault(); onClose() }}
        style={{ position: "fixed", inset: 0, margin: 0, width: "100%", maxWidth: "none", height: "100dvh", maxHeight: "none",
            padding: 0, border: 0, boxSizing: "border-box", overscrollBehavior: "contain", background: "var(--bf-bg, #fff)", color: "var(--bf-text, #172019)" }}>
        <style>{`html:has(.turnits-public-overlay[open]){overflow:hidden;scrollbar-gutter:stable}`}</style>
        <div style={{ maxWidth: 1080, padding: "18px max(16px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom))", margin: "0 auto" }}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                <h2 id={label} style={{ margin: 0, fontSize: 23 }}>{title}</h2>
                <BackButton aria-label={`Cerrar ${title.toLocaleLowerCase("es")}`} onClick={onClose} />
            </header>
            {children}
        </div>
    </dialog>
}
