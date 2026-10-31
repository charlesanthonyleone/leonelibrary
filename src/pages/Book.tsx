import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { author, cover, getBook, langName, rightsFor, type Book } from '../lib/books';
import { GenCover, RightsTag, hueOf, Soon } from '../components/ui';
import { load, useProjects, useShelf, type Edit } from '../lib/store';

export function Provenance({ b }: { b: Book }) {
  const r = rightsFor(b);
  const edits = load<Edit[]>(`edits:${b.id}`, []);
  return (
    <div className="prov glass">
      <h3>Rights &amp; provenance</h3>
      <dl>
        <dt>Status</dt><dd><RightsTag r={r} /><div className="small muted">{r.detail}</div></dd>
        <dt>Source</dt><dd><a href={`https://www.gutenberg.org/ebooks/${b.id}`} target="_blank" rel="noreferrer">Project Gutenberg #{b.id}</a> via Gutendex</dd>
        <dt>Rule applied</dt><dd>US public domain: first published 1930 or earlier (as of 2026). Translations are made from the PD original, never from a later, possibly protected translation.</dd>
        <dt>Change log</dt><dd>{edits.length ? `${edits.length} local edit${edits.length > 1 ? 's' : ''} (latest ${new Date(Math.max(...edits.map(e => e.at))).toLocaleDateString()})` : 'Unaltered source text.'}</dd>
        <dt>AI tools used</dt><dd>None.</dd>
      </dl>
    </div>
  );
}

export default function BookPage() {
  const [sp] = useSearchParams();
  const id = Number(sp.get('id'));
  const [b, setB] = useState<Book | null>(null);
  const [err, setErr] = useState('');
  const [shelf, setShelf] = useShelf();
  const [projects] = useProjects();
  const [bad, setBad] = useState(false);
  useEffect(() => { let live = true; setB(null); setErr(''); getBook(id).then(x => { if (live) setB(x); }).catch(e => { if (live) setErr(String(e.message ?? e)); }); return () => { live = false; }; }, [id]);
  if (!id) return <div className="page"><h1 className="display">No book selected</h1><Link to="/library">Browse the Library</Link></div>;
  if (err) return <div className="page"><h1 className="display">Couldn't load this book</h1><p className="muted">{err}</p><Link className="btn ghost" to="/library">Back to the Library</Link></div>;
  if (!b) return <div className="page"><p className="muted"><span className="spin" /> Fetching from Gutenberg…</p></div>;
  const on = shelf.some(s => s.id === b.id);
  const derived = projects.filter(p => String(p.sourceId) === String(b.id));
  return (
    <div className="page book-page">
      <div className="book-hero">
        <div className="book-cover-lg">{cover(b) && !bad ? <img src={cover(b)} alt="" onError={() => setBad(true)} /> : <GenCover title={b.title} author={author(b)} hue={hueOf(b.title)} />}</div>
        <div>
          <div className="eyebrow">{b.languages.map(langName).join(' · ')} · Gutenberg #{b.id}</div>
          <h1 className="display">{b.title}</h1>
          <p className="by">by {b.authors.map(a => `${a.name}${a.birth_year ? ` (${a.birth_year}–${a.death_year ?? ''})` : ''}`).join(', ') || 'Anonymous'}</p>
          <RightsTag r={rightsFor(b)} />
          {b.summaries?.[0] && <p className="summary">{b.summaries[0].replace(/\s*\(This is an automatically generated summary\.\)/, '')}</p>}
          <div className="row gap wrap">
            <Link className="btn gold" to={`/read?id=${b.id}`}>Read now</Link>
            <button className="btn ghost" onClick={() => setShelf(on ? shelf.filter(s => s.id !== b.id) : [...shelf, { id: b.id, title: b.title, author: author(b), cover: cover(b), lang: b.languages[0], addedAt: Date.now() }])}>{on ? '✓ On your shelf' : '+ Add to shelf'}</button>
            <Link className="btn ghost" to={`/studio/translate?id=${b.id}`}>Translate</Link>
            <Link className="btn ghost" to={`/studio/remix?id=${b.id}`}>Remix</Link>
            <Link className="btn ghost" to={`/studio/continue?id=${b.id}`}>Continue</Link>
          </div>
          {b.subjects && <div className="chips">{b.subjects.slice(0, 6).map(s => <span className="chip" key={s}>{s.split(' -- ')[0]}</span>)}</div>}
        </div>
      </div>
      <div className="two-col">
        <Provenance b={b} />
        <div className="glass prov">
          <h3>Editions &amp; series</h3>
          <ul className="editions">
            <li><span className="ed-dot orig" /> <b>Original</b> · {b.title.split(/[;:]/)[0]} ({b.languages.map(langName).join(', ')})</li>
            {derived.map(p => <li key={p.id}><span className="ed-dot" /> <b>{p.kind[0].toUpperCase() + p.kind.slice(1)}</b> · {p.title} <span className="muted small">· draft, awaiting AI engine</span></li>)}
            {!derived.length && <li className="muted small">No remixes or translations yet. Start one in the Studio and it will link back here.</li>}
          </ul>
          <p className="small muted">Audiobook edition <Soon /></p>
        </div>
      </div>
    </div>
  );
}
