import * as THREE from 'three';

/**
 * WebGL renderer for the Linen cloth. The physics stays in linen.ts (pixel
 * units, flat typed arrays); this module only turns those points into a lit
 * mesh: a woven linen texture with cross-stitched lettering, a bump map from
 * the same weave, sheen for the fibres, and a real shadow cast on the wall.
 * It loads after the 2D version is already on screen, then takes over.
 */

export interface ClothState {
  W: number; H: number; cols: number; rows: number; sp: number; x0: number; y0: number; cw: number;
  px: Float32Array; py: Float32Array; pz: Float32Array;
  alive: Uint8Array; hC: Int32Array; vC: Int32Array; pin: Uint8Array;
  kind: Uint8Array; // per cell: 0 linen, 1 red stitch, 2 blue stitch
}

const LINEN = [226, 216, 196], RED = [168, 30, 40], BLUE = [40, 58, 136];

function weave(cols: number, rows: number, kind: Uint8Array, S: number) {
  const w = cols - 1, h = rows - 1;
  const col = document.createElement('canvas'), hgt = document.createElement('canvas');
  col.width = hgt.width = w * S; col.height = hgt.height = h * S;
  const g = col.getContext('2d')!, b = hgt.getContext('2d')!;
  // linen: a plain weave, threads ~S/4 wide, each with its own slight tone (slubs)
  const T = S / 4;
  g.fillStyle = `rgb(${LINEN.map((v) => v - 40)})`; g.fillRect(0, 0, col.width, col.height);
  b.fillStyle = '#202020'; b.fillRect(0, 0, hgt.width, hgt.height);
  const nx = w * 4, ny = h * 4;
  const warp = new Float32Array(nx).map(() => 0.93 + Math.random() * 0.1);
  const weft = new Float32Array(ny).map(() => 0.93 + Math.random() * 0.1);
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const over = (x + y) & 1; // over-under
    const tone = (over ? warp[x] : weft[y]) * (0.97 + Math.random() * 0.05);
    const [r, gg, bb] = LINEN.map((v) => Math.min(255, v * tone) | 0);
    g.fillStyle = `rgb(${r},${gg},${bb})`;
    b.fillStyle = over ? '#d0d0d0' : '#a0a0a0';
    if (over) { g.fillRect(x * T + T * 0.12, y * T - T * 0.1, T * 0.76, T * 1.2); b.fillRect(x * T + T * 0.2, y * T, T * 0.6, T); }
    else { g.fillRect(x * T - T * 0.1, y * T + T * 0.12, T * 1.2, T * 0.76); b.fillRect(x * T, y * T + T * 0.2, T, T * 0.6); }
  }
  // cross stitches: two diagonal strands of cotton per cell, the top strand catching the light
  g.lineCap = b.lineCap = 'round';
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = kind[j * w + i];
    if (!k) continue;
    const c = k === 1 ? RED : BLUE, x = i * S, y = j * S, m = S * 0.14;
    const strand = (x0: number, y0: number, x1: number, y1: number, top: boolean) => {
      g.lineWidth = S * 0.3; g.strokeStyle = `rgb(${c.map((v) => v * (top ? 1 : 0.8) | 0)})`;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.lineWidth = S * 0.08; g.strokeStyle = `rgba(255,255,255,${top ? 0.22 : 0.1})`;
      g.beginPath(); g.moveTo(x0, y0 - S * 0.04); g.lineTo(x1, y1 - S * 0.04); g.stroke();
      b.lineWidth = S * 0.3; b.strokeStyle = top ? '#ffffff' : '#e8e8e8';
      b.beginPath(); b.moveTo(x0, y0); b.lineTo(x1, y1); b.stroke();
    };
    strand(x + m, y + S - m, x + S - m, y + m, false);
    strand(x + m, y + m, x + S - m, y + S - m, true);
  }
  return { col, hgt };
}

