import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FLAGS } from '../lib/flags';
import { checkout, credits, magicLink, me, oauthUrl, passkey, signOut, syncPull, type User } from '../lib/account';
import { newPhrase, validPhrase } from '../lib/e2e';
import LeoneIdCard, { XpCard } from '../components/LeoneIdCard';

export default function Account() {
  const [u, setU] = useState<User | null | undefined>(undefined); const [email, setEmail] = useState(''); const [msg, setMsg] = useState(''); const [bal, setBal] = useState<Awaited<ReturnType<typeof credits>> | null>(null);
  useEffect(() => { if (FLAGS.accounts) me().then(setU).catch(() => setU(null)); }, []);
  useEffect(() => { if (u && FLAGS.credits) credits().then(setBal).catch(() => {}); }, [u]);
  if (!FLAGS.accounts) return (
    <div className="page"><div className="eyebrow">Account</div><h1 className="display">Your library</h1>
      <p className="lede">You don't need an account to read. Everything you do now (shelf, progress, highlights, imports, requests) is kept on this device.</p>
      <LeoneIdCard />
      <XpCard />
      <p><Link className="btn gold" to="/library">Keep reading</Link> <Link className="btn ghost" to="/offline">Offline library</Link></p></div>);
  const run = (p: Promise<unknown>, ok: string) => p.then(() => setMsg(ok)).catch(e => setMsg((e as Error).message));
  return (
    <div className="page"><div className="eyebrow">Account</div>
      {u === undefined ? <p className="muted">Checking…</p> : !u ? <>
        <h1 className="display">Sign in</h1>
        <div className="row gap wrap"><a className="btn gold" href={oauthUrl('google')}>Continue with Google</a><a className="btn gold" href={oauthUrl('github')}>Continue with GitHub</a><button className="btn ghost" onClick={() => passkey('login').then(setU).catch(e => setMsg(e.message))}>Use a passkey</button></div>
        <form className="row gap" onSubmit={e => { e.preventDefault(); run(magicLink(email), 'Check your inbox for a sign-in link.'); }}><input className="fx-in" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" /><button className="btn ghost">Email me a link</button></form>
      </> : <>
        <h1 className="display">{u.name ?? u.email ?? 'Your account'}</h1>
        <p className="muted">Signed in with {u.providers.join(', ')}.</p>
        <div className="row gap"><button className="btn ghost" onClick={() => passkey('register').then(() => setMsg('Passkey added.')).catch(e => setMsg(e.message))}>Add a passkey</button><button className="btn ghost" onClick={() => signOut().then(() => setU(null))}>Sign out</button></div>
        <SyncCard setMsg={setMsg} />
        <LeoneIdCard />
        <XpCard />
        {FLAGS.credits && bal && <section className="glass imp-card"><h2>Credits: {bal.balance}</h2>
          <div className="row gap">{['small', 'medium'].map(p => <button key={p} className="btn gold sm" onClick={() => checkout(p).then(r => { location.href = r.url; }).catch(e => setMsg(e.message))}>Buy {p} pack</button>)}</div>
          <ul className="small">{bal.ledger.map((l, i) => <li key={i}>{new Date(l.at).toLocaleDateString()} · {l.delta > 0 ? '+' : ''}{l.delta} · {l.reason}</li>)}</ul></section>}
      </>}
      {msg && <p role="status">{msg}</p>}
    </div>);
}

/** Encrypted sync: the recovery phrase never leaves this device; the server stores ciphertext only. */
function SyncCard({ setMsg }: { setMsg: (s: string) => void }) {
  const [phrase, setPhrase] = useState(''); const [fresh, setFresh] = useState(''); const [busy, setBusy] = useState(false);
  const go = (p: string) => { if (!validPhrase(p)) { setMsg('A recovery phrase is 8 groups of 5 letters and numbers.'); return; } setBusy(true); syncPull(p).then(n => setMsg(`Synced ${n} items, encrypted on this device before upload.`)).catch(e => setMsg((e as Error).message)).finally(() => setBusy(false)); };
  return <section className="glass imp-card"><h2>Sync across devices</h2>
    <p className="small">Your shelves, highlights, notes and progress are encrypted in this browser with your recovery phrase before they're uploaded. The server only stores the encrypted copy and can't read it. If you lose the phrase, nobody can recover that copy, including us. Anything you did before signing in is merged in.</p>
    {fresh ? <p><b>Write this down:</b> <code className="phrase">{fresh}</code></p> : <button className="btn ghost sm" onClick={() => { const p = newPhrase(); setFresh(p); setPhrase(p); }}>Create a recovery phrase</button>}
    <form className="row gap" onSubmit={e => { e.preventDefault(); go(phrase); }}><label className="sr-only" htmlFor="rp">Recovery phrase</label><input id="rp" className="fx-in" autoComplete="off" spellCheck={false} value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="XXXXX-XXXXX-…" /><button className="btn gold sm" disabled={busy}>{busy ? 'Syncing…' : 'Sync now'}</button></form>
  </section>;
}
