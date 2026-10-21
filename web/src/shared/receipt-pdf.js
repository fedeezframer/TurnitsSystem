import { bookingReceipt, receiptMoney } from "./booking-receipt.js";

export async function createReceiptPdf(turno) {
  const { jsPDF } = await import("jspdf");
  const receipt = bookingReceipt(turno);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: "Comprobante de reserva - Turnits", author: "Turnits" });
  let cursor = 22;
  const clean = value => String(value).replace(/[\u0000-\u001f\u007f]/g, " ");
  const heading = () => {
    doc.setTextColor(27, 107, 26); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
    doc.text("turnits", 22, cursor); cursor += 10;
    doc.setTextColor(25, 39, 25); doc.setFontSize(13);
    doc.text("Comprobante de reserva", 22, cursor); cursor += 12;
  };
  const space = height => {
    if (cursor + height > 270) { doc.addPage(); cursor = 22; heading(); }
  };
  const paragraph = (text, size = 10) => {
    doc.setFontSize(size); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(clean(text), 166);
    for (const line of lines) { space(6); doc.text(line, 22, cursor); cursor += 5.5; }
    cursor += 3;
  };
  const row = (label, value) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const labels = doc.splitTextToSize(clean(label), 70);
    const values = doc.splitTextToSize(clean(value), 86);
    const count = Math.max(labels.length, values.length);
    for (let index = 0; index < count; index++) {
      space(6); doc.setTextColor(93, 108, 86); doc.setFont("helvetica", "normal");
      if (labels[index]) doc.text(labels[index], 22, cursor);
      doc.setTextColor(25, 39, 25); doc.setFont("helvetica", "bold");
      if (values[index]) doc.text(values[index], 188, cursor, { align: "right" });
      cursor += 5.5;
    }
    cursor += 3;
  };
  heading();
  paragraph(receipt.state);
  paragraph(receiptMoney(receipt.total) + " ARS", 24);
  cursor += 4;
  for (const [label, value] of receipt.rows) row(label, value);
  space(18); cursor += 4;
  doc.setDrawColor(205, 216, 199); doc.line(22, cursor, 188, cursor); cursor += 10;
  paragraph("Detalle de importes", 12);
  for (const [label, value] of receipt.financialRows) row(label, value);
  cursor += 4;
  paragraph(receipt.note);
  paragraph("Reserva: " + receipt.id, 9);
  paragraph("Comprobante de reserva. No valido como factura. El estado y los importes pueden actualizarse.", 9);
  paragraph("Consultado: " + new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()) + " (Argentina)", 9);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(93, 108, 86);
    doc.text(`Turnits - ${page} / ${doc.getNumberOfPages()}`, 188, 286, { align: "right" });
  }
  return doc;
}
