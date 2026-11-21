import * as React from "react";
import "./offer-schedule.css";

export type OfferWindow = { dia: number; desde: string; hasta: string };
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function OfferSchedule({ windows, onChange, label }: {
  windows?: OfferWindow[];
  onChange: (windows: OfferWindow[]) => void;
  label?: string;
}) {
  const rows = windows || [];
  return <div className="offer-schedule">
    <strong>{label || "Días y horarios de la oferta"}</strong>
    <p>{rows.length ? "La oferta solo aparecerá si el servicio entra completo en estas franjas." : "Sin franjas: se ofrece en cualquier horario libre de atención."}</p>
    {rows.map((row, index) => <div className="offer-schedule-row" key={index}>
      <label>Día<select value={row.dia} onChange={event => onChange(rows.map((item, i) => i === index ? { ...item, dia: Number(event.target.value) } : item))}>{DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>
      <label>Desde<input type="time" value={row.desde} onChange={event => onChange(rows.map((item, i) => i === index ? { ...item, desde: event.target.value } : item))} /></label>
      <label>Hasta<input type="time" value={row.hasta} onChange={event => onChange(rows.map((item, i) => i === index ? { ...item, hasta: event.target.value } : item))} /></label>
      <button type="button" aria-label={`Quitar franja ${index + 1}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>Quitar</button>
    </div>)}
    {rows.length < 21 && <button type="button" className="offer-schedule-add" onClick={() => onChange([...rows, { dia: 1, desde: "15:00", hasta: "16:30" }])}>+ Agregar franja</button>}
  </div>;
}
