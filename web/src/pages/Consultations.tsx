import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { appConfig } from "../config";
import { consumerHeaders } from "../shared/consumer-session";
import "./Consultations.css";

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);
export default function Consultations() {
  if (!appConfig.quoteBookingEnabled) return <main className="consultations"><h1>Consultas y presupuestos</h1><p>Estamos preparando esta modalidad. Todavía no está habilitada.</p><Link to="/browse">Volver</Link></main>;
  return <ConsultationsContent />;
}
function ConsultationsContent() {
  const [params, setParams] = useSearchParams();
  const business = localStorage.getItem("account_type") !== "usuario";
  const prefix = business ? "/admin/consultas" : "/browse/consultas";
  const token = localStorage.getItem("access_token") || localStorage.getItem("auth_token") || "";
  const headers = business ? { Authorization: `Bearer ${token}` } : consumerHeaders();
  const [inbox, setInbox] = React.useState<any[]>([]);
  const [conversation, setConversation] = React.useState<any>(null);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [members, setMembers] = React.useState<any[]>([]);
  const [quote, setQuote] = React.useState<any>({ detalle: "", total: "", sena: "0", duracion: "60", equipo_id: "", fecha: "", hora: "", vence_at: "" });
  const lock = React.useRef(false);
  const current = params.get("id") || "";
  const requestedService = params.get("servicio_id");
  const api = React.useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(appConfig.apiUrl + path, { ...options, headers: { ...headers, ...options.headers }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "No pudimos cargar tus consultas.");
    return data;
  }, [business, token]);
  const post = (path: string, body: any) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  React.useEffect(() => {
    if (!requestedService || business) return;
    const controller = new AbortController();
    api("/browse/consultas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ servicio_id: requestedService }), signal: controller.signal }).then(data => { if (!controller.signal.aborted) setParams({ id: data.id }, { replace: true }); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [requestedService, business, api, setParams]);
  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setConversation(null); setError("");
    api(prefix, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setInbox(data.consultas || []); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    const load = () => {
      if (!current || document.hidden) { setLoading(false); return; }
      api(prefix + "/" + encodeURIComponent(current), { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setConversation(data); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    };
    load();
    const timer = window.setInterval(load, 15000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [api, prefix, current, revision]);
  React.useEffect(() => {
    setText(""); setMembers([]); setQuote({ detalle: "", total: "", sena: "0", duracion: "60", equipo_id: "", fecha: "", hora: "", vence_at: "" });
  }, [current]);
  React.useEffect(() => {
    if (!business || !conversation?.consulta) return;
    const controller = new AbortController();
    const consultation = conversation.consulta;
    fetch(`${appConfig.apiUrl}/equipo/${encodeURIComponent(consultation.slug)}?servicio_id=${encodeURIComponent(consultation.servicio_id)}`, { signal: controller.signal }).then(response => response.json()).then(data => { if (!controller.signal.aborted && data.success) setMembers(data.equipo || []); }).catch(() => {});
    return () => controller.abort();
  }, [business, conversation?.consulta?.id]);
  const act = async (action: () => Promise<void>, refresh = true) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); if (refresh) setRevision(value => value + 1); }
    catch (failure: any) { setError(failure.message || "No pudimos completar la operación."); }
    finally { lock.current = false; setBusy(false); }
  };
  const field = (name: string) => ({ value: quote[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setQuote((value: any) => ({ ...value, [name]: event.target.value })) });
  const activeQuote = conversation?.presupuestos?.find((item: any) => item.estado !== "reemplazado");
  const quoteExpired = activeQuote && Date.parse(activeQuote.vence_at) <= Date.now();
  return <main className="consultations">
    <header><Link to={business ? "/panel" : "/browse"}>Volver</Link><h1>Consultas y presupuestos</h1><p>Conversá, compartí referencias y acordá los detalles antes de reservar.</p></header>
    {error && <p role="alert" className="consultation-error">{error}</p>}
    <div className="consultation-layout"><nav aria-label="Tus consultas">{inbox.map(item => <button key={item.id} aria-current={current === item.id ? "page" : undefined} disabled={busy} onClick={() => setParams({ id: item.id })}><strong>{item.titulo}</strong><span>{item.slug} · {item.estado}</span></button>)}{!inbox.length && <p>Todavía no tenés consultas.</p>}</nav>
      <section aria-label="Conversación">
        {loading && <p role="status">Cargando conversación…</p>}
        {!current && <p>Elegí una consulta para empezar.</p>}
        {conversation && <><h2>{conversation.consulta.titulo}</h2><p>Esta conversación es privada entre vos y el negocio. No envíes contraseñas ni datos de tarjetas.</p>
          {conversation.anterior && <button type="button" disabled={busy} onClick={() => act(async () => { const older = await api(prefix + "/" + current + "?before=" + conversation.anterior); setConversation((value: any) => ({ ...value, anterior: older.anterior, mensajes: [...older.mensajes, ...value.mensajes] })); }, false)}>Ver mensajes anteriores</button>}
          <div className="consultation-messages" aria-label="Mensajes">{conversation.mensajes.map((message: any) => <article className={message.autor === (business ? "negocio" : "cliente") ? "mine" : ""} key={message.id}><strong>{message.autor === "negocio" ? "Negocio" : "Cliente"}</strong>{message.texto && <p>{message.texto}</p>}{message.referencia_url && <a href={message.referencia_url} target="_blank" rel="noreferrer"><img src={message.referencia_url} alt="Referencia compartida en esta consulta" loading="lazy" /></a>}<time>{new Date(message.created_at).toLocaleString("es-AR")}</time></article>)}</div>
          {conversation.consulta.estado !== "cerrada" && <form onSubmit={event => { event.preventDefault(); void act(async () => { await post(prefix + "/" + current + "/mensajes", { texto: text }); setText(""); }); }}><label>Tu mensaje<textarea required maxLength={3000} value={text} onChange={event => setText(event.target.value)} disabled={busy} /></label><button disabled={busy || !text.trim()}>Enviar mensaje</button><label>Compartir referencia (JPG, PNG o WebP, hasta 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || conversation.consulta.estado !== "abierta"} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (file.size > 2097152) { setError("La imagen debe pesar hasta 2 MB."); return; } void act(async () => { const body = new FormData(); body.append("referencia", file); await api(prefix + "/" + current + "/referencias", { method: "POST", body }); }); }} /></label></form>}
          {activeQuote && <article className="consultation-quote"><h3>Presupuesto</h3><p>{activeQuote.detalle}</p><dl><dt>Total</dt><dd>{money(activeQuote.total)}</dd><dt>Seña acordada</dt><dd>{money(activeQuote.sena)}</dd><dt>Fecha y hora propuestas</dt><dd>{activeQuote.fecha} · {activeQuote.hora.slice(0, 5)}</dd><dt>Duración</dt><dd>{activeQuote.duracion} min</dd><dt>Válido hasta</dt><dd>{new Date(activeQuote.vence_at).toLocaleString("es-AR")}</dd></dl><p>{activeQuote.estado === "reservado" ? "Reserva confirmada. Esto no significa que el pago esté acreditado." : quoteExpired ? "Este presupuesto venció. Pedí uno nuevo." : "Aceptar no bloquea el horario ni realiza un cobro. El horario se verifica al confirmar la reserva."}</p>
            {!business && activeQuote.estado === "propuesto" && !quoteExpired && <button disabled={busy} onClick={() => act(async () => { await post(prefix + "/" + current + "/aceptar", { presupuesto_id: activeQuote.id }); })}>Aceptar presupuesto y horario</button>}
            {business && activeQuote.estado === "aceptado" && !quoteExpired && <button disabled={busy} onClick={() => act(async () => { await post(prefix + "/" + current + "/reservar", { presupuesto_id: activeQuote.id }); })}>Marcar como reservado, sin registrar pago</button>}
          </article>}
          {business && conversation.consulta.estado === "abierta" && <form className="consultation-quote" onSubmit={event => { event.preventDefault(); void act(async () => { await post(prefix + "/" + current + "/presupuestos", { ...quote, vence_at: new Date(quote.vence_at).toISOString() }); }); }}><h3>{activeQuote ? "Proponer un nuevo presupuesto" : "Armar presupuesto"}</h3><p>Una nueva propuesta reemplaza la anterior y necesita una nueva aceptación del cliente.</p><label>Qué incluye<textarea required maxLength={3000} {...field("detalle")} /></label><div className="consultation-fields"><label>Total ($)<input required type="number" min="0.01" step="0.01" {...field("total")} /></label><label>Seña ($)<input required type="number" min="0" step="0.01" {...field("sena")} /></label><label>Profesional<select required {...field("equipo_id")}><option value="">Elegí un profesional</option>{members.map(member => <option key={member.id} value={member.id}>{member.nombre}</option>)}</select></label><label>Día<input required type="date" {...field("fecha")} /></label><label>Hora<input required type="time" {...field("hora")} /></label><label>Duración (minutos)<input required type="number" min="5" max="720" {...field("duracion")} /></label><label>Vencimiento<input required type="datetime-local" {...field("vence_at")} /></label></div><button disabled={busy}>Enviar presupuesto</button></form>}
        </>}
      </section>
    </div>
  </main>;
}
