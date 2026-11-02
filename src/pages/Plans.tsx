import { Link } from 'react-router-dom';

type Tier = { name: string; price: string; per?: string; tag: string; feats: string[]; cta: 'read' | 'soon'; hl?: boolean };
const TIERS: Tier[] = [
  { name: 'Reader', price: 'Free', tag: 'Every public-domain book, forever.', cta: 'read', feats: ['Read every book in the Open Library', 'The full reader: highlights, notes, progress', 'Reading design: type, colour, measure', 'A 3D shelf with three starter rooms', 'Publish with Leone (10–15% of net royalties)'] },
  { name: 'Editor', price: '$7', per: '/ month', tag: 'Make the library yours.', cta: 'soon', hl: true, feats: ['Everything in Reader', 'All shelf themes, materials, scenes and decorations', 'Custom HTML and CSS for your room', 'Studio tools: Translate, Remix, Continue workspaces', 'Monthly AI credit allowance', 'Public, followable shelf page'] },
  { name: 'Pro', price: '$19', per: '/ month', tag: 'For authors and translators.', cta: 'soon', feats: ['Everything in Editor', 'Larger AI credit allowance', 'Whole-book translation and remix runs', 'Print-ready interior and cover export', 'Priority review for Leone Publishing', 'Classroom seats for one teacher'] },
];
const PACKS = [['Small', '500', '$5'], ['Medium', '2,000', '$15'], ['Large', '6,000', '$39']];

export default function Plans() {
  return (
    <div className="page wide plans">
      <div className="center-head">
        <div className="eyebrow">Plans</div>
        <h1 className="display">Read free. Create without limits.</h1>
        <p className="lede">Every public-domain book is free to read, always. Editor plans unlock the creative tools, and AI credits pay for the heavy lifting.</p>
        <p className="draft-note">Draft pricing · placeholder prices, not final · no checkout yet, nothing can be charged</p>
      </div>
      <div className="tiers">{TIERS.map(t => (
        <div key={t.name} className={`tier glass ${t.hl ? 'hl' : ''}`}>
          {t.hl && <span className="tier-badge">Most popular</span>}
          <h2 className="h3">{t.name}</h2><p className="muted small">{t.tag}</p>
          <div className="price"><b>{t.price}</b>{t.per && <span>{t.per}</span>}{t.cta === 'soon' && <em className="draft">draft</em>}</div>
          <ul>{t.feats.map(f => <li key={f}>{f}</li>)}</ul>
          {t.cta === 'read' ? <Link className="btn ghost full" to="/library">Start reading</Link> : <button className="btn gold full" disabled>Coming soon</button>}
        </div>))}
      </div>
      <section className="packs glass pad">
        <div><div className="eyebrow">AI credits</div><h2 className="display sm">Top up when you need more</h2>
          <p className="muted">Credits are spent by AI features (translation, remixing, continuing a story, and the AI shelf designer) once the AI engine is connected. Packs never expire. How many credits each action costs will be published before launch.</p></div>
        <div className="pack-grid">{PACKS.map(([n, c, p]) => <div className="pack" key={n}><small>{n}</small><b>{c}</b><span>credits</span><div className="pp">{p} <em className="draft">draft</em></div><button className="btn ghost sm" disabled>Coming soon</button></div>)}</div>
      </section>
      <p className="tiny muted center">Want to try the Editor shelf tools now? Turn on the local demo on <Link to="/shelf">My Shelf</Link>. It only changes this device.</p>
    </div>
  );
}
