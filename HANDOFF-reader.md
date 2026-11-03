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

## Round 3c (74866946, deployed from fresh origin/main incl. 848782c2)
- tts.ts: Kokoro text goes through speakable() (empty result → short silence); highlight ranges unchanged. Piper (non-English) untouched.
- Book.tsx first-page title uses chapterTitle(). Reader titles already come via getChapters.
- Reader: new highlights store `para` and jump to it; bookmarks sorted by position, labelled "Group · Chapter", empty state.
- KJV 7999 "0$:001:001" Opening NOT fixed by me (per lead: new pipeline worker owns it). Cause: REF in scripture.py needs digits, so the first verse of each book (prefix "0$") falls into front → "Opening".
- Live /account shows the device-only state (no email input rendered), so 848782c2's email/live-region elements can't be checked live.

## Round 3d
- Pagination verified live (390 + 1440): CSS-column pages, two-page spread on desktop, tap halves / arrows, footer "Page N of M · K pages left in chapter". Phone: tap zones no longer leave a sticky gold frame after a touch; paper height uses 100dvh so the footer stays on screen; footer stacks at ≤520px.
- axe rescan of the remaining routes (/library … /nope, 25 routes) on live: 0 violations.
- /account sign-in form: gated by FLAGS.accounts (VITE_ACCOUNTS=1, not set in the Pages build), so the device-only state shows. Separately, Leone ID's issuer https://id.xatmarket.com doesn't answer over HTTPS (http gives 500 via Pingora), so the Leone ID card stays hidden. Left as-is: needs HTTPS on id.xatmarket.com plus an accounts backend (decision for Charles).

## Round 3e (90c64606, live)
- Progress scrubber under the page (whole book; drag shows chapter + %, release jumps to chapter/paragraph; keyboard works; aria-valuetext).
- "Save offline" / "✓ Offline" toggle in the reader bar (keepOffline/dropOffline); verified: saved, network off, reload of another chapter opens.
- Player: ⏪/⏩ paragraph skip beside ⏮/⏭ sentence skip, ☾ sleep-timer button cycling Off/15/30/60 min/end of chapter (same state as the Voice panel select). Verified with Kokoro on local.
- Already present and checked: Find in book (67 hits "Netherfield" across chapters), Aa themes Light/Sepia/Dark + size, Design panel font/leading/measure, slide page turn.

## Round 4 (reader worker 2)
- Sleep timer fades out: natural voices ramp a shared GainNode to silence over the last 30 s (tts.ts `Narration.fade`); device voices lower utterance volume per paragraph. Player ☾ shows a live mm:ss countdown and pulses while fading; 5-min option added; changing the timer mid-fade restores volume. Not verified end-to-end with Kokoro audio in headless (model load); code path typechecks.
- Page turns: swipe handlers moved to `.book-spread` so swipes starting on the 30% tap zones work on phones (they silently failed before); slow drags over 25% of the width also turn; horizontal trackpad swipe (wheel deltaX) turns; Home/End = first/last page of chapter. Verified with CDP touch at 390px.
- Notes panel: Export Markdown / Export JSON (`notesExport` in shared.ts; highlights, notes, bookmarks, deep links `read?id=&ch=#pN`, which the reader now honours). /stats has "Export all notes".
- New /stats page (Stats.tsx): time read, streak, measured reading speed (words from page turns ÷ active minutes, `readstats` key), 7-day bars, per-book progress/time/highlights. Footer shows "N min left in chapter" (desktop) from that speed, 230 wpm until learned. Linked from footer + reader bar.
- A11y: panel buttons aria-expanded/aria-controls, panel labelled per content, focus moves to panel heading and returns to the opener on Esc/✕, close button, visible focus rings on bar/panel/tap zones/selection toolbar, keyboard-help button. axe: 0 violations on /read and /stats.
