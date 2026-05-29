"""Quick exploration of the Telegram export to inform the parser. Read-only."""
import json
import re
from collections import defaultdict, Counter

PATH = "/Users/dstark/Downloads/ChatExport_2026-05-28/result.json"

with open(PATH, encoding="utf-8") as f:
    data = json.load(f)

msgs = data["messages"]
print(f"Total messages: {len(msgs)}")
print(f"Group: {data.get('name')!r}  type={data.get('type')}  id={data.get('id')}")

# message type breakdown
types = Counter(m.get("type") for m in msgs)
print(f"\nMessage types: {dict(types)}")

# how is text stored? string vs list
text_shapes = Counter()
for m in msgs:
    t = m.get("text")
    if isinstance(t, str):
        text_shapes["str"] += 1
    elif isinstance(t, list):
        text_shapes["list"] += 1
    else:
        text_shapes[type(t).__name__] += 1
print(f"text field shapes: {dict(text_shapes)}")


def plain_text(m):
    """Flatten Telegram text (string or list of str/entity dicts) to plain string."""
    t = m.get("text")
    if isinstance(t, str):
        return t
    if isinstance(t, list):
        out = []
        for part in t:
            if isinstance(part, str):
                out.append(part)
            elif isinstance(part, dict):
                out.append(part.get("text", ""))
        return "".join(out)
    return ""


# unique senders among real messages
senders = defaultdict(lambda: {"name": None, "count": 0})
for m in msgs:
    if m.get("type") != "message":
        continue
    fid = m.get("from_id")
    if fid is None:
        continue
    senders[fid]["name"] = m.get("from")
    senders[fid]["count"] += 1

print(f"\nUnique senders (real messages): {len(senders)}")
for fid, info in sorted(senders.items(), key=lambda kv: -kv[1]["count"]):
    print(f"  {fid:>20}  {str(info['name'])[:28]:28}  msgs={info['count']}")

# candidate time reports: first non-empty line is MM:SS or H:MM:SS
FIRST_LINE_TIME = re.compile(r"^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$")
print("\n--- Messages whose FIRST line is a bare time (candidate daily reports) ---")
hits = 0
per_sender_hits = Counter()
for m in msgs:
    if m.get("type") != "message":
        continue
    txt = plain_text(m)
    first_line = txt.split("\n", 1)[0] if txt else ""
    if FIRST_LINE_TIME.match(first_line):
        hits += 1
        per_sender_hits[m.get("from")] += 1
        if hits <= 25:
            extra = " | + comment" if "\n" in txt else ""
            print(f"  {m.get('date')[:10]}  {str(m.get('from'))[:20]:20}  {first_line.strip():>8}{extra}")
print(f"\nTotal candidate time-report messages: {hits}")
print("Per-sender candidate counts:")
for name, c in per_sender_hits.most_common():
    print(f"  {str(name)[:28]:28} {c}")
