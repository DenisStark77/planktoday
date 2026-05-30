# Operational notes & workarounds

Non-obvious decisions and quirks that are hard to reverse-engineer later.
If you change any of the behaviour below, update this file too.

---

## Accounts / identity

Two "admin" env vars in `wrangler.toml` that are **easy to confuse**:

| Var | uid | Who | Role |
|---|---|---|---|
| `ADMIN_UID` | `8607657267` | **Denis** (@denisstark77, slug `denis`) | Site owner / founder. Personal plank account. `strict=1` parser. |
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
**`source='pregroup'`**. (NB: his *group-era* rows were already tagged
`source='backfill'`, so the pre-group rows use a distinct tag to stay separable.)

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
