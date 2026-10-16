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

  React.useEffect(() => {
    if (loading || !enabled) return;
    TurnitsGlobalSaveManager_get()?.markDirty("tema", tema);
  }, [tema, loading, enabled]);
  React.useEffect(() => {
    const onSaved = (e: any) => {
      if (e.detail?.section !== "tema") return;
      const full = ThemeEditor_temaCompleto(e.detail.data);
      setTema(
        ThemeEditor_temaCompleto(
          TurnitsGlobalSaveManager_get()?.getPending("tema") || full,
        ),
      );
    };
    window.addEventListener("turnits_global_saved", onSaved);
    return () => window.removeEventListener("turnits_global_saved", onSaved);
  }, []);

  const update = (values: Partial<ThemeEditor_Tema>) => {
    setTema((t) => ({ ...t, ...values }));
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
        disabled={!enabled}
        style={!enabled ? TurnitsLockedStyle : undefined}
        className="te-fields"
      >
        <section className="te-section">
          <h3>Colores</h3>
          <p>Elegí una paleta clara para tu negocio.</p>
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
      {error && (
        <p role="alert" className="te-error">
          {error}
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
