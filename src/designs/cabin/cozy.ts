import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { labelTexture } from './textures';
import { shelf } from '../../content/jack';

/**
 * Everything that makes the cabin lived-in: a leather recliner with a grumpy
 * old man reading the paper, a floor lamp, tea with steam, candles on the
 * mantel, a firewood stack and a bookcase of Jack's projects.
 */

type Scanned = (mat: THREE.MeshStandardMaterial, id: string, repeat: [number, number], tint: string, rot?: number, normal?: number) => void;

const LINES = [
  'Do you mind? I’m reading.',
  'Close the door, you’re letting the cold in.',
  'If you’re here about Jack, the notebook’s on the table.',
  'Visitors. Wonderful.',
  'His projects are on the shelf. Don’t touch the plant.',
  'Hmph.',
  'Back in my day a portfolio was a folder.',
  'The fire doesn’t need your help.',
  'You’re standing in my light.',
  'Jack? Works too hard. Good kid, though.',
  'I was here first.',
];

export function addCozy(scene: THREE.Scene, opts: { coarse: boolean; scanned: Scanned; FZ: number }) {
  const { coarse, scanned } = opts;
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = scene) => (parent.add(o), o);
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], p?: THREE.Vector3, parent?: THREE.Object3D, shadow = true) => {
    const me = new THREE.Mesh(g, m);
    if (p) me.position.copy(p);
    me.castShadow = shadow; me.receiveShadow = true;
    return add(me, parent);
  };
  const rbox = (w: number, h: number, d: number, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, r);

  // ---------- materials ----------
  const leather = new THREE.MeshStandardMaterial({ color: '#5c2e1c', roughness: 0.42, metalness: 0 });
  scanned(leather, 'brown_leather', [1.5, 1.5], '#a8664a', 0, 0.8);
  const darkWood = new THREE.MeshStandardMaterial({ color: '#2e1d12', roughness: 0.6 });
  const plaid = new THREE.MeshStandardMaterial({
    roughness: 1,
    map: labelTexture(256, 256, (g) => {
      g.fillStyle = '#7b1f1a'; g.fillRect(0, 0, 256, 256);
      g.globalAlpha = 0.55; g.fillStyle = '#1f3a2a';
      for (let i = 0; i < 256; i += 64) { g.fillRect(i, 0, 26, 256); g.fillRect(0, i, 256, 26); }
      g.globalAlpha = 0.6; g.fillStyle = '#d8b25a';
      for (let i = 40; i < 256; i += 64) { g.fillRect(i, 0, 3, 256); g.fillRect(0, i, 256, 3); }
    }),
  });
  plaid.map!.wrapS = plaid.map!.wrapT = THREE.RepeatWrapping; plaid.map!.repeat.set(2, 2);
  scanned(plaid, 'caban', [2, 2], '#c46a5c', 0, 0.8);
  const skin = new THREE.MeshStandardMaterial({ color: '#d8a88d', roughness: 0.62 });
  const hair = new THREE.MeshStandardMaterial({ color: '#e9e5dc', roughness: 0.9 });
  const cardigan = new THREE.MeshStandardMaterial({ color: '#5f6446', roughness: 0.95 });
  const trousers = new THREE.MeshStandardMaterial({ color: '#34373d', roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: '#b8a77a', roughness: 0.3, metalness: 0.9 });
  const eyeW = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.3 });
  const pupilM = new THREE.MeshStandardMaterial({ color: '#1c1714', roughness: 0.2 });

  // ---------- recliner ----------
  const chair = add(new THREE.Group());
  chair.position.set(-1.55, 0, -1.95);
  chair.rotation.y = 0.42; // in the corner by the fire, facing whoever just walked in
  mesh(rbox(0.8, 0.3, 0.72), darkWood, v3(0, 0.17, 0), chair);
  mesh(rbox(0.78, 0.2, 0.7, 0.08), leather, v3(0, 0.42, 0.02), chair);
  const back = mesh(rbox(0.78, 0.82, 0.22, 0.1), leather, v3(0, 0.86, -0.3), chair);
  back.rotation.x = -0.22;
  for (const sx of [-1, 1]) mesh(rbox(0.17, 0.34, 0.74, 0.07), leather, v3(sx * 0.44, 0.6, 0.02), chair);
  const foot = mesh(rbox(0.64, 0.12, 0.42, 0.05), leather, v3(0, 0.36, 0.56), chair);
  foot.rotation.x = 0.12;
  const throwM = mesh(rbox(0.56, 0.05, 0.62, 0.02), plaid, v3(0, 0.66, 0.26), chair);
  throwM.rotation.x = 0.18;
  const drape = mesh(rbox(0.56, 0.34, 0.04, 0.02), plaid, v3(0, 0.5, 0.58), chair);
  drape.rotation.x = 0.12;

  // ---------- the old man ----------
  const man = add(new THREE.Group(), chair);
  mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 16), cardigan, v3(0, 0.8, -0.1), man).scale.set(1.15, 1, 0.8);
  for (const sx of [-1, 1]) {
    const thigh = mesh(new THREE.CapsuleGeometry(0.075, 0.36, 4, 10), trousers, v3(sx * 0.11, 0.57, 0.12), man);
    thigh.rotation.x = Math.PI / 2 - 0.12;
    const shin = mesh(new THREE.CapsuleGeometry(0.065, 0.3, 4, 10), trousers, v3(sx * 0.11, 0.48, 0.5), man);
    shin.rotation.x = Math.PI / 2 - 0.25;
    mesh(rbox(0.1, 0.08, 0.2, 0.03), darkWood, v3(sx * 0.11, 0.47, 0.73), man);
  }
  const head = add(new THREE.Group(), man);
  head.position.set(0, 1.18, -0.07);
  mesh(new THREE.SphereGeometry(0.105, 24, 20), skin, v3(0, 0, 0), head).scale.set(0.95, 1.08, 1);
  mesh(new THREE.SphereGeometry(0.022, 10, 8), skin, v3(0, -0.01, 0.105), head);                // nose
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.025, 10, 8), skin, v3(sx * 0.1, -0.005, 0), head); // ears
  // horseshoe of white hair round the back of a bald head, open at the front
  const fringeG = new THREE.TorusGeometry(0.1, 0.03, 8, 28, Math.PI * 1.25);
  fringeG.rotateX(Math.PI / 2); fringeG.rotateY(Math.PI * 1.125);
  mesh(fringeG, hair, v3(0, -0.005, -0.012), head).scale.set(1, 1.3, 1);
  const mus = mesh(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), hair, v3(0, -0.045, 0.098), head);
  mus.rotation.z = Math.PI / 2;
  const brows: THREE.Mesh[] = [];
  const pupils: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.016, 10, 8), eyeW, v3(sx * 0.038, 0.022, 0.093), head, false);
    pupils.push(mesh(new THREE.SphereGeometry(0.008, 8, 6), pupilM, v3(sx * 0.038, 0.022, 0.108), head, false));
    const br = mesh(new THREE.BoxGeometry(0.045, 0.012, 0.012), hair, v3(sx * 0.04, 0.048, 0.1), head, false);
    br.userData.sx = sx; brows.push(br);
    const lens = mesh(new THREE.TorusGeometry(0.024, 0.0025, 6, 20), metal, v3(sx * 0.038, 0.02, 0.112), head, false);
    lens.userData.glass = true;
  }
  mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.03, 6), metal, v3(0, 0.022, 0.114), head, false).rotation.z = Math.PI / 2;

  // the newspaper, with a headline about Jack
  const paperTex = labelTexture(640, 440, (g) => {
    g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, 640, 440);
    g.fillStyle = '#1e1c19'; g.textAlign = 'center';
    g.font = '700 46px "Fraunces Variable", Georgia, serif'; g.fillText('The Brooklyn Gazette', 320, 58);
    g.fillRect(30, 72, 580, 3); g.fillRect(30, 80, 580, 1);
    g.font = '800 30px Georgia, serif'; g.fillText('LOCAL ENGINEER BUILDS', 320, 122); g.fillText('A WEBSITE YOU CAN TOUCH', 320, 156);
    g.fillStyle = 'rgba(30,28,25,.55)';
    for (let c = 0; c < 4; c++) for (let r = 0; r < 18; r++) g.fillRect(36 + c * 146, 182 + r * 13, 128 - ((r * 37 + c * 11) % 5) * 9, 5);
    g.fillStyle = '#9a9384'; g.fillRect(470, 182, 132, 96);
  });
  const paperM = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95, side: THREE.DoubleSide });
  const paper = add(new THREE.Group(), man);
  const pl = mesh(new THREE.PlaneGeometry(0.3, 0.42), paperM, v3(-0.145, 0, 0), paper);
  pl.rotation.y = 0.28;
  const pr = mesh(new THREE.PlaneGeometry(0.3, 0.42), paperM, v3(0.145, 0, 0), paper);
  pr.rotation.y = -0.28;
  (pl.geometry as THREE.PlaneGeometry).attributes.uv.array.forEach((_, i, a) => { if (i % 2 === 0) (a as Float32Array)[i] *= 0.5; });
  (pr.geometry as THREE.PlaneGeometry).attributes.uv.array.forEach((_, i, a) => { if (i % 2 === 0) (a as Float32Array)[i] = 0.5 + (a as Float32Array)[i] * 0.5; });
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.035, 10, 8), skin, v3(sx * 0.27, -0.08, 0.04), paper);
  const PAPER_UP = v3(0, 1.08, 0.3), PAPER_DOWN = v3(0, 0.86, 0.32);
  paper.position.copy(PAPER_UP);

  // ---------- floor lamp beside the chair ----------
  const lamp = add(new THREE.Group());
  lamp.position.set(-2.08, 0, -2.55);
  mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 24), metal, v3(0, 0.015, 0), lamp);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 8), metal, v3(0, 0.76, 0), lamp);
  const shadeM = new THREE.MeshStandardMaterial({ color: '#f3dfb8', emissive: '#ffb963', emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.96 });
  mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.26, 28, 1, true), shadeM, v3(0, 1.5, 0), lamp, false);
  const lampLight = new THREE.PointLight('#ffb766', 2.2, 0, 2);
  lampLight.position.set(-2.08, 1.38, -2.55);
  scene.add(lampLight);

  // ---------- side table with tea ----------
  const side = add(new THREE.Group());
  side.position.set(-0.85, 0, -2.2);
  mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.035, 28), darkWood, v3(0, 0.56, 0), side);
  mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 10), darkWood, v3(0, 0.28, 0), side);
  mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.025, 24), darkWood, v3(0, 0.012, 0), side);
  const cupM = new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.3 });
  mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.07, 20), cupM, v3(0, 0.613, 0), side);
  mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 24), cupM, v3(0, 0.581, 0), side);
  const tea = mesh(new THREE.CircleGeometry(0.037, 20), new THREE.MeshStandardMaterial({ color: '#7a3e12', roughness: 0.1 }), v3(0, 0.64, 0), side, false);
  tea.rotation.x = -Math.PI / 2;
  // steam: a few soft sprites drifting up
  const steamTex = labelTexture(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.life = i / 7; steam.push(add(s, side));
  }

  // ---------- candles on the mantel ----------
  const flames: THREE.Sprite[] = [];
  const glowTex = labelTexture(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.35, 'rgba(255,160,60,.5)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const wax = new THREE.MeshStandardMaterial({ color: '#efe5cf', roughness: 0.55, emissive: '#5a3a10', emissiveIntensity: 0.25 });
  [[-0.7, 0.16], [-0.55, 0.11], [0.62, 0.13]].forEach(([dz, h]) => {
    const x = -2.32, z = opts.FZ + dz, y = 1.38 + h / 2;
    mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 16), wax, v3(x, y, z));
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    f.position.set(x, y + h / 2 + 0.03, z); f.scale.set(0.07, 0.1, 1);
    flames.push(add(f));
  });

  // ---------- firewood stack ----------
  const woodM = new THREE.MeshStandardMaterial({ color: '#5a3d26', roughness: 0.95 });
  scanned(woodM, 'bark_brown_02', [1, 1], '#9c7f66');
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
    const l = mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.5, 10), woodM, v3(-2.7, 0.07 + row * 0.12, 0.08 + (i + row * 0.5) * 0.14));
    l.rotation.x = Math.PI / 2; l.rotation.y = Math.random() * 0.2;
  }

  // ---------- bookcase of projects (right of the window) ----------
  const bc = add(new THREE.Group());
  bc.position.set(2.36, 0, -2.7);
  const bw = 0.95, bh = 1.95, bd = 0.32;
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.035, bh, bd), darkWood, v3(sx * (bw / 2), bh / 2, 0), bc);
  mesh(new THREE.BoxGeometry(bw, bh, 0.02), darkWood, v3(0, bh / 2, -bd / 2), bc);
  const shelfYs = [0.06, 0.52, 0.98, 1.44, bh - 0.02];
  for (const y of shelfYs) mesh(new THREE.BoxGeometry(bw, 0.035, bd), darkWood, v3(0, y, 0), bc);
  const spineCols = ['#7b2d24', '#2c3f5c', '#2f4a33', '#6d5a2a', '#4a2e4f', '#1f4a4a', '#5b4636', '#8a3b1d', '#33363c', '#5e2a2a'];
  const books: THREE.Mesh[] = [];
  const cursor = [-bw / 2 + 0.05, -bw / 2 + 0.05, -bw / 2 + 0.05, -bw / 2 + 0.05];
  const addBook = (si: number, w: number, h: number, col: string, title?: string, project?: number, lean = 0) => {
    const x = cursor[si];
    if (x + w > bw / 2 - 0.04) return null;
    const bm = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
    let face: THREE.Material = bm;
    if (title) {
      face = new THREE.MeshStandardMaterial({ roughness: 0.65, map: labelTexture(64, 256, (g) => {
        g.fillStyle = col; g.fillRect(0, 0, 64, 256);
        g.fillStyle = 'rgba(232,214,170,.9)'; g.fillRect(0, 16, 64, 3); g.fillRect(0, 237, 64, 3);
        g.save(); g.translate(40, 128); g.rotate(-Math.PI / 2);
        g.font = `600 ${w > 0.06 ? 26 : 22}px "Fraunces Variable", Georgia, serif`; g.textAlign = 'center'; g.fillText(title, 0, 0, 200);
        g.restore();
      }) });
    }
    const paperM = new THREE.MeshStandardMaterial({ color: '#e9e0c9', roughness: 0.9 });
    const b = mesh(new THREE.BoxGeometry(w, h, 0.22), [bm, bm, paperM, bm, face, bm], v3(x + w / 2, shelfYs[si] + 0.018 + h / 2, 0.03), bc);
    b.rotation.z = lean;
    if (project !== undefined) { b.userData.project = project; books.push(b); }
    cursor[si] += w + 0.004 + (lean ? 0.03 : 0);
    return b;
  };
  // the real projects at eye level and above; plain old books fill the gaps
  shelf.forEach((p, i) => {
    const big = p.size === 'big';
    const si = big ? 2 : i % 2 ? 1 : 3;
    addBook(si, big ? 0.075 : 0.05, big ? 0.37 : 0.31 + (i % 3) * 0.02, spineCols[i % spineCols.length], p.label, i);
  });
  for (let si = 0; si < 4; si++) {
    for (let k = 0; k < 14; k++) {
      const w = 0.035 + ((k * 37 + si * 11) % 5) * 0.008, h = 0.26 + ((k * 13 + si * 7) % 6) * 0.025;
      if (!addBook(si, w, h, spineCols[(k * 3 + si) % spineCols.length], undefined, undefined, k === 9 ? 0.12 : 0)) break;
    }
  }
  const shelfLight = new THREE.PointLight('#ffc27a', 1.1, 2.6, 2);
  shelfLight.position.set(1.95, 1.75, -2.1);
  scene.add(shelfLight);
  // a little plant on the top shelf
  mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.11, 16), new THREE.MeshStandardMaterial({ color: '#a4583a', roughness: 0.8 }), v3(0.28, bh + 0.055, 0.02), bc);
  const leafM = new THREE.MeshStandardMaterial({ color: '#3c6b35', roughness: 0.7 });
  for (let i = 0; i < 9; i++) { const l = mesh(new THREE.SphereGeometry(0.05, 8, 6), leafM, v3(0.28 + Math.cos(i * 2.4) * 0.05, bh + 0.15 + (i % 3) * 0.04, 0.02 + Math.sin(i * 2.4) * 0.05), bc); l.scale.set(1, 0.5, 1.6); l.rotation.y = i; }

  // ---------- behaviour ----------
  let mood = 0;          // 0 reading … 1 fully annoyed
  let moodGoal = 0;
  let lookTimer = 0, quietUntil = 0, idle = 18 + Math.random() * 20, lineI = Math.floor(Math.random() * LINES.length);
  const headWorld = new THREE.Vector3(), tmp = new THREE.Vector3(), camLocal = new THREE.Vector3();
  let onSay: ((line: string) => void) | null = null;

  function grumble() {
    const now = performance.now();
    if (now < quietUntil) return;
    moodGoal = 1; quietUntil = now + 4500;
    lineI = (lineI + 1 + Math.floor(Math.random() * 3)) % LINES.length;
    onSay?.(LINES[lineI]);
    setTimeout(() => (moodGoal = 0), 3800);
  }

  return {
    man: chair,
    bookcase: bc,
    books,
    bookAnchor: v3(2.36, 2.1, -2.7),
    headAnchor: () => head.getWorldPosition(headWorld).add(tmp.set(0, 0.2, 0)),
    onSay: (fn: (l: string) => void) => (onSay = fn),
    poke: grumble,
    update(dt: number, t: number, camera: THREE.Camera, gazeOnMan: boolean) {
      // annoyed if you stare at him for a moment, or now and then on his own
      lookTimer = gazeOnMan ? lookTimer + dt : Math.max(0, lookTimer - dt * 2);
      if (lookTimer > 1.6) { grumble(); lookTimer = 0; }
      idle -= dt;
      if (idle < 0) { idle = 22 + Math.random() * 25; if (performance.now() > quietUntil) { moodGoal = 0.45; setTimeout(() => (moodGoal = 0), 1600); } }
      mood += (moodGoal - mood) * (1 - Math.pow(0.002, dt));
      // paper lowers, head turns to the camera, brows knit
      paper.position.lerpVectors(PAPER_UP, PAPER_DOWN, mood);
      paper.rotation.x = -0.18 + mood * 0.35;
      man.worldToLocal(camLocal.copy(camera.position));
      const yawTo = Math.atan2(camLocal.x - head.position.x, camLocal.z - head.position.z);
      head.rotation.y = THREE.MathUtils.lerp(Math.sin(t * 0.4) * 0.05, THREE.MathUtils.clamp(yawTo, -0.9, 0.9), mood);
      head.rotation.x = THREE.MathUtils.lerp(0.18, -0.05, mood) + Math.sin(t * 0.7) * 0.01;
      for (const b of brows) b.rotation.z = b.userData.sx * (0.1 + mood * 0.45);
      for (const p of pupils) p.position.x = Math.sign(p.position.x) * 0.038 + Math.sin(yawTo) * 0.006 * mood;
      // steam + candles
      for (const s of steam) {
        s.userData.life = (s.userData.life + dt * 0.22) % 1;
        const l = s.userData.life;
        s.position.set(Math.sin(t * 1.3 + l * 9) * 0.02 * l, 0.66 + l * 0.32, Math.cos(t + l * 7) * 0.015 * l);
        s.scale.setScalar(0.05 + l * 0.12);
        s.material.opacity = Math.sin(l * Math.PI) * 0.5;
      }
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const k = 0.85 + Math.sin(t * 11 + i * 2) * 0.08 + (Math.random() - 0.5) * 0.08;
        f.scale.set(0.07 * k, 0.11 * k, 1);
      }
      lampLight.intensity = 2.2 + Math.sin(t * 50) * 0.01;
      void coarse;
    },
  };
}
