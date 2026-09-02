---
id: prism-a1bf36
title: Restore and wire glass roughness
status: done
priority: 2
size: s
owner: main
created: 2026-09-02T03:33:03Z
updated: 2026-09-02T03:37:53Z
depends: []
tags: [integration, rendering]
plan: docs/plans/2026-09-02-niri-glass-roughness.md
step: "Task 1: Restore and wire glass roughness"
---

## Notes

- 2026-09-02T03:36:54Z (main): Implemented in writable clone because the requested ~/d/prism checkout is read-only in this sandbox; focused definition, exact-KDL, and apply tests pass against native material roughness commit 26c14954.
- 2026-09-02T03:37:53Z (main): Restored glass.roughness at 0.08, wired reload-live native KDL, updated Quick presentation, and passed all 141 Node plus Lua plugin tests.
