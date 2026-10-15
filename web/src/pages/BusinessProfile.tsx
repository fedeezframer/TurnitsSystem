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
    <main
      className="negocio-editor"
      style={{
        minHeight: "100dvh",
        background: "#f8fafc",
        padding: "26px 16px",
      }}
    >
      <div
        style={{ maxWidth: 850, margin: "0 auto" }}
        className="negocio-stack"
      >
        <Link to="/" style={{ alignSelf: "center" }}>
          <img
            src={appConfig.logoUrl}
            alt="Turnits"
            style={{ width: 130, maxHeight: 45, objectFit: "contain" }}
          />
        </Link>
        <section className="negocio-card">
          {error ? (
            <p role="alert" className="negocio-muted">
              {error}
            </p>
          ) : !perfil ? (
            <p role="status">Cargando perfil…</p>
          ) : (
            <PerfilContenido
              perfil={perfil}
              logo={perfil.logo_url}
              bookingUrl={`/agenda/${slug}`}
            />
          )}
        </section>
      </div>
    </main>
  );
}
