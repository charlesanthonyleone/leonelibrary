#!/usr/bin/env bash
# Snapshot a curated set of Project Gutenberg plain texts into public/texts so the reader
# works same-origin on GitHub Pages (gutenberg.org sends no CORS headers).
set -euo pipefail
cd "$(dirname "$0")/.."
IDS="${IDS:-1342 84 2701 11 1661 345 43 2554 174 98 64317 2680 1952 21183 21186 19681 1513 16328}"
mkdir -p public/texts
for id in $IDS; do
  [ -s "public/texts/$id.txt" ] && continue
  curl -sfL -m 120 "https://www.gutenberg.org/cache/epub/$id/pg$id.txt" -o "public/texts/$id.txt" && echo "ok $id" || echo "fail $id"
done
