import { Link } from 'react-router-dom';
import { track } from '../lib/leoneid';
import { useState } from 'react';
import { author, cover, langName, rightsFor, type Book } from '../lib/books';
import { GenCover, RightsTag, hueOf } from './ui';
import { useShelf } from '../lib/store';

export default function BookCard({ b }: { b: Book }) {
  const [bad, setBad] = useState(false);
  const [shelf, setShelf] = useShelf();
  const on = shelf.some(s => s.id === b.id);
  const c = cover(b);
  const toggle = () => (on || track('library.shelf_add'), setShelf(on ? shelf.filter(s => s.id !== b.id) : [...shelf, { id: b.id, title: b.title, author: author(b), cover: c, lang: b.languages[0], addedAt: Date.now() }]));
  return (
    <article className="bookcard">
      <Link to={`/book?id=${b.id}`} className="bc-cover" tabIndex={-1} aria-hidden="true">
        {c && !bad ? <img src={c} alt="" loading="lazy" decoding="async" width={200} height={300} onError={() => setBad(true)} /> : <GenCover title={b.title} author={author(b)} hue={hueOf(b.title)} />}
        <span className="bc-sheen" />
      </Link>
      <div className="bc-body">
        <Link to={`/book?id=${b.id}`} className="bc-title">{b.title.split(/[;:]/)[0]}</Link>
        <div className="bc-author">{author(b)}</div>
        <div className="bc-meta"><RightsTag r={rightsFor(b)} /><span className="chip">{b.languages.map(langName).join(', ')}</span></div>
        <button className={`shelf-btn ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Add'} ${b.title.split(/[;:]/)[0]} ${on ? 'from' : 'to'} your shelf`}>{on ? '✓ On your shelf' : '+ Add to shelf'}</button>
      </div>
    </article>
  );
}
