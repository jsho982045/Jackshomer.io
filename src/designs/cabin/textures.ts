import * as THREE from 'three';

/**
 * Procedural textures for the cabin, drawn once into canvases.
 * Swap any of these for photo-scanned CC0 textures later without touching the scene.
 */

// ---- value noise ----
const P = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  let s = 1337;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const fade = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const a = P[P[X] + Y] / 255, b = P[P[X + 1] + Y] / 255, c = P[P[X] + Y + 1] / 255, d = P[P[X + 1] + Y + 1] / 255;
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; }
  return s;
}
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}
function tex(c: HTMLCanvasElement, color = true, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/** Pixel-shaded texture: fn returns [r,g,b,height] per pixel. Returns colour map + bump map. */
function shade(w: number, h: number, fn: (u: number, v: number, x: number, y: number) => [number, number, number, number]) {
  const [c, g] = canvas(w, h), [cb, gb] = canvas(w, h);
  const img = g.createImageData(w, h), bump = gb.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, gg, b, hh] = fn(x / w, y / h, x, y);
    const i = (y * w + x) * 4;
    img.data[i] = clamp(r); img.data[i + 1] = clamp(gg); img.data[i + 2] = clamp(b); img.data[i + 3] = 255;
    const v = clamp(hh * 255);
    bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = v; bump.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); gb.putImageData(bump, 0, 0);
  return { c, cb };
}

/** Log surface: lengthwise grain along u, bark-dark knots. Tiles horizontally. */
export function logTexture(size = 512) {
  const { c, cb } = shade(size, size / 2, (u, v) => {
    const n = fbm(u * 6, v * 40, 4);
    const grain = Math.sin((v * 22 + n * 6) * Math.PI) * 0.5 + 0.5;
    const knot = Math.max(0, 1 - Math.hypot((u * 4) % 1 - 0.5, (v - 0.5) * 3) * 4) * (vnoise(Math.floor(u * 4) * 7.1, 3) > 0.6 ? 1 : 0);
    const k = 0.62 + grain * 0.22 + (n - 0.5) * 0.3 - knot * 0.4;
    return [150 * k + 10, 96 * k + 4, 58 * k, 0.4 + grain * 0.35 + n * 0.25 - knot * 0.3];
  });
  return { map: tex(c, true, [3, 1]), bump: tex(cb, false, [3, 1]) };
}

/** Floor planks with seams and per-plank tone. */
export function plankTexture(size = 512) {
  const rows = 6;
  const { c, cb } = shade(size, size, (u, v) => {
    const row = Math.floor(v * rows), rv = (v * rows) % 1;
    const off = vnoise(row * 3.3, 1.7);
    const pu = (u + off) % 1, col = Math.floor((u + off) * 2);
    const tone = 0.75 + vnoise(row * 5.1 + col * 2.3, 9) * 0.35;
    const n = fbm(pu * 4, rv * 2 + row * 3, 4);
    const grain = Math.sin((rv * 18 + n * 6) * Math.PI) * 0.5 + 0.5;
    const seam = rv < 0.03 || rv > 0.97 || ((u + off) * 2) % 1 < 0.006 ? 1 : 0;
    const k = (0.62 + grain * 0.2 + (n - 0.5) * 0.25) * tone * (seam ? 0.25 : 1);
    return [168 * k, 112 * k, 70 * k, seam ? 0 : 0.5 + grain * 0.3];
  });
  return { map: tex(c, true, [4, 4]), bump: tex(cb, false, [4, 4]) };
}

/** Fieldstone: jittered cells (worley-ish) with mortar between. */
export function stoneTexture(size = 512) {
  const cells = 5;
  const pts: [number, number, number][] = [];
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) pts.push([(x + 0.2 + vnoise(x * 3.1, y * 7.7) * 0.6) / cells, (y + 0.2 + vnoise(x * 5.3, y * 1.9) * 0.6) / cells, vnoise(x * 9.1, y * 4.4)]);
  const { c, cb } = shade(size, size, (u, v) => {
    // only the 3x3 neighbouring cells can hold the nearest points (wrapping for seamless tiling)
    let d1 = 9, d2 = 9, id = 0;
    const ix = Math.floor(u * cells), iy = Math.floor(v * cells);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = ix + dx, gy = iy + dy, cx = (gx + cells) % cells, cy = (gy + cells) % cells, i = cy * cells + cx;
      const d = Math.hypot(u - (pts[i][0] + (gx - cx) / cells), v - (pts[i][1] + (gy - cy) / cells));
      if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
    }
    const edge = d2 - d1;
    const mortar = edge < 0.022 ? 1 : 0;
    const n = fbm(u * 20, v * 20, 3);
    const t = pts[id][2];
    const k = mortar ? 0.35 + n * 0.15 : 0.55 + t * 0.35 + (n - 0.5) * 0.35;
    const warm = mortar ? [120, 112, 100] : [150 + t * 30, 140 + t * 10, 125 - t * 10];
    return [warm[0] * k, warm[1] * k, warm[2] * k, mortar ? 0 : Math.min(1, edge * 14) * 0.7 + n * 0.3];
  });
  return { map: tex(c, true, [1, 1]), bump: tex(cb, false, [1, 1]) };
}

