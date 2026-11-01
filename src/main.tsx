import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import MountainSky from './components/MountainSky';
import { Footer, Nav, useUiMotion } from './components/ui';
import Home from './pages/Home';
import Library from './pages/Library';
import BookPage from './pages/Book';
import Reader from './pages/Reader';
import Design from './pages/Design';
import Shelf from './pages/Shelf';
import { Continue, Remix, StudioHub, Translate } from './pages/Studio';
import { Calculator, PublishingHome, Royalties, Submit } from './pages/Publishing';
import { Classroom, Community, NotFound, Rights, Storefront } from './pages/Misc';
import './styles.css';
import './room.css';
import Plans from './pages/Plans';
import { PublicShelves, Marketplace, Clubs, SharedNotes, Goals, Glossary, CollabStudio, ExportPage } from './pages/Features';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
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
        <ErrorBoundary key={pathname} label="page"><Routes>
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
          <Route path="*" element={<NotFound />} />
        </Routes></ErrorBoundary>
      </main>
      {!reading && <Footer />}
    </>
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></BrowserRouter></ErrorBoundary></React.StrictMode>,
);
