import '@fontsource-variable/fraunces';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import './desk.css';
import { loop } from '../../lib/loop';
import { swish, click, sample, preload } from '../../lib/sound';
import { jack, jobs, ai } from '../../content/jack';
import type { Mount } from '../registry';

/**
 * Desk: DOM objects with a tiny rigid-body model (position, velocity, angle,
 * angular velocity). Dragging applies a spring at the grabbed point, so paper
 * pivots around where you hold it, then slides and settles with friction.
 * Only `transform` is written per frame, so the browser composites on the GPU.
 */
interface Obj { el: HTMLElement; w: number; h: number; x: number; y: number; a: number; vx: number; vy: number; va: number; lift: number }

const mount: Mount = (root) => {
  root.className = 'design d-desk';
  const contact = jack.email
    ? `<a href="mailto:${jack.email}" title="${jack.email}">email me →</a>`
    : `<a href="/ask">ask me anything →</a>`;
  root.innerHTML = `
    <svg class="wood" aria-hidden="true">
      <filter id="dk-g1" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0025 0.11" numOctaves="4" seed="7"/><feColorMatrix values="0 0 0 0 .16  0 0 0 0 .08  0 0 0 0 .03  2.2 0 0 0 -.85"/></filter>
      <filter id="dk-g2" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.01 0.4" numOctaves="2" seed="2"/><feColorMatrix values="0 0 0 0 .9  0 0 0 0 .62  0 0 0 0 .38  1.6 0 0 0 -.75"/></filter>
      <rect width="100%" height="100%" fill="#6e4126"/><rect width="100%" height="100%" filter="url(#dk-g1)"/><rect width="100%" height="100%" filter="url(#dk-g2)" opacity=".35"/>
    </svg>
    <div class="walnut"></div>
    <div class="surface">
      <div class="o card flip" data-w="350" data-h="200" tabindex="0" aria-label="Business card. Press Enter to flip."><div class="sk in"><div class="face paper"><div><h1>${jack.name}</h1><div class="role">Software engineer · Brooklyn</div></div><div class="row"><span>${jack.role}, ${jack.company}</span><span>jackshomer.io</span></div></div><div class="face backf"><span>jackshomer.io</span><small>github.com/${jack.githubHandle}</small></div></div></div>
      <div class="o idx" data-w="330" data-h="214" tabindex="0" aria-label="Index card: tools"><div class="sk"><b>Things I reach for</b><br>Laravel · React<br>TypeScript · Node<br>Postgres · AWS<br>three.js when nobody stops me</div></div>
      ${jack.projects
        .map((p, i) => `<div class="o pol ${['pic-rail', 'pic-oneart', 'pic-arcade'][i]} flip" data-w="236" data-h="282" tabindex="0" aria-label="Photo: ${p.name}. Press Enter to flip."><div class="sk in"><div class="face"><div class="pic"></div><div class="cap">${i === 0 ? 'Shomer Valley' : p.name}</div></div><div class="face backf paper">${p.blurb}</div></div></div>`)
        .join('')}
      <div class="o pol pic-city flip" data-w="236" data-h="282" tabindex="0" aria-label="Photo: ${jack.company}. Press Enter to flip."><div class="sk in"><div class="face"><div class="pic"></div><div class="cap">${jack.company}, '25</div></div><div class="face backf paper">First hire. I lead ${jack.team}. ${jack.companyAbout[0].toUpperCase() + jack.companyAbout.slice(1)}, but make it fast.</div></div></div>
      <div class="o pol pic-ai flip" data-w="300" data-h="262" tabindex="0" aria-label="Printed screenshot from ${ai.proofDate}. Press Enter to flip."><div class="sk in"><div class="face"><img class="shot" src="${ai.proofImage}" alt="Jack's message about ChatGPT, ${ai.proofDate}" width="929" height="620" draggable="false"><div class="cap">${ai.proofDate}</div></div><div class="face backf paper">Four days after ChatGPT launched (${ai.launchDate}), I was already sending it around. On AI since day four. <a href="/story">The story →</a></div></div></div>
      <div class="o fold" data-w="380" data-h="250" tabindex="0" aria-label="Résumé folder. Press Enter to open."><div class="sk"><div class="tab">résumé</div><div class="body">The long version<small>Double-tap to pull out the sheet.</small></div></div></div>
      <div class="o res" data-w="440" data-h="520" tabindex="0" hidden aria-label="Résumé sheet"><div class="sk paper"><h2>${jack.name}</h2><p class="sub">${jack.title} · ${jack.location}</p><ol>${jobs.map((j) => `<li><b>${j.when.replace(' – ', '–')}</b><span><strong>${j.company}</strong> · ${j.title}</span></li>`).join('')}<li><b>${jack.schoolDates.replace(' – ', '–')}</b><span><strong>${jack.school}</strong> · ${jack.study}</span></li></ol></div></div>
      <div class="o stk" data-w="190" data-h="190" tabindex="0"><div class="sk">the long way in → <a href="/story">read my story</a><br>${contact}</div></div>
      <div class="o tok" data-w="86" data-h="86" tabindex="0" aria-label="Brass token"><div class="sk">BKLYN</div></div>
      <div class="o pen" data-w="330" data-h="22" tabindex="0" aria-label="Pencil"><div class="sk"></div></div>
    </div>
    <div class="lamp"></div>
    <div class="bar"><p><b>Desk.</b> Grab anything by a corner and it pivots like real paper. Fling it and it slides. Double-tap a photo or card to turn it over, or the folder to open it.</p><button data-a="lamp" aria-pressed="true">Lamp on</button></div>`;

  const surface = root.querySelector<HTMLDivElement>('.surface')!;
  {
    const wal = root.querySelector<HTMLDivElement>('.walnut')!;
    const img = new Image();
    img.onload = () => { wal.style.backgroundImage = `url(${img.src})`; wal.classList.add('on'); };
    img.src = '/textures/american_walnut_veneer_diff.webp';
  }
  const O: Obj[] = [...surface.querySelectorAll<HTMLElement>('.o')].map((el) => ({ el, w: +el.dataset.w!, h: +el.dataset.h!, x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0, lift: 0 }));
  const folder = O.find((o) => o.el.classList.contains('fold'))!;
  const sheet = O.find((o) => o.el.classList.contains('res'))!;
  // [x, y, angle] as fractions of the viewport
  const layout = [[0.24, 0.26, -0.08], [0.72, 0.2, 0.06], [0.64, 0.6, -0.14], [0.84, 0.56, 0.09], [0.45, 0.62, 0.15], [0.47, 0.36, 0.12], [0.4, 0.2, -0.07], [0.24, 0.68, -0.04], [0.5, 0.5, 0.02], [0.9, 0.2, 0.18], [0.57, 0.18, 0.4], [0.36, 0.86, -0.25]];
  // phones: a looser stack that still shows a corner of everything
  const mobile = [[0.42, 0.2, -0.06], [0.6, 0.34, 0.08], [0.3, 0.5, -0.12], [0.7, 0.55, 0.1], [0.35, 0.72, 0.07], [0.68, 0.76, -0.08], [0.45, 0.62, 0.05], [0.5, 0.42, 0.04], [0.5, 0.5, 0], [0.72, 0.14, 0.12], [0.18, 0.3, 0.3], [0.5, 0.88, -0.2]];
  let W = 0, H = 0, S = 1, z = 10;
  let grab: { o: Obj; r: [number, number]; sx: number; sy: number; t: number; id: number } | null = null;
  let mx = 0, my = 0, lastTap = { t: 0, o: null as Obj | null }, swishT = 0;

  const rot = (x: number, y: number, a: number): [number, number] => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

  function place() {
    W = root.clientWidth; H = root.clientHeight;
    S = Math.max(0.5, Math.min(1, W / 1200, H / 820));
    O.forEach((o, i) => {
      const L = layout[i] ?? [0.5, 0.5, 0];
      o.el.style.width = o.w + 'px'; o.el.style.height = o.h + 'px';
      o.x = W * L[0]; o.y = H * L[1]; o.a = L[2];
      if (W < 640) { const M = mobile[i] ?? [0.5, 0.5, 0]; o.x = W * M[0]; o.y = H * M[1]; o.a = M[2]; }
      o.el.style.zIndex = String(i + 1);
    });
  }

  function bring(o: Obj) { o.el.style.zIndex = String(++z); }
  function act(o: Obj) {
    if (o === folder) { openFolder(); return; }
    if (o.el.classList.contains('flip')) { o.el.classList.toggle('flipped'); sample(['scratch_001', 'scratch_002'], { gain: 0.35, rate: 1.1 }, () => swish(0.14, 2200, 0.08)); }
  }
  function openFolder() {
    if (!sheet.el.hidden) { bring(sheet); sheet.vx = 0; return; }
    sheet.el.hidden = false;
    sheet.x = folder.x; sheet.y = folder.y; sheet.a = folder.a;
    sheet.vx = 0; sheet.vy = -26 * S; sheet.va = 0.02;
    bring(sheet);
    sample('scratch_004', { gain: 0.45, rate: 0.8 }, () => swish(0.3, 2600, 0.14));
  }

  const onDown = (e: PointerEvent) => {
    const el = (e.target as Element).closest<HTMLElement>('.o');
    if (!el || (e.target as Element).closest('a')) return;
    const o = O.find((q) => q.el === el)!;
    surface.setPointerCapture(e.pointerId);
    mx = e.clientX; my = e.clientY;
    bring(o);
    grab = { o, r: rot(mx - o.x, my - o.y, -o.a), sx: mx, sy: my, t: performance.now(), id: e.pointerId };
    o.el.classList.add('lift');
    sample(['pluck_001', 'pluck_002'], { gain: 0.18, rate: 1.6 }, () => click(900, 0.02, 0.06));
  };
  const onMove = (e: PointerEvent) => { if (grab && e.pointerId === grab.id) { mx = e.clientX; my = e.clientY; } };
  const onUp = () => {
    if (!grab) return;
    const o = grab.o, now = performance.now();
    if (Math.hypot(mx - grab.sx, my - grab.sy) < 6 && now - grab.t < 300) {
      if (lastTap.o === o && now - lastTap.t < 380) { act(o); lastTap = { t: 0, o: null }; } else lastTap = { t: now, o };
    }
    o.el.classList.remove('lift');
    sample(['drop_001', 'drop_002', 'drop_003'], { gain: 0.25, rate: 0.9 });
    grab = null;
  };
  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerup', onUp);
  surface.addEventListener('pointercancel', onUp);

  // keyboard: Enter/Space acts, arrows nudge, Q/E rotate
  surface.addEventListener('keydown', (e) => {
    const o = O.find((q) => q.el === document.activeElement);
    if (!o) return;
    const k = e.key, n = e.shiftKey ? 12 : 4;
    if (k === 'Enter' || k === ' ') { e.preventDefault(); act(o); }
    else if (k === 'ArrowLeft') o.vx -= n; else if (k === 'ArrowRight') o.vx += n;
    else if (k === 'ArrowUp') o.vy -= n; else if (k === 'ArrowDown') o.vy += n;
    else if (k === 'q') o.va -= 0.02; else if (k === 'e') o.va += 0.02;
    else return;
    if (k.startsWith('Arrow')) e.preventDefault();
    bring(o);
  });

  const lampBtn = root.querySelector<HTMLButtonElement>('[data-a=lamp]')!;
  lampBtn.addEventListener('click', () => {
    const on = !root.classList.toggle('dim');
    lampBtn.setAttribute('aria-pressed', String(on));
    lampBtn.textContent = on ? 'Lamp on' : 'Lamp off';
    sample('switch_002', { gain: 0.8, rate: 0.9 }, () => click(700, 0.05, 0.4, 70));
  });

  const stop = loop(() => {
    const m = 30;
    for (const o of O) {
      if (o.el.hidden) continue;
      const w = o.w * S, h = o.h * S, I = (w * w + h * h) / 12;
      if (grab && grab.o === o) {
        const rw = rot(grab.r[0], grab.r[1], o.a), gx = o.x + rw[0], gy = o.y + rw[1];
        const fx = (mx - gx) * 0.3, fy = (my - gy) * 0.3;
        o.vx += fx; o.vy += fy; o.va += ((rw[0] * fy - rw[1] * fx) / I) * 0.9;
        o.vx *= 0.55; o.vy *= 0.55; o.va *= 0.7; o.lift += (1 - o.lift) * 0.25;
        const sp = Math.hypot(o.vx, o.vy);
        const now = performance.now();
        if (sp > 6 && now - swishT > 140) { swish(0.1, 1800 + sp * 40, Math.min(0.06, sp * 0.002)); swishT = now; }
      } else { o.vx *= 0.9; o.vy *= 0.9; o.va *= 0.88; o.lift *= 0.8; }
      if (Math.abs(o.vx) + Math.abs(o.vy) + Math.abs(o.va) * 100 + o.lift < 0.01 && !(grab && grab.o === o)) continue; // at rest: skip the style write
      o.x += o.vx; o.y += o.vy; o.a += o.va;
      if (o.x < m) { o.x = m; o.vx *= -0.4; } if (o.x > W - m) { o.x = W - m; o.vx *= -0.4; }
      if (o.y < m) { o.y = m; o.vy *= -0.4; } if (o.y > H - m) { o.y = H - m; o.vy *= -0.4; }
      o.el.style.transform = `translate3d(${o.x}px,${o.y}px,0) translate(-50%,-50%) rotate(${o.a}rad) scale(${S * (1 + o.lift * 0.045)})`;
    }
  });

  const paintAll = () => { for (const o of O) o.el.style.transform = `translate3d(${o.x}px,${o.y}px,0) translate(-50%,-50%) rotate(${o.a}rad) scale(${S})`; };
  const ro = new ResizeObserver(() => {
    // re-lay out only on real width changes (not when a phone's URL bar slides)
    if (Math.abs(root.clientWidth - W) > 40) { place(); paintAll(); } else H = root.clientHeight;
  });
  ro.observe(root);
  preload(['scratch_001', 'scratch_002', 'scratch_004', 'pluck_001', 'pluck_002', 'drop_001', 'drop_002', 'drop_003', 'switch_002']);
  place();
  paintAll();
  return () => { stop(); ro.disconnect(); };
};

export default mount;
