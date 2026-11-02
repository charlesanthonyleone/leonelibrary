import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { author, getBook, getChapters, langName, LANGS, rightsFor, type Book } from '../lib/books';
import { runAI } from '../lib/ai';
import { AIStub, RightsTag, Soon } from '../components/ui';
import { uid, useProjects, type Project } from '../lib/store';

export function StudioHub() {
  return (
    <div className="page">
      <div className="eyebrow">The Studio</div>
      <h1 className="display">AI Rewrites Everything</h1>
      <p className="lede">Four tools, one rule: start from a public-domain original, and keep a record of every change.</p>
      <AIStub />
      <div className="feature-grid">
        <Link to="/studio/translate" className="feature glass hl"><h3>Translate</h3><p>A whole book from the original language, side by side, in faithful, modern or simplified style.</p></Link>
        <Link to="/studio/remix" className="feature glass"><h3>Remix</h3><p>Make yourself the protagonist. Change the setting, era or voice.</p></Link>
        <Link to="/studio/continue" className="feature glass"><h3>Continue</h3><p>Write new books in an existing world, with protected names flagged.</p></Link>
        <Link to="/design" className="feature glass"><h3>Design</h3><p>Fonts, colours, covers, layout and spine animation. Works today.</p></Link>
      </div>
    </div>
  );
}

function useSaveProject() {
  const [projects, setProjects] = useProjects();
  return (p: Omit<Project, 'id' | 'createdAt' | 'status'>) => { const n: Project = { ...p, id: uid(), createdAt: Date.now(), status: 'awaiting-ai' }; setProjects([n, ...projects]); return n; };
}

type Src = { key: string; label: string; lang: string; kind: 'pg' | 'ws'; id?: number; title?: string };
const PRESETS: Src[] = [
  { key: 'pg:22367', label: 'Die Verwandlung — Kafka (1915)', lang: 'de', kind: 'pg', id: 22367 },
  { key: 'pg:4650', label: "Candide, ou l'optimisme — Voltaire (1759)", lang: 'fr', kind: 'pg', id: 4650 },
];
const STYLES = { faithful: 'Faithful: close to the original sentence by sentence', modern: 'Modern: contemporary idiom, same story and tone', simplified: 'Simplified: clear, shorter sentences for younger or new readers' };

