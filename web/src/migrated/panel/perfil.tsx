import * as React from "react";
import {
  MenuFooter_getSlug,
  MenuFooter_getToken,
  SeccionHeader,
  TurnitsGlobalSaveManager_get,
} from "./common";
import { TeamManager, TeamManager_ServiciosVinculados } from "./equipo";
import { TurnitsPlanRequirement } from "./shared";
import "./perfil.css";
const LocationPicker = React.lazy(() =>
  import("../../components/BranchMap").then((m) => ({
    default: m.LocationPicker,
  })),
);
import "./perfil-publico.css";
import { SOCIAL_LINKS } from "../../shared/socials.js";
import { perfilVacio, perfilDraft } from "../../shared/profile-draft";
import { SocialProfileField } from "../../components/SocialProfileField";
import { BusinessAvatar } from "../../components/BusinessAvatar";
import type { IconShape } from "../../shared/appearance.js";

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
export { perfilVacio } from "../../shared/profile-draft";
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
    [habilitado, setHabilitado] = React.useState(false),
    [redesHabilitadas, setRedesHabilitadas] = React.useState(false),
    [imagenesHabilitadas, setImagenesHabilitadas] = React.useState(false),
    [formaIcono, setFormaIcono] = React.useState<IconShape>("original"),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [uploading, setUploading] = React.useState(false),
    [uploadProgress, setUploadProgress] = React.useState(""),
    [error, setError] = React.useState("");
  const draftRef = React.useRef(form);
  const capabilities = React.useRef({ redes: false, imagenes: false });
  const updateDraft = (
    update: (value: typeof perfilVacio) => typeof perfilVacio,
  ) => {
    const manager = TurnitsGlobalSaveManager_get();
    const next = update({
      ...draftRef.current,
      ...manager?.getPending("perfil"),
    });
    draftRef.current = next;
    setForm(next);
    manager?.markDirty(
      "perfil",
      perfilDraft(
        next,
        capabilities.current.redes,
        capabilities.current.imagenes,
      ),
    );
  };
  React.useEffect(() => {
    let alive = true;
    request(`${api}/admin/perfil/${slug}`)
      .then((d) => {
        if (alive) {
          const manager = TurnitsGlobalSaveManager_get();
          capabilities.current = {
            redes: !!d.redes_habilitadas,
            imagenes: !!d.imagenes_habilitadas,
          };
          manager?.setBaseline(
            "perfil",
            perfilDraft(
              d.perfil,
              capabilities.current.redes,
              capabilities.current.imagenes,
            ),
          );
          const next = {
            ...perfilVacio,
            ...d.perfil,
            ...manager?.getPending("perfil"),
          };
          draftRef.current = next;
          setForm(next);
          setHabilitado(d.habilitado);
          setRedesHabilitadas(!!d.redes_habilitadas);
          setImagenesHabilitadas(!!d.imagenes_habilitadas);
          setFormaIcono(d.tema?.forma_icono || "original");
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [api, slug]);
  React.useEffect(() => {
    const manager = TurnitsGlobalSaveManager_get();
    setBusy(!!manager?.isSaving());
    const onState = (e: any) => setBusy(!!e.detail?.saving);
    const onSaved = (e: any) => {
      if (e.detail?.section !== "perfil") return;
      const next = {
        ...perfilVacio,
        ...e.detail.data,
        ...manager?.getPending("perfil"),
      };
      draftRef.current = next;
      setForm(next);
      setError("");
    };
    window.addEventListener("turnits_global_save_state", onState);
    window.addEventListener("turnits_global_saved", onSaved);
    return () => {
      window.removeEventListener("turnits_global_save_state", onState);
      window.removeEventListener("turnits_global_saved", onSaved);
    };
  }, []);
  const change = (key: string, value: any) => {
    updateDraft((f) => ({ ...f, [key]: value }));
  };
  const subir = async (
    e: React.ChangeEvent<HTMLInputElement>,
    destino: "fotos" | "foto_perfil_url" | "banner_url" = "fotos",
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (
      !files.length ||
      uploading ||
      TurnitsGlobalSaveManager_get()?.getBlocker()
    )
      return;
    if (
      files.some(
        (file) =>
          file.size > 3 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      setError("Usá una foto JPG, PNG o WebP de hasta 3 MB.");
      return;
    }
    setUploading(true);
    const manager = TurnitsGlobalSaveManager_get();
    manager?.setBlocker("perfil", "Esperá a que terminen de subir las fotos.");
    setError("");
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress(`Subiendo ${index + 1} de ${files.length}…`);
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
        updateDraft((f) =>
          destino === "fotos"
            ? { ...f, fotos: [...new Set([...f.fotos, d.url])] }
            : { ...f, [destino]: d.url },
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      setUploadProgress("");
      manager?.setBlocker("perfil", "");
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              TurnitsGlobalSaveManager_get()?.saveAll();
            }}
            className="negocio-card negocio-stack"
          >
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
              <section
                className="negocio-brand-grid"
                aria-label="Imágenes del perfil"
              >
                {(
                  [
                    ["foto_perfil_url", "Foto de perfil"],
                    ["banner_url", "Banner"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="negocio-brand-upload negocio-stack" key={key}>
                    <h3>{label}</h3>
                    <div
                      className={`negocio-brand-preview${key === "banner_url" ? " negocio-banner-preview" : ""}`}
                    >
                      {key === "foto_perfil_url" ? (
                        <BusinessAvatar
                          name={form.nombre || "Negocio"}
                          src={form.foto_perfil_url}
                          shape={formaIcono}
                        />
                      ) : (
                        form.banner_url && (
                          <img src={form.banner_url} alt="Banner del negocio" />
                        )
                      )}
                    </div>
                    <p className="negocio-muted">
                      {key === "foto_perfil_url"
                        ? "Se usa como ícono de tu negocio en el perfil y en la agenda."
                        : "Una imagen horizontal, sin texto agregado por Turnits."}
                    </p>
                    <div className="negocio-row">
                      <label
                        className={`negocio-button secondary${uploading || !imagenesHabilitadas ? " is-disabled" : ""}`}
                      >
                        {form[key] ? "Cambiar imagen" : "Subir imagen"}
                        <input
                          aria-label={`Subir ${label.toLowerCase()}`}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          disabled={uploading || !imagenesHabilitadas}
                          onChange={(e) => subir(e, key)}
                        />
                      </label>
                      {form[key] && (
                        <button
                          className="negocio-button secondary"
                          type="button"
                          aria-label={`Quitar ${label.toLowerCase()}`}
                          disabled={uploading || !imagenesHabilitadas}
                          onClick={() => change(key, "")}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
              {!imagenesHabilitadas && (
                <p className="negocio-muted">
                  Falta instalar la actualización de imágenes del perfil para
                  habilitar el banner, la foto de perfil y la galería ampliada.
                </p>
              )}
              <div className="negocio-grid">
                {(
                  [
                    ["nombre", "Nombre del negocio"],
                    ["categoria", "Rubro"],
                    ["ciudad", "Ciudad"],
                    ["provincia", "Provincia"],
                    ["direccion", "Dirección pública"],
                    ["telefono_publico", "Teléfono público"],
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
              <section className="negocio-redes-editor negocio-stack">
                <div>
                  <h3>Redes sociales</h3>
                  <p className="negocio-muted">
                    Completá sólo tu usuario en cada red, sin pegar el enlace.
                    Aparecen en «Sobre el negocio» y podés quitarlos cuando
                    quieras.
                  </p>
                </div>
                <div className="negocio-grid">
                  {SOCIAL_LINKS.map((red) => (
                    <SocialProfileField
                      key={red.key}
                      network={red}
                      value={
                        (red.key === "instagram"
                          ? form.instagram
                          : form.redes_sociales?.[red.key]) || ""
                      }
                      disabled={red.key !== "instagram" && !redesHabilitadas}
                      onChange={(value) =>
                        red.key === "instagram"
                          ? change("instagram", value)
                          : change("redes_sociales", {
                              ...form.redes_sociales,
                              [red.key]: value,
                            })
                      }
                    />
                  ))}
                </div>
                {!redesHabilitadas && (
                  <p className="negocio-muted">
                    Falta instalar la actualización de redes sociales para
                    habilitar los nuevos enlaces.
                  </p>
                )}
              </section>
              <div className="negocio-stack" style={{ gap: 10 }}>
                <div className="negocio-between">
                  <h3>Galería de fotos</h3>
                  <label
                    className="negocio-button secondary"
                    style={{
                      opacity: uploading ? 0.45 : 1,
                    }}
                  >
                    {" "}
                    {uploading ? "Subiendo…" : "+ Agregar fotos"}
                    <input
                      aria-label="Agregar fotos a la galería"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      multiple
                      disabled={uploading}
                      onChange={(e) => subir(e)}
                    />
                  </label>
                </div>
                <p className="negocio-muted">
                  Sin límite de cantidad. Podés seleccionar varias a la vez.
                  JPG, PNG o WebP, hasta 3 MB por imagen.
                </p>
                {uploadProgress && (
                  <p role="status" className="negocio-muted">
                    {uploadProgress}
                  </p>
                )}
                <div className="negocio-gallery">
                  {form.fotos.map((url, i) => (
                    <div className="negocio-photo" key={url}>
                      <img src={url} alt={`Foto ${i + 1}`} loading="lazy" />
                      <button
                        type="button"
                        aria-label={`Quitar foto ${i + 1}`}
                        disabled={uploading}
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
          </form>
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
  latitud: null as number | null,
  longitud: null as number | null,
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
        body: JSON.stringify(
          data.mapa_habilitado
            ? form
            : Object.fromEntries(
                Object.entries(form).filter(
                  ([key]) => !["latitud", "longitud"].includes(key),
                ),
              ),
        ),
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
      </div>
      {form && (
        <form className="negocio-card negocio-stack" onSubmit={guardar}>
          <h2>
            {form.id === "principal"
              ? "Editar sede principal"
              : form.id
                ? "Editar sucursal"
                : "Nueva sucursal"}
          </h2>
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
            <React.Suspense
              fallback={<p className="negocio-muted">Cargando mapa…</p>}
            >
              <LocationPicker
                latitud={form.latitud}
                longitud={form.longitud}
                disabled={busy || !data.mapa_habilitado}
                onChange={(point) =>
                  setForm({
                    ...form,
                    latitud: point?.latitud ?? null,
                    longitud: point?.longitud ?? null,
                  })
                }
              />
            </React.Suspense>
            {!data.mapa_habilitado && (
              <p className="negocio-muted">
                Falta instalar la actualización de mapas para guardar
                ubicaciones.
              </p>
            )}
            <div className="negocio-stack" style={{ gap: 10 }}>
              <h3>Miembros de esta sucursal</h3>
              <p className="negocio-muted">
                Cada profesional trabaja en una sede. Al moverlo, sus reservas
                anteriores conservan su sucursal.
                {form.id === "principal"
                  ? " Para quitar a alguien de la principal, asignalo desde otra sede."
                  : " Los que quites vuelven a la sede principal."}
              </p>
              <div className="negocio-grid">
                {data.equipo
                  .filter((m: any) => form.id === "principal" || !m.es_dueño)
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
                        disabled={form.id === "principal" && !m.sucursal_id}
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
                            {sede?.nombre ||
                              data.principal?.nombre ||
                              "Sede principal"}
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
                aria-label="Encargado de la sucursal"
                value={form.admin_equipo_id || ""}
                onChange={(e) =>
                  setForm({ ...form, admin_equipo_id: e.target.value || null })
                }
              >
                <option value="">La administra el dueño general</option>
                {data.equipo
                  .filter(
                    (m: any) =>
                      form.miembros.includes(m.id) &&
                      m.activo &&
                      m.login_email &&
                      !m.es_dueño,
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
        {[
          data.principal || {
            ...sucursalVacia,
            id: "principal",
            nombre: "Sede principal",
          },
          ...data.sucursales,
        ].map((s: any) => {
          const miembros = data.equipo.filter(
              (m: any) => (m.sucursal_id || "principal") === s.id,
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
                {s.id === "principal" && (
                  <p className="negocio-muted">Sede principal</p>
                )}
                <p className="negocio-muted">
                  {s.direccion || "Sin dirección configurada"}
                </p>
              </div>
              <p className="negocio-muted">
                {admin
                  ? `Encargado: ${admin.nombre} ${admin.apellido || ""}`
                  : "Administrada por el dueño general"}
              </p>
              <p className="negocio-muted">
                {s.latitud != null && s.longitud != null
                  ? "Ubicación marcada en el mapa"
                  : "Sin ubicación en el mapa"}
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
                disabled={
                  disabled ||
                  busy ||
                  (s.id === "principal" && !data.mapa_habilitado)
                }
                className="negocio-button secondary"
                onClick={() => {
                  setForm({
                    id: s.id,
                    nombre: s.nombre,
                    direccion: s.direccion,
                    activo: s.activo,
                    admin_equipo_id: s.admin_equipo_id,
                    miembros: miembros.map((m: any) => m.id),
                    latitud: s.latitud ?? null,
                    longitud: s.longitud ?? null,
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
                    disabled={!!m.es_dueño}
                    onClick={() =>
                      setServiciosMiembro(serviciosMiembro === m.id ? "" : m.id)
                    }
                  >
                    Servicios
                  </button>
                  {m.id !== myId && !m.es_dueño && (
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
