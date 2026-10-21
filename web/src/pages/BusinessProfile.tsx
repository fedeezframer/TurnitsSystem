import * as React from "react";
import { useParams, Link } from "react-router";
import { appConfig } from "../config";
import { BusinessFavoritesProvider } from "../components/BusinessFavorites";
import { SoftRouteLoading, useStartupLoading } from "../components/BrandPreloader";
import { PerfilContenido } from "../migrated/panel/perfil-publico";
function BusinessProfileContent({
  publications = false,
}: {
  publications?: boolean;
}) {
  const { slug } = useParams(),
    [perfil, setPerfil] = React.useState<any>(null),
    [error, setError] = React.useState("");
  useStartupLoading(!perfil && !error);
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
    document.title = `${perfil?.nombre || "Negocio"} | Perfil | Turnits`;
    return () => {
      document.title = previousTitle;
    };
  }, [perfil?.nombre, publications]);
  const bookingUrl = `/agenda/${encodeURIComponent(slug || "")}`;
  if (!perfil && !error) {
    return <SoftRouteLoading />;
  }
  return (
    <main
      className="perfil-page"
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
        ) : (
          <PerfilContenido
            perfil={perfil}
            logo={perfil.logo_url}
            bookingUrl={bookingUrl}
            slug={slug}
            initialExpanded={publications}
          />
        )}
      </div>
    </main>
  );
}
export default function BusinessProfile(props: { publications?: boolean }) {
  return <BusinessFavoritesProvider><BusinessProfileContent {...props} /></BusinessFavoritesProvider>;
}
