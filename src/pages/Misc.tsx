import { Link } from 'react-router-dom';
import { Section, Soon } from '../components/ui';
import Shelf3D from '../components/Shelf3D';

export function Classroom() {
  return (
    <div className="page">
      <div className="eyebrow">Classroom edition</div>
      <h1 className="display">The Children's Workshop</h1>
      <p className="lede">Bring the classics into class. Assign a book, let students rewrite a chapter in their own voice, and print a class anthology published by Leone Publishing.</p>
      <div className="feature-grid">
        <div className="feature glass"><h3>Assign &amp; read</h3><p>Shared reading lists, progress at a glance, and the simplified translation style for younger readers. <Soon /></p></div>
        <div className="feature glass"><h3>Remix a chapter</h3><p>Students become the hero, change the setting, or tell it from another character's side. <Soon /></p></div>
        <div className="feature glass"><h3>Safe by design</h3><p>No public profiles for students, teacher-approved publishing, and AI use disclosed on every page. <Soon /></p></div>
        <div className="feature glass"><h3>Class anthology</h3><p>Print a real book of the class's work through print-on-demand. <Soon /></p></div>
      </div>
      <div className="row gap center"><Link className="btn gold" to="/library?q=fairy">Browse fairy tales</Link><Link className="btn ghost" to="/studio/remix?id=11">Try remixing Alice</Link></div>
    </div>
  );
}

export function Community() {
  const shelves = [
    { who: 'The Night Readers', books: [{ id: 345, title: 'Dracula', author: 'Bram Stoker' }, { id: 84, title: 'Frankenstein', author: 'Mary Shelley' }, { id: 43, title: 'Jekyll and Hyde', author: 'R. L. Stevenson' }, { id: 1952, title: 'The Yellow Wallpaper', author: 'C. P. Gilman' }] },
    { who: 'Russian Winter', books: [{ id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' }, { id: 2680, title: 'Meditations', author: 'Marcus Aurelius' }, { id: 16328, title: 'Beowulf', author: 'Anonymous' }] },
  ];
  return (
    <div className="page wide">
      <div className="eyebrow">Community</div>
      <h1 className="display">Your Library Is a Statement</h1>
      <p className="lede">Follow other readers' shelves, review editions, and enter contests for the best remix or translation.</p>
      <div className="example-banner">Preview. These shelves are samples; public profiles and following are coming soon.</div>
      <div className="two-col">{shelves.map(s => <div className="glass pad" key={s.who}><h3>{s.who} <button className="btn ghost sm" disabled>Follow · soon</button></h3><Shelf3D books={s.books} rows={1} /></div>)}</div>
      <div className="feature-grid">
        <div className="feature glass"><h3>Reviews</h3><p>Review the original and each edition separately. <Soon /></p></div>
        <div className="feature glass"><h3>Featured remixes</h3><p>Editor's picks from the Studio, every week. <Soon /></p></div>
        <div className="feature glass"><h3>Contests</h3><p>Seasonal prompts: best new translation, best sequel, best cover. <Soon /></p></div>
        <div className="feature glass"><h3>Author storefronts</h3><p>Sell direct from your own Leone page. <Link to="/storefront">Preview</Link></p></div>
      </div>
    </div>
  );
}

export function Storefront() {
  return (
    <div className="page">
      <div className="eyebrow">Author storefronts</div>
      <h1 className="display">Sell direct</h1>
      <p className="lede">Your own page on Leone Library: your books, editions and signed print runs, with direct sales and Leone's standard fee.</p>
      <div className="example-banner">Preview layout <Soon /></div>
      <div className="glass pad storefront"><div className="seal">C</div><div><h3>Your name here</h3><p className="muted">Translator of Russian classics · 3 editions</p><p className="imprint">Published by Leone Publishing</p></div></div>
      <Section eyebrow="Also coming" title="Audiobooks">
        <p className="lede">Narrated editions of your translations and remixes, distributed alongside print and ebook. <Soon /></p>
      </Section>
    </div>
  );
}

export function Rights() {
  return (
    <div className="page">
      <div className="eyebrow">Rights &amp; provenance engine</div>
      <h1 className="display">Every book carries its papers</h1>
      <p className="lede">Leone Library indexes US public-domain works only: as of 2026, works first published in 1930 or earlier. Each book and each derivative records:</p>
      <div className="feature-grid">
        <div className="feature glass"><h3>Source</h3><p>The exact public-domain source edition it was transcribed from, with its eBook number and checksum.</p></div>
        <div className="feature glass"><h3>PD status</h3><p>A tag on every card: confirmed, needs a publication-year check, or excluded.</p></div>
        <div className="feature glass"><h3>Change log</h3><p>Every edit you make in the reader is recorded against the source text.</p></div>
        <div className="feature glass"><h3>AI tools used</h3><p>Which tools touched the text and for what, carried through to the published book.</p></div>
      </div>
      <p className="small muted">Translations are made from the public-domain original. A later translation can carry its own copyright even when the original is free. Rights outside the US differ. This is not legal advice.</p>
    </div>
  );
}

export const NotFound = () => <div className="page center"><h1 className="display">This page is not on any shelf</h1><Link className="btn gold" to="/">Return home</Link></div>;
