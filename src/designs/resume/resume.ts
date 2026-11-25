import '@fontsource-variable/newsreader';
import './resume.css';
import { jack, jobs, resumeBullets } from '../../content/jack';
import type { Mount } from '../registry';

/** Fast facts for a reviewer in a hurry, then the full résumé (which also prints / exports to PDF). */
const DL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>`;

const mount: Mount = (root) => {
  root.className = 'design d-resume';
  const linkedinShort = jack.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  root.innerHTML = `
    <div class="wrap">
      <dl class="facts" aria-label="Fast facts">
        <div><dt>Now</dt><dd>${jack.role}, ${jack.company}</dd></div>
        <div><dt>Experience</dt><dd>~3 yrs engineering · 2.5 yrs data</dd></div>
        <div><dt>Core stack</dt><dd>Laravel · React · TypeScript · Node</dd></div>
        <div><dt>Based in</dt><dd>${jack.location}</dd></div>
      </dl>
      <div class="actions">
        <a class="primary" href="/Jack_Shomer_Resume.pdf" download>${DL} Download PDF</a>
        <a href="mailto:${jack.email}">${jack.email}</a>
        <a href="${jack.linkedin}" target="_blank" rel="noopener">LinkedIn</a>
        <a href="/story">The story behind it</a>
      </div>
      <article class="sheet">
        <h1>${jack.name}<small>Software Engineer</small></h1>
        <div class="contact"><span>${jack.location}</span><a href="mailto:${jack.email}">${jack.email}</a><a href="${jack.site}">jackshomer.io</a><a href="${jack.linkedin}">${linkedinShort}</a><a href="${jack.github}">github.com/${jack.githubHandle}</a></div>
        <h2>Overview</h2>
        <p class="summary">Full-stack engineer and founding engineer at ${jack.company}, leading ${jack.team}. Ships end to end, from schema to production, and has built with AI-assisted tooling since the week ChatGPT launched.</p>
        <h2>Experience</h2>
        ${jobs
          .map(
            (j) => `<section class="job"><header><span><b>${j.company}</b> · <span class="t">${j.title}</span></span><time>${j.when}${j.where ? ' · ' + j.where : ''}</time></header>
            <ul>${(resumeBullets[j.company] ?? [j.summary]).map((b) => `<li>${b}</li>`).join('')}</ul></section>`,
          )
          .join('')}
        <h2>Skills</h2>
        <dl class="skills">
          <dt>Languages</dt><dd>${jack.skills.languages.join(', ')}</dd>
          <dt>Frameworks</dt><dd>${jack.skills.frameworks.join(', ')}</dd>
          <dt>Data</dt><dd>${jack.skills.data.join(', ')}</dd>
          <dt>Cloud & DevOps</dt><dd>${jack.skills.cloud.join(', ')}</dd>
          <dt>Tools</dt><dd>${jack.skills.tools.join(', ')}</dd>
          <dt>AI tooling</dt><dd>${jack.skills.ai.join(', ')}</dd>
        </dl>
        <h2>Education</h2>
        <section class="job"><header><span><b>${jack.school}</b> · <span class="t">${jack.study}</span></span><time>${jack.schoolDates} · Brooklyn</time></header>
          <ul><li>Coursework: ${jack.coursework.join(', ')}.</li></ul></section>
      </article>
    </div>`;
  return () => {};
};

export default mount;
