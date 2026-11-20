import * as React from "react";
const LocationPicker = React.lazy(() => import("./BranchMap").then((module) => ({ default: module.LocationPicker })));

export type LocationValue = {
  direccion: string;
  latitud: number | null;
  longitud: number | null;
};

function splitAddress(value: string) {
  const parts = value.split(",").map((part) => part.trim());
  return parts.length >= 3
    ? { direccion: parts.slice(0, -2).join(", "), ciudad: parts.at(-2) || "", provincia: parts.at(-1) || "" }
    : { direccion: value, ciudad: "", provincia: "" };
}

function fullAddress(fields: { direccion: string; ciudad: string; provincia: string }) {
  return [fields.direccion, fields.ciudad, fields.provincia].filter(Boolean).join(", ");
}

export function LocationEditor({ value, onChange, disabled = false }: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  disabled?: boolean;
}) {
  const [fields, setFields] = React.useState(() => splitAddress(value.direccion));
  const [status, setStatus] = React.useState("");
  const lookupId = React.useRef(0);
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  React.useEffect(() => () => { lookupId.current++; if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  function updateField(key: keyof typeof fields, text: string) {
    lookupId.current++;
    const next = { ...fields, [key]: text };
    setFields(next);
    setStatus("");
    onChange({ direccion: fullAddress(next), latitud: null, longitud: null });
  }

  async function searchAddress() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const queryText = fullAddress(fields);
    if (!fields.direccion.trim() || !fields.ciudad.trim() || !fields.provincia.trim() || disabled) {
      setStatus("Completá dirección, ciudad y provincia para ubicar el punto.");
      return;
    }
    const current = ++lookupId.current;
    setStatus("Buscando dirección…");
    try {
      const query = new URLSearchParams({ q: `${queryText}, Argentina`, format: "jsonv2", limit: "1" });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, { referrerPolicy: "strict-origin-when-cross-origin" });
      if (!response.ok) throw new Error();
      const [place] = await response.json();
      if (current !== lookupId.current) return;
      const latitud = Number(place?.lat), longitud = Number(place?.lon);
      if (!place || !Number.isFinite(latitud) || !Number.isFinite(longitud)) {
        setStatus("No encontramos esa dirección. Marcá el punto en el mapa.");
        return;
      }
      onChange({ ...valueRef.current, direccion: queryText, latitud, longitud });
      setStatus("Punto ubicado. Revisalo antes de guardar.");
    } catch { if (current === lookupId.current) setStatus("No pudimos buscar la dirección. Marcá el punto manualmente."); }
  }
  function scheduleSearch() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (fields.direccion.trim() && fields.ciudad.trim() && fields.provincia.trim())
      searchTimer.current = setTimeout(() => void searchAddress(), 900);
  }

  async function selectPoint(point: { latitud: number; longitud: number } | null) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const current = ++lookupId.current;
    onChange({ ...valueRef.current, latitud: point?.latitud ?? null, longitud: point?.longitud ?? null });
    if (!point) { setStatus(""); return; }
    setStatus("Buscando calle…");
    try {
      const query = new URLSearchParams({ lat: String(point.latitud), lon: String(point.longitud), format: "jsonv2", zoom: "18", addressdetails: "1" });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, { referrerPolicy: "strict-origin-when-cross-origin" });
      if (!response.ok) throw new Error();
      const place = await response.json();
      if (current !== lookupId.current) return;
      const address = place.address || {};
      const road = address.road || address.pedestrian || address.residential;
      if (!road) { setStatus("Punto marcado. Completá la dirección manualmente."); return; }
      const next = {
        direccion: [road, address.house_number].filter(Boolean).join(" "),
        ciudad: address.city || address.town || address.village || fields.ciudad,
        provincia: address.state || fields.provincia,
      };
      setFields(next);
      onChange({ ...valueRef.current, ...point, direccion: fullAddress(next) });
      setStatus("Dirección sugerida. Revisala antes de guardar.");
    } catch { if (current === lookupId.current) setStatus("Punto marcado. Completá la dirección manualmente."); }
  }

  return <div className="tn-address-editor">
    <div className="tn-address-fields">
      {([ ["provincia", "Provincia"], ["ciudad", "Ciudad"], ["direccion", "Dirección y altura"] ] as const).map(([key, label]) =>
        <label className="negocio-field" key={key}>{label}
          <input value={fields[key]} maxLength={key === "direccion" ? 80 : 50} disabled={disabled}
            placeholder={key === "direccion" ? "Calle y número" : label}
            onChange={(e) => updateField(key, e.target.value)} onBlur={scheduleSearch}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void searchAddress(); } }} />
        </label>) }
    </div>
    <button type="button" className="tn-location-button tn-address-search" disabled={disabled} onClick={() => void searchAddress()}>Ubicar dirección en el mapa</button>
    <React.Suspense fallback={<p className="tn-map-note">Cargando mapa…</p>}>
      <LocationPicker latitud={value.latitud} longitud={value.longitud} onChange={selectPoint} disabled={disabled} />
    </React.Suspense>
    {status && <p className="tn-map-note" role="status">{status}</p>}
  </div>;
}
