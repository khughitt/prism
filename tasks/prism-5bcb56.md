---
id: prism-5bcb56
title: Verify interruption prefixes and concurrent pair mutations
status: todo
priority: 2
size: m
complexity: high
process: direct
created: 2026-09-20T12:37:07Z
updated: 2026-09-20T12:37:07Z
depends: [prism-fba116]
parent: prism-d513ec
tags: [profiles]
agent: codex
spec: docs/specs/2026-09-20-profile-wallpaper-pairs-design.md
plan: docs/plans/2026-09-20-profile-wallpaper-pairs.md
step: "Task 4: Verify interruption prefixes and concurrent pair mutations"
---

Reviewed amendment Task 4 (former 2c): extend real-filesystem injection to all transition and migration prefixes, current-store rerun/conflict behavior and immutable first-backup preservation, recovery runtime/apply boundary, and multiprocess pair attribution. Minimal source fixes only for demonstrated invariant failures; full just test before commit.