export function linenGL(cv: HTMLCanvasElement) {
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -4000, 4000);
  camera.position.z = 1000;

  scene.add(new THREE.HemisphereLight('#dfe6f0', '#3a3026', 1.25));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  sun.shadow.radius = 14; sun.shadow.blurSamples = 16; sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.55 }));
  wall.receiveShadow = true;
  scene.add(wall);

  const clothMat = new THREE.MeshPhysicalMaterial({ roughness: 0.92, sheen: 0.7, sheenRoughness: 0.6, sheenColor: new THREE.Color('#fff3df'), side: THREE.DoubleSide, bumpScale: 1.6 });
  const geo = new THREE.BufferGeometry();
  const cloth = new THREE.Mesh(geo, clothMat);
  cloth.castShadow = true; cloth.receiveShadow = true;
  cloth.frustumCulled = false;
  // soft shadows need a depth material that respects the double-sided cloth
  cloth.customDepthMaterial = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide });
  scene.add(cloth);

  const wood = new THREE.MeshStandardMaterial({ color: '#9a6234', roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d6b46a', roughness: 0.3, metalness: 1 });
  const rail = new THREE.Group();
  scene.add(rail);
  let rings: THREE.Mesh[] = [];

  let S: ClothState | null = null, posAttr: THREE.BufferAttribute | null = null, topo = -1;

  function rebuild(s: ClothState) {
    S = s;
    const { cols, rows, W, H, x0, y0, cw } = s, N = cols * rows;
    posAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(N * 2);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const k = j * cols + i; uv[k * 2] = i / (cols - 1); uv[k * 2 + 1] = 1 - j / (rows - 1); }
    geo.setAttribute('position', posAttr);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    topo = -1;

    const { col, hgt } = weave(cols, rows, s.kind, coarse ? 10 : 16);
    clothMat.map?.dispose(); clothMat.bumpMap?.dispose();
    const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const bump = new THREE.CanvasTexture(hgt); bump.anisotropy = 8;
    clothMat.map = map; clothMat.bumpMap = bump; clothMat.needsUpdate = true;

    // the rail, its finials, the cord to the nail and a brass ring per pin
    for (const o of [...rail.children]) { rail.remove(o); (o as THREE.Mesh).geometry?.dispose(); }
    const ry = -(y0 - 6);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, cw + 68, 20), wood);
    rod.rotation.z = Math.PI / 2; rod.position.set(W / 2, ry, 10); rod.castShadow = true; rail.add(rod);
    for (const x of [x0 - 38, x0 + cw + 38]) { const f = new THREE.Mesh(new THREE.SphereGeometry(10, 18, 12), wood); f.position.set(x, ry, 10); f.castShadow = true; rail.add(f); }
    const cordG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0 + cw * 0.12, ry, 10), new THREE.Vector3(W / 2, ry + 60, 4), new THREE.Vector3(x0 + cw * 0.88, ry, 10)]);
    const cord = new THREE.Line(cordG, new THREE.LineBasicMaterial({ color: '#1c1a18' })); rail.add(cord);
    const nail = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), brass); nail.position.set(W / 2, ry + 62, 4); nail.castShadow = true; rail.add(nail);
    rings = [];
    for (let i = 0; i < cols; i++) if (s.pin[i]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(9, 1.8, 8, 20), brass);
      r.rotation.y = Math.PI / 2; r.position.set(s.px[i], ry - 1, 10); r.castShadow = true; rail.add(r); rings.push(r);
    }

    wall.scale.set(W * 3, H * 3, 1); wall.position.set(W / 2, -H / 2, -70);
    const L = Math.max(W, H) * 1.2, sc = sun.shadow.camera;
    sc.left = -L; sc.right = L; sc.top = L; sc.bottom = -L; sc.near = 1; sc.far = 6000; sc.updateProjectionMatrix();
    sun.target.position.set(W / 2, -H / 2, 0);
    sun.position.set(W / 2 - 900, -H / 2 + 1300, 1500);
  }

  function resize(W: number, H: number, dpr: number) {
    renderer.setPixelRatio(Math.min(dpr, coarse ? 1.5 : 2));
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H; camera.updateProjectionMatrix();
  }

  function draw(topoVersion: number) {
    if (!S || !posAttr) return;
    const { cols, rows, px, py, pz, alive, hC, vC } = S, N = cols * rows, p = posAttr.array as Float32Array;
    for (let k = 0; k < N; k++) { p[k * 3] = px[k]; p[k * 3 + 1] = -py[k]; p[k * 3 + 2] = pz[k]; }
    posAttr.needsUpdate = true;
    if (topoVersion !== topo) {
      topo = topoVersion;
      const idx: number[] = [];
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
        if (!(alive[hC[a]] && alive[hC[c]] && alive[vC[a]] && alive[vC[b]])) continue;
        idx.push(a, c, b, b, c, d);
      }
      geo.setIndex(idx);
    }
    geo.computeVertexNormals();
    renderer.render(scene, camera);
  }

  function dispose() {
    scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
    clothMat.map?.dispose(); clothMat.bumpMap?.dispose(); clothMat.dispose(); wood.dispose(); brass.dispose();
    renderer.dispose();
  }

  return { rebuild, resize, draw, dispose };
}
