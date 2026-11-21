import { BackButton } from "../../components/BackButton"
import { LocationEditor } from "../../components/LocationEditor";
import LoadingRunner, { InlineLoading } from "../../components/LoadingRunner"
import { useBranchAdmin } from "../../components/BranchAdmin";
import * as React from "react";
import {
  MenuFooter_getSlug,
  MenuFooter_getToken,
  TurnitsGlobalSaveManager_get,
} from "./common";
import { TeamManager, TeamManager_ServiciosVinculados } from "./equipo";
import { ServiciosManager_RowMenu } from "./servicios";
import "./perfil.css";
const BranchMap = React.lazy(() => import("../../components/BranchMap").then((m) => ({ default: m.BranchMap })));
import "./perfil-publico.css";
import { SOCIAL_LINKS } from "../../shared/socials.js";
import { perfilVacio, perfilDraft } from "../../shared/profile-draft";
import { SocialProfileField } from "../../components/SocialProfileField";
import { BusinessAvatar } from "../../components/BusinessAvatar";

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
  if (!r.ok) throw new Error("No se pudo completar la solicitud (" + r.status + ").");
  if (!r.headers.get("content-type")?.includes("application/json")) throw new Error("Respuesta inesperada del servidor.");
  const d = await r.json();
  if (!r.ok || !d.success)
    throw new Error(d.error || "No se pudo completar la solicitud.");
  return d;
}
export { perfilVacio } from "../../shared/profile-draft";
function UbicacionPerfil({api, slug}: {api:string; slug:string}) {
  const [branches, setBranches] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState("principal");
  const [status, setStatus] = React.useState("Cargando ubicaciones…");
  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`${api}/sucursales/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!result.success || !Array.isArray(result.sucursales)) throw new Error();
        if (!controller.signal.aborted) { setBranches(result.sucursales.filter((s:any) => Number.isFinite(s.latitud) && Number.isFinite(s.longitud))); setStatus(""); }
      }).catch(() => { if (!controller.signal.aborted) setStatus("No pudimos cargar el mapa."); });
    return () => controller.abort();
  }, [api, slug]);
  const pins = branches.map((s:any) => ({ id:s.id, nombre: branches.length === 1 && s.id === "principal" ? "Local" : s.nombre, latitud:s.latitud, longitud:s.longitud }));
  return <section className="perfil-ubicacion"><h3>Ubicación</h3>
    {pins.length ? <React.Suspense fallback={<p className="negocio-muted">Cargando mapa…</p>}>
      <BranchMap pins={pins} selected={selected} onSelect={setSelected} label="Ubicaciones del negocio" />
    </React.Suspense> : <p className="negocio-muted" role="status">{status || "Configurá tu local en Sucursales para mostrarlo acá."}</p>}
    {branches.length > 1 && <div className="perfil-sede-lista">{branches.map((s:any) => <button type="button" key={s.id} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}>{s.nombre}<small>{s.direccion}</small></button>)}</div>}
  </section>;
}

export function PerfilNegocio({
  baseUrl,
  isMobile,
  publicaciones = false,
}: {
  publicaciones?: boolean;
  baseUrl: string;
  isMobile: boolean;
}) {
  const api = baseUrl.replace(/\/+$/, ""),
    slug = MenuFooter_getSlug();
  const [form, setForm] = React.useState(perfilVacio),
    [habilitado, setHabilitado] = React.useState(false),
    [redesHabilitadas, setRedesHabilitadas] = React.useState(false),
    [imagenesHabilitadas, setImagenesHabilitadas] = React.useState(false),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [uploading, setUploading] = React.useState(false),
    [uploadProgress, setUploadProgress] = React.useState(""),
    [servicios, setServicios] = React.useState<{ id: string; nombre: string }[]>([]),
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
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [api, slug]);
  React.useEffect(() => {
    if (!publicaciones) return;
    request(`${api}/admin/servicios/${slug}`)
      .then((data) => setServicios((data.servicios || []).map((service: any) => ({ id: service.id, nombre: service.nombre }))))
      .catch(() => setError("No pudimos cargar los servicios para las publicaciones."));
  }, [api, slug, publicaciones]);
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
        if (!r.ok || !r.headers.get("content-type")?.includes("application/json")) throw new Error("No se pudo subir la foto.");
        const d = await r.json();
        if (!d.success)
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
      {loading ? (
        <LoadingRunner card label="Cargando perfil…" />
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
            className="negocio-card negocio-stack perfil-workspace"
          >
            <fieldset
              disabled={!habilitado || busy}
              style={{ border: 0, padding: 0, margin: 0 }}
              className="negocio-stack"
            >
              {!publicaciones && <>
              <section className="perfil-branding" aria-label="Imágenes del perfil">
                {(
                  [
                    ["foto_perfil_url", "Foto de perfil"],
                    ["banner_url", "Banner"],
                  ] as const
                ).map(([key, label]) => (
                  <div className={`negocio-brand-upload negocio-stack perfil-brand-card perfil-brand-${key === "banner_url" ? "banner" : "avatar"}`} key={key}>
                    <h3>{label}</h3>
                    <div className="perfil-media-preview">
                      {key === "foto_perfil_url" ? (
                        <BusinessAvatar
                          name={form.nombre || "Negocio"}
                          src={form.foto_perfil_url}
                          shape="circular"
                        />
                      ) : (
                        form.banner_url ? (
                          <img src={form.banner_url} alt="Banner del negocio" />
                        ) : null
                      )}
                    </div>
                    <p className="negocio-muted">{key === "foto_perfil_url" ? "Se usa como ícono de tu negocio en el perfil y en la agenda." : "Una imagen horizontal, sin texto agregado por Turnits."}</p>
                    <div className="negocio-row perfil-media-buttons">
                      <label className="negocio-button secondary">{form[key] ? "Cambiar imagen" : "Subir imagen"}
                        <input aria-label={`Subir ${label.toLowerCase()}`} type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || !imagenesHabilitadas} onChange={e=>subir(e,key)} />
                      </label>
                      {form[key] && <button className="negocio-button secondary" type="button" disabled={uploading || !imagenesHabilitadas} onClick={()=>change(key,"")}>Quitar</button>}
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
              <div className="perfil-editor-grid">
              <section className="perfil-details-card">
                <h1>{form.nombre || "Tu negocio"}</h1>
                <UbicacionPerfil api={api} slug={slug}/>
                <label className="negocio-field perfil-description">
                  <span><strong>Descripción</strong><small>Contales a tus clientes qué ofrecés y qué hace especial a tu espacio.</small></span>
                  <textarea value={form.descripcion} maxLength={1500} onChange={e=>change("descripcion",e.target.value)} placeholder="Escribí una descripción clara y cercana…" />
                </label>
              </section>
              <section className="negocio-redes-editor negocio-stack perfil-social-card">
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
              </div>
              </>}
              {publicaciones && <>
                <div className="publicacion-intro"><div><span className="publicacion-eyebrow">Tu galería</span><h2>Publicaciones</h2><p>Mostrá tus trabajos y conectá cada foto con el servicio que ofrecés.</p></div><span className="publicacion-count">{form.fotos.length} publicaciones</span></div>
                {uploadProgress && <p role="status">{uploadProgress}</p>}
                <div className="publicacion-grid">
                  <label className="publicacion-upload">
                    <span aria-hidden="true">＋</span>{uploading ? "Subiendo…" : "Crear publicación"}<small>JPG, PNG o WebP · hasta 3 MB</small>
                    <input aria-label="Subir fotos" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading} onChange={e => subir(e)} />
                  </label>
                  {form.fotos.map((url, i) => (
                    <article className="publicacion-tile" key={url}>
                      <div className="publicacion-image"><img src={url} alt={form.publicaciones[url]?.descripcion || `Publicación ${i + 1}`} loading="lazy" /><button type="button" aria-label={`Quitar publicación ${i + 1}`} disabled={uploading} onClick={() => updateDraft(f => {
                        const titles = {...f.titulos_fotos};
                        delete titles[url];
                        const posts = {...f.publicaciones};
                        delete posts[url];
                        return {...f, titulos_fotos: titles, publicaciones: posts, fotos: f.fotos.filter(photo => photo !== url)};
                      })}>×</button></div>
                      <div className="publicacion-fields"><span className="publicacion-index">Publicación {i + 1}</span><label>Servicio<select value={form.publicaciones[url]?.servicio_id || ""} onChange={e => { const selected = servicios.find(service => service.id === e.target.value); change("publicaciones", {...form.publicaciones, [url]: { ...form.publicaciones[url], servicio_id: selected?.id || "", servicio_nombre: selected?.nombre || "", descripcion: form.publicaciones[url]?.descripcion || "" }}); }}><option value="">Elegí un servicio</option>{servicios.map(service => <option key={service.id} value={service.id}>{service.nombre}</option>)}</select></label><label>Descripción<textarea maxLength={1500} rows={3} placeholder="Contá qué se ve en esta foto…" value={form.publicaciones[url]?.descripcion ?? form.titulos_fotos[url] ?? ""} onChange={e => change("publicaciones", {...form.publicaciones, [url]: { servicio_id: form.publicaciones[url]?.servicio_id || "", servicio_nombre: form.publicaciones[url]?.servicio_nombre || "", descripcion: e.target.value }})} /></label></div>
                    </article>
                  ))}
                </div>
              </>}
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
                    Ver perfil público
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
  foto_url: null as string | null,
  activo: true,
  admin_equipo_id: null as string | null,
  miembros: [] as string[],
  latitud: null as number | null,
  longitud: null as number | null,
};
export function SucursalesNegocio({ baseUrl, iconoCheck, iconoEditar }: { baseUrl: string; iconoCheck?: string; iconoEditar?: string }) {
  const api = baseUrl.replace(/\/+$/, ""),
    slug = MenuFooter_getSlug();
  const [data, setData] = React.useState<any>(null),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [form, setForm] = React.useState<typeof sucursalVacia | null>(null),
    [menuId, setMenuId] = React.useState<string | null>(null),
    [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const menuAnchor = React.useRef<HTMLButtonElement>(null);
  const cargar = React.useCallback(
    () => request(`${api}/admin/sucursales/${slug}`).then(setData),
    [api, slug],
  );
  React.useEffect(() => {
    cargar().catch((e) => setError(e.message));
  }, [cargar]);
  const formKey = form ? form.id || "nueva" : null;
  React.useEffect(() => {
    if (!formKey || !form) return;
    const manager = TurnitsGlobalSaveManager_get();
    const pending = manager?.getPending("sucursales");
    manager?.setBaseline("sucursales", form);
    if (pending?.id === form.id) setForm({ ...form, ...pending });
    const unregister = manager?.registerSaveHandler("sucursales", async (draft: typeof sucursalVacia) => {
      if (draft.direccion && (draft.latitud === null || draft.longitud === null))
        throw new Error("Marcá la dirección en el mapa antes de guardar.");
      const result = await request(`${api}/admin/sucursales/${slug}`, {
        method: "PUT",
        body: JSON.stringify(data.mapa_habilitado
          ? Object.fromEntries(Object.entries(draft).filter(([key]) => key !== "foto_url" || data.fotos_habilitadas))
          : Object.fromEntries(Object.entries(draft).filter(([key]) => !["latitud", "longitud", "foto_url"].includes(key)))),
      });
      setData((previous:any) => ({ ...previous, ...result }));
      setForm(null);
    });
    const discard = () => setForm(null);
    window.addEventListener("turnits_global_discarded", discard);
    return () => { unregister?.(); window.removeEventListener("turnits_global_discarded", discard); };
  }, [formKey, api, slug, data?.mapa_habilitado, data?.fotos_habilitadas]);
  React.useEffect(() => {
    if (form) TurnitsGlobalSaveManager_get()?.markDirty("sucursales", form);
  }, [form]);
  const closeEditor = () => { TurnitsGlobalSaveManager_get()?.clear("sucursales"); setForm(null); };
  React.useEffect(() => {
    if (!menuId) return;
    const outside = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".svc-row-menu,.sucursal-menu-trigger")) {
        setMenuId(null);
        setConfirmDeleteId(null);
      }
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        menuAnchor.current?.focus();
        setMenuId(null);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuId]);
  async function eliminarSucursal(id: string) {
    setBusy(true);
    setError("");
    try {
      await request(`${api}/admin/sucursales/${slug}/${encodeURIComponent(id)}`, { method:"DELETE" });
      await cargar();
      setMenuId(null);
      setConfirmDeleteId(null);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function subirFoto(file: File | undefined) {
    if (!file || !form) return;
    if (file.size > 3 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Elegí una imagen JPG, PNG o WebP de hasta 3 MB.");
      return;
    }
    const body = new FormData();
    body.append("foto", file);
    setBusy(true); setError("");
    try {
      const res = await fetch(api + "/admin/perfil/" + encodeURIComponent(slug) + "/foto", {
        method: "POST", headers: {Authorization: "Bearer " + MenuFooter_getToken()}, body
      });
      if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) throw Error("No se pudo subir la foto.");
      const d = await res.json();
      if (!d.success || !d.url) throw Error("La carga de la foto quedó incompleta.");
      setForm(prev => prev && ({...prev, foto_url:d.url}));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (!data)
    return error ? <p className="negocio-error" role="alert">{error}</p> : <LoadingRunner card label="Cargando sucursales…" />;
  const locked = !data.premium,
    disabled = !data.habilitado;
  return (
    <div className="negocio-editor negocio-stack">
      <div className="sucursal-section-top">
        <div className="turnits-section-heading">
          <h1 className="turnits-section-heading-title">{locked ? "Local" : "Sucursales"}</h1>
          <p className="turnits-section-heading-subtitle">{locked ? "Configurá la ubicación de tu local." : "Administrá las sedes y sus profesionales."}</p>
        </div>
        {!form && (locked ? null : (
          <button
            type="button"
            className="negocio-button"
            disabled={disabled || busy}
            onClick={() => {
              setForm({ ...sucursalVacia, miembros: [] });
              setError("");
            }}
          >
            Crear +
          </button>
        ))}
      </div>
      {!data.habilitado && (
        <p className="negocio-muted">
          Falta instalar la actualización de Sucursales en la base de datos.
        </p>
      )}
      {form && locked ? <section className="negocio-card negocio-stack sucursal-editor">
        <div className="sucursal-editor-head"><h2>Local</h2><BackButton disabled={busy} onClick={closeEditor} aria-label="Volver" /></div>
        <LocationEditor key="local" value={form} onChange={(location) => setForm((previous) => previous ? { ...previous, ...location } : previous)} disabled={busy || !data.mapa_habilitado} />
      </section> : form && (
        <form className="negocio-card negocio-stack sucursal-editor" onSubmit={(event) => event.preventDefault()}>
          <div className="sucursal-editor-head"><h2>
            {form.id === "principal"
              ? "Editar sede principal"
              : form.id
                ? "Editar sucursal"
                : "Nueva sucursal"}
          </h2><BackButton disabled={busy} onClick={closeEditor} aria-label="Volver" /></div>
          <fieldset
            className="negocio-stack"
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0 }}
          >
            <section className="sucursal-columna"><div className="negocio-grid">
              <label className="negocio-field">
                Nombre de la sucursal
                <input
                  required
                  maxLength={80}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>
            </div>
            <LocationEditor key={form.id || "new"} value={form} onChange={(location) => setForm((previous) => previous ? { ...previous, ...location } : previous)} disabled={busy || !data.mapa_habilitado} />
            {!data.mapa_habilitado && (
              <p className="negocio-muted">
                Falta instalar la actualización de mapas para guardar
                ubicaciones.
              </p>
            )}
            <div className="negocio-stack" style={{ gap: 10 }}>
              <h3>Profesionales que trabajan aquí</h3>
              <p className="negocio-muted">
                Cada profesional trabaja en una sede. Al moverlo, sus reservas
                anteriores conservan su sucursal.
                {form.id === "principal"
                  ? " Para quitar a alguien de la principal, asignalo desde otra sede."
                  : " Los que quites vuelven a la sede principal."}
              </p>
              <div className="sucursal-profesionales">
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
                        <span className="sucursal-avatar" style={{background:m.color || "#536357"}}>
                          {m.foto_url ? <img src={m.foto_url} alt=""/> : [m.nombre,m.apellido].filter(Boolean).map(v => v[0]).join("")}
                          {selected && <b aria-hidden="true">{iconoCheck && <img src={iconoCheck} alt=""/>}</b>}
                        </span>
                        <span>{m.nombre} {m.apellido}<small>{sede?.nombre || data.principal?.nombre || "Sede principal"}{!m.activo && " · Inactivo"}</small></span>
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
            </section><section className="sucursal-columna">
            {data.fotos_habilitadas && <label className="negocio-field sucursal-photo-picker">Imagen de la sucursal
              <span className="sucursal-photo-preview">
                <span className="sucursal-photo-empty"><NegocioIcon kind="sucursal"/><strong>Sumá una imagen</strong><small>La tarjeta siempre conserva este espacio</small></span>
                {form.foto_url && <img src={form.foto_url} alt={"Foto de " + form.nombre} onError={e => { e.currentTarget.style.display = "none"; }}/>}
              </span>
              <input className="sucursal-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void subirFoto(file); }}/>
              <small className="sucursal-photo-hint">JPG, PNG o WebP · hasta 3 MB</small>
            </label>}
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
            <div className="negocio-row">
              <a className="negocio-button secondary" target="_blank" rel="noreferrer" href={window.location.pathname + "?" + new URLSearchParams({...Object.fromEntries(new URLSearchParams(window.location.search)),seccion:"equipo",vista:"miembros",nuevo:"1"})}>Crear acceso nuevo</a>
              <button type="button" className="negocio-button secondary" onClick={() => cargar().catch(e => setError(e.message))}>Actualizar profesionales</button>
            </div>
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
            </section>
          </fieldset>
        </form>
      )}
      {error && (
        <p className="negocio-error" role="alert">
          {error}
        </p>
      )}
      {!form && <div className="negocio-grid sucursal-listado">
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
            admin = miembros.find((m: any) => m.id === s.admin_equipo_id),
            reservas = Number.isInteger(s.reservas) ? s.reservas : 0;
          return (
            <article
              className="negocio-card sucursal-card"
              key={s.id}
              style={{ opacity: !s.activo ? 0.55 : 1 }}
            >
              <div className="sucursal-card-media">
                <div className="sucursal-photo-empty"><NegocioIcon kind="sucursal"/><strong>Sin imagen</strong></div>
                {s.foto_url && <img className="sucursal-foto" src={s.foto_url} alt={"Imagen de " + s.nombre} onError={e => { e.currentTarget.style.display = "none"; }}/>}
              <div className="sucursal-card-badges">
                  {s.id === "principal" && <span className="sucursal-principal">Principal</span>}
                </div>
                <span className="sucursal-reservas">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
                  <strong>{reservas.toLocaleString("es-AR")}</strong><small>{reservas === 1 ? "reserva" : "reservas"}</small>
                </span>
              </div>
              <div className="sucursal-card-body">
              <div className="sucursal-card-content">
                <h2>{locked && s.id === "principal" ? "Local" : s.nombre}</h2>
                <p className="negocio-muted">{s.direccion || "Agregá una dirección para que tus clientes ubiquen la sede."}</p>
                <div className="sucursal-quick-info"><span>{miembros.length} {miembros.length === 1 ? "profesional" : "profesionales"}</span><span>{s.latitud != null && s.longitud != null ? "Ubicación en el mapa" : "Ubicación pendiente"}</span></div>
              </div>
              <div className="sucursal-card-team">
              <strong>Equipo y encargado</strong>
              <p className="negocio-muted">{admin ? `Encargado: ${admin.nombre} ${admin.apellido || ""}` : "Administrada por el dueño general"}</p>
              <div className="sucursal-card-members">
                {miembros.map((m: any) => (
                  <span className="sucursal-member-tag" key={m.id}>{m.foto_url ? <img src={m.foto_url} alt=""/> : <span style={{background:m.color || "#536357"}}>{[m.nombre,m.apellido].filter(Boolean).map((v:string) => v[0]).join("")}</span>}{m.nombre}</span>
                ))}
                {!miembros.length && <p className="negocio-muted">Todavía no hay profesionales asignados.</p>}
              </div>
              </div>
              </div>
              <div className="sucursal-card-actions">
              <button
                type="button"
                disabled={
                  disabled ||
                  busy ||
                  (locked && s.id !== "principal") ||
                  (s.id === "principal" && !data.mapa_habilitado)
                }
                className="negocio-button secondary"
                onClick={() => {
                  setForm({
                    id: s.id,
                    nombre: locked && s.id === "principal" ? "Local" : s.nombre,
                    direccion: s.direccion,
                    foto_url: s.foto_url || null,
                    activo: s.activo,
                    admin_equipo_id: s.admin_equipo_id,
                    miembros: miembros.map((m: any) => m.id),
                    latitud: s.latitud ?? null,
                    longitud: s.longitud ?? null,
                  });
                  setError("");
                }}
              >
                {iconoEditar && <img src={iconoEditar} alt="" aria-hidden="true"/>}Editar
              </button>
              {!locked && s.id !== "principal" && <button type="button" className="sucursal-menu-trigger" ref={menuId === s.id ? menuAnchor : undefined} aria-label={`Opciones de ${s.nombre}`} aria-haspopup="menu" aria-expanded={menuId === s.id} disabled={disabled || busy} onClick={() => { setConfirmDeleteId(null); setMenuId(menuId === s.id ? null : s.id); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button>}
              {menuId === s.id && <ServiciosManager_RowMenu anchor={menuAnchor}>
                {confirmDeleteId === s.id ? <>
                  <span className="sucursal-delete-confirm">¿Eliminar esta sucursal?</span>
                  <button type="button" className="is-danger" disabled={busy} onClick={() => eliminarSucursal(s.id)}>Eliminar definitivamente</button>
                  <button type="button" disabled={busy} onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                </> : <button type="button" className="is-danger" disabled={busy} onClick={() => setConfirmDeleteId(s.id)}>Eliminar</button>}
              </ServiciosManager_RowMenu>}
              </div>
            </article>
          );
        })}
      </div>}
    </div>
  );
}
export function EquipoSecciones(props: any) {
  const branch = useBranchAdmin();
  return props.sucursales && !branch ? <SucursalesNegocio baseUrl={props.baseUrl} iconoCheck={props.iconoCheck} iconoEditar={props.iconoEditar}/> : <TeamManager {...props}/>;
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
        <LoadingRunner card label="Cargando sucursal…" />
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
                Crear +
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
                  <BackButton disabled={busy} onClick={() => setForm(null)} aria-label="Volver" />
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
