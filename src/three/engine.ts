import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BookSlot, Item, Layout } from '../lib/layout';
import { clockFace, cloudSprite, globeTex, noiseNormal, pageTex, pbr, rnd, softSprite, spineTex, tex } from './tex';

const HDR: Record<string, string> = { meadow: 'kloofendal_48d_partly_cloudy_puresky', snow: 'snowy_park_01', night: 'satara_night', interior: 'kloofendal_48d_partly_cloudy_puresky', room: 'lythwood_room' };
const hdrCache = new Map<string, Promise<THREE.DataTexture>>();
const loadHdr = (n: string) => { let p = hdrCache.get(n); if (!p) { p = new RGBELoader().loadAsync(import.meta.env.BASE_URL + 'pbr/' + n + '.hdr'); hdrCache.set(n, p); } return p; };

const PLINTH = .08, BOARD = .025;
import { caseHeight } from '../lib/layout';
import { Reading, type ReadState } from './reading';
import type { ReaderLook } from '../lib/reader3d';
export { caseHeight };

type Upd = (t: number, dt: number) => void;
export type Pick = { type: 'book'; id: string } | { type: 'item'; id: string } | null;
export type EngineEvents = {
  onBooks: (books: BookSlot[]) => void; onItem: (it: Item, final: boolean) => void; onSelect: (p: Pick) => void; onCam: (c: Layout['cam']) => void; onReady: () => void;
  onOpen?: (id: string) => void; onRead?: (s: ReadState | null) => void;
};

