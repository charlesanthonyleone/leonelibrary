import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import DesignPanel from '../components/DesignPanel';
import { GenCover, Soon } from '../components/ui';
import { useDesign } from '../lib/store';
import Shelf3D from '../components/Shelf3D';

const SAMPLE = [
  'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
  'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
  '“My dear Mr. Bennet,” said his lady to him one day, “have you heard that Netherfield Park is let at last?”',
];
const STYLES = ['Gilded', 'Deco', 'Minimal', 'Marbled'];

export default function Design() {
  const [d, setD] = useDesign();
  const [title, setTitle] = useState('Pride and Prejudice');
  const [auth, setAuth] = useState('Jane Austen');
  const [hue, setHue] = useState(350);
  const style = { '--r-bg': d.bg, '--r-ink': d.ink, '--r-acc': d.accent, '--r-font': `'${d.font}', Georgia, serif`, '--r-size': `${d.size}px`, '--r-lead': d.leading, '--r-measure': `${d.measure}em`, '--r-align': d.align } as CSSProperties;
  return (
    <div className="page wide">
      <div className="eyebrow">The Studio · Design</div>
      <h1 className="display">Total Creative Control</h1>
      <p className="lede">Every change applies live and is saved on this device. The reader uses these settings for every book.</p>
      <div className="design-layout">
        <div className="glass pad"><h2 className="h3">Typography &amp; page</h2><DesignPanel /></div>
        <div className={`reader preview ${d.dropcap ? 'dropcap' : ''} ${d.indent ? 'indent' : ''} ${d.ornament ? 'orn' : ''}`} style={style}>
          <article className="page-paper"><h2 className="ch-title">Chapter I</h2><div className="prose">{SAMPLE.map((p, i) => <p key={i}>{p}</p>)}</div></article>
          <Link className="btn gold" to="/read?id=1342">Open in the reader</Link>
        </div>
      </div>
      <div className="design-layout two">
        <div className="glass pad">
          <h2 className="h3">Cover designer</h2>
          <label>Title<input value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label>Author<input value={auth} onChange={e => setAuth(e.target.value)} /></label>
          <label>Cloth hue <input type="range" min={0} max={359} value={hue} onChange={e => setHue(+e.target.value)} /></label>
          <div className="lbl">Style</div>
          <div className="row gap wrap">{STYLES.map(s => <button key={s} className={`chipbtn ${d.coverStyle === s ? 'on' : ''}`} onClick={() => setD({ ...d, coverStyle: s })}>{s}</button>)}</div>
          <p className="small muted">Chapter art, full layout templates and print-ready cover export <Soon /></p>
        </div>
        <div className="cover-stage"><GenCover title={title} author={auth} hue={hue} style={d.coverStyle} className="big" /></div>
      </div>
      <div className="glass pad">
        <h2 className="h3">Spine animation</h2>
        <p className="small muted">Glow is {d.spineAnim ? 'on' : 'off'}. Turn it off here or under interface motion in scene settings (⚙).</p>
        <Shelf3D rows={1} books={[{ id: 1342, title, author: auth }, { id: 84, title: 'Frankenstein', author: 'Mary Shelley' }, { id: 2701, title: 'Moby Dick', author: 'Herman Melville' }, { id: 345, title: 'Dracula', author: 'Bram Stoker' }, { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' }, { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' }]} />
      </div>
    </div>
  );
}
