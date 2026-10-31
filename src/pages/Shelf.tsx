import { Link } from 'react-router-dom';
import Shelf3D from '../components/Shelf3D';
import { useShelf, useProjects, load, type Progress } from '../lib/store';
import { Soon } from '../components/ui';

const STARTER = [
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' }, { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' }, { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker' }, { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
];

export default function Shelf() {
  const [shelf, setShelf] = useShelf();
  const [projects] = useProjects();
  const books = shelf.length ? shelf : STARTER;
  return (
    <div className="page wide">
      <div className="eyebrow">My Shelf</div>
      <h1 className="display">A Living 3D Bookshelf</h1>
      <p className="lede">{shelf.length ? `${shelf.length} book${shelf.length > 1 ? 's' : ''} on your shelf, saved on this device.` : 'Your shelf is empty, so here is a starter shelf. Add books from the Library and they take their place here.'}</p>
      <Shelf3D books={books} rows={books.length > 8 ? 2 : 1} />
      {shelf.length > 0 && <div className="list glass pad">
        {shelf.map(b => { const p = load<Progress>(`progress:${b.id}`, { chapter: 0, pct: 0, at: 0 });
          return <div className="list-row" key={b.id}><Link to={`/read?id=${b.id}`}><b>{b.title.split(/[;:]/)[0]}</b> <span className="muted">· {b.author}</span></Link>
            <span className="small muted">{p.at ? `Chapter ${p.chapter + 1}` : 'Not started'}</span>
            <button className="link small" onClick={() => setShelf(shelf.filter(x => x.id !== b.id))}>Remove</button></div>; })}
      </div>}
      {projects.length > 0 && <div className="list glass pad"><h3>Studio projects</h3>{projects.map(p => <div className="list-row" key={p.id}><b>{p.title}</b><span className="muted small">{p.kind} of {p.sourceTitle}</span><span className="soon">awaiting AI engine</span></div>)}</div>}
      <p className="center"><Link className="btn gold" to="/library">Find more books</Link> <span className="small muted">Public, followable shelves <Soon /></span></p>
    </div>
  );
}
