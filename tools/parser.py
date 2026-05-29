"""
Parse plank-time reports from a Telegram chat export.

Strategy: per message, try to extract a duration in seconds, but ONLY when the
message "looks like a report" (duration at the start of a line, or followed by a
done-marker / punctuation / checkmark) — not when the number is buried in a
conversational sentence.

Run:  python3 tools/parser.py
Outputs: a per-person validation table + tools/backfill_data.json
"""
import datetime
import json
import re
import sys
from collections import defaultdict

PATH = "/Users/dstark/Downloads/ChatExport_2026-05-28/result.json"
OUT = "tools/backfill_data.json"

# user_id -> display name overrides (Denis is "Deleted Account"/None in export)
NAME_OVERRIDES = {
    "user419686805": "Denis Stark",
}

# These users post conversationally; use the strict report-only extractor for them.
STRICT_UIDS = {"user419686805"}  # Denis

TODAY = datetime.date(2026, 5, 28)
ACTIVE_DAYS = 14  # reported within this many days of TODAY => "active"

DONE_MARKERS = ("done", "готово", "✅", "☑️", "✔️", "✔", "🙌", "💪", "🔥", "👍")

# --- duration patterns, each returns seconds (float) ---
# H:MM:SS
RE_HMS = re.compile(r"^(\d{1,2}):([0-5]?\d):([0-5]?\d)(?:[.,](\d{1,2}))?")
# MM:SS  with optional ,hh / .hh hundredths
RE_MS = re.compile(r"^(\d{1,2}):([0-5]?\d)(?:[.,](\d{1,2}))?")
# number + minutes word, optional fractional, optional trailing seconds
RE_MIN = re.compile(r"^(\d+)(?:[.,](\d+))?\s*(?:мин(?:ут[аы]?)?|min(?:ute)?s?|m)\b\.?\s*(?:(\d+)\s*(?:сек(?:унд[аы]?)?|sec(?:ond)?s?|s)\b)?", re.I)
# number + seconds word
RE_SEC = re.compile(r"^(\d+)\s*(?:сек(?:унд[аы]?)?|sec(?:ond)?s?|s)\b", re.I)
# bare number that is the WHOLE line (Игорь posts "90" sometimes? keep conservative)
RE_BARE_NUM = re.compile(r"^(\d{1,4})$")

# strip leading emoji / spaces / bullets / quotes
LEAD_JUNK = re.compile(r"^[\s\W_]*", re.UNICODE)
# a date prefix like "9 февраля" / "10 march" to skip
RE_DATE_PREFIX = re.compile(
    r"^\d{1,2}\s*(?:янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек|"
    r"jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[а-яa-z]*\.?\s+", re.I)


def flatten(m):
    t = m.get("text")
    if isinstance(t, str):
        return t
    if isinstance(t, list):
        return "".join(p if isinstance(p, str) else p.get("text", "") for p in t)
    return ""


def strip_lead(s):
    return LEAD_JUNK.sub("", s)


def followed_ok(line, end):
    """After the matched duration, the line must end, or be followed by
    punctuation / whitespace+done-marker / checkmark — NOT continue as a sentence."""
    rest = line[end:]
    if rest == "":
        return True
    # immediate punctuation or checkmark
    if rest[0] in ".,!)✅☑️✔️✔🙌💪🔥👍✓ ":
        # if it's a space, require a done-marker somewhere in the rest, or rest is short
        if rest[0] == " ":
            low = rest.lower()
            if any(mk in low for mk in ("done", "готов", "сек", "sec")):
                return True
            # "2:20 готово", "88 sec done" handled above; otherwise a trailing
            # space + word that's a full comment after a colon-time is fine too.
            return False
        return True
    return False


