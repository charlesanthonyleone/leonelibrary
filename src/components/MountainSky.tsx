import { useEffect, useRef, useState } from 'react';
import RM from './ridgeMeta.json';

/* Leone Library: the view from a high summit at night, over a vast ocean far below.
   Sky, stars, meteors and ocean shader adapted from RecordOfLaw's OceanSky; the camera now sits at altitude and
   procedural ridge layers (ridged fBm, moonlit rim light, rock texture, drifting cloud banks) form the foreground.
   Sky/star/meteor treatment adapted from IntelOasis (OasisGL + OasisCanvas): stars are soft radial-gradient glow
   sprites (plus diffraction spikes on the brightest) drawn on a devicePixelRatio-sized 2D canvas, slowly turning
   about an off-screen pole, with OasisGL's multi-frequency twinkle; shooting stars and comets on the same layer.
   The WebGL shader paints the gloomy sky gradient, a drifting Milky Way with dust lanes, the moon, thin cloud
   wisps and a ray-marched open ocean: long Gerstner swells + choppy multi-octave wind sea, Fresnel sky reflection,
   moon glitter path, sub-surface tint on crests, and sea mist at the horizon. A meteor that falls into the sea is
   drawn on a top-most overlay and its impact sends real height ripples through the shader's water. */

export const HORIZON = 0.5; // fraction of viewport height (from top) where sea meets sky

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FRAG = `
precision highp float;
uniform vec2 R; uniform float T; uniform float TS; uniform vec4 RIP[4]; uniform sampler2D MW; uniform float MWON;
const float HZ = __HZ__; const float ALT = 520.;
uniform vec3 MOON; // moon direction, set from JS so the photo disc sits top-right at any aspect
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float h31(vec3 p){ p = fract(p*vec3(.1031,.11369,.13787)); p += dot(p, p.yzx+19.19); return fract((p.x+p.y)*p.z); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return -1.+2.*mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p, int o){ float a=.5, s=0.; for(int i=0;i<5;i++){ if(i>=o) break; s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
float rdg(float x, float s){ float h = 0., a = .5, f = 1.; for (int i=0;i<7;i++){ float v = 1. - abs(n2(vec2(x*f + s, s*1.37 + float(i)*3.1))); h += a*v*v; f *= 2.07; a *= .5; } return h; }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }

float starfield(vec3 s, float sc, float thr){ // dense faint stars: one hashed point per cell on the sphere
  vec3 c = floor(s*sc), f = fract(s*sc) - .5; float h = h31(c);
  if (h < thr) return 0.;
  vec3 o = vec3(h31(c+7.1), h31(c+3.3), h31(c+1.7)) - .5; float d = length(f - o*.7);
  return smoothstep(.16, 0., d) * pow((h-thr)/(1.-thr), 2.);
}
vec3 sky(vec3 d, bool refl){
  float e = max(d.y, 0.);
  // Bortle 1: true black overhead, natural airglow (green 557nm + faint red 630nm) in a band above the horizon
  vec3 col = mix(vec3(.006,.010,.020), vec3(.0008,.0014,.0035), pow(e, .4));
  col += vec3(.010,.030,.016) * exp(-e*11.) * (.8 + .4*n3(d*4. + TS*.01));
  col += vec3(.020,.006,.004) * exp(-e*30.);
  vec3 s = rotX(.62) * rotY(TS*.004) * rotX(-.62) * d; // the celestial sphere turns slowly (for procedural field stars)
  // real photograph: ESO/S. Brunier all-sky Milky Way panorama (CC BY 4.0), projected onto the sky with a very slow drift
  if (MWON > .5 && d.z > .05) {
    vec2 q = d.xy / d.z;
    float a = sin(TS*.0021)*.035; q = mat2(cos(a),sin(a),-sin(a),cos(a)) * (q - vec2(.23,.17)) + vec2(.23,.17);
    q.x += sin(TS*.0013)*.06;
    vec2 tuv = vec2((q.x - .22)/1.5 + .5, (.49 - q.y)/.75);
    vec3 ph = texture2D(MW, tuv).rgb; ph = pow(ph, vec3(2.2)) * (refl ? .9 : 1.55);
    float edge = smoothstep(0.,.06,tuv.x)*smoothstep(1.,.94,tuv.x)*smoothstep(0.,.06,tuv.y)*smoothstep(1.,.94,tuv.y);
    col += ph * edge * smoothstep(0.,.12,e) * (1. - .55*exp(-e*14.)); // fades into airglow at the horizon
  }
  if (!refl) col += starfield(s+.77, 180., .985) * vec3(.7,.75,.9) * .18 * smoothstep(0.,.1,e); // scattered faint field stars everywhere
  // moon: the disc itself is a real photo drawn on the 2D layer; here only a soft, local halo (keeps the Milky Way intact)
  float md = dot(d, MOON), ang = acos(clamp(md,-1.,1.));
  col += vec3(.85,.88,.95) * (exp(-ang*45.)*.06 + exp(-ang*12.)*.010) * (refl ? 0. : 1.);
  // very thin high cloud wisps, only visible as stars dimming
  if (!refl && e > .005) {
    vec2 cp = d.xz/(d.y+.08) * .9 + vec2(TS*.006, TS*.002);
    float c = smoothstep(.72, .98, fbm3(vec3(cp*1.6, TS*.01), 4));
    col *= 1. - c*.35*smoothstep(.0,.3,e);
  }
  return col;
}

// ---- ocean: long Gerstner swells + choppy wind sea (Seascape-style octaves)
const mat2 OM = mat2(1.6,1.2,-1.2,1.6);
float oct(vec2 uv, float ch){ uv += n2(uv); vec2 wv = 1.-abs(sin(uv)), sw = abs(cos(uv)); wv = mix(wv, sw, wv); return pow(1.-pow(wv.x*wv.y,.65), ch); }
float swell(vec2 p){
  float h = 0.;
  h += 1.25*sin(dot(p, normalize(vec2(1.,.28)))*.045 + T*.62);
  h += .80*sin(dot(p, normalize(vec2(.7,-.6)))*.071 + T*.80 + 1.3);
  h += .45*sin(dot(p, normalize(vec2(-.3,1.)))*.11 + T*.99 + 4.);
  return h;
}
float ripple(vec2 p){
  float h = 0.;
  for (int i=0;i<4;i++){ vec4 r = RIP[i]; if (r.w <= 0.) continue;
    float age = T - r.z; if (age < 0.) continue;
    float d = length(p - r.xy), R0 = age*5.2;
    h += r.w * sin((d-R0)*2.3) * exp(-pow((d-R0)/(1.4+age*.9),2.)) * exp(-age*.55) / (1.+d*.15); }
  return h;
}
float sea(vec3 p, int it){
  float fq = .16, amp = .52, ch = 4.2, h = 0.; vec2 uv = p.xz; uv.x *= .75;
  for (int i=0;i<5;i++){ if (i>=it) break;
    float d = oct((uv + T*.75)*fq, ch) + oct((uv - T*.75)*fq, ch);
    h += d*amp; uv *= OM; fq *= 1.9; amp *= .22; ch = mix(ch, 1., .2); }
  return p.y - h - swell(p.xz) - ripple(p.xz);
}
vec3 nrm(vec3 p, float eps){
  vec3 n; n.y = sea(p,5); n.x = sea(vec3(p.x+eps,p.y,p.z),5) - n.y; n.z = sea(vec3(p.x,p.y,p.z+eps),5) - n.y; n.y = eps; return normalize(n);
}
float trace(vec3 o, vec3 d, out vec3 p){
  float tm = 0., tx = 400000.; float hx = sea(o + d*tx, 3);
  if (hx > 0.) { p = o + d*tx; return tx; }
  float hm = sea(o, 3), tmid = 0.;
  for (int i=0;i<9;i++){ tmid = mix(tm, tx, hm/(hm-hx)); p = o + d*tmid; float hh = sea(p, 3);
    if (hh < 0.) { tx = tmid; hx = hh; } else { tm = tmid; hm = hh; } }
  return tmid;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*R) / R.y;
  float hz = (1. - HZ) - .5;
  vec3 rd = normalize(vec3(uv.x, uv.y - hz, 1.25));
  rd = rotY(sin(T*.03)*.004) * rd; // the faintest breathing pan
  vec3 ro = vec3(0., ALT, T*.6);
  vec3 col;
  float mist = exp(-abs(rd.y)*60.); // sea mist hugging the horizon
  if (rd.y > -.0015) {
    col = sky(rd, false);
  } else {
    vec3 p; float dist = trace(ro, rd, p);
    vec3 n = nrm(p, max(.02, dist*.0006));
    n = normalize(mix(n, vec3(0,1,0), smoothstep(3000., 60000., dist)*.45));
    vec3 r = reflect(rd, n); r.y = abs(r.y) + .001;
    float fres = clamp(.02 + .98*pow(1. - max(dot(n, -rd), 0.), 5.), 0., 1.);
    vec3 refl = sky(r, true) * 1.3;
    vec3 deep = vec3(.0006,.003,.007);
    vec3 sss = vec3(.010,.040,.055) * pow(max(p.y + 1.5, 0.)*.28, 2.) * max(dot(n, MOON*vec3(1,0,1)) + .3, 0.);
    col = mix(deep + sss, refl, fres*.8);
    float sp = max(dot(r, MOON), 0.);
    // moonlit glitter path: a column straight down from the moon on screen, widening slightly toward the viewer,
    // lit only where wave facets tilt the reflection toward the moon (so it shimmers instead of being a flat stripe)
    float cx = rd.x/rd.z - MOON.x/MOON.z, wdt = .035 + (-rd.y)*.10;
    float column = exp(-cx*cx/(wdt*wdt));
    col += vec3(.92,.95,1.) * (pow(sp, 2400.)*1.5*column + column*(pow(sp, 14.)*1.1 + pow(sp, 120.)*.9 + .012)) * (.6 + .4*fres*6.);
    // starlight glinting off facets: reflected stars break into sparkles
    vec3 rs = rotX(.62) * rotY(TS*.004) * rotX(-.62) * r;
    float gl = starfield(rs, 140., .955) * fres * 6. * exp(-dist*.00004);
    col += vec3(.75,.82,1.) * gl * .5;
    float fog = 1. - exp(-dist*.000035);
    col = mix(col, vec3(.006,.009,.015), fog*.92);
  }
  col = mix(col, vec3(.010,.014,.022), mist*.55);
  col *= 1. - .32*dot(uv*.85, uv*.85); // vignette
  col = col / (1. + col*.5);
  col = pow(col, vec3(.4545));
  col += (h21(gl_FragCoord.xy + fract(T)*100.) - .5) / 220.; // dither: no banding in the dark gradients
  gl_FragColor = vec4(col, 1.);
}`;