/** Wool rug: woven stripes. */
export function rugTexture() {
  const { c, cb } = shade(256, 256, (u, v, x, y) => {
    const band = Math.floor(v * 9);
    const pal = [[120, 34, 30], [190, 150, 90], [40, 50, 70], [190, 150, 90], [120, 34, 30], [70, 40, 30], [190, 150, 90], [40, 50, 70], [120, 34, 30]][band];
    const weave = ((x + (y >> 1)) % 4 < 2 ? 1 : 0.86) * (0.9 + fbm(u * 30, v * 30, 2) * 0.2);
    const edge = u < 0.04 || u > 0.96 ? 0.55 : 1;
    return [pal[0] * weave * edge, pal[1] * weave * edge, pal[2] * weave * edge, weave * 0.8];
  });
  return { map: tex(c), bump: tex(cb, false) };
}

/** Dusk forest seen through the window: sky, distant ridges, fogged pines. */
export function forestTexture() {
  const [c, g] = canvas(1024, 512);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#1a2233'); sky.addColorStop(0.45, '#3b4a63'); sky.addColorStop(0.7, '#6d7891'); sky.addColorStop(1, '#4a5466');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  const layers = [
    { y: 300, h: 140, col: '#3e4a5c', n: 46, a: 0.9 },
    { y: 340, h: 190, col: '#2b3442', n: 34, a: 1 },
    { y: 390, h: 260, col: '#161c25', n: 22, a: 1 },
  ];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647), s / 2147483647);
  for (const L of layers) {
    g.fillStyle = L.col; g.globalAlpha = L.a;
    for (let i = 0; i < L.n; i++) {
      const x = (i / L.n) * 1100 - 40 + rnd() * 30, h = L.h * (0.6 + rnd() * 0.6), w = h * 0.32;
      g.beginPath();
      for (let k = 0; k <= 8; k++) {
        const ty = L.y - h + (h * k) / 8, tw = (w * k) / 8;
        g.lineTo(x - tw * (k % 2 ? 0.75 : 1), ty);
      }
      for (let k = 8; k >= 0; k--) {
        const ty = L.y - h + (h * k) / 8, tw = (w * k) / 8;
        g.lineTo(x + tw * (k % 2 ? 0.75 : 1), ty);
      }
      g.closePath(); g.fill();
    }
    g.fillRect(0, L.y - 2, 1024, 512);
    // fog between layers
    const f = g.createLinearGradient(0, L.y - L.h * 0.6, 0, L.y + 40);
    f.addColorStop(0, 'rgba(110,122,145,0)'); f.addColorStop(1, 'rgba(110,122,145,.35)');
    g.globalAlpha = 1; g.fillStyle = f; g.fillRect(0, L.y - L.h, 1024, L.h + 60);
  }
  return tex(c);
}

/** Paper with handwritten lines (for the notebook). */
export function pageTexture(lines: string[], title: string) {
  const [c, g] = canvas(512, 680);
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 512, 680);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * 0.05})`; g.fillRect(Math.random() * 512, Math.random() * 680, 2, 2); }
  g.strokeStyle = 'rgba(80,110,160,.35)'; g.lineWidth = 1.5;
  for (let y = 130; y < 660; y += 50) { g.beginPath(); g.moveTo(30, y); g.lineTo(490, y); g.stroke(); }
  g.fillStyle = '#23324f';
  g.font = '700 56px Caveat, "Bradley Hand", cursive'; g.fillText(title, 40, 92);
  g.font = '500 40px Caveat, "Bradley Hand", cursive';
  lines.forEach((l, i) => g.fillText(l, 40, 172 + i * 50, 440));
  return tex(c);
}

/** Simple label texture (book spines, radio dial, photo). */
export function labelTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const [c, g] = canvas(w, h);
  draw(g);
  return tex(c);
}
