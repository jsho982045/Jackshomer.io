import { track } from './track';

/**
 * One-time pointers to the two highlights, so they don't stay hidden:
 *
 *  1. Ask: ~6 s into a first visit (any device), a bubble under the Ask button
 *     with two questions you can tap; tapping one opens /ask and asks it.
 *  2. Hand: desktop only, after the Ask bubble is done, the first time someone
 *     actually grabs or drags something in a design ("now try it with your hand").
 *
 * Each shows once per visitor ever, never stacked, never on the page it
 * advertises, never on /resume, and never to someone already using the feature.
 */

const ASK_KEY = 'hint-ask', HAND_KEY = 'hint-hand';
const QUESTIONS = ['What does Jack do?', 'What has he built?'];
const QUIET_PAGES = ['/resume'];
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return '1'; } }, // storage blocked → treat as seen
  set: (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* ignore */ } },
};

/** pre-fill a question for /ask to send as soon as it opens */
export function askAbout(q: string, go: (path: string) => void) {
  try { sessionStorage.setItem('ask-q', q); } catch { /* ignore */ }
  go('/ask');
}

export function initHints(o: { nav: HTMLElement; askBtn: HTMLElement; handBtn: HTMLElement; handOn: () => boolean; sheetOpen: () => boolean; go: (path: string) => void }) {
  let open: HTMLElement | null = null;
  const path = () => location.pathname.replace(/\/+$/, '') || '/';
  const desktop = matchMedia('(pointer: fine)').matches && innerWidth >= 700;
  if (location.search.includes('handtest')) return;

  // using a feature counts as having seen its hint
  o.askBtn.addEventListener('click', () => store.set(ASK_KEY));
  o.handBtn.addEventListener('click', () => store.set(HAND_KEY));

  function bubble(kind: 'ask' | 'hand', anchor: HTMLElement, html: string) {
    const tip = document.createElement('div');
    tip.className = `hint-bubble hint-${kind}`;
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-label', kind === 'ask' ? 'Ask my AI assistant' : 'Use your hand');
    tip.innerHTML = `${html}<button class="hb-x" aria-label="Dismiss">×</button>`;
    o.nav.append(tip);
    // sit under the button it's about, kept on screen, with the arrow pointing at the button
    const r = anchor.getBoundingClientRect(), n = o.nav.getBoundingClientRect(), w = tip.offsetWidth, cx = r.left + r.width / 2;
    const left = Math.max(12, Math.min(innerWidth - w - 12, cx - 44));
    tip.style.right = 'auto'; tip.style.left = `${left - n.left}px`;
    tip.style.setProperty('--arrow', `${Math.max(18, Math.min(w - 18, cx - left))}px`);
    open = tip;
    track('hint-shown', { hint: kind });
    let closed = false;
    const close = (how: 'click' | 'dismiss' | 'timeout') => {
      if (closed) return; closed = true;
      if (how !== 'click') track(`hint-${how}`, { hint: kind });
      tip.classList.add('out');
      setTimeout(() => { tip.remove(); if (open === tip) open = null; }, 300);
    };
    tip.querySelector('.hb-x')!.addEventListener('click', () => close('dismiss'));
    // give people time to read it, but don't linger while they're busy
    let timer = setTimeout(() => close('timeout'), 14000);
    tip.addEventListener('pointerenter', () => clearTimeout(timer));
    tip.addEventListener('pointerleave', () => { clearTimeout(timer); timer = setTimeout(() => close('timeout'), 6000); });
    return { tip, close };
  }

  // ---------- 1. Ask ----------
  function showAsk() {
    if (store.get(ASK_KEY) || open || o.sheetOpen()) return false;
    const p = path();
    if (p === '/ask' || p === '/' || QUIET_PAGES.includes(p)) return false; // the home page already has the Ask card
    store.set(ASK_KEY);
    const { tip, close } = bubble('ask', o.askBtn, `
      <p><b>Have a question about me?</b> My AI assistant answers in seconds.</p>
      <div class="hb-chips">${QUESTIONS.map((q) => `<button class="hb-q">${q}</button>`).join('')}</div>`);
    tip.querySelectorAll<HTMLButtonElement>('.hb-q').forEach((b) => b.addEventListener('click', () => {
      track('hint-click', { hint: 'ask', question: b.textContent! });
      close('click'); askAbout(b.textContent!, o.go);
    }));
    return true;
  }
  let askTimer = 0;
  const scheduleAsk = () => { clearTimeout(askTimer); askTimer = window.setTimeout(() => { if (!showAsk() && !store.get(ASK_KEY)) scheduleAsk(); }, 6000); };
  if (!store.get(ASK_KEY)) scheduleAsk();

  // ---------- 2. Hand ----------
  if (!desktop || store.get(HAND_KEY)) return;
  const DESIGN_PAGES = ['/linen', '/desk', '/machine', '/gel', '/cabin', '/globe'];
  let grabbed = false;
  const onDown = (e: PointerEvent) => {
    if (e.isTrusted === false || !DESIGN_PAGES.includes(path()) || o.nav.contains(e.target as Node)) return;
    grabbed = true;
  };
  const onUp = () => {
    if (!grabbed) return;
    grabbed = false;
    // wait a beat after they let go, so it doesn't interrupt the gesture
    setTimeout(() => {
      if (store.get(HAND_KEY) || open || o.handOn() || o.sheetOpen() || !store.get(ASK_KEY)) return;
      store.set(HAND_KEY);
      removeEventListener('pointerdown', onDown, true); removeEventListener('pointerup', onUp, true);
      const { tip, close } = bubble('hand', o.handBtn, `
        <p><b>Now try it with your real hand.</b> Your webcam turns a pinch into a grab. ✋</p>
        <div class="hb-chips"><button class="hb-go">Try it</button></div>`);
      tip.querySelector('.hb-go')!.addEventListener('click', () => { track('hint-click', { hint: 'hand' }); close('click'); o.handBtn.click(); });
    }, 1200);
  };
  addEventListener('pointerdown', onDown, true);
  addEventListener('pointerup', onUp, true);
}