// ---- star sprites (OasisGL glow + spike, tinted per colour temperature)
const TEMPS = ['175,200,255', '205,220,255', '240,244,255', '255,244,222', '255,214,170', '255,184,150'];
const glowSprite = (rgb: string) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.1, `rgba(${rgb},.85)`); r.addColorStop(.28, `rgba(${rgb},.22)`); r.addColorStop(.55, `rgba(${rgb},.05)`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill(); return c; };
const spikeSprite = () => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  for (const vert of [false, true]) { const r = vert ? g.createLinearGradient(64, 0, 64, 128) : g.createLinearGradient(0, 64, 128, 64);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(.5, 'rgba(220,228,255,.75)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r;
    g.beginPath(); if (vert) g.ellipse(64, 64, .9, 64, 0, 0, Math.PI * 2); else g.ellipse(64, 64, 64, .9, 0, 0, Math.PI * 2); g.fill(); }
  return c; };
function mulberry(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }


// ---- photographic mountains: two masked, night-graded layers cut from a real photo (see credits) and composited
// over the shader's sea with a little parallax. RM holds the source size and each layer's skyline, so stars and
// meteors on the 2D layer, and meteors landing in the sea, respect the peaks.
const RIDGE_Y = .085; // far ridge crest sits this far (fraction of H) below the horizon, leaving a band of open sea
/** layout shared by the drawing and the skyline mask: drawn width/left and the far ridge crest y */
function mtnLayout(W: number, H: number) {
  const top = H * (HORIZON + RIDGE_Y), frac = (1 - RM.ridgeTop) * RM.srcH / RM.srcW;
  const dw = Math.max(W * 1.05, (H - top) * 1.02 / frac), y0 = top - 0; // y0: where the far image's top row lands
  const nk = 1.14, yN = y0 + (RM.humpTop - RM.ridgeTop) * RM.srcH * (dw / RM.srcW) * .78; // near summit: closer, so larger
  const cw = Math.max(W * .46, H * .62), ch = cw * RM.cragAR; // foreground crag, anchored bottom-left
  return { dw, x0: (W - dw) / 2, y0, k: dw / RM.srcW, nk, yN, cw, ch, cy: H - ch + 2 };
}
function profileAt(prof: number[], u: number) { const f = Math.max(0, Math.min(1, u)) * (prof.length - 1), i = Math.floor(f), t = f - i; return prof[i] + ((prof[Math.min(i + 1, prof.length - 1)] ?? prof[i]) - prof[i]) * t; }
/** screen y of the highest mountain edge at screen x */
function ridgeTopY(x: number, W: number, H: number) { const L = mtnLayout(W, H), u = (x - L.x0) / L.dw;
  const dn = L.dw * L.nk, un = (x - (W - dn) / 2) / dn;
  let y = Math.min(L.y0 + (profileAt(RM.ridge, u) - RM.ridgeTop) * RM.srcH * L.k + 8 * L.k, L.yN + (profileAt(RM.hump, un) - RM.humpTop) * RM.srcH * L.k * L.nk);
  if (x < L.cw) y = Math.min(y, L.cy + profileAt(RM.crag, x / L.cw) * L.ch);
  return y; }

