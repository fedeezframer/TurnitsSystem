import * as React from "react";
import { motion } from "framer-motion";
import type { SeccionId } from "./common";

const NAV_ICONS: Record<SeccionId, React.ReactElement> = {
  perfil: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8 17c0-4 8-4 8 0" />
    </>
  ),
  inicio: (
    <path d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
  ),
  servicios: (
    <>
      <circle cx="7" cy="7" r="3" />
      <circle cx="7" cy="17" r="3" />
      <path d="M9.5 8.8 20 20M20 4 9.5 15.2" />
    </>
  ),
  consultas: (
    <>
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5A7.5 7.5 0 1 1 20 11.5Z" />
      <path d="M8 11h8M8 14.5h5" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.8 5.5-5.8s5.5 2.5 5.5 5.8" />
      <path d="M15.5 5.5a3.2 3.2 0 0 1 0 6.2" />
      <path d="M17.5 14.5c2.4.5 3.9 2.6 3.9 5.5" />
    </>
  ),
  agenda: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="8.2" cy="14.2" r="1" />
      <circle cx="12" cy="14.2" r="1" />
      <circle cx="15.8" cy="14.2" r="1" />
    </>
  ),
  horarios: (
    <>
      <circle cx="12" cy="12.5" r="8.2" />
      <path d="M12 8v4.7l3.2 2" />
    </>
  ),
  pagos: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.3h18" />
      <path d="M7 14.7h4" />
    </>
  ),
  finanzas: (
    <>
      <path d="M4 19V5M4 19h17" />
      <path d="m7 15 4-4 3 2 6-7" />
      <circle cx="7" cy="15" r="1" />
      <circle cx="11" cy="11" r="1" />
      <circle cx="14" cy="13" r="1" />
      <circle cx="20" cy="6" r="1" />
    </>
  ),
  temas: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.1 0 1.8-1 1.2-1.9-.3-.5-.2-1.1.3-1.4.4-.3.9-.2 1.4.1.9.6 2 .1 2-.9 0-.5.4-.9 1-1 1.5-.1 2.6-1.3 2.1-2.8A8.5 8.5 0 0 0 12 3.5Z" />
      <circle cx="8" cy="10.5" r="1" />
      <circle cx="11.5" cy="7.8" r="1" />
      <circle cx="15.5" cy="9.2" r="1" />
    </>
  ),
  equipo: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M3 20c0-3 2.5-5.3 5.5-5.3S14 17 14 20" />
      <path d="M15.3 14.8c2.6.2 4.7 2.2 4.7 5.2" />
    </>
  ),
};

