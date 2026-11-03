import { initAssets } from './lib/assets';
import { startAutoSync } from './lib/leoneid';
startAutoSync();
import '@fontsource/opendyslexic/400.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import MountainSky from './components/MountainSky';
import { Footer, Nav, useUiMotion } from './components/ui';
import { lazy, Suspense } from 'react';
import Home from './pages/Home';
const Add = lazy(() => import('./pages/Add'));
const Library = lazy(() => import('./pages/Library'));
const BookPage = lazy(() => import('./pages/Book'));
const Reader = lazy(() => import('./pages/Reader'));
const Design = lazy(() => import('./pages/Design'));
const Shelf = lazy(() => import('./pages/Shelf'));
const Plans = lazy(() => import('./pages/Plans'));
const Search = lazy(() => import('./pages/Search'));
const AuthorPage = lazy(() => import('./pages/Browse').then(m => ({ default: m.AuthorPage })));
const AuthorsPage = lazy(() => import('./pages/Browse').then(m => ({ default: m.AuthorsPage })));
const SubjectsPage = lazy(() => import('./pages/Browse').then(m => ({ default: m.SubjectsPage })));
const SubjectPage = lazy(() => import('./pages/Browse').then(m => ({ default: m.SubjectPage })));
const GenrePage = lazy(() => import('./pages/Browse').then(m => ({ default: m.GenrePage })));
const Paths = lazy(() => import('./pages/Paths'));
const Dna = lazy(() => import('./pages/Dna'));
const Account = lazy(() => import('./pages/Account'));
const named = <M extends Record<string, unknown>>(f: () => Promise<M>, k: keyof M) => lazy(() => f().then(m => ({ default: m[k] as React.ComponentType })));
const studio = () => import('./pages/Studio'), pub = () => import('./pages/Publishing'), misc = () => import('./pages/Misc'), feat = () => import('./pages/Features'), my = () => import('./pages/MyBooks');
const [Continue, Remix, StudioHub, Translate] = (['Continue', 'Remix', 'StudioHub', 'Translate'] as const).map(k => named(studio, k));
const [Calculator, PublishingHome, Royalties, Submit] = (['Calculator', 'PublishingHome', 'Royalties', 'Submit'] as const).map(k => named(pub, k));
const [Classroom, Community, NotFound, Rights, Storefront] = (['Classroom', 'Community', 'NotFound', 'Rights', 'Storefront'] as const).map(k => named(misc, k));
const [PublicShelves, Marketplace, Clubs, SharedNotes, Goals, Glossary, CollabStudio, ExportPage] = (['PublicShelves', 'Marketplace', 'Clubs', 'SharedNotes', 'Goals', 'Glossary', 'CollabStudio', 'ExportPage'] as const).map(k => named(feat, k));
const [Offline, Imports] = (['Offline', 'Imports'] as const).map(k => named(my, k));
import { routeSeo } from './lib/seo';
import './styles.css';
import './room.css';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); routeSeo(pathname); }, [pathname]);
  return null;
}
function MotionClass() {
  const on = useUiMotion();
  useEffect(() => { document.body.classList.toggle('no-motion', !on); }, [on]);
  return null;
}

function App() {
  const { pathname } = useLocation();
  const reading = pathname === '/read';
  return (
    <>
      <ScrollTop /><MotionClass />
      <ErrorBoundary label="background"><MountainSky /></ErrorBoundary>
      <a href="#main" className="skip">Skip to content</a>
      <Nav />
      <main id="main" className={reading ? 'reading' : ''}>
        <ErrorBoundary key={pathname} label="page"><Suspense fallback={<div className="page" role="status"><p className="muted">Loading…</p></div>}><Routes>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/book" element={<BookPage />} />
          <Route path="/read" element={<Reader />} />
          <Route path="/design" element={<Design />} />
          <Route path="/shelf" element={<Shelf />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/shelves" element={<PublicShelves />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/notes" element={<SharedNotes />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/studio/glossary" element={<Glossary />} />
          <Route path="/studio/collab" element={<CollabStudio />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/studio" element={<StudioHub />} />
          <Route path="/studio/translate" element={<Translate />} />
          <Route path="/studio/remix" element={<Remix />} />
          <Route path="/studio/continue" element={<Continue />} />
          <Route path="/studio/design" element={<Design />} />
          <Route path="/publishing" element={<PublishingHome />} />
          <Route path="/publishing/calculator" element={<Calculator />} />
          <Route path="/publishing/submit" element={<Submit />} />
          <Route path="/publishing/royalties" element={<Royalties />} />
          <Route path="/classroom" element={<Classroom />} />
          <Route path="/community" element={<Community />} />
          <Route path="/storefront" element={<Storefront />} />
          <Route path="/rights" element={<Rights />} />
          <Route path="/add" element={<Add />} />
          <Route path="/search" element={<Search />} />
          <Route path="/author" element={<AuthorPage />} />
          <Route path="/authors" element={<AuthorsPage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/subject" element={<SubjectPage />} />
          <Route path="/genre" element={<GenrePage />} />
          <Route path="/paths" element={<Paths />} />
          <Route path="/dna" element={<Dna />} />
          <Route path="/offline" element={<Offline />} />
          <Route path="/import" element={<Imports />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Routes></Suspense></ErrorBoundary>
      </main>
      {!reading && <Footer />}
    </>
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));

initAssets().finally(() => { const m = /^\/(read|book)\/?$/.test(location.pathname) && Number(new URLSearchParams(location.search).get('id')); if (m && m > 0) import('./lib/books').then(b => b.getHosted(m)).catch(() => {}); });
initAssets().finally(() => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></BrowserRouter></ErrorBoundary></React.StrictMode>,
));
