#!/bin/sh
# Runs on Contabo next to the quick tunnel. Reads the tunnel's current address from cloudflared's internal metrics
# endpoint (never published), and when it differs from data/assets.json on gh-pages, rewrites that one file and pushes.
# Auth: a deploy key scoped to charlesanthonyleone/leonelibrary, mounted read-only from outside the repo.
export HOME=/tmp/home; mkdir -p $HOME
REPO=git@github.com:charlesanthonyleone/leonelibrary.git; W=/work/site; LOG() { echo "$(date -u '+%F %T UTC') $*"; }
export GIT_SSH_COMMAND="ssh -i /key/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/work/known_hosts"
git config --global user.name Infectoid; git config --global user.email charlesanthonyleone@users.noreply.github.com
sleep 20; LOG "watchdog up"
while true; do
  H=$(curl -sf -m 10 http://tunnel:2000/quicktunnel | sed -n 's/.*"hostname":"\([^"]*\)".*/\1/p')
  if [ -n "$H" ]; then
    NEW="https://$H/"
    if [ ! -d $W/.git ]; then rm -rf $W; git clone -q --depth 1 -b gh-pages $REPO $W || { LOG "clone failed"; sleep 120; continue; }; fi
    (cd $W && git fetch -q --depth 1 origin gh-pages && git reset -q --hard origin/gh-pages) || LOG "fetch failed"
    CUR=$(sed -n 's/.*"base":"\([^"]*\)".*/\1/p' $W/data/assets.json 2>/dev/null)
    if [ "$NEW" != "$CUR" ]; then
      ok=0; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do curl -sf -m 10 -o /dev/null "${NEW}fts/meta.json" && { ok=1; break; }; sleep 10; done
      if [ $ok = 1 ]; then
        printf '{"base":"%s"}\n' "$NEW" > $W/data/assets.json
        (cd $W && git commit -qam "Asset host: $NEW (watchdog)" && git push -q origin HEAD:gh-pages) && LOG "repointed $CUR -> $NEW" || { LOG "push failed"; rm -rf $W; }
      else LOG "new host $NEW not answering yet"; fi
    fi
  else LOG "tunnel metrics unavailable"; fi
  sleep 120
done
