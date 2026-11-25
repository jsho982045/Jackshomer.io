// Single source of truth for everything the site says about Jack.
// Every design, the story page and the Ask assistant read from here.
// Fields left empty ('') are hidden everywhere until filled in.
// Sources: résumé (2026-11-02) and Jack's own notes (2026-11-25).

export interface Job {
  company: string;
  title: string;
  when: string;
  start: number;
  where: string;
  /** first person, one or two sentences */
  summary: string;
  /** 3–5 words for tight spaces */
  short: string;
  /** de-emphasised roles still appear on the résumé, but not in highlights */
  minor?: boolean;
}

export const jobs: Job[] = [
  {
    company: 'UrbanLogic',
    title: 'Founding Engineer · Senior Full-Stack',
    when: 'Jul 2025 – Present',
    start: 2025,
    where: 'New York',
    summary:
      'First engineering hire at a platform that runs co-op, condo and rental applications for New York buildings from start to finish. I lead a team of four engineers, own features end to end, from spec and schema to tests and production, and ship work that drives revenue and tooling the team relies on every day.',
    short: 'Founding engineer, UrbanLogic',
  },
  {
    company: 'HCleanz',
    title: 'Full-Stack Engineer (Contract)',
    when: 'Feb 2025 – Jun 2026',
    start: 2025,
    where: 'New York City',
    summary:
      'An "Uber for house cleaners". As the sole engineer I built the whole platform, with the first full-stack MVP live in two weeks (Next.js, Node, Express, MongoDB), while working full time at Nap York.',
    short: 'Sole engineer, HCleanz',
  },
  {
    company: 'Nap York',
    title: 'Intern → Lead Frontend Engineer',
    when: 'Jan 2025 – May 2025',
    start: 2025,
    where: 'New York City',
    summary:
      'Nap York runs sleep pods around the city that you can book for a few hours or overnight. I came in as an intern and became lead frontend engineer: the only engineer on three frontend apps. I rebuilt the booking engine (replacing an outside four-person team), launched a self-check-in app integrated with AWS and MEWS, and added Jest coverage everywhere.',
    short: 'Intern → lead frontend, Nap York',
  },
  {
    company: 'Atidaynu Our Future School',
    title: 'Coding Teacher',
    when: 'Sep 2023 – Nov 2024',
    start: 2023,
    where: 'Brooklyn',
    summary: 'Taught coding and computer skills to students with autism, with adaptive, hands-on lessons, while still in college.',
    short: 'Coding teacher, Atidaynu',
  },
  {
    company: 'AppliedABC',
    title: 'Software Engineer / Technical Consultant',
    when: 'Sep 2023 – Nov 2024',
    start: 2023,
    where: 'Brooklyn',
    summary: 'Technical consulting and software work for the parent organisation of the school group.',
    short: 'Technical consultant, AppliedABC',
    minor: true,
  },
  {
    company: 'Adjmi Apparel',
    title: 'Data Analyst',
    when: 'Jan 2021 – Aug 2023',
    start: 2021,
    where: 'New York City',
    summary:
      'Data analyst at a major wholesale apparel company behind licensed brands like Champion, FILA and IZOD, doing around $500M a year. My analysis saved about $1M in costs.',
    short: 'Data analyst, Adjmi Apparel',
  },
];

/** Résumé bullets (from the 2026-11-02 résumé, lightly edited). Keyed by company. */
export const resumeBullets: Record<string, string[]> = {
  UrbanLogic: [
    'Recruited as the founding engineer; lead a team of four engineers through standups, code review, PR approvals and Jira planning.',
    'Own production features end to end: technical specs, schema design, full-stack implementation, automated tests and deployment.',
    'Work directly with the founders to turn business goals into technical requirements, architecture and roadmaps.',
    'Build and scale a live platform serving thousands of users with PHP/Laravel REST APIs and React, on Heroku, AWS (S3, Lambda), Google Cloud and PostgreSQL.',
    'Set up multi-tier staging environments and automated and manual testing for zero-downtime releases.',
    'Use AI-assisted tooling (Cursor, Claude Code, Gemini) daily for scoping, test generation, debugging, refactoring and review.',
  ],
  HCleanz: ['Sole engineer on an “Uber for house cleaners”: built the full-stack booking platform MVP in two weeks with Next.js, Node.js, Express and MongoDB, alongside a full-time role.'],
  'Nap York': [
    'Started as an intern; became lead frontend engineer and sole engineer on three core frontend apps.',
    'Rebuilt the main booking engine, replacing an external four-person team, and launched an AWS/MEWS-integrated self-check-in app.',
    'Turned 10,000+ lines of legacy email code into modular MJML templates and added Jest unit and integration coverage.',
  ],
  'Atidaynu Our Future School': ['Taught coding and computer skills to students with autism using adaptive, hands-on methods.'],
  AppliedABC: ['Aligned technical goals with business strategy alongside leadership; delivered software for a large school network and improved CI/CD.'],
  'Adjmi Apparel': ['Analyzed sales and operations data for a $500M+ global wholesale apparel company; insights saved about $1M in costs.'],
};

