import * as React from "react";
import { appConfig } from "../../config";
import { validPoint } from "../../shared/locations.js";
import type { MapBranch } from "../../components/BranchMap";
import "./perfil.css";
import "./perfil-publico.css";
const BranchMap = React.lazy(() =>
  import("../../components/BranchMap").then((m) => ({ default: m.BranchMap })),
);
function Stars() {
  return (
    <span
      className="perfil-stars"
      role="img"
      aria-label="Todavía sin puntuaciones"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z" />
        </svg>
      ))}
    </span>
  );
}
export function PerfilContenido({
  perfil,
  logo,
  bookingUrl,
  slug,
}: {
  perfil: any;
  logo?: string;
  bookingUrl?: string;
  slug?: string;
}) {
  const [locations, setLocations] = React.useState<MapBranch[]>([]),
    [mapError, setMapError] = React.useState(false),
    [mapLoading, setMapLoading] = React.useState(!!slug),
    [coverFailed, setCoverFailed] = React.useState(false);
  const cover = perfil.fotos?.[0];
  React.useEffect(() => setCoverFailed(false), [cover]);
  React.useEffect(() => {
    setLocations([]);
    setMapError(false);
    setMapLoading(!!slug);
    if (!slug) return;
    const controller = new AbortController();
    fetch(`${appConfig.apiUrl}/sucursales/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success || !Array.isArray(d.sucursales))
          throw new Error("mapa");
        if (!controller.signal.aborted)
          setLocations(d.sucursales.filter(validPoint));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setMapError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMapLoading(false);
      });
    return () => controller.abort();
  }, [slug]);
  const main = locations.find((s) => s.id === "principal") || locations[0],
    [locationId, setLocationId] = React.useState(""),
    location = locations.find((s) => s.id === locationId) || main;
  const pins = React.useMemo(
    () =>
      location
        ? [
            {
              id: location.id,
              nombre: location.nombre,
              latitud: location.latitud!,
              longitud: location.longitud!,
            },
          ]
        : [],
    [location],
  );
  const name = perfil.nombre || "Nombre del negocio",
    city = [perfil.ciudad, perfil.provincia].filter(Boolean).join(", "),
    hasDetails =
      perfil.descripcion ||
      perfil.telefono_publico ||
      perfil.instagram ||
      perfil.sitio_web ||
      perfil.fotos?.length > 1;
  return (
    <div className="perfil-publico">
      <article className="perfil-main-card" aria-label={`Perfil de ${name}`}>
        <div
          className={`perfil-cover${!cover || coverFailed ? " perfil-cover-empty" : ""}`}
        >
          {cover && !coverFailed && (
            <img
              className="perfil-cover-photo"
              src={cover}
              alt={`Portada de ${name}`}
              onError={() => setCoverFailed(true)}
            />
          )}
          <div className="perfil-cover-shade" />
          <div className="perfil-cover-brand">
            <span>{name}</span>
            {perfil.categoria && <small>{perfil.categoria}</small>}
          </div>
        </div>
        <div className="perfil-overview">
          <div className="perfil-identity">
            <p className="perfil-category">{perfil.categoria || "Negocio"}</p>
            <h1>{name}</h1>
            {city && <p className="perfil-city">{city}</p>}
            {bookingUrl ? (
              <a className="perfil-booking-link" href={bookingUrl}>
                Ver Agenda
              </a>
            ) : (
              <span className="perfil-booking-link perfil-booking-preview">
                Ver Agenda
              </span>
            )}
          </div>
          <div className="perfil-rating">
            <div className="perfil-rating-heading">
              <span>Puntuación</span>
              <Stars />
              <small>(0)</small>
            </div>
            <textarea
              aria-label="Dejar comentario — próximamente"
              placeholder="Dejar Comentario"
              disabled
              rows={3}
            />
            <span className="perfil-coming-soon">Próximamente</span>
          </div>
          <div className="perfil-location">
            <h2>Ubicación</h2>
            {locations.length > 1 && (
              <select
                aria-label="Sucursal del mapa del perfil"
                value={location?.id || ""}
                onChange={(e) => setLocationId(e.target.value)}
              >
                {locations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
            {location ? (
              <React.Suspense
                fallback={
                  <div className="perfil-map-placeholder" role="status">
                    Cargando mapa…
                  </div>
                }
              >
                <BranchMap
                  pins={pins}
                  selected={location.id}
                  compact
                  label={`Ubicación de ${location.nombre}`}
                />
              </React.Suspense>
            ) : (
              <div className="perfil-map-placeholder">
                <svg viewBox="0 0 32 42" aria-hidden="true">
                  <path d="M16 2A13 13 0 0 0 3 15c0 10 13 25 13 25s13-15 13-25A13 13 0 0 0 16 2Z" />
                  <circle cx="16" cy="15" r="4" />
                </svg>
                <span>
                  {mapLoading
                    ? "Cargando ubicación…"
                    : mapError
                      ? "No pudimos cargar la ubicación."
                      : "Ubicación no configurada"}
                </span>
              </div>
            )}
            {(location?.direccion || perfil.direccion) && (
              <p className={`perfil-address${location?' perfil-visually-hidden':''}`}>
                {location?.direccion || perfil.direccion}
              </p>
            )}
          </div>
        </div>
      </article>
      <section
        className="perfil-reviews"
        aria-labelledby="perfil-reviews-title"
      >
        <h2 id="perfil-reviews-title">Reseñas</h2>
        <p>Todavía no hay reseñas.</p>
        <span>Próximamente vas a poder compartir tu experiencia.</span>
      </section>
      {hasDetails && (
        <section className="perfil-details">
          <h2>Sobre el negocio</h2>
          {perfil.descripcion && <p>{perfil.descripcion}</p>}
          <div className="perfil-contact-links">
            {perfil.telefono_publico && (
              <a href={`tel:${perfil.telefono_publico.replace(/[^\d+]/g, "")}`}>
                Llamar
              </a>
            )}
            {perfil.instagram && (
              <a
                href={perfil.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram ↗
              </a>
            )}
            {perfil.sitio_web && (
              <a
                href={perfil.sitio_web}
                target="_blank"
                rel="noopener noreferrer"
              >
                Sitio web ↗
              </a>
            )}
          </div>
          {perfil.fotos?.length > 1 && (
            <div className="perfil-photo-gallery">
              {perfil.fotos.slice(1).map((url: string, i: number) => (
                <img
                  key={`${url}-${i}`}
                  src={url}
                  loading="lazy"
                  alt={`Foto ${i + 2} de ${name}`}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
