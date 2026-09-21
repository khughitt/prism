---
id: prism-01554f
title: Cut over store readers and writers with idempotent layout migration
status: done
priority: 2
size: l
complexity: high
process: direct
owner: prism-aec90f
created: 2026-09-20T12:36:44Z
updated: 2026-09-20T13:12:19Z
started: 2026-09-20T12:53:47Z
completed: 2026-09-20T13:12:19Z
depends: [prism-95e0d0]
parent: prism-d513ec
tags: [profiles]
agent: codex
spec: docs/specs/2026-09-20-profile-wallpaper-pairs-design.md
plan: docs/plans/2026-09-20-profile-wallpaper-pairs.md
step: "Task 2: Cut over store readers and writers with idempotent layout migration"
---

Reviewed amendment Task 2 (former 2a): atomic reader/writer and fixture format switch, pair transitions/commits, missing/broken-profile recovery preserving scratch, legacy-source guard, and current-store idempotent migrate pairs with immutable per-attempt backups. Existing unqualified commands stay functional; guards and broader discovery are the next child. Full just test before commit; no live migration.

## Notes

- 2026-09-20T12:53:47Z (prism-aec90f): started
  provenance: {"harness_session":"codex:01a0bbd8-f021-7163-9af3-bf80490291a9","harness_session_source":"CODEX_SESSION_ID"}
- 2026-09-20T13:11:47Z (prism-aec90f): Pair/runtime cutover and idempotent layout migration implemented; 427 Node/contract tests plus Lua pass. Ordinary guards reject old sources; recovery validates base/scratch/incoming separately. Malformed shared YAML clear refuses byte-preservingly; parameter-invalid selected pairs remain clearable.
- 2026-09-20T13:12:19Z (prism-aec90f): done
- 2026-09-20T13:12:19Z (prism-aec90f): Cut over look/pair and runtime storage, preserved broken-profile recovery, and added backed-up idempotent layout migration.
