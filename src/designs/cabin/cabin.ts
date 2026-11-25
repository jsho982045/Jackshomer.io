import * as THREE from 'three';
import '@fontsource-variable/fraunces';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import './cabin.css';
import { logTexture, plankTexture, stoneTexture, rugTexture, forestTexture, pageTexture, labelTexture } from './textures';
import { audioCtx, click } from '../../lib/sound';
import { jack, jobs } from '../../content/jack';
import type { Mount } from '../registry';

/**
 * Cabin: a log cabin at dusk, rendered with three.js. Physically based
 * materials, filmic tone mapping, a flickering fire (shader flames + embers +
 * a shadow-casting light), rain running down the window and the odd flash of
 * lightning. Everything on the table is a section of the site.
 * All textures are generated in code, so the scene needs no downloads.
 */

const FLAME_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }`;
const FLAME_FS = `uniform float uTime; uniform float uSeed; varying vec2 vUv; ${NOISE}
void main(){
  vec2 uv = vUv;
  float n = fbm(vec2(uv.x*3.0 + uSeed, uv.y*2.6 - uTime*1.7));
  float w = abs(uv.x - 0.5) * (1.5 + uv.y*2.6);
  float shape = 1.0 - smoothstep(0.0, 0.5, w);
  float f = shape * (1.0 - uv.y) * 1.7 - n*0.95 - uv.y*0.25;
  f = clamp(f, 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.7, 0.25), smoothstep(0.15, 0.7, f));
  col = mix(col, vec3(1.0, 0.95, 0.82), smoothstep(0.7, 1.0, f));
  gl_FragColor = vec4(col * f * 2.4, f);
}`;
const RAIN_FS = `uniform float uTime; uniform float uFlash; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = vUv * vec2(1.0, 1.25);
  float a = 0.0;
  for (int l = 0; l < 2; l++){
    float sc = l == 0 ? 20.0 : 36.0;
    vec2 g = uv * sc; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float r = h(id + float(l)*7.0);
    vec2 o = vec2(h(id+3.1) - 0.5, h(id+9.7) - 0.5) * 0.6;
    a += smoothstep(0.1*r + 0.03, 0.0, length(f - o)) * step(0.5, r);
  }
  float cols = 13.0; float cx = floor(uv.x*cols); float rr = h(vec2(cx, 1.0));
  float y = fract(uv.y*0.55 + uTime*(0.10 + rr*0.22) + rr*10.0);
  vec2 p = vec2(fract(uv.x*cols) - 0.5 + sin(uv.y*18.0 + rr*6.0)*0.06, (y - 0.5)*6.0);
  float drop = smoothstep(0.2, 0.0, length(p*vec2(1.0, 0.65)));
  float trail = smoothstep(0.05, 0.0, abs(p.x)) * smoothstep(0.0, 2.5, p.y) * step(0.0, p.y) * 0.3;
  a += (drop + trail) * step(0.3, rr);
  vec3 tint = mix(vec3(0.7, 0.78, 0.9), vec3(1.0), uFlash);
  gl_FragColor = vec4(tint, 0.05 + a*0.32 + uFlash*0.25);
}`;

type Hot = { id: string; label: string; obj: THREE.Object3D; anchor: THREE.Vector3; view: [THREE.Vector3, THREE.Vector3]; html: string; el?: HTMLButtonElement };

const mount: Mount = (root) => {
  root.className = 'design d-cabin';
  root.innerHTML = `
    <canvas aria-label="A log cabin at dusk with a fire burning, rain on the window, and a table of objects about Jack"></canvas>
    <div class="lens"></div>
    <div class="labels"></div>
    <div class="panel" role="dialog" aria-modal="false"><div class="pb"></div><button data-a="back">Back to the room</button></div>
    <div class="loading">Lighting the fire…</div>
    <div class="bar"><p><b>Cabin.</b> Look around with your mouse (or drag). Everything glowing on the table is about me; click it.</p><button data-a="sound" aria-pressed="false">Sound off</button></div>`;
  const cv = root.querySelector('canvas')!;
  const labels = root.querySelector<HTMLDivElement>('.labels')!;
  const panel = root.querySelector<HTMLDivElement>('.panel')!;
  let disposed = false;
  let cleanupScene = () => {};

  const fontsReady = Promise.race([
    Promise.all([document.fonts.load('500 30px Caveat'), document.fonts.load('700 44px Caveat')]),
    new Promise((r) => setTimeout(r, 1200)),
  ]);

  void fontsReady.then(() => {
    if (disposed) return;
    cleanupScene = build();
  });

  function build() {
    const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !coarse, powerPreference: 'high-performance' });
    let dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !coarse;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#06070a');
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);

    // ---------- materials ----------
    const logT = logTexture();
    for (const t of [logT.map, logT.bump]) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(1, 4); }
    const logMat = new THREE.MeshStandardMaterial({ map: logT.map, bumpMap: logT.bump, bumpScale: 0.7, roughness: 0.88, color: '#b59c86' });
    const beamMat = new THREE.MeshStandardMaterial({ map: logT.map, bumpMap: logT.bump, bumpScale: 0.5, roughness: 0.9, color: '#6b5a4c' });
    const plank = plankTexture();
    const floorMat = new THREE.MeshStandardMaterial({ map: plank.map, bumpMap: plank.bump, bumpScale: 0.5, roughness: 0.78, color: '#a99282' });
    const slab = plank.map.clone(), slabB = plank.bump.clone();
    for (const t of [slab, slabB]) { t.repeat.set(0.9, 0.35); t.needsUpdate = true; }
    const tableMat = new THREE.MeshStandardMaterial({ map: slab, bumpMap: slabB, bumpScale: 0.25, roughness: 0.5, color: '#c8a88a' });
    const stone = stoneTexture();
    const stoneMat = new THREE.MeshStandardMaterial({ map: stone.map, bumpMap: stone.bump, bumpScale: 1.2, roughness: 0.95, color: '#c9c3ba' });
    const sootMat = new THREE.MeshStandardMaterial({ color: '#0d0907', roughness: 1, side: THREE.BackSide });
    const chinkMat = new THREE.MeshStandardMaterial({ color: '#8f8270', roughness: 1 });
    const rug = rugTexture();
    const rugMat = new THREE.MeshStandardMaterial({ map: rug.map, bumpMap: rug.bump, bumpScale: 0.6, roughness: 1 });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.5, metalness: 0.8 });
    // Photo-scanned CC0 textures (public/textures, fetched by `npm run textures`) replace the
    // procedural ones as they arrive. If a file is missing the procedural texture simply stays.
    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    function scanned(mat: THREE.MeshStandardMaterial, id: string, repeat: [number, number], tint: string, rot = 0, normal = 1) {
      const load = (m: string, color: boolean) =>
        new Promise<THREE.Texture | null>((res) =>
          loader.load(`/textures/${id}_${m}.webp`, (t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = Math.min(8, maxAniso);
            if (rot) { t.center.set(0.5, 0.5); t.rotation = rot; }
            if (color) t.colorSpace = THREE.SRGBColorSpace;
            res(t);
          }, undefined, () => res(null)),
        );
      void Promise.all([load('diff', true), load('nor', false), load('rough', false)]).then(([d, n, r]) => {
        if (gone || !d) { d?.dispose(); n?.dispose(); r?.dispose(); return; }
        mat.map = d; mat.color.set(tint);
        if (n) { mat.normalMap = n; mat.normalScale.setScalar(normal); mat.bumpMap = null; }
        if (r) { mat.roughnessMap = r; mat.roughness = 1; }
        mat.needsUpdate = true;
      });
    }
    let gone = false;
    const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, cast = true) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true; scene.add(me); return me;
    };

    scanned(logMat, 'rough_wood', [1, 3], '#d9c3ad', Math.PI / 2, 0.8);
    scanned(beamMat, 'rough_wood', [1, 3], '#7c6857', Math.PI / 2, 0.6);
    scanned(floorMat, 'wood_floor_worn', [3, 3], '#cdb8a6');
    scanned(tableMat, 'wood_table_worn', [1, 0.6], '#ffffff', 0, 0.6);
    scanned(stoneMat, 'rustic_stone_wall', [0.8, 0.8], '#ffffff', 0, 1.2);

    // ---------- room: logs, chinking, floor, ceiling ----------
    const R = 0.13, ROWS = 11, WIN = { x0: 0.5, x1: 1.9, y0: 0.95, y1: 2.05 };
    const logGeo = (len: number) => new THREE.CylinderGeometry(R, R, len, 22, 1);
    const addLog = (len: number, pos: THREE.Vector3, axis: 'x' | 'z') => {
      const m = new THREE.Mesh(logGeo(len), logMat);
      if (axis === 'x') m.rotation.z = Math.PI / 2; else m.rotation.x = Math.PI / 2;
      m.position.copy(pos); m.receiveShadow = true; scene.add(m);
    };
    for (let i = 0; i < ROWS; i++) {
      const y = R + i * 0.25;
      if (y + R > WIN.y0 && y - R < WIN.y1) {
        addLog(WIN.x0 + 3.2, new THREE.Vector3((WIN.x0 - 3.2) / 2, y, -3), 'x');
        addLog(3.2 - WIN.x1, new THREE.Vector3((WIN.x1 + 3.2) / 2, y, -3), 'x');
      } else addLog(6.4, new THREE.Vector3(0, y, -3), 'x');
      addLog(5.8, new THREE.Vector3(-3, y, -0.2), 'z');
      addLog(5.8, new THREE.Vector3(3, y, -0.2), 'z');
    }
    {
      // chinking behind the back wall logs, with a hole for the window
      const s = new THREE.Shape([new THREE.Vector2(-3.2, 0), new THREE.Vector2(3.2, 0), new THREE.Vector2(3.2, 2.8), new THREE.Vector2(-3.2, 2.8)]);
      s.holes.push(new THREE.Path([new THREE.Vector2(WIN.x0, WIN.y0), new THREE.Vector2(WIN.x0, WIN.y1), new THREE.Vector2(WIN.x1, WIN.y1), new THREE.Vector2(WIN.x1, WIN.y0)]));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s), chinkMat);
      m.position.z = -3.06; scene.add(m);
      for (const x of [-3.06, 3.06]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 2.8), chinkMat); p.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; p.position.set(x, 1.4, -0.2); scene.add(p); }
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.z = -0.2; floor.receiveShadow = true; scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6), beamMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 2.8, -0.2); scene.add(ceil);
    for (const z of [-2.3, -0.9, 0.5, 1.9]) box(6.4, 0.2, 0.18, beamMat, 0, 2.7, z, false);

    // ---------- window: frame, rain glass, forest outside ----------
    const frameMat = new THREE.MeshStandardMaterial({ color: '#3b2717', roughness: 0.7 });
    const wx = (WIN.x0 + WIN.x1) / 2, wy = (WIN.y0 + WIN.y1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
    box(ww + 0.16, 0.08, 0.3, frameMat, wx, WIN.y0 - 0.02, -2.92);
    box(ww + 0.16, 0.08, 0.2, frameMat, wx, WIN.y1 + 0.02, -2.92);
    box(0.08, wh, 0.2, frameMat, WIN.x0 - 0.02, wy, -2.92);
    box(0.08, wh, 0.2, frameMat, WIN.x1 + 0.02, wy, -2.92);
    box(0.04, wh, 0.06, frameMat, wx, wy, -2.95, false);
    box(ww, 0.04, 0.06, frameMat, wx, wy, -2.95, false);
    const rainU = { uTime: { value: 0 }, uFlash: { value: 0 } };
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.ShaderMaterial({ vertexShader: FLAME_VS, fragmentShader: RAIN_FS, uniforms: rainU, transparent: true, depthWrite: false }));
    glass.position.set(wx, wy, -2.97); scene.add(glass);
    const forestMat = new THREE.MeshBasicMaterial({ map: forestTexture(), color: new THREE.Color(0.8, 0.8, 0.85), fog: false });
    const forest = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), forestMat);
    forest.position.set(wx + 0.4, 2.2, -9); scene.add(forest);

    // ---------- fireplace ----------
    const FZ = -1.1, FX = -2.65;
    box(0.7, 1.3, 0.425, stoneMat, FX, 0.65, FZ - 0.6875);
    box(0.7, 1.3, 0.425, stoneMat, FX, 0.65, FZ + 0.6875);
    box(0.7, 0.68, 0.95, stoneMat, FX, 0.96, FZ);
    box(1.0, 0.08, 2.0, stoneMat, -2.5, 0.04, FZ);
    box(0.58, 0.6, 0.93, sootMat, -2.66, 0.38, FZ, false).receiveShadow = false;
    box(0.55, 1.5, 1.2, stoneMat, -2.72, 2.05, FZ);
    box(0.32, 0.08, 2.1, tableMat, -2.28, 1.34, FZ);
    const emberMat = new THREE.MeshStandardMaterial({ color: '#1c120c', emissive: '#ff4a0a', emissiveIntensity: 0.6, roughness: 1 });
    for (const [z, rot] of [[-0.12, 0.3], [0.1, -0.25], [0, 0]] as const) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.55, 10), emberMat);
      l.rotation.set(Math.PI / 2, 0, rot); l.position.set(-2.62, 0.13 + (z === 0 ? 0.08 : 0), FZ + z); scene.add(l);
    }
    const flameU: { uTime: { value: number }; uSeed: { value: number } }[] = [];
    const flames = new THREE.Group();
    flames.position.set(-2.6, 0.17, FZ);
    for (let i = 0; i < 3; i++) {
      const u = { uTime: { value: 0 }, uSeed: { value: i * 4.7 } };
      flameU.push(u);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42 - i * 0.06, 0.62 - i * 0.08), new THREE.ShaderMaterial({ vertexShader: FLAME_VS, fragmentShader: FLAME_FS, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      f.position.set(0, 0.29 - i * 0.04, (i - 1) * 0.12);
      flames.add(f);
    }
    scene.add(flames);
    const glowC = document.createElement('canvas'); glowC.width = glowC.height = 128;
    { const g = glowC.getContext('2d')!; const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,150,60,.9)'); gr.addColorStop(0.4, 'rgba(255,90,20,.25)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
    const glowTex = new THREE.CanvasTexture(glowC);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    glow.position.set(-2.5, 0.35, FZ); glow.scale.set(1.6, 1.4, 1); scene.add(glow);
    const EM = 70, emPos = new Float32Array(EM * 3), emVel = new Float32Array(EM * 3);
    const resetEmber = (i: number) => {
      emPos[i * 3] = -2.6 + (Math.random() - 0.5) * 0.2; emPos[i * 3 + 1] = 0.2 + Math.random() * 0.2; emPos[i * 3 + 2] = FZ + (Math.random() - 0.5) * 0.5;
      emVel[i * 3] = (Math.random() - 0.3) * 0.002; emVel[i * 3 + 1] = 0.004 + Math.random() * 0.008; emVel[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    };
    for (let i = 0; i < EM; i++) { resetEmber(i); emPos[i * 3 + 1] += Math.random() * 0.8; }
    const emGeo = new THREE.BufferGeometry(); emGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
    const embers = new THREE.Points(emGeo, new THREE.PointsMaterial({ color: '#ffae5a', size: 0.014, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    scene.add(embers);

    // ---------- table, rug, objects ----------
    const rugM = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), rugMat);
    rugM.rotation.x = -Math.PI / 2; rugM.position.set(0.3, 0.006, -0.8); rugM.receiveShadow = true; scene.add(rugM);
    const TY = 0.8, T = { x: 0.3, z: -0.85 };
    box(1.7, 0.07, 0.95, tableMat, T.x, TY - 0.035, T.z);
    for (const [dx, dz] of [[-0.78, -0.4], [0.78, -0.4], [-0.78, 0.4], [0.78, 0.4]]) box(0.07, TY - 0.07, 0.07, tableMat, T.x + dx, (TY - 0.07) / 2, T.z + dz);

    const edgeMat = new THREE.MeshStandardMaterial({ color: '#e9e0cc', roughness: 0.9 });
    const coverMat = new THREE.MeshStandardMaterial({ color: '#5a2a1c', roughness: 0.7 });
    const notebook = new THREE.Group();
    const pageL = new THREE.MeshStandardMaterial({ map: pageTexture([`I'm ${jack.first}.`, `${jack.role},`, `${jack.company}.`, `Brooklyn, born & based.`, `I build web things`, `that feel like objects.`], 'About'), roughness: 0.95 });
    const pageR = new THREE.MeshStandardMaterial({ map: pageTexture([...jobs].filter((j) => !j.minor).reverse().map((j) => `· ${j.start} ${j.company.split(' ')[0]}`).concat(`· ${jack.school}, CS`), 'So far'), roughness: 0.95 });
    for (const [i, pm] of [[-1, pageL], [1, pageR]] as const) {
      const pg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.4), [edgeMat, edgeMat, pm, coverMat, edgeMat, edgeMat]);
      pg.position.set(i * 0.152, 0.006, 0); pg.rotation.z = -i * 0.04; pg.castShadow = pg.receiveShadow = true; notebook.add(pg);
    }
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.006, 0.42), coverMat); cover.position.y = -0.002; cover.castShadow = true; notebook.add(cover);
    notebook.position.set(0.05, TY + 0.004, -0.62); notebook.rotation.y = 0.18; scene.add(notebook);

    const photoTex = labelTexture(256, 320, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, '#f2b47c'); gr.addColorStop(0.6, '#a65b58'); g.fillStyle = '#f3ede0'; g.fillRect(0, 0, 256, 320);
      g.fillStyle = gr; g.fillRect(18, 18, 220, 220); g.fillStyle = '#2b2433';
      for (let x = 18; x < 238; x += 22) { const h = 40 + ((x * 37) % 90); g.fillRect(x, 238 - h, 18, h); }
      g.fillStyle = '#2a2a2a'; g.font = '700 30px Caveat, cursive'; g.textAlign = 'center'; g.fillText(`${jack.company} '25`, 128, 290);
    });
    const photo = new THREE.Group();
    const fbox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.022), [frameMat, frameMat, frameMat, frameMat, new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.35 }), frameMat]);
    fbox.castShadow = true; photo.add(fbox);
    photo.position.set(0.72, TY + 0.15, -1.12); photo.rotation.set(-0.12, -0.35, 0); scene.add(photo);

    const books = new THREE.Group();
    const bookCols = ['#2c3f5c', '#6b2a22', '#2f4a33'];
    jack.projects.forEach((p, i) => {
      const spine = labelTexture(512, 80, (g) => { g.fillStyle = bookCols[i]; g.fillRect(0, 0, 512, 80); g.fillStyle = '#e7d9b4'; g.font = '600 38px "Fraunces Variable", Georgia, serif'; g.textBaseline = 'middle'; g.fillText(p.name, 24, 42); g.fillRect(470, 10, 6, 60); });
      const bm = new THREE.MeshStandardMaterial({ color: bookCols[i], roughness: 0.6 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.045, 0.19), [new THREE.MeshStandardMaterial({ color: '#efe6d0' }), bm, bm, bm, new THREE.MeshStandardMaterial({ map: spine, roughness: 0.6 }), bm]);
      b.position.set(0, 0.0225 + i * 0.046, 0); b.rotation.y = (i - 1) * 0.12; b.castShadow = b.receiveShadow = true; books.add(b);
    });
    books.position.set(0.88, TY, -0.62); books.rotation.y = -0.35; scene.add(books);

    const radio = new THREE.Group();
    const radioFace = labelTexture(300, 190, (g) => {
      g.fillStyle = '#5b3a22'; g.fillRect(0, 0, 300, 190);
      g.fillStyle = '#1a120c'; g.beginPath(); g.roundRect(16, 16, 150, 158, 10); g.fill();
      g.strokeStyle = '#7a5a3a'; g.lineWidth = 3; for (let y = 30; y < 170; y += 10) { g.beginPath(); g.moveTo(26, y); g.lineTo(156, y); g.stroke(); }
      g.fillStyle = '#e8d6a8'; g.fillRect(180, 26, 104, 60); g.fillStyle = '#3a2a1a'; g.font = '600 15px Georgia, serif'; g.textAlign = 'center'; g.fillText('jackshomer.io', 232, 52); g.fillText('ON AIR', 232, 74);
      g.fillStyle = '#c4361c'; g.fillRect(230, 30, 3, 52);
    });
    const woodM = new THREE.MeshStandardMaterial({ color: '#5b3a22', roughness: 0.5 });
    const rbox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.19, 0.14), [woodM, woodM, woodM, woodM, new THREE.MeshStandardMaterial({ map: radioFace, roughness: 0.55 }), woodM]);
    rbox.castShadow = true; rbox.position.y = 0.095; radio.add(rbox);
    for (const x of [0.06, 0.11]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), ironMat); k.rotation.x = Math.PI / 2; k.position.set(x, 0.04, 0.075); radio.add(k); }
    radio.position.set(0.15, TY, -1.15); radio.rotation.y = 0.1; scene.add(radio);

    const mug = new THREE.Group();
    const cer = new THREE.MeshStandardMaterial({ color: '#e7e1d6', roughness: 0.35 });
    const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 24), cer); mb.position.y = 0.05; mb.castShadow = true; mug.add(mb);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16, Math.PI), cer); hd.rotation.z = -Math.PI / 2; hd.position.set(0.045, 0.05, 0); mug.add(hd);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), new THREE.MeshStandardMaterial({ color: '#2a160c', roughness: 0.15 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.09; mug.add(coffee);
    mug.position.set(0.5, TY, -0.5); scene.add(mug);

    const lantern = new THREE.Group();
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.03, 20), ironMat); lb.position.y = 0.015; lantern.add(lb);
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 20, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb45a', emissiveIntensity: 1.2, transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide }));
    lg.position.y = 0.11; lantern.add(lg);
    const lt = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.06, 20), ironMat); lt.position.y = 0.22; lantern.add(lt);
    lantern.position.set(-0.45, TY, -1.05); scene.add(lantern);

    const diplomaTex = labelTexture(400, 300, (g) => {
      g.fillStyle = '#f1e8d2'; g.fillRect(0, 0, 400, 300); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6; g.strokeRect(16, 16, 368, 268);
      g.fillStyle = '#3a2a1a'; g.textAlign = 'center'; g.font = '600 30px "Fraunces Variable", Georgia, serif'; g.fillText(jack.school, 200, 110);
      g.font = '400 22px Georgia, serif'; g.fillText(jack.study, 200, 160); g.fillText(jack.schoolYears.replace(' to ', '–'), 200, 200);
      g.fillStyle = '#9b2a1e'; g.beginPath(); g.arc(320, 240, 22, 0, 7); g.fill();
    });
    const diploma = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.03), [frameMat, frameMat, frameMat, frameMat, new THREE.MeshStandardMaterial({ map: diplomaTex, roughness: 0.6 }), frameMat]);
    diploma.position.set(-0.8, 1.72, -2.84); scene.add(diploma);

    // ---------- lights ----------
    scene.add(new THREE.HemisphereLight('#4a5a7a', '#20160f', 0.55));
    const fire = new THREE.PointLight('#ff8f4a', 8, 0, 2);
    fire.position.set(-2.3, 0.55, FZ); fire.castShadow = !coarse;
    fire.shadow.mapSize.set(512, 512); fire.shadow.bias = -0.003; fire.shadow.radius = 6; fire.shadow.camera.near = 0.1;
    scene.add(fire);
    const lamp = new THREE.PointLight('#ffb35c', 1.4, 0, 2);
    lamp.position.set(-0.45, TY + 0.14, -1.05); scene.add(lamp);
    const moon = new THREE.DirectionalLight('#9fb4d6', 0.9);
    moon.position.set(wx, 2.4, -6); moon.target.position.set(0, 0, 0); scene.add(moon, moon.target);
    const fill = new THREE.PointLight('#ffd2a8', 0.9, 0, 2);
    fill.position.set(0.3, 1.6, 0.6); scene.add(fill);

    // ---------- hotspots ----------
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const contact = [jack.email && `<li><a href="mailto:${jack.email}">${jack.email}</a></li>`, `<li><a href="${jack.linkedin}" target="_blank" rel="noopener">LinkedIn</a></li>`, `<li><a href="${jack.github}" target="_blank" rel="noopener">github.com/${jack.githubHandle}</a></li>`, `<li><a href="/ask">Ask the assistant</a></li>`].filter(Boolean).join('');
    const hots: Hot[] = [
      { id: 'about', label: 'About', obj: notebook, anchor: v(0.05, TY + 0.06, -0.62), view: [v(0.1, TY + 0.62, -0.1), v(0.05, TY, -0.66)], html: `<h2>${jack.name}</h2><p>${jack.headline}</p><p>${jack.role} at ${jack.company}. I got here the long way: data analyst, coding teacher, intern, lead frontend.</p><p><a href="/story">Read my story →</a></p>` },
      { id: 'work', label: 'Work', obj: photo, anchor: v(0.72, TY + 0.33, -1.12), view: [v(0.5, TY + 0.25, -0.45), v(0.72, TY + 0.15, -1.12)], html: `<h2>${jack.company}</h2><p>${jack.role} (${jack.title}) since ${jack.since}. First hire at ${jack.companyAbout}; I now lead ${jack.team}.</p><p>Before that:</p><ul>${jobs.slice(1).filter((j) => !j.minor).map((j) => `<li><b>${j.company}</b>, ${j.title} (${j.when})</li>`).join('')}</ul>` },
      { id: 'projects', label: 'Projects', obj: books, anchor: v(0.88, TY + 0.2, -0.62), view: [v(0.62, TY + 0.38, -0.05), v(0.88, TY + 0.06, -0.62)], html: `<h2>Side projects</h2><ul>${jack.projects.map((p) => `<li><b>${p.name}.</b> ${p.blurb}</li>`).join('')}</ul>` },
      { id: 'contact', label: 'Contact', obj: radio, anchor: v(0.15, TY + 0.25, -1.15), view: [v(0.15, TY + 0.3, -0.55), v(0.15, TY + 0.1, -1.15)], html: `<h2>Get in touch</h2><ul>${contact}</ul>` },
      { id: 'school', label: 'School', obj: diploma, anchor: v(-0.8, 1.98, -2.84), view: [v(-0.6, 1.7, -1.9), v(-0.8, 1.72, -2.84)], html: `<h2>${jack.school}</h2><p>${jack.study}, ${jack.schoolYears}. Before that, I taught myself with free online courses during Covid.</p>` },
    ];
    labels.innerHTML = hots.map((h) => `<button class="hs" data-h="${h.id}">${h.label}</button>`).join('');
    hots.forEach((h) => (h.el = labels.querySelector<HTMLButtonElement>(`[data-h="${h.id}"]`)!));

    // ---------- camera rig ----------
    const home: [THREE.Vector3, THREE.Vector3] = [v(0.1, 1.42, 1.9), v(-0.15, 0.95, -1.4)];
    const camPos = home[0].clone(), camLook = home[1].clone(), goalPos = home[0].clone(), goalLook = home[1].clone();
    // open looking at the fire, then drift over to the table
    let yaw = 0.62, pitch = 0, yawGoal = 0, pitchGoal = 0, focused: Hot | null = null, hovered: Hot | null = null;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-9, -9);
    let downAt: { x: number; y: number; yaw: number } | null = null;

    function focus(h: Hot | null) {
      focused = h;
      root.classList.toggle('focused', !!h);
      if (h) {
        goalPos.copy(h.view[0]); goalLook.copy(h.view[1]);
        panel.querySelector('.pb')!.innerHTML = h.html;
        panel.classList.add('on');
        click(1400, 0.05, 0.08);
      } else {
        goalPos.copy(home[0]); goalLook.copy(home[1]);
        panel.classList.remove('on');
      }
    }
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (downAt && e.pointerType !== 'mouse') yawGoal = Math.max(-0.6, Math.min(0.6, downAt.yaw - ((e.clientX - downAt.x) / r.width) * 1.6));
      else if (e.pointerType === 'mouse' && !focused) { yawGoal = -ndc.x * 0.42; pitchGoal = ndc.y * 0.14; }
    };
    const onDown = (e: PointerEvent) => { if ((e.target as Element) === cv) downAt = { x: e.clientX, y: e.clientY, yaw: yawGoal }; };
    const onUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8;
      downAt = null;
      if (moved) return;
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const h = pick();
      if (h) focus(h); else if (focused) focus(null);
    };
    function pick(): Hot | null {
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(hots.map((h) => h.obj), true)[0];
      if (!hit) return null;
      return hots.find((h) => { let o: THREE.Object3D | null = hit.object; while (o) { if (o === h.obj) return true; o = o.parent; } return false; }) ?? null;
    }
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerup', onUp);
    labels.addEventListener('click', (e) => { const b = (e.target as Element).closest<HTMLButtonElement>('.hs'); if (b) focus(hots.find((h) => h.id === b.dataset.h)!); });
    panel.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-a=back]')) focus(null); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') focus(null); };
    addEventListener('keydown', onKey);

    // ---------- sound: rain bed + fire crackle, synthesized ----------
    let snd: { stop: () => void } | null = null;
    const sBtn = root.querySelector<HTMLButtonElement>('[data-a=sound]')!;
    sBtn.addEventListener('click', () => {
      if (snd) { snd.stop(); snd = null; } else snd = startAmbience();
      sBtn.setAttribute('aria-pressed', String(!!snd)); sBtn.textContent = snd ? 'Sound on' : 'Sound off';
    });
    function startAmbience() {
      const a = audioCtx();
      if (!a) return null;
      const len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
      const g = a.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.09, a.currentTime + 1.5);
      src.connect(hp).connect(lp).connect(g).connect(a.destination); src.start();
      const crackle = window.setInterval(() => { if (Math.random() < 0.55) click(600 + Math.random() * 2600, 0.01 + Math.random() * 0.03, 0.05 + Math.random() * 0.18, 0, 2); }, 140);
      return { stop: () => { clearInterval(crackle); g.gain.linearRampToValueAtTime(0, a.currentTime + 0.4); setTimeout(() => src.stop(), 450); } };
    }
    function thunder() {
      if (!snd) return;
      const a = audioCtx(); if (!a) return;
      const n = a.sampleRate * 3, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = last * 6 * (1 - i / n) ** 2; }
      const s = a.createBufferSource(); s.buffer = buf; const g = a.createGain(); g.gain.value = 0.9; s.connect(g).connect(a.destination); s.start(a.currentTime + 1.2);
    }

    // ---------- loop ----------
    let raf = 0, t = 0, last = performance.now(), flash = 0, nextBolt = 8 + Math.random() * 10, frames = 0, slow = 0;
    const proj = new THREE.Vector3(), dir = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    function resize() {
      const w = root.clientWidth, h = root.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 72 : w / h < 1.2 ? 62 : 55;
      camera.updateProjectionMatrix();
      // tall screens: step back so the table fits
      home[0].set(0.1, w / h < 0.8 ? 1.55 : 1.42, w / h < 0.8 ? 2.6 : 1.9);
      home[1].set(w / h < 0.8 ? 0.2 : -0.15, 0.95, -1.4);
      if (!focused) { goalPos.copy(home[0]); goalLook.copy(home[1]); }
    }
    const ro = new ResizeObserver(resize); ro.observe(root); resize();

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // adaptive resolution: if we keep missing frames, render fewer pixels
      frames++; if (dt > 0.024) slow++;
      if (frames === 90) { if (slow > 45 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); } frames = slow = 0; }

      const flick = 0.75 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 23.7) * 0.06 + Math.sin(t * 3.3) * 0.08 + (Math.random() - 0.5) * 0.08;
      fire.intensity = 8 * flick; fire.position.y = 0.55 + Math.sin(t * 7) * 0.03;
      glow.material.opacity = 0.45 + flick * 0.2;
      emberMat.emissiveIntensity = 0.45 + flick * 0.35;
      lamp.intensity = 1.4 + Math.sin(t * 13) * 0.05;
      for (const u of flameU) u.uTime.value = t;
      flames.rotation.y = Math.atan2(camera.position.x - flames.position.x, camera.position.z - flames.position.z);
      for (let i = 0; i < EM; i++) {
        emPos[i * 3] += emVel[i * 3] + Math.sin(t * 3 + i) * 0.0006; emPos[i * 3 + 1] += emVel[i * 3 + 1]; emPos[i * 3 + 2] += emVel[i * 3 + 2];
        if (emPos[i * 3 + 1] > 1.05) resetEmber(i);
      }
      emGeo.attributes.position.needsUpdate = true;
      // lightning
      nextBolt -= dt;
      if (nextBolt < 0) { flash = 1; nextBolt = 12 + Math.random() * 18; thunder(); }
      flash *= 0.86; const fl = flash > 0.05 ? flash * (0.6 + Math.random() * 0.4) : 0;
      rainU.uTime.value = t; rainU.uFlash.value = fl;
      moon.intensity = 0.9 + fl * 6;
      forestMat.color.setScalar(0.8 + fl * 1.6);

      // camera: ease toward goal, add look-around offsets when not focused
      const k = 1 - Math.pow(0.0015, dt);
      camPos.lerp(goalPos, k); camLook.lerp(goalLook, k);
      const kk = 1 - Math.pow(0.02, dt);
      yaw += ((focused ? 0 : yawGoal) - yaw) * kk; pitch += ((focused ? 0 : pitchGoal) - pitch) * kk;
      camera.position.copy(camPos);
      dir.copy(camLook).sub(camPos).applyAxisAngle(UP, yaw);
      dir.y += pitch * dir.length();
      camera.lookAt(dir.add(camPos));

      // hover (mouse only)
      if (!downAt && !focused) {
        const h = ndc.x > -2 ? pick() : null;
        if (h !== hovered) { hovered?.el?.classList.remove('on'); hovered = h; h?.el?.classList.add('on'); root.classList.toggle('hover', !!h); }
      }
      // keep labels pinned to their objects
      for (const h of hots) {
        proj.copy(h.anchor).project(camera);
        const vis = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
        h.el!.style.transform = `translate(${((proj.x + 1) / 2) * root.clientWidth}px, ${((1 - proj.y) / 2) * root.clientHeight}px) translate(-50%, -100%)`;
        h.el!.style.visibility = vis ? 'visible' : 'hidden';
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVis);
    // compile shaders up front so the first visible frame doesn't hitch
    renderer.compile(scene, camera);
    raf = requestAnimationFrame((n) => { last = n; frame(n); root.querySelector('.loading')!.classList.add('gone'); root.classList.add('ready'); });

    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      snd?.stop();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) { for (const val of Object.values(mat)) if (val instanceof THREE.Texture) val.dispose(); mat.dispose(); }
      });
      renderer.dispose();
    };
  }

  return () => { disposed = true; cleanupScene(); };
};

export default mount;
