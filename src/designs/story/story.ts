import '@fontsource-variable/newsreader';
import './story.css';
import { jack, story, ai } from '../../content/jack';
import type { Mount } from '../registry';

/**
 * The story: Jack's journey as one well-set page, shared by every design.
 * Chapters come from content/jack.ts; the AI chapter carries the proof figure.
 */
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const mount: Mount = (root) => {
  root.className = 'design d-story';
  const gap = days(ai.launchDate, ai.proofDate);
  const chapter = (c: (typeof story)[number]) => {
    let extra = '';
    if (c.id === 'ai') {
      extra = `
        <figure class="proof">
          <div class="print"><img src="${ai.proofImage}" width="929" height="620" alt="Jack's group-chat message from ${ai.proofDate}, 1:27 AM: a link to chat.openai.com with the words 'This is very cool'." loading="lazy" decoding="async"></div>
          <figcaption>
            <b>Receipts.</b>
            ChatGPT went public on <a href="${ai.launchSource}" target="_blank" rel="noopener">${ai.launchDate}</a> (OpenAI’s announcement).
            <span class="gap"><strong>${gap}</strong> days later I sent this.</span>
            ${ai.proofDate}, 1:27 AM, to a group chat.
          </figcaption>
        </figure>`;
    }
    const tools = c.id === 'ai' ? `<ul class="tools">${ai.tools.map((t) => `<li>${t}</li>`).join('')}</ul>` : '';
    const quote = c.id === 'ai' ? `<blockquote>“${ai.line}”</blockquote>` : '';
    const projects =
      c.id === 'building'
        ? `<div class="projects">${jack.projects.map((p) => `<div><b>${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${p.name}</a>` : p.name}</b>${p.blurb}</div>`).join('')}</div>
           <p>A few of the early ones:</p>
           <ul class="small">${jack.smallProjects.map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a></li>`).join('')}</ul>
           <p><a href="${jack.allProjectsUrl}" target="_blank" rel="noopener">See all the early projects →</a></p>`
        : '';
    const [first, ...rest] = c.body;
    return `<section id="${c.id}" aria-labelledby="h-${c.id}">
      <h2 id="h-${c.id}">${c.title}</h2><p class="when">${c.when}</p>
      <p>${first}</p>${c.id === 'ai' ? quote + extra : ''}${rest.map((p) => `<p>${p}</p>`).join('')}${tools}${projects}
    </section>`;
  };

  root.innerHTML = `
    <div class="book">
      <header>
        <h1>The long way in</h1>
        <p class="dek">How a data analyst with no connections became a founding engineer, and why I’ve been building with AI since the week it launched.</p>
      </header>
      <nav class="toc" aria-label="Chapters">${story.map((c) => `<a href="#${c.id}"><span>${c.when}</span><span>${c.title}</span></a>`).join('')}</nav>
      <main>
        ${story.map(chapter).join('')}
        <footer>
          <h3>Let’s talk.</h3>
          <p>${jack.title} · ${jack.location}</p>
          <div class="links">
            <a href="mailto:${jack.email}">${jack.email}</a>
            <a href="${jack.linkedin}" target="_blank" rel="noopener">LinkedIn</a>
            <a href="${jack.github}" target="_blank" rel="noopener">GitHub</a>
            <a href="/ask">Ask about me</a>
          </div>
        </footer>
      </main>
    </div>`;

  // chapter links scroll inside the page (the URL stays on /story)
  const toc = root.querySelector('nav.toc')!;
  toc.addEventListener('click', (e) => {
    const a = (e.target as Element).closest('a');
    if (!a) return;
    e.preventDefault();
    root.querySelector(a.getAttribute('href')!)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  // highlight the chapter being read
  const links = [...toc.querySelectorAll('a')];
  const io = new IntersectionObserver(
    (es) => es.forEach((en) => { if (en.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === '#' + en.target.id)); }),
    { root, rootMargin: '-30% 0px -60% 0px' },
  );
  root.querySelectorAll('section').forEach((s) => io.observe(s));
  return () => io.disconnect();
};

export default mount;
