import '@fontsource-variable/newsreader';
import './ask.css';
import { answer, SUGGESTIONS } from './engine';
import { jack } from '../../content/jack';
import type { Mount } from '../registry';

/**
 * Ask: a calm, conversational assistant that only knows about Jack.
 * Answers come from a local engine (engine.ts) and are streamed in word by
 * word, so it feels alive without a server or an API key.
 */

// Jack's own mark: a little hand-cut "J" seal (not anyone else's logo)
const MARK = `<svg class="mark" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3 3.6"/><path d="M28.5 13v15.5c0 4.4-2.8 7-6.6 7-3 0-5.3-1.6-6.2-4.3" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>`;
const SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
const STOPI = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** tiny markdown: paragraphs, "- " lists, **bold**, [text](url). Input is escaped first. */
function md(src: string) {
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[(.+?)\]\(((?:https?:\/\/|mailto:|\/)[^\s)]+)\)/g, (_m, t, u) => `<a href="${u}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
  return src
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      const items = lines.filter((l) => l.startsWith('- '));
      const lead = lines.filter((l) => !l.startsWith('- '));
      return (lead.length ? `<p>${inline(lead.join(' '))}</p>` : '') + (items.length ? `<ul>${items.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>` : '');
    })
    .join('');
}

// The AI endpoint. In production set VITE_ASK_URL to the Ask service's URL; in dev, Vite proxies /api.
const API = ((import.meta.env.VITE_ASK_URL as string | undefined) || '/api/ask').replace(/\/$/, '');
type Msg = { role: 'user' | 'assistant'; content: string };
let remoteDown = false; // once it fails (not configured / unreachable), stay offline for this visit

/** Stream an answer from the AI service. Resolves false if it couldn't, so the caller can fall back. */
async function remote(messages: Msg[], onText: (t: string) => void, signal: AbortSignal): Promise<boolean> {
  if (remoteDown) return false;
  let got = 0;
  try {
    const firstByte = new AbortController();
    const t = setTimeout(() => firstByte.abort(), 8000);
    signal.addEventListener('abort', () => firstByte.abort());
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }), signal: firstByte.signal });
    clearTimeout(t);
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('text/event-stream') || !r.body) {
      if (r.status !== 429) remoteDown = true;
      return false;
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return got > 0;
        try {
          const ev = JSON.parse(data) as { t?: string; error?: string };
          if (ev.t) { got++; onText(ev.t); }
          else if (ev.error) return got > 0;
        } catch { /* ignore */ }
      }
    }
    return got > 0;
  } catch {
    if (signal.aborted) return got > 0;
    remoteDown = true;
    return false;
  }
}

const mount: Mount = (root) => {
  root.className = 'design d-ask';
  root.innerHTML = `
    <div class="scroll"><div class="col" aria-live="polite">
      <div class="hello">${MARK}<h1>What would you like to know about ${jack.first}?</h1><p>I'm a small assistant that only knows one subject. Ask about his work, background, projects or how to reach him.</p>
        <div class="chips">${SUGGESTIONS.map((s) => `<button type="button">${s}</button>`).join('')}</div></div>
    </div></div>
    <div class="composer"><form>
      <label class="visually-hidden" for="ask-q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Ask a question about ${jack.first}</label>
      <textarea id="ask-q" rows="1" placeholder="Ask about ${jack.first}…" enterkeyhint="send" autocomplete="off"></textarea>
      <div class="row"><small>Answers only about ${jack.name}, powered by Gemini.</small><button class="send" type="submit" aria-label="Send" disabled>${SEND}</button></div>
    </form></div>`;

  const scroller = root.querySelector<HTMLDivElement>('.scroll')!;
  const col = root.querySelector<HTMLDivElement>('.col')!;
  const form = root.querySelector('form')!;
  const ta = root.querySelector('textarea')!;
  const send = root.querySelector<HTMLButtonElement>('.send')!;
  let streaming: { cancel: () => void } | null = null;
  const history: Msg[] = [];
  const modeEl = root.querySelector<HTMLElement>('.row small')!;
  const setMode = (m: 'ai' | 'offline') => {
    modeEl.innerHTML = m === 'ai' ? `<span class="dot ai"></span>Answers by Gemini, from ${jack.first}'s own facts.` : `<span class="dot"></span>Offline answers, only about ${jack.name}.`;
  };

  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(200, ta.scrollHeight) + 'px'; send.disabled = !streaming && !ta.value.trim(); };
  const atBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
  const toBottom = () => { scroller.scrollTop = scroller.scrollHeight; };

  function setStreaming(s: typeof streaming) {
    streaming = s;
    send.innerHTML = s ? STOPI : SEND;
    send.setAttribute('aria-label', s ? 'Stop' : 'Send');
    send.type = s ? 'button' : 'submit';
    grow();
  }

  function ask(q: string) {
    q = q.trim();
    if (!q || streaming) return;
    root.querySelector('.hello')?.remove();
    const u = document.createElement('div');
    u.className = 'msg user';
    u.innerHTML = `<div>${esc(q)}</div>`;
    const b = document.createElement('div');
    b.className = 'msg bot streaming';
    b.innerHTML = `${MARK}<div><div class="txt"><span class="dots"><i></i><i></i><i></i></span></div><div class="tools"><button type="button" data-copy>Copy</button></div></div>`;
    col.append(u, b);
    ta.value = '';
    grow();
    if (matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
    toBottom();

    const txt = b.querySelector<HTMLDivElement>('.txt')!;
    history.push({ role: 'user', content: q });
    let full = '';
    let raf = 0;
    const paint = () => { raf = 0; const stick = atBottom(); txt.innerHTML = md(full); if (stick) toBottom(); };
    const finish = () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      txt.innerHTML = md(full || '…');
      b.classList.remove('streaming');
      b.dataset.raw = full;
      history.push({ role: 'assistant', content: full });
      setStreaming(null);
    };
    // offline engine: reveal a precomputed answer word by word
    let timer = 0;
    const local = () => {
      const tokens = answer(q).match(/\S+\s*|\n+/g) ?? [];
      let i = 0;
      const tick = () => {
        i = Math.min(tokens.length, i + 1 + (Math.random() < 0.3 ? 1 : 0));
        full = tokens.slice(0, i).join('');
        paint();
        if (i >= tokens.length) return finish();
        timer = window.setTimeout(tick, 18 + Math.random() * 34);
      };
      timer = window.setTimeout(tick, 300 + Math.random() * 200);
    };
    const ctrl = new AbortController();
    setStreaming({ cancel: () => { ctrl.abort(); finish(); } });
    void remote(history.slice(-12), (t) => { full += t; if (!raf) raf = requestAnimationFrame(paint); }, ctrl.signal).then((ok) => {
      setMode(ok ? 'ai' : 'offline');
      if (ctrl.signal.aborted) return;
      if (ok && full) finish();
      else { full = ''; local(); }
    });
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(ta.value); });
  send.addEventListener('click', () => { if (streaming) streaming.cancel(); });
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(ta.value); }
  });
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const chip = t.closest<HTMLButtonElement>('.chips button');
    if (chip) ask(chip.textContent!);
    const cp = t.closest<HTMLButtonElement>('[data-copy]');
    if (cp) {
      const raw = cp.closest<HTMLElement>('.msg')!.dataset.raw ?? '';
      navigator.clipboard?.writeText(raw.replace(/\*\*/g, '').replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')).then(
        () => { cp.textContent = 'Copied'; setTimeout(() => (cp.textContent = 'Copy'), 1400); },
        () => { cp.textContent = 'Copy failed'; },
      );
    }
  });

  // focus the composer on desktop only (on phones it would pop the keyboard)
  if (matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
  return () => streaming?.cancel();
};

export default mount;
