import * as React from "react";
import { Link } from "react-router";
import { appConfig } from "../../config";
import { validPoint } from "../../shared/locations.js";
import type { MapBranch } from "../../components/BranchMap";
import { enlacesPublicos } from "../../shared/socials.js";
import { SocialIcon } from "../../components/SocialIcon";
import { ProfileMapDialog } from "../../components/ProfileMapDialog";
import { ProfilePhotoDialog } from "../../components/ProfilePhotoDialog";
import { BusinessAvatar } from "../../components/BusinessAvatar";
import { FavoriteButton } from "../../components/BusinessFavorites";
import { cardRadius } from "../../shared/appearance.js";
import { consumerHeaders } from "../../shared/consumer-session";
import "./perfil.css";
import "./perfil-publico.css";
import "./perfil-publicaciones.css";
const BranchMap = React.lazy(() =>
  import("../../components/BranchMap").then((m) => ({ default: m.BranchMap })),
);
function PublicationsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <rect x="5" y="3" width="15" height="16" rx="1" />
      <path d="M2 7v15h15M7 16l4-5 3 3 2-2 2 4" />
      <circle cx="15.5" cy="7.5" r="1" />
    </svg>
  );
}
function Stars({ rating = 0, label = "Sin puntuaciones todavía" }: { rating?: number; label?: string } = {}) {
  return (
    <span
      className="perfil-stars"
      role="img"
      aria-label={label}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} className={i < Math.round(rating) ? "perfil-star-filled" : undefined} viewBox="0 0 24 24" aria-hidden="true">
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
  initialExpanded = false,
}: {
  perfil: any;
  logo?: string;
  bookingUrl?: string;
  slug?: string;
  initialExpanded?: boolean;
}) {
  const [locations, setLocations] = React.useState<MapBranch[]>([]),
    [mapError, setMapError] = React.useState(false),
    [mapLoading, setMapLoading] = React.useState(!!slug),
    [coverFailed, setCoverFailed] = React.useState(false),
    [mapOpen, setMapOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState<{ src: string; alt: string } | null>(
    null,
  );
  const [expanded, setExpanded] = React.useState(initialExpanded);
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [reviewSummary, setReviewSummary] = React.useState({ promedio: 0, cantidad: 0 });
  const [myReview, setMyReview] = React.useState<any>(null);
  const [reviewEligible, setReviewEligible] = React.useState(false);
  const [reviewLoading, setReviewLoading] = React.useState(!!slug);
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [reviewEditing, setReviewEditing] = React.useState(false);
  const [reviewRating, setReviewRating] = React.useState(5);
  const [reviewComment, setReviewComment] = React.useState("");
  const [reviewError, setReviewError] = React.useState("");
  const [reviewNotice, setReviewNotice] = React.useState("");
  const signedInConsumer = !!consumerHeaders().Authorization;
  const photos = (Array.isArray(perfil.fotos) ? perfil.fotos : []).filter((url: any) => typeof url === "string" && url);
  React.useEffect(() => setExpanded(initialExpanded), [slug, initialExpanded]);
  React.useEffect(() => {
    setReviews([]);
    setReviewSummary({ promedio: 0, cantidad: 0 });
    setMyReview(null);
    setReviewEligible(false);
    setReviewEditing(false);
    setReviewLoading(!!slug);
    setReviewError("");
    if (!slug) return;
    const controller = new AbortController();
    const base = appConfig.apiUrl;
    const encodedSlug = encodeURIComponent(slug);
    fetch(`${base}/perfil/${encodedSlug}/resenas`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "No pudimos cargar las reseñas.");
        if (!controller.signal.aborted) {
          setReviews(data.resenas || []);
          setReviewSummary({ promedio: Number(data.promedio) || 0, cantidad: Number(data.cantidad) || 0 });
        }
        const headers = consumerHeaders();
        if (!headers.Authorization) return;
        const ownResponse = await fetch(`${base}/browse/perfil/${encodedSlug}/resena`, { headers, signal: controller.signal });
        const ownData = await ownResponse.json();
        if (!ownResponse.ok || !ownData.success) throw new Error(ownData.error || "No pudimos revisar si podés reseñar este negocio.");
        if (!controller.signal.aborted) {
          setMyReview(ownData.resena || null);
          setReviewEligible(ownData.elegible === true);
          if (ownData.resena) {
            setReviewRating(Number(ownData.resena.puntuacion) || 5);
            setReviewComment(ownData.resena.comentario || "");
          }
        }
      })
      .catch(error => { if (!controller.signal.aborted) setReviewError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setReviewLoading(false); });
    return () => controller.abort();
  }, [slug]);
  const cover = perfil.banner_url;
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
    selectedLocation = locations.find((s) => s.id === locationId) || main,
    location = selectedLocation && locations.length === 1 && selectedLocation.id === "principal"
      ? { ...selectedLocation, nombre: "Local" }
      : selectedLocation;
  const pins = React.useMemo(() => locations.map((branch) => ({
    id: branch.id,
    nombre: locations.length === 1 && branch.id === "principal" ? "Local" : branch.nombre,
    latitud: branch.latitud!,
    longitud: branch.longitud!,
  })), [locations]);
  const locationParts = location?.direccion?.split(",").map((part) => part.trim()) || [];
  const tierraDelFuego = "Tierra del Fuego, Antártida e Islas del Atlántico Sur";
  const name = perfil.nombre || "Nombre del negocio",
    city = location?.direccion?.endsWith(`, ${tierraDelFuego}`) && locationParts.length >= 4
      ? `${locationParts.at(-3)}, ${tierraDelFuego}`
      : locationParts.length >= 3 ? locationParts.slice(-2).join(", ") : [perfil.ciudad, perfil.provincia].filter(Boolean).join(", "),
    socials = enlacesPublicos(perfil),
    hasDetails =
      perfil.descripcion ||
      perfil.telefono_publico ||
      socials.length > 0 ||
      perfil.sitio_web;
  return (
    <div
      className="perfil-publico"
      style={
        {
          "--perfil-card-radius":
            perfil.tema?.forma_tarjetas &&
            perfil.tema.forma_tarjetas !== "original"
              ? cardRadius(perfil.tema.forma_tarjetas)
              : undefined,
        } as React.CSSProperties
      }
    >
      <article className="perfil-main-card" aria-label={`Perfil de ${name}`}>
        <div
          className={`perfil-cover${!cover || coverFailed ? " perfil-cover-empty" : ""}`}
        >
          {cover && !coverFailed && (
            <button
              type="button"
              className="perfil-cover-open"
              aria-label={`Ampliar portada de ${name}`}
              aria-haspopup="dialog"
              onClick={() =>
                setPhoto({ src: cover, alt: `Portada de ${name}` })
              }
            >
              <img
                className="perfil-cover-photo"
                src={cover}
                alt={`Portada de ${name}`}
                onError={() => setCoverFailed(true)}
              />
            </button>
          )}
          <FavoriteButton slug={slug} name={name} compact />
        </div>
        <div className="perfil-overview">
          <div className="perfil-identity">
            <BusinessAvatar
              name={name}
              src={perfil.foto_perfil_url}
              shape={perfil.tema?.forma_icono}
              onOpen={() =>
                setPhoto({
                  src: perfil.foto_perfil_url,
                  alt: `Foto de perfil de ${name}`,
                })
              }
            />
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
              <Stars rating={reviewSummary.promedio} label={reviewSummary.cantidad ? `${reviewSummary.promedio} de 5 estrellas` : undefined} />
              <small>({reviewSummary.cantidad})</small>
            </div>
            <a className="perfil-review-jump" href="#perfil-reviews">{reviewSummary.cantidad ? "Ver reseñas" : "Sé la primera persona en reseñar"}</a>
          </div>
          <div className="perfil-location">
            <h2>Ubicación</h2>
            {location ? (
              <React.Suspense
                fallback={
                  <div className="perfil-map-placeholder" role="status">
                    Cargando mapa…
                  </div>
                }
              >
                <div className="perfil-map-clickable">
                  <BranchMap
                    pins={pins}
                    selected={location.id}
                    onSelect={setLocationId}
                    compact
                    label={`Ubicación de ${location.nombre}`}
                  />
                  <button
                    className="perfil-map-expand"
                    type="button"
                    aria-label={`Ampliar mapa de ${location.nombre}`}
                    aria-haspopup="dialog"
                    onClick={() => setMapOpen(true)}
                  >
                    <span>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        aria-hidden="true"
                      >
                        <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" />
                      </svg>
                      Ampliar
                    </span>
                  </button>
                </div>
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
            {location?.direccion && (
              <p
                className="perfil-address"
              >
                {location.direccion}
              </p>
            )}
          </div>
        </div>
      </article>
      {photo && (
        <ProfilePhotoDialog {...photo} onClose={() => setPhoto(null)} />
      )}
      {mapOpen && location && (
        <ProfileMapDialog
          location={location}
          locations={locations}
          onSelect={setLocationId}
          onClose={() => setMapOpen(false)}
        />
      )}
      {hasDetails && (
        <section className="perfil-details">
          <h2>Sobre el negocio</h2>
          {perfil.descripcion && <p>{perfil.descripcion}</p>}
          <div className="perfil-contact-links">
            {perfil.telefono_publico && (
              <a
                className="perfil-social-link"
                href={`tel:${perfil.telefono_publico.replace(/[^\d+]/g, "")}`}
              >
                <span className="perfil-social-icon">
                  <SocialIcon name="phone" />
                </span>
                <span>
                  <strong>Llamar</strong>
                  <small>{perfil.telefono_publico}</small>
                </span>
              </a>
            )}
            {socials.map((red) => (
              <a
                key={red.key}
                className="perfil-social-link"
                href={red.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${red.label} del negocio`}
              >
                <span className="perfil-social-icon">
                  <SocialIcon name={red.key} />
                </span>
                <span>
                  <strong>{red.label}</strong>
                  <small>
                    {red.key === "whatsapp"
                      ? "Escribinos"
                      : new URL(red.url).pathname
                          .replace(/^\//, "")
                          .replace(/\/$/, "") || "Ver perfil"}
                  </small>
                </span>
              </a>
            ))}
            {perfil.sitio_web && (
              <a
                className="perfil-social-link"
                href={perfil.sitio_web}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="perfil-social-icon">
                  <SocialIcon name="web" />
                </span>
                <span>
                  <strong>Sitio web</strong>
                  <small>Conocé más</small>
                </span>
              </a>
            )}
          </div>
        </section>
      )}
      {photos.length > 0 && <section className="perfil-inline-publications" aria-labelledby="perfil-inline-publications-title">
        <div className="perfil-inline-section-heading"><h2 id="perfil-inline-publications-title">Publicaciones</h2><span>{photos.length}</span></div>
        <div className="perfil-publications-grid" id="perfil-inline-gallery">
          {photos.slice(0, expanded ? photos.length : 6).map((url: string, index: number) => <PublicationPhoto key={`${url}-${index}`} src={url} caption={perfil.titulos_fotos?.[url]} name={name} index={index} onOpen={() => setPhoto({ src: url, alt: perfil.titulos_fotos?.[url] || `Publicación ${index + 1} de ${name}` })} />)}
        </div>
        {photos.length > 6 && <button type="button" className="perfil-publications-more" aria-expanded={expanded} aria-controls="perfil-inline-gallery" onClick={() => setExpanded(value => !value)}>{expanded ? "Ver menos" : "Ver más publicaciones"}</button>}
      </section>}
      <section className="perfil-reviews" id="perfil-reviews" aria-labelledby="perfil-reviews-title">
        <div className="perfil-reviews-heading">
          <div><h2 id="perfil-reviews-title">Reseñas</h2><p>Experiencias de personas que reservaron en {name}.</p></div>
          {reviewSummary.cantidad > 0 && <div className="perfil-reviews-score"><Stars rating={reviewSummary.promedio} label={`${reviewSummary.promedio} de 5 estrellas`} /><strong>{reviewSummary.promedio}</strong><span>({reviewSummary.cantidad})</span></div>}
        </div>
        {reviewLoading ? <p role="status">Cargando reseñas…</p> : reviews.length ? <div className="perfil-review-list">{reviews.map(review => <article className="perfil-review-card" key={review.id}><div className="perfil-review-card-heading"><strong>{review.nombre}</strong><time dateTime={review.created_at}>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(review.created_at))}</time></div><Stars rating={Number(review.puntuacion)} label={`${review.puntuacion} de 5 estrellas`} /><p>{review.comentario || "Sin comentario escrito."}</p></article>)}</div> : reviewError ? <p className="perfil-review-error" role="alert">{reviewError}</p> : <p>Todavía no hay reseñas. Si ya completaste un turno, podés dejar la primera.</p>}
        {appConfig.consumerAccountsEnabled && <div className="perfil-review-action">
          {!signedInConsumer ? <p><Link to={`/login?${new URLSearchParams({ tipo: "usuario", volver: `/perfil/${slug || ""}#perfil-reviews` })}`}>Iniciá sesión como usuario para dejar una reseña.</Link></p> : myReview && !reviewEditing ? <button className="perfil-review-secondary" type="button" onClick={() => { setReviewRating(Number(myReview.puntuacion) || 5); setReviewComment(myReview.comentario || ""); setReviewEditing(true); setReviewError(""); setReviewNotice(""); }}>Editar mi reseña</button> : reviewEligible || myReview ? <form className="perfil-review-form" onSubmit={async event => {
            event.preventDefault();
            setReviewBusy(true); setReviewError(""); setReviewNotice("");
            try {
              const response = await fetch(`${appConfig.apiUrl}/browse/perfil/${encodeURIComponent(slug || "")}/resena`, { method: "PUT", headers: { ...consumerHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ puntuacion: reviewRating, comentario: reviewComment }) });
              const data = await response.json();
              if (!response.ok || !data.success) throw new Error(data.error || "No pudimos guardar la reseña.");
              setMyReview(data.resena); setReviewEligible(true); setReviewEditing(false); setReviewNotice("Tu reseña quedó guardada.");
              const listing = await fetch(`${appConfig.apiUrl}/perfil/${encodeURIComponent(slug || "")}/resenas`);
              const listingData = await listing.json();
              if (listing.ok && listingData.success) { setReviews(listingData.resenas || []); setReviewSummary({ promedio: Number(listingData.promedio) || 0, cantidad: Number(listingData.cantidad) || 0 }); }
            } catch (error: any) { setReviewError(error.message || "No pudimos guardar la reseña."); }
            finally { setReviewBusy(false); }
          }}>
            <label>Tu puntuación<div className="perfil-review-rating-input" role="radiogroup" aria-label="Puntuación de la reseña">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" role="radio" aria-checked={reviewRating === value} aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`} onClick={() => setReviewRating(value)}><svg className={value <= reviewRating ? "perfil-star-filled" : undefined} viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9Z" /></svg></button>)}</div></label>
            <label htmlFor="perfil-review-comment">Tu comentario <span>Opcional</span></label>
            <textarea id="perfil-review-comment" value={reviewComment} maxLength={1000} rows={4} placeholder="Contá brevemente cómo fue tu experiencia…" onChange={event => setReviewComment(event.target.value)} />
            <div className="perfil-review-form-footer"><small>{reviewComment.length}/1000</small><div>{myReview && <button className="perfil-review-secondary" type="button" onClick={() => { setReviewEditing(false); setReviewError(""); setReviewComment(myReview.comentario || ""); setReviewRating(Number(myReview.puntuacion) || 5); }}>Cancelar</button>}<button className="perfil-review-submit" type="submit" disabled={reviewBusy}>{reviewBusy ? "Guardando…" : myReview ? "Guardar cambios" : "Publicar reseña"}</button></div></div>
          </form> : <p>{reviewEligible ? "Podés compartir tu experiencia." : "Vas a poder reseñar este negocio después de completar un turno."}</p>}
          {reviewError && !reviewLoading && <p className="perfil-review-error" role="alert">{reviewError}</p>}
          {reviewNotice && <p className="perfil-review-notice" role="status">{reviewNotice}</p>}
        </div>}
      </section>
    </div>
  );
}

function PublicationPhoto({
  src,
  caption,
  name,
  index,
  onOpen,
}: {
  src: string;
  caption?: string;
  name: string;
  index: number;
  onOpen: () => void;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  return failed ? (
    <div
      className="perfil-publication-unavailable"
      role="img"
      aria-label={`Publicación ${index + 1} de ${name}: imagen no disponible`}
    >
      <PublicationsIcon />
      <span>Imagen no disponible</span>
    </div>
  ) : (
    <button
      type="button"
      className="perfil-publication-open"
      aria-label={`Ampliar publicación ${index + 1} de ${name}`}
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <img
        src={src}
        loading="lazy"
        decoding="async"
        alt={caption || `Publicación ${index + 1} de ${name}`}
        onError={() => setFailed(true)}
      />
      {caption && <span className="publicacion-caption">{caption}</span>}
    </button>
  );
}

export function PerfilPublicaciones({
  perfil,
  bookingUrl,
  profileUrl,
}: {
  perfil: any;
  bookingUrl: string;
  profileUrl: string;
}) {
  const name = perfil.nombre || "Nombre del negocio";
  const photos = Array.isArray(perfil.fotos) ? perfil.fotos : [];
  const [photo, setPhoto] = React.useState<{ src: string; alt: string } | null>(
    null,
  );
  return (
    <div className="perfil-publications">
      <header className="perfil-publications-header">
        <BusinessAvatar
          name={name}
          src={perfil.foto_perfil_url}
          shape={perfil.tema?.forma_icono}
          onOpen={() =>
            setPhoto({
              src: perfil.foto_perfil_url,
              alt: `Foto de perfil de ${name}`,
            })
          }
        />
        <div className="perfil-publications-identity">
          <h1>{name}</h1>
          {perfil.descripcion && <p>{perfil.descripcion}</p>}
        </div>
        <div className="perfil-publications-actions">
          <a className="perfil-publications-booking" href={bookingUrl}>
            Ver agenda
          </a>
          <Link className="perfil-publications-profile" to={profileUrl}>
            Ver perfil
          </Link>
        </div>
      </header>
      <section aria-labelledby="perfil-publications-title">
        <h2 id="perfil-publications-title">Publicaciones</h2>
        {photos.length ? (
          <div className="perfil-publications-grid">
            {photos.map((url: string, index: number) => (
              <PublicationPhoto
                key={`${url}-${index}`}
                src={url}
                caption={perfil.titulos_fotos?.[url]}
                name={name}
                index={index}
                onOpen={() =>
                  setPhoto({
                    src: url,
                    alt: perfil.titulos_fotos?.[url] || `Publicación ${index + 1} de ${name}`,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <p className="perfil-publications-empty">
            Todavía no hay publicaciones.
          </p>
        )}
      </section>
      {photo && (
        <ProfilePhotoDialog {...photo} onClose={() => setPhoto(null)} />
      )}
    </div>
  );
}
