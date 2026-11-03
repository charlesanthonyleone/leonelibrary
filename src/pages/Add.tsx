import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCatalog, langName, type CatEntry } from '../lib/books';
import { useStored } from '../lib/store';

type D = [number, string, string, string, number];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const VOTE_THRESHOLD = 10;

export default function Add() {
  const [all, setAll] = useState<D[] | null>(null);
  const [q, setQ] = useState('');
  const [mine, setMine] = useStored<number[]>('requests', []);
  const [cat, setCat] = useState<CatEntry[]>([]);
  useEffect(() => { getCatalog().then(setCat).catch(() => {}); }, []);
  const owned = useMemo(() => { const t = norm(q).split(/\s+/).filter(w => w.length > 1); if (!t.length) return []; return cat.filter(b => { const s = norm(b.title + ' ' + b.author); return t.every(w => s.includes(w)); }).sort((a, b) => b.downloads - a.downloads).slice(0, 4); }, [cat, q]);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data/discover.json`).then(r => r.json()).then(setAll).catch(() => setAll([])); }, []);
  const hits = useMemo(() => { if (!all) return []; const t = norm(q).split(/\s+/).filter(Boolean); if (!t.length) return all.slice(0, 30);
    return all.filter(d => { const s = norm(d[1] + ' ' + d[2]); return t.every(w => s.includes(w)); }).slice(0, 60); }, [all, q]);
  return (
    <div className="page">
      <div className="eyebrow">Add a book</div>
      <h1 className="display">Ask for a book</h1>
      <p className="lede">These {all ? all.length.toLocaleString() : '…'} titles are public domain worldwide but not on our shelves yet. Requesting one tells us what readers want; books are only added after their full text is imported and checked for completeness.</p>
      <input className="fx-in big" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by title or author" aria-label="Search books to request" />
      <p className="note glass small" role="note"><b>Honest note:</b> your requests are saved only in this browser, on this device. They are not sent anywhere yet, so no one else sees them and there is no shared vote count today. When Leone accounts launch they can be counted toward a {VOTE_THRESHOLD}-reader threshold. Clearing your browser data erases them. Only complete, verified texts are ever added; nothing here is readable until it is.</p>
      {owned.length > 0 && <section aria-label="Already in the Library"><h2 className="h5">Already on our shelves</h2><ul className="req-list">{owned.map(b => <li key={b.id} className="glass"><div><b>{b.title}</b><div className="small muted">{b.author}</div></div><Link className="btn sm gold" to={`/read?id=${b.id}`}>Read now</Link></li>)}</ul></section>}
      {mine.length > 0 && <p className="small muted" role="status">You've requested {mine.length} {mine.length === 1 ? 'book' : 'books'}.</p>}
      {owned.length > 0 && hits.length > 0 && <h2 className="h5">Not yet hosted</h2>}
      <ul className="req-list">{hits.map(d => { const on = mine.includes(d[0]); return (
        <li key={d[0]} className="glass"><div><b>{d[1]}</b><div className="small muted">{d[2]} · {langName(d[3])}</div></div>
          <button className={`btn sm ${on ? 'ghost' : 'gold'}`} onClick={() => setMine(on ? mine.filter(x => x !== d[0]) : [...mine, d[0]])}>{on ? '✓ Requested' : 'Request'}</button></li>); })}</ul>
      {all && q && !hits.length && !owned.length && <p className="muted">No public-domain match. If the book is still under copyright somewhere (an author who died after 1955), we can't host it. <Link to="/rights">How we decide</Link></p>}
    </div>
  );
}
