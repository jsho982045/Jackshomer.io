// Single source of truth for everything the site says about Jack.
// Every design and the Ask chatbot read from here, so edit facts once.
// Fields left empty ('') are hidden everywhere until filled in.

export const jack = {
  name: 'Jack Shomer',
  first: 'Jack',
  headline: 'Software engineer in Brooklyn who builds web things that feel physical.',
  role: 'Founding Engineer',
  title: 'Senior Full-Stack Engineer',
  company: 'UrbanLogic',
  companyAbout: 'a real estate platform',
  since: 'July 2025',
  team: 'a team of two engineers',
  location: 'Brooklyn, New York',
  yearsExperience: 'about three years',
  school: 'Brooklyn College',
  study: 'Computer Science',
  schoolYears: '2021 to 2024',
  // Contact. Anything filled in here becomes public on the site.
  email: 'jackshomer98@gmail.com',
  phone: '',
  site: 'https://jackshomer.io',
  github: 'https://github.com/jsho982045',
  githubHandle: 'jsho982045',
  linkedin: '',
  stack: ['React', 'TypeScript', 'Node.js', 'Google Cloud (GCP)', 'three.js', 'Canvas & WebGL'],
  path: [
    { when: 'Covid', what: 'Taught himself to code with free online courses' },
    { when: 'College', what: 'Data analyst at a large wholesale apparel company (about 2 years)' },
    { when: '~1.5 yrs', what: 'Taught coding to autistic children and did technical consulting for Applied ABC' },
    { when: 'Nap York', what: 'Started as an intern, became lead frontend engineer' },
    { when: '2025', what: 'First hire and founding engineer at UrbanLogic' },
  ],
  projects: [
    { name: 'Shomer Valley Railway', blurb: 'An explorable 3D miniature railway world.' },
    { name: 'OneArt', blurb: 'One shared real-time canvas; everyone paints, and the final piece goes to the people who made it.' },
    { name: 'Arcadia', blurb: 'A modern browser arcade in the spirit of the old Flash game sites.' },
  ],
} as const;

export type Jack = typeof jack;
