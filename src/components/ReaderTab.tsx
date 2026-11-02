import { DEFAULT_LOOK, FONTS, FREE_PAPERS, PAPERS, type ReaderLook } from '../lib/reader3d';

const Lock = () => null;
type P = { look: ReaderLook; set: (l: ReaderLook) => void; pro: boolean; upsell: (what: string) => void; reading: boolean; onPreview: () => void };

/** Edit → Reader: design the physical book every title opens into. Saved on this device. */
export default function ReaderTab({ look, set, pro, upsell, reading, onPreview }: P) {
  const up = (p: Partial<ReaderLook>) => set({ ...look, ...p });
  const g = (what: string, free: boolean, fn: () => void) => (free || pro ? fn() : upsell(what));
  const Chips = <T extends string | number | boolean>({ label, opts, val, on, free = () => false }: { label: string; opts: [T, string][]; val: T; on: (v: T) => void; free?: (v: T) => boolean }) =>
    <div className="ctl"><div className="lbl">{label}</div><div className="chips">{opts.map(([v, n]) => <button key={String(v)} className={`chip ${val === v ? 'on' : ''}`} onClick={() => g(label, free(v), () => on(v))}>{n}{!pro && !free(v) && <Lock />}</button>)}</div></div>;
  const Slider = ({ label, min, max, step, val, on, fmt, free }: { label: string; min: number; max: number; step: number; val: number; on: (v: number) => void; fmt?: (v: number) => string; free?: boolean }) =>
    <div className="ctl"><div className="lbl">{label} {!pro && !free && <Lock />} <span className="val">{fmt ? fmt(val) : val}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => g(label, !!free, () => on(+e.target.value))} /></div>;
  const Color = ({ label, val, on, free }: { label: string; val: string; on: (v: string) => void; free?: boolean }) =>
    <label className="ctl row between"><span className="lbl">{label} {!pro && !free && <Lock />}</span><input type="color" value={val} onChange={e => g(label, !!free, () => on(e.target.value))} /></label>;
  return <div className="ctls reader-tab">
    <p className="small muted">Design the book every title opens into. Click any book on the shelf to read; changes show live on the open book and are saved on this device only.</p>
    {!reading && <button className="btn ghost sm" onClick={onPreview}>Open a book to preview</button>}
    <h4>Paper</h4>
    <div className="ctl"><div className="lbl">Colour</div><div className="swatches">{PAPERS.map(([c, n]) => { const free = FREE_PAPERS.includes(c);
      return <button key={c} title={n + (free || pro ? '' : ' (Editor)')} aria-label={n} style={{ background: c }} className={look.paper === c ? 'on' : ''} onClick={() => g('Paper colours', free, () => up({ paper: c, ink: c === '#25231f' ? '#e7dcc6' : look.ink === '#e7dcc6' ? DEFAULT_LOOK.ink : look.ink }))} />; })}</div></div>
    <Chips label="Texture" opts={[['smooth', 'Smooth'], ['laid', 'Laid'], ['vellum', 'Vellum'], ['rough', 'Deckle']]} val={look.texture} on={v => up({ texture: v })} free={v => v === 'smooth' || v === 'laid'} />
    <Slider label="Age" min={0} max={1} step={.05} val={look.age} on={v => up({ age: v })} fmt={v => v < .1 ? 'New' : v < .45 ? 'Read' : v < .75 ? 'Old' : 'Antique'} />
    <Color label="Ink" val={look.ink} on={v => up({ ink: v })} />
    <h4>Type</h4>
    <div className="ctl"><div className="lbl">Typeface</div><div className="chips">{FONTS.map(([f, n, free]) => <button key={f} style={{ fontFamily: `"${f}", Georgia, serif` }} className={`chip ${look.font === f ? 'on' : ''}`} onClick={() => g('Typefaces', free, () => up({ font: f }))}>{n}{!pro && !free && <Lock />}</button>)}</div></div>
    <Slider label="Size" min={14} max={28} step={1} val={look.size} on={v => up({ size: v })} free />
    <Slider label="Line height" min={1.15} max={1.9} step={.05} val={look.lh} on={v => up({ lh: v })} fmt={v => v.toFixed(2)} free />
    <Slider label="Margins" min={26} max={80} step={2} val={look.margin} on={v => up({ margin: v })} />
    <Chips label="Setting" opts={[[true, 'Justified'], [false, 'Ragged']]} val={look.justify} on={v => up({ justify: v })} free={() => true} />
    <Chips label="Chapter openings" opts={[[true, 'Drop cap'], [false, 'Plain']]} val={look.dropcap} on={v => up({ dropcap: v })} />
    <Chips label="Running heads" opts={[[true, 'Show'], [false, 'Hide']]} val={look.heads} on={v => up({ heads: v })} free={() => true} />
    <h4>Binding</h4>
    <Chips label="Material" opts={[['cloth', 'Cloth'], ['linen', 'Linen'], ['leather', 'Leather'], ['paper', 'Paperback']]} val={look.binding} on={v => up({ binding: v })} free={v => v === 'cloth'} />
    <div className="ctl"><div className="lbl">Cover colour {!pro && <Lock />}</div><div className="row gap">
      <button className={`chip ${look.cover === '' ? 'on' : ''}`} onClick={() => up({ cover: '' })}>Each book's own</button>
      <input type="color" value={look.cover || '#5a1f1b'} onChange={e => g('Cover colours', false, () => up({ cover: e.target.value }))} /></div></div>
    <Color label="Foil stamping" val={look.foil} on={v => up({ foil: v })} />
    <Chips label="Ribbon bookmark" opts={[[true, 'On'], [false, 'Off']]} val={look.ribbon} on={v => up({ ribbon: v })} free={() => true} />
    {look.ribbon && <Color label="Ribbon colour" val={look.ribbonColor} on={v => up({ ribbonColor: v })} />}
    <h4>Turning pages</h4>
    <Chips label="Paper feel" opts={[['curl', 'Curling'], ['soft', 'Soft'], ['stiff', 'Stiff card']]} val={look.style} on={v => up({ style: v })} free={v => v === 'curl'} />
    <Slider label="Speed" min={300} max={1400} step={50} val={look.flipMs} on={v => up({ flipMs: v })} fmt={v => `${(v / 1000).toFixed(2)} s`} />
    <Chips label="Sound" opts={[[true, 'Rustle'], [false, 'Silent']]} val={look.sound} on={v => up({ sound: v })} free={() => true} />
    <h4>Reading light</h4>
    <Chips label="Lamp" opts={[['lamp', 'Desk lamp'], ['daylight', 'Daylight'], ['candle', 'Candle']]} val={look.light} on={v => up({ light: v })} free={v => v === 'lamp'} />
    <Slider label="Brightness" min={.4} max={1.6} step={.05} val={look.lightAmt} on={v => up({ lightAmt: v })} fmt={v => `${Math.round(v * 100)}%`} free />
    <button className="btn ghost sm" onClick={() => set(DEFAULT_LOOK)}>Reset reader</button>
  </div>;
}
