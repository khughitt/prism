---
id: prism-63dd45
title: Expose blur noise and saturation per focus state
status: todo
priority: 2
size: m
created: 2026-09-05T02:36:51Z
updated: 2026-09-05T09:06:51Z
depends: [material-1293e8]
tags: [glass, noctalia]
spec: docs/specs/2026-09-05-glass-noise-saturation-focus-state-design.md
---

Goal: the Noctalia Focus matrix gains Noise and Saturation rows, each with a focused and an unfocused slider, and the niri sink writes the values into terminal-glass and terminal-glass-inactive. Mechanism decided 2026-09-05: optional glass { noise; saturation } parameters in niri-material (written value always applies; omission inherits as before), not per-state background-effect emission. Two pieces: the native parameters in niri-material, then the Prism definitions, sink, and tests, which cannot land until the native build is installed because the generated fragment fails niri validate without the grammar.
