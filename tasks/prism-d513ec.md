---
id: prism-d513ec
title: Switch all store consumers to durable profile–wallpaper pairs
status: todo
priority: 2
size: l
complexity: high
process: direct
created: 2026-09-20T12:08:08Z
updated: 2026-09-20T12:08:08Z
depends: [prism-95e0d0]
parent: prism-a3484e
tags: [profiles]
agent: codex
spec: docs/specs/2026-09-20-profile-wallpaper-pairs-design.md
plan: docs/plans/2026-09-20-profile-wallpaper-pairs.md
step: "Task 2: Switch all store consumers to durable profile–wallpaper pairs"
---

Implement reviewed plan Task 2 as one independently green cutover: projections, pair transitions/commits, explicit backed-up resumable layout migration, all-pair diagnostics and parameter migration, guarded panel argv. Verify all write prefixes/retries and full just test before commit. No live migration.
