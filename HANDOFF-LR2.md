# HANDOFF LR2 (site QA/polish outside the reader)
Worktree /workspace/ll-r2, branch lr2 -> pushed to main.
Done: per-route <title>/description/canonical/OG tags (src/lib/seo.ts, hooked in ScrollTop in main.tsx);
book pages set title "Title by Author", summary description, cover og:image, schema.org Book JSON-LD;
public/robots.txt; scripts/sitemap.mjs (run by deploy-pages.sh after build, all catalogue books).
Done 2: Search error state + retry + no-result tips; Library catalogue-failure state + retry, better empty state; BookCard img decoding/size + aria-pressed shelf button; mobile nav Esc/outside-click close, aria-controls, 44px targets; prefers-reduced-motion.
Done 3: Book page not-found states (6fe62b03; its fetchpriority TS error was fixed by lead in b35266ee). My 22:10 deploy was from a stale tree and briefly rolled back the reader; lead redeployed 0015ca9d. RULE: always build from fresh origin/main and check merge-base before deploying.
Done 4: Account email autocomplete + always-present live status region. Next: Lighthouse (not installed; box too loaded).
