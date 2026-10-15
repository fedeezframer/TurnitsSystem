import * as React from "react";
import "./perfil.css";
export function PerfilContenido({
  perfil,
  logo,
  bookingUrl,
}: {
  perfil: any;
  logo?: string;
  bookingUrl?: string;
}) {
  return (
    <div className="negocio-stack">
      {perfil.fotos?.length > 0 ? (
        <img
          src={perfil.fotos[0]}
          alt={perfil.nombre}
          style={{
            width: "100%",
            maxHeight: 280,
            objectFit: "cover",
            borderRadius: 14,
          }}
        />
      ) : null}
      <div className="negocio-row">
        {logo && (
          <img
            src={logo}
            alt=""
            style={{
              width: 58,
              height: 58,
              borderRadius: 12,
              objectFit: "contain",
              background: "white",
            }}
          />
        )}
        <div>
          <p className="negocio-muted">{perfil.categoria || "Tu negocio"}</p>
          <h2>{perfil.nombre || "Nombre del negocio"}</h2>
          <p className="negocio-muted">
            {[perfil.ciudad, perfil.provincia].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>
      {perfil.descripcion && (
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {perfil.descripcion}
        </p>
      )}
      {perfil.direccion && <p className="negocio-muted">{perfil.direccion}</p>}
      <div className="negocio-row">
        {bookingUrl && (
          <a className="negocio-button" href={bookingUrl}>
            Reservar turno →
          </a>
        )}
        {perfil.telefono_publico && (
          <a
            href={`tel:${perfil.telefono_publico.replace(/[^\d+]/g, "")}`}
            className="negocio-button secondary"
          >
            Llamar
          </a>
        )}
        {perfil.instagram && (
          <a
            href={perfil.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="negocio-button secondary"
          >
            Instagram
          </a>
        )}
        {perfil.sitio_web && (
          <a
            href={perfil.sitio_web}
            target="_blank"
            rel="noopener noreferrer"
            className="negocio-button secondary"
          >
            Sitio web
          </a>
        )}
      </div>
      {perfil.fotos?.length > 1 && (
        <div className="negocio-gallery">
          {perfil.fotos.slice(1).map((url: string, i: number) => (
            <div className="negocio-photo" key={url}>
              <img
                src={url}
                alt={`Foto ${i + 2} de ${perfil.nombre}`}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
