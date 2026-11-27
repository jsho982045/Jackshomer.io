import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './shell.css';
import { designs, pages, notFound, byPath, type DesignMeta } from './designs/registry';
import { mountHub } from './hub';
import { jack } from './content/jack';
import { initAnalytics, track } from './lib/track';
import { initHints } from './lib/hints';

const stage = document.getElementById('stage')!;
const root = document.documentElement;
let current: string | null = null;
let cleanup: (() => void) | null = null;
let token = 0;

const clean = (p: string) => p.replace(/\/+$/, '') || '/';

async function render(path: string, push: boolean) {
  path = clean(path);
  if (path === current) return;
  const meta = byPath(path) ?? (path === '/' ? undefined : notFound);
  const my = ++token;
  if (push) history.pushState(null, '', path);
  let mount = mountHub as unknown as (el: HTMLElement, nav: (p: string) => void) => () => void;
  if (meta) {
    root.dataset.loading = '';
    try {
      mount = (await meta.load()).default;
    } finally {
      delete root.dataset.loading;
    }
  }
  if (my !== token) return; // a newer navigation won

  const swap = () => {
    cleanup?.();
    cleanup = null;
    const el = document.createElement('div');
    el.className = 'design';
    stage.replaceChildren(el);
    const tone = meta?.tone ?? 'dark';
    root.dataset.tone = tone === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : tone;
    root.dataset.design = meta?.id ?? 'home';
    document.title = meta ? `${meta.name} · Jack Shomer` : 'Jack Shomer';
    cleanup = mount(el, navigate);
    current = path;
    dock.update(meta);
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (current !== null && document.startViewTransition && !reduce) document.startViewTransition(swap);
  else swap();
}

export function navigate(path: string) {
  void render(path, true);
}

/* ---------- links: intercept same-origin clicks, prefetch on intent ---------- */
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest('a');
  if (e.defaultPrevented || !a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  navigate(url.pathname);
});
addEventListener('popstate', () => void render(location.pathname, false));

const prefetch = (e: Event) => {
  const a = (e.target as Element).closest?.('a');
  if (a) byPath(clean(new URL(a.href, location.href).pathname))?.load().catch(() => {});
};
document.addEventListener('pointerover', prefetch, { passive: true });
document.addEventListener('focusin', prefetch);
document.addEventListener('touchstart', prefetch, { passive: true });

