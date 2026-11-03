// Per-page <title>, description, canonical and Open Graph tags (SPA has one index.html).
const SITE = 'Leone Library';
const ORIGIN = 'https://library.leoneuniversity.org';
const DEF_DESC = 'A free index of public-domain books you can read, translate, remix and publish through Leone Publishing.';
const TITLES: Record<string, string> = {
  '/': 'Leone Library — the Library of Leone University', '/library': 'Browse the Library', '/search': 'Search', '/shelf': 'My shelf',
  '/plans': 'Plans', '/account': 'Account', '/studio': 'Studio', '/publishing': 'Leone Publishing', '/rights': 'Rights & public domain',
  '/paths': 'Reading paths', '/dna': 'Book DNA', '/offline': 'Offline books', '/import': 'Import books', '/add': 'Request a book',
  '/classroom': 'Classroom', '/community': 'Community', '/clubs': 'Book clubs', '/goals': 'Reading goals', '/shelves': 'Public shelves',
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
export function routeSeo(pathname: string) { if (pathname === '/book') return; const t = TITLES[pathname]; setSeo({ title: t ?? (pathname === '/read' ? 'Reading' : 'Page not found'), path: pathname }); }
