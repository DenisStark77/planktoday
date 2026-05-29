-- plank.today D1 schema
-- Model: EVERY group member is tracked in `users` (registered=0 = hidden).
-- A person appears on the leaderboard / public profile only after they
-- claim (registered=1). public=0 means unlisted but reachable by direct link.

CREATE TABLE IF NOT EXISTS users (
  uid         TEXT PRIMARY KEY,        -- telegram user id, e.g. "419686805"
  slug        TEXT UNIQUE,             -- url slug, e.g. "denis"
  first_name  TEXT,                    -- display name (first name only by default)
  full_name   TEXT,                    -- original TG name (private)
  registered  INTEGER NOT NULL DEFAULT 0,  -- 0 tracked/hidden, 1 opted-in/public
  public      INTEGER NOT NULL DEFAULT 1,  -- 1 listed, 0 unlisted
  photo_url   TEXT,                    -- R2 url of profile photo/video (optional)
  media_bytes INTEGER NOT NULL DEFAULT 0,  -- size of this user's stored media (for cap accounting)
  strict      INTEGER NOT NULL DEFAULT 0,  -- 1 => use strict report parser (Denis)
  referrer    TEXT,                    -- uid of the user who referred them (via ?start=u_<slug>)
  ref_source  TEXT,                    -- 'profile' | 'board' | 'site' | null
  lang        TEXT,                    -- preferred language code (from Telegram language_code)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- key/value counters (e.g. 'media_bytes' = total R2 bytes stored, for the cap guard)
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  uid        TEXT NOT NULL,
  day        TEXT NOT NULL,            -- 'YYYY-MM-DD'
  seconds    INTEGER NOT NULL,
  source     TEXT NOT NULL,            -- 'backfill' | 'group' | 'dm'
  message_id INTEGER,
  PRIMARY KEY (uid, day)               -- one report per person per day, latest wins
);
CREATE INDEX IF NOT EXISTS idx_entries_uid ON entries(uid);

CREATE TABLE IF NOT EXISTS voices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT NOT NULL,
  milestone  INTEGER,                  -- day number: 1 / 7 / 70 / 365
  kind       TEXT NOT NULL,            -- 'video' | 'photo' | 'text'
  url        TEXT,                     -- R2 url for video/photo
  text       TEXT,                     -- message text (for kind='text')
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_voices_uid ON voices(uid);

-- transient bot conversation state (claim / onboarding)
CREATE TABLE IF NOT EXISTS claim_state (
  uid        TEXT PRIMARY KEY,
  step       TEXT,                     -- e.g. 'awaiting_first_time'
  data       TEXT,                     -- JSON blob
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
