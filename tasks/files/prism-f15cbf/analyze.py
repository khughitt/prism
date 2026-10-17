"""Summarise PRISMPROBE spans written to noctalia.log since a saved offset.

usage: analyze.py <offset-file> <out.json>

The offset file holds `<inode> <byte offset>` of noctalia.log when the session
started. If the log rotated since, the rest of that inode is read from
noctalia.log.1 before the current file.
"""
import json
import re
import statistics
import sys
from pathlib import Path

LOG = Path.home() / ".cache/noctalia/noctalia.log"
PROBE = re.compile(r"PRISMPROBE (\d+) (\w+) (\d+) (\S+) ([\d.]+)")
BUDGET = re.compile(r"exceeded its CPU budget|disabled after repeated timeouts", re.I)

inode, offset = (int(x) for x in Path(sys.argv[1]).read_text().split())
text = ""
if LOG.stat().st_ino != inode:
    old = LOG.with_name("noctalia.log.1")
    assert old.stat().st_ino == inode, "log rotated more than once; read it by hand"
    with old.open("rb") as f:
        f.seek(offset)
        text += f.read().decode("utf-8", "replace")
    offset = 0
with LOG.open("rb") as f:
    f.seek(offset)
    text += f.read().decode("utf-8", "replace")

spans = {}
budget = []
for line in text.splitlines():
    if BUDGET.search(line) and "prism" in line:
        budget.append(line)
    m = PROBE.search(line)
    if not m:
        continue
    nonce, tag, seq, label, ms = m.groups()
    spans.setdefault(tag, []).append({"nonce": nonce, "seq": int(seq), "label": label, "ms": float(ms)})


def stats(values):
    if not values:
        return None
    return {"n": len(values), "median": round(statistics.median(values), 3), "max": round(max(values), 3), "min": round(min(values), 3)}


summary = {}
for tag, rows in spans.items():
    by = {}
    for r in rows:
        if r["label"] == "coldStart":
            continue
        by.setdefault(r["label"], []).append(r["ms"])
    summary[tag] = {label: stats(v) for label, v in sorted(by.items())}
    summary[tag]["nonces"] = sorted({r["nonce"] for r in rows})

variants = {}
for tag, rows in spans.items():
    v = tag[0]
    for r in rows:
        if r["label"] != "coldStart":
            variants.setdefault(v, {}).setdefault(r["label"], []).append(r["ms"])
pooled = {v: {label: stats(x) for label, x in sorted(by.items())} for v, by in variants.items()}

result = {"perActivation": summary, "pooled": pooled, "budgetLines": budget}
Path(sys.argv[2]).write_text(json.dumps({"spans": spans, **result}, indent=2))
print(json.dumps(result, indent=2))
