---
id: prism-2cdad7
title: Accept select models and pin panel behavior
status: done
priority: 2
size: s
owner: glass-noise-types
created: 2026-09-07T19:43:19Z
updated: 2026-09-07T20:28:22Z
depends: []
parent: prism-51f23b
tags: [noctalia]
spec: docs/specs/2026-09-06-glass-noise-type-design.md
plan: docs/plans/2026-09-07-glass-noise-type.md
step: "Task 1: Accept select models and pin panel behavior"
---

Fix visibleParamError select fallthrough. Extend the existing Lua harness to accept a select model, verify all three string writes and selected indices, and keep missing-values rejection.

## Notes

- 2026-09-07T20:28:22Z (glass-noise-types): RED: npm run test:plugin-lua failed at section headers missing because valid select was rejected. GREEN: validator accepts select with table values; Lua harness and just test pass.
- 2026-09-07T20:28:22Z (glass-noise-types): Accepted valid select controls and pinned options, zero-based selection writes, and missing-values validation.
