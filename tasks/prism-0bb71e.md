---
id: prism-0bb71e
title: Land the template first and verify the host palette refresh
status: todo
priority: 1
size: s
complexity: mid
process: direct
created: 2026-10-02T09:44:25Z
updated: 2026-10-02T09:44:25Z
depends: [prism-47da20]
parent: prism-b5cb1e
tags: []
agent: codex
spec: docs/specs/2026-10-02-noctalia-glass-color-design.md
plan: docs/plans/2026-10-02-noctalia-glass-color.md
step: "Task 2: Merge the template and verify the host palette"
---

Merge only the template/tests/README phase into main while the original sink remains installed; refresh each rollout host and verify valid primary plus surface before allowing the second phase. Record live paths, main revision, host and output. Failed refresh blocks the second landing; no host pointers may be repointed.
