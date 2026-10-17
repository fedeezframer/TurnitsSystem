import * as React from "react";
import {
  TurnitsGlobalSaveManager_get,
  ServiciosManager_getSlug,
  ServiciosManager_getToken,
} from "./common";
import "./browse-config.css";
const id = () => crypto.randomUUID();
export default function BrowseBusiness({
  api,
  view,
}: {
  api: string;
  view: "offers" | "coins";
}) {
  const [data, setData] = React.useState<any>(null),
    [draft, setDraft] = React.useState<any>({ offers: [], recompensas: [] }),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [reload, setReload] = React.useState(0);
  const ref = React.useRef(draft),
    slug = ServiciosManager_getSlug();
  const update = (fn: (d: any) => any) => {
    const manager = TurnitsGlobalSaveManager_get();
    const next = fn({ ...ref.current, ...manager?.getPending("browse") });
    ref.current = next;
    setDraft(next);
    manager?.markDirty("browse", next);
  };
  React.useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(`${api}/admin/browse/${slug}`, {
      headers: { Authorization: `Bearer ${ServiciosManager_getToken()}` },
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success)
          throw new Error(d.error || "No pudimos cargar esta configuración.");
        const manager = TurnitsGlobalSaveManager_get(),
          baseline = { offers: d.offers, recompensas: d.recompensas };
        manager?.setBaseline("browse", baseline);
        const next = { ...baseline, ...manager?.getPending("browse") };
        ref.current = next;
        setData(d);
        setDraft(next);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [api, slug, reload]);
  React.useEffect(() => {
    const state = (e: any) => setBusy(!!e.detail?.saving);
    const saved = (e: any) => {
      if (e.detail?.section !== "browse") return;
      const next = {
        ...e.detail.data,
        ...TurnitsGlobalSaveManager_get()?.getPending("browse"),
      };
      ref.current = next;
      setDraft(next);
      setError("");
    };
    window.addEventListener("turnits_global_save_state", state);
    window.addEventListener("turnits_global_saved", saved);
    return () => {
      window.removeEventListener("turnits_global_save_state", state);
      window.removeEventListener("turnits_global_saved", saved);
    };
  }, []);
  const patch = (key: string, index: number, values: any) =>
    update((d) => ({
      ...d,
      [key]: d[key].map((row: any, i: number) =>
        i === index ? { ...row, ...values } : row,
      ),
    }));
  if (error)
    return (
      <div className="browse-business">
        <p role="alert">{error}</p>
        <button onClick={() => setReload((v) => v + 1)}>Reintentar</button>
      </div>
    );
  if (!data) return <p role="status">Cargando configuración…</p>;
  const services = data.servicios.filter(
      (s: any) => s.activo === true || s.activo === "true",
    ),
    members = data.equipo.filter((m: any) => m.activo),
    products = data.productos.filter(
      (p: any) => p.activo === true || p.activo === "true",
    );
  return (
    <section className="browse-business">
      <h3>{view === "offers" ? "Turnits Offers" : "Turnits T-Coins"}</h3>
      {view === "offers" ? (
        <>
          <p>
            Ofrecé horarios sin ocupar en la última hora antes del cierre de
            reservas. Se respeta la antelación de cada profesional y sólo se
            publica si Mercado Pago está conectado.
          </p>
          <p>
            El descuento usa el 20% de la diferencia con tu tarifa mínima;
            cuando quedan 30 minutos usa el 60%, y en los últimos 15 llega al
            mínimo. Nunca se combinan otras promociones.
          </p>
          {draft.offers.map((o: any, i: number) => (
            <fieldset key={o.id} disabled={busy}>
              <legend>Offer {i + 1}</legend>
              <div className="browse-business-fields">
                <label>
                  Servicio
                  <select
                    value={o.servicio_id}
                    onChange={(e) =>
                      patch("offers", i, { servicio_id: e.target.value })
                    }
                  >
                    <option value="">Elegí un servicio</option>
                    {services.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Profesional
                  <select
                    value={o.equipo_id}
                    onChange={(e) =>
                      patch("offers", i, { equipo_id: e.target.value })
                    }
                  >
                    <option value="">Elegí un profesional</option>
                    {members.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} {m.apellido}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tarifa mínima ($)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={o.precio_minimo || ""}
                    onChange={(e) =>
                      patch("offers", i, {
                        precio_minimo: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="browse-business-toggle">
                <input
                  type="checkbox"
                  checked={o.activo}
                  onChange={(e) =>
                    patch("offers", i, { activo: e.target.checked })
                  }
                />
                Habilitar esta Offer
              </label>
              <button
                className="browse-business-remove"
                onClick={() =>
                  update((d) => ({
                    ...d,
                    offers: d.offers.filter(
                      (_: any, index: number) => index !== i,
                    ),
                  }))
                }
              >
                Quitar configuración
              </button>
            </fieldset>
          ))}
          <button
            disabled={busy || !services.length || !members.length}
            onClick={() =>
              update((d) => ({
                ...d,
                offers: [
                  ...d.offers,
                  {
                    id: id(),
                    servicio_id: "",
                    equipo_id: "",
                    precio_minimo: 0,
                    activo: false,
                  },
                ],
              }))
            }
          >
            Agregar Offer
          </button>
        </>
      ) : (
        <>
          <p>
            Los usuarios reciben 1 T-Coin por cada $10.000 efectivamente pagados
            online en Turnits. Los importes se acumulan entre reservas y
            negocios.
          </p>
          <p>
            Elegí qué ofrecés a cambio de monedas. Los canjes no generan
            comisión de Turnits; los importes adicionales se abonan en el local.
            Los productos siempre requieren reservar un servicio.
          </p>
          {draft.recompensas.map((r: any, i: number) => (
            <fieldset key={r.id} disabled={busy}>
              <legend>Recompensa {i + 1}</legend>
              <div className="browse-business-fields">
                <label>
                  Nombre
                  <input
                    maxLength={100}
                    value={r.nombre}
                    onChange={(e) =>
                      patch("recompensas", i, { nombre: e.target.value })
                    }
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={r.tipo}
                    onChange={(e) =>
                      patch("recompensas", i, {
                        tipo: e.target.value,
                        objeto_id: "",
                        servicio_id: "",
                        copago: 0,
                      })
                    }
                  >
                    <option value="servicio">
                      Servicio o descuento en un servicio
                    </option>
                    <option value="producto">
                      Producto al consumir un servicio
                    </option>
                  </select>
                </label>
                <label>
                  {r.tipo === "servicio" ? "Servicio" : "Producto"}
                  <select
                    value={r.objeto_id}
                    onChange={(e) =>
                      patch("recompensas", i, {
                        objeto_id: e.target.value,
                        ...(r.tipo === "servicio"
                          ? { servicio_id: e.target.value }
                          : {}),
                      })
                    }
                  >
                    <option value="">Elegí un elemento</option>
                    {(r.tipo === "servicio" ? services : products).map(
                      (s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {r.tipo === "producto" && (
                  <label>
                    Servicio que debe consumir
                    <select
                      value={r.servicio_id}
                      onChange={(e) =>
                        patch("recompensas", i, { servicio_id: e.target.value })
                      }
                    >
                      <option value="">Elegí un servicio</option>
                      {services.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  T-Coins requeridos
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value={r.monedas}
                    onChange={(e) =>
                      patch("recompensas", i, {
                        monedas: Number(e.target.value),
                      })
                    }
                  />
                </label>
                {r.tipo === "servicio" && (
                  <label>
                    Importe adicional en el local ($)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.copago}
                      onChange={(e) =>
                        patch("recompensas", i, {
                          copago: Number(e.target.value),
                        })
                      }
                    />
                    <small>
                      Dejá 0 para un servicio completo a cambio de monedas.
                    </small>
                  </label>
                )}
                <label>
                  Unidades disponibles
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Sin límite"
                    value={r.stock ?? ""}
                    onChange={(e) =>
                      patch("recompensas", i, {
                        stock:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="browse-business-toggle">
                <input
                  type="checkbox"
                  checked={r.activo}
                  onChange={(e) =>
                    patch("recompensas", i, { activo: e.target.checked })
                  }
                />
                Publicar recompensa
              </label>
              <button
                className="browse-business-remove"
                onClick={() =>
                  update((d) => ({
                    ...d,
                    recompensas: d.recompensas.filter(
                      (_: any, index: number) => index !== i,
                    ),
                  }))
                }
              >
                Quitar recompensa
              </button>
            </fieldset>
          ))}
          <button
            disabled={busy || !services.length}
            onClick={() =>
              update((d) => ({
                ...d,
                recompensas: [
                  ...d.recompensas,
                  {
                    id: id(),
                    nombre: "",
                    tipo: "servicio",
                    objeto_id: "",
                    servicio_id: "",
                    monedas: 1,
                    copago: 0,
                    stock: null,
                    activo: false,
                  },
                ],
              }))
            }
          >
            Agregar recompensa
          </button>
        </>
      )}
      {!services.length && (
        <p>Primero creá un servicio y asignalo a un profesional.</p>
      )}
      <p className="browse-business-save-note">
        Los cambios se aplican con el botón global Guardar cambios.
      </p>
    </section>
  );
}
