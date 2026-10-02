---
id: prism-67247f
title: Derive glass tint from Noctalia with manual tuning and regression checks
status: todo
priority: 1
size: m
complexity: mid
process: direct
created: 2026-10-02T09:44:26Z
updated: 2026-10-02T09:44:26Z
depends: [prism-0bb71e]
parent: prism-b5cb1e
tags: []
agent: codex
spec: docs/specs/2026-10-02-noctalia-glass-color-design.md
plan: docs/plans/2026-10-02-noctalia-glass-color.md
step: "Task 3: Implement palette-driven tint, controls and regression checks"
---

After the first-landing refresh gate succeeds, implement the required-field palette reader, pure tint derivation, apply consumer selection, defs/rack/manifest controls and 30/35 px defaults. Preserve neutral, bypass, ring and starter profiles; cover both focus states, failure recovery and unchanged store across palette changes. Commit the complete second phase without merging it yet.
