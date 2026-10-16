import * as React from "react";
import { iconRadius, type IconShape } from "../shared/appearance.js";

export function BusinessAvatar({
  name,
  src,
  shape,
  onOpen,
}: {
  name: string;
  src?: string;
  shape?: IconShape;
  onOpen?: () => void;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] || "")
      .join("")
      .toLocaleUpperCase("es-AR") || "N";
  const colors = ["#dcebe1", "#e2e8f2", "#f1e5dc", "#ece1ef", "#e4ecda"];
  const color =
    colors[
      Array.from(name).reduce(
        (sum, letter) => sum + (letter.codePointAt(0) || 0),
        0,
      ) % colors.length
    ];
  return (
    <span
      className="perfil-business-avatar"
      style={{ background: color, borderRadius: iconRadius(shape) }}
    >
      {src && !failed ? (
        <>
          <img
            src={src}
            alt={`Foto de perfil de ${name}`}
            onError={() => setFailed(true)}
          />
          {onOpen && (
            <button
              type="button"
              className="perfil-avatar-open"
              aria-label={`Ampliar foto de perfil de ${name}`}
              aria-haspopup="dialog"
              onClick={onOpen}
            />
          )}
        </>
      ) : (
        <span role="img" aria-label={`Iniciales de ${name}`}>
          {initials}
        </span>
      )}
    </span>
  );
}
