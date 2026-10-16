import * as React from "react";
import {
  BranchPanelScope,
  getPanelScope,
  setBranchScheduleMember,
} from "../shared/panel-scope";
import { HorariosConfig, ExcepcionesConfig } from "../migrated/panel/horarios";
import {
  MenuFooter_cerrarSesion,
  MenuFooter_getToken,
  MenuFooter_getSlug,
  TurnitsGlobalSaveManager_get,
} from "../migrated/panel/common";
export const BranchAdminContext = React.createContext<BranchPanelScope | null>(
  null,
);
export const useBranchAdmin = () => React.useContext(BranchAdminContext);
export function OwnerOnly({ children }: { children: React.ReactNode }) {
  return useBranchAdmin() ? null : <>{children}</>;
}
export function BranchAccountFooter({
  logoutUrl = "/login",
}: {
  logoutUrl?: string;
}) {
  const branch = useBranchAdmin();
  return (
    <div
      style={{
        marginTop: "auto",
        padding: "18px 12px",
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 13 }}>
          {branch?.nombre_admin}
        </strong>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          Administrador · {branch?.nombre}
        </span>
      </div>
      <button
        type="button"
        aria-label="Cerrar sesión"
        onClick={() => MenuFooter_cerrarSesion(logoutUrl)}
        style={{
          border: "1px solid #e2e8f0",
          background: "#fff",
          borderRadius: 9,
          width: 34,
          height: 34,
          cursor: "pointer",
          color: "#334155",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M9 4H4v16h5M12 12h9m-4-4 4 4-4 4" />
        </svg>
      </button>
    </div>
  );
}
export function BranchSchedule({
  baseUrl,
  accentColor,
}: {
  baseUrl: string;
  accentColor: string;
}) {
  const branch = useBranchAdmin();
  const [members, setMembers] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState(
    getPanelScope()?.scheduleMemberId || branch?.equipo_id || "",
  );
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    fetch(
      `${baseUrl}/admin/equipo/${encodeURIComponent(MenuFooter_getSlug())}`,
      { headers: { Authorization: `Bearer ${MenuFooter_getToken()}` } },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success)
          throw Error(d.error || "No se pudo cargar el equipo.");
        return d.equipo;
      })
      .then((rows) => {
        if (!alive) return;
        const editable = rows.filter((m: any) => !m.es_dueño);
        setMembers(editable);
        if (!editable.some((m: any) => m.id === selected)) {
          const id = editable[0]?.id || "";
          setBranchScheduleMember(id);
          setSelected(id);
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [baseUrl]);
  React.useEffect(() => {
    TurnitsGlobalSaveManager_get()?.configure(baseUrl);
    const update = () =>
      setPending(!!TurnitsGlobalSaveManager_get()?.hasDirty());
    update();
    window.addEventListener("turnits_global_dirty_changed", update);
    window.addEventListener("turnits_global_save_state", update);
    return () => {
      window.removeEventListener("turnits_global_dirty_changed", update);
      window.removeEventListener("turnits_global_save_state", update);
    };
  }, [baseUrl, selected]);
  const settingsUrl = `${baseUrl}/admin/equipo/${encodeURIComponent(selected)}/config`;
  return (
    <div className="negocio-stack">
      {error && (
        <p role="alert" className="negocio-error">
          {error}
        </p>
      )}
      <label className="negocio-field">
        Profesional de la sucursal
        <select
          aria-label="Profesional de la sucursal"
          value={selected}
          disabled={pending || !members.length}
          onChange={(e) => {
            setBranchScheduleMember(e.target.value);
            setSelected(e.target.value);
          }}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre} {m.apellido}
            </option>
          ))}
        </select>
      </label>
      {pending && (
        <p className="negocio-muted">
          Guardá los cambios antes de elegir otro profesional.
        </p>
      )}
      {!!members.length && selected && (
        <React.Fragment key={selected}>
          <HorariosConfig
            baseUrl={baseUrl}
            accentColor={accentColor}
            settingsUrl={settingsUrl}
            mostrarBotonGuardar={false}
          />
          <ExcepcionesConfig
            baseUrl={baseUrl}
            accentColor={accentColor}
            settingsUrl={settingsUrl}
          />
        </React.Fragment>
      )}
    </div>
  );
}
