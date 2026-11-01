import { useCallback, useEffect, useRef, useState } from 'react';
import { load, save, uid } from './store';

/** A full, editable 3D room layout. Everything is saved on this device only. Units are metres. */
export type ItemKind = 'plant' | 'fern' | 'lamp' | 'candle' | 'rug' | 'globe' | 'frame' | 'figurine' | 'vase' | 'clock';
export type Item = { id: string; kind: ItemKind; x: number; y: number; z: number; ry: number; s: number; color?: string };
export type SpineTex = 'cloth' | 'leather' | 'paper' | 'gilt';
export type BookSlot = { id: number | string; title: string; author: string; shelf: number; color: string; tex: SpineTex; h: number; t: number };
export type Setting = 'room' | 'outdoor';
export type View = 'meadow' | 'snow' | 'night' | 'interior';
export type Mat = 'walnut' | 'oak' | 'marble' | 'glass' | 'steel' | 'white';
export type Wall = 'plaster' | 'sage' | 'navy' | 'oxblood' | 'wood';
export type Floor = 'oak' | 'marble' | 'grass' | 'snow';
export type Weather = 'none' | 'snow' | 'rain' | 'dust' | 'fireflies' | 'petals';
export type Layout = {
  id: string; name: string; preset: string;
  setting: Setting; view: View; window: boolean; wall: Wall; floor: Floor;
  mat: Mat; shelves: number; width: number; spacing: number; depth: number;
  time: number; lampColor: string; lampOn: boolean; ambient: number; exposure: number;
  weather: Weather; sound: boolean;
  cam: { az: number; el: number; dist: number };
  books: BookSlot[]; items: Item[]; css: string; html: string;
};

export const MATS: [Mat, string][] = [['walnut', 'Walnut'], ['oak', 'Oak'], ['white', 'Painted white'], ['marble', 'Marble'], ['glass', 'Glass'], ['steel', 'Brushed steel']];
export const WALLS: [Wall, string][] = [['plaster', 'Warm plaster'], ['sage', 'Sage'], ['navy', 'Midnight navy'], ['oxblood', 'Oxblood'], ['wood', 'Wood panel']];
export const FLOORS: [Floor, string][] = [['oak', 'Oak boards'], ['marble', 'Marble'], ['grass', 'Grass'], ['snow', 'Snow']];
export const VIEWS: [View, string][] = [['meadow', 'Meadow & falls'], ['snow', 'Snowy park'], ['night', 'Night sky'], ['interior', 'Sunlit room']];
export const WEATHERS: [Weather, string][] = [['none', 'Clear'], ['snow', 'Snowfall'], ['rain', 'Rain'], ['dust', 'Dust motes'], ['fireflies', 'Fireflies'], ['petals', 'Petals']];
export const ITEMS: [ItemKind, string][] = [['plant', 'Potted plant'], ['fern', 'Fern'], ['lamp', 'Reading lamp'], ['candle', 'Candle'], ['rug', 'Rug'], ['globe', 'Globe'], ['frame', 'Picture frame'], ['figurine', 'Bust figurine'], ['vase', 'Vase'], ['clock', 'Mantel clock']];
export const SPINE_COLORS = ['#5a1f24', '#1f3b2d', '#1d2a4a', '#6b4a22', '#2b2420', '#7a5a2a', '#3d1f3f', '#24403f', '#8a2f1f', '#c9b48a'];
export const TEXES: [SpineTex, string][] = [['cloth', 'Cloth'], ['leather', 'Leather'], ['paper', 'Paper'], ['gilt', 'Gilt-tooled']];

const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export function toSlots(books: { id: number | string; title: string; author: string }[], shelves: number): BookSlot[] {
  const per = Math.ceil(books.length / Math.max(1, shelves));
  return books.map((b, i) => { const h = hash(String(b.id) + b.title);
    return { ...b, title: b.title.split(/[;:]/)[0], shelf: Math.min(shelves - 1, shelves - 1 - Math.floor(i / per)), color: SPINE_COLORS[h % SPINE_COLORS.length], tex: (['cloth', 'leather', 'gilt', 'cloth'] as SpineTex[])[h % 4], h: .215 + (h % 7) * .009, t: .042 + (h % 5) * .008 }; });
}

