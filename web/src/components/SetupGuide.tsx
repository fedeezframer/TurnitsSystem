import React from "react";
import { selectStoredSession } from "../shared/session-startup";
import { fetchPanelRead } from "../shared/panel-requests";
import { setupProgress } from "../shared/setup-progress";
import "./SetupGuide.css";
import SetupArtwork, { type SetupStep } from "./SetupArtwork";

export default function SetupGuide({ baseUrl, onNavigate }: {
  baseUrl: string; onNavigate: (section: "servicios" | "horarios" | "pagos") => void;
}) {
  const [snapshot, setSnapshot] = React.useState<{ slug: string; progress: ReturnType<typeof setupProgress> } | null>(null);
  const [error, setError] = React.useState("");
  const [attempt, retry] = React.useReducer(value => value + 1, 0);
  React.useEffect(() => {
    const controller = new AbortController();
    const api = baseUrl.replace(/\/+$/, "");
    let pending = false;
    async function load() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      const session = selectStoredSession();
      if (!session?.slug || session.role !== "owner") {
        setSnapshot(null); setError("Volvé a iniciar sesión para revisar tu configuración."); pending = false; return;
      }
      try {
        const headers = { Authorization: `Bearer ${session.token}` };
        const responses = await Promise.all([
          fetchPanelRead(`${api}/settings/${encodeURIComponent(session.slug)}`, { headers, signal: controller.signal }),
          fetchPanelRead(`${api}/admin/servicios/${encodeURIComponent(session.slug)}`, { headers, signal: controller.signal }),
        ]);
        const [settings, catalog] = await Promise.all(responses.map(async response => {
          const data = await response.json();
          if (!response.ok || !data.success) throw Error("No pudimos revisar tu configuración.");
          return data;
        }));
        if (!settings.settings || !Array.isArray(catalog.servicios)) throw Error("Respuesta incompleta.");
        if (!controller.signal.aborted) {
          setSnapshot({ slug: session.slug, progress: setupProgress(settings.settings, catalog.servicios) }); setError("");
        }
      } catch {
        if (!controller.signal.aborted) { setSnapshot(null); setError("No pudimos revisar tu configuración. Tus datos guardados no se modificaron."); }
      } finally { pending = false; }
    }
    void load();
    window.addEventListener("focus", load);
    return () => { controller.abort(); window.removeEventListener("focus", load); };
  }, [baseUrl, attempt]);
  if (!snapshot && !error) return null;
  if (snapshot?.progress.ready) return null;
  const next = snapshot?.progress.steps.find(step => !step.done);
  const titles: Record<string, string> = { servicios: "Sumá tu primer servicio", horarios: "Definí tus horarios", pagos: "Configurá tus cobros" };
  const actions: Record<string, string> = { servicios: "Agregar servicio", horarios: "Elegir horarios", pagos: "Ir a Pagos" };
  const artStep = !error && !snapshot?.progress.paused ? next?.id as SetupStep | undefined : undefined;
  return <section className="setup-guide" aria-labelledby="setup-guide-title" aria-busy={!snapshot && !error} data-completed={snapshot?.progress.completed} data-step={artStep}>
    <SetupArtwork step={artStep} className="setup-guide-art" />
    <div className="setup-guide-surface">
    <div className="setup-guide-main">
      <div>
        <h2 id="setup-guide-title">{error ? "No pudimos revisar tu agenda" : snapshot?.progress.paused ? "Revisá el estado de tu cuenta" : next ? titles[next.id] : "Tu agenda está lista"}</h2>
        <p className="setup-guide-description" role={error ? "alert" : !snapshot ? "status" : undefined}>
          {error ? "Intentá de nuevo para continuar." : snapshot?.progress.paused
            ? "Tu cuenta figura pausada o vencida. Revisala desde el menú de tu cuenta."
            : next ? next.description : "Estamos consultando tu configuración."}
        </p>
      </div>
      {error ? <button className="setup-guide-action" type="button" onClick={retry}>Reintentar</button>
        : next && !snapshot?.progress.paused && <button className="setup-guide-action" type="button" onClick={() => onNavigate(next.id as "servicios" | "horarios" | "pagos")}>
          {actions[next.id]}
        </button>}
    </div>
    </div>
  </section>;
}
