import '@fontsource-variable/fraunces';
import './globe.css';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { jack, jobs } from '../../content/jack';
import { sample, preload } from '../../lib/sound';
import type { Mount } from '../registry';

/**
 * Snow globe: a tiny New York under glass. Brownstones, an art-deco tower, a
 * suspension bridge, a college clock tower and a subway entrance, each one a
 * section. Drag to spin it, shake it (button, fast drag, or shake your phone)
 * and the snow swirls with the rotation, then settles; the labels come back
 * once it does.
 */

const R = 1;            // globe radius
const GY = -0.42;       // snow floor inside the globe
const FLOOR_R = Math.sqrt(R * R - GY * GY) - 0.02;

type Hot = { id: string; label: string; obj: THREE.Object3D; anchor: THREE.Vector3; html: string; el?: HTMLButtonElement };

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** facade + matching emissive map: a grid of windows, some lit */
function windows(cols: number, rows: number, wall: string, seed: number, lit = 0.45) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const W = cols * 16, H = rows * 24, on: boolean[] = [];
  for (let i = 0; i < cols * rows; i++) on.push(rnd() < lit);
  const map = canvasTex(W, H, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      g.fillStyle = on[r * cols + c] ? '#ffd79a' : '#1d2330';
      g.fillRect(c * 16 + 4, r * 24 + 5, 8, 13);
    }
  });
  const glow = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (on[r * cols + c]) {
      g.fillStyle = '#ffc77a'; g.fillRect(c * 16 + 4, r * 24 + 5, 8, 13);
    }
  });
  return { map, glow };
}

