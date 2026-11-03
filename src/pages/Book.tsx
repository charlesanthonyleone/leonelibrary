import { Link, useSearchParams } from 'react-router-dom';
import { track } from '../lib/leoneid';
import { useEffect, useState } from 'react';
import { author, cover, getCatalog, similarBooks, toBook, topSubject, dropOffline, getBook, getHosted, isOffline, keepOffline, langName, PD_DEATH_CUTOFF, rightsFor, type Book } from '../lib/books';
import { setSeo } from '../lib/seo';
import BookCard from '../components/BookCard';
import { GenCover, RightsTag, hueOf, Soon } from '../components/ui';
import { load, useProjects, useShelf, type Edit } from '../lib/store';

export function Provenance({ b }: { b: Book }) {
  const r = rightsFor(b);
  const edits = load<Edit[]>(`edits:${b.id}`, []);
  return (
    <div className="prov glass">
      <h2 className="h3">Rights &amp; provenance</h2>
      <dl>
        <dt>Status</dt><dd><RightsTag r={r} /><div className="small muted">{r.detail}</div></dd>
        <dt>Source</dt><dd>Public-domain transcription, source eBook #{b.id}. Hosted complete on Leone Library and checked for completeness (start and end of text present, every chapter kept).</dd>
        <dt>Rule applied</dt><dd>Public domain worldwide: every author and translator died in {PD_DEATH_CUTOFF} or earlier (life + 70 years), so the text is free in the US and in life+70 countries alike. Translations are made from the PD original, never from a later, possibly protected translation.</dd>
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
  const [off, setOff] = useState<'no' | 'yes' | 'busy'>('no');
  useEffect(() => { isOffline(id).then(v => setOff(v ? 'yes' : 'no')).catch(() => {}); }, [id]);
  const toggleOff = async () => { setOff('busy'); try { if (off === 'yes') { await dropOffline(id); setOff('no'); } else { await keepOffline(id); setOff('yes'); } } catch { setOff('no'); } };
  useEffect(() => { let live = true; setB(null); setErr(''); getBook(id).then(x => { if (live) setB(x); }).catch(e => { if (live) setErr(String(e.message ?? e)); }); return () => { live = false; }; }, [id]);
  useEffect(() => { if (!b) return; const by = author(b); setSeo({ title: `${b.title}${by ? ` by ${by}` : ''}`, desc: b.summaries?.[0]?.replace(/\s*\(This is an automatically generated summary\.\)/, '') || `Read ${b.title}${by ? ` by ${by}` : ''} free on Leone Library — public domain, with natural narration.`, path: `/book?id=${b.id}`, image: cover(b) || undefined, jsonld: { '@context': 'https://schema.org', '@type': 'Book', name: b.title, author: b.authors.map(a => ({ '@type': 'Person', name: a.name })), inLanguage: b.languages, isAccessibleForFree: true, license: 'https://creativecommons.org/publicdomain/mark/1.0/', url: `https://library.leoneuniversity.org/book?id=${b.id}`, ...(b.words ? { numberOfPages: Math.round(b.words / 275) } : {}) } }); }, [b]);
  if (!id) return <div className="page"><h1 className="display">No book selected</h1><Link to="/library">Browse the Library</Link></div>;
  if (err) { const missing = /not in the Library/.test(err); return <div className="page" role="alert"><h1 className="display">{missing ? 'This book isn’t in the Library' : 'Couldn’t load this book'}</h1><p className="muted">{missing ? `No book has the number ${sp.get('id')}. The link may be mistyped or the book was never added.` : 'The catalogue didn’t answer. Check your connection and try again.'}</p><div className="row gap wrap">{!missing && <button className="btn gold" onClick={() => location.reload()}>Try again</button>}<Link className="btn ghost" to="/library">Browse the Library</Link>{missing && <Link className="btn ghost" to="/add">Request a book</Link>}</div></div>; }
  if (!b) return <div className="page"><p className="muted"><span className="spin" /> Opening the book…</p></div>;
  const on = shelf.some(s => s.id === b.id);
  const derived = projects.filter(p => String(p.sourceId) === String(b.id));
  return (
    <div className="page book-page">
      <div className="book-hero">
        <div className="book-cover-lg">{cover(b) && !bad ? <img src={cover(b)} alt={`Cover of ${b.title}`} width={300} height={450} decoding="async" fetchpriority="high" onError={() => setBad(true)} /> : <GenCover title={b.title} author={author(b)} hue={hueOf(b.title)} />}</div>
        <div>
          <div className="eyebrow">{b.languages.map(langName).join(' · ')} {b.words ? ` · ${Math.round(b.words / 1000)}k words · ${b.chapterCount} chapters · about ${Math.max(1, Math.round(b.words / 250 / 60))} h` : ''}</div>
          <h1 className="display">{b.title}</h1>
          <p className="by">by {b.authors.map(a => `${a.name}${a.birth_year ? ` (${a.birth_year}–${a.death_year ?? ''})` : ''}`).join(', ') || 'Anonymous'}</p>
          <RightsTag r={rightsFor(b)} />
          {b.summaries?.[0] && <p className="summary">{b.summaries[0].replace(/\s*\(This is an automatically generated summary\.\)/, '')}</p>}
          <div className="row gap wrap">
            <Link className="btn gold" to={`/read?id=${b.id}`}>Read now</Link>
            <button className="btn ghost" onClick={() => (on || track('library.shelf_add'), setShelf(on ? shelf.filter(s => s.id !== b.id) : [...shelf, { id: b.id, title: b.title, author: author(b), cover: cover(b), lang: b.languages[0], addedAt: Date.now() }]))}>{on ? '✓ On your shelf' : '+ Add to shelf'}</button>
            <Link className="btn ghost" to={`/dna?id=${b.id}`}>Book DNA</Link> <button className="btn ghost" onClick={toggleOff} disabled={off === 'busy'}>{off === 'yes' ? '✓ Saved offline' : off === 'busy' ? 'Saving…' : '⤓ Keep offline'}</button>
            <Link className="btn ghost" to={`/studio/translate?id=${b.id}`}>Translate</Link>
            <Link className="btn ghost" to={`/studio/remix?id=${b.id}`}>Remix</Link>
            <Link className="btn ghost" to={`/studio/continue?id=${b.id}`}>Continue</Link>
          </div>
          {b.subjects && <div className="chips">{b.subjects.slice(0, 6).map(s => <Link className="chip" key={s} to={`/library?subject=${encodeURIComponent(topSubject(s))}`}>{topSubject(s)}</Link>)}</div>}
        </div>
      </div>
      <div className="two-col">
        <Provenance b={b} />
        <div className="glass prov">
          <h2 className="h3">Editions &amp; series</h2>
          <ul className="editions">
            <li><span className="ed-dot orig" /> <b>Original</b> · {b.title.split(/[;:]/)[0]} ({b.languages.map(langName).join(', ')})</li>
            {derived.map(p => <li key={p.id}><span className="ed-dot" /> <b>{p.kind[0].toUpperCase() + p.kind.slice(1)}</b> · {p.title} <span className="muted small">· draft, awaiting AI engine</span></li>)}
            {!derived.length && <li className="muted small">No remixes or translations yet. Start one in the Studio and it will link back here.</li>}
          </ul>
          <p className="small muted">Audiobook edition <Soon /></p>
        </div>
      </div>
      <FirstPage id={b.id} />
      <MoreLike id={b.id} />
    </div>
  );
}

function FirstPage({ id }: { id: number }) {
  const [p, setP] = useState<{ ci: number; t: string; ps: string[] } | null>(null);
  useEffect(() => { setP(null); getHosted(id).then(h => { const ci = Math.max(0, h.chapters.findIndex((c, i) => i > 0 || !/^opening$/i.test(c.t))); const c = h.chapters[ci] ?? h.chapters[0];
    setP({ ci, t: c.t, ps: c.p.filter(x => x.length > 60).slice(0, 3) }); }).catch(() => {}); }, [id]);
  if (!p || !p.ps.length) return null;
  return <section className="glass prov first-page" aria-labelledby="fp-h"><h2 className="h3" id="fp-h">The first page</h2><p className="small muted">{p.t}</p>
    {p.ps.map((x, i) => <p key={i} className="fp-p">{x.length > 700 ? x.slice(0, 700) + '…' : x}</p>)}
    <Link className="btn gold sm" to={`/read?id=${id}&ch=${p.ci}`}>Keep reading</Link></section>;
}

function MoreLike({ id }: { id: number }) {
  const [list, setList] = useState<ReturnType<typeof similarBooks>>([]);
  useEffect(() => { getCatalog().then(c => setList(similarBooks(c, id))).catch(() => {}); }, [id]);
  if (!list.length) return null;
  return <section className="more-like" aria-labelledby="ml-h"><h2 className="h3" id="ml-h">More like this</h2><p className="small muted">Chosen by shared subjects and shelves in the catalogue.</p>
    <div className="grid-books">{list.map(c => <BookCard key={c.id} b={toBook(c)} />)}</div></section>;
}
