import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Section, Soon } from '../components/ui';

const money = (n: number) => (n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(2);

export function PublishingHome() {
  return (
    <div className="page">
      <div className="eyebrow">Leone Publishing</div>
      <h1 className="display">Print It. Ship It. Own It.</h1>
      <p className="lede">Leone Publishing is the publisher of record for every book made here. Every edition carries the line “Published by Leone Publishing”, and you keep 85–90% of the net royalties.</p>
      <div className="pitch glass pad">
        <div><h3>The traditional deal</h3><p>A conventional publisher pays an author a royalty that is usually a small share of the cover price and keeps the rest, often in exchange for an advance, editing, marketing and distribution. Terms vary widely by publisher and contract.</p></div>
        <div className="vs">vs</div>
        <div><h3>Leone</h3><p>You keep <b>90%</b> of net royalties on mostly-original work and <b>85%</b> on public-domain remixes and translations. Net means after print and retailer costs. No upfront fees. You keep your rights.</p></div>
      </div>
      <Section eyebrow="How it works" title="From manuscript to bookstore">
        <ol className="how">
          <li><b>Create</b><span>Write, translate or remix in the Studio, or upload your own manuscript.</span></li>
          <li><b>Quality gate</b><span>Minimum originality, a complete AI disclosure and a rights check. Optional paid human review.</span></li>
          <li><b>Distribute</b><span>Ebook and print through IngramSpark and Draft2Digital to the stores they reach, plus Lulu print-on-demand and your own storefront.</span></li>
          <li><b>Get paid</b><span>Retailers pay Leone; Leone pays you, less the 10% or 15% fee, with a statement for every sale.</span></li>
        </ol>
      </Section>
      <div className="feature-grid">
        <div className="feature glass"><h3>IngramSpark</h3><p>Print and ebook distribution to bookstores and libraries. Integration <Soon /></p></div>
        <div className="feature glass"><h3>Draft2Digital</h3><p>Ebook distribution to major online stores. Integration <Soon /></p></div>
        <div className="feature glass"><h3>Lulu Print API</h3><p>Print-on-demand paperbacks and hardcovers, shipped direct. Integration <Soon /></p></div>
        <div className="feature glass"><h3>Amazon KDP</h3><p>KDP has no public upload API, so Amazon listings are reached through partner distribution where the partner allows it.</p></div>
      </div>
      <Section eyebrow="Quality gate" title="Published by Leone means something">
        <div className="feature-grid">
          <div className="feature glass"><h3>Originality</h3><p>Remixes need meaningful new material, not a find-and-replace. Mostly-original work qualifies for the 10% rate.</p></div>
          <div className="feature glass"><h3>AI disclosure</h3><p>Every book states which AI tools were used and for what. It goes on the copyright page.</p></div>
          <div className="feature glass"><h3>Rights check</h3><p>Sources must be US public domain (first published 1930 or earlier). Protected names are flagged.</p></div>
          <div className="feature glass"><h3>Human review &amp; editing</h3><p>Optional volunteer review: rights review, copy-edit, developmental edit. <Soon /></p></div>
        </div>
      </Section>
      <div className="row gap wrap center"><Link className="btn gold" to="/publishing/calculator">Fee calculator</Link><Link className="btn ghost" to="/publishing/submit">Submit your book</Link><Link className="btn ghost" to="/publishing/royalties">Royalty dashboard</Link><Link className="btn ghost" to="/storefront">Author storefronts</Link></div>
    </div>
  );
}

export function Calculator() {
  const [list, setList] = useState(16.99);
  const [print, setPrint] = useState(4.85);
  const [cut, setCut] = useState(40);
  const [kind, setKind] = useState<'original' | 'derivative'>('original');
  const [trad, setTrad] = useState(10);
  const [copies, setCopies] = useState(1000);
  const r = useMemo(() => {
    const retailer = list * cut / 100, net = list - retailer - print, rate = kind === 'original' ? .10 : .15;
    const fee = Math.max(0, net) * rate, author = net - fee, tradAuthor = list * trad / 100;
    return { retailer, net, rate, fee, author, tradAuthor };
  }, [list, print, cut, kind, trad]);
  const max = Math.max(list, .01);
  const bar = (v: number) => `${Math.max(0, v / max * 100)}%`;
  return (
    <div className="page">
      <div className="eyebrow">Leone Publishing · Fee calculator</div>
      <h1 className="display">What you keep</h1>
      <p className="lede">Enter your list price, print cost and the retailer's cut. The Leone fee is taken from what's left.</p>
      <div className="calc">
        <div className="glass pad">
          <label>List price ($)<input type="number" min={0} step={0.01} value={list} onChange={e => setList(+e.target.value)} /></label>
          <label>Print cost per copy ($) <span className="tiny muted">0 for ebooks</span><input type="number" min={0} step={0.01} value={print} onChange={e => setPrint(+e.target.value)} /></label>
          <label>Retailer / distributor cut <span className="val">{cut}%</span><input type="range" min={0} max={70} value={cut} onChange={e => setCut(+e.target.value)} /></label>
          <div className="lbl">Work type</div>
          <div className="radio-cards two"><button className={kind === 'original' ? 'on' : ''} onClick={() => setKind('original')}><b>Mostly original</b><span>10% fee</span></button><button className={kind === 'derivative' ? 'on' : ''} onClick={() => setKind('derivative')}><b>PD remix or translation</b><span>15% fee</span></button></div>
          <label>Copies sold<input type="number" min={0} value={copies} onChange={e => setCopies(+e.target.value)} /></label>
          <hr />
          <label>Comparison: traditional royalty rate (% of list) <span className="val">{trad}%</span><input type="range" min={0} max={25} step={0.5} value={trad} onChange={e => setTrad(+e.target.value)} /></label>
          <p className="tiny muted">Illustrative only. Set this to the rate in an actual offer. Traditional contracts vary and can include advances and services this comparison leaves out.</p>
        </div>
        <div className="glass pad results">
          <div className="stack">
            <div className="stk-row"><span>List price</span><b>{money(list)}</b></div>
            <div className="stk-row neg"><span>Retailer cut ({cut}%)</span><b>{money(-r.retailer)}</b></div>
            <div className="stk-row neg"><span>Print cost</span><b>{money(-print)}</b></div>
            <div className="stk-row"><span>Net royalty</span><b>{money(r.net)}</b></div>
            <div className="stk-row neg"><span>Leone fee ({r.rate * 100}% of net)</span><b>{money(-r.fee)}</b></div>
            <div className="stk-row total"><span>You keep, per copy</span><b>{money(r.author)}</b></div>
          </div>
          {r.net <= 0 && <p className="warn-msg small">At this price the net is zero or negative. Raise the list price or lower costs.</p>}
          <div className="bars">
            <div><span>Leone (you)</span><div className="bar"><i className="gold" style={{ width: bar(r.author) }} /></div><b>{money(r.author)}</b></div>
            <div><span>Traditional at {trad}% <em>(illustrative)</em></span><div className="bar"><i style={{ width: bar(r.tradAuthor) }} /></div><b>{money(r.tradAuthor)}</b></div>
          </div>
          <div className="big-num"><span>On {copies.toLocaleString()} copies</span><b>{money(r.author * copies)}</b><em>vs {money(r.tradAuthor * copies)} at the illustrative traditional rate</em></div>
        </div>
      </div>
    </div>
  );
}

const STEPS = ['Manuscript', 'Rights & originality', 'Quality gate', 'Distribution', 'Review'];
export function Submit() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ title: '', author: '', kind: 'original', file: '', source: '', rights: false, orig: 80, ai: 'none', aiTools: '', review: false, edit: 'none', ebook: true, paper: true, hard: false, ingram: true, d2d: true, lulu: true, direct: true, price: '14.99' });
  const [done, setDone] = useState(false);
  const up = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const minOrig = f.kind === 'remix' ? 20 : f.kind === 'translation' ? 0 : 70;
  const checks = [
    { ok: !!f.title && !!f.author, label: 'Title and author name' },
    { ok: f.kind === 'original' || !!f.source, label: 'Public-domain source named' },
    { ok: f.rights, label: 'Rights declaration signed' },
    { ok: f.orig >= minOrig, label: `Originality at least ${minOrig}% for ${f.kind === 'original' ? 'mostly-original work' : f.kind}` },
    { ok: f.ai === 'none' || !!f.aiTools.trim(), label: 'AI disclosure complete' },
  ];
  const pass = checks.every(c => c.ok);
  const fee = f.kind === 'original' && f.orig >= 70 ? 10 : 15;
  if (done) return (
    <div className="page"><div className="glass pad center">
      <div className="seal">L</div><h1 className="display">Submission preview complete</h1>
      <p className="lede">This is a demo. Nothing was uploaded or sent. When submissions open, “{f.title}” would enter review at a {fee}% fee.</p>
      <p className="imprint">Published by Leone Publishing</p>
      <button className="btn ghost" onClick={() => { setDone(false); setStep(0); }}>Start over</button></div></div>);
  return (
    <div className="page">
      <div className="eyebrow">Leone Publishing · Submit</div>
      <h1 className="display">Submit your book</h1>
      <p className="lede">A walkthrough of the submission flow. Submissions aren't open yet, so nothing leaves your browser.</p>
      <ol className="steps">{STEPS.map((s, i) => <li key={s} className={i <= step ? 'on' : ''}><button onClick={() => setStep(i)}>{s}</button></li>)}</ol>
      <div className="glass pad form">
        {step === 0 && <>
          <label>Title<input value={f.title} onChange={e => up({ title: e.target.value })} /></label>
          <label>Author name (as printed)<input value={f.author} onChange={e => up({ author: e.target.value })} /></label>
          <label>What is it?<select value={f.kind} onChange={e => up({ kind: e.target.value })}><option value="original">Mostly original work</option><option value="remix">Remix of a public-domain book</option><option value="translation">New translation of a public-domain book</option></select></label>
          <label>Manuscript (.docx, .epub, .md) <span className="tiny muted">stays on your device</span><input type="file" accept=".docx,.epub,.md,.txt" onChange={e => up({ file: e.target.files?.[0]?.name ?? '' })} /></label>
        </>}
        {step === 1 && <>
          {f.kind !== 'original' && <label>Public-domain source (title, author, year)<input value={f.source} onChange={e => up({ source: e.target.value })} placeholder="White Nights, Dostoevsky, 1848" /></label>}
          <label>Estimated original material <span className="val">{f.orig}%</span><input type="range" min={0} max={100} value={f.orig} onChange={e => up({ orig: +e.target.value })} /></label>
          <label>AI use<select value={f.ai} onChange={e => up({ ai: e.target.value })}><option value="none">No AI used</option><option value="assist">AI-assisted (editing, ideas)</option><option value="generate">AI-generated text, human-edited</option><option value="translate">AI translation, human-reviewed</option></select></label>
          {f.ai !== 'none' && <label>Which tools, and for what?<textarea rows={3} value={f.aiTools} onChange={e => up({ aiTools: e.target.value })} /></label>}
          <label className="check"><input type="checkbox" checked={f.rights} onChange={e => up({ rights: e.target.checked })} /> I confirm I hold the rights to the new material and that every source is US public domain.</label>
        </>}
        {step === 2 && <>
          <ul className="gate">{checks.map(c => <li key={c.label} className={c.ok ? 'ok' : 'no'}>{c.ok ? '✓' : '○'} {c.label}</li>)}</ul>
          <p className={pass ? 'ok-msg' : 'warn-msg'}>{pass ? `Passes the gate. Fee: ${fee}% of net royalties.` : 'Not ready yet. Complete the items above.'}</p>
          <label className="check"><input type="checkbox" checked={f.review} onChange={e => up({ review: e.target.checked })} /> Add human rights &amp; quality review <Soon /></label>
          <label>Editing add-on<select value={f.edit} onChange={e => up({ edit: e.target.value })}><option value="none">None</option><option value="copy">Copy-edit</option><option value="line">Line edit</option><option value="dev">Developmental edit</option></select></label>
          <p className="tiny muted">Editing help is volunteer-run and free.</p>
        </>}
        {step === 3 && <>
          <div className="lbl">Formats</div>
          <div className="toggles"><label><input type="checkbox" checked={f.ebook} onChange={e => up({ ebook: e.target.checked })} /> Ebook</label><label><input type="checkbox" checked={f.paper} onChange={e => up({ paper: e.target.checked })} /> Paperback</label><label><input type="checkbox" checked={f.hard} onChange={e => up({ hard: e.target.checked })} /> Hardcover</label><label><input type="checkbox" disabled /> Audiobook <Soon /></label></div>
          <div className="lbl">Channels</div>
          <div className="toggles"><label><input type="checkbox" checked={f.ingram} onChange={e => up({ ingram: e.target.checked })} /> IngramSpark</label><label><input type="checkbox" checked={f.d2d} onChange={e => up({ d2d: e.target.checked })} /> Draft2Digital</label><label><input type="checkbox" checked={f.lulu} onChange={e => up({ lulu: e.target.checked })} /> Lulu print-on-demand</label><label><input type="checkbox" checked={f.direct} onChange={e => up({ direct: e.target.checked })} /> My Leone storefront</label></div>
          <label>List price ($)<input value={f.price} onChange={e => up({ price: e.target.value })} /></label>
          <p className="tiny muted">Each partner's own options, territories and pricing rules apply.</p>
        </>}
        {step === 4 && <>
          <div className="review-card"><div className="rc-title">{f.title || 'Untitled'}</div><div>{f.author || 'Author'}</div><div className="small muted">{f.kind} · {f.orig}% original · AI: {f.ai}{f.file && ` · ${f.file}`}</div><div className="imprint">Published by Leone Publishing</div></div>
          <p className="small">Fee {fee}% of net royalties, collected by Leone before paying you.</p>
        </>}
        <div className="row gap between mt">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          {step < 4 ? <button className="btn gold" onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn gold" disabled={!pass} onClick={() => setDone(true)}>Submit (demo)</button>}
        </div>
      </div>
    </div>
  );
}

