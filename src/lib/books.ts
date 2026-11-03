export type Person = { name: string; birth_year: number | null; death_year: number | null };
export type Book = {
  id: number; title: string; authors: Person[]; languages: string[]; subjects?: string[];
  summaries?: string[]; bookshelves?: string[]; words?: number; chapterCount?: number; formats: Record<string, string>; download_count?: number; copyright?: boolean | null;
};
export type Page = { count: number; next: string | null; results: Book[] };

const BASE = import.meta.env.BASE_URL;
import { assetFetch, assetUrl, localKey } from './assets';
import { chapterTitle, migrateSaved } from './chapters';
/** Catalogue entry: only books whose complete text is hosted on Leone Library are listed. */
export type CatEntry = { id: number; title: string; author: string; authors: Person[]; lang: string[]; subjects: string[]; shelves: string[]; downloads: number; cover: boolean; words: number; chapters: number };
let catalog: Promise<CatEntry[]> | null = null;
/** Library of Congress class codes (PR, PS, V…) that Gutenberg lists among subjects; not real subjects. */
export const isShelfCode = (s: string) => /^[A-Z]{1,3}$/.test(s.trim());
export const topSubject = (s: string) => s.split(' -- ')[0].replace(/\s*\(.*?\)\s*$/, '').trim();
/** Books sharing the most top-level subjects and shelves with `id`, from real catalogue metadata only. */
export function similarBooks(cat: CatEntry[], id: number, n = 8): CatEntry[] {
  const me = cat.find(c => c.id === id); if (!me) return [];
  const subs = new Set(me.subjects.map(topSubject)), shelves = new Set(me.shelves);
  const meA = me.authors.map(a => a.name);
  return cat.filter(c => c.id !== id).map(c => { let sc = 0; new Set(c.subjects.map(topSubject)).forEach(s => { if (subs.has(s)) sc += 2; }); c.shelves.forEach(s => { if (shelves.has(s)) sc += 1; }); if (c.authors.some(a => meA.includes(a.name))) sc += 1; return [c, sc] as const; })
    .filter(x => x[1] >= 2).sort((a, b) => b[1] - a[1] || b[0].downloads - a[0].downloads).slice(0, n).map(x => x[0]);
}
export function getCatalog() {
  catalog ??= fetch(`${BASE}data/catalog.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  catalog.catch(() => { catalog = null; });
  return catalog;
}
export const toBook = (c: CatEntry): Book => ({ id: c.id, title: c.title, authors: c.authors, languages: c.lang, subjects: c.subjects, bookshelves: c.shelves, download_count: c.downloads, copyright: false, formats: c.cover ? { 'image/jpeg': assetUrl(`covers/${c.id}.jpg`) } : {}, words: c.words, chapterCount: c.chapters });
/** Compatibility shim for older callers: the whole hosted catalogue. */
export async function getSnapshot(): Promise<Page & { bundled: number[] }> {
  const c = await getCatalog();
  return { count: c.length, next: null, results: c.map(toBook), bundled: c.map(x => x.id) };
}
export async function isBundled(id: number) { return (await getCatalog()).some(c => c.id === id); }

export const LANGS: Record<string, string> = { en: 'English', fr: 'French', de: 'German', ru: 'Russian', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', fi: 'Finnish', zh: 'Chinese', la: 'Latin', el: 'Greek', sv: 'Swedish', ja: 'Japanese', pl: 'Polish', da: 'Danish', hu: 'Hungarian', eo: 'Esperanto' };
export const langName = (c: string) => LANGS[c] ?? c.toUpperCase();

export async function getBook(id: number): Promise<Book> {
  if (id < 0) { const h = await getHosted(id); return { id, title: h.title, authors: [{ name: h.author, birth_year: null, death_year: null }], languages: [h.lang], formats: {}, words: h.words, chapterCount: h.chapters.length, copyright: null }; }
  const hit = (await getCatalog()).find(b => b.id === id);
  if (!hit) throw new Error('This book is not in the Library.');
  return toBook(hit);
}

export const cover = (b: Book) => b.formats['image/jpeg'];
/** "Tolstoy, Leo, graf" → "Leo Tolstoy"; "Doyle, Arthur Conan" → "Arthur Conan Doyle". Lower-case titles (graf, freiherr) and parenthesised full names are dropped; Jr./Sr. kept. */
export const personName = (n: string) => { const p = n.replace(/\s*\(.*\)\s*$/, '').split(/,\s*/).filter(Boolean); if (p.length < 2) return p[0] ?? n;
  const suf = p.slice(2).filter(x => /^(Jr\.?|Sr\.?|[IVX]+)$/.test(x)); return [p[1], p[0], ...suf].join(' '); };
export const author = (b: Book) => (b.authors[0] ? personName(b.authors[0].name) : 'Anonymous');

/** Rights/provenance tag. US PD rule for 2026: first published 1930 or earlier. */
export type Rights = { tag: string; tone: 'ok' | 'check' | 'no'; detail: string };
export const PD_DEATH_CUTOFF = new Date().getFullYear() - 71; // life+70: author died 1955 or earlier (2026)
export function rightsFor(b: Book): Rights {
  if (b.id < 0) return { tag: 'Private import', tone: 'check', detail: 'Your own DRM-free file. It stays in this browser and is never uploaded or shared.' };
  const ds = b.authors.map(a => a.death_year).filter((y): y is number => y != null);
  const last = ds.length ? Math.max(...ds) : null;
  return { tag: 'Public domain worldwide', tone: 'ok', detail: `${last ? `Author died ${last}, more than 70 years ago (life+70 rule), ` : ''}and first published before 1931 (US rule). Listed only because both checks pass.` };
}

export type Chapter = { title: string; paras: string[]; group?: string };
/** Strip the Gutenberg licence wrapper and split into chapters. */
export function parseText(raw: string): { front: string; chapters: Chapter[] } {
  let t = raw.replace(/\r\n/g, '\n');
  const s = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (s >= 0) t = t.slice(t.indexOf('\n', s) + 1);
  const e = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (e >= 0) t = t.slice(0, e);
  t = t.replace(/\[Illustration[^\]]*\]/gi, "").replace(/\[Copyright[^\]]*\]/gi, "");
  const junk = /^(produced by|transcriber|e-?text prepared|this e-?book|updated editions|release date|language:|character set|credits?:|most recently updated|\*\*\*)/i;
  let blocks = t.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').replace(/_([^_]+)_/g, '$1').trim()).filter(b => b && !junk.test(b));
  // edition front matter (printer, publisher addresses, plate lists): drop short lines before the first real paragraph or heading
  const first = blocks.findIndex(b => b.length > 220 || (b.length < 90 && /^(CHAPTER|Chapter|PREFACE|Preface|INTRODUCTION|Introduction|LETTER|STAVE|BOOK|PART)\b|^[IVXLC]{1,7}\.?$/.test(b)));
  if (first > 0) blocks = blocks.slice(first);
  const head = /^(CHAPTER|Chapter|CHAP\.|BOOK|Book|LETTER|Letter|STAVE|PART|Part|ACT|Act|ГЛАВА|Глава|KAPITEL|Kapitel|CHAPITRE|Chapitre|[IVXLC]{1,7}\.?)(\s|$)[^.]{0,80}$/;
  const chapters: Chapter[] = [];
  let cur: Chapter = { title: 'Opening', paras: [] };
  for (const b of blocks) {
    if (b.length < 90 && head.test(b)) {
      if (cur.paras.length) chapters.push(cur);
      cur = { title: b, paras: [] };
    } else cur.paras.push(b);
  }
  if (cur.paras.length) chapters.push(cur);
  // Fallback: no headings found (or tiny TOC chapters) — chunk evenly.
  const real = chapters.filter(c => c.paras.length > 3);
  if (real.length < 2) {
    const all = chapters.flatMap(c => c.paras); const out: Chapter[] = [];
    for (let i = 0; i < all.length; i += 120) out.push({ title: `Part ${out.length + 1}`, paras: all.slice(i, i + 120) });
    return { front: '', chapters: out };
  }
  const front = chapters[0].title === 'Opening' ? chapters[0].paras.slice(0, 6).join(' · ') : '';
  return { front, chapters: real };
}

export type HostedBook = { id: number; title: string; author: string; lang: string; words: number; source: string; sha: string; chapters: { t: string; p: string[]; g?: string }[]; v?: number; remap?: [number, number][] };
const bookCache = new Map<number, Promise<HostedBook>>();
/** Complete, cleaned text hosted on Leone Library (gzip JSON, decompressed in the browser). */
export function getHosted(id: number): Promise<HostedBook> {
  if (!bookCache.has(id)) {
    bookCache.set(id, (async () => {
      if (id < 0) { const b = await (await import('./private')).privateGet(id); if (!b) throw new Error('not-hosted'); return b; }
      const rp = assetFetch(`books/${id}.json.gz`); rp.catch(() => {}); // fetch the text while the catalogue confirms it's hosted
      if (!(await isBundled(id))) throw new Error('not-hosted');
      const read = async (r: Response) => { if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
        const enc = r.headers.get('content-encoding');
        return JSON.parse(enc && enc.includes('gzip') ? await r.text() : await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text()) as HostedBook; };
      let b = await read(await rp);
      // A browser or offline copy from before a re-split: the catalogue knows the current chapter count, so fetch fresh.
      const want = (await getCatalog()).find(c => c.id === id)?.chapters;
      if (want && want !== b.chapters.length) {
        try { const r2 = await fetch(assetUrl(`books/${id}.json.gz`), { cache: 'reload' }); const keep = r2.clone(); const fresh = await read(r2);
          if (fresh.chapters.length !== b.chapters.length) { b = fresh;
            if (await isOffline(id)) void caches.open(BOOKS_CACHE).then(c => c.put(localKey(`books/${id}.json.gz`), keep)).catch(() => {}); } } catch { /* keep the copy we have */ }
      }
      migrateSaved(b); return b;
    })());
    bookCache.get(id)!.catch(() => bookCache.delete(id));
  }
  return bookCache.get(id)!;
}
/** Raw JSON text of a hosted book (for fast pre-filtering in search). */
export async function getHostedRaw(id: number): Promise<string> {
  const r = await assetFetch(`books/${id}.json.gz`); if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
  const enc = r.headers.get('content-encoding'); return enc && enc.includes('gzip') ? r.text() : new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
}
export async function getChapters(id: number): Promise<Chapter[]> {
  return (await getHosted(id)).chapters.map(c => ({ title: chapterTitle(c.t), paras: c.p, group: c.g && chapterTitle(c.g) }));
}
/** Plain text of the whole book (title + chapters), for tools that want a string. */
export async function getText(id: number): Promise<string> {
  const h = await getHosted(id);
  return h.chapters.map(c => `${chapterTitle(c.t)}\n\n${c.p.join('\n\n')}`).join('\n\n');
}


/* ---- offline library ---- */
const BOOKS_CACHE = 'leone-books';
const bookPaths = (id: number) => [`books/${id}.json.gz`, `covers/${id}.jpg`];
const bookUrls = (id: number) => bookPaths(id).map(localKey);
export async function isOffline(id: number) { if (!('caches' in window)) return false; const c = await caches.open(BOOKS_CACHE); return !!(await c.match(bookUrls(id)[0])); }
export async function keepOffline(id: number) { const c = await caches.open(BOOKS_CACHE); const [b, cv] = bookPaths(id);
  const r = await assetFetch(b); if (!r.ok) throw new Error(`HTTP ${r.status}`); await c.put(localKey(b), r.clone());
  await assetFetch(cv).then(x => x.ok ? c.put(localKey(cv), x) : undefined).catch(() => {}); }
export async function dropOffline(id: number) { const c = await caches.open(BOOKS_CACHE); await Promise.all(bookUrls(id).map(u => c.delete(u))); }
export async function offlineIds(): Promise<number[]> { if (!('caches' in window)) return []; const c = await caches.open(BOOKS_CACHE); return (await c.keys()).map(r => r.url.match(/books\/(\d+)\.json\.gz/)?.[1]).filter(Boolean).map(Number); }
