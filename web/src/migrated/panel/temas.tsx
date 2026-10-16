import * as React from "react";
import { appConfig } from "../../config";
import {
  ThemeEditor_cardBase,
  ThemeEditor_PALETAS,
  ThemeEditor_Tema,
  ThemeEditor_getSlug,
  ThemeEditor_getToken,
  ThemeEditor_TEMA_DEFAULT,
  TurnitsResolveAccountPlan,
  ThemeEditor_temaCompleto,
  TurnitsGlobalSaveManager_get,
  ThemeEditor_mismoTema,
  TurnitsLockedStyle,
} from "./common";
import { TurnitsPlanRequirement } from "./shared";
import { UploadPlaceholderIcon } from "./inicio";
import {
  CARD_SHAPES,
  ICON_SHAPES,
  appearanceChanges,
} from "../../shared/appearance.js";
import "./temas.css";

const COLORS = [
  ["primario", "Color principal"],
  ["secundario", "Color secundario"],
  ["fondo", "Fondo"],
  ["texto", "Texto"],
  ["acento", "Acento"],
] as const;

function ThemeEditor({
  baseUrl = appConfig.apiUrl,
  accentColor = "#197128",
  style,
  onOpenProfile,
}: {
  baseUrl?: string;
  accentColor?: string;
  style?: React.CSSProperties;
  onOpenProfile?: () => void;
}) {
  const api = baseUrl.replace(/\/+$/, "");
  const [loading, setLoading] = React.useState(true),
    [enabled, setEnabled] = React.useState(false),
    [tema, setTema] = React.useState<ThemeEditor_Tema>(
      ThemeEditor_TEMA_DEFAULT,
    ),
    [baseline, setBaseline] = React.useState<ThemeEditor_Tema>(
      ThemeEditor_TEMA_DEFAULT,
    ),
    [busy, setBusy] = React.useState(false),
    [saved, setSaved] = React.useState(false),
    [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true,
      tries = 0,
      timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const slug = ThemeEditor_getSlug(),
        token = ThemeEditor_getToken();
      if (!slug || !token) {
        if (++tries < 10) timer = setTimeout(load, 300);
        else if (alive) {
          setLoading(false);
          setError("Iniciá sesión para editar la apariencia.");
        }
        return;
      }
      try {
        const r = await fetch(`${api}/admin/tema/${slug}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (r.status === 401) {
          if (alive) {
            setError("Sesión expirada");
            setLoading(false);
          }
          return;
        }
        const d = await r.json();
        if (!r.ok || !d.success)
          throw new Error(d.error || "No se pudo cargar la apariencia.");
        const plan = await TurnitsResolveAccountPlan(api, slug, token, d);
        if (!alive) return;
        const full = ThemeEditor_temaCompleto(d.tema);
        setEnabled(["basico", "premium"].includes(plan));
        setBaseline(full);
        const manager = TurnitsGlobalSaveManager_get();
        manager?.setBaseline("tema", full);
        const pending = manager?.getPending("tema");
        setTema(
          pending ? ThemeEditor_temaCompleto({ ...full, ...pending }) : full,
        );
        setLoading(false);
      } catch (e: any) {
        if (!alive) return;
        if (++tries < 3) timer = setTimeout(load, 300);
        else {
          setLoading(false);
          setError(e.message || "No se pudo cargar la apariencia.");
        }
      }
    };
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [api]);

  const dirty = !ThemeEditor_mismoTema(tema, baseline);
  React.useEffect(() => {
    if (loading || !enabled) return;
    const manager = TurnitsGlobalSaveManager_get();
    if (dirty) manager?.markDirty("tema", tema);
    else if (manager?.isDirty("tema")) manager.clear("tema");
  }, [dirty, tema, loading, enabled]);
  React.useEffect(() => {
    const onSaved = (e: any) => {
      if (e.detail?.section === "tema") setBaseline({ ...tema });
    };
    window.addEventListener("turnits_global_saved", onSaved);
    return () => window.removeEventListener("turnits_global_saved", onSaved);
  }, [tema]);

  const update = (values: Partial<ThemeEditor_Tema>) => {
    setTema((t) => ({ ...t, ...values }));
    setSaved(false);
  };
  const save = async () => {
    if (busy || !enabled || !dirty) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch(`${api}/admin/tema/${ThemeEditor_getSlug()}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ThemeEditor_getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tema),
      });
      const d = await r.json();
      if (!r.ok || !d.success)
        throw new Error(d.error || "No se pudo guardar la apariencia.");
      const full = ThemeEditor_temaCompleto(d.tema || tema);
      setTema(full);
      setBaseline(full);
      setSaved(true);
      const manager = TurnitsGlobalSaveManager_get();
      manager?.setBaseline("tema", full);
      manager?.clear("tema");
    } catch (e: any) {
      setError(e.message || "Error de red.");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div style={{ ...ThemeEditor_cardBase, ...style }} role="status">
        Cargando apariencia…
      </div>
    );
  if (error && !enabled)
    return (
      <div style={{ ...ThemeEditor_cardBase, ...style }}>
        <p role="alert" className="te-error">
          {error}
        </p>
        <button
          type="button"
          className="te-button"
          onClick={() => window.location.reload()}
        >
          Volver a cargar
        </button>
      </div>
    );
  const accent = /^#[\da-f]{6}$/i.test(tema.primario)
    ? tema.primario
    : accentColor;
  return (
    <div
      className="te-editor"
      style={
        {
          ...ThemeEditor_cardBase,
          ...style,
          height: "auto",
          "--te-accent": accent,
        } as React.CSSProperties
      }
    >
      <div className="te-heading">
        <div>
          <h2>Apariencia</h2>
          <p>Colores y formas de tu agenda y tu perfil público.</p>
        </div>
        {!enabled && <TurnitsPlanRequirement />}
      </div>
      <div className="te-photo-note">
        <span>La foto del negocio se cambia desde Perfil.</span>
        {onOpenProfile && (
          <button type="button" onClick={onOpenProfile}>
            Editar foto ↗
          </button>
        )}
      </div>
      <fieldset
        disabled={!enabled || busy}
        style={!enabled ? TurnitsLockedStyle : undefined}
        className="te-fields"
      >
        <section className="te-section">
          <h3>Colores</h3>
          <p>Elegí una paleta o ajustá cada color.</p>
          <div className="te-palettes">
            {ThemeEditor_PALETAS.map((p) => (
              <button
                key={p.nombre}
                type="button"
                className="te-palette"
                aria-pressed={ThemeEditor_mismoTema(
                  { ...tema, ...p.tema },
                  tema,
                )}
                onClick={() => update(p.tema)}
              >
                <span aria-hidden="true" className="te-palette-dots">
                  <i style={{ background: p.tema.primario }} />
                  <i style={{ background: p.tema.acento }} />
                  <i style={{ background: p.tema.fondo }} />
                </span>
                {p.nombre}
              </button>
            ))}
          </div>
          <div className="te-colors">
            {COLORS.map(([key, label]) => (
              <div className="te-color-field" key={key}>
                <label
                  className="te-color-swatch"
                  style={{ background: tema[key] }}
                >
                  <span className="te-sr-only">{label}</span>
                  <input
                    aria-label={`${label} (selector)`}
                    type="color"
                    value={
                      /^#[\da-f]{6}$/i.test(tema[key]) ? tema[key] : "#000000"
                    }
                    onChange={(e) => update({ [key]: e.target.value })}
                  />
                </label>
                <label>
                  <span>{label}</span>
                  <input
                    aria-label={`${label} (HEX)`}
                    type="text"
                    spellCheck={false}
                    maxLength={7}
                    value={tema[key]}
                    onChange={(e) => {
                      if (/^#[\da-f]{0,6}$/i.test(e.target.value))
                        update({ [key]: e.target.value });
                    }}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
        {(
          [
            [
              "forma_tarjetas",
              "Forma de las tarjetas",
              "Se aplica a las tarjetas de la agenda y del perfil público.",
              CARD_SHAPES,
            ],
            [
              "forma_icono",
              "Forma del ícono",
              "Usa la foto cargada en Perfil.",
              ICON_SHAPES,
            ],
          ] as const
        ).map(([key, title, hint, options]) => (
          <section className="te-section" key={key}>
            <h3>{title}</h3>
            <p>{hint}</p>
            <div className="te-shapes" role="group" aria-label={title}>
              {options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className="te-shape"
                  aria-pressed={(tema[key] || "original") === option.value}
                  onClick={() =>
                    update(appearanceChanges({ [key]: option.value }))
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`te-shape-sample${key === "forma_icono" ? " te-icon-sample" : ""}`}
                    style={{
                      borderRadius:
                        option.radius ||
                        (key === "forma_icono" ? "12px" : "6px"),
                    }}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </fieldset>
      {enabled && (
        <button
          type="button"
          className="te-button"
          onClick={save}
          disabled={busy || !dirty}
        >
          {busy ? "Guardando…" : "Guardar apariencia"}
        </button>
      )}
      {error && (
        <p role="alert" className="te-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="te-success">
          Apariencia guardada.
        </p>
      )}
    </div>
  );
}

function TeamManager_PlaceholderIcon({
  src,
  size = 24,
}: {
  src?: string;
  size?: number;
}) {
  if (!src) return <UploadPlaceholderIcon size={size} />;
  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, objectFit: "contain", opacity: 0.5 }}
    />
  );
}
export { ThemeEditor, TeamManager_PlaceholderIcon };
