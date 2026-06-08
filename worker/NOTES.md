# Operational notes & workarounds

Non-obvious decisions and quirks that are hard to reverse-engineer later.
If you change any of the behaviour below, update this file too.

---

## Daily reminders

Timezone-aware "did you plank today?" nudges. Code: `src/reminders.js`; wired into
`bot.js` (commands + callbacks + onboarding offer) and `index.js` `scheduled()`.

- **Opt-in.** Offered once after onboarding (claim flow) and via a one-time
  broadcast (`/broadcast_reminders`, admin-only). `users.reminder_offered` guards
  against re-offering. Users can also run `/remind` anytime.
- **Timezones = 4 coarse zones only** (London / New York / Moscow / Sydney →
  `Europe/London`, `America/New_York`, `Europe/Moscow`, `Australia/Sydney`).
  The zone **and** hour are on **one screen** (edited in place) so e.g. a Berlin
  user picks "London" and shifts the hour to compensate. IANA zones → DST is
  correct via `Intl`. (v2 idea: a Mini App that auto-detects the exact IANA zone.)
- **Scheduling:** cron is hourly (`0 * * * *`). Each tick, `runReminderTick`
  selects `reminder_on=1` users whose local hour (computed via `localParts`) ==
  `reminder_hour`, who haven't been nudged today (`reminder_last`) and haven't
  planked today. Nudge lands *within* the chosen local hour (exact minute varies
  by the zone's UTC offset — e.g. India-style :30 zones aren't in the picker).
- **Auto-pause after 12 days** of inactivity: one warm farewell, then
  `reminder_on=0`. Blocked bot (send 403/400) also auto-disables.
- **Columns** on `users`: `tz`, `reminder_on`, `reminder_hour`, `reminder_last`,
  `reminder_offered`. Remember to `ALTER` **remote** D1 (local schema goes stale).

---

## Web localization (profile + leaderboard)

`/u/<slug>` and `/board` are localized to the **viewer's** language (ru/en/es/ar),
detected from the `Accept-Language` header in `index.js` (`pickLang`), defaulting
to **English**. Arabic renders with `dir="rtl"`.

- Strings + the 7 board names/descriptions live in `src/web_i18n.js` (`tw()`,
  `boardName`/`boardDesc`, `daysWord`). `render.js` threads `lang` through every
  function. The bot has its own `i18n.js` (owner language); these are separate.
- The static landing page (`index.html`, GitHub Pages) has its own data-i18n.
- **Card images** (`card.js`) are localized too, via a `?lang=` query param that
  the profile threads into `og:image` and the IG share URLs (default English).
  **Arabic caveat:** the bundled Inter font has no Arabic glyphs, so the Arabic
  card falls back to English text (`cl = lang==='ar' ? 'en' : lang`) to avoid tofu.
  To do Arabic cards properly, bundle an Arabic font (e.g. Noto Sans Arabic) and
  pass both fonts to `ImageResponse`.

## Share button (web)

`psShare()` uses the Web Share API when available (native sheet), else copies the
link. Do NOT make it redirect to Telegram on missing Web Share — that hijacks the
generic Share button (regressed once, see git `ade3dc4`→`c8992bc`). In-app
browsers (Telegram iOS) lack `navigator.share`, so it copies there; the dedicated
Telegram / Instagram / Copy icon buttons cover targeted sharing.

---

## Report parsing (generic, + LLM fallback)

`src/parser.js` → `extractReport(text)` is now **generic for everyone** — the old
per-user strict/lenient split is gone (the `strict` arg is ignored; `users.strict`
is vestigial). A line is a report if, after stripping lead-ins (emoji, dates,
"сегодня"/"планка", verbs like "держал"), it STARTS with a duration and then:
a colon time (M:SS) — strong signal, accepted even with trailing commentary;
or a non-sentence remainder (emoji/punct/units); or a trailing period/marker;
or the line ends in a checkmark. No ✔️ required. Discussion never starts with a
bare time, so it's rejected. Validated against the full group export.

- **LLM fallback** (`src/aiparse.js` → `aiClassifyReport`) runs in `bot.js` ONLY
  when the algorithm returns null AND `hasTimeToken(text)` AND the message is
  short — judges report-vs-chatter via Workers AI for the messy leftovers. Clean
  reports never hit the LLM.