// EXAMPLE DATA: invented for layout only. Not real sales.
const EX_STORES = [{ s: 'IngramSpark (print)', u: 184, gross: 2852.0 }, { s: 'Draft2Digital (ebook)', u: 412, gross: 2468.0 }, { s: 'Lulu print-on-demand', u: 63, gross: 1070.4 }, { s: 'Leone storefront', u: 97, gross: 1164.0 }];
const EX_MONTHS = [['May', 610], ['Jun', 742], ['Jul', 905], ['Aug', 1180], ['Sep', 1362], ['Oct', 1544]] as const;
export function Royalties() {
  const net = EX_STORES.reduce((a, b) => a + b.gross, 0);
  const fee = net * .12, paid = net - fee;
  const mx = Math.max(...EX_MONTHS.map(m => m[1]));
  return (
    <div className="page">
      <div className="eyebrow">Leone Publishing · Royalties</div>
      <h1 className="display">Royalty dashboard</h1>
      <div className="example-banner">Example data. These numbers are made up to show the layout. Your real statements appear here once you publish.</div>
      <div className="kpis">
        <div className="glass kpi"><span>Net royalties</span><b>{money(net)}</b></div>
        <div className="glass kpi"><span>Leone fees (blended)</span><b>{money(fee)}</b></div>
        <div className="glass kpi"><span>Paid to you</span><b className="gold-t">{money(paid)}</b></div>
        <div className="glass kpi"><span>Units</span><b>{EX_STORES.reduce((a, b) => a + b.u, 0)}</b></div>
      </div>
      <div className="two-col">
        <div className="glass pad"><h3>Net by month <span className="tiny muted">(example)</span></h3>
          <svg viewBox="0 0 360 180" className="chart">{EX_MONTHS.map(([m, v], i) => <g key={m}><rect x={20 + i * 56} y={150 - v / mx * 130} width="34" height={v / mx * 130} rx="4" fill="url(#gg)" /><text x={37 + i * 56} y="168" textAnchor="middle">{m}</text></g>)}
            <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0d58e" /><stop offset="1" stopColor="#8a6a2a" /></linearGradient></defs></svg></div>
        <div className="glass pad"><h3>Sales by store <span className="tiny muted">(example)</span></h3>
          <table className="tbl"><thead><tr><th>Store</th><th>Units</th><th>Net</th></tr></thead><tbody>{EX_STORES.map(s => <tr key={s.s}><td>{s.s}</td><td>{s.u}</td><td>{money(s.gross)}</td></tr>)}</tbody></table></div>
      </div>
      <div className="glass pad"><h3>Payouts <span className="tiny muted">(example)</span></h3>
        <table className="tbl"><thead><tr><th>Period</th><th>Title</th><th>Net</th><th>Fee</th><th>Paid</th><th>Status</th></tr></thead><tbody>
          <tr><td>Sep 2026</td><td>White Nights (modern translation)</td><td>{money(1362)}</td><td>15%</td><td>{money(1157.7)}</td><td>Paid</td></tr>
          <tr><td>Sep 2026</td><td>The Lighthouse Keeper (original)</td><td>{money(980)}</td><td>10%</td><td>{money(882)}</td><td>Paid</td></tr>
          <tr><td>Oct 2026</td><td>White Nights (modern translation)</td><td>{money(1544)}</td><td>15%</td><td>{money(1312.4)}</td><td>Scheduled</td></tr>
        </tbody></table>
        <p className="tiny muted">Leone collects from retailers and distributors, deducts the fee, then pays you.</p></div>
    </div>
  );
}
