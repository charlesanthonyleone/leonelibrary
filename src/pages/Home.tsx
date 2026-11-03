import { lazy, Suspense, useEffect, useState } from 'react';
import { author, cover, getCatalog, getHosted, toBook, type Book } from '../lib/books';
import { load } from '../lib/store';
import { Link } from 'react-router-dom';
import Room from '../components/Room';
import { fromPreset } from '../lib/room';
import { STARTER } from '../lib/shared';
import { HomeShelves } from './Browse';
const Contest = lazy(() => import('./Features').then(m => ({ default: m.Contest })));

const ROOMS = [
  { n: 'I', to: '/library', t: 'The Library', d: 'Thousands of complete public-domain classics, hosted in full and free to read in a reader you can make your own.' },
  { n: 'II', to: '/studio', t: 'The Studio', d: 'Translate from the original, put yourself in the story, or write the sequel the author never did.' },
  { n: 'III', to: '/publishing', t: 'Leone Publishing', d: 'Print-on-demand and ebook distribution. You keep 85–90% of net royalties, nothing up front.' },
  { n: 'IV', to: '/shelf', t: 'My Shelf', d: 'A personal 3D library. Glass, walnut, snowfall, a waterfall, or anything HTML and CSS can draw.' },
  { n: 'V', to: '/plans', t: 'Plans', d: 'Reading is free forever. Editor plans unlock the creative tools; AI credits do the heavy lifting.' },
];
const meadow = fromPreset('meadow');

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="eyebrow">The Open Library · Leone Publishing</div>
        <h1 className="display xl">Every book,<br /><em>yours to remake.</em></h1>
        <p className="lede">Read the world's public-domain classics free, then translate, remix and publish them as your own.</p>
        <div className="row gap wrap"><Link className="btn gold" to="/library">Enter the Library</Link><Link className="btn ghost" to="/shelf">Build your shelf</Link></div>
        <p className="hero-facts">Free to read <i /> 4 public-domain sources <i /> 85–90% royalties to you</p>
      </section>

      <ContinueReading />
      <HomeShelves />
      <FirstLine />
      <section className="section index-sec">
        <div className="eyebrow">Inside</div>
        <h2 className="display">Five rooms, one library</h2>
        <nav className="index glass" aria-label="Sections">{ROOMS.map(r => (
          <Link key={r.to} to={r.to} className="ix"><span className="ix-n">{r.n}</span><span className="ix-t">{r.t}</span><span className="ix-d">{r.d}</span><span className="ix-a" aria-hidden>→</span></Link>))}
        </nav>
      </section>

      <section className="section spot">
        <div className="spot-copy">
          <div className="eyebrow">My Shelf</div>
          <h2 className="display">A library that looks like you</h2>
          <p className="lede">Choose a room or build your own: materials, lighting, plants, candles, weather. Editors can write their own HTML and CSS, and soon an AI will design it from a sentence.</p>
          <div className="row gap wrap"><Link className="btn gold" to="/shelf">Design my shelf</Link><Link className="btn ghost" to="/plans">See plans</Link></div>
        </div>
        <Room cfg={meadow} books={STARTER.slice(0, 6)} rows={1} compact />
      </section>

      <Suspense fallback={null}><Contest /></Suspense>

      <section className="section">
        <div className="eyebrow">Also in the library</div>
        <h2 className="display">Read with people, keep the habit</h2>
        <div className="feature-grid fx-links">
          {[['/clubs', 'Book clubs', 'One pace, a thread per chapter, no spoilers.'], ['/goals', 'Goals & streaks', 'A daily habit and a yearly recap from your real reading.'], ['/shelves', 'Public shelves', 'Publish your 3D room as a link others can follow.'], ['/marketplace', 'Theme marketplace', 'Rooms and reader palettes, installed in one click.'], ['/studio/collab', 'Co-author a remix', 'Versions, diffs and agreed royalty splits.'], ['/export', 'EPUB & print', 'Download your edition or size a print cover.']].map(([to, t, d]) => <Link key={to} to={to} className="feature glass"><h2 className="h3">{t}</h2><p>{d}</p></Link>)}
        </div>
      </section>

      <section className="section closing center">
        <h2 className="display">Start with a book.</h2>
        <p className="lede center-lede">Free, forever, for every public-domain title.</p>
        <Link className="btn gold" to="/library">Enter the Library</Link>
      </section>
    </>
  );
}

