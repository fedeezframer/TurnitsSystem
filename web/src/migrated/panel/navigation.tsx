import * as React from "react";
import { motion } from "framer-motion";
import type { SeccionId } from "./common";

const NAV_ASSETS: Partial<Record<SeccionId, string>> = {
  inicio: "/assets/panel-nav/ant-design_home-outlined.svg",
  servicios: "/assets/panel-nav/iconmind_key-combo-outline-regular.svg",
  clientes: "/assets/panel-nav/andrsrxn_book-user.svg",
  agenda: "/assets/panel-nav/fa7-regular_calendar-alt.svg",
  horarios: "/assets/panel-nav/hugeicons_time-quarter-02.svg",
  pagos: "/assets/panel-nav/ix_money-alt.svg",
  finanzas: "/assets/panel-nav/ion_stats-chart-sharp.svg",
  temas: "/assets/panel-nav/bi_paint-bucket.svg",
  equipo: "/assets/panel-nav/iconoven_team-building.svg",
  perfil: "/assets/panel-nav/andrsrxn_user-background-sparkle.svg",
};

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
      <rect x="4" y="4" width="10" height="10" rx="1.5" />
      <rect x="10" y="10" width="10" height="10" rx="1.5" />
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
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="12" cy="9" r="2.7" />
      <path d="M7.5 18c.4-2.4 2-3.7 4.5-3.7s4.1 1.3 4.5 3.7" />
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
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  finanzas: (
    <>
      <path d="M4 20V10h3v10M10.5 20V4h3v16M17 20V7h3v13" />
    </>
  ),
  temas: (
    <>
      <path d="m4 19 9.7-9.7M3 21l4.2-1 10.5-10.5a2.8 2.8 0 0 0-4-4L3.2 16Z" />
      <path d="m16.5 4.5 3 3" />
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
  showChevron = false,
  chevronDown = false,
}: {
  id: SeccionId;
  active: boolean;
  accentColor: string;
  onClick: () => void;
  navIconos?: Record<string, string>;
  showChevron?: boolean;
  chevronDown?: boolean;
}) {
  return (
    <motion.button
      className="turnits-bottom-nav-button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label={id}
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
        borderRadius: 0,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        overflow: "hidden",
        background: "transparent",
        border: "none",
        boxSizing: "border-box",
      }}
    >
      {logoImage ? (
        <img src={logoImage} alt={logoText || "Logo"} style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"left center"}} />
      ) : (
        <span style={{color:light?"#fff":"#111",fontWeight:700,fontSize:20}}>{logoText || "Logo"}</span>
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
  const customSrc = navIconos?.[id] || NAV_ASSETS[id];
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
  showChevron = false,
  chevronDown,
}: {
  item: { id: SeccionId; label: string };
  active: boolean;
  accentColor: string;
  onClick: () => void;
  navIconos?: Record<string, string>;
  showChevron?: boolean;
  chevronDown?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: active ? 0 : 2 }}
      whileTap={{ scale: 0.97 }}
      aria-expanded={chevronDown}
      aria-current={active ? "page" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 11,
        padding: "9px 12px",
        borderRadius: 10,
        border: "none",
        background: "transparent",
        color: active ? "#176b24" : "#2b342d",
        fontSize: 14,
        fontWeight: active ? 600 : 450,
        letterSpacing: "-0.005em",
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      <NavGlyph id={item.id} navIconos={navIconos} size={19} strokeWidth={1.6} />
      <span style={{ position: "relative", flex: 1 }}>{item.label}</span>
      {showChevron && (
        <motion.svg
          aria-hidden="true"
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="currentColor"
          style={{ opacity: 0.55 }}
          initial={false}
          animate={{rotate:chevronDown === false ? -90 : 0}}
          transition={{duration:.2,ease:[.22,1,.36,1]}}
        >
          <path d="m2 4 4 4 4-4" />
        </motion.svg>
      )}
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
