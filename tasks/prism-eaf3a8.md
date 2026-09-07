---
id: prism-eaf3a8
title: "Roughness (Blur) slider: logarithmic scale"
status: done
priority: 2
size: s
owner: slider-ranges
created: 2026-09-07T00:03:24Z
updated: 2026-09-07T00:28:56Z
depends: []
parent: prism-5758d3
tags: [ui, defs]
---

glass.roughness [0,1] has the steepest response of every swept parameter: per-step Lab RMSE is 0.87-0.90 from 0 to 0.1, 0.36 for 0.1-0.2, and 0.12-0.18 for the rest, so 61% of the total change over the slider happens in its first tenth and the default 0.08 sits in the steep part. The mechanism is pyramid level selection (levels * roughness at ior 1.5), so equal steps buy geometrically less. Switch to scale: logarithmic (as distortionScale already does) or an equivalent transform so the useful 0-0.2 region fills most of the travel. Evidence: niri-material docs/materials/2026-09-06-glass-parameter-sweep-evidence.md, Part 2.

## Notes

- 2026-09-07T00:28:56Z (slider-ranges): glass.roughness and glass.inactive.roughness use scale power, exponent 2 over the unchanged [0,1]: 0.1 sits at a third of the travel and 0.4 at two thirds. Exponent 2 rather than 3 because the renderer scales effective roughness by clamp(2*ior-2), so at ior 1.2 the knee sits near 0.25-0.5. Percent labels kept.
