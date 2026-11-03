// Optional Leone ID card: encryption disclosure, link/unlink, sync, cross-site XP bar + achievements.
import { useEffect, useState } from 'react';
import { lid, linked as isLinked, syncAll, type XpSummary } from '../lib/leoneid';

export function XpCard() {
  const [s, setS] = useState<XpSummary | null>(null);
  useEffect(() => { const load = () => lid()?.xp.summary().then(setS).catch(() => {}); load(); addEventListener('leoneid:xp', load); return () => removeEventListener('leoneid:xp', load); }, []);
  if (!s) return null;
  const pct = Math.min(100, Math.round((s.into / Math.max(1, s.need)) * 100));
  return <section className="glass imp-card" aria-labelledby="xp-h"><h2 id="xp-h">Level {s.level} <span className="muted small">· {s.xp} XP{s.crossSite ? ' across Leone sites' : ' on this device'}</span></h2>
    <div role="progressbar" aria-label="Progress to next level" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ height: 10, borderRadius: 6, background: 'rgba(255,255,255,.12)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: pct + '%', background: 'linear-gradient(90deg,#c9a24a,#f3d37a)' }} /></div>
    <p className="small muted">{s.into} / {s.need} XP to level {s.level + 1}. Read pages, finish books, add to shelves and highlight to earn XP.</p>
    <ul className="small" style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>{s.achievements.map(a => <li key={a.id} title={a.desc} style={{ opacity: a.unlocked ? 1 : 0.45, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.2)' }}>{a.unlocked ? '★' : '☆'} {a.name}<span className="sr-only"> — {a.unlocked ? 'unlocked' : 'locked'}: {a.desc}</span></li>)}</ul>
  </section>;
}

export default function LeoneIdCard() {
  const [on, setOn] = useState(isLinked()); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [priv, setPriv] = useState<{ e2e: string[]; server_sees: string[] } | null>(null); const [down, setDown] = useState(false);
  useEffect(() => {
    const s = lid(); if (!s) { setDown(true); return; }
    const off = s.onChange(() => setOn(isLinked()));
    s.handleRedirect().then(r => { if (r?.linked) { setMsg('Linked. Syncing your library, encrypted on this device…'); return syncAll().then(n => { setMsg(`Linked and synced ${n} items, end-to-end encrypted.`); setTimeout(() => location.reload(), 900); }); } if (r?.cancelled) setMsg('Linking cancelled — nothing changed.'); }).catch(e => setMsg((e as Error).message));
    s.privacy().then(p => p && setPriv(p)).catch(() => setDown(true));
    return off;
  }, []);
  if (down) return null; // Leone ID not reachable yet: the site stays fully local, no prompts.
  const run = (f: () => Promise<unknown>) => { setBusy(true); f().catch(e => setMsg((e as Error).message)).finally(() => setBusy(false)); };
  return <section className="glass imp-card" aria-labelledby="lid-h"><h2 id="lid-h">Save across Leone sites <span className="muted small">· optional</span></h2>
    {on ? <p className="small">Linked to your Leone ID. Your shelves, progress, highlights and notes sync automatically, encrypted on this device first.</p>
      : <p className="small">You don't need an account to read. Link a Leone ID only if you want your library on other devices and XP shared with XatCast and other Leone sites. Leone Library gets an anonymous ID that other sites can't connect to you.</p>}
    {priv && <div className="small"><p><b>End-to-end encrypted</b> (only your devices can read): {priv.e2e.join(', ')}.</p><p><b>What the server can see:</b> {priv.server_sees.join(', ')}.</p></div>}
    <div className="row gap wrap">{on ? <>
      <button className="btn gold sm" disabled={busy} onClick={() => run(async () => setMsg(`Synced ${await syncAll()} items.`))}>Sync now</button>
      <a className="btn ghost sm" href="https://id.xatmarket.com/account/">Open Leone ID portal</a>
      <button className="btn ghost sm" disabled={busy} onClick={() => { if (confirm('Unlink Leone Library? Its encrypted backup on Leone ID is deleted. Everything on this device stays.')) run(async () => { await lid()!.unlink(); setMsg('Unlinked. Your library stays on this device.'); }); }}>Unlink</button>
    </> : <button className="btn gold sm" disabled={busy} onClick={() => run(() => lid()!.link(location.href))}>Link Leone ID</button>}</div>
    {msg && <p role="status" className="small">{msg}</p>}
  </section>;
}
