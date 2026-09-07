---
id: prism-8e8a18
title: Refraction saturates fast and turns the glass milky
status: done
priority: 2
size: s
owner: slider-ranges
created: 2026-09-06T00:32:53Z
updated: 2026-09-07T00:28:56Z
depends: []
parent: prism-5758d3
tags: [ui, defs]
---

Refraction has range [1, 3]; in practice it saturates quickly and leads to a dull, milky appearance, which is why it is kept very low. Determine where the useful region is (real glass is roughly 1.4 to 1.7) and whether the milkiness is a range problem or a rendering one (frosted backdrop plus bevel at high index). If it is rendering, file the follow-up in niri-material and tighten only the range here.

## Notes

- 2026-09-07T00:03:24Z (main): Data from material-37cec9 (Part 1 of niri-material docs/materials/2026-09-06-glass-parameter-sweep-evidence.md): bevel per-step peaks at ior 1.4 and is a tenth of that by 1.7; from 1.7 to 3 the edge is nearly flat while the face keeps changing monotonically. The useful edge region is about 1.0-1.7, matching real glass. Whether the face change is the milkiness is not settled: the table shows where the image changes, not why, and bending is not measured (material-343f27).
- 2026-09-07T00:28:56Z (slider-ranges): Range half settled: [1,3] -> [1,2], linear, step 0.02. The rendering half is not: the sweep shows the face keeps changing monotonically to ior 3 while the edge is flat past 1.7, and cannot say whether that change is the milkiness (it may be Fresnel or the filament). A niri-material follow-up on what the face change is belongs with material-343f27's instrument; not filed separately because a bending measurement is the prerequisite for attributing it.
- 2026-09-07T00:28:56Z (slider-ranges): Range tightened to [1,2]; the milkiness attribution stays with niri-material's bending instrument (material-343f27).
