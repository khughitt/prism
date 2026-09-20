---
id: prism-d513ec
title: Deliver durable profile–wallpaper pair store and command guarantees
status: todo
priority: 2
size: l
complexity: high
process: direct
created: 2026-09-20T12:08:08Z
updated: 2026-09-20T12:36:44Z
depends: [prism-95e0d0]
parent: prism-a3484e
tags: [profiles]
agent: codex
spec: docs/specs/2026-09-20-profile-wallpaper-pairs-design.md
plan: docs/plans/2026-09-20-profile-wallpaper-pairs.md
---

Goal split from the reviewed original Task 2: three ordered implementation children cover the atomic store/layout migration cutover, expected-slot guards and all-pair management, and interruption/multiprocess verification. Each child passes full just test independently; no live migration. Controller closes this goal after verifying its children.
