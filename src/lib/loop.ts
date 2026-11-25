// Animation helpers shared by every design.
// - Pauses automatically while the tab is hidden (saves battery on phones).
// - `fixed` runs physics at a constant 60 steps/s whatever the display rate,
//   so simulations behave the same on 60Hz, 90Hz and 120Hz screens.

export type Stop = () => void;

export function loop(frame: (dtMs: number, now: number) => void): Stop {
  let raf = 0;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    frame(dt, now);
    raf = requestAnimationFrame(tick);
  };
  const onVis = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVis);
  };
}

const STEP = 1000 / 60;

/** Fixed-timestep simulation + per-frame render. Reports average step cost for adaptive quality. */
export function fixed(step: () => void, render: () => void, onCost?: (msPerStep: number) => void): Stop {
  let acc = 0;
  let costAvg = 0;
  return loop((dt) => {
    acc += dt;
    let n = 0;
    const t0 = performance.now();
    while (acc >= STEP && n < 3) {
      step();
      acc -= STEP;
      n++;
    }
    if (n === 3) acc = 0; // never spiral: drop time rather than stutter
    if (n && onCost) {
      costAvg = costAvg * 0.95 + ((performance.now() - t0) / n) * 0.05;
      onCost(costAvg);
    }
    render();
  });
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Size a canvas to its CSS box at a capped device pixel ratio. */
export function fitCanvas(cv: HTMLCanvasElement, maxDpr = 2) {
  const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  return { w, h, dpr };
}
