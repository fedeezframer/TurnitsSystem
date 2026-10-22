import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { appConfig } from "../config";
import { consumerHeaders } from "../shared/consumer-session";
import { availabilityInquiry, defaultQuoteExpiry, mergeMessages, messagePreview, quotePresentation } from "../shared/consultations.js";
import { ChatAvatar, ChatBottomNav, ChatHeader, ChatIcon } from "../components/ChatChrome";
import BookingReceipt from "../components/BookingReceipt";
import "./Consultations.css";

type Screen = "chat" | "edit" | "quote";
type Draft = { servicio: string; detalle: string; total: string; sena: string; duracion: string; equipo_id: string; fecha: string; hora: string; vence_at: string };
const emptyDraft = (): Draft => ({ servicio: "", detalle: "", total: "", sena: "0", duracion: "60", equipo_id: "", fecha: "", hora: "", vence_at: "" });
const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(value);

export default function Consultations() {
  if (!appConfig.quoteBookingEnabled) return <main className="consultations-unavailable"><h1>Mensajes</h1><p>Esta modalidad todavía no está habilitada.</p><Link to="/browse">Volver</Link></main>;
  return <ConsultationsContent />;
}
function ConsultationsContent() {
  const [params, setParams] = useSearchParams();
  const business = localStorage.getItem("account_type") !== "usuario";
  const prefix = business ? "/admin/consultas" : "/browse/consultas";
  const token = localStorage.getItem("access_token") || localStorage.getItem("auth_token") || "";
  const current = params.get("id") || "", requestedService = params.get("servicio_id");
  const [inbox, setInbox] = React.useState<any[]>([]);
  const [conversation, setConversation] = React.useState<any>(null);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [screen, setScreen] = React.useState<Screen>("chat");
  const [members, setMembers] = React.useState<any[]>([]);
  const [memberError, setMemberError] = React.useState("");
  const [draft, setDraft] = React.useState<Draft>(emptyDraft);
  const [attachmentsOpen, setAttachmentsOpen] = React.useState(false);
  const [reference, setReference] = React.useState("");
  const [receipt, setReceipt] = React.useState<any>(null);
  const [revision, setRevision] = React.useState(0);
  const lock = React.useRef(false), activeThread = React.useRef(current), stickBottom = React.useRef(true), readMarker = React.useRef("");
  activeThread.current = current;
  const activeScreen = React.useRef(screen);
  activeScreen.current = screen;
  const scrollArea = React.useRef<HTMLDivElement>(null), fileInput = React.useRef<HTMLInputElement>(null), composer = React.useRef<HTMLTextAreaElement>(null), referenceDialog = React.useRef<HTMLDialogElement>(null);
  const pendingScroll = React.useRef<{ top: number; height: number } | null>(null);
  const api = React.useCallback(async (path: string, options: RequestInit = {}) => {
    const headers = business ? { Authorization: `Bearer ${token}` } : consumerHeaders();
    const response = await fetch(appConfig.apiUrl + path, { ...options, headers: { ...headers, ...options.headers }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || "No pudimos cargar tus mensajes.");
    return data;
  }, [business, token]);
  const post = (path: string, body: any) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const refreshInbox = React.useCallback(async (signal?: AbortSignal) => {
    const data = await api(prefix, { signal }); if (!signal?.aborted) setInbox(data.consultas || []);
  }, [api, prefix]);
  const refreshThread = React.useCallback(async (signal?: AbortSignal) => {
    if (!current) return;
    const data = await api(`${prefix}/${encodeURIComponent(current)}`, { signal });
    if (signal?.aborted || activeThread.current !== current) return;
    setConversation((previous: any) => previous?.consulta.id === current ? { ...data, mensajes: mergeMessages(previous.mensajes, data.mensajes), anterior: previous.historyLoaded ? previous.anterior : data.anterior, historyLoaded: previous.historyLoaded } : data);
    const message = data.mensajes.at(-1), marker = `${current}:${message?.id || ""}`;
    if (!document.hidden && activeScreen.current === "chat" && message && readMarker.current !== marker) {
      await api(`${prefix}/${current}/leida`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensaje_id: message.id }), signal });
      if (!signal?.aborted && activeThread.current === current) { readMarker.current = marker; setInbox(items => items.map(item => item.id === current ? { ...item, no_leidos: 0 } : item)); }
    }
  }, [api, prefix, current]);
  React.useEffect(() => { const previous = document.title; document.title = `Mensajes | Turnits${appConfig.staging ? " TEST" : ""}`; return () => { document.title = previous; }; }, []);
  React.useEffect(() => {
    if (!requestedService || business || !token) return;
    const controller = new AbortController();
    api("/browse/consultas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ servicio_id: requestedService }), signal: controller.signal }).then(data => { if (!controller.signal.aborted) { const next = new URLSearchParams(window.location.search); next.delete("servicio_id"); next.set("id", data.id); setParams(next, { replace: true }); } }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [requestedService, business, api, setParams, token]);
  React.useEffect(() => { setConversation(null); setScreen("chat"); setText(!business ? availabilityInquiry(new URLSearchParams(window.location.search)) : ""); setError(""); setMembers([]); setMemberError(""); setDraft(emptyDraft()); setAttachmentsOpen(false); stickBottom.current = true; pendingScroll.current = null; }, [current, business]);
  React.useEffect(() => {
    if (!token) { setLoading(false); return; }
    const controller = new AbortController(); let pending = false;
    const load = async (initial = false) => {
      if (pending || (!initial && document.hidden)) return; pending = true;
      try { await refreshInbox(controller.signal); await refreshThread(controller.signal); }
      catch (failure: any) { if (!controller.signal.aborted) setError(failure.message); }
      finally { pending = false; if (!controller.signal.aborted) setLoading(false); }
    };
    setLoading(true); void load(true);
    const timer = window.setInterval(() => void load(), 15000), visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [refreshInbox, refreshThread, revision, token]);
  React.useEffect(() => {
    if (!business || !conversation?.consulta) return;
    const controller = new AbortController(), consultation = conversation.consulta;
    fetch(`${appConfig.apiUrl}/equipo/${encodeURIComponent(consultation.slug)}?servicio_id=${encodeURIComponent(consultation.servicio_id)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok || !data.success) throw new Error("No pudimos cargar los profesionales. Volvé a intentar.");
      if (!controller.signal.aborted) { setMembers(data.equipo || []); setMemberError(""); }
    }).catch(failure => { if (!controller.signal.aborted) setMemberError(failure.message); });
    return () => controller.abort();
  }, [business, conversation?.consulta?.id, revision]);
  React.useLayoutEffect(() => {
    if (!scrollArea.current || screen !== "chat") return;
    if (pendingScroll.current) { const previous = pendingScroll.current; scrollArea.current.scrollTop = previous.top + scrollArea.current.scrollHeight - previous.height; pendingScroll.current = null; }
    else if (stickBottom.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight;
  }, [conversation?.mensajes?.length, current, screen]);
  React.useEffect(() => { if (composer.current) { composer.current.style.height = "0px"; composer.current.style.height = `${Math.min(100, Math.max(50, composer.current.scrollHeight))}px`; } }, [text, screen, current]);
  React.useEffect(() => { if (reference && referenceDialog.current && !referenceDialog.current.open) referenceDialog.current.showModal(); }, [reference]);
  React.useEffect(() => {
    setReceipt(null);
    if (!current || screen !== "quote" || !conversation?.presupuestos?.some((item: any) => item.estado === "reservado")) return;
    const controller = new AbortController();
    api(`${prefix}/${current}/comprobante`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setReceipt(data.turno); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [current, screen, conversation?.presupuestos?.find((item: any) => item.estado === "reservado")?.turno_id, api, prefix]);
  const act = async (action: () => Promise<void>) => {
    if (lock.current) return; const origin = current; lock.current = true; setBusy(true); setError("");
    try { await action(); if (activeThread.current === origin) { await refreshInbox(); await refreshThread(); } }
    catch (failure: any) { if (activeThread.current === origin) setError(failure.message || "No pudimos completar la operación."); }
    finally { lock.current = false; setBusy(false); }
  };
  const activeQuote = conversation?.presupuestos?.find((item: any) => item.estado !== "reemplazado"), presented = quotePresentation(activeQuote, conversation?.consulta.titulo);
  const quoteExpired = activeQuote && Date.parse(activeQuote.vence_at) <= Date.now(), participant = conversation?.interlocutor || { nombre: "", foto_url: "" }, mine = business ? "negocio" : "cliente", canEdit = business && conversation?.consulta.estado === "abierta";
  const setField = (name: keyof Draft, value: string) => setDraft(previous => ({ ...previous, [name]: value }));
  const field = (name: keyof Draft) => ({ value: draft[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setField(name, event.target.value) });
  const enterEditor = () => {
    if (!canEdit) { setScreen("quote"); return; }
    setDraft({ servicio: activeQuote ? presented.service : conversation.servicio?.nombre || conversation.consulta.titulo, detalle: activeQuote ? presented.observation : "", total: activeQuote ? String(activeQuote.total) : "", sena: activeQuote ? String(activeQuote.sena) : "0", duracion: String(activeQuote?.duracion || conversation.servicio?.duracion || 60), equipo_id: activeQuote?.equipo_id || (members.length === 1 ? members[0].id : ""), fecha: activeQuote?.fecha || "", hora: activeQuote?.hora?.slice(0, 5) || "", vence_at: "" });
    setScreen("edit"); setError(""); setAttachmentsOpen(false);
  };
  const send = (event: React.FormEvent) => { event.preventDefault(); if (text.trim()) void act(async () => { await post(`${prefix}/${current}/mensajes`, { texto: text.trim() }); if (activeThread.current === current) { setText(""); stickBottom.current = true; } }); };
  const upload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; setAttachmentsOpen(false); if (!file) return;
    if (file.size > 2097152 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Elegí una foto JPG, PNG o WebP de hasta 2 MB."); return; }
    void act(async () => { const body = new FormData(); body.append("referencia", file); await api(`${prefix}/${current}/referencias`, { method: "POST", body }); stickBottom.current = true; });
  };
  const submitQuote = (event: React.FormEvent) => { event.preventDefault(); void act(async () => {
    const member = draft.equipo_id || (members.length === 1 ? members[0].id : ""); if (!member) throw new Error("Elegí el profesional que va a realizar el servicio.");
    const expires = draft.vence_at ? new Date(`${draft.vence_at}:00-03:00`).toISOString() : defaultQuoteExpiry(draft.fecha, draft.hora); if (!expires) throw new Error("Elegí un día y horario futuros.");
    await post(`${prefix}/${current}/presupuestos`, { ...draft, equipo_id: member, vence_at: expires }); if (activeThread.current === current) { setScreen("chat"); stickBottom.current = true; }
  }); };
  const older = () => void act(async () => {
    if (!scrollArea.current) return; const position = { top: scrollArea.current.scrollTop, height: scrollArea.current.scrollHeight };
    const data = await api(`${prefix}/${current}?before=${conversation.anterior}`); if (activeThread.current !== current) return;
    pendingScroll.current = position; setConversation((previous: any) => ({ ...previous, anterior: data.anterior, mensajes: mergeMessages(data.mensajes, previous.mensajes), historyLoaded: true }));
  });
  const payQuote = () => void act(async () => {
    const data = await post(`${prefix}/${current}/pagar`, { presupuesto_id: activeQuote.id });
    const url = new URL(data.payment_url);
    if (url.protocol !== "https:" || !/(^|\.)mercadopago\.(com|com\.ar)$/.test(url.hostname)) throw Error("No pudimos abrir un enlace de pago seguro.");
    window.location.assign(url.href);
  });
  return <main className={`consultations ${current ? "consultations-thread" : "consultations-inbox"}`}><ChatHeader business={business} />
    {!token ? <div className="chat-empty"><p>Iniciá sesión para ver tus mensajes.</p><Link to={`/login?${new URLSearchParams({ tipo: "usuario", volver: `/consultas${window.location.search}` })}`}>Iniciar sesión</Link></div> : !current ? <>
      <section className="chat-inbox" aria-labelledby="chat-inbox-title"><h1 id="chat-inbox-title">Mensajes</h1>
        {error && <div className="chat-error" role="alert">{error}<button onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
        {loading && !inbox.length && <p className="chat-empty" role="status">Cargando mensajes…</p>}
        {!loading && !inbox.length && !error && <p className="chat-empty">Todavía no tenés mensajes. Tus consultas van a aparecer acá.</p>}
        <div className="chat-inbox-list">{inbox.map(item => <button className={`chat-inbox-item${Number(item.no_leidos) > 0 ? " unread" : ""}`} key={item.id} onClick={() => setParams({ id: item.id })} aria-label={`${item.interlocutor_nombre || item.slug}: ${messagePreview(item, business)}${Number(item.no_leidos) > 0 ? ", mensajes sin leer" : ""}`}><ChatAvatar name={item.interlocutor_nombre || item.slug} src={item.foto_url} /><span className="chat-inbox-copy"><strong>{item.interlocutor_nombre || item.slug}</strong><span>{messagePreview(item, business)}</span></span>{Number(item.no_leidos) > 0 && <span className="chat-unread-dot" aria-hidden="true" />}</button>)}</div>
      </section><ChatBottomNav business={business} />
    </> : <section className="chat-thread" aria-label="Conversación">
      <header className="chat-person"><ChatAvatar name={participant.nombre || "?"} src={participant.foto_url} /><h1>{participant.nombre || "Cargando…"}</h1><div className="chat-person-actions">{business && conversation && <button className={`chat-tool${screen === "edit" ? " selected" : ""}`} type="button" disabled={busy} aria-label={screen === "edit" ? "Cerrar editor de presupuesto" : canEdit ? "Armar presupuesto" : "Ver presupuesto"} aria-pressed={screen === "edit"} onClick={() => screen === "edit" ? setScreen("chat") : enterEditor()}><ChatIcon name="tool" /></button>}<button className="chat-back" type="button" disabled={busy} aria-label={screen === "chat" ? "Volver a mensajes" : "Volver al chat"} onClick={() => { if (screen === "chat") setParams({}); else { setScreen("chat"); setError(""); } }}><ChatIcon name="back" /></button></div></header>
      {error && <div className="chat-error" role="alert">{error}<button onClick={() => setRevision(value => value + 1)}>Reintentar</button></div>}
      {loading && !conversation && <p role="status" className="chat-empty">Cargando conversación…</p>}
      {conversation && screen === "chat" && <>
        {activeQuote && <div className="chat-quote-strip"><strong>{presented.service}</strong><button type="button" className={business && canEdit ? "provider" : ""} disabled={busy} onClick={() => business && canEdit ? enterEditor() : setScreen("quote")}>{business && canEdit ? "Editar Presupuesto" : "Ver Presupuesto"}</button></div>}
        <div className="chat-messages" ref={scrollArea} role="log" aria-label="Mensajes de la conversación" aria-relevant="additions" onScroll={() => { if (scrollArea.current) stickBottom.current = scrollArea.current.scrollHeight - scrollArea.current.scrollTop - scrollArea.current.clientHeight < 120; }}>
          {conversation.anterior && <button className="chat-history" disabled={busy} onClick={older}>Ver mensajes anteriores</button>}
          {!conversation.mensajes.length && <p className="chat-empty">Contá qué te gustaría hacer y compartí tus referencias.</p>}
          {conversation.mensajes.map((message: any) => <article className={`chat-bubble ${message.autor === mine ? "mine" : "theirs"}${message.referencia_url ? " chat-photo-bubble" : ""}`} key={message.id} aria-label={`${message.autor === mine ? "Vos" : participant.nombre}, ${new Date(message.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`}>
            {message.texto && <p>{message.texto}</p>}{message.referencia_url && <button className="chat-reference" type="button" aria-label="Ampliar foto de referencia" onClick={() => setReference(message.referencia_url)}><img src={message.referencia_url} alt="Foto de referencia compartida" loading="lazy" onLoad={() => { if (stickBottom.current && scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight; }} /></button>}
          </article>)}
        </div>
        {conversation.consulta.estado !== "cerrada" ? <div className="chat-compose-area">{attachmentsOpen && <div className="chat-attachment-menu"><button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><ChatIcon name="photo" />Agregar foto de referencia</button><small>JPG, PNG o WebP · Hasta 2 MB</small></div>}<form className="chat-composer" onSubmit={send}><button className="chat-attach" type="button" aria-label="Adjuntar referencia" aria-expanded={attachmentsOpen} disabled={busy || conversation.consulta.estado !== "abierta"} onClick={() => setAttachmentsOpen(value => !value)}><ChatIcon name="plus" size={25} /></button><textarea ref={composer} rows={1} aria-label="Escribí un mensaje" placeholder="Escribe aquí" maxLength={3000} value={text} onChange={event => setText(event.target.value)} disabled={busy} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) { event.preventDefault(); send(event); } }} /><button className="chat-send" type="submit" aria-label="Enviar mensaje" disabled={busy || !text.trim()}><ChatIcon name="send" size={28} /></button><input className="chat-file-input" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-label="Elegir foto de referencia" onChange={upload} /></form></div> : <p className="chat-closed">Esta consulta está cerrada.</p>}
      </>}
      {conversation && screen === "edit" && <div className="chat-quote-scroll"><form className="chat-quote-form" onSubmit={submitQuote}>
        <label className="chat-quote-field">Servicio<input required minLength={2} maxLength={120} autoComplete="off" {...field("servicio")} /></label>
        <div className="chat-quote-row"><label className="chat-quote-field">Día<input required type="date" {...field("fecha")} onInput={event => setField("fecha", event.currentTarget.value)} /></label><label className="chat-quote-field">Hora<input required type="time" {...field("hora")} onInput={event => setField("hora", event.currentTarget.value)} /></label></div>
        <label className="chat-quote-field">Precio<span className="chat-price-input"><span aria-hidden="true">$</span><input required type="number" min="0.01" max="100000000" step="0.01" inputMode="decimal" aria-label="Precio" {...field("total")} /></span></label>
        <label className="chat-quote-field">Observación<textarea maxLength={2200} {...field("detalle")} /></label>
        {memberError && <p role="alert" className="chat-error">{memberError}</p>}
        {members.length > 1 && <label className="chat-quote-field">Profesional<select required {...field("equipo_id")}><option value="">Elegí un profesional</option>{members.map(member => <option key={member.id} value={member.id}>{member.nombre} {member.apellido || ""}</option>)}</select></label>}
        <button className="chat-quote-submit" disabled={busy || !members.length || !!memberError}>{busy ? "Enviando…" : "Enviar Presupuesto"}</button>
        <details className="chat-quote-options"><summary>Opciones del presupuesto</summary><label className="chat-quote-field">Seña ($)<input type="number" min="0" step="0.01" {...field("sena")} /></label><label className="chat-quote-field">Duración (minutos)<input type="number" min="5" max="720" {...field("duracion")} /></label><label className="chat-quote-field">Vencimiento (hora de Argentina)<input type="datetime-local" {...field("vence_at")} onInput={event => setField("vence_at", event.currentTarget.value)} /></label></details>
      </form></div>}
{conversation && screen === "quote" && activeQuote && <div className="chat-quote-scroll"><section className="chat-quote-view" aria-label="Detalle del presupuesto"><h2>Presupuesto</h2><dl><dt>Servicio</dt><dd>{presented.service}</dd><div className="chat-quote-row"><div><dt>Día</dt><dd>{activeQuote.fecha.split("-").reverse().join("/")}</dd></div><div><dt>Hora</dt><dd>{activeQuote.hora.slice(0, 5)}</dd></div></div><dt>Precio</dt><dd>{money(activeQuote.total)}</dd>{Number(activeQuote.sena) > 0 && <><dt>Seña acordada</dt><dd>{money(activeQuote.sena)}</dd></>}<dt>Observación</dt><dd className="chat-quote-observation">{presented.observation || "Sin observaciones adicionales."}</dd></dl><p className="chat-quote-note">{activeQuote.estado === "reservado" ? "Turno reservado. La confirmación de la reserva no acredita un pago." : quoteExpired ? "Este presupuesto venció. Pedí una nueva propuesta." : activeQuote.estado === "aceptado" ? "Presupuesto aceptado. El horario se verifica nuevamente al confirmar la reserva." : "Aceptar no realiza un cobro ni bloquea el horario."}</p>{!business && activeQuote.estado === "propuesto" && !quoteExpired && <button className="chat-quote-submit" disabled={busy} onClick={() => act(async () => { await post(`${prefix}/${current}/aceptar`, { presupuesto_id: activeQuote.id }); })}>Aceptar Presupuesto</button>}{business && activeQuote.estado === "aceptado" && !quoteExpired && <button className="chat-quote-submit" disabled={busy} onClick={() => act(async () => { await post(`${prefix}/${current}/reservar`, { presupuesto_id: activeQuote.id }); })}>Marcar como reservado</button>}{!business && conversation.pago_online && activeQuote.estado === "aceptado" && !quoteExpired && !conversation.pagos?.length && <button className="chat-quote-submit" disabled={busy} onClick={payQuote}>{Number(activeQuote.sena) > 0 ? "Pagar seña" : "Pagar presupuesto"}</button>}{conversation.pagos?.map((payment: any, index: number) => <p className="chat-quote-note" role="status" key={index}>{payment.estado === "reintegro_pendiente" ? "No pudimos confirmar ese horario. El reintegro automático está pendiente; no vuelvas a pagar." : payment.estado === "reintegrado" ? "Pago reintegrado. Coordiná una nueva propuesta por chat." : "Pago acreditado y reserva confirmada."}</p>)}{receipt && <BookingReceipt turno={receipt} />}</section></div>}
    </section>}
    <dialog className="chat-reference-dialog" ref={referenceDialog} onCancel={() => setReference("")} onClose={() => setReference("")}><button type="button" className="chat-reference-close" aria-label="Cerrar foto" onClick={() => { referenceDialog.current?.close(); setReference(""); }}><ChatIcon name="close" /></button>{reference && <img src={reference} alt="Foto de referencia ampliada" />}</dialog>
  </main>;
}
