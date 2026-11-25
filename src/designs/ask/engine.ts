import { jack } from '../../content/jack';

/**
 * A small, fully local question answerer. It only knows about Jack.
 * Questions are normalised, matched against weighted keyword intents (with
 * typo tolerance), and answered from content/jack.ts. Two strong intents in
 * one question get a combined answer.
 *
 * To swap in a real model later, replace `answer()` with a fetch to a
 * server function that is given the same facts; the UI does not change.
 */

type Intent = { id: string; keys: Record<string, number>; reply: () => string };

const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const emailLine = () => (jack.email ? `You can email him at [${jack.email}](mailto:${jack.email}).` : `He hasn't put an email on the site yet; the best way to reach him right now is through [GitHub](${jack.github}).`);

const INTENTS: Intent[] = [
  { id: 'hello', keys: { hi: 2, hello: 2, hey: 2, yo: 1, sup: 1, morning: 1 }, reply: () => `Hi! I can answer questions about ${jack.first}: his work, background, projects or how to reach him. What would you like to know?` },
  { id: 'who', keys: { who: 2, jack: 0.5, about: 1, yourself: 1, introduce: 2, summary: 2, tldr: 2, bio: 2 }, reply: () => `${jack.name} is a software engineer in ${jack.location}. He's the **${jack.role}** at **${jack.company}** (${jack.companyAbout}), where he leads ${jack.team}. He has ${jack.yearsExperience} of professional experience and studied ${jack.study} at ${jack.school}.` },
  { id: 'role', keys: { role: 3, job: 3, title: 3, position: 3, do: 1, does: 1, current: 2, currently: 2, now: 1, profession: 3, occupation: 3 }, reply: () => `He's the **${jack.role}** at ${jack.company}, working as a ${jack.title}. He has been there since ${jack.since} and leads ${jack.team}.` },
  { id: 'company', keys: { work: 2, works: 2, working: 2, company: 3, employer: 3, urbanlogic: 4, where: 1 }, reply: () => `He works at **${jack.company}**, ${jack.companyAbout}. He was the first hire there and is now the ${jack.role}, leading ${jack.team}.` },
  { id: 'school', keys: { school: 3, college: 3, university: 3, study: 3, studied: 3, degree: 3, education: 3, major: 3, graduate: 2, graduated: 2, brooklyn: 0.5 }, reply: () => `He studied **${jack.study}** at **${jack.school}**, ${jack.schoolYears}. Before that he taught himself to code with free online courses during Covid.` },
  { id: 'email', keys: { email: 4, mail: 3, contact: 3, reach: 3, touch: 2, message: 1, hire: 1 }, reply: () => (jack.email ? `${emailLine()} His code lives at [github.com/${jack.githubHandle}](${jack.github}).` : emailLine()) },
  { id: 'phone', keys: { phone: 4, number: 2, call: 3, text: 1, cell: 3, mobile: 2 }, reply: () => (jack.phone ? `His number is ${jack.phone}.` : `He doesn't share a phone number publicly. ${emailLine()}`) },
  { id: 'location', keys: { live: 3, lives: 3, based: 3, location: 3, from: 2, city: 2, nyc: 2, york: 1, brooklyn: 2 }, reply: () => `He's from and based in **${jack.location}**, and knows its neighbourhoods very well.` },
  { id: 'experience', keys: { experience: 3, years: 3, long: 1, senior: 2, junior: 2 }, reply: () => `He has ${jack.yearsExperience} of professional engineering experience, plus earlier work as a data analyst during college.` },
  { id: 'stack', keys: { stack: 4, tech: 3, technologies: 3, skills: 3, languages: 3, language: 3, framework: 3, frameworks: 3, tools: 2, react: 3, typescript: 3, node: 2, gcp: 3, cloud: 2, frontend: 1, backend: 1 }, reply: () => `His day-to-day stack: ${list(jack.stack)}. He's a full-stack engineer with a soft spot for interactive, physical-feeling interfaces.` },
  { id: 'projects', keys: { projects: 4, project: 4, built: 2, build: 2, side: 2, portfolio: 2, made: 1, railway: 3, oneart: 3, arcadia: 3 }, reply: () => `A few of his side projects:\n${jack.projects.map((p) => `- **${p.name}**: ${p.blurb}`).join('\n')}` },
  { id: 'path', keys: { background: 4, career: 4, history: 3, before: 4.5, previous: 3, previously: 3, path: 3, journey: 3, start: 2, started: 2, napyork: 3, nap: 2 }, reply: () => `His path so far:\n${jack.path.map((p) => `- ${p.what}`).join('\n')}` },
  { id: 'teaching', keys: { teach: 3, taught: 3, teaching: 3, kids: 3, children: 3, autistic: 3, autism: 3, abc: 2 }, reply: () => `For about a year and a half he taught coding to autistic children and did technical consulting for the parent company, Applied ABC.` },
  { id: 'team', keys: { team: 3, lead: 3, leads: 3, manage: 3, manager: 3, management: 3, leadership: 3 }, reply: () => `At ${jack.company} he leads ${jack.team}, as well as building a lot of the product himself.` },
  { id: 'github', keys: { github: 4, code: 2, repo: 2, repos: 2, open: 1, source: 1 }, reply: () => `His GitHub is [github.com/${jack.githubHandle}](${jack.github}).` },
  { id: 'site', keys: { site: 3, website: 3, this: 1, built: 1, how: 1, made: 1 }, reply: () => `This site is six designs of the same portfolio, each one physical in a different way. It's built with Vite and TypeScript, no UI framework, with hand-written physics (cloth, soft bodies, paper) and three.js for the cabin. Each design loads only when you open it.` },
];

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'his', 'he', 'him', 'jack', 'jacks', 'shomer', 'what', 'whats', 'does', 'did', 'to', 'of', 'in', 'at', 'for', 'me', 'tell', 'can', 'you', 'please', 'and', 'or', 'on', 'i', 'it', 'do', 'go', 'went', 'with']);
const SYN: Record<string, string> = { mail: 'email', 'e-mail': 'email', uni: 'university', job: 'role', employer: 'company', skillset: 'skills', cv: 'background', resume: 'background', 'résumé': 'background', where: 'where', number: 'number' };

