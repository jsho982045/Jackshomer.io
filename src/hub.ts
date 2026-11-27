import { designs } from './designs/registry';
import { jack, ai } from './content/jack';

/** The home page: one swatch per design. Lives in the main bundle so "/" paints instantly. */
export function mountHub(el: HTMLElement) {
  el.innerHTML = `
    <section class="hub">
      <h1>${jack.name}</h1>
      <p class="lede">${jack.headline} Same person, seven different rooms. Pick one; switch any time from the top-right corner.</p>
      <div class="try">
        <div class="try-card try-ask">
          <span class="try-k">Try this</span>
          <h2>Ask my AI</h2>
          <p>An assistant that knows my work, my story and my projects. Ask it anything about me.</p>
          <div class="try-q">${['What does Jack do?', 'What has he built?', 'How did he get into tech?'].map((q) => `<a href="/ask" data-q="${q}">${q}</a>`).join('')}</div>
        </div>
        <div class="try-card try-hand">
          <span class="try-k">Try this</span>
          <h2>Use your hand ✋</h2>
          <p>Turn on your webcam and grab the cloth, squash the gummies or shake the snow globe with your real hand. Nothing leaves your device.</p>
          <div class="try-q"><button class="try-go">Turn it on</button><span class="try-phone">Open on a laptop with a webcam to try it.</span></div>
        </div>
      </div>
      <a class="story" href="/story">
        <div><h2>The long way in</h2><p>Data analyst with no connections → coding teacher → unpaid intern → founding engineer. And building with AI since the week ChatGPT launched.</p><span class="go">Read my story →</span></div>
        <figure><img src="${ai.proofImage}" width="929" height="620" alt="Jack's message about ChatGPT, ${ai.proofDate}" loading="lazy" decoding="async"><figcaption>${ai.proofDate}, four days after ChatGPT launched.</figcaption></figure>
      </a>
      <div class="grid">
        ${designs
          .map(
            (d) => `<a class="sw" href="${d.path}"><div class="mat m-${d.id}"></div><div class="cap"><b>${d.name}</b><span>${d.blurb}</span></div></a>`,
          )
          .join('')}
      </div>
      <h2 class="pj-h" id="projects">Projects</h2>
      <div class="pjs">
        ${jack.projects.map((p) => `<a class="pj big" href="${p.url}" target="_blank" rel="noopener"><b>${p.name} <span aria-hidden="true">↗</span></b><p>${p.blurb}</p>${p.highlights.length ? `<ul>${p.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>` : ''}<small>${new URL(p.url).host}</small></a>`).join('')}
        ${jack.smallProjects.map((p) => `<a class="pj" href="${p.url}" target="_blank" rel="noopener"><b>${p.name} <span aria-hidden="true">↗</span></b><p>${p.blurb}</p></a>`).join('')}
      </div>
      <p class="foot"><a href="/resume">Résumé</a> · <a href="/built">How this site is built</a> · Tip: <kbd>[</kbd> and <kbd>]</kbd> step between designs.</p>
    </section>`;
  // tapped questions are asked as soon as /ask opens; the hand card presses the ✋ button in the dock
  el.addEventListener('click', (e) => {
    const t = e.target as Element;
    const q = t.closest<HTMLAnchorElement>('a[data-q]');
    if (q) { try { sessionStorage.setItem('ask-q', q.dataset.q!); } catch { /* ignore */ } }
    if (t.closest('.try-go')) document.querySelector<HTMLButtonElement>('.dk-hand')?.click();
  });
  return () => {};
}
