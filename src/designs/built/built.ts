import type { Mount } from '../registry';
import { designs } from '../registry';

/**
 * "How this site is built": real numbers from dist/build-stats.json (written at
 * build time) plus the visitor's own load timings, then the techniques behind
 * each design and how the site was made with AI agents.
 */
const CSS = `
.d-built { --bg: #10233f; --line: rgba(160,200,255,.14); --ink: #e8f0fb; --soft: #9fb3cf; --hi: #ffcf5a;
  position: fixed; inset: 0; overflow-y: auto; overscroll-behavior: contain; color: var(--ink); font: 16px/1.6 'Instrument Sans Variable', system-ui, sans-serif;
  background: var(--bg); background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px), linear-gradient(rgba(160,200,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(160,200,255,.06) 1px, transparent 1px);
  background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px; }
.d-built .wrap { max-width: 980px; margin: 0 auto; padding: 96px 20px 90px; }
.d-built h1 { font: 700 clamp(34px, 5vw, 52px)/1.05 'Instrument Sans Variable', sans-serif; letter-spacing: -.02em; margin: 0 0 12px; }
.d-built .dek { color: var(--soft); max-width: 60ch; margin: 0 0 30px; font-size: 18px; }
.d-built h2 { font-size: 22px; margin: 44px 0 14px; padding-top: 14px; border-top: 1px solid var(--line); }
.d-built .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.d-built .card { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: rgba(8,20,38,.55); }
.d-built .card b { display: block; font-size: clamp(24px, 3vw, 32px); line-height: 1.1; color: var(--hi); font-variant-numeric: tabular-nums; }
.d-built .card span { color: var(--soft); font-size: 13.5px; }
.d-built .bars { display: grid; gap: 8px; }
.d-built .bar { display: grid; grid-template-columns: 120px minmax(0, 1fr) 84px; gap: 12px; align-items: center; font-size: 14px; }
.d-built .bar i { display: block; height: 14px; border-radius: 3px; background: linear-gradient(90deg, #5aa2ff, #8fd0ff); min-width: 2px; }
.d-built .bar.big i { background: linear-gradient(90deg, #ffb35a, #ffd78f); }
.d-built .bar em { font-style: normal; text-align: right; font-variant-numeric: tabular-nums; color: var(--soft); white-space: nowrap; }
.d-built .note { color: var(--soft); font-size: 14px; margin: 10px 0 0; }
.d-built .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.d-built .tech { border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; background: rgba(8,20,38,.55); }
.d-built .tech h3 { margin: 0 0 6px; font-size: 17px; }
.d-built .tech p { margin: 0; color: #c9d6ea; font-size: 15px; }
.d-built ul.pts { padding-left: 20px; margin: 0; }
.d-built ul.pts li { margin: 6px 0; }
.d-built code { font: 14px ui-monospace, SFMono-Regular, Menlo, monospace; background: rgba(160,200,255,.12); padding: 1px 6px; border-radius: 4px; }
.d-built a { color: var(--hi); }
@media (max-width: 760px) { .d-built .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .d-built .grid2 { grid-template-columns: minmax(0, 1fr); } .d-built .bar { grid-template-columns: 90px minmax(0, 1fr) 70px; } }
`;

