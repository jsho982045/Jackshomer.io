import * as THREE from 'three';

/**
 * WebGL renderer for Gel. The soft-body physics stays in gel.ts; here each
 * gummy becomes a smooth triangle fan whose fragment shader treats it as a
 * squashed glass-like dome: it refracts the table behind it (offset by the
 * dome normal and thickness), absorbs light through its body (Beer–Lambert, so
 * thick middles are deeper in colour), and picks up a sharp specular, a
 * Fresnel rim and a soft internal glow. Shadows are drawn into the backdrop
 * first, so they get refracted too.
 */

export interface BlobView { x: Float32Array; y: Float32Array; cx: number; cy: number; r: number; col: string }

const SUB = 3; // smoothing samples per physics segment

const VS = `
attribute vec2 aP;
varying vec2 vP;
void main(){ vP = aP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FS = `
uniform sampler2D uBg; uniform vec2 uRes; uniform vec3 uCol; uniform float uR;
varying vec2 vP;
void main(){
  float d2 = clamp(dot(vP, vP), 0.0, 1.0);
  float h = sqrt(1.0 - d2);                       // dome height = thickness
  vec3 n = normalize(vec3(vP.x * 1.15, -vP.y * 1.15, h + 0.15));
  vec2 uv = gl_FragCoord.xy / uRes;
  // refraction: bend the view through the dome; stronger near the rim
  vec2 off = n.xy * (0.35 + 0.65 * (1.0 - h)) * uR * 0.55 / uRes;
  vec3 bg = texture2D(uBg, uv - off * 1.0).rgb;
  bg = 0.6 * bg + 0.4 * texture2D(uBg, uv - off * 1.15).rgb;  // a touch of blur/dispersion
  // absorption through the body
  vec3 absorb = mix(vec3(1.0), uCol, 0.74 + 0.26 * h);
  vec3 c = bg * absorb * 1.02 + uCol * 0.3 * h;
  // light from the top-left: soft diffuse, a sharp highlight and a broad sheen
  vec3 L = normalize(vec3(-0.5, 0.65, 0.6));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(n, H), 0.0), 140.0) * 1.6 + pow(max(dot(n, H), 0.0), 18.0) * 0.12;
  float fres = pow(1.0 - max(n.z, 0.0), 3.0);
  // light that enters the body pools on the side away from the light
  float glow = smoothstep(0.2, 1.0, dot(-n.xy, L.xy)) * (1.0 - h) * 0.5;
  c += uCol * glow * 0.55;
  c = mix(c, uCol * 0.45, smoothstep(0.88, 1.0, sqrt(d2)) * 0.6); // darker meniscus at the edge
  c += vec3(1.0, 0.98, 0.94) * spec + vec3(1.0) * fres * 0.16;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(90,45,20,1)'); gr.addColorStop(0.55, 'rgba(90,45,20,.55)'); gr.addColorStop(1, 'rgba(90,45,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function backdropCanvas(W: number, H: number, floor: number) {
  const c = document.createElement('canvas'); c.width = Math.max(1, W); c.height = Math.max(1, H);
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, Math.max(W, H) * 0.75);
  gr.addColorStop(0, '#fbf3ea'); gr.addColorStop(0.7, '#eadccd'); gr.addColorStop(1, '#d8c6b3');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // a printed candy-shop paper: faint stripes and dots, which is what the gummies bend
  g.globalAlpha = 0.045; g.fillStyle = '#b24a3a';
  for (let x = -H; x < W; x += 46) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 18, 0); g.lineTo(x + 18 + H, H); g.lineTo(x + H, H); g.fill(); }
  g.globalAlpha = 0.1; g.fillStyle = '#7a5640';
  for (let y = 12; y < H; y += 28) for (let x = (y / 28) % 2 ? 14 : 0; x < W; x += 28) { g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // the table
  const tg = g.createLinearGradient(0, floor, 0, H);
  tg.addColorStop(0, 'rgba(120,80,50,.16)'); tg.addColorStop(1, 'rgba(120,80,50,.04)');
  g.fillStyle = tg; g.fillRect(0, floor, W, H - floor);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, floor, W, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function gelGL(cv: HTMLCanvasElement, N: number) {
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  const bgScene = new THREE.Scene(), scene = new THREE.Scene();
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  const paperMat = new THREE.MeshBasicMaterial();
  const paper = new THREE.Mesh(quadGeo, paperMat); bgScene.add(paper);
  const shown = new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial({ map: rt.texture })); scene.add(shown);
  const shTex = shadowTexture();
  const res = new THREE.Vector2();

  type G = { mesh: THREE.Mesh; pos: THREE.BufferAttribute; ap: THREE.BufferAttribute; shadow: THREE.Mesh; mat: THREE.ShaderMaterial };
  let gs: G[] = [];
  const M = N * SUB;

  function setBlobs(blobs: BlobView[]) {
    for (const g of gs) { scene.remove(g.mesh); bgScene.remove(g.shadow); g.mesh.geometry.dispose(); g.mat.dispose(); (g.shadow.material as THREE.Material).dispose(); }
    gs = blobs.map((b, i) => {
      const geo = new THREE.BufferGeometry();
      const pos = new THREE.BufferAttribute(new Float32Array((M + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage);
      const ap = new THREE.BufferAttribute(new Float32Array((M + 1) * 2), 2).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('position', pos); geo.setAttribute('aP', ap);
      const idx: number[] = [];
      for (let k = 0; k < M; k++) idx.push(0, 1 + k, 1 + ((k + 1) % M));
      geo.setIndex(idx);
      const col = new THREE.Color(b.col).convertSRGBToLinear();
      const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uBg: { value: rt.texture }, uRes: { value: res }, uCol: { value: new THREE.Vector3(col.r, col.g, col.b) }, uR: { value: b.r } }, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.position.z = i * 0.001 + 1; scene.add(mesh);
      const shadow = new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.3 }));
      shadow.position.z = 0.5; bgScene.add(shadow);
      return { mesh, pos, ap, shadow, mat };
    });
  }

  let W = 1, H = 1, floor = 1;
  function resize(w: number, h: number, dpr: number, fl: number) {
    W = w; H = h; floor = fl;
    const pr = Math.min(dpr, coarse ? 1.5 : 2);
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    rt.setSize(Math.round(W * pr), Math.round(H * pr));
    res.set(Math.round(W * pr), Math.round(H * pr));
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H; camera.updateProjectionMatrix();
    paperMat.map?.dispose(); paperMat.map = backdropCanvas(W, H, floor); paperMat.needsUpdate = true;
    for (const m of [paper, shown]) { m.scale.set(W, H, 1); m.position.set(W / 2, -H / 2, 0); }
  }

  function draw(blobs: BlobView[]) {
    for (let bi = 0; bi < blobs.length; bi++) {
      const b = blobs[bi], g = gs[bi];
      if (!g) continue;
      const p = g.pos.array as Float32Array, a = g.ap.array as Float32Array;
      p[0] = b.cx; p[1] = -b.cy; a[0] = 0; a[1] = 0;
      // smooth outline: quadratic B-spline through the edge midpoints, like the 2D version
      let o = 1;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, h = (i + N - 1) % N;
        const sx = (b.x[h] + b.x[i]) / 2, sy = (b.y[h] + b.y[i]) / 2, ex = (b.x[i] + b.x[j]) / 2, ey = (b.y[i] + b.y[j]) / 2;
        for (let s = 0; s < SUB; s++, o++) {
          const t = s / SUB, u = 1 - t;
          const x = u * u * sx + 2 * u * t * b.x[i] + t * t * ex, y = u * u * sy + 2 * u * t * b.y[i] + t * t * ey;
          p[o * 3] = x; p[o * 3 + 1] = -y; p[o * 3 + 2] = 0;
          // local dome coordinate: 0 at the centre, unit length at the rim
          const dx = x - b.cx, dy = y - b.cy, l = Math.hypot(dx, dy) || 1;
          a[o * 2] = (dx / l) * 0.999; a[o * 2 + 1] = (dy / l) * 0.999;
        }
      }
      g.pos.needsUpdate = true; g.ap.needsUpdate = true;
      g.mat.uniforms.uR.value = b.r;
      // contact shadow: tighter and darker as the gummy nears the table
      const s = Math.max(0.15, 1 - Math.max(0, floor - (b.cy + b.r)) / 400);
      g.shadow.scale.set((b.r * 2.3 * s + 8), (b.r * 0.42 * s + 5), 1);
      g.shadow.position.set(b.cx, -(floor + 2), 0.5);
      (g.shadow.material as THREE.MeshBasicMaterial).opacity = 0.42 * s;
    }
    renderer.setRenderTarget(rt); renderer.render(bgScene, camera);
    renderer.setRenderTarget(null); renderer.render(scene, camera);
  }

  function dispose() {
    for (const g of gs) { g.mesh.geometry.dispose(); g.mat.dispose(); (g.shadow.material as THREE.Material).dispose(); }
    paperMat.map?.dispose(); paperMat.dispose(); shTex.dispose(); quadGeo.dispose(); rt.dispose(); renderer.dispose();
  }

  return { setBlobs, resize, draw, dispose };
}
