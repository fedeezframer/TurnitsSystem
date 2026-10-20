import * as React from "react";
import { useLocation } from "react-router";
import "./LoadingRunner.css";
import {
  BRAND_WRITING_DURATION,
  brandWritingSvg,
  isAppGateway,
  isBrandPreloaderPath,
  prepareBrandArtwork,
} from "../shared/brand-preloader";

// Keep the HTML loader mounted through JS download, lazy routes and session
// checks, so the handwriting never restarts between those startup stages.
let startup = document.getElementById("turnits-startup-preloader");
let appDestinationPending = isAppGateway(window.location.pathname);
let pending = 0;
let routeReady = false;
let finished = !startup;
let writingStarted = false;
let startFrame = 0;

function finishStartup() {
  if (finished || !startup) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const image = startup.querySelector(".turnits-writing-finished");
  if (
    !reduced &&
    !startup.classList.contains("is-art-error") &&
    image &&
    Number(getComputedStyle(image).opacity) < 0.999
  ) {
    requestAnimationFrame(finishStartup);
    return;
  }
  finished = true;
  startup.classList.add("is-leaving");
  setTimeout(() => startup.remove(), reduced ? 0 : 190);
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

// /app has no artwork. Its first destination gets the same single writing
// cycle without downloading a second document or restarting the application.
export function prepareAppDestinationPreloader(path: string) {
  if (!appDestinationPending) return;
  if (!isBrandPreloaderPath(path)) { appDestinationPending=false;return; }
  appDestinationPending = false;
  routeReady = false;
  finished = false;
  startup = document.createElement("div");
  startup.id = "turnits-startup-preloader";
  startup.className = "turnits-brand-preloader";
  startup.setAttribute("role", "status");
  startup.setAttribute("aria-label", "Cargando Turnits");
  startup.innerHTML = brandWritingSvg("turnits-startup-writing");
  startup.addEventListener("turnits-brand-ready", startWhenReady);
  document.body.appendChild(startup);
  prepareBrandArtwork(startup);
}

export function useStartupLoading(loading: boolean) {
  React.useLayoutEffect(() => {
    if (!isBrandPreloaderPath(window.location.pathname) || !loading || finished || writingStarted) return;
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
  const { pathname } = useLocation();
  React.useEffect(() => {
    if(!isBrandPreloaderPath(pathname) && !isAppGateway(pathname)){
      cancelAnimationFrame(startFrame);startFrame=0;
      startup?.remove();finished=true;routeReady=false;
      return;
    }
    routeReady = !isAppGateway(pathname);
    startWhenReady();
    return () => {
      routeReady = false;
    };
  }, [pathname]);
  return null;
}

export function SoftRouteLoading(){return <div className="route-blur-loading" role="status" aria-label="Cargando"><span /></div>}
export default function BrandPreloader() {
  useStartupLoading(true);
  if (!finished) return null;
  return <SoftRouteLoading />;
}
