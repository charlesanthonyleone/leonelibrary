#!/usr/bin/env bash
# Watches the Contabo quick tunnel; when its address changes (container restart), repoints and redeploys the site.
# Single instance (flock), low priority, every 120 s. Start: setsid nohup nice -n 15 scripts/asset-watchdog.sh >/tmp/asset-watchdog.log 2>&1 &
cd "$(dirname "$0")/.."; exec 9>/tmp/asset-watchdog.lock; flock -n 9 || { echo "already running"; exit 0; }
while true; do
  NEW=$(timeout 30 ssh -n -i "$HOME/.ssh/contabo_rsa" -o BatchMode=yes -o ConnectTimeout=10 root@217.216.52.191 \
    'cd /opt/leonelibrary && docker compose logs --tail 200 tunnel 2>&1' | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1)
  CUR=$(grep -o 'https://[^"]*' public/data/assets.json)
  if [ -n "$NEW" ] && [ "$NEW/" != "$CUR" ]; then
    for i in 1 2 3 4 5 6; do curl -sf -m 10 -o /dev/null "$NEW/fts/meta.json" && break; sleep 10; done
    echo "$(date '+%F %T %Z') tunnel moved: $CUR -> $NEW/"
    timeout 600 bash scripts/set-asset-host.sh "$NEW/" && git push -q origin main && echo "$(date '+%F %T %Z') repointed" || echo "repoint failed, retrying next round"
  fi
  sleep 120 9>&-
done
