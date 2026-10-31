export type Person = { name: string; birth_year: number | null; death_year: number | null };
export type Book = {
  id: number; title: string; authors: Person[]; languages: string[]; subjects?: string[];
  summaries?: string[]; formats: Record<string, string>; download_count?: number; copyright?: boolean | null;
};
export type Page = { count: number; next: string | null; results: Book[] };

const BASE = import.meta.env.BASE_URL;
let snapshot: Promise<Page & { bundled: number[] }> | null = null;
export function getSnapshot() {
  snapshot ??= fetch(`${BASE}data/popular.json`).then(r => r.json());
  return snapshot;
}
export async function isBundled(id: number) { return (await getSnapshot()).bundled.includes(id); }

async function withTimeout(url: string, ms: number, signal?: AbortSignal) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  signal?.addEventListener('abort', () => ctl.abort());
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r; }
  finally { clearTimeout(t); }
}

export const LANGS: Record<string, string> = { en: 'English', fr: 'French', de: 'German', ru: 'Russian', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', fi: 'Finnish', zh: 'Chinese', la: 'Latin', el: 'Greek', sv: 'Swedish', ja: 'Japanese', pl: 'Polish', da: 'Danish', hu: 'Hungarian', eo: 'Esperanto' };
export const langName = (c: string) => LANGS[c] ?? c.toUpperCase();

/** Live Gutendex search. Gutendex can be slow, so callers show the bundled snapshot meanwhile. */
export async function searchBooks(q: { search?: string; lang?: string; topic?: string; page?: number }, signal?: AbortSignal): Promise<Page> {
  const p = new URLSearchParams();
  if (q.search) p.set('search', q.search);
  if (q.lang) p.set('languages', q.lang);
  if (q.topic) p.set('topic', q.topic);
  if (q.page && q.page > 1) p.set('page', String(q.page));
  p.set('copyright', 'false');
  const r = await withTimeout(`https://gutendex.com/books/?${p}`, 45000, signal);
  return r.json();
}

export async function getBook(id: number): Promise<Book> {
  const snap = await getSnapshot();
  const hit = snap.results.find(b => b.id === id);
  if (hit) return hit;
  const r = await withTimeout(`https://gutendex.com/books/${id}`, 45000);
  return r.json();
}

export const cover = (b: Book) => b.formats['image/jpeg'];
export const author = (b: Book) => b.authors[0]?.name.replace(/^([^,]+),\s*(.+?)(\s*\(.*\))?$/, '$2 $1') ?? 'Anonymous';

/** Rights/provenance tag. US PD rule for 2026: first published 1930 or earlier. */
export type Rights = { tag: string; tone: 'ok' | 'check' | 'no'; detail: string };
export function rightsFor(b: Book): Rights {
  if (b.copyright) return { tag: 'Copyright noted', tone: 'no', detail: 'Project Gutenberg flags this edition as carrying copyright. Excluded from remix and publishing.' };
  const a = b.authors[0];
  if (a?.death_year && a.death_year <= 1930) return { tag: 'US Public Domain', tone: 'ok', detail: `Author died ${a.death_year}; every work they published is pre-1931. Source: Project Gutenberg.` };
  return { tag: 'US Public Domain · verify year', tone: 'check', detail: 'Project Gutenberg lists this as public domain in the USA. Confirm the first-publication year is 1930 or earlier before publishing a derivative.' };
}

export type Chapter = { title: string; paras: string[] };
/** Strip the Gutenberg licence wrapper and split into chapters. */
export function parseText(raw: string): { front: string; chapters: Chapter[] } {
  let t = raw.replace(/\r\n/g, '\n');
  const s = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (s >= 0) t = t.slice(t.indexOf('\n', s) + 1);
  const e = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (e >= 0) t = t.slice(0, e);
  t = t.replace(/\[Illustration[^\]]*\]/gi, "").replace(/\[Copyright[^\]]*\]/gi, "");
  const blocks = t.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').replace(/_([^_]+)_/g, '$1').trim()).filter(Boolean);
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

const textCache = new Map<number, Promise<string>>();
/** Bundled same-origin snapshot first; gutenberg.org sends no CORS headers so a live fetch usually fails. */
export function getText(id: number): Promise<string> {
  if (!textCache.has(id)) {
    textCache.set(id, (async () => {
      if (await isBundled(id)) return (await fetch(`${BASE}texts/${id}.txt`)).text();
      const r = await withTimeout(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, 20000);
      return r.text();
    })());
    textCache.get(id)!.catch(() => textCache.delete(id));
  }
  return textCache.get(id)!;
}

/** Russian Wikisource (CORS-enabled MediaWiki API) for PD originals like Dostoevsky. */
export async function wikisourceSearch(lang: string, q: string) {
  const r = await withTimeout(`https://${lang}.wikisource.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=8&format=json&origin=*`, 20000);
  const j = await r.json();
  return (j.query?.search ?? []) as { title: string; wordcount: number; pageid: number }[];
}
export async function wikisourceText(lang: string, title: string) {
  const r = await withTimeout(`https://${lang}.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&origin=*`, 25000);
  const j = await r.json();
  const doc = new DOMParser().parseFromString(j.parse?.text ?? '', 'text/html');
  doc.querySelectorAll('table, .ws-noexport, sup, style, .mw-editsection, .navbox, .ws-header, #headertemplate').forEach(n => n.remove());
  return Array.from(doc.querySelectorAll('p')).map(p => p.textContent?.trim() ?? '').filter(t => t.length > 30);
}
