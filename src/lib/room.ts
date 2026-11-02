import { useStored } from './store';

/** A personal 3D library: every choice here is saved on this device (localStorage). */
export type Scene = 'study' | 'summit' | 'atelier' | 'snow' | 'greenhouse' | 'meadow' | 'neon' | 'gallery';
export type Material = 'walnut' | 'oak' | 'glass' | 'marble' | 'steel' | 'birch';
export type Light = 'candle' | 'moon' | 'daylight' | 'neon' | 'none';
export type Effect = 'none' | 'snow' | 'fireflies' | 'dust' | 'petals';
export type Decor = { plants: boolean; candles: boolean; lamp: boolean; ivy: boolean; lights: boolean; globe: boolean };
export type RoomCfg = { preset: string; scene: Scene; material: Material; light: Light; intensity: number; effect: Effect; decor: Decor; css: string; html: string };

const D0: Decor = { plants: false, candles: false, lamp: false, ivy: false, lights: false, globe: false };
export const PRESETS: { id: string; name: string; blurb: string; free?: boolean; cfg: Omit<RoomCfg, 'preset' | 'css' | 'html'> }[] = [
  { id: 'study', name: 'Walnut Study', blurb: 'Dark walnut, candlelight, a reading lamp.', free: true, cfg: { scene: 'study', material: 'walnut', light: 'candle', intensity: .8, effect: 'dust', decor: { ...D0, candles: true, lamp: true, globe: true } } },
  { id: 'summit', name: 'Midnight Summit', blurb: 'Floating over the sea beneath the Milky Way.', free: true, cfg: { scene: 'summit', material: 'walnut', light: 'moon', intensity: .7, effect: 'none', decor: { ...D0, candles: true } } },
  { id: 'atelier', name: 'Glass Atelier', blurb: 'Clear glass shelves, cool moonlight, bokeh.', free: true, cfg: { scene: 'atelier', material: 'glass', light: 'moon', intensity: .8, effect: 'none', decor: { ...D0, plants: true } } },
  { id: 'snow', name: 'Snowbound Cabin', blurb: 'Pale birch in a snowfall among the pines.', cfg: { scene: 'snow', material: 'birch', light: 'candle', intensity: .6, effect: 'snow', decor: { ...D0, candles: true, lights: true } } },
  { id: 'greenhouse', name: 'Greenhouse', blurb: 'Oak shelves overgrown with ivy and ferns.', cfg: { scene: 'greenhouse', material: 'oak', light: 'daylight', intensity: .6, effect: 'fireflies', decor: { ...D0, plants: true, ivy: true } } },
  { id: 'meadow', name: 'Meadow Falls', blurb: 'Outdoors on a patch of grass by a waterfall.', cfg: { scene: 'meadow', material: 'oak', light: 'daylight', intensity: .5, effect: 'petals', decor: { ...D0, plants: true, ivy: true } } },
  { id: 'neon', name: 'Neon Arcade', blurb: 'Brushed steel under magenta and cyan.', cfg: { scene: 'neon', material: 'steel', light: 'neon', intensity: .9, effect: 'none', decor: { ...D0, lights: true } } },
  { id: 'gallery', name: 'Marble Gallery', blurb: 'White marble in soft museum daylight.', cfg: { scene: 'gallery', material: 'marble', light: 'daylight', intensity: .7, effect: 'none', decor: { ...D0, plants: true, globe: true } } },
];
export const SCENES: [Scene, string][] = [['study', 'Study'], ['summit', 'Summit night'], ['atelier', 'Atelier'], ['snow', 'Snowy pines'], ['greenhouse', 'Greenhouse'], ['meadow', 'Meadow + waterfall'], ['neon', 'Neon'], ['gallery', 'Gallery']];
export const MATERIALS: [Material, string][] = [['walnut', 'Walnut'], ['oak', 'Oak'], ['birch', 'Birch'], ['glass', 'Glass'], ['marble', 'Marble'], ['steel', 'Steel']];
export const LIGHTS: [Light, string][] = [['candle', 'Candle'], ['moon', 'Moonlight'], ['daylight', 'Daylight'], ['neon', 'Neon'], ['none', 'Off']];
export const EFFECTS: [Effect, string][] = [['none', 'None'], ['snow', 'Falling snow'], ['fireflies', 'Fireflies'], ['dust', 'Dust motes'], ['petals', 'Drifting petals']];
export const DECOR: [keyof Decor, string][] = [['plants', 'Plants'], ['candles', 'Candles'], ['lamp', 'Reading lamp'], ['ivy', 'Trailing ivy'], ['lights', 'String lights'], ['globe', 'Globe']];

