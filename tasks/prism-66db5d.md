---
id: prism-66db5d
title: Investigate intermittent lost updates under the real process lock
status: done
priority: 1
size: s
complexity: mid
process: direct
created: 2026-10-02T10:55:41Z
updated: 2026-10-10T11:55:30Z
completed: 2026-10-10T11:55:30Z
depends: []
tags: [testing]
source: test/lock-multiprocess.test.js
model: claude-opus-5-5
agent: codex
---

Closing verification observed the existing test real child processes serializing on the lock never lose a counter update fail with 23 rather than 24; all 499 tests plus Lua passed on the next run. Lock code and its worker test are unchanged by the tint feature. Trace the reclaim path: it reads an owner token, checks process liveness and then unlinks the path while ordinary acquisition does not share the reclaim guard; a release/exit/new-acquisition interleaving may let reclamation unlink a replacement lock. This is a hypothesis, not a proven cause. Reproduce with a deterministic interleaving, fix the shared lock if confirmed, and verify ordinary, dead-owner and empty-lock contention through the test front door. Do not weaken the existing assertion.

## Notes

- 2026-10-10T11:43:35Z (main): Same defect family as prism-f0e28e (lost update = two holders); investigated and fixed there.
- 2026-10-10T11:55:30Z (prism-f0e28e): done
  provenance: {"harness_session":"claude-code:41589cad-7208-4e6b-b96a-c7169806d7d6","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
- 2026-10-10T11:55:30Z (prism-f0e28e): Same lost update as prism-f0e28e (age-based preemption of a live holder); fixed there, the existing assertion unchanged.
  provenance: {"harness_session":"claude-code:41589cad-7208-4e6b-b96a-c7169806d7d6","harness_session_source":"CLAUDE_CODE_SESSION_ID"}
