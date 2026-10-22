import * as React from "react";
import { Link } from "react-router";
import { appConfig } from "../config";
import { ChatAvatar, ChatHeader } from "../components/ChatChrome";
import "./QuoteAvailability.css";
import "./Consultations.css";

const argentinaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export default function QuoteAvailability({ slug, business }: { slug: string; business: any }) {
  const initialService = new URLSearchParams(location.search).get("servicio_id") || "";
  const [services, setServices] = React.useState<any[]>([]), [members, setMembers] = React.useState<any[]>([]);
  const [service, setService] = React.useState(initialService), [member, setMember] = React.useState("");
  const [date, setDate] = React.useState(argentinaDate), [time, setTime] = React.useState("");
  const [slots, setSlots] = React.useState<any[]>([]), [loading, setLoading] = React.useState(true), [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  const [catalogLoading, setCatalogLoading] = React.useState(true);
  React.useEffect(() => {
    const controller = new AbortController();
    setError(""); setServices([]); setService(initialService); setCatalogLoading(true);
    fetch(`${appConfig.apiUrl}/servicios/${encodeURIComponent(slug)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok || !data.success) throw Error("No pudimos cargar los servicios.");
      if (controller.signal.aborted) return;
      setServices(data.servicios || []); setService((data.servicios || []).some((item: any) => item.id === initialService) ? initialService : data.servicios?.[0]?.id || "");
    }).catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false); } }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [slug, initialService, retry]);
  React.useEffect(() => {
    setMembers([]); setMember(""); setSlots([]); setTime(""); if (!service) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true);
    fetch(`${appConfig.apiUrl}/equipo/${encodeURIComponent(slug)}?servicio_id=${encodeURIComponent(service)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok || !data.success) throw Error("No pudimos cargar los profesionales.");
      if (controller.signal.aborted) return;
      setMembers(data.equipo || []); setMember(data.equipo?.[0]?.id || ""); if (!data.equipo?.length) setLoading(false);
    }).catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setLoading(false); } });
    return () => controller.abort();
  }, [slug, service, retry]);
  React.useEffect(() => {
    setSlots([]); setTime(""); if (!service || !member || !date) return;
    const controller = new AbortController(); setLoading(true); setError("");
    fetch(`${appConfig.apiUrl}/slots-disponibles/${encodeURIComponent(slug)}?${new URLSearchParams({ servicio_id: service, equipo_id: member, fecha: date })}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok || !data.success || data.suspendido) throw Error("No pudimos consultar la disponibilidad de esta agenda.");
      if (!controller.signal.aborted) setSlots((data.slots || []).filter((item: any) => !item.lleno));
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, service, member, date, retry]);
  const consult = `/consultas?${new URLSearchParams({ servicio_id: service, ...(time ? { fecha: date, hora: time, profesional: members.find(item => item.id === member)?.nombre || "" } : {}) })}`;
  return <main className="quote-availability"><ChatHeader business={false} /><section className="quote-availability-content">
    <Link className="quote-availability-business" to={`/perfil/${encodeURIComponent(slug)}`}><ChatAvatar name={business.business_name} src={business.logo_url} /><span>{business.business_name}</span></Link>
    <h1>Disponibilidad para tu proyecto</h1><p>Explorá la agenda y contanos qué tenés en mente. El precio, la duración y el horario definitivo se acuerdan por chat.</p>
    {error && <div role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    {!!services.length && <label>¿Qué te interesa?<select value={service} onChange={event => setService(event.target.value)}>{services.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>}
    {members.length > 1 && <label>Profesional<select value={member} onChange={event => setMember(event.target.value)}>{members.map(item => <option key={item.id} value={item.id}>{item.nombre} {item.apellido || ""}</option>)}</select></label>}
    {!!service && <label>Día para consultar<input type="date" min={argentinaDate()} value={date} onChange={event => setDate(event.target.value)} /></label>}
    <h2>Horarios orientativos</h2><p className="quote-availability-note">Estos horarios no están reservados. La disponibilidad se vuelve a verificar al confirmar el presupuesto.</p>
    {loading || catalogLoading ? <p role="status">Consultando agenda…</p> : !error && !slots.length ? <p>No hay horarios para mostrar en este día. Podés consultar igualmente por chat.</p> : <div className="quote-availability-slots">{slots.map(item => <button key={item.hora} type="button" aria-pressed={time === item.hora} onClick={() => setTime(previous => previous === item.hora ? "" : item.hora)}>{item.hora}</button>)}</div>}
    {!!service && <Link className="quote-availability-consult" to={consult}>{time ? `Consultar por las ${time}` : "Consultar mi proyecto"}</Link>}
    {!loading && !catalogLoading && !services.length && !error && <p>Este negocio todavía no publicó servicios para consultar.</p>}
    <p className="quote-availability-note">Consultar no genera una reserva ni un cobro.</p>
  </section></main>;
}