const base = (p: Partial<Layout>): Omit<Layout, 'books' | 'id' | 'name'> => ({
  preset: 'custom', setting: 'room', view: 'interior', window: true, wall: 'plaster', floor: 'oak', mat: 'walnut', shelves: 3, width: 1.6, spacing: .36, depth: .3,
  time: 19, lampColor: '#ffb46b', lampOn: true, ambient: .6, exposure: 1, weather: 'none', sound: false, cam: { az: -.35, el: .12, dist: 2.6 }, items: [], css: '', html: '', ...p,
});
const it = (kind: ItemKind, x: number, y: number, z: number, ry = 0, s = 1, color?: string): Item => ({ id: uid(), kind, x, y, z, ry, s, color });
/** y values of items standing on the case top use the 'top' convention resolved in the scene (y < 0 = floor). */
export const PRESETS3D: { id: string; name: string; blurb: string; free?: boolean; make: () => Omit<Layout, 'books' | 'id' | 'name'> }[] = [
  { id: 'study', name: 'Walnut Study', blurb: 'Walnut, plaster, a brass lamp at dusk.', free: true, make: () => base({ preset: 'study', items: [it('lamp', -.95, 0, .35, .4), it('rug', 0, 0, .9, 0, 1.3, '#6d2a22'), it('globe', .55, 1.08, .05, 0, .9), it('candle', -.4, 1.08, .08), it('plant', 1.15, 0, .3, 0, 1.1)] }) },
  { id: 'meadow', name: 'Meadow Falls', blurb: 'Out on the grass beside a real waterfall.', free: true, make: () => base({ preset: 'meadow', setting: 'outdoor', view: 'meadow', floor: 'grass', mat: 'oak', time: 15.5, lampOn: false, weather: 'petals', sound: false, cam: { az: -.42, el: .2, dist: 4.4 }, items: [it('fern', -1.05, 0, .25, 0, 1.2), it('plant', .3, 1.08, .05, 0, .8), it('figurine', -.45, 1.08, .05, .5, .9)] }) },
  { id: 'night', name: 'Midnight Reading Room', blurb: 'Navy walls, a window full of stars.', free: true, make: () => base({ preset: 'night', view: 'night', wall: 'navy', time: 23, ambient: .35, lampColor: '#ffae5e', items: [it('lamp', -.95, 0, .35, .4), it('candle', .45, 1.08, .08), it('candle', .52, 1.08, .02, 0, .8), it('clock', -.3, 1.08, .05), it('rug', 0, 0, .9, 0, 1.3, '#1e2b4a')] }) },
  { id: 'snow', name: 'Snowbound', blurb: 'White shelves in a snowfall among the pines.', make: () => base({ preset: 'snow', setting: 'outdoor', view: 'snow', floor: 'snow', mat: 'white', time: 13, weather: 'snow', lampOn: true, cam: { az: -.4, el: .12, dist: 3.4 }, items: [it('candle', .4, 1.08, .06), it('candle', .48, 1.08, .0, 0, .8), it('lamp', -1.0, 0, .3, .4)] }) },
  { id: 'gallery', name: 'Stone Gallery', blurb: 'Pale stone shelves in museum daylight.', make: () => base({ preset: 'gallery', mat: 'marble', wall: 'plaster', floor: 'marble', time: 12, lampOn: false, items: [it('figurine', 0, 1.08, .05, 0, 1.2), it('vase', -.6, 1.08, .05), it('plant', 1.15, 0, .3, 0, 1.2), it('frame', .6, 1.08, -.05, 0, 1)] }) },
  { id: 'atelier', name: 'Glass Atelier', blurb: 'Glass and steel against sage walls.', make: () => base({ preset: 'atelier', mat: 'glass', wall: 'sage', floor: 'oak', time: 10, lampOn: false, items: [it('fern', 1.1, 0, .3), it('vase', .5, 1.08, .05, 0, .9), it('frame', -.5, 1.08, -.05)] }) },
  { id: 'library', name: 'Oxblood Library', blurb: 'Five tall walnut shelves, rain at the window.', make: () => base({ preset: 'library', wall: 'oxblood', shelves: 5, width: 1.9, time: 17, weather: 'rain', cam: { az: -.3, el: .1, dist: 3.9 }, items: [it('lamp', -1.1, 0, .35, .4), it('globe', 1.2, 0, .4, 0, 1.6), it('rug', 0, 0, .9, 0, 1.5, '#3a2a1a')] }) },
];
export const FREE_PRESETS = PRESETS3D.filter(p => p.free).map(p => p.id);

