# HANDOFF — LR3 (reader content quality & audio)

Worktree `/workspace/ll-r3` (branch lr3, push `HEAD:main`). Staging output: `/workspace/ll-r3-stage/books`.

## Done
- **Chapter splitter v2** `scripts/chapters/chap2.py` + `rebuild.py` (re-splits from the existing book JSON, text-preserving check ≥99.5% words).
  Over the 2,500 core: blind "Part N" fallback 555 → 156 books; chapters >40k words 526 → 0; 740 books get group labels.
  Fixes: repeated "CHAPTER I" per Book (War and Peace had 55 chapters, now 366), contents lists no longer become chapters,
  subtitles merged ("Chapter I: St. Jago — Cape de Verd Islands"), all-caps section titles used for essays/Lives/tales,
  stanza/aphorism runs merged into ~2,500-word chapters ("I – XLII"), giant no-blank-line texts split at sentences,
  CJK 第…回/章/卷 headings, Title Case that keeps roman numerals.
- **Book JSON v2 fields** (backward compatible): `chapters[i].g` group label, `v: 2`, `remap[oldCh] = [newCh, para]`.
- `src/lib/chapters.ts`: `tocGroups(chapters)` for a two-level TOC, `mapPos`, `migrateSaved` (moves saved progress/bookmarks/
  highlights/3D-shelf anchor to the new split once per book, called from `getHosted`). `Chapter.group` now exposed by `getChapters`.

## For the lead (Reader.tsx is yours; I don't edit it)
- TOC panel: `tocGroups(chapters.map(c => ({ title: c.title, g: c.group })))` → render group headers.
- `pendingPara` in Reader is captured from `prog.para` at mount; on the first open after v2 data, migration rewrites
  progress just before chapters arrive. Re-read `prog.para` when chapters load to land exactly.
