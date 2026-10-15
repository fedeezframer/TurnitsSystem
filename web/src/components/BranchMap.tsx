import * as React from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  branchesByDistance,
  validPoint,
  type GeoPoint,
} from "../shared/locations.js";
import "./BranchMap.css";

export type MapBranch = {
  id: string;
  nombre: string;
  direccion: string;
  latitud?: number | null;
  longitud?: number | null;
  equipo_ids?: string[];
  sin_equipo?: boolean;
};
type Pin = { id: string; nombre: string; latitud: number; longitud: number };
const DEFAULT_CENTER: L.LatLngTuple = [-31.4167, -64.1833];
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
function pinIcon(selected: boolean) {
  return L.divIcon({
    className: "tn-map-pin-container",
    html: `<span class="tn-map-pin ${selected ? "selected" : ""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>`,
    iconSize: [38, 46],
    iconAnchor: [19, 42],
    tooltipAnchor: [0, -35],
  });
}
export function BranchMap({
  pins,
  selected,
  onSelect,
  onPointChange,
  label = "Mapa de sucursales",
  editing = false,
}: {
  pins: Pin[];
  selected?: string;
  onSelect?: (id: string) => void;
  onPointChange?: (p: GeoPoint) => void;
  label?: string;
  editing?: boolean;
}) {
  const container = React.useRef<HTMLDivElement>(null),
    map = React.useRef<L.Map | null>(null),
    layer = React.useRef<L.LayerGroup | null>(null),
    callbacks = React.useRef({ onSelect, onPointChange });
  callbacks.current = { onSelect, onPointChange };
  const [tileError, setTileError] = React.useState(false);
  const previousFit = React.useRef("");
  React.useEffect(() => {
    if (!container.current) return;
    previousFit.current = "";
    const instance = L.map(container.current, {
      scrollWheelZoom: false,
      worldCopyJump: true,
      zoomControl: true,
    }).setView(DEFAULT_CENTER, editing ? 12 : 5);
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    let errors = 0;
    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
      referrerPolicy: "strict-origin-when-cross-origin",
      keepBuffer: 1,
    });
    tiles.on("tileerror", () => {
      if (++errors >= 3) setTileError(true);
    });
    tiles.on("tileload", () => {
      errors = 0;
      setTileError(false);
    });
    tiles.addTo(instance);
    if (editing)
      instance.on("click", (event: L.LeafletMouseEvent) =>
        callbacks.current.onPointChange?.({
          latitud: Math.max(-90, Math.min(90, event.latlng.lat)),
          longitud: ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180,
        }),
      );
    const resize = new ResizeObserver(() =>
      instance.invalidateSize({ animate: false }),
    );
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, [editing]);
  React.useEffect(() => {
    const instance = map.current,
      group = layer.current;
    if (!instance || !group) return;
    group.clearLayers();
    for (const pin of pins) {
      const marker = L.marker([pin.latitud, pin.longitud], {
        icon: pinIcon(editing || pin.id === selected),
        draggable: editing,
        keyboard: true,
        title: pin.nombre,
        alt: pin.nombre,
        riseOnHover: true,
      });
      const text = document.createElement("span");
      text.textContent = pin.nombre;
      marker.bindTooltip(text, { direction: "top" });
      if (editing)
        marker.on("dragend", () => {
          const point = marker.getLatLng();
          callbacks.current.onPointChange?.({
            latitud: Math.max(-90, Math.min(90, point.lat)),
            longitud: ((((point.lng + 180) % 360) + 360) % 360) - 180,
          });
        });
      else marker.on("click", () => callbacks.current.onSelect?.(pin.id));
      marker.addTo(group);
    }
    const fitKey = pins
      .map((p) => `${p.id}:${p.latitud}:${p.longitud}`)
      .join("|");
    if (fitKey && previousFit.current !== fitKey) {
      previousFit.current = fitKey;
      const bounds = L.latLngBounds(
        pins.map((p) => [p.latitud, p.longitud] as L.LatLngTuple),
      );
      instance.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: editing ? 16 : 14,
        animate: false,
      });
    }
    const active = pins.find((p) => p.id === selected);
    if (
      active &&
      !editing &&
      !instance.getBounds().contains([active.latitud, active.longitud])
    )
      instance.panTo([active.latitud, active.longitud]);
  }, [pins, selected, editing]);
  return (
    <div className="tn-branch-map">
      <div
        className="tn-map-surface"
        ref={container}
        role="region"
        aria-label={label}
      />
      {tileError && (
        <p className="tn-map-error" role="status">
          No pudimos cargar el fondo del mapa. Podés seguir usando la lista de
          sucursales.
        </p>
      )}
    </div>
  );
}
export function useDeviceLocation() {
  const [position, setPosition] = React.useState<GeoPoint | null>(null),
    [error, setError] = React.useState(""),
    [locating, setLocating] = React.useState(false),
    requestId = React.useRef(0);
  React.useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );
  const locate = () => {
    if (locating) return;
    if (!navigator.geolocation) {
      setError(
        "Tu navegador no permite obtener la ubicación. Podés elegir la sede manualmente.",
      );
      return;
    }
    const current = ++requestId.current;
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (current !== requestId.current) return;
        setLocating(false);
        const next = {
          latitud: p.coords.latitude,
          longitud: p.coords.longitude,
        };
        if (validPoint(next)) setPosition(next);
        else setError("No pudimos obtener una ubicación válida.");
      },
      (e) => {
        if (current !== requestId.current) return;
        setLocating(false);
        setError(
          e.code === 1
            ? "No diste permiso de ubicación. Podés elegir la sede manualmente."
            : "No pudimos obtener tu ubicación. Podés elegir la sede manualmente.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };
  return { position, error, locating, locate };
}
export function LocationPicker({
  latitud,
  longitud,
  onChange,
  disabled = false,
}: {
  latitud: number | null;
  longitud: number | null;
  onChange: (p: GeoPoint | null) => void;
  disabled?: boolean;
}) {
  const geo = useDeviceLocation(),
    change = React.useRef(onChange);
  change.current = onChange;
  const [coordinates, setCoordinates] = React.useState({
    latitud: latitud == null ? "" : String(latitud),
    longitud: longitud == null ? "" : String(longitud),
  });
  React.useEffect(() => {
    setCoordinates({
      latitud: latitud == null ? "" : String(latitud),
      longitud: longitud == null ? "" : String(longitud),
    });
  }, [latitud, longitud]);
  React.useEffect(() => {
    if (geo.position && !disabled) change.current(geo.position);
  }, [geo.position]);
  const pins = React.useMemo(
    () =>
      validPoint({ latitud, longitud })
        ? [
            {
              id: "punto",
              nombre: "Ubicación de la sucursal",
              latitud: latitud!,
              longitud: longitud!,
            },
          ]
        : [],
    [latitud, longitud],
  );
  return (
    <div className="tn-location-picker">
      <div className="tn-map-actions">
        <div>
          <strong>Ubicación en el mapa</strong>
          <p>Tocá el mapa o arrastrá el pin hasta la entrada del local.</p>
        </div>
        <button
          className="tn-location-button"
          type="button"
          disabled={disabled || geo.locating}
          onClick={geo.locate}
        >
          {geo.locating ? "Buscando…" : "Usar mi ubicación"}
        </button>
      </div>
      <div
        style={{
          pointerEvents: disabled ? "none" : undefined,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <BranchMap
          pins={pins}
          editing={!disabled}
          selected="punto"
          onPointChange={onChange}
          label="Ubicar sucursal en el mapa"
        />
      </div>
      <div className="tn-map-actions">
        <span className="tn-map-note">
          {pins.length
            ? "Ubicación marcada. Guardá la sucursal para aplicar el cambio."
            : "La dirección escrita no fija un punto automáticamente."}
        </span>
        {pins.length > 0 && (
          <button
            type="button"
            className="tn-location-button"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Quitar ubicación
          </button>
        )}
      </div>
      {geo.error && (
        <p className="tn-map-note" role="status">
          {geo.error}
        </p>
      )}
      <details className="tn-map-note">
        <summary>Ingresar coordenadas</summary>
        <div className="tn-coordinate-fields">
          {(["latitud", "longitud"] as const).map((key) => (
            <label key={key}>
              {key === "latitud" ? "Latitud" : "Longitud"}
              <input
                aria-label={
                  key === "latitud"
                    ? "Latitud de la sucursal"
                    : "Longitud de la sucursal"
                }
                type="number"
                step="any"
                disabled={disabled}
                min={key === "latitud" ? -90 : -180}
                max={key === "latitud" ? 90 : 180}
                value={coordinates[key]}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setCoordinates({ latitud: "", longitud: "" });
                    onChange(null);
                    return;
                  }
                  const next = { ...coordinates, [key]: value };
                  setCoordinates(next);
                  const point = {
                    latitud: Number(next.latitud),
                    longitud: Number(next.longitud),
                  };
                  if (
                    next.latitud !== "" &&
                    next.longitud !== "" &&
                    validPoint(point)
                  )
                    onChange(point);
                }}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
export function BranchSelection({
  branches,
  selected,
  onSelect,
  onContinue,
  accent = "#197128",
}: {
  branches: MapBranch[];
  selected: string;
  onSelect: (id: string) => void;
  onContinue: () => void;
  accent?: string;
}) {
  const geo = useDeviceLocation(),
    sorted = React.useMemo(
      () => branchesByDistance(branches, geo.position),
      [branches, geo.position],
    );
  const pins = React.useMemo(
    () =>
      branches.filter(validPoint).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        latitud: s.latitud!,
        longitud: s.longitud!,
      })),
    [branches],
  );
  const chosen = branches.find((s) => s.id === selected),
    previousLocation = React.useRef<GeoPoint | null>(null);
  React.useEffect(() => {
    if (!geo.position || previousLocation.current === geo.position) return;
    previousLocation.current = geo.position;
    const nearest = sorted.find(
      (s) => s.distancia !== null && (s.equipo_ids?.length || s.sin_equipo),
    );
    if (nearest) onSelect(nearest.id);
  }, [geo.position, sorted, onSelect]);
  return (
    <section
      className="tn-branch-selection"
      style={{ "--tn-map-accent": accent } as React.CSSProperties}
    >
      <div className="tn-map-actions">
        <p>Elegí dónde querés atenderte.</p>
        <button
          type="button"
          className="tn-location-button"
          disabled={geo.locating}
          onClick={geo.locate}
        >
          {geo.locating ? "Buscando…" : "Usar mi ubicación"}
        </button>
      </div>
      <BranchMap
        pins={pins}
        selected={selected}
        onSelect={(id) => {
          if (
            branches.find((s) => s.id === id)?.equipo_ids?.length ||
            branches.find((s) => s.id === id)?.sin_equipo
          )
            onSelect(id);
        }}
      />
      {geo.error && (
        <p className="tn-map-note" role="status">
          {geo.error}
        </p>
      )}
      <p className="tn-map-note">
        Tu ubicación se usa en este dispositivo para ordenar las sedes. Las
        distancias son aproximadas, en línea recta.
      </p>
      {!pins.length && (
        <p className="tn-map-note">
          El negocio todavía no marcó sus sedes en el mapa. Elegí una de la
          lista para continuar.
        </p>
      )}
      <div className="tn-branch-options">
        {sorted.map((s) => {
          const available = !!s.equipo_ids?.length || !!s.sin_equipo,
            nearest =
              geo.position &&
              s.distancia !== null &&
              s.id ===
                sorted.find(
                  (x) =>
                    x.distancia !== null &&
                    (x.equipo_ids?.length || x.sin_equipo),
                )?.id;
          return (
            <button
              type="button"
              key={s.id}
              className="tn-branch-option"
              aria-pressed={selected === s.id}
              disabled={!available}
              onClick={() => onSelect(s.id)}
            >
              <span className="tn-branch-option-title">
                {s.nombre}
                {selected === s.id && <span aria-hidden="true">✓</span>}
              </span>
              {s.direccion && <span>{s.direccion}</span>}
              <small>
                {!available
                  ? "Sin profesionales disponibles"
                  : s.distancia !== null
                    ? `${nearest ? "Más cercana · " : ""}${s.distancia < 1 ? `${Math.round(s.distancia * 1000)} m` : `${s.distancia.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`}`
                    : validPoint(s)
                      ? "Ubicación disponible en el mapa"
                      : "Ubicación pendiente"}
              </small>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="tn-location-continue"
        disabled={!chosen?.equipo_ids?.length && !chosen?.sin_equipo}
        onClick={onContinue}
      >
        Continuar{chosen ? ` con ${chosen.nombre}` : ""} →
      </button>
    </section>
  );
}
