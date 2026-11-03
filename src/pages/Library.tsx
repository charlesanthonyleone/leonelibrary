import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCatalog, isShelfCode, langName, topSubject, toBook, type CatEntry } from '../lib/books';
import BookCard from '../components/BookCard';

const PER = 48;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Edit distance with an early exit once it passes `max`. */
function lev(a: string, b: string, max: number) { if (Math.abs(a.length - b.length) > max) return max + 1; let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const cur = [i]; let lo = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); lo = Math.min(lo, cur[j]); } if (lo > max) return max + 1; prev = cur; } return prev[b.length]; }
const LEN: Record<string, [number, number, string]> = { short: [0, 40000, 'Short (under 40k words)'], mid: [40000, 120000, 'Novel length'], long: [120000, 1e9, 'Long (120k+ words)'] };

export default function Library() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '', lang = sp.get('lang') ?? '', shelf = sp.get('shelf') ?? '', subj = sp.get('subject') ?? '', len = sp.get('len') ?? '', sort = sp.get('sort') ?? 'popular', page = Number(sp.get('page') ?? 1);
  const [input, setInput] = useState(q);
  const [cat, setCat] = useState<CatEntry[] | null>(null);
  const [catErr, setCatErr] = useState(false); const [tries, setTries] = useState(0);
  useEffect(() => { setCatErr(false); getCatalog().then(setCat).catch(() => { setCatErr(true); setCat([]); }); }, [tries]);
  useEffect(() => setInput(q), [q]);
  const facets = useMemo(() => {
    const L = new Map<string, number>(), S = new Map<string, number>(), J = new Map<string, number>();
    cat?.forEach(c => { c.lang.forEach(l => L.set(l, (L.get(l) ?? 0) + 1)); c.shelves.forEach(s => S.set(s, (S.get(s) ?? 0) + 1)); new Set(c.subjects.filter(x => !isShelfCode(x)).map(topSubject)).forEach(s => J.set(s, (J.get(s) ?? 0) + 1)); });
    return { langs: [...L].sort((a, b) => b[1] - a[1]), shelves: [...S].filter(s => s[1] >= 5).sort((a, b) => a[0].localeCompare(b[0])), subjects: [...J].filter(s => s[1] >= 8).sort((a, b) => a[0].localeCompare(b[0])) };
  }, [cat]);
  const hits = useMemo(() => {
    if (!cat) return [];
    const terms = norm(q).split(/\s+/).filter(Boolean);
    let r = cat.filter(c => (!lang || c.lang.includes(lang)) && (!shelf || c.shelves.includes(shelf)) && (!subj || c.subjects.some(x => topSubject(x) === subj)) && (!len || (c.words >= LEN[len][0] && c.words < LEN[len][1])));
    if (terms.length) {
      const scored = r.map(c => { const t = norm(c.title), a = norm(c.author + ' ' + c.authors.map(x => x.name).join(' ')), s = norm(c.subjects.join(' ') + ' ' + c.shelves.join(' '));
        let sc = 0; for (const w of terms) { if (t.includes(w)) sc += 3; else if (a.includes(w)) sc += 2; else if (s.includes(w)) sc += 1; else return null; } return [c, sc] as const; }).filter(Boolean) as (readonly [CatEntry, number])[];
      r = scored.sort((x, y) => y[1] - x[1] || y[0].downloads - x[0].downloads).map(x => x[0]);
    }
    if (sort === 'title') r = [...r].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'author') r = [...r].sort((a, b) => a.author.localeCompare(b.author));
    else if (sort === 'short') r = [...r].sort((a, b) => a.words - b.words);
    else if (!terms.length) r = [...r].sort((a, b) => b.downloads - a.downloads);
    return r;
  }, [cat, q, lang, shelf, subj, len, sort]);
  // Typo help: "dostoevski" or "sherlok" finds the nearest title or author word in the catalogue.
  const vocab = useMemo(() => { const m = new Map<string, number>(); cat?.forEach(c => norm(c.title + ' ' + c.author + ' ' + c.authors.map(x => x.name).join(' ')).split(/[^\p{L}]+/u).forEach(w => w.length >= 4 && m.set(w, (m.get(w) ?? 0) + c.downloads))); return m; }, [cat]);
  const suggestion = useMemo(() => { if (!cat || hits.length || !q.trim()) return '';
    const fixed = norm(q).split(/\s+/).filter(Boolean).map(w => { if (vocab.has(w) || w.length < 4) return w; const max = w.length >= 7 ? 2 : 1; let best = w, bd = max + 1, bn = 0;
      for (const [v, n] of vocab) { const d = lev(w, v, max); if (d < bd || (d === bd && n > bn)) { best = v; bd = d; bn = n; } } return best; }).join(' ');
    return fixed !== norm(q) ? fixed : ''; }, [cat, hits.length, q, vocab]);
  const go = (p: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(p).forEach(([k, v]) => v ? n.set(k, v) : n.delete(k)); if (!('page' in p)) n.delete('page'); setSp(n); };
  const pages = Math.max(1, Math.ceil(hits.length / PER));
  const shown = hits.slice((page - 1) * PER, page * PER);
  return (
    <div className="page">
      <div className="eyebrow">The Library</div>
      <h1 className="display">The Open Library</h1>
      <p className="lede">{cat ? cat.length.toLocaleString() : '…'} complete public-domain books, every one hosted here in full and readable right now. Want something that isn't here? <Link to="/add">Request it</Link>.</p>
      <form className="searchbar glass" role="search" onSubmit={e => { e.preventDefault(); go({ q: input.trim() }); }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Search titles, authors or subjects: Tolstoy, whales, detective…" aria-label="Search the library" />
        <select value={lang} onChange={e => go({ lang: e.target.value })} aria-label="Language">
          <option value="">All languages</option>
          {facets.langs.map(([k, n]) => <option key={k} value={k}>{langName(k)} ({n})</option>)}
        </select>
        <button className="btn gold">Search</button>
      </form>
      <div className="row gap wrap filters">
        <select className="fx-in" value={shelf} onChange={e => go({ shelf: e.target.value })} aria-label="Shelf"><option value="">All shelves</option>{facets.shelves.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}</select>
        <select className="fx-in" value={subj} onChange={e => go({ subject: e.target.value })} aria-label="Subject"><option value="">All subjects</option>{facets.subjects.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}</select>
        <select className="fx-in" value={len} onChange={e => go({ len: e.target.value })} aria-label="Length"><option value="">Any length</option>{Object.entries(LEN).map(([k, v]) => <option key={k} value={k}>{v[2]}</option>)}</select>
        <select className="fx-in" value={sort} onChange={e => go({ sort: e.target.value === 'popular' ? '' : e.target.value })} aria-label="Sort"><option value="popular">Most read</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option><option value="short">Shortest first</option></select>
        {(q || lang || shelf || subj || len) && <button className="btn ghost sm" onClick={() => { setInput(''); setSp(new URLSearchParams()); }}>Clear</button>}
      </div>
      <div className="status small muted" aria-live="polite">{!cat ? <span><span className="spin" /> Opening the catalogue…</span> : <span>{hits.length.toLocaleString()} book{hits.length === 1 ? '' : 's'}{q && <> for “{q}”</>}{lang && <> in {langName(lang)}</>}{shelf && <> on {shelf}</>}{subj && <> about {subj}</>} · all complete, all free</span>}</div>
      <div className="grid-books">{shown.map(c => <BookCard key={c.id} b={toBook(c)} />)}</div>
      {suggestion && <p className="lede" role="status">Did you mean <button className="link" onClick={() => { setInput(suggestion); go({ q: suggestion }); }}><b>{suggestion}</b></button>?</p>}
      {catErr && <div className="glass" role="alert"><p><b>The catalogue didn't load.</b> Check your connection; books you saved offline are still on <Link to="/offline">your Offline page</Link>.</p><button className="btn sm" onClick={() => { setCat(null); setTries(t => t + 1); }}>Try again</button></div>}
      {cat && !catErr && !hits.length && <p className="muted">Nothing matches yet. Try a shorter word, <button className="link" onClick={() => { setInput(''); setSp(new URLSearchParams()); }}>clear the filters</button>, <Link to={`/search?q=${encodeURIComponent(q)}`}>search inside the texts</Link>, or <Link to="/add">ask for this book</Link>.</p>}
      {pages > 1 && <div className="row gap center pager">
        <button className="btn ghost" disabled={page <= 1} onClick={() => { go({ page: String(page - 1) }); window.scrollTo(0, 0); }}>← Previous</button>
        <span className="muted">Page {page} of {pages}</span>
        <button className="btn ghost" disabled={page >= pages} onClick={() => { go({ page: String(page + 1) }); window.scrollTo(0, 0); }}>Next →</button>
      </div>}
    </div>
  );
}
