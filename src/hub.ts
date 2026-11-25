import { designs } from './designs/registry';
import { jack, ai } from './content/jack';

/** The home page: one swatch per design. Lives in the main bundle so "/" paints instantly. */
export function mountHub(el: HTMLElement) {
  el.innerHTML = `
    <section class="hub">
      <h1>${jack.name}</h1>
      <p class="lede">${jack.headline} Same person, six different rooms. Pick one; switch any time from the top-right corner.</p>
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
      <p class="foot">Tip: <kbd>[</kbd> and <kbd>]</kbd> step between designs.</p>
    </section>`;
  return () => {};
}
