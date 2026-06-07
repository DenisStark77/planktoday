/**
 * Plank-time report parser. extractReport(text) -> seconds:int | null
 *
 * A REPORT is a line that, after stripping lead-ins (emoji, dates, "сегодня",
 * "планка", report verbs like "держал"), STARTS with a duration and whose
 * remainder is either:
 *   - not a sentence (only emoji / punctuation / unit words / сегодня|вчера), or
 *   - a line ending in a checkmark ✔︎/✅ (covers compound reports like
 *     "5:18 планка и 48 отжиманий ✔️").
 * This is generic for everyone — no per-user strict mode, no required ✔️.
 * Discussion ("я дошёл с 1:30 до 30 минут", "давай в 5:01") never starts with a
 * bare time, so it's rejected. Genuinely ambiguous cases (a time buried after a
 * verb we don't know, "5 мин и 5 мин вчера") fall through to the LLM in bot.js.
 */

const RE_HMS = /^(\d{1,2}):([0-5]?\d):([0-5]?\d)(?:[.,](\d{1,2}))?/;
const RE_MS = /^(\d{1,2}):([0-5]?\d)(?:[.,](\d{1,2}))?/;
const RE_MIN = /^(\d+)(?:[.,](\d+))?\s*(?:мин(?:ут[аы]?|уты)?|min(?:ute)?s?|m)(?![\p{L}])\.?\s*(?:(\d+)\s*(?:сек(?:унд[аы]?)?|sec(?:ond)?s?|s)(?![\p{L}]))?/iu;
const RE_SEC = /^(\d+)\s*(?:сек(?:унд[аы]?)?|sec(?:ond)?s?|s)(?![\p{L}])/iu;

const LEAD_JUNK = /^[^\p{L}\p{N}]+/u;             // leading emoji/space/punct
const DATE_PREFIX = /^\d{1,2}\s*(?:янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\p{L}]*\.?\s+/iu;
// lead-ins that precede a real report: keywords + common "I did" verbs
const REPORT_LEAD = /^(?:планка|plank|сегодня|today|сделал[а]?|держал[а]?|простоял[а]?|постоял[а]?|выстоял[а]?|отстоял[а]?|результат|итог)\s+/i;
// tokens allowed AFTER the time without making it a "sentence"
const UNIT_WORDS = /мин(?:ут[аы]?|уты)?|min(?:ute)?s?|сек(?:унд[аы]?|унды)?|sec(?:ond)?s?/giu;
const TRAIL_WORDS = /сегодня|today|вчера|yesterday|готово|done|всё|ура|сделано/giu;
const CHECK_DONE = /(?:✔️|✔|☑️|✓|✅|🕔)\s*$/u;   // explicit "logged" marker (checkmarks only)

// Any duration-like token ANYWHERE — used by bot.js to decide if an unparsed
// message is "ambiguous" enough to warrant an LLM check (not for extraction).
const TIME_TOKEN = /\d{1,2}:[0-5]\d|\d+(?:[.,]\d+)?\s*(?:мин(?:ут)?|min|сек|sec|час|hour|[mсмs])(?![\p{L}])/iu;
export function hasTimeToken(text) {
  return !!text && TIME_TOKEN.test(text);
}

const stripLead = (s) => s.replace(LEAD_JUNK, "");
const fracSeconds = (g) => (g ? parseInt(g, 10) / Math.pow(10, g.length) : 0);

/** If s starts with a time token, return [seconds:int, endIndex]. Else [null, 0]. */
function matchTimeAtStart(s) {
  let m = RE_HMS.exec(s);
  if (m) return [Math.round((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + fracSeconds(m[4])), m[0].length];
  m = RE_MS.exec(s);
  if (m) return [Math.round((+m[1]) * 60 + (+m[2]) + fracSeconds(m[3])), m[0].length];
  m = RE_MIN.exec(s);
  if (m) {
    const fr = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
    const extra = m[3] ? +m[3] : 0;
    return [Math.round((+m[1]) * 60 + fr * 60 + extra), m[0].length];
  }
  m = RE_SEC.exec(s);
  if (m) return [+m[1], m[0].length];
  return [null, 0];
}

/** True if what follows the time is NOT a sentence (only emoji/punct/units/day-words). */
function isJustTrailing(rest) {
  const r = rest.toLowerCase().replace(UNIT_WORDS, " ").replace(TRAIL_WORDS, " ");
  return r.replace(/[^\p{L}]/gu, "").length === 0;
}

/**
 * Extract a plank time in seconds from a message, or null.
 * @param {string} text
 * @param {boolean} _strict - accepted for backwards compatibility; ignored (the
 *   rule is now generic for all users).
 */
export function extractReport(text, _strict = false) {
  if (!text) return null;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 2);
  for (const line of lines) {
    let s = stripLead(line).replace(DATE_PREFIX, "");
    let prev;
    do { prev = s; s = stripLead(s.replace(REPORT_LEAD, "")); } while (s !== prev);
    const [sec, end] = matchTimeAtStart(s);
    if (sec === null || sec < 3 || sec > 3600) continue;
    if (isJustTrailing(s.slice(end)) || CHECK_DONE.test(line)) return sec;
  }
  return null;
}
