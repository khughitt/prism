---
id: prism-f0e28e
title: Store lock lost an update while reclaiming a dead-pid lock across processes
status: todo
priority: 1
size: s
complexity: high
process: direct
created: 2026-10-02T11:21:58Z
updated: 2026-10-02T11:21:58Z
depends: []
tags: [store, bug]
agent: claude-code/claude-opus-5-5
---

Observed 2026-10-02 in the suite, run during a niri makepkg build (host under load): 'real child processes reclaim a lock pre-seeded with a dead pid, with no lost updates' failed with 'a lost update means the lock did not exclude across processes', actual 23, expected 24. Two immediate reruns passed 499/499, so it is load- or timing-dependent. It is not a flaky assertion: a lost update means two processes held the lock at once during dead-pid reclaim. Likely a race between detecting the dead holder and taking over (two reclaimers both see the dead pid and both write). Reproduce by looping the test under CPU load (e.g. stress-ng) before changing the reclaim path.
