/** D1 access + metrics. */

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function translit(s) {
  let out = "";
  for (const ch of String(s).toLowerCase()) {
    if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (ch === " " || ch === "-" || ch === "_") out += "-";
  }
  return out.replace(/-+/g, "-").replace(/^-|-$/g, "") || "user";
}

export function firstName(name) {
  const cleaned = String(name).replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const toks = cleaned.split(/\s+/).filter(Boolean);
  return toks[0] || String(name);
}

export function fmt(sec) {
  sec = Math.round(sec);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export async function getUserByUid(env, uid) {
  return env.DB.prepare("SELECT * FROM users WHERE uid=?").bind(String(uid)).first();
}

export async function getUserBySlug(env, slug) {
  return env.DB.prepare("SELECT * FROM users WHERE slug=?").bind(slug).first();
}

async function uniqueSlug(env, base) {
  let slug = base, i = 2;
  while (await env.DB.prepare("SELECT 1 FROM users WHERE slug=?").bind(slug).first()) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

/** Create a tracked (hidden) user if not present. Returns the user row. */
export async function ensureUser(env, uid, fullName) {
  uid = String(uid);
  let u = await getUserByUid(env, uid);
  if (u) return u;
  const fn = firstName(fullName || uid);
  const slug = await uniqueSlug(env, translit(fn));
  await env.DB.prepare(
    "INSERT INTO users (uid, slug, first_name, full_name, registered, public, strict) VALUES (?,?,?,?,0,1,0)"
  ).bind(uid, slug, fn, fullName || fn).run();
  return getUserByUid(env, uid);
}

export async function upsertEntry(env, uid, day, seconds, source, messageId = null) {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO entries (uid, day, seconds, source, message_id) VALUES (?,?,?,?,?)"
  ).bind(String(uid), day, Math.round(seconds), source, messageId).run();
}

export async function getEntries(env, uid) {
  const r = await env.DB.prepare(
    "SELECT day, seconds FROM entries WHERE uid=? ORDER BY day ASC"
  ).bind(String(uid)).all();
  return r.results || [];
}

export async function registerUser(env, uid, isPublic = true) {
  await env.DB.prepare("UPDATE users SET registered=1, public=? WHERE uid=?")
    .bind(isPublic ? 1 : 0, String(uid)).run();
}

export async function setPhoto(env, uid, url) {
  await env.DB.prepare("UPDATE users SET photo_url=? WHERE uid=?").bind(url, String(uid)).run();
}

// --- metrics ---
function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function computeStats(entries, now = new Date()) {
  if (!entries.length) return null;
  const series = entries.map((e) => [e.day, e.seconds]);
  const [startDate, start] = series[0];
  const [lastDate, current] = series[series.length - 1];

  // longest consecutive-day streak
  let best = 1, cur = 1;
  for (let i = 1; i < series.length; i++) {
    best = daysBetween(series[i - 1][0], series[i][0]) === 1 ? (cur += 1, Math.max(best, cur)) : (cur = 1, best);
  }

  // comeback: best plank within a return after a >=5 day gap
  let comeback = 0, prev = null;
  for (const [d, s] of series) {
    if (prev && daysBetween(prev, d) >= 5) comeback = Math.max(comeback, s);
    prev = d;
  }

  // comebackCount: how many times they returned after a long (>14 day) pause.
  // Rewards resilience — falling off and getting back up, repeatedly.
  let comebackCount = 0, p = null;
  for (const [d] of series) {
    if (p && daysBetween(p, d) > 14) comebackCount++;
    p = d;
  }

  const todayStr = now.toISOString().slice(0, 10);
  const daysSince = daysBetween(lastDate, todayStr);
  return {
    start, current, startDate, lastDate,
    multiplier: start ? Math.round((current / start) * 100) / 100 : null,
    reports: series.length,
    streak: best,
    comeback,
    comebackCount,
    daysSince,
    active: daysSince <= 14,
    series,
  };
}

/** Registered+public users with computed stats, for the leaderboard. */
export async function listPublicWithStats(env) {
  const users = (await env.DB.prepare(
    "SELECT * FROM users WHERE registered=1 AND public=1"
  ).all()).results || [];
  if (!users.length) return [];
  const placeholders = users.map(() => "?").join(",");
  const allEntries = (await env.DB.prepare(
    `SELECT uid, day, seconds FROM entries WHERE uid IN (${placeholders}) ORDER BY day ASC`
  ).bind(...users.map((u) => u.uid)).all()).results || [];
  const byUid = {};
  for (const e of allEntries) (byUid[e.uid] ||= []).push(e);
  return users
    .map((u) => ({ user: u, stats: computeStats(byUid[u.uid] || []) }))
    .filter((x) => x.stats);
}
