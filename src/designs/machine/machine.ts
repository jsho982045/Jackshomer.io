import '@fontsource/vt323';
import '@fontsource-variable/archivo/wdth.css';
import './machine.css';
import { loop } from '../../lib/loop';
import { click, setMuted, sample, preload } from '../../lib/sound';
import { jack, jobs, ai, shelf } from '../../content/jack';
import type { Mount } from '../registry';

/**
 * Machine: the portfolio as a hardware instrument. A detented rotary dial picks
 * the section, mechanical keys load projects, toggles really toggle, and a
 * spring-damped needle reacts to everything you touch.
 */
const U = (s: string) => s.toUpperCase();

const mount: Mount = (root) => {
  root.className = 'design d-machine';
  const SEC: [string, string][] = [
    ['About', `${U(jack.name)}\nSOFTWARE ENGINEER, ${U(jack.location)}\n\nI BUILD THINGS FOR THE WEB THAT\nFEEL LIKE THINGS YOU CAN HOLD.\n\nFULL STORY: JACKSHOMER.IO/STORY`],
    ['Work', `${U(jack.role)} @ ${U(jack.company)}\nSINCE ${U(jack.since)}. LEADS ${U(jack.team)}.\nLIVE PLATFORM, THOUSANDS OF USERS.\n\nPRESS A KEY BELOW TO LOAD\nA SIDE PROJECT >`],
    ['Stack', jack.stack.map((s, i) => U(s).padEnd(22, '.') + (i < 3 ? ' DAILY' : ' OFTEN')).join('\n')],
    ['Path', [...jobs].filter((j) => !j.minor).reverse().map((j) => `${j.start}  ${U(j.short)}`).join('\n') + `\n${U(jack.study)} @ ${U(jack.school)}`],
    ['Contact', `${jack.email ? U(jack.email) + '\n' : ''}LINKEDIN / JACK-SHOMER\nGITHUB / ${U(jack.githubHandle)}\n\nOR OPEN "ASK" (TOP RIGHT)\nAND ASK THE ASSISTANT.`],
  ];
  const KEYS: [string, string][] = [
    ...jack.projects.map((p): [string, string] => [p.name.split(' ')[0], `${U(p.name)}\n\n${U(p.blurb)}`]),
    ['AI', `AI SINCE DAY 4.\nCHATGPT LAUNCHED ${U(ai.launchDate)}.\nI WAS SHARING IT ${U(ai.proofDate)}.\n\n${ai.tools.slice(0, 5).map(U).join(' / ')}`],
  ];
  root.innerHTML = `
    <div class="dev">
      <span class="screw" style="left:12px;top:12px;--r:20deg"></span><span class="screw" style="right:12px;top:12px;--r:-50deg"></span>
      <span class="screw" style="left:12px;bottom:12px;--r:75deg"></span><span class="screw" style="right:12px;bottom:12px;--r:5deg"></span>
      <div class="brand"><span class="name">JS<i>-1</i> portfolio unit</span><span class="silk">Made in Brooklyn · serial 2021</span></div>
      <div class="top">
        <div class="lcdwrap"><div class="lcd" aria-live="polite"></div></div>
        <div class="meter"><svg viewBox="0 0 190 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg></div>
      </div>
      <div class="bottom">
        <div class="kw"><div class="knob" tabindex="0" role="slider" aria-label="Section" aria-valuemin="0" aria-valuemax="4"><div class="cap"></div></div></div>
        <div class="ctr">
          <div class="toggles">
            ${[['pow', 'Power', true], ['lit', 'Backlight', false], ['snd', 'Sound', true]].map(([id, l, on]) => `<button class="tg" data-t="${id}" aria-pressed="${on}"><span class="plate"><span class="nut"></span><span class="bat"></span></span><span class="led"></span><span class="silk">${l}</span></button>`).join('')}
          </div>
          <div class="keys">${KEYS.map((k, i) => `<button class="key${i === KEYS.length - 1 ? ' or' : ''}" data-k="${i}">${k[0]}</button>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="shelf" aria-label="Project cartridges">
      <div class="slot"><span class="silk">Cartridge port</span><a class="open" hidden target="_blank" rel="noopener">Open ↗</a></div>
      <div class="carts">${shelf.map((p, i) => `<button class="cart ${p.size}" data-i="${i}" style="--c:${['#d9481c', '#2f6db5', '#2f8a5a', '#c99a1e', '#7b4bb3', '#c2364c', '#3d8b8e', '#8a6a3a', '#4a4f57', '#b5562f'][i % 10]}"><span class="lbl">${p.label}</span></button>`).join('')}</div>
      <div class="plank"></div>
    </div>
    <div class="bar"><p><b>Machine.</b> Turn the dial, press the keys, flip the switches. Arrow keys turn the dial; 1 to 4 press the keys. Sound on for the clicks.</p></div>`;

  const lcd = root.querySelector<HTMLDivElement>('.lcd')!;
  const knob = root.querySelector<HTMLDivElement>('.knob')!;
  const kw = root.querySelector<HTMLDivElement>('.kw')!;
  const DET = [-120, -60, 0, 60, 120];
  let power = true, typer = 0, sel = -1, ang = -120, act = 0;

  function show(txt: string) {
    clearInterval(typer);
    if (!power) return;
    let i = 0;
    const cur = document.createElement('span');
    cur.className = 'cur';
    cur.textContent = '█';
    typer = window.setInterval(() => {
      i += 3;
      lcd.textContent = txt.slice(0, i);
      lcd.append(cur);
      if (i >= txt.length) clearInterval(typer);
    }, 16);
    act = Math.min(1, act + 0.55);
  }

  DET.forEach((d, i) => {
    const t = document.createElement('span');
    t.className = 'tick';
    t.style.transform = `rotate(${d}deg)`;
    kw.append(t);
    const r = (d * Math.PI) / 180;
    const b = document.createElement('button');
    b.className = 'kl silk';
    b.textContent = SEC[i][0];
    b.style.left = 115 + Math.sin(r) * 128 + 'px';
    b.style.top = 115 - Math.cos(r) * 122 + 'px';
    b.onclick = () => setSel(i, true);
    kw.append(b);
  });
  const labels = [...kw.querySelectorAll('.kl')];

  function setSel(i: number, snap: boolean) {
    const changed = i !== sel;
    sel = i;
    labels.forEach((b, k) => b.classList.toggle('on', k === i));
    knob.setAttribute('aria-valuenow', String(i));
    knob.setAttribute('aria-valuetext', SEC[i][0]);
    if (snap) { ang = DET[i]; knob.style.transform = `rotate(${ang}deg)`; }
    if (changed) { sample(['tick_001', 'tick_002', 'tick_004'], { gain: 0.9 }, () => click(2600, 0.02, 0.35)); show(SEC[i][1]); }
  }

  let drag: { p: number; a: number } | null = null;
  const pang = (e: PointerEvent) => {
    const r = knob.getBoundingClientRect();
    return (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
  };
  knob.addEventListener('pointerdown', (e) => { knob.setPointerCapture(e.pointerId); drag = { p: pang(e), a: ang }; knob.style.transition = ''; });
  knob.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pang(e);
    let d = p - drag.p;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    ang = Math.max(-135, Math.min(135, drag.a + d));
    drag.a = ang; drag.p = p;
    knob.style.transform = `rotate(${ang}deg)`;
    let best = 0;
    DET.forEach((x, i) => { if (Math.abs(x - ang) < Math.abs(DET[best] - ang)) best = i; });
    if (best !== sel) setSel(best, false);
  });
  const endK = () => {
    if (!drag) return;
    drag = null;
    knob.style.transition = 'transform .18s cubic-bezier(.3,1.6,.5,1)';
    ang = DET[sel];
    knob.style.transform = `rotate(${ang}deg)`;
  };
  knob.addEventListener('pointerup', endK);
  knob.addEventListener('pointercancel', endK);

  root.querySelector('.keys')!.addEventListener('pointerdown', (e) => { if ((e.target as Element).closest('.key')) sample(['click_001', 'click_002', 'click_003'], { gain: 0.8, rate: 0.85 }, () => click(1500, 0.03, 0.35, 140)); });
  root.querySelector('.keys')!.addEventListener('click', (e) => {
    const k = (e.target as Element).closest<HTMLButtonElement>('.key');
    if (k) show(KEYS[+k.dataset.k!][1]);
  });

  root.querySelectorAll<HTMLButtonElement>('.tg').forEach((b) => {
    b.addEventListener('click', () => {
      const v = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(v));
      const t = b.dataset.t;
      if (t === 'snd' && v) setMuted(false);
      sample(['switch_001', 'switch_002', 'switch_004'], { gain: 0.8 }, () => click(900, 0.04, 0.5, 90));
      if (t === 'snd' && !v) setTimeout(() => setMuted(true), 60);
      if (t === 'pow') { power = v; lcd.classList.toggle('off', !v); if (v) show(SEC[sel][1]); else { clearInterval(typer); lcd.textContent = ''; } }
      if (t === 'lit') lcd.classList.toggle('lit', v);
    });
  });

  // cartridges: pick one and it rises into the port; the LCD reads it
  const carts = root.querySelector<HTMLDivElement>('.carts')!;
  const openA = root.querySelector<HTMLAnchorElement>('.slot .open')!;
  carts.addEventListener('click', (e) => {
    const c = (e.target as Element).closest<HTMLButtonElement>('.cart');
    if (!c) return;
    const p = shelf[+c.dataset.i!];
    carts.querySelectorAll('.cart').forEach((x) => x.classList.toggle('in', x === c));
    sample(['switch_004', 'click_003'], { gain: 0.7, rate: 0.75 }, () => click(700, 0.05, 0.4, 80));
    show(`CARTRIDGE: ${U(p.name)}\n\n${U(p.blurb)}`);
    if (p.url) { openA.href = p.url; openA.target = p.url.startsWith('/') ? '' : '_blank'; openA.hidden = false; } else openA.hidden = true;
  });

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as Element).closest('input,textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.min(4, sel + 1), true); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.max(0, sel - 1), true); }
    else if (/^[1-4]$/.test(e.key)) {
      const k = root.querySelector<HTMLButtonElement>(`.key[data-k="${+e.key - 1}"]`);
      if (k) { k.classList.add('dn'); sample(['click_001', 'click_002', 'click_003'], { gain: 0.8, rate: 0.85 }, () => click(1500, 0.03, 0.35, 140)); show(KEYS[+e.key - 1][1]); setTimeout(() => k.classList.remove('dn'), 110); }
    }
  };
  addEventListener('keydown', onKey);

  // VU-style needle with a damped spring
  const mv = root.querySelector('svg')!;
  const P = (deg: number, r: number) => [95 + Math.sin((deg * Math.PI) / 180) * r, 130 - Math.cos((deg * Math.PI) / 180) * r];
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const [x1, y1] = P(-50 + i * 10, i % 5 ? 64 : 58), [x2, y2] = P(-50 + i * 10, 72);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i > 7 ? '#ef5a1f' : '#2a2a2a'}" stroke-width="${i % 5 ? 1.5 : 2.5}"/>`;
  }
  const [ax, ay] = P(-50, 80), [bx, by] = P(50, 80);
  mv.innerHTML = `<path d="M${ax} ${ay} A80 80 0 0 1 ${bx} ${by}" fill="none" stroke="#2a2a2a" stroke-width="1.5"/>${ticks}
    <text x="95" y="98" text-anchor="middle" font-family="'Archivo Variable',sans-serif" font-weight="800" font-size="11" fill="#3a3a3a">ENERGY</text>
    <line class="ndl" x1="95" y1="130" x2="95" y2="46" stroke="#c43d0d" stroke-width="2" stroke-linecap="round"/><circle cx="95" cy="130" r="9" fill="#1d1d1f"/>`;
  const ndl = mv.querySelector('.ndl')!;
  let na = -50, nv = 0;
  const stop = loop((_dt, now) => {
    act *= 0.985;
    const target = power ? -50 + act * 95 + Math.sin(now / 300) * act * 4 : -50;
    nv += (target - na) * 0.06;
    nv *= 0.82;
    na += nv;
    if (Math.abs(nv) > 0.001 || act > 0.001) ndl.setAttribute('transform', `rotate(${na} 95 130)`);
  });

  preload(['switch_004', 'click_003', 'tick_001', 'tick_002', 'tick_004', 'click_001', 'click_002', 'click_003', 'switch_001', 'switch_002', 'switch_004']);
  setSel(0, true);
  return () => { stop(); clearInterval(typer); removeEventListener('keydown', onKey); setMuted(false); };
};

export default mount;
