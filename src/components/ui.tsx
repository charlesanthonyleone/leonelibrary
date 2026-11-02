import { NavLink, Link } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import type { Rights } from '../lib/books';
import { SCENE_EVT, sceneSettings } from './MountainSky';

export function useUiMotion() {
  const [on, setOn] = useState(() => sceneSettings().ui);
  useEffect(() => { const f = () => setOn(sceneSettings().ui); window.addEventListener(SCENE_EVT, f); return () => window.removeEventListener(SCENE_EVT, f); }, []);
  return on;
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const L = (to: string, label: string) => <NavLink to={to} onClick={() => setOpen(false)}>{label}</NavLink>;
  return (
    <header className="nav glass">
      <Link to="/" className="brand" onClick={() => setOpen(false)}>
        <span className="brand-mark">L</span><span className="brand-word">Leone <em>Library</em></span>
      </Link>
      <a className="small muted uni-link" href="https://leoneuniversity.org" title="Leone University">The Library of Leone University ↗</a>
      <button className="nav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
      <nav className={open ? 'open' : ''}>
        {L('/library', 'Library')}{L('/search', 'Search')}{L('/paths', 'Paths')}{L('/shelf', 'My Shelf')}{L('/studio', 'Studio')}{L('/publishing', 'Publishing')}{L('/plans', 'Plans')}
      </nav>
    </header>
  );
}

function InstallApp() {
  const [ev, setEv] = useState<(Event & { prompt: () => void }) | null>(null); const [ok, setOk] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches);
  useEffect(() => { const f = (e: Event) => { e.preventDefault(); setEv(e as never); }; window.addEventListener('beforeinstallprompt', f); window.addEventListener('appinstalled', () => setOk(true)); return () => window.removeEventListener('beforeinstallprompt', f); }, []);
  if (ok) return <p className="tiny muted center">Installed. Books you've opened work offline.</p>;
  return <p className="tiny muted center">{ev ? <button className="btn ghost sm" onClick={() => ev.prompt()}>Install Leone Library</button> : 'Install Leone Library from your browser menu (“Install app” or “Add to Home Screen”) to read offline.'}</p>;
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div><div className="brand-word big">Leone <em>Library</em></div><p className="muted small">The Library of Leone University. <a href="https://leoneuniversity.org">Leone University</a> · <a href="https://github.com/sponsors/charlesanthonyleone" target="_blank" rel="noreferrer">♥ Donate</a></p></div>
        <div className="foot-cols">
          <div><h5>Read</h5><Link to="/library">The Library</Link><Link to="/search">Search inside books</Link><Link to="/paths">Reading paths</Link><Link to="/add">Request a book</Link><Link to="/shelf">My Shelf</Link><Link to="/offline">Offline library</Link><Link to="/import">Import EPUB / Kindle / Goodreads</Link><Link to="/goals">Reading goals</Link><Link to="/clubs">Book clubs</Link><Link to="/design">Design</Link></div>
          <div><h5>Create</h5><Link to="/studio/translate">Translate</Link><Link to="/studio/remix">Remix</Link><Link to="/studio/continue">Continue</Link><Link to="/studio/collab">Co-author</Link><Link to="/studio/glossary">Glossary</Link><Link to="/export">Export</Link></div>
          <div><h5>Publish</h5><Link to="/publishing">Leone Publishing</Link><Link to="/publishing/calculator">Fee calculator</Link><Link to="/publishing/submit">Submit a book</Link><Link to="/publishing/royalties">Royalties</Link></div>
          <div><h5>More</h5><Link to="/account">Account</Link><Link to="/plans">Plans</Link><a href="https://leoneuniversity.org">Leone University</a><a href="https://github.com/sponsors/charlesanthonyleone" target="_blank" rel="noreferrer">Donate</a><Link to="/marketplace">Themes</Link><Link to="/shelves">Public shelves</Link><Link to="/classroom">Classroom</Link><Link to="/community">Community</Link><Link to="/rights">Rights</Link></div>
        </div>
      </div>
      <InstallApp />
      <p className="muted tiny center">Every book here is complete and public domain worldwide: all its authors and translators died at least 70 years ago. Texts are volunteer public-domain transcriptions, cleaned and hosted by Leone Library.</p>
    </footer>
  );
}

export const Soon = ({ children = 'Coming soon' }: { children?: ReactNode }) => <span className="soon">{children}</span>;
export const AIStub = ({ msg }: { msg?: string }) => (
  <div className="ai-stub" role="status"><span className="pulse" /> <strong>AI engine connecting soon.</strong> <span className="muted">{msg ?? 'No model is connected yet, so nothing is sent anywhere. Your project and settings are saved on this device.'}</span></div>
);
export const RightsTag = ({ r }: { r: Rights }) => <span className={`rights ${r.tone}`} title={r.detail}>{r.tone === 'ok' ? '◆' : r.tone === 'check' ? '◇' : '✕'} {r.tag}</span>;

export function Section({ eyebrow, title, lede, children, className = '' }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`section ${className}`}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2 className="display">{title}</h2>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </section>
  );
}

/** Generated cloth-and-gilt cover for books without one, or for user designs. */
export function GenCover({ title, author, hue = 220, style = 'Gilded', className = '' }: { title: string; author: string; hue?: number; style?: string; className?: string }) {
  const t = title.length > 48 ? title.slice(0, 46) + '…' : title;
  return (
    <div className={`gencover ${style.toLowerCase()} ${className}`} style={{ ['--h' as string]: hue }}>
      <div className="gc-frame"><div className="gc-orn">❦</div><div className="gc-title">{t}</div><div className="gc-rule" /><div className="gc-author">{author}</div></div>
    </div>
  );
}
export const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
