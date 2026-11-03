// Per-page <title>, description, canonical and Open Graph tags (SPA has one index.html).
const SITE = 'Leone Library';
const ORIGIN = 'https://library.leoneuniversity.org';
const DEF_DESC = 'A free index of public-domain books you can read, translate, remix and publish through Leone Publishing.';
const TITLES: Record<string, string> = {
  '/': 'Leone Library — the Library of Leone University', '/library': 'Browse the Library', '/search': 'Search', '/shelf': 'My shelf',
  '/plans': 'Plans', '/account': 'Account', '/studio': 'Studio', '/publishing': 'Leone Publishing', '/rights': 'Rights & public domain',
  '/paths': 'Reading paths', '/dna': 'Book DNA', '/offline': 'Offline books', '/import': 'Import books', '/add': 'Request a book',
  '/classroom': 'Classroom', '/community': 'Community', '/clubs': 'Book clubs', '/goals': 'Reading goals', '/shelves': 'Public shelves',
  '/read': 'Reading', '/design': 'Cover design', '/marketplace': 'Marketplace', '/notes': 'Shared notes', '/export': 'Export',
  '/studio/glossary': 'Glossary', '/studio/collab': 'Collaborative studio', '/studio/translate': 'Translate', '/studio/remix': 'Remix',
  '/studio/continue': 'Continue a story', '/studio/design': 'Cover design', '/publishing/calculator': 'Royalty calculator',
  '/publishing/submit': 'Submit a manuscript', '/publishing/royalties': 'Royalties', '/storefront': 'Storefront',
  '/authors': 'Authors', '/subjects': 'Subjects', '/genre': 'Genres', '/author': 'Author', '/subject': 'Subject',
};
function tag(sel: string, make: () => HTMLElement): HTMLElement { let el = document.head.querySelector<HTMLElement>(sel); if (!el) { el = make(); document.head.appendChild(el); } return el; }
function meta(attr: 'name' | 'property', key: string, val: string) { tag(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }).setAttribute('content', val); }
export function setSeo(o: { title?: string; desc?: string; path?: string; image?: string; jsonld?: object | null }) {
  const title = o.title ? (o.title.startsWith(SITE) ? o.title : `${o.title} · ${SITE}`) : TITLES['/'];
  const desc = (o.desc || DEF_DESC).replace(/\s+/g, ' ').slice(0, 300);
  const url = ORIGIN + (o.path ?? location.pathname + location.search);
  document.title = title;
  meta('name', 'description', desc); meta('property', 'og:title', title); meta('property', 'og:description', desc);
  meta('property', 'og:url', url); meta('property', 'og:type', o.jsonld ? 'book' : 'website'); meta('property', 'og:site_name', SITE);
  meta('name', 'twitter:card', o.image ? 'summary_large_image' : 'summary');
  if (o.image) meta('property', 'og:image', new URL(o.image, ORIGIN).href);
  (tag('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }) as HTMLLinkElement).href = url;
  const old = document.getElementById('ld-json'); if (old) old.remove();
  if (o.jsonld) { const s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'ld-json'; s.textContent = JSON.stringify(o.jsonld); document.head.appendChild(s); }
}
/** Every route has an entry in TITLES (scripts/check-titles.mjs enforces it); pages with per-item titles refine it in their own effect. */
export const DYNAMIC = new Set(['/book']);
export function routeSeo(pathname: string) { const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname; if (DYNAMIC.has(p)) return; setSeo({ title: TITLES[p] ?? 'Page not found', path: p }); }
