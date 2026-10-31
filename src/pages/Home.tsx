import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getSnapshot, type Book } from '../lib/books';
import Shelf3D from '../components/Shelf3D';
import { Section, Soon } from '../components/ui';
import { author } from '../lib/books';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => { let live = true; getSnapshot().then(s => { if (live) setBooks(s.results.filter(b => s.bundled.includes(b.id))); }).catch(() => {}); return () => { live = false; }; }, []);
  return (
    <>
      <section className="hero">
        <div className="eyebrow">The Open Library · Leone Publishing</div>
        <h1 className="display xl">Every book,<br /><em>yours to remake.</em></h1>
        <p className="lede">Read the world's public-domain classics free. Translate them from the original, remix them, continue them, design them, and publish under your own name. You keep 85–90% of the royalties.</p>
        <div className="row gap wrap">
          <Link className="btn gold" to="/library">Enter the Library</Link>
          <Link className="btn ghost" to="/studio/translate">Translate a classic</Link>
          <Link className="btn ghost" to="/publishing">Publish with Leone</Link>
        </div>
        <div className="hero-stats glass">
          <div><b>Free</b><span>public-domain index</span></div>
          <div><b>4</b><span>sources: Gutenberg, Standard Ebooks, Internet Archive, Wikisource</span></div>
          <div><b>85–90%</b><span>of net royalties to you</span></div>
        </div>
      </section>

      <Section eyebrow="I · The Library" title="The Open Library" lede="Search tens of thousands of public-domain books live from Project Gutenberg. Every title carries a rights and provenance tag, and every one opens in a reader you can make your own.">
        <div className="feature-grid">
          <Link to="/library" className="feature glass"><h3>Live search</h3><p>Titles, authors, subjects and languages, with covers.</p></Link>
          <Link to="/book?id=1342" className="feature glass"><h3>A reader worth reading in</h3><p>Chapters, highlights, notes, progress, and a narration preview.</p></Link>
          <Link to="/rights" className="feature glass"><h3>Rights &amp; provenance</h3><p>Source, US public-domain status, change log and AI tools used, on every book.</p></Link>
        </div>
      </Section>

      <Section eyebrow="II · Design" title="Total Creative Control" lede="Typeface, colour, measure, leading, drop caps, covers and spine animation, applied live and saved on your device.">
        <div className="row gap wrap"><Link className="btn gold" to="/design">Open the Design editor</Link><Link className="btn ghost" to="/read?id=84">See it in the reader</Link></div>
      </Section>

      <Section eyebrow="III · Your shelf" title="A Living 3D Bookshelf" lede="Every book you save takes its place on a glowing, turnable case. Drag it; open any spine.">
        {books.length > 0 && <Shelf3D books={books.slice(0, 16).map(b => ({ id: b.id, title: b.title, author: author(b) }))} />}
        <div className="center"><Link className="btn ghost" to="/shelf">Go to My Shelf</Link></div>
      </Section>

      <Section eyebrow="IV · The Studio" title="AI Rewrites Everything" lede="Translate a whole book from the public-domain original. Put yourself in the story. Write the sequel the author never did.">
        <div className="feature-grid">
          <Link to="/studio/translate" className="feature glass hl"><h3>Translate</h3><p>Russian, French, German and more into English, side by side. Faithful, modern or simplified.</p></Link>
          <Link to="/studio/remix" className="feature glass"><h3>Remix</h3><p>Become the protagonist. Move the setting, the era, the voice.</p></Link>
          <Link to="/studio/continue" className="feature glass"><h3>Continue</h3><p>New books in an existing world, with protected names flagged.</p></Link>
        </div>
      </Section>

      <Section eyebrow="V · Leone Publishing" title="Print It. Ship It. Own It." lede="Published by Leone Publishing, distributed through IngramSpark, Draft2Digital and Lulu print-on-demand. We take 10% of net royalties on original work and 15% on remixes and translations. Nothing up front.">
        <div className="row gap wrap"><Link className="btn gold" to="/publishing/calculator">Run the numbers</Link><Link className="btn ghost" to="/publishing">How it works</Link></div>
      </Section>

      <Section eyebrow="VI · Classroom" title="The Children's Workshop" lede="A safe classroom edition: assign a classic, let students remix a chapter, and print a class anthology.">
        <Link className="btn ghost" to="/classroom">Explore the Classroom</Link>
      </Section>

      <Section eyebrow="VII · Community" title="Your Library Is a Statement" lede="Followable shelves, reviews, featured remixes and contests.">
        <div className="row gap wrap"><Link className="btn ghost" to="/community">Visit the Community</Link><Soon /></div>
      </Section>
    </>
  );
}
