// Parsers for reading-history files the reader exports from other services. Everything stays on this device.
export type Clip = { title: string; author: string; text: string; note?: string; loc?: string; at?: number };
/** Kindle "My Clippings.txt": entries separated by ==========. */
export function parseClippings(raw: string): Clip[] {
  const out: Clip[] = []; const notes: Clip[] = [];
  for (const e of raw.replace(/^\uFEFF/, '').split(/\r?\n==========\r?\n?/)) {
    const lines = e.split(/\r?\n/).map(l => l.trim()); while (lines.length && !lines[0]) lines.shift();
    if (lines.length < 3) continue;
    const m = lines[0].replace(/^\uFEFF/, '').match(/^(.*?)\s*\(([^()]*)\)\s*$/), title = (m ? m[1] : lines[0]).trim(), author = m ? m[2].trim() : '';
    const info = lines[1], text = lines.slice(2).join(' ').trim(); if (!text) continue;
    const loc = info.match(/(?:location|Location|page|Page|Position|Emplacement|Seite)\s*([\d-]+)/)?.[1], d = Date.parse(info.split(/\|\s*(?:Added on|Ajouté le|Hinzugefügt am)\s*/)[1] || '');
    const c: Clip = { title, author, text, loc, at: isNaN(d) ? undefined : d };
    if (/\bNote\b|\bNotiz\b/i.test(info.split('|')[0])) notes.push(c); else if (!/Bookmark|Lesezeichen|Signet/i.test(info.split('|')[0])) out.push(c);
  }
  for (const n of notes) { const h = out.find(c => c.title === n.title && c.loc && n.loc && c.loc.split('-').pop() === n.loc.split('-').pop()); if (h) h.note = n.text; else out.push({ ...n, note: n.text, text: '' }); }
  return out;
}
export type ReadRow = { title: string; author: string; shelf: string; rating: number; dateRead?: string; isbn?: string };
function csv(raw: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], f = '', q = false;
  for (let i = 0; i < raw.length; i++) { const c = raw[i];
    if (q) { if (c === '"' && raw[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && raw[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); } return rows;
}
/** Goodreads "Export Library" CSV. */
export function parseGoodreads(raw: string): ReadRow[] {
  const [h, ...rows] = csv(raw.replace(/^\uFEFF/, '')); if (!h) return [];
  const ix = (n: string) => h.findIndex(x => x.trim().toLowerCase() === n);
  const T = ix('title'), A = ix('author'), S = ix('exclusive shelf'), R = ix('my rating'), D = ix('date read'), I = ix('isbn13');
  if (T < 0) throw new Error('This does not look like a Goodreads export (no Title column).');
  return rows.filter(r => r[T]).map(r => ({ title: r[T].trim(), author: (r[A] || '').trim(), shelf: (r[S] || '').trim() || 'read', rating: Number(r[R]) || 0, dateRead: r[D] || undefined, isbn: (r[I] || '').replace(/[="]/g, '') || undefined }));
}
/** Loose title match against the hosted catalogue (exact normalised title + author surname). */
export const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)|[:;].*$/g, '').replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