/** Low-power mode: lower resolution, no soft shadows, no particles, 30 fps. 'auto' turns it on for phones, Save-Data and low-memory devices. */
export function lowPower(): boolean {
  let pref = 'auto'; try { pref = JSON.parse(localStorage.getItem('leone:room-power') ?? '"auto"'); } catch { /* default */ }
  if (pref === 'low') return true; if (pref === 'full') return false;
  const n = navigator as any; return !!(n.connection?.saveData || (n.deviceMemory && n.deviceMemory <= 4) || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600));
}
export class Engine {
  low = lowPower(); last = 0;
  r: THREE.WebGLRenderer; scene = new THREE.Scene(); cam: THREE.PerspectiveCamera; orbit: OrbitControls; tc: TransformControls;
  L!: Layout; ev: EngineEvents; mode: 'view' | 'books' | 'decor' = 'view'; editable = true;
  world = new THREE.Group(); caseG = new THREE.Group(); booksG = new THREE.Group(); itemsG = new THREE.Group(); fx = new THREE.Group(); lights = new THREE.Group();
  surfaces: THREE.Object3D[] = []; upd: Upd[] = []; worldUpd: Upd[] = []; itemUpd: Upd[] = []; fxUpd: Upd[] = [];
  sun = new THREE.DirectionalLight(0xffffff, 3); hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a2a1a, .2);
  keys: Record<string, string> = {}; clock = new THREE.Clock(); raf = 0; visible = true; sel: Pick = null; envName = ''; bgName = '';
  ray = new THREE.Raycaster(); ptr = new THREE.Vector2(); drag: { mesh: THREE.Object3D; slot: BookSlot; moved: boolean; x0: number; y0: number } | null = null;
  ro: ResizeObserver; io: IntersectionObserver; selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xf3d27a);
  reading: Reading | null = null; click: { x: number; y: number; id: string } | null = null;

  constructor(public host: HTMLElement, ev: EngineEvents) {
    this.ev = ev;
    const r = this.r = new THREE.WebGLRenderer({ antialias: !this.low, powerPreference: this.low ? 'low-power' : 'high-performance', preserveDrawingBuffer: true });
    r.setPixelRatio(this.pr(1.75)); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = !this.low; r.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(r.domElement); r.domElement.className = 'lib3d-canvas';
    this.cam = new THREE.PerspectiveCamera(38, 1, .05, 400);
    this.orbit = new OrbitControls(this.cam, r.domElement); this.orbit.enableDamping = true; this.orbit.minDistance = 1.1; this.orbit.maxDistance = 7;
    this.orbit.maxPolarAngle = Math.PI * .52; this.orbit.minAzimuthAngle = -1.25; this.orbit.maxAzimuthAngle = 1.25; this.orbit.enablePan = false;
    this.orbit.addEventListener('end', () => { const s = new THREE.Spherical().setFromVector3(this.cam.position.clone().sub(this.orbit.target)); this.ev.onCam({ az: +s.theta.toFixed(3), el: +(Math.PI / 2 - s.phi).toFixed(3), dist: +s.radius.toFixed(2) }); });
    this.tc = new TransformControls(this.cam, r.domElement); this.tc.setSize(.8);
    this.tc.addEventListener('dragging-changed', (e: any) => { this.orbit.enabled = !e.value; if (!e.value) this.commitItem(true); });
    this.tc.addEventListener('objectChange', () => this.commitItem(false));
    this.scene.add(this.tc.getHelper());
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(this.low ? 1024 : 2048, this.low ? 1024 : 2048); this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .02;
    Object.assign(this.sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: .5, far: 40 }); this.sun.shadow.radius = 4;
    this.scene.add(this.world, this.caseG, this.booksG, this.itemsG, this.fx, this.lights, this.sun, this.sun.target, this.hemi, this.selBox);
    this.selBox.visible = false;
    const el = r.domElement;
    el.addEventListener('pointerdown', this.down); el.addEventListener('pointermove', this.move); window.addEventListener('pointerup', this.up);
    el.addEventListener('wheel', ev => this.reading?.wheel(ev), { passive: false }); el.addEventListener('dblclick', () => this.reading?.fit());
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.io = new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }); this.io.observe(host);
    this.resize(); this.loop();
  }
  pr(max: number) { return this.low ? Math.min(devicePixelRatio, 1) : Math.min(devicePixelRatio, max); }
  dispose() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.io.disconnect(); window.removeEventListener('pointerup', this.up); this.tc.dispose(); this.orbit.dispose(); this.r.dispose(); this.r.domElement.remove(); }
  resize() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
    if (this.low) { const now = performance.now(); if (now - this.last < 32) return; this.last = now; }
    const dt = Math.min(this.clock.getDelta(), .05), t = this.clock.elapsedTime;
    for (const u of this.low ? [...this.worldUpd, ...this.itemUpd] : [...this.worldUpd, ...this.itemUpd, ...this.fxUpd]) u(t, dt);
    this.fx.visible = !this.low;
    if (this.reading) this.reading.update(dt, t); else this.orbit.update();
    if (this.selBox.visible) this.selBox.update();
    this.r.render(this.scene, this.cam);
  };
  /** Advance the reading animations by s seconds in one go (tests, slow software renderers). */
  step(s: number) { for (let t = 0; t < s; t += .05) { this.clock.elapsedTime += .05; this.reading?.update(.05, this.clock.elapsedTime); } this.r.render(this.scene, this.cam); }
  snapshot(): string { this.r.render(this.scene, this.cam); return this.r.domElement.toDataURL('image/jpeg', .9); }

  setMode(m: 'view' | 'books' | 'decor') { this.mode = m; if (m !== 'decor') this.tc.detach(); this.r.domElement.style.cursor = m === 'books' ? 'grab' : ''; }
  setTool(t: 'translate' | 'rotate' | 'scale') { this.tc.setMode(t); this.tc.showX = true; this.tc.showZ = true; this.tc.showY = t !== 'rotate'; if (t === 'rotate') { this.tc.showX = false; this.tc.showZ = false; this.tc.showY = true; } }

  /** Diff the layout and rebuild only what changed. */
  set(L: Layout, first = false) {
    const k = (o: unknown) => JSON.stringify(o);
    const parts = {
      world: k([L.setting, L.view, L.window, L.wall, L.floor, L.width]),
      case: k([L.mat, L.shelves, L.width, L.spacing, L.depth, L.view, L.setting]),
      books: k([L.books, L.shelves, L.width, L.spacing, L.depth]),
      items: k([L.items, L.lampColor, L.lampOn, L.shelves, L.spacing, L.mat, L.width, L.depth]),
      light: k([L.time, L.ambient, L.exposure, L.view, L.setting, L.lampOn]),
      fx: k([L.weather, L.setting]),
    };
    this.L = L;
    if (parts.world !== this.keys.world) this.buildWorld();
    if (parts.case !== this.keys.case) this.buildCase();
    if (parts.books !== this.keys.books) this.buildBooks();
    if (parts.items !== this.keys.items) this.buildItems();
    if (parts.light !== this.keys.light) this.buildLight();
    if (parts.fx !== this.keys.fx) this.buildFx();
    this.keys = parts;
    if (first || L.preset !== this.lastPreset || L.id !== this.lastId) this.setCam(L.cam);
    this.lastPreset = L.preset; this.lastId = L.id;
    this.refreshSel();
  }
  lastPreset = ''; lastId = '';
  setCam(c: Layout['cam']) {
    c = { ...c, dist: Math.min(this.orbit.maxDistance, c.dist * Math.max(1, 1.15 / (this.cam.aspect || 1.5))) };
    const H = caseHeight(this.L); this.orbit.target.set(0, Math.min(H * .55, 1.1), 0);
    this.cam.position.copy(this.orbit.target).add(new THREE.Vector3().setFromSphericalCoords(c.dist, Math.PI / 2 - c.el, c.az)); this.orbit.update();
  }

  clear(g: THREE.Group) { g.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); g.clear(); }

  async env() {
    const L = this.L, envN = L.setting === 'outdoor' ? HDR[L.view] : HDR.room, bgN = HDR[L.view] || HDR.meadow;
    if (envN !== this.envName) { this.envName = envN; const t = await loadHdr(envN); t.mapping = THREE.EquirectangularReflectionMapping; if (this.envName === envN) this.scene.environment = t; }
    if (bgN !== this.bgName) { this.bgName = bgN; const t = await loadHdr(bgN); t.mapping = THREE.EquirectangularReflectionMapping; if (this.bgName === bgN) { this.scene.background = t; this.ev.onReady(); } }
  }

  // ---------------------------------------------------------------- world
  buildWorld() {
    const L = this.L; this.clear(this.world); this.worldUpd = []; this.surfaces = this.surfaces.filter(s => s.userData.case);
    this.env(); this.scene.fog = null; this.scene.backgroundRotation.set(0, L.view === 'meadow' ? 2.2 : L.view === 'snow' ? 1.2 : 0, 0); this.scene.environmentRotation.copy(this.scene.backgroundRotation);
    const add = (m: THREE.Object3D) => { this.world.add(m); return m; };
    if (L.setting === 'room') {
      const floorMat = L.floor === 'marble' ? pbr('marble_01', 3, { roughness: .25, clearcoat: .6, clearcoatRoughness: .2 }) : pbr('laminate_floor_02', 2.5);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 7), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.z = 2.2; floor.receiveShadow = true; add(floor); this.surfaces.push(floor);
      const wallCol = { plaster: '#e9dccb', sage: '#a3b39b', navy: '#2a3552', oxblood: '#6a2422', wood: '#ffffff' }[L.wall];
      const wallMat = L.wall === 'wood' ? pbr('dark_wood', 2, { color: '#b99a80' }) : pbr('painted_plaster_wall', 2, { color: wallCol, map: tex('painted_plaster_wall_col', 2, true) });
      const z = -L.depth / 2 - .03, W = 9, H = 3.2, wx0 = -L.width / 2 - 1.55, wx1 = -L.width / 2 - .35, wy0 = .75, wy1 = 2.45;
      const box = (x0: number, x1: number, y0: number, y1: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, .12), wallMat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z - .06); m.castShadow = m.receiveShadow = true;
        (m.geometry.attributes.uv as THREE.BufferAttribute).array.forEach(() => 0); add(m); return m; };
      if (L.window) {
        box(-W / 2, wx0, 0, H); box(wx1, W / 2, 0, H); box(wx0, wx1, 0, wy0); box(wx0, wx1, wy1, H);
        const frameM = new THREE.MeshPhysicalMaterial({ color: '#f2eee6', roughness: .45 });
        const bar = (w: number, h: number, x: number, y: number, d = .07) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameM); m.position.set(x, y, z); m.castShadow = true; add(m); };
        const cx = (wx0 + wx1) / 2, cy = (wy0 + wy1) / 2, ww = wx1 - wx0, wh = wy1 - wy0;
        bar(ww + .1, .06, cx, wy0); bar(ww + .1, .06, cx, wy1); bar(.06, wh, wx0, cy); bar(.06, wh, wx1, cy); bar(.035, wh, cx, cy, .04); bar(ww, .035, cx, cy, .04);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(ww + .2, .04, .22), frameM); sill.position.set(cx, wy0 - .02, z + .08); sill.castShadow = sill.receiveShadow = true; add(sill); this.surfaces.push(sill);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: .08, roughness: .02, metalness: 0, envMapIntensity: 1.5 }));
        glass.position.set(cx, cy, z - .01); add(glass);
      } else box(-W / 2, W / 2, 0, H);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, .1, .02), new THREE.MeshPhysicalMaterial({ color: L.wall === 'wood' ? '#3a2616' : '#f0ebe2', roughness: .5 })); skirt.position.set(0, .05, z + .01); skirt.receiveShadow = true; add(skirt);
      // a hint of the room's side walls so light has something to bounce off
      const side = new THREE.Mesh(new THREE.BoxGeometry(.12, H, 7), wallMat); side.position.set(W / 2 - .5, H / 2, 2.2); side.receiveShadow = true; add(side);
      return;
    }
    // ---- outdoors
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), L.floor === 'snow' || L.view === 'snow'
      ? new THREE.MeshPhysicalMaterial({ color: '#f4f7fb', roughness: .75, normalMap: noiseNormal(16, 3, 4), normalScale: new THREE.Vector2(.6, .6), sheen: .5, sheenColor: new THREE.Color('#dfe9ff') })
      : pbr('aerial_grass_rock', 22, { color: '#8fae5e' }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; add(ground); this.surfaces.push(ground);
    (ground.material as THREE.MeshPhysicalMaterial).map?.repeat.set(22, 22);
    if (L.view === 'snow' || L.floor === 'snow') { this.scene.fog = new THREE.FogExp2('#cfd8e3', .02); this.snowDrifts(); }
    else { this.scene.fog = new THREE.FogExp2(L.view === 'night' ? '#0b1020' : '#b9c6cf', .012); this.grass(); }
    if (L.view === 'meadow') this.waterfall();
  }

  snowDrifts() {
    const r = rnd(21), m = new THREE.MeshPhysicalMaterial({ color: '#f6f9fd', roughness: .8, sheen: .6, sheenColor: new THREE.Color('#dde8ff') });
    for (let i = 0; i < 26; i++) { const g = new THREE.SphereGeometry(1, 24, 12); const p = g.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < p.count; j++) { const y = p.getY(j); p.setY(j, Math.max(0, y) * .35); }
      g.computeVertexNormals(); const s = new THREE.Mesh(g, m); const a = r() * Math.PI * 2, d = 4 + r() * 14; s.position.set(Math.cos(a) * d, -.05, Math.sin(a) * d - 3); s.scale.set(1 + r() * 3, .5 + r(), 1 + r() * 2); s.receiveShadow = true; this.world.add(s); }
    // dark pines on the far edge
    const bark = new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: .9 }), nd = new THREE.MeshStandardMaterial({ color: '#1f3326', roughness: .85 }), sn = new THREE.MeshStandardMaterial({ color: '#f3f6fa', roughness: .7 });
    for (let i = 0; i < 34; i++) { const t = new THREE.Group(), h = 3 + r() * 5;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(.06 * h / 4, .1 * h / 4, h * .3, 8), bark); tr.position.y = h * .15; t.add(tr);
      for (let k = 0; k < 5; k++) { const rad = (1 - k / 5) * h * .28 + .2, cone = new THREE.ConeGeometry(rad, h * .32, 10, 1, true); const pp = cone.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < pp.count; j++) { const n = Math.sin(j * 12.9898) * .08 * rad; pp.setX(j, pp.getX(j) + n); pp.setZ(j, pp.getZ(j) + n); } cone.computeVertexNormals();
        const c = new THREE.Mesh(cone, k % 2 ? sn : nd); c.position.y = h * .22 + k * h * .14; c.castShadow = true; t.add(c); }
      const a = -Math.PI * .1 - r() * Math.PI * .8, d = 9 + r() * 16; t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d - 2); t.rotation.y = r() * 6; this.world.add(t); }
  }

  grass() {
    const L = this.L, N = 52000, r = rnd(7);
    const g = new THREE.PlaneGeometry(.022, .32, 1, 4); g.translate(0, .16, 0);
    const p = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / .32; p.setX(i, p.getX(i) * (1 - y * .9)); p.setZ(i, y * y * .06); }
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .65, side: THREE.DoubleSide });
    const U = { t: { value: 0 } };
    m.onBeforeCompile = s => { s.uniforms.uT = U.t; s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.); float h = position.y / .32;
      float w = sin(uT*1.6 + wp.x*.7 + wp.z*.5) * .5 + sin(uT*2.7 + wp.x*1.9) * .25;
      transformed.x += w * h * h * .07; transformed.z += w * h * h * .03;`).replace('#include <color_vertex>', '#include <color_vertex>\n vColor.rgb *= mix(.35, 1.1, position.y/.32);'); };
    const im = new THREE.InstancedMesh(g, m, N); im.receiveShadow = true;
    const o = new THREE.Object3D(), c = new THREE.Color();
    const pool = L.view === 'meadow';
    for (let i = 0; i < N; i++) {
      let x, z; do { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 11; x = Math.cos(a) * d; z = Math.sin(a) * d + 1; } while ((pool && Math.hypot((x - 3.2) / 1.4, z + 6.4) < 2.3) || (Math.abs(x) < L.width / 2 + .25 && Math.abs(z) < L.depth / 2 + .35));
      o.position.set(x, 0, z); o.rotation.set((r() - .5) * .3, r() * Math.PI, (r() - .5) * .3); const near = Math.min(1, Math.hypot(x, z - .4) / 3), s = .45 + r() * .5; o.scale.set(s, s * (.35 + r() * .5) * (.55 + near * .6), s); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      c.setHSL(.21 + r() * .07, .5 + r() * .2, .24 + r() * .14); im.setColorAt(i, c);
    }
    this.world.add(im); this.worldUpd.push(t => { U.t.value = t; });
    // wildflowers
    const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 6, 4), new THREE.MeshStandardMaterial({ roughness: .6 }), 700);
    for (let i = 0; i < 700; i++) { const a = r() * 6.28, d = 1.2 + Math.sqrt(r()) * 9; o.position.set(Math.cos(a) * d, .22 + r() * .12, Math.sin(a) * d + 1); o.scale.setScalar(1); o.updateMatrix(); fl.setMatrixAt(i, o.matrix); fl.setColorAt(i, c.set(['#f4f1e6', '#f2d24a', '#c9a2e6', '#ffffff'][i % 4])); }
    this.world.add(fl);
  }

  /** a soft ring of broadleaf trees so the meadow has a horizon */
  forest() {
    const r = rnd(55), bark = new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: .9 });
    const leafG = new THREE.IcosahedronGeometry(1, 2), p = leafG.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + Math.sin(v.x * 5 + v.y * 3) * .12 + Math.sin(v.z * 7) * .08); p.setXYZ(i, v.x, v.y, v.z); } leafG.computeVertexNormals();
    const leaves = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ roughness: .85, flatShading: true }), 420), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.08, .14, 1, 6), bark, 90);
    const o = new THREE.Object3D(), c = new THREE.Color(); let li = 0, ti = 0;
    for (let i = 0; i < 90; i++) { const a = -Math.PI * .95 + r() * Math.PI * 1.9 + Math.PI, d = 13 + r() * 12, x = Math.sin(a) * d, z = Math.cos(a) * d - 2; if (Math.abs(x - 3.2) < 3 && z < -5) continue; const h = 3 + r() * 4;
      o.position.set(x, h * .25, z); o.rotation.set(0, 0, 0); o.scale.set(1, h * .5, 1); o.updateMatrix(); trunks.setMatrixAt(ti++, o.matrix);
      for (let k = 0; k < 4 && li < 420; k++, li++) { const sc = h * (.22 + r() * .14); o.position.set(x + (r() - .5) * h * .3, h * (.55 + r() * .3), z + (r() - .5) * h * .3); o.scale.set(sc, sc * (.8 + r() * .3), sc); o.rotation.set(r(), r(), r()); o.updateMatrix(); leaves.setMatrixAt(li, o.matrix); leaves.setColorAt(li, c.setHSL(.24 + r() * .06, .35 + r() * .2, .16 + r() * .1)); } }
    leaves.count = li; trunks.count = ti; leaves.castShadow = true; trunks.castShadow = true; this.world.add(leaves, trunks);
  }

  rockGeo(seed: number, detail = 4) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position as THREE.BufferAttribute, r = rnd(seed), ph = [r() * 9, r() * 9, r() * 9];
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 2.1 + ph[0]) * Math.cos(v.y * 2.7 + ph[1]) * .18 + Math.sin(v.z * 4.3 + v.x * 3 + ph[2]) * .08 + Math.sin(v.y * 9 + v.z * 7) * .025;
      v.multiplyScalar(1 + n); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    // triplanar-ish UVs from position so the rock texture doesn't smear
    const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, v.x * .5 + v.z * .5, v.y * .6); }
    return g;
  }

  /** Meadow Falls: a rock cliff, a shader-driven waterfall, foam, drifting mist and a reflective plunge pool. */
  waterfall() {
    const W = this.world, cx = 3.2, cz = -8.2, top = 4.4;
    const rockM = pbr('rock_face', 1.5, { color: '#d8d0c2', roughness: 1, envMapIntensity: 2.6 });
    const rockM2 = pbr('rock_face', 1, { color: '#b3ab9e', envMapIntensity: 2.6 });
    this.forest();
    const r = rnd(33);
    // cliff: a wall of big overlapping boulders with a notch for the falls
    for (let i = 0; i < 26; i++) {
      const x = -7 + i * .62 + (r() - .5) * .4; if (Math.abs(x - cx) < .55) continue;
      const h = top - .4 + (r() - .3) * 1.6 - Math.max(0, Math.abs(x - cx) - 5) * .4;
      const m = new THREE.Mesh(this.rockGeo(100 + i), i % 3 ? rockM : rockM2); m.scale.set(.9 + r() * .7, h / 2 + .3, 1.2 + r() * .6); m.position.set(x, h / 2 - .2, cz - .5 - r() * .6); m.rotation.y = r() * 3; m.castShadow = m.receiveShadow = true; W.add(m);
    }
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(this.rockGeo(300 + i), rockM2); m.scale.set(1.1, top / 2, 1.2); m.position.set(cx + (i - 1) * .3, top / 2 - 1.6, cz - 1.6); W.add(m); }
    // lip rocks and the boulders around the pool
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 1.2 + Math.PI * .9, d = 1.9 + r() * .5; const m = new THREE.Mesh(this.rockGeo(200 + i, 3), rockM);
      const s = .25 + r() * .45; m.scale.set(s * 1.4, s * .8, s); m.position.set(cx + Math.cos(a) * d * 1.4, s * .25, cz + 1.8 + Math.sin(a) * d * .9); m.rotation.set(r(), r() * 3, r()); m.castShadow = m.receiveShadow = true; W.add(m); }
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(this.rockGeo(260 + i, 3), rockM2); const s = .12 + r() * .25; m.scale.set(s * 1.3, s * .7, s); m.position.set(-2.5 + r() * 9, s * .2, -2 - r() * 4); m.rotation.y = r() * 3; m.castShadow = m.receiveShadow = true; W.add(m); }
    // the falling sheet: two layered shader strips, slightly curved over the lip
    const sheet = (w: number, z: number, speed: number, op: number, seed: number) => {
      const g = new THREE.PlaneGeometry(w, top + .3, 24, 64), p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), yy = (y + (top + .3) / 2) / (top + .3), x = p.getX(i);
        p.setZ(i, Math.pow(yy, 6) * -.35 + (1 - yy) * .25 + Math.cos(x / w * 3) * .05); p.setX(i, x * (1 + (1 - yy) * .35)); }
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uT: { value: 0 }, uSp: { value: speed }, uOp: { value: op }, uSeed: { value: seed }, uLight: { value: 1 } },
        vertexShader: `varying vec2 vUv; varying vec3 vW;
          void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uT, uSp, uOp, uSeed, uLight; varying vec2 vUv; varying vec3 vW;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
          void main(){
            float y = vUv.y; float accel = 1. + (1.-y)*1.8;
            vec2 q = vec2(vUv.x*14. + uSeed, y*3. + uT*uSp*accel);
            float streak = fbm(vec2(q.x, q.y*.35)) ; float fine = fbm(vec2(vUv.x*40.+uSeed*3., y*6. + uT*uSp*1.6*accel));
            float body = smoothstep(.25, .75, streak*.7 + fine*.5);
            float edge = smoothstep(0., .16, vUv.x) * smoothstep(1., .84, vUv.x);
            float holes = smoothstep(.15, .45, fbm(vec2(vUv.x*6.+uSeed, y*2. + uT*uSp*.8))) ;
            float a = edge * mix(.35, 1., body) * mix(.55, 1., holes) * uOp;
            a *= smoothstep(1., .96, y);
            vec3 deep = vec3(.42,.52,.55), white = vec3(.96,.98,1.);
            vec3 col = mix(deep, white, clamp(body*1.1 + (1.-y)*.35, 0., 1.)) * uLight;
            gl_FragColor = vec4(col, a);
          }` });
      const mesh = new THREE.Mesh(g, m); mesh.position.set(cx, (top + .3) / 2 - .35, cz + .55 + z); W.add(mesh);
      this.worldUpd.push(t => { m.uniforms.uT.value = t; m.uniforms.uLight.value = this.dayLight; }); return mesh;
    };
    sheet(1.05, 0, .9, .95, 1); sheet(1.3, .08, 1.25, .55, 7); sheet(.7, .14, 1.6, .5, 13);
    // plunge pool
    const pg = new THREE.CircleGeometry(1, 64); pg.scale(2.2, 1.6, 1);
    const nm = noiseNormal(6, 4, 8); nm.repeat.set(3, 3);
    const nm2 = noiseNormal(10, 3, 12); 
    const water = new THREE.Mesh(pg, new THREE.MeshPhysicalMaterial({ color: '#1d3a3f', roughness: .04, metalness: 0, normalMap: nm, normalScale: new THREE.Vector2(.35, .35), clearcoat: 1, clearcoatNormalMap: nm2, clearcoatNormalScale: new THREE.Vector2(.2, .2), envMapIntensity: 1.3 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, .03, cz + 1.8); water.receiveShadow = true; W.add(water);
    const bank = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 64), new THREE.MeshStandardMaterial({ color: '#3d3a2a', roughness: 1 })); bank.geometry.scale(2.2, 1.6, 1); bank.rotation.x = -Math.PI / 2; bank.position.set(cx, .02, cz + 1.8); W.add(bank);
    this.worldUpd.push((t) => { nm.offset.set(t * .02, t * .05); nm2.offset.set(-t * .03, t * .02); });
    // foam & spray particles
    const N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { seed[i] = r(); pos[i * 3] = cx + (r() - .5) * 1.3; pos[i * 3 + 1] = .05; pos[i * 3 + 2] = cz + .9 + (r() - .5) * .5; }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const fm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uMap: { value: softSprite() }, uLight: { value: 1 } },
      vertexShader: `attribute float seed; uniform float uT; varying float vA;
        void main(){ float life = fract(uT*.35 + seed*7.); vec3 p = position; float ang = seed*40.;
          p.x += cos(ang)*life*1.1; p.z += sin(ang)*life*.8 + life*.5; p.y += sin(life*3.1416)*(.35+seed*.6);
          vA = (1.-life) * smoothstep(0., .08, life); vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = (40. + seed*90.) * (1.+life*1.5) / -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uLight; varying float vA; void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(.95,.97,1.)*uLight, c.a*vA*.55); }` });
    W.add(new THREE.Points(fg, fm)); this.worldUpd.push(t => { fm.uniforms.uT.value = t; fm.uniforms.uLight.value = this.dayLight; });
    // billowing mist
    const mist: THREE.Sprite[] = [];
    for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudSprite(), transparent: true, depthWrite: false, opacity: .35, fog: true })); s.userData = { ph: r() * 10, x: cx + (r() - .5) * 2.2, s: 1.4 + r() * 2 }; W.add(s); mist.push(s); }
    this.worldUpd.push(t => mist.forEach(s => { const u = s.userData, life = (t * .06 + u.ph) % 1; s.position.set(u.x + Math.sin(t * .2 + u.ph) * .4, .3 + life * 2.4, cz + 1.2 + life * 1.2); s.scale.setScalar(u.s * (1 + life)); (s.material as THREE.SpriteMaterial).opacity = .2 * Math.sin(life * Math.PI) * this.dayLight; s.material.rotation = u.ph + t * .03; }));
  }
  dayLight = 1;

  // ---------------------------------------------------------------- bookcase
  caseMat() {
    const m = this.L.mat;
    if (m === 'walnut') return pbr('dark_wood', 1.2, { color: '#c8a68a', clearcoat: .35, clearcoatRoughness: .4 });
    if (m === 'oak') return pbr('oak_veneer_01', 1.2, { clearcoat: .25, clearcoatRoughness: .5 });
    if (m === 'marble') return pbr('marble_01', 1, { roughness: .2, clearcoat: .8, clearcoatRoughness: .15 });
    if (m === 'steel') return new THREE.MeshPhysicalMaterial({ color: '#b9bec4', metalness: 1, roughness: .32, normalMap: noiseNormal(40, .6, 2), normalScale: new THREE.Vector2(.2, .2) });
    if (m === 'white') return new THREE.MeshPhysicalMaterial({ color: '#efece6', roughness: .42, clearcoat: .3, clearcoatRoughness: .3 });
    return new THREE.MeshPhysicalMaterial({ color: '#2a2e33', metalness: .9, roughness: .3 });
  }
  buildCase() {
    const L = this.L; this.clear(this.caseG); this.surfaces = this.surfaces.filter(s => !s.userData.case);
    const W = L.width, D = L.depth, H = caseHeight(L), T = .03, mat = this.caseMat();
    const glass = L.mat === 'glass', gm = new THREE.MeshPhysicalMaterial({ color: '#dff4ee', roughness: .03, transmission: 1, thickness: .02, ior: 1.5, transparent: true, opacity: .55, metalness: 0 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = mat, surface = false) => {
      const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * .25); const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.caseG.add(mesh);
      if (surface) { mesh.userData.case = true; this.surfaces.push(mesh); } return mesh; };
    box(T, H, D, -W / 2 + T / 2, H / 2, 0); box(T, H, D, W / 2 - T / 2, H / 2, 0);
    box(W + .03, T, D + .03, 0, H - T / 2, .005, mat, true);
    box(W - T * 2, PLINTH, D * .92, 0, PLINTH / 2, .0);
    if (!glass) box(W - T * 2, H - T, .012, 0, H / 2, -D / 2 + .006, mat); else box(W - T * 2, H - T, .006, 0, H / 2, -D / 2 + .003, gm);
    for (let i = 0; i < L.shelves; i++) { const y = PLINTH + i * L.spacing; if (i === 0) { box(W - T * 2, BOARD, D - .02, 0, y - BOARD / 2 + .002, .0, mat, true); continue; }
      box(W - T * 2, glass ? .012 : BOARD, D - .02, 0, y - BOARD / 2, 0, glass ? gm : mat, true); }
    // crown moulding
    if (!glass && L.mat !== 'steel') box(W + .07, .035, D + .06, 0, H + .017, .01, mat, true);
    this.caseG.traverse(o => { if ((o as THREE.Mesh).isMesh) o.userData.case = true; });
    if (L.setting === 'outdoor' && L.view === 'snow') { // a dusting of snow on top
      const s = new THREE.Mesh(new RoundedBoxGeometry(W + .05, .03, D + .05, 2, .012), new THREE.MeshPhysicalMaterial({ color: '#f7f9fc', roughness: .8, sheen: .6 })); s.position.set(0, H + .045, .01); s.castShadow = true; this.caseG.add(s); }
  }

  // ---------------------------------------------------------------- books
  bookMesh(b: BookSlot) {
    const g = new THREE.Group(), d = Math.min(this.L.depth - .06, .17 + (b.h - .21) * .6), h = b.h, t = b.t, st = spineTex(b);
    const coverM = new THREE.MeshPhysicalMaterial({ map: st.cover, roughness: b.tex === 'leather' ? .55 : .85, sheen: b.tex === 'cloth' ? .5 : 0, sheenColor: new THREE.Color(b.color).multiplyScalar(1.6), clearcoat: b.tex === 'leather' ? .3 : 0 });
    const spineM = new THREE.MeshPhysicalMaterial({ map: st.map, roughnessMap: st.orm, metalnessMap: st.orm, roughness: 1, metalness: 1, sheen: b.tex === 'cloth' ? .4 : 0, sheenColor: new THREE.Color(b.color).multiplyScalar(1.5), clearcoat: b.tex === 'leather' ? .25 : 0 });
    const pageM = new THREE.MeshPhysicalMaterial({ map: pageTex(), roughness: .9 });
    const board = .0035;
    for (const s of [-1, 1]) { const c = new THREE.Mesh(new RoundedBoxGeometry(board, h, d, 2, .0012), coverM); c.position.set(s * (t / 2 - board / 2), h / 2, 0); c.castShadow = c.receiveShadow = true; g.add(c); }
    // spine: rounded, slightly proud of the boards
    const sg = new THREE.CylinderGeometry(t / 2, t / 2, h, 16, 1, true, -Math.PI / 2, Math.PI); sg.scale(1, 1, .35);
    const sp = new THREE.Mesh(sg, spineM); sp.position.set(0, h / 2, d / 2 - .002); sp.castShadow = true; g.add(sp);
    // page block, inset from head, tail and fore-edge
    const pg = new THREE.Mesh(new THREE.BoxGeometry(t - board * 2, h - .008, d - .006), pageM); pg.position.set(0, h / 2, -.002); pg.receiveShadow = true; g.add(pg);
    g.userData = { book: String(b.id), w: t, h, d };
    g.traverse(o => { o.userData.book = String(b.id); });
    return g;
  }
  shelfY = (i: number) => PLINTH + i * this.L.spacing;
  layoutBooks() {
    const L = this.L, inner = L.width - .06 - .02, r = rnd(5);
    const by = new Map<number, BookSlot[]>(); L.books.forEach(b => { const s = Math.min(L.shelves - 1, Math.max(0, b.shelf)); by.set(s, [...(by.get(s) ?? []), b]); });
    const pos = new Map<string, { x: number; y: number; lean: number; scale: number }>();
    by.forEach((list, s) => {
      const total = list.reduce((a, b) => a + b.t, 0) + list.length * .002, k = total > inner ? inner / total : 1;
      let x = -inner / 2 + .005; const maxH = L.spacing - BOARD - .012;
      list.forEach((b, i) => { const w = b.t * k; const last = i === list.length - 1 && total < inner * .8;
        pos.set(String(b.id), { x: x + w / 2 + (last ? .012 : 0), y: this.shelfY(s) + (s === 0 ? .002 : 0), lean: last ? -.09 : (r() - .5) * .01, scale: Math.min(1, maxH / b.h) }); x += w + .002 * k; });
    });
    return pos;
  }
  buildBooks() {
    this.clear(this.booksG); const pos = this.layoutBooks(), D = this.L.depth;
    for (const b of this.L.books) { const m = this.bookMesh(b), p = pos.get(String(b.id)); if (!p) continue;
      m.position.set(p.x, p.y, D / 2 - .1 - (m.userData.d ?? 0)); m.position.z = D / 2 - (Math.min(D - .06, .17 + (b.h - .21) * .6)) / 2 - .02;
      m.scale.set(1, p.scale, 1); m.rotation.z = p.lean; if (p.lean < -.05) m.position.x += .02;
      this.booksG.add(m); }
  }

  // ---------------------------------------------------------------- decor
  dayTime() { const t = this.L.time; return Math.sin(((t - 6) / 12) * Math.PI); }
  itemMesh(it: Item): THREE.Object3D {
    const g = new THREE.Group(), L = this.L, r = rnd(it.id.split('').reduce((a, c) => a + c.charCodeAt(0), 1));
    const brass = new THREE.MeshPhysicalMaterial({ color: '#c9a25a', metalness: 1, roughness: .28 });
    const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    const lathe = (pts: [number, number][], m: THREE.Material, seg = 48) => mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), m);
    const leafGeo = (len: number, wid: number) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(wid, len * .4, 0, len); s.quadraticCurveTo(-wid, len * .4, 0, 0);
      const lg = new THREE.ShapeGeometry(s, 8); const p = lg.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / len, x = p.getX(i); p.setZ(i, -y * y * len * .55 + Math.abs(x) * .4); } lg.computeVertexNormals(); return lg; };
    switch (it.kind) {
      case 'plant': case 'fern': {
        const clay = new THREE.MeshPhysicalMaterial({ color: it.kind === 'fern' ? '#e9e4da' : '#b0623e', roughness: it.kind === 'fern' ? .3 : .85, clearcoat: it.kind === 'fern' ? .5 : 0, normalMap: noiseNormal(20, 1.5, 6), normalScale: new THREE.Vector2(.3, .3) });
        lathe([[0, 0], [.07, 0], [.085, .14], [.095, .15], [.095, .17], [.085, .17], [.08, .16], [0, .16]], clay);
        mesh(new THREE.CircleGeometry(.08, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2e2016', roughness: 1 }), 0, .155, 0);
        const leafM = new THREE.MeshPhysicalMaterial({ color: '#3f6b2e', roughness: .5, side: THREE.DoubleSide, sheen: .4, sheenColor: new THREE.Color('#9fd070'), clearcoat: .3, clearcoatRoughness: .5 });
        const n = it.kind === 'fern' ? 22 : 13;
        for (let i = 0; i < n; i++) { const lf = new THREE.Mesh(it.kind === 'fern' ? leafGeo(.32 + r() * .14, .028) : leafGeo(.2 + r() * .12, .07), leafM.clone());
          (lf.material as THREE.MeshPhysicalMaterial).color.offsetHSL((r() - .5) * .04, 0, (r() - .5) * .1);
          lf.position.set(0, .15, 0); lf.rotation.set(-(.25 + r() * (it.kind === 'fern' ? .9 : .6)), 0, 0, 'YXZ'); lf.rotation.y = i / n * Math.PI * 2 + r() * .4; lf.castShadow = true; g.add(lf); }
        break; }
      case 'lamp': {
        const floor = it.y < .02;
        const hgt = floor ? 1.45 : .42;
        lathe([[0, 0], [.13, 0], [.13, .015], [.06, .03], [.012, .04], [0, .04]].map(([x, y]) => [x * (floor ? 1 : .7), y]) as [number, number][], brass);
        mesh(new THREE.CylinderGeometry(.008, .008, hgt, 12), brass, 0, hgt / 2 + .03, 0);
        const shade = new THREE.MeshPhysicalMaterial({ color: '#efe3c8', roughness: .9, side: THREE.DoubleSide, transmission: .3, thickness: .01, emissive: new THREE.Color(L.lampColor), emissiveIntensity: L.lampOn ? .9 : 0 });
        const s = floor ? 1 : .65;
        const sh = mesh(new THREE.CylinderGeometry(.11 * s, .2 * s, .24 * s, 40, 1, true), shade, 0, hgt + .1 * s, 0); sh.castShadow = false;
        if (L.lampOn) { const bulb = mesh(new THREE.SphereGeometry(.03 * s, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.lampColor).multiplyScalar(3) }), 0, hgt + .05 * s, 0); bulb.castShadow = false;
          const sp = new THREE.SpotLight(L.lampColor, floor ? 9 : 4, 6, 1.05, .7, 2); sp.position.set(0, hgt + .06 * s, 0); sp.target.position.set(.15, 0, .2); sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -.0005; sp.shadow.radius = 6; g.add(sp, sp.target);
          const pl = new THREE.PointLight(L.lampColor, floor ? 1.6 : .8, 4, 2); pl.position.set(0, hgt + .2 * s, 0); g.add(pl); }
        break; }
      case 'candle': {
        const wax = new THREE.MeshPhysicalMaterial({ color: '#f1e6cf', roughness: .5, transmission: .35, thickness: .05, emissive: '#ff9a4a', emissiveIntensity: L.lampOn ? .08 : 0 });
        lathe([[0, 0], [.055, 0], [.06, .012], [.05, .02], [.05, .025], [0, .025]], brass);
        mesh(new THREE.CylinderGeometry(.022, .023, .14 + r() * .05, 24), wax, 0, .1, 0);
        const top = .17 + .025;
        mesh(new THREE.CylinderGeometry(.0012, .0012, .012, 6), new THREE.MeshBasicMaterial({ color: '#111' }), 0, top, 0);
        if (L.lampOn) { const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#ffb35c', blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.set(.025, .06, 1); fl.position.set(0, top + .022, 0); g.add(fl);
          const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: '#fff3d6', blending: THREE.AdditiveBlending, depthWrite: false })); core.scale.set(.012, .03, 1); core.position.set(0, top + .016, 0); g.add(core);
          const pl = new THREE.PointLight('#ff9e4f', .5, 2.2, 2); pl.position.set(0, top + .05, 0); g.add(pl);
          const ph = r() * 10; this.itemUpd.push(t => { const f = .85 + Math.sin(t * 13 + ph) * .06 + Math.sin(t * 29 + ph) * .05 + (Math.random() - .5) * .06; pl.intensity = .5 * f; fl.scale.set(.025 * (2 - f), .06 * f, 1); fl.position.x = Math.sin(t * 3 + ph) * .002; }); }
        break; }
      case 'rug': {
        const m = new THREE.MeshPhysicalMaterial({ color: it.color ?? '#6d2a22', roughness: 1, normalMap: tex('fabric_pattern_07_nor', 4), roughnessMap: tex('fabric_pattern_07_rough', 4), sheen: 1, sheenColor: new THREE.Color(it.color ?? '#6d2a22').multiplyScalar(1.8), sheenRoughness: .6 });
        const rg = mesh(new RoundedBoxGeometry(1.6, .01, 1.05, 2, .004), m, 0, .005, 0); rg.castShadow = false;
        const border = new THREE.Mesh(new THREE.RingGeometry(.6, .63, 4, 1), new THREE.MeshStandardMaterial({ color: '#d8c28a', roughness: 1 })); border.geometry.rotateZ(Math.PI / 4); border.geometry.scale(1.62, 1.02, 1); border.rotation.x = -Math.PI / 2; border.position.y = .0105; g.add(border);
        break; }
      case 'armchair': case 'footstool': {
        const fab = new THREE.MeshPhysicalMaterial({ color: it.color ?? '#7a2e2a', roughness: .95, normalMap: tex('fabric_pattern_07_nor', 3), sheen: 1, sheenColor: new THREE.Color(it.color ?? '#7a2e2a').multiplyScalar(1.6), sheenRoughness: .5 });
        const wood = new THREE.MeshPhysicalMaterial({ color: '#3b2416', roughness: .45, clearcoat: .6 });
        const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = fab) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(.04, w / 3, h / 3, d / 3)), m, x, y, z);
        const legs = (w: number, d: number, h: number) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.CylinderGeometry(.018, .012, h, 10), wood, sx * (w / 2 - .05), h / 2, sz * (d / 2 - .05)); };
        if (it.kind === 'footstool') { legs(.42, .32, .14); box(.44, .16, .34, 0, .22, 0); break; }
        legs(.72, .7, .12);
        box(.66, .14, .62, 0, .19, .02);            // base
        box(.56, .1, .54, 0, .31, .05);             // seat cushion
        box(.66, .62, .14, 0, .62, -.27);           // back
        box(.14, .34, .64, -.33, .4, 0); box(.14, .34, .64, .33, .4, 0); // arms
        box(.12, .3, .2, -.31, .78, -.2); box(.12, .3, .2, .31, .78, -.2); // wings
        break; }
      case 'sidetable': {
        const wood = new THREE.MeshPhysicalMaterial({ color: it.color ?? '#5a3a22', roughness: .4, clearcoat: .7, clearcoatRoughness: .25 });
        mesh(new THREE.CylinderGeometry(.24, .24, .03, 48), wood, 0, .56, 0);
        lathe([[0, 0], [.14, 0], [.14, .02], [.05, .05], [.03, .2], [.04, .4], [.025, .54], [0, .55]], wood);
        break; }
      case 'fireplace': {
        const stone = new THREE.MeshPhysicalMaterial({ color: it.color ?? '#b9ab95', roughness: .85, normalMap: noiseNormal(30, 2, 5), normalScale: new THREE.Vector2(.6, .6) });
        const soot = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 1 });
        const blk = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = stone) => mesh(new RoundedBoxGeometry(w, h, d, 2, .01), m, x, y, z);
        blk(.18, .9, .3, -.41, .45, 0); blk(.18, .9, .3, .41, .45, 0); blk(1, .16, .34, 0, .98, 0); blk(1.1, .04, .4, 0, 1.08, .01); // jambs, lintel, mantel shelf
        blk(.64, .74, .04, 0, .37, -.13, soot); blk(1.04, .04, .5, 0, .02, .06);                                                   // firebox back, hearth
        const log = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: .9 });
        for (const [x, ry] of [[-.08, .35], [.08, -.35]] as const) { const l = mesh(new THREE.CylinderGeometry(.04, .045, .42, 10), log, x, .08, 0); l.rotation.set(0, ry, Math.PI / 2); }
        if (L.lampOn) {
          for (let i = 0; i < 5; i++) { const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: i % 2 ? '#ff8a2a' : '#ffc060', blending: THREE.AdditiveBlending, depthWrite: false }));
            fl.scale.set(.14 + r() * .08, .22 + r() * .14, 1); fl.position.set((r() - .5) * .3, .2 + r() * .08, .02); g.add(fl); }
          const pl = new THREE.PointLight('#ff9a4a', 2.2, 4, 2); pl.position.set(0, .3, .25); g.add(pl);
        }
        break; }
      case 'ladder': {
        const wood = new THREE.MeshPhysicalMaterial({ color: it.color ?? '#6b4428', roughness: .5, clearcoat: .5 });
        const lad = new THREE.Group(); lad.rotation.x = -.22; g.add(lad);
        for (const x of [-.2, .2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.035, 1.9, .05), wood); rail.position.set(x, .95, 0); rail.castShadow = true; lad.add(rail); }
        for (let k = 0; k < 7; k++) { const rung = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .4, 10), wood); rung.rotation.z = Math.PI / 2; rung.position.set(0, .22 + k * .25, 0); rung.castShadow = true; lad.add(rung); }
        break; }
      case 'globe': {
        lathe([[0, 0], [.08, 0], [.08, .012], [.03, .02], [.012, .06], [.012, .1], [0, .1]], new THREE.MeshPhysicalMaterial({ color: '#4a2f1d', roughness: .4, clearcoat: .6 }));
        const tilt = new THREE.Group(); tilt.position.y = .22; tilt.rotation.z = .41; g.add(tilt);
        const sph = new THREE.Mesh(new THREE.SphereGeometry(.11, 48, 32), new THREE.MeshPhysicalMaterial({ map: globeTex(), roughness: .35, clearcoat: .8, clearcoatRoughness: .2 })); sph.castShadow = true; tilt.add(sph);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.125, .005, 8, 64, Math.PI * 1.3), brass); ring.rotation.z = -Math.PI * .15; ring.castShadow = true; tilt.add(ring);
        this.itemUpd.push(t => { sph.rotation.y = t * .08; });
        break; }
      case 'frame': {
        const gilt = new THREE.MeshPhysicalMaterial({ color: '#b48a3e', metalness: 1, roughness: .35 });
        const art = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'sky/milkyway.webp'); art.colorSpace = THREE.SRGBColorSpace;
        const fw = .34, fh = .26; const fr = new THREE.Group(); fr.rotation.x = -.14; fr.position.set(0, fh / 2 + .01, 0); g.add(fr);
        for (const [w, h, x, y] of [[fw, .025, 0, fh / 2], [fw, .025, 0, -fh / 2], [.025, fh, fw / 2, 0], [.025, fh, -fw / 2, 0]] as const) { const b = new THREE.Mesh(new RoundedBoxGeometry(w + .02, h, .03, 2, .008), gilt); b.position.set(x, y, 0); b.castShadow = true; fr.add(b); }
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(fw - .01, fh - .01), new THREE.MeshPhysicalMaterial({ map: art, roughness: .6 })); pic.position.z = .001; fr.add(pic);
        break; }
      case 'figurine': {
        const marble = pbr('marble_01', .6, { roughness: .3, clearcoat: .4 });
        lathe([[0, 0], [.06, 0], [.06, .03], [.04, .04], [.035, .06], [.045, .08], [0, .08]], marble);
        const torso = mesh(new THREE.SphereGeometry(.07, 32, 24), marble, 0, .12, 0); torso.scale.set(1.25, .75, .7);
        const neck = mesh(new THREE.CylinderGeometry(.022, .026, .05, 20), marble, 0, .18, 0); neck.castShadow = true;
        const head = mesh(new THREE.SphereGeometry(.042, 32, 24), marble, 0, .23, .005); head.scale.set(.9, 1.15, 1);
        mesh(new THREE.ConeGeometry(.008, .02, 8).rotateX(Math.PI / 2), marble, 0, .228, .045);
        break; }
      case 'vase': {
        const glaze = new THREE.MeshPhysicalMaterial({ color: it.color ?? '#2c4a5a', roughness: .12, clearcoat: 1, clearcoatRoughness: .05 });
        lathe([[0, 0], [.04, 0], [.07, .06], [.075, .12], [.05, .2], [.03, .24], [.038, .26], [.034, .26], [.026, .24], [0, .24]], glaze);
        break; }
      case 'clock': {
        const wood = pbr('dark_wood', .4, { color: '#a07e64', clearcoat: .6 });
        mesh(new RoundedBoxGeometry(.2, .05, .1, 2, .01), wood, 0, .025, 0);
        const body = mesh(new THREE.CylinderGeometry(.085, .085, .07, 48), wood, 0, .13, 0); body.rotation.x = Math.PI / 2;
        const face = mesh(new THREE.CircleGeometry(.07, 48), new THREE.MeshPhysicalMaterial({ map: clockFace(), roughness: .3, clearcoat: 1 }), 0, .13, .0355); face.castShadow = false;
        const bez = mesh(new THREE.TorusGeometry(.072, .006, 8, 48), brass, 0, .13, .036); bez.castShadow = false;
        break; }
    }
    g.position.set(it.x, it.y, it.z); g.rotation.y = it.ry; g.scale.setScalar(it.s);
    g.userData.item = it.id; g.traverse(o => { o.userData.item = it.id; });
    return g;
  }
  buildItems() {
    this.tc.detach(); this.clear(this.itemsG); this.itemUpd = [];
    for (const it of this.L.items) { const m = this.itemMesh(it); this.itemsG.add(m); }
    // settle everything onto whatever surface is below it
    this.itemsG.children.forEach(m => this.settle(m));
  }
  settle(o: THREE.Object3D) {
    const ray = new THREE.Raycaster(new THREE.Vector3(o.position.x, o.position.y + .3, o.position.z), new THREE.Vector3(0, -1, 0), 0, 4);
    const hits = ray.intersectObjects(this.surfaces, false); o.position.y = hits.length ? hits[0].point.y : 0;
  }

  // ---------------------------------------------------------------- light
  buildLight() {
    const L = this.L, outdoor = L.setting === 'outdoor', d = this.dayTime(), day = Math.max(0, d), night = L.view === 'night';
    const el = Math.max(.08, d) * 1.1, az = ((L.time - 6) / 12) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(az) * -4, Math.sin(el) * 7 + 1, -6 - Math.sin(az) * 2);
    this.sun.position.copy(dir); this.sun.target.position.set(0, .5, 0);
    const warm = new THREE.Color().setHSL(.08, .9, .55 + .4 * Math.min(1, day * 1.6)), moon = new THREE.Color('#9fb4ff');
    this.sun.color.copy(d > .05 && !night ? warm : moon); this.sun.intensity = night || d <= .05 ? .25 : (outdoor ? 3.2 : 4.2) * Math.min(1, day * 1.5 + .2);
    const envI = night ? .35 : (.2 + .9 * Math.min(1, day * 1.4 + .1));
    this.dayLight = night ? .35 : .4 + .6 * Math.min(1, day * 2);
    this.scene.environmentIntensity = (outdoor ? envI : envI * .6) * L.ambient * 1.4;
    this.scene.backgroundIntensity = night ? 1 : envI;
    this.hemi.intensity = .15 * L.ambient;
    this.r.toneMappingExposure = L.exposure * (night ? 1.1 : 1);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.set(night ? '#0b1020' : L.view === 'snow' ? '#cfd8e3' : '#b9c6cf').multiplyScalar(this.dayLight);
  }

  // ---------------------------------------------------------------- weather
  buildFx() {
    const w = this.L.weather; this.clear(this.fx); this.fxUpd = []; if (w === 'none') return;
    const N = w === 'rain' ? 2500 : w === 'snow' ? 2600 : w === 'fireflies' ? 90 : w === 'petals' ? 260 : 400, r = rnd(3);
    const area = this.L.setting === 'outdoor' ? [9, 5, 7] : w === 'rain' || w === 'snow' ? [2.4, 2.6, .4] : [3, 2.2, 2.5];
    const off = this.L.setting === 'room' && (w === 'rain' || w === 'snow') ? [-this.L.width / 2 - .95, 1.6, -this.L.depth / 2 - .6] : [0, area[1] / 2, 0];
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (r() - .5) * area[0]; pos[i * 3 + 1] = r() * area[1]; pos[i * 3 + 2] = (r() - .5) * area[2]; seed[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const cfg = { snow: ['.55', '1.,1.,1.', '3.5', '.85'], rain: ['3.2', '.75,.8,.9', '1.4', '.35'], dust: ['.03', '1.,.85,.6', '1.2', '.5'], fireflies: ['.05', '1.,.9,.4', '4.', '1.'], petals: ['.35', '1.,.82,.86', '4.', '.9'] }[w];
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: w === 'fireflies' || w === 'dust' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uT: { value: 0 }, uMap: { value: softSprite() }, uH: { value: area[1] } },
      vertexShader: `attribute float seed; uniform float uT, uH; varying float vS;
        void main(){ vec3 p = position; float sp = ${cfg[0]} * (.6 + seed*.8);
          p.y = mod(p.y - uT*sp, uH); p.x += sin(uT*.7 + seed*30.)*.15*${w === 'rain' ? '0.' : '1.'}; p.z += cos(uT*.5 + seed*20.)*.1*${w === 'rain' ? '0.' : '1.'};
          ${w === 'fireflies' || w === 'dust' ? 'p.y = position.y + sin(uT*.6+seed*40.)*.2;' : ''}
          vS = seed; vec4 mv = modelViewMatrix*vec4(p + vec3(${off.join(',')}) - vec3(0., uH*.5*${this.L.setting === 'room' && (w === 'rain' || w === 'snow') ? '1.' : '0.'}, 0.),1.);
          gl_PointSize = ${cfg[2]} * (1. + seed) * 60. / -mv.z * ${w === 'dust' ? '.4' : '1.'}; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uT; varying float vS;
        void main(){ vec2 c = gl_PointCoord; ${w === 'rain' ? 'c.x = (c.x-.5)*6.+.5; if (c.x<0.||c.x>1.) discard;' : ''}
          float a = texture2D(uMap, c).a * ${cfg[3]}; ${w === 'fireflies' ? 'a *= .5+.5*sin(uT*2.+vS*50.);' : ''}
          gl_FragColor = vec4(vec3(${cfg[1]}), a); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; this.fx.add(pts); this.fxUpd.push(t => { m.uniforms.uT.value = t; });
  }

  // ---------------------------------------------------------------- picking & dragging
  pickAt(e: PointerEvent) {
    const rc = this.r.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.cam); return this.ray.intersectObjects([this.booksG, this.itemsG], true)[0];
  }
  /** Lift a book off the shelf and open it in the room. */
  openBook(id: string, look: ReaderLook) {
    if (this.reading) return this.reading;
    const mesh = this.booksG.children.find(c => c.userData.book === id), slot = this.L.books.find(b => String(b.id) === id); if (!mesh || !slot) return null;
    this.select(null); this.selBox.visible = false;
    this.reading = new Reading(this, mesh, { title: slot.title, author: slot.author, color: slot.color }, look, s => this.ev.onRead?.(s));
    this.r.setPixelRatio(this.pr(2)); this.resize();
    return this.reading;
  }
  closeBook(done?: () => void) { const R = this.reading; if (!R) return; R.close(() => { this.reading = null; this.r.setPixelRatio(this.pr(1.75)); this.resize(); this.r.domElement.style.cursor = ''; done?.(); }); }
  down = (e: PointerEvent) => {
    if (this.reading) { this.reading.down(e); return; }
    if (this.mode === 'view' && this.ev.onOpen) { const h = this.pickAt(e); if (h?.object.userData.book) this.click = { x: e.clientX, y: e.clientY, id: h.object.userData.book }; }
    if (!this.editable || (this.tc as any).dragging || (this.tc as any).axis) return;
    const hit = this.pickAt(e); if (!hit) { if (this.mode !== 'view') this.select(null); return; }
    const ud = hit.object.userData;
    if (ud.book && this.mode === 'books') {
      let o: THREE.Object3D = hit.object; while (o.parent && o.parent !== this.booksG) o = o.parent;
      const slot = this.L.books.find(b => String(b.id) === ud.book)!; this.drag = { mesh: o, slot, moved: false, x0: e.clientX, y0: e.clientY }; this.orbit.enabled = false; this.r.domElement.style.cursor = 'grabbing';
      this.select({ type: 'book', id: ud.book });
    } else if (ud.book) this.select({ type: 'book', id: ud.book });
    else if (ud.item && this.mode === 'decor') this.select({ type: 'item', id: ud.item });
    else if (ud.item) this.select({ type: 'item', id: ud.item });
  };
  move = (e: PointerEvent) => {
    if (this.reading) { this.reading.move(e); return; }
    if (this.mode === 'view' && !this.drag && this.ev.onOpen && e.pointerType === 'mouse' && !e.buttons) { const h = this.pickAt(e); this.r.domElement.style.cursor = h?.object.userData.book ? 'pointer' : ''; }
    const d = this.drag; if (!d) return; if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4) d.moved = true; if (!d.moved) return;
    const rc = this.r.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.cam); const p = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.L.depth / 2), p)) { d.mesh.position.set(p.x, p.y - .1, this.L.depth / 2 + .02); d.mesh.rotation.z = 0; }
  };
  up = (e: PointerEvent) => {
    if (this.reading) { this.reading.up(e); return; }
    const c = this.click; this.click = null;
    if (c && this.mode === 'view' && Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6) { this.ev.onOpen?.(c.id); return; }
    const d = this.drag; if (!d) return; this.drag = null; this.orbit.enabled = true; this.r.domElement.style.cursor = this.mode === 'books' ? 'grab' : '';
    if (!d.moved) return;
    const L = this.L, y = d.mesh.position.y + .1, x = d.mesh.position.x;
    const shelf = Math.max(0, Math.min(L.shelves - 1, Math.floor((y - PLINTH + .04) / L.spacing)));
    const rest = L.books.filter(b => b !== d.slot), same = rest.filter(b => Math.min(L.shelves - 1, b.shelf) === shelf);
    const pos = this.layoutBooks(); let before: BookSlot | undefined = same.find(b => (pos.get(String(b.id))?.x ?? 0) > x);
    const moved = { ...d.slot, shelf }; const out = [...rest]; const idx = before ? out.indexOf(before) : (same.length ? out.indexOf(same[same.length - 1]) + 1 : out.length);
    out.splice(idx, 0, moved); this.ev.onBooks(out);
  };
  select(p: Pick) { this.sel = p; this.ev.onSelect(p); this.refreshSel(); }
  refreshSel() {
    const p = this.sel; this.tc.detach(); this.selBox.visible = false; if (!p) return;
    const g = p.type === 'book' ? this.booksG : this.itemsG, key = p.type;
    const o = g.children.find(c => c.userData[key] === p.id); if (!o) return;
    if (p.type === 'item' && this.mode === 'decor' && this.editable) this.tc.attach(o);
    else { this.selBox.setFromObject(o); this.selBox.visible = true; }
  }
  commitItem(final: boolean) {
    const o = this.tc.object; if (!o) return; if (final) this.settle(o);
    const it = this.L.items.find(i => i.id === o.userData.item); if (!it) return;
    this.ev.onItem({ ...it, x: +o.position.x.toFixed(3), y: +o.position.y.toFixed(3), z: +o.position.z.toFixed(3), ry: +o.rotation.y.toFixed(3), s: +Math.max(.2, Math.min(4, o.scale.x)).toFixed(3) }, final);
    if (this.tc.mode === 'scale') o.scale.setScalar(o.scale.x);
  }
}

