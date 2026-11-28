import * as React from "react"
import { BackButton } from "../../components/BackButton"
import { useNativeDialogExit } from "../../components/useNativeDialogExit"
import { AgendaPanel_formatMonto, AgendaPanel_metodoPagoLabel, MenuFooter_getSlug, MenuFooter_getToken } from "./common"

export type MembershipPayment = {
    id: string; nombre: string; importe: number; metodo_pago: string
    comprobante: boolean; cliente: string; email?: string
    created_at: string; pagado_at?: string; estado?: "pendiente" | "cobrado"
}

export function useAgendaMembershipPayments(api: string, enabled: boolean) {
    const [payments, setPayments] = React.useState<MembershipPayment[]>([])
    const [loading, setLoading] = React.useState(enabled)
    const [error, setError] = React.useState("")
    const [revision, retry] = React.useReducer(value => value + 1, 0)
    const request = React.useCallback(async <T,>(suffix = "", init: RequestInit = {}): Promise<T> => {
        const slug = MenuFooter_getSlug()
        const token = MenuFooter_getToken()
        if (!slug || !token) throw Error("Volvé a iniciar sesión para revisar los cobros.")
        const response = await fetch(`${api.replace(/\/+$/, "")}/admin/membresias/${encodeURIComponent(slug)}/pagos-manuales${suffix}`, {
            ...init, cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
        })
        const data = await response.json()
        if (!response.ok || !data.success) throw Error(data.error || "No pudimos revisar los cobros.")
        return data
    }, [api])

    React.useEffect(() => {
        if (!enabled) return
        const controller = new AbortController()
        setLoading(true)
        setError("")
        request<{ pagos: MembershipPayment[] }>("?vista=turnos", { signal: controller.signal }).then(data => {
            if (!controller.signal.aborted) setPayments(data.pagos)
        }).catch(err => {
            if (!controller.signal.aborted) setError(err.message)
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false)
        })
        return () => controller.abort()
    }, [enabled, request, revision])

    async function review(payment: MembershipPayment, approve: boolean) {
        await request(`/${encodeURIComponent(payment.id)}`, { method: "PUT", body: JSON.stringify({ aprobar: approve }) })
        setPayments(items => approve ? items.map(item => item.id === payment.id
            ? { ...item, estado: "cobrado", pagado_at: new Date().toISOString() } : item) : items.filter(item => item.id !== payment.id))
        retry()
    }

    return { payments, loading, error, retry, request, review }
}

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })

export function MembershipPaymentReview({ payment, request, review, onClose }: {
    payment: MembershipPayment
    request: ReturnType<typeof useAgendaMembershipPayments>["request"]
    review: ReturnType<typeof useAgendaMembershipPayments>["review"]
    onClose: () => void
}) {
    const dialog = React.useRef<HTMLDialogElement>(null)
    const title = React.useId()
    const finishClose = useNativeDialogExit(onClose)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState("")
    const [proof, setProof] = React.useState("")
    const date = new Date(payment.pagado_at || payment.created_at)
    React.useEffect(() => {
        if (!dialog.current?.open) dialog.current?.showModal()
    }, [])

    async function perform(action: () => Promise<void>) {
        setBusy(true)
        setError("")
        try { await action() }
        catch (err) { setError(err instanceof Error ? err.message : "No pudimos revisar el cobro.") }
        finally { setBusy(false) }
    }

    function confirm(approve: boolean) {
        if (!window.confirm(approve ? `¿Confirmar el cobro de ${AgendaPanel_formatMonto(payment.importe)} y acreditar los tickets?` : "¿Rechazar este pago de suscripción?")) return
        void perform(async () => {
            await review(payment, approve)
            dialog.current?.close()
        })
    }

    return <dialog className="agenda-reservation-dialog" ref={dialog} aria-labelledby={title} onClose={finishClose}
        onCancel={event => { if (busy) event.preventDefault() }}>
        <header>
            <div><h2 id={title}>{payment.nombre}</h2><p>Suscripción</p></div>
            <BackButton onClick={() => dialog.current?.close()} aria-label="Cerrar detalle de cobro" disabled={busy} autoFocus />
        </header>
        <dl className="agenda-reservation-facts">
            <div><dt>Cliente</dt><dd>{payment.cliente || payment.email || "Cliente"}</dd></div>
            <div><dt>Importe</dt><dd>{AgendaPanel_formatMonto(payment.importe)}</dd></div>
            <div><dt>Medio de pago</dt><dd>{AgendaPanel_metodoPagoLabel(payment.metodo_pago)}</dd></div>
            <div><dt>Estado</dt><dd>{payment.estado === "cobrado" ? "Cobrado" : "Por confirmar"}</dd></div>
            {Number.isFinite(date.getTime()) && <div><dt>{payment.estado === "cobrado" ? "Cobrado el" : "Registrado el"}</dt><dd>{dateFormat.format(date)}</dd></div>}
        </dl>
        {proof && <a className="agenda-proof" href={proof} target="_blank" rel="noopener noreferrer">Abrir comprobante de transferencia</a>}
        {error && <p role="alert">{error}</p>}
        <div className="agenda-payment-actions">
            {payment.comprobante && !proof && <button type="button" disabled={busy} onClick={() => void perform(async () => {
                const data = await request<{ url: string }>(`/${encodeURIComponent(payment.id)}/comprobante`)
                setProof(data.url)
            })}>Ver comprobante</button>}
            {payment.estado !== "cobrado" && <>
                <button type="button" disabled={busy} onClick={() => confirm(false)}>Rechazar cobro</button>
                <button type="button" className="agenda-payment-confirm" disabled={busy} onClick={() => confirm(true)}>Confirmar cobro</button>
            </>}
        </div>
    </dialog>
}
