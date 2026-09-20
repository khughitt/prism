---
id: prism-01554f
title: Cut over store readers and writers with idempotent layout migration
status: todo
priority: 2
size: l
complexity: high
process: direct
created: 2026-09-20T12:36:44Z
updated: 2026-09-20T12:36:44Z
depends: [prism-95e0d0]
parent: prism-d513ec
tags: [profiles]
agent: codex
spec: docs/specs/2026-09-20-profile-wallpaper-pairs-design.md
plan: docs/plans/2026-09-20-profile-wallpaper-pairs.md
step: "Task 2: Cut over store readers and writers with idempotent layout migration"
---

Reviewed amendment Task 2 (former 2a): atomic reader/writer and fixture format switch, pair transitions/commits, missing/broken-profile recovery preserving scratch, legacy-source guard, and current-store idempotent migrate pairs with immutable per-attempt backups. Existing unqualified commands stay functional; guards and broader discovery are the next child. Full just test before commit; no live migration.
