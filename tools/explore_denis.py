"""Dump Denis's (user419686805) messages containing a time token, full text,
to find the signature of his REAL daily reports vs conversational mentions."""
import json, re
PATH = "/Users/dstark/Downloads/ChatExport_2026-05-28/result.json"
UID = "user419686805"
with open(PATH, encoding="utf-8") as f:
    data = json.load(f)

def flatten(m):
    t = m.get("text")
    if isinstance(t, str): return t
    if isinstance(t, list):
        return "".join(p if isinstance(p, str) else p.get("text","") for p in t)
    return ""

ANY_TIME = re.compile(r"\b\d{1,2}:\d{2}\b|\b\d+\s*(?:сек|sec|мин|min)\b", re.I)
msgs = [m for m in data["messages"] if m.get("from_id")==UID and m.get("type")=="message"]
print(f"Denis total messages: {len(msgs)}")
hits = [m for m in msgs if ANY_TIME.search(flatten(m))]
print(f"With a time token: {len(hits)}\n")
for m in hits:
    txt = flatten(m).replace("\n"," / ")
    print(f"{m['date'][:10]}  {txt[:120]}")
