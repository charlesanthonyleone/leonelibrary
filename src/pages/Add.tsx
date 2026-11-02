import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { langName } from '../lib/books';
import { useStored } from '../lib/store';

type D = [number, string, string, string, number];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const VOTE_THRESHOLD = 10;

export default function Add() {
  const [all, setAll] = useState<D[] | null>(null);
  const [q, setQ] = useState('');
  const [mine, setMine] = useStored<number[]>('requests', []);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data/discover.json`).then(r => r.json()).then(setAll).catch(() => setAll([])); }, []);
  const hits = useMemo(() => { if (!all) return []; const t = norm(q).split(/\s+/).filter(Boolean); if (!t.length) return all.slice(0, 30);
    return all.filter(d => { const s = norm(d[1] + ' ' + d[2]); return t.every(w => s.includes(w)); }).slice(0, 60); }, [all, q]);
  return (
    <div className="page">
      <div className="eyebrow">Add a book</div>
      <h1 className="display">Ask for a book</h1>
      <p className="lede">These {all ? all.length.toLocaleString() : '…'} titles are public domain worldwide but not on our shelves yet. Request one: when {VOTE_THRESHOLD} readers ask for it, it's imported, checked for completeness and added to the Library.</p>
      <input className="fx-in big" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by title or author" aria-label="Search books to request" />
      <p className="small muted">Requests are saved on this device now and counted toward the {VOTE_THRESHOLD}-vote threshold when Leone accounts launch. Only complete, verified texts are ever added; nothing here is readable until it is.</p>
      <ul className="req-list">{hits.map(d => { const on = mine.includes(d[0]); return (
        <li key={d[0]} className="glass"><div><b>{d[1]}</b><div className="small muted">{d[2]} · {langName(d[3])}</div></div>
          <button className={`btn sm ${on ? 'ghost' : 'gold'}`} onClick={() => setMine(on ? mine.filter(x => x !== d[0]) : [...mine, d[0]])}>{on ? '✓ Requested' : 'Request'}</button></li>); })}</ul>
      {all && q && !hits.length && <p className="muted">No public-domain match. If the book is still under copyright somewhere (an author who died after 1955), we can't host it. <Link to="/rights">How we decide</Link></p>}
    </div>
  );
}
