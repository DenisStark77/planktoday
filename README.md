# plank.today

**+1% to plank time daily. A tiny step → an exponential result.**

A free, social plank challenge — practice every day, add 1% to your time, and a few months turn 20 seconds into 12 minutes.

## 🧘 Want to try the practice, not the code?

**→ [plank.today](https://plank.today)** has the method, math, calculator, and FAQ.

Then open **[@plank_today_bot](https://t.me/plank_today_bot)** on Telegram and tap **Start** — you'll get a personal progress page like [plank.today/u/denis](https://plank.today/u/denis) (with a chart, leaderboard rank, and a card that unfurls beautifully when you share the link).

The bot speaks **Russian, English, Spanish, and Arabic** — it auto-picks your Telegram language. There's no paywall, no signup form, no email collected.

---

## What this repo contains

The full stack behind plank.today:

- **Landing** (`index.html`) — single static file on **GitHub Pages**, 4 languages, with the methodology, a live +1% calculator, and FAQ.
- **Web app + bot** (`worker/`) — a single **Cloudflare Worker** (plain ES modules, no build step) hosting:
  - The Telegram bot (claim flow, group report parsing, daily updates, welcome-back AI, `/donate`)
  - Dynamic profile pages (`plank.today/u/<slug>`) with the growth chart, +1% forward projection, rank badges, and video circle
  - Multi-category leaderboard (`plank.today/board`) with cross-linking deep-links
  - Dynamic OG share cards (`/api/card/<slug>.png`) so links unfurl with a real image
  - Media (photos + Telegram video circles) in **R2** with a hard storage-cap guard

Storage: **D1** (SQLite at the edge) for users/entries. AI: **Workers AI** (Llama 3.3 70B) for personalized welcome-back greetings in the user's language.

## Architecture in one breath

Telegram messages → Cloudflare Worker (webhook) → parses daily plank reports from the group → upserts into D1 → live profile pages + leaderboard re-render on each request, with OG cards generated on demand via `workers-og` (Satori + resvg WASM). The static landing stays on GitHub Pages; only `/u/*`, `/board`, and `/api/*` paths are routed to the Worker via Cloudflare proxy.

## Repo layout

```
index.html                 ← the landing (RU/EN/ES/AR, served by GitHub Pages)
worker/                    ← Cloudflare Worker
  src/
    index.js               ← router + Telegram webhook entrypoint
    bot.js                 ← Telegram bot, claim flow, welcome-back AI
    render.js              ← profile + leaderboard HTML, share UI
    card.js                ← dynamic OG PNG (workers-og)
    i18n.js                ← all bot messages in RU/EN/ES/AR
    db.js                  ← D1 queries + metrics (growth, streak, peak, …)
    parser.js              ← multi-format MM:SS report parser
    telegram.js            ← Bot API helpers
  schema.sql               ← D1 schema
  BRING-UP.md              ← exact deploy commands (D1/R2/secrets/webhook)
  assets/font.ttf          ← Cyrillic-capable Inter, bundled for OG cards
tools/                     ← Python tools (TG export parser, D1 seed generator)
.github/workflows/         ← deploy.yml — Cloudflare deploy on push to main
```

## Run locally / deploy

The full setup (creating D1 + R2, setting Worker secrets, registering the Telegram webhook, switching the domain to Cloudflare) is documented step-by-step in [`worker/BRING-UP.md`](worker/BRING-UP.md).

Local dev:

```bash
cd worker
npm install
npx wrangler dev
```

## Mission

plank.today is **free**. The methodology, the bot, the community page — all open-access, no paywall. The project's purpose is to spread a tiny, repeatable daily habit that genuinely compounds, and to eventually let advanced practitioners run their own +1% groups.

## Status

Live. Launched to the founding community in May 2026.

Built by [@DenisStark77](https://github.com/DenisStark77).
