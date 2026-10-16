import * as React from "react";
import { useParams, Link } from "react-router";
import { appConfig } from "../config";
import {
  PerfilContenido,
  PerfilPublicaciones,
} from "../migrated/panel/perfil-publico";
export default function BusinessProfile({
  publications = false,
}: {
  publications?: boolean;
}) {
  const { slug } = useParams(),
    [perfil, setPerfil] = React.useState<any>(null),
    [error, setError] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    setPerfil(null);
    setError("");
    fetch(`${appConfig.apiUrl}/perfil/${encodeURIComponent(slug || "")}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success)
          throw new Error(d.error || "Perfil no disponible.");
        if (alive) setPerfil(d.perfil);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [slug]);
  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = `${perfil?.nombre || "Negocio"} | ${publications ? "Publicaciones" : "Perfil"} | Turnits`;
    return () => {
      document.title = previousTitle;
    };
  }, [perfil?.nombre, publications]);
  const profileUrl = `/perfil/${encodeURIComponent(slug || "")}`;
  const bookingUrl = `/agenda/${encodeURIComponent(slug || "")}`;
  return (
    <main
      className={`perfil-page${publications ? " perfil-page-publications" : ""}`}
    >
      <div className="perfil-page-inner">
        <Link
          to="/"
          className="perfil-turnits-link"
          aria-label="Turnits — ir al inicio"
        >
          <img src={appConfig.logoUrl} alt="Turnits" />
        </Link>
        {error ? (
          <p role="alert" className="perfil-page-status">
            {error}
          </p>
        ) : !perfil ? (
          <p role="status" className="perfil-page-status">
            Cargando perfil…
          </p>
        ) : publications ? (
          <PerfilPublicaciones
            perfil={perfil}
            bookingUrl={bookingUrl}
            profileUrl={profileUrl}
          />
        ) : (
          <PerfilContenido
            perfil={perfil}
            logo={perfil.logo_url}
            bookingUrl={bookingUrl}
            slug={slug}
            publicationsUrl={`${profileUrl}/publicaciones`}
          />
        )}
      </div>
    </main>
  );
}
