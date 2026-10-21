import * as React from "react";
import { appConfig } from "../config";
import { matchingSlots, timeMinutes } from "../shared/discovery.js";
import "./IntentDiscovery.css";

const localDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function IntentDiscovery({ services, renderService }: { services: any[]; renderService: (service: any) => React.ReactNode }) {
  const [query, setQuery] = React.useState("");
  const [date, setDate] = React.useState(localDay);
  const [from, setFrom] = React.useState("");
  const [until, setUntil] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [intent, setIntent] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [results, setResults] = React.useState<any[] | null>(null);
  const [summary, setSummary] = React.useState("");
  const controller = React.useRef<AbortController | null>(null);
  const version = React.useRef(0);
  React.useEffect(() => () => controller.current?.abort(), []);
  const invalidate = () => {
    version.current++;
    controller.current?.abort();
    setBusy(false); setResults(null); setError("");
  };
  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    invalidate();
    if (date < localDay() || (from && until && timeMinutes(from) >= timeMinutes(until))) {
      setError("Elegí una fecha vigente y una hora de finalización posterior a la de inicio."); return;
    }
    const request = new AbortController(); controller.current = request;
    const current = version.current;
    setBusy(true);
    const candidates = services.filter(service => normalize([service.nombre, service.negocio?.nombre, service.negocio?.categoria, service.negocio?.ciudad].join(" ")).includes(normalize(query.trim())));
    const found: any[] = [];
    let next = 0, failures = 0;
    const worker = async () => {
      while (next < candidates.length && !request.signal.aborted) {
        const service = candidates[next++];
        const members = (service.equipo || []).filter((member: any) => !budget || Number(member.precio) <= Number(budget));
        let match: any = null;
        for (const member of members) {
          if (request.signal.aborted) return;
          try {
            const params = new URLSearchParams({ fecha: date, servicio_id: service.id, equipo_id: member.id });
            const response = await fetch(`${appConfig.apiUrl}/slots-disponibles/${encodeURIComponent(service.slug)}?${params}`, { signal: request.signal, cache: "no-store" });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error();
            const slot = matchingSlots(data.slots || [], service.duracion, from, until)[0];
            if (slot && (!match || slot.hora < match.hora)) match = { ...slot, member };
          } catch {
            if (!request.signal.aborted) failures++;
          }
        }
        if (match) found.push({ ...service, precio: Number(match.member.precio), discovery: { hora: match.hora, profesional: match.member.nombre, equipo_id: match.member.id, fecha: date } });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, worker));
    if (request.signal.aborted || current !== version.current) return;
    found.sort((first, second) => first.discovery.hora.localeCompare(second.discovery.hora));
    setResults(found);
    setSummary(`Disponibilidad para el ${date.split("-").reverse().join("/")}${until ? `, terminando hasta las ${until}` : ""}`);
    setError(failures ? "No pudimos consultar todos los profesionales. Los resultados son parciales; volvé a buscar para reintentar." : "");
    setBusy(false);
  };
  return <section className="intent-discovery" aria-labelledby="intent-title">
    <div className="intent-heading"><span>Tu día, a tu manera</span><h2 id="intent-title">¿Qué te gustaría hacer?</h2><p>Encontrá un servicio que encaje con tus tiempos y tu presupuesto.</p></div>
    <div className="intent-options" aria-label="Qué buscás hoy">{["Resolver algo hoy", "Organizar una ocasión", "Probar algo nuevo"].map(option => <button key={option} type="button" aria-pressed={intent === option} onClick={() => { invalidate(); setIntent(intent === option ? "" : option); if (option === "Resolver algo hoy") setDate(localDay()); }}>{option}</button>)}</div>
    <p className="intent-hint">{intent === "Organizar una ocasión" ? "Buscá el servicio que necesitás y elegí el día en que querés atenderte." : intent === "Probar algo nuevo" ? "Podés dejar el servicio vacío para descubrir opciones disponibles." : "¿Tenés una hora límite? Buscamos turnos que terminen antes, no que recién empiecen."}</p>
    <form onSubmit={search} onChange={invalidate}>
      <label className="intent-query">¿Qué buscás?<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Servicio, negocio o ciudad" maxLength={100} /></label>
      <label>¿Qué día?<input type="date" required min={localDay()} value={date} onInput={event => { invalidate(); setDate(event.currentTarget.value); }} onChange={event => setDate(event.target.value)} /></label>
      <label>Desde las<input type="time" value={from} onInput={event => { invalidate(); setFrom(event.currentTarget.value); }} onChange={event => setFrom(event.target.value)} /></label>
      <label>Necesito terminar hasta las<input type="time" value={until} onInput={event => { invalidate(); setUntil(event.currentTarget.value); }} onChange={event => setUntil(event.target.value)} /></label>
      <label>Presupuesto máximo ($)<input type="number" min="0" step="1" value={budget} onChange={event => setBudget(event.target.value)} placeholder="Sin límite" /></label>
      <button className="intent-submit" type="submit" disabled={busy}>{busy ? "Buscando horarios…" : "Encontrar opciones para mí"}</button>
    </form>
    {busy && <button type="button" className="intent-stop" onClick={invalidate}>Detener búsqueda</button>}
    {error && <p role="alert">{error}</p>}
    <div aria-live="polite">{results && <><h3>{summary}</h3><p>{results.length ? `${results.length} servicios con horarios compatibles. La disponibilidad se confirma de nuevo al reservar.` : "No encontramos horarios compatibles. Probá otro día, ampliá el horario o cambiá tu búsqueda."}</p><div className="browse-card-grid">{results.map(service => <div key={service.id}><p className="intent-slot">{service.discovery.hora} · {service.discovery.profesional} · {service.duracion} min</p>{renderService(service)}</div>)}</div></>}</div>
  </section>;
}
