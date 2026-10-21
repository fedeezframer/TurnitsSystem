import React from "react";
import { bookingReceipt, receiptMoney } from "../shared/booking-receipt.js";
import "./BookingReceipt.css";

export default function BookingReceipt({ turno }: { turno: any }) {
  const receipt = bookingReceipt(turno);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState("");
  const download = async () => {
    setDownloading(true); setError("");
    try {
      const { createReceiptPdf } = await import("../shared/receipt-pdf.js");
      const doc = await createReceiptPdf(turno);
      doc.save(`Turnits-comprobante-${receipt.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || "reserva"}.pdf`);
    } catch { setError("No se pudo descargar el PDF. Volvé a intentarlo."); }
    finally { setDownloading(false); }
  };
  return <article className="booking-receipt" aria-label="Comprobante de reserva">
    <div className="booking-receipt-heading"><span>turnits</span><span>Comprobante de reserva</span></div>
    <div className="booking-receipt-summary">
      <span className={`booking-receipt-state booking-receipt-state-${turno.estado}`}>{receipt.state}</span>
      <h2>{receiptMoney(receipt.total)}</h2><p>Total de la reserva · ARS</p>
    </div>
    <dl className="booking-receipt-details">{receipt.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="booking-receipt-tear" />
    <h3>Detalle de importes</h3>
    <dl className="booking-receipt-details booking-receipt-finances">{receipt.financialRows.map(([label, value], index) => <div key={index} className={label === "Saldo pendiente" ? "booking-receipt-balance" : label === "Abonado registrado" ? "booking-receipt-paid" : ""}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="booking-receipt-note">{receipt.note}</p>
    <p className="booking-receipt-reference">Reserva {receipt.id || "sin número"}</p>
    <p className="booking-receipt-legal">Comprobante de reserva. No válido como factura. El estado y los importes pueden actualizarse.</p>
    <button type="button" className="booking-receipt-download" disabled={downloading} onClick={download}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></svg>
      {downloading ? "Preparando PDF…" : "Descargar comprobante PDF"}
    </button>
    {error && <p role="alert" className="booking-receipt-error">{error}</p>}
  </article>;
}
