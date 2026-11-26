import * as React from "react"

type Payment = {
    id: string; nombre: string; importe: number; metodo_pago: "efectivo" | "transferencia"
    comprobante: boolean; cliente: string; email?: string
}
type Request = <T>(suffix: string, init?: RequestInit) => Promise<T>
const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const path = "/pagos-manuales"
const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }
const action: React.CSSProperties = { padding: "7px 11px", borderRadius: 8, border: "1px solid #d4ddd5", background: "white", color: "#17271b", font: "inherit", cursor: "pointer" }

export default function MembershipPaymentReview({ request }: { request: Request }) {
    const [payments, setPayments] = React.useState<Payment[]>([])
    const [busy, setBusy] = React.useState("")
    const [error, setError] = React.useState("")
    const [proof, setProof] = React.useState<{ id: string; url: string } | null>(null)
    const [retry, setRetry] = React.useState(0)

    React.useEffect(() => {
        const controller = new AbortController()
        setError("")
        request<{ pagos: Payment[] }>(path, { signal: controller.signal }).then(data => {
            if (!controller.signal.aborted) setPayments(data.pagos)
        }).catch(err => { if (!controller.signal.aborted) setError(err.message) })
        return () => controller.abort()
    }, [request, retry])

    async function showProof(payment: Payment) {
        setBusy(payment.id)
        setError("")
        try {
            const data = await request<{ url: string }>(`${path}/${payment.id}/comprobante`)
            setProof({ id: payment.id, url: data.url })
        } catch (err) { setError(err instanceof Error ? err.message : "No pudimos abrir el comprobante.") }
        finally { setBusy("") }
    }

    async function review(payment: Payment, approve: boolean) {
        if (!window.confirm(approve ? `¿Confirmar el cobro de ${money.format(payment.importe)} y acreditar los tickets?` : "¿Rechazar este pago de suscripción?")) return
        setBusy(payment.id)
        setError("")
        try {
            await request(`${path}/${payment.id}`, { method: "PUT", body: JSON.stringify({ aprobar: approve }) })
            setPayments(items => items.filter(item => item.id !== payment.id))
            if (proof?.id === payment.id) setProof(null)
        } catch (err) { setError(err instanceof Error ? err.message : "No pudimos revisar el pago.") }
        finally { setBusy("") }
    }

    if (!payments.length && !error) return null
    return <section aria-label="Cobros de suscripciones pendientes" style={{ display: "grid", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Cobros pendientes</h3>
        {error && <p role="alert" style={{ margin: 0 }}>{error} <button type="button" style={action} onClick={() => setRetry(value => value + 1)}>Actualizar</button></p>}
        {payments.map(payment => <article key={payment.id} style={{ display: "grid", gap: 7, padding: 14, borderRadius: 12, border: "1px solid #d4ddd5", background: "white", overflowWrap: "anywhere" }}>
            <div style={{ ...row, justifyContent: "space-between" }}><b>{payment.nombre}</b><strong>{money.format(payment.importe)}</strong></div>
            <div>{[payment.cliente, payment.email].filter(Boolean).join(" · ")}</div>
            <small>{payment.metodo_pago === "transferencia" ? "Transferencia bancaria" : "Efectivo en el local"}</small>
            {proof?.id === payment.id && <a href={proof.url} target="_blank" rel="noreferrer">
                <img src={proof.url} alt="Comprobante de la transferencia" style={{ maxWidth: "min(100%, 360px)", maxHeight: 300, objectFit: "contain" }} />
            </a>}
            <div style={row}>
                {payment.comprobante && <button type="button" disabled={!!busy} style={action} onClick={() => void showProof(payment)}>Ver comprobante</button>}
                <button type="button" disabled={!!busy} style={action} onClick={() => void review(payment, false)}>Rechazar</button>
                <button type="button" disabled={!!busy} style={{ ...action, background: "#196b1f", color: "white" }} onClick={() => void review(payment, true)}>Confirmar cobro</button>
            </div>
        </article>)}
    </section>
}
