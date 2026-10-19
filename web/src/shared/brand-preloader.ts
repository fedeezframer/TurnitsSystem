// Reveal the supplied artwork with brush masks; these paths never redraw it.
const strokes = [
  {
    d: "M165 484 C240 393 458 304 600 309",
    width: 130,
    start: 0,
    duration: 0.48,
  },
  {
    d: "M376 420 C344 503 277 670 246 791",
    width: 116,
    start: 0.36,
    duration: 0.4,
  },
  {
    d: "M431 563 C397 642 370 742 407 742 C468 745 528 582 551 529 M552 530 C534 595 498 694 536 700 C575 703 612 617 632 553",
    width: 98,
    start: 0.7,
    duration: 0.42,
  },
  {
    d: "M643 478 C623 514 674 511 722 501 C705 555 671 646 680 664 C697 711 757 627 795 551",
    width: 91,
    start: 1.05,
    duration: 0.35,
  },
  {
    d: "M824 466 L784 635 C821 557 877 454 930 442 C947 433 900 550 916 591 C929 625 991 575 1025 511",
    width: 98,
    start: 1.32,
    duration: 0.36,
  },
  {
    d: "M1055 402 C1032 467 1008 551 1031 570 C1057 594 1101 527 1134 468",
    width: 92,
    start: 1.62,
    duration: 0.25,
  },
  { d: "M1065 301 L1080 291", width: 90, start: 1.85, duration: 0.12 },
  {
    d: "M1222 233 C1178 338 1124 484 1145 527 C1170 578 1250 459 1317 364",
    width: 98,
    start: 1.93,
    duration: 0.32,
  },
  { d: "M1137 327 L1294 276", width: 87, start: 2.15, duration: 0.2 },
  {
    d: "M1350 337 C1303 339 1338 404 1359 449 C1390 524 1306 564 1280 527 M1365 481 L1421 440",
    width: 104,
    start: 2.3,
    duration: 0.38,
  },
];

export const BRAND_WRITING_DURATION = 2200;
export const BRAND_IMAGE = "/assets/loading/turnits-script-original.png";

// Used by the initial HTML and React, including when the image is not cached.
export function prepareBrandArtwork(container: HTMLElement) {
  if (container.dataset.artworkPrepared) return () => {};
  container.dataset.artworkPrepared = "true";
  // Carry the completed logo through our own version-refresh navigation.
  // Manual visits/reloads still get their normal single writing cycle.
  try {
    const reload = JSON.parse(
      sessionStorage.getItem("turnits-writing-reload-once") || "null",
    );
    if (
      reload &&
      reload.path === location.pathname &&
      new URLSearchParams(location.search).has("_r") &&
      Date.now() - reload.at >= 0 &&
      Date.now() - reload.at < 30000
    ) {
      container.dataset.skipWriting = "true";
      container.classList.add("is-complete");
    }
  } catch {}
  const artwork = new Image();
  const ready = () => {
    if (container.classList.contains("is-art-ready")) return;
    container.classList.add("is-art-ready");
    container.dispatchEvent(new Event("turnits-brand-ready"));
  };
  artwork.onload = ready;
  artwork.onerror = () => {
    container.classList.add("is-art-error");
    ready();
  };
  artwork.src = "/assets/loading/turnits-script-original.png";
  return () => {
    artwork.onload = artwork.onerror = null;
  };
}

export function brandWritingSvg(id: string) {
  return `<svg class="turnits-writing" viewBox="90 155 1380 720" aria-hidden="true" focusable="false">
    <defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1536" height="1024" style="mask-type:alpha">
      <g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">${strokes.map((s) => `<path class="turnits-writing-stroke" d="${s.d}" stroke-width="${s.width}" pathLength="1" style="--stroke-start:${s.start}s;--stroke-duration:${s.duration}s"/>`).join("")}</g>
    </mask></defs>
    <image href="${BRAND_IMAGE}" width="1536" height="1024" mask="url(#${id})"/>
    <image class="turnits-writing-finished" href="${BRAND_IMAGE}" width="1536" height="1024"/>
  </svg>`;
}

export function startupPreloaderHtml() {
  return `<div id="turnits-startup-preloader" class="turnits-brand-preloader" role="status" aria-label="Cargando Turnits">${brandWritingSvg("turnits-startup-writing")}<script>(${prepareBrandArtwork.toString()})(document.getElementById('turnits-startup-preloader'))</script></div>`;
}