type Star = { r: number; a: number; m: number; c: number; f1: number; f2: number; p: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; age: number; len: number; comet?: boolean; lands?: boolean; ly?: number };

export default function MountainSky() {
  const glRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<HTMLCanvasElement>(null);
  const mtRef = useRef<HTMLCanvasElement>(null);
  const fbRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cv = glRef.current!, bg = bgRef.current!, top = topRef.current!, mt = mtRef.current!;
    let st = sceneSettings();
    const onSet = () => { st = sceneSettings(); kick(); };
    window.addEventListener(SCENE_EVT, onSet);
    let tOcean = 40, tSky = 40, painted = false, dead = false;
    let gl: WebGLRenderingContext | null = null;
    try { gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' }); } catch { gl = null; }
    const b2 = bg.getContext('2d')!, t2 = top.getContext('2d')!;
    let raf = 0, W = 0, H = 0, gs = 1, dpr = 1, ok = false;
    let uMoon: WebGLUniformLocation | null = null, uTS: WebGLUniformLocation | null = null, uR: WebGLUniformLocation | null = null, uT: WebGLUniformLocation | null = null, uRip: WebGLUniformLocation | null = null;
    if (gl) {
      const sh = (type: number, src: string) => { const s = gl!.createShader(type)!; gl!.shaderSource(s, src); gl!.compileShader(s);
        if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) { console.warn(gl!.getShaderInfoLog(s)); return null; } return s; };
      const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG.replace('__HZ__', HORIZON.toFixed(3)));
      if (vs && fs) {
        const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          gl.useProgram(prog);
          const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
          const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
          uR = gl.getUniformLocation(prog, 'R'); uT = gl.getUniformLocation(prog, 'T'); uTS = gl.getUniformLocation(prog, 'TS'); uRip = gl.getUniformLocation(prog, 'RIP[0]');
          uMoon = gl.getUniformLocation(prog, 'MOON'); const uOn = gl.getUniformLocation(prog, 'MWON'); gl.uniform1f(uOn, 0); gl.uniform1i(gl.getUniformLocation(prog, 'MW'), 0);
          const tex = gl.createTexture(); const img = new Image();
          img.onload = () => { const g = gl!; g.bindTexture(g.TEXTURE_2D, tex); g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, img);
            for (const k of [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T]) g.texParameteri(g.TEXTURE_2D, k, g.CLAMP_TO_EDGE);
            g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
            if (dead) return; g.useProgram(prog); g.uniform1f(uOn, 1); painted = false; kick(); };
          img.src = import.meta.env.BASE_URL + 'sky/milkyway.webp';
          ok = true;
        }
      }
    }
    if (!ok) { cv.style.display = 'none'; fbRef.current?.classList.add('on'); } // CSS gradient ocean fallback

    const glows = TEMPS.map(glowSprite), spike = spikeSprite();
    let stars: Star[] = [];
    // Milky Way star clouds: thousands of small stars sampled in the shader's galactic frame and projected every frame
    type BS = { x: number; y: number; z: number; m: number; w: number };
    const NB = [-.80, .58, -.122], nl = Math.hypot(...NB), BN = NB.map((v) => v / nl);
    const GC = [-.08, .10, 1].map((v, _, a) => v / Math.hypot(...a));
    const bandStars: BS[] = (() => { const r = mulberry(11), out: BS[] = [];
      while (out.length < 5200) { const z = r() * 2 - 1, ph = r() * 6.283, q = Math.sqrt(1 - z * z), v = [q * Math.cos(ph), q * Math.sin(ph), z];
        const bd = v[0] * BN[0] + v[1] * BN[1] + v[2] * BN[2], core = Math.exp(-((v[0] - GC[0]) ** 2 + (v[1] - GC[1]) ** 2 + (v[2] - GC[2]) ** 2) * 4);
        if (r() > Math.exp(-bd * bd * 60) * (.35 + .65 * core + .3)) continue;
        out.push({ x: v[0], y: v[1], z: v[2], m: Math.pow(r(), 3), w: core }); }
      return out; })();
    const rx = (v: number[], a: number) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; };
    const ry = (v: number[], a: number) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
    const drawBand = (t: number) => {
      const hzo = (1 - HORIZON) - .5, hzy = H * HORIZON;
      b2.globalCompositeOperation = 'lighter';
      for (const b of bandStars) {
        const d = rx(ry(rx([b.x, b.y, b.z], -.62), -t * .004), .62);
        if (d[2] <= .05) continue;
        const X = W / 2 + d[0] / d[2] * 1.25 * H, Y = H / 2 - (d[1] / d[2] * 1.25 + hzo) * H;
        if (X < 0 || X > W || Y < 0 || Y > hzy - 2 || Y > skyY(X)) continue;
        const ext = Math.min(1, (hzy - Y) / (H * .12));
        const rad = .7 + b.m * 1.6;
        b2.globalAlpha = (.18 + .55 * b.m) * ext;
        b2.drawImage(glows[b.w > .45 ? 3 : b.m > .5 ? 1 : 2], X - rad * 2, Y - rad * 2, rad * 4, rad * 4);
      }
      b2.globalAlpha = 1;
    };
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // the shader is soft everywhere (stars live on the crisp 2D layer), so cap its pixel budget for a steady 60fps
      gs = Math.min(dpr, Math.sqrt(2.4e6 / (W * H)));
      cv.width = Math.round(W * gs); cv.height = Math.round(H * gs);
      for (const c of [bg, top, mt]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0); }
      if (gl && ok) gl.viewport(0, 0, cv.width, cv.height);
      const rnd = mulberry(7), D = Math.hypot(W, H) * 1.35, n = Math.round(Math.min(4500, W * H / 300));
      stars = Array.from({ length: n }, () => { const u = rnd(); const m = Math.pow(u, 6.5); // power law: many faint, few brilliant
        const ct = rnd(); return { r: Math.sqrt(rnd()) * D, a: rnd() * Math.PI * 2, m, c: ct < .12 ? 0 : ct < .32 ? 1 : ct < .7 ? 2 : ct < .86 ? 3 : ct < .96 ? 4 : 5,
          f1: 1.5 + rnd() * 3.5, f2: 4 + rnd() * 6, p: rnd() * 6.283 }; });
    };
    let mask: Float32Array = new Float32Array(0);
    const buildMask = () => { mask = new Float32Array(Math.ceil(W / 3) + 2); for (let i = 0; i < mask.length; i++) mask[i] = ridgeTopY(i * 3, W, H) - 2; };
    const skyY = (x: number) => mask[Math.max(0, Math.min(mask.length - 1, Math.round(x / 3)))] ?? H * HORIZON;
    const ridgePath = (c: CanvasRenderingContext2D) => { c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); for (let x = W; x >= 0; x -= 3) c.lineTo(x, Math.min(skyY(x), H * HORIZON)); c.closePath(); };
    resize(); buildMask(); window.addEventListener('resize', resize); window.addEventListener('resize', buildMask);

    // ---- the moon: real photo (Gregory H. Revera, CC BY-SA 3.0), top-right, modest size, local halo
    const moonImg = new Image(); moonImg.onload = () => { painted = false; kick(); }; moonImg.src = import.meta.env.BASE_URL + 'sky/moon.webp';
    const moonPos = () => { const r = Math.max(16, Math.min(34, H * .036)); return { x: Math.min(W - 70, W * .86), y: Math.max(r + 70, H * .16), r }; };
    const moonDir = () => { const m = moonPos(), hzo = (1 - HORIZON) - .5; const v = [(m.x - W / 2) / H, (H / 2 - m.y) / H - hzo, 1.25]; const l = Math.hypot(...v); return v.map((c) => c / l); };
    const drawMoon = () => {
      const m = moonPos(); b2.globalCompositeOperation = 'source-over';
      const h = b2.createRadialGradient(m.x, m.y, m.r * .9, m.x, m.y, m.r * 7);
      h.addColorStop(0, 'rgba(215,225,245,.22)'); h.addColorStop(.25, 'rgba(190,205,235,.07)'); h.addColorStop(1, 'rgba(160,180,220,0)');
      b2.fillStyle = h; b2.fillRect(m.x - m.r * 7, m.y - m.r * 7, m.r * 14, m.r * 14);
      b2.fillStyle = '#02040a'; b2.beginPath(); b2.arc(m.x, m.y, m.r * .99, 0, 6.283); b2.fill(); // hide stars behind the disc
      if (moonImg.complete && moonImg.naturalWidth) b2.drawImage(moonImg, m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    };
    const drawStars = (t: number) => {
      const hz = H * HORIZON, px = W * .78, py = -H * .55, rot = t * .0045;
      b2.globalCompositeOperation = 'lighter';
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i], a = s.a + rot, x = px + Math.cos(a) * s.r, y = py + Math.sin(a) * s.r;
        if (x < -20 || x > W + 20 || y < -20 || y > hz - 2 || y > skyY(x)) continue;
        const ext = Math.min(1, (hz - y) / (H * .16)); // atmospheric extinction near the horizon
        const sc = !st.sky ? .8 : Math.max(0, .62 + .38 * Math.sin(t * s.f1 + s.p) * Math.sin(t * s.f2 + s.p * 1.7) + .18 * Math.sin(t * (9 + i % 7) + s.p * 3) * s.m);
        const rad = (1.1 + s.m * 9) * (.75 + .45 * sc);
        b2.globalAlpha = Math.min(1, (.32 + .9 * s.m) * sc * ext * ext);
        b2.drawImage(glows[s.c], x - rad, y - rad, rad * 2, rad * 2);
        if (s.m > .42) { const L = (8 + 34 * s.m) * (.5 + .6 * sc); b2.globalAlpha = .5 * sc * ext * s.m; b2.drawImage(spike, x - L, y - L, L * 2, L * 2);
          if (s.m > .7) { b2.save(); b2.translate(x, y); b2.rotate(.785); b2.globalAlpha *= .35; b2.drawImage(spike, -L * .6, -L * .6, L * 1.2, L * 1.2); b2.restore(); } }
      }
      b2.globalAlpha = 1;
    };

    let meteors: Meteor[] = [];
    const rips: { x: number; z: number; t: number; s: number }[] = [];
    let nextShoot = 1.2, nextComet = 10, nextLander = Infinity;
    const spawn = (t: number) => {
      const hz = H * HORIZON;
      if (t > nextShoot) {
        const dir = Math.random() < .5 ? -1 : 1, sp = 650 + Math.random() * 550, a = .22 + Math.random() * .4;
        meteors.push({ x: W * (.1 + Math.random() * .8), y: hz * (.04 + Math.random() * .45), vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp, life: .5 + Math.random() * .6, age: 0, len: 110 + Math.random() * 150 });
        nextShoot = t + 2.2 + Math.random() * 5.5;
      }
      if (t > nextComet) {
        const dir = Math.random() < .5 ? -1 : 1;
        meteors.push({ x: dir > 0 ? -80 : W + 80, y: hz * (.1 + Math.random() * .3), vx: dir * (22 + Math.random() * 16), vy: 3 + Math.random() * 5, life: (W + 160) / 26, age: 0, len: 170 + Math.random() * 100, comet: true });
        nextComet = t + 50 + Math.random() * 40;
      }
      if (t > nextLander) {
        const lx = W * (.15 + Math.random() * .7), gap = skyY(lx) - hz - 6; // land only on open sea, never on the mountains
        if (gap < 10) { nextLander = t + 3; return; }
        const ly = hz + 3 + gap * (.15 + Math.random() * .7);
        const dur = 1.4 + Math.random() * .6, sx = lx + (Math.random() < .5 ? -1 : 1) * W * (.22 + Math.random() * .15), sy = hz * .04;
        meteors.push({ x: sx, y: sy, vx: (lx - sx) / dur, vy: (ly - sy) / dur, life: dur, age: 0, len: 230, lands: true, ly });
        nextLander = t + 20 + Math.random() * 18;
      }
    };
    // screen point on the sea -> world xz (same camera as the shader, ignoring the tiny drift)
    const toWorld = (x: number, y: number, t: number) => {
      const uvx = (x - W / 2) / H, uvy = (H / 2 - y) / H, hzo = (1 - HORIZON) - .5;
      const dy = uvy - hzo; const len = Math.hypot(uvx, dy, 1.25); const rdy = dy / len; if (rdy >= -1e-3) return null;
      const dist = -(6.2 + .5 * Math.sin(t * .62)) / rdy; return { x: uvx / len * dist, z: t * .6 + 1.25 / len * dist };
    };
    const drawMeteor = (c: CanvasRenderingContext2D, m: Meteor) => { try { drawMeteorInner(c, m); } catch { m.age = m.life + 99; } };
    const drawMeteorInner = (c: CanvasRenderingContext2D, m: Meteor) => {
      if (!(Math.hypot(m.vx, m.vy) > 0) || ![m.x, m.y, m.len, m.age].every(Number.isFinite)) return;
      const sp = Math.hypot(m.vx, m.vy), ux = m.vx / sp, uy = m.vy / sp, p = m.age / m.life;
      const fade = m.comet ? Math.min(1, m.age / 3, (m.life - m.age) / 3) : m.lands ? Math.min(1, m.age * 4) : Math.sin(Math.min(1, p) * Math.PI);
      c.lineCap = 'round';
      if (m.comet) {
        const tx = m.x - ux * m.len, ty = m.y - uy * m.len - 20;
        const g = c.createLinearGradient(m.x, m.y, tx, ty); g.addColorStop(0, `rgba(205,228,255,${.5 * fade})`); g.addColorStop(1, 'rgba(205,228,255,0)');
        c.strokeStyle = g;
        for (const [w, o] of [[8, 0], [3, 7], [2, -6]] as const) { c.lineWidth = w; c.globalAlpha = .3; c.beginPath(); c.moveTo(m.x, m.y); c.quadraticCurveTo((m.x + tx) / 2, (m.y + ty) / 2 + o, tx, ty + o * 2); c.stroke(); }
        c.globalAlpha = 1;
        const rg = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, 11); rg.addColorStop(0, `rgba(245,250,255,${.95 * fade})`); rg.addColorStop(.3, `rgba(200,225,255,${.4 * fade})`); rg.addColorStop(1, 'rgba(180,210,255,0)');
        c.fillStyle = rg; c.beginPath(); c.arc(m.x, m.y, 11, 0, 7); c.fill();
        return;
      }
      const L = Math.min(m.len, sp * m.age);
      const g = c.createLinearGradient(m.x, m.y, m.x - ux * L, m.y - uy * L);
      g.addColorStop(0, `rgba(255,255,255,${fade})`); g.addColorStop(.2, `rgba(190,215,255,${.55 * fade})`); g.addColorStop(1, 'rgba(160,190,255,0)');
      c.strokeStyle = g; c.lineWidth = m.lands ? 2.6 : 1.5;
      c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x - ux * L, m.y - uy * L); c.stroke();
      const r = m.lands ? 7 + p * 8 : 4.5;
      const rg = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, r); rg.addColorStop(0, `rgba(255,255,255,${fade})`); rg.addColorStop(.35, `rgba(215,230,255,${.5 * fade})`); rg.addColorStop(1, 'rgba(170,200,255,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(m.x, m.y, r, 0, 7); c.fill();
    };
    // ---- photographic mountains (masked + night-graded offline; see credits). Far ridge and near summit are separate
    // layers so they can slide a few px apart: pointer parallax plus a very slow drift while the sky is animated.
    const m2 = mt.getContext('2d')!;
    const far = new Image(), near = new Image(), crag = new Image(); let mtnReady = 0;
    for (const [im, f] of [[far, 'ridge-far'], [near, 'ridge-near'], [crag, 'crag']] as const) { im.decoding = 'async'; im.onload = () => { mtnReady++; mtnKey = ''; kick(); }; im.src = import.meta.env.BASE_URL + 'sky/' + f + '.webp'; }
    let mtnKey = '', px = 0, py = 0, tpx = 0, tpy = 0;
    const onPtr = (e: PointerEvent) => { tpx = e.clientX / W * 2 - 1; tpy = e.clientY / H * 2 - 1; kick(); };
    window.addEventListener('pointermove', onPtr, { passive: true });
    const drawMtn = (t: number, dt: number) => {
      if (mtnReady < 3) return;
      const k = st.ui || st.sky ? 1 - Math.exp(-dt * 2.5) : 1; px += (tpx - px) * k; py += (tpy - py) * k;
      const drift = st.sky ? Math.sin(t * .05) : 0;
      const L = mtnLayout(W, H), sF = -(px * 4 + drift * 2.5), sN = -(px * 11 + drift * 6), vN = -py * 3, sC = -(px * 24 + drift * 12), vC = -py * 7;
      const key = [W, H, sF.toFixed(1), sN.toFixed(1), vN.toFixed(1), sC.toFixed(1), vC.toFixed(1)].join();
      if (key === mtnKey) return; mtnKey = key;
      m2.clearRect(0, 0, W, H);
      const dh = far.naturalHeight * L.dw / far.naturalWidth;
      m2.drawImage(far, L.x0 + sF, L.y0, L.dw, dh);
      const dN = L.dw * L.nk;
      m2.drawImage(near, (W - dN) / 2 + sN, L.yN + vN, dN, near.naturalHeight * dN / near.naturalWidth);
      if (crag.complete && crag.naturalWidth) m2.drawImage(crag, sC - 30, L.cy + vC, L.cw + 30, L.ch + 30 * RM.cragAR);
      // atmospheric seam: a breath of moonlit sea mist where the far ridge meets the water
      const hz = H * HORIZON, g = m2.createLinearGradient(0, hz, 0, L.y0 + 30);
      g.addColorStop(0, 'rgba(30,38,54,0)'); g.addColorStop(.8, 'rgba(30,38,54,.12)'); g.addColorStop(1, 'rgba(30,38,54,0)');
      m2.globalCompositeOperation = 'destination-over'; m2.fillStyle = g; m2.fillRect(0, hz, W, L.y0 + 30 - hz); m2.globalCompositeOperation = 'source-over';
    };
    const flashes: { x: number; y: number; age: number }[] = [];
    const RIP = new Float32Array(16);
    let last = performance.now();
    const frame = (ms: number) => { try { frameInner(ms); } catch (e) { console.warn('[scene] render failed, using fallback', e); ok = false; cv.style.display = 'none'; fbRef.current?.classList.add('on'); } };
    const frameInner = (ms: number) => {
      const dt = Math.min(.05, (ms - last) / 1000); last = ms;
      if (st.ocean) tOcean += dt; if (st.sky) tSky += dt;
      const t = tSky;
      b2.clearRect(0, 0, W, H); t2.clearRect(0, 0, W, H);
      drawStars(t); drawMoon(); drawMtn(t, dt);
      if (st.sky) {
        spawn(t);
        for (const m of meteors) { m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt; }
        for (const m of meteors) if (m.lands && m.age >= m.life) {
          const w = toWorld(m.x, m.ly!, tOcean); if (w) { rips.push({ x: w.x, z: w.z, t: tOcean, s: .9 }); if (rips.length > 4) rips.shift(); }
          flashes.push({ x: m.x, y: m.ly!, age: 0 });
        }
        meteors = meteors.filter((m) => m.age < m.life);
        b2.globalCompositeOperation = 'lighter';
        b2.save(); ridgePath(b2); b2.clip();
        for (const m of meteors) if (!m.lands) drawMeteor(b2, m);
        b2.restore();
        t2.globalCompositeOperation = 'lighter';
        for (const m of meteors) if (m.lands) drawMeteor(t2, m);
        for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.age += dt; if (f.age > .6) { flashes.splice(i, 1); continue; }
          const k = 1 - f.age / .6, rr = 26 + 40 * (f.y / H); const rg = t2.createRadialGradient(f.x, f.y, 0, f.x, f.y, rr);
          rg.addColorStop(0, `rgba(240,246,255,${.9 * k})`); rg.addColorStop(1, 'rgba(200,220,255,0)'); t2.fillStyle = rg;
          t2.beginPath(); t2.ellipse(f.x, f.y, rr, rr * .45, 0, 0, 7); t2.fill(); }
        b2.globalCompositeOperation = t2.globalCompositeOperation = 'source-over';
      }
      if (gl && ok) {
        RIP.fill(0); rips.forEach((r, i) => RIP.set([r.x, r.z, r.t, tOcean - r.t < 14 ? r.s : 0], i * 4));
        gl.uniform3fv(uMoon, moonDir()); gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, tOcean); gl.uniform1f(uTS, tSky); gl.uniform4fv(uRip, RIP); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      painted = true;
      raf = (!dead && (st.ocean || st.sky)) ? requestAnimationFrame(frame) : 0; // both off: keep the last still frame
    };
    function kick() { if (dead) return; if (!raf || !painted) { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(frame); } }
    raf = requestAnimationFrame(frame);
    const onResize = () => { painted = false; kick(); }; window.addEventListener('resize', onResize);
    const onVis = () => { cancelAnimationFrame(raf); raf = 0; if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', onVis);
    const onLost = (e: Event) => { e.preventDefault(); ok = false; cv.style.display = 'none'; fbRef.current?.classList.add('on'); };
    cv.addEventListener('webglcontextlost', onLost);
    return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('resize', buildMask); window.removeEventListener('resize', onResize); window.removeEventListener('pointermove', onPtr); window.removeEventListener(SCENE_EVT, onSet); document.removeEventListener('visibilitychange', onVis); cv.removeEventListener('webglcontextlost', onLost); };
  }, []);
  return (
    <>
      <div className="scene" aria-hidden="true">
        <div ref={fbRef} className="scene-fallback" />
        <canvas ref={glRef} className="scene-gl" />
        <canvas ref={bgRef} className="scene-2d" />
        <canvas ref={mtRef} className="scene-mtn" />
      </div>
      <canvas ref={topRef} className="scene-top" aria-hidden="true" />
      <SceneSettings />
    </>
  );
}