- **History was re-parsed** from `~/Downloads/ChatExport_2026-05-28/result.json`
  with this parser and written as **`source='reparse'`** (replaced the old
  `source='backfill'`). Tools `tools/parser.py` + `make_seed.py` are SUPERSEDED
  (they had a destructive outlier guard that silently dropped legit spikes like
  Denis's 16 Sep "10 минут"). Undo a re-import: `DELETE ... WHERE source='reparse'`.
- Old deleted account `user419686805` (Denis, pre Telegram-reset) is merged into
  `8607657267` via the same remap make_seed used.
- **Forwarded messages:** the live bot (`handleGroup`) IGNORES forwards
  (`forward_origin`/`forward_date`/…) — a relayed report must not credit the
  forwarder. In the historical re-parse, forwarded reports were re-attributed to
  `forwarded_from_id` (or matched by `forwarded_from` name) when that's a known
  member, else dropped (channels/non-members). This recovered e.g. Юлия's, Ivan's
  and Elena's true first-times that Denis had forwarded on their behalf.

---

## Accounts / identity

Two "admin" env vars in `wrangler.toml` that are **easy to confuse**:

| Var | uid | Who | Role |
|---|---|---|---|
| `ADMIN_UID` | `8607657267` | **Denis** (@denisstark77, slug `denis`) | Site owner / founder. Personal plank account. (`strict=1` flag now vestigial — parser is generic.) |
| `ANON_ADMIN_UID` | `969418040` | **Jane** (@JaneStarck, "Женя") | Telegram **group** admin. |

- `ADMIN_UID` is the *website* owner, **not** the group admin. Naming trap: "admin"
  here ≠ "the person who admins the Telegram group."
- **Anonymous-admin attribution.** In the TG group, Jane posts as the group's
  *anonymous* admin — Telegram's "send messages as the group" flag is enabled and
  **cannot be turned off** for her. Those messages arrive with
  `sender_chat === <group>` and no personal `from` user, so the bot can't attribute
  them normally. We credit such posts to `ANON_ADMIN_UID` (Jane). Her own plank
  history therefore lives under that account. Set `ANON_ADMIN_UID=""` to ignore
  anonymous posts entirely.

---

## Founder excluded from leaderboards

**Why:** Denis practiced solo for ~a year *before* the Telegram group existed,
growing **1:30 → 30:00** at ~1%/day. That history is restored on his profile (see
below), which is inspiring — but it would also put him #1 on most leaderboards
(×20 multiplier, earliest start, longest streak, most reports). A founder topping
every board is demotivating for members and reads as "the owner always wins."

**Rule:** the founder (= `ADMIN_UID`) is dropped from any board where he would rank
**#1**, and kept on boards where he is **not** #1 (e.g. he can still appear at #2).
His full history still shows on his own profile (`/u/denis`) — this only affects the
ranked leaderboards.

**Where:** `src/render.js` → `rankBoard(board, rows, founderUid)`, called from both
`renderLeaderboard()` (the `/board` page) and `rankBadges()` (profile rank chips).
Removing the founder renumbers everyone else, so ranks stay 1,2,3…

---

## Denis's pre-group history (backfill)

Reconstructed from anchor points in his TG blog and written as `entries` rows with
**`source='pregroup'`**. (His *group-era* rows are `source='reparse'` — see "Report
parsing" — so the pre-group blog reconstruction stays separable from both.)

- **Range:** `2023-06-13` (1:30 / 90s) → `2024-05-17` (30:00 / 1800s), 340
  consecutive daily entries. Then a pause until the group started (≈2025-01).
- **Method:** piecewise geometric (constant-%) interpolation that passes exactly
  through the recorded blog anchors (3:00, 7:56, 11:00, 17:50, 27:00, 30:00).
  Effective rate averaged **+0.95%/day**; the final climb to 30:00 was slower
  (+0.42%/day) — preserved, not smoothed.
- **Anchors used:** 2023-08-22 3:00 · 2023-11-24 7:56 · 2023-12-28 11:00 ·
  2024-02-16 17:50 · 2024-04-01 27:00 · 2024-04-26→05-17 30:00 (plateau).
- **Generator:** `/tmp/plank_backfill.py` (kept out of the repo; rerun to regenerate
  the SQL if anchors change).

**Reversible** — to remove the backfill entirely:

```sql
DELETE FROM entries WHERE uid='8607657267' AND source='pregroup';
```

This restores his stats to group-only (start 5:00, no ×20 multiplier) and he
re-enters the leaderboards normally.
