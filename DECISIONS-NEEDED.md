# Decisions needed from Charles

1. **DNS: api.leoneuniversity.org** needs an A record pointing to 217.216.52.191 (at IONOS). This is for accounts, sync and votes later.
2. **Port 443 on Contabo** belongs to the xatvision-caddy-1 container. To serve api.leoneuniversity.org over HTTPS, either add a site block to that Caddy (that touches another project, so it needs your OK) or use a separate port with its own certificate. Until you decide, all books stay hosted on GitHub Pages.
3. **Stripe keys:** paid plans stay in test mode or behind a flag until the keys are put in env.
4. **GitHub Pages size:** the published site is about 0.7 GB, against a soft limit of 1 GB. Going past 2,500 books needs the Contabo text host (see item 2) or a split repo.
5. **Book files are not in the main branch.** public/books and public/covers are gitignored to keep the repo small. They are built by /workspace/llimport and live only in the gh-pages deploy.

## 6. Accounts API: where it runs (blocked on #2)
`server/` holds a working, zero-dependency accounts + credits API (Google/GitHub OAuth, email magic link, passkeys, votes, sync, credits ledger, Stripe Checkout in test mode). The site hides it behind `VITE_ACCOUNTS=1` / `VITE_CREDITS=1`. It needs a public HTTPS host. Port 443 on Contabo belongs to XatCast and will not be touched, so the options are: (a) a free Cloudflare Tunnel to a localhost-only container (needs a Cloudflare account on the domain), (b) a different free host. The compose file is resource-capped (0.5 CPU, 256 MB) and binds 127.0.0.1 only; the port is chosen after checking `docker ps`/`ss` on deploy day.

## 7. Email sender for magic links
No mail provider is configured, so magic-link emails are only logged. Options: a free SMTP or transactional tier wired up through `MAIL_WEBHOOK`. Until one is chosen, Google, GitHub and passkeys are the only working sign-ins.

## 8. OAuth apps
Charles creates the Google and GitHub OAuth apps (callback: https://api.leoneuniversity.org/auth/{google,github}/callback) and puts the IDs and secrets in server/.env on the host. Nothing goes in the repo.

## 9. Live Stripe key present in the box shell
The box shell environment has a STRIPE_SECRET_KEY that starts with `sk_live`. Agents never read or use it; the server is always tested with `env -u STRIPE_SECRET_KEY`, and it refuses live keys unless STRIPE_LIVE=1. Charles: decide whether that variable should stay in the box environment.

## 10. GitHub Pages size
The deploy is about 768 MB in about 12,300 files. The GitHub Pages limit is 1 GB. Options: keep it under the limit (prune or recompress), or move books/fts to free object storage later.

**#10 resolved (Nov 2 2026):** book texts, covers and the search index now live on Contabo in /opt/leonelibrary/assets. They're served by the `leonelibrary` compose project: a Caddy file server capped at 256 MB and 0.5 CPU, read-only, on 127.0.0.1:8792, plus a cloudflared quick tunnel capped at 128 MB and 0.3 CPU. Pages now carries only the app shell (17 MB, 112 files, down from 768 MB). The app reads the asset host from `data/assets.json`, and falls back to same-origin URLs if it can't reach it.

## 11. Stable hostname for the asset tunnel: needs Charles
The tunnel is a free Cloudflare *quick* tunnel (`*.trycloudflare.com`, no account). Its address changes whenever the container restarts, and until it's re-pointed, books and covers won't load. The fix is one command, `scripts/set-asset-host.sh`. For a permanent `books.leoneuniversity.org` there are two free options:
- (a) Add leoneuniversity.org to a free Cloudflare account. That means changing the nameservers away from IONOS; first copy over all existing records, including the `library` CNAME. Then run `cloudflared tunnel login` on the server, create a named tunnel and route books.leoneuniversity.org to it.
- (b) Keep IONOS DNS and add just a subdomain zone `books.leoneuniversity.org` to Cloudflare. Cloudflare's free plan doesn't support that, so (a) is the free route.
After that: `scripts/set-asset-host.sh https://books.leoneuniversity.org/`.

## 12. Accounts: end-to-end encrypted sync (confirmed by Charles)
Shelves, highlights, notes and progress are encrypted in the browser before sync: AES-GCM, with a key derived from a recovery phrase. The server stores only ciphertext. Payment and credit records stay server-side. Anonymous local use keeps working and is merged in at sign-up. This still needs a host for the API (#6); the client crypto is being built behind the accounts flag.

> Update (Nov 2, 2026): until #11 is done, a capped watchdog container on Contabo (`deploy/watchdog`, 96 MB / 0.2 CPU, read-only, no capabilities)
> reads the quick tunnel's address from cloudflared's internal metrics and repoints `data/assets.json` on gh-pages. It authenticates with a
> deploy key scoped to this repo only (GitHub deploy key id 168532828), stored at /opt/leonelibrary/secrets on the VPS, never in the repo.
> It restarts with Docker (`restart: unless-stopped`), so it survives reboots. Revoke anytime in repo Settings → Deploy keys.
