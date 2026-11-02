#!/usr/bin/env bash
# Re-point the app at the Contabo asset tunnel. Run after the tunnel container restarts (a quick tunnel gets a new address),
# or pass a fixed host once books.leoneuniversity.org exists:  scripts/set-asset-host.sh https://books.leoneuniversity.org/
set -euo pipefail; cd "$(dirname "$0")/.."
URL="${1:-$(ssh -i "$HOME/.ssh/contabo_rsa" -o BatchMode=yes root@217.216.52.191 'cd /opt/leonelibrary && docker compose logs tunnel 2>&1' | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1)/}"
curl -sf -o /dev/null "${URL}fts/meta.json" || { echo "asset host $URL not answering"; exit 1; }
printf '{"base":"%s"}\n' "$URL" > public/data/assets.json
git commit -qm "Asset host: $URL" public/data/assets.json || true
bash scripts/deploy-pages.sh
