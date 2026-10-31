import { DEFAULT_DESIGN, THEMES, useDesign } from '../lib/store';

export const FONTS = ['Cormorant Garamond', 'EB Garamond', 'Literata', 'Lora', 'Inter'];
export default function DesignPanel({ compact = false }: { compact?: boolean }) {
  const [d, setD] = useDesign();
  const up = (p: Partial<typeof d>) => setD({ ...d, ...p });
  return (
    <div className={`design-panel ${compact ? 'compact' : ''}`}>
      <label>Typeface
        <select value={d.font} onChange={e => up({ font: e.target.value })}>{FONTS.map(f => <option key={f} style={{ fontFamily: f }}>{f}</option>)}</select>
      </label>
      <label>Size <span className="val">{d.size}px</span><input type="range" min={15} max={30} value={d.size} onChange={e => up({ size: +e.target.value })} /></label>
      <label>Leading <span className="val">{d.leading.toFixed(2)}</span><input type="range" min={1.3} max={2.2} step={0.05} value={d.leading} onChange={e => up({ leading: +e.target.value })} /></label>
      <label>Measure <span className="val">{d.measure}em</span><input type="range" min={26} max={52} value={d.measure} onChange={e => up({ measure: +e.target.value })} /></label>
      <div className="lbl">Theme</div>
      <div className="swatches">
        {Object.entries(THEMES).map(([k, t]) => (
          <button key={k} className={`swatch ${d.theme === k ? 'on' : ''}`} style={{ background: t.bg, color: t.ink, borderColor: t.accent }} onClick={() => up({ theme: k, ...t })} title={k}>Aa<small>{k}</small></button>
        ))}
      </div>
      <div className="colors">
        <label>Paper<input type="color" value={d.bg} onChange={e => up({ bg: e.target.value, theme: 'Custom' })} /></label>
        <label>Ink<input type="color" value={d.ink} onChange={e => up({ ink: e.target.value, theme: 'Custom' })} /></label>
        <label>Accent<input type="color" value={d.accent} onChange={e => up({ accent: e.target.value, theme: 'Custom' })} /></label>
      </div>
      <div className="toggles">
        <label><input type="checkbox" checked={d.align === 'justify'} onChange={e => up({ align: e.target.checked ? 'justify' : 'left' })} /> Justified</label>
        <label><input type="checkbox" checked={d.dropcap} onChange={e => up({ dropcap: e.target.checked })} /> Drop caps</label>
        <label><input type="checkbox" checked={d.indent} onChange={e => up({ indent: e.target.checked })} /> Book indents</label>
        <label><input type="checkbox" checked={d.ornament} onChange={e => up({ ornament: e.target.checked })} /> Chapter ornaments</label>
        {!compact && <label><input type="checkbox" checked={d.spineAnim} onChange={e => up({ spineAnim: e.target.checked })} /> Spine glow animation</label>}
      </div>
      <button className="link small" onClick={() => setD(DEFAULT_DESIGN)}>Reset to defaults</button>
    </div>
  );
}