type Stat = { file: string; name: string; type: string; entry: boolean; bytes: number; gzip: number };
const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`);
const ms = (n: number) => `${Math.round(n)} ms`;

const TECH: [string, string][] = [
  ['Shell', 'Vite + TypeScript, no UI framework. Each design is a lazily loaded chunk with its own CSS and fonts, prefetched when you point at its link. Page changes use the View Transitions API.'],
  ['Linen', 'Verlet cloth (positions in flat Float32Arrays, distance constraints, tearing) simulated on a fixed 60 Hz step, drawn in 2D instantly, then handed to a three.js renderer: a woven linen texture with real cross-stitches, a bump map, fibre sheen and a soft shadow cast on the wall.'],
  ['Desk', 'DOM objects with a tiny rigid-body model: a spring at the grab point gives torque, so paper pivots where you hold it. Only GPU-composited transforms change per frame, and objects at rest are skipped.'],
  ['Machine', 'Detented rotary dial (angle snapping with a spring), spring-damped VU needle, and recorded switch and key sounds through the Web Audio API.'],
  ['Gel', 'Position-based soft bodies (edge, bend and area constraints) rendered in WebGL with a refraction shader, so each gummy bends the backdrop behind it.'],
  ['Cabin', 'three.js with physically based materials from CC0 photo scans, filmic tone mapping, a shader fire with a shadow-casting light, rain and lightning, adaptive resolution and depth of field when you focus on something.'],
  ['Snow globe', 'A three.js scene under a physically based glass sphere (transmission, clearcoat, a custom studio environment for crisp highlights). About 1,600 snowflakes are simulated on the CPU with drag, flutter and swirl that follows the globe as you spin it; they collide with the glass, settle on the ground, and a hard flick or a real phone shake stirs them up again.'],
  ['Ask', 'Streams answers from Gemini (free tier) through a small Node service on Railway with a facts-only system prompt, per-visitor and daily rate limits, and an automatic fallback to an offline engine.'],
  ['Everywhere', 'Physics never runs while the tab is hidden; simulations use a fixed timestep so 60, 90 and 120 Hz screens behave the same; sounds are CC0 recordings, loaded on first interaction.'],
];

const mount: Mount = (root) => {
  root.className = 'design d-built';
  root.innerHTML = `<style>${CSS}</style><div class="wrap">
    <h1>How this site is built</h1>
    <p class="dek">Seven designs, one shell, real physics. The numbers below are read from this exact build, and the load times are measured in your browser right now.</p>
    <div class="cards" id="b-live"></div>
    <h2>What you download</h2>
    <div class="bars" id="b-bars"><p class="note">Loading build stats…</p></div>
    <p class="note">Sizes are gzipped. The shell is all that loads first; each design is fetched the first time you open it (three.js only for the 3D ones, cached after that).</p>
    <h2>Techniques</h2>
    <div class="grid2">${TECH.map(([h, p]) => `<div class="tech"><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
    <h2>How I build with AI agents</h2>
    <ul class="pts">
      <li><b>I set direction, agents do the legwork.</b> This site was built in a few long sessions with Claude as a coding agent: I wrote the brief (physical, fast, one portfolio in many designs), made the product calls and reviewed every result.</li>
      <li><b>Trust is earned, then extended.</b> Agents get clear guardrails (nothing is committed or pushed without my approval) and have to show evidence: screenshots on desktop and phone, test runs, checksums of synced files.</li>
      <li><b>Verify, don't assume.</b> Facts on this site were checked against primary sources, sizes come from the build itself, and every design was exercised in a real browser before shipping.</li>
      <li><b>Fundamentals first.</b> I learned to program before ChatGPT existed, which is what makes it possible to direct agents well and catch them when they're wrong.</li>
    </ul>
    <p class="note">Source: <a href="https://github.com/jsho982045/Jackshomer.io" target="_blank" rel="noopener">github.com/jsho982045/Jackshomer.io</a></p>
  </div>`;

  // visitor's own timings (from the first page load of this visit)
  const live = root.querySelector('#b-live')!;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
  const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const transferred = res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav?.transferSize ?? 0);
  let lcp = 0;
  let po: PerformanceObserver | null = null;
  try {
    po = new PerformanceObserver((l) => { const e = l.getEntries(); lcp = e[e.length - 1].startTime; paintLive(); });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* not supported */ }
  function paintLive() {
    const cards: [string, string][] = [
      ['First paint', fcp ? ms(fcp) : 'n/a'],
      ['Largest paint', lcp ? ms(lcp) : 'n/a'],
      ['Server response', nav ? ms(nav.responseStart - nav.requestStart) : 'n/a'],
      ['Transferred so far', transferred ? kb(transferred) : 'cached'],
    ];
    live.innerHTML = cards.map(([l, v]) => `<div class="card"><b>${v}</b><span>${l}, your visit</span></div>`).join('');
  }
  paintLive();

  // build stats
  const bars = root.querySelector('#b-bars')!;
  fetch('/build-stats.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(({ files }: { files: Stat[] }) => {
      const by = (pred: (f: Stat) => boolean) => files.filter(pred).reduce((s, f) => s + f.gzip, 0);
      const entry = files.find((f) => f.entry);
      const shellJs = entry ? entry.gzip : 0;
      const shellCss = by((f) => f.type === 'css' && f.file.includes('/index-'));
      const html = by((f) => f.file === 'index.html');
      const rows: [string, number, boolean?][] = [['Shell (first load)', shellJs + shellCss + html]];
      for (const d of designs) rows.push([d.name, by((f) => (f.type === 'js' || f.type === 'css') && f.file.includes(`/${d.id}-`))]);
      for (const [p, label] of [['story', 'Story'], ['resume', 'Résumé'], ['built', 'This page']]) rows.push([label, by((f) => (f.type === 'js' || f.type === 'css') && f.file.includes(`/${p}-`))]);
      rows.push(['three.js (shared)', by((f) => f.file.includes('/three-')), true]);
      const max = Math.max(...rows.map((r) => r[1]));
      bars.innerHTML = rows
        .filter((r) => r[1] > 0)
        .map(([n, v, big]) => `<div class="bar${big ? ' big' : ''}"><span>${n}</span><i style="width:${(v / max) * 100}%"></i><em>${kb(v)}</em></div>`)
        .join('');
    })
    .catch(() => { bars.innerHTML = '<p class="note">Build stats are written by <code>npm run build</code>; they are not available on the dev server.</p>'; });

  return () => po?.disconnect();
};

export default mount;
