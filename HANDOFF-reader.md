# Reader handoff (round 3, reader worker)
Done (commit "Reader: player bar, sentence sync, tap halves, quick themes"):
- Tap/click left half = previous page, right half = next (ignored on selection, links, marks, edit mode, after a swipe). Edge buttons remain for keyboard/AT.
- Narration player bar (fixed bottom, mobile-first): previous sentence, pause/resume (AudioContext suspend), next sentence, speed cycle 0.75–2×, stop. Works for Kokoro; device voice falls back to paragraph skip.
- Sentence highlight synced to Kokoro chunks (`narrate` onChunk → `.say` span); the page turns itself to follow the spoken sentence.
- Aa panel: Light / Sepia / Dark buttons and A− / A+ (14–30px).
- Footer shows whole-book %.
Verified locally at 390x844 (test: /workspace/t/rr.py, rq.py).
QA worker: please check desktop two-column spread with the player, and screen readers on the player region.

## Round 3b (reader worker)
- Desktop two-page spread + player verified live: player sits in the footer band (footer hidden while listening; book % shown in player).
- Define on select (single word) via Wiktionary REST, CC BY-SA attribution; touch selection handled via selectionchange.
- Contents is two-level using LR3 `tocGroups` (War and Peace: 15 Books / 366 chapters); current chapter scrolled into view; aria-current.
- Migrated progress re-read when chapters load (per HANDOFF-LR3).
- Home "Continue reading" (last 4 books from local progress). `personName()` in books.ts: natural author names site-wide.
- Known: book page "N chapters" comes from catalogue `chapters` and may differ from the v2 split until the catalogue is regenerated (LR3).
