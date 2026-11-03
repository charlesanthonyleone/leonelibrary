# HANDOFF LR2 (site QA/polish outside the reader)
Worktree /workspace/ll-r2, branch lr2 -> pushed to main.
Done: per-route <title>/description/canonical/OG tags (src/lib/seo.ts, hooked in ScrollTop in main.tsx);
book pages set title "Title by Author", summary description, cover og:image, schema.org Book JSON-LD;
public/robots.txt; scripts/sitemap.mjs (run by deploy-pages.sh after build, all catalogue books).
Done 2: Search error state + retry + no-result tips; Library catalogue-failure state + retry, better empty state; BookCard img decoding/size + aria-pressed shelf button; mobile nav Esc/outside-click close, aria-controls, 44px targets; prefers-reduced-motion.
Next: Book page 404 for unknown id (getBook error text), Account page a11y, image alt on Book hero, Lighthouse run once box load drops.