function AmbientOrbs({ accentColor }: { accentColor: string }) {
  const palette = React.useMemo(
    () => [accentColor, "#16a34a", "#4ade80", "#065f46"],
    [accentColor],
  );
  const orbs = [
    { size: 260, top: "-110px", left: "-90px", dur: 14, phase: 0 },
    { size: 190, top: "60%", left: "-60px", dur: 16, phase: 0.35 },
    { size: 220, top: "-40px", left: "60%", dur: 15, phase: 0.65 },
    { size: 160, top: "80%", left: "70%", dur: 18, phase: 0.9 },
  ];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            borderRadius: "50%",
            filter: "blur(46px)",
            mixBlendMode: "normal",
          }}
          animate={{
            background: [
              `radial-gradient(circle at 30% 30%, ${palette[i % palette.length]}66, transparent 70%)`,
              `radial-gradient(circle at 60% 40%, ${palette[(i + 1) % palette.length]}66, transparent 70%)`,
              `radial-gradient(circle at 30% 30%, ${palette[i % palette.length]}66, transparent 70%)`,
            ],
            opacity: [0.45, 0.75, 0.45],
            scale: [1, 1.18, 1],
            x: [0, 22, -14, 0],
            y: [0, -18, 12, 0],
          }}
          // Arrancan todas ya "en movimiento": en vez de un delay antes
          // de empezar (que se veía como una pausa inicial), cada orbe
          // inicia su animación en un punto distinto del ciclo.
          initial={{
            opacity: 0.45 + o.phase * 0.3,
            scale: 1 + o.phase * 0.18,
          }}
          transition={{
            duration: o.dur,
            delay: 0,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function BottomNavIcon({
  id,
  active,
  accentColor,
  onClick,
  navIconos,
}: {
  id: SeccionId;
  active: boolean;
  accentColor: string;
  onClick: () => void;
  navIconos?: Record<string, string>;
}) {
  return (
    <motion.button
      className="turnits-bottom-nav-button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label={id}
      aria-current={active ? "page" : undefined}
      style={{
        border: "none",
        background: active ? "#e3f2e1" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 14,
        cursor: "pointer",
        color: active ? accentColor : "#94a3b8",
        flexShrink: 0,
      }}
    >
      <NavGlyph
        id={id}
        navIconos={navIconos}
        size={22}
        strokeWidth={active ? 2.2 : 1.8}
      />
    </motion.button>
  );
}

function BottomNavMore({
  onClick,
  active = false,
}: {
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <motion.button
      className="turnits-bottom-nav-button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label="Más opciones"
      aria-current={active ? "page" : undefined}
      style={{
        border: "none",
        background: active ? "#e3f2e1" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        borderRadius: 14,
        cursor: "pointer",
        color: active ? "#1a6b1a" : "#94a3b8",
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5" cy="12" r="1.8" />
        <circle cx="12" cy="12" r="1.8" />
        <circle cx="19" cy="12" r="1.8" />
      </svg>
    </motion.button>
  );
}

function BrandMark({
  logoImage,
  logoText,
  width = 128,
  height = 64,
  light = false,
}: {
  logoImage?: string;
  logoText?: string;
  width?: number;
  height?: number;
  light?: boolean;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 12,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: logoImage
          ? "transparent"
          : light
            ? "rgba(255,255,255,0.08)"
            : "#f1f5f9",
        border: logoImage
          ? "none"
          : `1px dashed ${light ? "rgba(255,255,255,0.35)" : "#cbd5e1"}`,
        boxSizing: "border-box",
      }}
    >
      {logoImage ? (
        <img
          src={logoImage}
          alt={logoText || "Logo"}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: "'Inter Display', -apple-system, sans-serif",
            fontWeight: 500,
            fontSize: 13,
            color: light ? "#f8fafc" : "#94a3b8",
            letterSpacing: "-0.2px",
            textAlign: "center",
            padding: "0 6px",
          }}
        >
          {logoText || "Logo"}
        </span>
      )}
    </div>
  );
}

function NavGlyph({
  id,
  navIconos,
  size = 18,
  strokeWidth = 1.8,
}: {
  id: SeccionId;
  navIconos?: Record<string, string>;
  size?: number;
  strokeWidth?: number;
}) {
  const customSrc = navIconos?.[id];
  if (customSrc) {
    // Los íconos subidos se tratan como "máscaras": no importa que la
    // imagen sea un SVG/PNG negro, el color real sale de `currentColor`
    // (heredado del botón padre). Así logramos el mismo efecto "pressed"
    // que el ícono lineal por defecto: gris cuando está inactivo, verde
    // (accentColor) cuando está activo/presionado, con transición suave.
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          position: "relative",
          backgroundColor: "currentColor",
          WebkitMaskImage: `url(${customSrc})`,
          maskImage: `url(${customSrc})`,
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          transition: "background-color 0.15s ease",
        }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "relative", flexShrink: 0 }}
    >
      {NAV_ICONS[id]}
    </svg>
  );
}

function NavButton({
  item,
  active,
  accentColor,
  onClick,
  navIconos,
}: {
  item: { id: SeccionId; label: string };
  active: boolean;
  accentColor: string;
  onClick: () => void;
  navIconos?: Record<string, string>;
}) {
  return (
    <motion.button
      className="turnits-panel-nav-button"
      onClick={onClick}
      whileHover={{ x: active ? 0 : 2 }}
      whileTap={{ scale: 0.97 }}
      aria-current={active ? "page" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 11,
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        background: "transparent",
        color: active ? accentColor : "#475569",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        textAlign: "center",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {active && (
        <motion.div
          layoutId="navActivePill"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            background: `linear-gradient(90deg, ${accentColor}22, ${accentColor}08)`,
            border: `1px solid ${accentColor}2e`,
          }}
        />
      )}
      <NavGlyph id={item.id} navIconos={navIconos} size={18} />
      <span style={{ position: "relative" }}>{item.label}</span>
    </motion.button>
  );
}

export {
  NAV_ICONS,
  AmbientOrbs,
  BottomNavIcon,
  BottomNavMore,
  BrandMark,
  NavGlyph,
  NavButton,
};
