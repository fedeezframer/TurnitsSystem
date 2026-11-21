import * as React from "react";
import { createPortal } from "react-dom";
import "./BranchMap.css";
import localidades from "../generated/argentina-localidades.json";

const LocationPicker = React.lazy(() => import("./BranchMap").then((m) => ({ default: m.LocationPicker })));
const citiesByProvince = localidades as Record<string, string[]>;
const provinces = Object.keys(citiesByProvince);
export type LocationValue = { direccion: string; latitud: number | null; longitud: number | null };
type Fields = { calle: string; ciudad: string; provincia: string };
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const fullAddress = (f: Fields) => [f.calle, f.ciudad, f.provincia].filter(Boolean).join(", ");
function splitAddress(value: string): Fields {
  const province = provinces.find((option) => value.endsWith(`, ${option}`));
  if (province) {
    const rest = value.slice(0, -province.length - 2);
    const boundary = rest.lastIndexOf(", ");
    if (boundary >= 0) return { calle: rest.slice(0, boundary), ciudad: rest.slice(boundary + 2), provincia: province };
  }
  const parts = value.split(",").map((part) => part.trim());
  return parts.length >= 3
    ? { calle: parts.slice(0, -2).join(", "), ciudad: parts.at(-2) || "", provincia: parts.at(-1) || "" }
    : { calle: value, ciudad: "", provincia: "" };
}

