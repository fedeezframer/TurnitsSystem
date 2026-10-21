import React from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { appConfig } from "../config";
import BookingReceipt from "../components/BookingReceipt";
import { receiptHome } from "../shared/booking-receipt.js";
import "./Receipt.css";

function reservationState(turno: any) {
  if (turno.estado === "cancelado") return "cancelled";
  if (turno.pago_estado === "rechazado") return "rejected";
  if (["confirmado", "completado"].includes(turno.estado)) return "confirmed";
  return "pending";
}

export default function Receipt({ failed = false }: { failed?: boolean }) {
  const location = useLocation(), navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const slug = query.get("slug") || query.get("u") || "";
  const id = query.get("turno_id") || "";
  const paymentId = query.get("payment_id") || query.get("collection_id") || "";
  const requestKey = `${slug}/${id}/${paymentId}`;
  const [snapshot, setSnapshot] = React.useState<any>(null);
  const turno = snapshot?.key === requestKey ? snapshot.turno : null;
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const home = receiptHome(window.localStorage);
  React.useEffect(() => {
    setSnapshot(null); setError(""); setLoading(true);
    if (!slug || (!id && !paymentId)) {
      setLoading(false); setError("No se encontró la información de la reserva. Revisá el enlace que recibiste."); return;
    }
    const controller = new AbortController();
    let timer: number | undefined, misses = 0, polls = 0, latest: any = null;
    const load = async () => {
      try {
        const path = id ? `/turnos/publico/${encodeURIComponent(id)}?slug=${encodeURIComponent(slug)}` : `/turnos/by-payment?payment_id=${encodeURIComponent(paymentId)}&slug=${encodeURIComponent(slug)}`;
        const response = await fetch(appConfig.apiUrl + path, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success || !data.turno || (id && data.turno.id !== id)) throw new Error("Reserva no disponible");
        if (controller.signal.aborted) return;
        latest = data.turno; misses = 0;
        setSnapshot({ key: requestKey, turno: latest }); setError(""); setLoading(false);
        if ((reservationState(latest) === "pending" || latest.pago_estado === "pendiente") && ++polls < 60) timer = window.setTimeout(load, 5000);
      } catch {
        if (controller.signal.aborted) return;
        if (++misses < 10) timer = window.setTimeout(load, 5000);
        else { setLoading(false); setError(latest ? "No pudimos actualizar el estado. Consultá al negocio." : "Todavía no pudimos verificar la reserva. Si pagaste, conservá el comprobante del pago y contactá al negocio."); }
      }
    };
    load();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [slug, id, paymentId, requestKey]);
  const state = turno ? reservationState(turno) : null;
  React.useEffect(() => {
    if (!state) return;
    const destination = state === "confirmed" ? "/success" : state === "pending" ? "/pendiente" : "/alert";
    if (location.pathname === destination) return;
    const params = new URLSearchParams({ slug });
    if (turno.id) params.set("turno_id", turno.id);
    else if (paymentId) params.set("payment_id", paymentId);
    navigate(`${destination}?${params}`, { replace: true });
  }, [state, turno?.id, slug, paymentId, location.pathname, navigate]);
  return <div className="receipt-page">
    <header className="receipt-header"><Link to={home} aria-label="Turnits, volver al inicio"><img src="/assets/browse/LogoTurnitsCompletoB.png" alt="Turnits" /></Link></header>
    <main className="receipt-main"><section className="receipt-content" aria-labelledby="receipt-title">
      <h1 id="receipt-title">Tu Comprobante</h1>
      {loading && <p role="status" className="receipt-loading">Estamos consultando la información de tu reserva.</p>}
      {error && <p role="alert" className="receipt-error">{error}</p>}
      {turno && <BookingReceipt turno={{ ...turno, slug: turno.slug || slug }} />}
    </section></main>
  </div>;
}
