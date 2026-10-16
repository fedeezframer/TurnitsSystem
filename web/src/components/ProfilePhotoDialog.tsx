import * as React from "react";
import { createPortal } from "react-dom";
import "./ProfilePhotoDialog.css";

export function ProfilePhotoDialog({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="perfil-photo-dialog"
      aria-label={alt}
      onClose={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < b.left ||
          e.clientX > b.right ||
          e.clientY < b.top ||
          e.clientY > b.bottom
        )
          e.currentTarget.close();
      }}
    >
      <button
        className="perfil-photo-close"
        type="button"
        aria-label="Cerrar imagen"
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
      {failed ? (
        <p role="status">No pudimos cargar esta imagen.</p>
      ) : (
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      )}
    </dialog>,
    document.body,
  );
}
