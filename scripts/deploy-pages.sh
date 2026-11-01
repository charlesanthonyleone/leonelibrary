#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch of charlesanthonyleone/leonelibrary.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
cp dist/index.html dist/404.html
for r in library book read shelf plans shelves marketplace clubs notes goals export studio/glossary studio/collab design studio studio/translate studio/remix studio/continue studio/design publishing publishing/calculator publishing/submit publishing/royalties classroom community storefront rights; do
  mkdir -p "dist/$r"; cp dist/index.html "dist/$r/index.html"; done
touch dist/.nojekyll
REMOTE=$(git remote get-url origin)
cd dist && rm -rf .git && git init -q -b gh-pages && git add -A \
  && git -c user.name=Infectoid -c user.email=charlesanthonyleone@users.noreply.github.com commit -qm "Deploy $(cd .. && git rev-parse --short HEAD)" \
  && git push -qf "$REMOTE" gh-pages && rm -rf .git
