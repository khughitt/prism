---
id: prism-30be80
title: "Depth (thickness) slider: bound the useful region"
status: todo
priority: 2
size: s
created: 2026-09-07T00:03:24Z
updated: 2026-09-07T00:03:24Z
depends: []
parent: prism-5758d3
tags: [ui, defs]
---

glass.thickness [0,200]: bevel per-step peaks at 5-10 px, is a third of that by 20 and about a tenth from 40 on; the face barely moves at distortion 0. The region where a step buys visible edge change is 0-40, a fifth of the range. Either shrink the range (with a hard upper bound near 40-60 px) or use a log scale. Caveat from the same run: the sweep's periodic backdrop makes cumulative numbers past 40 unreliable, so the shape is trustworthy and the exact knee is approximate. Evidence: niri-material docs/materials/2026-09-06-glass-parameter-sweep-evidence.md, Part 2.
