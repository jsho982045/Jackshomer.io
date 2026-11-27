/**
 * Visitor analytics via Umami Cloud (free Hobby plan): cookieless, no personal
 * data, no consent banner needed. It only loads when VITE_UMAMI_WEBSITE_ID is set
 * at build time and only counts visits on jackshomer.io (not localhost).
 */
type Umami = { track: (name?: string | object, data?: Record<string, string | number | boolean>) => void };
const ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;

export function initAnalytics() {
  if (!ID) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.dataset.websiteId = ID;
  s.dataset.domains = 'jackshomer.io';
  document.head.append(s);

  // the links people actually use, counted from one listener (works for hand-mode clicks too)
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (href.endsWith('.pdf')) track('resume-download');
    else if (href.startsWith('mailto:')) track('email-click');
    else if (href.includes('linkedin.com')) track('linkedin-click');
    else if (href.includes('github.com')) track('github-click');
    else if (/^https?:/.test(href) && !href.includes('jackshomer.io')) track('project-open', { site: new URL(href).host + new URL(href).pathname.replace(/\/$/, '') });
  }, { capture: true });
}

export function track(name: string, data?: Record<string, string | number | boolean>) {
  try { (window as unknown as { umami?: Umami }).umami?.track(name, data); } catch { /* never let analytics break the site */ }
}
