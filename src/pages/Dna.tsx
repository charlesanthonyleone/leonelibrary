import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getHosted, getCatalog, type HostedBook, type CatEntry } from '../lib/books';
import { bookDna, DNA_UNSUPPORTED, type Dna } from '../lib/dna';

const level = (e: number) => e >= 80 ? 'very easy' : e >= 70 ? 'easy' : e >= 60 ? 'plain English' : e >= 50 ? 'fairly difficult' : e >= 30 ? 'difficult' : 'very difficult';
export default function DnaPage() {
  const [sp, setSp] = useSearchParams(); const id = Number(sp.get('id')); const vs = Number(sp.get('vs') || 0);
  const [b, setB] = useState<HostedBook | null>(null); const [d, setD] = useState<Dna | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { getHosted(id).then(h => { setB(h); setTimeout(() => setD(bookDna(h)), 0); }).catch(() => setErr(true)); }, [id]);
  const [v, setV] = useState<{ b: HostedBook; d: Dna } | null>(null);
  useEffect(() => { setV(null); if (vs) getHosted(vs).then(h => setV({ b: h, d: bookDna(h) })).catch(() => setV(null)); }, [vs]);
  if (b && DNA_UNSUPPORTED.has(b.lang)) return <div className="page"><div className="eyebrow">Book DNA</div><h1 className="display">{b.title}</h1><p className="lede">Book DNA counts words and sentences, and this book's language is not written with spaces between words, so the figures would be wrong. It is not shown rather than guessed.</p><Link className="btn gold" to={`/read?id=${id}`}>Read the book</Link></div>;
  if (err) return <div className="page"><h1 className="display">Book not found</h1><Link to="/library">Back to the Library</Link></div>;
  if (!b || !d) return <div className="page"><p className="muted" role="status">Reading the whole book to measure it…</p></div>;
  const maxW = Math.max(...d.chapterWords), C = b.chapters.length;
  return (
    <div className="page dna">
      <div className="eyebrow">Book DNA</div>
      <h1 className="display">{b.title}</h1>
      <p className="lede">{b.author}. Every figure below is counted from the complete hosted text in your browser just now.</p>
      <div className="dna-stats">
        {[['Words', d.words.toLocaleString()], ['Distinct words', d.unique.toLocaleString()], ['Sentences', d.sentences.toLocaleString()], ['Words per sentence', d.avgSentence.toFixed(1)], ['Letters per word', d.avgWord.toFixed(2)], ['In dialogue', Math.round(d.dialogue * 100) + '%'], ['Reading time', `${Math.round(d.words / 250 / 60 * 10) / 10} h at 250 wpm`], ...(d.ease != null ? [['Flesch reading ease', `${d.ease.toFixed(0)} (${level(d.ease)})`]] : [])].map(([k, v]) => <div key={k} className="glass"><div className="small muted">{k}</div><b>{v}</b></div>)}
      </div>
      <Compare id={id} a={{ b, d }} v={v} vs={vs} set={n => { const p = new URLSearchParams(sp); if (n) p.set('vs', String(n)); else p.delete('vs'); setSp(p); }} />
      <h2>Shape of the book</h2>
      <p className="small muted">Words in each of the {C} chapters. Select a bar to read it.</p>
      <div className="dna-bars">{d.chapterWords.map((w, i) => <Link key={i} to={`/read?id=${id}&ch=${i}`} title={`${b.chapters[i].t}: ${w.toLocaleString()} words`} aria-label={`${b.chapters[i].t}, ${w} words`} style={{ height: `${Math.max(3, (w / maxW) * 100)}%` }} />)}</div>
      {b.lang === 'de' && <p className="small muted">The story map is not drawn for German, where every noun is capitalised and names can't be told apart from them.</p>}
      {d.names.length > 0 && <><h2>Story map</h2>
        <p className="small muted">The most frequent capitalised names that never appear in lower case, and where in the book each one appears. Darker means more mentions in that chapter.</p>
        <div className="story-map" style={{ gridTemplateColumns: `9rem repeat(${C}, 1fr)` }}>
          {d.names.map(n => { const mx = Math.max(...n.per); return [<div key={n.name} className="sm-name">{n.name} <span className="muted small">{n.count}</span></div>,
            ...n.per.map((x, i) => <div key={n.name + i} className="sm-cell" title={`${n.name}: ${x} in ${b.chapters[i].t}`} style={{ opacity: x ? 0.18 + 0.82 * (x / mx) : 0.04 }} />)]; })}
        </div></>}
      <h2>Signature vocabulary</h2>
      <p className="tag-cloud">{d.topWords.map(([w, n]) => <span key={w} title={`${n} times`} style={{ fontSize: `${0.85 + 0.9 * (n / d.topWords[0][1])}rem` }}>{w} </span>)}</p>
      <h2>Longest sentence</h2>
      <blockquote className="glass" style={{ padding: '1rem 1.2rem' }}>{d.longest} <div className="small muted">{(d.longest.match(/\S+/g) ?? []).length} words</div></blockquote>
      <p><Link className="btn gold" to={`/read?id=${id}`}>Read the book</Link> <Link className="btn ghost" to={`/book?id=${id}`}>Book page</Link></p>
    </div>
  );
}

function Compare({ id, a, v, vs, set }: { id: number; a: { b: HostedBook; d: Dna }; v: { b: HostedBook; d: Dna } | null; vs: number; set: (n: number) => void }) {
  const [q, setQ] = useState(''); const [cat, setCat] = useState<CatEntry[]>([]);
  useEffect(() => { getCatalog().then(setCat); }, []);
  const opts = q.trim().length < 2 ? [] : cat.filter(c => c.id !== id && (c.title + ' ' + c.author).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const rows: [string, (d: Dna) => string][] = [['Words', d => d.words.toLocaleString()], ['Distinct words', d => d.unique.toLocaleString()], ['Words per sentence', d => d.avgSentence.toFixed(1)], ['Letters per word', d => d.avgWord.toFixed(2)], ['In dialogue', d => Math.round(d.dialogue * 100) + '%'], ['Flesch reading ease', d => d.ease == null ? '—' : d.ease.toFixed(0)], ['Chapters', d => String(d.chapterWords.length)]];
  return <section className="dna-compare">
    <h2>Compare with another book</h2>
    {!vs && <div className="cmp-pick"><input className="fx-in" value={q} onChange={e => setQ(e.target.value)} placeholder="Title or author" aria-label="Find a book to compare" />
      {opts.length > 0 && <ul className="cmp-opts">{opts.map(o => <li key={o.id}><button onClick={() => { set(o.id); setQ(''); }}>{o.title} <span className="muted small">{o.author}</span></button></li>)}</ul>}</div>}
    {vs > 0 && !v && <p className="muted" role="status">Reading the second book…</p>}
    {v && <><table className="cmp-table"><thead><tr><th></th><th>{a.b.title}</th><th><Link to={`/dna?id=${vs}`}>{v.b.title}</Link></th></tr></thead>
      <tbody>{rows.map(([k, f]) => <tr key={k}><th scope="row">{k}</th><td>{f(a.d)}</td><td>{f(v.d)}</td></tr>)}</tbody></table>
      <button className="btn ghost sm" onClick={() => set(0)}>Clear comparison</button></>}
  </section>;
}
