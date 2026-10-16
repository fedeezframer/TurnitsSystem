import * as React from "react";
import {
  BranchPanelScope,
  getPanelScope,
  setBranchScheduleMember,
} from "../shared/panel-scope";
import { HorariosConfig, ExcepcionesConfig } from "../migrated/panel/horarios";
import { MenuFooterMiembro } from "../migrated/panel/cuenta";
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
  baseUrl,
  soporteUrl,
  iconos,
  accentColor = "#197128",
  mobile = false,
}: {
  logoutUrl?: string;
  baseUrl: string;
  soporteUrl: string;
  iconos?: Record<string, string>;
  accentColor?: string;
  mobile?: boolean;
}) {
  const branch = useBranchAdmin();
  const [member, setMember] = React.useState<any>(null);
  React.useEffect(() => {
    if (!branch?.equipo_id) return;
    let alive = true;
    fetch(
      `${baseUrl.replace(/\/+$/, "")}/admin/equipo/${encodeURIComponent(MenuFooter_getSlug())}`,
      {
        headers: { Authorization: `Bearer ${MenuFooter_getToken()}` },
        cache: "no-store",
      },
    )
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        return data.success
          ? data.equipo?.find((row: any) => row.id === branch.equipo_id)
          : null;
      })
      .then((row) => {
        if (alive) setMember(row);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [baseUrl, branch?.equipo_id]);
  const nombre = member
    ? `${member.nombre || ""} ${member.apellido || ""}`.trim()
    : branch?.nombre_admin || "Mi panel";
  return (
    <MenuFooterMiembro
      nombre={nombre}
      fotoUrl={member?.foto_url}
      color={member?.color || accentColor}
      iconos={iconos}
      soporteUrl={soporteUrl}
      onLogout={() => MenuFooter_cerrarSesion(logoutUrl)}
      mobile={mobile}
    />
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
