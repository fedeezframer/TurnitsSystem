import * as React from "react";
import LoadingRunner from "../../components/LoadingRunner";

// The surrounding SectionLoadingBoundary owns one loader across both the
// module download and the section's initial API requests.
function deferred(load: () => Promise<{ default: React.ComponentType<any> }>) {
  const Component = React.lazy(load);
  return function DeferredPanelSection(props: any) {
    return (
      <React.Suspense fallback={<LoadingRunner card />}>
        <Component {...props} />
      </React.Suspense>
    );
  };
}

export const ServiciosManager = deferred(() =>
  import("./servicios").then((m) => ({ default: m.ServiciosManager })),
);
export const ClientesGrid = deferred(() =>
  import("./clientes").then((m) => ({ default: m.ClientesGrid })),
);
export const AgendaPanel = deferred(() =>
  import("./agenda").then((m) => ({ default: m.AgendaPanel })),
);
export const HorariosConfig = deferred(() =>
  import("./horarios").then((m) => ({ default: m.HorariosConfig })),
);
export const ExcepcionesConfig = deferred(() =>
  import("./horarios").then((m) => ({ default: m.ExcepcionesConfig })),
);
export const PagosSettingsGuard = deferred(() =>
  import("./pagos").then((m) => ({ default: m.PagosSettingsGuard })),
);
export const MercadoPagoConexion = deferred(() =>
  import("./pagos").then((m) => ({ default: m.MercadoPagoConexion })),
);
export const ConfigPagos = deferred(() =>
  import("./pagos").then((m) => ({ default: m.ConfigPagos })),
);
export const FinanzasPanel = deferred(() =>
  import("./finanzas").then((m) => ({ default: m.FinanzasPanel })),
);
export const ThemeEditor = deferred(() =>
  import("./temas").then((m) => ({ default: m.ThemeEditor })),
);
export const EquipoSecciones = deferred(() =>
  import("./perfil").then((m) => ({ default: m.EquipoSecciones })),
);
export const SucursalEmpleado = deferred(() =>
  import("./perfil").then((m) => ({ default: m.SucursalEmpleado })),
);
export const PerfilEditor = deferred(() =>
  import("./perfil").then((m) => ({ default: m.PerfilNegocio })),
);

export const MisServiciosPanel = deferred(() =>
  import("./servicios").then((m) => ({ default: m.MisServiciosPanel })),
);
export const ProductosPanel = deferred(() =>
  import("./servicios").then((m) => ({ default: m.ProductosPanel })),
);
export const PromocionesPanel = deferred(() =>
  import("./servicios").then((m) => ({ default: m.PromocionesPanel })),
);
