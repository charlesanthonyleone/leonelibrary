/** Procedural ambience with the Web Audio API: no audio files, nothing streamed. */
export type Amb = 'falls' | 'rain' | 'wind' | 'night' | 'fire' | 'room';
let ctx: AudioContext | null = null; let stopFns: (() => void)[] = [];
function noise(c: AudioContext, kind: 'white' | 'pink' | 'brown') {
  const len = c.sampleRate * 4, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); let l = 0, p0 = 0, p1 = 0, p2 = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w; else if (kind === 'brown') { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; } else { p0 = .997 * p0 + w * .029591; p1 = .985 * p1 + w * .032534; p2 = .95 * p2 + w * .048056; d[i] = (p0 + p1 + p2 + w * .1848) * .5; } }
  const s = c.createBufferSource(); s.buffer = b; s.loop = true; return s;
}
export function stopAmbience() { stopFns.forEach(f => f()); stopFns = []; }
export function playAmbience(kind: Amb, vol = .5) {
  stopAmbience(); ctx ??= new AudioContext(); const c = ctx; c.resume();
  const out = c.createGain(); out.gain.value = 0; out.gain.linearRampToValueAtTime(vol, c.currentTime + 1.5); out.connect(c.destination);
  const chain = (src: AudioScheduledSourceNode, ...nodes: AudioNode[]) => { let n: AudioNode = src; for (const x of nodes) { n.connect(x); n = x; } n.connect(out); src.start(); stopFns.push(() => { try { src.stop(); } catch { /* */ } }); };
  const filt = (type: BiquadFilterType, f: number, q = .7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (v: number) => { const g = c.createGain(); g.gain.value = v; return g; };
  if (kind === 'falls') { chain(noise(c, 'pink'), filt('lowpass', 2400), filt('highpass', 120), gain(.9)); chain(noise(c, 'brown'), filt('lowpass', 400), gain(.8)); }
  if (kind === 'rain') { chain(noise(c, 'pink'), filt('highpass', 800), filt('lowpass', 7000), gain(.35));
    const iv = setInterval(() => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 2500 + Math.random() * 3000; g.gain.setValueAtTime(.03, c.currentTime); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .03); o.connect(g).connect(out); o.start(); o.stop(c.currentTime + .04); }, 45); stopFns.push(() => clearInterval(iv)); }
  if (kind === 'wind' || kind === 'night' || kind === 'room') { const s = noise(c, 'brown'), f = filt('bandpass', 300, .6), lfo = c.createOscillator(), lg = gain(180); lfo.frequency.value = .08; lfo.connect(lg).connect(f.frequency); lfo.start(); stopFns.push(() => lfo.stop()); chain(s, f, gain(kind === 'wind' ? .9 : .25)); }
  if (kind === 'night') { const iv = setInterval(() => { for (let k = 0; k < 3; k++) { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + k * .07; o.frequency.value = 4300; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.02, t + .01); g.gain.linearRampToValueAtTime(0, t + .05); o.connect(g).connect(out); o.start(t); o.stop(t + .06); } }, 900); stopFns.push(() => clearInterval(iv)); }
  if (kind === 'fire' || kind === 'room') { const iv = setInterval(() => { if (Math.random() > .5) return; const s = noise(c, 'white'), g = c.createGain(), t = c.currentTime; g.gain.setValueAtTime(.08 * Math.random(), t); g.gain.exponentialRampToValueAtTime(.0001, t + .02 + Math.random() * .03); s.connect(filt('highpass', 1500)).connect(g).connect(out); s.start(t); s.stop(t + .06); }, 70); stopFns.push(() => clearInterval(iv)); }
  stopFns.push(() => { out.gain.cancelScheduledValues(c.currentTime); out.disconnect(); });
}