export const ai = {
  /** the proof: Jack's group-chat message, four days after ChatGPT launched */
  proofImage: '/story/chatgpt-2022-12-04.webp',
  proofDate: 'December 4, 2022',
  launchDate: 'November 30, 2022',
  launchSource: 'https://openai.com/index/chatgpt/',
  tools: ['Cursor', 'Claude Code', 'Amp', 'Gemini', 'ChatGPT', 'Linear', 'Notion', 'Playwright', 'Sentry'],
  line: 'AI is going to be to programming what the calculator was to math.',
};

export interface Chapter { id: string; title: string; when: string; body: string[] }

/** The story, in Jack's voice. Shown in full on /story, summarised elsewhere. */
export const story: Chapter[] = [
  {
    id: 'curiosity',
    title: 'It started with curiosity',
    when: '2020',
    body: [
      'When Covid sent everyone home, I started taking free online courses in whatever caught my eye: psychology, philosophy, anthropology, the study of elephants, even the study of death. Then I found Harvard’s CS50 with David J. Malan, and I was hooked. Programming felt like magic.',
      'I’d always wanted to make something. And when I looked around, almost every invention that shaped modern life was software: Google, YouTube, Facebook, Instagram, Twitter, PayPal, Venmo, Uber, LinkedIn. The list goes on and on. If Leonardo da Vinci were alive today, I think he’d be writing software. That was where I wanted to be.',
    ],
  },
  {
    id: 'long-route',
    title: 'The long route in',
    when: '2021 – 2023',
    body: [
      'Breaking into software was hard. I had no experience and no connections, so I took the long way around. I started as a data analyst at Adjmi Apparel, a major wholesale apparel company behind licensed brands like Champion, FILA and IZOD, doing around $500 million a year. My analysis saved the company about $1M. It was a serious job at a serious company, but it wasn’t the dream, so I enrolled in Computer Science at Brooklyn College and kept going.',
    ],
  },
  {
    id: 'teaching',
    title: 'Teaching what I was still learning',
    when: '2023 – 2024',
    body: [
      'While still in school, I got creative and took a job teaching coding to students with autism. Again, it was two things at once, and I made both work.',
      'Teaching gave me skills that engineering alone wouldn’t have: explaining things clearly, organising my thoughts, patience, and working with all kinds of people and personalities. It also made my foundations rock solid, because you can’t teach something you don’t fully understand.',
    ],
  },
  {
    id: 'knocking',
    title: 'Knocking on doors',
    when: '2024',
    body: [
      'I was happy teaching, but I still wanted to be an engineer. So I applied everywhere, and I networked. I spent hours a day finding software engineers at companies I admired and asking if they’d get on a call. About seven out of ten never answered. Of the ones who did, maybe one in three actually got on the phone. But those few calls made all of it worth it.',
      'Along the way I got offers for other kinds of roles, and I turned them down. I wanted to build software, and I wasn’t going to settle.',
    ],
  },
  {
    id: 'break',
    title: 'A foot in the door',
    when: '2025',
    body: [
      'My break was Nap York, a startup with sleep pods around the city that people book for a few hours or overnight. I started as an intern, making almost nothing, because the experience was the pay. Within months I was the lead frontend engineer and the only engineer on three apps. I rebuilt the booking engine an outside team of four used to run, and launched a self-check-in app.',
      'At the same time, I took a side contract with HCleanz, a company setting out to be the Uber of house cleaners. As the sole engineer, I built their entire platform. Two jobs, both shipped.',
    ],
  },
  {
    id: 'today',
    title: 'Today',
    when: '2025 – now',
    body: [
      'I joined UrbanLogic as its first engineering hire. It’s a platform that runs co-op, condo and rental applications for New York buildings from start to finish. Today I lead a team of four engineers. I own features from the first spec to production, ship work that drives revenue, build tools the team uses every day, and keep the whole codebase moving.',
    ],
  },
  {
    id: 'ai',
    title: 'On AI since day one',
    when: 'Since Dec 2022',
    body: [
      'OpenAI launched ChatGPT on November 30, 2022. Four days later I was sending it to my friends. While a lot of people were sceptical, I went all in, because I could see that AI was going to be to programming what the calculator was to math.',
      'Since then I’ve gone deep on prompting and on building agents that automate real workflows, and on earning enough trust in them over time that I can rely on their work without second-guessing it. Day to day that means Cursor, Claude Code, Amp, Gemini, Linear, Notion, Playwright and Sentry.',
      'There’s a flip side that I think matters. My first three semesters of computer science came before ChatGPT existed. I learned the fundamentals by hand, and that’s exactly why I can direct AI well and tell when it’s wrong.',
    ],
  },
  {
    id: 'building',
    title: 'Always building',
    when: 'Throughout',
    body: [
      'Through all of it I kept shipping side projects. They started small: a Casio-style piano, Pac-Man from scratch, checkers with an AI opponent, a Hacker News reader styled like an old newspaper. They grew into bigger worlds, like Shomer Valley Railway, an explorable 3D railway with a life-size Manhattan you can drive, and OneArt, a shared real-time canvas. This site is the latest.',
    ],
  },
];

