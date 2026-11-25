import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './shell.css';
import { designs, pages, byPath, type DesignMeta } from './designs/registry';
import { mountHub } from './hub';

const stage = document.getElementById('stage')!;
const root = document.documentElement;
let current: string | null = null;
let cleanup: (() => void) | null = null;
let token = 0;

const clean = (p: string) => p.replace(/\/+$/, '') || '/';

async function render(path: string, push: boolean) {
  path = clean(path);
  if (path === current) return;
  const meta = byPath(path);
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
    <a class="dk-step dk-prev" aria-label="Previous design">‹</a>
    <button class="dk-cur" aria-expanded="false" aria-controls="dk-menu"><span class="dk-name">All designs</span></button>
    <a class="dk-step dk-next" aria-label="Next design">›</a>
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
  const setOpen = (o: boolean) => {
    menu.hidden = !o;
    cur.setAttribute('aria-expanded', String(o));
  };
  cur.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', () => setOpen(false));
  document.addEventListener('pointerdown', (e) => {
    if (!nav.contains(e.target as Node)) setOpen(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
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