// A real opening line every day: one of the 400 most-read hosted books, picked by the date.
function FirstLine() {
  const [d, setD] = useState<{ id: number; title: string; author: string; ch: number; line: string } | null>(null);
  useEffect(() => { let live = true; (async () => {
    const cat = (await getCatalog()).slice().sort((a, b) => b.downloads - a.downloads).slice(0, 400);
    const t = new Date(), n = Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 864e5);
    for (let k = 0; k < 5 && live; k++) { const b = cat[(n * 7919 + k) % cat.length]; try { const h = await getHosted(b.id);
      const ci = h.chapters.findIndex((c, i) => i > 0 || !/^opening$/i.test(c.t)); const p = (h.chapters[ci]?.p ?? []).find(x => x.length > 40 && /[a-z]/.test(x) && !/^[A-Z\s.,]+$/.test(x));
      if (!p) continue; const m = p.match(/^.{20,320}?[.!?]["”’]?(?=\s|$)/); if (live) setD({ id: b.id, title: b.title.split(/[;:]/)[0], author: b.author, ch: ci, line: m ? m[0] : p.slice(0, 300) + '…' }); return; } catch { /* try next */ } } })();
    return () => { live = false; }; }, []);
  if (!d) return null;
  return <section className="section first-line" aria-label="Today's first line"><div className="glass pad"><div className="eyebrow">Today's first line</div>
    <blockquote className="fl-q">“{d.line.replace(/^["“]|["”]$/g, '')}”</blockquote>
    <p className="small muted">{d.title} · {d.author}</p><Link className="btn gold sm" to={`/read?id=${d.id}&ch=${d.ch}`}>Start reading</Link></div></section>;
}

/** Kindle-style "pick up where you left off": the books this browser was reading most recently. */
function ContinueReading() {
  const [rows, setRows] = useState<{ b: Book; pct: number; ch: number }[]>([]);
  useEffect(() => { const keys = Object.keys(localStorage).filter(k => /^leone:progress:\d+$/.test(k));
    const ps = keys.map(k => ({ id: +k.split(':')[2], p: load<{ chapter: number; at: number; book?: number }>(k.slice(6), { chapter: 0, at: 0 }) })).filter(x => x.p.at).sort((a, b) => b.p.at - a.p.at).slice(0, 4);
    if (!ps.length) return; let live = true;
    getCatalog().then(cat => { if (!live) return; const by = new Map(cat.map(c => [c.id, c]));
      setRows(ps.flatMap(x => { const c = by.get(x.id); return c ? [{ b: toBook(c), pct: Math.round((x.p.book ?? 0) * 100), ch: x.p.chapter }] : []; })); }).catch(() => {});
    return () => { live = false; }; }, []);
  if (!rows.length) return null;
  return <section className="section continue" aria-labelledby="cr-h"><div className="eyebrow">Your reading</div><h2 className="display" id="cr-h">Continue reading</h2>
    <ul className="cr-list">{rows.map(({ b, pct, ch }) => <li key={b.id}><Link to={`/read?id=${b.id}`} className="cr-item glass">
      {cover(b) ? <img src={cover(b)} alt="" width={64} height={96} loading="lazy" /> : <span className="cr-ph" aria-hidden="true" />}
      <span className="cr-t"><strong>{b.title.split(/[;:]/)[0]}</strong><span className="muted small">{author(b)}</span>
        <span className="cr-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span><span className="small muted">{pct ? `${pct}% · ` : ''}Chapter {ch + 1}</span></span></Link></li>)}</ul></section>;
}