def parse_line_for_seconds(line, colon_time_lenient):
    """Try to extract seconds from the START of a single line. Returns int or None."""
    s = strip_lead(line)
    s = RE_DATE_PREFIX.sub("", s)  # drop "9 февраля " style prefix
    if not s:
        return None

    m = RE_HMS.match(s)
    if m:
        h, mi, se = int(m.group(1)), int(m.group(2)), int(m.group(3))
        frac = int(m.group(4) or 0) / (100 if m.group(4) and len(m.group(4)) == 2 else 10) if m.group(4) else 0
        if colon_time_lenient or followed_ok(s, m.end()):
            return round(h * 3600 + mi * 60 + se + frac)

    m = RE_MS.match(s)
    if m:
        mi, se = int(m.group(1)), int(m.group(2))
        frac = 0
        if m.group(3):
            frac = int(m.group(3)) / (100 if len(m.group(3)) == 2 else 10)
        # colon-times are strong report signals -> lenient
        if colon_time_lenient or followed_ok(s, m.end()):
            return round(mi * 60 + se + frac)

    m = RE_MIN.match(s)
    if m:
        mins = int(m.group(1))
        fr = int(m.group(2)) / (10 ** len(m.group(2))) if m.group(2) else 0
        extra_sec = int(m.group(3)) if m.group(3) else 0
        if followed_ok(s, m.end()):
            return round(mins * 60 + fr * 60 + extra_sec)

    m = RE_SEC.match(s)
    if m:
        if followed_ok(s, m.end()):
            return int(m.group(1))

    return None


# --- strict extractor (for conversational posters like Denis) ---
LEAD_KEYWORDS = re.compile(r"^(?:планка|plank|сегодня|today)\s+", re.I)
END_DONE = re.compile(r"(?:✔️|✔|☑️|✓|🕔|done|готово|🔥|💪|👍|🙌)\s*$", re.I)
UNIT_ONLY = re.compile(r"(?:мин(?:ут[аы]?)?|min(?:ute)?s?|сек(?:унд[аы]?)?|sec(?:ond)?s?)\.?", re.I)


def match_time_at_start(s):
    """If s starts with a time token, return (seconds:int, end_index). Else (None, 0)."""
    m = RE_HMS.match(s)
    if m:
        h, mi, se = int(m.group(1)), int(m.group(2)), int(m.group(3))
        frac = (int(m.group(4)) / (10 ** len(m.group(4)))) if m.group(4) else 0
        return round(h * 3600 + mi * 60 + se + frac * 60 if False else h * 3600 + mi * 60 + se + frac), m.end()
    m = RE_MS.match(s)
    if m:
        mi, se = int(m.group(1)), int(m.group(2))
        frac = (int(m.group(3)) / (10 ** len(m.group(3)))) if m.group(3) else 0
        return round(mi * 60 + se + frac), m.end()
    m = RE_MIN.match(s)
    if m:
        mins = int(m.group(1))
        fr = int(m.group(2)) / (10 ** len(m.group(2))) if m.group(2) else 0
        extra = int(m.group(3)) if m.group(3) else 0
        return round(mins * 60 + fr * 60 + extra), m.end()
    m = RE_SEC.match(s)
    if m:
        return int(m.group(1)), m.end()
    return None, 0


def extract_report_strict(text):
    """A message is a report only if its first content line STARTS with a time
    token AND (ends with a done-marker OR is just the bare time/unit)."""
    for ln in text.split("\n"):
        if not ln.strip():
            continue
        s = strip_lead(ln)
        s = LEAD_KEYWORDS.sub("", s)        # drop one leading "Планка/Сегодня/..."
        s = strip_lead(s)
        sec, end = match_time_at_start(s)
        if sec is None:
            return None                     # first real line isn't a time -> not a report
        remainder = s[end:].strip()
        if remainder == "" or UNIT_ONLY.fullmatch(remainder) or END_DONE.search(ln):
            return sec if 3 <= sec <= 3600 else None
        return None                         # time followed by a sentence -> conversational
    return None


def extract_report(text):
    """Scan up to first 3 non-empty lines; return seconds from the first that
    parses as a report. colon-times are treated leniently on line 1-2."""
    lines = [ln for ln in text.split("\n")]
    nonempty_seen = 0
    for idx, ln in enumerate(lines):
        if not ln.strip():
            continue
        nonempty_seen += 1
        if nonempty_seen > 3:
            break
        lenient = nonempty_seen <= 2  # greeting-then-time still ok
        sec = parse_line_for_seconds(ln, colon_time_lenient=lenient)
        if sec is not None and 3 <= sec <= 3600:  # sanity band
            return sec
    return None


