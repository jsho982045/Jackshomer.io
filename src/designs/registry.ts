// Every design on the site. Each one is a separate chunk (code + CSS + fonts),
// downloaded the first time it is needed, or earlier when its link is hovered.

export type Navigate = (path: string) => void;
export type Mount = (root: HTMLElement, nav: Navigate) => () => void;

export interface DesignMeta {
  id: string;
  path: string;
  name: string;
  blurb: string;
  /** colour scheme of the design, so the dock can match it */
  tone: 'light' | 'dark' | 'auto';
  /** heavy designs are not prefetched in the background */
  heavy?: boolean;
  load: () => Promise<{ default: Mount }>;
}

function memo<T>(fn: () => Promise<T>) {
  let p: Promise<T> | null = null;
  return () => (p ??= fn().catch((e) => ((p = null), Promise.reject(e))));
}

export const designs: DesignMeta[] = [
  { id: 'linen', path: '/linen', name: 'Linen', tone: 'dark', blurb: 'A cross-stitched banner you can pull, cut and tear down to find what is written behind it.', load: memo(() => import('./linen/linen')) },
  { id: 'desk', path: '/desk', name: 'Desk', tone: 'dark', blurb: 'A walnut desk under a lamp. Cards, photos and a résumé folder, all real paper.', load: memo(() => import('./desk/desk')) },
  { id: 'machine', path: '/machine', name: 'Machine', tone: 'dark', blurb: 'The portfolio as a lab instrument. Dial a section, press a key, flip a switch.', load: memo(() => import('./machine/machine')) },
  { id: 'gel', path: '/gel', name: 'Gel', tone: 'light', blurb: 'Every section is a soft-body gummy. Throw them, squash them, tap to open.', load: memo(() => import('./gel/gel')) },
  { id: 'cabin', path: '/cabin', name: 'Cabin', tone: 'dark', heavy: true, blurb: 'A cabin in the woods at dusk. Fire going, rain on the glass, everything on the table is about me.', load: memo(() => import('./cabin/cabin')) },
  { id: 'globe', path: '/globe', name: 'Snow globe', tone: 'dark', heavy: true, blurb: 'A tiny New York under glass. Spin it, shake it, let the snow settle.', load: memo(() => import('./globe/globe')) },
  { id: 'ask', path: '/ask', name: 'Ask', tone: 'auto', blurb: 'A small assistant that only knows one subject: me.', load: memo(() => import('./ask/ask')) },
];

/** Pages that aren't designs: reachable from every design, but not in the [ ] rotation. */
export const pages: DesignMeta[] = [
  { id: 'story', path: '/story', name: 'My story', tone: 'light', blurb: 'The long way in: data analyst to founding engineer.', load: memo(() => import('./story/story')) },
  { id: 'resume', path: '/resume', name: 'Résumé', tone: 'light', blurb: 'Fast facts, the full résumé, and a PDF.', load: memo(() => import('./resume/resume')) },
  { id: 'built', path: '/built', name: 'How it’s built', tone: 'dark', blurb: 'Real numbers and techniques behind this site.', load: memo(() => import('./built/built')) },
];

export const notFound: DesignMeta = { id: 'notfound', path: '', name: 'Not found', tone: 'dark', blurb: '', load: memo(() => import('./notfound/notfound')) };

export const byPath = (p: string) => designs.find((d) => d.path === p) ?? pages.find((d) => d.path === p);
