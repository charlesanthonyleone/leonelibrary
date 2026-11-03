// Whole-catalogue book validator. Runs over every catalogue entry and its hosted book JSON.
// Errors fail the build (exit 1); warnings are reported only.
// Usage: node scripts/validate-books.mjs [booksDir] [catalog.json] [report.json] [covers dir or list file]
import fs from 'fs'; import zlib from 'zlib';
const DIR = process.argv[2] || 'public/books', CAT = process.argv[3] || 'public/data/catalog.json', REP = process.argv[4] || '', COV = process.argv[5] || '';
const covers = !COV ? null : new Set((fs.statSync(COV).isDirectory() ? fs.readdirSync(COV) : fs.readFileSync(COV, 'utf8').split('\n')).map(x => x.trim().replace(/\.\w+$/, '')).filter(Boolean));
const cat = JSON.parse(fs.readFileSync(CAT, 'utf8'));
const BOILER = /project gutenberg|\be-?texts? (was|is) |transcriber'?s note|gutenberg\.org|gutenberg-tm|\*\*\* ?(start|end) of (the|this)|end of (the |this )?project|produced by .{0,80}(distributed proofread|pgdp|online distributed)|pgdp\.net|this e-?book is for the use of anyone|www\.gutenberg/i;
const GARBLE = /\uFFFD|Ã[\u0080-\u00BF©¨¤§¼½¾]|â€[™œ\u009d“”˜]|&(amp|lt|gt|nbsp|quot|#\d+);|<\/?(p|div|span|br|i|b|em)(\s[^>]*)?\/?>|\{\d+\}|\[\d+:\d+\]/;
const JUNK = /(^|\s)0\$(:\d|\s)|^\s*\$\d\$\d/;   // KJV '0$:001:001', '$1$2'
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
const OKT = /^(§\s*\d+( – §\s*\d+)?|[IVXLCDM\d]+( [–-] [IVXLCDM\d]+)?)$/;
const VERSE = /^(\d{1,3}):(\d{1,3})\s/;
const nk = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const wc = s => s.split(/\s+/).filter(Boolean).length + Math.floor((s.match(CJK) || []).length / 2);   // CJK: ~2 chars a word
const shouting = t => { if (/^([A-Z]\.\s*)+[A-Z]?( – ([A-Z]\.\s*)+[A-Z]?)?$/.test(t)) return false; const L = t.replace(/\b[IVXLCDM]+\b/g, '').replace(/[^A-Za-zÀ-ÿ]/g, ''); return L.length >= 4 && L === L.toUpperCase(); };
const counts = {}; const books = []; let errs = 0, warns = 0;
const add = (r, lvl, code, msg) => { r[lvl].push(`${code}: ${msg}`); counts[`${lvl}:${code}`] = (counts[`${lvl}:${code}`] || 0) + 1; };
for (const c of cat) {
  const r = { id: c.id, title: c.title, errors: [], warnings: [] };
  if (covers && !covers.has(String(c.id))) add(r, 'errors', 'missing-cover', 'no cover file');
  const f = `${DIR}/${c.id}.json.gz`;
  if (!fs.existsSync(f)) { add(r, 'errors', 'missing', 'no hosted file'); books.push(r); continue; }
  const b = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  const chs = b.chapters || [];
  if (!chs.length) add(r, 'errors', 'empty-book', 'no chapters');
  // counts
  if (c.chapters !== chs.length) add(r, 'errors', 'count-mismatch', `catalogue says ${c.chapters} chapters, book has ${chs.length}`);
  const words = chs.reduce((a, ch) => a + ch.p.reduce((x, p) => x + wc(p), 0), 0);
  if (Math.abs((b.words || 0) - words) > Math.max(50, words * 0.02)) add(r, 'errors', 'word-mismatch', `book.words ${b.words} vs text ${words}`);
  if (c.words != null && Math.abs(c.words - (b.words || 0)) > Math.max(50, words * 0.02)) add(r, 'errors', 'word-mismatch', `catalogue words ${c.words} vs book ${b.words}`);
  if (words < 1500) add(r, 'errors', 'too-short', `${words} words`);
  // metadata
  if (shouting(b.title || '') || shouting(c.title || '')) add(r, 'errors', 'caps-title', b.title);
  if (/^[^,]+,\s/.test(c.author || '') && !/,\s*(Jr|Sr|Ph\.?D)/.test(c.author)) add(r, 'errors', 'author-format', c.author);
  if (/\(\d{3,4}/.test(c.author || '')) add(r, 'errors', 'author-format', c.author);
  if (b.title !== c.title || b.author !== c.author) add(r, 'errors', 'meta-mismatch', `book "${b.title}" / "${b.author}" vs catalogue "${c.title}" / "${c.author}"`);
  // sections
  const seen = new Map(), seenBody = new Map(); let prevKey = '';
  chs.forEach((ch, i) => {
    const t = ch.t || '', w = ch.p.reduce((x, p) => x + wc(p), 0), where = `#${i + 1} "${t.slice(0, 50)}"`;
    if (!t.trim()) add(r, 'errors', 'untitled', where);
    if (!ch.p.length || w === 0) add(r, 'errors', 'empty-section', where);
    else if (w < 20 && chs.length > 1) add(r, 'warnings', 'tiny-section', `${where} ${w} words`);
    if (shouting(t)) add(r, 'errors', 'caps-title', where);
    if (t.length > 120 || /^pg_?[0-9ivxlcdm½]+/.test(t) || JUNK.test(t) || GARBLE.test(t) || (/^[\W\d_]+$/u.test(t) && !OKT.test(t))) add(r, 'errors', 'broken-title', where);
    if (w > 40000) add(r, 'warnings', 'huge-section', `${where} ${w} words`);
    const key = (ch.g || '') + '|' + nk(t);
    // same title back-to-back = a split/duplication bug; the same title elsewhere in one group (letters 'To Lady Hesketh', 'Footnotes')
    // is only suspicious, so it warns. Repeated *text* (below) is always an error.
    if (nk(t) && key === prevKey) add(r, 'errors', 'duplicate-chapter', `${where} repeats #${i}`);
    else if (nk(t) && seen.has(key) && !/^(part|chapter)\s*\d+$/i.test(t)) add(r, 'warnings', 'repeated-title', `${where} repeats #${seen.get(key) + 1}`);
    seen.set(key, seen.get(key) ?? i); prevKey = key;
    const body = ch.p.slice(0, 3).join(' ').slice(0, 300);
    if (body.length > 80) { const k2 = nk(body); if (seenBody.has(k2)) add(r, 'errors', 'duplicate-chapter', `${where} same text as #${seenBody.get(k2) + 1}`); else seenBody.set(k2, i); }
    let boil = 0, garb = 0, vm = 0, junk = 0; const cn = /^Chapter (\d+)$/.exec(t);
    for (const p of [t, ...ch.p]) {
      if (BOILER.test(p)) boil++;
      if (GARBLE.test(p)) garb++;
      if (JUNK.test(p)) junk++;
      const m = VERSE.exec(p); if (cn && m && +m[1] !== +cn[1]) vm++;
    }
    if (boil) add(r, 'errors', 'boilerplate', `${where} ${boil} paragraph(s)`);
    if (garb) add(r, 'errors', 'garbled', `${where} ${garb} paragraph(s)`);
    if (junk) add(r, 'errors', 'junk-prefix', `${where} ${junk} paragraph(s)`);
    if (vm) add(r, 'errors', 'garbled-verses', `${where} ${vm} verse(s) from another chapter`);
  });
  if (chs.length >= 3 && chs.every(ch => /^Part \d+$/.test(ch.t))) add(r, 'warnings', 'blind-split', 'no structure found, fixed-size parts');
  if (!b.v) add(r, 'errors', 'unversioned', 'no v field');
  errs += r.errors.length; warns += r.warnings.length;
  if (r.errors.length || r.warnings.length) books.push(r);
}
const bad = books.filter(b => b.errors.length).length;
const summary = { books: cat.length, booksWithErrors: bad, booksWithWarnings: books.filter(b => b.warnings.length).length, errors: errs, warnings: warns, counts: Object.fromEntries(Object.entries(counts).sort()) };
if (REP) fs.writeFileSync(REP, JSON.stringify({ summary, books }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const b of books.filter(b => b.errors.length).slice(0, 15)) console.error(b.id, b.title, b.errors.slice(0, 3).join(' | '));
process.exit(errs ? 1 : 0);
