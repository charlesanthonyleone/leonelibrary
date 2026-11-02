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
