// Fails if a <Route path> in src/main.tsx has no document title in src/lib/seo.ts TITLES (or isn't a self-titling DYNAMIC page).
import fs from 'fs';
const routes = [...fs.readFileSync('src/main.tsx', 'utf8').matchAll(/<Route path="([^"*]+)"/g)].map(m => m[1]);
const seo = fs.readFileSync('src/lib/seo.ts', 'utf8');
const missing = routes.filter(r => !seo.includes(`'${r}':`) && !new RegExp(`DYNAMIC = new Set\\(\\[[^\\]]*'${r}'`).test(seo));
if (missing.length) { console.error('routes without a title:', missing.join(' ')); process.exit(1); }
console.log(`${routes.length} routes titled`);
