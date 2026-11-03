# HANDOFF — book pipeline + quality audit (scripts/pipeline, scripts/qa, scripts/validate-books.mjs)

Owner: QA/pipeline worker (took over from the interrupted pipeline worker, whose untracked files lived in /workspace/ll-pipe).

## Usage
- Build: `python3 scripts/pipeline/pipeline.py OUT --prev <live books dir> --catalog <catalog.json> [--only id,id,...]`
  Sources: `$LL_HTML` (default /workspace/llimport/html), `$LL_RAW` (/workspace/llimport/raw). Writes OUT/books/*.json.gz, catalog.json, manifest.json, report.json.
- Audit (rule-based, all books): `python3 scripts/qa/audit-books.py BOOKS_DIR CATALOG COVERS_LIST [REPORT]`
  flags: missing-cover, missing-book, empty-chapter, tiny-chapter (<20 words, CJK = 2 chars/word), broken-title, gutenberg-boilerplate, junk-prefix (KJV `0$`), encoding-garbage.
- Regression check (text lost vs previous build): `python3 scripts/qa/textloss.py OLD_DIR NEW_DIR ids [0.03]`
- Strict validator (also checks catalogue/meta, duplicates; now includes the audit's cover, junk-prefix, broken-title, CJK, etext-boilerplate rules):
  `node scripts/validate-books.mjs BOOKS CATALOG [report.json] [covers dir|list]`. It is much stricter than the audit and has many legacy false positives (e.g. `{12}` page markers counted as garbled, repeated "Footnotes" titles) — treat its counts as a backlog, not a gate.

## Rule fixes (2026-11-02)
- extract._clean_tree: dropped pagenum/boilerplate elements no longer drop their tail text (was losing up to 50% of some books). Page-anchor spans/links (`pg_xii`) removed, tail kept.
- extract._strip: any paragraph mentioning Project Gutenberg / etext / transcriber / pgdp / distributed proofreaders is dropped regardless of length.
- extract.fix_text: HTML entities unescaped; literal p/div/span/br/i/b/em tags stripped.
- structure: headings with ≥25 CJK chars are prose, not titles.
- post.dedupe: duplicate-opening sections keep the longer one (contents summaries no longer evict real chapters).
- post.finish: "Transcriber's/e-text editor's note", "Production notes" sections dropped.
- normalize.clean_title: strips trailing footnote markers and leading `pg_` anchors; book_title strips MARC ` : $b`.

## Results (2513 live books)
Before: 111 books flagged — broken-title 53, encoding-garbage 29, tiny-chapter 14, gutenberg-boilerplate 14, empty-chapter 4, junk-prefix 2, missing-cover 0.
After rebuilding the 111: 2 flagged, both legitimate (29765 Morse-code heading in Webster's; 16550 short "Index").
Backup of the replaced books on Contabo: /opt/leonelibrary/backup-pre-qa.
Known: 28696 Symbolic Logic is 53k words vs 66k before; checked — extraction now matches the HTML (the old build duplicated text), not a loss.

## GUT worker (Gutenberg growth + Wikipedia bios), Nov 3 night — coordination note, I don't edit scripts/pipeline
- I run scripts/pipeline from origin/main unchanged, with `LL_HTML=/workspace/ll-gut-stage/html` (raw text fallback /workspace/llimport/raw)
  and `--catalog` = main's catalog + my new entries. My ids: /workspace/ll-gut-stage/g*-ids.txt, from /workspace/ll-cat-stage/beyond-candidates.json
  (select.py eligible), excluding the catalogue and the CAT worker's b1/b2 batches. HTML from PG mirror gutenberg.pglaf.org, 2 s apart.
- Wikipedia/Wikidata: scripts/wiki/ (mine) -> public/data/authors.json, descriptions.json. UI: src/lib/wiki.tsx, author bio, book description.
- Batch g1 (300 books, ids in /workspace/ll-gut-stage/built1.txt): built with scripts/pipeline unchanged (headings 257, html-patterns 28, text-patterns 15, 0 errors);
  texts + covers (from /workspace/llimport/staged-6000/covers) uploaded to Contabo with --skip-old-files. audit-books.py on the 300: broken-title 4, encoding-garbage 3, tiny-chapter 5 (report /workspace/ll-gut-stage/audit1.json) — pipeline worker's call whether to rule-fix.
