import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { load, save, uid, useShelf, useStored, type Highlight, type Progress } from '../lib/store';
import { PRESETS3D, makeLayout, encodeLayout, decodeLayout, type Layout } from '../lib/layout';
import { THEMES } from '../lib/store';
import { getText, parseText } from '../lib/books';
import { buildEpub, download, today } from '../lib/epub';
import { usePlan } from '../lib/room';
import { STARTER } from './Shelf';

const Local = ({ children }: { children?: ReactNode }) => <div className="example-banner">{children ?? 'Saved on this device only. Accounts and syncing are coming soon.'}</div>;
const Head = ({ eb, t, l }: { eb: string; t: string; l: ReactNode }) => <><div className="eyebrow">{eb}</div><h1 className="display">{t}</h1><p className="lede">{l}</p></>;
type B = { id: number | string; title: string; author: string };
const useBooks = (): B[] => { const [s] = useShelf(); return s.length ? s : STARTER; };
const BookPick = ({ v, set }: { v: string; set: (v: string) => void }) => { const bs = useBooks(); return <select className="fx-in" value={v} onChange={e => set(e.target.value)}>{bs.map(b => <option key={b.id} value={String(b.id)}>{b.title} · {b.author}</option>)}</select>; };
const bookOf = (bs: B[], id: string) => bs.find(b => String(b.id) === id) ?? bs[0];

/* ------------------------------ 1. Public shelves ------------------------------ */
type Pub = { id: string; name: string; bio: string; code: string; at: number };
export function PublicShelves() {
  const rooms = load<Layout[]>('rooms3d', []);
  const [pubs, setPubs] = useStored<Pub[]>('pub-shelves', []);
  const [follows, setFollows] = useStored<{ id: string; name: string; code: string; at: number }[]>('follows', []);
  const [room, setRoom] = useState(rooms[0]?.id ?? ''); const [bio, setBio] = useState(''); const [paste, setPaste] = useState(''); const [msg, setMsg] = useState('');
  const link = (code: string) => `${location.origin}${import.meta.env.BASE_URL}shelf#room=${code}`;
  const publish = () => { const r = rooms.find(x => x.id === room); if (!r) return; const code = encodeLayout(r); setPubs([{ id: uid(), name: r.name, bio, code, at: Date.now() }, ...pubs]); navigator.clipboard?.writeText(link(code)).catch(() => {}); setMsg('Published. Link copied.'); };
  const follow = () => { const m = paste.match(/room=([^&\s]+)/); const l = m && decodeLayout(m[1]); if (!l) return setMsg('That doesn’t look like a Leone shelf link.'); setFollows([{ id: uid(), name: l.name, code: m![1], at: Date.now() }, ...follows]); setPaste(''); setMsg(`Following “${l.name}”.`); };
  return <div className="page wide">
    <Head eb="Public shelves" t="Shelves worth following" l="Publish any of your 3D rooms as a public link. Anyone who opens it sees your exact shelf, books, light and decor, and can follow it." />
    <Local>Shelf links work today: the whole room travels inside the link. Public profiles, follower counts and a feed need accounts, which are coming soon. Until then, “following” keeps the shelf on this device.</Local>
    <div className="two-col">
      <div className="glass pad fx-card"><h3>Publish a shelf</h3>
        {rooms.length ? <><label className="lbl">Room</label><select className="fx-in" value={room} onChange={e => setRoom(e.target.value)}>{rooms.map(r => <option key={r.id} value={r.id}>{r.name} · {r.books.length} books</option>)}</select>
          <label className="lbl">A line about it</label><input className="fx-in" value={bio} onChange={e => setBio(e.target.value)} placeholder="Gothic novels by candlelight" maxLength={120} />
          <button className="btn gold" onClick={publish}>Publish &amp; copy link</button></> : <p className="muted">Build a room first. <Link to="/shelf">Open My Shelf →</Link></p>}
        {msg && <p className="ok-msg">{msg}</p>}
      </div>
      <div className="glass pad fx-card"><h3>Follow a shelf</h3><p className="small muted">Paste a shelf link someone sent you.</p>
        <input className="fx-in" value={paste} onChange={e => setPaste(e.target.value)} placeholder="https://…/shelf#room=…" /><button className="btn ghost" onClick={follow} disabled={!paste}>Follow</button></div>
    </div>
    <h3 className="fx-h">Your published shelves</h3>
    {!pubs.length ? <p className="muted">Nothing published yet.</p> : <div className="fx-grid">{pubs.map(p => { const l = decodeLayout(p.code); return <div key={p.id} className="glass pad fx-tile"><b>{p.name}</b><span className="small muted">{p.bio || 'No description'}</span><span className="tiny muted">{l?.books.length ?? 0} books · published {new Date(p.at).toLocaleDateString()} · followers appear with accounts</span>
      <div className="row gap"><a className="btn ghost sm" href={link(p.code)}>Open</a><button className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(link(p.code))}>Copy link</button><button className="btn ghost sm" onClick={() => setPubs(pubs.filter(x => x.id !== p.id))}>Unpublish</button></div></div>; })}</div>}
    <h3 className="fx-h">Shelves you follow</h3>
    {!follows.length ? <p className="muted">You aren’t following any shelves yet.</p> : <div className="fx-grid">{follows.map(f => <div key={f.id} className="glass pad fx-tile"><b>{f.name}</b><span className="tiny muted">followed {new Date(f.at).toLocaleDateString()}</span><div className="row gap"><a className="btn ghost sm" href={link(f.code)}>Visit</a><button className="btn ghost sm" onClick={() => setFollows(follows.filter(x => x.id !== f.id))}>Unfollow</button></div></div>)}</div>}
  </div>;
}

