// Client-side EPUB 3 builder: a tiny STORE-only zip writer with CRC32. No server, no libraries.
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function zip(files: { name: string; data: string | Uint8Array }[]): Blob {
  const enc = new TextEncoder(), parts: Uint8Array[] = [], central: Uint8Array[] = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  }
  const size = central.reduce((s, p) => s + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)] as BlobPart[], { type: 'application/epub+zip' });
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function buildEpub(meta: { title: string; author: string; lang: string; source?: string }, chapters: { title: string; paras: string[] }[]): Blob {
  const id = 'urn:uuid:' + crypto.randomUUID(), now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const xhtml = (t: string, body: string) => `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${meta.lang}"><head><title>${esc(t)}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`;
  const files: { name: string; data: string }[] = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'OEBPS/style.css', data: 'body{font-family:Georgia,serif;line-height:1.55;margin:0 5%}h1,h2{text-align:center;font-weight:normal}p{text-indent:1.4em;margin:0}.tp{text-align:center;margin-top:30%}.tp p{text-indent:0}' },
    { name: 'OEBPS/title.xhtml', data: xhtml(meta.title, `<section class="tp"><h1>${esc(meta.title)}</h1><p>${esc(meta.author)}</p><p><small>Public-domain text${meta.source ? ' from ' + esc(meta.source) : ''}. Edition prepared with Leone Library.</small></p></section>`) },
  ];
  chapters.forEach((c, i) => files.push({ name: `OEBPS/c${i}.xhtml`, data: xhtml(c.title, `<h2>${esc(c.title)}</h2>${c.paras.map(p => `<p>${esc(p)}</p>`).join('')}`) }));
  files.push({ name: 'OEBPS/nav.xhtml', data: xhtml('Contents', `<nav epub:type="toc"><h2>Contents</h2><ol><li><a href="title.xhtml">Title</a></li>${chapters.map((c, i) => `<li><a href="c${i}.xhtml">${esc(c.title)}</a></li>`).join('')}</ol></nav>`) });
  files.push({ name: 'OEBPS/content.opf', data: `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bid">${id}</dc:identifier><dc:title>${esc(meta.title)}</dc:title><dc:creator>${esc(meta.author)}</dc:creator><dc:language>${meta.lang}</dc:language><dc:publisher>Leone Library</dc:publisher><meta property="dcterms:modified">${now}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="t" href="title.xhtml" media-type="application/xhtml+xml"/>${chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine><itemref idref="t"/>${chapters.map((_, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>` });
  return zip(files);
}
export function download(blob: Blob, name: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

/** Reading log for goals and streaks: minutes per local date. */
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
