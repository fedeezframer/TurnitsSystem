export type BranchPanelScope = {
  id: string;
  registro_id: string;
  nombre: string;
  equipo_id: string;
  nombre_admin: string;
  scheduleMemberId?: string;
};
let scope: BranchPanelScope | null = null;
export const getPanelScope = () => scope;
export function setPanelScope(value: BranchPanelScope | null) {
  if (value) {
    let selected = value.equipo_id;
    try {
      selected =
        sessionStorage.getItem(
          `branch-schedule:${value.registro_id}:${value.equipo_id}`,
        ) || selected;
    } catch {}
    value = { ...value, scheduleMemberId: selected };
  }
  const changed =
    scope?.registro_id !== value?.registro_id ||
    scope?.equipo_id !== value?.equipo_id;
  scope = value;
  if (changed && typeof window !== "undefined")
    (window as any).__turnitsGlobalSaveManager = null;
}
export function setBranchScheduleMember(id: string) {
  if (!scope) return;
  scope.scheduleMemberId = id;
  try {
    sessionStorage.setItem(
      `branch-schedule:${scope.registro_id}:${scope.equipo_id}`,
      id,
    );
  } catch {}
  (window as any).__turnitsGlobalSaveManager = null;
  window.dispatchEvent(new CustomEvent("turnits_global_dirty_changed"));
}