/* ------------------------------ 2. Theme marketplace ------------------------------ */
export function Marketplace() {
  const [plan] = usePlan(); const pro = plan === 'editor-demo'; const bs = useBooks(); const [msg, setMsg] = useState('');
  const install = (id: string, name: string) => { const rooms = load<Layout[]>('rooms3d', []); const l = makeLayout(id, bs, name); save('rooms3d', [...rooms, l]); save('room3d-active', l.id); setMsg(`“${name}” installed as a new room.`); };
  const [, setDesign] = useStored('design', {} as Record<string, unknown>);
  return <div className="page wide">
    <Head eb="Theme marketplace" t="Rooms and reading themes" l="Install a room for your 3D shelf or a palette for the reader in one click." />
    <Local>The house themes below are real and install now. Creator-made themes, prices and payouts open with the marketplace launch; nothing here charges you.</Local>
    {msg && <p className="ok-msg">{msg} <Link to="/shelf">Open My Shelf →</Link></p>}
    <h3 className="fx-h">3D rooms</h3>
    <div className="fx-grid">{PRESETS3D.map(p => { const locked = !p.free && !pro; return <div key={p.id} className="glass fx-theme"><span className={`p3-sw p3-${p.id}`} /><div className="pad"><b>{p.name}</b><p className="small muted">{p.blurb}</p><div className="row gap"><span className="chip">{p.free ? 'Free' : 'Editor plan'}</span><span className="chip">by Leone Library</span></div>
      <button className="btn gold sm" disabled={locked} onClick={() => install(p.id, p.name)}>{locked ? '🔒 Editor plan' : 'Install'}</button></div></div>; })}</div>
    <h3 className="fx-h">Reader palettes</h3>
    <div className="fx-grid">{Object.entries(THEMES).map(([n, t]) => <div key={n} className="glass fx-theme"><div className="fx-pal" style={{ background: t.bg, color: t.ink }}><span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22 }}>It was the best of times</span><i style={{ background: t.accent }} /></div><div className="pad"><b>{n}</b><div className="row gap"><span className="chip">Free</span></div><button className="btn ghost sm" onClick={() => { setDesign(d => ({ ...d, theme: n, ...t })); setMsg(`Reader palette “${n}” applied.`); }}>Apply</button></div></div>)}</div>
    <div className="glass pad fx-card mt"><h3>Sell your own theme</h3><p className="small muted">Design a room in the editor, then list it here. Creator listings, pricing and revenue share are not open yet.</p><button className="btn ghost" disabled>Submit a theme · coming soon</button></div>
  </div>;
}

