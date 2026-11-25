import '@fontsource-variable/newsreader';
import { loop } from '../../lib/loop';
import { sample } from '../../lib/sound';
import type { Mount } from '../registry';

/**
 * 404: a paper luggage tag hanging from a nail. It's a damped pendulum;
 * drag it to swing it, let go and it settles.
 */
const CSS = `
.d-404 { position: fixed; inset: 0; overflow: hidden; background: radial-gradient(ellipse 70% 60% at 50% 30%, #3a3f46, #1c1f23 75%); color: #f1ebe0; font-family: 'Instrument Sans Variable', system-ui, sans-serif; touch-action: none; }
.d-404::before { content: ''; position: absolute; inset: 0; opacity: .12; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.d-404 .nail { position: absolute; left: 50%; top: 14vh; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #e8e8e8, #6d6d6d 70%); box-shadow: 0 2px 3px rgba(0,0,0,.6); z-index: 2; }
.d-404 .rig { position: absolute; left: 50%; top: calc(14vh + 7px); width: 0; height: 0; transform-origin: 0 0; will-change: transform; }
.d-404 .string { position: absolute; left: -1px; top: 0; width: 2px; height: 120px; background: linear-gradient(90deg, #8b7a60, #cdb994, #8b7a60); }
.d-404 .tag { position: absolute; left: -150px; top: 112px; width: 300px; padding: 46px 28px 26px; cursor: grab; user-select: none; color: #2a241c;
  background: #e9dcc0; clip-path: polygon(22% 0, 78% 0, 100% 14%, 100% 100%, 0 100%, 0 14%);
  filter: drop-shadow(0 18px 18px rgba(0,0,0,.45));
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .3 0 0 0 0 .2 0 0 0 0 .1 0 0 0 .12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.d-404 .tag.grabbing { cursor: grabbing; }
.d-404 .hole { position: absolute; left: 50%; top: 10px; width: 18px; height: 18px; margin-left: -9px; border-radius: 50%; background: #2a2d31; box-shadow: 0 0 0 5px #c9a46a, inset 0 2px 3px rgba(0,0,0,.6); }
.d-404 .code { font: 600 76px/1 'Newsreader Variable', Georgia, serif; text-align: center; letter-spacing: -.02em; }
.d-404 .msg { text-align: center; margin: 8px 0 18px; font-size: 16px; color: #4a3f31; }
.d-404 .links { display: flex; flex-direction: column; gap: 8px; }
.d-404 .links a { display: block; text-align: center; padding: 11px; border-radius: 6px; border: 1.5px dashed #9c8357; color: #2a241c; text-decoration: none; font-weight: 600; }
.d-404 .links a:hover, .d-404 .links a:focus-visible { background: rgba(255,255,255,.35); outline: none; }
.d-404 .hint { position: absolute; left: 0; right: 0; bottom: max(24px, env(safe-area-inset-bottom)); text-align: center; color: #b9b2a6; font-size: 14px; }
@media (max-width: 420px) { .d-404 .tag { width: 260px; left: -130px; } .d-404 .code { font-size: 60px; } }
`;

const mount: Mount = (root) => {
  root.className = 'design d-404';
  root.innerHTML = `<style>${CSS}</style>
    <div class="nail"></div>
    <div class="rig"><div class="string"></div>
      <div class="tag" role="group" aria-label="Page not found">
        <div class="hole"></div>
        <div class="code">404</div>
        <p class="msg">This page took the long way and never arrived.</p>
        <nav class="links"><a href="/">Back to the front door</a><a href="/story">Read the story instead</a><a href="/ask">Ask where things are</a></nav>
      </div>
    </div>
    <p class="hint">Grab the tag and give it a swing.</p>`;
  document.title = 'Not found · Jack Shomer';

  const rig = root.querySelector<HTMLDivElement>('.rig')!;
  const tag = root.querySelector<HTMLDivElement>('.tag')!;
  // pendulum state: angle (rad), angular velocity
  let a = 0.5, w = 0, drag: { x: number; y: number } | null = null;
  const pivot = () => { const r = rig.getBoundingClientRect(); return [r.left, r.top]; };
  tag.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('a')) return;
    tag.setPointerCapture(e.pointerId); tag.classList.add('grabbing'); drag = { x: e.clientX, y: e.clientY };
    sample(['scratch_001', 'scratch_002'], { gain: 0.25, rate: 1.3 });
  });
  tag.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [px, py] = pivot();
    const target = Math.atan2(-(e.clientX - px), e.clientY - py);
    const na = Math.max(-1.3, Math.min(1.3, target));
    w = (na - a) * 0.6; a = na; drag = { x: e.clientX, y: e.clientY };
  });
  const up = () => { drag = null; tag.classList.remove('grabbing'); };
  tag.addEventListener('pointerup', up); tag.addEventListener('pointercancel', up);
  const stop = loop((dt) => {
    if (!drag) {
      const s = Math.min(dt, 32) / 16.67;
      w += -Math.sin(a) * 0.006 * s; // gravity
      w *= Math.pow(0.992, s);       // air + string friction
      a += w * s;
    }
    rig.style.transform = `rotate(${a}rad)`;
  });
  return () => stop();
};

export default mount;
