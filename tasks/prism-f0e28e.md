---
id: prism-f0e28e
title: Store lock lost an update while reclaiming a dead-pid lock across processes
status: doing
priority: 1
size: s
complexity: high
process: direct
owner: main
created: 2026-10-02T11:21:58Z
updated: 2026-10-10T11:50:44Z
started: 2026-10-10T11:43:29Z
depends: []
tags: [store, bug]
agent: claude-code/claude-opus-5-5
---

Observed 2026-10-02 in the suite, run during a niri makepkg build (host under load): 'real child processes reclaim a lock pre-seeded with a dead pid, with no lost updates' failed with 'a lost update means the lock did not exclude across processes', actual 23, expected 24. Two immediate reruns passed 499/499, so it is load- or timing-dependent. It is not a flaky assertion: a lost update means two processes held the lock at once during dead-pid reclaim. Likely a race between detecting the dead holder and taking over (two reclaimers both see the dead pid and both write). Reproduce by looping the test under CPU load (e.g. stress-ng) before changing the reclaim path.

## Notes

- 2026-10-10T11:43:29Z (main): started
  provenance: {"harness_session":"claude-code:41589cad-7208-4e6b-b96a-c7169806d7d6","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T11:43:35Z (main): Folding in prism-66db5d (ordinary-contention variant of the same lost update).
- 2026-10-10T11:50:44Z (main): Root cause confirmed: lock.js preempts LIVE holders by age (lock mtime > staleMs 10s; reclaim guard > 5s). A wall-clock jump while processes are frozen (IO stall/suspend under load) makes the first waker reclaim a live lock -> two holders. Repro: 8 real workers SIGSTOPped together 11s mid-run lost exactly 1 update in 4/4 trials (logged age-reclaim of a live token each time, guard-break in one). CPU contention alone (200 trials, 16 hogs on 2 cores) never reproduced. Fix: break locks and guards only on proven holder death (pid+starttime), never by age; guard carries a token; removal is rename-then-verify so a replacement planted after the stale read is restored, not deleted.