/* ------------------------------ 3. Book clubs ------------------------------ */
type Post = { id: string; ch: number; who: string; text: string; at: number };
type Club = { id: string; name: string; book: string; title: string; start: string; perWeek: number; chapters: number; posts: Post[] };
export function Clubs() {
  const bs = useBooks(); const [clubs, setClubs] = useStored<Club[]>('clubs', []); const [cur, setCur] = useState<string>(''); const [me, setMe] = useStored('club-name', '');
  const [f, setF] = useState({ name: '', book: String(bs[0].id), start: today(), perWeek: 3 });
  useEffect(() => { const m = location.hash.match(/club=([^&]+)/); if (!m) return; try { const c = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))) as Club; if (!clubs.find(x => x.id === c.id)) setClubs([...clubs, { ...c, posts: [] }]); setCur(c.id); history.replaceState(null, '', location.pathname); } catch { /* bad link */ } }, []); // eslint-disable-line
  const create = async () => { const b = bookOf(bs, f.book); let chapters = 20; try { chapters = parseText(await getText(Number(b.id))).chapters.length || 20; } catch { /* text not cached: default */ }
    const c: Club = { id: uid(), name: f.name || `${b.title} club`, book: String(b.id), title: b.title, start: f.start, perWeek: f.perWeek, chapters, posts: [] }; setClubs([...clubs, c]); setCur(c.id); };
  const c = clubs.find(x => x.id === cur);
  const upd = (n: Club) => setClubs(clubs.map(x => (x.id === n.id ? n : x)));
  return <div className="page wide">
    <Head eb="Book clubs" t="Read together, at one pace" l="Pick a book and a pace. Everyone gets the same weekly schedule and a discussion thread for each chapter, so nobody gets spoiled." />
    <Local>Schedules and invite links work now. Discussion posts stay on this device until accounts launch; there is no shared server yet.</Local>
    <div className="fx-split">
      <aside className="glass pad fx-card"><h3>Your clubs</h3>{clubs.map(x => <button key={x.id} className={`fx-li ${x.id === cur ? 'on' : ''}`} onClick={() => setCur(x.id)}>{x.name}<small>{x.title}</small></button>)}
        <h4 className="mt">Start a club</h4><input className="fx-in" placeholder="Club name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><BookPick v={f.book} set={v => setF({ ...f, book: v })} />
        <label className="lbl">Start date</label><input className="fx-in" type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} />
        <label className="lbl">Chapters per week: {f.perWeek}</label><input type="range" min={1} max={10} value={f.perWeek} onChange={e => setF({ ...f, perWeek: +e.target.value })} />
        <button className="btn gold" onClick={create}>Create club</button></aside>
      <section className="glass pad fx-card">{!c ? <p className="muted">Create a club or open an invite link.</p> : <ClubView c={c} upd={upd} me={me} setMe={setMe} del={() => { setClubs(clubs.filter(x => x.id !== c.id)); setCur(''); }} />}</section>
    </div>
  </div>;
}
function ClubView({ c, upd, me, setMe, del }: { c: Club; upd: (c: Club) => void; me: string; setMe: (s: string) => void; del: () => void }) {
  const weeks = Math.ceil(c.chapters / c.perWeek); const start = new Date(c.start + 'T00:00');
  const wk = Math.max(0, Math.floor((Date.now() - start.getTime()) / (7 * 864e5))); const unlocked = Math.min(c.chapters, (wk + 1) * c.perWeek);
  const [ch, setCh] = useState(0); const [txt, setTxt] = useState('');
  const invite = () => { const s = btoa(unescape(encodeURIComponent(JSON.stringify({ ...c, posts: [] })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); navigator.clipboard?.writeText(`${location.origin}${location.pathname}#club=${s}`); };
  return <><div className="row between wrap"><div><h3>{c.name}</h3><p className="small muted">{c.title} · {c.chapters} chapters · {c.perWeek}/week · {weeks} weeks from {start.toLocaleDateString()}</p></div><div className="row gap"><button className="btn ghost sm" onClick={invite}>Copy invite link</button><Link className="btn ghost sm" to={`/read?id=${c.book}&ch=${Math.max(0, unlocked - 1)}`}>Read this week</Link><button className="btn ghost sm" onClick={del}>Leave</button></div></div>
    <div className="fx-weeks">{Array.from({ length: weeks }, (_, w) => <div key={w} className={`fx-week ${w < wk ? 'done' : w === wk ? 'now' : ''}`}><b>Week {w + 1}</b><span>Ch. {w * c.perWeek + 1}–{Math.min(c.chapters, (w + 1) * c.perWeek)}</span></div>)}</div>
    <div className="row gap wrap mt"><label className="lbl">Discuss chapter</label><select className="fx-in sm" value={ch} onChange={e => setCh(+e.target.value)}>{Array.from({ length: c.chapters }, (_, i) => <option key={i} value={i} disabled={i >= unlocked}>Chapter {i + 1}{i >= unlocked ? ' · unlocks later' : ''}</option>)}</select></div>
    <ul className="fx-thread">{c.posts.filter(p => p.ch === ch).map(p => <li key={p.id}><b>{p.who}</b><span className="tiny muted"> {new Date(p.at).toLocaleString()}</span><p>{p.text}</p></li>)}{!c.posts.some(p => p.ch === ch) && <li className="muted small">No posts on this chapter yet.</li>}</ul>
    <div className="row gap"><input className="fx-in sm" style={{ maxWidth: 160 }} placeholder="Your name" value={me} onChange={e => setMe(e.target.value)} /><input className="fx-in" placeholder="Share a thought on this chapter…" value={txt} onChange={e => setTxt(e.target.value)} /><button className="btn gold sm" disabled={!txt || !me} onClick={() => { upd({ ...c, posts: [...c.posts, { id: uid(), ch, who: me, text: txt, at: Date.now() }] }); setTxt(''); }}>Post</button></div></>;
}

/* ------------------------------ 4. Shared notes ------------------------------ */
export function SharedNotes() {
  const data = useMemo(() => { const m = location.hash.match(/n=([^&]+)/); if (!m) return null; try { return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))) as { id: number; title: string; who: string; hl: Highlight[] }; } catch { return null; } }, []);
  const [, setMine] = useStored<Highlight[]>(data ? `highlights:${data.id}` : 'highlights:none', []); const [done, setDone] = useState(false);
  if (!data) return <div className="page"><Head eb="Shared notes" t="Margin notes, passed hand to hand" l="In the reader, open Notes and press “Share notes” to send your highlights and margin notes as a link. Whoever opens it can read them and add them to their own copy." /><Link className="btn gold" to="/library">Find a book</Link></div>;
  return <div className="page"><Head eb="Shared notes" t={data.title} l={<>{data.hl.length} highlights and notes shared by {data.who || 'a reader'}.</>} />
    <Local>These notes came inside the link; nothing was uploaded.</Local>
    <ul className="notes fx-notes">{data.hl.map(h => <li key={h.id}><span className="tiny muted">Chapter {h.chapter + 1}</span><q>{h.text}</q>{h.note && <p>{h.note}</p>}</li>)}</ul>
    <div className="row gap"><button className="btn gold" disabled={done} onClick={() => { setMine(m => [...m, ...data.hl.filter(h => !m.some(x => x.id === h.id))]); setDone(true); }}>{done ? 'Added to your copy' : 'Add to my copy'}</button><Link className="btn ghost" to={`/read?id=${data.id}`}>Open the book</Link></div></div>;
}
export const shareNotesLink = (id: number, title: string, who: string, hl: Highlight[]) => `${location.origin}${import.meta.env.BASE_URL}notes#n=${btoa(unescape(encodeURIComponent(JSON.stringify({ id, title, who, hl })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

/* ------------------------------ 5. Goals, streaks, recap ------------------------------ */
export function Goals() {
  const [log, setLog] = useStored<Record<string, number>>('readlog', {}); const [goal, setGoal] = useStored('goal', { books: 12, minutes: 20 });
  const [finished, setFinished] = useStored<{ id: string; title: string; at: number }[]>('finished', []); const bs = useBooks(); const [pick, setPick] = useState(String(bs[0].id)); const [mins, setMins] = useState(15);
  const y = new Date().getFullYear();
  const streak = useMemo(() => { let n = 0; const d = new Date(); if (!log[today(d)]) d.setDate(d.getDate() - 1); while (log[today(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }, [log]);
  const best = useMemo(() => { const days = Object.keys(log).filter(k => log[k] > 0).sort(); let b = 0, r = 0, prev = 0; for (const k of days) { const t = new Date(k + 'T00:00').getTime(); r = prev && t - prev < 1.5 * 864e5 ? r + 1 : 1; b = Math.max(b, r); prev = t; } return b; }, [log]);
  const yearMin = Object.entries(log).filter(([k]) => k.startsWith(String(y))).reduce((s, [, v]) => s + v, 0);
  const finY = finished.filter(f => new Date(f.at).getFullYear() === y);
  const started = Object.keys(localStorage).filter(k => k.startsWith('leone:progress:')).map(k => ({ id: k.split(':')[2], p: load<Progress>(k.slice(6), { chapter: 0, pct: 0, at: 0 }) })).filter(x => x.p.at && new Date(x.p.at).getFullYear() === y);
  const hlCount = Object.keys(localStorage).filter(k => k.startsWith('leone:highlights:')).reduce((s, k) => s + load<Highlight[]>(k.slice(6), []).length, 0);
  const days: string[] = []; for (let i = 7 * 26 - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(today(d)); }
  const byMonth = Array.from({ length: 12 }, (_, m) => Object.entries(log).filter(([k]) => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).reduce((s, [, v]) => s + v, 0)); const maxM = Math.max(1, ...byMonth);
  return <div className="page wide">
    <Head eb="Reading goals" t={`Your ${y} in reading`} l="Set a yearly goal and a daily habit. The reader logs your time automatically while you read; you can add sessions by hand too." />
    <Local>Every number here comes from your own reading on this device. Nothing is estimated or invented.</Local>
    <div className="kpis"><div className="kpi glass"><span>Current streak</span><b className="gold-t">{streak} {streak === 1 ? 'day' : 'days'}</b></div><div className="kpi glass"><span>Best streak</span><b>{best}</b></div><div className="kpi glass"><span>Books finished in {y}</span><b>{finY.length} / {goal.books}</b></div><div className="kpi glass"><span>Minutes read in {y}</span><b>{yearMin}</b></div></div>
    <div className="glass pad fx-card mt"><h3>Last 26 weeks</h3><div className="fx-heat">{days.map(d => { const v = log[d] || 0; return <i key={d} title={`${d}: ${v} min`} style={{ opacity: v ? .25 + Math.min(1, v / Math.max(1, goal.minutes)) * .75 : .08 }} className={v >= goal.minutes ? 'hit' : ''} />; })}</div><p className="tiny muted">Gold squares meet your daily goal of {goal.minutes} minutes.</p></div>
    <div className="two-col mt">
      <div className="glass pad fx-card"><h3>Goals</h3><label className="lbl">Books this year: {goal.books}</label><input type="range" min={1} max={100} value={goal.books} onChange={e => setGoal({ ...goal, books: +e.target.value })} /><label className="lbl">Minutes a day: {goal.minutes}</label><input type="range" min={5} max={120} step={5} value={goal.minutes} onChange={e => setGoal({ ...goal, minutes: +e.target.value })} />
        <div className="fx-bar"><span style={{ width: `${Math.min(100, (finY.length / goal.books) * 100)}%` }} /></div></div>
      <div className="glass pad fx-card"><h3>Log reading</h3><label className="lbl">Minutes today</label><div className="row gap"><input className="fx-in sm" type="number" min={1} max={600} value={mins} onChange={e => setMins(+e.target.value)} /><button className="btn ghost sm" onClick={() => setLog({ ...log, [today()]: (log[today()] || 0) + mins })}>Add</button></div>
        <label className="lbl">Mark a book finished</label><div className="row gap"><BookPick v={pick} set={setPick} /><button className="btn ghost sm" onClick={() => { const b = bookOf(bs, pick); setFinished([...finished, { id: String(b.id), title: b.title, at: Date.now() }]); }}>Finished</button></div></div>
    </div>
    <div className="glass pad fx-card mt fx-recap"><div className="eyebrow">Yearly recap</div><h2 className="display">{y}, so far</h2>
      <div className="fx-months">{byMonth.map((v, m) => <div key={m}><i style={{ height: `${(v / maxM) * 100}%` }} /><span>{'JFMAMJJASOND'[m]}</span></div>)}</div>
      <p className="lede">{yearMin ? <>You read for <b>{Math.round(yearMin / 60 * 10) / 10} hours</b>, opened <b>{started.length}</b> {started.length === 1 ? 'book' : 'books'}, finished <b>{finY.length}</b> and left <b>{hlCount}</b> highlights and notes.</> : 'Your recap fills in as you read. Open any book and it starts counting.'}</p>
      {finY.length > 0 && <p className="small muted">Finished: {finY.map(f => f.title).join(' · ')}</p>}</div>
  </div>;
}
/** Called from the reader: adds whole active minutes to today's log. */
export function logReading(min: number) { const l = load<Record<string, number>>('readlog', {}); const k = today(); save('readlog', { ...l, [k]: (l[k] || 0) + min }); }

/* ------------------------------ 6. Translation glossary ------------------------------ */
type Term = { id: string; src: string; tgt: string; note: string; pos: string };
export function Glossary() {
  const [projs, setProjs] = useStored<{ id: string; name: string; from: string; to: string; terms: Term[] }[]>('glossaries', []); const [cur, setCur] = useState(projs[0]?.id ?? ''); const [q, setQ] = useState('');
  const g = projs.find(p => p.id === cur); const [t, setT] = useState({ src: '', tgt: '', note: '', pos: 'noun' });
  const upd = (terms: Term[]) => setProjs(projs.map(p => (p.id === cur ? { ...p, terms } : p)));
  const csv = () => { if (!g) return; const rows = [['source', 'target', 'part of speech', 'note'], ...g.terms.map(x => [x.src, x.tgt, x.pos, x.note])].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'); download(new Blob([rows], { type: 'text/csv' }), `${g.name}-glossary.csv`); };
  const imp = (file: File) => file.text().then(s => { const rows = s.split(/\r?\n/).slice(1).filter(Boolean).map(l => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'))); upd([...(g?.terms ?? []), ...rows.filter(r => r[0]).map(r => ({ id: uid(), src: r[0], tgt: r[1] ?? '', pos: r[2] ?? '', note: r[3] ?? '' }))]); });
  return <div className="page wide">
    <Head eb="Studio · Glossary" t="Translation glossary" l="Keep names, places and tricky terms consistent across a whole translation. Export to CSV for any CAT tool, or import one." />
    <Local />
    <div className="fx-split">
      <aside className="glass pad fx-card"><h3>Glossaries</h3>{projs.map(p => <button key={p.id} className={`fx-li ${p.id === cur ? 'on' : ''}`} onClick={() => setCur(p.id)}>{p.name}<small>{p.from} → {p.to} · {p.terms.length} terms</small></button>)}
        <button className="btn ghost sm mt" onClick={() => { const n = prompt('Glossary name (e.g. “Crime and Punishment, EN→ES”)'); if (!n) return; const p = { id: uid(), name: n, from: 'source', to: 'target', terms: [] }; setProjs([...projs, p]); setCur(p.id); }}>+ New glossary</button></aside>
      <section className="glass pad fx-card">{!g ? <p className="muted">Create a glossary to begin.</p> : <>
        <div className="row between wrap"><h3>{g.name}</h3><div className="row gap"><input className="fx-in sm" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} /><button className="btn ghost sm" onClick={csv}>Export CSV</button><label className="btn ghost sm">Import CSV<input type="file" accept=".csv" hidden onChange={e => e.target.files?.[0] && imp(e.target.files[0])} /></label></div></div>
        <div className="row gap wrap"><input className="fx-in" placeholder="Source term" value={t.src} onChange={e => setT({ ...t, src: e.target.value })} /><input className="fx-in" placeholder="Translation" value={t.tgt} onChange={e => setT({ ...t, tgt: e.target.value })} /><select className="fx-in sm" value={t.pos} onChange={e => setT({ ...t, pos: e.target.value })}>{['noun', 'name', 'place', 'verb', 'idiom', 'title'].map(x => <option key={x}>{x}</option>)}</select><input className="fx-in" placeholder="Note (style, context)" value={t.note} onChange={e => setT({ ...t, note: e.target.value })} /><button className="btn gold sm" disabled={!t.src} onClick={() => { upd([...g.terms, { id: uid(), ...t }]); setT({ src: '', tgt: '', note: '', pos: t.pos }); }}>Add</button></div>
        <table className="tbl mt"><thead><tr><th>Source</th><th>Translation</th><th>Type</th><th>Note</th><th /></tr></thead><tbody>{g.terms.filter(x => !q || (x.src + x.tgt).toLowerCase().includes(q.toLowerCase())).map(x => <tr key={x.id}><td>{x.src}</td><td>{x.tgt}</td><td><span className="chip">{x.pos}</span></td><td className="small muted">{x.note}</td><td><button className="link" onClick={() => upd(g.terms.filter(y => y.id !== x.id))}>Remove</button></td></tr>)}</tbody></table>
        {!g.terms.length && <p className="muted small">No terms yet.</p>}</>}</section>
    </div>
  </div>;
}

/* ------------------------------ 7. Co-authored remixes ------------------------------ */
type Ver = { id: string; who: string; msg: string; text: string; at: number };
type Collab = { id: string; title: string; authors: { name: string; share: number }[]; versions: Ver[] };
function diff(a: string[], b: string[]) { const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [' ' | '+' | '-', string][] = []; let i = 0, j = 0; while (i < n && j < m) { if (a[i] === b[j]) { out.push([' ', a[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', a[i++]]); else out.push(['+', b[j++]]); } while (i < n) out.push(['-', a[i++]]); while (j < m) out.push(['+', b[j++]]); return out; }
export function CollabStudio() {
  const [docs, setDocs] = useStored<Collab[]>('collabs', []); const [cur, setCur] = useState(docs[0]?.id ?? ''); const d = docs.find(x => x.id === cur);
  const [text, setText] = useState(''); const [who, setWho] = useStored('club-name', ''); const [msg, setMsg] = useState(''); const [cmp, setCmp] = useState<[string, string] | null>(null);
  useEffect(() => { setText(d?.versions.slice(-1)[0]?.text ?? ''); setCmp(null); }, [cur]); // eslint-disable-line
  const upd = (n: Collab) => setDocs(docs.map(x => (x.id === n.id ? n : x)));
  const total = d?.authors.reduce((s, a) => s + a.share, 0) ?? 0;
  return <div className="page wide">
    <Head eb="Studio · Co-authoring" t="Remix together" l="Write a remix with co-authors: every save is a version you can compare and restore, and royalty splits are agreed up front." />
    <Local>Versions and splits are saved on this device. Real-time co-editing and paying out splits need accounts and a signed Leone Publishing agreement, both coming soon. No money moves here.</Local>
    <div className="fx-split">
      <aside className="glass pad fx-card"><h3>Projects</h3>{docs.map(x => <button key={x.id} className={`fx-li ${x.id === cur ? 'on' : ''}`} onClick={() => setCur(x.id)}>{x.title}<small>{x.versions.length} versions · {x.authors.length} authors</small></button>)}
        <button className="btn ghost sm mt" onClick={() => { const t = prompt('Remix title'); if (!t) return; const n: Collab = { id: uid(), title: t, authors: [{ name: who || 'You', share: 100 }], versions: [] }; setDocs([...docs, n]); setCur(n.id); }}>+ New remix</button></aside>
      <section className="glass pad fx-card">{!d ? <p className="muted">Start a remix project.</p> : <>
        <h3>{d.title}</h3>
        <textarea className="fx-in fx-ta" value={text} onChange={e => setText(e.target.value)} placeholder="Write or paste your chapter…" />
        <div className="row gap wrap"><input className="fx-in sm" style={{ maxWidth: 150 }} placeholder="Your name" value={who} onChange={e => setWho(e.target.value)} /><input className="fx-in" placeholder="What changed?" value={msg} onChange={e => setMsg(e.target.value)} /><button className="btn gold sm" disabled={!who || text === (d.versions.slice(-1)[0]?.text ?? '')} onClick={() => { upd({ ...d, versions: [...d.versions, { id: uid(), who, msg: msg || 'Edit', text, at: Date.now() }] }); setMsg(''); }}>Save version</button></div>
        <div className="two-col mt">
          <div><h4>Version history</h4><ol className="fx-vers">{[...d.versions].reverse().map((v, i, arr) => <li key={v.id}><b>{v.msg}</b><span className="tiny muted">{v.who} · {new Date(v.at).toLocaleString()} · {v.text.split(/\s+/).filter(Boolean).length} words</span><div className="row gap">{arr[i + 1] && <button className="link" onClick={() => setCmp([arr[i + 1].id, v.id])}>Compare with previous</button>}<button className="link" onClick={() => setText(v.text)}>Restore</button></div></li>)}</ol>{!d.versions.length && <p className="small muted">Save the first version.</p>}</div>
          <div><h4>Royalty splits</h4>{d.authors.map((a, i) => <div key={i} className="row gap fx-split-row"><input className="fx-in sm" value={a.name} onChange={e => upd({ ...d, authors: d.authors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /><input className="fx-in sm" type="number" min={0} max={100} value={a.share} onChange={e => upd({ ...d, authors: d.authors.map((x, j) => (j === i ? { ...x, share: +e.target.value } : x)) })} /><span>%</span>{d.authors.length > 1 && <button className="link" onClick={() => upd({ ...d, authors: d.authors.filter((_, j) => j !== i) })}>×</button>}</div>)}
            <button className="btn ghost sm" onClick={() => upd({ ...d, authors: [...d.authors, { name: 'Co-author', share: 0 }] })}>+ Co-author</button>
            <p className={total === 100 ? 'ok-msg' : 'small'} style={total === 100 ? {} : { color: '#ff9a8a' }}>{total === 100 ? 'Splits add up to 100%.' : `Splits add up to ${total}%. They need to total 100%.`}</p>
            <p className="tiny muted">Splits apply to the authors’ share of net royalties (85–90%) under a future Leone Publishing agreement.</p></div>
        </div>
        {cmp && (() => { const a = d.versions.find(v => v.id === cmp[0])!, b = d.versions.find(v => v.id === cmp[1])!; return <div className="fx-diff mt"><h4>{a.msg} → {b.msg}</h4>{diff(a.text.split('\n'), b.text.split('\n')).map(([k, l], i) => <div key={i} className={`dl ${k === '+' ? 'add' : k === '-' ? 'del' : ''}`}>{k} {l || ' '}</div>)}</div>; })()}</>}</section>
    </div>
  </div>;
}

/* ------------------------------ 8. Export: EPUB, PDF, print ------------------------------ */
export function ExportPage() {
  const bs = useBooks(); const [pick, setPick] = useState(String(bs[0].id)); const [state, setState] = useState(''); const [trim, setTrim] = useState('5.5x8.5'); const [paper, setPaper] = useState<'cream' | 'white'>('cream'); const [pages, setPages] = useState(320);
  const b = bookOf(bs, pick);
  const getCh = async () => { const t = await getText(Number(b.id)); const p = parseText(t).chapters; const ed = load<{ chapter: number; para: number; text: string }[]>(`edits:${b.id}`, []); return p.map((c, ci) => ({ ...c, paras: c.paras.map((x, pi) => ed.find(e => e.chapter === ci && e.para === pi)?.text ?? x) })); };
  const epub = async () => { setState('Building EPUB…'); try { const ch = await getCh(); download(buildEpub({ title: b.title, author: b.author, lang: 'en', source: 'Project Gutenberg' }, ch), `${b.title.replace(/[^\w]+/g, '-')}.epub`); setState(`EPUB ready: ${ch.length} chapters, including your edits.`); } catch { setState('This text isn’t in the cached collection yet, so it can’t be exported in the browser.'); } };
  const pdf = async () => { setState('Preparing print layout…'); try { const ch = await getCh(); const w = window.open('', '_blank'); if (!w) return setState('Allow pop-ups to open the print layout.'); const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    w.document.write(`<!doctype html><title>${e(b.title)}</title><style>@page{size:${trim.replace('x', 'in ')}in;margin:.7in .6in}body{font:11.5pt/1.5 Georgia,serif;color:#111}h1{text-align:center;margin-top:35%;font-weight:normal;font-size:28pt}h2{page-break-before:always;text-align:center;font-weight:normal;margin:1.2in 0 .4in}p{margin:0;text-indent:1.4em;text-align:justify}.a{text-align:center;text-indent:0}</style><h1>${e(b.title)}</h1><p class="a">${e(b.author)}</p>${ch.map(c => `<h2>${e(c.title)}</h2>${c.paras.map(p => `<p>${e(p)}</p>`).join('')}`).join('')}<script>setTimeout(()=>print(),400)<\/script>`); w.document.close(); setState('Print layout opened. Choose “Save as PDF” in the print dialog.'); } catch { setState('This text isn’t in the cached collection yet.'); } };
  const [tw, th] = trim.split('x').map(Number); const ppi = paper === 'cream' ? 0.0025 : 0.002252; const spine = pages * ppi; const coverW = tw * 2 + spine + 0.25;
  return <div className="page wide">
    <Head eb="Export" t="Take your edition anywhere" l="Download a real EPUB of any cached book with your own edits, print it to PDF, and size a print-on-demand cover." />
    <div className="two-col">
      <div className="glass pad fx-card"><h3>Ebook &amp; PDF</h3><BookPick v={pick} set={setPick} /><div className="row gap wrap mt"><button className="btn gold" onClick={epub}>Download EPUB</button><button className="btn ghost" onClick={pdf}>Print / save PDF</button></div>{state && <p className="small muted">{state}</p>}
        <p className="tiny muted">EPUB 3, built entirely in your browser. Validated structure: mimetype, container, OPF, nav, one XHTML file per chapter.</p></div>
      <div className="glass pad fx-card"><h3>Print-on-demand cover size</h3>
        <label className="lbl">Trim size</label><div className="chips">{['5x8', '5.5x8.5', '6x9'].map(t => <button key={t} className={`chipbtn ${trim === t ? 'on' : ''}`} onClick={() => setTrim(t)}>{t.replace('x', '″ × ')}″</button>)}</div>
        <label className="lbl">Paper</label><div className="chips">{(['cream', 'white'] as const).map(p => <button key={p} className={`chipbtn ${paper === p ? 'on' : ''}`} onClick={() => setPaper(p)}>{p}</button>)}</div>
        <label className="lbl">Page count: {pages}</label><input type="range" min={24} max={800} step={2} value={pages} onChange={e => setPages(+e.target.value)} />
        <div className="fx-cover"><i style={{ flex: tw }}>Back</i><i className="sp" style={{ flex: Math.max(spine, .05) }} /><i style={{ flex: tw }}>Front</i></div>
        <div className="stack"><div className="stk-row"><span>Spine width</span><b>{spine.toFixed(3)}″</b></div><div className="stk-row"><span>Full cover with 0.125″ bleed</span><b>{coverW.toFixed(3)}″ × {(th + 0.25).toFixed(3)}″</b></div></div>
        <p className="tiny muted">Uses common POD paper calipers (cream 0.0025″, white 0.002252″ per page). Ordering printed copies opens with Leone Publishing’s print partner, coming soon.</p><button className="btn ghost sm" disabled>Order printed copies · coming soon</button></div>
    </div>
  </div>;
}

