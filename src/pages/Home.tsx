import { Link } from 'react-router-dom';
import Room from '../components/Room';
import { fromPreset } from '../lib/room';
import { STARTER } from './Shelf';
import { Contest } from './Features';

const ROOMS = [
  { n: 'I', to: '/library', t: 'The Library', d: 'Tens of thousands of public-domain classics from Project Gutenberg, free to read in a reader you can make your own.' },
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

      <Contest />

      <section className="section">
        <div className="eyebrow">Also in the library</div>
        <h2 className="display">Read with people, keep the habit</h2>
        <div className="feature-grid fx-links">
          {[['/clubs', 'Book clubs', 'One pace, a thread per chapter, no spoilers.'], ['/goals', 'Goals & streaks', 'A daily habit and a yearly recap from your real reading.'], ['/shelves', 'Public shelves', 'Publish your 3D room as a link others can follow.'], ['/marketplace', 'Theme marketplace', 'Rooms and reader palettes, installed in one click.'], ['/studio/collab', 'Co-author a remix', 'Versions, diffs and agreed royalty splits.'], ['/export', 'EPUB & print', 'Download your edition or size a print cover.']].map(([to, t, d]) => <Link key={to} to={to} className="feature glass"><h3>{t}</h3><p>{d}</p></Link>)}
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
