import * as React from "react";
import { Link } from "react-router";
import { appConfig } from "../config";
import { ChatAvatar, ChatHeader } from "../components/ChatChrome";
import "./QuoteAvailability.css";
import "./Consultations.css";

export default function QuoteAvailability({ slug, business }: { slug: string; business: any }) {
  React.useEffect(() => { const previous = document.title; document.title = `Disponibilidad | ${business.business_name} | Turnits`; return () => { document.title = previous; }; }, [business.business_name]);
  const initialService = new URLSearchParams(location.search).get("servicio_id") || "";
  const [services, setServices] = React.useState<any[]>([]);
  const [service, setService] = React.useState(initialService);
  const [loading, setLoading] = React.useState(true), [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    setError(""); setServices([]); setService(initialService); setLoading(true);
    fetch(`${appConfig.apiUrl}/servicios/${encodeURIComponent(slug)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok || !data.success) throw Error("No pudimos cargar los servicios.");
      if (controller.signal.aborted) return;
      setServices(data.servicios || []); setService((data.servicios || []).some((item: any) => item.id === initialService) ? initialService : data.servicios?.[0]?.id || "");
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, initialService, retry]);
  const consult = `/browse?${new URLSearchParams({ vista: "mensajes", ...(service ? { servicio_id: service } : {}) })}`;
  return <main className="quote-availability"><ChatHeader business={false} /><section className="quote-availability-content">
    <Link className="quote-availability-business" to={`/perfil/${encodeURIComponent(slug)}`}><ChatAvatar name={business.business_name} src={business.logo_url} /><span>{business.business_name}</span></Link>
    <div className="quote-availability-intro"><span className="quote-availability-kicker">AGENDA POR PRESUPUESTO</span><h1>Contanos qué te gustaría hacer</h1><p>Iniciá una conversación con {business.business_name}. Podés explicar tu idea, adjuntar referencias y coordinar por chat el precio, la duración y el horario.</p></div>
    {error && <div role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Reintentar</button></div>}
    {services.length > 0 && <label>¿Qué servicio te interesa? <span className="quote-availability-select-wrap"><select value={service} onChange={event => setService(event.target.value)}>{services.map(item => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></span></label>}
    {loading ? <p role="status">Cargando información…</p> : !error && !services.length && <p>Podés iniciar la consulta y describir tu proyecto directamente en el chat.</p>}
    {!!service && <Link className="quote-availability-consult" to={consult}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14.5h5"/></svg><span><strong>Empezar un chat</strong><small>Contale tu idea y enviá tu consulta</small></span><span aria-hidden="true">›</span></Link>}
    <p className="quote-availability-note">La consulta no genera una reserva ni un cobro. El horario se confirma al aceptar el presupuesto.</p>
  </section></main>;
}
