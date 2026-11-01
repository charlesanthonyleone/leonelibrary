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
      <button className="nav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
      <nav className={open ? 'open' : ''}>
        {L('/library', 'Library')}{L('/shelf', 'My Shelf')}{L('/studio', 'Studio')}{L('/publishing', 'Publishing')}{L('/plans', 'Plans')}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div><div className="brand-word big">Leone <em>Library</em></div><p className="muted small">Every book, yours to remake. Published by Leone Publishing.</p></div>
        <div className="foot-cols">
          <div><h5>Read</h5><Link to="/library">The Library</Link><Link to="/shelf">My Shelf</Link><Link to="/design">Design</Link></div>
          <div><h5>Create</h5><Link to="/studio/translate">Translate</Link><Link to="/studio/remix">Remix</Link><Link to="/studio/continue">Continue</Link></div>
          <div><h5>Publish</h5><Link to="/publishing">Leone Publishing</Link><Link to="/publishing/calculator">Fee calculator</Link><Link to="/publishing/submit">Submit a book</Link><Link to="/publishing/royalties">Royalties</Link></div>
          <div><h5>More</h5><Link to="/plans">Plans</Link><Link to="/classroom">Classroom</Link><Link to="/community">Community</Link><Link to="/rights">Rights</Link></div>
        </div>
      </div>
      <p className="muted tiny center">Book data: Project Gutenberg via Gutendex, and Wikisource. Leone Library indexes US public-domain works only (first published 1930 or earlier). Rights outside the US differ.</p>
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