export const jack = {
  name: 'Jack Shomer',
  first: 'Jack',
  headline: 'Full-stack engineer in Brooklyn who builds web things that feel physical.',
  role: 'Founding Engineer',
  title: 'Senior Full-Stack Software Engineer',
  company: 'UrbanLogic',
  companyAbout: 'a platform that runs co-op, condo and rental applications for New York buildings',
  since: 'July 2025',
  team: 'a team of four engineers',
  location: 'Brooklyn, New York',
  yearsExperience: 'about three years',
  school: 'Brooklyn College',
  study: 'Computer Science',
  schoolYears: '2021 to 2024',
  schoolDates: 'Sep 2021 – Dec 2024',
  coursework: ['Data Structures', 'Analysis of Algorithms', 'Operating Systems', 'Large-Scale Web Apps', 'Artificial Intelligence', 'Human-Computer Interaction'],
  // Contact. Anything filled in here becomes public on the site. Phone intentionally not shown.
  email: 'jackshomer98@gmail.com',
  phone: '',
  site: 'https://jackshomer.io',
  github: 'https://github.com/jsho982045',
  githubHandle: 'jsho982045',
  linkedin: 'https://www.linkedin.com/in/jack-shomer-067123266/',
  stack: ['PHP / Laravel', 'React / React Native', 'TypeScript', 'Node.js / Next.js', 'PostgreSQL', 'AWS / Heroku / GCP'],
  skills: {
    languages: ['PHP', 'JavaScript', 'TypeScript', 'Python', 'C++', 'Java', 'C', 'HTML/CSS'],
    frameworks: ['Laravel', 'React', 'React Native', 'Node.js', 'Next.js', 'Express', 'Angular', 'Tailwind CSS', 'Material UI', 'MJML'],
    data: ['PostgreSQL', 'MySQL', 'MongoDB'],
    cloud: ['AWS (S3, Lambda)', 'Heroku', 'Google Cloud', 'Railway', 'Vercel', 'Docker', 'CI/CD'],
    tools: ['Jest', 'Playwright', 'Sentry', 'Stripe', 'Plaid', 'PandaDoc', 'REST APIs', 'Linear', 'Jira'],
    ai: ai.tools,
  },
  origin: 'He got into computer science during Covid, when Harvard’s CS50 hooked him.',
  get path() {
    return [
      { when: '2020', what: 'Found CS50 during Covid and got hooked' },
      ...[...jobs].filter((j) => !j.minor).reverse().map((j) => ({ when: String(j.start), what: `${j.title}, ${j.company}` })),
    ];
  },
  projects: [
    { name: 'Shomer Valley Railway', blurb: 'An explorable 3D railway world: ride trains, walk the towns, drive a life-size Manhattan.', url: 'https://concretejungle.app' },
    { name: 'OneArt', blurb: 'One shared real-time canvas; everyone paints, and the final piece goes to the people who made it.', url: '' },
    { name: 'Arcadia', blurb: 'A modern browser arcade in the spirit of the old Flash game sites.', url: '' },
  ],
  /** early, small projects (the "curiosity cabinet") */
  smallProjects: [
    { name: 'Casio-style virtual piano', url: 'https://concretejungle.app/projects/casio-inspired-piano' },
    { name: 'Pac-Man from scratch', url: 'https://concretejungle.app/projects/pacman-game' },
    { name: 'Checkers with an AI opponent', url: 'https://concretejungle.app/projects/checkers-game' },
    { name: 'Hacker News, vintage newspaper edition', url: 'https://concretejungle.app/projects/news-app' },
    { name: 'AI image generator', url: 'https://concretejungle.app/projects/ai-image-generator' },
    { name: 'Wordle clone', url: 'https://concretejungle.app/projects/wordle-clone' },
  ],
  allProjectsUrl: 'https://concretejungle.app/projects',
};

/** Every project as one list (for shelves): big ones first, then this site, then the early ones. */
const SHORT: Record<string, string> = { 'Shomer Valley Railway': 'Shomer Valley', 'Casio-style virtual piano': 'Piano', 'Pac-Man from scratch': 'Pac-Man', 'Checkers with an AI opponent': 'Checkers', 'Hacker News, vintage newspaper edition': 'HN Gazette', 'AI image generator': 'AI Images', 'Wordle clone': 'Wordle' };
export const shelf: { name: string; label: string; blurb: string; url: string; size: 'big' | 'small' }[] = [
  ...jack.projects.map((p) => ({ ...p, label: SHORT[p.name] ?? p.name, size: 'big' as const })),
  { name: 'jackshomer.io', label: 'This site', blurb: 'This site: six physical designs, real physics, an AI assistant. See /built for how.', url: '/built', size: 'big' },
  ...jack.smallProjects.map((p) => ({ name: p.name, label: SHORT[p.name] ?? p.name, blurb: 'One of the early projects from the Concrete Jungle cabinet.', url: p.url, size: 'small' as const })),
];

export type Jack = typeof jack;
