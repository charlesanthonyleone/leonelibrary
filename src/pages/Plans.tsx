import { Link } from 'react-router-dom';

const SPONSOR = 'https://github.com/sponsors/charlesanthonyleone';

export default function Plans() {
  return (
    <div className="page wide plans">
      <div className="center-head">
        <div className="eyebrow">Free &amp; open source</div>
        <h1 className="display">Free for everyone. Always.</h1>
        <p className="lede">Leone Library is the Library of <a href="https://leoneuniversity.org">Leone University</a>. Every book and every tool is free and open source: no user accounts, no paid tiers and no paid AI credits. Everything you make is saved on your own device.</p>
        <div className="row gap wrap" style={{ justifyContent: 'center' }}>
          <a className="btn gold" href={SPONSOR} target="_blank" rel="noreferrer">♥ Donate on GitHub Sponsors</a>
          <Link className="btn ghost" to="/library">Start reading</Link>
          <a className="btn ghost" href="https://github.com/charlesanthonyleone/leonelibrary" target="_blank" rel="noreferrer">Source code</a>
        </div>
        <p className="tiny muted">Donations are optional and keep the library running. They never unlock anything.</p>
      </div>
    </div>
  );
}
