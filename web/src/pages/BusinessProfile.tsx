import * as React from "react";
import { useParams, Link } from "react-router";
import { appConfig } from "../config";
import { PerfilContenido } from "../migrated/panel/perfil-publico";
export default function BusinessProfile() {
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
  return (
    <main className="perfil-page">
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
        ) : (
          <PerfilContenido
            perfil={perfil}
            logo={perfil.logo_url}
            bookingUrl={`/agenda/${slug}`}
            slug={slug}
          />
        )}
      </div>
    </main>
  );
}