export function Translate() {
  const [sp] = useSearchParams();
  const qid = Number(sp.get('id')) || 0;
  const [srcs, setSrcs] = useState<Src[]>(PRESETS);
  const [srcKey, setSrcKey] = useState(PRESETS[0].key);
  const [paras, setParas] = useState<string[] | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [target, setTarget] = useState('en');
  const [style, setStyle] = useState<keyof typeof STYLES>('faithful');
  const [scope, setScope] = useState('whole');
  const [glossary, setGlossary] = useState('');
  const [wsq, setWsq] = useState('');
  const [wsHits, setWsHits] = useState<{ title: string; wordcount: number }[]>([]);
  const [run, setRun] = useState<'idle' | 'running' | 'stub'>('idle');
  const [saved, setSaved] = useState('');
  const [qBook, setQBook] = useState<Book | null>(null);
  const save = useSaveProject();
  const src = srcs.find(s => s.key === srcKey) ?? srcs[0];

  useEffect(() => { if (!qid) return; getBook(qid).then(b => { setQBook(b); const s: Src = { key: `pg:${b.id}`, label: `${b.title.split(/[;:]/)[0]} — ${author(b)}`, lang: b.languages[0], kind: 'pg', id: b.id };
    setSrcs(x => x.some(y => y.key === s.key) ? x : [s, ...x]); setSrcKey(s.key); }).catch(() => {}); }, [qid]);
  useEffect(() => {
    let live = true; setState('loading'); setParas(null); setRun('idle');
    const p = getChapters(src.id!).then(cs => cs.flatMap(c => [c.title, ...c.paras]));
    p.then(x => { if (live) { setParas(x); setState('ok'); } }).catch(() => live && setState('err'));
    return () => { live = false; };
  }, [src.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const words = useMemo(() => paras?.join(' ').split(/\s+/).length ?? 0, [paras]);
  const segs = paras?.slice(0, 14) ?? [];
  const go = async () => { setRun('running'); await runAI({ kind: 'translate', input: segs.join('\n'), options: { target, style, scope } }); setRun('stub');
    const p = save({ kind: 'translation', title: `${src.label.split(' — ')[0]} (${langName(target)}, ${style})`, sourceId: src.id ?? src.key, sourceTitle: src.label, detail: `${langName(src.lang)} → ${langName(target)} · ${style} · ${scope}` }); setSaved(p.title); };

  return (
    <div className="page wide">
      <div className="eyebrow">The Studio · Translate</div>
      <h1 className="display">Translate a whole book</h1>
      <p className="lede">Work from the public-domain original, never from a later translation that may still be under copyright.</p>
      <ol className="steps"><li className="on">Choose the original</li><li className={state === 'ok' ? 'on' : ''}>Set the style</li><li className={run !== 'idle' ? 'on' : ''}>Translate side by side</li><li>Review &amp; publish</li></ol>
      <div className="studio-grid">
        <div className="glass pad">
          <h3>1 · Original text</h3>
          <label>Source<select value={srcKey} onChange={e => setSrcKey(e.target.value)}>{srcs.map(s => <option key={s.key} value={s.key}>{s.label} · {langName(s.lang)}</option>)}</select></label>
          <div className="small muted"><>From Leone Library book #{src.id}, complete and public domain worldwide.</> {qBook && src.id === qBook.id && <RightsTag r={rightsFor(qBook)} />}</div>
          <h3 className="mt">2 · Style</h3>
          <label>Into<select value={target} onChange={e => setTarget(e.target.value)}>{Object.entries(LANGS).filter(([k]) => k !== src.lang).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="radio-cards">{(Object.keys(STYLES) as (keyof typeof STYLES)[]).map(k => <button key={k} className={style === k ? 'on' : ''} onClick={() => setStyle(k)}><b>{k[0].toUpperCase() + k.slice(1)}</b><span>{STYLES[k].split(': ')[1]}</span></button>)}</div>
          <label>Scope<select value={scope} onChange={e => setScope(e.target.value)}><option value="whole">Whole book ({words.toLocaleString()} words)</option><option value="chapter">First chapter only</option><option value="sample">Sample (first 14 passages)</option></select></label>
          <label>Glossary · names &amp; terms to keep consistent<textarea rows={3} value={glossary} onChange={e => setGlossary(e.target.value)} placeholder={'Настенька = Nastenka\nПетербург = Petersburg'} /></label>
          <button className="btn gold full" disabled={state !== 'ok' || run === 'running'} onClick={go}>{run === 'running' ? 'Contacting engine…' : `Translate ${scope === 'whole' ? 'the whole book' : scope === 'chapter' ? 'chapter one' : 'the sample'}`}</button>
          {saved && <p className="small ok-msg">Saved “{saved}” to your projects. It links back to the original under Editions.</p>}
        </div>
        <div className="glass pad sbs-wrap">
          <h3>3 · Side by side</h3>
          {run === 'stub' && <AIStub msg="The original is loaded and segmented; translated text will fill the right column when the engine is live." />}
          {state === 'loading' && <p className="muted"><span className="spin" /> Loading the original…</p>}
          {state === 'err' && <p className="muted">Couldn't load this source. Try another.</p>}
          {state === 'ok' && <div className="sbs">
            <div className="sbs-h"><span>{langName(src.lang)} · original</span><span>{langName(target)} · {style}</span></div>
            {segs.map((p, i) => <div className="sbs-row" key={i}><p lang={src.lang}>{p}</p><p className={`ghost-text ${run === 'running' ? 'shimmer' : ''}`}>{run === 'idle' ? '—' : 'Awaiting AI engine'}</p></div>)}
            <p className="tiny muted center">Showing the first {segs.length} of {paras!.length.toLocaleString()} passages.</p>
          </div>}
        </div>
      </div>
    </div>
  );
}

function SourcePicker({ value, onChange }: { value: number; onChange: (b: Book) => void }) {
  const [opts, setOpts] = useState<Book[]>([]);
  useEffect(() => { import('../lib/books').then(m => m.getSnapshot()).then(s => { const list = s.results.filter(b => s.bundled.includes(b.id)); setOpts(list); const hit = list.find(b => b.id === value) ?? list[0]; if (hit) onChange(hit); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <label>Source book<select value={value} onChange={e => { const b = opts.find(o => o.id === +e.target.value); if (b) onChange(b); }}>{opts.map(b => <option key={b.id} value={b.id}>{b.title.split(/[;:]/)[0]} — {author(b)}</option>)}</select></label>;
}

const LEADS: Record<number, string> = { 1342: 'Elizabeth', 84: 'Victor', 2701: 'Ishmael', 11: 'Alice', 1661: 'Holmes', 345: 'Jonathan', 2554: 'Raskolnikov', 174: 'Dorian', 98: 'Sydney', 64317: 'Gatsby', 43: 'Utterson', 1952: 'John', 22367: 'Gregor', 4650: 'Candide' };

export function Remix() {
  const [sp] = useSearchParams();
  const [b, setB] = useState<Book | null>(null);
  const [lead, setLead] = useState('');
  const [you, setYou] = useState('');
  const [setting, setSetting] = useState('');
  const [era, setEra] = useState('Original');
  const [voice, setVoice] = useState('Original');
  const [preview, setPreview] = useState<string[]>([]);
  const [run, setRun] = useState(false);
  const save = useSaveProject();
  useEffect(() => { if (!b) return; setLead(LEADS[b.id] ?? ''); getChapters(b.id).then(cs => setPreview(cs[0]?.paras.slice(0, 5) ?? [])).catch(() => setPreview([])); }, [b]);
  const swapped = preview.map(p => lead && you ? p.split(new RegExp(`\\b${lead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')).join(`\u0000${you}\u0000`) : p);
  return (
    <div className="page wide">
      <div className="eyebrow">The Studio · Remix</div>
      <h1 className="display">Step into the story</h1>
      <p className="lede">Make yourself the protagonist, or move the whole book to another place, era or voice.</p>
      <div className="studio-grid">
        <div className="glass pad">
          <SourcePicker value={Number(sp.get('id')) || 1342} onChange={setB} />
          <label>Protagonist in the original<input value={lead} onChange={e => setLead(e.target.value)} /></label>
          <label>Your name<input value={you} onChange={e => setYou(e.target.value)} placeholder="e.g. Charles" /></label>
          <label>New setting<input value={setting} onChange={e => setSetting(e.target.value)} placeholder="e.g. 1920s New York, a Martian colony" /></label>
          <label>Era<select value={era} onChange={e => setEra(e.target.value)}>{['Original', 'Ancient', 'Renaissance', 'Victorian', 'Jazz Age', 'Present day', 'Far future'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Voice<select value={voice} onChange={e => setVoice(e.target.value)}>{['Original', 'First person', 'Noir', 'Comic', 'Lyrical', 'Young readers'].map(x => <option key={x}>{x}</option>)}</select></label>
          <button className="btn gold full" disabled={!b} onClick={async () => { setRun(true); await runAI({ kind: 'remix', input: '', options: { you, setting, era, voice } }); save({ kind: 'remix', title: `${b!.title.split(/[;:]/)[0]}: ${you || 'Remix'} edition`, sourceId: b!.id, sourceTitle: b!.title, detail: [setting, era, voice].join(' · ') }); }}>Remix the book</button>
          {run && <AIStub msg="Your remix is saved as a project and linked to the original. The full rewrite runs when the engine is live." />}
        </div>
        <div className="glass pad">
          <h3>Live preview <span className="tiny muted">· name swap runs locally; setting, era and voice need the AI engine</span></h3>
          <div className="prose sample">{swapped.map((p, i) => <p key={i}>{p.split('\u0000').map((s, j) => j % 2 ? <mark key={j}>{s}</mark> : s)}</p>)}</div>
          {(setting || era !== 'Original' || voice !== 'Original') && <p className="small muted">Requested: {[setting && `setting “${setting}”`, era !== 'Original' && `${era} era`, voice !== 'Original' && `${voice.toLowerCase()} voice`].filter(Boolean).join(', ')}.</p>}
        </div>
      </div>
    </div>
  );
}

/** Names and elements to check. Not legal advice; each entry says why to look closer. */
const PROTECTED: { re: RegExp; name: string; why: string }[] = [
  { re: /\benola\b/i, name: 'Enola Holmes', why: "Created by Nancy Springer (2006). In copyright. Use only Doyle's public-domain Holmes canon." },
  { re: /\btarzan\b/i, name: 'Tarzan', why: 'Early books are PD in the US, but "Tarzan" is a registered trademark. Avoid it in titles and branding.' },
  { re: /\bmickey\b/i, name: 'Mickey Mouse', why: "Only the 1928 Steamboat Willie version is PD. Later designs and Disney's trademarks are protected." },
  { re: /\bwinnie|pooh\b/i, name: 'Winnie-the-Pooh', why: 'The 1926 book is PD; Disney-era looks (e.g. the red shirt) and later characters are not.' },
  { re: /\bpoirot\b/i, name: 'Hercule Poirot', why: 'Only stories published 1930 or earlier are PD. Later traits and stories remain protected.' },
  { re: /\bgatsby\b/i, name: 'The Great Gatsby', why: 'The 1925 novel is PD. Later adaptations (films, musicals) are not.' },
  { re: /\bbatman|superman|hobbit|gandalf|frodo|harry potter|hogwarts|james bond\b/i, name: 'Post-1930 character', why: 'Created after 1930 and still in copyright and trademark.' },
  { re: /\bsherlock|holmes|watson\b/i, name: 'Sherlock Holmes', why: 'Fully PD in the US since 2023. Avoid elements created only in modern adaptations.' },
];
export function Continue() {
  const [sp] = useSearchParams();
  const [b, setB] = useState<Book | null>(null);
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('Enola Holmes travels to London to find her brother Sherlock, who has vanished from Baker Street.');
  const [len, setLen] = useState('Novella (20–40k words)');
  const [run, setRun] = useState(false);
  const save = useSaveProject();
  const flags = PROTECTED.filter(p => p.re.test(premise + ' ' + title));
  return (
    <div className="page wide">
      <div className="eyebrow">The Studio · Continue</div>
      <h1 className="display">Write the next book</h1>
      <p className="lede">New stories in an existing public-domain world. We flag names and elements that may still be protected as you type.</p>
      <div className="studio-grid">
        <div className="glass pad">
          <SourcePicker value={Number(sp.get('id')) || 1661} onChange={setB} />
          <label>Working title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="The Return of…" /></label>
          <label>Premise<textarea rows={5} value={premise} onChange={e => setPremise(e.target.value)} /></label>
          <label>Length<select value={len} onChange={e => setLen(e.target.value)}>{['Short story (under 7.5k words)', 'Novella (20–40k words)', 'Novel (60k+ words)'].map(x => <option key={x}>{x}</option>)}</select></label>
          <button className="btn gold full" disabled={!b} onClick={async () => { setRun(true); await runAI({ kind: 'continue', input: premise, options: { len } }); save({ kind: 'continuation', title: title || `A new ${b!.title.split(/[;:]/)[0]} story`, sourceId: b!.id, sourceTitle: b!.title, detail: premise.slice(0, 120) }); }}>Draft an outline</button>
          {run && <AIStub />}
        </div>
        <div className="glass pad">
          <h3>Protected-names check</h3>
          {!flags.length && <p className="ok-msg small">Nothing flagged in your title or premise.</p>}
          <ul className="flags">{flags.map(f => <li key={f.name} className={/PD in the US since|1925 novel is PD/.test(f.why) ? 'info' : 'warn'}><b>{f.name}</b><span>{f.why}</span></li>)}</ul>
          <p className="tiny muted">An automated hint, not legal advice. Optional human rights review is available when you publish. <Soon>Human review: coming soon</Soon></p>
          {b && <><h3 className="mt">World</h3><p className="small">{b.title} · {author(b)}</p><RightsTag r={rightsFor(b)} /></>}
        </div>
      </div>
    </div>
  );
}
