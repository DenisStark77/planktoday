# plank.today bot + pages — bring-up

Two phases:
- **Phase A** — deploy to a free `*.workers.dev` URL and test the whole thing end-to-end.
- **Phase B** — switch to clean `plank.today/u/<slug>` URLs (DNS on Cloudflare), keeping the existing landing on GitHub Pages.

Do Phase A first. Don't touch DNS until the bot works on workers.dev.

---

## Phase A — test on workers.dev

### 0. Prereqs
- Node installed (done — v26).
- From the repo root:
  ```bash
  cd worker
  npm install
  npx wrangler login     # opens browser, authorize
  ```

### 1. Create D1 and paste the id
```bash
npx wrangler d1 create plank-today
```
Copy the printed `database_id` into `worker/wrangler.toml` (replace `PLACEHOLDER_RUN_wrangler_d1_create`).

### 2. Create the R2 bucket
```bash
npx wrangler r2 bucket create plank-today-media
```

### 3. Apply schema + seed
Generate the seed (from repo root) if you haven't:
```bash
python3 tools/make_seed.py     # writes worker/seed.sql (gitignored)
```
Then load both into the REMOTE D1:
```bash
cd worker
npx wrangler d1 execute plank-today --remote --file=./schema.sql
npx wrangler d1 execute plank-today --remote --file=./seed.sql
```

### 4. Set secrets
```bash
npx wrangler secret put TG_BOT_TOKEN        # paste the rotated BotFather token
npx wrangler secret put TG_WEBHOOK_SECRET   # paste any random string, e.g. output of: openssl rand -hex 16
```
Keep a copy of the webhook secret — you need it in step 6.

### 5. Set PUBLIC_BASE to the workers.dev URL, then deploy
First deploy to learn your URL:
```bash
npx wrangler deploy
```
It prints something like `https://plank-today.<your-subdomain>.workers.dev`.
Put that into `worker/wrangler.toml` under `[vars] PUBLIC_BASE = "..."` (no trailing slash), then deploy again:
```bash
npx wrangler deploy
```
Sanity check:
```bash
curl https://plank-today.<your-subdomain>.workers.dev/api/health     # {"ok":true,...}
```
Open `https://plank-today.<your-subdomain>.workers.dev/` — you should see the leaderboard with **Denis** (pre-registered in the seed). Open `/u/denis`.

### 6. Point the Telegram webhook at the Worker
```bash
curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
  -d "url=https://plank-today.<your-subdomain>.workers.dev/api/tg/webhook" \
  -d "secret_token=<TG_WEBHOOK_SECRET>"
```
Verify:
```bash
curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo"
```

### 7. Test the flow
- **Group parsing**: post `5:00 ✔️` (as yourself) in the group → then re-open `/u/denis`, the new day should appear. (Group Privacy is already OFF, required for this.)
- **Claim**: open a DM with `@plank_today_bot`, send `/start`. A non-registered member (e.g. Юлия if she does it) gets her stats card + ✅ Опубликовать button. Tapping it publishes her page and adds her to the leaderboard.
- **New person**: someone with no history sends `/start` → bot asks for their first plank time → creates Day 1 → claim card.
- **Photo**: after claiming, send a photo → appears on the profile.

If something misbehaves, tail logs:
```bash
npx wrangler tail
```

---

## Phase B — clean plank.today/u/<slug> URLs

This keeps your landing on GitHub Pages and routes only `/u/*` and `/api/*` to the Worker. It requires the `plank.today` domain to be managed by Cloudflare DNS (proxied).

Registrar today: **GoDaddy** (`ns03/04.domaincontrol.com`). Apex → GitHub Pages IPs. **Email: ImprovMX forwarding** (`hello@plank.today`) via MX `mx1/mx2.improvmx.com` + SPF TXT. These MUST be preserved.

1. In the Cloudflare dashboard: **Add a site** → `plank.today` → Free plan → it scans your current DNS. Cloudflare gives you two **nameservers**.
2. **Before switching NS, verify Cloudflare imported every record** (add any it missed):
   - `A @` → `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` (GitHub Pages) → **Proxied (orange)**
   - `CNAME www` (or A www → same IPs) → **Proxied (orange)**
   - `MX @` → `mx1.improvmx.com` (10), `mx2.improvmx.com` (20) → **DNS only (grey)** — MX must NOT be proxied
   - `TXT @` → `v=spf1 include:spf.improvmx.com ~all`
3. **SSL/TLS → Overview → set mode to `Full`** (NOT Flexible — Flexible + GitHub Pages "Enforce HTTPS" = redirect loop).
4. At **GoDaddy**, change nameservers to the two Cloudflare ones. (Propagation: hours.)
5. Wait for Cloudflare to email "zone is active". The site keeps serving throughout. Confirm email still works (send a test to `hello@plank.today`).
4. Uncomment the `routes` block in `worker/wrangler.toml`:
   ```toml
   routes = [
     { pattern = "plank.today/u/*", zone_name = "plank.today" },
     { pattern = "plank.today/api/*", zone_name = "plank.today" },
   ]
   ```
5. Set `[vars] PUBLIC_BASE = "https://plank.today"` in `wrangler.toml`.
6. Redeploy: `npx wrangler deploy`.
7. Re-point the webhook to the clean URL:
   ```bash
   curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
     -d "url=https://plank.today/api/tg/webhook" \
     -d "secret_token=<TG_WEBHOOK_SECRET>"
   ```
8. Test: `https://plank.today/` still serves the GitHub Pages landing; `https://plank.today/u/denis` is served by the Worker; `https://plank.today/api/health` returns ok.

> Note: with the seed, profiles are reachable only for `registered=1` users. Only **Denis** is pre-registered; everyone else appears once they tap ✅ in the bot. That's the intended consent model.

---

## GitHub-based auto-deploy (optional, after Phase A works)

`.github/workflows/deploy.yml` deploys on every push to `worker/**`. Add two repo secrets:
- `CLOUDFLARE_API_TOKEN` — create at dashboard → My Profile → API Tokens → template **Edit Cloudflare Workers**.
- `CLOUDFLARE_ACCOUNT_ID` — `05ac0ce5e11911e97af46358bcd0553f`.

Then `git push` redeploys automatically.

## Re-deriving the group chat id (if needed later)
The bot reacts to any group it's in (Privacy OFF). If you later want to restrict to one group, get its id:
```bash
curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/getUpdates"   # post a message in the group first
```
Look for `"chat":{"id":-100...}`.
