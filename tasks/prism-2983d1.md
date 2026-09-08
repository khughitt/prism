---
id: prism-2983d1
title: "Sink apply scripts: print stderr legibly instead of rethrowing raw execFileSync errors"
status: todo
priority: 1
size: s
created: 2026-09-08T15:13:04Z
updated: 2026-09-08T23:30:44Z
depends: []
tags: [errors, dx]
spec: docs/specs/2026-09-08-sink-requirements-design.md
plan: docs/plans/2026-09-08-sink-requirements.md
step: "Task 1: `src/sink.js` and the three apply scripts"
---

Found bringing europa (laptop) up to date on 2026-09-08 after ~3 weeks. Both integrations/niri/apply and integrations/debug-backdrop/apply surfaced failures as Node error objects carrying Buffer(2383) [Uint8Array] [69, 114, ...] dumps, which also flooded prism doctor and dotfiles-health output. The underlying stderr was already readable. Outcome: apply scripts print the child's stderr and exit non-zero, with no Buffer dumps.
