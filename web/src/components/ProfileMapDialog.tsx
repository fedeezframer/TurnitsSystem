import * as React from "react";
import { createPortal } from "react-dom";
import type { MapBranch } from "./BranchMap";
const BranchMap = React.lazy(() =>
  import("./BranchMap").then((m) => ({ default: m.BranchMap })),
);
export function ProfileMapDialog({
  location,
  onClose,
}: {
  location: MapBranch;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null),
    title = React.useId();
  React.useEffect(() => {
    const dialog = ref.current,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  const pins = React.useMemo(
    () => [
      {
        id: location.id,
        nombre: location.nombre,
        latitud: location.latitud!,
        longitud: location.longitud!,
      },
    ],
    [location],
  );
  return createPortal(
    <dialog
      className="perfil-map-dialog"
      ref={ref}
      aria-labelledby={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            e.currentTarget.close();
        }
      }}
    >
      <header>
        <div>
          <span>Ubicación</span>
          <h2 id={title}>{location.nombre}</h2>
          {location.direccion && <p>{location.direccion}</p>}
        </div>
        <button
          type="button"
          aria-label="Cerrar mapa"
          onClick={() => ref.current?.close()}
          autoFocus
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <React.Suspense
        fallback={
          <p className="perfil-dialog-loading" role="status">
            Cargando mapa…
          </p>
        }
      >
        <BranchMap
          pins={pins}
          selected={location.id}
          expanded
          label={`Mapa ampliado de ${location.nombre}`}
        />
      </React.Suspense>
    </dialog>,
    document.body,
  );
}