export function makeLayout(presetId: string, books: { id: number | string; title: string; author: string }[], name?: string): Layout {
  const p = PRESETS3D.find(x => x.id === presetId) ?? PRESETS3D[0]; const b = p.make();
  return { ...b, id: uid(), name: name ?? p.name, books: toSlots(books, b.shelves) };
}

// ---- share links: the whole layout travels in the URL hash, nothing is uploaded ----
export const encodeLayout = (l: Layout) => btoa(unescape(encodeURIComponent(JSON.stringify(l)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decodeLayout(s: string): Layout | null {
  try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))) as Layout; } catch { return null; }
}

/** Multiple saved layouts + undo/redo history for the active one. */
export function useLayouts(starter: { id: number | string; title: string; author: string }[]) {
  const [rooms, setRooms] = useState<Layout[]>(() => { const r = load<Layout[]>('rooms3d', []); return r.length ? r : [makeLayout('study', starter, 'My library')]; });
  const [active, setActive] = useState<string>(() => load('room3d-active', rooms[0].id));
  const cur = rooms.find(r => r.id === active) ?? rooms[0];
  const hist = useRef<{ past: Layout[]; fut: Layout[] }>({ past: [], fut: [] });
  const [, tick] = useState(0);
  useEffect(() => { save('rooms3d', rooms); }, [rooms]);
  useEffect(() => { save('room3d-active', active); hist.current = { past: [], fut: [] }; tick(t => t + 1); }, [active]);
  const replace = (l: Layout) => setRooms(rs => rs.map(r => (r.id === l.id ? l : r)));
  const set = useCallback((l: Layout, coalesce?: boolean) => {
    const h = hist.current; if (!coalesce || !h.past.length) h.past.push(cur); if (h.past.length > 80) h.past.shift(); h.fut = []; replace(l); tick(t => t + 1);
  }, [cur]);
  const undo = () => { const h = hist.current; const p = h.past.pop(); if (p) { h.fut.push(cur); replace(p); tick(t => t + 1); } };
  const redo = () => { const h = hist.current; const n = h.fut.pop(); if (n) { h.past.push(cur); replace(n); tick(t => t + 1); } };
  const add = (l: Layout) => { setRooms(rs => [...rs, l]); setActive(l.id); };
  const remove = (id: string) => { if (rooms.length < 2) return; const rest = rooms.filter(r => r.id !== id); setRooms(rest); setActive(rest[0].id); };
  return { rooms, cur, set, undo, redo, canUndo: hist.current.past.length > 0, canRedo: hist.current.fut.length > 0, add, remove, setActive };
}

export const caseHeight = (l: Pick<Layout, 'shelves' | 'spacing'>) => .08 + l.shelves * l.spacing + .025;
export function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

/** Re-spread books over a new shelf count, keeping each book's look. */
export function respread(books: BookSlot[], shelves: number): BookSlot[] {
  const per = Math.ceil(books.length / Math.max(1, shelves));
  return books.map((b, i) => ({ ...b, shelf: shelves - 1 - Math.floor(i / per) }));
}
