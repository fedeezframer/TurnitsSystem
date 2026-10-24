import * as React from "react";
import { useNavigate } from "react-router";
import { appConfig } from "../config";
import { consumerHeaders } from "../shared/consumer-session";
import { saveGuestConsultationSession } from "../shared/guest-consultation-session.js";
import "./QuoteAvailability.css";

const PHONE_COUNTRIES = [
  { code: "AR", dial: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "UY", dial: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "CL", dial: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "PY", dial: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "BO", dial: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "PE", dial: "+51", flag: "🇵🇪", name: "Perú" },
  { code: "CO", dial: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "México" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "España" },
];

const flagUrl = (code: string) => `https://flagcdn.com/${code.toLowerCase()}.svg`;

const validColor = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value)
    ? value
    : fallback;

export default function QuoteAvailability({ slug, business }: { slug: string; business: any }) {
  const navigate = useNavigate();
  const initialService = new URLSearchParams(location.search).get("servicio_id") || "";
  const [services, setServices] = React.useState<any[]>([]);
  const [service, setService] = React.useState(initialService);
  const [countryCode, setCountryCode] = React.useState("AR");
  const [countryDropdownOpen, setCountryDropdownOpen] = React.useState(false);
  const countryControl = React.useRef<HTMLDivElement>(null);
  const [contact, setContact] = React.useState({ nombre: "", apellido: "", email: "", telefono: "" });
  const [loadingServices, setLoadingServices] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  const consumerAuthorization = consumerHeaders().Authorization;
  const country = PHONE_COUNTRIES.find((item) => item.code === countryCode) || PHONE_COUNTRIES[0];
  const phoneDigits = contact.telefono.replace(/\D/g, "");
  const validContact =
    contact.nombre.trim().length >= 2 && contact.nombre.trim().length <= 80 &&
    contact.apellido.trim().length >= 2 && contact.apellido.trim().length <= 80 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) &&
    phoneDigits.length >= 7 && phoneDigits.length + country.dial.replace(/\D/g, "").length <= 15;
  const canContinue = validContact && Boolean(service) && !loadingServices;
  const theme = business.tema || {};
  React.useEffect(() => {
    if (!countryDropdownOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!countryControl.current?.contains(event.target as Node)) setCountryDropdownOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [countryDropdownOpen]);
  const pageStyle = {
    "--quote-background": validColor(theme.fondo, "#f8f9fa"),
    "--quote-text": validColor(theme.texto, "#171916"),
    "--quote-primary": validColor(theme.primario, "#000000"),
    "--quote-muted": validColor(theme.secundario, "#817e7b"),
  } as React.CSSProperties;

  React.useEffect(() => {
    const previous = document.title;
    document.title = `Comenzá tu consulta | ${business.business_name} | Turnits`;
    return () => { document.title = previous; };
  }, [business.business_name]);

  React.useEffect(() => {
    const controller = new AbortController();
    setError("");
    setServices([]);
    setService("");
    setLoadingServices(true);
    fetch(`${appConfig.apiUrl}/servicios/${encodeURIComponent(slug)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error("No pudimos cargar los servicios.");
        if (controller.signal.aborted) return;
        const available = data.servicios || [];
        setServices(available);
        setService(available.some((item: any) => item.id === initialService) ? initialService : available[0]?.id || "");
      })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingServices(false); });
    return () => controller.abort();
  }, [slug, initialService, retry]);

  React.useEffect(() => {
    if (!consumerAuthorization) return;
    const controller = new AbortController();
    fetch(`${appConfig.apiUrl}/browse/identidad`, {
      headers: { Authorization: consumerAuthorization },
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success || controller.signal.aborted) return;
      const profile = data.perfil || {};
      setContact({
        nombre: profile.nombre_persona || "",
        apellido: profile.apellido || "",
        email: profile.email || "",
        telefono: String(profile.telefono || "").replace(/\D/g, ""),
      });
      const storedPhone = String(profile.telefono || "").replace(/\D/g, "");
      const match = PHONE_COUNTRIES.slice().sort((first, second) => second.dial.length - first.dial.length)
        .find((item) => storedPhone.startsWith(item.dial.replace(/\D/g, "")));
      if (match) {
        setCountryCode(match.code);
        setContact((previous) => ({ ...previous, telefono: storedPhone.slice(match.dial.replace(/\D/g, "").length) }));
      }
    }).catch(() => {});
    return () => controller.abort();
  }, [consumerAuthorization]);

  async function openChat(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue || busy) return;
    setError("");
    if (!consumerAuthorization) {
      setBusy(true);
      try {
        const response = await fetch(`${appConfig.apiUrl}/browse/consultas/invitado`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            servicio_id: service,
            nombre: contact.nombre.trim(),
            apellido: contact.apellido.trim(),
            email: contact.email.trim().toLowerCase(),
            telefono: `${country.dial}${phoneDigits}`,
          }),
          cache: "no-store",
        });
        const consultation = await response.json().catch(() => null);
        if (!response.ok || !consultation?.success) throw new Error(consultation?.error || "No pudimos abrir el chat.");
        saveGuestConsultationSession(consultation.id, consultation.guest_token, consultation.guest_expires_at);
        navigate(`/browse?${new URLSearchParams({ vista: "mensajes", id: consultation.id })}`);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "No pudimos abrir el chat. Volvé a intentar.");
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${appConfig.apiUrl}/browse/perfil`, {
        method: "PUT",
        headers: { Authorization: consumerAuthorization, "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_persona: contact.nombre.trim(),
          apellido: contact.apellido.trim(),
          telefono: `${country.dial}${phoneDigits}`,
        }),
        cache: "no-store",
      });
      const profile = await response.json().catch(() => null);
      if (!response.ok || !profile?.success) throw new Error(profile?.error || "No pudimos guardar tus datos.");
      const consultationResponse = await fetch(`${appConfig.apiUrl}/browse/consultas`, {
        method: "POST",
        headers: { Authorization: consumerAuthorization, "Content-Type": "application/json" },
        body: JSON.stringify({ servicio_id: service }),
        cache: "no-store",
      });
      const consultation = await consultationResponse.json().catch(() => null);
      if (!consultationResponse.ok || !consultation?.success) throw new Error(consultation?.error || "No pudimos abrir el chat.");
      navigate(`/browse?${new URLSearchParams({ vista: "mensajes", id: consultation.id })}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No pudimos abrir el chat. Volvé a intentar.");
      setBusy(false);
    }
  }

  return <main className="quote-availability" style={pageStyle}>
    <header className="quote-availability-brand">
      {business.logo_url && <img src={business.logo_url} alt="" />}
      <span>{business.business_name}</span>
    </header>
    <section className="quote-availability-content" aria-labelledby="quote-title">
      <h1 id="quote-title">Comenzá tu consulta</h1>
      <form onSubmit={openChat} noValidate>
        <p className="quote-availability-label">Tus datos</p>
        <div className="quote-availability-name-row">
          <label><span className="quote-availability-sr-only">Nombre</span><input autoComplete="given-name" maxLength={80} placeholder="Nombre" value={contact.nombre} onChange={(event) => setContact({ ...contact, nombre: event.target.value })} /></label>
          <label><span className="quote-availability-sr-only">Apellido</span><input autoComplete="family-name" maxLength={80} placeholder="Apellido" value={contact.apellido} onChange={(event) => setContact({ ...contact, apellido: event.target.value })} /></label>
        </div>
        <label><span className="quote-availability-sr-only">Email</span><input autoComplete="email" inputMode="email" maxLength={254} placeholder="Email" readOnly={Boolean(consumerAuthorization && contact.email)} type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} /></label>
        <div className="quote-availability-phone" ref={countryControl}>
          <div className="quote-availability-country">
            <button type="button" className="quote-availability-country-button" aria-label={`País: ${country.name}`} aria-expanded={countryDropdownOpen} onClick={() => setCountryDropdownOpen((open) => !open)}>
              <img src={flagUrl(country.code)} alt={country.code} />
              <span aria-hidden="true">▾</span>
            </button>
            {countryDropdownOpen && <div className="quote-availability-country-menu" role="listbox" aria-label="Elegí tu país">
              {PHONE_COUNTRIES.map((item) => <button type="button" role="option" aria-selected={countryCode === item.code} key={item.code} onClick={() => { setCountryCode(item.code); setCountryDropdownOpen(false); }}>
                <img src={flagUrl(item.code)} alt="" /><span>{item.name}</span><span>{item.dial}</span>
              </button>)}
            </div>}
          </div>
          <label className="quote-availability-phone-number"><span className="quote-availability-sr-only">Número de teléfono</span><input autoComplete="tel-national" inputMode="tel" maxLength={20} placeholder="Número de teléfono" type="tel" value={contact.telefono} onChange={(event) => setContact({ ...contact, telefono: event.target.value })} /></label>
        </div>
        {error && <p className="quote-availability-error" role="alert">{error}{!services.length && <button type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button>}</p>}
        {loadingServices && <p className="quote-availability-status" role="status">Cargando…</p>}
        {!loadingServices && !services.length && !error && <p className="quote-availability-error" role="status">Este negocio todavía no tiene servicios disponibles para consultar.</p>}
        {canContinue && <button className="quote-availability-submit" type="submit" disabled={busy}>{busy ? "Abriendo el chat…" : "Ir al Chat"}</button>}
      </form>
    </section>
  </main>;
}
