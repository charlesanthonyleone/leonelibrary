// Writes dist/sitemap.xml: static routes plus every catalogue book page.
import fs from 'node:fs';
const O = 'https://library.leoneuniversity.org';
const cat = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8'));
const urls = ['/', '/library', '/search', '/paths', '/publishing', '/rights', '/plans', '/studio', '/classroom', '/community'].map(p => O + p)
  .concat(cat.map(c => `${O}/book?id=${c.id}`));
fs.writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log('sitemap', urls.length);
