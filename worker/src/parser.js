/**
 * Plank-time report parser (JS port of tools/parser.py).
 * extractReport(text, strict) -> seconds:int | null
 *
 * - lenient mode (most users): duration at start of a line, or followed by a
 *   done-marker / punctuation — not buried mid-sentence.
 * - strict mode (conversational posters like Denis): first content line must
 *   START with a time AND (end with a done-marker OR be just the bare time).
 */

// duration patterns (anchored at start of a cleaned line)
const RE_HMS = /^(\d{1,2}):([0-5]?\d):([0-5]?\d)(?:[.,](\d{1,2}))?/;
const RE_MS = /^(\d{1,2}):([0-5]?\d)(?:[.,](\d{1,2}))?/;
const RE_MIN = /^(\d+)(?:[.,](\d+))?\s*(?:мин(?:ут[аы]?)?|min(?:ute)?s?|m)(?![\p{L}])\.?\s*(?:(\d+)\s*(?:сек(?:унд[аы]?)?|sec(?:ond)?s?|s)(?![\p{L}]))?/iu;
const RE_SEC = /^(\d+)\s*(?:сек(?:унд[аы]?)?|sec(?:ond)?s?|s)(?![\p{L}])/iu;

const LEAD_JUNK = /^[^\p{L}\p{N}]+/u;            // strip leading emoji/space/punct (keep letters/digits)
const DATE_PREFIX = /^\d{1,2}\s*(?:янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[\p{L}]*\.?\s+/iu;
const LEAD_KEYWORDS = /^(?:планка|plank|сегодня|today)\s+/i;
const END_DONE = /(?:✔️|✔|☑️|✓|🕔|done|готово|🔥|💪|👍|🙌)\s*$/iu;
const UNIT_ONLY = /^(?:мин(?:ут[аы]?)?|min(?:ute)?s?|сек(?:унд[аы]?)?|sec(?:ond)?s?)\.?$/iu;
const DONE_HINT = /(done|готов|сек|sec)/i;

function stripLead(s) {
  return s.replace(LEAD_JUNK, "");
}

function fracSeconds(group) {
  if (!group) return 0;
  return parseInt(group, 10) / Math.pow(10, group.length);
}

/** If s starts with a time token, return [seconds:int, endIndex]. Else [null, 0]. */
function matchTimeAtStart(s) {
  let m = RE_HMS.exec(s);
  if (m) {
    const sec = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + fracSeconds(m[4]);
    return [Math.round(sec), m[0].length];
  }
  m = RE_MS.exec(s);
  if (m) {
    const sec = (+m[1]) * 60 + (+m[2]) + fracSeconds(m[3]);
    return [Math.round(sec), m[0].length];
  }
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

/** After the matched duration, line must end / be punctuation / done-marker — not a sentence. */
function followedOk(line, end) {
  const rest = line.slice(end);
  if (rest === "") return true;
  const c = rest[0];
  if (".,!)✅☑️✔️✔🕔🙌💪🔥👍✓ ".includes(c)) {
    if (c === " ") return DONE_HINT.test(rest);
    return true;
  }
  return false;
}

function parseLineForSeconds(line, colonLenient) {
  let s = stripLead(line).replace(DATE_PREFIX, "");
  if (!s) return null;

  let m = RE_HMS.exec(s);
  if (m && (colonLenient || followedOk(s, m[0].length))) {
    return Math.round((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + fracSeconds(m[4]));
  }
  m = RE_MS.exec(s);
  if (m && (colonLenient || followedOk(s, m[0].length))) {
    return Math.round((+m[1]) * 60 + (+m[2]) + fracSeconds(m[3]));
  }
  m = RE_MIN.exec(s);
  if (m && followedOk(s, m[0].length)) {
    const fr = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
    const extra = m[3] ? +m[3] : 0;
    return Math.round((+m[1]) * 60 + fr * 60 + extra);
  }
  m = RE_SEC.exec(s);
  if (m && followedOk(s, m[0].length)) return +m[1];
  return null;
}

function extractLenient(text) {
  const lines = text.split("\n");
  let seen = 0;
  for (const ln of lines) {
    if (!ln.trim()) continue;
    seen++;
    if (seen > 3) break;
    const sec = parseLineForSeconds(ln, seen <= 2);
    if (sec !== null && sec >= 3 && sec <= 3600) return sec;
  }
  return null;
}

function extractStrict(text) {
  for (const ln of text.split("\n")) {
    if (!ln.trim()) continue;
    let s = stripLead(ln).replace(LEAD_KEYWORDS, "");
    s = stripLead(s);
    const [sec, end] = matchTimeAtStart(s);
    if (sec === null) return null;                 // first real line isn't a time
    const remainder = s.slice(end).trim();
    if (remainder === "" || UNIT_ONLY.test(remainder) || END_DONE.test(ln)) {
      return sec >= 3 && sec <= 3600 ? sec : null;
    }
    return null;                                    // time followed by a sentence
  }
  return null;
}

export function extractReport(text, strict = false) {
  if (!text) return null;
  return strict ? extractStrict(text) : extractLenient(text);
}
