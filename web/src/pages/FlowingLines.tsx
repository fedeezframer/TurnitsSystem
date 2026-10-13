import React, { useEffect, useRef } from "react"
export default function FlowingLines() {
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(() => {



  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;
  let raf = 0;

  // Offscreen canvas para compositing
  let offscreen, offCtx;

  let W = 0, H = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2); // Cap en 2x para no saturar

  function resize() {
    W = canvas.parentElement.clientWidth;
    H = canvas.parentElement.clientHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR);

    offscreen = document.createElement('canvas');
    offscreen.width  = canvas.width;
    offscreen.height = canvas.height;
    offCtx = offscreen.getContext('2d', { alpha: true });
    offCtx.scale(DPR, DPR);

    // Se setea una sola vez — no toca el loop
    offCtx.lineJoin = 'round';
    offCtx.lineCap  = 'round';
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);
  resize();

  // ── Configuración ────────────────────────────────────────────────
  const COLOR   = '100, 160, 120';
  const N_LINES = 18;
  const N_PTS   = 4;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Pre-alocamos los arrays de puntos resueltos (evita GC en cada frame)
  const resolvedX = new Float32Array(N_PTS);
  const resolvedY = new Float32Array(N_PTS);

  const lines = Array.from({ length: N_LINES }, () => ({
    bx: Array.from({ length: N_PTS }, (_, i) => (i / (N_PTS - 1)) * 1.2 - 0.1),
    by: Array.from({ length: N_PTS }, () => rnd(0.1, 0.9)),
    ax: Array.from({ length: N_PTS }, () => rnd(0.03, 0.12)),
    ay: Array.from({ length: N_PTS }, () => rnd(0.05, 0.18)),
    fx: Array.from({ length: N_PTS }, () => rnd(0.05, 0.15)),
    fy: Array.from({ length: N_PTS }, () => rnd(0.04, 0.12)),
    px: Array.from({ length: N_PTS }, () => rnd(0, Math.PI * 2)),
    py: Array.from({ length: N_PTS }, () => rnd(0, Math.PI * 2)),
    opacity: rnd(0.12, 0.4),
    width:   rnd(1, 2.5),
  }));

  // ── Loop ─────────────────────────────────────────────────────────
  const TARGET_MS = 1000 / 60; // 60 fps cap
  let lastTime = 0;

  function draw(now) {
    if (!matchMedia("(prefers-reduced-motion:reduce)").matches) raf = requestAnimationFrame(draw);

    // Throttle: salta el frame si llegó demasiado pronto
    if (now - lastTime < TARGET_MS - 1) return;
    lastTime = now;

    const t = now * 0.0008;

    offCtx.clearRect(0, 0, W, H);

    for (let i = 0; i < N_LINES; i++) {
      const l = lines[i];

      // Resolver puntos en arrays tipados (sin objetos nuevos)
      for (let j = 0; j < N_PTS; j++) {
        resolvedX[j] = (l.bx[j] + Math.sin(t * l.fx[j] + l.px[j]) * l.ax[j]) * W;
        resolvedY[j] = (l.by[j] + Math.sin(t * l.fy[j] + l.py[j]) * l.ay[j]) * H;
      }

      offCtx.beginPath();
      offCtx.moveTo(resolvedX[0], resolvedY[0]);

      for (let j = 1; j < N_PTS - 1; j++) {
        const xc = (resolvedX[j] + resolvedX[j + 1]) * 0.5;
        const yc = (resolvedY[j] + resolvedY[j + 1]) * 0.5;
        offCtx.quadraticCurveTo(resolvedX[j], resolvedY[j], xc, yc);
      }

      offCtx.lineTo(resolvedX[N_PTS - 1], resolvedY[N_PTS - 1]);

      offCtx.lineWidth   = l.width;
      offCtx.strokeStyle = `rgba(${COLOR},${l.opacity})`;
      offCtx.stroke();
    }

    // Vuelca el offscreen al canvas visible en un solo drawImage
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(offscreen, 0, 0, W, H);
  }

  raf = requestAnimationFrame(draw);

  return () => { observer.disconnect(); cancelAnimationFrame(raf); };

 }, []);
 return <div style={{width:"100%",height:"100%",overflow:"hidden",background:"white"}} aria-hidden="true"><canvas ref={canvasRef} style={{display:"block",width:"100%",height:"100%"}} /></div>;
}
