import '@fontsource-variable/fraunces';
import './linen.css';
import { fixed, fitCanvas } from '../../lib/loop';
import { swish } from '../../lib/sound';
import { jack } from '../../content/jack';
import type { Mount } from '../registry';

/**
 * Linen: a cross-stitched banner simulated as 3D cloth (Verlet integration,
 * distance constraints), rendered as lit quads on a 2D canvas.
 * Physics lives in flat typed arrays so it stays cache-friendly and garbage-free.
 */
const mount: Mount = (root) => {
  root.className = 'design d-linen';
  root.innerHTML = `
    <div class="wall"></div>
    <div class="behind">
      <h2>Hi, I'm ${jack.first}.</h2>
      <p>${jack.role} at ${jack.company}, ${jack.companyAbout}, where I lead ${jack.team}. I got here the long way: data analyst, coding teacher, then an intern who became lead frontend engineer.</p>
      <p>Studied ${jack.study} at ${jack.school}. Based in ${jack.location}.</p>
      <ul>
        <li><a href="${jack.github}" target="_blank" rel="noopener">GitHub</a></li>
        ${jack.email ? `<li><a href="mailto:${jack.email}">${jack.email}</a></li>` : ''}
        <li><a href="/story">Read my story</a></li>
        <li><a href="${jack.linkedin}" target="_blank" rel="noopener">LinkedIn</a></li>
        <li><a href="/ask">Ask me anything</a></li>
      </ul>
    </div>
    <canvas aria-label="A cross-stitched banner reading Jack Shomer. Drag to pull it, cut it, or tear it down to read what is behind it." role="img"></canvas>
    <div class="bar">
      <p><b>Linen.</b> Drag to pull. Cut (or hold Shift) to slice. Tear it off its rings to read what's on the wall.</p>
      <div class="btns">
        <button data-a="cut" aria-pressed="false">Cut</button>
        <button data-a="wind" aria-pressed="true">Breeze</button>
        <button data-a="hang">Re-hang</button>
      </div>
    </div>`;

  const cv = root.querySelector('canvas')!;
  const ctx = cv.getContext('2d', { alpha: true })!;
  const behind = root.querySelector<HTMLDivElement>('.behind')!;
  const LX = -0.5, LY = -0.6, LZ = 0.65, LL = Math.hypot(LX, LY, LZ);
  const lx = LX / LL, ly = LY / LL, lz = LZ / LL;

  let W = 0, H = 0, cols = 0, rows = 0, sp = 0, x0 = 0, y0 = 0, cw = 0, N = 0, C = 0;
  let px = new Float32Array(0), py = px, pz = px, qx = px, qy = px, qz = px;
  let pin = new Uint8Array(0), alive = pin;
  let ca = new Int32Array(0), cb = ca, hC = ca, vC = ca;
  let cellCol = new Uint8Array(0);
  let iters = 5, t = 0, wind = true, mode: 'pull' | 'cut' = 'pull';
  let grab = -1, cutting = false, mx = 0, my = 0, lx0 = 0, ly0 = 0, lastTearSound = 0;
  let hoverX = -1, hoverY = -1, hoverV = 0;

  function texture() {
    const w = cols - 1, h = rows - 1;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const fs = Math.floor(Math.min(h * 0.27, w * 0.21));
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${fs}px "Arial Black","Helvetica Neue",Arial,sans-serif`;
    g.fillText('JACK', w / 2, h * 0.34);
    g.fillText('SHOMER', w / 2, h * 0.34 + fs * 1.05);
    const txt = g.getImageData(0, 0, w, h).data;
    cellCol = new Uint8Array(w * h * 3);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i;
      let r = 226, gg = 216, b = 196;
      const inside = i >= 2 && i <= w - 3 && j >= 2 && j <= h - 3;
      const edge = inside && (i === 2 || i === w - 3 || j === 2 || j === h - 3) && (i + j) % 2 === 0;
      const band = i > 5 && i < w - 6 && ((j === h - 6 && i % 4 === 0) || ((j === h - 7 || j === h - 5) && i % 2 === 1));
      if (txt[k * 4 + 3] > 120) { r = 176; gg = 36; b = 44; }
      else if (edge || band) { r = 44; gg = 62; b = 140; }
      const v = ((i + j) % 2 ? 1.018 : 0.982) * (0.985 + Math.random() * 0.03);
      cellCol[k * 3] = Math.min(255, r * v); cellCol[k * 3 + 1] = Math.min(255, gg * v); cellCol[k * 3 + 2] = Math.min(255, b * v);
    }
  }

  function build() {
    cols = W < 640 ? 56 : 70;
    cw = Math.min(W * 0.84, 980);
    sp = cw / (cols - 1);
    rows = Math.max(18, Math.min(Math.round(cols * (W < 640 ? 1.05 : 0.62)), Math.floor((H - 200) / sp)));
    x0 = (W - cw) / 2;
    y0 = Math.max(84, H * 0.13);
    N = cols * rows;
    px = new Float32Array(N); py = new Float32Array(N); pz = new Float32Array(N);
    qx = new Float32Array(N); qy = new Float32Array(N); qz = new Float32Array(N);
    pin = new Uint8Array(N);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      px[k] = qx[k] = x0 + i * sp; py[k] = qy[k] = y0 + j * sp; pz[k] = qz[k] = (Math.random() - 0.5) * 3;
      pin[k] = j === 0 && (i % 5 === 0 || i === cols - 1) ? 1 : 0;
    }
    C = (cols - 1) * rows + cols * (rows - 1);
    ca = new Int32Array(C); cb = new Int32Array(C); alive = new Uint8Array(C).fill(1);
    hC = new Int32Array(N); vC = new Int32Array(N);
    let c = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * cols + i;
      if (i < cols - 1) { hC[a] = c; ca[c] = a; cb[c] = a + 1; c++; }
      if (j < rows - 1) { vC[a] = c; ca[c] = a; cb[c] = a + cols; c++; }
    }
    texture();
    behind.style.top = `${y0 + Math.min(rows * sp * 0.22, 140)}px`;
  }

  let builtW = 0, builtH = 0;
  function resize() {
    const s = fitCanvas(cv, 2);
    W = s.w; H = s.h;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    // phones resize the viewport when the URL bar slides; only re-hang on real layout changes
    if (Math.abs(W - builtW) > 40 || Math.abs(H - builtH) > 160) { builtW = W; builtH = H; build(); }
  }

  function step() {
    t += 1 / 60;
    const g = 0.28, damp = 0.988;
    for (let k = 0; k < N; k++) {
      if (pin[k]) continue;
      const vx = (px[k] - qx[k]) * damp, vy = (py[k] - qy[k]) * damp, vz = (pz[k] - qz[k]) * damp;
      qx[k] = px[k]; qy[k] = py[k]; qz[k] = pz[k];
      let wx = 0, wz = 0;
      if (wind) {
        wz = (Math.sin(t * 1.4 + px[k] * 0.012) + Math.sin(t * 0.63 + py[k] * 0.017 + px[k] * 0.004)) * 0.06;
        wx = Math.sin(t * 0.8 + py[k] * 0.02) * 0.012;
      }
      // a hand brushing past: cursor speed pushes nearby cloth away from the viewer
      if (hoverV > 0.5) {
        const dx = px[k] - hoverX, dy = py[k] - hoverY, d2 = dx * dx + dy * dy;
        if (d2 < 3600) wz -= hoverV * 0.02 * (1 - d2 / 3600);
      }
      px[k] += vx + wx; py[k] += vy + g; pz[k] += vz + wz;
      if (py[k] > H + 600) { py[k] = H + 600; qy[k] = py[k]; }
    }
    hoverV *= 0.85;
    if (grab >= 0) { px[grab] = mx; py[grab] = my; }
    const tear = grab >= 0 ? 4.2 : 6, tearD = sp * tear;
    let tore = false;
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < C; c++) {
        if (!alive[c]) continue;
        const A = ca[c], B = cb[c];
        const dx = px[B] - px[A], dy = py[B] - py[A], dz = pz[B] - pz[A];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        if (d > tearD) { alive[c] = 0; tore = true; continue; }
        const wa = pin[A] || A === grab ? 0 : 1, wb = pin[B] || B === grab ? 0 : 1, s = wa + wb;
        if (!s) continue;
        const f = (d - sp) / d, ka = (f * wa) / s, kb = (f * wb) / s;
        px[A] += dx * ka; py[A] += dy * ka; pz[A] += dz * ka;
        px[B] -= dx * kb; py[B] -= dy * kb; pz[B] -= dz * kb;
      }
    }
    if (tore && t - lastTearSound > 0.08) { swish(0.12, 2600, 0.1); lastTearSound = t; }
  }

  const colCache = new Map<number, string>();
  function rgb(r: number, g: number, b: number) {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let s = colCache.get(key);
    if (!s) { s = `rgb(${(r >> 2) << 2},${(g >> 2) << 2},${(b >> 2) << 2})`; colCache.set(key, s); }
    return s;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const ry = y0 - 6;
    ctx.strokeStyle = 'rgba(20,20,20,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0 + cw * 0.12, ry); ctx.lineTo(W / 2, ry - 60); ctx.lineTo(x0 + cw * 0.88, ry); ctx.stroke();
    ctx.fillStyle = '#2a2522'; ctx.beginPath(); ctx.arc(W / 2, ry - 62, 3.5, 0, 7); ctx.fill();
    const w = cols - 1;
    ctx.lineWidth = 0.8;
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < w; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      if (!(alive[hC[a]] && alive[hC[c]] && alive[vC[a]] && alive[vC[b]])) continue;
      const e1x = px[d] - px[a], e1y = py[d] - py[a], e1z = pz[d] - pz[a];
      const e2x = px[b] - px[c], e2y = py[b] - py[c], e2z = pz[b] - pz[c];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const dot = Math.abs((nx * lx + ny * ly + nz * lz) / nl);
      const sh = 0.3 + 0.85 * dot + dot ** 24 * 0.25;
      const k = (j * w + i) * 3;
      const s = rgb(Math.min(255, cellCol[k] * sh) | 0, Math.min(255, cellCol[k + 1] * sh) | 0, Math.min(255, cellCol[k + 2] * sh) | 0);
      ctx.fillStyle = s; ctx.strokeStyle = s;
      ctx.beginPath(); ctx.moveTo(px[a], py[a]); ctx.lineTo(px[b], py[b]); ctx.lineTo(px[d], py[d]); ctx.lineTo(px[c], py[c]); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    const gr = ctx.createLinearGradient(0, ry - 7, 0, ry + 7);
    gr.addColorStop(0, '#c8925b'); gr.addColorStop(0.45, '#9a6234'); gr.addColorStop(1, '#4d2d15');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x0 - 34, ry - 7, cw + 68, 14, 7); ctx.fill();
    ctx.fillStyle = '#3a2414';
    for (const x of [x0 - 38, x0 + cw + 38]) { ctx.beginPath(); ctx.arc(x, ry, 9, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#d6b46a'; ctx.lineWidth = 2.2;
    for (let i = 0; i < cols; i++) if (pin[i]) { ctx.beginPath(); ctx.ellipse(px[i], ry + 1, 4, 9, 0, 0, 7); ctx.stroke(); }
  }

  function nearest(x: number, y: number) {
    let best = -1, bd = 46 * 46;
    for (let k = 0; k < N; k++) {
      if (pin[k]) continue;
      const d = (px[k] - x) ** 2 + (py[k] - y) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function cut(ax: number, ay: number, bx: number, by: number) {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, r2 = (sp * 0.8) ** 2;
    let any = false;
    for (let c = 0; c < C; c++) {
      if (!alive[c]) continue;
      const A = ca[c], B = cb[c], cx = (px[A] + px[B]) / 2, cy = (py[A] + py[B]) / 2;
      let u = ((cx - ax) * vx + (cy - ay) * vy) / l2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      if ((ax + u * vx - cx) ** 2 + (ay + u * vy - cy) ** 2 < r2) { alive[c] = 0; any = true; }
    }
    if (any && t - lastTearSound > 0.06) { swish(0.08, 4200, 0.08); lastTearSound = t; }
  }

  // The canvas ignores pointer events so links painted on the wall stay clickable.
  // We claim the pointer only when it lands on (or near) the cloth.
  const pos = (e: PointerEvent) => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('.bar')) return;
    [mx, my] = pos(e);
    claimed = false;
    if (mode === 'cut' || e.shiftKey) { cutting = true; lx0 = mx; ly0 = my; cut(mx, my, mx, my); root.classList.add('cutting'); }
    else { grab = nearest(mx, my); if (grab < 0) return; root.classList.add('grabbing'); }
    claimed = true;
    root.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  // a press that grabbed or cut the cloth must not also click a link underneath it
  let claimed = false;
  const onClick = (e: MouseEvent) => { if (claimed) { e.preventDefault(); e.stopPropagation(); claimed = false; } };
  root.addEventListener('click', onClick, true);
  const onMove = (e: PointerEvent) => {
    const [x, y] = pos(e);
    if (hoverX >= 0) hoverV = Math.min(30, Math.hypot(x - hoverX, y - hoverY));
    hoverX = x; hoverY = y; mx = x; my = y;
    if (cutting) { cut(lx0, ly0, mx, my); lx0 = mx; ly0 = my; }
  };
  const onUp = () => { grab = -1; cutting = false; root.classList.remove('grabbing', 'cutting'); };
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);

  root.querySelector('.btns')!.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button');
    if (!b) return;
    if (b.dataset.a === 'cut') { mode = mode === 'cut' ? 'pull' : 'cut'; b.setAttribute('aria-pressed', String(mode === 'cut')); }
    if (b.dataset.a === 'wind') { wind = !wind; b.setAttribute('aria-pressed', String(wind)); }
    if (b.dataset.a === 'hang') build();
  });
  const onKey = (e: KeyboardEvent) => { if (e.key === 'r' && !(e.target as Element).closest('input,textarea')) build(); };
  addEventListener('keydown', onKey);

  const ro = new ResizeObserver(resize);
  ro.observe(cv);
  resize();
  // adaptive quality: fewer constraint passes on slow devices
  const stop = fixed(step, draw, (ms) => { iters = ms > 6 ? 3 : ms > 3.5 ? 4 : 5; });

  return () => { stop(); ro.disconnect(); removeEventListener('keydown', onKey); };
};

export default mount;