def main():
    with open(PATH, encoding="utf-8") as f:
        data = json.load(f)
    msgs = data["messages"]

    # per user: date -> seconds (keep last report of the day)
    series = defaultdict(dict)   # uid -> {date: sec}
    names = {}
    for m in msgs:
        if m.get("type") != "message":
            continue
        uid = m.get("from_id")
        if uid is None:
            continue
        names.setdefault(uid, m.get("from"))
        text = flatten(m)
        if not text.strip():
            continue
        if uid in STRICT_UIDS:
            sec = extract_report_strict(text)
        else:
            sec = extract_report(text)
        if sec is None:
            continue
        date = m["date"][:10]
        series[uid][date] = sec  # later same-day report overrides earlier

    # build per-person summary, with light outlier guard
    people = []
    for uid, daymap in series.items():
        items = sorted(daymap.items())  # (date, sec)
        if not items:
            continue
        # outlier guard against conversational false positives.
        # strict uids (Denis): tight symmetric band, catches demo spikes AND dips.
        # others: loose high-only, so legit restarts-after-breaks are kept.
        cleaned = []
        secs = [s for _, s in items]
        strict = uid in STRICT_UIDS
        for i, (d, s) in enumerate(items):
            lo = max(0, i - 2)
            hi = min(len(secs), i + 3)
            window = sorted(secs[lo:hi])
            med = window[len(window) // 2]
            if med > 0 and len(items) > 4:
                if strict and (s > med * 1.7 or s < med * 0.55):
                    continue
                if not strict and s > med * 2.6:
                    continue
            cleaned.append((d, s))
        if not cleaned:
            continue
        start_date, start_sec = cleaned[0]
        last_date, last_sec = cleaned[-1]
        name = NAME_OVERRIDES.get(uid) or names.get(uid) or uid
        days_since = (TODAY - datetime.date.fromisoformat(last_date)).days
        people.append({
            "uid": uid,
            "name": name,
            "start_date": start_date,
            "start_sec": start_sec,
            "last_date": last_date,
            "last_sec": last_sec,
            "reports": len(cleaned),
            "multiplier": round(last_sec / start_sec, 2) if start_sec else None,
            "raw_points": len(items),
            "dropped": len(items) - len(cleaned),
            "days_since_last": days_since,
            "active": days_since <= ACTIVE_DAYS,
            "series": cleaned,
        })

    people.sort(key=lambda p: (not p["active"], -p["reports"]))

    # validation table
    print(f"{'St':2} {'Name':22} {'start':>7} {'→ now':>7} {'×':>5} {'pts':>4} "
          f"{'drop':>4} {'ago':>4}  {'first':10} {'last':10}")
    print("-" * 92)
    for p in people:
        def f(sec):
            return f"{sec//60}:{sec%60:02d}"
        status = "🟢" if p["active"] else "⏸"
        print(f"{status:2} {str(p['name'])[:22]:22} {f(p['start_sec']):>7} {f(p['last_sec']):>7} "
              f"{str(p['multiplier']):>5} {p['reports']:>4} {p['dropped']:>4} "
              f"{str(p['days_since_last'])+'d':>4}  {p['start_date']} {p['last_date']}")
    n_active = sum(1 for p in people if p["active"])
    print(f"\n🟢 active (≤{ACTIVE_DAYS}d): {n_active}    ⏸ paused: {len(people)-n_active}    total: {len(people)}")

    # flag big day-to-day jumps for manual review
    print("\n--- Day-to-day jumps > 25% (possible misparse to review) ---")
    flagged = 0
    for p in people:
        prev = None
        for d, s in p["series"]:
            if prev and prev[1] > 0:
                ratio = s / prev[1]
                if ratio > 1.25 or ratio < 0.6:
                    flagged += 1
                    if flagged <= 30:
                        print(f"  {str(p['name'])[:18]:18} {prev[0]}={prev[1]//60}:{prev[1]%60:02d} "
                              f"→ {d}={s//60}:{s%60:02d}  (x{ratio:.2f})")
            prev = (d, s)
    print(f"  total flagged jumps: {flagged}")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(people, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {len(people)} people to {OUT}")


if __name__ == "__main__":
    main()
