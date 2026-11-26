import '@fontsource-variable/rubik';
import './gel.css';
import { fixed, fitCanvas } from '../../lib/loop';
import { click, sample, preload } from '../../lib/sound';
import { jack, ai } from '../../content/jack';
import type { Mount } from '../registry';

/**
 * Gel: pressure soft bodies. Each gummy is a ring of Verlet points held by
 * edge and bend constraints plus an area constraint (the "pressure"), solved
 * position-based so it stays stable at any frame rate. Scratch buffers are
 * allocated once; the step allocates nothing.
 */
const N = 24;
interface Blob { k: string; col: string; r: number; x: Float32Array; y: Float32Array; ox: Float32Array; oy: Float32Array; nx: Float32Array; ny: Float32Array; A0: number; L0: number; L2: number; cx: number; cy: number; t?: string; body?: string; light: string; dark: string }

const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (h: string, f: number) => `rgb(${hex(h).map((v) => Math.max(0, Math.min(255, f > 1 ? v + (255 - v) * (f - 1) : v * f)) | 0)})`;

const mount: Mount = (root) => {
  root.className = 'design d-gel';
  const contact = [jack.email && `<li><a href="mailto:${jack.email}">${jack.email}</a></li>`, `<li><a href="${jack.linkedin}" target="_blank" rel="noopener">LinkedIn</a></li>`, `<li><a href="${jack.github}" target="_blank" rel="noopener">github.com/${jack.githubHandle}</a></li>`, `<li><a href="/ask">Ask the assistant</a></li>`].filter(Boolean).join('');
  const DATA = [
    { k: 'Jack', col: '#e2263b', big: 1.35, t: jack.name, body: `<p>${jack.headline}</p><p>${jack.role} at ${jack.company}. Based in ${jack.location}.</p>` },
    { k: 'work', col: '#ff7a1a', big: 1, t: 'Work', body: `<p>${jack.role} at ${jack.company}, ${jack.companyAbout}, since ${jack.since}. I lead ${jack.team}.</p><ul>${jack.projects.map((p) => `<li><b><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a>.</b> ${p.blurb}</li>`).join('')}</ul>` },
    { k: 'stack', col: '#f4c20d', big: 0.9, t: 'Stack', body: `<p>${jack.stack.join(', ')}.</p>` },
    { k: 'path', col: '#2a7de1', big: 0.95, t: 'Path', body: `<ul>${jack.path.map((p) => `<li>${p.what}</li>`).join('')}</ul><p>Studied ${jack.study} at ${jack.school}. <a href="/story">The full story →</a></p>` },
    { k: 'story', col: '#1f8a70', big: 1.05, t: 'The long way in', body: `<p>Data analyst with no connections → coding teacher → unpaid intern → lead frontend → founding engineer. Building with AI since four days after ChatGPT launched (${ai.proofDate}).</p><p><a href="/story">Read the whole story →</a></p>` },
    { k: 'say hi', col: '#7b3fbf', big: 1, t: 'Say hi', body: `<ul>${contact}</ul>` },
    { k: '', col: '#2fb5a8', big: 0.55 }, { k: '', col: '#ff7a1a', big: 0.5 }, { k: '', col: '#e2263b', big: 0.45 }, { k: '', col: '#f4c20d', big: 0.5 },
  ];
  root.innerHTML = `
    <canvas class="gl" aria-hidden="true"></canvas>
    <canvas class="c2d" role="img" aria-label="A pile of gummy sweets, each labelled with a section of the site"></canvas>
    <div class="sr" aria-label="Sections">${DATA.filter((d) => d.t).map((d, i) => `<button data-i="${i}">${d.t}</button>`).join('')}</div>
    <div class="sheet" role="dialog" aria-modal="false" aria-labelledby="gel-h"><h2 id="gel-h"></h2><div class="sb"></div><button data-close>Drop it back in</button></div>
    <div class="bar"><p><b>Gel.</b> Grab a gummy and throw it. Tap one without dragging to open it. Shake the pile.</p><button data-shake>Shake</button></div>`;

  const cv = root.querySelector<HTMLCanvasElement>('canvas.c2d')!;
  const glc = root.querySelector<HTMLCanvasElement>('canvas.gl')!;
  let gl: ReturnType<typeof import('./gl').gelGL> | null = null, dpr = 1;
  const ctx = cv.getContext('2d')!;
  const sheet = root.querySelector<HTMLDivElement>('.sheet')!;
  let W = 0, H = 0, floor = 0, blobs: Blob[] = [];
  let gb: Blob | null = null, gi = -1, mx = 0, my = 0;
  let down: { b: Blob; x: number; y: number; t: number } | null = null;

  function spawn() {
    const base = Math.max(38, Math.min(W, H) * 0.095);
    blobs = DATA.map((d, j) => {
      const r = base * d.big, x0 = W * (0.3 + 0.4 * ((j * 0.618) % 1)), y0 = -r * 2 - j * r * 1.4;
      const b: Blob = { k: d.k, col: d.col, r, t: d.t, body: d.body, light: mix(d.col, 1.35), dark: mix(d.col, 0.55),
        x: new Float32Array(N), y: new Float32Array(N), ox: new Float32Array(N), oy: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N),
        A0: 0.5 * N * r * r * Math.sin((2 * Math.PI) / N), L0: 2 * r * Math.sin(Math.PI / N), L2: 2 * r * Math.sin((2 * Math.PI) / N), cx: x0, cy: y0 };
      for (let i = 0; i < N; i++) { const t = (i / N) * Math.PI * 2; b.x[i] = b.ox[i] = x0 + Math.cos(t) * r; b.y[i] = b.oy[i] = y0 + Math.sin(t) * r; }
      return b;
    });
    gl?.setBlobs(blobs);
  }
  let sizedW = 0;
  function resize() {
    const s = fitCanvas(cv, 2);
    W = s.w; H = s.h;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0); dpr = s.dpr;
    floor = H - (W < 600 ? 128 : 96);
    gl?.resize(W, H, dpr, floor);
    if (!blobs.length || Math.abs(W - sizedW) > 60) { sizedW = W; spawn(); }
  }

  function link(b: Blob, i: number, j: number, L: number, k: number) {
    const dx = b.x[j] - b.x[i], dy = b.y[j] - b.y[i], d = Math.hypot(dx, dy) || 1e-6, f = ((d - L) / d) * 0.5 * k;
    const gI = b === gb && i === gi, gJ = b === gb && j === gi;
    if (!gI) { b.x[i] += dx * f; b.y[i] += dy * f; }
    if (!gJ) { b.x[j] -= dx * f; b.y[j] -= dy * f; }
  }
  function centroid(b: Blob) { let x = 0, y = 0; for (let i = 0; i < N; i++) { x += b.x[i]; y += b.y[i]; } b.cx = x / N; b.cy = y / N; }

  function step() {
    for (const b of blobs) for (let i = 0; i < N; i++) {
      const vx = (b.x[i] - b.ox[i]) * 0.993, vy = (b.y[i] - b.oy[i]) * 0.993;
      b.ox[i] = b.x[i]; b.oy[i] = b.y[i];
      b.x[i] += vx; b.y[i] += vy + 0.42;
    }
    if (gb) { gb.x[gi] += (mx - gb.x[gi]) * 0.6; gb.y[gi] += (my - gb.y[gi]) * 0.6; }
    for (let it = 0; it < 6; it++) {
      for (const b of blobs) {
        for (let i = 0; i < N; i++) { link(b, i, (i + 1) % N, b.L0, 1); link(b, i, (i + 2) % N, b.L2, 0.25); }
        let A = 0, per = 0;
        for (let i = 0; i < N; i++) { const j = (i + 1) % N; A += b.x[i] * b.y[j] - b.x[j] * b.y[i]; per += Math.hypot(b.x[j] - b.x[i], b.y[j] - b.y[i]); }
        A *= 0.5;
        const dl = ((b.A0 - A) / per) * 0.9;
        for (let i = 0; i < N; i++) {
          const p = (i + N - 1) % N, n = (i + 1) % N;
          const x = b.y[n] - b.y[p], y = -(b.x[n] - b.x[p]), l = Math.hypot(x, y) || 1;
          b.nx[i] = x / l; b.ny[i] = y / l;
        }
        for (let i = 0; i < N; i++) { if (b === gb && i === gi) continue; b.x[i] += b.nx[i] * dl; b.y[i] += b.ny[i] * dl; }
        centroid(b);
      }
      for (const A of blobs) for (const B of blobs) {
        if (A === B) continue;
        const rr = B.r * 1.02;
        if ((A.cx - B.cx) ** 2 + (A.cy - B.cy) ** 2 > (A.r * 1.6 + rr) ** 2) continue;
        for (let i = 0; i < N; i++) {
          if (A === gb && i === gi) continue;
          const dx = A.x[i] - B.cx, dy = A.y[i] - B.cy, d = Math.hypot(dx, dy) || 1e-6;
          if (d < rr) { const f = ((rr - d) / d) * 0.5; A.x[i] += dx * f; A.y[i] += dy * f; }
        }
      }
      for (const b of blobs) for (let i = 0; i < N; i++) {
        if (b.y[i] > floor) { const vy = b.y[i] - b.oy[i]; b.y[i] = floor; b.oy[i] = b.y[i] + vy * 0.25; b.ox[i] = b.x[i] - (b.x[i] - b.ox[i]) * 0.75; }
        if (b.x[i] < 14) { b.x[i] = 14; b.ox[i] = b.x[i] + (b.x[i] - b.ox[i]) * 0.3; }
        if (b.x[i] > W - 14) { b.x[i] = W - 14; b.ox[i] = b.x[i] + (b.x[i] - b.ox[i]) * 0.3; }
      }
    }
  }

  function path(b: Blob) {
    ctx.beginPath();
    ctx.moveTo((b.x[N - 1] + b.x[0]) / 2, (b.y[N - 1] + b.y[0]) / 2);
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; ctx.quadraticCurveTo(b.x[i], b.y[i], (b.x[i] + b.x[j]) / 2, (b.y[i] + b.y[j]) / 2); }
    ctx.closePath();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (gl) { gl.draw(blobs); labels(); return; }
    ctx.fillStyle = 'rgba(120,80,50,.08)';
    ctx.fillRect(0, floor, W, H - floor);
    for (const b of blobs) {
      const s = Math.max(0.15, 1 - Math.max(0, floor - (b.cy + b.r)) / 400);
      ctx.fillStyle = `rgba(90,45,20,${0.22 * s})`;
      ctx.beginPath(); ctx.ellipse(b.cx, floor + 3, b.r * 1.05 * s + 4, b.r * 0.16 * s + 2, 0, 0, 7); ctx.fill();
    }
    for (const b of blobs) {
      const g = ctx.createRadialGradient(b.cx - b.r * 0.35, b.cy - b.r * 0.4, b.r * 0.1, b.cx, b.cy, b.r * 1.25);
      g.addColorStop(0, b.light); g.addColorStop(0.55, b.col); g.addColorStop(1, b.dark);
      path(b); ctx.globalAlpha = 0.94; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = 2; ctx.strokeStyle = b.dark; ctx.stroke();
      ctx.save(); path(b); ctx.clip();
      const g2 = ctx.createRadialGradient(b.cx + b.r * 0.3, b.cy + b.r * 0.45, 0, b.cx + b.r * 0.3, b.cy + b.r * 0.45, b.r * 0.8);
      g2.addColorStop(0, 'rgba(255,255,230,.35)'); g2.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = g2; ctx.fillRect(b.cx - b.r * 2, b.cy - b.r * 2, b.r * 4, b.r * 4);
      ctx.translate(b.cx - b.r * 0.2, b.cy - b.r * 0.3); ctx.scale(0.5, 0.36); ctx.translate(-b.cx, -b.cy); path(b);
      const g3 = ctx.createLinearGradient(0, b.cy - b.r, 0, b.cy + b.r);
      g3.addColorStop(0, 'rgba(255,255,255,.75)'); g3.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g3; ctx.fill(); ctx.restore();
      label(b);
    }
  }

  function labels() { for (const b of blobs) label(b); }
  function label(b: Blob) {
    if (b.k) {
        let a = Math.atan2(b.y[0] - b.cy, b.x[0] - b.cx);
        if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI;
        a *= 0.35; // follow the body's spin a little, but stay readable
        let sx = 0;
        for (let i = 0; i < N / 2; i++) sx += Math.hypot(b.x[i] - b.x[i + N / 2], b.y[i] - b.y[i + N / 2]);
        const sq = sx / (N / 2) / (2 * b.r);
        ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(a); ctx.scale(Math.min(1.25, Math.max(0.8, sq)), 1);
        ctx.font = `800 ${b.r * (b.k.length > 4 ? 0.36 : 0.46)}px 'Rubik Variable',system-ui,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = b.dark; ctx.fillText(b.k, 0, 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(b.k, 0, 0);
        ctx.restore();
      }
  }

  function pick(x: number, y: number) {
    let best: Blob | null = null, bd = 1e9;
    for (const b of blobs) { const d = (b.cx - x) ** 2 + (b.cy - y) ** 2; if (d < b.r * b.r * 1.3 && d < bd) { bd = d; best = b; } }
    return best;
  }
  const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    [mx, my] = pos(e);
    const b = pick(mx, my);
    if (!b) return;
    cv.setPointerCapture(e.pointerId);
    let bi = 0, bd = 1e9;
    for (let i = 0; i < N; i++) { const d = (b.x[i] - mx) ** 2 + (b.y[i] - my) ** 2; if (d < bd) { bd = d; bi = i; } }
    gb = b; gi = bi; down = { b, x: mx, y: my, t: performance.now() };
    root.classList.add('grabbing');
    sample(['pluck_001', 'pluck_002'], { gain: 0.35, jitter: 0.25 }, () => click(500, 0.06, 0.12, 120, 0.8));
  });
  cv.addEventListener('pointermove', (e) => { [mx, my] = pos(e); });
  const up = () => {
    if (down && Math.hypot(mx - down.x, my - down.y) < 8 && performance.now() - down.t < 280 && down.b.t) open(down.b.t, down.b.body!, down.b.col);
    gb = null; gi = -1; down = null;
    root.classList.remove('grabbing');
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  function open(t: string, body: string, col: string) {
    const h = sheet.querySelector('h2')!;
    h.textContent = t; h.style.color = col;
    sheet.querySelector('.sb')!.innerHTML = body;
    sheet.classList.add('on');
    sheet.querySelector<HTMLButtonElement>('[data-close]')!.focus({ preventScroll: true });
  }
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-close]')) sheet.classList.remove('on');
    if (t.closest('[data-shake]')) for (const b of blobs) { const kx = (Math.random() - 0.5) * 18, ky = -8 - Math.random() * 16; for (let i = 0; i < N; i++) { b.ox[i] -= kx; b.oy[i] -= ky; } }
    const sr = t.closest<HTMLButtonElement>('.sr button');
    if (sr) { const d = DATA[+sr.dataset.i!]; open(d.t!, d.body!, d.col); }
  });
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') sheet.classList.remove('on'); };
  addEventListener('keydown', onKey);

  preload(['pluck_001', 'pluck_002']);
  // 2D first, then the WebGL gummies (refraction, absorption, real highlights) take over
  let gone = false;
  if (document.createElement('canvas').getContext('webgl2')) {
    void import('./gl').then((m) => {
      if (gone) return;
      try { gl = m.gelGL(glc, N); gl.resize(W, H, dpr, floor); gl.setBlobs(blobs); root.classList.add('webgl'); } catch { gl = null; }
    });
  }

  const ro = new ResizeObserver(resize);
  ro.observe(cv);
  resize();
  const stop = fixed(step, draw);
  // shaking your hand at the camera tosses every gummy
  const onShake = (e: Event) => {
    const p = (e as CustomEvent).detail?.power ?? 1;
    for (const b of blobs) { const kx = (Math.random() - 0.5) * 30 * p, ky = -(10 + Math.random() * 18) * p; for (let i = 0; i < N; i++) { b.ox[i] = b.x[i] - kx; b.oy[i] = b.y[i] - ky; } }
    sample(['pluck_001', 'pluck_002'], { gain: 0.3, jitter: 0.3 });
  };
  addEventListener('hand:shake', onShake);
  return () => { gone = true; stop(); ro.disconnect(); removeEventListener('keydown', onKey); removeEventListener('hand:shake', onShake); gl?.dispose(); };
};

export default mount;