function norm(q: string) {
  return q
    .toLowerCase()
    .replace(/nap york/g, 'napyork')
    .replace(/one art/g, 'oneart')
    .replace(/[^a-z0-9\s@.-]/g, ' ')
    .split(/\s+/)
    .map((w) => SYN[w] ?? w)
    .filter((w) => w && !STOP.has(w));
}

/** true if a and b are within one edit (for typos like "collge", "emial") */
function near(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } // transposition
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function answer(q: string): string {
  const words = norm(q);
  const raw = q.toLowerCase();
  const scored = INTENTS.map((it) => {
    let s = 0;
    for (const w of words) {
      if (it.keys[w] !== undefined) s += it.keys[w];
      else for (const k in it.keys) if (near(w, k)) { s += it.keys[k] * 0.8; break; }
    }
    return { it, s };
  });
  scored.sort((a, b) => b.s - a.s);

  // phrasings the plain keywords miss: boost, don't short-circuit, so two-part questions still work
  const boost = (id: string, n: number) => { const e = scored.find((x) => x.it.id === id)!; e.s += n; };
  if (/where (does|did|do) (he|jack|you) (go to )?(school|college|study)/.test(raw)) boost('school', 3);
  if (/where (does|is|do) (he|jack|you) work/.test(raw)) boost('company', 3);
  scored.sort((x, y) => y.s - x.s);

  const [a, b] = scored;
  if (!a || a.s < 1.5) {
    return `I only know about ${jack.first}, so I can't help with that one. Try asking about his current role, where he works, where he studied, his projects or how to contact him.`;
  }
  if (b && b.s >= 2.5 && b.s >= a.s * 0.6 && a.it.id !== 'hello' && b.it.id !== 'hello') return `${a.it.reply()}\n\n${b.it.reply()}`;
  return a.it.reply();
}

export const SUGGESTIONS = ["What's his current role?", 'Where does he work?', 'Where did he go to school?', 'How can I contact him?', 'What has he built?'];
