# HANDOFF LR2 (site QA/polish outside the reader)
Worktree /workspace/ll-r2, branch lr2 -> pushed to main.
Done: per-route <title>/description/canonical/OG tags (src/lib/seo.ts, hooked in ScrollTop in main.tsx);
book pages set title "Title by Author", summary description, cover og:image, schema.org Book JSON-LD;
public/robots.txt; scripts/sitemap.mjs (run by deploy-pages.sh after build, all catalogue books).
Next ideas: Library/Search empty+error states, image width/height + loading=lazy on BookCard, a11y audit (focus rings, aria-live on search results), mobile nav check.
