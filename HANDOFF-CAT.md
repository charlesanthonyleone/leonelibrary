# HANDOFF CAT (catalog & discovery worker, Nov 2 night)
Worktree /workspace/ll-cat (branch catdisc -> main).
## Catalog
- Gutenberg top 1000 by downloads (scraped 22:50 ET): 655 already hosted. Of the 345 missing, 305 fail select.py eligibility
  (author/translator died after 1955 or unknown, no text, etc.), 7 previously rejected, 20 are other editions of titles we host.
  13 genuinely new, eligible titles staged for the pipeline worker: /workspace/ll-cat-stage (README.md, new-ids.txt,
  top1000-new-entries.json in catalog shape, source HTML in html/). Run: LL_HTML=/workspace/ll-cat-stage/html pipeline.py OUT --only $(cat new-ids.txt)
- Standard Ebooks: 1541 titles listed with cover URLs in /workspace/ll-cat-stage/standard-ebooks.json (1138 not in catalogue by title).
  Their OPDS feed needs patron auth (401); texts not fetched. Next: per-book epub download from the public book pages, through the pipeline.
## Discovery UI (src/pages/Browse.tsx, styles appended to styles.css)
- Home: store-style shelves (genre chips, Most read ranked, Timeless classics, Short reads, 8 genre rows) with typographic GenCover fallback.
- /genre?g=slug, /author?name=<PG name>, /authors, /subjects, /subject?s=. BookCard author links to author page.
- Routes rely on 404.html SPA fallback; deploy-pages.sh route dirs (pipeline worker's script) could add author authors subjects subject genre.
Shots: /workspace/ll-shots/cat-*.png (desktop 1440, phone 390).
