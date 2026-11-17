import { BackButton } from "./BackButton";
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
      <BackButton floating style={{ top: 0, right: 0 }} aria-label="Cerrar imagen" onClick={() => ref.current?.close()} autoFocus />
      {failed ? (
        <p role="status">No pudimos cargar esta imagen.</p>
      ) : (
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      )}
    </dialog>,
    document.body,
  );
}
