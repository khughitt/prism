---
id: prism-eaf3a8
title: "Roughness (Blur) slider: logarithmic scale"
status: todo
priority: 2
size: s
created: 2026-09-07T00:03:24Z
updated: 2026-09-07T00:03:24Z
depends: []
parent: prism-5758d3
tags: [ui, defs]
---

glass.roughness [0,1] has the steepest response of every swept parameter: per-step Lab RMSE is 0.87-0.90 from 0 to 0.1, 0.36 for 0.1-0.2, and 0.12-0.18 for the rest, so 61% of the total change over the slider happens in its first tenth and the default 0.08 sits in the steep part. The mechanism is pyramid level selection (levels * roughness at ior 1.5), so equal steps buy geometrically less. Switch to scale: logarithmic (as distortionScale already does) or an equivalent transform so the useful 0-0.2 region fills most of the travel. Evidence: niri-material docs/materials/2026-09-06-glass-parameter-sweep-evidence.md, Part 2.
