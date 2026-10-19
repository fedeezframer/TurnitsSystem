// Share the same dynamic imports with React.lazy, so a session check can warm
// its destination without mounting it or making authenticated data requests.
export const loadPanel = () => import("../migrated/panel");
export const loadBrowse = () => import("../pages/Browse");

export function preloadSessionDestination(role: string) {
  void (role === "consumidor" ? loadBrowse() : loadPanel()).catch(() => {});
}
