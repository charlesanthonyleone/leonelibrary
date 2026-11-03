#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch of charlesanthonyleone/leonelibrary.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/check-catalog.mjs
# The Contabo watchdog keeps data/assets.json on gh-pages pointed at the live tunnel; carry its current value forward.
LIVE=$(curl -sf -m 10 https://library.leoneuniversity.org/data/assets.json || true)
case "$LIVE" in '{"base":"https://'*) printf '%s\n' "$LIVE" > public/data/assets.json;; esac
npm run build
# Book texts, covers and the search index are served from Contabo (see data/assets.json); Pages keeps only the app shell.
if [ "${KEEP_ASSETS:-0}" != 1 ]; then rm -rf dist/books dist/covers dist/fts; fi
node scripts/sitemap.mjs
cp dist/index.html dist/404.html
for r in library book read shelf plans shelves marketplace clubs notes goals export studio/glossary studio/collab design studio studio/translate studio/remix studio/continue studio/design publishing publishing/calculator publishing/submit publishing/royalties classroom community storefront rights add search paths dna offline import account author authors subjects subject genre; do
  mkdir -p "dist/$r"; cp dist/index.html "dist/$r/index.html"; done
touch dist/.nojekyll
REMOTE=$(git remote get-url origin)
(cd dist && ls assets | grep -v -e kokoro -e '\.wasm$' | sed 's|^|assets/|' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(s.trim().split('\\n'))))" > precache.json)
cd dist && rm -rf .git && git init -q -b gh-pages && git add -A \
  && git -c user.name=Infectoid -c user.email=charlesanthonyleone@users.noreply.github.com commit -qm "Deploy $(cd .. && git rev-parse --short HEAD)" \
  && git push -qf "$REMOTE" gh-pages && rm -rf .git
