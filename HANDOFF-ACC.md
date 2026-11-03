# HANDOFF ACC (Leone ID integration — owned by the ACC worker)
Optional cross-site account via Leone ID (id.xatmarket.com). Nothing prompts sign-up; reading stays anonymous and local.
- public/vendor/leone-id-sdk.js: vendored SDK (source: /workspace/leone-id/public/sdk.js). Loaded in index.html, client `leone-library`, redirect https://library.leoneuniversity.org/account.
- src/lib/leoneid.ts: track(), syncAll() (encrypts all leone:* keys with the site key kd via LeoneID.data.sync, reusing e2e.ts merge), startAutoSync() (tab hide + every 3 min, only when linked; started in main.tsx).
- src/components/LeoneIdCard.tsx: "Save across Leone sites" card (privacy disclosure from /api/sites, link/sync/unlink) + XpCard (level, XP bar, achievements). Shown on /account in both flag states. Card hides itself if Leone ID is unreachable (today: id.xatmarket.com has no Caddy route yet, see leone-id DECISIONS-NEEDED.md).
- XP hooks: Reader page turn -> library.read_page, finishing (>=99%) -> library.finish_book (once per book, lid-fin:<id>), highlight -> library.bookmark, shelf add (BookCard, Book) -> library.shelf_add.
- Coexists with the existing phrase-based SyncCard (FLAGS.accounts) — untouched.
Not done: gh-pages deploy (left to whoever runs scripts/deploy-pages.sh next; it ships automatically). Next: show XP badge in nav, Leone ID sign-in replacing the phrase card once accounts flag decisions land.
