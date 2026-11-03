import { load, save, type Highlight } from './store';
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const STARTER = [
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' }, { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' }, { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker' }, { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { id: 2701, title: 'Moby Dick', author: 'Herman Melville' }, { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
  { id: 1513, title: 'Romeo and Juliet', author: 'William Shakespeare' }, { id: 1260, title: 'Jane Eyre', author: 'Charlotte Brontë' },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens' }, { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: 1400, title: 'Great Expectations', author: 'Charles Dickens' }, { id: 768, title: 'Wuthering Heights', author: 'Emily Brontë' },
  { id: 1184, title: 'The Count of Monte Cristo', author: 'Alexandre Dumas' }, { id: 2600, title: 'War and Peace', author: 'Leo Tolstoy' },
  { id: 1399, title: 'Anna Karenina', author: 'Leo Tolstoy' }, { id: 158, title: 'Emma', author: 'Jane Austen' },
  { id: 161, title: 'Sense and Sensibility', author: 'Jane Austen' }, { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman' },
  { id: 120, title: 'Treasure Island', author: 'Robert Louis Stevenson' }, { id: 43, title: 'Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson' },
  { id: 36, title: 'The War of the Worlds', author: 'H. G. Wells' }, { id: 35, title: 'The Time Machine', author: 'H. G. Wells' },
  { id: 1080, title: 'A Modest Proposal', author: 'Jonathan Swift' }, { id: 829, title: "Gulliver's Travels", author: 'Jonathan Swift' },
  { id: 4300, title: 'Ulysses', author: 'James Joyce' },
  { id: 1232, title: 'The Prince', author: 'Niccolò Machiavelli' }, { id: 205, title: 'Walden', author: 'Henry David Thoreau' },
];
export function logReading(min: number) { const l = load<Record<string, number>>('readlog', {}); const k = today(); save('readlog', { ...l, [k]: (l[k] || 0) + min }); }
export const shareNotesLink = (id: number, title: string, who: string, hl: Highlight[]) => `${location.origin}${import.meta.env.BASE_URL}notes#n=${btoa(unescape(encodeURIComponent(JSON.stringify({ id, title, who, hl })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

/** Per-book reading statistics on this device: minutes and words read (from page turns), plus words read per day for a reading speed. */
export type BookStat = { min: number; words: number; last: number };
export type ReadStats = { books: Record<string, BookStat>; words: Record<string, number> };
export const readStats = () => load<ReadStats>('readstats', { books: {}, words: {} });
export function logBook(id: number, min: number, words: number) {
  if (!(id > 0) || (!min && !words)) return; const s = readStats(); const b = s.books[id] ?? { min: 0, words: 0, last: 0 }; const k = today();
  save('readstats', { books: { ...s.books, [id]: { min: b.min + min, words: b.words + words, last: Date.now() } }, words: words ? { ...s.words, [k]: (s.words[k] || 0) + words } : s.words });
}
/** Words per minute measured from this device's own page turns; null until there is enough to say. */
export function readingSpeed(): number | null {
  const s = readStats(); let w = 0, m = 0; for (const b of Object.values(s.books)) { w += b.words; m += b.min; }
  return m >= 3 && w >= 500 ? Math.max(80, Math.min(700, Math.round(w / m))) : null;
}
const NL = '\n';
/** Highlights, notes and bookmarks as Markdown or JSON, for download. */
export function notesExport(fmt: 'md' | 'json', o: { id: number; title: string; author: string; hl: Highlight[]; marks: { chapter: number; para: number; label: string; at: number }[]; chapterName: (c: number) => string }) {
  const hs = [...o.hl].sort((a, b) => a.chapter - b.chapter || (a.para ?? 0) - (b.para ?? 0)); const ms = [...o.marks].sort((a, b) => a.chapter - b.chapter || a.para - b.para);
  const link = (c: number, p?: number) => `${location.origin}${import.meta.env.BASE_URL}read?id=${o.id}&ch=${c}${p != null ? `#p${p}` : ''}`;
  if (fmt === 'json') return JSON.stringify({ format: 'leone-library-notes/1', exported: new Date().toISOString(), book: { id: o.id, title: o.title, author: o.author },
    highlights: hs.map(h => ({ chapter: h.chapter, chapterTitle: o.chapterName(h.chapter), para: h.para ?? null, text: h.text, note: h.note ?? null, created: new Date(h.at).toISOString(), link: link(h.chapter, h.para) })),
    bookmarks: ms.map(m => ({ chapter: m.chapter, chapterTitle: o.chapterName(m.chapter), para: m.para, excerpt: m.label, created: new Date(m.at).toISOString(), link: link(m.chapter, m.para) })) }, null, 2);
  const out = [`# ${o.title}`, `*${o.author}*`, '', `Exported from Leone Library on ${new Date().toLocaleDateString()} · ${hs.length} highlight${hs.length === 1 ? '' : 's'}, ${hs.filter(h => h.note).length} note${hs.filter(h => h.note).length === 1 ? '' : 's'}, ${ms.length} bookmark${ms.length === 1 ? '' : 's'}`, ''];
  let cur = -1; if (hs.length) out.push('## Highlights & notes', '');
  for (const h of hs) { if (h.chapter !== cur) { cur = h.chapter; out.push(`### ${o.chapterName(h.chapter)}`, ''); }
    out.push(...h.text.split(/\n+/).map(l => `> ${l}`), ''); if (h.note) out.push(`**Note:** ${h.note}`, ''); out.push(`<sub>[Open in reader](${link(h.chapter, h.para)}) · ${new Date(h.at).toLocaleDateString()}</sub>`, ''); }
  if (ms.length) { out.push('## Bookmarks', ''); for (const m of ms) out.push(`- [${o.chapterName(m.chapter)}](${link(m.chapter, m.para)}): ${m.label}…`); out.push(''); }
  return out.join(NL);
}
export function download(name: string, body: string, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