function SearchSelect({ label, value, options, disabled, onChange }: {
  label: string; value: string; options: string[]; disabled: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false), [query, setQuery] = React.useState("");
  const [position, setPosition] = React.useState<React.CSSProperties>({});
  const root = React.useRef<HTMLDivElement>(null), popover = React.useRef<HTMLDivElement>(null), search = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  React.useEffect(() => {
    if (!open) return;
    search.current?.focus({ preventScroll: true });
    const place = () => {
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(Math.max(box.width, 280), window.innerWidth - 24);
      setPosition({ position: "fixed", width, left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)), top: Math.max(12, Math.min(box.bottom + 6, window.innerHeight - 260)), zIndex: 10050 });
    };
    place();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !popover.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { document.removeEventListener("pointerdown", outside); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  const visible = options.filter((option) => normalize(option).includes(normalize(query))).slice(0, 80);
  return <div className="tn-search-select" ref={root}>
    <span className="tn-search-label">{label}</span>
    <button type="button" className="tn-search-trigger" disabled={disabled} aria-expanded={open} aria-controls={listId}
      onClick={() => { setQuery(""); setOpen(!open); }}>
      <span className={value ? "" : "tn-search-placeholder"}>{value || `Seleccionar ${label.toLowerCase()}`}</span>
    </button>
    {open && createPortal(<div className="tn-search-popover" id={listId} ref={popover} style={position}>
      <input ref={search} aria-label={`Buscar ${label.toLowerCase()}`} placeholder={`Buscar ${label.toLowerCase()}…`}
        value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
      <div className="tn-search-options" role="listbox" aria-label={label}>
        {visible.length ? visible.map((option) => <button type="button" role="option" aria-selected={option === value} key={option}
          onClick={() => { onChange(option); setOpen(false); }}>{option}</button>) : <p>No hay resultados.</p>}
      </div>
    </div>, document.body)}
  </div>;
}

export function LocationEditor({ value, onChange, disabled = false }: {
  value: LocationValue; onChange: (value: LocationValue) => void; disabled?: boolean;
}) {
  const [fields, setFields] = React.useState(() => splitAddress(value.direccion));
  const [status, setStatus] = React.useState("");
  const lookupId = React.useRef(0), timer = React.useRef<ReturnType<typeof setTimeout> | null>(null), valueRef = React.useRef(value);
  valueRef.current = value;
  React.useEffect(() => () => { lookupId.current++; if (timer.current) clearTimeout(timer.current); }, []);
  async function searchAddress(next: Fields) {
    if (!next.calle.trim() || !next.ciudad || !next.provincia || disabled) return;
    const current = ++lookupId.current;
    setStatus("Buscando la dirección…");
    try {
      const query = new URLSearchParams({ q: `${fullAddress(next)}, Argentina`, format: "jsonv2", limit: "1" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, { referrerPolicy: "strict-origin-when-cross-origin" });
      if (!response.ok) throw new Error();
      const [place] = await response.json();
      if (current !== lookupId.current) return;
      const latitud = Number(place?.lat), longitud = Number(place?.lon);
      if (!place || !Number.isFinite(latitud) || !Number.isFinite(longitud)) {
        setStatus("No encontramos esa calle. Podés marcar el punto o usar tu ubicación."); return;
      }
      onChange({ direccion: fullAddress(next), latitud, longitud });
      setStatus("Punto ubicado. Revisalo en el mapa.");
    } catch { if (current === lookupId.current) setStatus("No pudimos buscar la calle. Podés marcar el punto en el mapa."); }
  }
  function scheduleSearch(next: Fields) {
    if (timer.current) clearTimeout(timer.current);
    if (next.calle.trim() && next.ciudad && next.provincia)
      timer.current = setTimeout(() => void searchAddress(next), 1100);
  }
  function updateField(key: keyof Fields, text: string) {
    lookupId.current++;
    const next = { ...fields, [key]: text };
    if (key === "provincia") next.ciudad = "";
    setFields(next); setStatus("");
    onChange({ direccion: fullAddress(next), latitud: null, longitud: null });
    if (key !== "calle") scheduleSearch(next);
  }
  async function selectPoint(point: { latitud: number; longitud: number } | null) {
    if (timer.current) clearTimeout(timer.current);
    const current = ++lookupId.current;
    onChange({ ...valueRef.current, latitud: point?.latitud ?? null, longitud: point?.longitud ?? null });
    if (!point) { setStatus(""); return; }
    setStatus("Buscando la calle…");
    try {
      const query = new URLSearchParams({ lat: String(point.latitud), lon: String(point.longitud), format: "jsonv2", zoom: "18", addressdetails: "1" });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, { referrerPolicy: "strict-origin-when-cross-origin" });
      if (!response.ok) throw new Error();
      const place = await response.json();
      if (current !== lookupId.current) return;
      const address = place.address || {};
      const road = address.road || address.pedestrian || address.residential;
      if (!road) { setStatus("Punto marcado. Completá la calle manualmente."); return; }
      const province = provinces.find((option) => normalize(option) === normalize(address.state || "")) || fields.provincia;
      const city = (citiesByProvince[province] || []).find((option) => normalize(option) === normalize(address.city || address.town || address.village || "")) || fields.ciudad;
      const next = { calle: [road, address.house_number].filter(Boolean).join(" "), ciudad: city, provincia: province };
      setFields(next); onChange({ ...point, direccion: fullAddress(next) });
      setStatus("Dirección sugerida. Revisala antes de guardar.");
    } catch { if (current === lookupId.current) setStatus("Punto marcado. Completá la calle manualmente."); }
  }
  return <div className="tn-address-editor">
    <div className="tn-address-fields">
      <SearchSelect label="Provincia" value={fields.provincia} options={provinces} disabled={disabled} onChange={(text) => updateField("provincia", text)} />
      <SearchSelect label="Ciudad" value={fields.ciudad} options={citiesByProvince[fields.provincia] || []} disabled={disabled || !fields.provincia} onChange={(text) => updateField("ciudad", text)} />
      <label className="negocio-field">Calle y número
        <input value={fields.calle} maxLength={80} disabled={disabled} placeholder="Ej.: San Martín 123"
          onChange={(e) => updateField("calle", e.target.value)} onBlur={() => scheduleSearch(fields)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scheduleSearch(fields); } }} />
      </label>
    </div>
    <React.Suspense fallback={<p className="tn-map-note">Cargando mapa…</p>}>
      <LocationPicker latitud={value.latitud} longitud={value.longitud} onChange={selectPoint} disabled={disabled} />
    </React.Suspense>
    {status && <p className="tn-map-note" role="status">{status}</p>}
  </div>;
}
