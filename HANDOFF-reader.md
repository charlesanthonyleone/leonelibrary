# Reader handoff (round 3, reader worker)
Done (commit "Reader: player bar, sentence sync, tap halves, quick themes"):
- Tap/click left half = previous page, right half = next (ignored on selection, links, marks, edit mode, after a swipe). Edge buttons remain for keyboard/AT.
- Narration player bar (fixed bottom, mobile-first): previous sentence, pause/resume (AudioContext suspend), next sentence, speed cycle 0.75–2×, stop. Works for Kokoro; device voice falls back to paragraph skip.
- Sentence highlight synced to Kokoro chunks (`narrate` onChunk → `.say` span); the page turns itself to follow the spoken sentence.
- Aa panel: Light / Sepia / Dark buttons and A− / A+ (14–30px).
- Footer shows whole-book %.
Verified locally at 390x844 (test: /workspace/t/rr.py, rq.py).
QA worker: please check desktop two-column spread with the player, and screen readers on the player region.
