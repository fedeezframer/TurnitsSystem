import * as React from "react";
import {
  MenuFooter_getSlug,
  MenuFooter_getToken,
  SeccionHeader,
} from "./common";
import { TeamManager, TeamManager_ServiciosVinculados } from "./equipo";
import { TurnitsPlanRequirement } from "./shared";
import "./perfil.css";
import { PerfilContenido } from "./perfil-publico";

export function NegocioIcon({
  kind = "sucursal",
}: {
  kind?: "perfil" | "sucursal" | "equipo";
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "sucursal" ? (
        <>
          <path d="M3 10h18l-2-6H5l-2 6Zm1 0v10h16V10M9 20v-6h6v6" />
          <path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
        </>
      ) : kind === "perfil" ? (
        <>
          <rect x="4" y="3" width="16" height="18" rx="3" />
          <circle cx="12" cy="9" r="2.5" />
          <path d="M8 17c0-4 8-4 8 0" />
        </>
      ) : (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-2c0-5 12-5 12 0v2M16 5a3 3 0 0 1 0 6m2 3c3 0 3 3 3 6" />
        </>
      )}
    </svg>
  );
}
const headers = () => ({
  Authorization: `Bearer ${MenuFooter_getToken()}`,
  "Content-Type": "application/json",
});
async function request(url: string, options: RequestInit = {}) {
  const r = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { ...headers(), ...options.headers },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.success)
    throw new Error(d.error || "No se pudo completar la solicitud.");
  return d;
}
export const perfilVacio = {
  nombre: "",
  descripcion: "",
  categoria: "",
  direccion: "",
  ciudad: "",
  provincia: "",
  telefono_publico: "",
  instagram: "",
  sitio_web: "",
  fotos: [] as string[],
  publicado: false,
};
export function PerfilNegocio({
  baseUrl,
  isMobile,
}: {
  baseUrl: string;
  isMobile: boolean;
}) {
  const api = baseUrl.replace(/\/+$/, ""),
    slug = MenuFooter_getSlug();
  const [form, setForm] = React.useState(perfilVacio),
    [logo, setLogo] = React.useState(""),
    [habilitado, setHabilitado] = React.useState(false),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [uploading, setUploading] = React.useState(false),
    [error, setError] = React.useState(""),
    [saved, setSaved] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    request(`${api}/admin/perfil/${slug}`)
      .then((d) => {
        if (alive) {
          setForm({ ...perfilVacio, ...d.perfil });
          setLogo(d.logo_url || "");
          setHabilitado(d.habilitado);
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [api, slug]);
  const change = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved("");
  };
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const d = await request(`${api}/admin/perfil/${slug}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setForm(d.perfil);
      setSaved("Perfil guardado.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const subir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (
      file.size > 3 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Usá una foto JPG, PNG o WebP de hasta 3 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("foto", file);
      const r = await fetch(`${api}/admin/perfil/${slug}/foto`, {
        method: "POST",
        headers: { Authorization: `Bearer ${MenuFooter_getToken()}` },
        body,
      });
      const d = await r.json();
      if (!r.ok || !d.success)
        throw new Error(d.error || "No se pudo subir la foto.");
      setForm((f) => ({ ...f, fotos: [...f.fotos, d.url].slice(0, 8) }));
      setSaved("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };
  if (!loading && error && !habilitado) {
    return (
      <div className="negocio-editor negocio-stack">
        <SeccionHeader
          title="Perfil del negocio"
          subtitle="Tu presentación pública"
          isMobile={isMobile}
        />
        <section className="negocio-card negocio-stack">
          <p role="alert" className="negocio-error">
            {error}
          </p>
          <a
            className="negocio-button"
            href={
              /sesión|token|autorizado/i.test(error)
                ? "/login"
                : window.location.pathname
            }
            style={{ alignSelf: "flex-start" }}
          >
            {/sesión|token|autorizado/i.test(error)
              ? "Iniciar sesión"
              : "Volver a cargar"}
          </a>
        </section>
      </div>
    );
  }
  return (
    <div className="negocio-editor negocio-stack">
      <SeccionHeader
        title="Perfil del negocio"
        subtitle="Tu presentación pública y la base de tu espacio en Browse"
        isMobile={isMobile}
      />
      {loading ? (
        <p className="negocio-muted">Cargando perfil…</p>
      ) : (
        <>
          {!habilitado && (
            <p role="status" className="negocio-muted">
              Falta instalar la actualización de Perfil en la base de datos.
            </p>
          )}
          <form onSubmit={guardar} className="negocio-card negocio-stack">
            <div className="negocio-between">
              <div>
                <h2>Presentá tu negocio</h2>
                <p className="negocio-muted">
                  Completá sólo los datos que quieras mostrar a tus clientes.
                </p>
              </div>
              <NegocioIcon kind="perfil" />
            </div>
            <fieldset
              disabled={!habilitado || busy}
              style={{ border: 0, padding: 0, margin: 0 }}
              className="negocio-stack"
            >
              <div className="negocio-grid">
                {(
                  [
                    ["nombre", "Nombre del negocio"],
                    ["categoria", "Rubro"],
                    ["ciudad", "Ciudad"],
                    ["provincia", "Provincia"],
                    ["direccion", "Dirección pública"],
                    ["telefono_publico", "Teléfono público"],
                    ["instagram", "Instagram (https://instagram.com/…)"],
                    ["sitio_web", "Sitio web (https://…)"],
                  ] as const
                ).map(([key, label]) => (
                  <label className="negocio-field" key={key}>
                    {label}
                    <input
                      value={form[key]}
                      onChange={(e) => change(key, e.target.value)}
                      required={key === "nombre"}
                      maxLength={
                        key === "nombre"
                          ? 100
                          : key === "telefono_publico"
                            ? 30
                            : key === "sitio_web"
                              ? 300
                              : key === "instagram"
                                ? 250
                                : key === "direccion"
                                  ? 200
                                  : key === "categoria"
                                    ? 80
                                    : 100
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="negocio-field">
                Acerca del negocio
                <textarea
                  value={form.descripcion}
                  maxLength={1500}
                  onChange={(e) => change("descripcion", e.target.value)}
                  placeholder="Contá qué ofrecés y qué hace especial a tu negocio."
                />
              </label>
              <div className="negocio-stack" style={{ gap: 10 }}>
                <div className="negocio-between">
                  <h3>Fotos del negocio</h3>
                  <label
                    className="negocio-button secondary"
                    style={{
                      opacity: uploading || form.fotos.length >= 8 ? 0.45 : 1,
                    }}
                  >
                    {" "}
                    {uploading ? "Subiendo…" : "+ Agregar foto"}
                    <input
                      aria-label="Agregar foto del negocio"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      disabled={uploading || form.fotos.length >= 8}
                      onChange={subir}
                    />
                  </label>
                </div>
                <p className="negocio-muted">
                  Hasta 8 fotos. La primera se usa como portada.
                </p>
                <div className="negocio-gallery">
                  {form.fotos.map((url, i) => (
                    <div className="negocio-photo" key={url}>
                      <img src={url} alt={`Foto ${i + 1}`} />
                      <button
                        type="button"
                        aria-label={`Quitar foto ${i + 1}`}
                        onClick={() =>
                          change(
                            "fotos",
                            form.fotos.filter((x) => x !== url),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <label className="negocio-toggle">
                <input
                  type="checkbox"
                  checked={form.publicado}
                  onChange={(e) => change("publicado", e.target.checked)}
                />
                Publicar mi perfil
              </label>
              <p className="negocio-muted">
                Al publicarlo, estos datos y fotos estarán disponibles en tu
                ficha pública. Podés ocultarla cuando quieras.
              </p>
              <div className="negocio-row">
                <button className="negocio-button" disabled={uploading || busy}>
                  {busy ? "Guardando…" : "Guardar perfil"}
                </button>
                {form.publicado && (
                  <a
                    href={`/perfil/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="negocio-button secondary"
                  >
                    Ver perfil público ↗
                  </a>
                )}
              </div>
            </fieldset>
            {error && (
              <p className="negocio-error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="negocio-success" role="status">
                {saved}
              </p>
            )}
          </form>
          <section className="negocio-card negocio-stack">
            <h2>Vista previa</h2>
            <div className="negocio-preview">
              <PerfilContenido perfil={form} logo={logo} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
const sucursalVacia = {
  id: null as string | null,
  nombre: "",
  direccion: "",
  activo: true,
  admin_equipo_id: null as string | null,
  miembros: [] as string[],
};
export function SucursalesNegocio({ baseUrl }: { baseUrl: string }) {
  const api = baseUrl.replace(/\/+$/, ""),
    slug = MenuFooter_getSlug();
  const [data, setData] = React.useState<any>(null),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [form, setForm] = React.useState<typeof sucursalVacia | null>(null),
    [saved, setSaved] = React.useState("");
  const cargar = React.useCallback(
    () => request(`${api}/admin/sucursales/${slug}`).then(setData),
    [api, slug],
  );
  React.useEffect(() => {
    cargar().catch((e) => setError(e.message));
  }, [cargar]);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const d = await request(`${api}/admin/sucursales/${slug}`, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setData((p: any) => ({ ...p, ...d }));
      setForm(null);
      setSaved("Sucursal guardada.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <p
        className={error ? "negocio-error" : "negocio-muted"}
        role={error ? "alert" : "status"}
      >
        {error || "Cargando sucursales…"}
      </p>
    );
  const locked = !data.premium,
    disabled = locked || !data.habilitado;
  return (
    <div className="negocio-editor negocio-stack">
      <div
        className="negocio-card negocio-stack"
        style={locked ? { opacity: 0.55, filter: "grayscale(1)" } : {}}
      >
        <div className="negocio-between">
          <div>
            <h2>Sucursales</h2>
            <p className="negocio-muted">
              Un negocio, una agenda. Organizá a tu equipo por sede.
            </p>
          </div>
          {locked ? (
            <TurnitsPlanRequirement premiumOnly />
          ) : (
            <button
              type="button"
              className="negocio-button"
              disabled={disabled || busy}
              onClick={() => {
                setForm({ ...sucursalVacia, miembros: [] });
                setError("");
                setSaved("");
              }}
            >
              + Nueva sucursal
            </button>
          )}
        </div>
        {!data.habilitado && (
          <p className="negocio-muted">
            Falta instalar la actualización de Sucursales en la base de datos.
          </p>
        )}
        <div className="negocio-row">
          <NegocioIcon />
          <div>
            <h3>Sede principal</h3>
            <p className="negocio-muted">
              Dueño general ·{" "}
              {data.equipo.filter((m: any) => !m.sucursal_id).length}{" "}
              integrantes
            </p>
          </div>
        </div>
      </div>
      {form && (
        <form className="negocio-card negocio-stack" onSubmit={guardar}>
          <h2>{form.id ? "Editar sucursal" : "Nueva sucursal"}</h2>
          <fieldset
            className="negocio-stack"
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <div className="negocio-grid">
              <label className="negocio-field">
                Nombre de la sucursal
                <input
                  required
                  maxLength={80}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>
              <label className="negocio-field">
                Dirección
                <input
                  maxLength={200}
                  value={form.direccion}
                  onChange={(e) =>
                    setForm({ ...form, direccion: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="negocio-stack" style={{ gap: 10 }}>
              <h3>Miembros de esta sucursal</h3>
              <p className="negocio-muted">
                Cada profesional trabaja en una sede. Al moverlo, sus reservas
                anteriores conservan la sucursal original. Los que quites
                vuelven a la sede principal.
              </p>
              <div className="negocio-grid">
                {data.equipo
                  .filter((m: any) => !m.es_dueño)
                  .map((m: any) => {
                    const selected = form.miembros.includes(m.id),
                      sede = data.sucursales.find(
                        (s: any) => s.id === m.sucursal_id,
                      );
                    return (
                      <button
                        className="negocio-chip"
                        type="button"
                        aria-pressed={selected}
                        key={m.id}
                        onClick={() =>
                          setForm({
                            ...form,
                            miembros: selected
                              ? form.miembros.filter((id) => id !== m.id)
                              : [...form.miembros, m.id],
                            admin_equipo_id:
                              selected && form.admin_equipo_id === m.id
                                ? null
                                : form.admin_equipo_id,
                          })
                        }
                      >
                        {m.foto_url ? (
                          <img src={m.foto_url} alt="" />
                        ) : (
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: m.color || "#64748b",
                            }}
                          />
                        )}
                        <span>
                          {m.nombre} {m.apellido}
                          <small
                            style={{
                              display: "block",
                              fontSize: 11,
                              color: "#64748b",
                            }}
                          >
                            {sede?.nombre || "Sede principal"}
                            {!m.activo ? " · Inactivo" : ""}
                          </small>
                        </span>
                        <span style={{ marginLeft: "auto" }}>
                          {selected ? "✓" : "+"}
                        </span>
                      </button>
                    );
                  })}
              </div>
              {!data.equipo.some((m: any) => !m.es_dueño) && (
                <p className="negocio-muted">
                  Creá los integrantes desde Miembros y después asignalos a la
                  sucursal.
                </p>
              )}
            </div>
            <label className="negocio-field">
              Encargado de la sucursal
              <select
                value={form.admin_equipo_id || ""}
                onChange={(e) =>
                  setForm({ ...form, admin_equipo_id: e.target.value || null })
                }
              >
                <option value="">La administra el dueño general</option>
                {data.equipo
                  .filter(
                    (m: any) =>
                      form.miembros.includes(m.id) && m.activo && m.login_email,
                  )
                  .map((m: any) => (
                    <option value={m.id} key={m.id}>
                      {m.nombre} {m.apellido}
                      {!m.login_activado ? " · Acceso pendiente" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <p className="negocio-muted">
              El encargado usa su acceso de empleado para ver los turnos de esta
              sede, aprobar pagos manuales pendientes y gestionar sus miembros.
              Los permisos y las sucursales los define el dueño general.
            </p>
            <label className="negocio-toggle">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              Sucursal habilitada para reservas
            </label>
            <div className="negocio-row">
              <button className="negocio-button">
                {busy ? "Guardando…" : "Guardar sucursal"}
              </button>
              <button
                type="button"
                className="negocio-button secondary"
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p className="negocio-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="negocio-success" role="status">
          {saved}
        </p>
      )}
      <div className="negocio-grid">
        {data.sucursales.map((s: any) => {
          const miembros = data.equipo.filter(
              (m: any) => m.sucursal_id === s.id,
            ),
            admin = miembros.find((m: any) => m.id === s.admin_equipo_id);
          return (
            <article
              className="negocio-card negocio-stack"
              key={s.id}
              style={{ opacity: locked || !s.activo ? 0.55 : 1 }}
            >
              <div className="negocio-between">
                <NegocioIcon />
                <span className="negocio-muted">
                  {s.activo ? "Activa" : "Pausada"}
                </span>
              </div>
              <div>
                <h2>{s.nombre}</h2>
                <p className="negocio-muted">
                  {s.direccion || "Sin dirección configurada"}
                </p>
              </div>
              <p className="negocio-muted">
                {admin
                  ? `Encargado: ${admin.nombre} ${admin.apellido || ""}`
                  : "Administrada por el dueño general"}
              </p>
              <div className="negocio-row">
                {miembros.map((m: any) => (
                  <span
                    className="negocio-chip"
                    style={{ cursor: "default" }}
                    key={m.id}
                  >
                    {m.nombre}
                  </span>
                ))}
                {!miembros.length && (
                  <p className="negocio-muted">Sin integrantes asignados</p>
                )}
              </div>
              <button
                type="button"
                disabled={disabled || busy}
                className="negocio-button secondary"
                onClick={() => {
                  setForm({
                    id: s.id,
                    nombre: s.nombre,
                    direccion: s.direccion,
                    activo: s.activo,
                    admin_equipo_id: s.admin_equipo_id,
                    miembros: miembros.map((m: any) => m.id),
                  });
                  setError("");
                  setSaved("");
                }}
              >
                Editar sucursal
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
export function EquipoSecciones(props: any) {
  const [tab, setTab] = React.useState("miembros");
  return (
    <div className="negocio-editor negocio-stack">
      <div
        className="negocio-tabs"
        role="tablist"
        aria-label="Organización del equipo"
      >
        {(["miembros", "sucursales"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <NegocioIcon kind={id === "miembros" ? "equipo" : "sucursal"} />
            {id === "miembros" ? "Miembros" : "Sucursales"}
          </button>
        ))}
      </div>
      {tab === "miembros" ? (
        <TeamManager {...props} />
      ) : (
        <SucursalesNegocio baseUrl={props.baseUrl} />
      )}
    </div>
  );
}

export function SucursalEmpleado({
  api,
  slug,
  token,
  onChange,
}: {
  api: string;
  slug: string;
  token: string;
  onChange?: (exists: boolean) => void;
}) {
  const [data, setData] = React.useState<any>(null),
    [error, setError] = React.useState(""),
    [form, setForm] = React.useState<any>(null),
    [busy, setBusy] = React.useState(false),
    [serviciosMiembro, setServiciosMiembro] = React.useState("");
  const cargar = React.useCallback(async () => {
    const d = await request(`${api}/empleado/${slug}/sucursal`);
    setData(d);
    onChange?.(!!d.sucursal);
  }, [api, slug, onChange]);
  React.useEffect(() => {
    cargar().catch((e) => setError(e.message));
  }, [cargar]);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(
        `${api}/empleado/${slug}/sucursal/miembros${form.id ? "/" + form.id : ""}`,
        {
          method: form.id ? "PUT" : "POST",
          body: JSON.stringify(
            form.id
              ? {
                  nombre: form.nombre,
                  apellido: form.apellido,
                  color: form.color,
                  activo: form.activo,
                }
              : {
                  nombre: form.nombre,
                  apellido: form.apellido,
                  color: form.color,
                  login_email: form.login_email,
                },
          ),
        },
      );
      setForm(null);
      await cargar();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function aprobar(id: string, estado: string) {
    setBusy(true);
    setError("");
    try {
      await request(`${api}/turnos/${id}`, {
        method: "PUT",
        body: JSON.stringify({ slug, estado }),
      });
      await cargar();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  let myId = "";
  try {
    myId = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ).equipoId;
  } catch {}
  return (
    <div className="negocio-editor negocio-stack">
      {error && (
        <p className="negocio-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p className="negocio-muted">Cargando sucursal…</p>
      ) : !data.sucursal ? (
        <p className="negocio-muted">
          El dueño general todavía no te asignó la administración de una
          sucursal.
        </p>
      ) : (
        <>
          <div className="negocio-card negocio-between">
            <div>
              <h2>{data.sucursal.nombre}</h2>
              <p className="negocio-muted">{data.sucursal.direccion}</p>
            </div>
            <button
              className="negocio-button secondary"
              disabled={busy}
              onClick={() => cargar().catch((e) => setError(e.message))}
            >
              Actualizar
            </button>
          </div>
          <section className="negocio-card negocio-stack">
            <div className="negocio-between">
              <h2>Miembros de la sucursal</h2>
              <button
                className="negocio-button"
                onClick={() =>
                  setForm({
                    nombre: "",
                    apellido: "",
                    color: "#197128",
                    login_email: "",
                    activo: true,
                  })
                }
              >
                + Nuevo miembro
              </button>
            </div>
            {form && (
              <form className="negocio-stack" onSubmit={guardar}>
                <div className="negocio-grid">
                  {[
                    "nombre",
                    "apellido",
                    ...(!form.id ? ["login_email"] : []),
                  ].map((key) => (
                    <label className="negocio-field" key={key}>
                      {key === "login_email"
                        ? "Email de acceso"
                        : key === "nombre"
                          ? "Nombre"
                          : "Apellido"}
                      <input
                        type={key === "login_email" ? "email" : "text"}
                        required={key === "nombre"}
                        maxLength={key === "login_email" ? 254 : 80}
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                {form.id && (
                  <label className="negocio-toggle">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) =>
                        setForm({ ...form, activo: e.target.checked })
                      }
                    />
                    Miembro activo
                  </label>
                )}
                <div className="negocio-row">
                  <button className="negocio-button" disabled={busy}>
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="negocio-button secondary"
                    disabled={busy}
                    onClick={() => setForm(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            {data.equipo.map((m: any) => (
              <div className="negocio-between" key={m.id}>
                <div className="negocio-row">
                  {m.foto_url ? (
                    <img className="negocio-avatar" src={m.foto_url} alt="" />
                  ) : (
                    <span
                      className="negocio-avatar"
                      style={{ background: m.color }}
                    >
                      {m.nombre[0]}
                    </span>
                  )}
                  <div>
                    <h3>
                      {m.nombre} {m.apellido}
                    </h3>
                    <p className="negocio-muted">
                      {m.activo ? "Activo" : "Pausado"}
                    </p>
                  </div>
                </div>
                <div className="negocio-row">
                  <button
                    className="negocio-button secondary"
                    onClick={() =>
                      setServiciosMiembro(serviciosMiembro === m.id ? "" : m.id)
                    }
                  >
                    Servicios
                  </button>
                  {m.id !== myId && (
                    <button
                      className="negocio-button secondary"
                      onClick={() =>
                        setForm({ ...m, apellido: m.apellido || "" })
                      }
                    >
                      Editar
                    </button>
                  )}
                </div>
                {serviciosMiembro === m.id && (
                  <div style={{ width: "100%" }}>
                    <TeamManager_ServiciosVinculados
                      equipoId={m.id}
                      apiUrl={api}
                      accentColor="#197128"
                      isMobile={false}
                      routePrefix={"/empleado/" + slug + "/sucursal/miembros"}
                    />
                  </div>
                )}
              </div>
            ))}
          </section>
          <section className="negocio-card negocio-stack">
            <h2>Agenda de la sucursal</h2>
            <p className="negocio-muted">
              Próximos turnos de esta sede. Hasta 500 reservas.
            </p>
            {!data.turnos.length && (
              <p className="negocio-muted">Todavía no hay turnos.</p>
            )}
            {data.turnos.map((t: any) => (
              <div
                className="negocio-between"
                key={t.id}
                style={{ padding: "12px 0", borderTop: "1px solid #edf1f5" }}
              >
                <div>
                  <h3>
                    {t.nombre} {t.apellido}
                  </h3>
                  <p className="negocio-muted">
                    {t.fecha.split("-").reverse().join("/")} ·{" "}
                    {t.hora.slice(0, 5)} · {t.servicio_nombre}
                  </p>
                  <p className="negocio-muted">
                    {t.equipo_nombre} · {t.estado}
                  </p>
                </div>
                {t.estado === "pendiente" &&
                  ["transferencia", "efectivo"].includes(t.metodo_pago) && (
                    <div className="negocio-row">
                      <button
                        className="negocio-button"
                        disabled={busy}
                        onClick={() => aprobar(t.id, "confirmado")}
                      >
                        Confirmar
                      </button>
                      <button
                        className="negocio-button secondary"
                        disabled={busy}
                        onClick={() => aprobar(t.id, "cancelado")}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
