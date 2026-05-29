"""Investigate parser misses: messages with time-like tokens NOT caught by the
strict first-line-bare-time rule. Read-only."""
import json
import re
from collections import Counter

PATH = "/Users/dstark/Downloads/ChatExport_2026-05-28/result.json"
with open(PATH, encoding="utf-8") as f:
    data = json.load(f)
msgs = data["messages"]


def plain_text(m):
    t = m.get("text")
    if isinstance(t, str):
        return t
    if isinstance(t, list):
        return "".join(p if isinstance(p, str) else p.get("text", "") for p in t)
    return ""


FIRST_LINE_TIME = re.compile(r"^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$")
ANY_MMSS = re.compile(r"\b(\d{1,2}):(\d{2})\b")
MINSEC_WORDS = re.compile(r"\b\d+\s*(мин|min|сек|sec|m|s|минут|секунд)\b", re.I)

# date range
dates = [m["date"][:10] for m in msgs if m.get("type") == "message"]
print(f"Date range: {min(dates)} .. {max(dates)}")

# Confirm the Deleted Account / Denis
denis = [m for m in msgs if m.get("from_id") == "user419686805"]
print(f"\nuser419686805 (reported as Denis/@denisstark77): {len(denis)} msgs, "
      f"names seen: {set(m.get('from') for m in denis)}")

# For two suspicious high-volume senders, show messages that contain a time token
for target in ["Игорь Веретенников", "🍀Юлия🌋"]:
    print(f"\n===== {target}: messages containing a time-like token but NOT a bare first line =====")
    shown = 0
    for m in msgs:
        if m.get("type") != "message" or m.get("from") != target:
            continue
        txt = plain_text(m)
        first = txt.split("\n", 1)[0] if txt else ""
        if FIRST_LINE_TIME.match(first):
            continue  # already captured
        if ANY_MMSS.search(txt) or MINSEC_WORDS.search(txt):
            shown += 1
            if shown <= 12:
                oneline = txt.replace("\n", " / ")[:90]
                print(f"  {m['date'][:10]}  {oneline}")
    print(f"  ... total such messages for {target}: {shown}")

# Global: how many messages have a time token somewhere but fail the strict rule?
near_miss = 0
near_miss_samples = []
for m in msgs:
    if m.get("type") != "message":
        continue
    txt = plain_text(m)
    first = txt.split("\n", 1)[0] if txt else ""
    if FIRST_LINE_TIME.match(first):
        continue
    if ANY_MMSS.search(txt):
        near_miss += 1
        if len(near_miss_samples) < 20:
            near_miss_samples.append((m["date"][:10], str(m.get("from"))[:18], txt.replace("\n", " / ")[:80]))
print(f"\nMessages with an MM:SS token somewhere but failing strict rule: {near_miss}")
print("Samples:")
for d, who, t in near_miss_samples:
    print(f"  {d}  {who:18}  {t}")
