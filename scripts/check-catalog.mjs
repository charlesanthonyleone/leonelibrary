// Fails if any catalogue book lacks its hosted full text, or if anything links out to Gutenberg.
import fs from 'fs'; import zlib from 'zlib';
const cat = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8')); let bad = 0;
for (const c of cat) { const f = `public/books/${c.id}.json.gz`;
  if (!fs.existsSync(f)) { console.error('missing', c.id); bad++; continue; }
  const b = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
  if (!b.chapters?.length || b.words < 1500) { console.error('incomplete', c.id); bad++; } }
const src = fs.readdirSync('src', { recursive: true }).filter(f => /\.tsx?$/.test(f)).map(f => fs.readFileSync('src/' + f, 'utf8')).join('\n');
if (/gutenberg\.org|gutendex/i.test(src)) { console.error('source links out to Gutenberg'); bad++; }
console.log(`${cat.length} books checked, ${bad} problems`); process.exit(bad ? 1 : 0);
