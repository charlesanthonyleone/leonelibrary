// Private books: DRM-free EPUBs the reader imports. Parsed and stored only in this browser (IndexedDB); never uploaded.
import type { HostedBook } from './books';

const DB = 'leone-private', STORE = 'books';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db(); return new Promise((res, rej) => { const q = f(d.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); });
}
export type PrivateBook = HostedBook & { added: number; file: string };
export const privateList = () => tx<PrivateBook[]>('readonly', s => s.getAll());
export const privateGet = (id: number) => tx<PrivateBook | undefined>('readonly', s => s.get(id));
export const privatePut = (b: PrivateBook) => tx('readwrite', s => s.put(b));
export const privateDelete = (id: number) => tx('readwrite', s => s.delete(id));

/* ---- minimal zip reader (stored + deflate via DecompressionStream) ---- */
async function unzip(buf: ArrayBuffer): Promise<Map<string, () => Promise<Uint8Array>>> {
  const v = new DataView(buf), u8 = new Uint8Array(buf); let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Not a zip/EPUB file');
  const count = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  const out = new Map<string, () => Promise<Uint8Array>>(), dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = u8.subarray(start, start + csize);
    out.set(name, async () => method === 0 ? data : new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
    p += 46 + nlen + xlen + clen;
  }
  return out;
}
const resolve = (base: string, href: string) => { const parts = (base + decodeURIComponent(href.split('#')[0])).split('/'), o: string[] = []; for (const s of parts) s === '..' ? o.pop() : s !== '.' && o.push(s); return o.join('/'); };

/** Parse a DRM-free EPUB into chapters of plain paragraphs. Throws on DRM-protected files. */
export async function parseEpub(file: File): Promise<PrivateBook> {
  const z = await unzip(await file.arrayBuffer()), txt = async (n: string) => new TextDecoder().decode(await z.get(n)!());
  if (z.has('META-INF/encryption.xml') && /EncryptedData/.test(await txt('META-INF/encryption.xml')) && !/obfuscation/i.test(await txt('META-INF/encryption.xml'))) throw new Error('This EPUB is DRM-protected. Only DRM-free files can be imported.');
  const cont = new DOMParser().parseFromString(await txt('META-INF/container.xml'), 'application/xml');
  const opfPath = cont.querySelector('rootfile')?.getAttribute('full-path'); if (!opfPath || !z.has(opfPath)) throw new Error('EPUB has no package file');
  const opf = new DOMParser().parseFromString(await txt(opfPath), 'application/xml'), base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const meta = (t: string) => opf.getElementsByTagNameNS('*', t)[0]?.textContent?.trim() || '';
  const items = new Map([...opf.getElementsByTagNameNS('*', 'item')].map(i => [i.getAttribute('id')!, i.getAttribute('href')!]));
  const chapters: HostedBook['chapters'] = []; let words = 0;
  for (const ref of opf.getElementsByTagNameNS('*', 'itemref')) {
    const href = items.get(ref.getAttribute('idref') || ''); if (!href) continue; const path = resolve(base, href); if (!z.has(path)) continue;
    const doc = new DOMParser().parseFromString(await txt(path), 'application/xhtml+xml');
    const body = doc.getElementsByTagName('body')[0] ?? doc.documentElement; if (!body) continue;
    const p: string[] = []; let t = '';
    body.querySelectorAll('h1,h2,h3,p,li,blockquote,pre,div:not(:has(p,div,h1,h2,h3,li))').forEach(el => {
      const s = (el.textContent || '').replace(/\s+/g, ' ').trim(); if (!s) return;
      if (/^H[123]$/.test(el.tagName.toUpperCase()) && !t) t = s.slice(0, 90); else p.push(s);
    });
    if (!p.length) continue;
    words += p.reduce((n, s) => n + s.split(' ').length, 0);
    chapters.push({ t: t || doc.title || `Section ${chapters.length + 1}`, p });
  }
  if (!chapters.length) throw new Error('No readable text found in this EPUB');
  return { id: -(Date.now() % 1e12), title: meta('title') || file.name.replace(/\.epub$/i, ''), author: meta('creator') || 'Unknown', lang: (meta('language') || 'en').slice(0, 2), words, source: 'Your private import', sha: '', chapters, added: Date.now(), file: file.name };
}
