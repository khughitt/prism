---
id: prism-8e8a18
title: Refraction saturates fast and turns the glass milky
status: todo
priority: 2
size: s
created: 2026-09-06T00:32:53Z
updated: 2026-09-07T00:03:24Z
depends: []
parent: prism-5758d3
tags: [ui, defs]
---

Refraction has range [1, 3]; in practice it saturates quickly and leads to a dull, milky appearance, which is why it is kept very low. Determine where the useful region is (real glass is roughly 1.4 to 1.7) and whether the milkiness is a range problem or a rendering one (frosted backdrop plus bevel at high index). If it is rendering, file the follow-up in niri-material and tighten only the range here.

## Notes

- 2026-09-07T00:03:24Z (main): Data from material-37cec9 (Part 1 of niri-material docs/materials/2026-09-06-glass-parameter-sweep-evidence.md): bevel per-step peaks at ior 1.4 and is a tenth of that by 1.7; from 1.7 to 3 the edge is nearly flat while the face keeps changing monotonically. The useful edge region is about 1.0-1.7, matching real glass. Whether the face change is the milkiness is not settled: the table shows where the image changes, not why, and bending is not measured (material-343f27).