const mount: Mount = (root) => {
  root.className = 'd-globe';
  root.innerHTML = `
    <canvas aria-label="A snow globe with a tiny New York inside. Drag to spin it, shake it to make it snow."></canvas>
    <div class="labels"></div>
    <aside class="panel" aria-live="polite"><div class="body"></div><button class="close">Back to the globe</button></aside>
    <div class="hint"><b>Snow globe.</b> Drag to spin it. Shake it (or shake your hand at the camera with ✋ on), then let the snow settle. Tap a building to visit.</div>
    <div class="ctrl"><button class="shake">Shake it</button></div>`;
  const cv = root.querySelector('canvas')!;
  const labels = root.querySelector<HTMLDivElement>('.labels')!;
  const panel = root.querySelector<HTMLElement>('.panel')!;
  const body = panel.querySelector<HTMLDivElement>('.body')!;
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 700;

  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !coarse;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // a dark studio with a few soft windows: crisp highlights on the glass without a grey haze
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#05070c');
  const panelM = (c: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide });
  const softbox = (w: number, h: number, c: string, k: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), panelM(c, k)); m.scale.set(w / 2, h / 2, 1); m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m); };
  softbox(3, 2, '#fff1dc', 3, 4, 5, 5);      // key, warm, upper right
  softbox(1.2, 4, '#9fb8ff', 1.6, -6, 1, -2); // cool rim
  softbox(6, 1, '#ffb070', 0.8, 0, -3, 6);    // warm bounce from below
  const env = pmrem.fromScene(studio, 0.02).texture;
  studio.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); });
  scene.environment = env;
  // a night sky behind the globe; the glass refracts it, so it has to be in the scene
  const sky = canvasTex(512, 512, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#0b1222'); gr.addColorStop(0.55, '#18223a'); gr.addColorStop(0.8, '#3a2c2c'); gr.addColorStop(1, '#22160f');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    const glow = g.createRadialGradient(256, 400, 10, 256, 400, 300);
    glow.addColorStop(0, 'rgba(255,170,90,.28)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 512, 512);
  });
  scene.background = sky;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight('#8fa6d6', '#2a1c14', 0.7));
  const key = new THREE.DirectionalLight('#ffe2bd', 1.6);
  key.position.set(2.2, 3.5, 2.5);
  key.castShadow = !coarse;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.5, far: 9 });
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#7fa0ff', 0.9);
  rim.position.set(-3, 1.5, -2.5); scene.add(rim);

  const globe = new THREE.Group(); scene.add(globe);   // wobbles when shaken
  const city = new THREE.Group(); globe.add(city);      // spins when dragged

  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  const add = <T extends THREE.Object3D>(o: T, p: THREE.Object3D = city) => (p.add(o), o);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, p: THREE.Object3D = city) => {
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; return add(me, p);
  };
  const snowM = std({ color: '#f4f7fb', roughness: 0.85 });

  // ---------- snowy ground ----------
  const groundG = new THREE.CircleGeometry(FLOOR_R, 64);
  { // gentle drifts
    const p = groundG.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y) / FLOOR_R;
      p.setZ(i, (Math.sin(x * 9) * Math.cos(y * 7) * 0.012 + r * r * 0.03));
    }
    groundG.computeVertexNormals();
  }
  const ground = mesh(groundG, snowM, 0, GY, 0);
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  // a street across the middle, lightly dusted
  const street = mesh(new THREE.PlaneGeometry(1.7, 0.2), std({ color: '#5d6270', roughness: 0.6 }), 0, GY + 0.004, 0.18);
  street.rotation.x = -Math.PI / 2; street.castShadow = false;

  // ---------- the tower (Work) ----------
  const tower = add(new THREE.Group()); tower.position.set(0.02, GY, -0.3);
  const lime = '#cdbf9f';
  const tiers: [number, number][] = [[0.24, 0.42], [0.19, 0.2], [0.14, 0.14], [0.09, 0.1]];
  let ty = 0;
  tiers.forEach(([w, h], i) => {
    const { map, glow } = windows(Math.round(w * 40), Math.round(h * 30), lime, 7 + i, 0.5);
    const m = std({ map, emissiveMap: glow, emissive: '#ffffff', emissiveIntensity: 1.1, roughness: 0.7 });
    mesh(new THREE.BoxGeometry(w, h, w), m, 0, ty + h / 2, 0, tower);
    mesh(new THREE.BoxGeometry(w + 0.012, 0.012, w + 0.012), snowM, 0, ty + h + 0.006, 0, tower);
    ty += h;
  });
  mesh(new THREE.CylinderGeometry(0.004, 0.018, 0.2, 8), std({ color: '#d8d2c2', metalness: 0.8, roughness: 0.3 }), 0, ty + 0.1, 0, tower);
  const beacon = mesh(new THREE.SphereGeometry(0.008, 8, 6), std({ color: '#ff3b2e', emissive: '#ff3b2e', emissiveIntensity: 3 }), 0, ty + 0.21, 0, tower);
  beacon.castShadow = false;

  // ---------- brownstones (Story) ----------
  const row = add(new THREE.Group()); row.position.set(-0.47, GY, 0.0); row.rotation.y = 0.5;
  const brown = ['#6e3f2b', '#7a4733', '#5f3626'];
  brown.forEach((c, i) => {
    const { map, glow } = windows(3, 4, c, 30 + i, 0.55);
    const m = std({ map, emissiveMap: glow, emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.85 });
    const x = (i - 1) * 0.15;
    mesh(new THREE.BoxGeometry(0.145, 0.3, 0.2), [m, m, snowM, m, m, m], x, 0.15, 0, row);
    mesh(new THREE.BoxGeometry(0.155, 0.02, 0.21), std({ color: '#3a2a20', roughness: 0.7 }), x, 0.3, 0, row);
    // stoop with a snowy top step
    for (let s = 0; s < 3; s++) mesh(new THREE.BoxGeometry(0.05, 0.02, 0.025), s === 2 ? snowM : std({ color: '#4e3a30' }), x + 0.035, 0.01 + s * 0.02, 0.11 + (2 - s) * 0.022, row);
  });

  // ---------- bridge (Projects) ----------
  const bridge = add(new THREE.Group()); bridge.position.set(0.47, GY, 0.12); bridge.rotation.y = -0.9;
  const stone = std({ color: '#a99c86', roughness: 0.9 });
  mesh(new THREE.BoxGeometry(0.66, 0.025, 0.08), std({ color: '#5a4a3c', roughness: 0.8 }), 0, 0.12, 0, bridge);
  mesh(new THREE.BoxGeometry(0.66, 0.006, 0.082), snowM, 0, 0.136, 0, bridge);
  for (const x of [-0.2, 0.2]) {
    for (const z of [-0.035, 0.035]) mesh(new THREE.BoxGeometry(0.04, 0.33, 0.022), stone, x, 0.165, z, bridge);
    mesh(new THREE.BoxGeometry(0.05, 0.03, 0.1), stone, x, 0.32, 0, bridge);
    mesh(new THREE.BoxGeometry(0.05, 0.03, 0.1), stone, x, 0.2, 0, bridge);
  }
  const cableM = new THREE.LineBasicMaterial({ color: '#d9d2c4' });
  for (const z of [-0.04, 0.04]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -0.33 + (i / 40) * 0.66;
      const between = Math.abs(x) <= 0.2;
      const y = between ? 0.14 + 0.18 * (x / 0.2) ** 2 : 0.33 - (Math.abs(x) - 0.2) * 1.4;
      pts.push(new THREE.Vector3(x, Math.max(0.135, y), z));
    }
    add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableM), bridge);
  }

  // ---------- clock tower (School) ----------
  const clock = add(new THREE.Group()); clock.position.set(-0.3, GY, -0.52);
  const brick = std({ color: '#8a4b38', roughness: 0.9 });
  mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), brick, 0, 0.07, 0, clock);
  mesh(new THREE.BoxGeometry(0.23, 0.01, 0.15), snowM, 0, 0.145, 0, clock);
  mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), brick, 0, 0.25, 0, clock);
  const face = std({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#f2ead2'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 32); g.lineTo(32, 12); g.moveTo(32, 32); g.lineTo(46, 38); g.stroke(); }), emissive: '#fff1c8', emissiveIntensity: 0.4 });
  mesh(new THREE.CircleGeometry(0.026, 20), face, 0, 0.3, 0.041, clock).castShadow = false;
  mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), std({ color: '#efeae0' }), 0, 0.385, 0, clock);
  mesh(new THREE.ConeGeometry(0.05, 0.08, 8), snowM, 0, 0.45, 0, clock);

  // ---------- subway entrance (Contact) ----------
  const subway = add(new THREE.Group()); subway.position.set(0.12, GY, 0.52); subway.rotation.y = 0.2;
  const rail = std({ color: '#2b4a35', roughness: 0.5, metalness: 0.4 });
  mesh(new THREE.BoxGeometry(0.16, 0.05, 0.006), rail, 0, 0.025, -0.05, subway);
  for (const x of [-0.08, 0.08]) {
    mesh(new THREE.BoxGeometry(0.006, 0.05, 0.1), rail, x, 0.025, 0, subway);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), rail, x, 0.06, 0.05, subway);
    const lamp = mesh(new THREE.SphereGeometry(0.016, 14, 10), std({ color: '#4fd27a', emissive: '#3ddc6e', emissiveIntensity: 2.5 }), x, 0.125, 0.05, subway);
    lamp.castShadow = false;
  }
  const stairs = mesh(new THREE.PlaneGeometry(0.15, 0.1), std({ color: '#151515' }), 0, GY * 0 + 0.002, 0, subway);
  stairs.rotation.x = -Math.PI / 2;

  // ---------- trees, lamp posts, a taxi ----------
  const pine = std({ color: '#1f4a33', roughness: 0.9 });
  const treeAt = (x: number, z: number, s = 1) => {
    const t = add(new THREE.Group()); t.position.set(x, GY, z); t.scale.setScalar(s);
    mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.04, 6), std({ color: '#3d2a1c' }), 0, 0.02, 0, t);
    for (let i = 0; i < 3; i++) {
      mesh(new THREE.ConeGeometry(0.05 - i * 0.012, 0.07, 10), pine, 0, 0.06 + i * 0.04, 0, t);
      mesh(new THREE.ConeGeometry(0.03 - i * 0.008, 0.03, 10), snowM, 0, 0.085 + i * 0.04, 0, t);
    }
  };
  [[-0.66, 0.34, 1.1], [-0.2, 0.62, 0.9], [0.62, -0.32, 1], [0.38, -0.55, 0.8], [-0.62, -0.3, 0.9], [0.7, 0.42, 0.85], [-0.42, 0.55, 0.75]].forEach(([x, z, s]) => treeAt(x, z, s));
  const warm = std({ color: '#ffd59a', emissive: '#ffb45c', emissiveIntensity: 3 });
  const lamps: THREE.PointLight[] = [];
  [[-0.2, 0.3], [0.3, 0.3], [-0.05, 0.06]].forEach(([x, z], i) => {
    mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.13, 6), std({ color: '#222' }), x, GY + 0.065, z);
    mesh(new THREE.SphereGeometry(0.01, 10, 8), warm, x, GY + 0.135, z).castShadow = false;
    if (i < (coarse ? 1 : 3)) { const l = new THREE.PointLight('#ffb25e', 0.25, 0.6, 2); l.position.set(x, GY + 0.14, z); city.add(l); lamps.push(l); }
  });
  const taxi = add(new THREE.Group()); taxi.position.set(-0.15, GY + 0.012, 0.2);
  const yellow = std({ color: '#f2b705', roughness: 0.4 });
  mesh(new RoundedBoxGeometry(0.09, 0.022, 0.04, 2, 0.006), yellow, 0, 0.011, 0, taxi);
  mesh(new RoundedBoxGeometry(0.05, 0.018, 0.036, 2, 0.006), yellow, -0.005, 0.03, 0, taxi);
  mesh(new THREE.BoxGeometry(0.012, 0.006, 0.01), std({ color: '#fff', emissive: '#fff8d0', emissiveIntensity: 2 }), -0.005, 0.042, 0, taxi);

  // ---------- glass ----------
  const glassM = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.08, ior: 1.45,
    envMapIntensity: 1, specularIntensity: 1, clearcoat: 0.5, clearcoatRoughness: 0.03, depthWrite: false,
  });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, coarse ? 48 : 72, coarse ? 32 : 48, 0, Math.PI * 2, 0, Math.acos(GY / R)), glassM);
  glass.renderOrder = 2;
  globe.add(glass);

  // ---------- base ----------
  const walnut = std({ color: '#4a2a17', roughness: 0.5, envMapIntensity: 0.6 });
  new THREE.TextureLoader().load('/textures/american_walnut_veneer_diff.webp', (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
    walnut.map = t; walnut.color.set('#b88a6a'); walnut.needsUpdate = true;
  }, undefined, () => {});
  const brass = std({ color: '#d6b46a', metalness: 1, roughness: 0.28 });
  const baseG = new THREE.CylinderGeometry(0.95, 1.12, 0.5, 64, 1);
  const base = mesh(baseG, walnut, 0, GY - 0.27, 0, globe);
  base.castShadow = true;
  mesh(new THREE.TorusGeometry(FLOOR_R + 0.03, 0.025, 12, 72), brass, 0, GY - 0.01, 0, globe).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(1.13, 1.13, 0.04, 64), brass, 0, GY - 0.54, 0, globe);
  const plaque = mesh(new THREE.PlaneGeometry(0.62, 0.17), std({
    map: canvasTex(620, 170, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, '#f0d58e'); gr.addColorStop(1, '#a7803a');
      g.fillStyle = gr; g.fillRect(0, 0, 620, 170);
      g.strokeStyle = 'rgba(70,45,10,.6)'; g.lineWidth = 4; g.strokeRect(10, 10, 600, 150);
      g.fillStyle = '#3a2408'; g.textAlign = 'center';
      g.font = '600 54px "Fraunces Variable", Georgia, serif'; g.fillText(jack.name.toUpperCase(), 310, 88);
      g.font = '500 26px "Fraunces Variable", Georgia, serif'; g.fillText('BROOKLYN · NEW YORK', 310, 132);
    }), metalness: 0.5, roughness: 0.45, envMapIntensity: 0.6,
  }), 0, GY - 0.27, 1.045, globe);
  plaque.rotation.x = -0.32;
  // a soft shadow on the "table"
  const shadowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = GY - 0.56; scene.add(shadow);

  // ---------- snow ----------
  const N = coarse ? 700 : 1600;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.85;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = GY + Math.random() * 1.3; pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = Math.random() * 100;
  }
  const snowG = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  snowG.setAttribute('position', posAttr);
  const flake = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const snow = new THREE.Points(snowG, new THREE.PointsMaterial({ map: flake, size: coarse ? 0.034 : 0.028, sizeAttenuation: true, transparent: true, depthWrite: false, color: '#ffffff' }));
  snow.renderOrder = 3; snow.frustumCulled = false;
  globe.add(snow);
  let energy = 1.4, lastShake = performance.now();

  function shake(power = 1) {
    energy = Math.min(4, energy + 2.2 * power);
    lastShake = performance.now();
    for (let i = 0; i < N; i++) {
      if (pos[i * 3 + 1] < GY + 0.03 || Math.random() < 0.5) {
        vel[i * 3] += (Math.random() - 0.5) * 1.2 * power;
        vel[i * 3 + 1] += (0.6 + Math.random() * 1.6) * power;
        vel[i * 3 + 2] += (Math.random() - 0.5) * 1.2 * power;
      }
    }
    wobble = 1;
    sample('glass_001', { gain: 0.3, jitter: 0.1 });
    root.classList.remove('settled');
  }

  function stepSnow(dt: number, t: number, spin: number) {
    const drag = Math.exp(-1.9 * dt), e = energy;
    for (let i = 0; i < N; i++) {
      const k = i * 3;
      let x = pos[k], y = pos[k + 1], z = pos[k + 2];
      let vx = vel[k], vy = vel[k + 1], vz = vel[k + 2];
      if (y <= GY + 0.006 && e < 0.15 && vy <= 0) continue; // resting on the floor
      const s = seed[i];
      // gentle flutter, stronger while the water is stirred up
      vx += Math.sin(t * 0.9 + s + y * 4) * (0.05 + e * 0.5) * dt;
      vz += Math.cos(t * 0.8 + s * 1.3 + x * 4) * (0.05 + e * 0.5) * dt;
      vy += (Math.sin(t * 0.7 + s * 2) * e * 0.4 - 0.16) * dt;
      // the water follows the glass when it spins
      vx += -z * spin * 2.4 * dt; vz += x * spin * 2.4 * dt;
      vx *= drag; vy *= drag; vz *= drag;
      x += vx * dt; y += vy * dt; z += vz * dt;
      // stay inside the glass
      const d = Math.hypot(x, y, z), lim = R - 0.05;
      if (d > lim) { const f = lim / d; x *= f; y *= f; z *= f; const dot = (vx * x + vy * y + vz * z) / (lim * lim); vx -= 1.6 * dot * x; vy -= 1.6 * dot * y; vz -= 1.6 * dot * z; }
      if (y < GY + 0.005) { y = GY + 0.005 + Math.random() * 0.003; vy = Math.max(0, vy) * 0.2; vx *= 0.3; vz *= 0.3; }
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z; vel[k] = vx; vel[k + 1] = vy; vel[k + 2] = vz;
    }
    posAttr.needsUpdate = true;
    energy *= Math.exp(-0.55 * dt);
  }

  // ---------- hotspots ----------
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const contact = [jack.email && `<li><a href="mailto:${jack.email}">${jack.email}</a></li>`, `<li><a href="${jack.linkedin}" target="_blank" rel="noopener">LinkedIn</a></li>`, `<li><a href="${jack.github}" target="_blank" rel="noopener">github.com/${jack.githubHandle}</a></li>`, `<li><a href="/ask">Ask the assistant</a></li>`].filter(Boolean).join('');
  const hots: Hot[] = [
    { id: 'work', label: 'Work', obj: tower, anchor: v(0.02, GY + ty + 0.28, -0.3), html: `<h2>${jack.company}</h2><p>${jack.role} (${jack.title}) since ${jack.since}. First hire at ${jack.companyAbout}; I now lead ${jack.team}.</p><p>Before that:</p><ul>${jobs.slice(1).filter((j) => !j.minor).map((j) => `<li><b>${j.company}</b>, ${j.title} <small>(${j.when})</small></li>`).join('')}</ul><p><a href="/resume">Résumé →</a></p>` },
    { id: 'story', label: 'My story', obj: row, anchor: v(-0.47, GY + 0.4, 0), html: `<h2>${jack.name}</h2><p>${jack.headline}</p><p>I got here the long way: data analyst, coding teacher, unpaid intern, lead frontend, founding engineer. Brooklyn the whole way.</p><p><a href="/story">Read my story →</a></p>` },
    { id: 'projects', label: 'Projects', obj: bridge, anchor: v(0.47, GY + 0.42, 0.12), html: `<h2>Projects</h2><ul class="pj">${jack.projects.map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener"><b>${p.name}</b> ↗</a> ${p.blurb}${p.highlights.length ? `<ul>${p.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>` : ''}</li>`).join('')}${jack.smallProjects.map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener"><b>${p.name}</b> ↗</a> ${p.blurb}</li>`).join('')}</ul>` },
    { id: 'school', label: 'School', obj: clock, anchor: v(-0.3, GY + 0.55, -0.52), html: `<h2>${jack.school}</h2><p>${jack.study}, ${jack.schoolYears}. Before that, I taught myself with free online courses during Covid.</p>` },
    { id: 'contact', label: 'Contact', obj: subway, anchor: v(0.12, GY + 0.2, 0.52), html: `<h2>Get in touch</h2><ul>${contact}</ul>` },
  ];
  labels.innerHTML = hots.map((h) => `<button class="hs" data-h="${h.id}">${h.label}</button>`).join('');
  hots.forEach((h) => (h.el = labels.querySelector<HTMLButtonElement>(`[data-h="${h.id}"]`)!));
  labels.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('.hs');
    if (b) focus(hots.find((h) => h.id === b.dataset.h) ?? null);
  });

  // ---------- camera + focus ----------
  let yaw = -0.5, yawVel = 0, yawGoal: number | null = 0, wobble = 0, focused: Hot | null = null;
  const camPos = v(0, 0.55, 5), camLook = v(0, -0.05, 0), goalPos = v(0, 0.3, 4.2), goalLook = v(0, -0.1, 0);
  const homePos = v(0, 0.3, 4.2), homeLook = v(0, -0.1, 0);
  function focus(h: Hot | null) {
    focused = h;
    root.classList.toggle('focused', !!h);
    if (h) {
      // turn the globe so the building faces us, then lean in
      const a = Math.atan2(h.anchor.x, h.anchor.z);
      let goal = -a;
      while (goal - yaw > Math.PI) goal -= Math.PI * 2;
      while (goal - yaw < -Math.PI) goal += Math.PI * 2;
      yawGoal = goal;
      const r = Math.hypot(h.anchor.x, h.anchor.z);
      const wide = root.clientWidth > 760;
      const cy = (GY + h.anchor.y) / 2;
      if (wide) { goalPos.set(0.4, cy + 0.3, r + 2.5); goalLook.set(0.4, cy, r); }
      else { goalPos.set(0, cy + 0.45, r + 3.2); goalLook.set(0, cy - 0.32, r); } // panel covers the bottom half on phones
      body.innerHTML = h.html;
      panel.classList.add('on');
      sample('open_001', { gain: 0.3 });
    } else {
      yawGoal = null;
      goalPos.copy(homePos); goalLook.copy(homeLook);
      if (panel.classList.contains('on')) sample('close_001', { gain: 0.25 });
      panel.classList.remove('on');
    }
  }
  panel.querySelector('.close')!.addEventListener('click', () => focus(null));

  // ---------- input ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(-9, -9);
  let down: { x: number; y: number; t: number; moved: number } | null = null, lastX = 0, lastT = 0;
  const setNdc = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  const pick = () => { ray.setFromCamera(ndc, camera); for (const h of hots) if (ray.intersectObject(h.obj, true).length) return h; return null; };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; lastX = e.clientX; lastT = performance.now();
    yawGoal = null;
  });
  cv.addEventListener('pointermove', (e) => {
    setNdc(e);
    if (!down) { root.classList.toggle('hover', !!pick()); return; }
    const now = performance.now(), dx = e.clientX - lastX, dts = Math.max(1, now - lastT) / 1000;
    down.moved += Math.abs(dx) + Math.abs(e.clientY - down.y) * 0.1;
    const dYaw = dx * 0.008;
    yaw += dYaw; yawVel = dYaw / dts;
    if (Math.abs(yawVel) > 9) shake(Math.min(1, Math.abs(yawVel) / 22)); // a hard flick is a shake
    lastX = e.clientX; lastT = now;
  });
  cv.addEventListener('pointerup', (e) => {
    setNdc(e);
    const wasClick = down && down.moved < 6;
    down = null;
    if (!wasClick) return;
    const h = pick();
    if (h) focus(h); else if (focused) focus(null);
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') focus(null);
    else if (e.key === 's' || e.key === 'S') shake();
    else if (e.key === 'ArrowLeft') { yawGoal = null; yawVel -= 1.5; }
    else if (e.key === 'ArrowRight') { yawGoal = null; yawVel += 1.5; }
  };
  addEventListener('keydown', onKey);

  // phone shake (iOS asks for permission on the first tap of the Shake button)
  let lastMotion = 0;
  const onMotion = (e: DeviceMotionEvent) => {
    const a = e.acceleration ?? e.accelerationIncludingGravity;
    if (!a) return;
    const m = Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) - (e.acceleration ? 0 : 9.8);
    const now = performance.now();
    if (m > 12 && now - lastMotion > 350) { lastMotion = now; shake(Math.min(1.3, m / 20)); }
  };
  addEventListener('devicemotion', onMotion);
  const onHandShake = (e: Event) => shake(Math.min(1.4, (e as CustomEvent).detail?.power ?? 1));
  addEventListener('hand:shake', onHandShake);
  let askedMotion = false;
  root.querySelector('.shake')!.addEventListener('click', async () => {
    shake();
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (!askedMotion && DM?.requestPermission) { askedMotion = true; try { await DM.requestPermission(); } catch { /* ignore */ } }
  });
  preload(['glass_001', 'open_001', 'close_001']);

  // ---------- size ----------
  let dpr = Math.min(devicePixelRatio, coarse ? 1.5 : 2);
  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole globe in frame on tall phones
    const portrait = w / h < 0.8;
    // fit the whole globe and base (about 1.2 wide) in the narrower dimension
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(1, w / h));
    const dist = Math.max(4.3, 1.12 / Math.tan(half));
    homePos.set(0, portrait ? 0.35 : 0.3, dist);
    homeLook.set(0, portrait ? -0.5 : -0.1, 0);
    if (!focused) { goalPos.copy(homePos); goalLook.copy(homeLook); }
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(root); resize();

  // ---------- loop ----------
  const proj = new THREE.Vector3(), world = new THREE.Vector3();
  let raf = 0, last = performance.now(), slow = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    // spin: free spin with friction, or ease to a building
    const prevYaw = yaw;
    if (!down) {
      if (yawGoal !== null) yaw += (yawGoal - yaw) * (1 - Math.pow(0.02, dt));
      else { yaw += yawVel * dt; yawVel *= Math.exp(-2.2 * dt); }
    }
    const spin = (yaw - prevYaw) / Math.max(dt, 1e-3);
    city.rotation.y = yaw;
    wobble *= Math.exp(-3 * dt);
    globe.rotation.z = Math.sin(t * 18) * 0.03 * wobble;
    globe.rotation.x = Math.cos(t * 15) * 0.02 * wobble;
    stepSnow(dt, t, spin);

    camPos.lerp(goalPos, 1 - Math.pow(0.03, dt));
    camLook.lerp(goalLook, 1 - Math.pow(0.03, dt));
    camera.position.copy(camPos); camera.lookAt(camLook);
    beacon.visible = Math.sin(t * 3) > -0.2;
    for (let i = 0; i < lamps.length; i++) lamps[i].intensity = 0.25 + Math.sin(t * 7 + i) * 0.01;

    // labels come back once the snow has (mostly) settled
    const settled = energy < 0.25 && now - lastShake > 2500;
    root.classList.toggle('settled', settled);
    const W = root.clientWidth, H = root.clientHeight;
    for (const h of hots) {
      world.copy(h.anchor).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      proj.copy(world).project(camera);
      const front = world.z > -0.42;
      h.el!.style.transform = `translate(${((proj.x + 1) / 2) * W}px, ${((1 - proj.y) / 2) * H}px) translate(-50%, -50%)`;
      h.el!.classList.toggle('back', !front);
    }
    renderer.render(scene, camera);
    // drop resolution if the device struggles
    if (dt > 0.034) { if (++slow > 40 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); slow = 0; } } else slow = Math.max(0, slow - 1);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener('keydown', onKey);
    removeEventListener('devicemotion', onMotion);
    removeEventListener('hand:shake', onHandShake);
    document.removeEventListener('visibilitychange', onVis);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mt of mats) { for (const k of Object.keys(mt)) { const val = (mt as unknown as Record<string, unknown>)[k]; if (val instanceof THREE.Texture) val.dispose(); } mt.dispose(); }
    });
    sky.dispose(); env.dispose(); pmrem.dispose(); renderer.dispose();
  };
};

export default mount;
