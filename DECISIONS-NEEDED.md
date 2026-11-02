# Decisions needed from Charles

1. **DNS: api.leoneuniversity.org** needs an A record pointing to 217.216.52.191 (at IONOS). This is for accounts, sync and votes later.
2. **Port 443 on Contabo** belongs to the xatvision-caddy-1 container. To serve api.leoneuniversity.org over HTTPS, either add a site block to that Caddy (that touches another project, so it needs your OK) or use a separate port with its own certificate. Until you decide, all books stay hosted on GitHub Pages.
3. **Stripe keys:** paid plans stay in test mode or behind a flag until the keys are put in env.
4. **GitHub Pages size:** the published site is about 0.7 GB, against a soft limit of 1 GB. Going past 2,500 books needs the Contabo text host (see item 2) or a split repo.
5. **Book files are not in the main branch.** public/books and public/covers are gitignored to keep the repo small. They are built by /workspace/llimport and live only in the gh-pages deploy.
