---
id: prism-1cda51
title: Fix false edit count after panel profile selection
status: done
priority: 2
size: s
complexity: mid
process: direct
owner: prism-aec90f
created: 2026-09-20T11:47:14Z
updated: 2026-09-20T11:55:42Z
started: 2026-09-20T11:49:36Z
completed: 2026-09-20T11:55:42Z
depends: []
parent: prism-aec90f
tags: [profiles]
agent: codex
---

Manual acceptance: selecting a profile reports about20 edits; close/reopen reports0. Reproduce panel state/queue path, fix root cause, cover programmatic profile changes without fabricating scratch edits.

## Notes

- 2026-09-20T11:49:36Z (prism-aec90f): started
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T11:52:23Z (prism-aec90f): Reproduced in Lua lifecycle harness and confirmed native callback path: programmatic slider setValue emits onChange; beginDrag falsely marks edits and leaves drag active, blocking refresh; closing/reopening clears drag. Minimal fix ignores callbacks equal to currently rendered slider value.
- 2026-09-20T11:55:42Z (prism-aec90f): done
- 2026-09-20T11:55:42Z (prism-aec90f): Ignored model-equal slider callbacks so profile selection keeps the scratch edit count and polling accurate; lifecycle regression and full suite pass