/* ---- scene settings: animation toggles, saved in localStorage; defaults respect prefers-reduced-motion */
export const SKEY = 'leone.scene.v1', SCENE_EVT = 'leone-scene';
export type SceneSet = { ocean: boolean; sky: boolean; ui: boolean };
export function sceneSettings(): SceneSet {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const def = { ocean: !reduce, sky: !reduce, ui: !reduce };
  try { const v = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (v && typeof v === 'object') return { ocean: typeof v.ocean === 'boolean' ? v.ocean : def.ocean, sky: typeof v.sky === 'boolean' ? v.sky : def.sky, ui: typeof v.ui === 'boolean' ? v.ui : def.ui }; } catch { try { localStorage.removeItem(SKEY); } catch { /* */ } }
  return def;
}
function SceneSettings() {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(sceneSettings);
  const upd = (p: Partial<SceneSet>) => { const n = { ...v, ...p }; setV(n); try { localStorage.setItem(SKEY, JSON.stringify(n)); } catch { /* quota */ } window.dispatchEvent(new Event(SCENE_EVT)); };
  return (
    <div className="scene-set">
      {open && <div className="scene-panel glass" role="dialog" aria-label="Scene settings">
        <label><input type="checkbox" checked={v.ocean} onChange={(e) => upd({ ocean: e.target.checked })} /> Ocean animation</label>
        <label><input type="checkbox" checked={v.sky} onChange={(e) => upd({ sky: e.target.checked })} /> Stars, clouds &amp; meteors</label>
        <label><input type="checkbox" checked={v.ui} onChange={(e) => upd({ ui: e.target.checked })} /> Interface motion (shelf, spines)</label>
        <p className="muted small">Off shows a still frame. Defaults follow your system's reduced-motion setting.</p>
        <p className="muted small scene-credit">Milky Way photo: <a href="https://www.eso.org/public/images/eso0932a/" target="_blank" rel="noreferrer">ESO/S. Brunier</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> (cropped, colour-graded) · Moon photo: <a href="https://commons.wikimedia.org/wiki/File:FullMoon2010.jpg" target="_blank" rel="noreferrer">Gregory H. Revera</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> (cropped, masked)</p>
        <p className="muted small">Ocean and clouds are rendered live in WebGL. Mountains: <a href="https://commons.wikimedia.org/wiki/File:Morning_Layers_from_Peaky_Peak.jpg" target="_blank" rel="noreferrer">“Morning Layers from Peaky Peak”</a> by Megaurab09, CC BY-SA 4.0; foreground rocks: <a href="https://commons.wikimedia.org/wiki/File:Boulders_(50066572142).jpg" target="_blank" rel="noreferrer">“Boulders”</a>, Joshua Tree National Park (NPS), public domain — both via Wikimedia Commons, masked and colour-graded to night.</p>
      </div>}
      <button className="scene-gear glass" aria-expanded={open} aria-label="Scene settings" title="Scene settings" onClick={() => setOpen(!open)}>⚙</button>
    </div>
  );
}
