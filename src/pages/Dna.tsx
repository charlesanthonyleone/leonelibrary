import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getHosted, type HostedBook } from '../lib/books';
import { bookDna, type Dna } from '../lib/dna';

const level = (e: number) => e >= 80 ? 'very easy' : e >= 70 ? 'easy' : e >= 60 ? 'plain English' : e >= 50 ? 'fairly difficult' : e >= 30 ? 'difficult' : 'very difficult';
export default function DnaPage() {
  const [sp] = useSearchParams(); const id = Number(sp.get('id'));
  const [b, setB] = useState<HostedBook | null>(null); const [d, setD] = useState<Dna | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { getHosted(id).then(h => { setB(h); setTimeout(() => setD(bookDna(h)), 0); }).catch(() => setErr(true)); }, [id]);
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
      <h2>Shape of the book</h2>
      <p className="small muted">Words in each of the {C} chapters. Select a bar to read it.</p>
      <div className="dna-bars" role="list">{d.chapterWords.map((w, i) => <Link role="listitem" key={i} to={`/read?id=${id}&ch=${i}`} title={`${b.chapters[i].t}: ${w.toLocaleString()} words`} aria-label={`${b.chapters[i].t}, ${w} words`} style={{ height: `${Math.max(3, (w / maxW) * 100)}%` }} />)}</div>
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
