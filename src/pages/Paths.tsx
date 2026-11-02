import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCatalog, keepOffline, type CatEntry } from '../lib/books';
import { load } from '../lib/store';
import { makeLayout, encodeLayout } from '../lib/layout';

// Reading paths are built from the catalogue itself: each shelf or author, ordered shortest to longest so the path gets steadily more ambitious.
type Path = { key: string; title: string; kind: 'Shelf' | 'Author'; books: CatEntry[] };
const clean = (s: string) => s.replace(/^Browsing:\s*/, '').replace(/^Category:\s*/, '');
function buildPaths(cat: CatEntry[]): Path[] {
  const shelf = new Map<string, CatEntry[]>(), auth = new Map<string, CatEntry[]>();
  for (const c of cat) { for (const s of c.shelves) shelf.set(clean(s), [...(shelf.get(clean(s)) ?? []), c]); if (!/anonymous|unknown|various/i.test(c.author)) auth.set(c.author, [...(auth.get(c.author) ?? []), c]); }
  const mk = (kind: Path['kind']) => ([k, v]: [string, CatEntry[]]): Path => ({ key: `${kind[0]}:${k}`, title: k, kind, books: [...new Map(v.map(b => [b.id, b])).values()].sort((a, b) => a.words - b.words).slice(0, 12) });
  return [...[...shelf].filter(([, v]) => v.length >= 6).map(mk('Shelf')), ...[...auth].filter(([, v]) => v.length >= 5).map(mk('Author'))].sort((a, b) => b.books.length - a.books.length || a.title.localeCompare(b.title));
}
const done = (id: number) => (load<{ book?: number }>(`progress:${id}`, {}).book ?? 0);

export default function Paths() {
  const [cat, setCat] = useState<CatEntry[]>([]); const [sp, setSp] = useSearchParams(); const sel = sp.get('p'); const [f, setF] = useState(''); const [saving, setSaving] = useState('');
  useEffect(() => { getCatalog().then(setCat); }, []); useEffect(() => setSaving(''), [sel]);
  const paths = useMemo(() => buildPaths(cat), [cat]); const cur = paths.find(p => p.key === sel);
  if (cur) { const pct = cur.books.map(b => done(b.id)); const next = cur.books.find((_, i) => pct[i] < 0.98);
    return (
      <div className="page">
        <div className="eyebrow"><Link to="/paths">Reading paths</Link> · {cur.kind}</div>
        <h1 className="display">{cur.title}</h1>
        <p className="lede">{cur.books.length} books, shortest first. {pct.filter(x => x >= 0.98).length} finished.</p>
        <p className="row gap wrap">{next && <Link className="btn gold" to={`/read?id=${next.id}`}>Continue with {next.title}</Link>}
          <button className="btn ghost" disabled={!!saving && saving !== 'done'} onClick={async () => { let n = 0; for (const b of cur.books) { setSaving(`${n}/${cur.books.length}`); await keepOffline(b.id).catch(() => {}); n++; } setSaving('done'); }}>{saving === 'done' ? '✓ Whole path saved offline' : saving ? `Saving ${saving}…` : '⤓ Keep the whole path offline'}</button> <Link className="btn ghost" to={`/shelf#room=${encodeLayout(makeLayout('library', cur.books.map(b => ({ id: b.id, title: b.title, author: b.author })), cur.title))}`}>▦ See this path as a 3D room</Link></p>
        <ol className="path-list">{cur.books.map((b, i) => <li key={b.id} className={`glass ${pct[i] >= 0.98 ? 'done' : ''}`}>
          <span className="path-n" aria-hidden>{pct[i] >= 0.98 ? '✓' : i + 1}</span>
          <div><Link to={`/book?id=${b.id}`}><b>{b.title}</b></Link><div className="small muted">{b.author} · {b.words.toLocaleString()} words · about {Math.max(1, Math.round(b.words / 15000))} h{pct[i] > 0 && pct[i] < 0.98 ? ` · ${Math.round(pct[i] * 100)}% read` : ''}</div></div>
          <Link className="btn sm ghost" to={`/read?id=${b.id}`}>Read</Link></li>)}</ol>
      </div>); }
  const shown = paths.filter(p => !f || p.title.toLowerCase().includes(f.toLowerCase()));
  return (
    <div className="page">
      <div className="eyebrow">Reading paths</div>
      <h1 className="display">Follow a path</h1>
      <p className="lede">Each path is a shelf or an author from the Library, ordered from the shortest book to the longest. Your progress is ticked off as you read.</p>
      <input className="fx-in" value={f} onChange={e => setF(e.target.value)} placeholder="Filter paths" aria-label="Filter paths" />
      <div className="path-grid">{shown.map(p => { const fin = p.books.filter(b => done(b.id) >= 0.98).length; return (
        <button key={p.key} className="glass path-card" onClick={() => setSp({ p: p.key })}><span className="small muted">{p.kind} · {p.books.length} books</span><b>{p.title}</b>
          <span className="small">{p.books.slice(0, 3).map(b => b.title).join(' → ')} …</span>{fin > 0 && <span className="small gold-t">{fin} finished</span>}</button>); })}</div>
    </div>
  );
}