export const fromPreset = (id: string, keep?: Pick<RoomCfg, 'css' | 'html'>): RoomCfg => {
  const p = PRESETS.find(x => x.id === id) ?? PRESETS[0];
  return { preset: p.id, ...p.cfg, decor: { ...p.cfg.decor }, css: keep?.css ?? '', html: keep?.html ?? '' };
};
export const useRoom = () => {
  const [r, set] = useStored<RoomCfg>('room', fromPreset('study'));
  return [{ ...fromPreset('study'), ...r, decor: { ...D0, ...r.decor } }, set] as const;
};

/** Leone Library is free and open source: every tool is unlocked for everyone, with no accounts or paid tiers. */
export type Plan = 'free' | 'editor-demo';
export const usePlan = () => { const [, set] = useStored<Plan>('plan', 'editor-demo'); return ['editor-demo' as Plan, set] as const; };

// ---- safety: user CSS/HTML never runs script and never escapes the room ----
const BAD_TAGS = 'script,iframe,frame,frameset,object,embed,applet,link,meta,base,form,input,button,textarea,select,option,style,template,noscript,portal,audio,video,source,track,math';
export function sanitizeHtml(src: string): string {
  const doc = new DOMParser().parseFromString(`<body>${src}</body>`, 'text/html');
  doc.querySelectorAll(BAD_TAGS).forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      if (n.startsWith('on') || n === 'srcdoc' || n === 'formaction' || n === 'action' || n === 'ping') el.removeAttribute(a.name);
      else if (['href', 'src', 'xlink:href', 'srcset', 'poster', 'background'].includes(n) && !(v.startsWith('data:image/') && !v.startsWith('data:image/svg'))) el.removeAttribute(a.name);
      else if (n === 'style') el.setAttribute('style', sanitizeCss(a.value));
    }
  });
  return doc.body.innerHTML;
}
/** strips anything that could load or run code or phone home; only raster data: images are allowed in url() */
export function sanitizeCss(src: string): string {
  return src.replace(/<\/?\s*style/gi, '').replace(/@import[^;]*;?/gi, '').replace(/@namespace[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'x(').replace(/javascript:/gi, '').replace(/behavior\s*:/gi, 'x:').replace(/-moz-binding/gi, 'x')
    .replace(/url\s*\(\s*(['"]?)(?!data:image\/(?:png|jpe?g|gif|webp))[^)]*\)/gi, 'none')
    .replace(/image-set\s*\(/gi, 'x(');
}
/** wraps user CSS in native CSS nesting under the room, so selectors only ever match inside it */
export function scopeCss(css: string, scope: string) {
  const c = sanitizeCss(css).replace(/\/\*[\s\S]*?\*\//g, ''); let inner = '', outer = '', i = 0;
  while (i < c.length) { // lift top-level @keyframes out of the nesting block (they cannot be nested)
    const m = /@(-webkit-)?keyframes\s+[\w-]+\s*\{/y; m.lastIndex = i; const hit = m.exec(c);
    if (hit) { let d = 1, j = m.lastIndex; while (j < c.length && d) { if (c[j] === '{') d++; else if (c[j] === '}') d--; j++; } outer += c.slice(i, j) + '\n'; i = j; }
    else { let d = 0, j = i; while (j < c.length) { if (c[j] === '{') d++; else if (c[j] === '}') d--; j++; if (d === 0 && (c[j - 1] === '}' || c[j - 1] === ';')) break; } inner += c.slice(i, j); i = j; }
  }
  return (inner.trim() ? `${scope}{${inner}}` : '') + outer;
}

export const CSS_EXAMPLES: [string, string][] = [
  ['Gilded spines', '.b-spine { background: linear-gradient(90deg,#3a2508,#c9a04a 40%,#f3dc9c 50%,#8a6a2a 70%,#3a2508); }\n.b-title { color: #2a1a05; text-shadow: none; }'],
  ['Rose-gold glow', '.room-light { background: radial-gradient(50% 50% at 50% 35%, #ff9fb4, transparent 70%); opacity: .7; }'],
  ['Floating case', '.case { animation: float 6s ease-in-out infinite; }\n@keyframes float { 50% { translate: 0 -14px; } }'],
];
export const HTML_EXAMPLE = '<div style="position:absolute; right:6%; top:8%; font: italic 28px Cormorant Garamond, serif; color:#f3dc9c; text-shadow:0 0 18px #f0c060">My reading room</div>';
