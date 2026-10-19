import * as React from "react";
import {
  BRAND_WRITING_DURATION,
  brandWritingSvg,
  prepareBrandArtwork,
} from "../shared/brand-preloader";

// Keep the HTML loader mounted through JS download, lazy routes and session
// checks, so the handwriting never restarts between those startup stages.
const startup = document.getElementById("turnits-startup-preloader");
let pending = 0;
let routeReady = false;
let finished = !startup;
let finishTimer: ReturnType<typeof setTimeout> | undefined;

function finishStartup() {
  clearTimeout(finishTimer);
  if (
    finished ||
    !routeReady ||
    pending ||
    !startup?.classList.contains("is-art-ready")
  )
    return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const remaining =
    reduced || startup.classList.contains("is-art-error")
      ? 0
      : BRAND_WRITING_DURATION +
        180 -
        (performance.now() - Number(startup.dataset.startedAt || 0));
  if (remaining > 0) {
    finishTimer = setTimeout(finishStartup, remaining);
    return;
  }
  finished = true;
  startup.classList.add("is-leaving");
  setTimeout(() => startup.remove(), reduced ? 0 : 230);
}
startup?.addEventListener("turnits-brand-ready", finishStartup);

export function StartupRouteReady() {
  React.useEffect(() => {
    routeReady = true;
    finishStartup();
  }, []);
  return null;
}

export default function BrandPreloader() {
  const id = React.useId().replace(/:/g, "");
  const container = React.useRef<HTMLDivElement>(null);
  const sharesStartup = !finished;
  React.useLayoutEffect(() => {
    if (!sharesStartup) return;
    pending++;
    clearTimeout(finishTimer);
    return () => {
      pending--;
      finishStartup();
    };
  }, [sharesStartup]);
  React.useLayoutEffect(() => {
    if (container.current) return prepareBrandArtwork(container.current);
  }, [sharesStartup]);
  if (sharesStartup) return null;
  return (
    <div
      ref={container}
      className="turnits-brand-preloader"
      role="status"
      aria-label="Cargando Turnits"
      dangerouslySetInnerHTML={{
        __html: brandWritingSvg(`turnits-writing-${id}`),
      }}
    />
  );
}