/* ------------------------------ 9. Monthly contest (homepage) ------------------------------ */
const PROMPTS = ['Retell a ghost story from the ghost’s side', 'Translate one chapter into a language you love', 'Write the missing chapter of a classic', 'Design a cover for a book with none', 'Move a classic into your own city', 'Give a minor character the last word', 'Rewrite a fairy tale for today', 'A sequel nobody expected', 'Best translated poem', 'A classic, retold in letters', 'Turn a chapter into a play scene', 'Write a winter tale from a summer book'];
export function Contest() {
  const d = new Date(), month = d.toLocaleString('en', { month: 'long' }), prompt = PROMPTS[d.getMonth()], end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const left = Math.ceil((end.getTime() - d.getTime()) / 864e5);
  const key = `contest:${d.getFullYear()}-${d.getMonth() + 1}`; const [entry, setEntry] = useStored<{ title: string; text: string } | null>(key, null); const [open, setOpen] = useState(false); const [f, setF] = useState(entry ?? { title: '', text: '' });
  return <section className="section fx-contest"><div className="glass pad fx-contest-in">
    <div><div className="eyebrow">{month} contest</div><h2 className="display">{prompt}</h2><p className="lede">Any public-domain book is fair game. Entries close {left <= 0 ? 'tonight at midnight' : <>on {end.toLocaleDateString('en', { month: 'long', day: 'numeric' })}, {left} {left === 1 ? 'day' : 'days'} from now</>}.</p>
      <p className="small muted">Prize to be announced. Public entry and judging open when accounts launch; until then your entry is saved as a draft on this device.</p>
      <div className="row gap wrap"><button className="btn gold" onClick={() => setOpen(!open)}>{entry ? 'Edit your draft entry' : 'Draft an entry'}</button><Link className="btn ghost" to="/studio/remix">Open the Studio</Link></div></div>
    <div className="fx-contest-side"><b>Entries so far</b><p className="small muted">{entry ? '1 draft (yours, on this device). Public entries appear here once submissions open.' : 'None yet. Public entries appear here once submissions open.'}</p></div>
    {open && <div className="fx-entry"><input className="fx-in" placeholder="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /><textarea className="fx-in fx-ta" placeholder="Your entry…" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} /><button className="btn gold sm" disabled={!f.title} onClick={() => { setEntry(f); setOpen(false); }}>Save draft</button></div>}
  </div></section>;
}