/* ---------- the dock: switch designs from anywhere ---------- */
const dock = (() => {
  const nav = document.createElement('nav');
  nav.className = 'dock';
  nav.setAttribute('aria-label', 'Designs');
  nav.innerHTML = `
    <a class="dk-home" href="/" aria-label="All designs">JS</a>
    <a class="dk-cv" href="/resume" aria-label="Résumé"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg><span>Résumé</span></a>
    <a class="dk-ask" href="/ask" aria-label="Ask my AI assistant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12.5 11h.01M16 11h.01"/></svg><span>Ask</span></a>
    <button class="dk-hand" aria-pressed="false" aria-label="Use your hand (camera)" title="Use your hand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4a1.5 1.5 0 0 1 3 0v7"/><path d="M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 11.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.7L4.6 14.4a1.6 1.6 0 0 1 2.5-2l.9 1.1"/></svg></button>
    <button class="dk-pj" aria-expanded="false" aria-controls="dk-proj" aria-label="Projects"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg><span>Projects</span></button>
    <a class="dk-step dk-prev" aria-label="Previous design">‹</a>
    <button class="dk-cur" aria-expanded="false" aria-controls="dk-menu"><span class="dk-name">All designs</span></button>
    <a class="dk-step dk-next" aria-label="Next design">›</a>
    <div class="dk-proj" id="dk-proj" hidden>
      <p class="dk-h">Projects <small>open in a new tab</small></p>
      ${jack.projects.map((p) => `<a class="pj big" href="${p.url}" target="_blank" rel="noopener"><b>${p.name} <span aria-hidden="true">↗</span></b><span>${p.blurb}</span>${p.highlights.length ? `<ul>${p.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>` : ''}</a>`).join('')}
      <div class="pj-row">${jack.smallProjects.map((p) => `<a class="pj" href="${p.url}" target="_blank" rel="noopener"><b>${p.name} <span aria-hidden="true">↗</span></b><span>${p.blurb}</span></a>`).join('')}</div>
      <a class="pj-more" href="${jack.allProjectsUrl}" target="_blank" rel="noopener">More on GitHub ↗</a>
    </div>
    <div class="dk-menu" id="dk-menu" hidden>
      <a href="/"><i style="--sw:#3a3a3a"></i>All designs</a>
      ${pages.map((d) => `<a href="${d.path}" data-id="${d.id}"><i class="sw-${d.id}"></i>${d.name}</a>`).join('')}
      <hr>
      ${designs.map((d) => `<a href="${d.path}" data-id="${d.id}"><i class="sw-${d.id}"></i>${d.name}</a>`).join('')}
    </div>`;
  document.body.append(nav);
  const cur = nav.querySelector<HTMLButtonElement>('.dk-cur')!;
  const menu = nav.querySelector<HTMLDivElement>('.dk-menu')!;
  const prev = nav.querySelector<HTMLAnchorElement>('.dk-prev')!;
  const next = nav.querySelector<HTMLAnchorElement>('.dk-next')!;
  // ✋ hand tracking: explained first, camera only after an explicit "Turn on"
  const handBtn = nav.querySelector<HTMLButtonElement>('.dk-hand')!;
  let hands: typeof import('./lib/hands') | null = null, handWired = false;
  const sheet = document.createElement('div');
  sheet.className = 'hand-sheet'; sheet.hidden = true;
  sheet.innerHTML = `<div class="hs-card" role="dialog" aria-modal="true" aria-labelledby="hs-t">
      <h2 id="hs-t">Use your hand</h2>
      <p>Your webcam finds your hand and turns it into a pointer, so you can grab things with it.</p>
      <ul><li><b>Move</b> your hand to point.</li><li><b>Pinch</b> thumb and index finger to grab; let go to drop or throw.</li><li><b>Quick pinch</b> to click.</li><li><b>Shake</b> your open hand to shake things (try the snow globe).</li></ul>
      <p class="hs-small">Tracking runs on your device. No video is recorded or sent anywhere. The first time, it downloads a hand model (about 20 MB). Turn it off any time with the ✋ button.</p>
      <p class="hs-err" hidden></p>
      <div class="hs-row"><button class="hs-go">Turn on camera</button><button class="hs-no">Not now</button></div>
    </div>`;
  document.body.append(sheet);
  const sheetErr = sheet.querySelector<HTMLParagraphElement>('.hs-err')!, goBtn = sheet.querySelector<HTMLButtonElement>('.hs-go')!;
  const reflect = (s: string, msg?: string) => {
    handBtn.setAttribute('aria-pressed', String(s === 'on'));
    handBtn.classList.toggle('loading', s === 'loading');
    goBtn.textContent = s === 'loading' ? 'Loading the hand model…' : 'Turn on camera';
    goBtn.disabled = s === 'loading';
    if (s === 'on') { sheet.hidden = true; track('hand-mode-on'); }
    if (s === 'error') track('hand-mode-error');
    if (s === 'error') { sheet.hidden = false; sheetErr.hidden = false; sheetErr.textContent = msg ?? 'Hand tracking could not start.'; }
  };
  handBtn.addEventListener('click', async () => {
    if (hands?.handStatus() === 'on') { void hands.toggleHands(); return; }
    sheetErr.hidden = true; sheet.hidden = false; goBtn.focus();
    hands ??= await import('./lib/hands');
  });
  goBtn.addEventListener('click', async () => {
    if (!hands) { hands = await import('./lib/hands'); }
    if (!handWired) { handWired = true; hands.onHandStatus(reflect); }
    if (hands.handStatus() !== 'on') void hands.toggleHands();
  });
  sheet.querySelector('.hs-no')!.addEventListener('click', () => (sheet.hidden = true));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
  initHints({ nav, askBtn: nav.querySelector<HTMLElement>('.dk-ask')!, handBtn, handOn: () => hands?.handStatus() === 'on', sheetOpen: () => !sheet.hidden, go: navigate });
  initAnalytics();
  if (location.search.includes('handtest')) (window as unknown as { __hands: () => Promise<unknown> }).__hands = async () => (hands ??= await import('./lib/hands'))._driveForTest();

  const pjBtn = nav.querySelector<HTMLButtonElement>('.dk-pj')!;
  const proj = nav.querySelector<HTMLDivElement>('.dk-proj')!;
  const setOpen = (o: boolean) => {
    menu.hidden = !o;
    cur.setAttribute('aria-expanded', String(o));
    if (o) setProj(false);
  };
  const setProj = (o: boolean) => {
    proj.hidden = !o;
    pjBtn.setAttribute('aria-expanded', String(o));
    if (o) setOpen(false);
  };
  cur.addEventListener('click', () => setOpen(menu.hidden));
  pjBtn.addEventListener('click', () => setProj(proj.hidden));
  menu.addEventListener('click', () => setOpen(false));
  proj.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) setProj(false); });
  document.addEventListener('pointerdown', (e) => {
    if (!nav.contains(e.target as Node)) { setOpen(false); setProj(false); }
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { setOpen(false); setProj(false); sheet.hidden = true; }
    const t = e.target as HTMLElement;
    if (t.closest('input,textarea,[contenteditable]')) return;
    if (e.key === '[') prev.click();
    if (e.key === ']') next.click();
  });
  return {
    update(meta?: DesignMeta) {
      const i = meta ? designs.indexOf(meta) : -1;
      nav.querySelector('.dk-name')!.textContent = meta ? meta.name : 'All designs';
      cur.className = `dk-cur${meta ? ' sw-' + meta.id : ''}`;
      prev.href = i <= 0 ? (i === 0 ? '/' : designs[designs.length - 1].path) : designs[i - 1].path;
      next.href = i === designs.length - 1 ? '/' : designs[i + 1].path;
      menu.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', clean(new URL(a.href).pathname) === clean(location.pathname)));
    },
  };
})();

void render(location.pathname, false);

/* warm up the light designs once the page is idle (Cabin waits for intent) */
const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
idle(() => designs.filter((d) => !d.heavy).forEach((d) => d.load().catch(() => {})), { timeout: 4000 });
