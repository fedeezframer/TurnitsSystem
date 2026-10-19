import * as React from "react";
import "./LoadingRunner.css";

// Crop the original transparent sheet in SVG. Each pose keeps the same scale,
// calendar center and ground line; the neighboring poses stay clipped out.
const frames: { left: number; right: number; center: number; clip?: string }[] =
  [
    { left: 0, right: 269, center: 147 },
    {
      left: 276,
      right: 520,
      center: 411,
      clip: "M276 350H520V536H500V650H276Z",
    },
    { left: 526, right: 766, center: 668 },
    {
      left: 775,
      right: 1018,
      center: 920,
      clip: "M775 350H1018V536H998V650H775Z",
    },
    { left: 1025, right: 1270, center: 1170 },
    {
      left: 1292,
      right: 1536,
      center: 1428,
      clip: "M1310 350H1536V650H1292V470H1310Z",
    },
  ];

export default function LoadingRunner({
  label = "Cargando…",
  size = "section",
  card = false,
}: {
  label?: string;
  size?: "section" | "compact" | "inline";
  card?: boolean;
}) {
  const instanceId = React.useId().replace(/:/g, "");
  return (
    <div
      className={["turnits-runner-loading", `is-${size}`, card ? "is-card" : ""]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <svg
        className="turnits-runner-animation"
        viewBox="0 0 300 300"
        aria-hidden="true"
        focusable="false"
      >
        {frames.map((frame, index) => (
          <g
            key={index}
            className="turnits-runner-frame"
            style={{ "--runner-frame": index } as React.CSSProperties}
          >
            <svg
              x={150 - frame.center + frame.left}
              y={0}
              width={frame.right - frame.left}
              height={300}
              viewBox={`${frame.left} 350 ${frame.right - frame.left} 300`}
              overflow="hidden"
            >
              <defs>
                <clipPath
                  id={`${instanceId}-runner-${index}`}
                  clipPathUnits="userSpaceOnUse"
                >
                  {frame.clip ? (
                    <path d={frame.clip} />
                  ) : (
                    <rect
                      x={frame.left}
                      y={350}
                      width={frame.right - frame.left}
                      height={300}
                    />
                  )}
                </clipPath>
              </defs>
              <image
                href="/assets/loading/calendar-runner.png"
                width={1536}
                height={1024}
                clipPath={`url(#${instanceId}-runner-${index})`}
              />
            </svg>
          </g>
        ))}
      </svg>
      <span className="turnits-runner-description">{label}</span>
    </div>
  );
}
