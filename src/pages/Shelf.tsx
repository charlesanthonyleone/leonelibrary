import { Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import Room from '../components/Room';
import { useShelf, useProjects, load, type Progress } from '../lib/store';
import { CSS_EXAMPLES, DECOR, EFFECTS, HTML_EXAMPLE, LIGHTS, MATERIALS, PRESETS, SCENES, fromPreset, usePlan, useRoom, type RoomCfg } from '../lib/room';
import { Soon } from '../components/ui';

export const STARTER = [
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' }, { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' }, { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker' }, { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { id: 2701, title: 'Moby Dick', author: 'Herman Melville' }, { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
];

const Lock = () => <span className="lock" aria-label="Editor plan">🔒</span>;

export default function Shelf() {
  const [shelf, setShelf] = useShelf();
  const [projects] = useProjects();
  const [room, setRoom] = useRoom();
  const [plan, setPlan] = usePlan();
  const [tab, setTab] = useState<'look' | 'code' | 'ai'>('look');
  const [draft, setDraft] = useState({ css: room.css, html: room.html });
  const [upsell, setUpsell] = useState(false);
  const pro = plan === 'editor-demo';
  const books = shelf.length ? shelf : STARTER;
  const gate = (fn: () => void) => () => (pro ? fn() : setUpsell(true));
  const patch = (p: Partial<RoomCfg>) => setRoom({ ...room, ...p, preset: 'custom' });

  const Chips = <T extends string>({ label, opts, val, on }: { label: string; opts: [T, string][]; val: T; on: (v: T) => void }) => (
    <div className="ctl"><div className="lbl">{label} {!pro && <Lock />}</div><div className="chips">{opts.map(([v, n]) => <button key={v} className={`chip ${val === v ? 'on' : ''}`} onClick={gate(() => on(v))}>{n}</button>)}</div></div>
  );
  const Tab = ({ id, children }: { id: typeof tab; children: ReactNode }) => <button role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{children}</button>;

  return (
    <div className="page wide shelf-page">
      <div className="shelf-head">
        <div><div className="eyebrow">My Shelf</div><h1 className="display">Your personal 3D library</h1>
          <p className="lede">{shelf.length ? `${shelf.length} book${shelf.length > 1 ? 's' : ''} on your shelf.` : 'A starter shelf until you add books from the Library.'} Make the room yours: glass or walnut, snow or a waterfall, or anything CSS and HTML can draw.</p></div>
        <label className="demo-toggle"><input type="checkbox" checked={pro} onChange={e => setPlan(e.target.checked ? 'editor-demo' : 'free')} /> <span>Preview Editor features <small className="muted">(local demo, nothing is charged)</small></span></label>
      </div>

      <div className="shelf-layout">
        <div className="room-col"><Room cfg={room} books={books} />
        <div className="presets">{PRESETS.map(p => { const locked = !p.free && !pro;
        return <button key={p.id} className={`preset ${room.preset === p.id ? 'on' : ''} ${locked ? 'locked' : ''}`} onClick={() => (locked ? setUpsell(true) : setRoom(fromPreset(p.id, room)))}>
          <span className={`pv scene-${p.cfg.scene}`} /><b>{p.name} {locked && <Lock />}</b><small>{p.blurb}</small></button>; })}</div>

        </div>
        <aside className="studio-panel glass">
          <div className="tabs" role="tablist"><Tab id="look">Customize</Tab><Tab id="code">HTML / CSS {!pro && <Lock />}</Tab><Tab id="ai">AI designer</Tab></div>
          {tab === 'look' && <div className="ctls">
            <div className="ctl"><div className="lbl">Light intensity <span className="val">{Math.round(room.intensity * 100)}%</span></div><input type="range" min={0} max={1} step={.05} value={room.intensity} onChange={e => setRoom({ ...room, intensity: +e.target.value })} /></div>
            <Chips label="Lighting" opts={LIGHTS} val={room.light} on={v => patch({ light: v })} />
            <Chips label="Shelf material" opts={MATERIALS} val={room.material} on={v => patch({ material: v })} />
            <Chips label="Background scene" opts={SCENES} val={room.scene} on={v => patch({ scene: v })} />
            <Chips label="Atmosphere" opts={EFFECTS} val={room.effect} on={v => patch({ effect: v })} />
            <div className="ctl"><div className="lbl">Decorations {!pro && <Lock />}</div><div className="chips">{DECOR.map(([k, n]) => <button key={k} className={`chip ${room.decor[k] ? 'on' : ''}`} onClick={gate(() => patch({ decor: { ...room.decor, [k]: !room.decor[k] } }))}>{room.decor[k] ? '✓ ' : '+ '}{n}</button>)}</div></div>
            <p className="tiny muted">Saved automatically on this device.</p>
          </div>}
          {tab === 'code' && <div className={`ctls ${pro ? '' : 'gated'}`}>
            <p className="small muted">Style anything in your room: <code>.case</code>, <code>.b-spine</code>, <code>.plank span</code>, <code>.room-light</code>, <code>.sb</code>. Your CSS is scoped to this room; scripts, event handlers, iframes, forms and external URLs are stripped.</p>
            <div className="lbl">CSS</div>
            <textarea className="code" spellCheck={false} rows={9} value={draft.css} onChange={e => setDraft({ ...draft, css: e.target.value })} placeholder={'.b-spine { background: #123; }'} disabled={!pro} />
            <div className="chips">{CSS_EXAMPLES.map(([n, c]) => <button key={n} className="chip" disabled={!pro} onClick={() => setDraft({ ...draft, css: (draft.css ? draft.css + '\n\n' : '') + c })}>+ {n}</button>)}</div>
            <div className="lbl">HTML overlay</div>
            <textarea className="code" spellCheck={false} rows={5} value={draft.html} onChange={e => setDraft({ ...draft, html: e.target.value })} placeholder={HTML_EXAMPLE} disabled={!pro} />
            <div className="row gap wrap"><button className="btn gold sm" disabled={!pro} onClick={() => setRoom({ ...room, css: draft.css, html: draft.html })}>Apply to my room</button>
              <button className="btn ghost sm" disabled={!pro} onClick={() => { setDraft({ css: '', html: '' }); setRoom({ ...room, css: '', html: '' }); }}>Clear code</button></div>
            {!pro && <div className="gate-over"><Lock /><b>Custom HTML &amp; CSS is an Editor feature</b><Link className="btn gold sm" to="/plans">See plans</Link><button className="link small" onClick={() => setPlan('editor-demo')}>Preview it (demo)</button></div>}
          </div>}
          {tab === 'ai' && <div className="ctls">
            <div className="lbl">Describe your dream shelf <Soon /></div>
            <textarea rows={5} disabled placeholder="A cherry-wood case in a rainy Kyoto tea house, paper lanterns, moss on the lower shelf…" />
            <button className="btn gold sm" disabled>Design it for me · coming soon</button>
            <p className="small muted">The AI designer will write the HTML and CSS for you, using AI credits from your plan. No model is connected yet, so nothing is sent anywhere.</p>
          </div>}
        </aside>
      </div>

      {shelf.length > 0 && <div className="list glass pad">
        {shelf.map(b => { const p = load<Progress>(`progress:${b.id}`, { chapter: 0, pct: 0, at: 0 });
          return <div className="list-row" key={b.id}><Link to={`/read?id=${b.id}`}><b>{b.title.split(/[;:]/)[0]}</b> <span className="muted">· {b.author}</span></Link>
            <span className="small muted">{p.at ? `Chapter ${p.chapter + 1}` : 'Not started'}</span>
            <button className="link small" onClick={() => setShelf(shelf.filter(x => x.id !== b.id))}>Remove</button></div>; })}
      </div>}
      {projects.length > 0 && <div className="list glass pad"><h3>Studio projects</h3>{projects.map(p => <div className="list-row" key={p.id}><b>{p.title}</b><span className="muted small">{p.kind} of {p.sourceTitle}</span><span className="soon">awaiting AI engine</span></div>)}</div>}
      <p className="center"><Link className="btn gold" to="/library">Find more books</Link></p>

      {upsell && <div className="modal-back" onClick={() => setUpsell(false)}><div className="modal glass pad" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
        <div className="eyebrow">Editor plan</div><h3 className="display sm">Unlock the whole room</h3>
        <p className="muted">Every theme, material, scene and decoration, plus your own HTML and CSS. Reading stays free forever.</p>
        <div className="row gap wrap"><Link className="btn gold" to="/plans">See plans</Link><button className="btn ghost" onClick={() => { setPlan('editor-demo'); setUpsell(false); }}>Preview as Editor (demo)</button></div>
      </div></div>}
    </div>
  );
}
