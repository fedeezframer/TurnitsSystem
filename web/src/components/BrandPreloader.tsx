import * as React from "react";
import {
  BRAND_WRITING_DURATION,
  brandWritingSvg,
} from "../shared/brand-preloader";

// Keep the HTML loader mounted through JS download, lazy routes and session
// checks, so the handwriting never restarts between those startup stages.
const startup = document.getElementById("turnits-startup-preloader");
let pending = 0;
let routeReady = false;
let finished = !startup;
let writingStarted = false;
let startFrame = 0;
const afterWriting = new Set<() => void>();

// A version refresh must not tear down the document halfway through a stroke.
export function afterStartupWriting(callback: () => void) {
  if (finished || !startup) callback();
  else afterWriting.add(callback);
}

if (startup?.dataset.skipWriting === "true") {
  try {
    sessionStorage.removeItem("turnits-writing-reload-once");
  } catch {}
}

function finishStartup() {
  if (finished || !startup) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const image = startup.querySelector(".turnits-writing-finished");
  if (
    !reduced &&
    startup.dataset.skipWriting !== "true" &&
    !startup.classList.contains("is-art-error") &&
    image &&
    Number(getComputedStyle(image).opacity) < 0.999
  ) {
    requestAnimationFrame(finishStartup);
    return;
  }
  finished = true;
  const callbacks = [...afterWriting];
  afterWriting.clear();
  callbacks.forEach((callback) => callback());
  startup.classList.add("is-leaving");
  setTimeout(() => startup.remove(), reduced ? 0 : 230);
}

function readyToWrite() {
  return (
    !finished &&
    !writingStarted &&
    routeReady &&
    pending === 0 &&
    startup?.classList.contains("is-art-ready")
  );
}

function startWhenReady() {
  if (!readyToWrite() || startFrame) return;
  // Let the last ready state commit and paint before starting the one timeline.
  startFrame = requestAnimationFrame(() => {
    startFrame = requestAnimationFrame(() => {
      startFrame = 0;
      if (!readyToWrite() || !startup) return;
      writingStarted = true;
      if (startup.dataset.skipWriting === "true") {
        finishStartup();
        return;
      }
      startup.dataset.startedAt = String(performance.now());
      startup.classList.add("is-writing");
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setTimeout(
        finishStartup,
        reduced || startup.classList.contains("is-art-error")
          ? 0
          : BRAND_WRITING_DURATION + 100,
      );
    });
  });
}
startup?.addEventListener("turnits-brand-ready", startWhenReady);

export function useStartupLoading(loading: boolean) {
  React.useLayoutEffect(() => {
    if (!loading || finished || writingStarted) return;
    pending++;
    cancelAnimationFrame(startFrame);
    startFrame = 0;
    return () => {
      pending--;
      startWhenReady();
    };
  }, [loading]);
}

export function StartupRouteReady() {
  React.useEffect(() => {
    routeReady = true;
    startWhenReady();
  }, []);
  return null;
}

export default function BrandPreloader() {
  const id = React.useId().replace(/:/g, "");
  useStartupLoading(true);
  if (!finished) return null;
  return (
    <div
      className="turnits-brand-preloader is-complete"
      role="status"
      aria-label="Cargando Turnits"
      dangerouslySetInnerHTML={{
        __html: brandWritingSvg(`turnits-writing-${id}`),
      }}
    />
  );
}
