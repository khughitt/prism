---
id: prism-980a29
title: "Glass color sources: familiar tint, source-aware swatches, ring focus axis"
status: todo
priority: 2
size: m
complexity: mid
process: planned
created: 2026-10-02T23:38:52Z
updated: 2026-10-02T23:38:52Z
depends: []
tags: [ui, material]
agent: claude-code/claude-opus-5-5
---

Goal: bring the glass tint and ring color controls in line with each other and with the Focus group's layout. Three pieces, filed as children:
1. Tint source gains 'familiar', matching glass.ring.colorSource (blocked on niri-material's attenuation-tint response).
2. Color pickers show only under the manual source; other sources show read-only swatches of the effective color.
3. The Ring group is organized on the same Unfocused/Focused axis as the Focus group's rows.
Done when all three children close.
